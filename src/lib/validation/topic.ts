import { z } from "zod";

/**
 * Topic input (FR-S3, US-B4).
 *
 * Bounds mirror the CHECK constraint in the Sprint 13 migration: 1–160
 * characters.
 *
 * Unlike subjects, topics DO carry a uniqueness rule — the schema has
 * `unique (subject_id, name)`. That is not the mistake Sprint 19 corrected. A
 * student can legitimately run two classes called "Biology" in different
 * semesters, but two topics called "Chapter 3" inside one subject serve no
 * purpose and make every later "tag this material to a topic" choice ambiguous.
 * The check in the action is case-INSENSITIVE, which is stricter than the
 * database's, because "Cell Biology" and "cell biology" are the same chapter to
 * everyone except Postgres.
 */

export const topicSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the topic a name.")
    .max(160, "Topic names are limited to 160 characters."),
});

export type TopicInput = z.infer<typeof topicSchema>;
