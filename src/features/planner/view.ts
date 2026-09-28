import { isDateKey, isPlannerView, type DateKey, type PlannerView } from "./dates";

/**
 * The shape of the planner URL, shared by the page and the controls
 * (Sprint 61).
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
 * The calendar arithmetic itself — which days a view covers, how a step moves
 * — lives in `dates.ts`, which has no imports and so can be loaded directly by
 * `npm run planner:test`. This module has one job: reading and writing the
 * query string.
 */

export { PLANNER_VIEWS, isPlannerView, rangeFor, daysFor, shift, periodLabel } from "./dates";
export type { PlannerView } from "./dates";

export const VIEW_LABEL: Record<PlannerView, string> = {
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
    view: isPlannerView(params.view) ? params.view : "month",
    anchor: params.date && isDateKey(params.date) ? params.date : today,
  };
}

/** Build a planner URL. `date` is dropped when it is today, so the common link
    is `/planner` rather than a URL that pins the calendar to the day it was
    copied. */
export function plannerHref(view: PlannerView, anchor: DateKey, today: DateKey): string {
  const params = new URLSearchParams();
  if (view !== "month") params.set("view", view);
  if (anchor !== today) params.set("date", anchor);
  const qs = params.toString();
  return qs ? `/planner?${qs}` : "/planner";
}
