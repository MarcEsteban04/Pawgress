/**
 * The shape of the reviewer library URL — shared by the client filter bar and
 * the server query (FR-R1, US-F1).
 *
 * Outside `@/server/reviewers/queries` because that module is `server-only` and
 * the filter bar is a Client Component; importing the labels from there would
 * drag a Supabase client into the browser bundle. It is also the one thing both
 * halves must agree on, so a single definition is what stops the UI producing a
 * URL the query cannot read. Same contract as `materials/query.ts`.
 */

export const REVIEWER_SORTS = {
  recent: "Newest first",
  oldest: "Oldest first",
  title: "Title",
} as const;

export type ReviewerSort = keyof typeof REVIEWER_SORTS;

export function isReviewerSort(value: string | undefined): value is ReviewerSort {
  return value === "recent" || value === "oldest" || value === "title";
}

export type ReviewerQuery = {
  search?: string;
  /** A subject id. The library spans subjects; this narrows it to one. */
  subjectId?: string;
  sort?: ReviewerSort;
};

/** Whether the URL is narrowing the library, which decides WHICH empty state. */
export function isFiltering(query: ReviewerQuery): boolean {
  return Boolean(query.search || query.subjectId);
}
