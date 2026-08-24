/**
 * Shared application types.
 *
 * Database row types are generated from Supabase in Sprint 13 and will live in
 * `src/types/database.ts`; hand-written domain types belong here.
 */

/** A discriminated result type for operations that can fail expectedly. */
export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

export {};
