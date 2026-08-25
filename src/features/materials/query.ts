import { type JobStatus, type MaterialKind } from "@/types";

/**
 * The shape of the material library URL — shared by the client filter bar and
 * the server query.
 *
 * Outside `@/server/materials/queries` because that module is `server-only`
 * and the filter bar is a Client Component; importing the labels from there
 * would drag a Supabase client into the browser bundle. It is also the one
 * thing both halves must agree on, so a single definition is what stops the UI
 * producing a URL the query cannot read.
 */

export const MATERIAL_SORTS = {
  recent: "Newest first",
  oldest: "Oldest first",
  name: "Name",
  size: "Largest first",
} as const;

export type MaterialSort = keyof typeof MATERIAL_SORTS;

export function isMaterialSort(value: string | undefined): value is MaterialSort {
  return value === "recent" || value === "oldest" || value === "name" || value === "size";
}

/**
 * Filterable kinds.
 *
 * `note` is absent because typed notes do not exist until Sprint 30. Offering
 * a filter that can only ever return nothing is a control that lies about what
 * the library contains.
 */
export const FILTERABLE_KINDS: MaterialKind[] = ["pdf", "docx", "pptx", "image"];

export function isMaterialKind(value: string | undefined): value is MaterialKind {
  return (
    value === "pdf" || value === "docx" || value === "pptx" || value === "image" || value === "note"
  );
}

/**
 * Statuses worth filtering by, collapsed from the nine the enum carries.
 *
 * A student does not think in `extracting` versus `embedding` — they think
 * "is it ready?", "is it still working?", "did it break?". The enum keeps the
 * detail because the pipeline needs it; the filter offers the three answers a
 * person actually wants.
 */
export const STATUS_FILTERS = {
  ready: "Ready",
  working: "Still processing",
  failed: "Failed",
} as const;

export type StatusFilter = keyof typeof STATUS_FILTERS;

export function isStatusFilter(value: string | undefined): value is StatusFilter {
  return value === "ready" || value === "working" || value === "failed";
}

/** The raw statuses behind each filter. */
export const STATUS_GROUPS: Record<StatusFilter, JobStatus[]> = {
  ready: ["ready"],
  working: ["queued", "uploading", "extracting", "embedding", "generating"],
  failed: ["failed", "cancelled", "over_quota"],
};

export type MaterialQuery = {
  search?: string;
  kind?: MaterialKind;
  status?: StatusFilter;
  topicId?: string;
  sort?: MaterialSort;
};
