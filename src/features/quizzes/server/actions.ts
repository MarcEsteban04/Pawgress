"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { enqueueJob } from "@/server/jobs/enqueue";
import { isQuizDifficulty, type QuizDifficulty } from "@/features/practice/schema";
import { defaultQuizTitle, isQuizLength, DEFAULT_QUIZ_LENGTH } from "@/features/quizzes/schema";

/**
 * Making a quiz (FR-Q1, US-G1, Sprint 49).
 *
 * **From the material, over a scope the student picked.** A practice set is
 * generated from a reviewer and examines what the study aid taught; a quiz has
 * no reviewer and examines the material itself, including the parts the
 * reviewer left out. `reviewer_id is null` is what distinguishes the two, here
 * and in every query that reads them back.
 *
 * **Checked before the job, not by it.** "There is nothing in this subject to
 * write questions from" is something a student can act on NOW. Letting the job
 * discover it a minute later costs them the minute and puts a red badge on a
 * quiz that never had a chance.
 */

export type QuizResult =
  { status: "ok"; quizId: string } | { status: "error"; message: string; nextStep: string };

export type CreateQuizInput = {
  subjectId: string;
  topicId: string | null;
  difficulty: QuizDifficulty;
  count: number;
  /** Blank means "name it for me" — see `defaultQuizTitle`. */
  title?: string;
};

export async function createQuizAction(input: CreateQuizInput): Promise<QuizResult> {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  /* Re-validated on the server. The picker only offers legal values, but a
     Server Action is a public endpoint and the column's CHECK would surface a
     constraint violation as "we could not start that quiz" — a message about
     our problem, wearing the student's name. */
  const difficulty = isQuizDifficulty(input.difficulty) ? input.difficulty : "medium";
  const count = isQuizLength(input.count) ? input.count : DEFAULT_QUIZ_LENGTH;

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("id", input.subjectId)
    .maybeSingle();

  if (!subject) {
    return {
      status: "error",
      message: "That subject is no longer in your library.",
      nextStep: "Pick another one.",
    };
  }

  /* Topic looked up rather than trusted: the name goes in the default title,
     and a topic id from another subject would produce a quiz labelled with
     someone else's chapter. RLS already stops it being another STUDENT's. */
  let topicName: string | null = null;
  if (input.topicId) {
    const { data: topic } = await supabase
      .from("topics")
      .select("name, subject_id")
      .eq("id", input.topicId)
      .maybeSingle();

    if (!topic || topic.subject_id !== subject.id) {
      return {
        status: "error",
        message: "That topic is not in this subject.",
        nextStep: "Choose the subject first, then its topic.",
      };
    }
    topicName = topic.name;
  }

  /* The same readable-text test the generator applies, run early. Extraction
     finishes before embedding, so a file still being indexed can be examined —
     what cannot is one with no text at all. */
  let check = supabase
    .from("materials")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", subject.id)
    .not("extracted_text", "is", null);

  if (input.topicId) check = check.eq("topic_id", input.topicId);
  const { count: readable } = await check;

  if (!readable) {
    return {
      status: "error",
      message: input.topicId
        ? "There is nothing filed under this topic to write questions from."
        : "There is nothing in this subject to write questions from.",
      nextStep: "Upload a file, or wait for one to finish processing.",
    };
  }

  const title = (
    input.title?.trim() ||
    defaultQuizTitle({ subjectName: subject.name, topicName, difficulty, count })
  ).slice(0, 300);

  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      user_id: session.userId,
      subject_id: subject.id,
      topic_id: input.topicId,
      /* The column that makes this a quiz rather than a practice set. */
      reviewer_id: null,
      title,
      difficulty,
      /* The REQUEST, until the generator replaces it with what it managed to
         write. Safe because every reader checks `status === "ready"` first. */
      question_count: count,
      /* Timed mock exams are Sprint 54. A quiz is untimed. */
      is_mock_exam: false,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: "We could not start that quiz.",
      nextStep: "Try again in a moment.",
    };
  }

  await enqueueJob({
    userId: session.userId,
    kind: "generate_quiz",
    subjectId: subject.id,
    targetId: data.id,
  });

  revalidatePath("/", "layout");
  return { status: "ok", quizId: data.id };
}

/**
 * Delete a quiz.
 *
 * `quiz_questions` and `quiz_attempts` cascade from the Sprint 13 schema, so
 * the attempts go with it. That is right for a quiz the student is discarding
 * and is exactly why deleting a REVIEWER leaves its quiz behind instead — there
 * the student asked to remove the study aid, not their own record.
 */
export async function deleteQuizAction(quizId: string): Promise<QuizResult> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("quizzes")
    .delete()
    .eq("id", quizId)
    /* Belt and braces beside RLS: this endpoint must never be able to remove a
       practice set, which belongs to a reviewer and has its own delete path. */
    .is("reviewer_id", null);

  if (error) {
    return {
      status: "error",
      message: "We could not delete that quiz.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "ok", quizId };
}
