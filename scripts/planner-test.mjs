/**
 * Calendar days and deadlines, checked (Sprint 60).
 *
 *   npm run planner:test
 *
 * Dates are where a planner is quietly wrong: a deadline one day off is a
 * missed deadline. These pin the rules in `src/features/planner/dates.ts`,
 * the timezone cases most of all — "today" computed in UTC was the bug that
 * made this module necessary.
 */
import assert from "node:assert/strict";
import {
  addDays,
  daysBetween,
  isDateKey,
  isTimezone,
  todayIn,
  weekday,
  whenIs,
} from "../src/features/planner/dates.ts";

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

console.log("\nPlanner dates\n");

/* 2026-10-01 at 20:30 UTC. */
const EVENING_UTC = Date.parse("2026-10-01T20:30:00.000Z");

check("today is the STUDENT's date, not UTC's — ahead of UTC", () => {
  /* Manila is UTC+8: already 04:30 on the 2nd. */
  assert.equal(todayIn("Asia/Manila", EVENING_UTC), "2026-10-02");
});

check("today is the student's date — behind UTC", () => {
  /* New York is UTC-4 in October: still 16:30 on the 1st. */
  assert.equal(todayIn("America/New_York", Date.parse("2026-10-02T02:00:00.000Z")), "2026-10-01");
});

check("an unknown timezone falls back to UTC instead of throwing", () => {
  assert.equal(isTimezone("Mars/Olympus_Mons"), false);
  assert.equal(todayIn("Mars/Olympus_Mons", EVENING_UTC), "2026-10-01");
  assert.equal(todayIn(null, EVENING_UTC), "2026-10-01");
});

check("a date must be a real calendar date, not just the shape of one", () => {
  assert.equal(isDateKey("2026-02-28"), true);
  assert.equal(isDateKey("2028-02-29"), true);
  assert.equal(isDateKey("2026-02-29"), false);
  assert.equal(isDateKey("2026-13-01"), false);
  assert.equal(isDateKey("2026-2-1"), false);
});

check("adding days crosses months and years", () => {
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

check("day arithmetic survives a daylight-saving change", () => {
  /* Europe's clocks go back on 25 Oct 2026; days are still whole days. */
  assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2);
  assert.equal(addDays("2026-10-24", 2), "2026-10-26");
});

check("weeks start on Monday", () => {
  assert.equal(weekday("2026-09-28"), 0); /* a Monday */
  assert.equal(weekday("2026-10-04"), 6); /* a Sunday */
});

console.log("\nWhere a deadline sits\n");

const TODAY = "2026-10-01";

check("before today is overdue", () => assert.equal(whenIs("2026-09-30", TODAY, false), "overdue"));
check("today is today", () => assert.equal(whenIs(TODAY, TODAY, false), "today"));
check("tomorrow is tomorrow", () => assert.equal(whenIs("2026-10-02", TODAY, false), "tomorrow"));
check("within seven days is this week", () =>
  assert.equal(whenIs("2026-10-07", TODAY, false), "this_week"),
);
check("seven days or more is later", () =>
  assert.equal(whenIs("2026-10-08", TODAY, false), "later"),
);

check("done outranks overdue — finished work is never 'late'", () => {
  assert.equal(whenIs("2026-09-01", TODAY, true), "done");
});

check("'this week' is the next seven days, even on a Sunday", () => {
  /* Sunday the 4th; a Tuesday deadline is two days away, not "later". */
  assert.equal(whenIs("2026-10-06", "2026-10-04", false), "this_week");
});

console.log(failures === 0 ? "\nall planner rules hold\n" : `\n${failures} failing\n`);
process.exitCode = failures === 0 ? 0 : 1;
