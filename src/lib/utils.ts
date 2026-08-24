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
