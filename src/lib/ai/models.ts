/**
 * The model registry and its price list (NFR-C3).
 *
 * Two jobs: name the models we are allowed to call, and turn a token count into
 * a dollar figure. Both live here rather than at call sites so a price change is
 * one edit and a model swap is configuration.
 *
 * Rates are USD per million tokens, taken from Anthropic's published pricing.
 * They are a snapshot: `verifiedOn` says when, and a stale figure produces a
 * wrong cost estimate rather than a wrong bill — the bill comes from Anthropic
 * either way. Re-check when the number matters.
 */

export type ModelId = "claude-opus-5" | "claude-sonnet-5" | "claude-haiku-4-5";

export type ModelSpec = {
  id: ModelId;
  label: string;
  /** USD per million input tokens. */
  inputPerMTok: number;
  /** USD per million output tokens. */
  outputPerMTok: number;
  /**
   * Cache reads are about a tenth of the input rate and cache writes about
   * 1.25x. Kept as multipliers because they track the input rate rather than
   * being quoted separately.
   */
  cacheReadMultiplier: number;
  cacheWriteMultiplier: number;
  /** Context window, in tokens. */
  contextWindow: number;
};

const VERIFIED_ON = "2026-06-24";

export const MODELS: Record<ModelId, ModelSpec> = {
  "claude-opus-5": {
    id: "claude-opus-5",
    label: "Claude Opus 5",
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheReadMultiplier: 0.1,
    cacheWriteMultiplier: 1.25,
    contextWindow: 1_000_000,
  },
  "claude-sonnet-5": {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheReadMultiplier: 0.1,
    cacheWriteMultiplier: 1.25,
    contextWindow: 1_000_000,
  },
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    inputPerMTok: 1,
    outputPerMTok: 5,
    cacheReadMultiplier: 0.1,
    cacheWriteMultiplier: 1.25,
    contextWindow: 200_000,
  },
};

export const PRICING_VERIFIED_ON = VERIFIED_ON;

/**
 * The model everything runs on unless `AI_CHAT_MODEL` says otherwise.
 *
 * Opus 5, deliberately. Picking a cheaper model is a product decision about
 * quality, not a default to slide in quietly — and for a study app the whole
 * value proposition rests on the generated reviewer being trustworthy. Set
 * `AI_CHAT_MODEL=claude-sonnet-5` (or `claude-haiku-4-5`) to trade it away
 * knowingly; the quota ceiling in `AI_QUOTAS` is the cost control, not the
 * model choice.
 */
const DEFAULT_MODEL: ModelId = "claude-opus-5";

function isModelId(value: string | undefined): value is ModelId {
  return value !== undefined && value in MODELS;
}

/** The configured model, or the default when the env var is absent or unknown. */
export function resolveModel(configured?: string): ModelSpec {
  return MODELS[isModelId(configured) ? configured : DEFAULT_MODEL];
}

export type TokenCounts = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

/**
 * What a call cost, in USD.
 *
 * Cached tokens are billed separately from fresh input, and conflating them
 * overstates the cost of a well-cached RAG prompt by roughly ten times — which
 * would make caching look pointless in exactly the reports meant to justify it.
 */
export function estimateCostUsd(model: ModelSpec, tokens: TokenCounts): number {
  const perToken = (perMTok: number) => perMTok / 1_000_000;

  const input = tokens.inputTokens * perToken(model.inputPerMTok);
  const output = tokens.outputTokens * perToken(model.outputPerMTok);
  const cacheRead =
    (tokens.cacheReadTokens ?? 0) * perToken(model.inputPerMTok) * model.cacheReadMultiplier;
  const cacheWrite =
    (tokens.cacheWriteTokens ?? 0) * perToken(model.inputPerMTok) * model.cacheWriteMultiplier;

  // Six decimal places, matching the numeric(12,6) column.
  return Number((input + output + cacheRead + cacheWrite).toFixed(6));
}
