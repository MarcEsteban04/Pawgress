/**
 * Embedding models and the token-count shape the ledger stores.
 *
 * **The chat model registry used to live here and no longer does.** It listed
 * three Claude models with their prices; chat now runs across Groq, Gemini and
 * OpenAI, and each of those owns its model name and rates in `providers.ts`
 * alongside the base URL and timeout they belong with. Splitting a provider's
 * identity across two files is how a price ends up updated in one of them.
 *
 * Embeddings stay here because they are genuinely a different axis: one
 * provider, one model, and a dimension count that is load-bearing.
 */

/**
 * `dimensions` is load-bearing: `material_chunks.embedding` is `vector(1536)`,
 * so a model of a different width needs a migration and a full re-embed, not a
 * config change.
 */
export type EmbeddingModelSpec = {
  id: string;
  label: string;
  inputPerMTok: number;
  dimensions: number;
};

export const EMBEDDING_MODELS: Record<string, EmbeddingModelSpec> = {
  "text-embedding-3-small": {
    id: "text-embedding-3-small",
    label: "OpenAI text-embedding-3-small",
    inputPerMTok: 0.02,
    dimensions: 1536,
  },
};

/** Embeddings have no output tokens, so cost is one multiplication. */
export function estimateEmbeddingCostUsd(model: EmbeddingModelSpec, inputTokens: number): number {
  return Number(((inputTokens * model.inputPerMTok) / 1_000_000).toFixed(6));
}

/**
 * What the ledger records for a call.
 *
 * `cacheRead`/`cacheWrite` are optional and currently always zero: prompt
 * caching is an Anthropic-shaped feature and none of the three OpenAI-protocol
 * providers reports it the same way. The columns stay because dropping them
 * would lose the history already written into them, and because Gemini's
 * implicit caching may become reportable later.
 */
export type TokenCounts = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};
