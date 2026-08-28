import { cn } from "@/lib/utils";

/**
 * The Acadify mark: an **A whose crossbar is a progress bar**.
 *
 * The name changed because "Acadify" promised a pet product and Daylight
 * delivers a study tool — but the *idea* in the old name was worth keeping, so
 * it moved into the mark instead of being thrown away. The A is the initial; the
 * accent crossbar is the thing the product actually does. One mark, two
 * readings, no mascot.
 *
 * DRAWN, NOT PHOTOGRAPHED, and that is the whole point of this rewrite. What
 * this replaced was a 1.4 MB raster cropped to a dog's face by hand-measured
 * percentages, which meant chrome could not follow the theme, cost a download,
 * and would have broken the moment the artwork was redrawn. An SVG on
 * `currentColor` has none of those problems.
 *
 * GEOMETRY IS DELIBERATE at 16px, where a favicon lives:
 *  - Stroke 4 on a 32 grid — 12.5%, heavy enough to survive a tab.
 *  - The crossbar sits at y 19.5, low on the letter. Centred, it collides with
 *    the apex when the strokes thicken; low, the counter stays open.
 *  - Its ends are inset to x 9.6/22.4 so round caps land flush on the legs
 *    rather than overhanging them.
 *  - No fourth element. The paw it replaced had to drop a toe at favicon size;
 *    this has nothing left to drop, which is the correct amount of detail.
 */
export function AcadifyMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      role="img"
      aria-label="Acadify"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* The A. `currentColor`, so it inherits ink, white-on-ink, or a hover. */}
      <path d="M5.5 26 16 6l10.5 20" stroke="currentColor" strokeWidth="4" />
      {/* The crossbar — progress. The one accent in the mark. */}
      <path d="M9.6 19.5h12.8" className="stroke-accent" strokeWidth="4" />
    </svg>
  );
}

/**
 * The mark on a solid ink tile — the app mark at the top of the nav rail, and
 * the single object on the sign-up aside.
 *
 * The tile scales from `className` and the mark is sized as a fraction of it, so
 * one component covers 40px in chrome and 112px as a brand moment. Sizing the
 * inner SVG in absolute units instead is what forces a second near-identical
 * component into existence later.
 */
export function AppMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-[var(--radius-control)] bg-ink shadow-[var(--shadow-pill)]",
        className,
      )}
    >
      <AcadifyMark className="size-auto h-[62%] w-[62%] text-on-ink" />
    </span>
  );
}

/**
 * Mark plus wordmark — the header lockup, used in the landing nav, the auth
 * header and the app top bar.
 *
 * The wordmark is TYPE, not artwork: it follows the theme, stays crisp at any
 * size, and can be selected and read by a screen reader.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <AcadifyMark className="size-8" />
      <span className="font-display text-[1.375rem] leading-none font-semibold tracking-[-0.02em]">
        Acadify
      </span>
    </span>
  );
}

/**
 * The large brand moment — the sign-up aside, where the mascot used to stand.
 *
 * `AuthShell` describes that column as "one object, whole and centred", against
 * the landing page's six cropped ones. Removing the illustration without putting
 * an object back would have quietly broken that contrast, so the tile is sized
 * up to be the object. Type sits beneath it rather than beside it: at this scale
 * a horizontal lockup would run wider than the 26rem column it lives in.
 */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-4", className)}>
      <AppMark className="size-24 rounded-[1.25rem]" />
      <span className="font-display text-[2rem] leading-none font-semibold tracking-[-0.03em] text-ink">
        Acadify
      </span>
    </div>
  );
}
