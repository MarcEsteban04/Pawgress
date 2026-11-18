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
import { bestStreak, streakOf, weekOf } from "../src/features/study/streak.ts";
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

console.log("\nstreaks, with a rest day a week");

const TODAY = "2026-11-19";
/* Days before today, as keys: d(0) is today, d(1) yesterday. */
const d = (n) => {
  const date = new Date(Date.UTC(2026, 10, 19 - n));
  return date.toISOString().slice(0, 10);
};
const back = (...ns) => ns.map(d);

check("no study, no streak", () => {
  assert.deepEqual(streakOf([], TODAY), { current: 0, best: 0, status: "none", restUsed: false });
});

check("studied today and the two days before: three", () => {
  const streak = streakOf(back(0, 1, 2), TODAY);
  assert.equal(streak.current, 3);
  assert.equal(streak.status, "today");
});

check("not yet today is not a break", () => {
  const streak = streakOf(back(1, 2, 3), TODAY);
  assert.equal(streak.current, 3);
  assert.equal(streak.status, "pending");
});

check("one missed day holds the chain, and is not counted in it", () => {
  const streak = streakOf(back(0, 1, 3, 4), TODAY);
  assert.equal(streak.current, 4);
  assert.equal(streak.restUsed, true);
});

check("two missed days in a row break it", () => {
  assert.equal(streakOf(back(0, 1, 4, 5), TODAY).current, 2);
});

check("two rest days inside a week break it at the second", () => {
  /* Missed d2 and d5: three days apart. */
  assert.equal(streakOf(back(0, 1, 3, 4, 6, 7), TODAY).current, 4);
});

check("rest days a week apart are both allowed", () => {
  /* Missed d2 and d9. */
  assert.equal(streakOf(back(0, 1, 3, 4, 5, 6, 7, 8, 10, 11), TODAY).current, 10);
});

check("yesterday as the rest day: today keeps it", () => {
  const streak = streakOf(back(2, 3, 4), TODAY);
  assert.equal(streak.current, 3);
  assert.equal(streak.status, "at-risk");
});

check("the best streak follows the same rule, and the milestone reads it", () => {
  assert.equal(bestStreak(back(20, 19, 17, 16, 15, 14, 13, 12)), 8);
  assert.equal(bestStreak(back(20, 19, 17, 16, 14, 13)), 4);
  assert.equal(streakOf(back(0), TODAY).best, 1);
});

check("the week runs Monday to Sunday, with today marked", () => {
  /* 19 Nov 2026 is a Thursday. */
  const week = weekOf(back(0, 2), TODAY);
  assert.deepEqual(
    week.map((day) => day.date),
    [
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ],
  );
  assert.deepEqual(
    week.map((day) => day.studied),
    [false, true, false, true, false, false, false],
  );
  assert.equal(
    week.findIndex((day) => day.today),
    3,
  );
});

console.log(`\n${passed} checks passed\n`);
