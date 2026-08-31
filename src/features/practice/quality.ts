/* TYPE-ONLY, deliberately. Node erases a type-only import, which is what
   lets `scripts/practice-quality-test.mjs` load this module directly with no
   build step and no loader — the same trick `markdown-blocks.ts` relies on.
   A runtime import of `./schema` here would break that. */
import type { GeneratedQuestion } from "./schema";

/**
 * Question quality: deduplication, answer verification, choice order
 * (Sprint 48).
 *
 * **Deterministic, not a second model call**, and that is the sprint's main
 * decision. "Verify generated answers" could mean asking a model to mark its
 * own homework, which would double the quota cost of every practice set and add
 * a second thing that can hallucinate. The failure modes actually worth
 * catching are structural — an answer quoted inside its own question, a named
 * term that appears nowhere in the source, the same fact asked twice — and
 * every one of them is checkable with string work that costs nothing and cannot
 * itself be wrong about a subject it does not understand.
 *
 * A model call would still be the right tool for "is this explanation
 * pedagogically sound". That is not what this pass claims to do.
 *
 * Everything here is a FILTER, following the schema's rule: one bad question
 * never throws away the nine good ones it was generated with.
 */

/** Why a question was dropped. Recorded so the handler can say what happened. */
export type RejectionReason =
  | "unusable"
  | "answer_in_prompt"
  | "answer_not_grounded"
  | "duplicate"
  | "duplicate_answer"
  | "self_referential";

export type Rejection = { reason: RejectionReason; prompt: string };

/* Words carrying no distinguishing signal. Kept deliberately short: a long
   stoplist starts removing subject vocabulary, and "cell", "state" and "force"
   are content words in some subjects and filler in others. */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "than",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "this",
  "to",
  "was",
  "were",
  "what",
  "when",
  "which",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

