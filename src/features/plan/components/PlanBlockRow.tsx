"use client";

import { ArrowRight, BookOpen, Layers, ListChecks, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TintRow } from "@/components/ui";
import { launchPlanBlockAction } from "@/features/plan/server/launch";
import { type PlanBlock } from "@/server/dashboard/queries";
import { cn } from "@/lib/utils";

/**
 * One block of today's plan, and the door to it (FR-L2, Sprint 66).
 *
 * **The whole row is the button.** A plan block is a thing to DO; making the
 * student hunt for a small "Start" inside it would be asking them to read the
 * plan twice. The arrow is there to say the row goes somewhere, not as a
 * separate target.
 *
 * **What it opens is decided on the server, on the click** — see
 * `launchPlanBlockAction`. The wait can include writing a quiz or starting a
 * reviewer, so the row says so rather than looking frozen.
 */

const ACTIVITY: Record<string, { label: string; Icon: typeof BookOpen; wait: string }> = {
  review: { label: "Review", Icon: BookOpen, wait: "Opening your reviewer…" },
  practice: { label: "Practice questions", Icon: ListChecks, wait: "Opening practice…" },
  flashcards: { label: "Flashcards", Icon: Layers, wait: "Opening flashcards…" },
  quiz: { label: "Quiz", Icon: Timer, wait: "Writing your quiz…" },
};

export function PlanBlockRow({ block }: { block: PlanBlock }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activity = ACTIVITY[block.activity] ?? {
    label: block.activity,
    Icon: BookOpen,
    wait: "Opening…",
  };

  function open() {
    setError(null);
    startTransition(async () => {
      const result = await launchPlanBlockAction(block.id);
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      router.push(result.href);
    });
  }

  return (
    <TintRow
      tone={block.colorSlot}
      className={cn("p-0 transition-opacity", block.done && "opacity-55")}
    >
      <button
        type="button"
        onClick={open}
        disabled={isPending}
        aria-label={`${activity.label}: ${block.topic ?? block.subject ?? ""}, ${block.minutes} minutes`}
        className={cn(
          "group block w-full rounded-[var(--radius-tile)] p-3.5 text-left transition-shadow",
          "hover:shadow-[inset_0_0_0_1px_var(--color-rule-strong)] disabled:cursor-progress",
        )}
      >
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-ink-muted">{block.subject}</span>
            <span
              className={cn("mt-0.5 block leading-snug font-medium", block.done && "line-through")}
            >
              {/* The topic, or "Whole subject" — never the activity name, which
                  has its own line below and read as a title of "practice". */}
              {block.topic ?? "Whole subject"}
            </span>
          </span>
          <ArrowRight
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
          />
        </span>

        <span className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
          <activity.Icon className="size-3.5" aria-hidden />
          {isPending ? (
            activity.wait
          ) : (
            <>
              <span className="tabular-nums">{block.minutes} min</span>
              <span aria-hidden>·</span>
              {activity.label}
            </>
          )}
        </span>

        {block.reason && (
          <span className="mt-2.5 block border-t border-ink/5 pt-2.5 text-xs text-ink-muted">
            {block.reason}
          </span>
        )}
      </button>

      {error && (
        <p role="alert" className="px-3.5 pb-3 text-xs text-bad">
          {error}
        </p>
      )}
    </TintRow>
  );
}
