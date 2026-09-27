import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { LOW_EVIDENCE_QUESTIONS } from "@/types";
import { getSubjectMastery, getTopicMastery } from "@/server/mastery/queries";

/**
 * Everything the dashboard reads, from the real database (FR-D1, FR-D3).
 *
 * This replaced `features/dashboard/sample-data.ts`, which rendered a full,
 * convincing dashboard for an account that had nothing in it. That file made
 * the design reviewable before the tables existed; kept any longer it would
 * have become a lie the product told about itself every time it loaded.
 *
 * Most of these return empty right now, and that is correct rather than
 * broken: nothing writes materials until Sprint 25, quiz attempts until 52,
 * progress until 56, planner events until 60, or plans until 65. The panels say
 * so instead of inventing numbers.
 *
 * No `user_id` filters — RLS scopes every query to the caller (Sprint 14).
 */

export type DashboardSubject = {
  id: string;
  name: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  materialCount: number;
  topicCount: number;
  /** Null when no topic under this subject has enough answers to be honest. */
  mastery: number | null;
  questionsAnswered: number;
};

export type MasteryBand = { label: string; value: number; step: 1 | 2 | 3 | 4 | "none" };

export type UpcomingItem = {
  id: string;
  title: string;
  subject: string | null;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  kind: string;
  dueOn: string;
  inDays: number;
};

export type PlanBlock = {
  id: string;
  subject: string | null;
  topic: string | null;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  activity: string;
  minutes: number;
  reason: string | null;
  done: boolean;
};

export type ScorePoint = { label: string; value: number };

export type DashboardStats = {
  subjects: number;
  materials: number;
  topicsTracked: number;
  quizzesTaken: number;
  /** Minutes studied in the last seven days. */
  minutesThisWeek: number;
};

export type DashboardData = {
  stats: DashboardStats;
  /** Quiz score per attempt, oldest first. One series, one unit, one axis. */
  scoreTrend: ScorePoint[];
  /** Minutes studied per day for the last seven days, oldest first. */
  studyByDay: { label: string; minutes: number }[];
  subjects: DashboardSubject[];
  masteryBands: MasteryBand[];
  topicsTracked: number;
  /** Overall readiness, or null when there is not enough evidence for one. */
  readiness: number | null;
  upcoming: UpcomingItem[];
  planToday: PlanBlock[];
  planMinutesRemaining: number;
};

