import { z } from "zod";

/**
 * Subject input (FR-S1, US-B1).
 *
 * Bounds mirror the CHECK constraints in the Sprint 13 migration. What is NOT
 * here is a uniqueness rule: US-B1 allows duplicate names and asks for a
 * warning instead, so that check lives in the action, which can tell the
 * student and let them decide.
 */

/** The categorical slots that exist in globals.css. */
export const COLOR_SLOTS = [1, 2, 3, 4, 5] as const;

/**
 * A small, fixed icon set rather than free text.
 *
 * The stored value is a key, not a component or a class name — the database
 * should not know what a Lucide icon is, and a key survives swapping icon
 * libraries. Unknown keys fall back to a default at render time, so removing
 * one from this list never breaks an existing subject.
 */
export const SUBJECT_ICONS = [
  "book",
  "flask",
  "calculator",
  "globe",
  "code",
  "palette",
  "music",
  "dumbbell",
  "scroll",
  "leaf",
] as const;

export type SubjectIcon = (typeof SUBJECT_ICONS)[number];

/**
 * Bounds for the academic year, matching the CHECK constraint in the Sprint 22
 * migration. A sanity check rather than a policy: it catches a mistyped 202
 * while leaving room for someone entering next year's classes early.
 */
export const ACADEMIC_YEAR_MIN = 2000;
export const ACADEMIC_YEAR_MAX = 2100;

/** "2025–2026" from 2025. An en dash, because it is a range, not a hyphenation. */
export function formatAcademicYear(startYear: number): string {
  return `${startYear}–${startYear + 1}`;
}

/**
 * The years worth offering in a dropdown, newest first.
 *
 * A span around today rather than the full 2000–2100 range the constraint
 * allows: a student is enrolling for this year or the next one, and a hundred
 * options to scroll past is a worse control than eight.
 */
export function academicYearOptions(today: Date): number[] {
  const current = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return [current + 1, current, current - 1, current - 2, current - 3, current - 4];
}

export const subjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the subject a name.")
    .max(120, "Names are limited to 120 characters."),
  colorSlot: z.coerce.number().int().min(1, "Pick a colour.").max(5, "Pick a colour."),
  icon: z.enum(SUBJECT_ICONS).nullable().catch(null),
  semester: z
    .string()
    .trim()
    .max(60, "Semester is limited to 60 characters.")
    .transform((value) => (value.length === 0 ? null : value))
    .nullable(),
  /**
   * The academic year's STARTING year — 2025 means 2025–2026 (FR-S6, US-B6).
   *
   * An empty select posts `""`, which `z.coerce.number()` would happily turn
   * into 0 and then reject as out of range with a message about the year 2000.
   * The pre-transform maps empty to null first, so "I did not set one" reads as
   * unset rather than as an error.
   */
  academicYear: z
    .preprocess(
      (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
      z
        .number()
        .int()
        .min(ACADEMIC_YEAR_MIN, "Pick an academic year.")
        .max(ACADEMIC_YEAR_MAX, "Pick an academic year.")
        .nullable(),
    )
    .catch(null),
});

export type SubjectInput = z.infer<typeof subjectSchema>;

/** What a student types to confirm deleting a subject (US-B3). */
export const DELETE_SUBJECT_CONFIRMATION = "DELETE";
