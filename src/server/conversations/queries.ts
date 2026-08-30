import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { type AssistantCitation } from "@/features/assistant/types";

/**
 * Saved conversations (FR-C6, US-E5).
 *
 * No `user_id` filter: RLS scopes every statement to the caller (Sprint 14).
 */

export type ConversationSummary = {
  id: string;
  title: string;
  subjectId: string | null;
  subjectName: string | null;
  topicId: string | null;
  topicName: string | null;
  /** False when the student turned off searching their files for this thread. */
  useMaterial: boolean;
  updatedAt: string;
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: AssistantCitation[];
  ungrounded: boolean;
};

/** The sidebar list, most recently touched first. */
export const listConversations = cache(async (limit = 50): Promise<ConversationSummary[]> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, title, subject_id, topic_id, use_material, updated_at, subjects(name), topics(name)",
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    subjectId: row.subject_id,
    subjectName: row.subjects?.name ?? null,
    topicId: row.topic_id,
    topicName: row.topics?.name ?? null,
    useMaterial: row.use_material,
    updatedAt: row.updated_at,
  }));
});

/**
 * One thread, in order.
 *
 * Returns null when the id is unknown OR belongs to someone else — RLS makes
 * those the same answer, and distinguishing them would leak which ids are real.
 */
export const getConversation = cache(
  async (
    id: string,
  ): Promise<{ conversation: ConversationSummary; messages: StoredMessage[] } | null> => {
    await requireSession();
    const supabase = await createSupabaseServerClient();

    const { data: row } = await supabase
      .from("conversations")
      .select(
        "id, title, subject_id, topic_id, use_material, updated_at, subjects(name), topics(name)",
      )
      .eq("id", id)
      .maybeSingle();

    if (!row) return null;

    const { data: messages } = await supabase
      .from("conversation_messages")
      .select("id, role, content, citations, ungrounded")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    return {
      conversation: {
        id: row.id,
        title: row.title,
        subjectId: row.subject_id,
        subjectName: row.subjects?.name ?? null,
        topicId: row.topic_id,
        topicName: row.topics?.name ?? null,
        useMaterial: row.use_material,
        updatedAt: row.updated_at,
      },
      messages: (messages ?? []).map((message) => ({
        id: message.id,
        role: message.role as "user" | "assistant",
        content: message.content,
        /* `citations` is jsonb, so it arrives as `unknown`. Cast at the edge
           rather than trusting it deeper in: the shape was written by us, but
           a column that can hold anything should be narrowed where it is
           read. */
        citations: Array.isArray(message.citations)
          ? (message.citations as unknown as AssistantCitation[])
          : [],
        ungrounded: message.ungrounded,
      })),
    };
  },
);
