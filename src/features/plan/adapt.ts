/* TYPE-ONLY imports — `scripts/plan-test.mjs` loads this file straight into
   Node. Anything date-shaped (how many days ago) is computed by the caller. */
import type { Difficulty, Evidence, Mastery } from "@/features/mastery/formula";
import type { DaySession } from "./build";

/**
 * A plan that reacts to the last result (FR-L4, US-J2, Sprint 68).
 *
 * **Why mastery alone is not enough.** Mastery (Sprint 56) is a 30-day,
 * weighted reading across every answer — exactly right for "how well do I
 * know Genetics", and deliberately slow. A single bad quiz yesterday barely
 * moves it, so a plan built only on mastery would shrug at the result the
 * student is still smarting from. US-J2 asks for the opposite: a poor result
 * changes the NEXT plan. So this reads the most recent run per topic, and
 * acts on that, on top of everything the plan already does.
 *
 *  - **Poor** — a follow-up on that topic goes to the front of the plan:
 *    review, then practise again. It takes time from something else; that is
 *    the adaptation.
 *  - **Strong, and strong overall** — the topic is done for now; the session
 *    moves on to the next topic in the subject that is not.
 *  - **Strong, not yet strong overall** — harder questions. Delivered as a
 *    quiz, because a practice block would reopen the same practice set at the
 *    same level and the reason would be a lie; the quiz launcher reads the
 *    same result and steps the difficulty up (`difficultyAfter`).
 *
 * Every change rewrites the session's reason, so the block says what changed
 * and why — US-J2's third line, "I can see why an item is in my plan".
 */

/** How far back a result still counts as "the last one". */
export const RESULT_WINDOW_DAYS = 7;
/** Fewer answers on a topic than this in one run is not a result about it. */
export const MIN_RESULT_QUESTIONS = 3;
export const POOR_RESULT = 0.6;
export const STRONG_RESULT = 0.85;
/** Follow-ups per plan. More than this and the plan is only follow-ups. */
export const MAX_FOLLOW_UPS = 2;

export type RecentResult = {
  topicId: string;
  correct: number;
  total: number;
  /** Calendar days ago, in the student's timezone. */
  daysAgo: number;
  difficulty: Difficulty;
};

export type Verdict = "poor" | "fair" | "strong";

export function verdictOf(result: RecentResult): Verdict {
  const score = result.correct / result.total;
  if (score < POOR_RESULT) return "poor";
  if (score >= STRONG_RESULT) return "strong";
  return "fair";
}

/**
 * The latest run on each topic, from the answers.
 *
 * Per topic, the run whose newest answer is newest — and only that run's
 * answers ON THAT TOPIC are counted, so a whole-subject quiz yields a
 * separate result for each topic it covered well enough to say something
 * about. Runs older than the window, or too thin on the topic, give nothing:
 * no result is better than a result built from two questions.
 */
export function latestResults(
  evidence: Evidence[],
  daysAgoOf: (iso: string) => number,
): Map<string, RecentResult> {
  /* topic → attempt → answers */
  const runs = new Map<string, Map<string, Evidence[]>>();
  for (const answer of evidence) {
    if (!answer.topicId || !answer.attemptId) continue;
    const byAttempt = runs.get(answer.topicId) ?? new Map<string, Evidence[]>();
    const list = byAttempt.get(answer.attemptId) ?? [];
    list.push(answer);
    byAttempt.set(answer.attemptId, list);
    runs.set(answer.topicId, byAttempt);
  }

  const results = new Map<string, RecentResult>();
  for (const [topicId, byAttempt] of runs) {
    let latest: { answers: Evidence[]; at: string } | null = null;
    for (const answers of byAttempt.values()) {
      const at = answers.reduce((max, a) => (a.answeredAt > max ? a.answeredAt : max), "");
      if (!latest || at > latest.at) latest = { answers, at };
    }
    if (!latest || latest.answers.length < MIN_RESULT_QUESTIONS) continue;

    const daysAgo = daysAgoOf(latest.at);
    if (daysAgo > RESULT_WINDOW_DAYS) continue;

    results.set(topicId, {
      topicId,
      correct: latest.answers.filter((a) => a.correct).length,
      total: latest.answers.length,
      daysAgo,
      difficulty: latest.answers[0]!.difficulty,
    });
  }
  return results;
}

const STEP: Difficulty[] = ["easy", "medium", "hard"];

/**
 * The difficulty to set next, given the last result.
 *
 * One step up from the run that went well, one step down from the one that
 * did not, the same again for a middling one. Relative to the run's OWN
 * difficulty, not to a fixed level: 9/10 on easy questions earns medium, not
 * a leap to hard. No recent result falls back to whatever the caller already
 * had — Sprint 59's reading of the pattern of mistakes.
 */
