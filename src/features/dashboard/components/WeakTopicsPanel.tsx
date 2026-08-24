import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, Avatar } from "@/components/ui";
import { WEAK_TOPICS } from "@/features/dashboard/sample-data";
import { formatPercent } from "@/lib/utils";

/**
 * The topics holding the student back, each with the specific thing they got
 * wrong and one action to fix it.
 *
 * "Genetics 42%" on its own is a scoreboard. "5 of 6 missed questions were
 * about base cases" is a lesson — so the panel leads with the mistake and the
 * percentage is the supporting detail, not the headline.
 */
export function WeakTopicsPanel({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
      </CardHeader>

      <CardBody>
        <ul className="flex flex-col gap-2.5">
          {WEAK_TOPICS.map((topic) => (
            <li key={topic.id}>
              <div className="rounded-[var(--radius-tile)] bg-surface-sunken p-3.5">
                <div className="flex items-start gap-3">
                  <Avatar name={topic.subject} tone={topic.tone} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug font-medium">{topic.topic}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {topic.subject} ·{" "}
                      <span className="tabular">{formatPercent(topic.mastery)}</span> from{" "}
                      <span className="tabular">{topic.questionCount}</span> questions
                    </p>
                  </div>
                </div>

                <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{topic.missed}</p>

                <Link
                  href={`/subjects?topic=${topic.id}`}
                  className="mt-3 inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-rule bg-surface px-3 text-sm font-medium transition-colors hover:border-rule-strong"
                >
                  Study this
                  <ChevronRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
