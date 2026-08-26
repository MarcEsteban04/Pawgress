import "server-only";

import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAiError, logAiEvent } from "@/lib/ai/log";
import { publicEnv } from "@/config/env";
import { type JobKind } from "./types";

/**
 * Putting work on the queue (US-D1).
 *
 * Two halves, and both matter:
 *
 *  1. **The row is the queue.** An upsert on `(kind, target_id)` — the unique
 *     constraint from the Sprint 31 migration — so enqueueing the same work
 *     twice is one job, not a race between two workers. A retry is the same
 *     upsert, which is why "retry" needs no separate code path.
 *  2. **The kick starts it now.** Waiting for a schedule would mean a student
 *     uploading a file watches "Waiting to start" for up to a minute for no
 *     reason. The kick is fire-and-forget through `after()`, which is the one
 *     job `after()` is genuinely right for — it runs after the response and
 *     within the same function's budget, so it must only TRIGGER work, never do
 *     it (docs/architecture.md §5).
 *
 * The kick is best-effort by design. If it fails, the row is still queued and
 * the sweeper picks it up; correctness lives in the table, not in the trigger.
 */

export type EnqueueInput = {
  userId: string;
  kind: JobKind;
  subjectId: string | null;
  targetId: string;
  /** Set false when the runner chains one stage to the next — it is already running. */
  kick?: boolean;
};

export async function enqueueJob(input: EnqueueInput): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("jobs").upsert(
    {
      user_id: input.userId,
      kind: input.kind,
      subject_id: input.subjectId,
      target_id: input.targetId,
      status: "queued",
      slice_cursor: null,
      /* Reset on re-enqueue: a student pressing retry is asking for a fresh
         set of attempts, not for the one remaining attempt from last time. */
      attempts: 0,
      failure_message: null,
      failure_next_step: null,
      leased_until: null,
    },
    { onConflict: "kind,target_id" },
  );

  if (error) {
    logAiError("jobs.enqueue_failed", error, { kind: input.kind, targetId: input.targetId });
    return;
  }

  logAiEvent("jobs.enqueued", { kind: input.kind, targetId: input.targetId });

  if (input.kick !== false) kickWorker();
}

/**
 * Nudge the worker to start now.
 *
 * Deliberately not awaited inside the request: the caller is a Server Action
 * returning to a student who should not wait on a document being parsed.
 */
function kickWorker(): void {
  const secret = process.env.JOBS_SECRET;
  if (!secret) {
    /* Without the secret the worker refuses the call, so there is no point
       making it. The queue still drains via the sweeper. Warned, because a
       production deploy missing this is a slow pipeline nobody notices. */
    logAiEvent("jobs.kick_skipped", { reason: "JOBS_SECRET not set" }, "warn");
    return;
  }

  after(async () => {
    try {
      await fetch(`${publicEnv.appUrl}/api/jobs/run`, {
        method: "POST",
        headers: { "x-jobs-secret": secret },
        // Never let a slow worker hold the invocation open.
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      /* Expected sometimes: the worker may already be busy, or the invocation
         may end first. The job is queued either way, which is the whole reason
         the kick is allowed to be unreliable. */
    }
  });
}
