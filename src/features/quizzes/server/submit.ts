"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { gradeAnswers } from "@/server/quizzes/grade";

/**
 * Handing a quiz in (FR-Q5, FR-Q7, US-G3, Sprint 52).
 *
 * **The server loads the answers, marks the paper, and computes the score.**
 * The browser sends what was written and nothing else — it never had the answer
 * key (see `QuizQuestion`) and it does not get to say how it did. That is the
 * whole reason a quiz is worth more than practice: the number is not one the
 * student could have produced themselves.
 *
 * **Every question is marked, including the blanks.** A skipped question scored
 * nothing, which is a fact rather than a judgement, and leaving it out would
 * make a quiz of twenty look like a quiz of seventeen and inflate the
 * percentage.
 */

export type SubmitResult =
  | { status: "ok"; attemptId: string; correct: number; total: number }
  | { status: "error"; message: string; nextStep: string };

export async function submitQuizAction(input: {
  quizId: string;
  /** What the student wrote, keyed by question. Missing means skipped. */
  answers: Record<string, string>;
  /** How long the sitting took, measured by the page that ran it. */
  durationSeconds: number;
}): Promise<SubmitResult> {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, subject_id, topic_id, status")
    .eq("id", input.quizId)
    .is("reviewer_id", null)
    .maybeSingle();

  if (!quiz || quiz.status !== "ready") {
    return {
      status: "error",
      message: "That quiz is no longer available.",
      nextStep: "Go back to your quizzes and pick another.",
    };
  }

  /* THE ANSWER KEY, read here and nowhere the browser can reach. RLS scopes it
     to the caller, so a student can only ever be marked against their own
     questions. */
  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, type, prompt, correct_answer")
    .eq("quiz_id", quiz.id)
    .order("position", { ascending: true });

  if (!questions?.length) {
    return {
      status: "error",
      message: "This quiz has no questions to mark.",
      nextStep: "Delete it and make another — your files are untouched.",
    };
  }

  const duration = Math.max(0, Math.min(Math.round(input.durationSeconds), 6 * 3600));
  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - duration * 1000);

  /* The attempt row first, so grading has something to key its idempotency on
     and so a submission that dies mid-marking leaves a visible unfinished
     attempt rather than nothing at all. `submitted_at` stays null until it is
     scored — the schema's own check constraint insists on that pairing. */
  const { data: attempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .insert({
      user_id: session.userId,
      quiz_id: quiz.id,
      started_at: startedAt.toISOString(),
      duration_seconds: duration,
    })
    .select("id")
    .single();

  if (attemptError || !attempt) {
    return {
      status: "error",
      message: "We could not record that attempt.",
      nextStep: "Try submitting again — your answers are still on screen.",
    };
  }

  const graded = await gradeAnswers({
    userId: session.userId,
    attemptId: attempt.id,
    answers: questions.map((question) => ({
      questionId: question.id,
      question: {
        type: question.type,
        answer: question.correct_answer,
        prompt: question.prompt,
      },
      given: input.answers[question.id] ?? "",
    })),
  });

  const correct = graded.filter((entry) => entry.verdict.correct).length;

  const { error: answersError } = await supabase.from("quiz_answers").insert(
    graded.map((entry) => ({
      user_id: session.userId,
      attempt_id: attempt.id,
      question_id: entry.questionId,
      /**
       * The text IS kept here, unlike the practice mistakes list.
       *
       * Not an inconsistency — a different need. Practice stores only the
       * verdict, because "show me the ones I missed" needs nothing more and
       * the text would make it a record of how badly someone was doing. A quiz
       * result has to show a student what they wrote: it is how they judge
       * whether the marking was fair, and they cannot sensibly overrule a
       * verdict on an answer they can no longer see.
       */
      given_answer: entry.given || null,
      is_correct: entry.verdict.correct,
      graded_by_ai: entry.verdict.byModel,
    })),
  );

  if (answersError) {
    return {
      status: "error",
      message: "We marked your quiz but could not save the answers.",
      nextStep: "Try submitting again.",
    };
  }

  await supabase
    .from("quiz_attempts")
    .update({
      submitted_at: endedAt.toISOString(),
      score_correct: correct,
      score_total: graded.length,
    })
    .eq("id", attempt.id);

  /* The same two writes a finished practice run makes, so a quiz shows up in
     the study history and moves mastery exactly as practice does. A quiz that
     did not count would be the harder measurement contributing less than the
     easier one. */
  await supabase.from("study_sessions").insert({
    user_id: session.userId,
    subject_id: quiz.subject_id,
    topic_id: quiz.topic_id,
    activity: "quiz",
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    duration_seconds: duration,
    items_total: graded.length,
    items_correct: correct,
  });

  if (quiz.topic_id) {
    await supabase.rpc("record_practice", {
      p_topic_id: quiz.topic_id,
      p_answered: graded.length,
      p_correct: correct,
    });
  }

  revalidatePath("/", "layout");
  return { status: "ok", attemptId: attempt.id, correct, total: graded.length };
}

