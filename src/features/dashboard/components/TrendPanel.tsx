import { Card, CardBody, CardHeader, CardTitle, TrendChart } from "@/components/ui";
import { TREND, TREND_RANGES, type TrendRange } from "@/features/dashboard/sample-data";
import { formatPercent } from "@/lib/utils";

/**
 * Mastery and quiz score over time.
 *
 * Two series share one axis only because both are percentages. Study minutes
 * belong on their own card, not on a second y-scale here — see the note in
 * TrendChart.
 */
export function TrendPanel({ range, className }: { range: TrendRange; className?: string }) {
  const data = TREND[range];
  const first = data[0]!;
  const last = data[data.length - 1]!;
  const delta = last.a - first.a;
  const rangeLabel = TREND_RANGES.find((r) => r.value === range)?.label.toLowerCase() ?? "";

  return (
    <Card className={className}>
      <CardHeader className="items-start">
        <div className="min-w-0">
          <CardTitle>Mastery over time</CardTitle>
          <p className="mt-1 text-sm text-ink-muted">
            <span className="tabular font-medium text-ink">
              {delta >= 0 ? "+" : ""}
              {formatPercent(delta)}
            </span>{" "}
            {rangeLabel}
          </p>
        </div>
      </CardHeader>

      <CardBody>
        <TrendChart
          data={data}
          seriesA={{ name: "Mastery", color: "var(--cat-3)" }}
          seriesB={{ name: "Quiz score", color: "var(--cat-5)" }}
        />
      </CardBody>
    </Card>
  );
}
