/**
 * Text normalisation (FR-P1, US-D3).
 *
 * Extractors return what the file says; this decides what is worth keeping. It
 * matters more than it sounds: everything downstream is chunked, embedded and
 * quoted back to a student, so a page number stuck in the middle of a sentence
 * becomes a page number inside a flashcard, and a hyphen left at a line break
 * becomes "photosyn- thesis" in a quiz answer nobody can match.
 *
 * Deliberately not `server-only`: this is pure string work with no imports, and
 * the same rules should be available to a test or a future client-side preview.
 */

export type ExtractedPage = {
  /** 1-indexed. Page for PDF and DOCX, slide for PPTX. */
  page: number;
  text: string;
};

export type PageOffset = {
  page: number;
  /** Inclusive character index into the joined text. */
  start: number;
  /** Exclusive. */
  end: number;
};

export type NormalisedDocument = {
  text: string;
  offsets: PageOffset[];
  pageCount: number;
  /** Characters of real text after normalisation, for the empty-document check. */
  textLength: number;
};

/**
 * Rejoins words split across a line break.
 *
 * PDFs hyphenate at the right margin, and the hyphen is a typesetting artefact
 * rather than part of the word. Only applied when the break looks like
 * hyphenation — lowercase letter, hyphen, newline, lowercase letter — so a real
 * compound at a line end ("well-\nknown") is left alone by the uppercase and
 * punctuation cases, and an em-dash is never touched.
 */
function rejoinHyphens(text: string): string {
  return text.replace(/([a-z])-\n([a-z])/g, "$1$2");
}

/**
 * Drops lines that are only a page number, or a number with light decoration.
 *
 * "12", "- 12 -", "Page 12", "12 of 40". Not a line containing a number, which
 * would delete real content: the whole line has to be the artefact.
 */
function isRunningNumber(line: string): boolean {
  return /^(?:page\s*)?[-–—|\s]*\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?[-–—|\s]*$/i.test(line.trim());
}

/**
 * Removes headers and footers by finding the lines that repeat across pages.
 *
 * A course title at the top of forty slides is forty copies of the same
 * sentence in the embedding index, which drags every similarity search toward
 * it. Detected rather than configured: a first or last line that appears on more
 * than half the pages is furniture, whatever it says.
 *
 * Skipped for short documents, where "appears on most pages" is not evidence of
 * anything — on a two-page handout it would delete a genuine heading.
 */
function stripRepeatedEdges(pages: ExtractedPage[]): ExtractedPage[] {
  if (pages.length < 4) return pages;

  const counts = new Map<string, number>();
  const bump = (line: string | undefined) => {
    const key = line?.trim();
    if (!key || key.length < 4 || key.length > 120) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  for (const { text } of pages) {
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    bump(lines[0]);
    bump(lines[lines.length - 1]);
  }

  const threshold = Math.ceil(pages.length / 2);
  const furniture = new Set(
    [...counts.entries()].filter(([, count]) => count >= threshold).map(([line]) => line),
  );
  if (furniture.size === 0) return pages;

  return pages.map(({ page, text }) => {
    const lines = text.split("\n");
    // Only the edges: the same string mid-page is likely to be real content.
    while (lines.length > 0 && furniture.has(lines[0]!.trim())) lines.shift();
    while (lines.length > 0 && furniture.has(lines[lines.length - 1]!.trim())) lines.pop();
    return { page, text: lines.join("\n") };
  });
}

function normalisePage(text: string): string {
  return rejoinHyphens(
    text
      // Windows and old Mac line endings, so line logic below sees one shape.
      .replace(/\r\n?/g, "\n")
      // Non-breaking and other exotic spaces read as text but break matching.
      .replace(/[   ⁠]/g, " ")
      // Ligatures pdf.js passes through verbatim; "ﬁ" should match "fi".
      .replace(/ﬁ/g, "fi")
      .replace(/ﬂ/g, "fl"),
  )
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => !isRunningNumber(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Turns per-page extraction into the one string stored on the material, plus the
 * offsets that let a chunk name its page.
 *
 * Empty pages are kept in the offset table and contribute no text — a slide with
 * only an image still exists, and dropping it would shift every later page
 * number by one.
 */
export function normaliseDocument(pages: ExtractedPage[]): NormalisedDocument {
  const cleaned = stripRepeatedEdges(pages).map(({ page, text }) => ({
    page,
    text: normalisePage(text),
  }));

  const SEPARATOR = "\n\n";
  const offsets: PageOffset[] = [];
  let out = "";

  for (const { page, text } of cleaned) {
    if (out.length > 0) out += SEPARATOR;
    const start = out.length;
    out += text;
    offsets.push({ page, start, end: out.length });
  }

  return {
    text: out,
    offsets,
    pageCount: pages.length,
    textLength: out.replace(/\s/g, "").length,
  };
}

/**
 * Below this many non-whitespace characters a document has no usable text.
 *
 * The case this catches is the one that matters most in practice: a scanned
 * handout, which is a PDF of photographs. pdf.js returns a page count and
 * almost nothing else, and without this check the material would be marked
 * ready and then produce an empty reviewer (Sprint 26 deferred this detection
 * to here, because it needs the extractor).
 */
export const MIN_USABLE_CHARACTERS = 40;
