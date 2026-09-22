import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { type ReviewerDocument } from "@/features/reviewers/schema";
import { type ReviewerQuery } from "@/features/reviewers/query";
import { type JobStatus } from "@/types";

/** Reviewers (FR-R1, US-F1). RLS scopes every statement to the caller. */

export type ReviewerSummary = {
  id: string;
  title: string;
  status: JobStatus;
  topicId: string | null;
  topicName: string | null;
  sourceCount: number;
  createdAt: string;
};

/** A row in the cross-subject library, which has to name its own subject. */
export type ReviewerListItem = ReviewerSummary & {
  subjectId: string;
  subjectName: string;
  /** The subject's colour. A list spanning five classes is unreadable without it. */
  colorSlot: 1 | 2 | 3 | 4 | 5;
};

export type Reviewer = ReviewerSummary & {
  /**
   * The subject it was built from.
   *
   * Carried on the reviewer now that the detail page lives at /reviewers/[id]
   * rather than under a subject. Generating flashcards and questions needs it,
   * and reading it here beats keeping it in the URL where it could disagree
   * with the row.
   */
  subjectId: string;
  subjectName: string;
  /** The subject's colour, so a study screen can carry it. */
  colorSlot: 1 | 2 | 3 | 4 | 5;
  content: ReviewerDocument | null;
  failureMessage: string | null;
};

const SELECT =
  "id, title, status, topic_id, subject_id, source_material_ids, created_at, content, topics(name), subjects(name, color_slot)";

/* `content` is jsonb, so it arrives as `unknown`. Narrowed at the edge rather
   than trusted deeper in: the shape was written by us through a Zod schema, but
   a column that can hold anything should be checked where it is read. */
function readContent(value: unknown): ReviewerDocument | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ReviewerDocument>;
  return typeof candidate.summary === "string" ? (candidate as ReviewerDocument) : null;
}

export const getReviewer = cache(async (id: string): Promise<Reviewer | null> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.from("reviewers").select(SELECT).eq("id", id).maybeSingle();

  if (!data) return null;

  const { data: job } = await supabase
    .from("jobs")
    .select("failure_message")
    .eq("kind", "generate_reviewer")
    .eq("target_id", id)
    .maybeSingle();
  const failure = job?.failure_message;

  return {
    id: data.id,
    title: data.title,
    status: data.status as JobStatus,
    topicId: data.topic_id,
    topicName: data.topics?.name ?? null,
    sourceCount: data.source_material_ids?.length ?? 0,
    createdAt: data.created_at,
    subjectId: data.subject_id,
    subjectName: data.subjects?.name ?? "",
    colorSlot: (data.subjects?.color_slot ?? 1) as 1 | 2 | 3 | 4 | 5,
    content: readContent(data.content),
    /* Read from the JOB, not embedded here: there is no foreign key from a
       reviewer to the job that produced it, so PostgREST cannot join them and
       asking it to would be a 400 at runtime rather than a compile error. */
    failureMessage: failure ?? null,
  };
});

/**
 * The whole library, across every subject (Sprint 47).
 *
 * The only list of reviewers there is. A per-subject version existed for the
 * subject hub's preview panel; that panel is gone — the hub is subjects, topics
 * and files now — so this is the one query, and `subjectId` narrows it.
 *
 * No `user_id` filter anywhere: RLS scopes every statement to the caller
 * (Sprint 14). `subjectId` chooses WHICH of the student's reviewers to return
 * and is not the ownership check.
 */
export const listAllReviewers = cache(
  async (query: ReviewerQuery = {}): Promise<ReviewerListItem[]> => {
    await requireSession();
    const supabase = await createSupabaseServerClient();

    let request = supabase
      .from("reviewers")
      .select(
        "id, title, status, topic_id, subject_id, source_material_ids, created_at, topics(name), subjects(name, color_slot)",
      );

    /* `%` and `_` are LIKE wildcards, so a student searching for "50%" would
       otherwise match every row. Escaped before interpolation — the same rule
       as the subject and material searches. */
    if (query.search) {
      const escaped = query.search.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);
      if (escaped) request = request.ilike("title", `%${escaped}%`);
    }

    if (query.subjectId) request = request.eq("subject_id", query.subjectId);

    switch (query.sort ?? "recent") {
      case "oldest":
        request = request.order("created_at", { ascending: true });
        break;
      case "title":
        request = request.order("title", { ascending: true });
        break;
      default:
        request = request.order("created_at", { ascending: false });
    }

    const { data } = await request;

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status as JobStatus,
      topicId: row.topic_id,
      topicName: row.topics?.name ?? null,
      subjectId: row.subject_id,
      subjectName: row.subjects?.name ?? "",
      colorSlot: (row.subjects?.color_slot ?? 1) as 1 | 2 | 3 | 4 | 5,
      sourceCount: row.source_material_ids?.length ?? 0,
      createdAt: row.created_at,
    }));
  },
);

