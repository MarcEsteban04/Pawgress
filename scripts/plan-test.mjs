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
import { summarisePlans } from "../src/features/plan/analytics.ts";
import {
  adaptSessions,
  difficultyAfter,
  latestResults,
  MAX_FOLLOW_UPS,
  verdictOf,
} from "../src/features/plan/adapt.ts";
import {
  ACTIVITY_MIX,
  buildDayPlan,
  MIN_BLOCK_MINUTES,
  pickBlockToTick,
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

console.log("\nticking off finished work");

const block = (id, topicId, activity = "practice", position = 0, subjectId = "bio") => ({
  id,
  subjectId,
  topicId,
  activity,
  position,
});

check("the exact topic's block is ticked first", () => {
  const picked = pickBlockToTick(
    [block("whole", null, "practice", 0), block("gen", "genetics", "practice", 1)],
    { subjectId: "bio", topicId: "genetics", activity: "practice" },
  );
  assert.equal(picked?.id, "gen");
});

check("a whole-subject block is satisfied by work on one of its topics", () => {
  const picked = pickBlockToTick([block("whole", null)], {
    subjectId: "bio",
    topicId: "genetics",
    activity: "practice",
  });
  assert.equal(picked?.id, "whole");
});

check("whole-subject work ticks a topic block — it is what the launcher opens", () => {
  const picked = pickBlockToTick([block("gen", "genetics")], {
    subjectId: "bio",
    topicId: null,
    activity: "practice",
  });
  assert.equal(picked?.id, "gen");
});

check("another topic's work does not tick a topic block", () => {
  const picked = pickBlockToTick([block("gen", "genetics")], {
    subjectId: "bio",
    topicId: "cells",
    activity: "practice",
  });
  assert.equal(picked, null);
});

check("a different activity or subject ticks nothing", () => {
  const review = [block("gen", "genetics", "review")];
  const done = { subjectId: "bio", topicId: "genetics", activity: "practice" };
  assert.equal(pickBlockToTick(review, done), null);
  assert.equal(pickBlockToTick([block("gen", "genetics")], { ...done, subjectId: "chem" }), null);
});

check("one finished activity ticks one block, the earliest", () => {
  const picked = pickBlockToTick(
    [block("later", "genetics", "practice", 4), block("first", "genetics", "practice", 1)],
    { subjectId: "bio", topicId: "genetics", activity: "practice" },
  );
  assert.equal(picked?.id, "first");
});

console.log("\nthe last result");

const NOW = Date.parse("2026-11-19T12:00:00Z");
const daysAgoOf = (iso) => Math.round((NOW - Date.parse(iso)) / 86_400_000);
const answer = (attemptId, topicId, correct, day, difficulty = "medium") => ({
  questionId: `${attemptId}-${topicId}-${Math.random()}`,
  topicId,
  subjectId: "bio",
  correct,
  answeredAt: `2026-11-${day}T10:00:00Z`,
  difficulty,
  attemptId,
});
const run = (attemptId, topicId, right, wrong, day, difficulty) => [
  ...Array.from({ length: right }, () => answer(attemptId, topicId, true, day, difficulty)),
  ...Array.from({ length: wrong }, () => answer(attemptId, topicId, false, day, difficulty)),
];

check("the latest run on a topic is its result, not the average", () => {
  const results = latestResults(
    [...run("old", "genetics", 9, 1, "15"), ...run("new", "genetics", 3, 7, "18")],
    daysAgoOf,
  );
  assert.deepEqual(results.get("genetics"), {
    topicId: "genetics",
    correct: 3,
    total: 10,
    daysAgo: 1,
    difficulty: "medium",
  });
});

check("a run too thin on a topic, or too old, is not a result", () => {
  const results = latestResults(
    [...run("a", "genetics", 1, 1, "18"), ...run("b", "cells", 5, 5, "05")],
    daysAgoOf,
  );
  assert.equal(results.size, 0);
});

check("one whole-subject quiz gives each topic its own result", () => {
  const results = latestResults(
    [...run("q", "genetics", 2, 3, "18"), ...run("q", "cells", 4, 0, "18")],
    daysAgoOf,
  );
  assert.equal(verdictOf(results.get("genetics")), "poor");
  assert.equal(verdictOf(results.get("cells")), "strong");
});

check("difficulty steps from the run's own level", () => {
  const r = (correct, difficulty) => ({ topicId: "t", correct, total: 10, daysAgo: 1, difficulty });
  assert.equal(difficultyAfter(r(9, "easy"), "medium"), "medium");
  assert.equal(difficultyAfter(r(9, "hard"), "medium"), "hard");
  assert.equal(difficultyAfter(r(3, "hard"), "medium"), "medium");
  assert.equal(difficultyAfter(r(3, "easy"), "medium"), "easy");
  assert.equal(difficultyAfter(r(7, "medium"), "easy"), "medium");
  assert.equal(difficultyAfter(undefined, "easy"), "easy");
});

console.log("\nthe plan reacts");

const topic = (id, position, band, hasMaterial = true) => ({
  id,
  name: id,
  subjectId: "bio",
  subjectName: "Biology",
  colorSlot: 1,
  position,
  band,
  hasMaterial,
});
const TOPICS = [
  topic("genetics", 0, "strong"),
  topic("cells", 1, "strong"),
  topic("ecology", 2, "weak"),
  topic("plants", 3, null, false),
];
const result = (topicId, correct, daysAgo = 1) => [
  topicId,
  { topicId, correct, total: 10, daysAgo, difficulty: "medium" },
];
const adapt = (sessions, results) =>
  adaptSessions({ sessions, results: new Map(results), topics: TOPICS });

check("a poor result puts a follow-up first, after the student's own sessions", () => {
  const { sessions, changed } = adapt(
    [
      session({ source: "planned", topicId: "cells", basis: "developing", title: "Cells" }),
      session({ topicId: "ecology" }),
    ],
    [result("genetics", 4)],
  );
  assert.deepEqual(
    sessions.map((s) => s.topicId),
    ["cells", "genetics", "ecology"],
  );
  assert.equal(sessions[1].basis, "weak");
  assert.equal(sessions[1].reason, "4/10 on genetics yesterday — review it, then practise again");
  assert.equal(changed, 1);
});

check("a suggested session on that topic is replaced, not doubled", () => {
  const { sessions } = adapt(
    [session({ topicId: "genetics", basis: "developing" })],
    [result("genetics", 4)],
  );
  assert.equal(sessions.filter((s) => s.topicId === "genetics").length, 1);
  assert.equal(sessions[0].source, "adapted");
});

check("the student's own session on a poor topic stays theirs, as review then practice", () => {
  const { sessions } = adapt(
    [session({ source: "planned", topicId: "genetics", basis: "developing", title: "Genetics" })],
    [result("genetics", 4)],
  );
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].source, "planned");
  assert.equal(sessions[0].basis, "weak");
});

