/**
 * Topic form contract.
 *
 * Separate from `server/actions.ts` because a `"use server"` module may export
 * only async functions.
 */
export type TopicFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  nextStep?: string;
  fieldErrors?: Partial<Record<"name", string>>;
  /**
   * How many topics this form has created, incremented by the action from the
   * previous state.
   *
   * It exists so the create dialog can clear its input after every save without
   * an effect: the form is keyed on this number, so React remounts it on each
   * success. Keying on `status` alone would only work for the first save —
   * "saved" to "saved" is not a change.
   */
  saves?: number;
};

export const initialTopicState: TopicFormState = { status: "idle" };
