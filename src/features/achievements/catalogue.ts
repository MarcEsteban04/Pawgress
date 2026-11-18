/**
 * Achievements — what they are, and when one is earned (Sprint 72).
 *
 * Import-free, so `scripts/achievements-test.mjs` can pin it in Node.
 *
 * **What is rewarded is learning, not volume.** A badge for fifty quizzes
 * rewards fifty easy quizzes, and a student chasing it is doing the one thing
 * this product spends most of its effort telling them not to: mistaking
 * activity for knowledge. So most of these reward a real change in what the
 * student knows — a weak topic turned around, a subject's readiness reached,
 * every topic in a subject measured — and the ones that do count (time,
 * streaks, one quiz milestone) count things that cannot be faked by picking
 * easier questions.
 *
 * **Earned once, kept.** A subject's readiness can fall again; the achievement
 * for reaching it does not, because it records something that happened. The
 * table's unique `(user_id, code)` is what makes a second grant a no-op.
 *
 * **Celebrated in words, never with a character, and never on a failure**
 * (docs/branding.md). Nothing here can be earned BY doing badly.
 */

/** Everything the rules read — gathered on the server by `getAchievementFacts`. */
export type AchievementFacts = {
  sessions: number;
  totalMinutes: number;
  /** Longest run of consecutive study days, ever. */
  longestStreak: number;
  quizzesHandedIn: number;
  mockExams: number;
  /** Days whose plan had at least one block and every block done. */
  fullPlanDays: number;
  /** Topics that started weak and are strong now — see `turnedAround`. */
  turnedAround: { topicId: string; topicName: string }[];
  /** Subjects whose readiness is at or above `READY_SCORE`. */
  readySubjects: { subjectId: string; subjectName: string }[];
  /** Subjects with at least one topic, every one of them measured. */
  coveredSubjects: { subjectId: string; subjectName: string }[];
};

export type Earned = { code: string; metadata: Record<string, string | number> };

export type AchievementKind = {
  /** The code, or its prefix for per-subject and per-topic ones. */
  code: string;
  title: string;
  /** What it means once earned, said to the student. */
  earned: string;
  /** How to earn it, for the ones still ahead. */
  how: string;
  /** Per-subject or per-topic: earned once for each. */
  repeats: boolean;
};

export const READY_SCORE = 0.8;
/** Answers that make a topic's start "how it started". */
export const START_ANSWERS = 10;
export const START_WEAK = 0.6;
export const NOW_STRONG = 0.75;

export const ACHIEVEMENTS: AchievementKind[] = [
  {
    code: "first_session",
    title: "Started",
    earned: "You finished your first study session.",
    how: "Finish a practice set, a deck of flashcards, a quiz or a timed session.",
    repeats: false,
  },
  {
    code: "first_quiz",
    title: "First quiz handed in",
    earned: "Your first quiz is marked and counted.",
    how: "Hand in a quiz.",
    repeats: false,
  },
  {
    code: "first_mock",
    title: "Sat a mock exam",
    earned: "You sat a full mock exam, against the clock.",
    how: "Take a mock exam from the Quizzes page.",
    repeats: false,
  },
  {
    code: "full_plan_day",
    title: "A whole day's plan, done",
    earned: "Every block in a day's plan, finished.",
    how: "Build today's plan on the dashboard and finish every block in it.",
    repeats: false,
  },
  {
    code: "turned_around",
    title: "Turned it around",
    earned: "A topic you started weak on is strong now.",
    how: `Take a topic you got under ${Math.round(START_WEAK * 100)}% on at first up to ${Math.round(NOW_STRONG * 100)}% mastery.`,
    repeats: true,
  },
  {
    code: "subject_ready",
    title: "Ready",
    earned: `A subject's readiness reached ${Math.round(READY_SCORE * 100)}%.`,
    how: `Bring a subject's readiness to ${Math.round(READY_SCORE * 100)}% — the breakdown on the dashboard says which input to move.`,
    repeats: true,
  },
  {
    code: "covered",
    title: "Every topic measured",
    earned: "Every topic in a subject has enough answers to count.",
    how: "Practise every topic in a subject until each one is measured.",
    repeats: true,
  },
  {
    code: "quizzes_10",
    title: "Ten quizzes",
    earned: "Ten quizzes handed in.",
    how: "Hand in ten quizzes.",
    repeats: false,
  },
  {
    code: "hours_5",
    title: "Five hours",
    earned: "Five hours of finished study.",
    how: "Study for five hours in total.",
    repeats: false,
  },
  {
    code: "hours_20",
    title: "Twenty hours",
    earned: "Twenty hours of finished study.",
    how: "Study for twenty hours in total.",
    repeats: false,
  },
  {
    code: "hours_50",
    title: "Fifty hours",
    earned: "Fifty hours of finished study.",
    how: "Study for fifty hours in total.",
    repeats: false,
  },
  {
    code: "streak_7",
    title: "A week in a row",
    earned: "Seven days in a row with study in them.",
    how: "Study on seven days in a row.",
    repeats: false,
  },
  {
    code: "streak_30",
    title: "A month in a row",
    earned: "Thirty days in a row with study in them.",
    how: "Study on thirty days in a row.",
    repeats: false,
  },
];

