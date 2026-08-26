import "server-only";

import { createAnthropicService } from "./anthropic";
import { type AiService } from "./types";

/**
 * The one way a feature reaches a model.
 *
 * `import { getAiService } from "@/lib/ai"` and nothing else — no feature
 * imports `anthropic.ts`, and no feature imports the provider SDK. That is what
 * makes the provider swappable and the usage log complete: there is no second
 * path a call could take that skips quotas or accounting.
 *
 * Not memoised. The service holds no connection state worth reusing, and a
 * per-call instance means a model change through `AI_CHAT_MODEL` takes effect
 * on the next request rather than the next deploy.
 */
export function getAiService(): AiService {
  return createAnthropicService();
}

export { AI_QUOTAS } from "./types";
export type {
  AiCallMeta,
  AiQuotaKind,
  AiService,
  AiTaskKind,
  AiUsage,
  Citation,
  GenerateOptions,
  GenerateResult,
  QuotaStatus,
  RetrievedChunk,
} from "./types";
export { MODELS, PRICING_VERIFIED_ON, estimateCostUsd, resolveModel } from "./models";
export type { ModelId, ModelSpec } from "./models";
export { getQuotaStatus } from "./usage";
