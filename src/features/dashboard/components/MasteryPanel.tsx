import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Card, CardActions, CardBody, CardHeader, CardTitle, Donut } from "@/components/ui";
import { HEADLINE, MASTERY_BANDS } from "@/features/dashboard/sample-data";
import { formatPercent } from "@/lib/utils";

/**
 * Where the student's topics sit across the mastery bands.
 *
 * The centre carries readiness — the one number the panel exists to deliver —
 * so the card has an answer before the legend is read.
 */
export function MasteryPanel({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Topic mastery</CardTitle>
        <CardActions>
          <Link
            href="/progress"
            aria-label="Open full progress"
            title="Open full progress"
            className="inline-flex size-8 items-center justify-center rounded-full border border-rule bg-surface text-ink-muted transition-colors hover:border-rule-strong hover:text-ink"
          >
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </CardActions>
      </CardHeader>

      <CardBody>
        <Donut
          segments={MASTERY_BANDS}
          centerValue={formatPercent(HEADLINE.readiness)}
          centerLabel="ready"
        />
      </CardBody>
    </Card>
  );
}
