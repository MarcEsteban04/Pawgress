/**
 * Today's study plan, checked (Sprint 65).
 *
 *   npm run plan:test
 *
 * Pins the rules in `src/features/plan/build.ts`: which activities a session
 * becomes, that the blocks add up, that the time budget is respected, and
 * that an empty plan says why rather than inventing work.
 */
import assert from "node:assert/strict";
import {
  ACTIVITY_MIX,
  buildDayPlan,
  MIN_BLOCK_MINUTES,
  splitSession,
} from "../src/features/plan/build.ts";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const session = (overrides = {}) => ({
  subjectId: "bio",
  subjectName: "Biology",
  colorSlot: 1,
  topicId: "genetics",
  topicName: "Genetics",
  title: "Revise Genetics",
  basis: "weak",
  reason: "Bio exam in 5 days · you are weak on Genetics",
  source: "suggested",
  ...overrides,
});

const base = {
  sessions: [],
  blockMinutes: 30,
  perDay: 2,
  studiedMinutes: 0,
  done: [],
  context: { subjects: 1, materials: 3 },
};
const build = (input) => buildDayPlan({ ...base, ...input });
const sum = (parts) => parts.reduce((total, part) => total + part.minutes, 0);

console.log("\nactivities");

check("weak is reviewed before it is practised", () => {
  assert.deepEqual(splitSession("weak", 30), [
    { activity: "review", minutes: 10 },
    { activity: "practice", minutes: 20 },
  ]);
});

check("strong is confirmed with a quiz, untested is practised", () => {
  assert.deepEqual(splitSession("strong", 30), [{ activity: "quiz", minutes: 30 }]);
  assert.deepEqual(splitSession("untested", 30), [{ activity: "practice", minutes: 30 }]);
});

check("stale starts with flashcards", () => {
  assert.equal(splitSession("stale", 30)[0].activity, "flashcards");
});

check("the blocks always add up to the session", () => {
  for (const basis of Object.keys(ACTIVITY_MIX)) {
    for (const minutes of [20, 25, 30, 45, 60, 90]) {
      const parts = splitSession(basis, minutes);
      if (basis === "work") continue;
      assert.equal(sum(parts), minutes, `${basis} ${minutes}`);
      assert.ok(
        parts.every((part) => part.minutes >= MIN_BLOCK_MINUTES),
        `${basis} ${minutes}`,
      );
    }
  }
});

check("a short session is one activity, not two slivers", () => {
  assert.deepEqual(splitSession("weak", 15), [{ activity: "practice", minutes: 15 }]);
});

console.log("\nthe day");

check("today's sessions become blocks, each with its reason", () => {
  const plan = build({ sessions: [session()] });
  assert.equal(plan.totalMinutes, 30);
  assert.equal(plan.items.length, 2);
  assert.ok(plan.items.every((item) => item.reason.startsWith("Bio exam in 5 days")));
  assert.equal(plan.empty, null);
});

check("a session the student planned says so", () => {
  const plan = build({ sessions: [session({ source: "planned", title: "Genetics before lab" })] });
  assert.match(plan.items[0].reason, /^You planned "Genetics before lab"/);
});

check("the budget is sessions a day times the block", () => {
  const plan = build({
    perDay: 1,
    sessions: [session(), session({ topicId: "cells", topicName: "Cells" })],
  });
  assert.equal(plan.totalMinutes, 30);
  assert.equal(plan.leftOver, 1);
});

check("time already studied today comes off the budget", () => {
  const plan = build({ studiedMinutes: 45, sessions: [session(), session({ topicId: "cells" })] });
  assert.equal(plan.budgetMinutes, 15);
  assert.equal(plan.totalMinutes, 15);
  assert.equal(plan.leftOver, 1);
});

check("a budget below the minimum block plans nothing, and says time is used", () => {
  const plan = build({ studiedMinutes: 55, sessions: [session()] });
  assert.equal(plan.items.length, 0);
  assert.equal(plan.empty, "time-used");
});

check("work is reported beside the plan, not turned into practice", () => {
  const plan = build({ sessions: [session({ basis: "work", title: "Work on Essay" })] });
  assert.equal(plan.items.length, 0);
  assert.deepEqual(plan.alsoToday, ["Work on Essay"]);
});

check("a topic finished earlier today is not planned again", () => {
  const plan = build({ sessions: [session()], done: ["bio|genetics"] });
  assert.equal(plan.items.length, 0);
  assert.equal(plan.empty, "all-done");
});

check("the same topic from the planner and the scheduler is planned once", () => {
  const plan = build({ sessions: [session({ source: "planned" }), session()] });
  assert.equal(plan.totalMinutes, 30);
});

console.log("\nan empty plan says why");

check("no subjects, then no material, then nothing due", () => {
  assert.equal(build({ context: { subjects: 0, materials: 0 } }).empty, "no-subjects");
  assert.equal(build({ context: { subjects: 2, materials: 0 } }).empty, "no-material");
  assert.equal(build({}).empty, "nothing-due");
});

check("a long exam title cannot break the 300-character reason column", () => {
  const plan = build({ sessions: [session({ reason: "x".repeat(400) })] });
  assert.ok(plan.items.every((item) => item.reason.length <= 300));
});

console.log(`\n${passed} checks passed\n`);
