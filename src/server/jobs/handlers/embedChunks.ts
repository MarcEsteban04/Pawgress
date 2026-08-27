import "server-only";

import { embedBatch, planBatches, toVectorLiteral } from "@/lib/ai/embeddings";
import { toAppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type Job, type JobSliceResult } from "../types";

/**
 * The embedding handler (FR-P3, US-D4, NFR-C4).
 *
 * **This is the handler the slice mechanism was designed for.** Extraction reads
 * a document in one pass because pdf.js parses it as a unit; embedding is dozens
 * of independent API calls, and a 100-page PDF is far more of them than fits in
 * one function invocation. So it processes a bounded number of batches, records
 * where it stopped, and re-enqueues itself — the `continue` result that has been
 * unused since Sprint 07.
 *
 * Idempotent by selection rather than by bookkeeping: it only ever looks at
 * chunks whose `embedding` is null. A reclaimed lease, a retry, or a second
 * worker all converge on the same end state, and the cursor is an optimisation
 * rather than a correctness requirement.
 */

/**
 * Batches per invocation.
 *
 * Each is one API round trip of up to 96 chunks. Three keeps an invocation to a
 * few seconds even on a slow response, which is the point: a worker that tries
 * to finish a long document in one go is a worker that gets killed holding a
 * lease.
 */
const BATCHES_PER_RUN = 3;

export async function embedChunksHandler(job: Job): Promise<JobSliceResult> {
  const supabase = createSupabaseAdminClient();

  /* Only unembedded chunks, ordered so progress is stable across invocations.
     Selecting by "embedding is null" rather than by cursor is what makes this
     safe to re-run: work already done is invisible to the next attempt. */
  const { data: pending, error } = await supabase
    .from("material_chunks")
    .select("id, content, token_count")
    .eq("material_id", job.targetId)
    .is("embedding", null)
    .order("chunk_index", { ascending: true })
    .limit(BATCHES_PER_RUN * 96);

  if (error) {
    return {
      kind: "failed",
      message: "We could not read the sections to index.",
      nextStep: "Try again in a moment.",
      retryable: true,
    };
  }

  if (!pending || pending.length === 0) {
    // Nothing left — either it was all done, or there was nothing to do.
    return { kind: "done" };
  }

  const batches = planBatches(
    pending.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      tokenCount: chunk.token_count ?? Math.ceil(chunk.content.length / 4),
    })),
  ).slice(0, BATCHES_PER_RUN);

  let embedded = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    try {
      const { vectors } = await embedBatch(
        {
          userId: job.userId,
          task: "embedding",
          /* Keyed on the chunk ids in the batch, not on a running counter. A
             counter would change between attempts as earlier batches complete,
             so a retry would look like new work and be paid for again. The ids
             are stable, so the same batch is always the same key (NFR-C4). */
          idempotencyKey: `embed:${batch[0]!.id}:${batch.length}`,
        },
        batch.map((chunk) => chunk.content),
      );

      /* Written one row at a time rather than as a bulk upsert. It is more round
         trips, and it means a failure halfway through a batch leaves the
         successful rows embedded instead of discarding all 96 — the next
         invocation simply picks up fewer. Progress that survives a failure is
         worth more here than the round trips it costs. */
      for (const [index, chunk] of batch.entries()) {
        const vector = vectors[index];
        if (!vector) continue;
        await supabase
          .from("material_chunks")
          .update({ embedding: toVectorLiteral(vector) })
          .eq("id", chunk.id);
        embedded += 1;
      }
    } catch (thrown) {
      const appError = toAppError(thrown);

      /* Anything already written this run stays written, and the job comes back
         for the rest. A rate limit or a provider blip mid-document should cost
         the remaining batches, not the ones already paid for. */
      if (appError.retryable && embedded > 0) {
        return { kind: "continue", cursor: (job.cursor ?? 0) + embedded };
      }

      return {
        kind: "failed",
        message: appError.message,
        nextStep: appError.nextStep,
        retryable: appError.retryable,
      };
    }

    // Bail out early if this run has done its share.
    if (batchIndex + 1 >= BATCHES_PER_RUN) break;
  }

  /* More to do? Come back. The count is what the status UI turns into a
     progress bar, which is why it is recorded even though selection does not
     depend on it. */
  const { count: remaining } = await supabase
    .from("material_chunks")
    .select("id", { count: "exact", head: true })
    .eq("material_id", job.targetId)
    .is("embedding", null);

  if ((remaining ?? 0) > 0) {
    const done = (job.cursor ?? 0) + embedded;
    return { kind: "continue", cursor: done, totalSlices: done + (remaining ?? 0) };
  }

  return { kind: "done" };
}
