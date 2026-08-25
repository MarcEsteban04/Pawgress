"use client";

import { useId, useRef, useState } from "react";
import { cn, clamp, formatPercent } from "@/lib/utils";

/**
 * One measure over time — quiz score per attempt.
 *
 * ONE series, so there is no legend: the card's title names it, and a legend
 * box for a single line is furniture (docs/design-system.md §3). A second
 * measure on a different scale would need its own chart, never a second y-axis.
 *
 * **The empty state still draws the chart.** A blank card reads as broken; an
 * axis, a grid and a line of explanation read as "nothing here yet", which is
 * the truth. It is also what the panel will look like once there is data, so
 * nothing jumps when the first attempt lands.
 */

export type ScorePoint = { label: string; value: number };

const W = 600;
const H = 170;
const GRID = [0, 0.25, 0.5, 0.75, 1];

/**
 * Catmull-Rom through the points, clamped so a smooth line cannot bulge past
 * the data. An overshoot on a 0–100% scale would draw a score nobody got.
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
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${clamp(p1.y + (p2.y - p0.y) / 6, lo, hi)}, ${
      p2.x - (p3.x - p1.x) / 6
    } ${clamp(p2.y - (p3.y - p1.y) / 6, lo, hi)}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function ScoreChart({
  data,
  color = "var(--cat-3)",
  emptyMessage,
  className,
}: {
  data: ScorePoint[];
  color?: string;
  emptyMessage: string;
  className?: string;
}) {
  const gradientId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const x = (i: number) => (data.length < 2 ? W / 2 : (i / (data.length - 1)) * W);
  const y = (v: number) => H - clamp(v, 0, 1) * H;
  const points = data.map((d, i) => ({ x: x(i), y: y(d.value) }));
  const path = smoothPath(points);

  function onMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || data.length === 0) return;
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    setHover(Math.round(ratio * (data.length - 1)));
  }

  const active = hover === null ? null : data[hover];

  return (
    <div className={cn("grid grid-cols-[2.25rem_1fr] gap-x-2", className)}>
      <div className="relative h-[10.625rem]">
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
        className="relative h-[10.625rem] touch-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="size-full overflow-visible"
          role="img"
          aria-label={
            data.length === 0 ? emptyMessage : `Quiz score across ${data.length} attempts`
          }
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Solid hairlines. A dashed grid reads as a threshold that is not there. */}
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

          {data.length >= 2 && (
            <>
              <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${gradientId})`} />
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}

          {/* A single attempt is a dot, not a line. */}
          {data.length === 1 && (
            <circle
              cx={x(0)}
              cy={y(data[0]!.value)}
              r="5"
              fill={color}
              stroke="var(--surface)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {hover !== null && data.length > 0 && (
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
              <circle
                cx={points[hover]!.x}
                cy={points[hover]!.y}
                r="5"
                fill={color}
                stroke="var(--surface)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <p className="max-w-[32ch] text-center text-sm text-ink-subtle">{emptyMessage}</p>
          </div>
        )}

        {active && hover !== null && (
          <div
            role="status"
            className={cn(
              "pointer-events-none absolute top-1 z-10 w-max rounded-[var(--radius-control)]",
              "border border-rule bg-surface px-3 py-2 shadow-[var(--shadow-pop)]",
              hover > data.length / 2 ? "-translate-x-full" : "",
            )}
            style={{ left: `${data.length < 2 ? 50 : (hover / (data.length - 1)) * 100}%` }}
          >
            <p className="text-xs font-medium text-ink-subtle">{active.label}</p>
            <p className="tabular mt-0.5 text-sm font-medium">{formatPercent(active.value)}</p>
          </div>
        )}
      </div>

      <div />
      <div className="flex justify-between pt-2">
        {data.length === 0 ? (
          <span className="text-xs text-ink-subtle">No attempts yet</span>
        ) : (
          data.map((d, i) => (
            <span
              key={`${d.label}-${i}`}
              className={cn("text-xs text-ink-subtle", data.length > 8 && i % 2 === 1 && "sr-only")}
            >
              {d.label}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
