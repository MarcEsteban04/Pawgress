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

/**
 * What is actually STORED in `reviewers.content` (Sprint 46).
 *
 * Deliberately not the same object as `reviewerSchema`. That one is the
 * generation contract: it is converted to a strict JSON schema and handed to
 * the provider, where every property is required and an extra one is something
 * the model will dutifully invent. These three are ours — written by the
 * student or by the editor — and a model asked to produce `editedAt` would.
 *
 * They live in the jsonb rather than in columns because the whole document is
 * always read and written as a unit: one write updates the content and its
 * provenance together, with no window in which the two disagree. It also means
 * the editor needed no migration.
 */
export const reviewerDocumentSchema = reviewerSchema.extend({
  /**
   * The student's own additions.
   *
   * Kept separate from everything generated, and labelled as theirs on screen.
   * Merging a student's note into the summary would destroy the one distinction
   * this product cannot afford to lose: which words came from their material
   * and which came from them.
   */
  notes: z.array(z.string().min(1).max(2000)).max(20).optional(),

  /**
   * When a human last changed this, if ever.
   *
   * Its presence is what retires the "Written by Aki from N files" line. Once a
   * student has edited a reviewer that sentence is false, and a footer that
   * keeps claiming it is the product lying about its own provenance.
   */
  editedAt: z.string().optional(),

  /**
   * The section a regeneration job is currently rewriting.
   *
   * The jobs table has no payload column, so the request rides with the
   * document it is about. Cleared by the handler when it finishes, which also
   * makes it self-healing: a job that dies leaves a flag the next successful
   * run overwrites.
   */
  pendingSection: z.enum(["summary", "concepts", "terms", "focus"]).optional(),
});

export type ReviewerDocument = z.infer<typeof reviewerDocumentSchema>;

/** The sections a student can regenerate or clear, in the order they appear. */
export const REVIEWER_SECTIONS = ["summary", "focus", "concepts", "terms"] as const;
export type ReviewerSection = (typeof REVIEWER_SECTIONS)[number];

/**
 * One section at a time, validated against the SAME bounds as a full
 * generation.
 *
 * Derived from `reviewerSchema.shape` rather than restated: a regenerated
 * concepts list that could hold forty entries because someone edited one file
 * and not the other is exactly the drift these bounds exist to prevent.
 */
export const SECTION_SCHEMAS = {
  summary: z.object({ summary: reviewerSchema.shape.summary }),
  concepts: z.object({ concepts: reviewerSchema.shape.concepts }),
  terms: z.object({ terms: reviewerSchema.shape.terms }),
  focus: z.object({ focus: reviewerSchema.shape.focus }),
} as const;

export const SECTION_LABELS: Record<ReviewerSection, string> = {
  summary: "Summary",
  focus: "Revise first",
  concepts: "Key concepts",
  terms: "Key terms",
};

/** What to ask for when only one section is being rewritten. */
export const SECTION_PROMPTS: Record<ReviewerSection, string> = {
  summary:
    "Rewrite ONLY the summary: the whole subject in a breath, for a student with two minutes. Do not summarise the sections below it — summarise the material.",
  concepts:
    "Rewrite ONLY the key concepts: three to six things the material is actually about, each explained in two or three sentences.",
  terms:
    "Rewrite ONLY the key terms: vocabulary a student would lose marks for not knowing, defined as the material defines it.",
  focus:
    "Rewrite ONLY the advice on what to revise first: up to four lines, each saying what to start with and why.",
};

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
