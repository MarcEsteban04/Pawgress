"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

/**
 * Shell-level error boundary. Errors bubble to the nearest boundary, so this
 * catches anything a route below did not handle — and the sidebar and top bar
 * survive, which means the student is never stranded (docs/states.md §4).
 *
 * Expected failures — quota, validation, not-found, a failed generation — never
 * reach here. Those are `Result` values rendered in place by the page.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sprint 08 wires this to real error tracking (NFR-O2).
    console.error("Unhandled error in app shell:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4 py-10">
      <div>
        <h1 className="font-display text-2xl font-medium">Something broke on this page</h1>
        <p className="mt-2 max-w-[52ch] leading-relaxed text-ink-muted">
          Your work is safe — this is a display problem, not a data one. Try loading the page again.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-ink-subtle">Reference: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
