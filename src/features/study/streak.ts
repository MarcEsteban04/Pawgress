/**
 * Study streaks, with one rest day a week (Sprint 73).
 *
 * Import-free, so `scripts/achievements-test.mjs` can pin it in Node.
 *
 * **Why a strict daily streak is the wrong design here.** It works by loss
 * aversion: miss one day and weeks of work show as zero. Students respond by
 * doing a two-minute session at midnight to protect the number — studying for
 * the counter, which is the exact substitution of activity for learning this
 * product exists to argue against. And the student it punishes hardest is the
 * one who took a sensible evening off before an exam.
 *
 * **So recovery is in the rule, not in a shop.** A single missed day does not
 * break a streak, as long as rest days are at least a week apart. Two missed
 * days in a row do. There is nothing to buy, nothing to "freeze", and no
 * screen telling anyone they lost something.
 *
 * **The count is days STUDIED.** A rest day keeps the chain together; it does
 * not add to it. A 12-day streak means twelve days of study.
 *
 * **Today is never a break.** Until the day is over, not having studied yet
 * today is "not yet", not "missed" — a streak that resets at midnight while the
 * student sleeps is a streak nobody trusts.
 */

export type StreakStatus =
  /** Studied today. */
  | "today"
  /** Not yet today; the streak is safe, and studying today extends it. */
  | "pending"
  /** Not yet today, and yesterday was the rest day — today keeps it alive. */
  | "at-risk"
  | "none";

export type Streak = {
  /** Days studied in the current chain. */
  current: number;
  /** The longest chain ever, by the same rule. */
  best: number;
  status: StreakStatus;
  /** Whether a rest day is inside the current chain's last week. */
  restUsed: boolean;
};

/** Rest days must be at least this many days apart. */
export const REST_EVERY_DAYS = 7;

function toDay(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

export function streakOf(days: string[], today: string): Streak {
  const studied = new Set(days.map(toDay));
  const now = toDay(today);

  /* ---- The current chain, walking back from today ----------------------- */
  let current = 0;
  let lastRest: number | null = null;
  let restInChain = false;
  /* Today unstudied is "not yet": start from yesterday without spending rest. */
  let day = studied.has(now) ? now : now - 1;
  let yesterdayRested = false;

  while (true) {
    if (studied.has(day)) {
      current += 1;
      day -= 1;
      continue;
    }
    /* A missed day. It is a rest day — and the chain holds — only if the last
       rest was a week or more further on, and there is study behind it. Two
       missed days in a row fail the second test. */
    const spaced = lastRest === null || lastRest - day >= REST_EVERY_DAYS;
    if (!spaced || !studied.has(day - 1)) break;
    lastRest = day;
    if (day === now - 1) yesterdayRested = true;
    if (now - day < REST_EVERY_DAYS) restInChain = true;
    day -= 1;
  }

  let status: StreakStatus = "none";
  if (current > 0) {
    if (studied.has(now)) status = "today";
    else status = yesterdayRested ? "at-risk" : "pending";
  }

  return { current, best: Math.max(current, bestStreak(days)), status, restUsed: restInChain };
}

/**
 * The longest chain ever, by the same rule — walking forward from the first
 * day studied. What the 7- and 30-day milestones are earned against, so the
 * number on screen and the milestone can never disagree.
 */
export function bestStreak(days: string[]): number {
  const sorted = [...new Set(days.map(toDay))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous: number | null = null;
  let lastRest: number | null = null;

  for (const day of sorted) {
    if (previous === null) {
      run = 1;
    } else {
      const gap = day - previous;
      if (gap === 1) {
        run += 1;
      } else if (gap === 2 && (lastRest === null || day - 1 - lastRest >= REST_EVERY_DAYS)) {
        /* One missed day, and the last rest was a week or more ago. */
        lastRest = day - 1;
        run += 1;
      } else {
        run = 1;
        lastRest = null;
      }
    }
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/**
 * Monday to Sunday of the week containing `today`, and which were studied.
 *
 * A week, not a chain: "four days this week" is a fact a student can plan
 * around, where a streak is a number they can only defend.
 */
export function weekOf(
  days: string[],
  today: string,
): { date: string; studied: boolean; today: boolean }[] {
  const studied = new Set(days);
  const t = toDay(today);
  /* 1970-01-01 was a Thursday; Monday-first weekday index. */
  const weekday = (t + 3) % 7;
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date((t - weekday + index) * 86_400_000).toISOString().slice(0, 10);
    /* Marked here, from the STUDENT's today, so no renderer has to work out
       "today" again from the server's clock. */
    return { date, studied: studied.has(date), today: date === today };
  });
}