/**
 * The student overrules a mark (FR-Q7).
 *
 * **Only a mark a MODEL made.** A multiple-choice answer was compared against
 * the option they picked; letting that be overturned would not be fairness, it
 * would be an edit button on their own score. A short answer is a judgement,
 * and the person who wrote it is better placed than the model to say whether
 * they meant the same thing.
 *
 * `student_override` records that they did it, beside `graded_by_ai` recording
 * that a model marked it first. Both stay, because the history of a grade is
 * part of the grade.
 */
export async function overrideAnswerAction(
  answerId: string,
  correct: boolean,
): Promise<SubmitResult> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data: answer } = await supabase
    .from("quiz_answers")
    .select("id, attempt_id, graded_by_ai, is_correct")
    .eq("id", answerId)
    .maybeSingle();

  if (!answer) {
    return {
      status: "error",
      message: "That answer is no longer in your attempt.",
      nextStep: "Reload the page.",
    };
  }

  if (!answer.graded_by_ai) {
    return {
      status: "error",
      message: "This one was not marked by Aki, so there is nothing to overrule.",
      nextStep: "Multiple choice is checked against the option you picked.",
    };
  }

  if (answer.is_correct === correct)
    return { status: "ok", attemptId: answer.attempt_id, correct: 0, total: 0 };

  await supabase
    .from("quiz_answers")
    .update({ is_correct: correct, student_override: correct })
    .eq("id", answerId);

  /* Rescored from the answers rather than by adding or subtracting one. A
     counter nudged in both directions drifts the moment anything else touches
     a row, and the answers are the source of truth for the score. */
  const { data: rows } = await supabase
    .from("quiz_answers")
    .select("is_correct")
    .eq("attempt_id", answer.attempt_id);

  const total = rows?.length ?? 0;
  const scoreCorrect = (rows ?? []).filter((row) => row.is_correct === true).length;

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .update({ score_correct: scoreCorrect, score_total: total })
    .eq("id", answer.attempt_id)
    .select("started_at, quizzes(subject_id)")
    .single();

  /**
   * The study session carries the same tally, and must move with it.
   *
   * Without this, overruling a mark would change the quiz's score while the
   * Progress page went on reporting the old one — two numbers for the same
   * paper, and the student would be right to trust neither.
   *
   * Matched on the start time rather than an id, because `study_sessions` has
   * no link to an attempt and adding one is a migration waiting on a working
   * `SUPABASE_ACCESS_TOKEN`. It is exact rather than approximate: submission
   * writes both rows from the same timestamp, so there is one session that
   * began at that instant and it is this one.
   *
   * Topic mastery is NOT corrected, and that is a known gap. `record_practice`
   * only ever adds, and refuses a tally with nothing answered, so it cannot
   * express "one of these was actually right". An overrule is rare and moves
   * mastery by one answer in however many a topic has; the fix is the same
   * migration.
   */
  if (attempt?.started_at) {
    await supabase
      .from("study_sessions")
      .update({ items_correct: scoreCorrect, items_total: total })
      .eq("activity", "quiz")
      .eq("started_at", attempt.started_at)
      .eq("subject_id", attempt.quizzes?.subject_id ?? "");
  }

  revalidatePath("/", "layout");
  return { status: "ok", attemptId: answer.attempt_id, correct: scoreCorrect, total };
}