/** The kind an earned code belongs to: per-subject codes are `prefix:id`. */
export function kindOf(code: string): AchievementKind | undefined {
  const prefix = code.split(":")[0];
  return ACHIEVEMENTS.find((kind) => kind.code === prefix);
}

/** Every achievement the facts show has been earned. */
export function earnedFrom(facts: AchievementFacts): Earned[] {
  const earned: Earned[] = [];
  const add = (code: string, metadata: Record<string, string | number> = {}) =>
    earned.push({ code, metadata });

  if (facts.sessions > 0) add("first_session");
  if (facts.quizzesHandedIn > 0) add("first_quiz");
  if (facts.mockExams > 0) add("first_mock");
  if (facts.fullPlanDays > 0) add("full_plan_day");
  if (facts.quizzesHandedIn >= 10) add("quizzes_10");

  const hours = facts.totalMinutes / 60;
  if (hours >= 5) add("hours_5");
  if (hours >= 20) add("hours_20");
  if (hours >= 50) add("hours_50");

  if (facts.longestStreak >= 7) add("streak_7");
  if (facts.longestStreak >= 30) add("streak_30");

  for (const topic of facts.turnedAround) {
    add(`turned_around:${topic.topicId}`, { name: topic.topicName });
  }
  for (const subject of facts.readySubjects) {
    add(`subject_ready:${subject.subjectId}`, { name: subject.subjectName });
  }
  for (const subject of facts.coveredSubjects) {
    add(`covered:${subject.subjectId}`, { name: subject.subjectName });
  }

  return earned;
}

/**
 * Topics that started weak and are strong now.
 *
 * "Started" is the topic's first ten answers, in the order they were given;
 * "now" is its Sprint 56 mastery. Both ends need real evidence: a topic with
 * ten answers in total has no "since" to have improved over.
 */
export function turnedAround(
  answers: { topicId: string; correct: boolean; answeredAt: string }[],
  mastery: Map<string, { mastery: number; questions: number; name: string }>,
): { topicId: string; topicName: string }[] {
  const byTopic = new Map<string, { correct: boolean; answeredAt: string }[]>();
  for (const answer of answers) {
    const list = byTopic.get(answer.topicId) ?? [];
    list.push(answer);
    byTopic.set(answer.topicId, list);
  }

  const result: { topicId: string; topicName: string }[] = [];
  for (const [topicId, list] of byTopic) {
    const now = mastery.get(topicId);
    if (!now || list.length < START_ANSWERS * 2) continue;
    const first = [...list]
      .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
      .slice(0, START_ANSWERS);
    const start = first.filter((answer) => answer.correct).length / first.length;
    if (start < START_WEAK && now.mastery >= NOW_STRONG) {
      result.push({ topicId, topicName: now.name });
    }
  }
  return result;
}

/** The longest run of consecutive calendar days in a set of `YYYY-MM-DD` keys. */
export function longestRun(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const key of sorted) {
    const [y, m, d] = key.split("-").map(Number);
    const day = Date.UTC(y!, m! - 1, d!) / 86_400_000;
    run = previous !== null && day - previous === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}
