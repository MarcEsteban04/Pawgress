import { Search } from "lucide-react";
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
  return <input className={cn(controlBase, "h-11 px-4", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlBase, "min-h-28 px-4 py-3", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlBase, "h-11 px-4 pr-9", className)} {...props} />;
}

/**
 * The wide pill search in the page header.
 *
 * A real `<input type="search">` inside a `<label>`, not a button that opens a
 * modal: a student with six subjects and thirty files reaches for this
 * constantly, and a search box you have to open first is one interaction slower
 * every single time.
 */
export function SearchField({
  label = "Search subjects, materials and topics",
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label?: string }) {
  return (
    <label
      className={cn(
        "group flex h-11 w-full items-center gap-2.5 rounded-[var(--radius-pill)]",
        "border border-rule bg-surface px-4",
        "transition-colors focus-within:border-rule-strong hover:border-rule-strong",
        className,
      )}
    >
      <Search className="size-[1.125rem] shrink-0 text-ink-subtle" aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-subtle"
        {...props}
      />
    </label>
  );
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
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-[0.9375rem] font-medium">
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
