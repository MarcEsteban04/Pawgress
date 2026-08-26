import "server-only";

import { chunkText } from "@/lib/extraction/chunk";
import { type PageOffset } from "@/lib/extraction/normalize";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type Job, type JobSliceResult } from "../types";

/**
 * The chunking handler (FR-P2, US-D3).
 *
 * Idempotent the blunt way: it deletes this material's chunks and writes a fresh
 * set. That is not laziness — an upsert on `(material_id, chunk_index)` would
 * leave orphans behind whenever a re-chunk produces FEWER chunks than last time,
 * and an orphaned chunk is a sentence retrieval can still cite after the student
 * removed it. Delete-then-insert cannot do that.
 *
 * `subject_id` is copied onto every chunk so scoped retrieval can filter without
 * a join (see the Sprint 34 migration for why that matters to pgvector).
 */
export async function chunkTextHandler(job: Job): Promise<JobSliceResult> {
  const supabase = createSupabaseAdminClient();

  const { data: material, error } = await supabase
    .from("materials")
    .select("id, subject_id, extracted_text, page_offsets")
    .eq("id", job.targetId)
    .maybeSingle();

  if (error || !material) {
    return {
      kind: "failed",
      message: "That material is no longer in your library.",
      nextStep: "Nothing to do — it was deleted.",
      retryable: false,
    };
  }

  const text = material.extracted_text ?? "";
  if (text.trim().length === 0) {
    /* Nothing to chunk. Reached when extraction produced nothing and the
       pipeline still advanced, which is a bug on our side rather than a file
       the student can fix — so the copy does not ask them to do anything. */
    return {
      kind: "failed",
      message: "There is no text to index for this material.",
      nextStep: "Try uploading it again — this one is on us.",
      retryable: false,
    };
  }

  /* `page_offsets` is `jsonb`, so it arrives as `Json`. Validated in shape
     rather than trusted: a malformed offset table would silently attribute
     every citation to the wrong page, which is worse than having none. */
  const offsets = parseOffsets(material.page_offsets);

  const chunks = chunkText(text, offsets);
  if (chunks.length === 0) {
    return {
      kind: "failed",
      message: "We could not split this material into sections.",
      nextStep: "Try uploading it again — this one is on us.",
      retryable: false,
    };
  }

  /* Old chunks go first. If the insert then fails the material has none, which
     shows as an unindexed material and gets retried — the opposite order can
     leave a mix of old and new, and a citation pointing at text that is no
     longer there is the one outcome there is no recovering from. */
  const { error: deleteError } = await supabase
    .from("material_chunks")
    .delete()
    .eq("material_id", material.id);

  if (deleteError) {
    return {
      kind: "failed",
      message: "We could not clear the old index for this material.",
      nextStep: "Try again in a moment.",
      retryable: true,
    };
  }

  const { error: insertError } = await supabase.from("material_chunks").insert(
    chunks.map((chunk) => ({
      user_id: job.userId,
      material_id: material.id,
      subject_id: material.subject_id,
      chunk_index: chunk.index,
      content: chunk.content,
      page_from: chunk.pageFrom,
      page_to: chunk.pageTo,
      token_count: chunk.tokenCount,
      /* `embedding` stays null. Sprint 35 fills it, and until then a null
         embedding is exactly what marks a chunk as not yet searchable. */
    })),
  );

  if (insertError) {
    return {
      kind: "failed",
      message: "We split the material but could not save the sections.",
      nextStep: "Try again in a moment.",
      retryable: true,
    };
  }

  return { kind: "done" };
}

/** `jsonb` in, `PageOffset[]` out, or an empty array if it is not that shape. */
function parseOffsets(raw: unknown): PageOffset[] {
  if (!Array.isArray(raw)) return [];

  const offsets: PageOffset[] = [];
  for (const entry of raw) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as PageOffset).page === "number" &&
      typeof (entry as PageOffset).start === "number" &&
      typeof (entry as PageOffset).end === "number"
    ) {
      const offset = entry as PageOffset;
      offsets.push({ page: offset.page, start: offset.start, end: offset.end });
    }
  }
  return offsets;
}
