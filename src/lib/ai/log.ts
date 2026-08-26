import "server-only";

import { toAppError } from "@/lib/errors";

/**
 * Request logging for the AI layer (Sprint 31 deliverable).
 *
 * Deliberately scoped to `lib/ai` rather than a general observability module:
 * Sprint 08, which would have owned that, was removed from the roadmap. What
 * remains necessary is narrower — every model call has to be traceable, because
 * an untraceable call is an unbounded one.
 *
 * One line of JSON per event, which is the shape Vercel's logs and Supabase's
 * both ingest without extra work. A vendor SDK, if one is ever adopted at
 * Sprint 77, replaces the body of `emit` and nothing else.
 */

type Severity = "error" | "warn" | "info";

function emit(severity: Severity, event: string, fields: Record<string, unknown>): void {
  const line = JSON.stringify({
    severity,
    event,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    at: new Date().toISOString(),
    ...fields,
  });
  if (severity === "error") console.error(line);
  else if (severity === "warn") console.warn(line);
  else console.log(line);
}

/**
 * A model call, a quota refusal, a rate-limit trip.
 *
 * Never the prompt and never the response. A log carrying student material is a
 * copy of their coursework in a place with different retention rules and
 * different access rules (NFR-P1) — token counts and costs answer every
 * operational question without holding any of it.
 */
export function logAiEvent(
  event: string,
  fields: Record<string, unknown>,
  severity: Exclude<Severity, "error"> = "info",
): void {
  emit(severity, event, fields);
}

/** A failure. Normalised first, so nothing raw from a provider reaches a log either. */
export function logAiError(
  event: string,
  thrown: unknown,
  fields: Record<string, unknown> = {},
): void {
  const error = toAppError(thrown);
  emit("error", event, {
    code: error.code,
    message: error.message,
    cause: error.cause instanceof Error ? error.cause.message : undefined,
    ...error.context,
    ...fields,
  });
}
