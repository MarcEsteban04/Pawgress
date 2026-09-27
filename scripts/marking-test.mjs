/**
 * The marking rules, checked against the cases that matter (Sprint 51).
 *
 *   npm run mark:test
 *
 * These three types are marked by comparison, which means every rule is a claim
 * that two different strings mean the same thing. Each claim that is wrong
 * marks a correct answer wrong — the failure a student cannot argue with and
 * will not forgive — so the claims are written down here as examples rather
 * than left as a regex somebody has to read backwards.
 *
 * Short answers are absent on purpose. They are judged by a model, and a model
 * is not a thing a deterministic test can pin down; `npm run ai:eval` is where
 * behaviour like that is examined.
 *
 * Plain Node, no test runner, matching the other scripts in this folder.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * The rules, lifted from the source rather than restated.
 *
 * The file is TypeScript, so it is stripped to JavaScript by hand — the two
 * functions use no types beyond annotations, and importing the real thing is
 * what stops this test from slowly describing a version that no longer exists.
 */
const source = fs.readFileSync(path.join(process.cwd(), "src/features/quizzes/marking.ts"), "utf8");
const js = source
  .replace(/^import .*$/gm, "")
  .replace(/export type [\s\S]*?^};$/gm, "")
  .replace(/export /g, "")
  .replace(/: MarkableQuestion|: string|: Verdict \| null|: Verdict/g, "")
  .replace(/ as const/g, "");

const { normaliseAnswer, markDeterministic } = await import(
  `data:text/javascript;base64,${Buffer.from(`${js}\nexport { normaliseAnswer, markDeterministic };`).toString("base64")}`
);

let failures = 0;

function check(name, actual, expected) {
  try {
    assert.equal(actual, expected);
    console.log(`  ok    ${name}`);
  } catch {
    failures++;
    console.log(`  FAIL  ${name} — expected ${expected}, got ${actual}`);
  }
}

const mark = (type, answer, given) =>
  markDeterministic({ type, answer, prompt: "" }, given).correct;

console.log("\nMarking rules\n");

console.log("  normalisation");
check("lowercases", normaliseAnswer("Mitochondria"), "mitochondria");
check("drops punctuation", normaliseAnswer("ATP, and NADH."), "atp and nadh");
check("collapses whitespace", normaliseAnswer("  cell   wall  "), "cell wall");
check("drops a leading article", normaliseAnswer("The nucleus"), "nucleus");
/* An article INSIDE the answer is meaning, not noise. Stripping every "the"
   would turn "the sum of the parts" into "sum of parts". */
check("keeps an internal article", normaliseAnswer("sum of the parts"), "sum of the parts");

console.log("\n  multiple choice and true/false");
check("exact match", mark("mcq", "Oxidative phosphorylation", "Oxidative phosphorylation"), true);
check("case insensitive", mark("mcq", "True", "true"), true);
check("wrong option", mark("mcq", "Glycolysis", "Krebs cycle"), false);
check("blank is wrong", mark("mcq", "True", ""), false);
check("whitespace is blank", mark("true_false", "False", "   "), false);
/* Deliberately strict: a chosen option that does not match exactly means the
   choice was recorded wrongly, and leniency would hide that. */
check("no partial credit on a choice", mark("mcq", "Inner membrane", "membrane"), false);

console.log("\n  identification");
check("exact", mark("identification", "Mitochondrion", "mitochondrion"), true);
check("with an article", mark("identification", "Mitochondrion", "the mitochondrion"), true);
check("student said more", mark("identification", "Golgi", "the Golgi apparatus"), true);
check("student said less", mark("identification", "Golgi apparatus", "Golgi"), true);
check("plain wrong", mark("identification", "Ribosome", "Lysosome"), false);
check("blank is wrong", mark("identification", "Ribosome", ""), false);

console.log("\n  short answer");
check(
  "is never marked here",
  markDeterministic({ type: "short_answer", answer: "x", prompt: "" }, "something"),
  null,
);
/* Except a blank one, which needs no judgement — nothing was said. */
check(
  "blank is settled without a model",
  markDeterministic({ type: "short_answer", answer: "x", prompt: "" }, "  ").correct,
  false,
);

console.log(
  failures === 0 ? "\nall marking rules hold\n" : `\n${failures} failing — read the output above\n`,
);
process.exitCode = failures === 0 ? 0 : 1;
