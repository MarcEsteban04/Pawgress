import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Server Component by default — a button only needs `"use client"` at the point
 * it gets an `onClick`, which is the caller's concern, not this file's.
 *
 * "Daylight" solid controls are ink, not the brand hue: in this shell the
 * saturated end of the palette belongs to data, so the loudest thing on screen
 * is never a button. Buttons are pills; only `square` opts out.
 *
 * `asChild` is deliberately absent: to make a link look like a button, use
 * `buttonStyles()` on an `<a>`/`<Link>`. Cards and rows are real links so that
 * ctrl-click opens a new tab (docs/navigation.md §1).
 */
const buttonStyles = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium transition-[background-color,border-color,color,box-shadow]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-ink text-on-ink shadow-[var(--shadow-pill)] hover:bg-ink/90",
        accent: "bg-accent text-on-accent shadow-[var(--shadow-pill)] hover:bg-accent-hover",
        subtle:
          "border border-rule bg-surface text-ink hover:border-rule-strong hover:bg-surface-sunken",
        quiet: "bg-surface-sunken text-ink-muted hover:text-ink",
        ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
        danger: "border border-bad/40 bg-bad-soft text-bad hover:border-bad",
      },
      size: {
        /* 44px minimum touch target wherever touch is plausible. */
        sm: "h-9 px-3.5 text-sm [&_svg]:size-4",
        md: "h-11 px-5 text-[0.9375rem] [&_svg]:size-[1.125rem]",
        lg: "h-12 px-6 text-base [&_svg]:size-5",
        icon: "size-11 [&_svg]:size-5",
      },
      shape: {
        pill: "rounded-[var(--radius-pill)]",
        square: "rounded-[var(--radius-control)]",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md", shape: "pill" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, shape, block, type, ...props }: ButtonProps) {
  return (
    <button
      // Defaulting to "button" avoids the classic accidental form submit.
      type={type ?? "button"}
      className={cn(buttonStyles({ variant, size, shape, block }), className)}
      {...props}
    />
  );
}

/**
 * The small circular action in a card header or top bar. Always icon-only, so
 * `label` is required and becomes the accessible name — an unlabelled icon
 * button is the most common a11y defect in a dashboard like this.
 */
export function IconButton({
  label,
  className,
  type,
  size = "md",
  ...props
}: Omit<ComponentProps<"button">, "aria-label"> & {
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type={type ?? "button"}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        "border border-rule bg-surface text-ink-muted",
        "transition-colors hover:border-rule-strong hover:text-ink",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "size-8 [&_svg]:size-3.5" : "size-9 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export { buttonStyles };
