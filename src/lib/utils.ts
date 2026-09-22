import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Small, dependency-light helpers shared across the app.
 * Feature-specific logic belongs in `src/features/<feature>/`, not here.
 */

/**
 * Merges class names, letting later Tailwind utilities win over earlier ones.
 * Every component in `src/components/ui/` takes a `className` and merges it
 * through here, so a caller can always override a default.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Formats a number as a whole-percent string, e.g. `0.824` -> `"82%"`. */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Clamps a number into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * "3 days ago" beats a date a student has to subtract from today.
 *
 * `short` is for dense rows where the column has to stay narrow; `long` is for
 * cards with room to breathe. One function because the two copies that used to
 * live in MaterialRow and SubjectCard had already drifted — the compact one was
 * missing the year branch, so a file uploaded two terms ago read "24mo ago".
 */
export function relativeDate(iso: string, style: "short" | "long" = "long"): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return style === "short" ? `${days}d ago` : `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
