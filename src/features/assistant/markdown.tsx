import { Fragment, type ReactNode } from "react";
import { parseBlocks } from "./markdown-blocks";

/**
 * The small slice of Markdown a model actually emits, rendered as React.
 *
 * **No `dangerouslySetInnerHTML`, and no Markdown library.**
 *
 * Not the HTML path because this text is model output derived from files a
 * student uploaded — the least trustworthy string in the product. Building
 * React elements means the escaping is React's, not ours, and there is no route
 * from a crafted PDF to injected markup (NFR-S5).
 *
 * Not a library because the subset is genuinely small — bold, italic, inline
 * code, fenced code, headings, lists, rules — and a general Markdown pipeline
 * brings HTML passthrough that then has to be configured back off. The risk of
 * a hand-written parser is that it misses syntax; the risk of a general one is
 * that it renders syntax we never wanted. Missing syntax degrades to visible
 * text, which is what the screen shows today anyway.
 *
 * **Everything here has to survive half a document.** The text arrives a token
 * at a time, so at any moment there may be an unclosed fence, a dangling `**`,
 * or a list interrupted mid-item. Nothing throws: an unterminated fence renders
 * as code to the end, and an unmatched delimiter stays literal — which is
 * exactly what it looks like a moment later when the closing one arrives.
 */

/* Inline spans, in priority order. Code first: backticks win over emphasis, so
   `**not bold**` inside code stays literal, which is the whole point of it. */
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded-[0.3rem] bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

const HEADING_CLASS: Record<number, string> = {
  1: "font-display text-lg font-semibold tracking-[-0.01em]",
  2: "font-display text-[1.0625rem] font-semibold tracking-[-0.01em]",
  3: "font-display text-[0.9375rem] font-semibold",
  4: "text-[0.9375rem] font-semibold",
};

/**
 * A model's answer, rendered.
 *
 * `trailing` is the streaming caret. It is appended INSIDE the last block
 * rather than after the whole thing, so it sits at the end of the sentence
 * being written instead of on a line of its own below it.
 */
export function Markdown({ text, trailing }: { text: string; trailing?: ReactNode }) {
  const blocks = parseBlocks(text);
  if (blocks.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 text-[0.9375rem] leading-relaxed">
      {blocks.map((block, index) => {
        const last = index === blocks.length - 1;
        const tail = last ? trailing : null;
        const key = `b${index}`;

        if (block.kind === "code") {
          return (
            <pre
              key={key}
              className="thin-scroll overflow-x-auto rounded-[var(--radius-tile)] border border-rule bg-surface-sunken p-3.5 font-mono text-[0.8125rem] leading-relaxed"
            >
              <code>{block.lines.join("\n")}</code>
            </pre>
          );
        }

        if (block.kind === "heading") {
          return (
            <p key={key} className={cnHeading(block.level)}>
              {renderInline(block.text, key)}
              {tail}
            </p>
          );
        }

        if (block.kind === "rule") {
          return <hr key={key} className="border-rule" />;
        }

        if (block.kind === "quote") {
          return (
            <blockquote
              key={key}
              className="border-l-2 border-rule-strong pl-3 text-ink-muted italic"
            >
              {renderInline(block.lines.join(" "), key)}
              {tail}
            </blockquote>
          );
        }

        if (block.kind === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={key}
              className={
                block.ordered
                  ? "flex list-outside list-decimal flex-col gap-1.5 pl-5 marker:text-ink-subtle"
                  : "flex list-outside list-disc flex-col gap-1.5 pl-5 marker:text-ink-subtle"
              }
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`} className={item.depth > 0 ? "ml-4" : undefined}>
                  {renderInline(item.text, `${key}-${itemIndex}`)}
                  {last && itemIndex === block.items.length - 1 ? tail : null}
                </li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={key}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={`${key}-${lineIndex}`}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `${key}-${lineIndex}`)}
              </Fragment>
            ))}
            {tail}
          </p>
        );
      })}
    </div>
  );
}

function cnHeading(level: number): string {
  return HEADING_CLASS[level] ?? HEADING_CLASS[4];
}
