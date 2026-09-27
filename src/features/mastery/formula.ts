/**
 * Topic mastery (FR-P2, US-H1, Sprint 56).
 *
 * **Computed from the answers, not accumulated in a tally.** Until now mastery
 * was `progress.questions_correct / questions_answered`, a counter that only
 * ever added. It could not forget, so a topic a student failed in week one and
 * has since learned stayed dragged down by week one for ever; it could not tell
 * an easy question from a hard one; and it could not follow a mark the student
 * overruled, because `record_practice` has no way to take a point back. All of
 * that is information `quiz_answers` already holds — one row per question
 * answered, with its date and its verdict — so the figure is derived from
 * there, at read time, and every one of those problems goes away together.
 *
 * Four rules, each written down because each one changes the number:
 *
 *  1. **A question counts once — its most recent answer.** Drilling the same
 *     question ten times is one piece of evidence, not ten, and getting it
 *     right on the tenth try is where the student IS. This is also what makes
 *     improvement visible at all.
 *  2. **Recent answers count more.** Each answer's weight halves every
 *     `HALF_LIFE_DAYS`. Knowledge fades and learning happens; a month-old
 *     result is half as much evidence about today as one from this morning.
 *  3. **Difficulty weighs the verdict, asymmetrically.** A hard question
 *     answered right says more than an easy one; an easy one answered WRONG
 *     says more than a hard one. Symmetric weighting would let a student
 *     raise their mastery by failing hard questions, which is backwards.
 *  4. **Thin evidence is pulled toward the middle.** Two phantom answers at
 *     50% are added to every topic, so one lucky answer reads as 67% rather
 *     than 100%, and one unlucky one as 33% rather than zero. It fades to
 *     nothing as real evidence accumulates, and it never shows on screen —
 *     below `LOW_EVIDENCE_QUESTIONS` no percentage is shown at all.
 *
 * Flashcards are NOT evidence here, and that is deliberate. Pressing "I had it"
 * is a student's own judgement of their recall; answering a question is marked
 * by someone else. Mixing them would make mastery partly self-reported.
 */

/**
 * Mastery below this is "needs work" (FR-G3). Defined here, beside the formula
 * that produces the number it is compared with, and re-exported from
 * `@/types` — so the threshold the UI shows and the one the engine uses cannot
 * drift apart.
 */
export const WEAK_TOPIC_THRESHOLD = 0.6;

/**
 * Below this many distinct questions a mastery percentage is not trustworthy,
 * and the UI must say so instead of showing a confident number (US-H1).
 */
export const LOW_EVIDENCE_QUESTIONS = 10;

export const HALF_LIFE_DAYS = 30;

/** How far back "improvement" looks. Two weeks is a revision cycle. */
export const IMPROVEMENT_WINDOW_DAYS = 14;

/** At or above this, a topic is strong. Paired with `WEAK_TOPIC_THRESHOLD`. */
export const STRONG_TOPIC_THRESHOLD = 0.8;

const PRIOR_WEIGHT = 2;
const PRIOR_VALUE = 0.5;
const DAY = 86_400_000;

export type Difficulty = "easy" | "medium" | "hard";

/** One answer to one question. */
export type Evidence = {
  questionId: string;
  topicId: string | null;
  subjectId: string;
  correct: boolean;
  answeredAt: string;
  difficulty: Difficulty;
};

export type Mastery = {
  /** 0–1. Shown only when `questions` reaches `LOW_EVIDENCE_QUESTIONS`. */
  mastery: number;
  /** Distinct questions answered — the evidence behind the figure. */
  questions: number;
  lastAnsweredAt: string;
  /**
   * Change against the same formula as it stood `IMPROVEMENT_WINDOW_DAYS` ago,
   * in 0–1 terms. Null unless BOTH ends had enough evidence: comparing today
   * against a topic that had three answers a fortnight ago would measure the
   * arrival of evidence, not the arrival of knowledge.
   */
  improvement: number | null;
  band: "weak" | "developing" | "strong" | "unmeasured";
};

const RIGHT_WEIGHT: Record<Difficulty, number> = { easy: 0.75, medium: 1, hard: 1.25 };
const WRONG_WEIGHT: Record<Difficulty, number> = { easy: 1.25, medium: 1, hard: 0.75 };

