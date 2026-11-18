"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { grantAchievements } from "@/server/achievements/queries";
import { getProfile } from "@/server/profile/queries";
import { dateKeyAt } from "@/features/planner/dates";
import {
  elapsedSeconds,
  isLeftRunning,
  pickPlannedSession,
  settleDuration,
} from "@/features/study/timer";

/**
 * Start a session, finish it, record how long (FR-N4, US-I3, Sprint 63).
 *
 * **No migration.** `study_sessions.ended_at` has been nullable since the
 * Sprint 13 schema, which was designed for exactly this: a row is written
 * when the session STARTS, with no end, and the finish fills the end in. Every
 * reader of the table already ignores rows without a duration or an end — and
 * the one that did not (the progress page's lifetime read) is fixed in this
 * sprint — so a session on the clock counts toward nothing until it is done.
 *
 * **`review` is the activity.** Sprint 57 reserved it for "revision with
 * nothing measured", and nothing has ever written it. A timed session is that
 * exactly: time on a subject, no score. The history labels it "Study session".
 */

const ACTIVITY = "review" as const;

export type TimerResult =
  | {
      status: "ok";
      /** What was recorded. */
      seconds: number;
      /** The clock ran past the cap and the recorded time was cut to it. */
      capped: boolean;
      /** The planned session this one ticked off in the planner, by title. */
      completedPlan: string | null;
    }
  | { status: "started" }
  /** Under a minute — removed, not recorded. */
  | { status: "discarded" }
  | { status: "error"; message: string; nextStep: string };

const startSchema = z.object({
  subjectId: z.string().uuid(),
  topicId: z.string().uuid().nullable(),
});

