import { type ZodType } from "zod";

/**
 * The AI service contract.
 *
 * Every model call in Pawgress goes through this interface — the assistant, the
 * reviewer generator, the quiz generator, embeddings. Features depend on this
 * file and never on a provider SDK, so swapping a model is configuration and
 * swapping a provider is one new implementation (FR-P8).
 *
 * Implementations land in Sprint 31. This file is the contract they satisfy.
 */

export type AiTaskKind =
  | "assistant"
  | "reviewer"
  | "flashcards"
  | "practice_questions"
  | "quiz"
  | "short_answer_grade"
  | "embedding";

/** What a call cost. Recorded for every call, attributed to a user (NFR-C3). */
export type AiUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Milliseconds from request to last byte. */
  latencyMs: number;
  /** Provider-reported cost where available, else computed from a rate table. */
  estimatedCostUsd: number;
};

export type AiCallMeta = {
  /** Attribution for quotas and cost accounting. Required, always. */
  userId: string;
  task: AiTaskKind;
  /**
   * Stable hash of the request. Two identical requests must not be paid for
   * twice, and a retried job must not double-charge (NFR-C4, NFR-C5).
   */
  idempotencyKey: string;
};

/** A retrieved chunk of the student's own material, with its provenance. */
export type RetrievedChunk = {
  chunkId: string;
  materialId: string;
  materialName: string;
  /** Page for PDFs and DOCX, slide for PPTX. Null for typed notes. */
  page: number | null;
  text: string;
  /** Similarity score from the vector search, 0–1. */
  score: number;
};

/** A citation as it reaches the UI. Mirrors SourceChip's props on purpose. */
export type Citation = {
  materialId: string;
  materialName: string;
  page: number | null;
};

export type GenerateOptions = {
  /**
   * The chunks the answer must be grounded in. An empty array is meaningful:
   * it means retrieval found nothing, and the caller must handle that rather
   * than letting the model improvise (FR-C3, product principle 1).
   */
  context: RetrievedChunk[];
  /** Hard cap so one request cannot run away with the budget. */
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

export type GenerateResult<T> = {
  data: T;
  citations: Citation[];
  usage: AiUsage;
};

/**
 * The service every feature talks to.
 *
 * Note what is NOT here: no raw `complete(prompt)` escape hatch. Structured
 * output is validated against a schema by the implementation, retried once, then
 * surfaced as a failure — never rendered raw (NFR-R4). An unconstrained string
 * endpoint would let a feature route around that.
 */
export interface AiService {
  /**
   * Grounded generation constrained to a Zod schema.
   *
   * The schema goes to the provider, not just to us: structured output is
   * enforced at the API boundary, and a response that does not match is a
   * generation failure rather than something a feature has to validate after
   * the fact (NFR-R4).
   */
  generate<T>(
    meta: AiCallMeta,
    prompt: string,
    schema: ZodType<T>,
    options: GenerateOptions,
  ): Promise<GenerateResult<T>>;

  /** Streaming variant for the assistant, where first-token latency is the metric. */
  stream(
    meta: AiCallMeta,
    prompt: string,
    options: GenerateOptions,
  ): Promise<{
    textStream: AsyncIterable<string>;
    /** Resolves once the stream completes. */
    done: Promise<{ citations: Citation[]; usage: AiUsage }>;
  }>;

  /**
   * Embeddings for chunking and search. Batched — never one call per chunk.
   *
   * Anthropic publishes no embeddings endpoint, so this needs a second
   * provider. The Anthropic implementation throws until Sprint 35 picks one —
   * see `anthropic.ts`.
   */
  embed(meta: AiCallMeta, texts: string[]): Promise<{ vectors: number[][]; usage: AiUsage }>;
}

/**
 * Per-user daily allowances (NFR-C1).
 *
 * A public site running an LLM over uploaded documents with no ceiling is the
 * largest financial risk in this build, so the limits are part of the contract
 * rather than an operational afterthought. Numbers are a starting point to be
 * revised against real usage.
 */
export const AI_QUOTAS = {
  /** Reviewer, flashcard, quiz and practice generations combined. */
  generationsPerDay: 20,
  /** Assistant messages. */
  messagesPerDay: 20,
  /** Pages of a single document we will process. Long PDFs are truncated, loudly. */
  maxPagesPerDocument: 100,
  /** Total stored bytes per user. */
  maxStorageBytes: 500 * 1024 * 1024,
} as const;

export type AiQuotaKind = "generations" | "messages";

export type QuotaStatus = {
  kind: AiQuotaKind;
  used: number;
  limit: number;
  /** Local time the allowance resets, for the copy in QuotaMeter. */
  resetsAt: string;
};
