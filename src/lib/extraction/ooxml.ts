import { strFromU8, unzipSync } from "fflate";
import { type ExtractedPage } from "./normalize";

/**
 * DOCX and PPTX extraction (FR-P1, US-D3).
 *
 * Both formats are a ZIP of XML, and the text lives in a handful of known
 * elements. That is why there is no document-parsing dependency here: `mammoth`
 * would convert DOCX to HTML we would immediately throw away, and the PPTX
 * libraries in the ecosystem are thin wrappers over exactly this. More
 * importantly, neither gives us **slide numbers**, and a citation that cannot
 * say "slide 7" is not much of a citation (FR-P6).
 *
 * What this deliberately does not do: styles, tables as tables, images, speaker
 * notes' formatting, numbering. Downstream needs sentences to embed and quote,
 * not a faithful rendering.
 */

/** Pulls the text out of a run of OOXML, in document order. */
function textFromXml(xml: string, textTag: string, breakTags: string[]): string {
  /* A single pass over the tags we care about, in the order they appear.
     Matching `<a:t>` and `</a:p>` separately and then interleaving them by
     index is how the text ends up in the wrong order — so one regex, one walk. */
  const pattern = new RegExp(
    `<${textTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${textTag}>|<(?:${breakTags.join("|")})(?:\\s[^>]*)?/?>`,
    "g",
  );

  const out: string[] = [];
  for (const match of xml.matchAll(pattern)) {
    if (match[1] === undefined) {
      // A break tag: end the current line.
      out.push("\n");
      continue;
    }
    out.push(decodeXmlEntities(match[1]));
  }

  return out.join("").replace(/\n{3,}/g, "\n\n");
}

/**
 * The five predefined XML entities, and numeric references.
 *
 * `&amp;` must be last, or `&amp;lt;` decodes to `<` instead of `&lt;` — the
 * classic double-decode bug.
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

function readEntry(files: Record<string, Uint8Array>, path: string): string | null {
  const entry = files[path];
  return entry ? strFromU8(entry) : null;
}

/**
 * DOCX.
 *
 * A Word document has no pages until something lays it out — pagination is a
 * property of rendering, not of the file. So this returns ONE "page", and
 * `page_count` for a DOCX stays null rather than being invented. A citation into
 * a Word file names the document, not a page it does not have.
 */
export function extractDocx(bytes: Uint8Array): ExtractedPage[] {
  const files = unzipSync(bytes);
  const xml = readEntry(files, "word/document.xml");
  if (xml === null) return [];

  // `w:p` closes a paragraph, `w:br` is an explicit break, `w:tab` a tab stop.
  const text = textFromXml(xml, "w:t", ["/w:p", "w:br", "w:cr"]);
  return [{ page: 1, text }];
}

/**
 * PPTX.
 *
 * One entry per slide, numbered from the filename, because slide order in a
 * ZIP's directory is not slide order in the deck — `slide10.xml` sorts before
 * `slide2.xml` as a string, and a citation to slide 2 that opens slide 10 is
 * worse than no citation.
 */
export function extractPptx(bytes: Uint8Array): ExtractedPage[] {
  const files = unzipSync(bytes);

  const slides = Object.keys(files)
    .map((path) => {
      const match = /^ppt\/slides\/slide(\d+)\.xml$/.exec(path);
      return match ? { path, page: Number(match[1]) } : null;
    })
    .filter((entry): entry is { path: string; page: number } => entry !== null)
    .sort((a, b) => a.page - b.page);

  return slides.map(({ path, page }) => {
    const xml = readEntry(files, path) ?? "";
    /* `a:t` holds every run of text on a slide; `a:p` is a paragraph and
       `a:br` an explicit break. Title and body are both made of these, so no
       placeholder-type handling is needed to get the words. */
    const body = textFromXml(xml, "a:t", ["/a:p", "a:br"]);

    /* Speaker notes are where students put the actual explanation, and they are
       in a parallel file. Included, and labelled, so a quiz question drawn from
       a note is traceable to the right slide. */
    const notesXml = readEntry(files, `ppt/notesSlides/notesSlide${page}.xml`);
    const notes = notesXml ? textFromXml(notesXml, "a:t", ["/a:p", "a:br"]).trim() : "";

    const text = notes.length > 0 ? `${body}\n\nSpeaker notes:\n${notes}` : body;
    return { page, text };
  });
}
