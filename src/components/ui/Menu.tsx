"use client";

import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Overflow menus — the `⋯` on a material row, the account menu in the top bar.
 *
 * Menus hold secondary actions only. Anything a student does regularly belongs
 * on the surface, and a destructive item here still routes through a
 * ConfirmDialog with counts.
 */

export const Menu = DropdownPrimitive.Root;
export const MenuTrigger = DropdownPrimitive.Trigger;

export function MenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[11rem] overflow-hidden rounded-[var(--radius-card)] border border-rule bg-surface p-1 shadow-lg",
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function MenuItem({
  className,
  destructive = false,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex cursor-default items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2",
        "text-[0.9375rem] outline-none select-none",
        // Radix drives highlight from keyboard AND pointer, so this is not a
        // hover-only affordance.
        destructive
          ? "text-bad data-highlighted:bg-bad-soft"
          : "text-ink data-highlighted:bg-surface-sunken",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className={cn("my-1 h-px bg-rule", className)} {...props} />;
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      className={cn(
        "px-2.5 py-1.5 text-[0.6875rem] font-bold tracking-[0.08em] text-ink-subtle uppercase",
        className,
      )}
      {...props}
    />
  );
}
