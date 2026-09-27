import "server-only";

import { z } from "zod";
import { getAiService } from "@/lib/ai";
import { logAiError } from "@/lib/ai/log";
import {
  markDeterministic,
  normaliseAnswer,
  type MarkableQuestion,
  type Verdict,
} from "@/features/quizzes/marking";

/**
 * Marking a whole quiz, server-side (FR-Q7, US-G3, Sprint 51).
 *
 * **The server marks, because the browser cannot be trusted to.** A score that
 * feeds mastery and sits in a student's history has to be decided somewhere
 * they cannot edit. This module is the only place a quiz verdict is produced.
 *
 * **Three types are compared; the fourth is judged.** Multiple choice,
 * true/false and identification are settled by `markDeterministic` — free,
 * instant, and identical every time. A short answer is a sentence, and the only
 * honest ways to mark it are a model or the student. Both are available, and
 * the row records which one did it.
 */

/**
 * What the grader is asked to return, per answer.
 *
 * `correct` is a boolean rather than a score out of five. Partial credit sounds
 * generous and is unaccountable: nobody can explain why an answer scored three,
 * least of all the model, and a student cannot argue with a number that has no
 * reasoning attached. Right or not right, with a sentence saying why.
 */
const gradeSchema = z.object({
  results: z.array(
    z.object({
      /** The index of the answer being graded, echoed back so order cannot drift. */
      index: z.number().int().min(0),
      correct: z.boolean(),
      /** One sentence a student can argue with. Shown next to the verdict. */
      reason: z.string().min(1).max(300),
    }),
  ),
});

const GRADE_PROMPT = [
  "You are marking a student's short answers against the model answers above.",
  "",
  "For each one, decide whether the student has said the same thing. Judge the",
  "MEANING, not the wording:",
  "- Different words for the same idea are correct. So are answers that are",
  "  shorter than the model answer, as long as nothing essential is missing.",
  "- Spelling and grammar are not being marked. A misspelled right answer is a",
  "  right answer.",
  "- An answer that is correct but incomplete — it names one of two required",
  "  parts — is NOT correct. Say which part is missing.",
  "- An answer that contradicts the model answer is not correct, however",
  "  confidently it is written.",
  "- A blank, a guess, or 'I don't know' is not correct.",
  "",
  "`reason` is one sentence, addressed to the student, saying what they got or",
  "what they missed. Never 'incorrect' on its own — that teaches nothing.",
  "",
  "Return one result per answer, with the index you were given.",
].join("\n");

export type GradedAnswer = {
  questionId: string;
  given: string;
  verdict: Verdict;
};

/**
 * Mark a set of answers.
 *
 * Every question is included, whether or not it was answered: a skipped
 * question scored nothing, and leaving it out of the result would make a quiz
 * of twenty look like a quiz of seventeen.
 */
export async function gradeAnswers(input: {
  userId: string;
  /** The attempt this is for. Keys the idempotency so a retry does not re-pay. */
  attemptId: string;
  answers: { questionId: string; question: MarkableQuestion; given: string }[];
}): Promise<GradedAnswer[]> {
  const graded: GradedAnswer[] = [];
  const pending: { position: number; question: MarkableQuestion; given: string }[] = [];

  for (const entry of input.answers) {
    const verdict = markDeterministic(entry.question, entry.given);

    if (verdict) {
      graded.push({ questionId: entry.questionId, given: entry.given, verdict });
      continue;
    }

    /* A short answer. Blank ones never reach the model — `markDeterministic`
       settles those, and paying a provider to confirm that an empty string is
       wrong would be absurd. */
    graded.push({
      questionId: entry.questionId,
      given: entry.given,
      /* A placeholder, replaced below. Wrong-by-default rather than
         right-by-default: if the grader fails entirely, a student sees a mark
         they can overturn rather than one they did not earn. */
      verdict: { correct: false, byModel: true, note: undefined },
    });
    pending.push({ position: graded.length - 1, question: entry.question, given: entry.given });
  }

  if (pending.length === 0) return graded;

  try {
    /* ONE call for every short answer in the quiz, not one per question. Four
       round trips for four answers would quadruple the wait and the cost for
       the same work, and the model marks them better together — it can see
       that two answers are the same claim. */
    const { data } = await getAiService().generate(
      {
        userId: input.userId,
        task: "short_answer_grade",
        /* Keyed on the attempt: a retried submission reuses the marking rather
           than paying to grade the same paper twice, and — more importantly —
           rather than returning a different verdict the second time. */
        idempotencyKey: `grade:${input.attemptId}`,
      },
      [
        ...pending.map((entry, index) =>
          [
            `--- Answer ${index} ---`,
            `Question: ${entry.question.prompt}`,
            `Model answer: ${entry.question.answer}`,
            `Student wrote: ${entry.given}`,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
        "",
        GRADE_PROMPT,
      ].join("\n\n"),
      gradeSchema,
      { context: [] },
    );

    for (const result of data.results) {
      const entry = pending[result.index];
      if (!entry) continue;
      graded[entry.position] = {
        ...graded[entry.position],
        verdict: { correct: result.correct, byModel: true, note: result.reason },
      };
    }
  } catch (thrown) {
    /**
     * The grader failed, and the quiz is still submitted.
     *
     * **Falling back to a comparison, not to a refusal.** A student who has
     * just finished twenty questions must not lose the paper because one
     * provider was down. The fallback is deliberately strict — exact match
     * after normalisation — and every one of those verdicts is marked
     * `byModel: true`, which is what puts the override control in front of
     * them. A harsh mark they can overturn beats no mark at all.
     */
    logAiError("quiz.grade_failed", thrown, { attemptId: input.attemptId, count: pending.length });

    for (const entry of pending) {
      const matched = normaliseAnswer(entry.given) === normaliseAnswer(entry.question.answer);
      graded[entry.position] = {
        ...graded[entry.position],
        verdict: {
          correct: matched,
          byModel: true,
          note: "We could not mark this one properly. Check it against the answer and change the mark if we got it wrong.",
        },
      };
    }
  }

  return graded;
}
