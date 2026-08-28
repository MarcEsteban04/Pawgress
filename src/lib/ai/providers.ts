import "server-only";

/**
 * The three chat providers, in the order they are tried (FR-P8).
 *
 * **Groq first, Gemini second, OpenAI only when both have timed out.** That
 * order is a product-owner decision, not a technical one, and it is encoded
 * here rather than in a call site so there is exactly one place that decides.
 *
 * All three speak the OpenAI wire protocol, so one SDK and three base URLs is
 * the whole integration — no adapter layer, no per-provider request builder,
 * and no second dependency to keep in step. Groq and Google both publish
 * OpenAI-compatible endpoints precisely so that this works.
 *
 * Anthropic was here until this sprint. It was removed rather than left as a
 * fourth option: an unused provider still needs its SDK installed, its errors
 * mapped and its pricing kept current, and a path nobody exercises is a path
 * nobody notices has broken.
 */

export type ProviderId = "groq" | "gemini" | "openai";

export type ProviderSpec = {
  id: ProviderId;
  label: string;
  /** Environment variable holding the key. Absent key means the provider is skipped. */
  apiKeyEnv: string;
  /** OpenAI-compatible base URL. Undefined means the SDK's own default. */
  baseURL?: string;
  /** Env var that overrides the model for this provider. */
  modelEnv: string;
  defaultModel: string;
  /** USD per million tokens, for the cost ledger. */
  inputPerMTok: number;
  outputPerMTok: number;
  /**
   * How long to wait before deciding this provider is not going to answer.
   *
   * Short on purpose for the first two. "Timed out" has to be a bounded,
   * observable thing for the fallback rule to mean anything — without a
   * ceiling, a hanging Groq request would never reach Gemini, and the chain
   * would be decoration.
   */
  timeoutMs: number;
  /**
   * Whether the provider accepts `response_format: { type: "json_schema" }`.
   *
   * Where it does not, the schema is described in the prompt and the JSON is
   * validated here instead. The difference is where the guarantee comes from,
   * not whether there is one — a response that fails the schema is a failed
   * generation either way (NFR-R4).
   */
  supportsJsonSchema: boolean;
  /** Whether the provider can read images, for OCR (Sprint 33). */
  supportsImages: boolean;
};

/**
 * Rates are USD per million tokens and are a SNAPSHOT, not a source of truth —
 * the bill comes from the provider either way. A stale figure here produces a
 * wrong estimate in our own reporting, which is why `PRICING_VERIFIED_ON` is
 * published alongside it.
 */
export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  groq: {
    id: "groq",
    label: "Groq",
    apiKeyEnv: "GROQ_AI_API_KEY",
    baseURL: "https://api.groq.com/openai/v1",
    modelEnv: "GROQ_AI_MODEL",
    /* Verified present on this account, 2026-08-28. `llama-3.3-70b-versatile`
       was the obvious guess and returns 404 — Groq retires models faster than
       the other two, which is why the model is an env var and why the fallback
       chain matters. */
    defaultModel: "openai/gpt-oss-120b",
    inputPerMTok: 0.15,
    outputPerMTok: 0.75,
    timeoutMs: 30_000,
    supportsJsonSchema: true,
    /* gpt-oss is text-only, so an OCR call must skip Groq rather than send it
       an image it will silently ignore (Sprint 33). */
    supportsImages: false,
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    apiKeyEnv: "GEMINI_AI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    modelEnv: "GEMINI_AI_MODEL",
    defaultModel: "gemini-2.5-flash",
    inputPerMTok: 0.3,
    outputPerMTok: 2.5,
    timeoutMs: 45_000,
    supportsJsonSchema: true,
    supportsImages: true,
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    apiKeyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_AI_MODEL",
    defaultModel: "gpt-4o-mini",
    inputPerMTok: 0.15,
    outputPerMTok: 0.6,
    /* The last resort gets the longest patience: there is nothing after it, so
       giving up early here means failing the student rather than moving on. */
    timeoutMs: 90_000,
    supportsJsonSchema: true,
    supportsImages: true,
  },
};

/** The order providers are tried in. OpenAI is the fallback of last resort. */
export const PROVIDER_ORDER: ProviderId[] = ["groq", "gemini", "openai"];

export const PRICING_VERIFIED_ON = "2026-08-28";

export function modelFor(provider: ProviderSpec): string {
  return process.env[provider.modelEnv]?.trim() || provider.defaultModel;
}

export function apiKeyFor(provider: ProviderSpec): string | undefined {
  return process.env[provider.apiKeyEnv]?.trim() || undefined;
}

/**
 * The providers that are actually usable right now.
 *
 * A provider with no key is skipped silently rather than failing the chain.
 * That is what lets a developer run with only one key configured, and what
 * makes the deployment story "add a key to add a fallback" rather than "set all
 * three or nothing works".
 */
export function availableProviders(): ProviderSpec[] {
  return PROVIDER_ORDER.map((id) => PROVIDERS[id]).filter((spec) => apiKeyFor(spec) !== undefined);
}

/** USD for one call, to six decimal places — matching the numeric(12,6) column. */
export function estimateProviderCostUsd(
  provider: ProviderSpec,
  inputTokens: number,
  outputTokens: number,
): number {
  const cost =
    (inputTokens * provider.inputPerMTok) / 1_000_000 +
    (outputTokens * provider.outputPerMTok) / 1_000_000;
  return Number(cost.toFixed(6));
}
