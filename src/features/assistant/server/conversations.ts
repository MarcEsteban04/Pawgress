"use server";

import { revalidatePath } from "next/cache";
import { cleanText } from "@/lib/sanitize";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { type AssistantCitation } from "../types";

/**
 * Saving, renaming and deleting conversations (FR-C6, US-E5).
 *
 * **Messages are appended by the client, after the answer has streamed.** The
 * alternative — writing them inside the streaming route — sounds tidier and is
 * worse: the route has to keep the row open across a stream that the browser
 * may abandon halfway, and a student who stops an answer would still have the
 * half of it they stopped saved as though they had read it. Appending after the
 * fact means what is stored is what was actually shown.
 *
 * The cost of that choice is honest: a browser that dies mid-answer loses the
 * turn. That is the right way round — losing an answer nobody read beats
 * keeping one nobody saw.
 */

export type ConversationResult =
  { status: "ok"; conversationId: string } | { status: "error"; message: string; nextStep: string };

const failed = (message: string, nextStep: string): ConversationResult => ({
  status: "error",
  message,
  nextStep,
});

/**
 * A title from the first question.
 *
 * Truncated at a word boundary rather than mid-word, because the list is
 * skimmed and "How do I calculate the deriv…" reads worse than "How do I
 * calculate the…". Never a model call: naming a thread is not worth a
 * generation from a student's daily allowance.
 */
function titleFrom(question: string): string {
  const clean = cleanText(question).replace(/\s+/g, " ").trim();
  if (clean.length === 0) return "New conversation";
  if (clean.length <= 60) return clean;

  const cut = clean.slice(0, 60);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 30 ? cut.slice(0, lastSpace) : cut}…`;
}

/** Start a thread, named after the question that started it. */
export async function createConversationAction(input: {
  firstQuestion: string;
  subjectId: string | null;
  topicId: string | null;
  useMaterial: boolean;
}): Promise<ConversationResult> {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: session.userId,
      /* An empty select posts "", which is not a uuid. Null means "all my
         subjects", which is a legitimate scope rather than a missing one. */
      subject_id: input.subjectId || null,
      /* Narrower than the subject, and only meaningful with one. */
      topic_id: (input.subjectId && input.topicId) || null,
      /* Remembered on the thread, like the scope. Without it, resuming a
         conversation a student had deliberately made general would silently
         switch their files back on and start citing them. */
      use_material: input.useMaterial,
      title: titleFrom(input.firstQuestion),
    })
    .select("id")
    .single();

  if (error || !data) {
    return failed("We could not start that conversation.", "Your answer is still on screen.");
  }

  revalidatePath("/assistant");
  return { status: "ok", conversationId: data.id };
}

/**
 * Append one turn.
 *
 * Two rows in one call, because a question without its answer is not a state
 * any reader of this table should have to handle. The insert is a single
 * statement, so it is atomic.
 */
export async function appendTurnAction(input: {
  conversationId: string;
  question: string;
  answer: string;
  citations: AssistantCitation[];
  ungrounded: boolean;
}): Promise<ConversationResult> {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("conversation_messages").insert([
    {
      user_id: session.userId,
      conversation_id: input.conversationId,
      role: "user",
      content: cleanText(input.question).slice(0, 100_000),
      citations: [],
      ungrounded: false,
    },
    {
      user_id: session.userId,
      conversation_id: input.conversationId,
      role: "assistant",
      /* NOT `cleanText`. The answer is Markdown the renderer parses; stripping
         its punctuation would break the formatting it was written with. It is
         escaped by React at render time, which is where escaping belongs. */
      content: input.answer.slice(0, 100_000),
      citations: input.citations,
      ungrounded: input.ungrounded,
    },
  ]);

  if (error) {
    return failed("We could not save that message.", "It is still on screen for now.");
  }

  /* Touch the thread so it rises to the top of the list. The trigger fills in
     `updated_at`; this is the update that fires it. */
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.conversationId);

  revalidatePath("/assistant");
  return { status: "ok", conversationId: input.conversationId };
}

export async function renameConversationAction(
  conversationId: string,
  title: string,
): Promise<ConversationResult> {
  await requireSession();

  const clean = cleanText(title).trim();
  if (clean.length === 0) return failed("Give the conversation a name.", "Type something for it.");
  if (clean.length > 300) return failed("Names are limited to 300 characters.", "Shorten it.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("conversations")
    .update({ title: clean })
    .eq("id", conversationId);

  if (error) return failed("We could not rename that conversation.", "Try again in a moment.");

  revalidatePath("/assistant");
  return { status: "ok", conversationId };
}

/**
 * Delete a thread and its messages.
 *
 * The messages go by cascade, not by a second statement — one delete, and
 * nothing can leave a conversation half-removed.
 */
export async function deleteConversationAction(
  conversationId: string,
): Promise<ConversationResult> {
  await requireSession();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("conversations").delete().eq("id", conversationId);

  if (error) return failed("We could not delete that conversation.", "Try again in a moment.");

  revalidatePath("/assistant");
  return { status: "ok", conversationId };
}
