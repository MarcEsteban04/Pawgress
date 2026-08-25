import { CalendarDays } from "lucide-react";
import {
  Card,
  CardActions,
  CardBody,
  CardHeader,
  CardTitle,
  IconButton,
  Tag,
} from "@/components/ui";
import { PanelEmpty } from "./PanelEmpty";
import { type UpcomingItem } from "@/server/dashboard/queries";
import { cn } from "@/lib/utils";

const DOT = {
  1: "bg-cat-1",
  2: "bg-cat-2",
  3: "bg-cat-3",
  4: "bg-cat-4",
  5: "bg-cat-5",
} as const;

/** "Today" reads as a deadline; "In 4 days" reads as time you still have. */
function countdown(inDays: number): string {
  if (inDays <= 0) return "Today";
  if (inDays === 1) return "Tomorrow";
  return `In ${inDays} days`;
}

export function UpcomingPanel({ items, className }: { items: UpcomingItem[]; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Upcoming</CardTitle>
        <CardActions>
          <IconButton label="Open planner" size="sm" disabled>
            <CalendarDays aria-hidden />
          </IconButton>
        </CardActions>
      </CardHeader>

      <CardBody>
        {items.length === 0 ? (
          <PanelEmpty
            Icon={CalendarDays}
            title="Nothing scheduled"
            description="Exams, quizzes and deadlines you add show up here, soonest first, with how ready you are for each."
            awaiting="The planner arrives later in the roadmap."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {items.map((item) => (
              <li key={item.id} className="rounded-[var(--radius-tile)] bg-surface-sunken p-3.5">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn("size-2 shrink-0 rounded-full", DOT[item.colorSlot])}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-muted">
                    {item.subject ?? "No subject"}
                  </span>
                  <Tag className="bg-surface capitalize">{item.kind.replace("_", " ")}</Tag>
                </div>
                <p className="mt-2 leading-snug font-medium">{item.title}</p>
                <p className="tabular mt-2 text-sm font-medium">{countdown(item.inDays)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
