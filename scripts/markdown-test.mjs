/** Runs the block parser from markdown.tsx against real model output. */
import { parseBlocks } from "../src/features/assistant/markdown-blocks.ts";

let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  ok    ${name}`);
  else {
    failures++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
};

const SAMPLE = `**HTML Fundamentals – Quick Summary**

- **What HTML Is**
  - Stands for **HyperText Markup Language**.
  - It's a **markup language**, not a programming language.

- **Basic Document Skeleton**
\`\`\`html
<!DOCTYPE html>
<html lang="en">
\`\`\`

Use \`<p>Hello</p>\` for a paragraph.`;

const blocks = parseBlocks(SAMPLE);
const kinds = blocks.map((b) => b.kind);
console.log("\nblocks:", kinds.join(", "), "\n");

check("opens with a paragraph, not a heading", kinds[0] === "paragraph");
check("finds a list", kinds.includes("list"));
check("finds the fenced code", kinds.includes("code"));
check(
  "code block keeps its lines",
  blocks
    .find((b) => b.kind === "code")
    ?.lines.join("\n")
    .includes("<!DOCTYPE html>"),
);
check(
  "code language captured",
  blocks.find((b) => b.kind === "code")?.language === "html",
  String(blocks.find((b) => b.kind === "code")?.language),
);

const list = blocks.find((b) => b.kind === "list");
check(
  "list has nested items",
  list?.items.some((i) => i.depth === 1),
);
check(
  "list has top-level items",
  list?.items.some((i) => i.depth === 0),
);

console.log("\nStreaming partials must not throw:\n");
for (let i = 1; i <= SAMPLE.length; i += 7) {
  try {
    parseBlocks(SAMPLE.slice(0, i));
  } catch (e) {
    failures++;
    console.log(`  FAIL  threw at ${i} chars: ${e.message}`);
    break;
  }
}
check("every prefix of the answer parses", true);

const unclosed = parseBlocks("Intro\n\n```js\nconst a = 1;");
check(
  "an unclosed fence renders as code to the end",
  unclosed[unclosed.length - 1].kind === "code",
  unclosed.map((b) => b.kind).join(","),
);

const ordered = parseBlocks("1. first\n2. second\n3. third");
check("ordered lists parse", ordered[0].kind === "list" && ordered[0].ordered === true);
check("ordered list keeps all items", ordered[0].items.length === 3);

const wrapped = parseBlocks("- a long bullet\n  that wrapped onto a second line\n- next");
check(
  "a wrapped bullet stays in its item",
  wrapped[0].items.length === 2 && wrapped[0].items[0].text.includes("wrapped"),
  JSON.stringify(wrapped[0].items),
);

console.log(failures === 0 ? "\nall passed\n" : `\n${failures} failed\n`);
process.exitCode = failures === 0 ? 0 : 1;
