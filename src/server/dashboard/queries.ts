import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { LOW_EVIDENCE_QUESTIONS } from "@/types";
import { addDays, dateKeyAt, weekdayLabel } from "@/features/planner/dates";
import {
  groupDeadlines,
  listDeadlines,
  nextAssessed,
  type Deadline,
} from "@/server/planner/deadlines";
import { getStudentToday } from "@/server/planner/queries";
import { type UrgencyBand } from "@/features/planner/urgency";
import { getProfile } from "@/server/profile/queries";
import { getSubjectMastery, getTopicMastery } from "@/server/mastery/queries";
import { readRationale, type PlanRationale } from "@/server/plan/today";
import { getStudyDays } from "@/server/study/queries";
import { streakOf, weekOf, type Streak } from "@/features/study/streak";

/**
 * Everything the dashboard reads, from the real database (FR-D1, FR-D3).
 *
 * This replaced `features/dashboard/sample-data.ts`, which rendered a full,
 * convincing dashboard for an account that had nothing in it. That file made
 * the design reviewable before the tables existed; kept any longer it would
 * have become a lie the product told about itself every time it loaded.
 *
 * **One loader per panel (Sprint 70).** This was one `getDashboardData` that
 * awaited every read before returning anything — so the slowest query set the
 * speed of the whole page, and any one failure blanked all of it. US-J3 asks
 * for the opposite: "each panel loads and fails independently". Each loader
 * below reads only what its panel shows, and the page wraps each panel in its
 * own Suspense and error boundary. Shared inputs (mastery, deadlines, the
 * student's today) are request-cached, so splitting costs no extra queries.
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
  /** Whole days from the STUDENT's today. Negative is overdue. */
  inDays: number;
  /** Sprint 62: how hard this is pressing, and why. See `urgency.ts`. */
  band: UrgencyBand;
  reason: string | null;
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

/* -------------------------------------------------------------------------- */
/*  The library: what the student has, and the first-run gate                 */
/* -------------------------------------------------------------------------- */

export type Library = {
  subjects: DashboardSubject[];
  subjectCount: number;
  materialCount: number;
};

/**
 * Subjects and how much is in them.
 *
 * Read FIRST and alone, because it decides which dashboard renders: an account
 * with no subject or no file gets the first-run view (FR-D3), and every other
 * panel would only be a box saying "nothing yet".
 */
export const getLibrary = cache(async (): Promise<Library> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const [{ data }, subjectMastery] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, name, color_slot, materials(count), topics(count)")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    getSubjectMastery(),
  ]);

  const rows = data ?? [];
  return {
    subjectCount: rows.length,
    materialCount: rows.reduce((sum, row) => sum + (row.materials?.[0]?.count ?? 0), 0),
    subjects: rows.map((row) => {
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
  };
});

/* -------------------------------------------------------------------------- */
/*  Mastery: the donut and the readiness figure                                */
/* -------------------------------------------------------------------------- */

export type MasteryOverview = {
  masteryBands: MasteryBand[];
  topicsTracked: number;
  /** Overall readiness, or null when there is not enough evidence for one. */
  readiness: number | null;
};

export const getMasteryOverview = cache(async (): Promise<MasteryOverview> => {
  /* Mastery from the Sprint 56 formula over the answers themselves, not the
     old running tally — the same loader the Progress page and the subject
     hub read, so all three show the same number. */
  const topicMastery = await getTopicMastery();

  /* Worst first, which is the order every consumer below wants. */
  const progress = [...topicMastery.values()].sort((a, b) => a.mastery - b.mastery);

  /* Mastery bands. Topics with too few answers sit in "Not started" rather than
     being binned by a percentage that MasteryBar would refuse to print — the
     donut must not claim confidence the bar withholds (US-H1). */
  const bands = { notStarted: 0, weak: 0, developing: 0, solid: 0, strong: 0 };
  for (const row of progress) {
    if (row.questions < LOW_EVIDENCE_QUESTIONS) {
      bands.notStarted += 1;
      continue;
    }
    if (row.mastery < 0.4) bands.weak += 1;
    else if (row.mastery < 0.6) bands.developing += 1;
    else if (row.mastery < 0.8) bands.solid += 1;
    else bands.strong += 1;
  }

  /* Readiness is the mean mastery across topics that have enough evidence. With
     none, it is null — not zero. Zero would read as "you know nothing", when
     the truth is "nothing has been measured yet". */
  const evidenced = progress.filter((row) => row.questions >= LOW_EVIDENCE_QUESTIONS);

  return {
    masteryBands: [
      { label: "Not started", value: bands.notStarted, step: "none" },
      { label: "Weak", value: bands.weak, step: 1 },
      { label: "Developing", value: bands.developing, step: 2 },
      { label: "Solid", value: bands.solid, step: 3 },
      { label: "Strong", value: bands.strong, step: 4 },
    ],
    topicsTracked: progress.length,
    readiness:
      evidenced.length > 0
        ? evidenced.reduce((sum, row) => sum + row.mastery, 0) / evidenced.length
        : null,
  };
});

/* -------------------------------------------------------------------------- */
/*  Activity: the score trend and the week's minutes                           */
/* -------------------------------------------------------------------------- */

