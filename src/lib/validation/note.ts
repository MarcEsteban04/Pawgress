import { z } from "zod";

/**
 * Typed note input (FR-U5, US-C3).
 *
 * A note is a material with no file: the student types the text instead of
 * uploading something for extraction to read. The title bound mirrors the
 * `materials.title` CHECK constraint from Sprint 13 — 1–300 characters.
 *
 * The body bound is ours, not the database's. Postgres `text` has no practical
 * limit, but every character eventually gets chunked and embedded, and that is
 * paid for per token (NFR-C1, NFR-C4). 50,000 characters is roughly 25 pages of
 * typed prose — far more than anyone types into one note, and low enough that a
 * paste of an entire textbook is refused with an explanation rather than
 * silently costing a fortune.
 */

export const NOTE_BODY_MAX = 50_000;

export const noteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the note a title.")
    .max(300, "Titles are limited to 300 characters."),
  body: z
    .string()
    .trim()
    .min(1, "Write something first — an empty note has nothing to study from.")
    .max(
      NOTE_BODY_MAX,
      `Notes are limited to ${NOTE_BODY_MAX.toLocaleString()} characters. Split a longer one into two.`,
    ),
  /* An empty topic select posts "", which is not a uuid. Null means "filed
     under the subject only", which is a legitimate state. */
  topicId: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable(),
});

export type NoteInput = z.infer<typeof noteSchema>;
