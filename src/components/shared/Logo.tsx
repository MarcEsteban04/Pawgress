import { BrandMark } from "./BrandMark";
import { cn } from "@/lib/utils";

/**
 * The drawn paw mark.
 *
 * No longer used in chrome — `BrandMark` shows the real mascot there. It is
 * kept because it is the source of truth for `app/icon.svg`, the favicon: the
 * mascot illustration is far too detailed to survive 16px, so the tab icon
 * stays this reduced paw, and the two must not drift apart.
 *
 * Toes take ink, the pad takes the accent. At favicon size the toes drop from
 * four to three rather than shrinking; four at 16px turns to mud.
 */
export function PawMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      role="img"
      aria-label="Pawgress"
      fill="none"
    >
      <circle cx="7.8" cy="13.2" r="3" fill="currentColor" />
      <circle cx="13.3" cy="9.4" r="3.3" fill="currentColor" />
      <circle cx="19.1" cy="9.4" r="3.3" fill="currentColor" />
      <circle cx="24.5" cy="13.2" r="3" fill="currentColor" />
      <path
        d="M16 16.2c4.7 0 8.5 3.3 8.5 7.2 0 3-2.4 4.5-5.1 4.5-1.8 0-2.5-.7-3.4-.7s-1.6.7-3.4.7c-2.7 0-5.1-1.5-5.1-4.5 0-3.9 3.8-7.2 8.5-7.2Z"
        className="fill-accent"
      />
    </svg>
  );
}

/**
 * The mascot on a solid ink tile — the app mark at the top of the nav rail.
 *
 * The ink tile is what makes the artwork work at this size in both themes: the
 * wordmark's white half never appears here, and the dark ground gives the
 * mascot's own outlines something to sit against.
 */
export function AppMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-[var(--radius-control)] bg-ink shadow-[var(--shadow-pill)]",
        className,
      )}
    >
      <BrandMark className="size-7 rounded-[0.4rem]" />
    </span>
  );
}

/**
 * Mascot plus wordmark — the header lockup, used in the landing nav, the auth
 * header and the app top bar.
 *
 * The wordmark stays TYPE rather than being cropped out of the artwork: type
 * follows the theme, stays crisp at any size, and can be selected and read by a
 * screen reader. Only the mascot comes from the image.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <BrandMark className="size-8" />
      <span className="font-display text-[1.375rem] leading-none font-semibold tracking-[-0.02em]">
        Pawgress
      </span>
    </span>
  );
}
