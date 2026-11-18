import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { addDays, type DateKey } from "@/features/planner/dates";
import { EVENT_KIND_INFO } from "@/features/planner/schema";
import {
  HORIZON_DAYS,
  PER_DAY_COOKIE,
  parsePerDay,
  suggestSessions,
  type Suggestion,
} from "@/features/planner/suggest";
import { LEAD_DAYS } from "@/features/planner/urgency";
import { getAttention } from "@/server/mastery/queries";
import { getProfile } from "@/server/profile/queries";
import { listDeadlines } from "@/server/planner/deadlines";
import { getStudentToday, listEvents } from "@/server/planner/queries";

/**
 * Suggested study sessions for the week (FR-N5, Sprint 64).
 *
 * **No new query of its own.** Every input is a loader something else on the
 * planner or dashboard already reads, request-cached: the deadlines with their
 * readiness (Sprint 62), the topics needing attention (Sprint 59), the week's
 * events (Sprint 60), the profile's study block (Sprint 15). The work is the
 * pure function in `features/planner/suggest.ts`; this only gathers.
 */

export type SuggestionSet = {
  days: DateKey[];
  suggestions: Suggestion[];
  unplaced: number;
  perDay: number;
  minutes: number;
  /**
   * Whether there was anything to plan around at all. Separates "nothing to
   * suggest because nothing is coming" from "nothing to suggest because your
   * week already covers it" — two different empty states, and the second is
   * a compliment.
   */
  hasInputs: boolean;
  /** The next deadline whose run-up begins after this week, and when it does. */
  nextRunUp: { title: string; startsOn: DateKey } | null;
};

/** Enough flagged topics to rotate a whole-subject exam through its weak spots. */
const ATTENTION_LIMIT = 12;

export const getSuggestions = cache(async (): Promise<SuggestionSet> => {
  const today = await getStudentToday();
  const days = Array.from({ length: HORIZON_DAYS }, (_, index) => addDays(today, index));

  const [deadlines, attention, week, profile, cookieStore] = await Promise.all([
    listDeadlines(),
    getAttention({ limit: ATTENTION_LIMIT }),
    listEvents({ from: days[0], to: days[days.length - 1] }),
    getProfile(),
    cookies(),
  ]);

  const perDay = parsePerDay(cookieStore.get(PER_DAY_COOKIE)?.value);
  const minutes = profile?.preferredSessionMinutes ?? 30;

  const open = deadlines.filter((deadline) => deadline.completedAt === null);

  const { suggestions, unplaced } = suggestSessions({
    days,
    perDay,
    minutes,
    deadlines: open.map((deadline) => ({
      id: deadline.id,
      title: deadline.title,
      kind: deadline.kind,
      subjectId: deadline.subjectId,
      subjectName: deadline.subjectName,
      colorSlot: deadline.colorSlot,
      topicId: deadline.topicId,
      topicName: deadline.topicName,
      dueOn: deadline.dueOn,
      daysAway: deadline.daysAway,
      leadDays: LEAD_DAYS[deadline.kind],
      work: EVENT_KIND_INFO[deadline.kind].work,
      assessed: EVENT_KIND_INFO[deadline.kind].assessed,
      readiness: deadline.readiness,
      pressure: deadline.urgency.pressure,
    })),
    focus: attention.map((item) => ({
      topicId: item.topicId,
      topicName: item.topicName,
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      colorSlot: item.colorSlot,
      kind: item.kind,
      daysSince: item.daysSince,
    })),
    /* Done ones too: a session already studied today still used today's time. */
    planned: week
      .filter((event) => event.kind === "study_session")
      .map((event) => ({
        dueOn: event.dueOn,
        subjectId: event.subjectId,
        topicId: event.topicId,
      })),
  });

  const schedulable = open.filter(
    (deadline) =>
      EVENT_KIND_INFO[deadline.kind].assessed && deadline.daysAway > 0 && deadline.subjectId,
  );
  /* Run-up starts this many days from today; within the horizon it is "now". */
  const runUpIn = (deadline: (typeof schedulable)[number]) =>
    deadline.daysAway - LEAD_DAYS[deadline.kind];

  const hasInputs =
    attention.length > 0 || schedulable.some((deadline) => runUpIn(deadline) < HORIZON_DAYS);

  /* The soonest run-up that has not reached this week yet — so an empty list
     can say WHEN it will fill, rather than just that it is empty. */
  const later = schedulable
    .filter((deadline) => runUpIn(deadline) >= HORIZON_DAYS)
    .sort((a, b) => runUpIn(a) - runUpIn(b))[0];
  const nextRunUp = later ? { title: later.title, startsOn: addDays(today, runUpIn(later)) } : null;

  return { days, suggestions, unplaced, perDay, minutes, hasInputs, nextRunUp };
});
