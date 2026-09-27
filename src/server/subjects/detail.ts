import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { getSubjectMastery, getTopicMastery } from "@/server/mastery/queries";
import { type JobStatus, LOW_EVIDENCE_QUESTIONS } from "@/types";

/**
 * Everything the subject page reads (FR-S5, US-B5).
 *
 * Deliberately split into one exported function per PANEL rather than a single
 * `getSubjectDetail()`. US-B5 requires that a section never blocks the others
 * from rendering, and that is only achievable if each section awaits its own
 * promise inside its own Suspense boundary. One combined query would make the
 * slowest panel the speed of the page.
 *
 * Most of these return empty today, and that is correct rather than broken:
 * nothing writes materials until Sprint 25, quizzes until 49, attempts until
 * 52, progress until 56, or planner events until 60. The panels say which of
 * those it is instead of inventing numbers — see `PanelEmpty`'s `awaiting`.
 *
 * No `user_id` filters: RLS scopes every statement to the caller (Sprint 14).
 */

/* ------------------------------------------------------------------ progress */

export type SubjectProgress = {
  topicCount: number;
  /** Topics with enough answers to be quoted. Never more than `topicCount`. */
  measuredTopics: number;
  /** Null when this subject has not crossed the evidence bar. */
  mastery: number | null;
  /** Distinct questions answered in this subject, tagged to a topic or not. */
  questionsAnswered: number;
};

/**
 * The subject's own mastery — from the Sprint 56 formula over EVERY answer in
 * the subject, not a blend of its topics' figures.
 *
 * Two improvements over the old tally, and both change the number. Answers
 * with no topic count: a whole-subject quiz written before questions were
 * tagged is still evidence about the subject, and the tally could only file it
 * under a topic, so it dropped it. And the subject is scored directly rather
 * than averaged from topics, which would let a topic with three answers weigh
 * as much as one with ninety.
 */
export const getSubjectProgress = cache(async (subjectId: string): Promise<SubjectProgress> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const [{ data: topicRows }, subjects, topics] = await Promise.all([
    supabase.from("topics").select("id").eq("subject_id", subjectId),
    getSubjectMastery(),
    getTopicMastery(),
  ]);

  const ids = (topicRows ?? []).map((row) => row.id);
  const subject = subjects.get(subjectId);

  return {
    topicCount: ids.length,
    measuredTopics: ids.filter((id) => (topics.get(id)?.questions ?? 0) >= LOW_EVIDENCE_QUESTIONS)
      .length,
    // Withheld below the evidence bar for the same reason MasteryBar withholds
    // it: a confident number from four answers is worse than no number (US-H1).
    mastery: subject && subject.questions >= LOW_EVIDENCE_QUESTIONS ? subject.mastery : null,
    questionsAnswered: subject?.questions ?? 0,
  };
});

/* ----------------------------------------------------------------- materials */

export type SubjectMaterial = {
  id: string;
  title: string;
  kind: string;
  status: JobStatus;
  topicName: string | null;
  createdAt: string;
};

export const listSubjectMaterials = cache(
  async (subjectId: string, limit = 6): Promise<SubjectMaterial[]> => {
    await requireSession();
    const supabase = await createSupabaseServerClient();

    const { data } = await supabase
      .from("materials")
      .select("id, title, kind, status, created_at, topics(name)")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      status: row.status as JobStatus,
      topicName: row.topics?.name ?? null,
      createdAt: row.created_at,
    }));
  },
);

/* ------------------------------------------------------------------ upcoming */

export type SubjectUpcoming = {
  id: string;
  title: string;
  kind: string;
  dueOn: string;
  inDays: number;
};

/**
 * Exams and deadlines attached to this subject (FR-N2).
 *
 * `today` is passed in rather than read here so the "in N days" figure is
 * computed against one instant for the whole render. Reading the clock inside
 * a query means two panels can straddle midnight and disagree.
 */
export const listSubjectUpcoming = cache(
  async (subjectId: string, today: string): Promise<SubjectUpcoming[]> => {
    await requireSession();
    const supabase = await createSupabaseServerClient();

    const { data } = await supabase
      .from("planner_events")
      .select("id, title, kind, due_on")
      .eq("subject_id", subjectId)
      .is("completed_at", null)
      .gte("due_on", today)
      .order("due_on", { ascending: true })
      .limit(4);

    const start = new Date(`${today}T00:00:00Z`).getTime();

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      dueOn: row.due_on,
      inDays: Math.round((new Date(`${row.due_on}T00:00:00Z`).getTime() - start) / 86_400_000),
    }));
  },
);

/* ------------------------------------------------------------------ activity */

export type SubjectActivityItem = {
  id: string;
  kind: "material" | "quiz" | "session";
  title: string;
  detail: string | null;
  at: string;
};

/**
 * Recent activity, merged from three tables (FR-S5).
 *
 * Merged in TypeScript rather than by a database view or a UNION: three small
 * limited reads that run concurrently beat one query the schema does not
 * support, and a view would have to be migrated every time a new kind of
 * activity is added. Each source is capped before the merge so a hundred
 * uploads cannot crowd out the one quiz attempt.
 */
export const listSubjectActivity = cache(
  async (subjectId: string, limit = 6): Promise<SubjectActivityItem[]> => {
    await requireSession();
    const supabase = await createSupabaseServerClient();

    const [materials, attempts, sessions] = await Promise.all([
      supabase
        .from("materials")
        .select("id, title, created_at")
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("quiz_attempts")
        .select("id, submitted_at, score_correct, score_total, quizzes!inner(title, subject_id)")
        .eq("quizzes.subject_id", subjectId)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(limit),
      supabase
        .from("study_sessions")
        .select("id, activity, ended_at, duration_seconds")
        .eq("subject_id", subjectId)
        .not("ended_at", "is", null)
        .order("ended_at", { ascending: false })
        .limit(limit),
    ]);

    const items: SubjectActivityItem[] = [
      ...(materials.data ?? []).map((row) => ({
        id: `material-${row.id}`,
        kind: "material" as const,
        title: row.title,
        detail: "added",
        at: row.created_at,
      })),
      ...(attempts.data ?? []).map((row) => ({
        id: `attempt-${row.id}`,
        kind: "quiz" as const,
        title: row.quizzes?.title ?? "Quiz",
        detail:
          row.score_correct !== null && row.score_total !== null
            ? `${row.score_correct}/${row.score_total}`
            : "submitted",
        at: row.submitted_at!,
      })),
      ...(sessions.data ?? []).map((row) => ({
        id: `session-${row.id}`,
        kind: "session" as const,
        title: row.activity,
        detail: row.duration_seconds ? `${Math.round(row.duration_seconds / 60)}m` : null,
        at: row.ended_at!,
      })),
    ];

    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  },
);
