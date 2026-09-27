import "server-only";

import { getAiService } from "@/lib/ai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAiEvent } from "@/lib/ai/log";
import { selectQuestions } from "@/features/practice/quality";
import { isQuizDifficulty, questionPrompt, questionSetSchema } from "@/features/practice/schema";
import { type Job, type JobSliceResult } from "../types";

/**
 * Practice questions from a reviewer (FR-C2, US-F3, Sprint 45).
 *
 * Generated from the reviewer for the reason flashcards are: it is the material
 * already reduced to what matters, and questions written from the raw files
 * would test things the reviewer never told the student to learn. A practice
 * set that examines material the study aid skipped is a set that measures our
 * summarising rather than their revision.
 *
 * The target is the `quizzes` row, so the runner mirrors this job's status onto
 * it — which is right here, unlike flashcards: the set IS the target, and a
 * student watching it generate should see it say so.
 *
 * **TWO SOURCES, and `reviewer_id` chooses between them (Sprint 49).** A
 * practice set is built from the reviewer, as above. A QUIZ has no reviewer and
 * is built from the material itself — the same `extracted_text` the reviewer
 * generator reads, scoped to a subject or one topic. That is the difference
 * that matters: a practice set examines what the study aid taught, while a quiz
 * examines the syllabus, including the parts the reviewer chose to leave out.
 * A student who wants to know whether they are ready needs the second one.
 */

/**
 * How much material one quiz is written from.
 *
 * The same ceiling the reviewer generator uses, and for the same reasons:
 * countable without a tokeniser, inside every provider's window, and generous
 * enough that Groq's refusal hands it to Gemini rather than truncating.
 */
const MAX_SOURCE_CHARS = 120_000;
export async function generateQuestionsHandler(job: Job): Promise<JobSliceResult> {
  const supabase = createSupabaseAdminClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, user_id, subject_id, topic_id, reviewer_id, difficulty, question_count")
    .eq("id", job.targetId)
    .maybeSingle();

  if (!quiz) {
    return {
      kind: "failed",
      message: "That practice set is no longer in your library.",
      nextStep: "Nothing to do — it was deleted.",
      retryable: false,
    };
  }

  /* A quiz. Built from the material, and it returns early with its own
     source rather than threading a flag through the reviewer path below —
     the two share a generator, not a way of reading. */
  if (!quiz.reviewer_id) {
    return await generateFromMaterial(quiz);
  }

  const { data: reviewer } = await supabase
    .from("reviewers")
    .select("title, content, source_material_ids")
    .eq("id", quiz.reviewer_id)
    .maybeSingle();

  const content = reviewer?.content as {
    summary?: string;
    concepts?: { name: string; explanation: string }[];
    terms?: { term: string; definition: string }[];
  } | null;

  if (!content?.summary) {
    return {
      kind: "failed",
      message: "That reviewer has not finished generating yet.",
      nextStep: "Wait for it to finish, then make questions from it.",
      /* Retryable, because "not finished yet" fixes itself: the sweeper picking
         this up a minute later is the correct recovery, not a red badge. */
      retryable: true,
    };
  }

  const source = [
    `# ${reviewer?.title ?? "Reviewer"}`,
    "",
    content.summary,
    "",
    ...(content.concepts ?? []).map((concept) => `## ${concept.name}\n${concept.explanation}`),
    "",
    ...(content.terms ?? []).map((term) => `- ${term.term}: ${term.definition}`),
  ].join("\n");

  /* Falls back to medium rather than throwing. The column has a DEFAULT and a
     CHECK, so an unreadable value means the enum grew and this code did not —
     generating a medium set beats failing a job over a label. */
  const difficulty = isQuizDifficulty(quiz.difficulty) ? quiz.difficulty : "medium";

  try {
    const { data } = await getAiService().generate(
      {
        userId: quiz.user_id,
        task: "practice_questions",
        idempotencyKey: `questions:${quiz.id}`,
      },
      `${source}\n\n${questionPrompt(difficulty)}`,
      questionSetSchema,
      { context: [] },
    );

    /* Filtered, not rejected — see the schema's header. What reaches the table
       is only what can actually be put in front of a student. Sprint 48 turned
       this from one usability check into the full quality pass: verification,
       deduplication, and a deterministic choice order. */
    const { kept: usable, dropped } = selectQuestions(data.questions, source);

    if (dropped.length > 0) {
      /* Logged in aggregate, not per question. These counts are the only signal
         that a prompt change made the output worse — a set where half the
         questions are dropped as duplicates is a PROMPT problem, and without
         this it looks like a short reviewer. */
      const byReason: Record<string, number> = {};
      for (const rejection of dropped) {
        byReason[rejection.reason] = (byReason[rejection.reason] ?? 0) + 1;
      }
      logAiEvent("practice.questions.filtered", {
        quizId: quiz.id,
        difficulty,
        generated: data.questions.length,
        kept: usable.length,
        ...byReason,
      });
    }

    if (usable.length < 3) {
      /* Two different failures, and a student can act on only one of them. If
         the model produced plenty and dedupe took them, the reviewer is not too
         short — it is too repetitive to examine, and telling them to add more
         material would be the wrong advice. */
      const duplicates = dropped.filter(
        (rejection) => rejection.reason === "duplicate" || rejection.reason === "duplicate_answer",
      ).length;
      const mostlyDuplicates = duplicates > dropped.length / 2;

      return {
        kind: "failed",
        message: mostlyDuplicates
          ? "The questions we wrote from this reviewer were all variations of each other."
          : "We could not write usable questions from this reviewer.",
        nextStep: mostlyDuplicates
          ? "This reviewer covers a narrow topic — try one built from more of your material."
          : "It may be too short — try a reviewer built from more material.",
        retryable: false,
      };
    }

    /* Replace rather than append, for the reason the flashcard handler does:
       a retried job that added a second copy would leave a student answering
       the same question twice and blame us for it. */
    await supabase.from("quiz_questions").delete().eq("quiz_id", quiz.id);

    const { error } = await supabase.from("quiz_questions").insert(
      usable.map((question, index) => ({
        user_id: quiz.user_id,
        quiz_id: quiz.id,
        topic_id: quiz.topic_id,
        position: index,
        type: question.type,
        prompt: question.prompt,
        /* Trimmed here rather than trusted: the check constraint only counts
           the array, and a choice that is whitespace renders as an empty
           button. */
        choices:
          question.type === "mcq" ? question.choices.map((c) => c.trim()).filter(Boolean) : [],
        correct_answer: question.answer.trim(),
        explanation: question.explanation,
      })),
    );

    if (error) {
      return {
        kind: "failed",
        message: "We wrote the questions but could not save them.",
        nextStep: "Try again in a moment.",
        retryable: true,
      };
    }

    await supabase
      .from("quizzes")
      .update({
        question_count: usable.length,
        /* Citations are the reviewer's own sources, carried forward. They are
           what the questions ultimately came from, and inheriting them beats
           asking a model to report sources it cannot see. */
        source_material_ids: reviewer?.source_material_ids ?? [],
        status: "ready",
      })
      .eq("id", quiz.id);

    return { kind: "done" };
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : "Generation failed.";
    return {
      kind: "failed",
      message: "We could not write practice questions from this reviewer.",
      nextStep: "Try again in a moment.",
      retryable: !/schema|invalid/i.test(message),
    };
  }
}

