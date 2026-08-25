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

/**
 * How the list is divided into sections (FR-S6, US-B6).
 *
 * Grouping is separate from sorting because they answer different questions.
 * Sorting asks "which of these first?"; grouping asks "which of these belong
 * together?" — and a student with two years of classes wants both at once:
 * this year's subjects together, most recently used first inside that.
 */
export const SUBJECT_GROUPS = {
  none: "No grouping",
  year: "Academic year",
  semester: "Semester",
} as const;

export type SubjectGroup = keyof typeof SUBJECT_GROUPS;

export function isSubjectGroup(value: string | undefined): value is SubjectGroup {
  return value === "none" || value === "year" || value === "semester";
}

export type SubjectQuery = {
  search?: string;
  sort?: SubjectSort;
  semester?: string;
  year?: number;
  /**
   * Archived subjects are a separate view, not a filter layered on the main
   * one. "Hides it from the list while keeping its data readable" (US-B6) is
   * only true if the default list never contains them — an archived subject
   * that turns up in a search result has not been archived, it has been
   * labelled.
   */
  archived?: boolean;
};
