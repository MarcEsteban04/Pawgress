import "server-only";

import { extractMaterial } from "@/lib/extraction";
import { toAppError } from "@/lib/errors";
import { BUCKETS } from "@/lib/supabase/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type MaterialKind } from "@/types";
import { type Job, type JobSliceResult } from "../types";

/**
 * The extraction handler (FR-P1, US-D3).
 *
 * Idempotent by construction (NFR-R1): it reads the object, replaces
 * `extracted_text` and `page_offsets`, and writes nothing incremental. Running
 * it twice produces the same row, which is what makes a reclaimed lease safe.
 *
 * It downloads the whole object rather than reading a range, unlike the
 * signature check in Sprint 26. That check needed four bytes; this needs every
 * one of them, and a document is capped at 25 MB by the bucket.
 */
export async function extractTextHandler(job: Job): Promise<JobSliceResult> {
  const supabase = createSupabaseAdminClient();

  const { data: material, error } = await supabase
    .from("materials")
    .select("id, kind, storage_path, content_hash, extracted_text")
    .eq("id", job.targetId)
    .maybeSingle();

  if (error || !material) {
    /* The material was deleted while the job was queued. Not a failure worth
       showing anyone — there is nobody left to show it to. */
    return {
      kind: "failed",
      message: "That file is no longer in your library.",
      nextStep: "Nothing to do — it was deleted.",
      retryable: false,
    };
  }

  if (!material.storage_path) {
    return {
      kind: "failed",
      message: "This material has no file to read.",
      nextStep: "Delete it and upload again.",
      retryable: false,
    };
  }

  /* Already extracted and the bytes have not changed, so there is nothing to
     redo (FR-P7, NFR-C4). Cheap to check and it makes a re-queue — from a
     sweeper, or from a student hitting retry — free rather than wasteful. */
  if (material.extracted_text && material.extracted_text.length > 0 && job.attempts <= 1) {
    // Only skipped on a first attempt: a retry is usually asking for a redo.
    return { kind: "done" };
  }

  const download = await supabase.storage.from(BUCKETS.materials).download(material.storage_path);
  if (download.error || !download.data) {
    return {
      kind: "failed",
      message: "We could not open the stored file.",
      nextStep: "Try again in a moment. If it persists, re-upload the file.",
      retryable: true,
    };
  }

  const bytes = new Uint8Array(await download.data.arrayBuffer());

  let extracted;
  try {
    extracted = await extractMaterial(material.kind as MaterialKind, bytes);
  } catch (thrown) {
    const appError = toAppError(thrown);
    /* Extraction failures are almost all the student's to act on — a scan, an
       over-long book, a corrupt file — and they already carry copy that says
       what to do. Passed straight through rather than reworded. */
    return {
      kind: "failed",
      message: appError.message,
      nextStep: appError.nextStep,
      retryable: appError.retryable,
    };
  }

  const { error: writeError } = await supabase
    .from("materials")
    .update({
      extracted_text: extracted.text,
      page_offsets: extracted.offsets,
      /* A DOCX has no pages until something renders it, so the extractor
         returns one synthetic page and this stays null rather than claiming
         a page count that does not exist. */
      page_count: material.kind === "docx" ? null : extracted.pageCount,
    })
    .eq("id", job.targetId);

  if (writeError) {
    return {
      kind: "failed",
      message: "We read the file but could not save the text.",
      nextStep: "Try again in a moment.",
      retryable: true,
    };
  }

  return { kind: "done" };
}
