import { type QuestionType } from "@/features/practice/schema";

/**
 * Marking a written answer (FR-Q7, US-G3, Sprint 51).
 *
 * **One set of rules, shared by practice and quizzes.** They lived inside
 * `PracticeSession` as a client-side helper, which was fine while practice was
 * the only thing marking anything and nothing depended on the result. A quiz
 * score is recorded, feeds mastery, and must not be decidable by the browser —
 * so the rules move here, where both can import them and the server can be the
 * one that applies them.
 *
 * **Deterministic types only.** Multiple choice, true/false and identification
 * are marked by comparison; a short answer is a sentence and is marked by a
 * model (`gradeShortAnswer`), or by the student. Pretending a string comparison
 * can judge a sentence is the mistake this file exists to avoid.
 */

/**
 * The shape marking needs, and no more.
 *
 * Not `PracticeQuestion`: that carries an explanation, and nothing about
 * deciding whether an answer is right has any business reading the rationale
 * that will be shown afterwards.
 */
export type MarkableQuestion = {
  type: QuestionType;
  answer: string;
  /**
   * What was asked.
   *
   * Unused by the deterministic rules and required by the model grader, which
   * cannot judge "did they answer this" without seeing the question. Carried
   * on the type rather than threaded separately so the two markers take the
   * same input and cannot be handed mismatched halves.
   */
  prompt: string;
};

export type Verdict = {
  correct: boolean;
  /**
   * Whether a model decided this.
   *
   * Recorded on the answer row, because a student is entitled to know which of
   * their marks was a judgement rather than a comparison — and entitled to
   * overrule exactly those (FR-Q7).
   */
  byModel: boolean;
  /** Why, when the reason is not obvious. Only a model fills this in. */
  note?: string;
};

/**
 * Case, punctuation, a leading article, and runs of whitespace.
 *
 * Deliberately conservative. Every additional rule here is a claim that two
 * different strings mean the same thing, and each one that is wrong marks a
 * correct answer wrong — the failure a student cannot argue with and will not
 * forgive. Stemming and synonyms belong to the model, not to a regex.
 */
export function normaliseAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(the|a|an)\s+/, "");
}

/**
 * Mark everything that can be marked without a model.
 *
 * Returns `null` for a short answer, which is the signal to ask one. A boolean
 * here would have to be a guess, and a guess recorded as a grade is the thing
 * this product cannot afford.
 */
export function markDeterministic(question: MarkableQuestion, given: string): Verdict | null {
  const actual = normaliseAnswer(given);

  /* Blank is wrong, and it is wrong for every type. A skipped question is not
     an unmarked one — it scored nothing, which is a fact and not a judgement. */
  if (!actual) return { correct: false, byModel: false };

  const expected = normaliseAnswer(question.answer);

  switch (question.type) {
    /* Chosen from a list, so the comparison is exact. Leniency here would only
       ever mask a bug in how the choice was recorded. */
    case "mcq":
    case "true_false":
      return { correct: actual === expected, byModel: false };

    /**
     * ONE TERM, so containment is safe in both directions: "the mitochondrion"
     * matches "mitochondrion", and "mitochondrion" matches an expected
     * "mitochondrion (singular)". The same rule applied to a short answer would
     * mark a single word right against a whole model sentence, which is why
     * short answers never reach this branch.
     */
    case "identification":
      return {
        correct: actual === expected || expected.includes(actual) || actual.includes(expected),
        byModel: false,
      };

    case "short_answer":
      return null;
  }
}
