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
