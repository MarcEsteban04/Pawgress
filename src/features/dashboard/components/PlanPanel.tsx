"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import {
  Card,
  CardActions,
  CardBody,
  CardHeader,
  CardTitle,
  Chip,
  IconButton,
  TintRow,
} from "@/components/ui";
import { PLAN } from "@/features/dashboard/sample-data";
import { cn } from "@/lib/utils";

/**
 * Today's study plan — the panel that answers "what should I do right now?".
 *
 * Every block states WHY it was chosen. A plan a student cannot interrogate is
 * an instruction to obey, and this product's whole claim is that it can show
 * its reasoning (docs/branding.md §1).
 *
 * Client Component for the day toggle and the tick-off state. Once the planner
 * is real (Sprint 65+) ticking a block becomes a Server Action; the optimistic
 * local state stays, because a checkbox that waits for a round trip feels broken.
 */
export function PlanPanel({ className }: { className?: string }) {
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries([...PLAN.today, ...PLAN.tomorrow].map((block) => [block.id, block.done])),
  );

  const blocks = PLAN[day];
  const remaining = blocks.filter((block) => !done[block.id]);
  const minutes = remaining.reduce((sum, block) => sum + block.minutes, 0);

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>Study plan</CardTitle>
        <CardActions>
          <IconButton label="Add a study block" size="sm">
            <Plus aria-hidden />
          </IconButton>
        </CardActions>
      </CardHeader>

      <CardBody className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex items-center gap-1">
          {(["today", "tomorrow"] as const).map((value) => (
            <Chip
              key={value}
              size="sm"
              selected={day === value}
              onClick={() => setDay(value)}
              className="capitalize"
            >
              {value}
            </Chip>
          ))}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="tabular font-display text-2xl font-semibold">{minutes}m</span>
          <span className="text-sm text-ink-muted">
            left across {remaining.length} {remaining.length === 1 ? "block" : "blocks"}
          </span>
        </div>

        <ul className="thin-scroll -mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1">
          {blocks.map((block) => {
            const isDone = done[block.id] ?? false;
            return (
              <li key={block.id}>
                <TintRow
                  tone={block.tone}
                  className={cn("transition-opacity", isDone && "opacity-55")}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-ink-muted">{block.subject}</p>
                      <p
                        className={cn("mt-0.5 leading-snug font-medium", isDone && "line-through")}
                      >
                        {block.topic}
                      </p>
                      <p className="mt-1.5 text-xs text-ink-muted">{block.parts}</p>
                    </div>

                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isDone}
                      aria-label={`Mark ${block.topic} as done`}
                      onClick={() => setDone((prev) => ({ ...prev, [block.id]: !isDone }))}
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                        isDone
                          ? "border-ink bg-ink text-on-ink"
                          : "border-rule-strong bg-surface text-transparent hover:border-ink",
                      )}
                    >
                      <Check className="size-3.5" aria-hidden />
                    </button>
                  </div>

                  {/* The reason, not a score. */}
                  <p className="mt-2.5 border-t border-ink/5 pt-2.5 text-xs text-ink-muted">
                    {block.because}
                  </p>
                </TintRow>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
