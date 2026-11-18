import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { buttonStyles, Card, CardBody } from "@/components/ui";
import { longDayLabel } from "@/features/planner/dates";
import { type ActivityRate, type DayBar } from "@/features/plan/analytics";
import { type PlanAnalyticsView } from "@/server/plan/analytics";
import { cn } from "@/lib/utils";

/**
 * How the plans have gone — the Progress page's plan section (FR-L5, Sprint 69).
 *
 * **One hue, two steps.** Done minutes are the study-time green (`cat-4`), the
 * minutes planned but not done are a lighter step of the same ramp
 * (`cat-4-track`). The pair was run through the palette validator in both
 * modes: it passes separation for every kind of colour vision; the lighter
 * step sits under 3:1 against the surface, which the validator accepts only
 * with relief — so every figure is also in the table view, and in each bar's
 * hover and accessible name.
 *
 * **Stacked, not overlapped.** Done sits on the baseline, the rest of the plan
 * above it, a 2px gap between: the bar's whole height is the plan, and how
 * much of it is solid is how much got done.
 *
 * **"After", never "because of".** The improvement figure compares a topic's
 * accuracy before and after the plan first sent the student to it; the copy
 * says that the plan is one thing among whatever else they did.
 */

const ACTIVITY_LABEL: Record<string, string> = {
  review: "Review",
  practice: "Practice",
  flashcards: "Flashcards",
  quiz: "Quizzes",
};

function minutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function PlanAnalytics({ data }: { data: PlanAnalyticsView }) {
  if (!data.hasPlans) {
    return (
      <Card>
        <CardBody className="flex flex-col items-start gap-2 py-5">
          <span className="flex items-center gap-2 font-medium">
            <CalendarCheck className="size-4 text-ink-subtle" aria-hidden />
            No plans in the last four weeks
          </span>
          <p className="max-w-[52ch] text-sm text-ink-muted">
            Build today&apos;s plan from the dashboard. This is where you will see how much of each
            plan gets done, which kinds of block you skip, and how topics went after the plan sent
            you to them.
          </p>
          <Link href="/dashboard" className={buttonStyles({ variant: "subtle", size: "sm" })}>
            Go to the dashboard
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-6 py-5">
        <Headline data={data} />
        <DayChart days={data.daily} labels={data.labels} />
        <div className="grid gap-6 lg:grid-cols-2">
          <ByActivity rates={data.byActivity} />
          <Improvement data={data} />
        </div>
        <TableView data={data} />
      </CardBody>
    </Card>
  );
}

function Headline({ data }: { data: PlanAnalyticsView }) {
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <div>
        <p className="text-xs text-ink-subtle">Plan completion, last 4 weeks</p>
        <p className="font-display text-3xl font-semibold tracking-[-0.02em] tabular-nums">
          {data.completionRate === null ? "—" : percent(data.completionRate)}
        </p>
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-ink-subtle">Done of planned</dt>
          <dd className="font-medium tabular-nums">
            {minutes(data.completedMinutes)} of {minutes(data.plannedMinutes)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-subtle">Days with a plan</dt>
          <dd className="font-medium tabular-nums">
            {data.planDays}
            <span className="font-normal text-ink-muted"> · {data.fullDays} finished in full</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** The chart's height, in pixels, for the tallest plan. */
const CHART_PX = 96;

function DayChart({ days, labels }: { days: DayBar[]; labels: string[] }) {
  const peak = Math.max(...days.map((day) => day.planned), 1);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="font-medium text-ink">Planned and done, by day</span>
        {/* Two series, so a legend — text in ink, the colour only on the swatch. */}
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px] bg-cat-4" />
          Done
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px] bg-cat-4-track" />
          Planned, not done
        </span>
      </figcaption>

      <div className="flex items-end gap-1.5 sm:gap-2" style={{ height: CHART_PX + 4 }}>
        {days.map((day, index) => {
          const total = (day.planned / peak) * CHART_PX;
          const done = (day.completed / peak) * CHART_PX;
          const rest = total - done;
          const summary =
            day.planned === 0
              ? `${longDayLabel(day.date)}: no plan`
              : `${longDayLabel(day.date)}: ${day.completed} of ${day.planned} minutes done, ${day.blocksDone} of ${day.blocks} blocks`;

          return (
            <div
              key={day.date}
              tabIndex={0}
              aria-label={summary}
              /* The hit target is the whole column, not the bar: a short bar
                 is a hard thing to land a pointer on. */
              className="group relative flex h-full min-w-0 flex-1 flex-col justify-end outline-none"
            >
              {day.planned === 0 ? (
                <span className="h-[2px] w-full rounded-full bg-surface-sunken" />
              ) : (
                <span className="flex w-full flex-col justify-end gap-[2px]">
                  {rest > 0.5 && (
                    <span
                      className={cn("w-full bg-cat-4-track", "rounded-t-[4px]")}
                      style={{ height: Math.max(rest - (done > 0.5 ? 2 : 0), 2) }}
                    />
                  )}
                  {done > 0.5 && (
                    <span
                      className={cn("w-full bg-cat-4", rest <= 0.5 && "rounded-t-[4px]")}
                      style={{ height: Math.max(done, 2) }}
                    />
                  )}
                </span>
              )}

              {/* Hover and keyboard focus: the exact figures for the day. */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max max-w-[12rem] rounded-[var(--radius-control)] bg-ink px-2.5 py-1.5 text-xs text-on-ink shadow-[var(--shadow-pop)]",
                  "group-hover:block group-focus-visible:block",
                  index < days.length / 2 ? "left-0" : "right-0",
                )}
              >
                <span className="block font-medium">{longDayLabel(day.date)}</span>
                {day.planned === 0 ? (
                  "No plan"
                ) : (
                  <span className="tabular-nums">
                    {day.completed} of {day.planned} min · {day.blocksDone}/{day.blocks} blocks
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1.5 sm:gap-2" aria-hidden>
        {labels.map((label, index) => (
          <span key={index} className="min-w-0 flex-1 text-center text-[0.625rem] text-ink-subtle">
            {label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/**
 * Which kinds of block get done — a meter per kind.
 *
 * In the plan's own order rather than ranked: four rows, read as a set, and
 * reordering them each visit would make "practice" a moving target.
 */
function ByActivity({ rates }: { rates: ActivityRate[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Done, by kind of block</p>
      <ul className="flex flex-col gap-2.5">
        {rates.map((rate) => {
          const share = rate.planned > 0 ? rate.completed / rate.planned : 0;
          return (
            <li key={rate.activity} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3">
              <span className="text-sm text-ink-muted">{ACTIVITY_LABEL[rate.activity]}</span>
              <span
                role="img"
                aria-label={`${ACTIVITY_LABEL[rate.activity]}: ${rate.completed} of ${rate.planned} minutes done`}
                className="flex h-2 gap-[2px] overflow-hidden"
              >
                {share > 0 && (
                  <span
                    className="h-full rounded-full bg-cat-4"
                    style={{ width: `${share * 100}%` }}
                  />
                )}
                {share < 1 && <span className="h-full flex-1 rounded-full bg-cat-4-track" />}
              </span>
              <span className="text-sm font-medium tabular-nums">{percent(share)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Improvement({ data }: { data: PlanAnalyticsView }) {
  const result = data.improvement;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Topics after the plan sent you to them</p>
      {result ? (
        <>
          <p className="font-display text-2xl font-semibold tabular-nums">
            {percent(result.before)} <span className="text-ink-subtle">→</span>{" "}
            {percent(result.after)}
          </p>
          <p className="text-sm text-ink-muted">
            Accuracy on {result.topics} {result.topics === 1 ? "topic" : "topics"}, in the two weeks
            before its first finished block and from then on.{" "}
            {[
              result.improved > 0 && `${result.improved} improved`,
              result.held > 0 && `${result.held} held`,
              result.dropped > 0 && `${result.dropped} dropped`,
            ]
              .filter(Boolean)
              .join(", ")}
            .
          </p>
          <p className="text-xs text-ink-subtle">
            After the plan, not necessarily because of it — it is one thing among whatever else you
            did.
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-muted">
          Not enough answers yet. A topic counts once it has at least three answered questions in
          the two weeks before its first finished plan block, and three after.
        </p>
      )}
    </div>
  );
}

/** Every figure the chart draws, as a table — the chart's colour relief and its screen-reader view. */
function TableView({ data }: { data: PlanAnalyticsView }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-ink-muted hover:text-ink">Show as a table</summary>
      <table className="mt-3 w-full text-left tabular-nums">
        <thead className="text-xs text-ink-subtle">
          <tr>
            <th className="py-1.5 font-medium">Day</th>
            <th className="py-1.5 font-medium">Planned</th>
            <th className="py-1.5 font-medium">Done</th>
            <th className="py-1.5 font-medium">Blocks done</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {data.daily.map((day) => (
            <tr key={day.date}>
              <td className="py-1.5">{longDayLabel(day.date)}</td>
              <td className="py-1.5">{day.planned ? minutes(day.planned) : "—"}</td>
              <td className="py-1.5">{day.planned ? minutes(day.completed) : "—"}</td>
              <td className="py-1.5">{day.blocks ? `${day.blocksDone} of ${day.blocks}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
