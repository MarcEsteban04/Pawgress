import { isCalendarSpan, isDateKey, type CalendarSpan, type DateKey } from "./dates";

/**
 * The shape of the planner URL, shared by the page and the controls
 * (Sprint 61, extended in 62).
 *
 * **The URL is the state**, the same contract as every other list in this
 * product: `/planner?view=week&date=2026-10-12` is linkable, survives a
 * reload, and unwinds with the back button. It is also what lets the SERVER
 * fetch exactly the range being shown — a client holding the view in
 * `useState` would have to fetch a year and filter, or refetch on every arrow
 * press.
 *
 * Outside `@/server/planner/queries` because that module is `server-only` and
 * the navigation bar is a Client Component. It is the one thing both halves
 * must agree on, so a single definition is what stops the controls producing a
 * URL the query cannot read.
 *
 * The calendar arithmetic itself — which days a span covers, how a step moves
 * — lives in `dates.ts`, which has no imports and so can be loaded directly by
 * `npm run planner:test`. This module has one job: reading and writing the
 * query string.
 */

export { CALENDAR_SPANS, isCalendarSpan, rangeFor, daysFor, shift, periodLabel } from "./dates";
export type { CalendarSpan } from "./dates";

/**
 * **Upcoming leads, and is the default.**
 *
 * A month grid is for orientation — where does this fall, how much is on that
 * week. It is not the question anyone opens a planner to ask, which is "what
 * is due and what should I start". Sprint 61 landed on the month because it
 * was the only view there was; now that there is a deadline list, making a
 * student click through to it every time would be putting the map in front of
 * the directions.
 */
export const PLANNER_VIEWS = ["upcoming", "month", "week", "day"] as const;
export type PlannerView = (typeof PLANNER_VIEWS)[number];

export const DEFAULT_VIEW: PlannerView = "upcoming";

export function isPlannerView(value: string | undefined): value is PlannerView {
  return value === "upcoming" || isCalendarSpan(value);
}

export const VIEW_LABEL: Record<PlannerView, string> = {
  upcoming: "Upcoming",
  month: "Month",
  week: "Week",
  day: "Day",
};

/** Read the URL, falling back rather than failing. An unparseable date is a link
    someone edited or an old bookmark, and the right answer to both is today. */
export function readQuery(
  params: { view?: string; date?: string },
  today: DateKey,
): { view: PlannerView; anchor: DateKey } {
  return {
    view: isPlannerView(params.view) ? params.view : DEFAULT_VIEW,
    anchor: params.date && isDateKey(params.date) ? params.date : today,
  };
}

/**
 * Build a planner URL.
 *
 * Both params are dropped where they are the default, so the common link is
 * `/planner` rather than one that pins the calendar to the view and the day it
 * happened to be copied on. The anchor is dropped entirely for the deadline
 * list, which has no date to be on.
 */
export function plannerHref(view: PlannerView, anchor: DateKey, today: DateKey): string {
  const params = new URLSearchParams();
  if (view !== DEFAULT_VIEW) params.set("view", view);
  if (view !== "upcoming" && anchor !== today) params.set("date", anchor);
  const qs = params.toString();
  return qs ? `/planner?${qs}` : "/planner";
}

/** Narrowing helper, so a caller that needs a range can prove it has one. */
export function asCalendarSpan(view: PlannerView): CalendarSpan | null {
  return view === "upcoming" ? null : view;
}
