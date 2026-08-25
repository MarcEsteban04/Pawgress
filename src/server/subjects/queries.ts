import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { type SubjectIcon } from "@/lib/validation/subject";
import { type SubjectQuery } from "@/features/subjects/query";

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
  materialCount: number;
  topicCount: number;
  /** Newest material, or the subject's own last edit if it has none. */
  lastActivityAt: string;
};

export const listSubjects = cache(
  async ({ search, sort = "activity", semester }: SubjectQuery = {}): Promise<Subject[]> => {
    await requireSession();
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("subjects")
      .select(
        "id, name, color_slot, icon, semester, archived_at, created_at, updated_at, materials(count), topics(count)",
      )
      .is("archived_at", null);

    /* `%` and `_` are wildcards in LIKE, so a student searching for "50%" would
       otherwise match everything. Escaped before interpolation. */
    if (search) {
      const escaped = search.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);
      if (escaped) query = query.ilike("name", `%${escaped}%`);
    }
    if (semester) query = query.eq("semester", semester);

    const { data, error } = await query;
    if (error || !data) return [];

    /**
     * "Last activity" needs the newest material per subject, which PostgREST
     * cannot aggregate in the same select as the counts. One extra query for
     * two tiny columns beats N+1, and beats fetching every material row whole.
     *
     * If the library ever grows past a few thousand materials per account, this
     * becomes a `last_activity_at` column maintained by a trigger. It is not
     * worth the write amplification before then.
     */
    const { data: activity } = await supabase
      .from("materials")
      .select("subject_id, created_at")
      .order("created_at", { ascending: false });

    const newestBySubject = new Map<string, string>();
    for (const row of activity ?? []) {
      if (!newestBySubject.has(row.subject_id)) {
        newestBySubject.set(row.subject_id, row.created_at);
      }
    }

    const subjects: Subject[] = data.map((row) => ({
      id: row.id,
      name: row.name,
      colorSlot: row.color_slot as 1 | 2 | 3 | 4 | 5,
      icon: (row.icon as SubjectIcon | null) ?? null,
      semester: row.semester,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      materialCount: row.materials?.[0]?.count ?? 0,
      topicCount: row.topics?.[0]?.count ?? 0,
      lastActivityAt: newestBySubject.get(row.id) ?? row.updated_at,
    }));

    /* Sorted here rather than in the query, because `activity` is derived above
       and splitting the orderings across two places would let them disagree. */
    return subjects.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      return b.lastActivityAt.localeCompare(a.lastActivityAt);
    });
  },
);

/** Distinct semesters, for the filter. Empty when nobody has set one. */
export const listSemesters = cache(async (): Promise<string[]> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("subjects")
    .select("semester")
    .not("semester", "is", null)
    .is("archived_at", null);

  const unique = new Set((data ?? []).map((row) => row.semester).filter(Boolean) as string[]);
  return [...unique].sort((a, b) => a.localeCompare(b));
});

/**
 * Everything that will be destroyed with a subject (US-B3).
 *
 * Called on demand when the delete dialog opens, not for every card on the
 * page. Six count queries per subject was fine for three subjects and would be
 * ninety for fifteen, all of them thrown away unless something is deleted.
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
