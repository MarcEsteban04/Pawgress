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

export type UploadTicketResult =
  { status: "ok"; ticket: UploadTicket } | { status: "error"; message: string; nextStep: string };

export const initialMaterialState: MaterialFormState = { status: "idle" };
