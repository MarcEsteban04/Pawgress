import "server-only";

import { AppError, errors } from "@/lib/errors";
import { type MaterialKind } from "@/types";
import { extractDocx, extractPptx } from "./ooxml";
import {
  MIN_USABLE_CHARACTERS,
  normaliseDocument,
  type ExtractedPage,
  type NormalisedDocument,
} from "./normalize";

/**
 * Text extraction (FR-P1, US-D3).
 *
 * One entry point, one shape out. Callers pass bytes and a kind and get
 * normalised text plus the page offsets a citation needs — they never learn
 * which library read which format.
 */

export type { NormalisedDocument, PageOffset } from "./normalize";

/**
 * PDF page cap.
 *
 * `AI_QUOTAS.maxPagesPerDocument` is the product limit; this is where it bites.
 * A document over the cap is refused with an explanation rather than truncated,
 * because a reviewer silently built from the first 100 pages of a 400-page book
 * is worse than one that never appeared: the student cannot tell what is
 * missing.
 */
export const MAX_PAGES = 100;

async function extractPdf(bytes: Uint8Array): Promise<ExtractedPage[]> {
  /* Imported lazily. unpdf pulls in pdf.js, which is large, and only a PDF job
     needs it — a DOCX upload should not pay for loading a PDF engine. */
  const { extractText, getDocumentProxy } = await import("unpdf");

  const pdf = await getDocumentProxy(bytes);
  if (pdf.numPages > MAX_PAGES) {
    throw new AppError({
      code: "unreadable_file",
      message: `This PDF has ${pdf.numPages} pages, and we read up to ${MAX_PAGES}.`,
      nextStep: `Split it and upload the part you are studying — a reviewer built from ${MAX_PAGES} pages of a longer book would quietly leave things out.`,
    });
  }

  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((pageText, index) => ({ page: index + 1, text: pageText }));
}

/**
 * Extract and normalise one material.
 *
 * Throws an `AppError` carrying student-readable copy. Every failure here is
 * something the student can act on — a scan, an over-long book, a corrupt file —
 * so none of them are logged as bugs (docs/states.md §5).
 */
export async function extractMaterial(
  kind: MaterialKind,
  bytes: Uint8Array,
): Promise<NormalisedDocument> {
  let pages: ExtractedPage[];

  try {
    switch (kind) {
      case "pdf":
        pages = await extractPdf(bytes);
        break;
      case "docx":
        pages = extractDocx(bytes);
        break;
      case "pptx":
        pages = extractPptx(bytes);
        break;
      case "image":
        /* Images need OCR, which is Sprint 33. Distinguished from "we tried and
           failed" so the status the student sees is honest. */
        throw new AppError({
          code: "unreadable_file",
          message: "Reading text out of photos is not switched on yet.",
          nextStep: "Type the key parts as a note for now — notes work exactly like uploads.",
        });
      case "note":
        // A note's text is authored, not extracted; nothing to do here.
        throw new AppError({
          code: "validation",
          message: "A note does not need extracting.",
          nextStep: "This is a bug — please report it.",
          context: { kind },
        });
    }
  } catch (thrown) {
    if (thrown instanceof AppError) throw thrown;
    /* A malformed ZIP or a PDF pdf.js cannot parse lands here. The upload
       already passed a signature check in Sprint 26, so this is a genuinely
       broken or unusual file rather than a wrong type. */
    throw errors.unreadableFile(
      "We could not read this file.",
      "It may be corrupt or password-protected. Try re-saving it and uploading again.",
    );
  }

  const document = normaliseDocument(pages);

  if (document.textLength < MIN_USABLE_CHARACTERS) {
    /* The scanned-handout case, and the single most common real-world failure
       with teacher material. Named precisely, because "extraction failed" would
       send a student looking for a problem with their upload. */
    if (kind === "pdf") throw errors.imageOnlyPdf();
    throw errors.unreadableFile(
      "There is almost no text in this file.",
      "If the content is pictures of text, type the key parts as a note instead.",
    );
  }

  return document;
}