/** Days from today to a `date` column, in whole days. */
function daysUntil(dueOn: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueOn}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export const getDashboardData = cache(async (): Promise<DashboardData> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const weekAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);

  const [subjectRows, topicMastery, subjectMastery, eventRows, planRows, sessionRows, scoredRows] =
    await Promise.all([
      supabase
        .from("subjects")
        .select("id, name, color_slot, materials(count), topics(count)")
        .is("archived_at", null)
        .order("created_at", { ascending: false }),
      /* Mastery from the Sprint 56 formula over the answers themselves, not the
         old running tally — the same loader the Progress page and the subject
         hub read, so all three show the same number. */
      getTopicMastery(),
      getSubjectMastery(),
      supabase
        .from("planner_events")
        .select("id, title, kind, due_on, subjects(name, color_slot)")
        .is("completed_at", null)
        .gte("due_on", today)
        .order("due_on", { ascending: true })
        .limit(5),
      supabase
        .from("study_plans")
        .select(
          "id, plan_date, study_plan_items(id, activity, minutes, reason, completed_at, position, topics(name), subjects(name, color_slot))",
        )
        .eq("plan_date", today)
        .maybeSingle(),
      supabase
        .from("study_sessions")
        .select("started_at, duration_seconds")
        .gte("started_at", weekAgo)
        .not("duration_seconds", "is", null),
      /**
       * Scored practice, for the trend line.
       *
       * Separate from the week's sessions above because it answers a different
       * question over a different window: that one is "how much have I studied
       * lately", this one is "am I getting better". Flashcards are excluded —
       * a self-marked recall tally on the same axis as answered questions
       * would be two measures sharing one line, which is the chart mistake the
       * design system bans outright.
       */
      supabase
        .from("study_sessions")
        .select("started_at, items_total, items_correct, activity")
        .in("activity", ["practice", "quiz"])
        .gt("items_total", 0)
        .order("started_at", { ascending: true })
        .limit(30),
    ]);

  /* Worst first, which is the order every consumer below wants. */
  const progress = [...topicMastery.values()].sort((a, b) => a.mastery - b.mastery);

  /* Mastery bands. Topics with too few answers sit in "Not started" rather than
     being binned by a percentage that MasteryBar would refuse to print — the
     donut must not claim confidence the bar withholds (US-H1). */
  const bands: Record<string, number> = {
    "Not started": 0,
    Weak: 0,
    Developing: 0,
    Solid: 0,
    Strong: 0,
  };

  for (const row of progress) {
    if (row.questions < LOW_EVIDENCE_QUESTIONS) {
      bands["Not started"] += 1;
      continue;
    }
    const value = row.mastery;
    if (value < 0.4) bands.Weak += 1;
    else if (value < 0.6) bands.Developing += 1;
    else if (value < 0.8) bands.Solid += 1;
    else bands.Strong += 1;
  }

  const masteryBands: MasteryBand[] = [
    { label: "Not started", value: bands["Not started"], step: "none" },
    { label: "Weak", value: bands.Weak, step: 1 },
    { label: "Developing", value: bands.Developing, step: 2 },
    { label: "Solid", value: bands.Solid, step: 3 },
    { label: "Strong", value: bands.Strong, step: 4 },
  ];

  /* Readiness is the mean mastery across topics that have enough evidence. With
     none, it is null — not zero. Zero would read as "you know nothing", when
     the truth is "nothing has been measured yet". */
  const evidenced = progress.filter((row) => row.questions >= LOW_EVIDENCE_QUESTIONS);
  const readiness =
    evidenced.length > 0
      ? evidenced.reduce((sum, row) => sum + row.mastery, 0) / evidenced.length
      : null;

  const planItems = (planRows.data?.study_plan_items ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);

  const planToday: PlanBlock[] = planItems.map((item) => ({
    id: item.id,
    subject: item.subjects?.name ?? null,
    topic: item.topics?.name ?? null,
    colorSlot: (item.subjects?.color_slot ?? 1) as 1 | 2 | 3 | 4 | 5,
    activity: item.activity,
    minutes: item.minutes,
    reason: item.reason,
    done: item.completed_at !== null,
  }));

  /* Quiz score per attempt. One series, one unit, one axis — a second measure
     with a different scale would need its own chart, never a second y-scale
     (docs/design-system.md §3). */
  const scored = scoredRows.data ?? [];

  /**
   * The trend, from STUDY SESSIONS alone.
   *
   * This used to merge `quiz_attempts` with scored sessions, on the reasoning
   * that they were two sources of the same measurement. They are the same
   * measurement of the same RUN: a quiz hand-in writes an attempt and a
   * session, and since the mistakes list a finished practice set does too — so
   * every run plotted twice and "quizzes taken" counted double. A session is
   * written exactly once per finished run of either kind, which makes it the
   * one source that cannot double-count.
   */
  const scoreTrend: ScorePoint[] = scored
    .map((row) => ({
      at: row.started_at,
      value: (row.items_correct ?? 0) / (row.items_total as number),
    }))
    .slice(-30)
    .map((point) => ({
      label: new Date(point.at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      value: point.value,
    }));

  /* Seven days, every one of them present. Skipping days with no sessions would
     draw a bar chart whose gaps silently disappear, making a patchy week look
     like a consistent one. */
  const sessions = sessionRows.data ?? [];
  const studyByDay = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(Date.now() - (6 - offset) * 86_400_000);
    const key = day.toISOString().slice(0, 10);
    const minutes = sessions
      .filter((row) => (row.started_at as string).slice(0, 10) === key)
      .reduce((sum, row) => sum + Math.round((row.duration_seconds ?? 0) / 60), 0);
    return { label: day.toLocaleDateString(undefined, { weekday: "narrow" }), minutes };
  });

  const subjectList = subjectRows.data ?? [];

  return {
    stats: {
      subjects: subjectList.length,
      materials: subjectList.reduce((sum, row) => sum + (row.materials?.[0]?.count ?? 0), 0),
      topicsTracked: progress.length,
      /* Every finished practice set and quiz, once each. See the trend above
         for why this counts sessions and not attempts. */
      quizzesTaken: scored.length,
      minutesThisWeek: studyByDay.reduce((sum, day) => sum + day.minutes, 0),
    },
    scoreTrend,
    studyByDay,
    subjects: subjectList.map((row) => {
      /* Scored directly over the subject's own answers — untagged ones
         included — rather than averaged from its topics. See
         getSubjectMastery. */
      const measured = subjectMastery.get(row.id);
      return {
        id: row.id,
        name: row.name,
        colorSlot: row.color_slot as 1 | 2 | 3 | 4 | 5,
        materialCount: row.materials?.[0]?.count ?? 0,
        topicCount: row.topics?.[0]?.count ?? 0,
        mastery: measured && measured.questions >= LOW_EVIDENCE_QUESTIONS ? measured.mastery : null,
        questionsAnswered: measured?.questions ?? 0,
      };
    }),
    masteryBands,
    topicsTracked: progress.length,
    readiness,
    upcoming: (eventRows.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      subject: row.subjects?.name ?? null,
      colorSlot: (row.subjects?.color_slot ?? 1) as 1 | 2 | 3 | 4 | 5,
      kind: row.kind,
      dueOn: row.due_on,
      inDays: daysUntil(row.due_on),
    })),
    planToday,
    planMinutesRemaining: planToday
      .filter((block) => !block.done)
      .reduce((sum, block) => sum + block.minutes, 0),
  };
});
