/**
 * Readiness per subject, with its inputs (FR-D2, US-J3, Sprint 71).
 *
 * Import-free, so `scripts/plan-test.mjs` can pin it in Node.
 *
 * **A modelled number, so it shows its working.** Readiness was the subject's
 * mastery under another name. Mastery is one input — the most important one —
 * but "how ready am I for Biology" also depends on how much of Biology has been
 * measured at all, how the last fortnight's quizzes went, and whether the
 * student has been studying it. Each input is shown beside the score, with
 * the share of the score it carries, so a student can see which one to move.
 *
 * **What is IN the score:**
 *
 *  - mastery (half) — the Sprint 56 formula over every answer in the subject;
 *  - coverage (a fifth) — topics with enough answers to be measured, out of
 *    all of them. Strong on the three topics you have practised says nothing
 *    about the five you have not;
 *  - recent results (a fifth) — pooled accuracy over the last two weeks'
 *    practice and quizzes: the fast signal mastery deliberately smooths out;
 *  - consistency (a tenth) — days studied in the last fourteen, full marks
 *    at seven. Small, because time spent is not knowledge; present, because a
 *    subject nobody has opened in a fortnight is less ready than its last
 *    scores say.
 *
 * **What is NOT in it, deliberately:**
 *
 *  - weak topics — already inside mastery; counting them again would punish
 *    the same wrong answers twice. Shown beside the score as a count.
 *  - days to the exam — a date does not change what you know. It changes how
 *    urgent the gap is, which is Sprint 62's job; the next exam is shown with
 *    its urgency word ("on track", "time to revise", "start now").
 *
 * **No score without evidence.** Below the mastery evidence threshold there is
 * no readiness, the same rule every mastery figure in the product follows: a
 * number built from three answers is a guess wearing a percentage.
 *
 * **A missing input is left out, not scored zero.** No quizzes in a fortnight
 * is not 0% right; its share is spread over the inputs that exist, and the
 * breakdown says so.
 */

export type ReadinessInputs = {
  /** Subject mastery, or null below the evidence threshold. */
  mastery: number | null;
  answered: number;
  topics: number;
  measuredTopics: number;
  /** Practice and quizzes in the window, pooled. Null when there were none. */
  recent: { correct: number; total: number; runs: number } | null;
  /** Distinct days with a finished study session in the window. */
  studyDays: number;
};

export type ReadinessPart = {
  key: "mastery" | "coverage" | "recent" | "consistency";
  /** 0–1, or null when there was nothing to measure. */
  value: number | null;
  /** The share of the score this input carries as designed. */
  weight: number;
};

export type Readiness = { score: number; parts: ReadinessPart[] };

export const READINESS_WEIGHTS = {
  mastery: 0.5,
  coverage: 0.2,
  recent: 0.2,
  consistency: 0.1,
} as const;

/** The window recent results and consistency look back over. */
export const READINESS_WINDOW_DAYS = 14;
/** Days studied in the window that earn full marks for consistency. */
export const CONSISTENT_DAYS = 7;
/** Fewer recent questions than this is not a recent result. */
export const MIN_RECENT_QUESTIONS = 5;

export function readinessOf(inputs: ReadinessInputs): Readiness | null {
  if (inputs.mastery === null) return null;

  const parts: ReadinessPart[] = [
    { key: "mastery", value: inputs.mastery, weight: READINESS_WEIGHTS.mastery },
    {
      key: "coverage",
      value: inputs.topics > 0 ? Math.min(inputs.measuredTopics / inputs.topics, 1) : null,
      weight: READINESS_WEIGHTS.coverage,
    },
    {
      key: "recent",
      value:
        inputs.recent && inputs.recent.total >= MIN_RECENT_QUESTIONS
          ? inputs.recent.correct / inputs.recent.total
          : null,
      weight: READINESS_WEIGHTS.recent,
    },
    {
      key: "consistency",
      value: Math.min(inputs.studyDays / CONSISTENT_DAYS, 1),
      weight: READINESS_WEIGHTS.consistency,
    },
  ];

  const present = parts.filter((part) => part.value !== null);
  const totalWeight = present.reduce((sum, part) => sum + part.weight, 0);
  const score = present.reduce((sum, part) => sum + part.weight * part.value!, 0) / totalWeight;

  return { score, parts };
}

/** "half", "a fifth", "a tenth" — a weight in words, for the breakdown. */
export function shareLabel(weight: number): string {
  if (weight === 0.5) return "half the score";
  if (weight === 0.2) return "a fifth";
  if (weight === 0.1) return "a tenth";
  return `${Math.round(weight * 100)}%`;
}
