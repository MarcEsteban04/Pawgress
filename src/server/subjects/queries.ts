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
  /** Starting year of the academic year — 2025 means 2025–2026. */
  academicYear: number | null;
  archivedAt: string | null;
  createdAt: string;
  materialCount: number;
  topicCount: number;
  /** Newest material, or when the subject was created if it has none. */
  lastActivityAt: string;
};

export const listSubjects = cache(
  async ({
    search,
    sort = "activity",
    semester,
    year,
    archived = false,
  }: SubjectQuery = {}): Promise<Subject[]> => {
    await requireSession();
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("subjects")
      .select(
        "id, name, color_slot, icon, semester, academic_year, archived_at, created_at, last_activity_at, materials(count), topics(count)",
      );

    /* Archived is a MODE, not a filter — the two sets never mix. An archived
       subject that still turns up in the main list has not been archived, it
       has been labelled (US-B6). */
    query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

    /**
     * Search matches a subject's NAME or any of its TOPIC names.
     *
     * Name-only search fails the way a student actually searches. Someone
     * hunting for photosynthesis types "photosynthesis", not "Biology" — they
     * are looking for the material, and the subject is just where it lives.
     * Matching topics turns the search box into a way to find the thing rather
     * than a way to filter a list you already know.
     *
     * Two queries rather than an embedded filter: PostgREST's `!inner` join
     * would DROP subjects whose name matches but which have no topics at all,
     * which is most of them early on. Resolving the topic hits first and
     * OR-ing the ids keeps both halves.
     *
     * `%` and `_` are wildcards in LIKE, so a student searching for "50%"
     * would otherwise match everything. Escaped before interpolation.
     */
    if (search) {
      const escaped = search.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);
      if (escaped) {
        const { data: topicHits } = await supabase
          .from("topics")
          .select("subject_id")
          .ilike("name", `%${escaped}%`)
          .limit(200);

        const subjectIds = [...new Set((topicHits ?? []).map((row) => row.subject_id))];

        /* A comma or a parenthesis inside `in.(…)` would end the list early,
           so the ids are checked to be uuids rather than trusted. They come
           from our own database, but the day one does not, this is the line
           that decides whether that becomes a broken filter or a broken
           query. */
        const safeIds = subjectIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));

        /* `or()` takes ONE string, and PostgREST splits it on commas and
           parentheses. A student searching for "Ch 1, 2" or "History (AP)"
           would otherwise have their search term parsed as extra conditions
           and get a 400. Double-quoting the value is how PostgREST is told
           where it ends; the inner escape is for a quote inside the quotes.
           None of this applies to the `.ilike()` path below, where the value
           travels as its own query parameter. */
        const pattern = `%${escaped}%`;
        const quoted = `"${pattern.replace(/(["\\])/g, "\\$1")}"`;

        query =
          safeIds.length > 0
            ? query.or(`name.ilike.${quoted},id.in.(${safeIds.join(",")})`)
            : query.ilike("name", pattern);
      }
    }
    if (semester) query = query.eq("semester", semester);
    if (year !== undefined) query = query.eq("academic_year", year);

    const { data, error } = await query;
    if (error || !data) return [];

    /* "Last activity" used to mean reading every material row in the account
       and reducing them here — a cost that grew with the whole library rather
       than with the page. It is a column now, maintained by a trigger
       (Sprint 24 migration), so the sort reads what it sorts on. */
    const subjects: Subject[] = data.map((row) => ({
      id: row.id,
      name: row.name,
      colorSlot: row.color_slot as 1 | 2 | 3 | 4 | 5,
      icon: (row.icon as SubjectIcon | null) ?? null,
      semester: row.semester,
      academicYear: row.academic_year,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      materialCount: row.materials?.[0]?.count ?? 0,
      topicCount: row.topics?.[0]?.count ?? 0,
      lastActivityAt: row.last_activity_at,
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

/**
 * What the filter bar can actually offer, read from the data rather than
 * assumed.
 *
 * Scoped to the view being shown: offering "1st sem" while looking at the
 * archive, when nothing archived has that semester, is a control that can only
 * produce an empty result.
 */
export type SubjectFacets = { semesters: string[]; years: number[] };

export const listSubjectFacets = cache(async (archived = false): Promise<SubjectFacets> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("subjects").select("semester, academic_year");
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  const { data } = await query;

  const semesters = new Set<string>();
  const years = new Set<number>();
  for (const row of data ?? []) {
    if (row.semester) semesters.add(row.semester);
    if (row.academic_year !== null) years.add(row.academic_year);
  }

  return {
    semesters: [...semesters].sort((a, b) => a.localeCompare(b)),
    // Newest first: this year's classes are the ones being looked for.
    years: [...years].sort((a, b) => b - a),
  };
});

/** How many subjects are archived, for deciding whether to offer the archive. */
export const countArchivedSubjects = cache(async (): Promise<number> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from("subjects")
    .select("id", { count: "exact", head: true })
    .not("archived_at", "is", null);

  return count ?? 0;
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

/**
 * One subject by id, for the detail page.
 *
 * Returns null rather than throwing when nothing matches, because RLS makes
 * "not yours" and "does not exist" the same result — both should render the
 * same 404 rather than leak which one it was.
 */
export const getSubject = cache(async (id: string): Promise<Subject | null> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subjects")
    .select(
      "id, name, color_slot, icon, semester, academic_year, archived_at, created_at, last_activity_at, materials(count), topics(count)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    colorSlot: data.color_slot as 1 | 2 | 3 | 4 | 5,
    icon: (data.icon as SubjectIcon | null) ?? null,
    semester: data.semester,
    academicYear: data.academic_year,
    archivedAt: data.archived_at,
    createdAt: data.created_at,
    materialCount: data.materials?.[0]?.count ?? 0,
    topicCount: data.topics?.[0]?.count ?? 0,
    lastActivityAt: data.last_activity_at,
  };
});

/**
 * The library at a glance, for the masthead (FR-S2).
 *
 * Three `head: true` counts rather than reading rows: the page needs three
 * numbers, not the data behind them, and `select("id", { count: "exact", head:
 * true })` returns the count in a header with no body at all.
 *
 * Scoped to ACTIVE subjects. An archived class is deliberately out of the way,
 * and counting its files in "your library" would undo the archiving — the
 * number would keep growing for classes a student has finished.
 */
export type LibraryTotals = { subjects: number; materials: number; topics: number };

export const getLibraryTotals = cache(async (): Promise<LibraryTotals> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  /* The material and topic counts need the active subject ids, because their
     own rows carry no archived flag — archiving a subject does not touch the
     files inside it, which is exactly the promise archiving makes. */
  const { data: active } = await supabase.from("subjects").select("id").is("archived_at", null);
  const ids = (active ?? []).map((row) => row.id);

  if (ids.length === 0) return { subjects: 0, materials: 0, topics: 0 };

  const countIn = async (table: "materials" | "topics") => {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .in("subject_id", ids);
    return count ?? 0;
  };

  const [materials, topics] = await Promise.all([countIn("materials"), countIn("topics")]);
  return { subjects: ids.length, materials, topics };
});
