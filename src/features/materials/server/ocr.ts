"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cleanText } from "@/lib/sanitize";
import { getMaterial } from "@/server/materials/queries";
import { requireSession } from "@/server/auth/session";
import { type MaterialFormState } from "../types";

/**
 * Correcting a transcription (US-C7).
 *
 * **This is not "editing an uploaded file", and the distinction is the whole
 * reason it is allowed.** Sprint 30 refuses to let a student edit an upload's
 * extracted text, because that text is what an extractor read from bytes we did
 * not write — changing it would make every citation point at something the file
 * does not say.
 *
 * OCR is different in kind. The transcription is a GUESS about a photograph, and
 * the student is the one person who knows what their own handwriting says. Their
 * correction is more authoritative than the model's reading, not less.
 *
 * Saving a correction clears `ocr_confidence`: the text is no longer a guess, so
 * a warning about how confident the model was is no longer true. Once chunking
 * lands in Sprint 34 this will also drop the stale chunks, for the same reason
 * editing a note does.
 */
export async function correctOcrTextAction(
  _prevState: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("text") ?? "");
  const text = cleanText(raw);

  if (!id) {
    return {
      status: "error",
      message: "We could not tell which image to update.",
      nextStep: "Reload the page and try again.",
    };
  }

  if (text.length === 0) {
    return {
      status: "error",
      message: "The text cannot be empty.",
      nextStep: "If the photo has no text in it, delete the image instead.",
    };
  }

  /* Read through the DAL: this confirms the material is the caller's AND that it
     is an image, so the endpoint cannot be used to rewrite a PDF's extraction. */
  const material = await getMaterial(id);
  if (!material) {
    return {
      status: "error",
      message: "That image is no longer in your library.",
      nextStep: "Reload the page.",
    };
  }

  if (material.kind !== "image") {
    return {
      status: "error",
      message: "Only a photo's transcription can be corrected.",
      nextStep:
        "For a PDF or a document the text has to match the file — replace the upload instead.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("materials")
    .update({
      extracted_text: text,
      // No longer a guess, so there is nothing to be unconfident about.
      ocr_confidence: null,
      status: "ready",
    })
    .eq("id", id);

  if (error) {
    return {
      status: "error",
      message: "We could not save that.",
      nextStep: "Try again in a moment.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "saved" };
}
