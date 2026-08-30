"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { enqueueJob } from "@/server/jobs/enqueue";

/**
 * Practice questions (FR-C2, US-F3, Sprint 45).
 *
 * **Nothing here records an attempt.** Practice is not measurement: a student
 * working through questions to learn the material would otherwise be building a
 * score history out of their first, worst pass, and this product's whole claim
 * is that its numbers mean something. Graded attempts arrive with quizzes in
 * Sprint 49, against `quiz_attempts`, which is why that table is untouched here.
 */

export type PracticeResult =
  { status: "ok"; quizId: string } | { status: "error"; message: string; nextStep: string };

export async function generateQuestionsAction(input: {
  subjectId: string;
  reviewerId: string;
}): Promise<PracticeResult> {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data: reviewer } = await supabase
    .from("reviewers")
    .select("id, title, topic_id, status")
    .eq("id", input.reviewerId)
    .maybeSingle();

  if (!reviewer) {
    return {
      status: "error",
      message: "That reviewer is no longer in your library.",
      nextStep: "Generate a new one from your material.",
    };
  }

  if (reviewer.status !== "ready") {
    return {
      status: "error",
      message: "This reviewer is not finished yet.",
      nextStep: "Wait for it to finish, then make questions from it.",
    };
  }

  /* One set per reviewer, enforced by a partial unique index. Reused rather
     than replaced so regenerating keeps the same id — the URL a student may
     have open stays valid, and the job's `(kind, target_id)` key still points
     at one row. */
  const { data: existing } = await supabase
    .from("quizzes")
    .select("id")
    .eq("reviewer_id", input.reviewerId)
    .maybeSingle();

  let quizId = existing?.id;

  if (quizId) {
    await supabase.from("quizzes").update({ status: "queued" }).eq("id", quizId);
  } else {
    const { data, error } = await supabase
      .from("quizzes")
      .insert({
        user_id: session.userId,
        subject_id: input.subjectId,
        topic_id: reviewer.topic_id,
        reviewer_id: reviewer.id,
        /* Both columns cap at 300 characters, so a maximum-length reviewer
           title plus a prefix is one over. Truncated rather than left to the
           check constraint, which would surface as "we could not start that
           practice set" for a reason the student cannot act on. */
        title: `Practice · ${reviewer.title}`.slice(0, 300),
        /* Practice, not an exam. The flag is what Sprint 49 will use to tell a
           timed mock from a set someone is working through to learn. */
        is_mock_exam: false,
        status: "queued",
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        status: "error",
        message: "We could not start that practice set.",
        nextStep: "Try again in a moment.",
      };
    }

    quizId = data.id;
  }

  await enqueueJob({
    userId: session.userId,
    kind: "generate_quiz",
    subjectId: input.subjectId,
    targetId: quizId,
  });

  revalidatePath("/", "layout");
  return { status: "ok", quizId };
}
