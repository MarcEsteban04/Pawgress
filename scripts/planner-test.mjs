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
  addMonths,
  daysBetween,
  daysInMonth,
  daysFor,
  isDateKey,
  isPlannerView,
  isTimezone,
  periodLabel,
  rangeFor,
  shift,
  startOfMonth,
  startOfWeek,
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

console.log("\nMonth and week arithmetic (Sprint 61)\n");

check("a month knows its own length, leap years included", () => {
  assert.equal(daysInMonth("2026-02-14"), 28);
  assert.equal(daysInMonth("2028-02-14"), 29);
  assert.equal(daysInMonth("2026-04-30"), 30);
  assert.equal(daysInMonth("2026-12-01"), 31);
});

check("stepping a month CLAMPS instead of rolling over", () => {
  /* The bug this exists to prevent: 31 Jan + 1 month must not be 3 March,
     which is what naive date arithmetic gives, and what makes a calendar's
     next-month button skip February entirely. */
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(addMonths("2026-05-31", 1), "2026-06-30");
});

check("stepping a month crosses the year", () => {
  assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
  assert.equal(addMonths("2026-01-15", -1), "2025-12-15");
});

check("a week starts on the Monday containing the day", () => {
  assert.equal(startOfWeek("2026-10-01"), "2026-09-28"); /* Thursday */
  assert.equal(startOfWeek("2026-09-28"), "2026-09-28"); /* already Monday */
  assert.equal(startOfWeek("2026-10-04"), "2026-09-28"); /* Sunday, same week */
});

check("startOfMonth never goes near a Date object", () => {
  assert.equal(startOfMonth("2026-10-31"), "2026-10-01");
  assert.equal(startOfMonth("2026-01-01"), "2026-01-01");
});

console.log("\nWhat each view covers\n");

check("a day view is one day", () => {
  assert.deepEqual(rangeFor("day", "2026-10-01"), { from: "2026-10-01", to: "2026-10-01" });
  assert.equal(daysFor("day", "2026-10-01").length, 1);
});

check("a week view is seven days, Monday to Sunday", () => {
  assert.deepEqual(rangeFor("week", "2026-10-01"), { from: "2026-09-28", to: "2026-10-04" });
  assert.equal(daysFor("week", "2026-10-01").length, 7);
});

check("a month view covers MORE than its month, and fetches that much", () => {
  /* The bug this prevents: October 2026 starts on a Thursday, so the grid's
     first cells are 28-30 September. Fetching only October would leave them
     reliably, invisibly empty - an exam on the 30th missing from the cell it
     is visibly sitting in. */
  const range = rangeFor("month", "2026-10-15");
  assert.equal(range.from, "2026-09-28");
  assert.equal(range.to, "2026-11-01");
});

check("a month grid is always whole weeks, Monday to Sunday", () => {
  for (const anchor of ["2026-01-15", "2026-02-15", "2028-02-15", "2026-05-15", "2027-08-15"]) {
    const days = daysFor("month", anchor);
    assert.equal(days.length % 7, 0, `${anchor} produced ${days.length} cells`);
    assert.equal(weekday(days[0]), 0);
    assert.equal(weekday(days[days.length - 1]), 6);
  }
});

check("a five-row month is not padded out to six", () => {
  /* 1 Feb 2026 is a Sunday, so the grid runs 26 Jan to 1 Mar. The point is
     that nothing assumes six rows. */
  const days = daysFor("month", "2026-02-10");
  assert.equal(days[0], "2026-01-26");
  assert.equal(days.length % 7, 0);
});

console.log("\nMoving around\n");

check("each view steps in its own unit", () => {
  assert.equal(shift("day", "2026-10-01", 1), "2026-10-02");
  assert.equal(shift("week", "2026-10-01", 1), "2026-10-08");
  assert.equal(shift("week", "2026-10-01", -1), "2026-09-24");
  assert.equal(shift("month", "2026-10-31", 1), "2026-11-30");
});

check("a URL's view and date are both guarded before they are believed", () => {
  /* The two halves of `readQuery` in view.ts. A hand-edited link or an old
     bookmark must land on today's month rather than throwing, and these are
     what decide that. */
  assert.equal(isPlannerView("week"), true);
  assert.equal(isPlannerView("fortnight"), false);
  assert.equal(isPlannerView(undefined), false);
  assert.equal(isDateKey("2026-02-30"), false);
  assert.equal(isDateKey("2026-03-09"), true);
});

check("a week is labelled by both its ends, not just its start", () => {
  /* The wording is locale-dependent, so this pins the SHAPE: a range, with a
     dash between two dates. A week labelled by one date is one a student has
     to do arithmetic on to place. */
  const label = periodLabel("week", "2026-10-01");
  assert.ok(label.includes(" – "), `expected a range dash in ${label}`);
});

console.log(failures === 0 ? "\nall planner rules hold\n" : `\n${failures} failing\n`);
process.exitCode = failures === 0 ? 0 : 1;
