import { AppError } from "@/lib/errors";

/**
 * Upload validation (Sprint 17 — FR-U2, NFR-R3, NFR-S5).
 *
 * **`file.type` comes from the browser and is attacker-controlled.** Renaming
 * `payload.html` to `notes.pdf` sets it to `application/pdf`, and every check
 * that trusts it passes. So the bytes are sniffed: the declared type must match
 * what the file actually begins with.
 *
 * That is not a virus scanner and does not pretend to be. It stops the obvious
 * mislabelling, and it stops the extraction pipeline in Sprint 32 being handed
 * something that is not the format it was told to parse.
 */

export type UploadKind = "pdf" | "docx" | "pptx" | "jpeg" | "png" | "webp" | "heic";

/**
 * Leading bytes, as hex. Only formats we accept are listed — an unknown
 * signature is a rejection, not a shrug.
 *
 * DOCX and PPTX are both Zip archives, so they share `PK\x03\x04` and cannot be
 * told apart from the first bytes alone. They are treated as one "zip-office"
 * family and separated by the declared type, which is as far as it is worth
 * going without unzipping the container.
 */
const SIGNATURES: { kind: UploadKind | "zip-office"; offset: number; bytes: number[] }[] = [
  { kind: "pdf", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { kind: "zip-office", offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK..
  { kind: "zip-office", offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] }, // empty archive
  { kind: "jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { kind: "png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // RIFF....WEBP — the middle four bytes are the file size, so they are skipped.
  { kind: "webp", offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  // ftypheic / ftypheix / ftypmif1, at offset 4 inside the ISO-BMFF box header.
  { kind: "heic", offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
];

const MIME_TO_KIND: Record<string, UploadKind> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** Human names, for messages a student reads. */
const KIND_LABELS: Record<UploadKind, string> = {
  pdf: "PDF",
  docx: "Word document",
  pptx: "PowerPoint file",
  jpeg: "JPEG image",
  png: "PNG image",
  webp: "WebP image",
  heic: "HEIC image",
};

function matches(bytes: Uint8Array, signature: (typeof SIGNATURES)[number]): boolean {
  const { offset, bytes: expected } = signature;
  if (bytes.length < offset + expected.length) return false;
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

/** What the leading bytes actually say this file is. */
export function sniffKind(header: Uint8Array): UploadKind | "zip-office" | null {
  for (const signature of SIGNATURES) {
    if (matches(header, signature)) return signature.kind;
  }
  return null;
}

export type FileRule = {
  /** Accepted MIME types — the same list the bucket enforces. */
  accept: readonly string[];
  maxBytes: number;
  /** Used in messages: "up to 2 MB". */
  label: string;
};

/**
 * Validates one uploaded file, reading enough of it to check the signature.
 *
 * Returns the file on success rather than a bare `null`, so the caller ends up
 * with a properly typed `File` — a validator that only says "fine" leaves
 * every call site casting an `unknown` it was just told is safe.
 *
 * Every failure carries a next step, because "invalid file" tells a student
 * nothing they can act on (docs/states.md §5).
 */
export type UploadCheck = { ok: true; file: File } | { ok: false; error: AppError };

const reject = (error: AppError): UploadCheck => ({ ok: false, error });

export async function validateUpload(file: unknown, rule: FileRule): Promise<UploadCheck> {
  if (!(file instanceof File) || file.size === 0) {
    return reject(
      new AppError({
        code: "validation",
        message: "No file was chosen.",
        nextStep: `Pick a ${rule.label} and try again.`,
      }),
    );
  }

  if (file.size > rule.maxBytes) {
    const limitMb = Math.max(1, Math.round(rule.maxBytes / (1024 * 1024)));
    return reject(
      new AppError({
        code: "validation",
        message: `That file is larger than ${limitMb} MB.`,
        nextStep: "Try a smaller one, or split it into parts.",
        context: { size: file.size, limit: rule.maxBytes },
      }),
    );
  }

  if (!rule.accept.includes(file.type)) {
    return reject(
      new AppError({
        code: "unreadable_file",
        message: "That file type is not supported.",
        nextStep: `Use a ${rule.label}.`,
        context: { declared: file.type },
      }),
    );
  }

  // 16 bytes is enough for every signature above, including WebP at offset 8.
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffKind(header);
  const declared = MIME_TO_KIND[file.type];

  if (!sniffed) {
    return reject(
      new AppError({
        code: "unreadable_file",
        message: "That file does not look like the type it claims to be.",
        nextStep: "Re-export or re-save it, then upload again.",
        context: { declared: file.type },
      }),
    );
  }

  const consistent =
    sniffed === declared ||
    // Both Office formats are Zip containers; the declared type separates them.
    (sniffed === "zip-office" && (declared === "docx" || declared === "pptx"));

  if (!consistent) {
    return reject(
      new AppError({
        code: "unreadable_file",
        message: `That is not a ${declared ? KIND_LABELS[declared] : "supported file"}.`,
        nextStep: "Check you picked the right file — the contents do not match the extension.",
        context: { declared: file.type, sniffed },
      }),
    );
  }

  return { ok: true, file };
}

/* ------------------------------------------------------------------------- */
/* Sprint 26 — verifying the bytes that actually landed                       */
/* ------------------------------------------------------------------------- */

/**
 * Checks a STORED object against the type it was uploaded as (FR-U2, US-C2).
 *
 * `validateUpload()` runs in the browser from Sprint 25 onward, because the
 * bytes go straight to Supabase Storage and the server never sees the request
 * body. That check buys a student instant feedback; it cannot be the gate,
 * since anything running in a browser can be skipped. This is the gate, and it
 * runs against what is in the bucket.
 *
 * It reads two small windows rather than the file: the first 16 bytes for the
 * signature, and — for PDFs — the last few kilobytes for the trailer.
 *
 * The failures are separated because "we could not read your file" is useless
 * advice. A student whose PDF has a password can remove it; a student who
 * picked the wrong file can pick again; a student whose export truncated needs
 * to export again. One message for all three teaches them to ignore it.
 */
export type StoredCheck = { ok: true } | { ok: false; error: AppError };

/** Bytes are compared as Latin-1 so a marker search never re-encodes them. */
function includesAscii(bytes: Uint8Array, needle: string): boolean {
  const text = new TextDecoder("latin1").decode(bytes);
  return text.includes(needle);
}

export function verifyStoredHead(head: Uint8Array | null, declaredMime: string): StoredCheck {
  if (!head || head.length === 0) {
    return {
      ok: false,
      error: new AppError({
        code: "unreadable_file",
        message: "We could not read that file after uploading it.",
        nextStep: "Try uploading it again.",
      }),
    };
  }

  const declared = MIME_TO_KIND[declaredMime];
  const sniffed = sniffKind(head);

  if (!sniffed) {
    return {
      ok: false,
      error: new AppError({
        code: "unreadable_file",
        message: "That file is not readable as the type it was sent as.",
        nextStep: "Re-export or re-save it, then upload again.",
        context: { declared: declaredMime },
      }),
    };
  }

  const consistent =
    sniffed === declared ||
    (sniffed === "zip-office" && (declared === "docx" || declared === "pptx"));

  if (!consistent) {
    return {
      ok: false,
      error: new AppError({
        code: "unreadable_file",
        message: `That file is not a ${declared ? KIND_LABELS[declared] : "supported file"}.`,
        nextStep: "Check you picked the right file — its contents do not match its type.",
        context: { declared: declaredMime, sniffed },
      }),
    };
  }

  return { ok: true };
}

/**
 * PDF-specific checks that need the end of the file (US-C2).
 *
 * **Password-protected.** An encrypted PDF has an `/Encrypt` entry in its
 * trailer dictionary. Every page of it will come back as noise from the
 * extractor in Sprint 32, so catching it now turns "processing failed" into a
 * sentence naming the actual problem.
 *
 * **Truncated.** A complete PDF ends with `%%EOF`. A download that stopped
 * halfway, or an export that ran out of disk, will not — and that is worth
 * saying now rather than after the student waits for extraction.
 *
 * Both are heuristics on the last few kilobytes rather than a parse. A PDF
 * using cross-reference streams can put the encryption entry outside this
 * window, so a false NEGATIVE is possible: the file is accepted and fails later
 * with a clear message from the extractor. That is the right way round —
 * refusing a valid file is worse than accepting one we cannot fully check.
 *
 * **Image-only PDFs are NOT detected here.** Deciding that a PDF has no text
 * layer means extracting it, which is Sprint 32; OCR for that case is Sprint 33.
 * US-C2 asks for the distinction, and this is the half that can honestly be
 * made before the pipeline exists.
 */
export function verifyStoredPdfTail(tail: Uint8Array | null): StoredCheck {
  if (!tail || tail.length === 0) return { ok: true };

  if (includesAscii(tail, "/Encrypt")) {
    return {
      ok: false,
      error: new AppError({
        code: "unreadable_file",
        message: "That PDF is password-protected.",
        nextStep: "Open it, save a copy without the password, and upload that.",
      }),
    };
  }

  if (!includesAscii(tail, "%%EOF")) {
    return {
      ok: false,
      error: new AppError({
        code: "unreadable_file",
        message: "That PDF looks incomplete.",
        nextStep: "It may not have finished downloading. Get a fresh copy and try again.",
      }),
    };
  }

  return { ok: true };
}
