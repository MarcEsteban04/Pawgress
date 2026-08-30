import { z } from "zod";

/**
 * The shape of a generated reviewer (FR-R1, Sprint 43).
 *
 * Sent to the provider as a JSON schema, not merely used to validate what comes
 * back: structured output is enforced at the API boundary and parsed through
 * Zod, so a malformed generation is a failed job rather than something a screen
 * has to cope with (NFR-R4).
 *
 * **Bounded everywhere, and the bounds are the design.** A model given "produce
 * key terms" with no ceiling will produce forty, and a reviewer with forty
 * terms is a glossary a student will not read. The limits here are what makes
 * the output a study aid rather than a transcript with headings.
 */

export const reviewerSchema = z.object({
  /** One line a student would recognise on a list, not a restatement of the topic. */
  title: z.string().min(1).max(120),

  /**
   * The whole thing in a breath.
   *
   * First because it is what a student reads when they have two minutes, and
   * because a summary written after the detail tends to summarise the detail
   * rather than the subject.
   */
  summary: z.string().min(1).max(1200),

  /** What this is actually about. Three to six — fewer is thin, more is a list. */
  concepts: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        /** Two or three sentences. Longer and it stops being a concept card. */
        explanation: z.string().min(1).max(700),
      }),
    )
    .min(1)
    .max(6),

  /** Vocabulary a student would lose marks for not knowing. */
  terms: z
    .array(
      z.object({
        term: z.string().min(1).max(80),
        definition: z.string().min(1).max(400),
      }),
    )
    .max(12),

  /**
   * What to revise first.
   *
   * The one part that is advice rather than content, and the reason a reviewer
   * beats re-reading the file: a student who knows where to start has already
   * got value before reading a word of the rest.
   */
  focus: z.array(z.string().min(1).max(200)).max(4),
});

export type ReviewerContent = z.infer<typeof reviewerSchema>;

/** The instruction. Kept beside the schema so the two are read together. */
export const REVIEWER_PROMPT = [
  "Write a revision aid from the student's material above.",
  "",
  "- Cover what the material actually contains. Do not add topics it does not",
  "  raise, however standard they are for the subject — a reviewer that quietly",
  "  includes the syllabus rather than the material is worse than a short one,",
  "  because the student cannot tell which is which.",
  "- If the material is thin, produce a short reviewer and say what is missing",
  "  in the summary. Padding is the failure mode here.",
  "- Terms are ones a student would lose marks for not knowing, defined as the",
  "  material defines them.",
  "- `focus` is advice: what to revise first, and why, in one line each.",
  "- Write plainly, in the second person, for someone short of time.",
].join("\n");
