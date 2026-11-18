"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { eventInputSchema, type EventInput } from "@/features/planner/schema";
import { type TablesInsert } from "@/types/database";

/** An event row, minus its owner — which only the insert may set. */
type EventRow = Omit<TablesInsert<"planner_events">, "user_id">;

/**
 * Writing planner events (FR-L1, US-J1, Sprint 60).
 *
 * **Validated here, not only in the form.** A Server Action is a public
 * endpoint; the form's checks are a courtesy and these are the rule. And the
 * table's own CHECK constraints would reject a bad title or date anyway — but
 * as a database error, which reaches a student as "something went wrong"
 * instead of "keep the name under 300 characters".
 */

export type PlannerResult =
  | { status: "ok"; eventId: string }
  | { status: "error"; message: string; nextStep: string; field?: keyof EventInput };

/**
 * Validate, and settle which subject an event belongs to.
 *
 * **A topic implies its subject.** Filing an event under "Genetics" and
 * leaving the subject blank means Biology; asking the student to say so twice
 * is a form doing its own bookkeeping out loud. And a topic from a DIFFERENT
 * subject than the one chosen is refused rather than silently kept: an exam
 * filed under Chemistry's topic and Biology's subject would appear in two
 * places and belong to neither.
 */
async function prepare(
  input: EventInput,
): Promise<{ ok: true; row: EventRow } | { ok: false; result: PlannerResult }> {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      result: {
        status: "error",
        message: issue?.message ?? "Something in that event is not right.",
        nextStep: "Fix it and save again.",
        field: issue?.path[0] as keyof EventInput | undefined,
      },
    };
  }

  const event = parsed.data;
  const supabase = await createSupabaseServerClient();
  let subjectId = event.subjectId;

  if (event.topicId) {
    const { data: topic } = await supabase
      .from("topics")
      .select("subject_id")
      .eq("id", event.topicId)
      .maybeSingle();

    if (!topic) {
      return {
        ok: false,
        result: {
          status: "error",
          message: "That topic is no longer in your library.",
          nextStep: "Pick another, or leave the topic blank.",
          field: "topicId",
        },
      };
    }
    if (subjectId && topic.subject_id !== subjectId) {
      return {
        ok: false,
        result: {
          status: "error",
          message: "That topic belongs to a different subject.",
          nextStep: "Choose the subject first, then one of its topics.",
          field: "topicId",
        },
      };
    }
    subjectId = topic.subject_id;
  }

  return {
    ok: true,
    row: {
      title: event.title,
      kind: event.kind,
      subject_id: subjectId,
      topic_id: event.topicId,
      due_on: event.dueOn,
      due_time: event.dueTime,
      /* An empty box is no notes, not an empty string that renders as a blank
         "Notes:" section. */
      notes: event.notes || null,
    },
  };
}

export async function createEventAction(input: EventInput): Promise<PlannerResult> {
  const session = await requireSession();
  const prepared = await prepare(input);
  if (!prepared.ok) return prepared.result;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("planner_events")
    .insert({ ...prepared.row, user_id: session.userId })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: "We could not save that event.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "ok", eventId: data.id };
}

export async function updateEventAction(
  eventId: string,
  input: EventInput,
): Promise<PlannerResult> {
  await requireSession();
  const prepared = await prepare(input);
  if (!prepared.ok) return prepared.result;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("planner_events").update(prepared.row).eq("id", eventId);

  if (error) {
    return {
      status: "error",
      message: "We could not save that change.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "ok", eventId };
}

/**
 * Mark done, or undo it.
 *
 * A timestamp rather than a boolean, because WHEN something was finished is
 * worth keeping: handing an assignment in four days early and four minutes
 * early are different habits, and the plan analytics in Sprint 69 will want
 * to know which.
 */
export async function setEventCompletedAction(
  eventId: string,
  completed: boolean,
): Promise<PlannerResult> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("planner_events")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", eventId);

  if (error) {
    return {
      status: "error",
      message: "We could not update that event.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "ok", eventId };
}

export async function deleteEventAction(eventId: string): Promise<PlannerResult> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("planner_events").delete().eq("id", eventId);
  if (error) {
    return {
      status: "error",
      message: "We could not delete that event.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "ok", eventId };
}

/**
 * Add suggested study sessions to the planner (FR-N5, Sprint 64).
 *
 * One press for a row, or "Add all" for the week. Each becomes an ordinary
 * `study_session` event — editable, deletable, startable from the planner
 * (Sprint 63) — with the reason it was suggested kept in its notes, so a
 * student looking at "Revise Genetics" on Thursday can still see why.
 *
 * **Validated as events, not trusted as suggestions.** The browser sends back
 * what it was shown, and a Server Action is a public endpoint: every pick goes
 * through the same schema as a hand-made event, and every topic is checked
 * against the subject it is filed under, in one query for the batch.
 */
export type SessionPick = {
  dueOn: string;
  subjectId: string;
  topicId: string | null;
  title: string;
  notes: string | null;
};

/** A week at three a day is 21; anything past this is not a person pressing a button. */
const MAX_PICKS = 30;

export async function addSuggestedSessionsAction(
  picks: SessionPick[],
): Promise<
  { status: "ok"; added: number } | { status: "error"; message: string; nextStep: string }
> {
  const session = await requireSession();

  if (!Array.isArray(picks) || picks.length === 0 || picks.length > MAX_PICKS) {
    return {
      status: "error",
      message: "There was nothing to add.",
      nextStep: "Refresh the planner and try again.",
    };
  }

  const rows: EventRow[] = [];
  for (const pick of picks) {
    const parsed = eventInputSchema.safeParse({
      title: pick.title,
      kind: "study_session",
      subjectId: pick.subjectId,
      topicId: pick.topicId,
      dueOn: pick.dueOn,
      dueTime: null,
      notes: pick.notes,
    });
    if (!parsed.success || !parsed.data.subjectId) {
      return {
        status: "error",
        message: "One of those sessions is not valid any more.",
        nextStep: "Refresh the planner — the suggestions will be worked out again.",
      };
    }
    rows.push({
      title: parsed.data.title,
      kind: "study_session",
      subject_id: parsed.data.subjectId,
      topic_id: parsed.data.topicId,
      due_on: parsed.data.dueOn,
      due_time: null,
      notes: parsed.data.notes || null,
    });
  }

  const supabase = await createSupabaseServerClient();
  const topicIds = [...new Set(rows.map((row) => row.topic_id).filter((id): id is string => !!id))];
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from("topics")
      .select("id, subject_id")
      .in("id", topicIds);
    const subjectOf = new Map((topics ?? []).map((topic) => [topic.id, topic.subject_id]));
    if (rows.some((row) => row.topic_id && subjectOf.get(row.topic_id) !== row.subject_id)) {
      return {
        status: "error",
        message: "A topic in those sessions has moved or been deleted.",
        nextStep: "Refresh the planner — the suggestions will be worked out again.",
      };
    }
  }

  const { error } = await supabase
    .from("planner_events")
    .insert(rows.map((row) => ({ ...row, user_id: session.userId })));

  if (error) {
    return {
      status: "error",
      message: "We could not add those sessions.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "ok", added: rows.length };
}
