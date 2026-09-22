"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * What a student looks at while Aki is writing something (Sprint 44–45).
 *
 * **A skeleton of the RESULT, not a spinner.** A spinner says "something is
 * happening somewhere". A shimmering deck of cards says "cards are being made,
 * they will land here, and this is roughly what they will look like" — which is
 * the question someone staring at a blank screen is actually asking. It also
 * means the layout does not jump when the real thing arrives: the placeholders
 * occupy the space the content will.
 *
 * **The elapsed clock is real.** Every fake progress bar in this industry is a
 * lie told to a person who cannot check, and this product's entire claim is
 * that its numbers mean something. A count of seconds is a fact. Past the point
 * where the wait stops being normal it says so, because a student deserves to
 * know the difference between "slow" and "stuck" — and what to do about it.
 *
 * Mounted only while work is genuinely in flight. `ProgressWatcher` is what
 * nudges the queue and refreshes; this is only the face of it.
 */

/** Past this, the wait has stopped being ordinary and the copy says so. */
const LONG_SECONDS = 75;

export function GeneratingOverlay({
  title,
  detail,
  skeleton,
}: {
  title: string;
  detail: string;
  /** Ghosts of the thing being made. Shaped like the real content. */
  skeleton: ReactNode;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((previous) => previous + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const slow = seconds >= LONG_SECONDS;

  return (
    <div className="relative flex flex-1 flex-col">
      {/* The placeholders, dimmed and inert. They are scenery, not content, so
          they are hidden from assistive tech entirely — a screen reader
          announcing eight empty cards would be worse than silence. */}
      <div aria-hidden className="pointer-events-none flex flex-1 flex-col opacity-60">
        {skeleton}
      </div>

      {/* The message floats over the middle of them. `role="status"` rather
          than an alert: this is progress, not a problem, and it should not
          interrupt whatever a screen-reader user is doing. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <div
          role="status"
          className="pointer-events-auto flex max-w-[26rem] flex-col items-center gap-3 rounded-[var(--radius-card)] border border-rule bg-surface/85 px-7 py-6 text-center shadow-[var(--shadow-float)] backdrop-blur-xl"
        >
          <span className="relative flex size-11 items-center justify-center rounded-full bg-accent-soft">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
            <Sparkles className="relative size-5 text-accent" aria-hidden />
          </span>

          <div>
            <p className="font-display leading-snug font-semibold tracking-[-0.01em]">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              {slow
                ? "This is taking longer than it should. It is still queued, and this page keeps trying — if it has not landed in another minute, generate it again."
                : detail}
            </p>
          </div>

          <p
            className={cn(
              "text-xs tabular-nums",
              slow ? "font-medium text-warn" : "text-ink-subtle",
            )}
          >
            {formatElapsed(seconds)}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/**
 * A ghost block.
 *
 * `delay` staggers the entrance so the panel reads as being built rather than
 * as having failed to load — the same trick a good app uses on a list, applied
 * to something that genuinely is being written.
 */
export function Ghost({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <span
      className={cn("rise block overflow-hidden rounded-full bg-surface-sunken", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="shimmer block h-full w-full" />
    </span>
  );
}
