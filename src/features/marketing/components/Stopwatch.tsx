import { cn } from "@/lib/utils";

/**
 * The study-timer object in the hero.
 *
 * Drawn rather than photographed: an SVG follows the theme, stays crisp on any
 * display, weighs nothing, and does not need a licence. The hands sit at 25
 * minutes because that is the length of the shortest block the planner ever
 * recommends — a detail nobody will consciously read, and the reason the object
 * looks like it belongs to this product rather than a stock illustration.
 */
export function Stopwatch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 108"
      className={cn("size-24", className)}
      role="img"
      aria-label="A stopwatch set to 25 minutes"
      fill="none"
    >
      <defs>
        <linearGradient id="pw-watch-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--surface)" />
          <stop offset="100%" stopColor="var(--surface-sunken)" />
        </linearGradient>
      </defs>

      {/* crown and side buttons */}
      <rect x="40" y="2" width="16" height="12" rx="4" fill="var(--rule-strong)" />
      <rect x="16" y="16" width="12" height="9" rx="4" fill="var(--rule-strong)" />
      <rect x="68" y="16" width="12" height="9" rx="4" fill="var(--rule-strong)" />

      <circle cx="48" cy="62" r="40" fill="url(#pw-watch-body)" />
      <circle cx="48" cy="62" r="40" stroke="var(--rule)" strokeWidth="1.5" />
      <circle cx="48" cy="62" r="33" stroke="var(--rule)" strokeWidth="1" />

      {/* quarter ticks only — twelve would turn to noise at this size */}
      {[0, 90, 180, 270].map((deg) => (
        <line
          key={deg}
          x1="48"
          y1="26"
          x2="48"
          y2="32"
          stroke="var(--ink-subtle)"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${deg} 48 62)`}
        />
      ))}

      <line
        x1="48"
        y1="62"
        x2="48"
        y2="38"
        stroke="var(--ink)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="48"
        y1="62"
        x2="66"
        y2="70"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="48" cy="62" r="3.5" fill="var(--ink)" />
    </svg>
  );
}
