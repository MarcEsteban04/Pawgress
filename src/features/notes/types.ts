import { type FieldErrors } from "@/lib/validation/form";
import { type NoteInput } from "@/lib/validation/note";

/**
 * Note form contracts.
 *
 * Separate from `server/actions.ts` because a `"use server"` module may export
 * only async functions.
 */

export type NoteFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  nextStep?: string;
  fieldErrors?: FieldErrors<NoteInput>;
  /**
   * Whether the saved edit actually changed the text.
   *
   * A title-only edit does not invalidate the note's chunks, so the editor says
   * "Saved" rather than implying Pawgress is re-reading something it is not
   * (US-C3).
   */
  reindexed?: boolean;
};

export const initialNoteState: NoteFormState = { status: "idle" };
