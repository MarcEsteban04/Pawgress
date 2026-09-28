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

/* -------------------------------------------------------------------------- */
/*  Month and week arithmetic (Sprint 61)                                      */
/* -------------------------------------------------------------------------- */

/**
 * The first of the month `key` falls in.
 *
 * String surgery rather than `Date`, like everything above: a month is a label
 * on the calendar, and routing it through an instant is how a planner ends up
 * showing December for a January date in a zone behind UTC.
 */
export function startOfMonth(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

/** How many days the month containing `key` has. 28, 29, 30 or 31. */
export function daysInMonth(key: DateKey): number {
  const [y, m] = key.split("-").map(Number);
  /* Day 0 of the NEXT month is the last day of this one — the one piece of
     Date arithmetic that is simpler than counting leap years by hand. At UTC
     noon, so no zone can move it. */
  return new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
}

/**
 * The same day-of-month, `months` later or earlier, clamped to the month's end.
 *
 * Clamped, not rolled over: stepping forward from 31 January must land on 28
 * February, not on 3 March. A calendar whose "next month" button skips February
 * is a calendar nobody trusts twice.
 */
export function addMonths(key: DateKey, months: number): DateKey {
  const [y, m, d] = key.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1, 12));
  const first = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const day = Math.min(d, daysInMonth(first));
  return `${first.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

/** The Monday of the week `key` falls in. ISO weeks, as most school timetables run. */
export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, -weekday(key));
}

/**
 * Every day from `from` to `to`, inclusive.
 *
 * Bounded at 400 so a corrupted URL cannot ask the renderer for a decade of
 * cells. The views never come close: the largest is a six-week month grid.
 */
export function eachDay(from: DateKey, to: DateKey): DateKey[] {
  const days: DateKey[] = [];
  let cursor = from;
  for (let i = 0; i <= 400 && daysBetween(cursor, to) >= 0; i += 1) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** "October 2026". Formatted at UTC noon so the label cannot drift a month. */
export function monthLabel(key: DateKey): string {
  return new Date(toNoon(key)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Thursday, 1 October". The heading for one day. */
export function longDayLabel(key: DateKey): string {
  return new Date(toNoon(key)).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** "1 Oct" — compact, for a week column head. */
export function shortDayLabel(key: DateKey): string {
  return new Date(toNoon(key)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** The day of the month, as a bare number for a grid cell. */
export function dayOfMonth(key: DateKey): number {
  return Number(key.slice(8, 10));
}

/** Do these two keys fall in the same calendar month? */
export function sameMonth(a: DateKey, b: DateKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/**
 * A deadline's time, as a student reads it.
 *
 * `null` for an all-day event — the caller decides what to say instead, because
 * "all day" is the wrong words for a deadline and "—" is the wrong words for
 * anything.
 */
export function timeLabel(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/* -------------------------------------------------------------------------- */
/*  What a calendar view covers (Sprint 61)                                    */
/*                                                                            */
/*  Here rather than in `view.ts` because it is arithmetic, not routing: "what */
/*  days does a month view show" has one answer whether it was asked by a URL, */
/*  a test or a component. It also has to live in an IMPORT-FREE module, which */
/*  is the rule that lets `npm run planner:test` load this file straight from  */
/*  TypeScript with no build step — the same constraint `quizzes/marking.ts`   */
/*  works under. `view.ts` keeps the part that is genuinely about the URL.     */
/* -------------------------------------------------------------------------- */

export const PLANNER_VIEWS = ["month", "week", "day"] as const;
export type PlannerView = (typeof PLANNER_VIEWS)[number];

export function isPlannerView(value: string | undefined): value is PlannerView {
  return value === "month" || value === "week" || value === "day";
}

/**
 * The days a view covers, and the window to fetch.
 *
 * **A month view shows more than a month**, and the range has to admit that:
 * the grid starts on the Monday before the 1st and ends on the Sunday after
 * the last day, so up to six days at each end belong to the neighbouring
 * months. Fetching only the month itself would leave those cells reliably,
 * invisibly empty — the bug where an exam on the 1st is missing from the cell
 * you can see it in.
 */
export function rangeFor(view: PlannerView, anchor: DateKey): { from: DateKey; to: DateKey } {
  if (view === "day") return { from: anchor, to: anchor };

  if (view === "week") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6) };
  }

  const first = startOfMonth(anchor);
  const from = startOfWeek(first);
  const last = addDays(first, daysInMonth(first) - 1);
  return { from, to: addDays(startOfWeek(last), 6) };
}

/** The cells a view renders, in order. One day, seven, or a whole grid. */
export function daysFor(view: PlannerView, anchor: DateKey): DateKey[] {
  const { from, to } = rangeFor(view, anchor);
  return eachDay(from, to);
}

/**
 * One step forward or back, in the unit the view is showing.
 *
 * A month steps by a month, not by 30 days, and `addMonths` clamps — so
 * paging forward from 31 March lands on 30 April rather than skipping into
 * May. A week steps by seven days and a day by one, both of which are
 * unambiguous.
 */
export function shift(view: PlannerView, anchor: DateKey, steps: number): DateKey {
  if (view === "month") return addMonths(anchor, steps);
  return addDays(anchor, steps * (view === "week" ? 7 : 1));
}

/**
 * What the period is called, on screen.
 *
 * A week gets both ends because "week of 12 October" is a date a student has
 * to do arithmetic on to place; "12–18 Oct" is the week itself.
 */
export function periodLabel(view: PlannerView, anchor: DateKey): string {
  if (view === "day") return longDayLabel(anchor);
  if (view === "month") return monthLabel(anchor);

  const from = startOfWeek(anchor);
  const to = addDays(from, 6);
  return `${shortDayLabel(from)} – ${shortDayLabel(to)}`;
}
