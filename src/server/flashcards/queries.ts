import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { type JobStatus } from "@/types";

/** Flashcards (FR-R2, US-F2). RLS scopes every statement to the caller. */

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  timesSeen: number;
  timesKnown: number;
  lastSeenAt: string | null;
};

export type FlashcardDeck = {
  cards: Flashcard[];
  /**
   * How the generation job is doing.
   *
   * Read from the JOB rather than from a set row, because a deck is not a row —
   * it is however many cards point at one reviewer. `null` means nobody has
   * ever asked for cards from this reviewer, which is different from asking and
   * getting none.
   */
  status: JobStatus | null;
  failureMessage: string | null;
  /** Cards the student has answered correctly at least once. */
  knownCount: number;
};

export const getFlashcardDeck = cache(async (reviewerId: string): Promise<FlashcardDeck> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const [{ data: cards }, { data: job }] = await Promise.all([
    supabase
      .from("flashcards")
      .select("id, front, back, times_seen, times_known, last_seen_at")
      .eq("reviewer_id", reviewerId)
      /* Insertion order. The generator wrote them in the order the reviewer
         presents its concepts, which is the order a student was told to revise
         in — shuffling here would throw that away before they have seen it
         once. The session shuffles later, on purpose. */
      .order("created_at", { ascending: true }),
    supabase
      .from("jobs")
      .select("status, failure_message")
      .eq("kind", "generate_flashcards")
      .eq("target_id", reviewerId)
      .maybeSingle(),
  ]);

  const list = (cards ?? []).map((row) => ({
    id: row.id,
    front: row.front,
    back: row.back,
    timesSeen: row.times_seen,
    timesKnown: row.times_known,
    lastSeenAt: row.last_seen_at,
  }));

  return {
    cards: list,
    status: (job?.status as JobStatus | undefined) ?? null,
    failureMessage: job?.failure_message ?? null,
    knownCount: list.filter((card) => card.timesKnown > 0).length,
  };
});

/** Just the count, for the reviewer page's link. Cheap enough to run always. */
export const countFlashcards = cache(async (reviewerId: string): Promise<number> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("reviewer_id", reviewerId);

  return count ?? 0;
});
