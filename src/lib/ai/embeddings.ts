import "server-only";

import OpenAI from "openai";
import { AppError, errors } from "@/lib/errors";
import { logAiError } from "./log";
import { EMBEDDING_MODELS, estimateEmbeddingCostUsd, type EmbeddingModelSpec } from "./models";
import { type AiCallMeta } from "./types";
import { checkQuota, claimCall, settleCall } from "./usage";

/**
 * Embeddings (FR-P3, US-D4).
 *
 * **A second provider, and a correction to the Sprint 07 interface.**
 *
 * `AiService` carried an `embed()` method on the assumption that one provider
 * would serve every model call. Anthropic publishes no embeddings endpoint, so
 * that assumption was wrong: embeddings are a genuinely different vendor with a
 * different key, different limits and different pricing. Keeping them behind one
 * interface would mean an interface whose methods talk to two companies — the
 * kind of tidiness that hides the thing you most need to see when a key expires.
 *
 * So this is its own service. `AiService.embed()` is gone rather than left
 * throwing, because a method that always fails is worse than no method: it
 * invites a caller to handle a failure that is really a design gap.
 *
 * The provider is OpenAI's `text-embedding-3-small`, chosen by the product owner
 * over Voyage and a self-hosted model. It is 1536-dimensional, which is what the
 * Sprint 13 schema already fixed — so no migration, and no re-embedding of
 * anything already indexed.
 */

export type EmbeddingBatchResult = {
  /** One vector per input, in the same order. */
  vectors: number[][];
  inputTokens: number;
  costUsd: number;
};

/**
 * Hard limits, taken from the SDK's own documentation rather than assumed:
 * 8,192 tokens per input, 2,048 inputs per request, and 300,000 tokens summed
 * across a request. Our batching stays well inside all three — a request near a
 * limit is a request whose failure loses the most work.
 */
export const MAX_INPUTS_PER_REQUEST = 96;
export const MAX_TOKENS_PER_REQUEST = 100_000;
/** A single chunk over this is truncated rather than failing the whole batch. */
export const MAX_TOKENS_PER_INPUT = 8_000;

function client(): OpenAI {
  const apiKey = process.env.EMBEDDINGS_API_KEY;
  if (!apiKey) {
    throw new AppError({
      code: "provider_unavailable",
      message: "Search indexing is not switched on yet.",
      nextStep: "Reviewers and quizzes still work from your material directly.",
      context: { reason: "EMBEDDINGS_API_KEY is not set" },
    });
  }
  return new OpenAI({ apiKey });
}

function model(): EmbeddingModelSpec {
  const configured = process.env.EMBEDDINGS_MODEL;
  return configured && configured in EMBEDDING_MODELS
    ? EMBEDDING_MODELS[configured]!
    : EMBEDDING_MODELS["text-embedding-3-small"]!;
}

/** OpenAI's error classes mapped onto ours, so nothing raw reaches a screen. */
function mapError(thrown: unknown): AppError {
  if (thrown instanceof AppError) return thrown;

  if (thrown instanceof OpenAI.RateLimitError) {
    return new AppError({
      code: "rate_limited",
      message: "The indexing service is busy.",
      nextStep: "This retries by itself in a moment.",
      cause: thrown,
    });
  }
  if (thrown instanceof OpenAI.AuthenticationError) {
    return new AppError({
      code: "provider_unavailable",
      message: "Search indexing is not available right now.",
      nextStep: "This is on our side. Your material is safe and will be indexed once it is fixed.",
      cause: thrown,
      context: { reason: "embeddings authentication failed" },
    });
  }
  if (thrown instanceof OpenAI.APIError) return errors.providerUnavailable();
  return errors.providerUnavailable();
}

