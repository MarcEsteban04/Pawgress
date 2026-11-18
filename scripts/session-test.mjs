/**
 * Timed study sessions, checked (Sprint 63).
 *
 *   npm run session:test
 *
 * Pins the rules in `src/features/study/timer.ts`: what a finished session
 * records, where the cap bites, what counts as nothing, and which planned
 * session a finished one ticks off. These are the numbers a student sees on
 * the progress page — a session recorded as two days long would poison every
 * total on it, permanently.
 */
import assert from "node:assert/strict";
import {
  ceilingSeconds,
  clockLabel,
  durationLabel,
  elapsedSeconds,
  isLeftRunning,
  MIN_SESSION_SECONDS,
  pickPlannedSession,
  SESSION_CAP_SECONDS,
  settleDuration,
} from "../src/features/study/timer.ts";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const MIN = 60;
const HOUR = 3600;

console.log("\nelapsed");

check("whole seconds between start and now", () => {
  assert.equal(elapsedSeconds(0, 90_999), 90);
});

check("a browser clock behind the server never shows negative time", () => {
  assert.equal(elapsedSeconds(10_000, 5_000), 0);
});

console.log("\nsettling a duration");

check("an ordinary session records the clock", () => {
  assert.deepEqual(settleDuration(45 * MIN, null), {
    status: "ok",
    seconds: 45 * MIN,
    capped: false,
  });
});

check("exactly at the cap is not 'left running'", () => {
  assert.equal(isLeftRunning(SESSION_CAP_SECONDS), false);
  assert.deepEqual(settleDuration(SESSION_CAP_SECONDS, null), {
    status: "ok",
    seconds: SESSION_CAP_SECONDS,
    capped: false,
  });
});

check("a session left on overnight is capped, and says so", () => {
  const settled = settleDuration(30 * HOUR, null);
  assert.deepEqual(settled, { status: "ok", seconds: SESSION_CAP_SECONDS, capped: true });
});

check("a correction can go down", () => {
  assert.deepEqual(settleDuration(60 * MIN, 40), {
    status: "ok",
    seconds: 40 * MIN,
    capped: false,
  });
});

check("a correction cannot go above the clock", () => {
  assert.deepEqual(settleDuration(30 * MIN, 300), {
    status: "ok",
    seconds: 30 * MIN,
    capped: false,
  });
});

check("a correction cannot go above the cap, even on a left-on session", () => {
  const settled = settleDuration(50 * HOUR, 6000);
  assert.equal(settled.status, "ok");
  assert.equal(settled.seconds, SESSION_CAP_SECONDS);
});

check("a stated figure on a left-on session is the student's, so not flagged as capped", () => {
  assert.deepEqual(settleDuration(50 * HOUR, 90), {
    status: "ok",
    seconds: 90 * MIN,
    capped: false,
  });
});

check("under a minute records nothing", () => {
  assert.deepEqual(settleDuration(MIN_SESSION_SECONDS - 1, null), { status: "too-short" });
  assert.deepEqual(settleDuration(2 * HOUR, 0), { status: "too-short" });
});

check("exactly a minute is a session", () => {
  assert.equal(settleDuration(MIN_SESSION_SECONDS, null).status, "ok");
});

check("negative and nonsense corrections are not trusted", () => {
  assert.deepEqual(settleDuration(20 * MIN, -5), { status: "too-short" });
  assert.deepEqual(settleDuration(20 * MIN, Number.NaN), {
    status: "ok",
    seconds: 20 * MIN,
    capped: false,
  });
});

check("the ceiling is the smaller of clock and cap", () => {
  assert.equal(ceilingSeconds(10 * MIN), 10 * MIN);
  assert.equal(ceilingSeconds(10 * HOUR), SESSION_CAP_SECONDS);
});

console.log("\nticking off a planned session");

const BIO = "bio";
const CHEM = "chem";
const GENETICS = "genetics";
const CELLS = "cells";
const plan = (id, subjectId, topicId, dueOn) => ({ id, title: id, subjectId, topicId, dueOn });
const today = "2026-11-19";

check("today's plan for the same subject is ticked", () => {
  const picked = pickPlannedSession([plan("a", BIO, null, today)], {
    subjectId: BIO,
    topicId: GENETICS,
    day: today,
  });
  assert.equal(picked?.id, "a");
});

check("a plan for a later day is left alone", () => {
  const picked = pickPlannedSession([plan("a", BIO, null, "2026-11-20")], {
    subjectId: BIO,
    topicId: null,
    day: today,
  });
  assert.equal(picked, null);
});

check("an overdue plan is caught up on", () => {
  const picked = pickPlannedSession([plan("a", BIO, null, "2026-11-17")], {
    subjectId: BIO,
    topicId: null,
    day: today,
  });
  assert.equal(picked?.id, "a");
});

check("another subject's plan is not ticked", () => {
  const picked = pickPlannedSession([plan("a", CHEM, null, today)], {
    subjectId: BIO,
    topicId: null,
    day: today,
  });
  assert.equal(picked, null);
});

check("another topic's plan is not ticked", () => {
  const picked = pickPlannedSession([plan("a", BIO, CELLS, today)], {
    subjectId: BIO,
    topicId: GENETICS,
    day: today,
  });
  assert.equal(picked, null);
});

check("a topic plan is not ticked by a whole-subject session", () => {
  const picked = pickPlannedSession([plan("a", BIO, GENETICS, today)], {
    subjectId: BIO,
    topicId: null,
    day: today,
  });
  assert.equal(picked, null);
});

check("the exact topic beats the whole subject, which beats an unfiled plan", () => {
  const candidates = [
    plan("unfiled", null, null, today),
    plan("subject", BIO, null, today),
    plan("topic", BIO, GENETICS, "2026-11-18"),
  ];
  const picked = pickPlannedSession(candidates, { subjectId: BIO, topicId: GENETICS, day: today });
  assert.equal(picked?.id, "topic");
  const second = pickPlannedSession(
    candidates.filter((c) => c.id !== "topic"),
    { subjectId: BIO, topicId: GENETICS, day: today },
  );
  assert.equal(second?.id, "subject");
});

check("an unfiled plan is satisfied by any subject", () => {
  const picked = pickPlannedSession([plan("a", null, null, today)], {
    subjectId: CHEM,
    topicId: null,
    day: today,
  });
  assert.equal(picked?.id, "a");
});

check("within a rank, today's plan is ticked before an overdue one", () => {
  const picked = pickPlannedSession(
    [plan("old", BIO, null, "2026-11-10"), plan("today", BIO, null, today)],
    { subjectId: BIO, topicId: null, day: today },
  );
  assert.equal(picked?.id, "today");
});

console.log("\nlabels");

check("the clock face", () => {
  assert.equal(clockLabel(0), "0:00");
  assert.equal(clockLabel(65), "1:05");
  assert.equal(clockLabel(3725), "1:02:05");
});

check("durations in words", () => {
  assert.equal(durationLabel(45 * MIN), "45 min");
  assert.equal(durationLabel(HOUR), "1 h");
  assert.equal(durationLabel(2 * HOUR + 5 * MIN), "2 h 5 min");
  assert.equal(durationLabel(26 * HOUR), "1 day 2 h");
  assert.equal(durationLabel(72 * HOUR), "3 days");
});

console.log(`\n${passed} checks passed\n`);
