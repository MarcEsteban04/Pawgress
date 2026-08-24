import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

/**
 * Empty, error and quota states — the three surfaces that decide whether the
 * app feels finished. Rules from docs/states.md:
 *
 *  - An empty state names EXACTLY ONE next action. It is the onboarding.
 *  - An error states a cause and a next step. No stack traces, no "Error 503".
 *  - The mascot celebrates; it never apologises. Nothing cute on a failure.
 */

export type EmptyStateProps = {
  Icon?: LucideIcon;
  title: string;
  /** What this screen is for, in the student's words. */
  description: string;
  /** The single action. More than one is a design smell. */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-rule bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <h3 className="font-display text-xl font-medium">{title}</h3>
      <p className="max-w-[38ch] text-[0.9375rem] leading-relaxed text-ink-muted">{description}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export type ErrorStateProps = {
  /** What happened, in plain words. */
  title: string;
  /** What to do next. Required — an error without a next step is a dead end. */
  nextStep: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

/**
 * Note: `onRetry` makes this a Client Component at the point of use. Callers
 * that only need to display an error can omit it and keep the server render.
 */
export function ErrorState({
  title,
  nextStep,
  onRetry,
  retryLabel = "Try again",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-2 rounded-[var(--radius-card)] border border-bad bg-bad-soft p-4",
        className,
      )}
    >
      <p className="text-[0.9375rem] font-semibold">{title}</p>
      <p className="text-sm leading-relaxed text-ink-muted">{nextStep}</p>
      {onRetry && (
        <div className="mt-1">
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export type QuotaMeterProps = {
  label: string;
  used: number;
  limit: number;
  /** When the allowance resets, e.g. "midnight". */
  resetsAt?: string;
  className?: string;
};

/**
 * Shown wherever a student could be stopped by a limit — settings, quiz setup,
 * the assistant composer. A quota that only appears at the moment it blocks you
 * is a bug, not a feature (NFR-C1).
 */
export function QuotaMeter({ label, used, limit, resetsAt, className }: QuotaMeterProps) {
  const pct = limit > 0 ? Math.min(used / limit, 1) : 0;
  const exhausted = used >= limit;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink-muted">{label}</span>
        <span className="tabular text-xs">
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full border border-rule bg-surface-sunken">
        <div
          className={cn("h-full rounded-full", exhausted ? "bg-warn" : "bg-ink-muted")}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {resetsAt && (
        <p className="font-mono text-xs text-ink-subtle">
          {exhausted ? `Limit reached — resets at ${resetsAt}` : `Resets at ${resetsAt}`}
        </p>
      )}
    </div>
  );
}

/** Skeleton that matches the shape of what it replaces, so nothing shifts. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-[var(--radius-control)] bg-surface-sunken", className)}
    />
  );
}
