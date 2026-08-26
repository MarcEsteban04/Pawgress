import { type PageOffset } from "./normalize";

/**
 * Chunking (FR-P2, US-D3).
 *
 * A chunk is the unit of retrieval, so its size decides how good the assistant
 * and every generated reviewer can be. Both failure modes are real:
 *
 *  - **Too large** and the embedding is an average of several ideas, so it is
 *    close to everything and near to nothing. Retrieval returns a page when the
 *    student asked about a sentence, and the model has to find the answer inside
 *    it — paying for tokens that dilute rather than help.
 *  - **Too small** and a chunk loses the thing that made it meaningful. "It
 *    doubles under those conditions" is unretrievable and useless out of
 *    context, and a flashcard built from it is nonsense.
 *
 * The target here is ~350 tokens with ~15% overlap, split on the document's own
 * structure first and only falling back to arbitrary cuts. That is deliberately
 * mid-range: study material is explanatory prose where a paragraph usually *is*
 * one idea, which is a better boundary than any character count.
 *
 * No `server-only`: this is pure string work, and the same rules should be
 * available to a test.
 */

export type Chunk = {
  index: number;
  content: string;
  /** 1-indexed pages this chunk's text came from. Null when the source has no pages. */
  pageFrom: number | null;
  pageTo: number | null;
  /** Estimated, not measured — see `estimateTokens`. */
  tokenCount: number;
};

/** Roughly 350 tokens. */
const TARGET_CHARS = 1_400;
/**
 * The point past which a chunk is closed even mid-paragraph.
 *
 * A single 6,000-character paragraph does exist — lecture notes with no
 * formatting — and without a ceiling it would become one chunk that dwarfs every
 * other and skews retrieval toward itself.
 */
const MAX_CHARS = 2_200;
/**
 * Overlap between neighbours, in characters.
 *
 * The reason for overlap is boundaries: the sentence that answers a question is
 * as likely to sit across a cut as anywhere else. Repeating the tail of one
 * chunk at the head of the next means such a sentence is whole in at least one
 * of them. It costs about 15% more embedding spend, which is the cheapest
 * insurance in the pipeline.
 */
const OVERLAP_CHARS = 200;
/**
 * Below this, a fragment is merged into its neighbour rather than stored.
 *
 * A 40-character chunk — a stray heading, a page of just a figure caption — is
 * an embedding that matches short queries about nothing.
 */
const MIN_CHARS = 120;

/**
 * Tokens, estimated from characters.
 *
 * Deliberately an estimate. Measuring means an API call per chunk, which for a
 * 100-page PDF is a hundred round trips to learn a number used only for
 * budgeting and display. English prose runs about four characters per token;
 * this is stored so a later cost report has something to work with, and it is
 * named `estimate` everywhere so nobody mistakes it for the billed figure.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split on the document's own structure, largest boundary first.
 *
 * Blank line, then single newline, then sentence end. Falling through in that
 * order is what makes this "semantic" in any useful sense: it prefers the
 * author's paragraph to our arithmetic, and only cuts mid-sentence when a single
 * sentence exceeds the ceiling on its own.
 */
function splitIntoUnits(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n+/).flatMap((paragraph) => {
    const trimmed = paragraph.trim();
    if (trimmed.length === 0) return [];
    if (trimmed.length <= MAX_CHARS) return [trimmed];

    // Too long to be one unit: try single line breaks.
    const lines = trimmed.split(/\n+/).filter((line) => line.trim().length > 0);
    if (lines.length > 1) return lines.map((line) => line.trim());

    /* One enormous run with no line breaks. Sentence ends, then a hard cut for
       anything still over the ceiling — which in practice means text with no
       punctuation at all, such as a table read out of a PDF. */
    const sentences = trimmed.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g) ?? [trimmed];
    return sentences.flatMap((sentence) => {
      const s = sentence.trim();
      if (s.length <= MAX_CHARS) return [s];
      const pieces: string[] = [];
      for (let i = 0; i < s.length; i += MAX_CHARS) pieces.push(s.slice(i, i + MAX_CHARS));
      return pieces;
    });
  });

  return paragraphs;
}

