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
 *
 * **Per-question verdicts, and NOT the answers themselves.** A run can now hand
 * over which questions were right and which were wrong, which is what the
 * mistakes list reads back. What a student actually typed is never stored:
 * `given_answer` stays null. The verdict is the whole of what "show me the ones
 * I missed" needs, and the text is the part that would turn this into a record
 * of how badly somebody was doing.
 */

/**
 * `matching` is separate from `review` because it carries a SCORE. `review` is
 * revision with nothing measured; a finished matching board has a result, and
 * folding the two together left it in a student's history as "Review · 9/12"
 * with nothing to say what the nine were.
 */
export type StudyActivity = "flashcards" | "practice" | "quiz" | "matching" | "review" | "reading";

/** One question's outcome. The question, and whether it was right — no answer text. */
export type AnswerOutcome = { questionId: string; correct: boolean };

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
  /**
   * The per-question verdicts, for a practice run.
   *
   * Both of these or neither: an attempt row with no answers under it is a
   * score with nothing to explain it. Omitted by flashcards and matching, which
   * have no questions to point at.
   */
  quizId?: string | null;
  answers?: AnswerOutcome[];
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

  /**
   * The attempt, and the verdicts under it.
   *
   * Best-effort and deliberately not awaited before the mastery write: a
   * student has finished either way, and losing one mistakes-list entry is a
   * far smaller failure than losing the session that proves they studied.
   */
  if (input.quizId && input.answers?.length) {
    const { data: attempt } = await supabase
      .from("quiz_attempts")
      .insert({
        user_id: session.userId,
        quiz_id: input.quizId,
        started_at: new Date(endedAt.getTime() - duration * 1000).toISOString(),
        submitted_at: endedAt.toISOString(),
        score_correct: correct,
        score_total: input.total,
        duration_seconds: duration,
      })
      .select("id")
      .single();

    if (attempt) {
      await supabase.from("quiz_answers").insert(
        input.answers.map((answer) => ({
          user_id: session.userId,
          attempt_id: attempt.id,
          question_id: answer.questionId,
          /* Never the text. See the header — the verdict is all the mistakes
             list needs, and the text is the part worth not keeping. */
          given_answer: null,
          is_correct: answer.correct,
        })),
      );
    }
  }

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
