import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";

/**
 * Topic reads (FR-S3, US-B4).
 *
 * As everywhere in `src/server`, no `user_id` filter: RLS scopes every
 * statement to the caller. The `.eq("subject_id", …)` below chooses WHICH of
 * the student's topics to return, and is not the ownership check.
 */

export type Topic = {
  id: string;
  name: string;
  position: number;
  createdAt: string;
  /** Materials filed under this topic. They survive its deletion (US-B4). */
  materialCount: number;
  /**
   * Mastery, 0–1, and the evidence behind it.
   *
   * Read from the `progress` table rather than computed, and absent until a
   * quiz has actually been answered — which is Sprint 49 onward. Until then
   * every topic is genuinely low-evidence, and `MasteryBar` says so instead of
   * drawing a confident 0%.
   */
  mastery: number;
  questionsAnswered: number;
};

export const listTopics = cache(async (subjectId: string): Promise<Topic[]> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("topics")
    .select(
      "id, name, position, created_at, materials(count), progress(mastery, questions_answered)",
    )
    .eq("subject_id", subjectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => {
    const progress = row.progress?.[0];
    return {
      id: row.id,
      name: row.name,
      position: row.position,
      createdAt: row.created_at,
      materialCount: row.materials?.[0]?.count ?? 0,
      mastery: progress ? Number(progress.mastery) : 0,
      questionsAnswered: progress?.questions_answered ?? 0,
    };
  });
});

/**
 * What deleting a topic actually does (US-B4).
 *
 * The interesting number is `materials`, and the interesting fact is that they
 * are NOT deleted: the foreign key is `on delete set null (topic_id)`, so they
 * fall back to the subject. Saying so before the student confirms is the whole
 * requirement — "delete topic" reads like "delete my notes" unless the dialog
 * corrects it.
 */
export type TopicDeletionSummary = {
  materials: number;
  reviewers: number;
  quizzes: number;
};

export async function getTopicDeletionSummary(topicId: string): Promise<TopicDeletionSummary> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const countOf = async (table: "materials" | "reviewers" | "quizzes") => {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topicId);
    return count ?? 0;
  };

  const [materials, reviewers, quizzes] = await Promise.all([
    countOf("materials"),
    countOf("reviewers"),
    countOf("quizzes"),
  ]);

  return { materials, reviewers, quizzes };
}

/**
 * Case-insensitive duplicate check inside one subject.
 *
 * Stricter than the database's `unique (subject_id, name)`, which is
 * case-sensitive — see `lib/validation/topic.ts` for why that gap matters.
 */
export async function findTopicNamed(
  subjectId: string,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("topics")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", subjectId)
    .ilike("name", name.trim());

  if (excludeId) query = query.neq("id", excludeId);

  const { count } = await query;
  return (count ?? 0) > 0;
}

/**
 * The next sparse position, so a later drag-to-reorder (FR-S7, Sprint 24) can
 * insert between two rows without rewriting the whole list.
 */
export async function nextTopicPosition(subjectId: string): Promise<number> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("topics")
    .select("position")
    .eq("subject_id", subjectId)
    .order("position", { ascending: false })
    .limit(1);

  return (data?.[0]?.position ?? 0) + 100;
}
