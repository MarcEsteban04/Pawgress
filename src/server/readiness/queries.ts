import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { LOW_EVIDENCE_QUESTIONS } from "@/types";
import { addDays, dateKeyAt } from "@/features/planner/dates";
import { EVENT_KIND_INFO } from "@/features/planner/schema";
import { type UrgencyBand } from "@/features/planner/urgency";
import {
  READINESS_WINDOW_DAYS,
  readinessOf,
  type Readiness,
  type ReadinessInputs,
} from "@/features/readiness/score";
import { getSubjectMastery, getTopicMastery } from "@/server/mastery/queries";
import { listDeadlines } from "@/server/planner/deadlines";
import { getStudentToday } from "@/server/planner/queries";
import { getProfile } from "@/server/profile/queries";

/**
 * Readiness for every active subject, with its inputs (FR-D2, Sprint 71).
 *
 * One loader for the dashboard and the subject hub, so the two can never show
 * different readiness for the same subject — the mistake Sprint 56 fixed for
 * mastery. Mastery and deadlines are request-cached loaders the dashboard
 * already reads; the one read of its own is the fortnight's study sessions.
 */

export type SubjectReadiness = {
  subjectId: string;
  /** Null below the mastery evidence threshold — see `readinessOf`. */
  readiness: Readiness | null;
  inputs: ReadinessInputs;
  /** Shown beside the score, not counted in it — mastery already holds them. */
  weakTopics: number;
  /** The subject's next assessed deadline, and how pressing it is (Sprint 62). */
  nextExam: { title: string; daysAway: number; band: UrgencyBand } | null;
};

export const getSubjectReadiness = cache(async (): Promise<Map<string, SubjectReadiness>> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();
  const today = await getStudentToday();
  const firstDay = addDays(today, -(READINESS_WINDOW_DAYS - 1));

  const [{ data: subjects }, subjectMastery, topicMastery, deadlines, profile, { data: sessions }] =
    await Promise.all([
      supabase.from("subjects").select("id, topics(count)").is("archived_at", null),
      getSubjectMastery(),
      getTopicMastery(),
      listDeadlines(),
      getProfile(),
      /* A day wider than the window: the filter below is by the STUDENT's
         calendar day, and the query can only compare instants. */
      supabase
        .from("study_sessions")
        .select("subject_id, started_at, activity, items_total, items_correct")
        .not("ended_at", "is", null)
        .gte("started_at", addDays(firstDay, -1)),
    ]);

  const dayOf = (iso: string) => dateKeyAt(Date.parse(iso), profile?.timezone);
  const inWindow = (sessions ?? []).filter((row) => dayOf(row.started_at) >= firstDay);

  const result = new Map<string, SubjectReadiness>();
  for (const subject of subjects ?? []) {
    const mastery = subjectMastery.get(subject.id);
    const topics = [...topicMastery.values()].filter((topic) => topic.subjectId === subject.id);
    const own = inWindow.filter((row) => row.subject_id === subject.id);

    const scored = own.filter(
      (row) =>
        (row.activity === "practice" || row.activity === "quiz") && (row.items_total ?? 0) > 0,
    );
    const recent =
      scored.length > 0
        ? {
            correct: scored.reduce((sum, row) => sum + (row.items_correct ?? 0), 0),
            total: scored.reduce((sum, row) => sum + (row.items_total ?? 0), 0),
            runs: scored.length,
          }
        : null;

    const inputs: ReadinessInputs = {
      mastery: mastery && mastery.questions >= LOW_EVIDENCE_QUESTIONS ? mastery.mastery : null,
      answered: mastery?.questions ?? 0,
      topics: subject.topics?.[0]?.count ?? 0,
      measuredTopics: topics.filter((topic) => topic.questions >= LOW_EVIDENCE_QUESTIONS).length,
      recent,
      studyDays: new Set(own.map((row) => dayOf(row.started_at))).size,
    };

    /* The soonest assessed, unfinished deadline in this subject — the same
       rule as the planner's countdown, scoped to one subject. */
    const next = deadlines
      .filter(
        (deadline) =>
          deadline.subjectId === subject.id &&
          deadline.completedAt === null &&
          deadline.daysAway >= 0 &&
          EVENT_KIND_INFO[deadline.kind].assessed,
      )
      .sort((a, b) => a.daysAway - b.daysAway)[0];

    result.set(subject.id, {
      subjectId: subject.id,
      readiness: readinessOf(inputs),
      inputs,
      weakTopics: topics.filter((topic) => topic.band === "weak").length,
      nextExam: next
        ? { title: next.title, daysAway: next.daysAway, band: next.urgency.band }
        : null,
    });
  }

  return result;
});
