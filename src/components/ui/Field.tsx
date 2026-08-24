import { type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Inputs and the label/error scaffolding around them.
 *
 * 16px minimum font size on every text control — anything smaller makes iOS
 * Safari zoom on focus, which is the single most common way a mobile web form
 * feels broken (docs/wireframes.md §12).
 */

const controlBase = [
  "w-full bg-surface text-ink placeholder:text-ink-subtle",
  "border border-rule rounded-[var(--radius-control)]",
  "text-base", // 1rem — do not shrink this
  "transition-colors hover:border-rule-strong",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "aria-[invalid=true]:border-bad",
];

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlBase, "h-11 px-3", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlBase, "min-h-28 px-3 py-2.5", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlBase, "h-11 px-3 pr-8", className)} {...props} />;
}

export type FieldProps = {
  label: string;
  /** Ties label, control, hint and error together for screen readers. */
  htmlFor: string;
  hint?: string;
  /** Present means invalid. Say what happened and what to do next. */
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
};

export function Field({ label, htmlFor, hint, error, optional, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-[0.9375rem] font-semibold">
        {label}
        {optional && <span className="text-xs font-normal text-ink-subtle">optional</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-sm text-ink-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
