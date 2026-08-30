import "server-only";

import { getAiService } from "@/lib/ai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FLASHCARD_PROMPT, flashcardSetSchema } from "@/features/flashcards/schema";
import { type Job, type JobSliceResult } from "../types";

/**
 * Flashcards from a reviewer (FR-R2, US-F2, Sprint 44).
 *
 * **Generated from the REVIEWER, not from the material.** The reviewer is
 * already the material reduced to what matters, checked against a schema that
 * bounded it — reading the raw files again would redo that work, cost the
 * tokens twice, and let the cards disagree with the reviewer a student is
 * revising from. Cards that contradict the summary above them are worse than
 * no cards.
 *
 * Idempotent by delete-then-insert, for the reason chunking is: regenerating
 * into an upsert would strand cards from a longer previous run, and a stranded
 * card is one a student keeps being tested on after it stopped being right.
 * Review counts are lost with them, which is correct — they counted attempts at
 * a different card.
 */
export async function generateFlashcardsHandler(job: Job): Promise<JobSliceResult> {
  const supabase = createSupabaseAdminClient();

  const { data: reviewer } = await supabase
    .from("reviewers")
    .select("id, user_id, subject_id, topic_id, title, content, status")
    .eq("id", job.targetId)
    .maybeSingle();

  if (!reviewer) {
    return {
      kind: "failed",
      message: "That reviewer is no longer in your library.",
      nextStep: "Nothing to do — it was deleted.",
      retryable: false,
    };
  }

  const content = reviewer.content as {
    summary?: string;
    concepts?: { name: string; explanation: string }[];
    terms?: { term: string; definition: string }[];
  } | null;

  if (!content?.summary) {
    return {
      kind: "failed",
      message: "That reviewer has not finished generating yet.",
      nextStep: "Wait for it to finish, then make cards from it.",
      /* Retryable: the reviewer may simply still be running, and the sweeper
         picking this up a minute later is exactly the right recovery. */
      retryable: true,
    };
  }

  const source = [
    `# ${reviewer.title}`,
    "",
    content.summary,
    "",
    ...(content.concepts ?? []).map((c) => `## ${c.name}\n${c.explanation}`),
    "",
    ...(content.terms ?? []).map((t) => `- ${t.term}: ${t.definition}`),
  ].join("\n");

  try {
    const { data } = await getAiService().generate(
      {
        userId: reviewer.user_id,
        task: "flashcards",
        idempotencyKey: `flashcards:${reviewer.id}`,
      },
      `${source}\n\n${FLASHCARD_PROMPT}`,
      flashcardSetSchema,
      { context: [] },
    );

    await supabase.from("flashcards").delete().eq("reviewer_id", reviewer.id);

    const { error } = await supabase.from("flashcards").insert(
      data.cards.map((card) => ({
        user_id: reviewer.user_id,
        reviewer_id: reviewer.id,
        subject_id: reviewer.subject_id,
        topic_id: reviewer.topic_id,
        front: card.front,
        back: card.back,
      })),
    );

    if (error) {
      return {
        kind: "failed",
        message: "We generated the cards but could not save them.",
        nextStep: "Try again in a moment.",
        retryable: true,
      };
    }

    return { kind: "done" };
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : "Generation failed.";
    return {
      kind: "failed",
      message: "We could not make flashcards from this reviewer.",
      nextStep: "Try again in a moment.",
      retryable: !/schema|invalid/i.test(message),
    };
  }
}
