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
