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
};

export type Reviewer = ReviewerSummary & {
  /** Null until the job finishes, and null if it produced nothing usable. */
  content: ReviewerDocument | null;
  failureMessage: string | null;
};

const SELECT =
  "id, title, status, topic_id, source_material_ids, created_at, content, topics(name)";

/* `content` is jsonb, so it arrives as `unknown`. Narrowed at the edge rather
   than trusted deeper in: the shape was written by us through a Zod schema, but
   a column that can hold anything should be checked where it is read. */
function readContent(value: unknown): ReviewerDocument | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ReviewerDocument>;
  return typeof candidate.summary === "string" ? (candidate as ReviewerDocument) : null;
}

export const listReviewers = cache(async (subjectId: string): Promise<ReviewerSummary[]> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("reviewers")
    .select(SELECT)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status as JobStatus,
    topicId: row.topic_id,
    topicName: row.topics?.name ?? null,
    sourceCount: row.source_material_ids?.length ?? 0,
    createdAt: row.created_at,
  }));
});

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
 * Separate from `listReviewers` rather than a superset of it, because the two
 * answer different questions: the subject hub asks "what does THIS class have?"
 * and never needs a subject name on the row, while the library asks "what do I
 * have to revise from?" and is useless without one. Collapsing them would mean
 * every hub panel paying for a join it does not render.
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
        "id, title, status, topic_id, subject_id, source_material_ids, created_at, topics(name), subjects(name)",
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
      sourceCount: row.source_material_ids?.length ?? 0,
      createdAt: row.created_at,
    }));
  },
);

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
