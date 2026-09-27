/**
 * What a run of attempts adds up to (FR-P3, US-H2, Sprint 55).
 *
 * **Pure, and the only place these numbers are defined.** "Average" and "best"
 * sound self-explanatory and are not: an average of percentages and a pooled
 * accuracy disagree the moment two attempts have different lengths, and "best"
 * needs a rule for ties. Written down once here, the quiz page and the library
 * cannot quietly mean different things by the same word.
 */

export type ScoredAttempt = {
  id: string;
  correct: number;
  total: number;
  submittedAt: string;
};

export type AttemptSummary = {
  attempts: number;
  /** Mean share correct, 0–1. See `summariseAttempts` for which mean. */
  average: number | null;
  best: (ScoredAttempt & { share: number }) | null;
  recent: (ScoredAttempt & { share: number }) | null;
  /**
   * Most recent against the one before it, in percentage points. Null with
   * fewer than two attempts — one point is not a direction.
   */
  change: number | null;
};

const share = (attempt: ScoredAttempt) => (attempt.total > 0 ? attempt.correct / attempt.total : 0);

/**
 * Summarise attempts.
 *
 * **Average is POOLED — total right over total asked — not a mean of
 * percentages.** Across one quiz the two agree, because every attempt has the
 * same length. Across a library they do not: 5/5 on a five-question quiz and
 * 30/60 on a mock exam average to 75% as percentages, which says the student
 * gets three questions in four right when they got 35 of 65. Pooling weights
 * each attempt by how much evidence it is, which is the honest reading.
 *
 * **Best breaks ties toward the most recent.** Two attempts at 90% are the same
 * score, and the later one is the one that says where the student is now.
 *
 * Attempts with no questions are dropped rather than counted as zero — an empty
 * attempt is a bug, not a result.
 */
export function summariseAttempts(input: ScoredAttempt[]): AttemptSummary {
  const attempts = input
    .filter((attempt) => attempt.total > 0)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  if (attempts.length === 0) {
    return { attempts: 0, average: null, best: null, recent: null, change: null };
  }

  const right = attempts.reduce((sum, attempt) => sum + attempt.correct, 0);
  const asked = attempts.reduce((sum, attempt) => sum + attempt.total, 0);

  /* Iterating oldest to newest with >= is what makes a later tie win. */
  let best = attempts[0];
  for (const attempt of attempts) if (share(attempt) >= share(best)) best = attempt;

  const recent = attempts[attempts.length - 1];
  const before = attempts.length > 1 ? attempts[attempts.length - 2] : null;

  return {
    attempts: attempts.length,
    average: right / asked,
    best: { ...best, share: share(best) },
    recent: { ...recent, share: share(recent) },
    change: before ? Math.round((share(recent) - share(before)) * 100) : null,
  };
}

export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`;
}
