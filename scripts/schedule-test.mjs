/**
 * Smart scheduling, checked (Sprint 64).
 *
 *   npm run schedule:test
 *
 * Pins the rules in `src/features/planner/suggest.ts`: how many sessions a
 * deadline earns, which days they land on, what already-planned sessions
 * cover, and that what does not fit is counted rather than dropped.
 */
import assert from "node:assert/strict";
import {
  MAX_FOCUS_SESSIONS,
  parsePerDay,
  suggestSessions,
} from "../src/features/planner/suggest.ts";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const DAYS = [
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
  "2026-11-23",
  "2026-11-24",
  "2026-11-25",
];

function exam(overrides = {}) {
  const daysAway = overrides.daysAway ?? 5;
  return {
    id: "exam",
    title: "Bio exam",
    kind: "exam",
    subjectId: "bio",
    subjectName: "Biology",
    colorSlot: 1,
    topicId: null,
    topicName: null,
    dueOn: overrides.dueOn ?? addDaysTo("2026-11-19", daysAway),
    daysAway,
    leadDays: 14,
    work: false,
    assessed: true,
    readiness: "weak",
    pressure: 2,
    ...overrides,
  };
}

function addDaysTo(key, n) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function focus(topicId, subjectId = "bio", kind = "weak") {
  return {
    topicId,
    topicName: topicId,
    subjectId,
    subjectName: subjectId === "bio" ? "Biology" : "Chemistry",
    colorSlot: 2,
    kind,
    daysSince: 30,
  };
}

const base = { days: DAYS, deadlines: [], focus: [], planned: [], perDay: 2, minutes: 30 };
const run = (input) => suggestSessions({ ...base, ...input });

console.log("\ndemand");

check("nothing to plan around suggests nothing", () => {
  assert.deepEqual(run({}), { suggestions: [], unplaced: 0 });
});

check("a weak exam inside its run-up gets all four sessions", () => {
  const { suggestions } = run({ deadlines: [exam({ daysAway: 5 })] });
  assert.equal(suggestions.length, 4);
});

check("a strong exam needs only one", () => {
  const { suggestions } = run({ deadlines: [exam({ readiness: "strong" })] });
  assert.equal(suggestions.length, 1);
});

check("a quiz needs half what an exam does", () => {
  const { suggestions } = run({ deadlines: [exam({ kind: "quiz", leadDays: 7 })] });
  assert.equal(suggestions.length, 2);
});

check("an exam far off gets only this week's share of its run-up", () => {
  /* Due in 20 days: run-up starts on day 6, so one day of it is this week. */
  const { suggestions } = run({ deadlines: [exam({ daysAway: 20 })] });
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].dueOn, "2026-11-25");
});

check("an exam whose run-up has not started suggests nothing", () => {
  assert.equal(run({ deadlines: [exam({ daysAway: 30 })] }).suggestions.length, 0);
});

check("an exam today, or a deadline with no subject, suggests nothing", () => {
  assert.equal(run({ deadlines: [exam({ daysAway: 0 })] }).suggestions.length, 0);
  assert.equal(run({ deadlines: [exam({ subjectId: null })] }).suggestions.length, 0);
});

check("a planned study session is not itself a deadline to revise for", () => {
  const planned = exam({ kind: "study_session", assessed: false });
  assert.equal(run({ deadlines: [planned] }).suggestions.length, 0);
});

check("work that is handed in gets working sessions, whatever the readiness", () => {
  const essay = exam({
    kind: "assignment",
    title: "Essay",
    work: true,
    leadDays: 5,
    readiness: "strong",
  });
  const { suggestions } = run({ deadlines: [essay] });
  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0].title, "Work on Essay");
});

check("sessions already planned for the subject count toward it", () => {
  const planned = [
    { dueOn: "2026-11-19", subjectId: "bio", topicId: null },
    { dueOn: "2026-11-20", subjectId: "bio", topicId: null },
  ];
  assert.equal(run({ deadlines: [exam()], planned }).suggestions.length, 2);
});

console.log("\nplacement");

check("never on the deadline's own day, or after it", () => {
  const { suggestions } = run({ deadlines: [exam({ daysAway: 3 })] });
  assert.ok(suggestions.every((s) => s.dueOn < "2026-11-22"));
});

