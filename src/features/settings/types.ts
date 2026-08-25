/**
 * Settings form contract.
 *
 * Separate from `server/actions.ts` because a `"use server"` module may export
 * only async functions — a single exported constant there makes the whole
 * module export nothing, and the build error does not name the constant that
 * caused it.
 */
export type SettingsFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  nextStep?: string;
  fieldErrors?: Partial<Record<"displayName" | "yearLevel" | "school" | "confirmation", string>>;
};

export const initialSettingsState: SettingsFormState = { status: "idle" };