/** What a library row can say about itself beyond its own title. */
export type ReviewerStudyCounts = { cards: number; questions: number };

/**
 * Flashcard and question counts for a whole page of reviewers.
 *
 * TWO QUERIES FOR THE WHOLE LIST, not two per row. `countFlashcards` and
 * `countPracticeQuestions` are the right shape for one reviewer's own page and
 * the wrong shape here — forty reviewers would be eighty round trips before the
 * list could render, and `cache()` does not help because every call has a
 * different argument.
 *
 * Flashcards are counted by reading back one uuid column and tallying it, since
 * PostgREST has no GROUP BY. That is a lot of rows in exchange for one request,
 * and one small column of them; the alternative is a database view, which is
 * worth doing the day a student has thousands.
 */
/* Not wrapped in `cache()`: React memoises on argument identity, and a fresh
   array every render would never hit it. The page calls this once. */
export async function listReviewerStudyCounts(
  reviewerIds: string[],
): Promise<Map<string, ReviewerStudyCounts>> {
  const counts = new Map<string, ReviewerStudyCounts>();
  if (reviewerIds.length === 0) return counts;

  await requireSession();
  const supabase = await createSupabaseServerClient();

  const [cards, quizzes] = await Promise.all([
    supabase.from("flashcards").select("reviewer_id").in("reviewer_id", reviewerIds),
    supabase
      .from("quizzes")
      .select("reviewer_id, question_count, status")
      .in("reviewer_id", reviewerIds),
  ]);

  const get = (id: string) => {
    const existing = counts.get(id);
    if (existing) return existing;
    const fresh = { cards: 0, questions: 0 };
    counts.set(id, fresh);
    return fresh;
  };

  for (const row of cards.data ?? []) {
    if (row.reviewer_id) get(row.reviewer_id).cards += 1;
  }

  /* Only a finished set counts, matching `countPracticeQuestions`: a queued
     one has no `question_count` yet, and advertising questions nobody can
     answer is worse than saying nothing. */
  for (const row of quizzes.data ?? []) {
    if (row.reviewer_id && row.status === "ready") {
      get(row.reviewer_id).questions += row.question_count ?? 0;
    }
  }

  return counts;
}

/**
 * Which subjects actually have a reviewer.
 *
 * The filter offers only these. A subject filter that can only ever return
 * nothing is a control that teaches a student the filters are decorative — the
 * same rule the material filters follow.
 */
export const listReviewerSubjectFacets = cache(
  async (): Promise<{ id: string; name: string }[]> => {
    await requireSession();
    const supabase = await createSupabaseServerClient();

    const { data: rows } = await supabase
      .from("reviewers")
      .select("subject_id, subjects(name)")
      .order("created_at", { ascending: false });

    const seen = new Map<string, string>();
    for (const row of rows ?? []) {
      if (row.subject_id && !seen.has(row.subject_id)) {
        seen.set(row.subject_id, row.subjects?.name ?? "");
      }
    }
    return [...seen]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
);

/**
 * What deleting this reviewer actually destroys (Sprint 47).
 *
 * Needed because the two children behave differently by design, and a student
 * cannot be expected to know that:
 *
 *  - **flashcards** are `on delete cascade` — they and their known/unknown
 *    review progress go with the reviewer.
 *  - **quizzes** are `on delete set null` — they survive, merely unlinked, so
 *    a recorded attempt is never destroyed by tidying up a reviewer.
 *
 * The delete confirmation states both. `ConfirmDialog` requires a consequence
 * line for exactly this reason.
 */
export async function getReviewerImpact(
  reviewerId: string,
): Promise<{ flashcards: number; quizzes: number }> {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const [cards, quizzes] = await Promise.all([
    supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_id", reviewerId),
    supabase
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_id", reviewerId),
  ]);

  return { flashcards: cards.count ?? 0, quizzes: quizzes.count ?? 0 };
}