/** The newest answer to each question, answered no later than `asOf`. */
function latestPerQuestion(evidence: Evidence[], asOf: number): Evidence[] {
  const latest = new Map<string, Evidence>();
  for (const answer of evidence) {
    const at = Date.parse(answer.answeredAt);
    if (at > asOf) continue;
    const current = latest.get(answer.questionId);
    if (!current || Date.parse(current.answeredAt) < at) latest.set(answer.questionId, answer);
  }
  return [...latest.values()];
}

/** The formula itself, over one topic's (or subject's) evidence. */
function score(evidence: Evidence[], asOf: number): { mastery: number; questions: number } {
  const answers = latestPerQuestion(evidence, asOf);

  let right = PRIOR_WEIGHT * PRIOR_VALUE;
  let total = PRIOR_WEIGHT;

  for (const answer of answers) {
    const ageDays = Math.max(0, (asOf - Date.parse(answer.answeredAt)) / DAY);
    const recency = 0.5 ** (ageDays / HALF_LIFE_DAYS);
    const weight =
      recency *
      (answer.correct ? RIGHT_WEIGHT[answer.difficulty] : WRONG_WEIGHT[answer.difficulty]);
    total += weight;
    if (answer.correct) right += weight;
  }

  return { mastery: right / total, questions: answers.length };
}

export function bandFor(mastery: number, questions: number): Mastery["band"] {
  if (questions < LOW_EVIDENCE_QUESTIONS) return "unmeasured";
  if (mastery < WEAK_TOPIC_THRESHOLD) return "weak";
  if (mastery >= STRONG_TOPIC_THRESHOLD) return "strong";
  return "developing";
}

/**
 * Mastery for one group of evidence — a topic, or a whole subject.
 *
 * `now` is passed in rather than read, so the same evidence always produces
 * the same number in a test, and so a page renders every figure against one
 * clock reading instead of several that straddle a boundary.
 */
export function masteryOf(evidence: Evidence[], now: number): Mastery | null {
  if (evidence.length === 0) return null;

  const current = score(evidence, now);
  const earlier = score(evidence, now - IMPROVEMENT_WINDOW_DAYS * DAY);

  const improvement =
    current.questions >= LOW_EVIDENCE_QUESTIONS && earlier.questions >= LOW_EVIDENCE_QUESTIONS
      ? current.mastery - earlier.mastery
      : null;

  const lastAnsweredAt = evidence.reduce(
    (latest, answer) => (answer.answeredAt > latest ? answer.answeredAt : latest),
    evidence[0].answeredAt,
  );

  return {
    mastery: current.mastery,
    questions: current.questions,
    lastAnsweredAt,
    improvement,
    band: bandFor(current.mastery, current.questions),
  };
}

