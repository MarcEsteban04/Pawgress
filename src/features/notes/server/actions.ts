"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cleanText } from "@/lib/sanitize";
import { parseForm } from "@/lib/validation/form";
import { noteSchema } from "@/lib/validation/note";
import { getMaterial } from "@/server/materials/queries";
import { requireSession } from "@/server/auth/session";
import { type NoteFormState } from "@/features/notes/types";

/**
 * Typed notes (FR-U5, US-C3).
 *
 * **A note is a material, not a second kind of thing.** It lands in the same
 * `materials` table with `kind = 'note'`, `storage_path` null — a shape the
 * Sprint 13 schema already has a CHECK constraint for — and the student's text
 * goes into `extracted_text`.
 *
 * That column choice is the whole design. Everything downstream — chunking,
 * embedding, retrieval, generation — reads `extracted_text`. For an upload that
 * text is the output of an extractor; for a note it is what the student typed.
 * Giving notes their own `body` column would mean every consumer from Sprint 34
 * onwards has to know which of two columns to read, forever, to gain nothing.
 * The authored text *is* the extraction.
 *
 * Status is `queued` for the same reason an upload is: the text exists, but it
 * has not been chunked or embedded, so nothing can be generated from it yet.
 * A note simply skips the extraction stage its uploaded siblings need.
 */

const FIELDS = ["title", "body", "topicId"] as const;

/**
 * Identifies the TEXT, so an edit that did not change it costs nothing.
 *
 * Uploads hash in the browser because the server never sees their bytes
 * (`features/materials/hash.ts`). A note's text arrives in the action, so this
 * hash is computed here and is a fact rather than a claim.
 */
function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Shared failure copy for a subject that is not the caller's, or is gone. */
function subjectGone(): NoteFormState {
  return {
    status: "error",
    message: "That subject is no longer in your list.",
    nextStep: "Go back to your subjects and try again.",
  };
}

export async function createNoteAction(
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const session = await requireSession();

  const subjectId = String(formData.get("subjectId") ?? "");
  if (!subjectId) return subjectGone();

  const parsed = parseForm(noteSchema, formData, FIELDS);
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message,
      nextStep: parsed.nextStep,
      fieldErrors: parsed.fieldErrors,
    };
  }

  /* Control characters and zero-width joiners out; tabs and newlines survive,
     which `cleanText` already guarantees — a note is the one place in the app
     where a student's line breaks are content rather than noise. */
  const body = cleanText(parsed.data.body);
  const title = cleanText(parsed.data.title).slice(0, 300);

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("materials")
    .insert({
      user_id: session.userId,
      subject_id: subjectId,
      topic_id: parsed.data.topicId,
      title,
      kind: "note",
      /* Null, and the CHECK constraint requires it: a note has no object in the
         bucket, so there is nothing for a signed URL to point at. */
      storage_path: null,
      extracted_text: body,
      content_hash: hashText(body),
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !data) {
    /* An RLS refusal and a dead subject id are indistinguishable here, and both
       mean the same thing to the student. */
    return {
      status: "error",
      message: "We could not save that note.",
      nextStep: "Check you are still signed in, then try again.",
    };
  }

  revalidatePath("/", "layout");
  // Straight to the note, because the first thing a student wants after writing
  // one is to see it rendered.
  redirect(`/subjects/${subjectId}/materials/${data.id}`);
}

/**
 * Edit a note (US-C3).
 *
 * The acceptance criterion is that editing "re-processes it and supersedes its
 * old chunks rather than duplicating them". Both halves are here:
 *
 *  - **Supersede**: the note's existing `material_chunks` are deleted, so the
 *    next indexing run writes a fresh set rather than appending to a stale one.
 *    Retrieval must never be able to cite a sentence the student removed.
 *  - **Only when it changed**: the text is hashed and compared first. Fixing a
 *    typo in the TITLE leaves the body's hash identical, so the chunks and the
 *    embeddings behind them survive — re-embedding unchanged text is money spent
 *    for no difference (FR-P7, NFR-C4).
 */
export async function updateNoteAction(
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return {
      status: "error",
      message: "We could not tell which note to save.",
      nextStep: "Reload the page and try again.",
    };
  }

  const parsed = parseForm(noteSchema, formData, FIELDS);
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message,
      nextStep: parsed.nextStep,
      fieldErrors: parsed.fieldErrors,
    };
  }

  /* Read through the DAL rather than trusting the form: this confirms the note
     is the caller's and that it is a note at all, so an uploaded PDF cannot be
     turned into one by posting its id here. */
  const existing = await getMaterial(id);
  if (!existing) {
    return {
      status: "error",
      message: "That note is no longer in your library.",
      nextStep: "Reload the page.",
    };
  }
  if (existing.kind !== "note") {
    return {
      status: "error",
      message: "That material is an uploaded file, not a note.",
      nextStep: "Uploaded files cannot be edited — replace the file instead.",
    };
  }

  const body = cleanText(parsed.data.body);
  const title = cleanText(parsed.data.title).slice(0, 300);
  const nextHash = hashText(body);
  const textChanged = nextHash !== existing.contentHash;

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("materials")
    .update({
      title,
      topic_id: parsed.data.topicId,
      extracted_text: body,
      content_hash: nextHash,
      /* Only reset the pipeline when there is something new to read. A
         title-only edit keeps its status, its chunks and its embeddings. */
      ...(textChanged
        ? {
            status: "queued" as const,
            failure_message: null,
            failure_next_step: null,
            processed_at: null,
          }
        : {}),
    })
    .eq("id", id);

  if (error) {
    return {
      status: "error",
      message: "We could not save that note.",
      nextStep: "Try again in a moment.",
    };
  }

  if (textChanged) {
    /* Chunks go AFTER the text is safely stored. The other order risks losing
       the old chunks and then failing to save the new body, leaving a note that
       is neither searchable nor recoverable. A leftover set of stale chunks is
       the lesser failure, and the next indexing run replaces them anyway. */
    const { error: chunkError } = await supabase
      .from("material_chunks")
      .delete()
      .eq("material_id", id);

    if (chunkError) {
      return {
        status: "error",
        message: "Your note was saved, but we could not clear the old search index.",
        nextStep: "Edit and save it again to retry — nothing you wrote is lost.",
      };
    }
  }

  revalidatePath("/", "layout");
  return { status: "saved", reindexed: textChanged };
}
