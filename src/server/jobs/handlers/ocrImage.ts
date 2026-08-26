import "server-only";

import { toAppError } from "@/lib/errors";
import { ocrImage, ocrMediaTypeFor } from "@/lib/extraction/ocr";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BUCKETS } from "@/lib/supabase/storage";
import { type Job, type JobSliceResult } from "../types";

/**
 * The OCR handler (FR-U7, US-C7).
 *
 * Idempotent like its sibling: it replaces `extracted_text` and
 * `ocr_confidence` and writes nothing incremental, so a reclaimed lease is safe.
 * The AI call underneath is keyed on the material id as well, so a re-run reuses
 * the original call rather than paying to read the same photo twice.
 *
 * One page, always. A photo is one image; there is nothing to slice and nothing
 * to number, so `page_count` stays null rather than claiming a page 1 that means
 * nothing to a citation.
 */
export async function ocrImageHandler(job: Job): Promise<JobSliceResult> {
  const supabase = createSupabaseAdminClient();

  const { data: material, error } = await supabase
    .from("materials")
    .select("id, kind, storage_path, extracted_text")
    .eq("id", job.targetId)
    .maybeSingle();

  if (error || !material) {
    return {
      kind: "failed",
      message: "That image is no longer in your library.",
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

  const mediaType = ocrMediaTypeFor(material.storage_path);
  if (!mediaType) {
    /* Almost always HEIC. Named precisely, with the fix a student can actually
       apply, rather than a generic "unsupported format". */
    return {
      kind: "failed",
      message: "We cannot read this image format.",
      nextStep:
        "iPhones save photos as HEIC by default, which browsers and readers cannot open. In Settings → Camera → Formats, choose “Most Compatible”, then take the photo again — or type the text as a note.",
      retryable: false,
    };
  }

  // Already read, and a first attempt: nothing to redo (FR-P7, NFR-C4).
  if (material.extracted_text && material.extracted_text.length > 0 && job.attempts <= 1) {
    return { kind: "done" };
  }

  const download = await supabase.storage.from(BUCKETS.materials).download(material.storage_path);
  if (download.error || !download.data) {
    return {
      kind: "failed",
      message: "We could not open the stored image.",
      nextStep: "Try again in a moment. If it persists, re-upload it.",
      retryable: true,
    };
  }

  const bytes = new Uint8Array(await download.data.arrayBuffer());

  let result;
  try {
    result = await ocrImage({
      userId: job.userId,
      materialId: material.id,
      bytes,
      mediaType,
    });
  } catch (thrown) {
    const appError = toAppError(thrown);
    /* Quota and rate-limit refusals are retryable and arrive with their own
       copy; so do "too large" and "nothing readable", which are not. Passed
       through unchanged either way — they already say what to do. */
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
      extracted_text: result.text,
      ocr_confidence: result.confidence,
      /* One page, but the offset table still has to exist so chunking treats an
         OCR'd photo like anything else rather than special-casing it. */
      page_offsets: [{ page: 1, start: 0, end: result.text.length }],
      page_count: null,
    })
    .eq("id", job.targetId);

  if (writeError) {
    return {
      kind: "failed",
      message: "We read the image but could not save the text.",
      nextStep: "Try again in a moment.",
      retryable: true,
    };
  }

  return { kind: "done" };
}
