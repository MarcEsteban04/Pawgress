"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Choose one value from a short list, in the product's own design.
 *
 * **Why not `<select>`.** A native select drops down the OPERATING SYSTEM's
 * list, and no CSS reaches it: no rounded corners, no spacing, no check mark,
 * no font, and on Windows a white popup with a system-blue highlight on a
 * near-black page. `color-scheme: dark` fixes the colours at best and nothing
 * else. This is the same control drawn by us.
 *
 * **Why Radix Select and not the dropdown menu already in the app.** A menu is
 * a list of ACTIONS; this is a VALUE. Radix Select is a listbox: a screen
 * reader announces it as a choice with one option selected, typing jumps to a
 * match, arrow keys move without committing, and it sits in a form like a
 * field. Rebuilding that on top of a menu would lose most of it.
 *
 * **`""` is a real value here.** Radix reserves the empty string, but the app
 * uses it throughout to mean "no filter" — "All your subjects", "Every topic".
 * The empty string is mapped to a private sentinel on the way in and back on
 * the way out, so callers keep writing `""` and never meet the difference.
 *
 * `Select` (the native one) stays for dense forms where the OS list is fine and
 * a portal would be overkill; reach for this where the control is prominent.
 */

const EMPTY = "__acadify_empty__";
const toInner = (value: string) => (value === "" ? EMPTY : value);
const toOuter = (value: string) => (value === EMPTY ? "" : value);

export type PickerOption = {
  value: string;
  label: string;
  /** A second line, for options that need a word of explanation. */
  hint?: string;
  icon?: ReactNode;
};

export type PickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: PickerOption[];
  /** The accessible name. Required: a trigger that only shows a value does not say what it chooses. */
  label: string;
  /**
   * `field` stands alone, bordered like an input. `bare` has no frame of its
   * own, for sitting inside a segmented bar that already draws one.
   */
  variant?: "field" | "bare";
  disabled?: boolean;
  /** Which side of the trigger the list lines up with. */
  align?: "start" | "end";
  className?: string;
  /** Optional heading inside the list, above the options. */
  heading?: string;
};

export function Picker({
  value,
  onValueChange,
  options,
  label,
  variant = "field",
  disabled = false,
  align = "start",
  className,
  heading,
}: PickerProps) {
  const selected = options.find((option) => option.value === value);

  return (
    <SelectPrimitive.Root
      value={toInner(value)}
      onValueChange={(next) => onValueChange(toOuter(next))}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        aria-label={label}
        className={cn(
          "group inline-flex min-w-0 items-center justify-between gap-2 text-sm transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50",
          /* The focus ring drawn INSIDE the control. The global outline sits
             2px outside, and a trigger inside a rounded, overflow-hidden bar
             had it clipped to a single bright sliver down one edge. */
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
          variant === "field"
            ? "h-11 w-full rounded-[var(--radius-control)] border border-rule bg-surface px-4 text-base hover:border-rule-strong data-[state=open]:border-rule-strong"
            : "h-10 px-3.5 hover:bg-surface-sunken data-[state=open]:bg-surface-sunken",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon}
          <SelectPrimitive.Value>
            <span className="truncate">{selected?.label ?? ""}</span>
          </SelectPrimitive.Value>
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            className="size-4 shrink-0 text-ink-subtle transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          /* Popper, not the default item-aligned mode. Item-aligned slides the
             list so the chosen option sits over the trigger, which covers the
             trigger and the controls beside it — in a bar of three controls
             that hides the other two. */
          position="popper"
          side="bottom"
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "picker-pop z-50 overflow-hidden rounded-[var(--radius-control)] border border-rule bg-surface shadow-[var(--shadow-pop)]",
            /* At least the trigger's width, so the list reads as belonging to
               it; capped, so one long subject name cannot make it a banner. */
            "max-w-[min(22rem,calc(100vw-1.5rem))] min-w-[max(var(--radix-select-trigger-width),12rem)]",
            "max-h-[min(22rem,var(--radix-select-content-available-height))]",
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-ink-subtle">
            <ChevronUp className="size-4" aria-hidden />
          </SelectPrimitive.ScrollUpButton>

          <SelectPrimitive.Viewport className="p-1">
            {heading && (
              <p className="px-2.5 pt-1.5 pb-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
                {heading}
              </p>
            )}
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={toInner(option.value)}
                className={cn(
                  "relative flex cursor-pointer items-center gap-2.5 rounded-[calc(var(--radius-control)-0.25rem)] py-2 pr-8 pl-2.5 text-sm outline-none select-none",
                  "text-ink-muted transition-colors",
                  /* Highlighted is where the keyboard or pointer IS; checked is
                     what is chosen. Two different states, drawn two ways. */
                  "data-[highlighted]:bg-surface-sunken data-[highlighted]:text-ink",
                  "data-[state=checked]:font-medium data-[state=checked]:text-ink",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                )}
              >
                {option.icon && <span className="shrink-0 text-ink-subtle">{option.icon}</span>}
                <span className="min-w-0 flex-1">
                  <SelectPrimitive.ItemText>
                    <span className="block truncate">{option.label}</span>
                  </SelectPrimitive.ItemText>
                  {option.hint && (
                    <span className="mt-0.5 block text-xs font-normal text-ink-subtle">
                      {option.hint}
                    </span>
                  )}
                </span>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5 inline-flex items-center text-accent">
                  <Check className="size-4" aria-hidden />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>

          <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-ink-subtle">
            <ChevronDown className="size-4" aria-hidden />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
