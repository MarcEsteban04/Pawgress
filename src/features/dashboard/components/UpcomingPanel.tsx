import { AlertTriangle, CalendarDays } from "lucide-react";
import Link from "next/link";
import { Card, CardActions, CardBody, CardHeader, CardTitle, Tag } from "@/components/ui";
import { countdownText } from "@/features/planner/components/DeadlineRow";
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

/**
 * The countdown wording is `countdownText`, shared with the planner's deadline
 * list (Sprint 62).
 *
 * This panel had its own copy, and the copy collapsed everything at or before
 * today into "Today" — which was almost defensible while the query could not
 * return an overdue item, and became a lie the moment it could. Two
 * definitions of "how long have I got" is one more than a product gets to
 * have.
 */

export function UpcomingPanel({ items, className }: { items: UpcomingItem[]; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Upcoming</CardTitle>
        <CardActions>
          {/* A real link since Sprint 61. It was a disabled icon for six
              sprints because there was nowhere to go; leaving it disabled once
              there is would be the panel lying about its own feature. */}
          <Link
            href="/planner"
            aria-label="Open planner"
            title="Open planner"
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-full",
              "border border-rule bg-surface text-ink-muted",
              "transition-colors hover:border-rule-strong hover:text-ink",
            )}
          >
            <CalendarDays className="size-3.5" aria-hidden />
          </Link>
        </CardActions>
      </CardHeader>

      <CardBody>
        {items.length === 0 ? (
          <PanelEmpty
            Icon={CalendarDays}
            title="Nothing scheduled"
            description="Exams, quizzes and deadlines you add show up here, soonest first, with how ready you are for each."
            action={{ href: "/planner", label: "Open the planner" }}
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

                {/* Overdue named in words and marked with a glyph, not left to
                    the colour of the countdown — US-I2 asks for "more than
                    colour", and so does WCAG 1.4.1. */}
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p
                    className={cn(
                      "tabular text-sm font-medium",
                      item.band === "overdue" && "text-bad",
                      item.band === "critical" && "text-warn",
                    )}
                  >
                    {countdownText(item.inDays)}
                  </p>
                  {item.band === "overdue" && (
                    <span className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold tracking-wide text-bad uppercase">
                      <AlertTriangle className="size-3" aria-hidden />
                      Overdue
                    </span>
                  )}
                </div>

                {/* The one thing a calendar could not tell them. */}
                {item.reason && <p className="mt-1 text-xs text-ink-muted">{item.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
