"use client";

import { Award, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CELEBRATION_COOKIE, type Celebration } from "@/features/achievements/celebration";
import { cn } from "@/lib/utils";

/**
 * The one moment a milestone is celebrated (Sprint 73).
 *
 * **Copy, motion and the accent — nothing else** (docs/branding.md). No
 * character, no confetti, no sound. It rises in from the corner, says what
 * the student did in a sentence, and leaves on its own after a few seconds;
 * anyone who wants it gone sooner can close it.
 *
 * **Shown once.** The cookie it came from is cleared the moment it mounts, so
 * a reload or the next page does not repeat it — a celebration that keeps
 * coming back stops being one.
 *
 * `role="status"`: announced politely, never interrupting what a screen reader
 * was in the middle of.
 */

const VISIBLE_MS = 9000;

export function CelebrationToast({ items }: { items: Celebration[] }) {
  const [shown, setShown] = useState(items);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (items.length === 0) return;
    try {
      document.cookie = `${CELEBRATION_COOKIE}=; path=/; max-age=0; samesite=lax`;
    } catch {
      /* Blocked cookies: it may show once more on the next page. Harmless. */
    }
    const enter = window.requestAnimationFrame(() => setEntered(true));
    const leave = window.setTimeout(() => setShown([]), VISIBLE_MS);
    return () => {
      window.cancelAnimationFrame(enter);
      window.clearTimeout(leave);
    };
  }, [items]);

  if (shown.length === 0) return null;

  return (
    <div
      role="status"
      className={cn(
        "fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-rule bg-surface p-4 shadow-[var(--shadow-pop)]",
        "transition-[opacity,transform] duration-500 motion-reduce:transition-none",
        entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
    >
      <div className="flex items-start gap-3">
        <Award className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-accent uppercase">
            {shown.length === 1 ? "Milestone" : `${shown.length} milestones`}
          </p>
          <ul className="mt-1 flex flex-col gap-2">
            {shown.map((item) => (
              <li key={`${item.title}-${item.name ?? ""}`}>
                <p className="font-medium">
                  {item.title}
                  {item.name ? ` · ${item.name}` : ""}
                </p>
                <p className="text-sm text-ink-muted">{item.earned}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/progress"
            onClick={() => setShown([])}
            className="mt-2 inline-block text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            See all milestones
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setShown([])}
          aria-label="Close"
          className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-surface-sunken hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
