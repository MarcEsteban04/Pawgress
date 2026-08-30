import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { type QuestionType } from "@/features/practice/schema";
import { type JobStatus } from "@/types";

/** Practice questions (FR-C2, US-F3). RLS scopes every statement to the caller. */

export type PracticeQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  choices: string[];
  answer: string;
  explanation: string | null;
};

export type PracticeSet = {
  /** Null when nobody has ever asked for questions from this reviewer. */
  id: string | null;
  status: JobStatus | null;
  failureMessage: string | null;
  questions: PracticeQuestion[];
};

/* `choices` is jsonb, so it arrives as `unknown`. Narrowed where it is read
   rather than trusted deeper in: we wrote it through a Zod schema, but a column
   that can hold anything should be checked at the boundary. */
function readChoices(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export const getPracticeSet = cache(async (reviewerId: string): Promise<PracticeSet> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, status")
    .eq("reviewer_id", reviewerId)
    .maybeSingle();

  if (!quiz) return { id: null, status: null, failureMessage: null, questions: [] };

  const [{ data: rows }, { data: job }] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select("id, type, prompt, choices, correct_answer, explanation")
      .eq("quiz_id", quiz.id)
      /* By position, which is the order they were written in. The generator
         mixes types deliberately — shuffling would clump three true/false
         questions together as often as not. */
      .order("position", { ascending: true }),
    supabase
      .from("jobs")
      .select("failure_message")
      .eq("kind", "generate_quiz")
      .eq("target_id", quiz.id)
      .maybeSingle(),
  ]);

  return {
    id: quiz.id,
    status: quiz.status as JobStatus,
    /* Read from the JOB: there is no foreign key from a quiz to the job that
       produced it, so PostgREST cannot join them. */
    failureMessage: job?.failure_message ?? null,
    questions: (rows ?? []).map((row) => ({
      id: row.id,
      type: row.type as QuestionType,
      prompt: row.prompt,
      choices: readChoices(row.choices),
      answer: row.correct_answer,
      explanation: row.explanation,
    })),
  };
});

/** Just the count, for the reviewer page's link. */
export const countPracticeQuestions = cache(async (reviewerId: string): Promise<number> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("question_count, status")
    .eq("reviewer_id", reviewerId)
    .maybeSingle();

  /* Zero unless the set is finished. `question_count` is written at the end of
     generation, so a queued set reports 0 anyway — this is belt and braces
     against a half-written one advertising questions nobody can answer yet. */
  return quiz?.status === "ready" ? (quiz.question_count ?? 0) : 0;
});
