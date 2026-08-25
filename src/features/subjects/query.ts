/**
 * The shape of the subject list URL — shared by the client filter bar and the
 * server query.
 *
 * It lives outside `@/server/subjects/queries` because that module is
 * `server-only`, and the filter bar is a Client Component: importing the sort
 * labels from there would drag a Supabase client into the browser bundle. The
 * options are also the one thing both halves must agree on, so a single
 * definition is what stops a URL the UI can produce but the query cannot read.
 */

export const SUBJECT_SORTS = {
  activity: "Recent activity",
  name: "Name",
  created: "Date created",
} as const;

export type SubjectSort = keyof typeof SUBJECT_SORTS;

export function isSubjectSort(value: string | undefined): value is SubjectSort {
  return value === "activity" || value === "name" || value === "created";
}

export type SubjectQuery = {
  search?: string;
  sort?: SubjectSort;
  semester?: string;
};
