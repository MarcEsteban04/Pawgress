"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { getAttention } from "@/server/mastery/queries";
import { generateReviewerAction } from "@/features/reviewers/server/actions";
import { createQuizAction } from "@/features/quizzes/server/actions";
import { type Difficulty } from "@/features/mastery/formula";

/**
 * One click from a plan block to the activity it names (FR-L2, Sprint 66).
 *
 * **The target is resolved when the block is CLICKED, not when the plan is
 * built.** A plan is built in the morning and used all day; a reviewer
 * generated at lunchtime should be the one the afternoon's practice block
 * opens. And resolving at build time would mean generating a reviewer for
 * every block on the plan — spending AI quota on things nobody may open.
 *
 * **Review, practice and flashcards all start from a reviewer**, because that
 * is what the product makes them from (Sprints 43–45). Which one:
 *
 *  1. The topic's own reviewer — the block is about this topic.
 *  2. If there is none and the topic has files, a new one for it. Practising
 *     the whole of Biology because Genetics is weak puts two thirds of the
 *     effort where it is not needed.
 *  3. The subject's whole reviewer.
 *  4. Failing everything, a new whole-subject reviewer.
 *
 * Practice and flashcard pages already handle "nothing written yet" with their
 * own generate button, so a block only ever needs to land on the right
 * reviewer. One still being written lands on the reviewer itself, which shows
 * the generation as it happens.
 *
 * **A quiz is written fresh — once.** Ten questions on the topic, at the
 * difficulty Sprint 59 read from the pattern of the student's mistakes. A
 * second click on the same block reuses today's unsat quiz for the same scope
 * instead of writing another, so a double click costs one generation, not two.
 */

export type LaunchResult =
  { status: "ok"; href: string } | { status: "error"; message: string; nextStep: string };

/** Anything written in the last day counts as "today's" for reuse. */
const REUSE_WINDOW_MS = 24 * 3600 * 1000;

export async function launchPlanBlockAction(itemId: string): Promise<LaunchResult> {
  await requireSession();
  if (!z.string().uuid().safeParse(itemId).success) return gone();

  const supabase = await createSupabaseServerClient();
  const { data: item } = await supabase
    .from("study_plan_items")
    .select("id, subject_id, topic_id, activity")
    .eq("id", itemId)
    .maybeSingle();

  if (!item || !item.subject_id) return gone();
  const subjectId = item.subject_id;
  const topicId = item.topic_id;

  if (item.activity === "quiz") return launchQuiz(supabase, subjectId, topicId);

  const reviewer = await findOrMakeReviewer(supabase, subjectId, topicId);
  if (reviewer.status === "error") return reviewer;

  /* Still being written: the reviewer page shows the generation, and the
     practice or flashcard page has nothing to work from until it finishes. */
  if (!reviewer.ready) return { status: "ok", href: `/reviewers/${reviewer.id}` };

  const suffix =
    item.activity === "practice"
      ? "/practice"
      : item.activity === "flashcards"
        ? "/flashcards"
        : "";
  return { status: "ok", href: `/reviewers/${reviewer.id}${suffix}` };
}

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function findOrMakeReviewer(
  supabase: Supabase,
  subjectId: string,
  topicId: string | null,
): Promise<
  { status: "ok"; id: string; ready: boolean } | Extract<LaunchResult, { status: "error" }>
> {
  /* Every usable reviewer in the subject, newest first. Failed ones are not
     usable; the rest are ready or on their way. */
  const { data: rows } = await supabase
    .from("reviewers")
    .select("id, topic_id, status")
    .eq("subject_id", subjectId)
    .neq("status", "failed")
    .order("created_at", { ascending: false });

  const reviewers = rows ?? [];
  const pick = (row: { id: string; status: string }) => ({
    status: "ok" as const,
    id: row.id,
    ready: row.status === "ready",
  });

  if (topicId) {
    const own = reviewers.find((row) => row.topic_id === topicId);
    if (own) return pick(own);

    const made = await generateReviewerAction({ subjectId, topicId });
    if (made.status === "ok") return { status: "ok", id: made.reviewerId, ready: false };
    /* No files on this topic: fall through to the subject's reviewer. */
  }

  const whole = reviewers.find((row) => row.topic_id === null);
  if (whole) return pick(whole);

  /* A topic-scoped block whose topic has no files, in a subject that has a
     reviewer for some OTHER topic only. Better that than nothing — it is the
     right subject, and the student can see whose reviewer it is. */
  if (topicId && reviewers[0]) return pick(reviewers[0]);

  const made = await generateReviewerAction({ subjectId, topicId: null });
  if (made.status === "error") return made;
  return { status: "ok", id: made.reviewerId, ready: false };
}

async function launchQuiz(
  supabase: Supabase,
  subjectId: string,
  topicId: string | null,
): Promise<LaunchResult> {
  /* Today's quiz on the same scope, written but not yet sat. */
  let reuse = supabase
    .from("quizzes")
    .select("id, quiz_attempts(submitted_at)")
    .eq("subject_id", subjectId)
    .is("reviewer_id", null)
    .eq("is_mock_exam", false)
    .neq("status", "failed")
    .gte("created_at", new Date(Date.now() - REUSE_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(5);
  reuse = topicId ? reuse.eq("topic_id", topicId) : reuse.is("topic_id", null);

  const { data: recent } = await reuse;
  const unsat = (recent ?? []).find(
    (quiz) => !(quiz.quiz_attempts ?? []).some((attempt) => attempt.submitted_at !== null),
  );
  if (unsat) return { status: "ok", href: `/quizzes/${unsat.id}` };

  /* The difficulty the pattern of mistakes calls for, when there is one —
     Sprint 59's reading. Medium when the topic is not flagged. */
  let difficulty: Difficulty = "medium";
  if (topicId) {
    const flagged = await getAttention({ limit: 50 });
    difficulty = flagged.find((item) => item.topicId === topicId)?.difficulty ?? "medium";
  }

  const result = await createQuizAction({ subjectId, topicId, difficulty, count: 10 });
  if (result.status === "error") return result;
  return { status: "ok", href: `/quizzes/${result.quizId}` };
}

function gone(): LaunchResult {
  return {
    status: "error",
    message: "That block is no longer in your plan.",
    nextStep: "Rebuild the plan to bring it up to date.",
  };
}
