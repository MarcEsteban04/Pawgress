import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { type QuestionType } from "@/features/practice/schema";
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
  /** Null means untimed, which is the default. */
  timeLimitSeconds: number | null;
  /** Longer, always timed, shuffled every sitting (Sprint 54). */
  isMockExam: boolean;
  /**
   * How many questions are saved so far, while a long paper is being written
   * in slices. Null when the job has not reported progress — which is the
   * normal case for anything that fits one slice.
   */
  written: number | null;
  failureMessage: string | null;
};

const SELECT =
  "id, title, status, difficulty, question_count, time_limit_seconds, is_mock_exam, subject_id, topic_id, created_at, topics(name), subjects(name, color_slot), quiz_attempts(id, submitted_at, score_correct, score_total)";

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
  time_limit_seconds: number | null;
  is_mock_exam: boolean;
  subject_id: string;
  created_at: string;
  topics: { name: string } | null;
  subjects: { name: string; color_slot: number } | null;
  quiz_attempts: AttemptRow[] | null;
}): Omit<QuizSummary, "failureMessage" | "written"> {
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
    timeLimitSeconds: row.time_limit_seconds,
    isMockExam: row.is_mock_exam,
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
    return (data ?? []).map((row) => ({ ...summarise(row), failureMessage: null, written: null }));
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
    .select("failure_message, slice_cursor")
    .eq("kind", "generate_quiz")
    .eq("target_id", id)
    .maybeSingle();

  return {
    ...summarise(data),
    written: job?.slice_cursor ?? null,
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

/* -------------------------------------------------------------------------- */
/*  Taking a quiz                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A question as the BROWSER is allowed to see it.
 *
 * **No `answer`, and no `explanation`.** `PracticeQuestion` carries both,
 * because practice marks each answer the moment it is given and has to. A quiz
 * is marked at the end, server-side, and sending the answers down with the
 * questions would put the whole key in the page source — one devtools tab away
 * from a score that means nothing. This is not a hypothetical: the two types
 * differ by exactly the two fields worth protecting, which is why this is its
 * own type rather than a comment asking future code to be careful.
 */
export type QuizQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  choices: string[];
};

export const getQuizQuestions = cache(async (quizId: string): Promise<QuizQuestion[]> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("quiz_questions")
    /* The columns are the allow-list. `correct_answer` and `explanation` are
       not selected at all, so they cannot reach a serialised prop by accident
       — a filter applied after the fact is one refactor away from being lost. */
    .select("id, type, prompt, choices")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type as QuestionType,
    prompt: row.prompt,
    choices: Array.isArray(row.choices)
      ? row.choices.filter((choice): choice is string => typeof choice === "string")
      : [],
  }));
});

/* -------------------------------------------------------------------------- */
/*  A finished attempt                                                         */
/* -------------------------------------------------------------------------- */

export type AttemptAnswer = {
  /** The answer row, which is what an override targets. */
  id: string;
  questionId: string;
  position: number;
  type: QuestionType;
  prompt: string;
  given: string | null;
  correct: boolean;
  /** True when a model decided it — the only marks a student may overrule. */
  gradedByAi: boolean;
  /** Whether they already did. */
  overridden: boolean;
  /**
   * The answer and the reason — null until the attempt is SUBMITTED.
   *
   * Everywhere else in this file the key is kept from the browser, because a
   * student in the middle of a quiz must not be able to read it. Once the
   * paper is handed in there is nothing left to protect and everything to
   * teach, so this is the one query that selects them — and it still returns
   * null for an attempt with no `submitted_at`, so a half-finished row cannot
   * be used to fish the answers out.
   */
  correctAnswer: string | null;
  explanation: string | null;
  /** The chapter it came from, when we know. See the Sprint 53 `source` field. */
  topicId: string | null;
  topicName: string | null;
};

export type Attempt = {
  id: string;
  quizId: string;
  quizTitle: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  subjectName: string;
  correct: number;
  total: number;
  durationSeconds: number | null;
  submittedAt: string | null;
  /** A mock exam gets a readiness verdict; a quiz does not (Sprint 54). */
  isMockExam: boolean;
  /**
   * The attempt before this one at the same paper, if there was one.
   *
   * The single most useful comparison a student can make — "am I getting
   * better at THIS" — and the only one that is fair: same questions, same
   * difficulty, same material. Comparing across different quizzes would be
   * comparing papers, not progress.
   */
  previous: { correct: number; total: number } | null;
  answers: AttemptAnswer[];
};

/**
 * One attempt, with every question marked.
 *
 * **Reads the answers from `quiz_answers`, not by re-marking.** The verdict was
 * decided once, at submission, and re-deriving it here would make a student's
 * score depend on when they happened to open the page — and would silently
 * discard any mark they had overruled.
 */
export const getAttempt = cache(async (attemptId: string): Promise<Attempt | null> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("quiz_attempts")
    .select(
      "id, quiz_id, score_correct, score_total, duration_seconds, submitted_at, quizzes(title, is_mock_exam, subjects(name, color_slot)), quiz_answers(id, question_id, given_answer, is_correct, graded_by_ai, student_override, quiz_questions(position, type, prompt, correct_answer, explanation, topic_id, topics(name)))",
    )
    .eq("id", attemptId)
    .maybeSingle();

  if (!data) return null;

  const submitted = data.submitted_at !== null;

  /* The attempt immediately before this one. Only submitted ones: an abandoned
     sitting has no score, and comparing against a zero the student never
     earned would invent an improvement. */
  const { data: before } = submitted
    ? await supabase
        .from("quiz_attempts")
        .select("score_correct, score_total")
        .eq("quiz_id", data.quiz_id)
        .not("submitted_at", "is", null)
        .lt("submitted_at", data.submitted_at as string)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const answers: AttemptAnswer[] = (data.quiz_answers ?? [])
    .map((row) => ({
      id: row.id,
      questionId: row.question_id,
      position: row.quiz_questions?.position ?? 0,
      type: (row.quiz_questions?.type ?? "mcq") as QuestionType,
      prompt: row.quiz_questions?.prompt ?? "",
      given: row.given_answer,
      correct: row.is_correct === true,
      gradedByAi: row.graded_by_ai,
      overridden: row.student_override !== null,
      correctAnswer: submitted ? (row.quiz_questions?.correct_answer ?? null) : null,
      explanation: submitted ? (row.quiz_questions?.explanation ?? null) : null,
      topicId: row.quiz_questions?.topic_id ?? null,
      topicName: row.quiz_questions?.topics?.name ?? null,
    }))
    /* Back into the order they were asked. PostgREST returns an embedded set
       in no guaranteed order, and a results list that shuffles between reloads
       is one nobody can check against the paper they just sat. */
    .sort((a, b) => a.position - b.position);

  return {
    id: data.id,
    quizId: data.quiz_id,
    quizTitle: data.quizzes?.title ?? "Quiz",
    colorSlot: slot(data.quizzes?.subjects?.color_slot),
    subjectName: data.quizzes?.subjects?.name ?? "",
    correct: data.score_correct ?? 0,
    total: data.score_total ?? answers.length,
    durationSeconds: data.duration_seconds,
    submittedAt: data.submitted_at,
    isMockExam: data.quizzes?.is_mock_exam ?? false,
    previous:
      before && before.score_total
        ? { correct: before.score_correct ?? 0, total: before.score_total }
        : null,
    answers,
  };
});
