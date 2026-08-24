import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Server Component by default — a button only needs `"use client"` at the point
 * it gets an `onClick`, which is the caller's concern, not this file's.
 *
 * `asChild` is deliberately absent: to make a link look like a button, use
 * `buttonStyles()` on an `<a>`/`<Link>`. Cards and rows are real links so that
 * ctrl-click opens a new tab (docs/navigation.md §1).
 */
const buttonStyles = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-semibold transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:bg-accent-hover",
        outline: "border border-ink bg-transparent text-ink hover:bg-accent-soft",
        subtle: "border border-rule bg-surface text-ink hover:bg-surface-sunken",
        ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
        danger: "border border-bad bg-transparent text-bad hover:bg-bad-soft",
      },
      size: {
        /* 44px minimum touch target wherever touch is plausible. */
        sm: "h-9 rounded-[var(--radius-control)] px-3 text-sm [&_svg]:size-4",
        md: "h-11 rounded-[var(--radius-control)] px-4 text-[0.9375rem] [&_svg]:size-[1.125rem]",
        lg: "h-12 rounded-[var(--radius-control)] px-6 text-base [&_svg]:size-5",
        icon: "size-11 rounded-[var(--radius-control)] [&_svg]:size-5",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, block, type, ...props }: ButtonProps) {
  return (
    <button
      // Defaulting to "button" avoids the classic accidental form submit.
      type={type ?? "button"}
      className={cn(buttonStyles({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { buttonStyles };
