/**
 * Block structure for the assistant's Markdown.
 *
 * Split from the renderer because it contains no JSX, which makes it directly
 * runnable — `npm run md:test` executes THIS file rather than a copy of it.
 * A parser tested through a transcription of itself is testing the
 * transcription.
 *
 * **Everything here has to survive half a document.** The text arrives a token
 * at a time, so at any moment there may be an unclosed fence, a dangling `**`,
 * or a list interrupted mid-item. Nothing throws: an unterminated fence runs to
 * the end as code, and an unmatched delimiter stays literal — which is exactly
 * what it looks like a moment before the closing one arrives.
 */
export type Block =
  | { kind: "code"; language: string | null; lines: string[] }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; items: { text: string; depth: number }[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "rule" }
  | { kind: "paragraph"; lines: string[] };

const FENCE = /^\s*```(\w*)\s*$/;
const HEADING = /^(#{1,4})\s+(.*)$/;
const RULE = /^\s*(?:---+|\*\*\*+|___+)\s*$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;

export function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i += 1;
      /* Runs to the end when the closing fence has not streamed in yet. A code
         block that grows as it arrives is right; a paragraph that turns into
         code once the fence closes would reflow the whole answer. */
      while (i < lines.length && !FENCE.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ kind: "code", language: fence[1] || null, lines: body });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: "rule" });
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length) {
        const quoted = QUOTE.exec(lines[i]);
        if (!quoted) break;
        body.push(quoted[1]);
        i += 1;
      }
      blocks.push({ kind: "quote", lines: body });
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = ORDERED.exec(line);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const items: { text: string; depth: number }[] = [];

      while (i < lines.length) {
        const nextBullet = BULLET.exec(lines[i]);
        const nextOrdered = ORDERED.exec(lines[i]);
        const item = isOrdered ? (nextOrdered ?? nextBullet) : (nextBullet ?? nextOrdered);
        if (!item) {
          /* A wrapped continuation line belongs to the item above it, not to a
             new paragraph. Models wrap long bullets constantly. */
          if (lines[i].trim() !== "" && /^\s{2,}\S/.test(lines[i]) && items.length > 0) {
            items[items.length - 1].text += ` ${lines[i].trim()}`;
            i += 1;
            continue;
          }
          break;
        }
        // One nesting level. Deeper than that, a model is making an outline.
        items.push({ text: item[2], depth: item[1].length >= 2 ? 1 : 0 });
        i += 1;
      }

      blocks.push({ kind: "list", ordered: isOrdered, items });
      continue;
    }

    const body: string[] = [];
    while (i < lines.length) {
      const current = lines[i];
      if (
        current.trim() === "" ||
        FENCE.test(current) ||
        HEADING.test(current) ||
        RULE.test(current) ||
        QUOTE.test(current) ||
        BULLET.test(current) ||
        ORDERED.test(current)
      ) {
        break;
      }
      body.push(current);
      i += 1;
    }
    blocks.push({ kind: "paragraph", lines: body });
  }

  return blocks;
}
