/* TYPE-ONLY imports — `scripts/plan-test.mjs` loads this straight into Node. */
import type { Evidence } from "@/features/mastery/formula";
import type { PlanActivity } from "./build";

/**
 * How the plans have gone (FR-L5, Sprint 69).
 *
 * Three questions, each answered with figures a student can check:
 *
 *  1. **Planned against done**, in MINUTES — a ten-minute block skipped is not
 *     the same miss as a forty-minute one, and counting blocks would say it is.
 *  2. **Which kinds of block get done.** If reviews are ticked and practice is
 *     skipped every time, that is worth knowing; the plan keeps asking for
 *     practice for a reason.
 *  3. **Whether topics got better after the plan sent the student to them.**
 *     Accuracy on a topic in the two weeks before its first finished block,
 *     against from that day on. Pooled — right over asked — not an average of
 *     percentages (the Sprint 55 rule), and only for topics with enough answers
 *     on BOTH sides to say anything. It is "after", never "because of": the
 *     product cannot know what else the student did, and the copy says so.
 */

export type PlanDay = {
  /** `YYYY-MM-DD`. */
  date: string;
  items: { activity: PlanActivity; minutes: number; completed: boolean; topicId: string | null }[];
};

export type DayBar = {
  date: string;
  planned: number;
  completed: number;
  blocks: number;
  blocksDone: number;
};

export type ActivityRate = { activity: PlanActivity; planned: number; completed: number };

export type Improvement = {
  /** Topics with enough answers before and after to be counted. */
  topics: number;
  before: number;
  after: number;
  improved: number;
  held: number;
  dropped: number;
};

export type PlanAnalytics = {
  /** Days in the window that had a plan with anything in it. */
  planDays: number;
  /** Of those, days where every block was done. */
  fullDays: number;
  plannedMinutes: number;
  completedMinutes: number;
  /** Null with nothing planned — not zero, which would read as "did none of it". */
  completionRate: number | null;
  daily: DayBar[];
  byActivity: ActivityRate[];
  improvement: Improvement | null;
};

/** Days either side of a topic's first finished block that count as before and after. */
export const IMPROVEMENT_WINDOW_DAYS = 14;
/** Answers needed on EACH side before a topic's change is counted. */
export const MIN_SIDE_ANSWERS = 3;
/** Smaller moves than this are "held", not improvement — noise, at these sample sizes. */
export const CHANGE_THRESHOLD = 0.05;

const ORDER: PlanActivity[] = ["review", "practice", "flashcards", "quiz"];

/** A date key moved by whole days — UTC noon, so no DST edge can skip one. */
function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function summarisePlans(input: {
  plans: PlanDay[];
  /** The days to draw, oldest first. */
  days: string[];
  evidence: Evidence[];
  /** The student's calendar day an answer fell on. */
  dayOf: (iso: string) => string;
}): PlanAnalytics {
  const plans = input.plans.filter((plan) => plan.items.length > 0);

  let plannedMinutes = 0;
  let completedMinutes = 0;
  let fullDays = 0;
  const byDate = new Map<string, DayBar>();
  const byActivity = new Map<PlanActivity, ActivityRate>();
  /* Each topic's first finished block, by day. */
  const firstDone = new Map<string, string>();

  for (const plan of plans) {
    const bar: DayBar = { date: plan.date, planned: 0, completed: 0, blocks: 0, blocksDone: 0 };
    for (const item of plan.items) {
      bar.planned += item.minutes;
      bar.blocks += 1;
      const rate = byActivity.get(item.activity) ?? {
        activity: item.activity,
        planned: 0,
        completed: 0,
      };
      rate.planned += item.minutes;
      if (item.completed) {
        bar.completed += item.minutes;
        bar.blocksDone += 1;
        rate.completed += item.minutes;
        if (item.topicId) {
          const seen = firstDone.get(item.topicId);
          if (!seen || plan.date < seen) firstDone.set(item.topicId, plan.date);
        }
      }
      byActivity.set(item.activity, rate);
    }
    plannedMinutes += bar.planned;
    completedMinutes += bar.completed;
    if (bar.blocksDone === bar.blocks) fullDays += 1;
    byDate.set(plan.date, bar);
  }

  /* Every day in the window drawn, planned or not — a chart that skips the
     days without a plan makes a patchy fortnight look like a steady one. */
  const daily = input.days.map(
    (date) => byDate.get(date) ?? { date, planned: 0, completed: 0, blocks: 0, blocksDone: 0 },
  );

  /* ---- Improvement after plans ---------------------------------------- */
  const answersByTopic = new Map<string, Evidence[]>();
  for (const answer of input.evidence) {
    if (!answer.topicId || !firstDone.has(answer.topicId)) continue;
    const list = answersByTopic.get(answer.topicId) ?? [];
    list.push(answer);
    answersByTopic.set(answer.topicId, list);
  }

  const totals = { beforeRight: 0, beforeAll: 0, afterRight: 0, afterAll: 0 };
  const moves = { improved: 0, held: 0, dropped: 0 };
  let counted = 0;

  for (const [topicId, anchor] of firstDone) {
    const start = shiftKey(anchor, -IMPROVEMENT_WINDOW_DAYS);
    const end = shiftKey(anchor, IMPROVEMENT_WINDOW_DAYS);
    const before: Evidence[] = [];
    const after: Evidence[] = [];
    for (const answer of answersByTopic.get(topicId) ?? []) {
      const day = input.dayOf(answer.answeredAt);
      /* The block's own day counts as AFTER: the practice that ticked it was
         done that day, and that practice is the point. */
      if (day >= start && day < anchor) before.push(answer);
      else if (day >= anchor && day < end) after.push(answer);
    }
    if (before.length < MIN_SIDE_ANSWERS || after.length < MIN_SIDE_ANSWERS) continue;

    const right = (list: Evidence[]) => list.filter((answer) => answer.correct).length;
    counted += 1;
    totals.beforeRight += right(before);
    totals.beforeAll += before.length;
    totals.afterRight += right(after);
    totals.afterAll += after.length;

    const change = right(after) / after.length - right(before) / before.length;
    if (change >= CHANGE_THRESHOLD) moves.improved += 1;
    else if (change <= -CHANGE_THRESHOLD) moves.dropped += 1;
    else moves.held += 1;
  }

  return {
    planDays: plans.length,
    fullDays,
    plannedMinutes,
    completedMinutes,
    completionRate: plannedMinutes > 0 ? completedMinutes / plannedMinutes : null,
    daily,
    byActivity: ORDER.flatMap((activity) => byActivity.get(activity) ?? []),
    improvement:
      counted > 0
        ? {
            topics: counted,
            before: totals.beforeRight / totals.beforeAll,
            after: totals.afterRight / totals.afterAll,
            ...moves,
          }
        : null,
  };
}
