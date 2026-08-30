import "server-only";

import { getAiService } from "@/lib/ai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { REVIEWER_PROMPT, reviewerSchema } from "@/features/reviewers/schema";
import { type Job, type JobSliceResult } from "../types";

/**
 * The reviewer generator (FR-R1, US-F1, Sprint 43).
 *
 * **It reads `extracted_text`, not retrieved chunks.** Retrieval answers a
 * question by finding the passages that resemble it; a reviewer has no question
 * — it is about the material as a whole, and asking a vector index for
 * "everything" returns the eight chunks that happen to sit nearest an empty
 * query. The whole text, truncated at a budget, is the honest input.
 *
 * **Citations are the material ids, recorded before generation.** They are what
 * the model was shown, which is a fact we hold; asking it to report its own
 * sources invites it to invent one.
 */

/**
 * How much material one reviewer is built from.
 *
 * A ceiling in characters rather than tokens because that is what we can count
 * without a tokeniser, and it is generous: roughly 30–40k tokens, inside every
 * provider's window and inside Gemini's budget. Groq's 8k TPM will refuse a
 * full one and the chain will hand it to Gemini, which is the chain working.
 */
const MAX_SOURCE_CHARS = 120_000;

export async function generateReviewerHandler(job: Job): Promise<JobSliceResult> {
  const supabase = createSupabaseAdminClient();

  const { data: reviewer } = await supabase
    .from("reviewers")
    .select("id, user_id, subject_id, topic_id")
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

  /* Scoped exactly as the student asked. A reviewer for one topic built from
     the whole subject would be a reviewer for the wrong thing, and they would
     have no way to see that from the output. */
  let query = supabase
    .from("materials")
    .select("id, title, extracted_text")
    .eq("subject_id", reviewer.subject_id)
    .not("extracted_text", "is", null)
    .order("created_at", { ascending: true });

  if (reviewer.topic_id) query = query.eq("topic_id", reviewer.topic_id);

  const { data: materials } = await query;
  const usable = (materials ?? []).filter((m) => (m.extracted_text ?? "").trim().length > 0);

  if (usable.length === 0) {
    return {
      kind: "failed",
      message: "There is no readable text in this material yet.",
      nextStep: "Wait for your files to finish processing, or upload one first.",
      retryable: false,
    };
  }

  /* Titled and joined, so the model can attribute a point to a file rather than
     treating the whole thing as one undifferentiated wall. Truncated as a whole
     rather than per file: cutting every file to an equal share would silently
     drop the end of the longest one, which is usually the lecture. */
  let budget = MAX_SOURCE_CHARS;
  const used: string[] = [];
  const sections: string[] = [];

  for (const material of usable) {
    if (budget <= 0) break;
    const body = (material.extracted_text ?? "").slice(0, budget);
    budget -= body.length;
    used.push(material.id);
    sections.push(`[${material.title}]\n${body}`);
  }

  const truncated = used.length < usable.length;

  try {
    const { data } = await getAiService().generate(
      {
        userId: reviewer.user_id,
        task: "reviewer",
        /* Keyed on the reviewer row, so a retried job reuses the call rather
           than paying to generate the same document twice (NFR-C4). */
        idempotencyKey: `reviewer:${reviewer.id}`,
      },
      [
        sections.join("\n\n---\n\n"),
        "",
        truncated
          ? "NOTE: this subject has more material than fits in one reviewer. Say so in the summary."
          : "",
        "",
        REVIEWER_PROMPT,
      ]
        .filter(Boolean)
        .join("\n"),
      reviewerSchema,
      { context: [] },
    );

    await supabase
      .from("reviewers")
      .update({
        title: data.title,
        content: data,
        source_material_ids: used,
        status: "ready",
      })
      .eq("id", reviewer.id);

    return { kind: "done" };
  } catch (thrown) {
    /* The status is set by the runner's failure path; this only decides whether
       it is worth trying again. A schema mismatch is not — the same prompt
       produces the same shape — while a provider outage is. */
    const message = thrown instanceof Error ? thrown.message : "Generation failed.";
    const retryable = !/schema|invalid/i.test(message);

    return {
      kind: "failed",
      message: "We could not build a reviewer from this material.",
      nextStep: retryable ? "Try again in a moment." : "Try again — it is not you, it is us.",
      retryable,
    };
  }
}
