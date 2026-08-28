import "server-only";

import { z } from "zod";
import { getAiService } from "@/lib/ai";
import { type ImageInput } from "@/lib/ai/types";
import { MAX_OCR_BYTES, ocrMediaTypeFor } from "@/features/materials/ocr";
import { AppError } from "@/lib/errors";

/**
 * OCR (FR-U7, US-C7).
 *
 * **Why the model reads the image rather than Tesseract.**
 *
 * The obvious choice is `tesseract.js`, and it is the wrong one here for four
 * reasons, in order of how much they matter:
 *
 *  1. **Handwriting.** The main thing students photograph is their own notes.
 *     Tesseract is built for printed text and is poor at handwriting; a
 *     vision-capable model is genuinely good at it. An OCR pipeline that cannot
 *     read handwriting solves the wrong half of the problem.
 *  2. **Confidence that means something.** US-C7 requires telling a student when
 *     a reading is shaky. Tesseract reports per-character confidence, which
 *     averages into a number that does not correlate with whether the *text*
 *     makes sense. A model can be asked, and can say "this is a blurry photo of
 *     handwriting at an angle".
 *  3. **No new machinery.** This call inherits quotas, rate limiting, cost
 *     accounting, error mapping and structured output from Sprint 31. Tesseract
 *     brings a 10 MB WASM binary plus per-language training data that has to be
 *     fetched or bundled, on a serverless host, with a cold start per invocation.
 *  4. **Cost is bounded already.** An image is on the order of 1,500 input
 *     tokens; the per-user daily quota is what stops it running away, and it is
 *     the same ceiling every other AI feature sits under.
 *
 * The trade-off, stated plainly: OCR now needs an API key and spends AI quota,
 * where Tesseract would have been free and offline. For a photo of handwriting
 * that is the right trade; if OCR ever needs to be free, this file is the only
 * one that changes.
 *
 * Transcription is not reasoning, so it does not need the strongest model.
 * Which model runs it is per-provider configuration; what this call guarantees
 * is that it reaches a provider that can SEE. Passing `images` filters the
 * chain to vision-capable providers, so Groq — whose default is text-only — is
 * skipped rather than handed a photo it would quietly ignore.
 */

export { MAX_OCR_BYTES, ocrMediaTypeFor };

const ocrSchema = z.object({
  /** The transcription. Empty when the image contains no readable text. */
  text: z.string(),
  /**
   * 0–1, the model's own view of how faithful the transcription is.
   *
   * Asked for explicitly rather than inferred from anything, because the whole
   * point is to be able to warn a student before they revise from it.
   */
  confidence: z.number().min(0).max(1),
  /** Handwriting is the case worth flagging separately in the UI. */
  isHandwritten: z.boolean(),
  /** Set when there is nothing to read, so the caller can say why. */
  isBlank: z.boolean(),
});

export type OcrResult = {
  text: string;
  confidence: number;
  isHandwritten: boolean;
};

const OCR_PROMPT = [
  "Transcribe every piece of text in this image, exactly as written.",
  "",
  "- Preserve the reading order, the line breaks and the structure. A heading",
  "  stays a heading; a numbered list keeps its numbers.",
  "- Transcribe, do not summarise, correct or explain. If the source has a",
  "  spelling mistake, keep it.",
  "- Where a word is genuinely illegible, write [?] in its place rather than",
  "  guessing. A guessed word in a study note is worse than a visible gap.",
  "- Do not describe the image, the paper, or the handwriting.",
  "",
  "Then judge your own transcription:",
  "- confidence: how much of the text you are sure you read correctly. Be",
  "  honest. A clear photo of printed text is near 1; a dim photo of cursive at",
  "  an angle is near 0.3.",
  "- isHandwritten: true if the text is handwritten.",
  "- isBlank: true if there is no readable text at all.",
].join("\n");

/**
 * Read the text out of one image.
 *
 * Throws an `AppError` with copy the student can act on. Every failure mode here
 * is theirs to fix — wrong format, too large, nothing legible in the photo — so
 * none is logged as a bug.
 */
export async function ocrImage(input: {
  userId: string;
  materialId: string;
  bytes: Uint8Array;
  mediaType: ImageInput["mediaType"];
}): Promise<OcrResult> {
  if (input.bytes.byteLength > MAX_OCR_BYTES) {
    throw new AppError({
      code: "unreadable_file",
      message: "This photo is too large to read.",
      nextStep:
        "Take it again at a lower resolution, or crop it to just the page. Around 5 MB is plenty for a page of text.",
    });
  }

  const service = getAiService();

  const { data } = await service.generate(
    {
      userId: input.userId,
      task: "ocr",
      /* Keyed on the material, so a retried job reuses the existing call rather
         than paying to read the same photo twice (NFR-C4). */
      idempotencyKey: `ocr:${input.materialId}`,
    },
    OCR_PROMPT,
    ocrSchema,
    {
      context: [],
      images: [{ mediaType: input.mediaType, base64: Buffer.from(input.bytes).toString("base64") }],
      /* A page of dense handwriting is a few thousand tokens of output; this is
         a runaway guard, not a target. */
      maxOutputTokens: 8_000,
    },
  );

  if (data.isBlank || data.text.trim().length === 0) {
    throw new AppError({
      code: "unreadable_file",
      message: "There is no readable text in this photo.",
      nextStep:
        "Check it is the right image, and that the text is in focus and the right way up. A photo of a diagram with no words will land here too.",
    });
  }

  return {
    text: data.text.trim(),
    confidence: data.confidence,
    isHandwritten: data.isHandwritten,
  };
}
