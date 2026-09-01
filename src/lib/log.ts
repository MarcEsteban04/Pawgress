import "server-only";

/**
 * Server logging for everything that is not a model call.
 *
 * `lib/ai/log.ts` covers the AI layer and says why it is scoped that way:
 * Sprint 08, which would have owned general observability, was removed from the
 * roadmap. This is the narrow remainder that turned out to be necessary anyway.
 *
 * THE FAILURE THIS EXISTS FOR: every server action in the app followed the
 * shape `const { error } = await supabase...; if (error) return "we could not
 * do that"`. The Postgres error — its code, its constraint name, its message —
 * was discarded at that line and written nowhere. A student saw "try again in a
 * moment", the terminal showed nothing, and the actual cause was unrecoverable
 * from either side. A failure nobody can read is a failure nobody can fix.
 *
 * Same one-line-JSON shape as the AI logger, for the same reason: Vercel and
 * Supabase both ingest it without extra work.
 *
 * **Never log student content** — a subject name is theirs, a material's text
 * certainly is. Log the identifiers and the database's own words about what it
 * refused, which is what answers the operational question (NFR-P1).
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

export function logEvent(
  event: string,
  fields: Record<string, unknown> = {},
  severity: Exclude<Severity, "error"> = "info",
): void {
  emit(severity, event, fields);
}

/**
 * The shape PostgREST returns on a failed statement.
 *
 * Structural rather than imported from the Supabase SDK: the client's error
 * type differs between the query builder, storage and auth, and all three end
 * up here. Every field is optional because a network failure produces none of
 * them.
 */
export type DbError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

/**
 * A database statement that was refused.
 *
 * `code` is the useful one — `23505` is a unique violation, `23514` a failed
 * CHECK, `42501` an RLS policy refusing the row. Those three explain almost
 * every write failure in this codebase, and they are indistinguishable from
 * each other in the message a student sees.
 */
export function logDbError(
  operation: string,
  error: DbError | null,
  fields: Record<string, unknown> = {},
): void {
  emit("error", "db.error", {
    operation,
    code: error?.code ?? undefined,
    message: error?.message ?? undefined,
    details: error?.details ?? undefined,
    hint: error?.hint ?? undefined,
    ...fields,
  });
}
