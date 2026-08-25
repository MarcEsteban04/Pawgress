"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

/**
 * Error boundary for the subject routes.
 *
 * The shell already has one at `(app)/error.tsx`, so this exists for the
 * message rather than the mechanism: a student whose subject list failed needs
 * to know their subjects still exist, which a generic "something broke" does
 * not tell them. Errors stop at the NEAREST boundary, so this catches the list
 * and the subject hub before the shell-level one sees them, and the sidebar and
 * top bar survive either way.
 *
 * Individual panels inside the hub have their own `PanelBoundary` and never
 * reach here — this is for a failure in the page itself.
 */
export default function SubjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sprint 77 (production release) wires this to real error tracking (NFR-O2).
    console.error("Subjects route failed:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4 py-10">
      <div>
        <h1 className="font-display text-2xl font-medium">We could not load your subjects</h1>
        <p className="mt-2 max-w-[52ch] leading-relaxed text-ink-muted">
          Nothing has been deleted — your subjects, files and topics are all still there. This is a
          problem reading them, not a problem with them.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-ink-subtle">Reference: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
