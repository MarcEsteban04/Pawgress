import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";

/**
 * Timed study sessions, read (FR-N4, US-I3, Sprint 63).
 *
 * Both loaders run in the app LAYOUT, because the running session is shown in
 * the top bar on every page. That is why each is one query and not one per
 * subject: the layout re-renders after every Server Action in the product.
 */

export type RunningSession = {
  id: string;
  /** ISO timestamp, stamped by the server when it started. */
  startedAt: string;
  subjectId: string;
  subjectName: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  topicId: string | null;
  topicName: string | null;
  /**
   * When the server read this, as epoch ms. The pill's first frame is drawn
   * from it on the server AND in the browser, so the two agree and hydration
   * does not complain; after that the browser ticks from its own clock,
   * corrected by however far it disagrees with this.
   */
  readAt: number;
};

/** A subject a session can be started against, with its topics in order. */
export type SessionTarget = {
  id: string;
  name: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  topics: { id: string; name: string }[];
};

const slot = (value: number | null | undefined) => (value ?? 1) as 1 | 2 | 3 | 4 | 5;

/**
 * The session on the clock, if there is one.
 *
 * Open rows are only ever written by `startTimedSessionAction` — every other
 * writer (flashcards, practice, quizzes) inserts a finished session with
 * `ended_at` set. The activity filter is belt and braces.
 *
 * Newest first, one row. Two tabs pressing Start in the same instant could
 * leave two open rows; the older is then invisible and, being unfinished,
 * counts toward nothing. A partial unique index on `(user_id) where ended_at
 * is null` would rule it out, and is a one-line migration once
 * `SUPABASE_ACCESS_TOKEN` is renewed.
 */
export const getRunningSession = cache(async (): Promise<RunningSession | null> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("study_sessions")
    .select("id, started_at, subject_id, topic_id, subjects(name, color_slot), topics(name)")
    .is("ended_at", null)
    .eq("activity", "review")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  /* A session whose subject was deleted cascades away with it, so a row with
     no subject is one being deleted under us. Treat it as not running. */
  if (!data || !data.subject_id || !data.subjects) return null;

  return {
    id: data.id,
    startedAt: data.started_at,
    subjectId: data.subject_id,
    subjectName: data.subjects.name,
    colorSlot: slot(data.subjects.color_slot),
    topicId: data.topic_id,
    topicName: data.topics?.name ?? null,
    readAt: Date.now(),
  };
});

/**
 * Every active subject and its topics, for the Start dialog.
 *
 * Archived subjects are left out: a semester that is over is not one anyone
 * is starting a session for, and listing it is how a student files an hour
 * under last year's Biology by accident.
 */
export const listSessionTargets = cache(async (): Promise<SessionTarget[]> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("subjects")
    .select("id, name, color_slot, topics(id, name, position)")
    .is("archived_at", null)
    .order("last_activity_at", { ascending: false });

  return (data ?? []).map((subject) => ({
    id: subject.id,
    name: subject.name,
    colorSlot: slot(subject.color_slot),
    topics: [...(subject.topics ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((topic) => ({ id: topic.id, name: topic.name })),
  }));
});
