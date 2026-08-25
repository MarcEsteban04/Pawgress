import { z } from "zod";

/**
 * Profile input (FR-A7).
 *
 * Every bound here mirrors a CHECK constraint in the Sprint 13 migration. They
 * are duplicated on purpose: the database is the one that cannot be bypassed,
 * and this one exists so a student gets "80 characters maximum" instead of a
 * constraint-violation error they cannot act on.
 *
 * Students may be minors, so the rule from NFR-P1 applies to what is asked for:
 * collect only what a feature needs. Year level and school feed the study
 * planner's expectations about term structure; both stay optional, and there is
 * no date of birth, no phone number, and no full legal name.
 */

/** Matches `preferred_session_minutes between 5 and 240`. */
export const SESSION_MINUTE_OPTIONS = [15, 25, 30, 45, 60, 90] as const;

/**
 * Year levels for high school and college. Free text would be more flexible,
 * but a bounded list is what lets the planner reason about a school year later
 * without parsing "Grade 11 - STEM" by hand.
 */
export const YEAR_LEVELS = [
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "College 1st year",
  "College 2nd year",
  "College 3rd year",
  "College 4th year",
  "College 5th year",
  "Postgraduate",
  "Other",
] as const;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is limited to ${max} characters.`)
    // An empty field means "not set", which is null in the database, not "".
    .transform((value) => (value.length === 0 ? null : value))
    .nullable();

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Your name cannot be empty.")
    .max(80, "Names are limited to 80 characters."),
  yearLevel: optionalText(40, "Year level"),
  school: optionalText(120, "School"),
  preferredSessionMinutes: z.coerce
    .number()
    .int("Choose a whole number of minutes.")
    .min(5, "Sessions are at least 5 minutes.")
    .max(240, "Sessions are at most 240 minutes."),
  /**
   * IANA zone, detected in the browser. It matters more than it looks: a study
   * plan is built around what "today" means, and a student in Manila with a
   * server assuming UTC loses eight hours of it.
   */
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine((value) => {
      try {
        // The runtime's own tz database is the only list worth validating against.
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "That is not a timezone we recognise."),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/** What a student must type to delete their account (US-A5). */
export const DELETE_CONFIRMATION = "DELETE";
