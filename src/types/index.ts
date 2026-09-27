/**
 * Shared application types.
 *
 * Database row types are generated from Supabase in Sprint 13 and will live in
 * `src/types/database.ts`; hand-written domain types belong here.
 */

/** A discriminated result type for operations that can fail expectedly. */
export type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

/**
 * The one status vocabulary for every long-running job — uploads, extraction,
 * embedding, and generation. Defined once so the label a student learns in the
 * material library is the same one they see on a reviewer (docs/states.md §3).
 */
export type JobStatus =
  | "queued"
  | "uploading"
  | "extracting"
  | "embedding"
  | "generating"
  | "ready"
  | "failed"
  | "cancelled"
  | "over_quota";

/** Statuses that will not change on their own. */
export const TERMINAL_JOB_STATUSES = [
  "ready",
  "failed",
  "cancelled",
  "over_quota",
] as const satisfies readonly JobStatus[];

/**
 * What kind of thing a material is (FR-U1, FR-U5).
 *
 * Mirrors the `material_kind` enum. Every image collapses to `image` because
 * that is the distinction the product makes downstream: documents are parsed,
 * images are OCR'd. Whether a photo arrived as JPEG or PNG changes nothing
 * after upload, so recording it would be a column nobody reads.
 */
export type MaterialKind = "pdf" | "pptx" | "docx" | "image" | "note";

export function isTerminalStatus(status: JobStatus): boolean {
  return (TERMINAL_JOB_STATUSES as readonly JobStatus[]).includes(status);
}

/**
 * The mastery thresholds, re-exported from the formula that uses them
 * (Sprint 56). Defined there so the engine and the UI read one number, and so
 * the formula stays import-free and testable straight from TypeScript.
 */
export { LOW_EVIDENCE_QUESTIONS, WEAK_TOPIC_THRESHOLD } from "@/features/mastery/formula";
