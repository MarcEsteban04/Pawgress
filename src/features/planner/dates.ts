/**
 * Calendar days, in the student's own timezone (Sprint 60).
 *
 * **A deadline is a DAY, and "today" has to be the student's day.** The schema
 * stores `due_on` as a date rather than a timestamp precisely so an exam on
 * Friday stays on Friday — and then the code worked out "today" with
 * `new Date().toISOString().slice(0, 10)`, which is the date in UTC. For a
 * student eight hours ahead that is yesterday until 8am, so yesterday's
 * deadlines read as still upcoming; for one five hours behind it is tomorrow
 * every evening, so today's deadline has already vanished as past. Storing a
 * date and comparing it to UTC's date undoes the reason for storing a date.
 *
 * Everything here works on `YYYY-MM-DD` keys, never on `Date` objects, so a
 * day is never quietly converted into an instant and back. The arithmetic is
 * done at UTC noon, where no daylight-saving change can push it across
 * midnight.
 *
 * Import-free, so `npm run planner:test` can load it straight from TypeScript.
 */

export type DateKey = string;

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Is this a real calendar date — not just the right shape? 2026-02-30 is not. */
export function isDateKey(value: string): value is DateKey {
  const match = KEY.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Is this an IANA timezone the runtime understands?
 *
 * Checked rather than trusted: it comes from the profile, and an unknown zone
 * makes `Intl.DateTimeFormat` throw — which would take the whole page down
 * over one bad setting.
 */
export function isTimezone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Today's date where the student is.
 *
 * `en-CA` because it formats as `YYYY-MM-DD` — the one locale whose short date
 * is already an ISO key, so there is no string surgery to get wrong. Falls
 * back to UTC for a missing or unknown zone rather than throwing.
 */
export function todayIn(timezone: string | null | undefined, now: number = Date.now()): DateKey {
  const zone = isTimezone(timezone) ? timezone : "UTC";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

function toNoon(key: DateKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

function fromNoon(ms: number): DateKey {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromNoon(toNoon(key) + days * 86_400_000);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((toNoon(to) - toNoon(from)) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. ISO weeks start on Monday, as most school timetables do. */
export function weekday(key: DateKey): number {
  return (new Date(toNoon(key)).getUTCDay() + 6) % 7;
}

/**
 * Where an event sits relative to today.
 *
 * **Done outranks everything.** A finished assignment is not overdue, whatever
 * its date — telling a student they are late on work they handed in is the
 * fastest way to make them stop marking things done.
 *
 * "This week" means the next seven days, not the calendar week. On a Sunday,
 * the calendar week has one day left in it, and a deadline on Tuesday would
 * fall into "later" — the one bucket that says it can wait.
 */
export type When = "done" | "overdue" | "today" | "tomorrow" | "this_week" | "later";

export function whenIs(dueOn: DateKey, today: DateKey, completed: boolean): When {
  if (completed) return "done";
  const days = daysBetween(today, dueOn);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return "this_week";
  return "later";
}

/**
 * The student's calendar date at a given instant.
 *
 * For bucketing timestamps — a study session at 11pm in Manila belongs to
 * that evening, not to the next day, which is where UTC would put it.
 */
export function dateKeyAt(ms: number, timezone: string | null | undefined): DateKey {
  return todayIn(timezone, ms);
}

/** A short weekday label for a date key, independent of the server's own zone. */
export function weekdayLabel(key: DateKey, style: "narrow" | "short" = "short"): string {
  return new Date(toNoon(key)).toLocaleDateString(undefined, { weekday: style, timeZone: "UTC" });
}
