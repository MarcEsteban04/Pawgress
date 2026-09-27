/**
 * The topic-mastery formula, checked (Sprint 56).
 *
 *   npm run mastery:test
 *
 * Each rule in `src/features/mastery/formula.ts` changes the number a student
 * sees about themselves, so each one is pinned here as an example. Imports the
 * real module — Node 24 strips erasable TypeScript natively, and the formula
 * has no imports of its own precisely so this can load it.
 */
import assert from "node:assert/strict";
import {
  HALF_LIFE_DAYS,
  LOW_EVIDENCE_QUESTIONS,
  masteryBy,
  masteryOf,
} from "../src/features/mastery/formula.ts";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-01T12:00:00.000Z");

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

let next = 0;
const answer = (correct, { daysAgo = 0, difficulty = "medium", question, topic = "t1" } = {}) => ({
  questionId: question ?? `q${next++}`,
  topicId: topic,
  subjectId: "s1",
  correct,
  answeredAt: new Date(NOW - daysAgo * DAY).toISOString(),
  difficulty,
});

const many = (count, correct, options) =>
  Array.from({ length: count }, () => answer(correct, options));

const close = (actual, expected, places = 3) =>
  assert.equal(Number(actual.toFixed(places)), Number(expected.toFixed(places)));

console.log("\nTopic mastery\n");

check("no evidence is null, never zero", () => {
  assert.equal(masteryOf([], NOW), null);
});

check("one right answer reads 67%, not 100% (the prior)", () => {
  close(masteryOf([answer(true)], NOW).mastery, 2 / 3);
});

check("one wrong answer reads 33%, not 0%", () => {
  close(masteryOf([answer(false)], NOW).mastery, 1 / 3);
});

check("the prior fades as evidence arrives", () => {
  const result = masteryOf(many(40, true), NOW);
  assert.ok(result.mastery > 0.95, `got ${result.mastery}`);
});

check("a question counts once — its most recent answer", () => {
  const drilled = [
    answer(false, { question: "same", daysAgo: 3 }),
    answer(false, { question: "same", daysAgo: 2 }),
    answer(true, { question: "same", daysAgo: 0 }),
  ];
  const result = masteryOf(drilled, NOW);
  assert.equal(result.questions, 1);
  close(result.mastery, 2 / 3);
});

check("recent answers outweigh old ones", () => {
  const learned = [...many(10, false, { daysAgo: 60 }), ...many(10, true, { daysAgo: 0 })];
  const forgot = [...many(10, true, { daysAgo: 60 }), ...many(10, false, { daysAgo: 0 })];
  assert.ok(masteryOf(learned, NOW).mastery > 0.6);
  assert.ok(masteryOf(forgot, NOW).mastery < 0.4);
});

check(`an answer ${HALF_LIFE_DAYS} days old counts half`, () => {
  /* One old right, one new wrong: weights 0.5 and 1, plus the prior. */
  const result = masteryOf(
    [answer(true, { daysAgo: HALF_LIFE_DAYS }), answer(false, { daysAgo: 0 })],
    NOW,
  );
  close(result.mastery, (1 + 0.5) / (2 + 1.5));
});

check("failing a hard question hurts less than failing an easy one", () => {
  const hardMiss = masteryOf([...many(9, true), answer(false, { difficulty: "hard" })], NOW);
  const easyMiss = masteryOf([...many(9, true), answer(false, { difficulty: "easy" })], NOW);
  assert.ok(hardMiss.mastery > easyMiss.mastery);
});

check("a hard question right counts for more than an easy one right", () => {
  const hardHit = masteryOf([...many(5, false), answer(true, { difficulty: "hard" })], NOW);
  const easyHit = masteryOf([...many(5, false), answer(true, { difficulty: "easy" })], NOW);
  assert.ok(hardHit.mastery > easyHit.mastery);
});

check("failing hard questions can never RAISE mastery", () => {
  const base = masteryOf(many(10, true), NOW).mastery;
  const afterHardMiss = masteryOf([...many(10, true), answer(false, { difficulty: "hard" })], NOW);
  assert.ok(afterHardMiss.mastery < base);
});

check(`below ${LOW_EVIDENCE_QUESTIONS} questions the band is unmeasured`, () => {
  assert.equal(masteryOf(many(LOW_EVIDENCE_QUESTIONS - 1, true), NOW).band, "unmeasured");
  assert.equal(masteryOf(many(LOW_EVIDENCE_QUESTIONS, true), NOW).band, "strong");
});

check("weak and strong bands", () => {
  assert.equal(masteryOf(many(12, false), NOW).band, "weak");
  assert.equal(
    /* 9 of 12 is 75%; with the prior, (9+1)/(12+2) = 71%. */
    masteryOf([...many(9, true), ...many(3, false)], NOW).band,
    "developing",
  );
});

check("improvement needs enough evidence at BOTH ends", () => {
  /* Plenty now, none a fortnight ago: that is new evidence, not improvement. */
  assert.equal(masteryOf(many(15, true), NOW).improvement, null);
});

check("improvement is measured against the same formula two weeks ago", () => {
  const history = [
    ...many(12, false, { daysAgo: 30 }),
    /* The same twelve questions retaken this week, and now right. */
    ...Array.from({ length: 12 }, (_, i) => answer(true, { question: `r${i}`, daysAgo: 0 })),
    ...Array.from({ length: 12 }, (_, i) => answer(false, { question: `r${i}`, daysAgo: 30 })),
  ];
  const result = masteryOf(history, NOW);
  assert.ok(result.improvement !== null && result.improvement > 0.2, `got ${result.improvement}`);
});

check("grouping by topic keeps topics apart and skips untagged answers", () => {
  const groups = masteryBy(
    [answer(true, { topic: "a" }), answer(false, { topic: "b" }), answer(true, { topic: null })],
    (entry) => entry.topicId,
    NOW,
  );
  assert.equal(groups.size, 2);
  assert.ok(groups.get("a").mastery > groups.get("b").mastery);
});

console.log(failures === 0 ? "\nall mastery rules hold\n" : `\n${failures} failing\n`);
process.exitCode = failures === 0 ? 0 : 1;
