/* TYPE-ONLY imports, deliberately. Node erases them, which is what lets
   `scripts/planner-test.mjs` load this module directly with no build step and
   no loader — the same rule `dates.ts` and `quizzes/marking.ts` work under. A
   runtime import of `./schema` (which pulls in zod) would break that. */
import type { EventKind } from "./schema";
import type { Mastery } from "@/features/mastery/formula";

/**
 * How much a deadline should be pressing on you (FR-N3, US-I2, Sprint 62).
 *
 * **The product's one real advantage over a to-do list is that it knows how
 * ready you are.** A calendar can tell a student an exam is in nine days.
 * Acadify has answered questions with them and can tell them it is in nine
 * days AND that they are weak on two of its topics — which is the difference
 * between a date and a warning. So urgency here is not "how soon", it is "how
 * soon, against how long this kind of thing needs, discounted by how ready you
 * already are".
 *
 * **This is why priority is computed rather than asked for.** US-I2 asks for a
 * settable priority, and a settable priority is a field that is High on
 * everything by week three: a student under pressure is the worst-placed
 * person to rank their own pressure, and they have to re-rank it every time a
 * date moves. The inputs below are ones the product observes rather than asks
 * for, so they stay true without maintenance. A stored `priority` column
 * remains a one-migration change if the manual control is wanted as well —
 * see the sprint note in docs/backlog.md.
 *
 * **Ordering is inside a day bucket, never across one.** Pressure decides
 * which of this week's deadlines comes first; it never lifts next month's exam
 * above tomorrow's essay. A deadline list that is not chronological is a list
 * a student cannot trust, however clever its ranking.
 */

/**
 * How many days of run-up each kind genuinely needs.
 *
 * Not importance — LEAD TIME, which is a different thing and the one that
 * matters here. An assignment can be written the night before and often is; an
 * exam cannot be revised for the night before, whatever anyone tells
 * themselves. A study session needs no run-up at all: it IS the run-up.
 */
export const LEAD_DAYS: Record<EventKind, number> = {
  exam: 14,
  project: 10,
  presentation: 7,
  quiz: 7,
  assignment: 5,
  study_session: 1,
};

/**
 * What readiness does to the time you have.
 *
 * A multiplier on days remaining, not on the score: being weak on the material
 * does not make the exam sooner, it makes the time you have worth less. Weak
 * halves it — nine days at half strength is the four and a half days of
 * useful preparation you actually have. Strong stretches it, because revising
 * something you already know is topping up rather than learning.
 *
 * `unmeasured` and `null` are both 1: no evidence is not bad evidence, and
 * inventing pressure from a subject the student has never been quizzed on
 * would make every new class look like a crisis.
 */
const READINESS_FACTOR: Record<Mastery["band"], number> = {
  weak: 0.5,
  developing: 0.75,
  strong: 1.5,
  unmeasured: 1,
};

export type UrgencyBand = "done" | "overdue" | "critical" | "soon" | "ahead";

export type UrgencyInput = {
  kind: EventKind;
  /** Whole days from the student's today. Negative is overdue. */
  daysAway: number;
  completed: boolean;
  /** The band for the topic, or failing that the subject. Null when neither is known. */
  readiness: Mastery["band"] | null;
};

export type Urgency = {
  band: UrgencyBand;
  /**
   * How far past the point of "should be working on this" it is. 1.0 is
   * exactly at that point; above 1 is late to start, below 1 is time in hand.
   * Exposed because it is what sorts a bucket — not shown as a number, because
   * "pressure 1.4" means nothing to a student.
   */
  pressure: number;
};

/**
 * Pressure, and the band it falls in.
 *
 * Done comes out first and flat: a finished thing exerts no pressure whatever
 * its date, and the alternative is telling a student they are late on work
 * they handed in — the fastest way to make them stop marking things done.
 */
export function urgencyOf({ kind, daysAway, completed, readiness }: UrgencyInput): Urgency {
  if (completed) return { band: "done", pressure: 0 };

  /* Overdue is its own band rather than a very high pressure. "You are late"
     and "you should start" are different sentences, and collapsing them would
     let a merely urgent exam outrank work that is already missed. */
  if (daysAway < 0) return { band: "overdue", pressure: Number.POSITIVE_INFINITY };

  const factor = READINESS_FACTOR[readiness ?? "unmeasured"];
  /* Floored at half a day so today's deadline is finite rather than dividing
     by zero — today is maximum pressure, not undefined pressure. */
  const effectiveDays = Math.max(daysAway * factor, 0.5);
  const pressure = LEAD_DAYS[kind] / effectiveDays;

  /* 1.5 and 1.0 rather than a smooth scale, because the bands are words on a
     screen and three is what a student can act on. At 1 the run-up this kind
     of work needs has started; at 1.5 half of it is already gone. */
  if (pressure >= 1.5) return { band: "critical", pressure };
  if (pressure >= 1) return { band: "soon", pressure };
  return { band: "ahead", pressure };
}

/**
 * Why it is urgent, in one clause — or null when the answer is just "it is
 * soon", which the days-remaining figure beside it already said.
 *
 * Only ever claims readiness when there IS readiness. A student who has never
 * been quizzed on a subject must not be told they are weak on it; the Sprint
 * 56 `unmeasured` band exists precisely so the product can decline to guess.
 */
export function urgencyReason(
  input: UrgencyInput,
  urgency: Urgency,
  scopeName: string | null,
): string | null {
  if (urgency.band === "done" || urgency.band === "ahead") return null;

  const where = scopeName ? ` on ${scopeName}` : "";
  if (input.readiness === "weak") return `you are weak${where}`;
  if (input.readiness === "developing" && urgency.band === "critical") {
    return `you are still shaky${where}`;
  }
  if (input.readiness === "unmeasured" || input.readiness === null) {
    /* Said only when the lead time is genuinely short, so it reads as advice
       rather than as nagging about every distant exam. */
    return urgency.band === "critical" ? "nothing measured yet" : null;
  }
  return null;
}

/**
 * Order within one bucket: most pressing first, then soonest, then by name.
 *
 * **Pressure leads, and the BUCKET is what keeps that honest.** Sorting a flat
 * deadline list by anything but the date produces a list a student cannot
 * trust — next month's exam above tomorrow's essay, however good the reasoning.
 * So the list is cut into Overdue / Today / Tomorrow / This week / Later
 * first, and this only ever reorders inside one of those. Two of them are a
 * single day, so in practice it decides the order of THIS WEEK, which is
 * exactly the question worth answering: five things are due in five days, which
 * do I start? Every row still shows its own date, so nothing is hidden by it.
 *
 * The name is the last resort so the order is TOTAL — two deadlines with the
 * same pressure on the same day would otherwise swap places between renders,
 * which reads as a list that will not sit still.
 */
export function byUrgency<T extends { urgency: Urgency; dueOn: string; title: string }>(
  a: T,
  b: T,
): number {
  /* Finished work sinks, whatever its date or its kind. */
  const aDone = a.urgency.band === "done";
  const bDone = b.urgency.band === "done";
  if (aDone !== bDone) return aDone ? 1 : -1;

  if (a.urgency.pressure !== b.urgency.pressure) {
    /* Both Infinity (two overdue items) subtracts to NaN, which would leave
       the comparator incoherent and the order arbitrary. They are equal in
       pressure by definition, so fall through to the date — oldest first,
       which is the one most likely to be actually late rather than merely
       missed this morning. */
    const diff = b.urgency.pressure - a.urgency.pressure;
    if (Number.isFinite(diff)) return diff;
  }

  if (a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
  return a.title.localeCompare(b.title);
}