check("follow-ups are capped", () => {
  const { sessions } = adapt([], [result("genetics", 2), result("cells", 3), result("ecology", 4)]);
  assert.equal(sessions.length, MAX_FOLLOW_UPS);
});

check("strong now and strong overall moves on to the next topic that needs work", () => {
  const { sessions } = adapt(
    [session({ topicId: "genetics", basis: "strong" })],
    [result("genetics", 9)],
  );
  /* cells is strong already, plants has no files: ecology is next. */
  assert.equal(sessions[0].topicId, "ecology");
  assert.equal(sessions[0].basis, "weak");
  assert.match(sessions[0].reason, /on to ecology$/);
});

check("the student's own session is confirmed with a harder quiz, never moved", () => {
  const { sessions } = adapt(
    [session({ source: "planned", topicId: "genetics", basis: "developing", title: "Genetics" })],
    [result("genetics", 9)],
  );
  assert.equal(sessions[0].topicId, "genetics");
  assert.equal(sessions[0].basis, "strong");
});

check("strong now but not yet overall means harder questions", () => {
  const { sessions } = adapt(
    [session({ topicId: "ecology", basis: "weak" })],
    [result("ecology", 9)],
  );
  assert.equal(sessions[0].topicId, "ecology");
  assert.equal(sessions[0].basis, "strong");
  assert.match(sessions[0].reason, /harder questions now$/);
});

