import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";

/**
 * What a student has actually done, and what it shows (FR-P1, US-H1).
 *
 * **Every number here is counted, not modelled.** Sessions finished, questions
 * answered, cards recalled. The weighted mastery formula — recency, difficulty,
 * decay — is Sprint 56's job, and inventing half of it now would put the
 * "mastery misleads students" risk on screen ahead of schedule.
 *
 * **Recall and accuracy are reported separately and never averaged.** A student
 * pressing "I had it" on a flashcard is not the same evidence as answering a
 * question, and one percentage covering both would be a number with no meaning.
 */

/** How long back the activity chart looks. Two weeks fits a revision run. */
const ACTIVITY_DAYS = 14;

/** Below this, a percentage is withheld rather than shown (US-H1). */
export const LOW_EVIDENCE_QUESTIONS = 10;

export type ActivityDay = { date: string; label: string; minutes: number; sessions: number };

export type SubjectProgress = {
  id: string;
  name: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
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

  const [{ data: sessionRows }, { data: progressRows }, { data: cardRows }] = await Promise.all([
    /* Every session, not just the recent ones: the totals at the top are
       lifetime figures, and the chart filters to its own window below. RLS
       scopes this to the caller. */
    supabase
      .from("study_sessions")
      .select(
        "id, activity, started_at, duration_seconds, items_total, items_correct, topic_id, subject_id, topics(name), subjects(id, name, color_slot)",
      )
      .order("started_at", { ascending: false })
      .limit(500),
    supabase
      .from("progress")
      .select(
        "id, mastery, questions_answered, last_practised_at, topics(name), subjects(name, color_slot)",
      )
      .order("mastery", { ascending: true }),
    /* Card recall lives on the cards themselves — Sprint 44 has been counting
       it correctly all along, and nothing has ever displayed it. */
    supabase.from("flashcards").select("times_seen, times_known, subject_id").gt("times_seen", 0),
  ]);

  const sessions = sessionRows ?? [];

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

  for (const row of sessions) {
    const minutes = Math.round((row.duration_seconds ?? 0) / 60);
    totalMinutes += minutes;
    answered += row.items_total ?? 0;
    correct += row.items_correct ?? 0;

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

  return {
    totalSessions: sessions.length,
    totalMinutes,
    answered,
    correct,
    cardsSeen,
    cardsKnown,
    streak: streakFrom(sessions.map((row) => toDayKey(new Date(row.started_at)))),
    activity: [...buckets.values()],
    subjects: [...subjects.values()].sort((a, b) => b.minutes - a.minutes),
    topics: (progressRows ?? []).map((row) => ({
      id: row.id,
      topic: row.topics?.name ?? "Untitled topic",
      subject: row.subjects?.name ?? "",
      colorSlot: slot(row.subjects?.color_slot),
      mastery: Number(row.mastery),
      answered: row.questions_answered,
      lastPractisedAt: row.last_practised_at,
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
