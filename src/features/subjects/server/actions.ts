"use server";

import { revalidatePath } from "next/cache";
import { errorFormState } from "@/lib/errors";
import { cleanText } from "@/lib/sanitize";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/supabase/storage";
import { parseForm } from "@/lib/validation/form";
import { DELETE_SUBJECT_CONFIRMATION, subjectSchema } from "@/lib/validation/subject";
import { requireSession } from "@/server/auth/session";
import { findSubjectsNamed, getDeletionSummary } from "@/server/subjects/queries";
import { type SubjectFormState } from "../types";

/**
 * Subject mutations (Sprint 19 — FR-S1, FR-S4, US-B1, US-B3).
 *
 * `user_id` is written explicitly on insert because the policy's WITH CHECK
 * requires it to equal `auth.uid()`; it is never accepted from the form.
 */

const FIELDS = ["name", "colorSlot", "icon", "semester"] as const;

export async function createSubjectAction(
  _prevState: SubjectFormState,
  formData: FormData,
): Promise<SubjectFormState> {
  const session = await requireSession();

  const parsed = parseForm(subjectSchema, formData, FIELDS);
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message,
      nextStep: parsed.nextStep,
      fieldErrors: parsed.fieldErrors,
    };
  }

  const name = cleanText(parsed.data.name);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("subjects").insert({
    user_id: session.userId,
    name,
    color_slot: parsed.data.colorSlot,
    icon: parsed.data.icon,
    semester: parsed.data.semester,
  });

  if (error) {
    return {
      status: "error",
      message: "We could not create that subject.",
      nextStep: "Try again in a moment.",
    };
  }

  /* Checked AFTER the insert, on purpose. US-B1 allows duplicates and asks that
     the student be told — so this is a note attached to a success, not a
     gate in front of one. Checking first and blocking would be the behaviour
     the requirement explicitly rejects. */
  const existing = await findSubjectsNamed(name);
  const duplicateWarning =
    existing > 1 ? `You already had a subject called “${name}”. Both are kept.` : undefined;

  revalidatePath("/subjects");
  return { status: "saved", duplicateWarning };
}

export async function updateSubjectAction(
  _prevState: SubjectFormState,
  formData: FormData,
): Promise<SubjectFormState> {
  await requireSession();
  const id = String(formData.get("id") ?? "");

  if (!id) {
    return {
      status: "error",
      message: "We could not tell which subject to update.",
      nextStep: "Close this and try again.",
    };
  }

  const parsed = parseForm(subjectSchema, formData, FIELDS);
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message,
      nextStep: parsed.nextStep,
      fieldErrors: parsed.fieldErrors,
    };
  }

  const name = cleanText(parsed.data.name);
  const supabase = await createSupabaseServerClient();

  /* `.eq("id", …)` here selects WHICH of the student's rows to change — it is
     not the ownership check. RLS already restricted the statement to rows they
     own, so a wrong id simply matches nothing. */
  const { error } = await supabase
    .from("subjects")
    .update({
      name,
      color_slot: parsed.data.colorSlot,
      icon: parsed.data.icon,
      semester: parsed.data.semester,
    })
    .eq("id", id);

  if (error) {
    return {
      status: "error",
      message: "We could not save those changes.",
      nextStep: "Try again in a moment.",
    };
  }

  const existing = await findSubjectsNamed(name, id);
  const duplicateWarning =
    existing > 0 ? `You have another subject called “${name}”. Both are kept.` : undefined;

  // A rename must show up everywhere the subject appears (US-B1).
  revalidatePath("/", "layout");
  return { status: "saved", duplicateWarning };
}

/**
 * Delete a subject and everything under it (FR-S4, US-B3).
 *
 * Order matters, and it is the same lesson as account deletion: **storage
 * objects go first, through the Storage API.** The rows cascade from the
 * subject, but the bytes do not — Supabase refuses `delete from
 * storage.objects` precisely because it would orphan them. Removing files
 * first also fails safe: if that step breaks, the subject still exists and the
 * student is told, rather than losing the subject and keeping unreachable
 * uploads they are still paying for.
 *
 * "Deletion is atomic" (US-B3) holds for the database half: one DELETE, and
 * every child row goes with it by foreign key, so there is no window where
 * topics survive their subject.
 */
export async function deleteSubjectAction(
  _prevState: SubjectFormState,
  formData: FormData,
): Promise<SubjectFormState> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  const typed = String(formData.get("confirmation") ?? "").trim();

  if (!id) {
    return {
      status: "error",
      message: "We could not tell which subject to delete.",
      nextStep: "Close this and try again.",
    };
  }

  if (typed !== DELETE_SUBJECT_CONFIRMATION) {
    return {
      status: "error",
      message: `Type ${DELETE_SUBJECT_CONFIRMATION} to confirm.`,
      nextStep: "Nothing has been deleted.",
      fieldErrors: { confirmation: `Type ${DELETE_SUBJECT_CONFIRMATION} exactly.` },
    };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const summary = await getDeletionSummary(id);

    if (summary.storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(BUCKETS.materials)
        .remove(summary.storagePaths);

      if (storageError) {
        return {
          status: "error",
          message: "We could not remove this subject's uploaded files.",
          nextStep: "Nothing has been deleted. Try again in a moment.",
        };
      }
    }

    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) {
      return {
        status: "error",
        message: "We could not delete that subject.",
        nextStep: "Its files are gone but the subject remains — try deleting it again.",
      };
    }
  } catch (thrown) {
    return errorFormState(thrown);
  }

  revalidatePath("/", "layout");
  return { status: "saved" };
}
