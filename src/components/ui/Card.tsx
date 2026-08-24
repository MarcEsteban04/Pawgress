import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The workhorse surface. Panels on the dashboard and subject hub each load and
 * fail independently (docs/states.md §4), so a Card is a self-contained unit —
 * it never assumes a sibling rendered successfully.
 */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-[var(--radius-card)] border border-rule bg-surface", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-start gap-3 p-4 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("text-base leading-tight font-semibold", className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 border-t border-rule px-4 py-3", className)}
      {...props}
    />
  );
}

/**
 * Section label — the small uppercase kicker above a panel's content.
 * Kept as a component so the tracking and colour stay consistent everywhere.
 */
export function SectionLabel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-[0.6875rem] font-bold tracking-[0.08em] text-ink-subtle uppercase",
        className,
      )}
      {...props}
    />
  );
}

/** A hairline divider matching the card border. */
export function Hairline({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("h-px bg-rule", className)} {...props} />;
}
