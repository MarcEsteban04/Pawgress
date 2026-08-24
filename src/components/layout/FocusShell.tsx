import Link from "next/link";
import { X } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Focus mode — quizzes and flashcard sessions.
 *
 * No sidebar, no top bar, one deliberate exit, capped at 720px at EVERY width,
 * so an exam-like screen feels identical on a laptop and a phone.
 *
 * This is a separate route group rather than a nested layout, because nested
 * layouts COMPOSE: a layout inside `(app)` cannot remove the app shell above it.
 * See docs/architecture.md §2.
 */

export type FocusShellProps = {
  children: ReactNode;
  /** Where the exit goes. */
  exitHref: string;
  exitLabel?: string;
  /** e.g. "Question 3 of 10". */
  title?: string;
  /** 0–1. Omit for screens without linear progress. */
  progress?: number;
  /** Right-hand context, e.g. "Biology · Genetics". */
  meta?: string;
};

export function FocusShell({
  children,
  exitHref,
  exitLabel = "Exit",
  title,
  progress,
  meta,
}: FocusShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-frame">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-rule px-4 sm:px-6">
        <Link
          href={exitHref}
          className="flex items-center gap-2 rounded-[var(--radius-pill)] px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <X className="size-[1.125rem]" aria-hidden />
          {exitLabel}
        </Link>

        {title && <span className="tabular flex-1 text-center text-sm font-semibold">{title}</span>}
        {!title && <span className="flex-1" />}

        {meta && <span className="hidden text-xs text-ink-subtle sm:block">{meta}</span>}
      </header>

      {progress !== undefined && (
        <div
          className="h-1 shrink-0 bg-surface-sunken"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full rounded-r-[var(--radius-pill)] bg-ink transition-[width] duration-500"
            style={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }}
          />
        </div>
      )}

      <div className={cn("flex flex-1 justify-center px-4 py-8 sm:px-6")}>
        <div className="flex w-full max-w-[45rem] flex-col">{children}</div>
      </div>
    </div>
  );
}
