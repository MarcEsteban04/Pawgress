import { CalendarCheck, Plus } from "lucide-react";
import {
  Card,
  CardActions,
  CardBody,
  CardHeader,
  CardTitle,
  IconButton,
  TintRow,
} from "@/components/ui";
import { PanelEmpty } from "./PanelEmpty";
import { type PlanBlock } from "@/server/dashboard/queries";
import { cn } from "@/lib/utils";

/**
 * Today's study plan — the panel that answers "what should I do right now?".
 *
 * Every block states WHY it was chosen. A plan a student cannot interrogate is
 * an instruction to obey, and this product's claim is that it shows its
 * reasoning (docs/branding.md §1).
 *
 * A Server Component now. The day/tick-off state went with the sample data:
 * ticking a block off has to write to `study_plan_items.completed_at`, and the
 * planner that creates those rows is Sprint 65. Local-only state that forgets
 * on reload would be worse than not offering it.
 */
export function PlanPanel({
  blocks,
  minutesRemaining,
  hasSubjects,
  className,
}: {
  blocks: PlanBlock[];
  minutesRemaining: number;
  hasSubjects: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>Study plan</CardTitle>
        <CardActions>
          <IconButton label="Add a study block" size="sm" disabled>
            <Plus aria-hidden />
          </IconButton>
        </CardActions>
      </CardHeader>

      <CardBody className="flex min-h-0 flex-1 flex-col gap-4">
        {blocks.length === 0 ? (
          <PanelEmpty
            Icon={CalendarCheck}
            title="No plan for today"
            description={
              hasSubjects
                ? "Acadify builds a plan from your upcoming exams, weak topics and quiz results."
                : "Create a subject and upload something — a plan needs material to work from."
            }
            action={hasSubjects ? undefined : { href: "/subjects", label: "Create a subject" }}
            awaiting={hasSubjects ? "Daily plans arrive with the planner." : undefined}
          />
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="tabular font-display text-2xl font-semibold">
                {minutesRemaining}m
              </span>
              <span className="text-sm text-ink-muted">
                left across {blocks.filter((b) => !b.done).length} blocks
              </span>
            </div>

            <ul className="thin-scroll -mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1">
              {blocks.map((block) => (
                <li key={block.id}>
                  <TintRow
                    tone={block.colorSlot}
                    className={cn("transition-opacity", block.done && "opacity-55")}
                  >
                    <p className="text-xs font-medium text-ink-muted">{block.subject}</p>
                    <p
                      className={cn(
                        "mt-0.5 leading-snug font-medium",
                        block.done && "line-through",
                      )}
                    >
                      {block.topic ?? block.activity}
                    </p>
                    <p className="mt-1.5 text-xs text-ink-muted">
                      {block.minutes}m {block.activity}
                    </p>
                    {block.reason && (
                      <p className="mt-2.5 border-t border-ink/5 pt-2.5 text-xs text-ink-muted">
                        {block.reason}
                      </p>
                    )}
                  </TintRow>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}
