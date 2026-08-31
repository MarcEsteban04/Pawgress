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
 */
export async function generateQuestionsHandler(job: Job): Promise<JobSliceResult> {
  const supabase = createSupabaseAdminClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, user_id, subject_id, topic_id, reviewer_id, difficulty")
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

  if (!quiz.reviewer_id) {
    return {
      kind: "failed",
      message: "This practice set has nothing to draw questions from.",
      nextStep: "Generate a new one from a reviewer.",
      retryable: false,
    };
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
