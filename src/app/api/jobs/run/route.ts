import { NextResponse, type NextRequest } from "next/server";
import { runJobs } from "@/server/jobs/runner";

/**
 * The worker endpoint.
 *
 * Called two ways, and it does not care which: fire-and-forget by `enqueueJob`
 * right after work is queued, and on a schedule as the sweeper that reclaims
 * expired leases and picks up anything the kick missed.
 *
 * **The scheduler is Supabase `pg_cron`, not Vercel Cron** — the open question
 * from architecture.md §8, decided here. Vercel's free tier allows only daily
 * crons, and a document that takes up to 24 hours to start processing is not a
 * pipeline. `pg_cron` runs every minute on Supabase's free tier and the queue
 * already lives in that database, so the scheduler sits next to the thing it is
 * scheduling. The SQL to install it is in docs/architecture.md §5.
 *
 * Auth is a shared secret, not a session: there is no user here. It fails closed
 * — no `JOBS_SECRET` configured means every call is refused, because an open
 * worker endpoint lets anyone drain another student's queue and spend their
 * quota.
 */

/** A worker invocation is short by design; this is a ceiling, not a target. */
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const expected = process.env.JOBS_SECRET;
  if (!expected || expected.length < 16) return false;

  const provided = request.headers.get("x-jobs-secret");
  if (!provided || provided.length !== expected.length) return false;

  /* Constant-time compare. The timing signal on a short string is small, but
     this is a bearer secret on a public endpoint and a length-independent
     comparison costs nothing. */
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    // No detail: a 401 that explains itself tells a prober what to fix.
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const summary = await runJobs();
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "no-store" },
  });
}
