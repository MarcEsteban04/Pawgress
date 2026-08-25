import { ChevronRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Avatar, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { PanelEmpty } from "./PanelEmpty";
import { type WeakTopic } from "@/server/dashboard/queries";
import { formatPercent } from "@/lib/utils";

/**
 * The topics holding a student back.
 *
 * Only topics with enough answered questions appear — a 20% from three
 * questions is noise, and putting it at the top of "needs attention" would
 * send someone to study the wrong thing (US-H1).
 */
export function WeakTopicsPanel({
  topics,
  className,
}: {
  topics: WeakTopic[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
      </CardHeader>

      <CardBody>
        {topics.length === 0 ? (
          <PanelEmpty
            Icon={TrendingUp}
            title="Nothing flagged"
            description="Once you have answered enough questions on a topic, the weakest ones are listed here with what you got wrong."
            awaiting="Needs at least 10 answers on a topic."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {topics.map((topic) => (
              <li key={topic.id} className="rounded-[var(--radius-tile)] bg-surface-sunken p-3.5">
                <div className="flex items-start gap-3">
                  <Avatar name={topic.subject} tone={topic.colorSlot} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug font-medium">{topic.topic}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {topic.subject} ·{" "}
                      <span className="tabular">{formatPercent(topic.mastery)}</span> from{" "}
                      <span className="tabular">{topic.questionsAnswered}</span> questions
                    </p>
                  </div>
                </div>
                <Link
                  href="/subjects"
                  className="mt-3 inline-flex h-8 items-center gap-1 rounded-[var(--radius-pill)] border border-rule bg-surface px-3 text-sm font-medium transition-colors hover:border-rule-strong"
                >
                  Study this
                  <ChevronRight className="size-3.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