export async function startTimedSessionAction(input: {
  subjectId: string;
  topicId: string | null;
}): Promise<TimerResult> {
  const session = await requireSession();
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Choose a subject to study.",
      nextStep: "A session is filed under a subject so the time counts somewhere.",
    };
  }

  const { subjectId, topicId } = parsed.data;
  const supabase = await createSupabaseServerClient();

  /* One at a time. Two clocks running is two places the same hour gets
     counted, and the student could not tell from the top bar which one they
     were looking at. Refused rather than silently finishing the old one:
     finishing records time, and that is the student's call. */
  const { data: running } = await supabase
    .from("study_sessions")
    .select("id")
    .is("ended_at", null)
    .eq("activity", ACTIVITY)
    .limit(1)
    .maybeSingle();

  if (running) {
    return {
      status: "error",
      message: "You already have a session running.",
      nextStep: "Finish it from the top bar, then start this one.",
    };
  }

  /* Through RLS, so a subject id that is not the caller's simply is not
     found. Archived subjects are refused for the reason the Start dialog
     hides them. */
  const { data: subject } = await supabase
    .from("subjects")
    .select("id, archived_at")
    .eq("id", subjectId)
    .maybeSingle();

  if (!subject || subject.archived_at) {
    return {
      status: "error",
      message: "That subject is not in your library any more.",
      nextStep: "Pick another one.",
    };
  }

  if (topicId) {
    const { data: topic } = await supabase
      .from("topics")
      .select("subject_id")
      .eq("id", topicId)
      .maybeSingle();

    /* The same rule the planner applies: a topic from another subject would
       file the time in two places and count it in neither. */
    if (!topic || topic.subject_id !== subjectId) {
      return {
        status: "error",
        message: "That topic is not part of this subject.",
        nextStep: "Choose one of its topics, or study the whole subject.",
      };
    }
  }

  const { error } = await supabase.from("study_sessions").insert({
    user_id: session.userId,
    subject_id: subjectId,
    topic_id: topicId,
    activity: ACTIVITY,
    /* Stamped here, not taken from the browser: the server's clock is the
       one that will also stamp the finish. */
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_seconds: null,
  });

  if (error) {
    return {
      status: "error",
      message: "We could not start the session.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "started" };
}

/**
 * Finish, and record.
 *
 * `claimedMinutes` is the student's own figure — "I stepped away for twenty
 * minutes" — or null to take the clock. Either way the result is never more
 * than the clock and never more than the cap; see `settleDuration`.
 *
 * **The end time is honest about what is known.** A session finished within
 * the cap ended now. One that ran past it ended at some point nobody saw, so
 * `ended_at` is placed where the counted time runs out rather than at "now" —
 * otherwise a session started on Tuesday and finished on Thursday would put
 * four hours of Biology on Thursday's bar of the activity chart.
 */
export async function finishTimedSessionAction(
  sessionId: string,
  claimedMinutes: number | null,
): Promise<TimerResult> {
  await requireSession();
  if (!z.string().uuid().safeParse(sessionId).success) return gone();

  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("study_sessions")
    .select("id, started_at, subject_id, topic_id")
    .eq("id", sessionId)
    .is("ended_at", null)
    .maybeSingle();

  /* Already finished — in another tab, or on the phone. Not an error worth
     alarming anyone over; the top bar will catch up on refresh. */
  if (!row || !row.subject_id) return gone();

  const now = Date.now();
  const startedAt = Date.parse(row.started_at);
  const elapsed = elapsedSeconds(startedAt, now);
  const settled = settleDuration(elapsed, claimedMinutes);

  if (settled.status === "too-short") {
    await supabase.from("study_sessions").delete().eq("id", row.id).is("ended_at", null);
    revalidatePath("/", "layout");
    return { status: "discarded" };
  }

  const endedAt = new Date(isLeftRunning(elapsed) ? startedAt + settled.seconds * 1000 : now);

  const { data: updated, error } = await supabase
    .from("study_sessions")
    .update({ ended_at: endedAt.toISOString(), duration_seconds: settled.seconds })
    .eq("id", row.id)
    /* Only if still open: a second tab pressing Finish at the same moment
       must not overwrite the first one's figure with its own. */
    .is("ended_at", null)
    .select("id");

  if (error) {
    return {
      status: "error",
      message: "We could not record that session.",
      nextStep: "It is still running — try finishing it again.",
    };
  }
  if (!updated?.length) return gone();

  const completedPlan = await tickOffPlan(supabase, {
    subjectId: row.subject_id,
    topicId: row.topic_id,
    startedAt,
    endedAt,
  });

  /* Sprint 72: hours and streaks are earned by timed sessions too. */
  await grantAchievements();

  revalidatePath("/", "layout");
  return { status: "ok", seconds: settled.seconds, capped: settled.capped, completedPlan };
}

/**
 * Throw a running session away — started by mistake, or on the wrong subject.
 * Only an OPEN session: a finished one is history, and history is not undone
 * from the top bar.
 */
export async function discardTimedSessionAction(sessionId: string): Promise<TimerResult> {
  await requireSession();
  if (!z.string().uuid().safeParse(sessionId).success) return gone();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("study_sessions")
    .delete()
    .eq("id", sessionId)
    .is("ended_at", null)
    .eq("activity", ACTIVITY);

  if (error) {
    return {
      status: "error",
      message: "We could not discard that session.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "discarded" };
}

function gone(): TimerResult {
  return {
    status: "error",
    message: "That session has already been finished.",
    nextStep: "It may have been ended on another device.",
  };
}

/**
 * Tick off the planned study session this one fulfils, if any.
 *
 * "Day" is the STUDENT's day the session started on — a session at 11pm in
 * Manila belongs to that evening's plan, not UTC's next morning (the Sprint 60
 * bug). Best-effort: the time is already recorded, and failing to tick a box
 * the student can tick themselves is not worth failing the finish over.
 */
async function tickOffPlan(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  session: { subjectId: string; topicId: string | null; startedAt: number; endedAt: Date },
): Promise<string | null> {
  const timezone = (await getProfile())?.timezone;
  const day = dateKeyAt(session.startedAt, timezone);

  const { data } = await supabase
    .from("planner_events")
    .select("id, title, subject_id, topic_id, due_on")
    .eq("kind", "study_session")
    .is("completed_at", null)
    .lte("due_on", day)
    .or(`subject_id.eq.${session.subjectId},subject_id.is.null`)
    .order("due_on", { ascending: false })
    .limit(20);

  const plan = pickPlannedSession(
    (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      subjectId: row.subject_id,
      topicId: row.topic_id,
      dueOn: row.due_on,
    })),
    { subjectId: session.subjectId, topicId: session.topicId, day },
  );
  if (!plan) return null;

  const { error } = await supabase
    .from("planner_events")
    .update({ completed_at: session.endedAt.toISOString() })
    .eq("id", plan.id)
    .is("completed_at", null);

  return error ? null : plan.title;
}
