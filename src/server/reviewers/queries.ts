import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { type ReviewerContent } from "@/features/reviewers/schema";
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

export type Reviewer = ReviewerSummary & {
  /** Null until the job finishes, and null if it produced nothing usable. */
  content: ReviewerContent | null;
  failureMessage: string | null;
};

const SELECT =
  "id, title, status, topic_id, source_material_ids, created_at, content, topics(name)";

/* `content` is jsonb, so it arrives as `unknown`. Narrowed at the edge rather
   than trusted deeper in: the shape was written by us through a Zod schema, but
   a column that can hold anything should be checked where it is read. */
function readContent(value: unknown): ReviewerContent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ReviewerContent>;
  return typeof candidate.summary === "string" ? (candidate as ReviewerContent) : null;
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