check("no recent result, no change", () => {
  const input = [session({ topicId: "ecology", basis: "weak" })];
  const { sessions, changed } = adapt(input, []);
  assert.deepEqual(sessions, input);
  assert.equal(changed, 0);
});

console.log("\nplan analytics");

const item = (activity, minutes, completed, topicId = null) => ({
  activity,
  minutes,
  completed,
  topicId,
});
const DAYS3 = ["2026-11-17", "2026-11-18", "2026-11-19"];
const summarise = (plans, evidence = []) =>
  summarisePlans({ plans, days: DAYS3, evidence, dayOf: (iso) => iso.slice(0, 10) });

check("completion is counted in minutes, not blocks", () => {
  const result = summarise([
    { date: "2026-11-18", items: [item("review", 10, false), item("practice", 30, true)] },
  ]);
  assert.equal(result.plannedMinutes, 40);
  assert.equal(result.completedMinutes, 30);
  assert.equal(result.completionRate, 0.75);
  assert.equal(result.planDays, 1);
  assert.equal(result.fullDays, 0);
});

check("nothing planned is no rate, not zero", () => {
  const result = summarise([{ date: "2026-11-18", items: [] }]);
  assert.equal(result.completionRate, null);
  assert.equal(result.planDays, 0);
});

check("every day is drawn, including days with no plan", () => {
  const result = summarise([{ date: "2026-11-18", items: [item("quiz", 20, true)] }]);
  assert.deepEqual(
    result.daily.map((day) => [day.date, day.planned, day.completed]),
    [
      ["2026-11-17", 0, 0],
      ["2026-11-18", 20, 20],
      ["2026-11-19", 0, 0],
    ],
  );
  assert.equal(result.fullDays, 1);
});

check("kinds of block come in the plan's order, with their own minutes", () => {
  const result = summarise([
    {
      date: "2026-11-18",
      items: [item("quiz", 20, false), item("review", 10, true), item("review", 10, false)],
    },
  ]);
  assert.deepEqual(result.byActivity, [
    { activity: "review", planned: 20, completed: 10 },
    { activity: "quiz", planned: 20, completed: 0 },
  ]);
});

const ans = (day, correct, topicId = "genetics") => ({
  questionId: `${day}-${Math.random()}`,
  topicId,
  subjectId: "bio",
  correct,
  answeredAt: `2026-11-${day}T09:00:00Z`,
  difficulty: "medium",
});

check("a topic's accuracy before and after its first finished block, pooled", () => {
  const result = summarise(
    [{ date: "2026-11-10", items: [item("practice", 30, true, "genetics")] }],
    [
      ans("03", true),
      ans("05", false),
      ans("07", false),
      ans("09", false),
      /* The block's own day counts as after. */
      ans("10", true),
      ans("12", true),
      ans("14", true),
      ans("16", false),
    ],
  );
  assert.deepEqual(result.improvement, {
    topics: 1,
    before: 0.25,
    after: 0.75,
    improved: 1,
    held: 0,
    dropped: 0,
  });
});

check("a topic without three answers on both sides is not counted", () => {
  const result = summarise(
    [{ date: "2026-11-10", items: [item("practice", 30, true, "genetics")] }],
    [ans("05", false), ans("07", false), ans("12", true), ans("13", true), ans("14", true)],
  );
  assert.equal(result.improvement, null);
});

check("topics the plan never finished a block on are not counted", () => {
  const result = summarise(
    [{ date: "2026-11-10", items: [item("practice", 30, false, "genetics")] }],
    [
      ans("05", false),
      ans("06", false),
      ans("07", false),
      ans("12", true),
      ans("13", true),
      ans("14", true),
    ],
  );
  assert.equal(result.improvement, null);
});

console.log(`\n${passed} checks passed\n`);
