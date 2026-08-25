import { Layers, SearchX } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonStyles, EmptyState } from "@/components/ui";
import Link from "next/link";
import { SubjectCard } from "@/features/subjects/components/SubjectCard";
import { SubjectDialog } from "@/features/subjects/components/SubjectDialog";
import { SubjectFilters } from "@/features/subjects/components/SubjectFilters";
import { SubjectListSkeleton } from "@/features/subjects/components/SubjectListSkeleton";
import { isSubjectSort } from "@/features/subjects/query";
import { listSemesters, listSubjects } from "@/server/subjects/queries";

export const metadata = { title: "Subjects" };

/**
 * The subject list (FR-S2, US-B2).
 *
 * Filters live in the URL, so a filtered list is linkable, survives a reload,
 * and unwinds with the back button.
 *
 * The list is a Suspense boundary keyed on the query: the header and filters
 * paint immediately and only the grid swaps for skeletons, so typing in the
 * search box never blanks the screen. The key is what makes the fallback
 * re-appear on each new query rather than only on first load.
 */
async function SubjectList({
  search,
  sort,
  semester,
}: {
  search?: string;
  sort?: string;
  semester?: string;
}) {
  const subjects = await listSubjects({
    search,
    sort: isSubjectSort(sort) ? sort : "activity",
    semester,
  });

  const filtering = Boolean(search || semester);

  /* Two different empties, and telling them apart is the point. "No subjects
     yet" is onboarding and offers the one action that fixes it. "Nothing
     matched" is a dead search and offers a way back — showing the onboarding
     copy there would suggest a student has no subjects when they have twelve. */
  if (subjects.length === 0 && filtering) {
    return (
      <EmptyState
        Icon={SearchX}
        title="No subjects match"
        description={
          search
            ? `Nothing is called “${search}”${semester ? " in that semester" : ""}. Check the spelling, or clear the filters.`
            : "No subjects in that semester yet."
        }
        action={
          <Link href="/subjects" className={buttonStyles({ variant: "subtle" })}>
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

  return (
    <>
      <p className="text-sm text-ink-muted" role="status">
        {subjects.length} {subjects.length === 1 ? "subject" : "subjects"}
        {filtering ? " matching" : ""}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject) => (
          <li key={subject.id}>
            <SubjectCard subject={subject} />
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function Page({ searchParams }: PageProps<"/subjects">) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const search = first("q");
  const sort = first("sort");
  const semester = first("semester");
  const semesters = await listSemesters();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="One place per class"
        title="Subjects"
        description="Your files, topics and quizzes live inside a subject."
        action={<SubjectDialog />}
      />

      {/* Offered only once there is something to search through. Filters above
          an empty list are furniture. */}
      {(semesters.length > 0 || search || semester) && <SubjectFilters semesters={semesters} />}

      <Suspense key={`${search}-${sort}-${semester}`} fallback={<SubjectListSkeleton />}>
        <SubjectList search={search} sort={sort} semester={semester} />
      </Suspense>
    </div>
  );
}
