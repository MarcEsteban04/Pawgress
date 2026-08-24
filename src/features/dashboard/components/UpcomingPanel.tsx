import { CalendarDays } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardActions,
  CardBody,
  CardHeader,
  CardTitle,
  IconButton,
  Tag,
} from "@/components/ui";
import { UPCOMING } from "@/features/dashboard/sample-data";
import { LOW_EVIDENCE_QUESTIONS } from "@/types";
import { cn, formatPercent } from "@/lib/utils";

const DOT_TONE = {
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

/**
 * What is coming, and whether the student is ready for it.
 *
 * Readiness is shown as a plain number or withheld entirely — never guessed.
 * `null` means the app has not seen enough answers to say, and it says exactly
 * that rather than printing a confident-looking figure (US-H1).
 */
export function UpcomingPanel({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Upcoming</CardTitle>
        <CardActions>
          <IconButton label="Open planner" size="sm">
            <CalendarDays aria-hidden />
          </IconButton>
        </CardActions>
      </CardHeader>

      <CardBody>
        <ul className="flex flex-col gap-2.5">
          {UPCOMING.map((item) => (
            <li key={item.id}>
              <Link
                href="/planner"
                className="block rounded-[var(--radius-tile)] bg-surface-sunken p-3.5 transition-colors hover:bg-rule"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn("size-2 shrink-0 rounded-full", DOT_TONE[item.tone])}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-muted">
                    {item.subject}
                  </span>
                  <Tag className="bg-surface">{item.kind}</Tag>
                </div>

                <p className="mt-2 leading-snug font-medium">{item.title}</p>

                <div className="mt-2 flex items-baseline gap-2">
                  <span className="tabular text-sm font-medium">{countdown(item.inDays)}</span>
                  <span className="ml-auto text-xs text-ink-muted">
                    {item.readiness === null ? (
                      `Under ${LOW_EVIDENCE_QUESTIONS} answers — no reading yet`
                    ) : (
                      <>
                        <span className="tabular font-medium text-ink">
                          {formatPercent(item.readiness)}
                        </span>{" "}
                        ready
                      </>
                    )}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
