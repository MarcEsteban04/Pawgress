import { Card, CardBody, CardHeader, CardTitle, ScoreChart, StudyBars } from "@/components/ui";
import { type ScorePoint } from "@/server/dashboard/queries";
import { formatPercent } from "@/lib/utils";

/**
 * Two measures, two charts, one card.
 *
 * Quiz score is a percentage; study time is minutes. They do not share an axis
 * — that would be a dual-axis chart, which invents a correlation that is not in
 * the data. Side by side they can still be read together, which is the actual
 * question a student has: am I improving, and am I turning up?
 */
export function ActivityPanel({
  scores,
  studyByDay,
  minutesThisWeek,
  className,
}: {
  scores: ScorePoint[];
  studyByDay: { label: string; minutes: number }[];
  minutesThisWeek: number;
  className?: string;
}) {
  const latest = scores.at(-1)?.value ?? null;
  const first = scores[0]?.value ?? null;
  const delta = latest !== null && first !== null && scores.length > 1 ? latest - first : null;

  return (
    <Card className={className}>
      <CardHeader className="items-start">
        <div className="min-w-0">
          <CardTitle>Quiz scores</CardTitle>
          <p className="mt-1 text-sm text-ink-muted">
            {latest === null ? (
              "Across every quiz you submit"
            ) : (
              <>
                <span className="tabular font-medium text-ink">{formatPercent(latest)}</span> latest
                {delta !== null && (
                  <>
                    {" · "}
                    <span className="tabular font-medium text-ink">
                      {delta >= 0 ? "+" : ""}
                      {formatPercent(delta)}
                    </span>{" "}
                    since your first
                  </>
                )}
              </>
            )}
          </p>
        </div>
      </CardHeader>

      <CardBody className="flex flex-col gap-6">
        <ScoreChart
          data={scores}
          emptyMessage="Your score on every quiz will appear here, so you can see whether it is moving."
        />

        <div className="border-t border-rule pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[0.9375rem] font-medium">Study time</p>
            <p className="text-sm text-ink-muted">
              <span className="tabular font-medium text-ink">{minutesThisWeek}m</span> in 7 days
            </p>
          </div>
          <StudyBars days={studyByDay} className="mt-4" />
        </div>
      </CardBody>
    </Card>
  );
}
