import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pickBlockToTick, type PlanActivity } from "@/features/plan/build";
import { getStudentToday } from "@/server/planner/queries";

/**
 * Tick off today's plan block that a finished activity completes (Sprint 67).
 *
 * Called by the code that RECORDS finished work — a practice set or deck
 * (`recordStudySessionAction`), a handed-in quiz (`submitQuizAction`) — so
 * the plan keeps up with the student without asking them to report what the
 * product just watched them do.
 *
 * **Best-effort, and never throws.** The work is already recorded by the time
 * this runs; a plan block left unticked is something the student can fix with
 * one press, and failing the hand-in over it would lose something they cannot.
 */
export async function tickPlanBlock(done: {
  subjectId: string | null;
  topicId: string | null;
  activity: PlanActivity;
}): Promise<void> {
  if (!done.subjectId) return;

  try {
    const supabase = await createSupabaseServerClient();
    const today = await getStudentToday();

    const { data: plan } = await supabase
      .from("study_plans")
      .select("id, study_plan_items(id, subject_id, topic_id, activity, position, completed_at)")
      .eq("plan_date", today)
      .maybeSingle();
    if (!plan) return;

    const open = (plan.study_plan_items ?? [])
      .filter((item) => item.completed_at === null)
      .map((item) => ({
        id: item.id,
        subjectId: item.subject_id,
        topicId: item.topic_id,
        activity: item.activity,
        position: item.position,
      }));

    const block = pickBlockToTick(open, {
      subjectId: done.subjectId,
      topicId: done.topicId,
      activity: done.activity,
    });
    if (!block) return;

    await supabase
      .from("study_plan_items")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", block.id)
      /* Only if still open — never move the time on a block already ticked. */
      .is("completed_at", null);
  } catch {
    /* See the header: the plan is a convenience; the recorded work is not. */
  }
}
