import { z } from "zod";

/**
 * Generated flashcards (FR-R2, US-F2, Sprint 44).
 *
 * **A card is a question, not a heading.** The failure mode of generated cards
 * is a front that says "Mitochondria" and a back that says three paragraphs —
 * which is not a card, it is a page cut in half. The bounds enforce the shape:
 * a front short enough to be a prompt, a back short enough to be recalled.
 */

export const flashcardSetSchema = z.object({
  cards: z
    .array(
      z.object({
        /**
         * The prompt. Must be answerable — a question, a term to define, a
         * process to state.
         */
        front: z.string().min(1).max(200),
        /**
         * What a student should be able to say. One or two sentences: anything
         * a person cannot hold in their head is not being tested by a card.
         */
        back: z.string().min(1).max(400),
      }),
    )
    .min(4)
    .max(20),
});

export type FlashcardSet = z.infer<typeof flashcardSetSchema>;

export const FLASHCARD_PROMPT = [
  "Turn the revision aid above into flashcards.",
  "",
  "- Each front is a QUESTION or a prompt that can be answered, never a bare",
  "  heading. 'Mitochondria' is a topic; 'What do mitochondria produce, and",
  "  how?' is a card.",
  "- Each back is what a student should be able to say from memory. One or two",
  "  sentences. If it cannot be recalled in one breath, split it into two cards.",
  "- One idea per card. A card testing two things is marked wrong for knowing",
  "  half, which teaches nothing.",
  "- Cover the concepts and the terms. Skip anything the material only mentions",
  "  in passing — a card on a detail nobody will be asked is time taken from one",
  "  that matters.",
  "- Do not invent. Every card comes from the revision aid above.",
].join("\n");