/**
 * Which pages a character range covers.
 *
 * This is the payoff from the `page_offsets` column: a chunk that starts on page
 * 3 and runs onto page 4 reports both, so a citation can say where it came from
 * without the file being re-parsed (FR-P6).
 */
function pagesFor(
  start: number,
  end: number,
  offsets: PageOffset[],
): { pageFrom: number | null; pageTo: number | null } {
  if (offsets.length === 0) return { pageFrom: null, pageTo: null };

  const touched = offsets.filter((offset) => offset.start < end && offset.end > start);
  if (touched.length === 0) {
    /* A chunk that lands entirely inside the separator between two pages. Rare,
       and attributing it to the page it follows is more useful than null. */
    const preceding = offsets.filter((offset) => offset.end <= start).at(-1);
    return preceding
      ? { pageFrom: preceding.page, pageTo: preceding.page }
      : { pageFrom: null, pageTo: null };
  }

  return {
    pageFrom: touched[0]!.page,
    pageTo: touched[touched.length - 1]!.page,
  };
}

/**
 * Turn one material's normalised text into chunks.
 *
 * Positions are tracked against the ORIGINAL text rather than the assembled
 * chunk, because that is what the page offsets are indexed on. Assembling first
 * and searching for the substring afterwards is the version of this that quietly
 * mis-attributes a page whenever a phrase repeats.
 */
export function chunkText(text: string, offsets: PageOffset[]): Chunk[] {
  const units = splitIntoUnits(text);
  const chunks: Chunk[] = [];

  let buffer = "";
  let bufferStart = 0;
  let cursor = 0;

  const flush = () => {
    const content = buffer.trim();
    if (content.length === 0) return;

    const { pageFrom, pageTo } = pagesFor(bufferStart, bufferStart + buffer.length, offsets);
    chunks.push({
      index: chunks.length,
      content,
      pageFrom,
      pageTo,
      tokenCount: estimateTokens(content),
    });
    buffer = "";
  };

  for (const unit of units) {
    /* Locate this unit in the original text, searching forward only. `indexOf`
       from the cursor is what keeps a repeated heading from resolving to its
       first occurrence and dragging the page number back with it. */
    const found = text.indexOf(unit, cursor);
    const unitStart = found === -1 ? cursor : found;
    cursor = unitStart + unit.length;

    if (buffer.length === 0) {
      buffer = unit;
      bufferStart = unitStart;
    } else if (buffer.length + unit.length + 2 <= TARGET_CHARS) {
      buffer += `\n\n${unit}`;
    } else {
      flush();

      /* Carry the tail of the previous chunk into the next, cut at a word
         boundary so the overlap does not begin mid-word. */
      const previous = chunks[chunks.length - 1]?.content ?? "";
      const tail = previous.slice(-OVERLAP_CHARS);
      const overlap = tail.slice(Math.max(tail.search(/\s/) + 1, 0));

      buffer = overlap.length > 0 ? `${overlap}\n\n${unit}` : unit;
      /* The overlap belongs to earlier text, so the chunk starts where the
         overlap does — otherwise its page range would omit the page the
         repeated sentence came from. */
      bufferStart = Math.max(unitStart - overlap.length, 0);
    }
  }

  flush();

  return mergeFragments(chunks);
}

/**
 * Fold anything below the floor into its neighbour.
 *
 * Runs after chunking rather than during it, because whether a fragment is too
 * small is only knowable once it is final — a trailing heading looks like the
 * start of a chunk until the document ends.
 */
function mergeFragments(chunks: Chunk[]): Chunk[] {
  if (chunks.length <= 1) return chunks;

  const out: Chunk[] = [];
  for (const chunk of chunks) {
    const previous = out[out.length - 1];
    if (chunk.content.length < MIN_CHARS && previous) {
      previous.content = `${previous.content}\n\n${chunk.content}`;
      previous.pageTo = chunk.pageTo ?? previous.pageTo;
      previous.tokenCount = estimateTokens(previous.content);
      continue;
    }
    out.push({ ...chunk, index: out.length });
  }

  // A single sub-floor chunk is kept: a two-line note is still worth retrieving.
  return out;
}
