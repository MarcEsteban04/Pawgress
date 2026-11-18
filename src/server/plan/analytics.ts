import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { addDays, dateKeyAt, weekdayLabel } from "@/features/planner/dates";
import { summarisePlans, type PlanAnalytics } from "@/features/plan/analytics";
import { getAnswerEvidence } from "@/server/mastery/queries";
import { getProfile } from "@/server/profile/queries";
import { getStudentToday } from "@/server/planner/queries";

/**
 * Plan analytics for the Progress page (FR-L5, Sprint 69).
 *
 * Four weeks of plans for the totals and the per-activity rates; the last
 * fourteen days drawn day by day, the same window as the activity chart above
 * it so the two read together.
 */

/** Totals and rates look back this far. */
const WINDOW_DAYS = 28;
/** The chart draws this many days — the Progress page's existing window. */
const CHART_DAYS = 14;

export type PlanAnalyticsView = PlanAnalytics & {
  /** Short weekday labels for the chart, aligned with `daily`. */
  labels: string[];
  /** Whether any plan has ever been built — the empty state differs. */
  hasPlans: boolean;
};

export const getPlanAnalytics = cache(async (): Promise<PlanAnalyticsView> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();
  const today = await getStudentToday();

  const [{ data: rows }, evidence, profile] = await Promise.all([
    supabase
      .from("study_plans")
      .select("plan_date, study_plan_items(activity, minutes, completed_at, topic_id)")
      .gte("plan_date", addDays(today, -(WINDOW_DAYS - 1)))
      .lte("plan_date", today)
      .order("plan_date", { ascending: true }),
    getAnswerEvidence(),
    getProfile(),
  ]);

  const days = Array.from({ length: CHART_DAYS }, (_, index) =>
    addDays(today, index - (CHART_DAYS - 1)),
  );

  const analytics = summarisePlans({
    plans: (rows ?? []).map((row) => ({
      date: row.plan_date,
      items: (row.study_plan_items ?? []).map((item) => ({
        activity: item.activity,
        minutes: item.minutes,
        completed: item.completed_at !== null,
        topicId: item.topic_id,
      })),
    })),
    days,
    evidence,
    dayOf: (iso) => dateKeyAt(Date.parse(iso), profile?.timezone),
  });

  return {
    ...analytics,
    labels: days.map((day) => weekdayLabel(day, "narrow")),
    hasPlans: (rows ?? []).length > 0,
  };
});
