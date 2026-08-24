import { cn } from "@/lib/utils";

/**
 * The Pawgress paw mark — brand direction "Study Desk" (docs/branding.md).
 *
 * Toes take ink, the pad takes the accent. At 16px the toes are dropped rather
 * than shrunk: a four-toe paw at favicon size turns to mud. That reduction
 * lives in `app/icon.svg`, which is what the browser tab actually loads.
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
      <circle cx="7.6" cy="13.4" r="3.1" fill="currentColor" />
      <circle cx="13.2" cy="9.6" r="3.4" fill="currentColor" />
      <circle cx="19.2" cy="9.6" r="3.4" fill="currentColor" />
      <circle cx="24.6" cy="13.4" r="3.1" fill="currentColor" />
      <path
        d="M16 16.4c4.6 0 8.4 3.2 8.4 7 0 3-2.3 4.4-5 4.4-1.8 0-2.4-.7-3.4-.7s-1.6.7-3.4.7c-2.7 0-5-1.4-5-4.4 0-3.8 3.8-7 8.4-7Z"
        className="fill-accent"
      />
    </svg>
  );
}

/** Mark plus wordmark. The wordmark is set in the display face. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      <PawMark className="size-7" />
      <span className="font-display text-[1.375rem] leading-none font-medium tracking-tight">
        Pawgress
      </span>
    </span>
  );
}
