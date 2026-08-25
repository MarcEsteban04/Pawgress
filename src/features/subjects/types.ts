/**
 * Subject form contract.
 *
 * Separate from `server/actions.ts` because a `"use server"` module may export
 * only async functions.
 */
export type SubjectFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  nextStep?: string;
  fieldErrors?: Partial<
    Record<"name" | "colorSlot" | "icon" | "semester" | "confirmation", string>
  >;
  /**
   * Set when the name already exists. Not an error — US-B1 allows duplicates
   * and asks that the student be told, so this rides alongside a success.
   */
  duplicateWarning?: string;
};

export const initialSubjectState: SubjectFormState = { status: "idle" };
