import { z } from "zod";

/**
 * Generated practice questions (FR-C2, US-F3, Sprint 45).
 *
 * **Flat, not a discriminated union.** A union becomes `anyOf` in the JSON
 * schema we hand the provider, and structured-output support for `anyOf` is
 * uneven across the three in the chain — a schema that only Groq honours is a
 * schema that silently degrades on the fallback. One shape with a `type` field
 * is understood everywhere, and the per-type rules are enforced by
 * `usableQuestion` in `./quality` rather than by the wire format.
 *
 * **The rules are a filter, not a rejection.** Refusing the whole set because
 * one MCQ listed an answer that was not among its own choices throws away nine
 * good questions and a paid generation to punish the tenth. Bad questions are
 * dropped; the rest are kept.
 */

export const QUESTION_TYPES = ["mcq", "true_false", "identification", "short_answer"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const questionSetSchema = z.object({
  questions: z
    .array(
      z.object({
        type: z.enum(QUESTION_TYPES),
        prompt: z.string().min(1).max(600),
        /**
         * The options, for `mcq` only. Empty for every other type.
         *
         * Not optional: `zodResponseFormat` emits strict JSON schema, where an
         * absent key is a validation error rather than a default. An empty
         * array is the same information and survives the round trip.
         */
        choices: z.array(z.string().min(1).max(300)).max(5),
        /**
         * The answer, as text.
         *
         * For `mcq` it must equal one of the choices exactly — matching on the
         * letter would break the moment a model reordered them. For
         * `true_false` it is "True" or "False". For the written types it is the
         * answer a student should have given.
         */
        answer: z.string().min(1).max(600),
        /**
         * Why. Required, because a question a student got wrong and cannot
         * learn from is a question that only told them they are behind.
         */
        explanation: z.string().min(1).max(800),
      }),
    )
    .min(4)
    .max(20),
});

export type GeneratedQuestion = z.infer<typeof questionSetSchema>["questions"][number];

/**
 * Difficulty (Sprint 48).
 *
 * `quizzes.difficulty` has existed with this exact constraint since the Sprint
 * 13 schema and nothing has ever read it. The generator honours it from here.
 * Choosing it in the UI is Sprint 49 — this is the mechanism, not the picker.
 */
export const QUIZ_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type QuizDifficulty = (typeof QUIZ_DIFFICULTIES)[number];

export function isQuizDifficulty(value: string | null | undefined): value is QuizDifficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

/**
 * What each level MEANS, in terms of the question rather than the wording.
 *
 * "Make it harder" is not an instruction a model can follow consistently — it
 * reaches for obscure trivia, which is not the same thing as difficulty and is
 * usually worse revision. Each level below names the cognitive step being asked
 * for and, just as importantly, what the distractors should look like: on an
 * MCQ, difficulty lives almost entirely in how plausible the wrong options are.
 */
const DIFFICULTY_RULES: Record<QuizDifficulty, string[]> = {
  easy: [
    "Difficulty: EASY. Test recall of what the material states directly —",
    "definitions, names, the terms list. One step, no combining.",
    "Wrong options should be clearly wrong to anyone who read the material,",
    "without being silly: use other real terms from the same subject.",
  ],
  medium: [
    "Difficulty: MEDIUM. Test whether the student can USE what the material",
    "says: apply a definition to a case, or connect two things it covers.",
    "Wrong options should be tempting to someone who half-read the material —",
    "a right idea attached to the wrong term, or the right term with one",
    "detail changed.",
  ],
  hard: [
    "Difficulty: HARD. Test reasoning across the material: a conclusion that",
    "needs two of its statements together, a case at the edge of a",
    "definition, or telling two similar concepts apart.",
    "Wrong options should be defensible until the student thinks it through —",
    "true statements that do not answer the question, or the correct",
    "reasoning applied to the wrong quantity.",
    "Stay inside the material. Do NOT reach for obscure facts it never",
    "mentions; obscurity is not difficulty, and it teaches nothing.",
  ],
};

/**
 * The generation prompt, for one difficulty.
 *
 * A function rather than a constant, because difficulty has to be in the prompt
 * at all: shaping it afterwards is impossible, and asking for "some easy and
 * some hard" produces a set that is neither.
 */
export function questionPrompt(difficulty: QuizDifficulty): string {
  return [
    "Write practice questions on the revision aid above.",
    "",
    ...DIFFICULTY_RULES[difficulty],
    "",
    "Mix the four types, weighted toward multiple choice and identification:",
    '- "mcq" — four options in `choices`, and `answer` must be one of them WORD',
    "  FOR WORD.",
    '- "true_false" — `answer` is exactly "True" or "False". Leave `choices` empty.',
    '- "identification" — the student names a term or a person. `answer` is that',
    "  name, and it must be a term the material actually uses. Leave `choices`",
    "  empty.",
    '- "short_answer" — one or two sentences. `answer` is a model answer. Leave',
    "  `choices` empty.",
    "",
    "Every question must:",
    "- test one thing the revision aid actually covers — no outside knowledge, and",
    "  nothing you inferred beyond what it says;",
    "- be answerable from understanding rather than from recognising a phrase;",
    "- carry an `explanation` that says WHY the answer is right, not just what it",
    "  is. A student reads this after getting it wrong.",
    "",
    /* Three rules added in Sprint 48, each for a failure seen in real output. */
    "Never do these:",
    "- Do not put the answer inside the question. If the question contains the",
    "  answer as a phrase, it teaches nothing and will be discarded.",
    "- Do not ask the same thing twice in different words. Two questions with the",
    "  same answer are one question.",
    "- Do not ask about the reviewer itself, its structure, or how many concepts",
    "  it lists. Ask about the subject.",
  ].join("\n");
}
