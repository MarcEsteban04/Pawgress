import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toAppError } from "@/lib/errors";
import { logAiError, logAiEvent } from "@/lib/ai/log";
import { type JobStatus } from "@/types";
import { type Database } from "@/types/database";
import { chunkTextHandler } from "./handlers/chunkText";
import { embedChunksHandler } from "./handlers/embedChunks";
import { extractTextHandler } from "./handlers/extractText";
import { ocrImageHandler } from "./handlers/ocrImage";
import { MAX_JOB_ATTEMPTS, type Job, type JobHandler, type JobKind } from "./types";

/**
 * The job runner (US-D1, US-D2, NFR-R1).
 *
 * Implements the Sprint 07 decision: Postgres is the queue, workers lease work,
 * and the `jobs` table is also what the status UI reads — so what the worker
 * believes and what the student sees cannot drift apart (docs/architecture.md §5).
 *
 * **A correction to that plan, found while building it.** Sprint 07 assumed
 * every handler would process a bounded slice and re-enqueue. That is right for
 * embedding, which is many API calls, and wrong for extraction: pdf.js parses a
 * document as a unit, so there is no half of a PDF to read. Extraction is
 * therefore one pass, and the thing that makes that safe is the page cap
 * (`MAX_PAGES`) rather than slicing. The `continue` path is still here, unused
 * until Sprint 35 needs it — the machinery was not wrong, the assumption about
 * who needs it was.
 *
 * Runs under the service-role client: a worker has no session, and `jobs` is
 * select-only under RLS precisely so nothing client-side can mark its own work
 * done.
 */

const HANDLERS: Partial<Record<JobKind, JobHandler>> = {
  extract_text: extractTextHandler,
  ocr_image: ocrImageHandler,
  chunk_text: chunkTextHandler,
  embed_chunks: embedChunksHandler,
};

/**
 * What happens when a job of this kind finishes: hand on to the next stage, or
 * settle the material's status.
 *
 * The pipeline lives here and nowhere else. A handler that enqueued its own
 * successor would have to know where it sits in a sequence that is not its
 * business, and the sequence would then be spread across every handler.
 *
 * `ready` means the full pipeline is done: text extracted, split, and
 * embedded. A material with chunks but no vectors can be generated FROM —
 * generation reads `extracted_text` directly — but it cannot be SEARCHED, and
 * "ready" that means "half of ready" is the kind of half-truth that makes a
 * status display worthless.
 */
const NEXT_STAGE: Partial<Record<JobKind, { enqueue: JobKind } | { status: JobStatus }>> = {
  extract_text: { enqueue: "chunk_text" },
  ocr_image: { enqueue: "chunk_text" },
  chunk_text: { enqueue: "embed_chunks" },
  embed_chunks: { status: "ready" },
};

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

/** The claimed row, in the domain's shape. */
function toJob(row: JobRow): Job {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    subjectId: row.subject_id,
    targetId: row.target_id,
    status: row.status,
    cursor: row.slice_cursor,
    totalSlices: row.total_slices,
    attempts: row.attempts,
    failureMessage: row.failure_message,
    failureNextStep: row.failure_next_step,
    leasedUntil: row.leased_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** How long a worker may hold a claim. Mirrors the migration's default. */
const LEASE_SECONDS = 120;

export type RunSummary = {
  claimed: number;
  completed: number;
  failed: number;
  requeued: number;
};

/**
 * Claim and run a batch of jobs.
 *
 * `max` is small on purpose: one invocation should finish comfortably inside the
 * platform's function limit, and anything left over is picked up by the next
 * kick or the sweeper. A worker that tries to drain the whole queue is a worker
 * that gets killed halfway through.
 */
export async function runJobs(max = 3): Promise<RunSummary> {
  const supabase = createSupabaseAdminClient();
  const summary: RunSummary = { claimed: 0, completed: 0, failed: 0, requeued: 0 };

  const { data: claimed, error } = await supabase.rpc("claim_jobs", {
    max_jobs: max,
    lease_seconds: LEASE_SECONDS,
  });

  if (error) {
    logAiError("jobs.claim_failed", error);
    return summary;
  }

  const jobs = (claimed ?? []).map(toJob);
  summary.claimed = jobs.length;

  /* Sequential, not parallel. Each job is CPU-heavy (parsing a document) and
     two at once on one small function just makes both slower and doubles the
     peak memory. Concurrency comes from more invocations, not more threads. */
  for (const job of jobs) {
    await runOne(job, summary);
  }

  if (summary.claimed > 0) logAiEvent("jobs.batch", { ...summary });

  if (kickAgain) {
    kickAgain = false;
    const { kickWorker } = await import("./enqueue");
    kickWorker();
  }

  return summary;
}

/* Set when a slice re-enqueued itself, so the batch can kick the worker once
   at the end rather than once per job. */
let kickAgain = false;

async function runOne(job: Job, summary: RunSummary): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const handler = HANDLERS[job.kind];

  if (!handler) {
    /* An enqueued kind with no handler is a deploy problem, not a student
       problem. Left queued rather than failed: the handler may exist in the
       next deploy, and failing it would need copy that blames the student for
       something we have not built. */
    logAiEvent("jobs.no_handler", { jobId: job.id, kind: job.kind }, "warn");
    return;
  }

  await setJobStatus(job, statusWhileRunning(job.kind));

  try {
    const result = await handler(job);

    if (result.kind === "continue") {
      /* **Stall guard.** A slice that comes back asking for another turn without
         having advanced would kick the worker, get claimed again, and repeat —
         forever, and at the cost of whatever API calls it makes each time. A
         paid loop with no exit is the worst failure mode in this file, so a
         cursor that has not moved is treated as a failure rather than trusted.
         Nothing in the handlers should do this; that is exactly why it is
         checked rather than assumed. */
      if (result.cursor <= (job.cursor ?? 0) && job.cursor !== null) {
        logAiEvent("jobs.stalled", { jobId: job.id, cursor: result.cursor }, "warn");
        await failJob(
          job,
          "Indexing this material stopped making progress.",
          "Try again from the file — this one is on us.",
          false,
        );
        summary.failed += 1;
        return;
      }

      await supabase
        .from("jobs")
        .update({
          slice_cursor: result.cursor,
          total_slices: result.totalSlices ?? job.totalSlices,
          // Release the lease so the next invocation can pick it straight up.
          leased_until: null,
        })
        .eq("id", job.id);
      summary.requeued += 1;
      /* Nudge the worker again. Without this a long document advances one slice
         per sweeper tick — up to a minute per batch — and a student watches a
         progress bar crawl for no reason. */
      kickAgain = true;
      return;
    }

    if (result.kind === "failed") {
      await failJob(job, result.message, result.nextStep, result.retryable);
      summary.failed += 1;
      return;
    }

    await finishJob(job);
    summary.completed += 1;
  } catch (thrown) {
    const error = toAppError(thrown);
    logAiError("jobs.handler_threw", error, { jobId: job.id, kind: job.kind });
    await failJob(job, error.message, error.nextStep, error.retryable);
    summary.failed += 1;
  }
}

