/* TYPE-ONLY import — `scripts/plan-test.mjs` loads this file straight into
   Node, which works only while nothing here is a runtime import. */
import type { Basis } from "@/features/planner/suggest";

/**
 * Today's study plan, built (FR-L1, US-J1, Sprint 65).
 *
 * **Today's plan is today's slice of the week, not a second opinion.** Sprint
 * 64 already decides which sessions the week needs and which day each lands
 * on. A separate "daily plan engine" with its own rules would sooner or later
 * tell a student to revise Chemistry today while the planner beside it says
 * Thursday. So the inputs here are the sessions ALREADY placed on today — the
 * ones the student planned themselves, then the scheduler's — and this file's
 * job is the part the week view cannot do: turn a session into activities,
 * fit them into the time there is, and say why.
 *
 * **The activities follow the reason.** Every session carries its `basis`:
 *
 *  - weak → review first, then practise. Practising what you have not
 *    understood is rehearsing mistakes.
 *  - slipping → mostly practice, a little review: it was known once.
 *  - stale → flashcards, then practice: retrieval is what fades.
 *  - untested / unmeasured → practice only. What it lacks is a measurement,
 *    and nothing else in the product can be honest about it until it has one.
 *  - developing → practice, then flashcards.
 *  - strong → a quiz. Revising what you know is comfort; confirming it is
 *    information.
 *  - work → not an activity here at all. Time on an essay is real, but it is
 *    not review or practice, and pretending otherwise would put "15m practice"
 *    against an assignment. It is reported beside the plan instead.
 *
 * **Time is a budget, not a target.** Sessions a day × the study block, minus
 * what was already studied today. A plan that ignores the hour someone put in
 * this morning is a plan that punishes them for starting early.
 */

export type PlanActivity = "review" | "practice" | "quiz" | "flashcards";

/** One session on today, from the student's planner or from the scheduler. */
export type DaySession = {
  subjectId: string;
  subjectName: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  topicId: string | null;
  topicName: string | null;
  title: string;
  basis: Basis;
  reason: string;
  /** `adapted` — added or changed by a recent result (Sprint 68, `adapt.ts`). */
  source: "planned" | "suggested" | "adapted";
};

export type PlanItemDraft = {
  subjectId: string;
  topicId: string | null;
  activity: PlanActivity;
  minutes: number;
  reason: string;
};

/** Why there is no plan, when there is not — each has a next step in the UI. */
export type EmptyReason = "no-subjects" | "no-material" | "nothing-due" | "time-used" | "all-done";

export type DayPlanInput = {
  /** Today's sessions, most important first. Planned ones should lead. */
  sessions: DaySession[];
  blockMinutes: number;
  perDay: number;
  /** Minutes already studied today, from finished study sessions. */
  studiedMinutes: number;
  /** `subject|topic` keys already finished in today's plan, not planned again. */
  done: string[];
  /** What the student has, for saying what to do when there is nothing to plan. */
  context: { subjects: number; materials: number };
};

export type DayPlan = {
  items: PlanItemDraft[];
  totalMinutes: number;
  budgetMinutes: number;
  /** Work sessions on today, by title — shown beside the plan, not inside it. */
  alsoToday: string[];
  /** Sessions that were due today and did not fit in the time left. */
  leftOver: number;
  empty: EmptyReason | null;
};

/** No block shorter than this. Ten minutes is the least worth starting. */
export const MIN_BLOCK_MINUTES = 10;

/** Below this a session is one activity; splitting 15 minutes is fussing. */
const SPLIT_FROM_MINUTES = 20;

export const ACTIVITY_MIX: Record<Basis, [PlanActivity, number][]> = {
  weak: [
    ["review", 0.4],
    ["practice", 0.6],
  ],
  slipping: [
    ["review", 0.3],
    ["practice", 0.7],
  ],
  stale: [
    ["flashcards", 0.5],
    ["practice", 0.5],
  ],
  untested: [["practice", 1]],
  unmeasured: [["practice", 1]],
  developing: [
    ["practice", 0.6],
    ["flashcards", 0.4],
  ],
  strong: [["quiz", 1]],
  work: [],
};

/** What each activity is FOR, for the reason line under it. */
const PURPOSE: Record<PlanActivity, string> = {
  review: "go over the reviewer first",
  practice: "practice questions to measure it",
  flashcards: "flashcards to bring it back",
  quiz: "a short quiz to confirm it",
};

export function sessionKey(subjectId: string, topicId: string | null): string {
  return `${subjectId}|${topicId ?? ""}`;
}

/**
 * A session's minutes, split across its activities.
 *
 * Shares are rounded to five minutes, nothing goes under the minimum, and the
 * last activity takes the remainder so the blocks add up to the session
 * exactly — a plan that says 30 minutes and lists 35 is a plan that cannot add.
 */
