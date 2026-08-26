import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";
import { type MaterialQuery, STATUS_GROUPS } from "@/features/materials/query";
import { type JobStatus, type MaterialKind } from "@/types";

/**
 * The material library (FR-U4, US-C4).
 *
 * No `user_id` filter: RLS scopes every statement to the caller (Sprint 14).
 * The `.eq("subject_id", …)` chooses WHICH of the student's materials to
 * return and is not the ownership check.
 */

export type Material = {
  id: string;
  subjectId: string;
  title: string;
  kind: MaterialKind;
  status: JobStatus;
  byteSize: number | null;
  pageCount: number | null;
  topicId: string | null;
  topicName: string | null;
  storagePath: string | null;
  failureMessage: string | null;
  failureNextStep: string | null;
  createdAt: string;
};

export const listMaterials = cache(
  async (subjectId: string, query: MaterialQuery = {}): Promise<Material[]> => {
    await requireSession();
    const supabase = await createSupabaseServerClient();

    let request = supabase
      .from("materials")
      .select(
        "id, subject_id, title, kind, status, byte_size, page_count, topic_id, storage_path, failure_message, failure_next_step, created_at, topics(name)",
      )
      .eq("subject_id", subjectId);

    /* `%` and `_` are LIKE wildcards, so a student searching for "50%" would
       otherwise match everything. Escaped before interpolation — the same rule
       as the subject search. */
    if (query.search) {
      const escaped = query.search.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);
      if (escaped) request = request.ilike("title", `%${escaped}%`);
    }

    if (query.kind) request = request.eq("kind", query.kind);
    if (query.topicId) request = request.eq("topic_id", query.topicId);

    /* The filter offers three answers; the column stores nine states. The
       mapping lives in one place so the UI never has to know which raw statuses
       count as "still processing". */
    if (query.status) request = request.in("status", STATUS_GROUPS[query.status]);

    switch (query.sort) {
      case "oldest":
        request = request.order("created_at", { ascending: true });
        break;
      case "name":
        request = request.order("title", { ascending: true });
        break;
      case "size":
        /* Nulls last: a typed note has no byte size, and sorting by "largest"
           should not open with a list of things that have no size at all. */
        request = request.order("byte_size", { ascending: false, nullsFirst: false });
        break;
      default:
        request = request.order("created_at", { ascending: false });
    }

    const { data, error } = await request;
    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      subjectId: row.subject_id,
      title: row.title,
      kind: row.kind as MaterialKind,
      status: row.status as JobStatus,
      byteSize: row.byte_size,
      pageCount: row.page_count,
      topicId: row.topic_id,
      topicName: row.topics?.name ?? null,
      storagePath: row.storage_path,
      failureMessage: row.failure_message,
      failureNextStep: row.failure_next_step,
      createdAt: row.created_at,
    }));
  },
);

/** One material, for the viewer (Sprint 29) and for delete confirmations. */
export const getMaterial = cache(async (id: string): Promise<Material | null> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("materials")
    .select(
      "id, subject_id, title, kind, status, byte_size, page_count, topic_id, storage_path, failure_message, failure_next_step, created_at, topics(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    subjectId: data.subject_id,
    title: data.title,
    kind: data.kind as MaterialKind,
    status: data.status as JobStatus,
    byteSize: data.byte_size,
    pageCount: data.page_count,
    topicId: data.topic_id,
    topicName: data.topics?.name ?? null,
    storagePath: data.storage_path,
    failureMessage: data.failure_message,
    failureNextStep: data.failure_next_step,
    createdAt: data.created_at,
  };
});

/**
 * Which kinds and statuses this subject actually contains.
 *
 * Read from the data rather than assumed, for the same reason the subject
 * filters are: a "PowerPoint" filter over a library with no slides is a control
 * that can only ever return nothing.
 */
export type MaterialFacets = { kinds: MaterialKind[]; statuses: JobStatus[]; total: number };

export const listMaterialFacets = cache(async (subjectId: string): Promise<MaterialFacets> => {
  await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("materials")
    .select("kind, status")
    .eq("subject_id", subjectId);

  const kinds = new Set<MaterialKind>();
  const statuses = new Set<JobStatus>();
  for (const row of data ?? []) {
    kinds.add(row.kind as MaterialKind);
    statuses.add(row.status as JobStatus);
  }

  return { kinds: [...kinds], statuses: [...statuses], total: data?.length ?? 0 };
});
