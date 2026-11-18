/**
 * The rules of a timed study session (FR-N4, US-I3, Sprint 63).
 *
 * Import-free on purpose, like `planner/dates.ts`: these are the decisions a
 * student would argue with — how long is too long, what counts as nothing,
 * which planned session a finished one ticks off — and `npm run session:test`
 * can only pin them if Node can load this file without the app around it.
 *
 * **The clock is the server's.** A session is a `study_sessions` row whose
 * `ended_at` is still null; start and finish both stamp server time. The
 * browser only DRAWS the elapsed time. A timer kept in the tab would die with
 * the tab, would not follow the student to their phone, and would let any
 * client claim any duration it liked.
 */

/**
 * Past this, a session was left running.
 *
 * Four hours, not the six that Sprint 57 clamps client-measured activity to.
 * A finals-week student can sit for three hours straight; nobody revises for
 * five without stopping, and "I started the timer on Tuesday" is the case this
 * exists for. Recording 2 days 3 hours of Biology would make every total on
 * the progress page a lie, and the student could not undo it.
 */
export const SESSION_CAP_MINUTES = 240;
export const SESSION_CAP_SECONDS = SESSION_CAP_MINUTES * 60;

/**
 * Below this, nothing is recorded.
 *
 * The same rule as Sprint 57's "a session with nothing in it is not a
 * session": start, realise it was the wrong subject, finish — that should not
 * appear in anyone's history as having studied.
 */
export const MIN_SESSION_SECONDS = 60;

export function elapsedSeconds(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

/** Whether a session has run past the point anyone is still studying. */
export function isLeftRunning(elapsed: number): boolean {
  return elapsed > SESSION_CAP_SECONDS;
}

/**
 * The most a student may record for a session that has run this long.
 *
 * Never more than the clock — a correction can say "I stepped away for twenty
 * minutes", never "I studied longer than I had the timer on" — and never more
 * than the cap.
 */
export function ceilingSeconds(elapsed: number): number {
  return Math.min(elapsed, SESSION_CAP_SECONDS);
}

export type Settled =
  | { status: "too-short" }
  | {
      status: "ok";
      seconds: number;
      /** True when the clock was over the cap and the student did not say otherwise. */
      capped: boolean;
    };

/**
 * What a finished session records.
 *
 * `claimedMinutes` is the student's correction, or null to take the clock.
 * Clamped rather than refused: someone typing 300 into a session that ran for
 * 45 minutes meant "all of it", and an error message would be the product
 * arguing about a number it already knows.
 */
export function settleDuration(elapsed: number, claimedMinutes: number | null): Settled {
  const ceiling = ceilingSeconds(elapsed);
  const claimed =
    claimedMinutes !== null && Number.isFinite(claimedMinutes)
      ? Math.max(0, Math.round(claimedMinutes * 60))
      : null;

  const seconds = claimed === null ? ceiling : Math.min(claimed, ceiling);
  if (seconds < MIN_SESSION_SECONDS) return { status: "too-short" };

  return { status: "ok", seconds, capped: claimed === null && isLeftRunning(elapsed) };
}

/** A planned study session, as the finish step needs to see it. */
export type PlannedSession = {
  id: string;
  title: string;
  subjectId: string | null;
  topicId: string | null;
  /** `YYYY-MM-DD`. */
  dueOn: string;
};

/**
 * Which planned session a finished one ticks off, if any.
 *
 * There is no column linking a session to the event it was started from, and
 * that turns out to be the better rule rather than a workaround: "I planned to
 * study Genetics today, and I studied Genetics today" is done whether the
 * student pressed Start on the planner row or on the top bar.
 *
 * Eligible: not done, due on the session's day or earlier (an overdue plan
 * caught up on counts), and not contradicted — a plan for a different subject,
 * or a different topic of the same subject, is a different plan. A plan with
 * no subject is "study something today" and anything satisfies it, last.
 *
 * Ranked: exact topic, then same subject, then unfiled; within each, the one
 * due latest (today's before an overdue one). Exactly one is ticked: two
 * sessions planned and one done is one still to do.
 */
export function pickPlannedSession(
  candidates: PlannedSession[],
  session: { subjectId: string; topicId: string | null; day: string },
): PlannedSession | null {
  const rank = (plan: PlannedSession): number | null => {
    if (plan.dueOn > session.day) return null;
    if (plan.subjectId === null) return plan.topicId === null ? 2 : null;
    if (plan.subjectId !== session.subjectId) return null;
    if (plan.topicId === null) return 1;
    return plan.topicId === session.topicId ? 0 : null;
  };

  let best: { plan: PlannedSession; rank: number } | null = null;
  for (const plan of candidates) {
    const r = rank(plan);
    if (r === null) continue;
    if (!best || r < best.rank || (r === best.rank && plan.dueOn > best.plan.dueOn)) {
      best = { plan, rank: r };
    }
  }
  return best?.plan ?? null;
}

/** `12:04`, or `1:02:09` past the hour. The running pill's face. */
export function clockLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** `45 min`, `1 h`, `2 h 5 min`, `3 days 2 h`. Words, for sentences. */
export function durationLabel(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return `${days} ${days === 1 ? "day" : "days"}${h ? ` ${h} h` : ""}`;
}
