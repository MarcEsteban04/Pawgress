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
