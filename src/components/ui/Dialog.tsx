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

/**
 * How wide a dialog is from 640px up. Below that every size is the same
 * full-width bottom sheet.
 *
 * `sm` is the default and suits what most dialogs are: a name, a confirm, a
 * rename. A FORM with several choices side by side — difficulty tiles, a kind
 * switch — needs `lg`, or its tiles wrap into three-word lines and the whole
 * thing becomes a scroll. Sized per dialog rather than widened everywhere,
 * because a confirmation stretched to 42rem reads as a page, not a question.
 */
const DIALOG_WIDTH = {
  sm: "sm:w-[26rem]",
  md: "sm:w-[34rem]",
  lg: "sm:w-[42rem]",
} as const;

export function DialogContent({
  className,
  children,
  size = "sm",
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { size?: keyof typeof DIALOG_WIDTH }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[var(--scrim)]" />
      <DialogPrimitive.Content
        className={cn(
          /* The frame. It clips, and does NOT scroll: scrolling here put the
             scrollbar on the rounded edge, where the corner cut it off. */
          "fixed z-50 flex flex-col overflow-hidden border border-rule bg-surface shadow-lg",
          /* No focus ring on the frame. Radix moves focus into the dialog when
             it opens, and when it lands on the container itself the global
             :focus-visible outline drew a white box around the whole panel —
             a ring that points at nothing a student can act on. Every control
             inside keeps its own. */
          "outline-none",
          // Sheet on narrow viewports, centred dialog from 640px up.
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl",
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(88dvh,52rem)] sm:max-w-[calc(100vw-2rem)]",
          "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-card)]",
          DIALOG_WIDTH[size],
          className,
        )}
        {...props}
      >
        {/* The scroller, inside the frame's padding-free edge. `min-h-0` lets
            it shrink below its content inside the flex column, which is what
            makes it scroll rather than push the frame past the viewport. */}
        <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {children}
        </div>
        {/* Outside the scroller, so it stays put while a long form scrolls
            under it. */}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute top-4 right-4 rounded-[var(--radius-control)] bg-surface p-1 text-ink-subtle transition-colors hover:text-ink"
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
  /**
   * What opens it. Optional, because some confirmations have no button.
   *
   * "You are about to leave with unsaved answers" is provoked by a navigation,
   * not by a control a student can point at — so that caller drives `open`
   * instead. A trigger invented for it would be a button nobody presses.
   */
  trigger?: React.ReactNode;
  /** Controlled mode. Pass both, or neither and use `trigger`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  open,
  onOpenChange,
  title,
  consequences,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    /* Uncontrolled unless `open` is passed. Radix treats `open={undefined}` as
       uncontrolled, so the existing trigger-based callers are untouched. */
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
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
