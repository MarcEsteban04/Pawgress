import { ArrowUpRight, Layers } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardActions,
  CardBody,
  CardHeader,
  CardTitle,
  MasteryBar,
  Tag,
} from "@/components/ui";
import { ReadinessBreakdown } from "@/features/readiness/components/ReadinessBreakdown";
import { PanelEmpty } from "./PanelEmpty";
import { type DashboardSubject } from "@/server/dashboard/queries";
import { type SubjectReadiness } from "@/server/readiness/queries";

/**
 * Readiness per subject, and why (FR-D2, Sprint 71).
 *
 * Each bar takes its SUBJECT's own colour, chosen when the subject was created,
 * rather than a mastery ramp step — bar length already encodes the number, and
 * spending hue on it too would burn the only channel left for identity.
 *
 * **The inputs are one press away, on every row.** US-J3: "readiness shows the
 * inputs behind the number". The disclosure sits BESIDE the link to the
 * subject, not inside it — a control inside a link is two targets in one, and
 * whichever the thumb lands on is a guess.
 *
 * A subject with no score shows its counts instead of a bar. A bar at 0% would
 * be indistinguishable from a subject genuinely scoring zero.
 */
export function ReadinessPanel({
  subjects,
  readiness,
  className,
}: {
  subjects: DashboardSubject[];
  readiness: Map<string, SubjectReadiness>;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Readiness by subject</CardTitle>
        <CardActions>
          <Link
            href="/subjects"
            aria-label="Open all subjects"
            title="Open all subjects"
            className="inline-flex size-8 items-center justify-center rounded-full border border-rule bg-surface text-ink-muted transition-colors hover:border-rule-strong hover:text-ink"
          >
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </CardActions>
      </CardHeader>

      <CardBody>
        {subjects.length === 0 ? (
          <PanelEmpty
            Icon={Layers}
            title="No subjects yet"
            description="A subject is one class. Everything you upload lives inside one, so it is the first thing to make."
            action={{ href: "/subjects", label: "Create a subject" }}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {subjects.map((subject) => {
              const data = readiness.get(subject.id);
              const score = data?.readiness?.score ?? null;

              return (
                <li key={subject.id} className="flex flex-col gap-1">
                  <Link
                    href={`/subjects/${subject.id}`}
                    className="-mx-2 block rounded-[var(--radius-control)] px-2 py-1 transition-colors hover:bg-surface-sunken"
                  >
                    {score === null ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-[0.9375rem]">{subject.name}</span>
                        <span className="flex shrink-0 gap-1.5">
                          <Tag>{subject.materialCount} files</Tag>
                          <Tag>{subject.topicCount} topics</Tag>
                        </span>
                      </div>
                    ) : (
                      <MasteryBar
                        dense
                        hideEvidence
                        label={subject.name}
                        tone={subject.colorSlot}
                        value={score}
                        questionCount={data?.inputs.answered ?? 0}
                      />
                    )}
                  </Link>

                  {data && (
                    <details className="group px-0">
                      <summary className="w-fit cursor-pointer text-xs text-ink-subtle hover:text-ink">
                        {score === null ? "Why no score yet?" : `Why ${Math.round(score * 100)}%?`}
                      </summary>
                      <ReadinessBreakdown data={data} className="mt-2 pl-0.5" />
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
