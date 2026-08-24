"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Part-to-whole at a glance — how a student's topics are distributed across
 * mastery bands.
 *
 * Deliberate choices, from the dataviz rules in docs/design-system.md §3:
 *
 *  - Mastery bands are ORDERED (not started -> weak -> developing -> strong),
 *    so the segments use the single-hue `--mastery-*` ramp, not a rainbow of
 *    categorical hues. The ramp direction carries the meaning.
 *  - Every value is printed in the legend rather than hidden behind a hover.
 *    A tooltip that is the only way to read a number fails on touch and in
 *    print; hovering here just *emphasises* a pair that is already legible.
 *  - Segments are separated by a 2px surface gap, never by a stroke outline.
 *  - The centre carries the one number the panel exists to deliver, so the
 *    chart has a headline even before the legend is read.
 *
 * Capped at 6 segments by the type: past that, a donut stops being readable
 * and the answer is a bar chart.
 */

export type DonutSegment = {
  label: string;
  value: number;
  /** Ramp step 1–4 (weak -> strong), or "none" for the no-data neutral. */
  step: 1 | 2 | 3 | 4 | "none";
};

const STEP_VAR = {
  1: "var(--mastery-1)",
  2: "var(--mastery-2)",
  3: "var(--mastery-3)",
  4: "var(--mastery-4)",
  none: "var(--mastery-none)",
} as const;

const RADIUS = 48;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** 2px of surface between fills, expressed on the same scale as the path. */
const GAP = 2;

type Arc = DonutSegment & { length: number; offset: number; fraction: number };

/**
 * Walks the ring, accumulating offsets. Each arc is shortened by GAP so the
 * surface shows through between neighbours instead of a drawn border.
 *
 * Kept outside the component: the running cursor is a genuine accumulator, and
 * a reassigned local in a render body is exactly what the compiler's
 * immutability rule is there to catch.
 */
function buildArcs(segments: DonutSegment[], total: number): Arc[] {
  let cursor = 0;
  const arcs: Arc[] = [];
  for (const segment of segments) {
    const fraction = segment.value / total;
    const length = Math.max(fraction * CIRCUMFERENCE - GAP, 0);
    arcs.push({ ...segment, length, offset: cursor, fraction });
    cursor += fraction * CIRCUMFERENCE;
  }
  return arcs;
}

export function Donut({
  segments,
  centerValue,
  centerLabel,
  className,
}: {
  segments: DonutSegment[];
  /** The headline figure in the middle, e.g. "72%". */
  centerValue: string;
  centerLabel: string;
  className?: string;
}) {
  const titleId = useId();
  const [active, setActive] = useState<string | null>(null);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  const arcs = buildArcs(segments, total);

  return (
    <div className={cn("flex flex-col items-center gap-5 sm:flex-row sm:gap-6", className)}>
      <div className="relative shrink-0">
        <svg
          viewBox="0 0 120 120"
          className="size-[9.5rem]"
          role="img"
          aria-labelledby={titleId}
          // -90deg so the ring starts at 12 o'clock rather than 3 o'clock.
          style={{ transform: "rotate(-90deg)" }}
        >
          <title id={titleId}>
            {`Topics by mastery: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}
          </title>
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke={STEP_VAR[arc.step]}
              strokeWidth={STROKE}
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="butt"
              className="transition-opacity duration-150"
              opacity={active && active !== arc.label ? 0.35 : 1}
            />
          ))}
        </svg>

        {/* Centre figure. Not inside the SVG: real text stays selectable,
            scales with the user's font size, and needs no transform undo. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular font-display text-[1.75rem] leading-none font-semibold">
            {centerValue}
          </span>
          <span className="mt-1 text-xs text-ink-subtle">{centerLabel}</span>
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-col gap-2.5">
        {arcs.map((arc) => (
          <li key={arc.label}>
            <button
              type="button"
              onMouseEnter={() => setActive(arc.label)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(arc.label)}
              onBlur={() => setActive(null)}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-1 py-0.5 text-left transition-colors hover:bg-surface-sunken"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STEP_VAR[arc.step] }}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{arc.label}</span>
              <span className="tabular text-sm font-medium">{arc.value}</span>
              <span className="tabular w-10 text-right text-xs text-ink-subtle">
                {Math.round(arc.fraction * 100)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
