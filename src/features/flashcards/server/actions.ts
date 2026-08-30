"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { enqueueJob } from "@/server/jobs/enqueue";

/**
 * Flashcards (FR-R2, US-F2, Sprint 44).
 *
 * Generation is a job, like the reviewer it comes from: it is one model call
 * over a whole document, which is longer than a student should watch a button
 * spin for and longer than a serverless request should hold open.
 *
 * Reviewing is NOT a job. Marking a card known has to land in the time it takes
 * to press a key, so it is a direct write and the UI never waits for it.
 */

export type FlashcardsResult =
  { status: "ok" } | { status: "error"; message: string; nextStep: string };

export async function generateFlashcardsAction(input: {
  subjectId: string;
  reviewerId: string;
}): Promise<FlashcardsResult> {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  /* Checked here rather than left to the handler, because "your reviewer is
     still being written" is something a student can act on now — and a job that
     fails a minute later to say the same thing costs a minute and a red badge. */
  const { data: reviewer } = await supabase
    .from("reviewers")
    .select("status")
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
      nextStep: "Wait for it to finish, then make cards from it.",
    };
  }

  /* `(kind, target_id)` is unique, so a double press enqueues one job. An
     existing FAILED or READY job is reset by the enqueue path, which is what
     makes "generate again" work at all. */
  await enqueueJob({
    userId: session.userId,
    kind: "generate_flashcards",
    subjectId: input.subjectId,
    targetId: input.reviewerId,
  });

  revalidatePath("/", "layout");
  return { status: "ok" };
}

/**
 * One card answered (FR-R2).
 *
 * **Counts, not a boolean.** A card is not "known" or "unknown" — it is a card
 * a student got right four times out of five, and storing only the last answer
 * throws away everything a spacing schedule would need later. `times_seen` and
 * `times_known` cost the same to write and keep that door open.
 *
 * Read-then-write rather than an atomic increment, because PostgREST has no
 * `column + 1`. The race it loses is one student answering the same card twice
 * at once, which is not a thing that happens.
 */
export async function reviewFlashcardAction(
  cardId: string,
  known: boolean,
): Promise<FlashcardsResult> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data: card } = await supabase
    .from("flashcards")
    .select("times_seen, times_known")
    .eq("id", cardId)
    .maybeSingle();

  if (!card) {
    return {
      status: "error",
      message: "That card is no longer in your deck.",
      nextStep: "Reload the page.",
    };
  }

  const { error } = await supabase
    .from("flashcards")
    .update({
      times_seen: card.times_seen + 1,
      times_known: card.times_known + (known ? 1 : 0),
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", cardId);

  if (error) {
    return {
      status: "error",
      message: "We could not record that answer.",
      nextStep: "Keep going — your progress on the other cards is saved.",
    };
  }

  /* Deliberately NOT revalidating. A student is mid-session; re-rendering the
     page under them would reset the deck they are holding. The counts are read
     fresh the next time they open it, which is when they matter. */
  return { status: "ok" };
}

/**
 * Start the deck over.
 *
 * Zeroes the counts rather than deleting and regenerating: the cards are still
 * the right cards, and paying for a model call to get the same ones back would
 * be spending a student's budget on our convenience.
 */
export async function resetFlashcardsAction(reviewerId: string): Promise<FlashcardsResult> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("flashcards")
    .update({ times_seen: 0, times_known: 0, last_seen_at: null })
    .eq("reviewer_id", reviewerId);

  if (error) {
    return {
      status: "error",
      message: "We could not reset this deck.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "ok" };
}
