/**
 * Readiness, checked (Sprint 71).
 *
 *   npm run readiness:test
 *
 * Pins `src/features/readiness/score.ts`: what goes into the score, in what
 * share, and that a missing input is left out rather than counted as zero.
 */
import assert from "node:assert/strict";
import {
  CONSISTENT_DAYS,
  readinessOf,
  READINESS_WEIGHTS,
} from "../src/features/readiness/score.ts";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

const inputs = (overrides = {}) => ({
  mastery: 0.6,
  answered: 40,
  topics: 4,
  measuredTopics: 2,
  recent: { correct: 8, total: 10, runs: 2 },
  studyDays: 7,
  ...overrides,
});

console.log("\nreadiness");

check("the weights add up to the whole score", () => {
  const total = Object.values(READINESS_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  close(total, 1);
});

check("every input in its share", () => {
  /* 0.5·0.6 + 0.2·0.5 + 0.2·0.8 + 0.1·1 */
  close(readinessOf(inputs()).score, 0.3 + 0.1 + 0.16 + 0.1);
});

check("no score below the mastery evidence threshold", () => {
  assert.equal(readinessOf(inputs({ mastery: null })), null);
});

check("no recent quizzes is left out, not scored zero", () => {
  const result = readinessOf(inputs({ recent: null }));
  /* (0.3 + 0.1 + 0.1) over the 0.8 of weight that exists. */
  close(result.score, 0.5 / 0.8);
  assert.equal(result.parts.find((part) => part.key === "recent").value, null);
});

check("too few recent questions count as none", () => {
  const thin = readinessOf(inputs({ recent: { correct: 0, total: 3, runs: 1 } }));
  const none = readinessOf(inputs({ recent: null }));
  close(thin.score, none.score);
});

check("a subject with no topics is not marked down for coverage", () => {
  const result = readinessOf(inputs({ topics: 0, measuredTopics: 0 }));
  assert.equal(result.parts.find((part) => part.key === "coverage").value, null);
});

check(`consistency is full at ${CONSISTENT_DAYS} days studied, and caps there`, () => {
  const at = readinessOf(inputs({ studyDays: CONSISTENT_DAYS }));
  const beyond = readinessOf(inputs({ studyDays: 14 }));
  close(at.score, beyond.score);
  assert.equal(readinessOf(inputs({ studyDays: 0 })).parts.at(-1).value, 0);
});

check("studying more cannot outweigh knowing less", () => {
  const knows = readinessOf(inputs({ mastery: 0.8, studyDays: 0 }));
  const busy = readinessOf(inputs({ mastery: 0.5, studyDays: 14 }));
  assert.ok(knows.score > busy.score);
});

console.log(`\n${passed} checks passed\n`);
