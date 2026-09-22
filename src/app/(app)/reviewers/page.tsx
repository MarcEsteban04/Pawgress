import { FileSearch, Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonStyles, Card, CardBody, EmptyState, PanelBoundary, Skeleton } from "@/components/ui";
import { NewReviewerDialog } from "@/features/reviewers/components/NewReviewerDialog";
import { ReviewerFilters } from "@/features/reviewers/components/ReviewerFilters";
import { ReviewerLibraryRow } from "@/features/reviewers/components/ReviewerLibraryRow";
import { isFiltering, isReviewerSort, type ReviewerQuery } from "@/features/reviewers/query";
import {
  listAllReviewers,
  listReviewerStudyCounts,
  listReviewerSubjectFacets,
} from "@/server/reviewers/queries";
import { listSubjects } from "@/server/subjects/queries";
import { listTopics } from "@/server/topics/queries";

/**
 * The reviewer library (Sprint 47, FR-R1, US-F1).
 *
 * **Top level, not under a subject** — and that is the sprint's one real design
 * decision. The roadmap asks for "filter by subject", which is only meaningful
 * if the list spans them. It also matches how the thing is used: materials are
 * inputs and belong to the class they came from, but a reviewer is what a
 * student actually revises from, and "everything I have for finals week"
 * crosses subjects. Flashcards and practice both hang off a reviewer, which
 * makes it the hub of the study loop rather than a subject's appendix.
 *
 * **Reviewers are MADE here too.** The subject hub used to carry a preview panel
 * with the generate button on it, which put a study artefact on a page whose job
 * is adding a subject, a topic and a file. Moving the list here without the
 * control would have left a library nobody could add to — so the button follows
 * the list, and asks which subject, which the subject page never had to.
 */

export const metadata = { title: "Reviewers" };

async function ReviewerList({
  query,
  filtering,
  action,
}: {
  query: ReviewerQuery;
  filtering: boolean;
  /* Passed in rather than built here, so the empty state offers the SAME
     control as the header instead of a second route to the same thing. */
  action: React.ReactNode;
}) {
  const reviewers = await listAllReviewers(query);

  /* Two empties, and telling them apart is the point. "None yet" is onboarding;
     "none matched" is a dead search and offers a way back. Showing onboarding
     copy to someone with twenty reviewers and a typo would be actively wrong. */
  if (reviewers.length === 0 && filtering) {
    return (
      <EmptyState
        Icon={FileSearch}
        title="No reviewers match"
        description={
          query.search
            ? `Nothing here is called “${query.search}”. Check the spelling, or clear the filters.`
            : "Nothing here matches those filters."
        }
        action={
          <Link href="/reviewers" className={buttonStyles({ variant: "subtle" })}>
            Clear filters
          </Link>
        }
      />
    );
  }

  if (reviewers.length === 0) {
    return (
      <EmptyState
        Icon={Sparkles}
        title="No reviewers yet"
        description="A reviewer is a revision aid Aki writes from your own files — a summary, the key concepts and terms, and what to revise first. Generate one from a subject, then turn it into flashcards or practice questions."
        action={action}
      />
    );
  }

  /* Two queries for the whole list, after the list is known — not two per row.
     See `listReviewerStudyCounts`. */
  const counts = await listReviewerStudyCounts(reviewers.map((reviewer) => reviewer.id));

  return (
    <>
      <p className="text-sm text-ink-muted" role="status">
        {reviewers.length} {reviewers.length === 1 ? "reviewer" : "reviewers"}
        {filtering ? " matching" : ""}
      </p>

      <Card className="overflow-hidden">
        <CardBody flush>
          <ul className="divide-y divide-rule">
            {reviewers.map((reviewer) => (
              <ReviewerLibraryRow
                key={reviewer.id}
                reviewer={reviewer}
                counts={counts.get(reviewer.id) ?? { cards: 0, questions: 0 }}
              />
            ))}
          </ul>
        </CardBody>
      </Card>
    </>
  );
}

function ListSkeleton() {
  return (
    <Card>
      <CardBody className="flex flex-col gap-4 p-5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardBody>
    </Card>
  );
}

export default async function Page({ searchParams }: PageProps<"/reviewers">) {
  const resolved = await searchParams;

  const first = (key: string) => {
    const value = resolved[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const sort = first("sort");

  const query: ReviewerQuery = {
    search: first("q"),
    subjectId: first("subject"),
    sort: isReviewerSort(sort) ? sort : "recent",
  };

  const filtering = isFiltering(query);
  const subjects = await listReviewerSubjectFacets();

  /* The dialog needs every subject and its topics, not just the ones that
     already have a reviewer — the whole point is generating the first one.
     listReviewerSubjectFacets above answers a different question (what can I
     filter by) and the two must not be conflated. Both queries are cached. */
  const targets = await listSubjects().then((all) =>
    Promise.all(
      all.map(async (subject) => ({
        id: subject.id,
        name: subject.name,
        topics: (await listTopics(subject.id)).map((topic) => ({ id: topic.id, name: topic.name })),
      })),
    ),
  );

  const newReviewer =
    targets.length > 0 ? (
      <NewReviewerDialog subjects={targets} />
    ) : (
      /* A reason, not a hidden button. Someone who came looking for this needs
         to know what is missing and where to go. */
      <Link href="/subjects" className={buttonStyles({ variant: "accent" })}>
        Add a subject first
      </Link>
    );

  return (
    <div className="flex flex-col gap-5">
      {/* The button goes in PageHeader's own `action` slot. Sitting outside it
          in a second flex row put two competing layouts on one line, which is
          why the title block and the button never agreed on a baseline. */}
      <PageHeader
        eyebrow="Written from your own material"
        title="Reviewers"
        description="Every reviewer here was built from files you uploaded. Open one to revise, duplicate it before cutting it down, or turn it into flashcards and practice questions."
        action={newReviewer}
      />

      {/* Filters are furniture above an empty library. They appear once there is
          something to sort through, or once a filter is already applied —
          otherwise clearing the last one would remove the way to clear it. */}
      {(subjects.length > 0 || filtering) && <ReviewerFilters subjects={subjects} />}

      <PanelBoundary title="Reviewers">
        <Suspense
          key={`${query.search}-${query.subjectId}-${query.sort}`}
          fallback={<ListSkeleton />}
        >
          <ReviewerList query={query} filtering={filtering} action={newReviewer} />
        </Suspense>
      </PanelBoundary>
    </div>
  );
}
