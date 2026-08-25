import { cn } from "@/lib/utils";

/**
 * Minutes studied per day, last seven days.
 *
 * A bar chart rather than a second line on the score chart: minutes and
 * percentages are different units, and putting them on one axis would invent a
 * relationship that is not in the data — the single most common way a dashboard
 * chart lies (docs/design-system.md §3).
 *
 * One series, so one colour for every bar. Colouring each day differently would
 * imply the days are categories with identities; they are a sequence.
 *
 * Every day is drawn, including zeros — a chart that omits empty days makes a
 * patchy week look like a consistent one. A zero renders as a hairline stub so
 * the day is still visibly present.
 */
export function StudyBars({
  days,
  className,
}: {
  days: { label: string; minutes: number }[];
  className?: string;
}) {
  const peak = Math.max(...days.map((day) => day.minutes), 1);
  const total = days.reduce((sum, day) => sum + day.minutes, 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className="flex h-24 items-end gap-1.5"
        role="img"
        aria-label={`${total} minutes studied in the last seven days`}
      >
        {days.map((day, index) => {
          const ratio = day.minutes / peak;
          return (
            <div key={`${day.label}-${index}`} className="flex flex-1 flex-col justify-end gap-1">
              <span className="tabular text-center text-[0.625rem] text-ink-subtle">
                {day.minutes > 0 ? day.minutes : ""}
              </span>
              <div
                className={cn(
                  "rounded-t-[4px] transition-[height]",
                  day.minutes > 0 ? "bg-cat-4" : "bg-rule",
                )}
                // 4px rounded data-end, anchored to the baseline. A zero keeps a
                // 2px stub so the day is present rather than missing.
                style={{ height: day.minutes > 0 ? `${Math.max(ratio * 100, 8)}%` : "2px" }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-1.5">
        {days.map((day, index) => (
          <span
            key={`${day.label}-label-${index}`}
            className="flex-1 text-center text-xs text-ink-subtle"
          >
            {day.label}
          </span>
        ))}
      </div>
    </div>
  );
}