check("spread out rather than stacked when there is room", () => {
  const { suggestions } = run({ deadlines: [exam({ daysAway: 6, readiness: "developing" })] });
  const days = new Set(suggestions.map((s) => s.dueOn));
  assert.equal(days.size, suggestions.length);
});

check("never more than the sessions a day the student allowed", () => {
  const { suggestions } = run({
    perDay: 1,
    deadlines: [exam(), exam({ id: "chem", subjectId: "chem", subjectName: "Chemistry" })],
  });
  const perDay = new Map();
  for (const s of suggestions) perDay.set(s.dueOn, (perDay.get(s.dueOn) ?? 0) + 1);
  assert.ok([...perDay.values()].every((n) => n <= 1));
});

check("what does not fit is counted, not dropped silently", () => {
  /* A weak exam in 2 days needs 4 sessions; at 1 a day there are 2 slots. */
  const result = run({ perDay: 1, deadlines: [exam({ daysAway: 2 })] });
  assert.equal(result.suggestions.length, 2);
  assert.equal(result.unplaced, 2);
});

check("planned sessions take up their day", () => {
  /* An essay due tomorrow can only be worked on today — and today is full. */
  const essay = exam({ kind: "assignment", work: true, leadDays: 5, daysAway: 1 });
  const planned = [{ dueOn: "2026-11-19", subjectId: "chem", topicId: null }];
  const result = run({ perDay: 1, planned, deadlines: [essay] });
  assert.equal(result.suggestions.length, 0);
  assert.equal(result.unplaced, 2);
});

check("the more pressing deadline gets first pick of the days", () => {
  /* Both due tomorrow, one slot today: the pressing one takes it. */
  const urgent = exam({ id: "a", daysAway: 1, readiness: "strong", pressure: 9 });
  const relaxed = exam({
    id: "b",
    subjectId: "chem",
    subjectName: "Chemistry",
    daysAway: 1,
    readiness: "strong",
    pressure: 1,
  });
  const result = run({ perDay: 1, deadlines: [relaxed, urgent] });
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].subjectId, "bio");
  assert.equal(result.unplaced, 1);
});

console.log("\ntopics");

check("a whole-subject exam rotates through that subject's weak topics first", () => {
  const { suggestions } = run({
    deadlines: [exam()],
    focus: [focus("genetics"), focus("cells", "bio", "untested"), focus("acids", "chem")],
  });
  const titles = suggestions.map((s) => s.title);
  assert.ok(titles.includes("Revise genetics"));
  assert.ok(titles.includes("Revise cells"));
  assert.ok(titles.includes("Revise Biology"));
  /* Chemistry's weak topic is not revised for a Biology exam — it gets its
     own practice session instead. */
  assert.ok(!titles.includes("Revise acids"));
  assert.ok(titles.includes("Practise acids"));
});

check("a topic used by an exam is not suggested again on its own", () => {
  const { suggestions } = run({ deadlines: [exam()], focus: [focus("genetics")] });
  assert.equal(suggestions.filter((s) => s.topicId === "genetics").length, 1);
});

check("weak topics with nothing due get one session each, up to the limit", () => {
  const many = ["a", "b", "c", "d", "e"].map((t) => focus(t));
  const { suggestions } = run({ focus: many });
  assert.equal(suggestions.length, MAX_FOCUS_SESSIONS);
  /* The most urgent three, in Sprint 59's order — not the last two. */
  const titles = suggestions.map((s) => s.title).sort();
  assert.deepEqual(titles, ["Practise a", "Practise b", "Practise c"]);
});

check("a topic already planned this week is not suggested", () => {
  const planned = [{ dueOn: "2026-11-21", subjectId: "bio", topicId: "genetics" }];
  assert.equal(run({ focus: [focus("genetics")], planned }).suggestions.length, 0);
});

check("every suggestion says why", () => {
  const { suggestions } = run({ deadlines: [exam()], focus: [focus("genetics")] });
  assert.ok(suggestions.every((s) => s.reason.length > 0));
  assert.match(suggestions.find((s) => s.topicId === "genetics").reason, /Bio exam in 5 days/);
});

console.log("\navailability");

check("sessions a day reads only 1, 2 or 3, defaulting to 2", () => {
  assert.equal(parsePerDay("3"), 3);
  assert.equal(parsePerDay("9"), 2);
  assert.equal(parsePerDay(undefined), 2);
});

console.log(`\n${passed} checks passed\n`);
