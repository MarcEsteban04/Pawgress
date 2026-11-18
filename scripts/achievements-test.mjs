/**
 * Achievements, checked (Sprint 72).
 *
 *   npm run achievements:test
 *
 * Pins `src/features/achievements/catalogue.ts`: when each one is earned, and
 * that none of them can be earned by doing badly or by volume alone where the
 * catalogue says it should not be.
 */
import assert from "node:assert/strict";
import {
  earnedFrom,
  kindOf,
  longestRun,
  turnedAround,
} from "../src/features/achievements/catalogue.ts";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const facts = (overrides = {}) => ({
  sessions: 0,
  totalMinutes: 0,
  longestStreak: 0,
  quizzesHandedIn: 0,
  mockExams: 0,
  fullPlanDays: 0,
  turnedAround: [],
  readySubjects: [],
  coveredSubjects: [],
  ...overrides,
});
const codes = (input) => earnedFrom(facts(input)).map((item) => item.code);

console.log("\nearning");

check("nothing done, nothing earned", () => {
  assert.deepEqual(codes({}), []);
});

check("firsts", () => {
  assert.deepEqual(codes({ sessions: 1, quizzesHandedIn: 1, mockExams: 1, fullPlanDays: 1 }), [
    "first_session",
    "first_quiz",
    "first_mock",
    "full_plan_day",
  ]);
});

check("hours and streaks at their thresholds, not before", () => {
  assert.ok(!codes({ totalMinutes: 299 }).includes("hours_5"));
  assert.ok(codes({ totalMinutes: 300 }).includes("hours_5"));
  assert.ok(!codes({ longestStreak: 6 }).includes("streak_7"));
  assert.deepEqual(
    codes({ longestStreak: 30 }).filter((code) => code.startsWith("streak")),
    ["streak_7", "streak_30"],
  );
});

check("per-subject ones are earned once per subject, with its name", () => {
  const earned = earnedFrom(
    facts({
      readySubjects: [
        { subjectId: "bio", subjectName: "Biology" },
        { subjectId: "chem", subjectName: "Chemistry" },
      ],
    }),
  );
  assert.deepEqual(earned, [
    { code: "subject_ready:bio", metadata: { name: "Biology" } },
    { code: "subject_ready:chem", metadata: { name: "Chemistry" } },
  ]);
  assert.equal(kindOf("subject_ready:bio")?.title, "Ready");
});

check("every code fits the table's 60-character limit", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  const earned = earnedFrom(
    facts({
      turnedAround: [{ topicId: uuid, topicName: "x" }],
      readySubjects: [{ subjectId: uuid, subjectName: "x" }],
      coveredSubjects: [{ subjectId: uuid, subjectName: "x" }],
    }),
  );
  assert.ok(earned.every((item) => item.code.length <= 60));
});

console.log("\nturned around");

const answers = (topicId, pattern, startDay = 1) =>
  [...pattern].map((mark, index) => ({
    topicId,
    correct: mark === "1",
    answeredAt: `2026-10-${String(startDay + index).padStart(2, "0")}T09:00:00Z`,
  }));
const mastery = (value, name = "Genetics") =>
  new Map([["genetics", { mastery: value, questions: 20, name }]]);

check("weak at the start and strong now", () => {
  const result = turnedAround(answers("genetics", "00010010011111111111"), mastery(0.8));
  assert.deepEqual(result, [{ topicId: "genetics", topicName: "Genetics" }]);
});

check("strong from the start is not a turnaround", () => {
  assert.deepEqual(turnedAround(answers("genetics", "11111111111111111111"), mastery(0.9)), []);
});

check("weak at the start and still weak is not one either", () => {
  assert.deepEqual(turnedAround(answers("genetics", "00000000001111100000"), mastery(0.5)), []);
});

check("too few answers to have a 'since'", () => {
  assert.deepEqual(turnedAround(answers("genetics", "0000000000111"), mastery(0.8)), []);
});

console.log("\nstreaks");

check("the longest run of consecutive days, whatever the order", () => {
  assert.equal(longestRun([]), 0);
  assert.equal(longestRun(["2026-11-03", "2026-11-01", "2026-11-02", "2026-11-02"]), 3);
  assert.equal(longestRun(["2026-10-31", "2026-11-01", "2026-11-05", "2026-11-06"]), 2);
});

console.log(`\n${passed} checks passed\n`);
