import "server-only";

import { getAiService } from "@/lib/ai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  REVIEWER_PROMPT,
  SECTION_PROMPTS,
  SECTION_SCHEMAS,
  reviewerSchema,
  type ReviewerDocument,
  type ReviewerSection,
} from "@/features/reviewers/schema";
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
    .select("id, user_id, subject_id, topic_id, content")
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

  /**
   * Whole document, or one section?
   *
   * The request rides in the content jsonb because the jobs table has no
   * payload column — see `reviewerDocumentSchema`. Read once, here, so the rest
   * of the handler differs only where it has to.
   */
  const existing = (reviewer.content ?? null) as ReviewerDocument | null;
  const section = existing?.pendingSection as ReviewerSection | undefined;

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
    if (section && existing) {
      /* **Regenerating one section keeps the rest verbatim**, including the
         student's own edits and notes. A rewrite that quietly replaced the
         whole document because they asked for better key terms would throw
         away work they did by hand, which is the worst thing an editor can
         do. */
      const meta = {
        userId: reviewer.user_id,
        task: "reviewer" as const,
        /* Keyed on the section AND the moment, so pressing regenerate twice
           produces two different attempts rather than replaying the first from
           the idempotency cache — a student pressing it again is asking for a
           different answer, not the same one. */
        idempotencyKey: `reviewer:${reviewer.id}:${section}:${Date.now()}`,
      };

      const prompt = [
        sections.join("\n\n---\n\n"),
        "",
        "The student already has this revision aid, which you wrote:",
        JSON.stringify(
          { summary: existing.summary, concepts: existing.concepts, terms: existing.terms },
          null,
          1,
        ).slice(0, 6_000),
        "",
        SECTION_PROMPTS[section],
        "Do not repeat what the other sections already say.",
      ].join("\n");

      /* Switched rather than indexed. `SECTION_SCHEMAS[section]` is a UNION of
         four Zod types, and a generic that has to satisfy all of them collapses
         to the first — so the call would not type-check and, if forced, would
         return the wrong shape. Four branches is the price of the result being
         typed at all. */
      const data = await (async () => {
        const ai = getAiService();
        switch (section) {
          case "summary":
            return (await ai.generate(meta, prompt, SECTION_SCHEMAS.summary, { context: [] })).data;
          case "concepts":
            return (await ai.generate(meta, prompt, SECTION_SCHEMAS.concepts, { context: [] }))
              .data;
          case "terms":
            return (await ai.generate(meta, prompt, SECTION_SCHEMAS.terms, { context: [] })).data;
          case "focus":
            return (await ai.generate(meta, prompt, SECTION_SCHEMAS.focus, { context: [] })).data;
        }
      })();

      /* `editedAt` is deliberately left alone. It records that a HUMAN has
         touched this document, and the other sections may still be their words
         — clearing it because one section was rewritten would put our name back
         on their work. */
      const merged: ReviewerDocument = { ...existing, ...data };
      delete merged.pendingSection;

      await supabase
        .from("reviewers")
        .update({ content: merged, status: "ready" })
        .eq("id", reviewer.id);

      return { kind: "done" };
    }

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
        /* Notes survive a full regeneration. They are the student's, and the
           thing they asked to rewrite was ours. */
        content: existing?.notes?.length ? { ...data, notes: existing.notes } : data,
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
