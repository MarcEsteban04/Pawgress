"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { type ComponentProps } from "react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

/**
 * Dialog for short create / rename / confirm actions only.
 *
 * Never a quiz, a reviewer, or a material viewer — those are content a student
 * will want to link to, reload and return to, so they are pages
 * (docs/navigation.md §1). Below 768px this renders as a bottom sheet, which is
 * the same component in a different container.
 *
 * Radix handles focus trapping, restore-on-close, Escape and scroll lock. Those
 * are the parts that are genuinely hard to get right by hand.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--ink)_45%,transparent)]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col gap-4 border border-rule bg-surface shadow-lg",
          // Sheet on narrow viewports, centred dialog from 640px up.
          "inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl p-5",
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[26rem]",
          "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-card)] sm:p-6",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute top-4 right-4 rounded-[var(--radius-control)] p-1 text-ink-subtle transition-colors hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("pr-8 font-display text-xl font-medium", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-[0.9375rem] leading-relaxed text-ink-muted", className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export type ConfirmDialogProps = {
  trigger: React.ReactNode;
  title: string;
  /**
   * What will be destroyed, with counts. "Delete Biology?" is not enough —
   * a student needs to know it takes 6 materials and 4 quiz attempts with it
   * (docs/user-flows.md, US-B3).
   */
  consequences: string;
  confirmLabel: string;
  onConfirm: () => void;
};

/** Destructive confirmation. The consequence line is required, not optional. */
export function ConfirmDialog({
  trigger,
  title,
  consequences,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{consequences}</DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="subtle">Keep it</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="danger" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
