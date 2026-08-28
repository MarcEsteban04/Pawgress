import "server-only";

import { createChatService } from "./chat";
import { type AiService } from "./types";

/**
 * The one way a feature reaches a model.
 *
 * `import { getAiService } from "@/lib/ai"` and nothing else — no feature
 * imports `chat.ts`, and no feature imports the provider SDK. That is what
 * makes the provider swappable and the usage log complete: there is no second
 * path a call could take that skips quotas or accounting.
 *
 * Behind this one call sit three providers — Groq, then Gemini, then OpenAI —
 * tried in that order, with OpenAI reached only when the first two cannot
 * answer. Callers do not choose, and do not need to know which one replied;
 * `usage.model` on the result says which one did, and the ledger records it.
 *
 * Not memoised. The service holds no connection state worth reusing, and a
 * per-call instance means a model change through `GROQ_AI_MODEL` and friends
 * takes effect on the next request rather than the next deploy.
 */
export function getAiService(): AiService {
  return createChatService();
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
export {
  availableProviders,
  PRICING_VERIFIED_ON,
  PROVIDER_ORDER,
  PROVIDERS,
  estimateProviderCostUsd,
  modelFor,
} from "./providers";
export type { ProviderId, ProviderSpec } from "./providers";
export { EMBEDDING_MODELS, estimateEmbeddingCostUsd } from "./models";
export type { EmbeddingModelSpec, TokenCounts } from "./models";
export { getQuotaStatus } from "./usage";
