import "server-only";

import { getAiService } from "@/lib/ai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAiEvent } from "@/lib/ai/log";
import { selectQuestions } from "@/features/practice/quality";
import { isQuizDifficulty, questionPrompt, questionSetSchema } from "@/features/practice/schema";
import { QUESTIONS_PER_SLICE } from "@/features/quizzes/schema";
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
    return await generateFromMaterial(quiz, job);
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
 * A quiz or a mock exam, written from the student's own files (FR-Q1, US-G1,
 * Sprints 49 and 54).
 *
 * **Reads `extracted_text`, not retrieved chunks**, for the reason the reviewer
 * generator does: retrieval answers a QUESTION by finding passages that
 * resemble it, and "write me twenty questions" is not a question.
 *
 * **Written in slices of `QUESTIONS_PER_SLICE`** (Sprint 54). Fifty questions
 * with explanations do not fit one model response — Groq's budget is 3,000
 * output tokens — and a single call big enough for sixty would also be one
 * long enough to outrun a serverless function. The job runner already slices
 * work for text extraction; this uses the same contract. Each run writes one
 * batch, saves it, and hands back a cursor; the runner comes straight back for
 * the next.
 *
 * **Every batch is deduplicated against everything saved before it**, through
 * `selectQuestions`' `already`, and told in the prompt what has been asked.
 * Without both, batch two re-asks batch one and a sixty-question paper is
 * thirty questions twice.
 *
 * **It stops when the material runs dry, not when it hits the number.** A batch
 * that keeps fewer than half of what it asked for is the material saying it
 * has no more distinct questions in it, and pressing on would only produce
 * padding the quality pass throws away. That rule also bounds the loop: a job
 * cannot keep coming back for one question at a time.
 *
 * **The requested length lives in `question_count` until the quiz is ready**,
 * and is overwritten with the real figure when the last slice lands. Every
 * reader checks `status === "ready"` first, which is what makes that safe.
 */
