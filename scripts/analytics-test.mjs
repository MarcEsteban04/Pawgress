/**
 * What "average", "best" and "recent" mean, checked (Sprint 55).
 *
 *   npm run analytics:test
 *
 * These words sound self-explanatory and are not, so the definitions in
 * `src/features/quizzes/analytics.ts` are pinned here as examples. The one that
 * matters most is the average: a mean of percentages and a pooled accuracy
 * disagree the moment two attempts differ in length, and only one of them is
 * honest about how much evidence there is.
 *
 * Imports the real TypeScript module — Node 24 strips erasable types natively,
 * so there is no copy here to drift out of step with the source.
 */
import assert from "node:assert/strict";
import { summariseAttempts } from "../src/features/quizzes/analytics.ts";

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures++;
    console.log(`  FAIL  ${name} — ${error.message}`);
  }
}

const at = (id, correct, total, day) => ({
  id,
  correct,
  total,
  submittedAt: `2026-09-${String(day).padStart(2, "0")}T10:00:00.000Z`,
});

console.log("\nAttempt analytics\n");

check("nothing yet is null, not zero", () => {
  const summary = summariseAttempts([]);
  assert.equal(summary.attempts, 0);
  assert.equal(summary.average, null);
  assert.equal(summary.best, null);
});

check("average is POOLED, not a mean of percentages", () => {
  /* 5/5 and 30/60: a mean of percentages says 75%. The student got 35 of 65. */
  const summary = summariseAttempts([at("a", 5, 5, 1), at("b", 30, 60, 2)]);
  assert.equal(Math.round(summary.average * 1000), Math.round((35 / 65) * 1000));
});

check("best is the highest share", () => {
  const summary = summariseAttempts([at("a", 6, 10, 1), at("b", 9, 10, 2), at("c", 7, 10, 3)]);
  assert.equal(summary.best.id, "b");
});

check("a tie for best goes to the more recent", () => {
  const summary = summariseAttempts([at("old", 9, 10, 1), at("new", 9, 10, 5)]);
  assert.equal(summary.best.id, "new");
});

check("recent is the latest by date, whatever order they arrive in", () => {
  const summary = summariseAttempts([at("late", 5, 10, 9), at("early", 8, 10, 1)]);
  assert.equal(summary.recent.id, "late");
});

check("change compares the last two, in points", () => {
  const summary = summariseAttempts([at("a", 6, 10, 1), at("b", 8, 10, 2)]);
  assert.equal(summary.change, 20);
});

check("one attempt has no change", () => {
  assert.equal(summariseAttempts([at("a", 6, 10, 1)]).change, null);
});

check("an attempt with no questions is ignored, not counted as zero", () => {
  const summary = summariseAttempts([at("empty", 0, 0, 1), at("real", 8, 10, 2)]);
  assert.equal(summary.attempts, 1);
  assert.equal(summary.average, 0.8);
});

console.log(failures === 0 ? "\nall analytics rules hold\n" : `\n${failures} failing\n`);
process.exitCode = failures === 0 ? 0 : 1;
