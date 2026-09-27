import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonStyles, EmptyState, PanelBoundary, Skeleton } from "@/components/ui";
import { NewQuizDialog } from "@/features/quizzes/components/NewQuizDialog";
import { QuizCard } from "@/features/quizzes/components/QuizCard";
import { listQuizzes } from "@/server/quizzes/queries";
import { listSubjects } from "@/server/subjects/queries";
import { listTopics } from "@/server/topics/queries";

/**
 * The quiz library (FR-Q1, US-G1, Sprint 49).
 *
 * **Separate from reviewers, because a quiz is not made from one.** A practice
 * set belongs to the reviewer it was generated from and lives on that
 * reviewer's page; a quiz is built from the material over a scope the student
 * picked, so it belongs to them rather than to any one study aid. Putting the
 * two in one list would mean explaining a distinction that the two locations
 * make obvious.
 *
 * The list is suspended; the header is not. Someone who navigated here should
 * see the page they asked for immediately, and "make a new one" should not wait
 * on a query.
 */

export const metadata = { title: "Quizzes" };

async function Library() {
  const quizzes = await listQuizzes();

  if (quizzes.length === 0) {
    return (
      <EmptyState
        Icon={ClipboardCheck}
        title="No quizzes yet"
        description="A quiz is written from your uploaded files rather than from a reviewer, so it can ask about anything in the material — including the parts a summary left out. Choose a subject, a difficulty and a length, and Aki writes it."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {quizzes.map((quiz) => (
        <QuizCard key={quiz.id} quiz={quiz} />
      ))}
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[7.5rem] w-full rounded-[var(--radius-card)]" />
      ))}
    </div>
  );
}

export default async function Page() {
  /* Awaited rather than suspended: a "New quiz" button that appears before it
     knows which subjects exist is a button that cannot do anything yet. Both
     queries are cached. */
  const subjects = await listSubjects();
  const targets = await Promise.all(
    subjects.map(async (subject) => ({
      id: subject.id,
      name: subject.name,
      topics: (await listTopics(subject.id)).map((topic) => ({ id: topic.id, name: topic.name })),
    })),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="Written from your own files"
          title="Quizzes"
          description="Pick a subject, a difficulty and a length. Aki writes the questions from your material."
        />

        {targets.length > 0 ? (
          <NewQuizDialog subjects={targets} />
        ) : (
          /* A reason, not a hidden button. Someone who came looking for this
             needs to know what is missing and where to go. */
          <Link href="/subjects" className={buttonStyles({ variant: "accent" })}>
            Add a subject first
          </Link>
        )}
      </div>

      <PanelBoundary title="Quizzes">
        <Suspense fallback={<LibrarySkeleton />}>
          <Library />
        </Suspense>
      </PanelBoundary>
    </div>
  );
}
