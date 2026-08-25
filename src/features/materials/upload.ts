import { type MaterialKind } from "@/types";

/**
 * The upload contract, shared by the browser and the server (FR-U1, US-C1).
 *
 * **The file never passes through Next.** The browser asks a Server Action for
 * a signed upload URL, PUTs the bytes straight to Supabase Storage, then tells
 * a second action to record the row. That is not an optimisation, it is the
 * only design that works: a Server Action body is capped at 1 MB by default,
 * and on a serverless host the request limit is around 4.5 MB — well under the
 * 25 MB the bucket accepts. Proxying the bytes would fail on exactly the files
 * students most want to upload.
 *
 * It also buys Sprint 27 for free: a browser upload can report real progress
 * and be aborted. A Server Action can do neither.
 *
 * This module is imported by both halves, so it must stay free of
 * `server-only` and of anything DOM-shaped.
 */

/**
 * What the picker offers and the bucket accepts.
 *
 * Narrower than the bucket's own list on purpose. `allowed_mime_types` still
 * carries `application/msword` and `application/vnd.ms-powerpoint` from
 * Sprint 16, but the extraction pipeline cannot read legacy `.doc`/`.ppt`, and
 * accepting a file we will only fail to process later is a worse experience
 * than declining it while the student still has the original open.
 */
export const MATERIAL_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

/** Extensions for the file picker, which matches on those as well as MIME. */
export const MATERIAL_EXTENSIONS = ".pdf,.docx,.pptx,.jpg,.jpeg,.png,.webp,.heic";

const MIME_TO_MATERIAL_KIND: Record<string, MaterialKind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/heic": "image",
};

/**
 * The database's `material_kind`, from a MIME type.
 *
 * Every image collapses to `image` because that is the distinction the product
 * makes: PDFs, Word and PowerPoint files get parsed, images get OCR'd
 * (Sprint 33). Whether a photo is a JPEG or a PNG changes nothing downstream,
 * so storing it would be a column nobody reads.
 */
export function materialKindFor(mimeType: string): MaterialKind | null {
  return MIME_TO_MATERIAL_KIND[mimeType] ?? null;
}

export const KIND_LABELS: Record<MaterialKind, string> = {
  pdf: "PDF",
  docx: "Word",
  pptx: "PowerPoint",
  image: "Image",
  note: "Note",
};

/** "4.2 MB", "312 KB". Bytes are never shown raw — nobody reads 4404019. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * A title from a filename: extension gone, separators turned back into spaces.
 *
 * `BIO101_lecture-03.pdf` becomes `BIO101 lecture 03`, which is what a student
 * would have typed. The original filename is not lost — it is the tail of the
 * storage path — but a library listing full of underscores is a library nobody
 * skims.
 */
export function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const spaced = withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (spaced || "Untitled").slice(0, 300);
}

export type UploadTicket = {
  /** Object path inside the materials bucket, chosen by the server. */
  path: string;
  /** Single-use token the browser PUTs against. */
  token: string;
};

export type UploadOutcome =
  { status: "done"; materialId: string } | { status: "error"; message: string; nextStep: string };
