"use server";

import { requireSession } from "@/server/auth/session";
import { kickWorker } from "@/server/jobs/enqueue";

/**
 * Nudge the worker from a page that is watching something generate.
 *
 * WHY THIS EXISTS. `enqueueJob` kicks the worker once, fire-and-forget. If that
 * single kick is lost — the dev server restarting mid-flight, a network blip, a
 * function cut short — nothing invokes the worker again, and the job sits at
 * `queued` or `generating` for ever. Measured on the owner's own project: a
 * reviewer whose model call takes 3.7 SECONDS sat unfinished for 14 minutes,
 * and two indexing jobs waited 22 HOURS. None of that was slowness; it was an
 * empty queue with nobody looking at it.
 *
 * `claim_jobs` already reclaims exactly this state — it takes anything queued or
 * mid-flight whose lease is null or expired — so recovery needs no new SQL. It
 * needs someone to call the worker.
 *
 * A SERVER ACTION rather than letting the browser hit `/api/jobs/run` directly:
 * that endpoint authenticates with `JOBS_SECRET`, which must never reach the
 * client. Here the secret stays on the server and the caller is authenticated as
 * a student instead.
 *
 * **This is not the production sweeper.** `pg_cron` (architecture.md §5) is, and
 * it still needs installing — a student who closes the tab is exactly the case
 * this cannot cover. It is the recovery path for the student who is sitting
 * there waiting, which is when it matters most and when a stalled queue is most
 * visible.
 */
export async function nudgeJobsAction(): Promise<void> {
  /* Session-gated so this is not an open trigger. The work itself is safe to
     invoke repeatedly — leases are atomic and a claimed job cannot be claimed
     twice — so the worst a caller achieves is doing their own queued work
     sooner. */
  await requireSession();
  kickWorker();
}
