"use server";

import { revalidatePath } from "next/cache";
import { cleanText } from "@/lib/sanitize";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseForm } from "@/lib/validation/form";
import { topicSchema } from "@/lib/validation/topic";
import { requireSession } from "@/server/auth/session";
import {
  findTopicNamed,
  getTopicDeletionSummary,
  nextTopicPosition,
  type TopicDeletionSummary,
} from "@/server/topics/queries";
import { type TopicFormState } from "../types";

/**
 * Topic mutations (Sprint 21 — FR-S3, US-B4).
 *
 * `user_id` is written explicitly on insert because the policy's WITH CHECK
 * requires it to equal `auth.uid()`; it is never accepted from the form. The
 * same is true of `subject_id` — it comes from the route, and the composite
 * foreign key `(subject_id, user_id) → subjects (id, user_id)` means a forged
 * one belonging to somebody else fails at the database rather than quietly
 * filing a topic into a stranger's subject.
 */

const FIELDS = ["name"] as const;

/** Postgres unique_violation — the case-sensitive twin of our own check. */
const UNIQUE_VIOLATION = "23505";

function duplicateError(name: string): TopicFormState {
  return {
    status: "error",
    message: `This subject already has a topic called “${name}”.`,
    nextStep: "Pick a different name, or edit the existing one.",
    fieldErrors: { name: "That name is already used in this subject." },
  };
}

export async function createTopicAction(
  prevState: TopicFormState,
  formData: FormData,
): Promise<TopicFormState> {
  const session = await requireSession();
  const subjectId = String(formData.get("subjectId") ?? "");

  if (!subjectId) {
    return {
      status: "error",
      message: "We could not tell which subject this belongs to.",
      nextStep: "Reload the page and try again.",
    };
  }

  const parsed = parseForm(topicSchema, formData, FIELDS);
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message,
      nextStep: parsed.nextStep,
      fieldErrors: parsed.fieldErrors,
    };
  }

  const name = cleanText(parsed.data.name);

  /* Checked BEFORE the insert, unlike subjects. The opposite order there was
     deliberate — US-B1 wants duplicate subject names allowed with a warning.
     Here the database rejects duplicates outright, so checking first is what
     turns a raw constraint violation into a sentence naming the field. */
  if (await findTopicNamed(subjectId, name)) return duplicateError(name);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("topics").insert({
    user_id: session.userId,
    subject_id: subjectId,
    name,
    position: await nextTopicPosition(subjectId),
  });

  if (error) {
    /* The check above races: two tabs submitting the same name at once both
       pass it. The constraint is the thing that actually holds, so its error is
       translated rather than shown as "something went wrong". */
    if (error.code === UNIQUE_VIOLATION) return duplicateError(name);
    return {
      status: "error",
      message: "We could not create that topic.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath(`/subjects/${subjectId}`);
  return { status: "saved", saves: (prevState.saves ?? 0) + 1 };
}

export async function renameTopicAction(
  _prevState: TopicFormState,
  formData: FormData,
): Promise<TopicFormState> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");

  if (!id || !subjectId) {
    return {
      status: "error",
      message: "We could not tell which topic to rename.",
      nextStep: "Close this and try again.",
    };
  }

  const parsed = parseForm(topicSchema, formData, FIELDS);
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message,
      nextStep: parsed.nextStep,
      fieldErrors: parsed.fieldErrors,
    };
  }

  const name = cleanText(parsed.data.name);
  if (await findTopicNamed(subjectId, name, id)) return duplicateError(name);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("topics").update({ name }).eq("id", id);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return duplicateError(name);
    return {
      status: "error",
      message: "We could not save that name.",
      nextStep: "Try again in a moment.",
    };
  }

  // A topic name appears on materials and quizzes too, not only this page.
  revalidatePath("/", "layout");
  return { status: "saved" };
}

/**
 * Delete a topic, keeping its materials (US-B4, FR-S4).
 *
 * There is deliberately no type-to-confirm here, unlike deleting a subject.
 * The friction should match the loss: a subject takes a term of work with it,
 * a topic takes only itself — its materials detach to the subject and its
 * reviewers and quizzes keep working. Making both feel equally dangerous
 * teaches students to click through the one that matters.
 *
 * The detaching is the foreign key's doing (`on delete set null (topic_id)`),
 * not this function's. Doing it here in a second statement would leave a window
 * where the topic is gone and its materials still point at it.
 */
export async function deleteTopicAction(
  _prevState: TopicFormState,
  formData: FormData,
): Promise<TopicFormState> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return {
      status: "error",
      message: "We could not tell which topic to delete.",
      nextStep: "Close this and try again.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("topics").delete().eq("id", id);

  if (error) {
    return {
      status: "error",
      message: "We could not delete that topic.",
      nextStep: "Try again in a moment. Nothing has been removed.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "saved" };
}

/**
 * Counts for the delete confirmation, fetched when the dialog opens.
 *
 * Same reasoning as the subject dialog: a Server Component cannot be invoked
 * from a click, and computing this for every row up front would be three count
 * queries per topic on every page load, nearly all discarded.
 */
export async function loadTopicDeletionSummaryAction(
  topicId: string,
): Promise<TopicDeletionSummary | null> {
  await requireSession();
  try {
    return await getTopicDeletionSummary(topicId);
  } catch {
    return null;
  }
}
