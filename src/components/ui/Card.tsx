import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The workhorse surface of the "Daylight" shell: a white panel with a hairline
 * border and a low, wide shadow, floating on the canvas.
 *
 * Panels on the dashboard and subject hub each load and fail independently
 * (docs/states.md §4), so a Card is a self-contained unit — it never assumes a
 * sibling rendered successfully.
 */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-rule bg-surface shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Card header: title on the left, small round icon actions on the right.
 * The actions belong in `CardActions` so their alignment and hit area stay
 * identical on every panel.
 */
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-3 px-5 pt-5 pb-3 sm:px-6 sm:pt-6", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn("font-display text-[1.0625rem] leading-tight font-medium", className)}
      {...props}
    />
  );
}

/** Right-aligned cluster of icon buttons in a card header. */
export function CardActions({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("ml-auto flex shrink-0 items-center gap-1.5", className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5 sm:px-6 sm:pb-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 border-t border-rule px-5 py-3.5 sm:px-6", className)}
      {...props}
    />
  );
}

/**
 * Section label — the small muted kicker above a title. In "Daylight" it is
 * sentence case rather than uppercase tracking; the reference eyebrow reads as
 * a quiet sentence, not a system label.
 */
export function SectionLabel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("text-sm text-ink-muted", className)} {...props} />;
}

/** A hairline divider matching the card border. */
export function Hairline({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("h-px bg-rule", className)} {...props} />;
}

/**
 * A tinted row — the pastel list item that carries a subject's identity colour.
 * `tone` is the subject's fixed categorical slot, so the same subject keeps the
 * same tint in every list it appears in.
 */
export function TintRow({
  tone,
  className,
  ...props
}: ComponentProps<"div"> & { tone: 1 | 2 | 3 | 4 | 5 }) {
  const tints = {
    1: "bg-cat-1-soft",
    2: "bg-cat-2-soft",
    3: "bg-cat-3-soft",
    4: "bg-cat-4-soft",
    5: "bg-cat-5-soft",
  } as const;

  return (
    <div className={cn("rounded-[var(--radius-tile)] p-3.5", tints[tone], className)} {...props} />
  );
}
