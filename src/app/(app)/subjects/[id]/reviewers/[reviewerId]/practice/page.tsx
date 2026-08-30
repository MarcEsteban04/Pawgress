import { ArrowLeft, ListChecks, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui";
import { GenerateQuestionsButton } from "@/features/practice/components/GenerateQuestionsButton";
import { PracticeSession } from "@/features/practice/components/PracticeSession";
import { getPracticeSet } from "@/server/practice/queries";
import { getReviewer } from "@/server/reviewers/queries";

/**
 * Practice questions for one reviewer (FR-C2, US-F3, Sprint 45).
 *
 * A full-height column, like the flashcard deck: a question with its options
 * and its explanation needs the room, and the point of practising is that there
 * is nothing else on screen to look at.
 *
 * No polling. Generation is a job; the state on screen is honest about it and a
 * reload is one key.
 */

export async function generateMetadata({
  params,
}: PageProps<"/subjects/[id]/reviewers/[reviewerId]/practice">) {
  const { reviewerId } = await params;
  const reviewer = await getReviewer(reviewerId);
  return { title: reviewer ? `Practice · ${reviewer.title}` : "Practice" };
}

export default async function Page({
  params,
}: PageProps<"/subjects/[id]/reviewers/[reviewerId]/practice">) {
  const { id, reviewerId } = await params;
  const [reviewer, set] = await Promise.all([getReviewer(reviewerId), getPracticeSet(reviewerId)]);

  if (!reviewer) notFound();

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-[52rem] flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/subjects/${id}/reviewers/${reviewerId}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {reviewer.title}
        </Link>

        {set.questions.length > 0 && (
          <GenerateQuestionsButton
            subjectId={id}
            reviewerId={reviewerId}
            regenerate
            variant="quiet"
            size="sm"
          />
        )}
      </div>

      {set.questions.length > 0 ? (
        /* Keyed on the questions so regenerating starts a genuinely new run
           rather than dropping different questions into the index a student had
           already reached. */
        <PracticeSession
          key={set.questions.map((question) => question.id).join(":")}
          questions={set.questions}
        />
      ) : (
        <Card>
          <CardBody className="flex items-start gap-3 py-5">
            {set.status === "failed" ? (
              <>
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm leading-relaxed">
                    {set.failureMessage ?? "We could not write questions from this reviewer."} Your
                    reviewer is untouched.
                  </p>
                  <GenerateQuestionsButton subjectId={id} reviewerId={reviewerId} size="sm" />
                </div>
              </>
            ) : set.status === null ? (
              <>
                <ListChecks className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm leading-relaxed text-ink-muted">
                    No practice questions from this reviewer yet.
                  </p>
                  <GenerateQuestionsButton subjectId={id} reviewerId={reviewerId} size="sm" />
                </div>
              </>
            ) : (
              <>
                <Sparkles
                  className="mt-0.5 size-4 shrink-0 animate-pulse text-accent"
                  aria-hidden
                />
                <p className="text-sm leading-relaxed text-ink-muted">
                  Aki is writing questions on this reviewer. It usually takes under a minute —
                  reload the page to see them.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