/** Group evidence by a key and score each group. */
export function masteryBy(
  evidence: Evidence[],
  key: (answer: Evidence) => string | null,
  now: number,
): Map<string, Mastery> {
  const groups = new Map<string, Evidence[]>();
  for (const answer of evidence) {
    const id = key(answer);
    if (!id) continue;
    const group = groups.get(id);
    if (group) group.push(answer);
    else groups.set(id, [answer]);
  }

  const result = new Map<string, Mastery>();
  for (const [id, group] of groups) {
    const mastery = masteryOf(group, now);
    if (mastery) result.set(id, mastery);
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Weakness detection (Sprint 59)                                             */
/* -------------------------------------------------------------------------- */

/**
 * Four reasons a topic needs practice, and a low score is only one of them.
 *
 *  - **weak** — measured, and below `WEAK_TOPIC_THRESHOLD`. The obvious one,
 *    and the only one the product flagged before this.
 *  - **slipping** — measured, and down `SLIPPING_DROP` or more on a fortnight
 *    ago. A topic falling from 85% to 68% is invisible to a threshold until it
 *    crosses it, which is too late to be useful.
 *  - **stale** — measured, not yet strong, and untouched for `STALE_DAYS`. The
 *    formula already discounts old answers; this says out loud that a 72%
 *    nobody has looked at in five weeks is a 72% about the past.
 *  - **untested** — there are files for it and not enough answers to know.
 *    Leaving these out made an untested topic look exactly like a fine one,
 *    and before an exam that is the most dangerous kind of silence.
 *
 * One reason per topic — the most urgent — so the list is a list of topics,
 * not a list of complaints about the same topic.
 */
export type AttentionKind = "weak" | "slipping" | "stale" | "untested";

/**
 * What the wrong answers have in common, when the evidence says.
 *
 *  - **fundamentals** — easy questions are being missed. Hard practice would
 *    only add frustration; the basics come first.
 *  - **harder** — the easy questions are fine and the hard ones are not. More
 *    easy practice would feel productive and teach nothing.
 *
 * Null when there are too few answers at either difficulty to tell, which is
 * often. Guessing a pattern from two answers would be worse than not saying.
 */
export type Pattern = "fundamentals" | "harder" | null;

export type Attention = {
  topicId: string;
  kind: AttentionKind;
  mastery: number | null;
  questions: number;
  improvement: number | null;
  /** Days since the last answer, or null if never answered. */
  daysSince: number | null;
  pattern: Pattern;
  /** The difficulty a practice quiz for this topic should be set at. */
  difficulty: Difficulty;
};

export const SLIPPING_DROP = 0.1;
export const STALE_DAYS = 21;

/** Answers needed at a difficulty before a pattern is read from it. */
const PATTERN_MIN = 3;

function accuracy(answers: Evidence[]): number | null {
  if (answers.length < PATTERN_MIN) return null;
  return answers.filter((answer) => answer.correct).length / answers.length;
}

function patternOf(evidence: Evidence[], now: number): Pattern {
  const latest = latestPerQuestion(evidence, now);
  const easy = accuracy(latest.filter((answer) => answer.difficulty === "easy"));
  const hard = accuracy(latest.filter((answer) => answer.difficulty === "hard"));

  if (easy !== null && easy < 0.6) return "fundamentals";
  if (easy !== null && hard !== null && easy >= 0.75 && hard < 0.5) return "harder";
  return null;
}

/**
 * Which topics need practice, most urgent first.
 *
 * `topics` is every topic the student has — not only those with answers —
 * because "untested" can only be found among the ones with none.
 */
export function detectAttention(input: {
  evidence: Evidence[];
  topics: { id: string; hasMaterial: boolean }[];
  now: number;
}): Attention[] {
  const byTopic = new Map<string, Evidence[]>();
  for (const answer of input.evidence) {
    if (!answer.topicId) continue;
    const list = byTopic.get(answer.topicId);
    if (list) list.push(answer);
    else byTopic.set(answer.topicId, [answer]);
  }

  const found: (Attention & { priority: number })[] = [];

  for (const topic of input.topics) {
    const evidence = byTopic.get(topic.id) ?? [];
    const scored = masteryOf(evidence, input.now);

    if (!scored || scored.questions < LOW_EVIDENCE_QUESTIONS) {
      /* No files, no quiz can be written for it — flagging it would be a
         button that can only fail. */
      if (!topic.hasMaterial) continue;
      found.push({
        topicId: topic.id,
        kind: "untested",
        mastery: null,
        questions: scored?.questions ?? 0,
        improvement: null,
        daysSince: scored ? daysBetween(scored.lastAnsweredAt, input.now) : null,
        pattern: null,
        difficulty: "medium",
        priority: 1,
      });
      continue;
    }

    const daysSince = daysBetween(scored.lastAnsweredAt, input.now);
    const pattern = patternOf(evidence, input.now);

    let kind: AttentionKind | null = null;
    let priority = 0;

    /* In order of urgency. The first that applies is the one reported. */
    if (scored.mastery < WEAK_TOPIC_THRESHOLD) {
      kind = "weak";
      priority = 4 + (WEAK_TOPIC_THRESHOLD - scored.mastery);
    } else if (scored.improvement !== null && scored.improvement <= -SLIPPING_DROP) {
      kind = "slipping";
      priority = 3 - scored.improvement;
    } else if (daysSince >= STALE_DAYS && scored.mastery < STRONG_TOPIC_THRESHOLD) {
      kind = "stale";
      priority = 2 + Math.min(daysSince, 90) / 100;
    }

    if (!kind) continue;

    found.push({
      topicId: topic.id,
      kind,
      mastery: scored.mastery,
      questions: scored.questions,
      improvement: scored.improvement,
      daysSince,
      pattern,
      difficulty:
        pattern === "fundamentals"
          ? "easy"
          : pattern === "harder"
            ? "hard"
            : kind === "weak" && scored.mastery < 0.4
              ? "easy"
              : "medium",
      priority,
    });
  }

  return found
    .sort((a, b) => b.priority - a.priority)
    .map(({ priority: _priority, ...attention }) => attention);
}

function daysBetween(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / DAY));
}
