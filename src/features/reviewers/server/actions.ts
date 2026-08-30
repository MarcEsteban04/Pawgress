"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { enqueueJob } from "@/server/jobs/enqueue";

/**
 * Asking for a reviewer (FR-R1, US-F1).
 *
 * The row is created FIRST, at `queued`, and the job targets it. That order is
 * what makes the reviewer visible while it is being written: a student who
 * pressed generate sees a card that says "generating" rather than an empty list
 * and a hope. It is also what makes the job idempotent — `(kind, target_id)` is
 * unique, so a double click enqueues one job, not two.
 */

export type ReviewerResult =
  { status: "ok"; reviewerId: string } | { status: "error"; message: string; nextStep: string };

export async function generateReviewerAction(input: {
  subjectId: string;
  topicId: string | null;
}): Promise<ReviewerResult> {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  /* Generation reads `extracted_text`, which exists after extraction and before
     embedding — so a file that is still being indexed can still be generated
     from. What cannot is one with no text at all, and saying that here beats a
     job that fails a minute later. */
  let check = supabase
    .from("materials")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", input.subjectId)
    .not("extracted_text", "is", null);

  if (input.topicId) check = check.eq("topic_id", input.topicId);
  const { count } = await check;

  if (!count) {
    return {
      status: "error",
      message: "There is nothing to build a reviewer from yet.",
      nextStep: input.topicId
        ? "Upload a file to this topic, or wait for one to finish processing."
        : "Upload a file to this subject, or wait for one to finish processing.",
    };
  }

  const { data, error } = await supabase
    .from("reviewers")
    .insert({
      user_id: session.userId,
      subject_id: input.subjectId,
      topic_id: input.topicId || null,
      /* Replaced by the generated one. A placeholder rather than "Untitled"
         because this title is on screen for the minute it takes. */
      title: "Generating a reviewer…",
      kind: "summary",
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: "We could not start that reviewer.",
      nextStep: "Try again in a moment.",
    };
  }

  await enqueueJob({
    userId: session.userId,
    kind: "generate_reviewer",
    subjectId: input.subjectId,
    targetId: data.id,
  });

  revalidatePath("/", "layout");
  return { status: "ok", reviewerId: data.id };
}

/** Delete a reviewer. Nothing is generated from it yet, so nothing cascades. */
export async function deleteReviewerAction(reviewerId: string): Promise<ReviewerResult> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("reviewers").delete().eq("id", reviewerId);
  if (error) {
    return {
      status: "error",
      message: "We could not delete that reviewer.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "ok", reviewerId };
}