async function generateFromMaterial(
  quiz: {
    id: string;
    user_id: string;
    subject_id: string;
    topic_id: string | null;
    difficulty: string;
    question_count: number;
  },
  job: Job,
): Promise<JobSliceResult> {
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

  /* The first slice of a fresh generation starts clean. `cursor === null` is
     "this job has never saved progress", which is the only moment old
     questions from a previous run can be safely thrown away — a later slice
     deleting them would erase its own earlier batches. */
  if (job.cursor === null) {
    await supabase.from("quiz_questions").delete().eq("quiz_id", quiz.id);
  }

  /* What is already saved, read from the TABLE rather than trusted from the
     cursor. A slice that inserted its batch and then died before reporting
     back leaves the cursor behind the truth; counting the rows cannot. */
  const { data: savedRows } = await supabase
    .from("quiz_questions")
    .select("type, prompt, correct_answer")
    .eq("quiz_id", quiz.id)
    .order("position", { ascending: true });

  const saved = (savedRows ?? []).map((row) => ({
    type: row.type,
    prompt: row.prompt,
    answer: row.correct_answer,
  }));

  const batch = Math.min(QUESTIONS_PER_SLICE, Math.max(0, wanted - saved.length));

  if (batch === 0) {
    return await finish(supabase, quiz.id, saved.length, used);
  }

  /* The prompts already asked, so the model steers away from them rather than
     writing repeats for the quality pass to discard. Truncated: the point is
     to name what is covered, not to reproduce the paper, and sixty full
     prompts would crowd out the material itself. */
  const alreadyAsked =
    saved.length > 0
      ? [
          "",
          "These questions are ALREADY in the paper. Do not ask any of them again,",
          "in any wording — cover other parts of the material instead:",
          ...saved.map((question) => `- ${question.prompt.slice(0, 140)}`),
        ].join("\n")
      : "";

  try {
    const { data } = await getAiService().generate(
      {
        userId: quiz.user_id,
        task: "quiz",
        /* Keyed on the quiz AND how far it has got. A retried slice reuses its
           own call; the next slice is a different request and must not be
           served the previous batch from the cache. */
        idempotencyKey: `quiz:${quiz.id}:${saved.length}`,
      },
      `${source}\n\n${questionPrompt(difficulty, batch)}${alreadyAsked}`,
      questionSetSchema,
      { context: [] },
    );

    const { kept, dropped } = selectQuestions(data.questions, source, saved);

    if (dropped.length > 0) {
      const byReason: Record<string, number> = {};
      for (const rejection of dropped) {
        byReason[rejection.reason] = (byReason[rejection.reason] ?? 0) + 1;
      }
      logAiEvent("quiz.questions.filtered", {
        quizId: quiz.id,
        difficulty,
        slice: saved.length,
        batch,
        generated: data.questions.length,
        kept: kept.length,
        ...byReason,
      });
    }

    /* Trimmed to the batch. The prompt asks for 30% more precisely so this has
       something to take; a student who chose fifty gets fifty, not sixty-five. */
    const questions = kept.slice(0, batch);

    if (saved.length === 0 && questions.length < 3) {
      return {
        kind: "failed",
        message: "We could not write usable questions from this material.",
        nextStep: quiz.topic_id
          ? "This topic may be too thin — try a quiz over the whole subject."
          : "Try again, or upload more material for this subject.",
        retryable: false,
      };
    }

    /**
     * Which file, and so which topic, each question came from (Sprint 53).
     *
     * The model names a file by the bracketed title it was shown; this maps it
     * back to a material we hold, whose topic is a fact rather than a guess.
     * A title that matches nothing falls back to the quiz's own scope.
     */
    const byTitle = new Map(
      usableMaterials.map((material) => [material.title.trim().toLowerCase(), material]),
    );
    const origin = (title: string) => byTitle.get(title.trim().toLowerCase());

    if (questions.length > 0) {
      const { error } = await supabase.from("quiz_questions").insert(
        questions.map((question, index) => ({
          user_id: quiz.user_id,
          quiz_id: quiz.id,
          /* A topic-scoped quiz keeps its topic whatever the model says: every
             file it read was filed under that topic already. */
          topic_id: quiz.topic_id ?? origin(question.source)?.topic_id ?? null,
          source_material_id: origin(question.source)?.id ?? null,
          /* Continuing the paper, not restarting it. */
          position: saved.length + index,
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
    }

    const total = saved.length + questions.length;

    /* Done when the paper is full — or when the material has run dry, which is
       a batch keeping fewer than half of what it asked for. Short is allowed
       and is not an error; it is what the material could honestly support. */
    const dry = questions.length < Math.ceil(batch / 2);
    if (total >= wanted || dry) {
      return await finish(supabase, quiz.id, total, used);
    }

    return {
      kind: "continue",
      /* Strictly greater than before — the runner's stall guard insists, and
         `dry` above guarantees this batch saved at least one question. */
      cursor: total,
      totalSlices: Math.ceil(wanted / QUESTIONS_PER_SLICE),
    };
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : "Generation failed.";

    /* A later slice failing is not a lost paper. Everything saved so far is
       sound, so a mock exam that got forty of fifty questions written before a
       provider went down is finished at forty rather than thrown away — the
       student would rather sit forty than start again. */
    if (saved.length >= 3 && job.attempts >= 2) {
      return await finish(supabase, quiz.id, saved.length, used);
    }

    return {
      kind: "failed",
      message: "We could not write this quiz.",
      nextStep: "Try again in a moment.",
      retryable: !/schema|invalid/i.test(message),
    };
  }
}

/** The last slice: the real count replaces the request, and the quiz opens. */
async function finish(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  quizId: string,
  total: number,
  used: string[],
): Promise<JobSliceResult> {
  await supabase
    .from("quizzes")
    .update({
      /* Everything that reads this column does so behind a ready check, so
         this is the first moment it is allowed to mean "questions you can
         answer" rather than "questions you asked for". */
      question_count: total,
      /* Recorded from what the model was shown. That is a fact we hold; asking
         it to report its own sources invites invention. */
      source_material_ids: used,
      status: "ready",
    })
    .eq("id", quizId);

  return { kind: "done" };
}