export function splitSession(
  basis: Basis,
  minutes: number,
): { activity: PlanActivity; minutes: number }[] {
  const mix = ACTIVITY_MIX[basis];
  if (mix.length === 0 || minutes <= 0) return [];

  if (mix.length === 1 || minutes < SPLIT_FROM_MINUTES) {
    /* The activity with the biggest share stands in for the session. */
    const [primary] = [...mix].sort((a, b) => b[1] - a[1])[0]!;
    return [{ activity: primary, minutes }];
  }

  const parts: { activity: PlanActivity; minutes: number }[] = [];
  let left = minutes;
  mix.forEach(([activity, share], index) => {
    const last = index === mix.length - 1;
    let part = last ? left : Math.round((minutes * share) / 5) * 5;
    part = Math.max(MIN_BLOCK_MINUTES, Math.min(part, left - (last ? 0 : MIN_BLOCK_MINUTES)));
    if (part <= 0) return;
    parts.push({ activity, minutes: part });
    left -= part;
  });
  return parts;
}

const REASON_LIMIT = 300;

function reasonFor(session: DaySession, activity: PlanActivity): string {
  /* A planned session keeps saying it was the student's choice; if a recent
     result changed it (Sprint 68), the block says that too. */
  const lead =
    session.source !== "planned"
      ? session.reason
      : session.reason === session.title
        ? `You planned "${session.title}"`
        : `You planned "${session.title}" · ${session.reason}`;
  const text = `${lead} — ${PURPOSE[activity]}`;
  /* The column holds 300 characters; a long exam title must not fail the save. */
  return text.length > REASON_LIMIT ? `${text.slice(0, REASON_LIMIT - 1)}…` : text;
}

export function buildDayPlan(input: DayPlanInput): DayPlan {
  const budgetMinutes = Math.max(0, input.perDay * input.blockMinutes - input.studiedMinutes);
  const done = new Set(input.done);
  const alsoToday: string[] = [];
  const items: PlanItemDraft[] = [];
  const seen = new Set<string>();
  let left = budgetMinutes;
  let leftOver = 0;
  let studyable = 0;

  for (const session of input.sessions) {
    if (session.basis === "work") {
      alsoToday.push(session.title);
      continue;
    }

    /* Already finished today, or already in this plan from a planned session
       that the scheduler also suggested — once is enough. */
    const key = sessionKey(session.subjectId, session.topicId);
    if (done.has(key) || seen.has(key)) continue;
    seen.add(key);
    studyable += 1;

    const minutes = Math.min(input.blockMinutes, left);
    if (minutes < MIN_BLOCK_MINUTES) {
      leftOver += 1;
      continue;
    }

    for (const part of splitSession(session.basis, minutes)) {
      items.push({
        subjectId: session.subjectId,
        topicId: session.topicId,
        activity: part.activity,
        minutes: part.minutes,
        reason: reasonFor(session, part.activity),
      });
    }
    left -= minutes;
  }

  const totalMinutes = items.reduce((sum, item) => sum + item.minutes, 0);

  let empty: EmptyReason | null = null;
  if (items.length === 0) {
    if (input.context.subjects === 0) empty = "no-subjects";
    else if (input.context.materials === 0) empty = "no-material";
    else if (studyable > 0 && budgetMinutes < MIN_BLOCK_MINUTES) empty = "time-used";
    else if (studyable === 0 && input.done.length > 0) empty = "all-done";
    else empty = "nothing-due";
  }

  return { items, totalMinutes, budgetMinutes, alsoToday, leftOver, empty };
}

/* ------------------------------------------------------------------------ */
/*  Ticking a block off from finished work (Sprint 67)                      */
/* ------------------------------------------------------------------------ */

export type OpenBlock = {
  id: string;
  subjectId: string | null;
  topicId: string | null;
  activity: PlanActivity;
  position: number;
};

/**
 * Which unfinished block a finished activity completes, if any.
 *
 * Same subject and same activity, always. Then the topic:
 *
 *  - the exact topic first;
 *  - a whole-subject block is satisfied by work on any of its topics;
 *  - work on the WHOLE subject (a whole-subject reviewer's practice set)
 *    satisfies a topic block too — that is exactly what the launcher opens
 *    when a topic has no files of its own (Sprint 66), and a block that can
 *    never be ticked by doing what it opened would be a broken promise.
 *
 * Earliest position wins within a tier, so the plan is ticked off in the
 * order it was written. One block per finished activity: two practice blocks
 * planned and one practice set done is one still to do.
 */
export function pickBlockToTick(
  blocks: OpenBlock[],
  done: { subjectId: string; topicId: string | null; activity: PlanActivity },
): OpenBlock | null {
  const candidates = blocks
    .filter((block) => block.subjectId === done.subjectId && block.activity === done.activity)
    .sort((a, b) => a.position - b.position);

  return (
    candidates.find((block) => block.topicId === done.topicId) ??
    candidates.find((block) => block.topicId === null) ??
    (done.topicId === null ? candidates[0] : undefined) ??
    null
  );
}
