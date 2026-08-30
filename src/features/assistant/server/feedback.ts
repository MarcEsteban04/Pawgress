"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cleanText } from "@/lib/sanitize";
import { requireSession } from "@/server/auth/session";

/**
 * Feedback on one answer (Sprint 42, FR-P9).
 *
 * Every guardrail in this product is an assertion about behaviour nobody can
 * observe from the outside: that answers stay grounded, that citations are
 * real, that Aki says when the material does not cover something. The eval
 * harness checks that against cases we wrote. This is where the cases we did
 * not write come from.
 *
 * **It does not tell the student it worked, beyond the button changing.** A
 * toast thanking someone for feedback is the product congratulating itself for
 * being told it was wrong.
 */

export type FeedbackRating = "helpful" | "unhelpful";

export async function rateAnswerAction(
  messageId: string,
  rating: FeedbackRating,
): Promise<{ ok: boolean }> {
  const session = await requireSession();

  if (!messageId || (rating !== "helpful" && rating !== "unhelpful")) return { ok: false };

  const supabase = await createSupabaseServerClient();

  /* Upsert on the unique key, so changing your mind updates the row rather than
     stacking a second opinion under the same answer. */
  const { error } = await supabase
    .from("answer_feedback")
    .upsert(
      { user_id: session.userId, message_id: messageId, rating },
      { onConflict: "user_id,message_id" },
    );

  return { ok: !error };
}

/** An optional sentence about what was wrong, added after an unhelpful rating. */
export async function explainFeedbackAction(
  messageId: string,
  reason: string,
): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const clean = cleanText(reason).trim().slice(0, 2000);
  if (!messageId || clean.length === 0) return { ok: false };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("answer_feedback")
    .update({ reason: clean })
    .eq("message_id", messageId)
    .eq("user_id", session.userId);

  return { ok: !error };
}
