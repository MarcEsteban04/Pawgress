"use server";

import { revalidatePath } from "next/cache";
import { cleanText } from "@/lib/sanitize";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BUCKETS, BUCKET_LIMITS, objectPath, safeFileName } from "@/lib/supabase/storage";
import { requireSession } from "@/server/auth/session";
import { MATERIAL_MIME_TYPES, materialKindFor } from "../upload";
import { type MaterialFormState, type UploadTicketResult } from "../types";

/**
 * Material upload (Sprint 25 — FR-U1, US-C1).
 *
 * Three actions, because the bytes do not come through here. The browser asks
 * for a ticket, PUTs the file straight to Supabase Storage, then asks for the
 * row to be recorded. See `../upload.ts` for why that split is mandatory
 * rather than clever.
 *
 * The security consequence is worth being explicit about: **the server never
 * sees these bytes**, so the Sprint 17 magic-byte check cannot run here. What
 * still holds is the bucket's own `file_size_limit` and `allowed_mime_types`,
 * the storage policies keyed on the path's first segment, and the fact that the
 * path is chosen HERE and not accepted from the client. Byte-level verification
 * of what actually landed is Sprint 26's job, and it will run against the
 * stored object rather than a request body.
 */

/** Where a subject's files live. Grouped by subject so a listing is one prefix. */
function materialPath(userId: string, subjectId: string, fileName: string): string {
  /* A timestamp prefix rather than a bare name: two files called `lecture.pdf`
     must not collide, and `upsert: false` on the signed URL means a collision
     is an error rather than a silent overwrite of last week's notes. */
  return objectPath(userId, "materials", subjectId, `${Date.now()}-${safeFileName(fileName)}`);
}

export async function createUploadTicketAction(input: {
  subjectId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
}): Promise<UploadTicketResult> {
  const session = await requireSession();

  const kind = materialKindFor(input.mimeType);
  if (
    !kind ||
    !MATERIAL_MIME_TYPES.includes(input.mimeType as (typeof MATERIAL_MIME_TYPES)[number])
  ) {
    return {
      status: "error",
      message: "That file type is not supported.",
      nextStep: "Upload a PDF, Word or PowerPoint file, or a photo.",
    };
  }

  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) {
    return {
      status: "error",
      message: "That file is empty.",
      nextStep: "Check the file opens on your device, then try again.",
    };
  }

  if (input.byteSize > BUCKET_LIMITS.materials) {
    const limitMb = Math.round(BUCKET_LIMITS.materials / (1024 * 1024));
    return {
      status: "error",
      message: `That file is larger than ${limitMb} MB.`,
      nextStep: "Split it, or export a smaller version, and upload again.",
    };
  }

  const supabase = await createSupabaseServerClient();

  /* Ownership is checked before a ticket is minted, not after the bytes land.
     RLS would stop the row being inserted later, but by then the object is in
     the bucket and nothing points at it — an orphan the student pays for. This
     read returns nothing for a subject that is not theirs. */
  const { data: subject } = await supabase
    .from("subjects")
    .select("id")
    .eq("id", input.subjectId)
    .maybeSingle();

  if (!subject) {
    return {
      status: "error",
      message: "We could not find that subject.",
      nextStep: "Reload the page and try again.",
    };
  }

  const path = materialPath(session.userId, input.subjectId, input.fileName);

  const { data, error } = await supabase.storage
    .from(BUCKETS.materials)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return {
      status: "error",
      message: "We could not start that upload.",
      nextStep: "Try again in a moment.",
    };
  }

  return { status: "ok", ticket: { path: data.path, token: data.token } };
}

/**
 * Record a material once its bytes are in the bucket.
 *
 * `status: "queued"` rather than `"ready"`. Nothing has been extracted yet —
 * the pipeline lands in Sprint 32 — and marking a file ready before it is
 * readable would make every downstream panel lie about what it can do with it.
 */
export async function recordMaterialAction(input: {
  subjectId: string;
  topicId: string | null;
  path: string;
  fileName: string;
  title: string;
  mimeType: string;
  byteSize: number;
}): Promise<MaterialFormState> {
  const session = await requireSession();

  const kind = materialKindFor(input.mimeType);
  if (!kind) {
    return {
      status: "error",
      message: "That file type is not supported.",
      nextStep: "Upload a PDF, Word or PowerPoint file, or a photo.",
    };
  }

  /* The path is re-derived from the session rather than trusted. A client that
     posted somebody else's path would otherwise get a row pointing at a file it
     cannot read — the storage policy stops the READ, but the dangling row would
     still show up in their library as a file that never opens. */
  if (!input.path.startsWith(`${session.userId}/materials/${input.subjectId}/`)) {
    return {
      status: "error",
      message: "That upload could not be verified.",
      nextStep: "Try uploading the file again.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("materials")
    .insert({
      user_id: session.userId,
      subject_id: input.subjectId,
      /* An empty topic select posts "", which is not a uuid. Null means "filed
         under the subject only", which is a legitimate state (FR-U1). */
      topic_id: input.topicId || null,
      title: cleanText(input.title).slice(0, 300) || input.fileName.slice(0, 300),
      kind,
      storage_path: input.path,
      byte_size: input.byteSize,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: "We uploaded the file but could not add it to your library.",
      nextStep: "Try uploading it again.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "saved", materialId: data.id };
}

/**
 * Delete an object whose row was never created.
 *
 * Called by the browser when `recordMaterialAction` fails. Without it a failed
 * record leaves bytes in the bucket that nothing references and nothing can
 * reach — invisible to the student and charged to the project. Best effort by
 * design: if this also fails there is nothing useful left to tell them.
 */
export async function discardUploadAction(path: string): Promise<void> {
  const session = await requireSession();
  if (!path.startsWith(`${session.userId}/`)) return;

  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(BUCKETS.materials).remove([path]);
}
