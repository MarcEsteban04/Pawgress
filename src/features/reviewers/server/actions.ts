"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { enqueueJob } from "@/server/jobs/enqueue";
import { getReviewerImpact } from "@/server/reviewers/queries";

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

/**
 * Delete a reviewer.
 *
 * This DOES cascade now, and the two children were given different rules on
 * purpose (`20260826120000`, `20260831100000`):
 *
 *  - **flashcards** — `on delete cascade`. They were generated from this
 *    reviewer and have no meaning without it, so they go, and the known/unknown
 *    progress from Sprint 44 goes with them.
 *  - **quizzes** — `on delete set null`. A quiz the student actually SAT is a
 *    record of their own work; tidying up a reviewer must never destroy it. It
 *    survives, merely unlinked.
 *
 * The caller states both counts before asking — see `getReviewerImpact`. The
 * comment this replaced said nothing cascaded, which was true when it was
 * written in Sprint 43 and stopped being true one sprint later.
 */
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

/**
 * Duplicate a reviewer (Sprint 47).
 *
 * The point is editing. Sprint 46 made a reviewer editable in place, which
 * means a student who wants to cut it down for one exam has to damage the copy
 * they might want later. Duplicating gives them a fork to ruin.
 *
 * A COPY OF THE DOCUMENT, NOT A RE-GENERATION — deliberately. Re-running the
 * model would cost quota and return something different, so "duplicate" would
 * silently mean "roll the dice again". It copies the jsonb as-is, which carries
 * the Sprint 46 edits, notes and `editedAt` with it.
 *
 * Children are NOT copied. Flashcards and quizzes belong to the reviewer they
 * were generated from; cloning them would double a student's review queue
 * without being asked, and the copy can generate its own.
 */
export async function duplicateReviewerAction(reviewerId: string): Promise<ReviewerResult> {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  /* RLS scopes this to the caller, so a reviewer that is not theirs reads as
     absent rather than forbidden — the same shape as every other lookup. */
  const { data: source } = await supabase
    .from("reviewers")
    .select("subject_id, topic_id, title, kind, content, source_material_ids, status")
    .eq("id", reviewerId)
    .maybeSingle();

  if (!source) {
    return {
      status: "error",
      message: "That reviewer no longer exists.",
      nextStep: "Refresh the library.",
    };
  }

  /* Only a finished one. Copying a `queued` or `generating` row would produce a
     permanent orphan: the copy has no job pointing at it, so it would sit at
     "generating" for ever with nothing on the way to finish it. */
  if (source.status !== "ready") {
    return {
      status: "error",
      message: "This reviewer is not finished yet.",
      nextStep: "Wait for it to finish, then duplicate it.",
    };
  }

  /* `title` is `check (char_length(title) between 1 and 300)`. Appending the
     suffix blindly would fail the constraint on a long title, so the ORIGINAL
     is trimmed to make room rather than the suffix being dropped — a copy that
     is not visibly a copy is worse than a shortened name. */
  const SUFFIX = " (copy)";
  const MAX_TITLE = 300;
  const title = `${source.title.slice(0, MAX_TITLE - SUFFIX.length)}${SUFFIX}`;

  const { data, error } = await supabase
    .from("reviewers")
    .insert({
      user_id: session.userId,
      subject_id: source.subject_id,
      topic_id: source.topic_id,
      title,
      kind: source.kind,
      content: source.content,
      source_material_ids: source.source_material_ids,
      /* `ready` immediately: the content is already here, so there is no job and
         nothing to wait for. */
      status: "ready",
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: "We could not duplicate that reviewer.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "ok", reviewerId: data.id };
}

/**
 * What a delete would take with it, fetched when the dialog OPENS.
 *
 * Not on page load: two count queries per row was fine for three reviewers and
 * would be eighty for forty, nearly all of them discarded. Reading them on open
 * also means the numbers are current at the moment they are read, which is the
 * property that actually matters in a destructive confirmation — the same
 * reasoning as `loadDeletionSummaryAction` for subjects.
 */
export async function loadReviewerImpactAction(
  reviewerId: string,
): Promise<{ flashcards: number; quizzes: number } | null> {
  await requireSession();
  try {
    return await getReviewerImpact(reviewerId);
  } catch {
    return null;
  }
}
