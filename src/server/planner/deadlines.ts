import "server-only";

import { cache } from "react";
import { getSubjectMastery, getTopicMastery } from "@/server/mastery/queries";
import { getStudentToday, listUpcoming, type PlannerEvent } from "@/server/planner/queries";
import { daysBetween, type When } from "@/features/planner/dates";
import { EVENT_KIND_INFO } from "@/features/planner/schema";
import { byUrgency, urgencyOf, urgencyReason, type Urgency } from "@/features/planner/urgency";
import { type Mastery } from "@/features/mastery/formula";

/**
 * Deadlines, with how ready the student is for each (FR-N3, US-I2, Sprint 62).
 *
 * **The join is the sprint.** Sprint 60 could list events and Sprint 56 could
 * score topics, and nothing had ever put the two in the same sentence. A
 * deadline list that says "Biology exam · in 9 days" is a calendar; one that
 * says "in 9 days · you are weak on Genetics" is the thing this product is
 * for.
 *
 * **Completed events are not deadlines.** They are in the calendar, where the
 * day they fell on still matters, and they are out of here — a list of what is
 * still to do that keeps what is done is a list that only grows.
 *
 * Both mastery loaders are request-cached and are already read by the
 * dashboard, the progress page and the subject hub, so this adds no query on a
 * page that shows any of those.
 */

/** How many to read. Far more than anyone schedules in a term, and bounded so
    a pathological account cannot ask for every row it owns. */
const MAX_DEADLINES = 200;

export type Deadline = PlannerEvent & {
  /** Whole days from the student's today. Negative is overdue. */
  daysAway: number;
  urgency: Urgency;
  /** The band behind the urgency, and what it was measured on. */
  readiness: Mastery["band"] | null;
  readinessScope: string | null;
  /** One clause saying why this is pressing, or null when the date says it all. */
  reason: string | null;
};

/**
 * The band for an event, measured as narrowly as the event is filed.
 *
 * A topic if it has one, the subject otherwise, and nothing at all when it is
 * filed under neither. Narrow first because that is the honest answer: an exam
 * on Genetics is not made safe by being strong at the rest of Biology, and
 * saying "you are weak on Biology" about a topic-scoped exam would point the
 * student at the wrong revision.
 */
function readinessFor(
  event: PlannerEvent,
  topics: Map<string, Mastery>,
  subjects: Map<string, Mastery>,
): { band: Mastery["band"] | null; scope: string | null } {
  if (event.topicId) {
    const topic = topics.get(event.topicId);
    if (topic) return { band: topic.band, scope: event.topicName };
  }
  if (event.subjectId) {
    const subject = subjects.get(event.subjectId);
    if (subject) return { band: subject.band, scope: event.subjectName };
  }
  return { band: null, scope: null };
}

export const listDeadlines = cache(async (): Promise<Deadline[]> => {
  const [events, today, topics, subjects] = await Promise.all([
    listUpcoming({ limit: MAX_DEADLINES, includeOverdue: true }),
    getStudentToday(),
    getTopicMastery(),
    getSubjectMastery(),
  ]);

  return events.map((event) => {
    const { band, scope } = readinessFor(event, topics, subjects);
    const input = {
      kind: event.kind,
      daysAway: daysBetween(today, event.dueOn),
      completed: event.completedAt !== null,
      readiness: band,
    };
    const urgency = urgencyOf(input);

    return {
      ...event,
      daysAway: input.daysAway,
      urgency,
      readiness: band,
      readinessScope: scope,
      reason: urgencyReason(input, urgency, scope),
    };
  });
});

/**
 * The same list, cut into the buckets a student thinks in.
 *
 * `when` already exists on every event from Sprint 60 and means exactly this,
 * so the buckets are its values rather than a second set of rules that could
 * disagree with the dashboard about what "this week" means.
 *
 * Sorted INSIDE each bucket by pressure — see `byUrgency` for why that is only
 * safe once the list is cut up.
 */
export type DeadlineGroup = { when: When; label: string; deadlines: Deadline[] };

const GROUP_ORDER: { when: When; label: string }[] = [
  { when: "overdue", label: "Overdue" },
  { when: "today", label: "Today" },
  { when: "tomorrow", label: "Tomorrow" },
  { when: "this_week", label: "This week" },
  { when: "later", label: "Later" },
];

export function groupDeadlines(deadlines: Deadline[]): DeadlineGroup[] {
  return GROUP_ORDER.map(({ when, label }) => ({
    when,
    label,
    deadlines: deadlines.filter((deadline) => deadline.when === when).sort(byUrgency),
  })).filter((group) => group.deadlines.length > 0);
}

/**
 * The one thing to count down to.
 *
 * **Assessed only**, and that is the point of the card: a countdown to a study
 * session a student scheduled for themselves is a countdown to nothing. The
 * `assessed` flag has been on `EVENT_KIND_INFO` since Sprint 60 waiting for
 * exactly this.
 *
 * The SOONEST, not the most pressing. A countdown is a clock, and a clock that
 * skips the next event because a later one worries us more is not one. What
 * pressure decides is what the card SAYS underneath.
 */
export function nextAssessed(deadlines: Deadline[]): Deadline | null {
  const ahead = deadlines
    .filter((deadline) => EVENT_KIND_INFO[deadline.kind].assessed && deadline.daysAway >= 0)
    .sort((a, b) => a.daysAway - b.daysAway || a.title.localeCompare(b.title));

  return ahead[0] ?? null;
}
