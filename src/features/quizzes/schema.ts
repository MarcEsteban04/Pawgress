import { QUIZ_DIFFICULTIES, type QuizDifficulty } from "@/features/practice/schema";

/**
 * A quiz, as opposed to a practice set (FR-Q1, US-G1, Sprint 49).
 *
 * **Same table, and the difference is `reviewer_id`.** A practice set hangs off
 * a reviewer and is generated from it; a quiz is built from the MATERIAL, over
 * a subject or one topic, to a length and a difficulty the student chose. One
 * table because they are the same thing to everything downstream — questions,
 * attempts, answers, scoring — and two tables would mean writing all of that
 * twice for a row that differs by one nullable column.
 *
 * `reviewer_id is null` is therefore the predicate that defines this feature,
 * and every query here filters on it. A student opening their quizzes must
 * never find the practice sets belonging to their reviewers.
 */

export { QUIZ_DIFFICULTIES, type QuizDifficulty };

/**
 * How many questions a student may ask for.
 *
 * Five is the floor because a four-question quiz scored out of four gives
 * 25-point jumps — a single unlucky answer swings it from 75% to 50%, which is
 * noise reported as a grade. Thirty is the ceiling because one generation has
 * to fit in a provider's output budget, and a set nobody finishes teaches
 * nothing.
 */
export const QUIZ_LENGTHS = [5, 10, 15, 20, 30] as const;
export const DEFAULT_QUIZ_LENGTH = 10;

export const MIN_QUIZ_LENGTH = QUIZ_LENGTHS[0];
export const MAX_QUIZ_LENGTH = QUIZ_LENGTHS[QUIZ_LENGTHS.length - 1];

export function isQuizLength(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_QUIZ_LENGTH && value <= MAX_QUIZ_LENGTH;
}

/**
 * What each difficulty means to a STUDENT, in the picker.
 *
 * Deliberately not the same words as `DIFFICULTY_RULES` in the practice schema.
 * Those are instructions to a model about cognitive load and distractor
 * plausibility; these are the promise being made to the person choosing. Saying
 * "tests reasoning across the material" in a dropdown would be accurate and
 * useless.
 */
export const DIFFICULTY_LABELS: Record<QuizDifficulty, { label: string; blurb: string }> = {
  easy: { label: "Easy", blurb: "Definitions and facts, straight from the page." },
  medium: { label: "Medium", blurb: "Applying what you read. The default for revision." },
  hard: { label: "Hard", blurb: "Joining ideas up. Wrong answers look right until you think." },
};

/** How long an average student needs per question, for the estimate on screen. */
const SECONDS_PER_QUESTION = 45;

export function estimateMinutes(count: number): number {
  return Math.max(1, Math.round((count * SECONDS_PER_QUESTION) / 60));
}

/**
 * The name a quiz gets when nobody types one.
 *
 * Built from what the student actually chose, so a list of six reads as six
 * different quizzes rather than six rows called "Quiz". Truncated to the
 * column's 300 characters by the caller.
 */
export function defaultQuizTitle(input: {
  subjectName: string;
  topicName: string | null;
  difficulty: QuizDifficulty;
  count: number;
}): string {
  const scope = input.topicName ?? input.subjectName;
  return `${scope} · ${input.count} questions · ${DIFFICULTY_LABELS[input.difficulty].label}`;
}

/**
 * The timer choices on the start screen.
 *
 * **Untimed first, and it is the default.** A timer is for rehearsing an exam,
 * and most revision is not that — leading with a countdown would make a
 * pressure test out of something a student opened to learn from. The others are
 * round numbers because nobody wants a 13-minute quiz.
 */
export const TIMER_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: "Untimed", seconds: null },
  { label: "10 min", seconds: 600 },
  { label: "20 min", seconds: 1200 },
  { label: "30 min", seconds: 1800 },
];

/* -------------------------------------------------------------------------- */
/*  Mock exams (Sprint 54)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * How long a mock exam may be.
 *
 * Longer than any quiz on purpose, because that is the thing a quiz cannot
 * rehearse: holding concentration for an hour. Sixty is the ceiling because it
 * is already three sliced generations, and a paper nobody finishes measures
 * stamina rather than knowledge.
 */
export const MOCK_EXAM_LENGTHS = [40, 50, 60] as const;
export const DEFAULT_MOCK_EXAM_LENGTH = 50;

export function isMockExamLength(value: number): boolean {
  return (MOCK_EXAM_LENGTHS as readonly number[]).includes(value);
}

/**
 * Questions written per generation call.
 *
 * A mock exam is written in slices of this size, and so is any quiz longer
 * than it. Twenty questions with explanations is roughly 4–6k output tokens:
 * inside Gemini's budget, and small enough that one slice finishing inside a
 * serverless function's time limit is not in doubt.
 */
export const QUESTIONS_PER_SLICE = 20;

/**
 * The exam clock: a minute and a quarter a question, rounded to five minutes.
 *
 * Real papers run closer to a minute a mark. The extra quarter is for reading
 * and checking, and for the short answers — which take longer than a click —
 * without which a mock would be harder than the exam it rehearses.
 */
export function mockExamSeconds(count: number): number {
  const minutes = Math.max(10, Math.round((count * 1.25) / 5) * 5);
  return minutes * 60;
}

/**
 * Extra time, as a multiple of the standard clock.
 *
 * Offered on every mock exam, not hidden behind a setting. Students with
 * access arrangements sit their real exams with it, and a rehearsal at a pace
 * they will never actually sit is not a rehearsal.
 */
export const EXTRA_TIME_FACTOR = 1.5;

/**
 * What a mock-exam score says about readiness.
 *
 * **Three bands, not a percentage dressed as a prediction.** Nobody can say
 * from one paper that a student will score 72% on the real exam, and a product
 * that implied it would be making a promise it cannot keep. The bands say what
 * the score supports: ready, close, or not yet — against the material the mock
 * was written from, at the difficulty it was set.
 *
 * Withheld entirely below twenty answered questions. A readiness label from a
 * handful of answers is noise with a verdict attached.
 */
export type Readiness = "ready" | "close" | "not_yet";

export const READINESS_MIN_QUESTIONS = 20;

export function readinessFor(correct: number, total: number): Readiness | null {
  if (total < READINESS_MIN_QUESTIONS) return null;
  const share = correct / total;
  if (share >= 0.8) return "ready";
  if (share >= 0.6) return "close";
  return "not_yet";
}

export const READINESS_COPY: Record<Readiness, { label: string; line: string }> = {
  ready: {
    label: "Ready",
    line: "You would pass this comfortably. Sit another in a few days to check it holds.",
  },
  close: {
    label: "Close",
    line: "Most of it is there. The topics below are where the remaining marks are.",
  },
  not_yet: {
    label: "Not yet",
    line: "There is ground to cover. Start with the weakest topic below — that is where the most marks are.",
  },
};

export function defaultMockExamTitle(subjectName: string, topicName: string | null, count: number) {
  return `Mock exam · ${topicName ?? subjectName} · ${count} questions`;
}
