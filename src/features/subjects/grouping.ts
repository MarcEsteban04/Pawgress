import { formatAcademicYear } from "@/lib/validation/subject";
import { type SubjectGroup } from "./query";
import { type Subject } from "@/server/subjects/queries";

/**
 * Divide a subject list into sections (FR-S6, US-B6).
 *
 * Done in TypeScript rather than SQL on purpose. The list is already fully in
 * memory — `listSubjects` has to be, because "last activity" is derived after
 * the query — and grouping it again in the database would mean a second round
 * trip to re-sort rows we are holding. At a student's scale (tens of subjects,
 * not thousands) this is free.
 *
 * The order WITHIN each group is whatever `listSubjects` already sorted by, so
 * grouping and sorting compose instead of fighting: "this year's classes,
 * most recently used first" is one grouping and one sort, not a third mode.
 */

export type SubjectSection = {
  key: string;
  /** Null for the catch-all, which the UI labels differently. */
  title: string | null;
  subjects: Subject[];
};

/** Sorts unset last, then newest year / latest semester first. */
function compareSections(a: SubjectSection, b: SubjectSection): number {
  if (a.title === null) return 1;
  if (b.title === null) return -1;
  return b.title.localeCompare(a.title, undefined, { numeric: true });
}

export function groupSubjects(subjects: Subject[], group: SubjectGroup): SubjectSection[] {
  if (group === "none") return [{ key: "all", title: null, subjects }];

  const sections = new Map<string, SubjectSection>();

  for (const subject of subjects) {
    /* An unset field is its own section rather than being hidden or guessed
       at. A student who has filled in the year for four subjects and not the
       fifth should still see all five — the fifth just sits in a section that
       says what is missing about it. */
    const title =
      group === "year"
        ? subject.academicYear === null
          ? null
          : formatAcademicYear(subject.academicYear)
        : subject.semester;

    const key = title ?? "__unset__";
    const existing = sections.get(key);
    if (existing) existing.subjects.push(subject);
    else sections.set(key, { key, title, subjects: [subject] });
  }

  return [...sections.values()].sort(compareSections);
}
