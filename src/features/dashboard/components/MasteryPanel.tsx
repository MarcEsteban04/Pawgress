import { ArrowUpRight, Target } from "lucide-react";
import Link from "next/link";
import { Card, CardActions, CardBody, CardHeader, CardTitle, Donut } from "@/components/ui";
import { PanelEmpty } from "./PanelEmpty";
import { type MasteryBand } from "@/server/dashboard/queries";
import { formatPercent } from "@/lib/utils";

/**
 * Where a student's topics sit across the mastery bands.
 *
 * The centre shows readiness, or a dash. `null` readiness means nothing has
 * enough answers behind it to be honest about — and a dash is the right answer
 * there. Rendering 0% would say "you know nothing" when the truth is "nothing
 * has been measured", which is the same mistake MasteryBar exists to prevent.
 */
export function MasteryPanel({
  bands,
  readiness,
  topicsTracked,
  className,
}: {
  bands: MasteryBand[];
  readiness: number | null;
  topicsTracked: number;
  className?: string;
}) {
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
        {topicsTracked === 0 ? (
          <PanelEmpty
            Icon={Target}
            title="Nothing measured yet"
            description="Mastery is worked out from the questions you answer, so it fills in once you have taken a quiz."
            awaiting="Quizzes arrive later in the roadmap."
          />
        ) : (
          <Donut
            segments={bands.filter((band) => band.value > 0)}
            centerValue={readiness === null ? "—" : formatPercent(readiness)}
            centerLabel={readiness === null ? "not enough data" : "ready"}
          />
        )}
      </CardBody>
    </Card>
  );
}
