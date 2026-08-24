import { type JobStatus } from "@/types";

/**
 * The background job contract.
 *
 * Why this exists: extraction, chunking and embedding a 50-page PDF cannot run
 * inside a request. `after()` does not help — it still runs within the
 * platform's function duration, so it is right for logging and usage accounting
 * and wrong for this. See docs/architecture.md §5 for the full decision.
 *
 * The shape of the answer: Postgres is the queue, work is SLICED so every
 * invocation is short, and the jobs table doubles as the status the student sees
 * (FR-P4). No new vendor, and nothing to reconcile between "what the worker
 * thinks" and "what the UI shows".
 */

export type JobKind =
  | "extract_text"
  | "chunk_text"
  | "embed_chunks"
  | "ocr_image"
  | "generate_reviewer"
  | "generate_quiz";

export type Job = {
  id: string;
  userId: string;
  kind: JobKind;
  /** What the job is about — a material id, a reviewer id. */
  subjectId: string | null;
  targetId: string;
  status: JobStatus;
  /**
   * Slice cursor. A job processes a bounded slice, saves progress, and
   * re-enqueues itself. `null` means not started.
   */
  cursor: number | null;
  /** Total slices, when known — drives the progress bar. */
  totalSlices: number | null;
  attempts: number;
  /** Student-readable failure. Never a stack trace (docs/states.md §5). */
  failureMessage: string | null;
  failureNextStep: string | null;
  /** Set when a worker claims the job; a stale lease is reclaimable. */
  leasedUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

/** After this many failed attempts a job stops retrying and says so (US-D2). */
export const MAX_JOB_ATTEMPTS = 3;

/** How long a worker may hold a claim before the sweeper may reclaim it. */
export const JOB_LEASE_SECONDS = 120;

/**
 * Every job must be idempotent (NFR-R1): running it twice produces the same
 * result, never duplicate chunks, embeddings, questions or attempts. In
 * practice that means each handler writes with a deterministic key derived from
 * `(targetId, cursor)` and upserts rather than inserts.
 */
export type JobHandler = (job: Job) => Promise<JobSliceResult>;

export type JobSliceResult =
  /** More work remains; the runner re-enqueues with this cursor. */
  | { kind: "continue"; cursor: number; totalSlices?: number }
  /** Done. The runner marks the job ready and advances the material's status. */
  | { kind: "done" }
  /** Give up. Terminal, with copy the student will actually read. */
  | { kind: "failed"; message: string; nextStep: string; retryable: boolean };
