import { type UploadTicket } from "./upload";

/**
 * Material action contracts.
 *
 * Separate from `server/actions.ts` because a `"use server"` module may export
 * only async functions.
 */

export type MaterialFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  nextStep?: string;
  materialId?: string;
};

/** An existing material with the same bytes (FR-U8). */
export type DuplicateMaterial = {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  /** True when it is already in the subject being uploaded to. */
  sameSubject: boolean;
};

export type UploadTicketResult =
  | { status: "ok"; ticket: UploadTicket }
  | { status: "duplicate"; existing: DuplicateMaterial }
  | { status: "error"; message: string; nextStep: string };

/** The result of checking the bytes that actually landed (FR-U2). */
export type VerifyResult =
  { status: "ok" } | { status: "error"; message: string; nextStep: string };

export const initialMaterialState: MaterialFormState = { status: "idle" };
