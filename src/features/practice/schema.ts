import { z } from "zod";

/**
 * Generated practice questions (FR-C2, US-F3, Sprint 45).
 *
 * **Flat, not a discriminated union.** A union becomes `anyOf` in the JSON
 * schema we hand the provider, and structured-output support for `anyOf` is
 * uneven across the three in the chain — a schema that only Groq honours is a
 * schema that silently degrades on the fallback. One shape with a `type` field
 * is understood everywhere, and the per-type rules are enforced by
 * `usableQuestion` below rather than by the wire format.
 *
 * **The rules are a filter, not a rejection.** Refusing the whole set because
 * one MCQ listed an answer that was not among its own choices throws away nine
 * good questions and a paid generation to punish the tenth. Bad questions are
 * dropped; the rest are kept.
 */

export const QUESTION_TYPES = ["mcq", "true_false", "identification", "short_answer"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const questionSetSchema = z.object({
  questions: z
    .array(
      z.object({
        type: z.enum(QUESTION_TYPES),
        prompt: z.string().min(1).max(600),
        /**
         * The options, for `mcq` only. Empty for every other type.
         *
         * Not optional: `zodResponseFormat` emits strict JSON schema, where an
         * absent key is a validation error rather than a default. An empty
         * array is the same information and survives the round trip.
         */
        choices: z.array(z.string().min(1).max(300)).max(5),
        /**
         * The answer, as text.
         *
         * For `mcq` it must equal one of the choices exactly — matching on the
         * letter would break the moment a model reordered them. For
         * `true_false` it is "True" or "False". For the written types it is the
         * answer a student should have given.
         */
        answer: z.string().min(1).max(600),
        /**
         * Why. Required, because a question a student got wrong and cannot
         * learn from is a question that only told them they are behind.
         */
        explanation: z.string().min(1).max(800),
      }),
    )
    .min(4)
    .max(20),
});

export type GeneratedQuestion = z.infer<typeof questionSetSchema>["questions"][number];

/**
 * Is this question actually answerable?
 *
 * Every rule here has a failure it prevents on screen: an MCQ whose answer is
 * not among its options can only be got wrong; a true/false question with a
 * third answer cannot be rendered by two buttons; duplicate choices make two
 * options correct.
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
      return /^(true|false)$/i.test(answer);
    default:
      /* Written answers only need to be short enough to mark. A "short answer"
         of two hundred words is an essay, and nothing downstream can grade it
         against what a student typed. */
      return answer.length <= 300;
  }
}

export const QUESTION_PROMPT = [
  "Write practice questions on the revision aid above.",
  "",
  "Mix the four types, weighted toward multiple choice and identification:",
  '- "mcq" — four options in `choices`, and `answer` must be one of them WORD',
  "  FOR WORD. Wrong options must be plausible to someone who half-read the",
  "  material; an obviously silly option teaches nothing and wastes the question.",
  '- "true_false" — `answer` is exactly "True" or "False". Leave `choices` empty.',
  '- "identification" — the student names a term or a person. `answer` is that',
  "  name. Leave `choices` empty.",
  '- "short_answer" — one or two sentences. `answer` is a model answer. Leave',
  "  `choices` empty.",
  "",
  "Every question must:",
  "- test one thing the revision aid actually covers — no outside knowledge, and",
  "  nothing you inferred beyond what it says;",
  "- be answerable from understanding rather than from recognising a phrase;",
  "- carry an `explanation` that says WHY the answer is right, not just what it",
  "  is. A student reads this after getting it wrong.",
  "",
  "Do not ask about the reviewer itself, its structure, or how many concepts it",
  "lists. Ask about the subject.",
].join("\n");