export function difficultyAfter(
  result: RecentResult | undefined,
  fallback: Difficulty,
): Difficulty {
  if (!result) return fallback;
  const index = STEP.indexOf(result.difficulty);
  const verdict = verdictOf(result);
  if (verdict === "strong") return STEP[Math.min(index + 1, 2)]!;
  if (verdict === "poor") return STEP[Math.max(index - 1, 0)]!;
  return result.difficulty;
}

/** A topic the plan could move on to. */
export type TopicInfo = {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  position: number;
  /** Null when nothing has been answered on it. */
  band: Mastery["band"] | null;
  /** Without files there is nothing to study it from, so it is never moved on to. */
  hasMaterial: boolean;
};

export type AdaptInput = {
  sessions: DaySession[];
  results: Map<string, RecentResult>;
  topics: TopicInfo[];
};

export type Adapted = {
  sessions: DaySession[];
  /** How many sessions a recent result added or changed. */
  changed: number;
};

function when(daysAgo: number): string {
  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  return `${daysAgo} days ago`;
}

function score(result: RecentResult): string {
  return `${result.correct}/${result.total}`;
}

export function adaptSessions({ sessions, results, topics }: AdaptInput): Adapted {
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  let changed = 0;

  /* ---- Poor results: follow-ups, most recent first ---------------------- */
  const poor = [...results.values()]
    .filter((result) => verdictOf(result) === "poor" && topicById.has(result.topicId))
    .sort((a, b) => a.daysAgo - b.daysAgo || a.correct / a.total - b.correct / b.total)
    .slice(0, MAX_FOLLOW_UPS);
  const followTopics = new Set(poor.map((result) => result.topicId));

  const planned: DaySession[] = [];
  const rest: DaySession[] = [];
  for (const session of sessions) {
    if (session.source === "planned") {
      /* The student's own session on a topic they just did badly on keeps its
         place — they chose it — but turns into review-then-practice. */
      const result = session.topicId ? results.get(session.topicId) : undefined;
      if (result && followTopics.has(result.topicId) && session.basis !== "work") {
        planned.push({
          ...session,
          basis: "weak",
          reason: `${score(result)} on ${session.topicName ?? "it"} ${when(result.daysAgo)} — review it, then practise again`,
        });
        followTopics.delete(result.topicId);
        changed += 1;
      } else {
        planned.push(session);
      }
    } else if (!(session.topicId && followTopics.has(session.topicId))) {
      /* A suggested session on a follow-up topic is replaced by the follow-up. */
      rest.push(session);
    }
  }

  const followUps: DaySession[] = poor
    .filter((result) => followTopics.has(result.topicId))
    .map((result): DaySession => {
      const topic = topicById.get(result.topicId)!;
      changed += 1;
      return {
        subjectId: topic.subjectId,
        subjectName: topic.subjectName,
        colorSlot: topic.colorSlot,
        topicId: topic.id,
        topicName: topic.name,
        title: `Follow up on ${topic.name}`,
        basis: "weak",
        reason: `${score(result)} on ${topic.name} ${when(result.daysAgo)} — review it, then practise again`,
        source: "adapted",
      };
    });

  /* ---- Strong results: harder, or on to the next topic ------------------ */
  const taken = new Set(
    [...planned, ...followUps, ...rest].map((session) => session.topicId).filter(Boolean),
  );

  const raised = [...planned, ...rest].map((session): DaySession => {
    if (!session.topicId || session.basis === "work") return session;
    const result = results.get(session.topicId);
    if (!result || verdictOf(result) !== "strong") return session;
    const topic = topicById.get(session.topicId);
    const name = topic?.name ?? session.topicName ?? "this topic";

    /* Strong now AND strong overall: done for now. Move a SUGGESTED session on
       to the next topic in the subject that still needs work — never the
       student's own planned session, which they filed against this topic on
       purpose; that one is confirmed with a harder quiz instead. */
    if (topic?.band === "strong" && session.source !== "planned") {
      const next = topics
        .filter(
          (candidate) =>
            candidate.subjectId === topic.subjectId &&
            candidate.position > topic.position &&
            candidate.band !== "strong" &&
            candidate.hasMaterial &&
            !taken.has(candidate.id),
        )
        .sort((a, b) => a.position - b.position)[0];

      if (next) {
        taken.add(next.id);
        changed += 1;
        return {
          ...session,
          topicId: next.id,
          topicName: next.name,
          title: `Start ${next.name}`,
          basis: next.band ?? "unmeasured",
          reason: `${score(result)} on ${name} ${when(result.daysAgo)} and strong overall — on to ${next.name}`,
          source: "adapted",
        };
      }
    }

    changed += 1;
    return {
      ...session,
      basis: "strong",
      reason: `${score(result)} on ${name} ${when(result.daysAgo)} — harder questions now`,
      source: session.source === "planned" ? "planned" : "adapted",
    };
  });

  const raisedPlanned = raised.slice(0, planned.length);
  const raisedRest = raised.slice(planned.length);

  return { sessions: [...raisedPlanned, ...followUps, ...raisedRest], changed };
}
