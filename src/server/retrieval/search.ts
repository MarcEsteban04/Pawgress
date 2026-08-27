import "server-only";

import { embedBatch } from "@/lib/ai/embeddings";
import { type RetrievedChunk } from "@/lib/ai/types";
import { logAiEvent } from "@/lib/ai/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSessionOrFail } from "@/server/auth/session";

/**
 * Retrieval (FR-P6, US-D4).
 *
 *   question → embedding → vector search → ranked chunks → context
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 *  1. **The relevance floor.** Nearest-neighbour search always returns
 *     neighbours. Without a minimum similarity, a question about something the
 *     student never uploaded still comes back with the eight least-unrelated
 *     chunks in their library, and the model is handed irrelevant text and asked
 *     to be useful with it. That is precisely where confident nonsense comes
 *     from, and an empty result is the honest answer instead (FR-C3).
 *  2. **Diversity across materials.** Raw top-k lets one long document win every
 *     slot, because a 400-chunk lecture series simply has more chances to score
 *     highly than a two-page handout. The handout is often the better answer.
 *
 * The search itself is `match_chunks` in the database, running as the caller so
 * RLS scopes it — retrieval can only ever see the asking student's own material.
 */

/**
 * Minimum cosine similarity for a chunk to count as relevant.
 *
 * **This number is a starting point, not a calibrated one.** The right value
 * depends on the embedding model and on real questions against real student
 * material, neither of which exists to measure yet. 0.25 is deliberately
 * permissive: at this stage a missed relevant chunk (the assistant claiming the
 * material does not cover something it does) is a worse failure than an extra
 * marginal one, because the model can ignore a weak chunk but cannot invent a
 * missing one. Revisit once there is usage to measure — see the note in
 * docs/architecture.md.
 */
export const MIN_SIMILARITY = 0.25;

/** How many chunks reach the model. */
export const DEFAULT_MATCH_COUNT = 8;

/**
 * Most chunks any single material may contribute.
 *
 * Not a hard rule about relevance — a cap on how much of the answer one document
 * is allowed to be, so a second source gets a look in.
 */
const MAX_PER_MATERIAL = 4;

/**
 * Rough character budget for assembled context.
 *
 * Sized against the model's window with room to spare rather than filled to it:
 * every token of context is paid for on every message, and a prompt stuffed to
 * the limit is one where the instruction competes with a wall of text.
 */
const CONTEXT_CHAR_BUDGET = 24_000;

export type RetrievalScope = {
  subjectId?: string | null;
  topicId?: string | null;
};

export type RetrievalResult = {
  chunks: RetrievedChunk[];
  /** True when the search ran and found nothing above the floor. */
  empty: boolean;
  /** How many chunks matched before diversity and budget trimming. */
  matched: number;
};

type MatchRow = {
  chunk_id: string;
  material_id: string;
  material_title: string;
  page_from: number | null;
  page_to: number | null;
  content: string;
  similarity: number;
};

/**
 * Find the material most relevant to a question.
 *
 * Returns an empty result rather than throwing when nothing is relevant — that
 * is an outcome the caller must handle, not a failure (FR-C3).
 */
export async function retrieveForQuestion(
  question: string,
  scope: RetrievalScope = {},
  matchCount = DEFAULT_MATCH_COUNT,
): Promise<RetrievalResult> {
  const session = await requireSessionOrFail();

  const trimmed = question.trim();
  if (trimmed.length === 0) return { chunks: [], empty: true, matched: 0 };

  /* The question is embedded with the same model the chunks were, which is not
     optional: two models produce vectors in unrelated spaces, and cosine
     distance between them is noise that looks like a number. */
  const { vectors } = await embedBatch(
    {
      userId: session.userId,
      task: "embedding",
      /* Keyed on the question so asking the same thing twice in a session is
         free. Scope is in the key because the same words under a different
         subject are a different query. */
      idempotencyKey: `query:${scope.subjectId ?? "all"}:${scope.topicId ?? "all"}:${hash(trimmed)}`,
    },
    [trimmed],
  );

  const queryVector = vectors[0];
  if (!queryVector) return { chunks: [], empty: true, matched: 0 };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: `[${queryVector.join(",")}]`,
    match_count: matchCount,
    min_similarity: MIN_SIMILARITY,
    p_subject_id: scope.subjectId ?? null,
    p_topic_id: scope.topicId ?? null,
  });

  if (error) {
    logAiEvent("retrieval.failed", { message: error.message }, "warn");
    return { chunks: [], empty: true, matched: 0 };
  }

  const rows = (data ?? []) as MatchRow[];
  const chunks = assembleContext(rows);

  logAiEvent("retrieval.done", {
    matched: rows.length,
    used: chunks.length,
    topSimilarity: rows[0]?.similarity ?? null,
    scoped: Boolean(scope.subjectId),
  });

  return { chunks, empty: chunks.length === 0, matched: rows.length };
}

/**
 * Diversity cap, then budget, then reading order.
 *
 * The order of those three matters. Diversity is applied to the score-ranked
 * list so the best chunk of each material survives; the budget then trims from
 * the weakest end; and only at the very end is the surviving set put back into
 * document order — a model reads a document better in the order it was written
 * than in descending relevance, and the relevance ranking has already done its
 * job by deciding *which* chunks are here.
 */
function assembleContext(rows: MatchRow[]): RetrievedChunk[] {
  const perMaterial = new Map<string, number>();
  const kept: MatchRow[] = [];

  for (const row of rows) {
    const used = perMaterial.get(row.material_id) ?? 0;
    if (used >= MAX_PER_MATERIAL) continue;
    perMaterial.set(row.material_id, used + 1);
    kept.push(row);
  }

  let budget = CONTEXT_CHAR_BUDGET;
  const affordable: MatchRow[] = [];
  for (const row of kept) {
    if (row.content.length > budget) break;
    budget -= row.content.length;
    affordable.push(row);
  }

  /* Reading order: by material, then by page. Chunks from the same page keep
     their relative order because the sort is stable. */
  affordable.sort((a, b) => {
    if (a.material_id !== b.material_id) return a.material_title.localeCompare(b.material_title);
    return (a.page_from ?? 0) - (b.page_from ?? 0);
  });

  return affordable.map((row) => ({
    chunkId: row.chunk_id,
    materialId: row.material_id,
    materialName: row.material_title,
    page: row.page_from,
    text: row.content,
    score: row.similarity,
  }));
}

/**
 * A short, stable key for a question string.
 *
 * Only ever used as an idempotency key, so a fast non-cryptographic hash is the
 * right tool — a collision costs a reused embedding of a similar question, not a
 * security problem.
 */
function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
