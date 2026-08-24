import { cn } from "@/lib/utils";

/**
 * The Pawgress paw mark — brand direction "Daylight" (docs/branding.md).
 *
 * Four toes on a rounded pad, built from circles and one superellipse-ish path
 * so it stays geometric next to Outfit. Toes take ink, the pad takes the accent.
 * At 16px the toes are dropped rather than shrunk: a four-toe paw at favicon
 * size turns to mud. That reduction lives in `app/icon.svg`, which is what the
 * browser tab actually loads.
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
 * The paw on a solid ink tile — the app mark at the top of the icon rail, and
 * the only place the brand appears inside the authenticated shell.
 */
export function AppMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-[var(--radius-control)] bg-ink text-on-ink shadow-[var(--shadow-pill)]",
        className,
      )}
    >
      <PawMark className="size-6" />
    </span>
  );
}

/** Mark plus wordmark. The wordmark is set in the display face. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <PawMark className="size-7" />
      <span className="font-display text-[1.375rem] leading-none font-semibold tracking-[-0.02em]">
        Pawgress
      </span>
    </span>
  );
}
