import { ArrowLeft, ListChecks, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui";
import { ProgressWatcher } from "@/features/jobs/components/ProgressWatcher";
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

export async function generateMetadata({ params }: PageProps<"/reviewers/[reviewerId]/practice">) {
  const { reviewerId } = await params;
  const reviewer = await getReviewer(reviewerId);
  return { title: reviewer ? `Practice · ${reviewer.title}` : "Practice" };
}

export default async function Page({ params }: PageProps<"/reviewers/[reviewerId]/practice">) {
  const { reviewerId } = await params;
  const [reviewer, set] = await Promise.all([getReviewer(reviewerId), getPracticeSet(reviewerId)]);

  if (!reviewer) notFound();

  /* From the ROW, not the URL. The old route carried the subject in its path;
     this one does not, and reading it here means it can never disagree with the
     reviewer it belongs to. */
  const id = reviewer.subjectId;

  /* Queued counts. A job nobody has claimed looks identical to one mid-flight
     from here, and both need the same nudge. */
  const generating = set.questions.length === 0 && set.status !== null && set.status !== "failed";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-[52rem] flex-col gap-5">
      {/**
       * The fix for the bug that made this look broken.
       *
       * Generation is a job, and `enqueueJob` kicks the worker exactly once,
       * fire-and-forget. Lose that kick and nothing invokes it again: the job
       * sits at `queued` with zero attempts for ever, which is precisely what
       * happened — a deck and a question set queued and never claimed.
       *
       * The copy said "reload the page", which was worse than useless: a reload
       * re-reads the same unchanged row and does not start anything. This nudges
       * the queue AND refreshes, so a lost kick recovers and a finished set
       * appears without being asked for. Renders nothing.
       */}
      <ProgressWatcher active={generating} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/reviewers/${reviewerId}`}
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
                  Aki is writing questions on this reviewer. It usually takes under a minute, and
                  they appear here on their own.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
