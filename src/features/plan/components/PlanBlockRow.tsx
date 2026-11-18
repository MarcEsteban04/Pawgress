"use client";

import { ArrowRight, BookOpen, Check, Layers, ListChecks, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { TintRow } from "@/components/ui";
import { setPlanBlockDoneAction } from "@/features/plan/server/actions";
import { launchPlanBlockAction } from "@/features/plan/server/launch";
import { type PlanBlock } from "@/server/dashboard/queries";
import { cn } from "@/lib/utils";

/**
 * One block of today's plan, the door to it, and the box to tick
 * (FR-L2, FR-L3, Sprints 66–67).
 *
 * **Two targets, side by side, never nested.** The row opens the activity;
 * the box beside it ticks the block off. A checkbox inside a button is
 * invalid HTML and, worse, a press that does two things depending on exactly
 * where the thumb landed.
 *
 * **The tick is optimistic.** It is the most frequent thing anyone does to a
 * plan, and waiting a round trip to see a tick appear makes it feel broken.
 * If the write fails, the box goes back and says why.
 *
 * **"Up next" is the one accent on the dashboard.** The blue is reserved for
 * the thing to press (docs/branding.md), and on this screen the next block is
 * exactly that.
 *
 * Practice, flashcards and quizzes tick themselves when they are finished
 * (`tickPlanBlock`); review has no "finished" the product can see, so its box
 * is the way. Any box can be ticked, though — the student knows what they did.
 */

const ACTIVITY: Record<string, { label: string; Icon: typeof BookOpen; wait: string }> = {
  review: { label: "Review", Icon: BookOpen, wait: "Opening your reviewer…" },
  practice: { label: "Practice questions", Icon: ListChecks, wait: "Opening practice…" },
  flashcards: { label: "Flashcards", Icon: Layers, wait: "Opening flashcards…" },
  quiz: { label: "Quiz", Icon: Timer, wait: "Writing your quiz…" },
};

export function PlanBlockRow({ block, next }: { block: PlanBlock; next: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [opening, startOpening] = useTransition();
  const [, startTicking] = useTransition();
  const [done, setOptimisticDone] = useOptimistic(block.done);

  const activity = ACTIVITY[block.activity] ?? {
    label: block.activity,
    Icon: BookOpen,
    wait: "Opening…",
  };
  const name = block.topic ?? block.subject ?? "this block";

  function open() {
    setError(null);
    startOpening(async () => {
      const result = await launchPlanBlockAction(block.id);
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      router.push(result.href);
    });
  }

  function toggle() {
    setError(null);
    const target = !done;
    startTicking(async () => {
      setOptimisticDone(target);
      const result = await setPlanBlockDoneAction(block.id, target);
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <TintRow
      tone={block.colorSlot}
      className={cn(
        "p-0 transition-opacity",
        done && "opacity-55",
        next && "shadow-[inset_0_0_0_2px_var(--color-accent)]",
      )}
    >
      <div className="flex items-start">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={done}
          aria-label={done ? `Mark ${name} not done` : `Mark ${name} done`}
          className="flex shrink-0 items-start py-3.5 pr-1 pl-3.5"
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-[0.375rem] border transition-colors",
              done
                ? "border-ok bg-ok text-on-ink"
                : "border-rule-strong bg-surface hover:border-ink",
            )}
          >
            {done && <Check className="size-3.5" aria-hidden />}
          </span>
        </button>

        <button
          type="button"
          onClick={open}
          disabled={opening}
          aria-label={`${activity.label}: ${name}, ${block.minutes} minutes`}
          className={cn(
            "group block min-w-0 flex-1 rounded-[var(--radius-tile)] py-3.5 pr-3.5 pl-2 text-left",
            "disabled:cursor-progress",
          )}
        >
          <span className="flex items-start gap-2">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs font-medium text-ink-muted">
                <span className="truncate">{block.subject}</span>
                {next && (
                  <span className="shrink-0 rounded-[var(--radius-pill)] bg-accent px-1.5 py-px text-[0.625rem] font-semibold tracking-wide text-on-accent uppercase">
                    Up next
                  </span>
                )}
              </span>
              <span className={cn("mt-0.5 block leading-snug font-medium", done && "line-through")}>
                {/* The topic, or "Whole subject" — never the activity name,
                    which has its own line below. */}
                {block.topic ?? "Whole subject"}
              </span>
            </span>
            <ArrowRight
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
                next ? "text-accent" : "text-ink-subtle group-hover:text-ink",
              )}
            />
          </span>

          <span className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <activity.Icon className="size-3.5" aria-hidden />
            {opening ? (
              activity.wait
            ) : (
              <>
                <span className="tabular-nums">{block.minutes} min</span>
                <span aria-hidden>·</span>
                {activity.label}
              </>
            )}
          </span>

          {block.reason && !done && (
            <span className="mt-2.5 block border-t border-ink/5 pt-2.5 text-xs text-ink-muted">
              {block.reason}
            </span>
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="px-3.5 pb-3 text-xs text-bad">
          {error}
        </p>
      )}
    </TintRow>
  );
}
