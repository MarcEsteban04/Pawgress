"use client";

import { RefreshCw, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, IconButton } from "@/components/ui";
import { buildTodayPlanAction } from "@/features/plan/server/actions";
import { cn } from "@/lib/utils";

/**
 * Build today's plan, or rebuild it (Sprint 65).
 *
 * Two faces: a labelled button in the empty panel, where "Plan my day" IS the
 * next step; and a small icon in the header once a plan exists, where
 * rebuilding is an occasional correction rather than the point of the panel.
 */
export function BuildPlanButton({ built }: { built: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function build() {
    setError(null);
    startTransition(async () => {
      const result = await buildTodayPlanAction();
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      router.refresh();
    });
  }

  if (built) {
    return (
      <IconButton
        label={
          isPending ? "Rebuilding your plan…" : "Rebuild today's plan — finished blocks are kept"
        }
        size="sm"
        onClick={build}
        disabled={isPending}
      >
        <RefreshCw aria-hidden className={cn(isPending && "motion-safe:animate-spin")} />
      </IconButton>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button variant="primary" size="sm" onClick={build} disabled={isPending}>
        <Wand2 aria-hidden />
        {isPending ? "Planning…" : "Plan my day"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
