import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { type Mastery } from "@/features/mastery/formula";
import { summariseAttempts, type AttemptSummary } from "@/features/quizzes/analytics";
import { getOverallMastery, getSubjectMastery, getTopicMastery } from "@/server/mastery/queries";
import { listAllQuizAttempts } from "@/server/quizzes/queries";
import { LOW_EVIDENCE_QUESTIONS as EVIDENCE } from "@/types";

/**
 * Everything the Progress page shows (FR-P1–P3, US-H1, Sprints 57–58).
 *
 * **Two kinds of number, kept apart.** Activity is COUNTED — sessions, minutes,
 * days in a row, cards recalled. Mastery is MODELLED, by the Sprint 56 formula
 * over the answers themselves, and read from the same cached loader the
 * dashboard and the subject hub use, so no two screens can disagree about it.
 *
 * **Recall and accuracy are reported separately and never averaged.** A student
 * pressing "I had it" on a flashcard is not the same evidence as answering a
 * question, and one percentage covering both would be a number with no meaning.
 */

/** How long back the activity chart looks. Two weeks fits a revision run. */
const ACTIVITY_DAYS = 14;

/* Re-exported so the Progress page can keep importing it from here. It is
   the same constant the formula uses — this file used to define a copy of its
   own, which is how two "tens" drift into a ten and a twelve. */
export { LOW_EVIDENCE_QUESTIONS } from "@/types";

export type ActivityDay = { date: string; label: string; minutes: number; sessions: number };

export type SubjectProgress = {
  id: string;
  name: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  /**
   * The subject's own mastery, from every answer in it (Sprint 56). Null when
   * nothing has been answered; the page withholds the figure below the
   * evidence threshold rather than showing a confident number.
   */
  mastery: Mastery | null;
  /** Topics in this subject, and how many have enough answers to be scored. */
  topicCount: number;
  measuredTopics: number;
  /** Practice questions answered, and how many were right. */
  answered: number;
  correct: number;
  /** Flashcards seen, and how many were recalled. */
  cardsSeen: number;
  cardsKnown: number;
  sessions: number;
  minutes: number;
  lastStudiedAt: string | null;
};

export type TopicMastery = {
  id: string;
  topic: string;
  subject: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  mastery: number;
  answered: number;
  lastPractisedAt: string | null;
  /** Change over the last two weeks, when both ends had enough evidence. */
  improvement: number | null;
  band: "weak" | "developing" | "strong" | "unmeasured";
};

export type RecentSession = {
  id: string;
  activity: string;
  subject: string;
  topic: string | null;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  total: number | null;
  correct: number | null;
  minutes: number;
  startedAt: string;
};

export type ProgressOverview = {
  /** Mastery across everything answered, plus how much of the syllabus it covers. */
  overall: {
    mastery: Mastery | null;
    measuredTopics: number;
    topicCount: number;
  };
  /**
   * The last seven days against the seven before them, in minutes.
   *
   * Rolling windows rather than calendar weeks. "This week" on a Monday
   * morning is almost empty and would read as a collapse; the last seven days
   * are always a full week, whichever day it is.
   */
  week: { recent: number; before: number };
  /** Quizzes and mock exams only — never practice. See `listAllQuizAttempts`. */
  quizzes: AttemptSummary & { trend: { label: string; value: number }[]; distinct: number };
  totalSessions: number;
  totalMinutes: number;
  answered: number;
  correct: number;
  cardsSeen: number;
  cardsKnown: number;
  /** Consecutive days ending today (or yesterday) with at least one session. */
  streak: number;
  activity: ActivityDay[];
  subjects: SubjectProgress[];
  topics: TopicMastery[];
  recent: RecentSession[];
};

const slot = (value: number | null | undefined) => (value ?? 1) as 1 | 2 | 3 | 4 | 5;