/**
 * A quiz, written from the student's own files (FR-Q1, US-G1, Sprint 49).
 *
 * **Reads `extracted_text`, not retrieved chunks**, for the reason the reviewer
 * generator does: retrieval answers a QUESTION by finding passages that
 * resemble it, and "write me twenty questions" is not a question. Asking a
 * vector index for everything returns whatever sits nearest an empty query.
 *
 * **The requested length lives in `question_count` until the quiz is ready**,
 * and is overwritten with the real figure here. That column is read everywhere
 * behind a `status === "ready"` guard, which is what makes the overload safe —
 * a queued quiz never advertises questions that do not exist yet. It is a
 * compromise: a separate `requested_count` column would also record that a
 * student asked for twenty and got seventeen, and that migration is waiting on
 * a working `SUPABASE_ACCESS_TOKEN`.
 */
async function generateFromMaterial(quiz: {
  id: string;
  user_id: string;
  subject_id: string;
  topic_id: string | null;
  difficulty: string;
  question_count: number;
}): Promise<JobSliceResult> {
  const supabase = createSupabaseAdminClient();

  /* Scoped exactly as the student asked. A quiz on one topic built from the
     whole subject would examine the wrong thing, and nothing on screen would
     tell them that had happened. */
  let query = supabase
    .from("materials")
    .select("id, title, topic_id, extracted_text")
    .eq("subject_id", quiz.subject_id)
    .not("extracted_text", "is", null)
    .order("created_at", { ascending: true });

  if (quiz.topic_id) query = query.eq("topic_id", quiz.topic_id);

  const { data: materials } = await query;
  const usableMaterials = (materials ?? []).filter(
    (material) => (material.extracted_text ?? "").trim().length > 0,
  );

  if (usableMaterials.length === 0) {
    return {
      kind: "failed",
      message: quiz.topic_id
        ? "There is no readable text filed under this topic yet."
        : "There is no readable text in this subject yet.",
      nextStep: "Upload a file, or wait for one to finish processing.",
      retryable: false,
    };
  }

  /* Titled and joined, then truncated as a WHOLE. Cutting every file to an
     equal share would silently drop the end of the longest one, which is
     usually the lecture. */
  let budget = MAX_SOURCE_CHARS;
  const used: string[] = [];
  const sections: string[] = [];

  for (const material of usableMaterials) {
    if (budget <= 0) break;
    const body = (material.extracted_text ?? "").slice(0, budget);
    budget -= body.length;
    used.push(material.id);
    sections.push(`[${material.title}]\n${body}`);
  }

  const difficulty = isQuizDifficulty(quiz.difficulty) ? quiz.difficulty : "medium";
  const wanted = quiz.question_count > 0 ? quiz.question_count : 10;
  const source = sections.join("\n\n---\n\n");

  try {
    const { data } = await getAiService().generate(
      {
        userId: quiz.user_id,
        task: "quiz",
        /* Keyed on the quiz row: a retried job reuses the call rather than
           paying to write the same twenty questions twice (NFR-C4). */
        idempotencyKey: `quiz:${quiz.id}`,
      },
      `${source}\n\n${questionPrompt(difficulty, wanted)}`,
      questionSetSchema,
      { context: [] },
    );

    const { kept, dropped } = selectQuestions(data.questions, source);

    if (dropped.length > 0) {
      const byReason: Record<string, number> = {};
      for (const rejection of dropped) {
        byReason[rejection.reason] = (byReason[rejection.reason] ?? 0) + 1;
      }
      logAiEvent("quiz.questions.filtered", {
        quizId: quiz.id,
        difficulty,
        wanted,
        generated: data.questions.length,
        kept: kept.length,
        ...byReason,
      });
    }

    if (kept.length < 3) {
      return {
        kind: "failed",
        message: "We could not write usable questions from this material.",
        nextStep: quiz.topic_id
          ? "This topic may be too thin — try a quiz over the whole subject."
          : "Try again, or upload more material for this subject.",
        retryable: false,
      };
    }

    /* Trimmed to the length that was asked for. The prompt asks for 30% more
       precisely so this trim has something to take; a student who chose ten
       gets ten, not thirteen. Short is allowed and is not an error — it is
       what the material could honestly support. */
    const questions = kept.slice(0, wanted);

    /**
     * Which file, and so which topic, each question came from.
     *
     * The model names a file by the bracketed title it was shown; this maps
     * that back to a material we hold, and the material's topic is a fact
     * rather than a guess. Matched case-insensitively and trimmed, because a
     * model that copies "Week 3 - Cells " with a trailing space has still
     * named the right file.
     *
     * A title that matches nothing falls back to the quiz's own scope — the
     * chosen topic, or none for a whole-subject quiz. That is the honest
     * answer to "we do not know which chapter this was", and it is the same
     * answer every question got before this existed.
     */
    const byTitle = new Map(
      usableMaterials.map((material) => [material.title.trim().toLowerCase(), material]),
    );
    const origin = (source: string) => byTitle.get(source.trim().toLowerCase());

    await supabase.from("quiz_questions").delete().eq("quiz_id", quiz.id);

    const { error } = await supabase.from("quiz_questions").insert(
      questions.map((question, index) => ({
        user_id: quiz.user_id,
        quiz_id: quiz.id,
        /* A topic-scoped quiz keeps its topic whatever the model says: every
           file it read was filed under that topic, so the answer is already
           known and a model-supplied one could only be wrong. */
        topic_id: quiz.topic_id ?? origin(question.source)?.topic_id ?? null,
        /* The citation FR-C2 asked for in the Sprint 13 schema and nothing has
           filled until now: every question points back at the file it came
           from. */
        source_material_id: origin(question.source)?.id ?? null,
        position: index,
        type: question.type,
        prompt: question.prompt,
        choices:
          question.type === "mcq" ? question.choices.map((c) => c.trim()).filter(Boolean) : [],
        correct_answer: question.answer.trim(),
        explanation: question.explanation,
      })),
    );

    if (error) {
      return {
        kind: "failed",
        message: "We wrote the questions but could not save them.",
        nextStep: "Try again in a moment.",
        retryable: true,
      };
    }

    await supabase
      .from("quizzes")
      .update({
        /* The real figure now replaces the request. Everything that reads this
           column does so behind a ready check, so this is the first moment it
           is allowed to mean "questions you can answer". */
        question_count: questions.length,
        /* Recorded BEFORE generation, from what the model was shown. That is a
           fact we hold; asking it to report its own sources invites invention. */
        source_material_ids: used,
        status: "ready",
      })
      .eq("id", quiz.id);

    return { kind: "done" };
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : "Generation failed.";
    return {
      kind: "failed",
      message: "We could not write this quiz.",
      nextStep: "Try again in a moment.",
      retryable: !/schema|invalid/i.test(message),
    };
  }
}
