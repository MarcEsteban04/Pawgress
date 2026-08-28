import { Archive, Layers, SearchX } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { buttonStyles, EmptyState, SectionLabel } from "@/components/ui";
import { groupSubjects } from "@/features/subjects/grouping";
import { isSubjectGroup, isSubjectSort } from "@/features/subjects/query";
import { SubjectCard } from "@/features/subjects/components/SubjectCard";
import { SubjectDialog } from "@/features/subjects/components/SubjectDialog";
import { SubjectFilters } from "@/features/subjects/components/SubjectFilters";
import { SubjectsMasthead } from "@/features/subjects/components/SubjectsMasthead";
import { SubjectListSkeleton } from "@/features/subjects/components/SubjectListSkeleton";
import {
  countArchivedSubjects,
  getLibraryTotals,
  listSubjectFacets,
  listSubjects,
} from "@/server/subjects/queries";

export const metadata = { title: "Subjects" };

type Query = {
  search?: string;
  sort?: string;
  group?: string;
  semester?: string;
  year?: string;
  archived: boolean;
};

/**
 * The subject list (FR-S2, FR-S6, US-B2, US-B6).
 *
 * Filters live in the URL, so a filtered list is linkable, survives a reload,
 * and unwinds with the back button.
 *
 * The list is a Suspense boundary keyed on the query: the header and filters
 * paint immediately and only the grid swaps for skeletons, so typing in the
 * search box never blanks the screen. The key is what makes the fallback
 * re-appear on each new query rather than only on first load.
 */
async function SubjectList({ search, sort, group, semester, year, archived }: Query) {
  const subjects = await listSubjects({
    search,
    sort: isSubjectSort(sort) ? sort : "activity",
    semester,
    year: year ? Number(year) : undefined,
    archived,
  });

  const filtering = Boolean(search || semester || year);

  /* Three empties, and telling them apart is the point. "No subjects yet" is
     onboarding and offers the one action that fixes it. "Nothing matched" is a
     dead search and offers a way back. An empty archive is neither — it is a
     normal, healthy state that needs no action at all, and offering "create a
     subject" there would be answering a question nobody asked. */
  if (subjects.length === 0 && archived && !filtering) {
    return (
      <EmptyState
        Icon={Archive}
        title="Nothing archived"
        description="Archiving a subject hides it from your list without deleting anything — useful once a term ends and you want the shelf clear but the notes kept."
        action={
          <Link href="/subjects" className={buttonStyles({ variant: "subtle" })}>
            Back to active subjects
          </Link>
        }
      />
    );
  }

  if (subjects.length === 0 && filtering) {
    return (
      <EmptyState
        Icon={SearchX}
        title="No subjects match"
        description={
          search
            ? `No subject or topic here matches “${search}”. Check the spelling, or clear the filters.`
            : "Nothing here matches those filters."
        }
        action={
          <Link
            href={archived ? "/subjects?archived=1" : "/subjects"}
            className={buttonStyles({ variant: "subtle" })}
          >
            Clear filters
          </Link>
        }
      />
    );
  }

  if (subjects.length === 0) {
    return (
      <EmptyState
        Icon={Layers}
        title="No subjects yet"
        description="A subject is one class — Biology, Programming, History. Everything you upload lives inside one, so this is the first thing to make."
        action={<SubjectDialog />}
      />
    );
  }

  const sections = groupSubjects(subjects, isSubjectGroup(group) ? group : "none");

  return (
    <>
      <p className="text-sm text-ink-muted" role="status">
        {subjects.length} {subjects.length === 1 ? "subject" : "subjects"}
        {archived ? " archived" : ""}
        {filtering ? " matching" : ""}
      </p>

      <div className="flex flex-col gap-7">
        {sections.map((section) => (
          <section key={section.key} className="flex flex-col gap-3">
            {/* The catch-all is labelled by what is MISSING from it, not left
                blank — "Other" tells a student nothing about why those cards
                are separated from the rest. */}
            {sections.length > 1 && (
              <div className="flex items-baseline gap-3">
                <SectionLabel>{section.title ?? "No year or semester set"}</SectionLabel>
                <span className="tabular text-xs text-ink-subtle">{section.subjects.length}</span>
              </div>
            )}

            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {section.subjects.map((subject) => (
                <li key={subject.id}>
                  <SubjectCard subject={subject} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

export default async function Page({ searchParams }: PageProps<"/subjects">) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const query: Query = {
    search: first("q"),
    sort: first("sort"),
    group: first("group"),
    semester: first("semester"),
    year: first("year"),
    archived: first("archived") === "1",
  };

  /* Facets describe the view being shown; the archived count describes the
     other one, which is what decides whether the door to it is offered. */
  const [facets, archivedCount, totals] = await Promise.all([
    listSubjectFacets(query.archived),
    countArchivedSubjects(),
    getLibraryTotals(),
  ]);

  const hasFilters = Boolean(query.search || query.semester || query.year);

  return (
    <div className="flex flex-col gap-6">
      <SubjectsMasthead
        eyebrow={query.archived ? "Kept, but out of the way" : "One place per class"}
        title={query.archived ? "Archived subjects" : "Subjects"}
        description={
          query.archived
            ? "Everything inside these is intact and still readable. Restore one to bring it back to your list."
            : "Every file, topic and quiz lives inside a subject. This is all of them."
        }
        /* No figures in the archive: "your library" is the wrong frame for a
           shelf of finished classes, and the counts there would be the ones
           archiving exists to stop showing. */
        totals={query.archived ? undefined : totals}
        tone={query.archived ? "quiet" : "accent"}
        action={query.archived ? undefined : <SubjectDialog />}
      />

      {(facets.semesters.length > 0 ||
        facets.years.length > 0 ||
        archivedCount > 0 ||
        query.archived ||
        hasFilters) && (
        <SubjectFilters
          semesters={facets.semesters}
          years={facets.years}
          archivedCount={archivedCount}
          archived={query.archived}
        />
      )}

      <Suspense
        key={`${query.search}-${query.sort}-${query.group}-${query.semester}-${query.year}-${query.archived}`}
        fallback={<SubjectListSkeleton />}
      >
        <SubjectList {...query} />
      </Suspense>
    </div>
  );
}
