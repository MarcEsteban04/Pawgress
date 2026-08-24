"use client";

import { useId, useRef, useState } from "react";
import { cn, clamp, formatPercent } from "@/lib/utils";

/**
 * Change over time, two series, ONE axis.
 *
 * Both series are percentages on a 0–100 scale, which is the only reason they
 * are allowed to share a plot. Two measures of different units (minutes studied
 * and mastery, say) would need two charts or a common index — a second y-scale
 * invents a correlation that is not in the data and is the single most common
 * way a dashboard chart lies (docs/design-system.md §3).
 *
 * Structure: the SVG draws only marks and gridlines. Axis labels are real HTML
 * in a grid around it, so text never scales with the plot, never clips, and the
 * card never grows a nested scrollbar to reach the x-axis band.
 */

export type TrendPoint = {
  /** x-axis tick, e.g. "Jan". */
  label: string;
  /** 0–1. */
  a: number;
  /** 0–1. */
  b: number;
};

const W = 600;
const H = 190;
const GRID = [0, 0.25, 0.5, 0.75, 1];

/**
 * Catmull-Rom through the points, converted to cubic beziers.
 *
 * Control points are clamped to the span of the segment they belong to, so a
 * smooth line can never bulge past the data — an overshoot on a 0–100% scale
 * would draw a mastery figure the student never had.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0]!.x} ${points[0]!.y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;

    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6, lo, hi);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6, lo, hi);

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function TrendChart({
  data,
  seriesA,
  seriesB,
  className,
}: {
  data: TrendPoint[];
  seriesA: { name: string; color: string };
  seriesB: { name: string; color: string };
  className?: string;
}) {
  const gradientId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) return null;

  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - clamp(v, 0, 1) * H;

  const aPoints = data.map((d, i) => ({ x: x(i), y: y(d.a) }));
  const bPoints = data.map((d, i) => ({ x: x(i), y: y(d.b) }));
  const aPath = smoothPath(aPoints);
  const bPath = smoothPath(bPoints);

  function onMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    setHover(Math.round(ratio * (data.length - 1)));
  }

  const active = hover === null ? null : data[hover];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Legend. Always present for two series — identity is never colour alone. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {[seriesA, seriesB].map((series) => (
          <span key={series.name} className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: series.color }}
            />
            <span className="text-sm text-ink-muted">{series.name}</span>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-[2.25rem_1fr] gap-x-2">
        {/* y labels — real text, so they never scale with the plot */}
        <div className="relative h-[11.875rem]">
          {GRID.map((g) => (
            <span
              key={g}
              className="tabular absolute right-0 -translate-y-1/2 text-xs text-ink-subtle"
              style={{ top: `${(1 - g) * 100}%` }}
            >
              {Math.round(g * 100)}
            </span>
          ))}
        </div>

        <div
          ref={plotRef}
          className="relative h-[11.875rem] touch-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="size-full overflow-visible"
            role="img"
            aria-label={`${seriesA.name} and ${seriesB.name} over ${data.length} periods`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={seriesA.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={seriesA.color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Solid hairline grid, one shade off the surface. Never dashed —
                a dashed rule reads as a threshold that is not there. */}
            {GRID.map((g) => (
              <line
                key={g}
                x1="0"
                x2={W}
                y1={y(g)}
                y2={y(g)}
                stroke="var(--rule)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <path d={`${aPath} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gradientId})`} />

            {/* vectorEffect keeps these a true 2px however wide the card gets. */}
            <path
              d={bPath}
              fill="none"
              stroke={seriesB.color}
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={aPath}
              fill="none"
              stroke={seriesA.color}
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            {hover !== null && (
              <>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1="0"
                  y2={H}
                  stroke="var(--rule-strong)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                {/* 2px surface ring so a marker stays readable over either line */}
                {[
                  { pt: bPoints[hover]!, color: seriesB.color },
                  { pt: aPoints[hover]!, color: seriesA.color },
                ].map(({ pt, color }, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r="5"
                    fill={color}
                    stroke="var(--surface)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </>
            )}
          </svg>

          {active && hover !== null && (
            <div
              role="status"
              className={cn(
                "pointer-events-none absolute top-1 z-10 w-max rounded-[var(--radius-control)]",
                "border border-rule bg-surface px-3 py-2 shadow-[var(--shadow-pop)]",
                // Flip the anchor near the right edge so the card never clips it.
                hover > data.length / 2 ? "-translate-x-full" : "",
              )}
              style={{ left: `${(hover / (data.length - 1)) * 100}%` }}
            >
              <p className="text-xs font-medium text-ink-subtle">{active.label}</p>
              <div className="mt-1.5 flex flex-col gap-1">
                {[
                  { series: seriesA, value: active.a },
                  { series: seriesB, value: active.b },
                ].map(({ series, value }) => (
                  <span key={series.name} className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: series.color }}
                    />
                    <span className="text-ink-muted">{series.name}</span>
                    <span className="tabular ml-auto font-medium">{formatPercent(value)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div />
        <div className="flex justify-between pt-2">
          {data.map((d) => (
            <span key={d.label} className="text-xs text-ink-subtle">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
