"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";

/**
 * Recording that studying happened, and how it went (FR-P1, US-H1).
 *
 * **This is the wire that was never connected.** `progress`, `study_sessions`
 * and `quiz_attempts` have existed since the Sprint 13 schema, and the
 * dashboard has read all three since Sprint 23 — but nothing in the product
 * ever wrote to them. A student could work through a deck and a practice set
 * and still be told "nothing measured yet", which was true and indefensible.
 *
 * **Written at the END of a session, once, not per answer.** Per-answer writes
 * would be forty round trips for a twelve-card deck and would record a session
 * every time someone opened a page and closed it. A session is a thing a
 * student finished; that is when it becomes a fact worth keeping.
 *
 * **What counts as mastery is narrower than what counts as studying**, and the
 * split is the point:
 *
 *  - Every finished session is recorded, whatever it was. That is the honest
 *    answer to "have I been working".
 *  - Only PRACTICE feeds `progress`, and only when the reviewer was scoped to a
 *    topic. Flashcards are self-marked recall — a student pressing "I had it"
 *    is not the same evidence as answering a question, and folding the two into
 *    one percentage is exactly the "mastery misleads students" risk in the
 *    register. Cards keep their own honest counts on `flashcards`.
 */

export type StudyActivity = "flashcards" | "practice" | "quiz" | "review" | "reading";

export type RecordSessionInput = {
  activity: StudyActivity;
  subjectId: string;
  /** Null for a whole-subject reviewer, which most of them are. */
  topicId: string | null;
  reviewerId: string;
  /** How many items were answered, and how many were right. */
  total: number;
  correct: number;
  /** Wall-clock seconds the student spent. Measured by the client that ran it. */
  durationSeconds: number;
};

export async function recordStudySessionAction(input: RecordSessionInput): Promise<void> {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  /* A session with nothing in it is not a session. Someone who opened a deck
     and left should not appear in their own history as having studied. */
  if (input.total <= 0) return;

  const correct = Math.max(0, Math.min(input.correct, input.total));
  /* Clamped rather than trusted. These numbers come from the browser, and a
     check constraint rejecting the row would lose a real session over a
     number nobody would have looked at. */
  const duration = Math.max(0, Math.min(input.durationSeconds, 6 * 3600));
  const endedAt = new Date();

  await supabase.from("study_sessions").insert({
    user_id: session.userId,
    subject_id: input.subjectId,
    topic_id: input.topicId,
    reviewer_id: input.reviewerId,
    activity: input.activity,
    started_at: new Date(endedAt.getTime() - duration * 1000).toISOString(),
    ended_at: endedAt.toISOString(),
    duration_seconds: duration,
    items_total: input.total,
    items_correct: correct,
  });

  /* Topic mastery, and only from practice. Through the RPC rather than a
     read-then-write: PostgREST cannot express `answered = answered + $1`, and
     two sessions finishing together would lose one of them. */
  if (input.activity === "practice" && input.topicId) {
    await supabase.rpc("record_practice", {
      p_topic_id: input.topicId,
      p_answered: input.total,
      p_correct: correct,
    });
  }

  /* The dashboard and the progress page both read this. Revalidated here
     rather than left to a reload, because the whole complaint was that
     finishing a session changed nothing anywhere. */
  revalidatePath("/", "layout");
}
