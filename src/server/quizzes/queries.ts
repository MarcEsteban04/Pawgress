import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { type QuizDifficulty } from "@/features/quizzes/schema";
import { type JobStatus } from "@/types";

/**
 * Quizzes (FR-Q1, US-G1, Sprint 49).
 *
 * **Every query filters `reviewer_id is null`.** The `quizzes` table holds two
 * things — quizzes and the practice sets that hang off reviewers — and a
 * student opening their quizzes must never find the second kind. RLS scopes
 * rows to the caller; this predicate scopes them to the FEATURE, and the two
 * are not interchangeable.
 */

export type QuizSummary = {
  id: string;
  title: string;
  status: JobStatus;
  difficulty: QuizDifficulty;
  /** Trustworthy only once ready — before that it is what was asked for. */
  questionCount: number;
  subjectId: string;
  subjectName: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  topicName: string | null;
  attempts: number;
  /** The most recent scored attempt, if there is one. */
  lastScore: { correct: number; total: number } | null;
  createdAt: string;
  failureMessage: string | null;
};

const SELECT =
  "id, title, status, difficulty, question_count, subject_id, topic_id, created_at, topics(name), subjects(name, color_slot), quiz_attempts(id, submitted_at, score_correct, score_total)";

const slot = (value: number | null | undefined) => (value ?? 1) as 1 | 2 | 3 | 4 | 5;

type AttemptRow = {
  id: string;
  submitted_at: string | null;
  score_correct: number | null;
  score_total: number | null;
};

function summarise(row: {
  id: string;
  title: string;
  status: string;
  difficulty: string;
  question_count: number;
  subject_id: string;
  created_at: string;
  topics: { name: string } | null;
  subjects: { name: string; color_slot: number } | null;
  quiz_attempts: AttemptRow[] | null;
}): Omit<QuizSummary, "failureMessage"> {
  /* Scored attempts only, newest first. An abandoned attempt has no score and
     must not be reported as a zero the student never earned. */
  const scored = (row.quiz_attempts ?? [])
    .filter((attempt) => attempt.submitted_at && attempt.score_total)
    .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));

  const latest = scored[0];

  return {
    id: row.id,
    title: row.title,
    status: row.status as JobStatus,
    difficulty: row.difficulty as QuizDifficulty,
    questionCount: row.question_count,
    subjectId: row.subject_id,
    subjectName: row.subjects?.name ?? "",
    colorSlot: slot(row.subjects?.color_slot),
    topicName: row.topics?.name ?? null,
    attempts: scored.length,
    lastScore: latest
      ? { correct: latest.score_correct ?? 0, total: latest.score_total ?? 0 }
      : null,
    createdAt: row.created_at,
  };
}

export const listQuizzes = cache(
  async ({ subjectId }: { subjectId?: string } = {}): Promise<QuizSummary[]> => {
    await requireSession();
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("quizzes")
      .select(SELECT)
      .is("reviewer_id", null)
      .order("created_at", { ascending: false });

    if (subjectId) query = query.eq("subject_id", subjectId);

    const { data } = await query;

    /* No failure message on a list row. It would cost one extra query per quiz
       to fetch, and a list is not where a student reads WHY something broke —
       the badge says it failed and the detail page says what happened. */
    return (data ?? []).map((row) => ({ ...summarise(row), failureMessage: null }));
  },
);

export const getQuiz = cache(async (id: string): Promise<QuizSummary | null> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("quizzes")
    .select(SELECT)
    .eq("id", id)
    .is("reviewer_id", null)
    .maybeSingle();

  if (!data) return null;

  const { data: job } = await supabase
    .from("jobs")
    .select("failure_message")
    .eq("kind", "generate_quiz")
    .eq("target_id", id)
    .maybeSingle();

  return {
    ...summarise(data),
    /* Read from the JOB: no foreign key links a quiz to the job that produced
       it, so PostgREST cannot join them and asking it to would be a 400 at
       runtime rather than a compile error. */
    failureMessage: job?.failure_message ?? null,
  };
});

/** Subjects that already have a quiz, for the library's filter. */
export const listQuizSubjects = cache(async (): Promise<{ id: string; name: string }[]> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("quizzes")
    .select("subject_id, subjects(name)")
    .is("reviewer_id", null);

  const seen = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.subject_id && !seen.has(row.subject_id)) {
      seen.set(row.subject_id, row.subjects?.name ?? "");
    }
  }

  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
});
