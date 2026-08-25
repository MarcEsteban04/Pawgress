import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { type SubjectIcon } from "@/lib/validation/subject";

/**
 * Subject reads (FR-S1, FR-S2).
 *
 * No `user_id` filter: RLS scopes every query to the caller (Sprint 14). See
 * docs/architecture.md §3 for why adding one anyway is worse than leaving it
 * out.
 */

export type Subject = {
  id: string;
  name: string;
  colorSlot: 1 | 2 | 3 | 4 | 5;
  icon: SubjectIcon | null;
  semester: string | null;
  archivedAt: string | null;
  createdAt: string;
  /** Cards show these; both are counted in one round trip below. */
  materialCount: number;
  topicCount: number;
};

/**
 * All of a student's subjects, newest first.
 *
 * Counts come back in the same request via PostgREST's embedded aggregates
 * rather than N+1 follow-ups — a student with twelve subjects would otherwise
 * cost twenty-five queries to render one page.
 */
export const listSubjects = cache(async (): Promise<Subject[]> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subjects")
    .select(
      "id, name, color_slot, icon, semester, archived_at, created_at, materials(count), topics(count)",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    colorSlot: row.color_slot as 1 | 2 | 3 | 4 | 5,
    icon: (row.icon as SubjectIcon | null) ?? null,
    semester: row.semester,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    materialCount: row.materials?.[0]?.count ?? 0,
    topicCount: row.topics?.[0]?.count ?? 0,
  }));
});

/**
 * Everything that will be destroyed with a subject (US-B3).
 *
 * The confirmation has to name real counts, not "and related content" — a
 * student about to lose a term of work deserves to see the number.
 *
 * Computed when the page renders, not when the dialog opens: a Server Component
 * cannot be invoked on demand from a click. That means a count can go stale if
 * the tab is left open for a long time, which is the trade being made and the
 * reason the delete still asks for a typed confirmation rather than trusting
 * the number alone.
 */
export type DeletionSummary = {
  topics: number;
  materials: number;
  reviewers: number;
  flashcards: number;
  quizzes: number;
  attempts: number;
  /** Storage paths that must be removed separately — rows cascade, bytes do not. */
  storagePaths: string[];
};

export async function getDeletionSummary(subjectId: string): Promise<DeletionSummary> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const countOf = async (table: "topics" | "reviewers" | "flashcards" | "quizzes") => {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("subject_id", subjectId);
    return count ?? 0;
  };

  const [topics, reviewers, flashcards, quizzes] = await Promise.all([
    countOf("topics"),
    countOf("reviewers"),
    countOf("flashcards"),
    countOf("quizzes"),
  ]);

  /* Materials are fetched rather than counted, because their storage paths are
     needed anyway — counting and then fetching would be two trips for one
     answer. */
  const { data: materials } = await supabase
    .from("materials")
    .select("id, storage_path")
    .eq("subject_id", subjectId);

  /* Attempts hang off quizzes, so they need the quiz ids. An empty `in ()` is
     a syntax error in PostgREST, hence the guard. */
  const { data: quizRows } = await supabase
    .from("quizzes")
    .select("id")
    .eq("subject_id", subjectId);
  const quizIds = (quizRows ?? []).map((row) => row.id);

  let attempts = 0;
  if (quizIds.length > 0) {
    const { count } = await supabase
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .in("quiz_id", quizIds);
    attempts = count ?? 0;
  }

  return {
    topics,
    materials: materials?.length ?? 0,
    reviewers,
    flashcards,
    quizzes,
    attempts,
    storagePaths: (materials ?? [])
      .map((row) => row.storage_path)
      .filter((path): path is string => Boolean(path)),
  };
}

/** Case-insensitive duplicate check for the create/rename warning (US-B1). */
export async function findSubjectsNamed(name: string, excludeId?: string): Promise<number> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("subjects")
    .select("id", { count: "exact", head: true })
    .ilike("name", name.trim());

  if (excludeId) query = query.neq("id", excludeId);

  const { count } = await query;
  return count ?? 0;
}
