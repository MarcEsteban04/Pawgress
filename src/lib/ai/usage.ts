import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, errors } from "@/lib/errors";
import { logAiEvent } from "./log";
import { estimateCostUsd, type ModelSpec, type TokenCounts } from "./models";
import { AI_QUOTAS, type AiCallMeta, type AiQuotaKind, type QuotaStatus } from "./types";

/**
 * Usage accounting, quotas and rate limiting (NFR-C1, NFR-C3, NFR-S4).
 *
 * **Every call is claimed before it runs and settled after.** The row goes in
 * with `outcome: 'started'`, so a call that times out or crashes still counts
 * against the day's allowance. Counting only completed calls would let a
 * student retry a failing generation without limit — which is precisely the
 * pattern that produces a surprise bill.
 *
 * Writes use the service-role client because `ai_calls` is select-only under
 * RLS: a student able to insert their own usage rows could grant themselves
 * unlimited quota. Reads for the UI go through the normal client, where RLS
 * scopes them to the caller.
 */

/** Which quota a task draws from. Assistant messages and generations are separate allowances. */
function quotaKindFor(task: AiCallMeta["task"]): AiQuotaKind | null {
  if (task === "assistant") return "messages";
  // Embeddings are metered by document pages, not by call — see maxPagesPerDocument.
  if (task === "embedding") return null;
  /* Everything else, OCR included, draws on the generation allowance. Reading a
     photo costs money, so it counts; the alternative was an unmetered paid call,
     which makes the whole ceiling decorative. The consequence is real and worth
     knowing: twenty photos in a day is a day's generations. */
  return "generations";
}

function limitFor(kind: AiQuotaKind): number {
  return kind === "messages" ? AI_QUOTAS.messagesPerDay : AI_QUOTAS.generationsPerDay;
}

/**
 * Midnight tonight in UTC.
 *
 * A per-student local reset would be fairer and needs their timezone, which the
 * profile does carry — wiring it is deliberately left until the planner needs
 * the same value, so both read one source rather than two.
 */
function windowStart(): string {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

const RATE_LIMIT_WINDOW_SECONDS = 60;
/** Bursts above this in a minute are a script, not a student (NFR-S4). */
const RATE_LIMIT_MAX_CALLS = 10;

export type QuotaCheck = { ok: true } | { ok: false; error: AppError };

/**
 * Whether this user may make this call right now.
 *
 * Checked BEFORE the model is called, so the failure costs nothing. The daily
 * allowance and the per-minute burst are both counted from `ai_calls`, which
 * means there is one source of truth for what a student has spent — no second
 * store to keep in step, and no counter that survives a deploy while the log
 * says otherwise (the open question from architecture.md §8, decided here).
 */
export async function checkQuota(userId: string, task: AiCallMeta["task"]): Promise<QuotaCheck> {
  const kind = quotaKindFor(task);
  if (!kind) return { ok: true };

  const supabase = createSupabaseAdminClient();

  const sinceRate = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
  const [{ count: dayCount }, { count: burstCount }] = await Promise.all([
    supabase
      .from("ai_calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("task", tasksFor(kind))
      .gte("created_at", windowStart()),
    supabase
      .from("ai_calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", sinceRate),
  ]);

  if ((burstCount ?? 0) >= RATE_LIMIT_MAX_CALLS) {
    logAiEvent("ai.rate_limited", { userId, burstCount }, "warn");
    return {
      ok: false,
      error: new AppError({
        code: "rate_limited",
        message: "That is a lot of requests at once.",
        nextStep: "Wait a few seconds and try again.",
      }),
    };
  }

  const used = dayCount ?? 0;
  const limit = limitFor(kind);
  if (used >= limit) {
    logAiEvent("ai.quota_exceeded", { userId, kind, used, limit }, "warn");
    return { ok: false, error: errors.quotaExceeded(used, limit, "midnight UTC") };
  }

  return { ok: true };
}

/** Which task kinds draw on a given allowance. */
function tasksFor(kind: AiQuotaKind): AiCallMeta["task"][] {
  return kind === "messages"
    ? ["assistant"]
    : ["reviewer", "flashcards", "practice_questions", "quiz", "short_answer_grade", "ocr"];
}

export type ClaimedCall = {
  id: string;
  /** True when an identical request was already made and is being reused. */
  reused: boolean;
};

/**
 * Reserve a call before making it.
 *
 * The unique index on `(user_id, idempotency_key)` does the real work: a retried
 * job or a double-clicked button hits the conflict and gets the existing row
 * back instead of paying twice (NFR-C4, NFR-C5).
 */
export async function claimCall(meta: AiCallMeta, model: ModelSpec): Promise<ClaimedCall> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("ai_calls")
    .insert({
      user_id: meta.userId,
      task: meta.task,
      model: model.id,
      idempotency_key: meta.idempotencyKey,
    })
    .select("id")
    .single();

  if (!error && data) return { id: data.id, reused: false };

  // 23505 is unique_violation: the same request has been made before.
  const existing = await supabase
    .from("ai_calls")
    .select("id")
    .eq("user_id", meta.userId)
    .eq("idempotency_key", meta.idempotencyKey)
    .maybeSingle();

  if (existing.data) return { id: existing.data.id, reused: true };

  /* Neither the insert nor the lookup worked, which means the usage log is
     unreachable. Refusing the call is the right answer: an unlogged call is an
     uncapped one, and the whole point of the ceiling is that it cannot be
     bypassed by a database hiccup. */
  throw new AppError({
    code: "unexpected",
    message: "We could not start that request.",
    nextStep: "Try again in a moment.",
    context: { reason: "ai_calls insert failed", error: error?.message },
  });
}

export type CallOutcome = "ok" | "refused" | "failed" | "invalid_output";

/** Settle a claimed call with what it actually used. */
export async function settleCall(
  callId: string,
  model: ModelSpec,
  outcome: CallOutcome,
  tokens: TokenCounts,
  latencyMs: number,
  failureCode?: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const costUsd = estimateCostUsd(model, tokens);

  await supabase
    .from("ai_calls")
    .update({
      outcome,
      input_tokens: tokens.inputTokens,
      output_tokens: tokens.outputTokens,
      cache_read_tokens: tokens.cacheReadTokens ?? 0,
      cache_write_tokens: tokens.cacheWriteTokens ?? 0,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      failure_code: failureCode ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", callId);

  logAiEvent("ai.call", {
    model: model.id,
    outcome,
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    cacheReadTokens: tokens.cacheReadTokens ?? 0,
    costUsd,
    latencyMs,
  });
}

/**
 * Today's usage for the signed-in student, for the shell's quota meter.
 *
 * Reads through the RLS-scoped client rather than the admin one: this is the
 * caller asking about themselves, and there is no reason to reach for a key
 * that can see everybody.
 */
export async function getQuotaStatus(kind: AiQuotaKind): Promise<QuotaStatus> {
  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from("ai_calls")
    .select("id", { count: "exact", head: true })
    .in("task", tasksFor(kind))
    .gte("created_at", windowStart());

  return {
    kind,
    used: count ?? 0,
    limit: limitFor(kind),
    resetsAt: "midnight UTC",
  };
}