/** The status a student sees while this kind of job is running. */
function statusWhileRunning(kind: JobKind): JobStatus {
  switch (kind) {
    case "extract_text":
    case "ocr_image":
      return "extracting";
    case "chunk_text":
    case "embed_chunks":
      return "embedding";
    case "generate_reviewer":
    case "generate_quiz":
      return "generating";
  }
}

/**
 * Job status and material status move together.
 *
 * Two writes rather than one transaction, because the REST client has no
 * transaction. The order is chosen so the worse failure is the harmless one: if
 * the material update fails after the job update, a sweeper re-runs the job and
 * an idempotent handler produces the same result.
 */
async function setJobStatus(job: Job, status: JobStatus): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from("jobs").update({ status }).eq("id", job.id);
  await supabase.from("materials").update({ status }).eq("id", job.targetId);
}

async function finishJob(job: Job): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const next = NEXT_STAGE[job.kind];

  await supabase
    .from("jobs")
    .update({ status: "ready", leased_until: null, failure_message: null, failure_next_step: null })
    .eq("id", job.id);

  if (next && "enqueue" in next) {
    /* Chained by the runner rather than by the handler: a handler that enqueues
       its own successor has to know the pipeline, and the pipeline is not its
       business. */
    const { enqueueJob } = await import("./enqueue");
    await enqueueJob({
      userId: job.userId,
      kind: next.enqueue,
      subjectId: job.subjectId,
      targetId: job.targetId,
      kick: false,
    });
    return;
  }

  await supabase
    .from("materials")
    .update({
      status: next && "status" in next ? next.status : "ready",
      processed_at: new Date().toISOString(),
      failure_message: null,
      failure_next_step: null,
    })
    .eq("id", job.targetId);
}

/**
 * Fail a job, or leave it for another attempt.
 *
 * `attempts` was already incremented by `claim_jobs`, so this compares against
 * the cap directly. A retryable failure under the cap releases the lease and
 * says nothing to the student — a transient provider blip should not put a red
 * message on their library. Only a terminal failure is surfaced (US-D2).
 */
async function failJob(
  job: Job,
  message: string,
  nextStep: string,
  retryable: boolean,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const terminal = !retryable || job.attempts >= MAX_JOB_ATTEMPTS;

  if (!terminal) {
    await supabase.from("jobs").update({ leased_until: null }).eq("id", job.id);
    logAiEvent("jobs.retrying", { jobId: job.id, attempts: job.attempts }, "warn");
    return;
  }

  await supabase
    .from("jobs")
    .update({
      status: "failed",
      failure_message: message,
      failure_next_step: nextStep,
      leased_until: null,
    })
    .eq("id", job.id);

  await supabase
    .from("materials")
    .update({ status: "failed", failure_message: message, failure_next_step: nextStep })
    .eq("id", job.targetId);
}
