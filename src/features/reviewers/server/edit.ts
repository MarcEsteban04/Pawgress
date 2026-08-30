"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { enqueueJob } from "@/server/jobs/enqueue";
import {
  reviewerDocumentSchema,
  type ReviewerDocument,
  type ReviewerSection,
} from "@/features/reviewers/schema";

/**
 * Editing a reviewer (FR-R5, US-F5, Sprint 46).
 *
 * **The whole document is written every time, and validated on the way in.**
 * The alternative — patching one jsonb key with a PostgREST expression — cannot
 * check the bounds the generator was held to, so a student pasting four
 * thousand words into a summary would produce a reviewer the model itself was
 * forbidden from writing. Reading, merging and validating costs one extra round
 * trip and keeps one definition of what a reviewer may contain.
 *
 * **Every write stamps `editedAt`.** The reviewer page says who wrote it, and
 * that sentence has to stop being about Aki the moment a human changes a word.
 */

export type EditResult = { status: "ok" } | { status: "error"; message: string; nextStep: string };

/** Load and narrow the stored document, or explain why we cannot edit it. */
async function loadDocument(reviewerId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("reviewers")
    .select("id, subject_id, content, status")
    .eq("id", reviewerId)
    .maybeSingle();

  if (!data) return { error: "gone" as const };

  const parsed = reviewerDocumentSchema.safeParse(data.content);
  /* A reviewer that has not finished generating has no document to edit, and
     one whose stored content does not parse is a bug we should not paper over
     by letting someone save on top of it. */
  if (!parsed.success) return { error: "unreadable" as const };

  return { supabase, row: data, document: parsed.data };
}

const GONE = {
  status: "error" as const,
  message: "That reviewer is no longer in your library.",
  nextStep: "Reload the page.",
};

const UNREADABLE = {
  status: "error" as const,
  message: "This reviewer has not finished generating yet.",
  nextStep: "Wait for it to finish, then edit it.",
};

/**
 * Save an edit.
 *
 * Takes the fields that changed, not the whole document: the client holds one
 * section at a time, and sending the rest back would let a stale tab overwrite
 * a section it never displayed.
 */
export async function updateReviewerAction(
  reviewerId: string,
  patch: Partial<
    Pick<ReviewerDocument, "title" | "summary" | "concepts" | "terms" | "focus" | "notes">
  >,
): Promise<EditResult> {
  await requireSession();

  const loaded = await loadDocument(reviewerId);
  if ("error" in loaded) return loaded.error === "gone" ? GONE : UNREADABLE;

  const next = reviewerDocumentSchema.safeParse({
    ...loaded.document,
    ...patch,
    editedAt: new Date().toISOString(),
  });

  if (!next.success) {
    /* The first message, not all of them. A student who pasted too much into
       one field does not need a list of everything else that is fine. */
    const issue = next.error.issues[0];
    return {
      status: "error",
      message: "That change does not fit.",
      nextStep: issue?.message
        ? `${issue.message}. Shorten it and try again.`
        : "Try a shorter edit.",
    };
  }

  const { error } = await loaded.supabase
    .from("reviewers")
    .update({
      content: next.data,
      /* The title column and the title inside the document are the same fact
         stored twice — the column so lists can be sorted and searched without
         reading jsonb, the document so one write updates one thing. Kept in
         step here rather than left to drift. */
      ...(patch.title ? { title: next.data.title } : {}),
    })
    .eq("id", reviewerId);

  if (error) {
    return {
      status: "error",
      message: "We could not save that change.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "ok" };
}

/**
 * Rewrite one section from the material.
 *
 * A job, not a server action: it is a model call over the whole of a subject's
 * text, which is neither fast enough to hold a request open nor cheap enough to
 * repeat because someone's tab timed out.
 *
 * The section rides in the document rather than in the job, because the jobs
 * table has no payload column. Recorded BEFORE the job is enqueued, so the
 * worker cannot claim it and find nothing to do.
 */
export async function regenerateSectionAction(
  reviewerId: string,
  section: ReviewerSection,
): Promise<EditResult> {
  const session = await requireSession();

  const loaded = await loadDocument(reviewerId);
  if ("error" in loaded) return loaded.error === "gone" ? GONE : UNREADABLE;

  const { error } = await loaded.supabase
    .from("reviewers")
    .update({
      content: { ...loaded.document, pendingSection: section },
      status: "generating",
    })
    .eq("id", reviewerId);

  if (error) {
    return {
      status: "error",
      message: "We could not start that rewrite.",
      nextStep: "Try again in a moment.",
    };
  }

  await enqueueJob({
    userId: session.userId,
    kind: "generate_reviewer",
    subjectId: loaded.row.subject_id,
    targetId: reviewerId,
  });

  revalidatePath("/", "layout");
  return { status: "ok" };
}
