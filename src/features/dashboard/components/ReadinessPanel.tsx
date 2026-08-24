import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Card, CardActions, CardBody, CardHeader, CardTitle, MasteryBar } from "@/components/ui";
import { SUBJECTS } from "@/features/dashboard/sample-data";

/**
 * Readiness per subject — the wide panel across the middle of the dashboard.
 *
 * Each bar takes its SUBJECT's fixed categorical hue rather than a ramp step.
 * The bar length already encodes the number; spending hue on it as well would
 * double-encode magnitude and burn the only channel left for identity. Biology
 * is the same green here, in the planner, and in every list it appears in.
 *
 * Rows are real links, so ctrl-click opens a subject in a new tab.
 */
export function ReadinessPanel({ className }: { className?: string }) {
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
        <ul className="flex flex-col gap-4">
          {SUBJECTS.map((subject) => (
            <li key={subject.id}>
              <Link
                href={`/subjects/${subject.id}`}
                className="-mx-2 block rounded-[var(--radius-control)] px-2 py-1 transition-colors hover:bg-surface-sunken"
              >
                <MasteryBar
                  dense
                  hideEvidence
                  label={subject.name}
                  tone={subject.tone}
                  value={subject.mastery}
                  questionCount={subject.questionCount}
                />
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