/** Lowercase, fold smart quotes, strip punctuation, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Content words only, for comparing what two questions are actually about. */
export function contentTokens(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

/**
 * Jaccard overlap of content words: shared / total distinct.
 *
 * Chosen over edit distance because the duplicates a model actually produces
 * are rephrasings, not typos — "What is osmosis?" and "Define osmosis." share
 * their content words and share almost no characters in order.
 */
export function similarity(a: string, b: string): number {
  const left = contentTokens(a);
  const right = contentTokens(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/**
 * Containment: shared / the SMALLER token set.
 *
 * Needed because Jaccard alone cannot see the duplicates that actually occur.
 * Measured on real pairs:
 *
 * | Pair | Jaccard | Containment |
 * |---|---|---|
 * | "What is osmosis?" / "Define osmosis." | 0.50 | 1.00 |
 * | "What is the function of the mitochondria?" / "What do the mitochondria do?" | 0.50 | 1.00 |
 * | "Define diffusion." / "Define osmosis." | 0.33 | 0.50 |
 *
 * A short question carries one or two content words, so a rephrasing scores
 * only ~0.5 on Jaccard while a genuinely different question scores 0.33 — the
 * two are not separable by one Jaccard threshold. Containment separates them
 * cleanly, but only for short prompts, which is why the rule below uses both.
 */
export function containment(a: string, b: string): number {
  const left = contentTokens(a);
  const right = contentTokens(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

/** Jaccard high enough that two longer questions are the same question. */
export const DUPLICATE_THRESHOLD = 0.6;

/**
 * The rule, and its honest limits.
 *
 * Two tests, because one does not work across prompt lengths:
 *  - **Longer prompts** — Jaccard at 0.6. They carry enough content words for
 *    proportional overlap to mean something.
 *  - **Short prompts** (two content words or fewer) — full containment. If
 *    everything one question is about is also in the other, it is the same
 *    question asked twice.
 *
 * KNOWN LIMIT, worth stating rather than discovering later: this is lexical, so
 * "Which organelle produces ATP?" and "What is the powerhouse of the cell?"
 * score 0.00 on both tests and both survive. Catching that needs embeddings —
 * which this codebase has, but at one call per question pair it would cost more
 * than the generation it is checking. Lexical dedupe removes the repeats a
 * model actually produces, which are rephrasings of its own wording.
 *
 * It also errs toward dropping: "What is osmosis?" alongside "Explain how
 * osmosis affects plant cells" is treated as a repeat. Within one set at one
 * difficulty that is the right call, and a slightly shorter set beats a set
 * that visibly asks the same thing twice.
 */
export function isDuplicatePrompt(a: string, b: string): boolean {
  const smaller = Math.min(contentTokens(a).size, contentTokens(b).size);
  if (smaller === 0) return false;
  if (smaller <= 2) return containment(a, b) >= 0.9;
  return similarity(a, b) >= DUPLICATE_THRESHOLD;
}

/**
 * Is this question actually answerable?
 *
 * Moved here from `schema.ts` in Sprint 48: it is the first of several quality
 * checks rather than part of the wire format, and keeping the whole pass in one
 * module is what lets the test script exercise it.
 *
 * Every rule has a failure it prevents on screen: an MCQ whose answer is not
 * among its options can only be got wrong; a true/false question with a third
 * answer cannot be rendered by two buttons; duplicate choices make two options
 * correct.
 */
export function usableQuestion(question: GeneratedQuestion): boolean {
  const answer = question.answer.trim();
  if (!answer) return false;

  switch (question.type) {
    case "mcq": {
      const choices = question.choices.map((choice) => choice.trim()).filter(Boolean);
      return (
        choices.length >= 3 &&
        new Set(choices.map((choice) => choice.toLowerCase())).size === choices.length &&
        choices.some((choice) => choice.toLowerCase() === answer.toLowerCase())
      );
    }
    case "true_false":
      return /^(?:true|false)$/i.test(answer);
    default:
      /* Written answers only need to be short enough to mark. A "short answer"
         of two hundred words is an essay, and nothing downstream can grade it
         against what a student typed. */
      return answer.length <= 300;
  }
}

/**
 * Does the question hand over its own answer?
 *
 * The observed failure: "What is photosynthesis, the process by which plants
 * convert light into chemical energy?" with that clause as the answer. It reads
 * as a real question and is worth nothing.
 *
 * `true_false` is exempt — its answer is the word "True" or "False", which can
 * appear in a legitimate prompt.
 */
export function answerLeaksIntoPrompt(question: GeneratedQuestion): boolean {
  if (question.type === "true_false") return false;

  const answer = normalize(question.answer);

  /* One-word answers are excluded: a single word that also appears in the
     question is usually correct behaviour rather than a leak — identification
     questions routinely name the thing they ask about ("Which organelle
     produces ATP?" / "mitochondrion" shares nothing, but "Define osmosis" /
     "osmosis" would trip a naive check). */
  if (answer.split(" ").length < 2) return false;

  return normalize(question.prompt).includes(answer);
}

/**
 * Is the answer traceable to the material?
 *
 * Only applied where it is fair. An `identification` answer is a term or a name
 * and must occur in the source; an `mcq` answer is quoted from it. A
 * `short_answer` is a model answer in the model's own words, and demanding it
 * appear verbatim would reject correct paraphrase — which is the entire point of
 * a written answer. `true_false` has nothing to trace.
 *
 * Tested per content word rather than as a whole string, because the source may
 * hyphenate or inflect differently.
 */
export function answerIsGrounded(question: GeneratedQuestion, sourceTokens: Set<string>): boolean {
  if (question.type === "short_answer" || question.type === "true_false") return true;

  const words = [...contentTokens(question.answer)];
  if (words.length === 0) return true;

  /* Identification is held to every word: a named term the material never
     mentions is the clearest single sign of a hallucinated question. */
  if (question.type === "identification") return words.every((word) => sourceTokens.has(word));

  /* MCQ: a majority, not all. A correct option can carry connective wording of
     its own ("increases as temperature rises") that the source phrases
     differently, and rejecting on one such word would drop good questions. */
  const found = words.filter((word) => sourceTokens.has(word)).length;
  return found / words.length >= 0.5;
}

/** Asking about the document rather than about the subject. */
export function isSelfReferential(prompt: string): boolean {
  return /\b(?:this|the)\s+(?:reviewer|summary|revision aid|document|passage|text|material)\b/i.test(
    prompt,
  );
}

/**
 * Reorder an MCQ's options deterministically.
 *
 * Models place the correct option first or second far more often than chance,
 * and a student notices that pattern long before they notice they are learning.
 *
 * The shuffle is seeded from the question's own text, so it is STABLE across
 * retries: a regenerated set does not reshuffle into a different order and make
 * a student think the questions changed. `Math.random()` would.
 *
 * `answer` is stored as TEXT, not as an index or a letter, so moving the options
 * cannot desynchronise it — which was the reason for storing it that way.
 */
export function orderChoices(question: GeneratedQuestion): GeneratedQuestion {
  if (question.type !== "mcq" || question.choices.length < 2) return question;

  /* FNV-1a over the prompt: small, dependency-free, and stable across
     processes. */
  let hash = 0x811c9dc5;
  for (const char of question.prompt) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  const choices = [...question.choices];
  // Fisher-Yates, driven by an LCG seeded from that hash.
  for (let i = choices.length - 1; i > 0; i -= 1) {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    const j = hash % (i + 1);
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return { ...question, choices };
}

/**
 * The whole pipeline: verify, deduplicate, order.
 *
 * ORDER MATTERS. Verification runs before deduplication so a bad question
 * cannot occupy the slot its good near-duplicate would have taken — dedupe keeps
 * the FIRST of a colliding pair, so letting an unverified one through first
 * would drop the better one.
 */
export function selectQuestions(
  questions: GeneratedQuestion[],
  source: string,
): { kept: GeneratedQuestion[]; dropped: Rejection[] } {
  const sourceTokens = contentTokens(source);
  const kept: GeneratedQuestion[] = [];
  const dropped: Rejection[] = [];
  const seenAnswers = new Set<string>();

  for (const question of questions) {
    const reject = (reason: RejectionReason) => dropped.push({ reason, prompt: question.prompt });

    if (!usableQuestion(question)) {
      reject("unusable");
      continue;
    }
    if (isSelfReferential(question.prompt)) {
      reject("self_referential");
      continue;
    }
    if (answerLeaksIntoPrompt(question)) {
      reject("answer_in_prompt");
      continue;
    }
    if (!answerIsGrounded(question, sourceTokens)) {
      reject("answer_not_grounded");
      continue;
    }

    /* Same fact, asked twice. Only for the types where an identical answer
       really does mean a repeat: "True" appearing twice is expected, and two
       short answers can legitimately share a model answer. */
    const answerKey = `${question.type}:${normalize(question.answer)}`;
    if (
      (question.type === "identification" || question.type === "mcq") &&
      seenAnswers.has(answerKey)
    ) {
      reject("duplicate_answer");
      continue;
    }

    if (kept.some((existing) => isDuplicatePrompt(existing.prompt, question.prompt))) {
      reject("duplicate");
      continue;
    }

    seenAnswers.add(answerKey);
    kept.push(orderChoices(question));
  }

  return { kept, dropped };
}
