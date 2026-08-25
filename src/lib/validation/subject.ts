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
});

export type SubjectInput = z.infer<typeof subjectSchema>;

/** What a student types to confirm deleting a subject (US-B3). */
export const DELETE_SUBJECT_CONFIRMATION = "DELETE";