export type StudyActivity = {
  /** Quiz score per attempt, oldest first. One series, one unit, one axis. */
  scoreTrend: ScorePoint[];
  /** Minutes studied per day for the last seven days, oldest first. */
  studyByDay: { label: string; minutes: number }[];
  minutesThisWeek: number;
  /** Every finished practice set and quiz, once each. */
  quizzesTaken: number;
  /** Sprint 73: the streak and this week's study days, by the shared rule. */
  streak: Streak;
  daysThisWeek: number;
};

export const getStudyActivity = cache(async (): Promise<StudyActivity> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();
  /* The student's today, from their profile timezone. It was UTC's, which
     put the week's bars a day out for part of every day. */
  const [today, profile] = await Promise.all([getStudentToday(), getProfile()]);
  const timezone = profile?.timezone;

  /* A day earlier than the seven days shown, because sessions are bucketed by
     the student's LOCAL date and the query compares instants — a session at
     1am local can sit on the far side of UTC midnight. */
  const weekAgo = addDays(today, -7);

  const [{ data: sessionRows }, { data: scoredRows }, studyDays] = await Promise.all([
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
    getStudyDays(),
  ]);

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
  const scored = scoredRows ?? [];
  const scoreTrend: ScorePoint[] = scored.slice(-30).map((row) => ({
    label: new Date(row.started_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    value: (row.items_correct ?? 0) / (row.items_total as number),
  }));

  /* Seven days, every one of them present. Skipping days with no sessions would
     draw a bar chart whose gaps silently disappear, making a patchy week look
     like a consistent one. */
  const sessions = sessionRows ?? [];
  const studyByDay = Array.from({ length: 7 }, (_, offset) => {
    const key = addDays(today, offset - 6);
    const minutes = sessions
      .filter((row) => dateKeyAt(Date.parse(row.started_at), timezone) === key)
      .reduce((sum, row) => sum + Math.round((row.duration_seconds ?? 0) / 60), 0);
    return { label: weekdayLabel(key, "narrow"), minutes };
  });

  return {
    scoreTrend,
    studyByDay,
    minutesThisWeek: studyByDay.reduce((sum, day) => sum + day.minutes, 0),
    quizzesTaken: scored.length,
    streak: streakOf(studyDays, today),
    daysThisWeek: weekOf(studyDays, today).filter((day) => day.studied).length,
  };
});

/* -------------------------------------------------------------------------- */
/*  What is coming: the next exam and the upcoming list                        */
/* -------------------------------------------------------------------------- */

export type ComingUp = {
  upcoming: UpcomingItem[];
  /** The soonest exam, quiz or other assessed deadline — the headline tile. */
  nextExam: Deadline | null;
};

/**
 * The SAME deadline read the planner uses (Sprint 62).
 *
 * It was a query of its own, and it was wrong in two ways that only showed up
 * once there was a planner to compare it against. It computed "in N days" from
 * `new Date()` — the SERVER's local midnight, not the student's — and
 * `gte(due_on, today)` dropped overdue work silently, so the one panel a
 * student glances at each morning hid the thing they had already missed.
 */
export const getComingUp = cache(async (): Promise<ComingUp> => {
  const deadlines = await listDeadlines();

  return {
    nextExam: nextAssessed(deadlines),
    /* Overdue first, then soonest — `groupDeadlines` already orders within
       each bucket, and flattening the groups keeps that order. Five, because
       this is a glance rather than the list; the planner has all of them. */
    upcoming: groupDeadlines(deadlines)
      .flatMap((group) => group.deadlines)
      .slice(0, 5)
      .map((deadline) => ({
        id: deadline.id,
        title: deadline.title,
        subject: deadline.subjectName,
        colorSlot: deadline.colorSlot ?? 1,
        kind: deadline.kind,
        dueOn: deadline.dueOn,
        inDays: deadline.daysAway,
        band: deadline.urgency.band,
        reason: deadline.reason,
      })),
  };
});

/* -------------------------------------------------------------------------- */
/*  Today's plan                                                               */
/* -------------------------------------------------------------------------- */

export type PlanToday = {
  planToday: PlanBlock[];
  planMinutesRemaining: number;
  /**
   * Whether today's plan has been built, and what it was built from (Sprint
   * 65). `built` with no blocks is a real state — a plan that found nothing
   * to do and said why — and must not render as "no plan yet".
   */
  plan: { built: boolean; rationale: PlanRationale | null };
};

export const getPlanToday = cache(async (): Promise<PlanToday> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();
  const today = await getStudentToday();

  const { data } = await supabase
    .from("study_plans")
    .select(
      "id, plan_date, rationale, study_plan_items(id, activity, minutes, reason, completed_at, position, topics(name), subjects(name, color_slot))",
    )
    .eq("plan_date", today)
    .maybeSingle();

  const planToday: PlanBlock[] = [...(data?.study_plan_items ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      id: item.id,
      subject: item.subjects?.name ?? null,
      topic: item.topics?.name ?? null,
      colorSlot: (item.subjects?.color_slot ?? 1) as 1 | 2 | 3 | 4 | 5,
      activity: item.activity,
      minutes: item.minutes,
      reason: item.reason,
      done: item.completed_at !== null,
    }));

  return {
    planToday,
    planMinutesRemaining: planToday
      .filter((block) => !block.done)
      .reduce((sum, block) => sum + block.minutes, 0),
    plan: { built: data !== null && data !== undefined, rationale: readRationale(data?.rationale) },
  };
});
