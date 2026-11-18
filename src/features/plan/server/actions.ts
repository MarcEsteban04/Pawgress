"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { draftTodayPlan } from "@/server/plan/today";

/**
 * Build today's plan, or rebuild it (FR-L1, US-J1, Sprint 65).
 *
 * **Built when asked, not when the dashboard is looked at.** Generating on
 * page load would write to the database as a side effect of reading a page,
 * would freeze the plan at whatever moment the student first glanced at it,
 * and would make "why did my plan change?" unanswerable. A button is one
 * press, and the moment it was pressed is the moment the plan describes.
 *
 * **Rebuilding keeps what is finished.** Done blocks are history; only the
 * unfinished ones are replaced, and the finished ones' subjects and topics are
 * not planned a second time. That is what makes Rebuild safe to press after
 * an exam is added at lunchtime.
 *
 * **One plan per day** is a table constraint (Sprint 13), so this upserts the
 * day's row rather than inserting a new one.
 */

export type BuildPlanResult =
  { status: "ok"; items: number } | { status: "error"; message: string; nextStep: string };

export async function buildTodayPlanAction(): Promise<BuildPlanResult> {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();
  const draft = await draftTodayPlan();

  const completedMinutes = (draft.existing?.completed ?? []).reduce(
    (sum, item) => sum + item.minutes,
    0,
  );

  const { data: plan, error: planError } = await supabase
    .from("study_plans")
    .upsert(
      {
        user_id: session.userId,
        plan_date: draft.today,
        total_minutes: completedMinutes + draft.plan.totalMinutes,
        rationale: draft.rationale,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,plan_date" },
    )
    .select("id")
    .single();

  if (planError || !plan) return failed();

  /* Out with the unfinished blocks; the finished ones stay where they are. */
  const { error: clearError } = await supabase
    .from("study_plan_items")
    .delete()
    .eq("plan_id", plan.id)
    .is("completed_at", null);
  if (clearError) return failed();

  if (draft.plan.items.length > 0) {
    /* After the finished blocks, so positions stay unique and the done ones
       keep reading first, in the order they were done. */
    const start =
      Math.max(-1, ...(draft.existing?.completed ?? []).map((item) => item.position)) + 1;

    const { error } = await supabase.from("study_plan_items").insert(
      draft.plan.items.map((item, index) => ({
        user_id: session.userId,
        plan_id: plan.id,
        subject_id: item.subjectId,
        topic_id: item.topicId,
        position: start + index,
        activity: item.activity,
        minutes: item.minutes,
        reason: item.reason,
      })),
    );
    if (error) return failed();
  }

  revalidatePath("/", "layout");
  return { status: "ok", items: draft.plan.items.length };
}

function failed(): BuildPlanResult {
  return {
    status: "error",
    message: "We could not build your plan.",
    nextStep: "Try again in a moment.",
  };
}
