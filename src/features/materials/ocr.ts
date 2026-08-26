/**
 * OCR values shared by the browser and the server (Sprint 33).
 *
 * Split out of `lib/extraction/ocr.ts` because that module is `server-only` —
 * it holds the API key path and the prompt — while the library row and the
 * viewer both need the threshold to decide whether to warn. Importing the
 * server module from a client component fails the build, which is the guard
 * working rather than an inconvenience.
 *
 * Free of `server-only` and of anything DOM-shaped, like `upload.ts`.
 */

/** The four media types the API accepts. HEIC is not among them. */
export const OCR_MEDIA_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
} as const;

export type OcrMediaType = (typeof OCR_MEDIA_TYPES)[keyof typeof OCR_MEDIA_TYPES];

/**
 * Byte ceiling for one image.
 *
 * Base64 inflates by a third, so 5 MB of image is about 6.7 MB on the wire —
 * inside request limits, and far more resolution than a photo of a page needs.
 * The bucket allows 25 MB, so this refusal is real: a student with a 20 MB photo
 * is told to send a smaller one rather than watching a request fail for reasons
 * nobody explains.
 */
export const MAX_OCR_BYTES = 5 * 1024 * 1024;

/**
 * Below this, a transcription is shown with a warning rather than presented as
 * fact (US-C7). Not a rejection: a rough reading of a student's own notes is
 * still more use to them than nothing, as long as they know it is rough.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export function ocrMediaTypeFor(storagePath: string): OcrMediaType | null {
  const extension = storagePath.toLowerCase().split(".").pop() ?? "";
  return (OCR_MEDIA_TYPES as Record<string, OcrMediaType>)[extension] ?? null;
}