/**
 * Embed one batch of chunk texts.
 *
 * Metered through the same `ai_calls` ledger as every model call, so one query
 * still answers "what has this student cost us" — the point of Sprint 31's
 * accounting was that no paid call sits outside it, and a different vendor does
 * not change that.
 *
 * The idempotency key is supplied by the caller and covers the exact slice, so a
 * reclaimed lease re-runs the same batch and finds the existing ledger row
 * rather than paying twice (NFR-C4).
 */
export async function embedBatch(meta: AiCallMeta, texts: string[]): Promise<EmbeddingBatchResult> {
  if (texts.length === 0) return { vectors: [], inputTokens: 0, costUsd: 0 };
  if (texts.length > MAX_INPUTS_PER_REQUEST) {
    throw new AppError({
      code: "validation",
      message: "Too many sections in one indexing batch.",
      nextStep: "This is a bug on our side — please report it.",
      context: { count: texts.length, max: MAX_INPUTS_PER_REQUEST },
    });
  }

  const spec = model();

  /* Quota first, then a ledger row, exactly as a text call does. Embeddings do
     not draw on the daily generation allowance — a student should not lose
     reviewers because they uploaded a long PDF — but they are still counted and
     costed, and the burst limit still applies. */
  const quota = await checkQuota(meta.userId, meta.task);
  if (!quota.ok) throw quota.error;

  const claim = await claimCall(meta, { id: spec.id });
  const startedAt = Date.now();

  try {
    const response = await client().embeddings.create({
      model: spec.id,
      input: texts,
      /* Stated explicitly even though it is the model's native width. The
         column is `vector(1536)`; if a future model defaults to something else,
         this fails loudly at the API rather than silently storing vectors the
         column will reject. */
      dimensions: spec.dimensions,
    });

    /* Sorted by index rather than trusted to arrive in order. The API documents
       an `index` on every item precisely because order is not guaranteed, and a
       mis-ordered batch would attach every vector to the wrong chunk — which
       fails silently, as retrieval that is simply bad rather than broken. */
    const vectors = [...response.data]
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    if (vectors.length !== texts.length) {
      throw new AppError({
        code: "invalid_ai_output",
        message: "Indexing returned the wrong number of sections.",
        nextStep: "This retries by itself.",
        context: { expected: texts.length, received: vectors.length },
      });
    }

    const inputTokens = response.usage.prompt_tokens;
    const costUsd = estimateEmbeddingCostUsd(spec, inputTokens);

    await settleCall(
      claim.id,
      { id: spec.id },
      "ok",
      { inputTokens, outputTokens: 0 },
      costUsd,
      Date.now() - startedAt,
    );

    return { vectors, inputTokens, costUsd };
  } catch (thrown) {
    const error = mapError(thrown);
    await settleCall(
      claim.id,
      { id: spec.id },
      error.code === "invalid_ai_output" ? "invalid_output" : "failed",
      { inputTokens: 0, outputTokens: 0 },
      0,
      Date.now() - startedAt,
      error.code,
    );
    logAiError("ai.embed", error, { batchSize: texts.length });
    throw error;
  }
}

/**
 * Group chunks into requests that respect both limits at once.
 *
 * Batching by count alone is the version that breaks on a document of long
 * sections; batching by tokens alone breaks on a document of very short ones.
 */
export function planBatches<T extends { content: string; tokenCount: number }>(chunks: T[]): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let tokens = 0;

  for (const chunk of chunks) {
    const cost = Math.min(chunk.tokenCount, MAX_TOKENS_PER_INPUT);
    const wouldExceed =
      current.length >= MAX_INPUTS_PER_REQUEST || tokens + cost > MAX_TOKENS_PER_REQUEST;

    if (wouldExceed && current.length > 0) {
      batches.push(current);
      current = [];
      tokens = 0;
    }

    current.push(chunk);
    tokens += cost;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Postgres wants a vector literal, and postgrest sends it as a string.
 *
 * `[0.1,0.2,…]` — no spaces, which keeps a 1536-dimension vector about 10%
 * smaller on the wire, times every chunk in a document.
 */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