export const getProgressOverview = cache(async (): Promise<ProgressOverview> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const [
    sessions,
    topicMastery,
    { data: cardRows },
    overallMastery,
    subjectMastery,
    { data: topicRows },
    quizAttempts,
  ] = await Promise.all([
    /* Every session, read in pages. The totals at the top are LIFETIME
       figures, and this used to be one read capped at 500 rows — so past 500
       sessions "Studied" silently stopped counting, which is exactly the
       student who studies most. */
    readAllSessions(supabase),
    /* The Sprint 56 formula, from the same loader the dashboard and the
       subject hub read — so this page cannot disagree with them. */
    getTopicMastery(),
    /* Card recall lives on the cards themselves — Sprint 44 has been counting
       it correctly all along, and nothing has ever displayed it. */
    supabase.from("flashcards").select("times_seen, times_known, subject_id").gt("times_seen", 0),
    getOverallMastery(),
    getSubjectMastery(),
    supabase.from("topics").select("id, subject_id"),
    listAllQuizAttempts(),
  ]);

  const topicsBySubject = new Map<string, string[]>();
  for (const row of topicRows ?? []) {
    const list = topicsBySubject.get(row.subject_id);
    if (list) list.push(row.id);
    else topicsBySubject.set(row.subject_id, [row.id]);
  }
  const isMeasured = (topicId: string) => (topicMastery.get(topicId)?.questions ?? 0) >= EVIDENCE;

  /* One bucket per day, pre-seeded, so a day with no studying is a gap in the
     chart rather than a missing bar that silently shortens the window. */
  const buckets = new Map<string, ActivityDay>();
  for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000);
    const key = toDayKey(day);
    buckets.set(key, {
      date: key,
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
      minutes: 0,
      sessions: 0,
    });
  }

  const subjects = new Map<string, SubjectProgress>();
  let totalMinutes = 0;
  let answered = 0;
  let correct = 0;

  const now = Date.now();
  const week = { recent: 0, before: 0 };

  for (const row of sessions) {
    const minutes = Math.round((row.duration_seconds ?? 0) / 60);
    totalMinutes += minutes;
    answered += row.items_total ?? 0;
    correct += row.items_correct ?? 0;

    const age = now - Date.parse(row.started_at);
    if (age < 7 * 86_400_000) week.recent += minutes;
    else if (age < 14 * 86_400_000) week.before += minutes;

    const bucket = buckets.get(toDayKey(new Date(row.started_at)));
    if (bucket) {
      bucket.minutes += minutes;
      bucket.sessions += 1;
    }

    const subject = row.subjects;
    if (!subject) continue;

    const entry = subjects.get(subject.id) ?? {
      id: subject.id,
      name: subject.name,
      colorSlot: slot(subject.color_slot),
      mastery: subjectMastery.get(subject.id) ?? null,
      topicCount: topicsBySubject.get(subject.id)?.length ?? 0,
      measuredTopics: (topicsBySubject.get(subject.id) ?? []).filter(isMeasured).length,
      answered: 0,
      correct: 0,
      cardsSeen: 0,
      cardsKnown: 0,
      sessions: 0,
      minutes: 0,
      lastStudiedAt: null,
    };

    entry.sessions += 1;
    entry.minutes += minutes;
    /* Only PRACTICE counts toward accuracy. A flashcard run's tally is recall
       and is reported in its own column — averaging the two would produce a
       percentage that means neither. */
    if (row.activity === "practice" || row.activity === "quiz") {
      entry.answered += row.items_total ?? 0;
      entry.correct += row.items_correct ?? 0;
    }
    /* Rows arrive newest first, so the first one wins. */
    entry.lastStudiedAt ??= row.started_at;

    subjects.set(subject.id, entry);
  }

  let cardsSeen = 0;
  let cardsKnown = 0;
  for (const card of cardRows ?? []) {
    cardsSeen += card.times_seen;
    cardsKnown += card.times_known;
    const entry = subjects.get(card.subject_id);
    if (entry) {
      entry.cardsSeen += card.times_seen;
      entry.cardsKnown += card.times_known;
    }
  }

  const quizSummary = summariseAttempts(quizAttempts);

  return {
    overall: {
      mastery: overallMastery,
      measuredTopics: (topicRows ?? []).filter((row) => isMeasured(row.id)).length,
      topicCount: topicRows?.length ?? 0,
    },
    week,
    quizzes: {
      ...quizSummary,
      /* The last twenty, oldest first. More than that and a line chart of
         percentages turns into a hedge, with no single attempt legible. */
      trend: quizAttempts.slice(-20).map((attempt, index, list) => ({
        label: `#${quizAttempts.length - list.length + index + 1}`,
        value: attempt.total > 0 ? attempt.correct / attempt.total : 0,
      })),
      distinct: new Set(quizAttempts.map((attempt) => attempt.quizId)).size,
    },
    totalSessions: sessions.length,
    totalMinutes,
    answered,
    correct,
    cardsSeen,
    cardsKnown,
    streak: streakFrom(sessions.map((row) => toDayKey(new Date(row.started_at)))),
    activity: [...buckets.values()],
    subjects: [...subjects.values()].sort((a, b) => b.minutes - a.minutes),
    topics: [...topicMastery.values()]
      .sort((a, b) => a.mastery - b.mastery)
      .map((row) => ({
        id: row.topicId,
        topic: row.topicName,
        subject: row.subjectName,
        colorSlot: row.colorSlot,
        mastery: row.mastery,
        answered: row.questions,
        lastPractisedAt: row.lastAnsweredAt,
        improvement: row.improvement,
        band: row.band,
      })),
    recent: sessions.slice(0, 12).map((row) => ({
      id: row.id,
      activity: row.activity,
      subject: row.subjects?.name ?? "",
      topic: row.topics?.name ?? null,
      colorSlot: slot(row.subjects?.color_slot),
      total: row.items_total,
      correct: row.items_correct,
      minutes: Math.round((row.duration_seconds ?? 0) / 60),
      startedAt: row.started_at,
    })),
  };
});

/** PostgREST's default row cap, and so the page size. */
const PAGE = 1000;

/**
 * Every study session, newest first, a page at a time.
 *
 * Bounded at fifty thousand so a runaway loop cannot hang a page render — a
 * student logging a session every day for a century would not reach it.
 */
async function readAllSessions(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const rows = [];
  for (let page = 0; page < 50; page++) {
    const { data } = await supabase
      .from("study_sessions")
      .select(
        "id, activity, started_at, duration_seconds, items_total, items_correct, topic_id, subject_id, topics(name), subjects(id, name, color_slot)",
      )
      .order("started_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);

    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

/** Local calendar day, not UTC: a session at 11pm belongs to that evening. */
function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Consecutive days studied, counting back from today.
 *
 * **Yesterday still counts as alive.** A streak that breaks the moment midnight
 * passes punishes someone who has not studied *yet today*, which is most of the
 * day for most people — and a counter that resets while you are asleep is a
 * counter nobody trusts.
 */
function streakFrom(dayKeys: string[]): number {
  const days = new Set(dayKeys);
  if (days.size === 0) return 0;

  const today = toDayKey(new Date());
  const yesterday = toDayKey(new Date(Date.now() - 86_400_000));
  if (!days.has(today) && !days.has(yesterday)) return 0;

  let streak = 0;
  for (let i = days.has(today) ? 0 : 1; ; i++) {
    if (!days.has(toDayKey(new Date(Date.now() - i * 86_400_000)))) break;
    streak += 1;
  }
  return streak;
}
