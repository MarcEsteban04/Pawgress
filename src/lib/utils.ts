/**
 * Small, dependency-light helpers shared across the app.
 * Feature-specific logic belongs in `src/features/<feature>/`, not here.
 */

/** Formats a number as a whole-percent string, e.g. `0.824` -> `"82%"`. */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Clamps a number into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
