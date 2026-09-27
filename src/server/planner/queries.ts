import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { getProfile } from "@/server/profile/queries";
import { todayIn, whenIs, type DateKey, type When } from "@/features/planner/dates";
import { type EventKind } from "@/features/planner/schema";

/**
 * Planner reads (FR-L1, US-J1, Sprint 60). RLS scopes every statement to the
 * caller; the filters below choose WHICH of the student's events to return.
 */

export type PlannerEvent = {
  id: string;
  title: string;
  kind: EventKind;
  subjectId: string | null;
  subjectName: string | null;
  colorSlot: 1 | 2 | 3 | 4 | 5 | null;
  topicId: string | null;
  topicName: string | null;
  dueOn: DateKey;
  /** `HH:MM`, or null for an all-day deadline. */
  dueTime: string | null;
  notes: string | null;
  completedAt: string | null;
  /** Where it sits relative to the STUDENT's today. See `whenIs`. */
  when: When;
};

const SELECT =
  "id, title, kind, subject_id, topic_id, due_on, due_time, notes, completed_at, subjects(name, color_slot), topics(name)";

/**
 * Today, where the student is.
 *
 * Cached per request so every event on a page is judged against one reading
 * of the clock — two components computing "today" either side of midnight
 * would disagree about whether the same deadline is tomorrow or today.
 */
export const getStudentToday = cache(async (): Promise<DateKey> => {
  const profile = await getProfile();
  return todayIn(profile?.timezone);
});

type Row = {
  id: string;
  title: string;
  kind: string;
  subject_id: string | null;
  topic_id: string | null;
  due_on: string;
  due_time: string | null;
  notes: string | null;
  completed_at: string | null;
  subjects: { name: string; color_slot: number } | null;
  topics: { name: string } | null;
};

function toEvent(row: Row, today: DateKey): PlannerEvent {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind as EventKind,
    subjectId: row.subject_id,
    subjectName: row.subjects?.name ?? null,
    colorSlot: row.subjects ? ((row.subjects.color_slot ?? 1) as 1 | 2 | 3 | 4 | 5) : null,
    topicId: row.topic_id,
    topicName: row.topics?.name ?? null,
    dueOn: row.due_on,
    /* Postgres returns `time` as HH:MM:SS. Seconds are noise on a deadline, and
       an input of type="time" expects HH:MM to round-trip. */
    dueTime: row.due_time ? row.due_time.slice(0, 5) : null,
    notes: row.notes,
    completedAt: row.completed_at,
    when: whenIs(row.due_on, today, row.completed_at !== null),
  };
}

/**
 * Events due in a range of days, inclusive — the calendar's read.
 *
 * Completed ones included: a calendar that deleted a finished exam from
 * Tuesday would misrepresent what Tuesday was.
 */
export const listEvents = cache(
  async (range: { from: DateKey; to: DateKey; subjectId?: string }): Promise<PlannerEvent[]> => {
    await requireSession();
    const supabase = await createSupabaseServerClient();
    const today = await getStudentToday();

    let query = supabase
      .from("planner_events")
      .select(SELECT)
      .gte("due_on", range.from)
      .lte("due_on", range.to)
      .order("due_on", { ascending: true })
      /* All-day deadlines first within a day, then by time. `nullsFirst`
         because "due Friday" is due at the start of Friday's thinking. */
      .order("due_time", { ascending: true, nullsFirst: true });

    if (range.subjectId) query = query.eq("subject_id", range.subjectId);

    const { data } = await query;
    return (data ?? []).map((row) => toEvent(row as Row, today));
  },
);

/**
 * What is still to do — the dashboard's and the deadline list's read.
 *
 * Overdue work is included by default, and that is the point: an assignment
 * that slipped past its date is the one a student most needs reminding of,
 * and a list of "upcoming" that silently drops it tells them it went away.
 */
export const listUpcoming = cache(
  async ({
    limit = 10,
    subjectId,
    includeOverdue = true,
  }: { limit?: number; subjectId?: string; includeOverdue?: boolean } = {}): Promise<
    PlannerEvent[]
  > => {
    await requireSession();
    const supabase = await createSupabaseServerClient();
    const today = await getStudentToday();

    let query = supabase
      .from("planner_events")
      .select(SELECT)
      .is("completed_at", null)
      .order("due_on", { ascending: true })
      .order("due_time", { ascending: true, nullsFirst: true })
      .limit(limit);

    if (!includeOverdue) query = query.gte("due_on", today);
    if (subjectId) query = query.eq("subject_id", subjectId);

    const { data } = await query;
    return (data ?? []).map((row) => toEvent(row as Row, today));
  },
);

export const getEvent = cache(async (id: string): Promise<PlannerEvent | null> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();
  const today = await getStudentToday();

  const { data } = await supabase.from("planner_events").select(SELECT).eq("id", id).maybeSingle();
  return data ? toEvent(data as Row, today) : null;
});
