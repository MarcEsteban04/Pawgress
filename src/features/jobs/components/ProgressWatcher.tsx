"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { nudgeJobsAction } from "@/features/jobs/server/actions";

/**
 * Watches work that is in progress: nudges the queue, then refreshes the page.
 *
 * TWO PROBLEMS, ONE COMPONENT, and they were being mistaken for each other.
 *
 *  1. **The queue stops draining.** `enqueueJob` kicks the worker once. Lose
 *     that kick — a dev server restarting mid-flight is enough — and nothing
 *     invokes it again. Measured on the owner's project: a reviewer whose model
 *     call takes 3.7 SECONDS sat unfinished for 14 minutes; two indexing jobs
 *     waited 22 HOURS. `claim_jobs` reclaims that state already; it just needed
 *     calling.
 *  2. **Nothing refreshed.** No page in the app polled, so even after a job
 *     finished the student saw "generating" until they reloaded by hand. Half
 *     of "it takes too long" was work that had already finished.
 *
 * Renders nothing. Mounted with `active` true only while something is actually
 * in progress, so an idle page costs nothing at all.
 *
 * IT STOPS. `MAX_TICKS` bounds it, because a job can be genuinely stuck — the
 * runner gives up after `MAX_JOB_ATTEMPTS` — and a page that nudges a dead
 * queue every few seconds for ever is a tab that quietly burns battery and
 * database round trips. Roughly three minutes of watching, which is far longer
 * than any of these jobs takes when the queue is moving; past that the honest
 * answer is that something is wrong, not that one more poll will fix it.
 */

const INTERVAL_MS = 4000;
const MAX_TICKS = 45;

export function ProgressWatcher({ active }: { active: boolean }) {
  const router = useRouter();
  /* A ref, not state: this counter must not itself cause a render, and the
     effect below already re-runs on the only thing that matters (`active`). */
  const ticks = useRef(0);

  useEffect(() => {
    if (!active) {
      ticks.current = 0;
      return;
    }

    let cancelled = false;

    const timer = setInterval(() => {
      if (cancelled) return;

      if (ticks.current >= MAX_TICKS) {
        clearInterval(timer);
        return;
      }
      ticks.current += 1;

      /* Nudge first, then refresh — in that order, so the refresh renders
         whatever the nudge just finished rather than the state before it.
         Failures are swallowed on purpose: this is a best-effort recovery
         path, and an error toast for "the optional nudge did not land" would
         be noise about something the student did not ask for. */
      void nudgeJobsAction()
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) router.refresh();
        });
    }, INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active, router]);

  return null;
}
