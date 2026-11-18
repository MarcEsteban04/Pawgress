import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { dateKeyAt, type DateKey } from "@/features/planner/dates";
import { buildDayPlan, sessionKey, type DayPlan, type DaySession } from "@/features/plan/build";
import { type Basis } from "@/features/planner/suggest";
import { getAttention, getSubjectMastery, getTopicMastery } from "@/server/mastery/queries";
import { getProfile } from "@/server/profile/queries";
import { getStudentToday, listEvents } from "@/server/planner/queries";
import { getSuggestions } from "@/server/planner/suggestions";
import { listSessionTargets } from "@/server/study/queries";

/**
 * Everything today's plan is built from, gathered (FR-L1, US-J1, Sprint 65).
 *
 * The rules are in `features/plan/build.ts`; this collects their inputs from
 * loaders the dashboard and planner already read. The one new read is
 * "minutes already studied today", because a plan that ignores this morning's
 * hour is a plan that punishes starting early.
 */

/**
 * What a plan was built from, stored on `study_plans.rationale`.
 *
 * The schema comment has asked for this since Sprint 13: "stored so the plan
 * can explain itself rather than asking the student to trust it". These are
 * the figures the panel prints under the plan — the inputs, not a score.
 */
export type PlanRationale = {
  version: 1;
  budgetMinutes: number;
  perDay: number;
  blockMinutes: number;
  studiedMinutes: number;
  /** Sessions the student had put in the planner for today themselves. */
  fromPlanner: number;
  /** Sessions the scheduler placed on today, by what they were for. */
  forDeadlines: number;
  forTopics: number;
  alsoToday: string[];
  leftOver: number;
  empty: DayPlan["empty"];
};

export type TodayPlanDraft = {
  today: DateKey;
  plan: DayPlan;
  rationale: PlanRationale;
  /** The existing plan row for today, if one has been built. */
  existing: { id: string; completed: { position: number; minutes: number }[] } | null;
};

/** How far back to read sessions to be sure of covering the student's whole today. */
const DAY_AND_A_HALF_MS = 36 * 3600 * 1000;

export const draftTodayPlan = cache(async (): Promise<TodayPlanDraft> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();
  const today = await getStudentToday();

  const [
    week,
    todayEvents,
    attention,
    topicMastery,
    subjectMastery,
    profile,
    targets,
    { count: materials },
    { data: recent },
    { data: plan },
  ] = await Promise.all([
    getSuggestions(),
    listEvents({ from: today, to: today }),
    getAttention({ limit: 12 }),
    getTopicMastery(),
    getSubjectMastery(),
    getProfile(),
    listSessionTargets(),
    supabase.from("materials").select("id", { count: "exact", head: true }),
    supabase
      .from("study_sessions")
      .select("started_at, duration_seconds")
      .not("ended_at", "is", null)
      .gte("started_at", new Date(Date.now() - DAY_AND_A_HALF_MS).toISOString()),
    supabase
      .from("study_plans")
      .select("id, study_plan_items(subject_id, topic_id, position, minutes, completed_at)")
      .eq("plan_date", today)
      .maybeSingle(),
  ]);

  /* Minutes studied on the student's today — read wide, filtered by THEIR
     calendar day, because "today" in UTC is the wrong day for half the world
     for part of every day (the Sprint 60 fix). */
  const studiedSeconds = (recent ?? [])
    .filter((row) => dateKeyAt(Date.parse(row.started_at), profile?.timezone) === today)
    .reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0);
  const studiedMinutes = Math.round(studiedSeconds / 60);

  /* What a planned session is FOR, when the student filed it themselves:
     the topic's Sprint 59 flag if it has one, then its mastery band, then the
     subject's. Nothing known is "unmeasured" — practice first. */
  const flagged = new Map(attention.map((item) => [item.topicId, item.kind]));
  const basisOf = (subjectId: string, topicId: string | null): Basis =>
    (topicId && (flagged.get(topicId) ?? topicMastery.get(topicId)?.band)) ||
    subjectMastery.get(subjectId)?.band ||
    "unmeasured";

  const colorOf = new Map(targets.map((target) => [target.id, target.colorSlot]));

  const planned: DaySession[] = todayEvents
    .filter(
      (event) =>
        event.kind === "study_session" && event.completedAt === null && event.subjectId !== null,
    )
    .map((event) => ({
      subjectId: event.subjectId!,
      subjectName: event.subjectName ?? "",
      colorSlot: event.colorSlot ?? colorOf.get(event.subjectId!) ?? 1,
      topicId: event.topicId,
      topicName: event.topicName,
      title: event.title,
      basis: basisOf(event.subjectId!, event.topicId),
      reason: event.title,
      source: "planned" as const,
    }));

  const suggestedToday = week.suggestions.filter((suggestion) => suggestion.dueOn === today);
  const suggested: DaySession[] = suggestedToday.map((suggestion) => ({
    subjectId: suggestion.subjectId,
    subjectName: suggestion.subjectName,
    colorSlot: suggestion.colorSlot,
    topicId: suggestion.topicId,
    topicName: suggestion.topicName,
    title: suggestion.title,
    basis: suggestion.basis,
    reason: suggestion.reason,
    source: "suggested" as const,
  }));

  const items = plan?.study_plan_items ?? [];
  const completed = items.filter((item) => item.completed_at !== null);

  const built = buildDayPlan({
    /* The student's own sessions lead: they chose them. */
    sessions: [...planned, ...suggested],
    blockMinutes: profile?.preferredSessionMinutes ?? 30,
    perDay: week.perDay,
    studiedMinutes,
    done: completed
      .filter((item) => item.subject_id)
      .map((item) => sessionKey(item.subject_id!, item.topic_id)),
    context: { subjects: targets.length, materials: materials ?? 0 },
  });

  return {
    today,
    plan: built,
    rationale: {
      version: 1,
      budgetMinutes: built.budgetMinutes,
      perDay: week.perDay,
      blockMinutes: profile?.preferredSessionMinutes ?? 30,
      studiedMinutes,
      fromPlanner: planned.length,
      forDeadlines: suggestedToday.filter((s) => s.forDeadline !== null && s.basis !== "work")
        .length,
      forTopics: suggestedToday.filter((s) => s.forDeadline === null).length,
      alsoToday: built.alsoToday,
      leftOver: built.leftOver,
      empty: built.empty,
    },
    existing: plan
      ? {
          id: plan.id,
          completed: completed.map((item) => ({ position: item.position, minutes: item.minutes })),
        }
      : null,
  };
});

/** Read a stored rationale defensively: it is jsonb, and older rows are `{}`. */
export function readRationale(value: unknown): PlanRationale | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<PlanRationale>;
  return row.version === 1 ? (row as PlanRationale) : null;
}
