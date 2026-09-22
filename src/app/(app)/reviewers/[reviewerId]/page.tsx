import { ArrowLeft, Layers, ListChecks, Sparkles, TriangleAlert } from "lucide-react";
import { type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, StatusBadge } from "@/components/ui";
import { ProgressWatcher } from "@/features/jobs/components/ProgressWatcher";
import { GenerateFlashcardsButton } from "@/features/flashcards/components/GenerateFlashcardsButton";
import { GenerateQuestionsButton } from "@/features/practice/components/GenerateQuestionsButton";
import { ReviewerDocumentView } from "@/features/reviewers/components/ReviewerDocumentView";
import { ReviewerTitle } from "@/features/reviewers/components/ReviewerTitle";
import { countFlashcards } from "@/server/flashcards/queries";
import { countPracticeQuestions } from "@/server/practice/queries";
import { getReviewer } from "@/server/reviewers/queries";

/**
 * One generated reviewer (FR-R1, US-F1).
 *
 * **Four sections in a fixed order, because the order is the advice.** Summary
 * first for the student with two minutes; then what to revise first, because
 * knowing where to start is worth more than any single explanation; then the
 * concepts; then the terms. Reversing that would produce a glossary with a
 * summary attached.
 *
 * **Its own route, not a page inside a subject.** A reviewer is what a student
 * revises FROM, and it is the hub the flashcards and the practice set hang off
 * — nesting it under /subjects/[id] made opening one from the library feel like
 * being sent back to a class you had already left. The subject it came from is
 * still named, as a fact about the reviewer rather than as the way back.
 */

export async function generateMetadata({ params }: PageProps<"/reviewers/[reviewerId]">) {
  const { reviewerId } = await params;
  const reviewer = await getReviewer(reviewerId);
  return { title: reviewer?.title ?? "Reviewer" };
}

export default async function Page({ params }: PageProps<"/reviewers/[reviewerId]">) {
  const { reviewerId } = await params;
  const [reviewer, cardCount, questionCount] = await Promise.all([
    getReviewer(reviewerId),
    countFlashcards(reviewerId),
    countPracticeQuestions(reviewerId),
  ]);

  if (!reviewer) notFound();

  const id = reviewer.subjectId;

  const content = reviewer.content;

  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-5">
      {/* Only while it is actually generating. Nudges the queue and refreshes,
          so a finished reviewer appears without a manual reload — and a job
          whose single kick was lost gets picked up instead of sitting for ever.
          Renders nothing. */}
      <ProgressWatcher active={reviewer.status !== "ready" && reviewer.status !== "failed"} />

      {/* Back to the LIBRARY, which is where this was opened from. Sending a
          student to the subject would be answering a question they did not
          ask — the subject is named below as a property of the reviewer. */}
      <Link
        href="/reviewers"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Reviewers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-subtle">
            {[
              reviewer.subjectName,
              reviewer.topicName,
              `${reviewer.sourceCount} source${reviewer.sourceCount === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <ReviewerTitle reviewerId={reviewerId} title={reviewer.title} />
        </div>
        <StatusBadge status={reviewer.status} />
      </div>

      {/* The two things a student does WITH a reviewer, on one row under the
          title rather than crowded into the header beside the status. Offered
          only once there is something to build from: a button on a reviewer
          that is still being written can only fail, and a button whose whole
          job is to explain why it will not work is worse than no button. */}
      {reviewer.status === "ready" && (
        <div className="flex flex-wrap items-center gap-2">
          {cardCount > 0 ? (
            <StudyLink
              href={`/reviewers/${reviewerId}/flashcards`}
              icon={<Layers className="size-4" aria-hidden />}
              label={`Study ${cardCount} cards`}
            />
          ) : (
            <GenerateFlashcardsButton subjectId={id} reviewerId={reviewerId} size="sm" />
          )}

          {questionCount > 0 ? (
            <StudyLink
              href={`/reviewers/${reviewerId}/practice`}
              icon={<ListChecks className="size-4" aria-hidden />}
              label={`Practise ${questionCount} questions`}
            />
          ) : (
            <GenerateQuestionsButton subjectId={id} reviewerId={reviewerId} size="sm" />
          )}
        </div>
      )}

      {/* Three states, and they are genuinely different. Still working is not a
          failure; failed is not empty; and a reviewer with no content but a
          ready status would be a bug worth seeing rather than hiding. */}
      {reviewer.status !== "ready" && !content && (
        <Card>
          <CardBody className="flex items-start gap-3 py-5">
            {reviewer.status === "failed" ? (
              <>
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                <p className="text-sm leading-relaxed">
                  {reviewer.failureMessage ?? "This reviewer could not be generated."} Nothing was
                  lost — your material is untouched.
                </p>
              </>
            ) : (
              <>
                <Sparkles
                  className="mt-0.5 size-4 shrink-0 animate-pulse text-accent"
                  aria-hidden
                />
                <p className="text-sm leading-relaxed text-ink-muted">
                  Aki is reading your material and writing this. It usually takes under a minute —
                  reload the page to see it.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {content && (
        <ReviewerDocumentView
          reviewerId={reviewerId}
          document={content}
          sourceCount={reviewer.sourceCount}
        />
      )}
    </div>
  );
}

/**
 * A link that reads as a study action.
 *
 * Shaped like the generate buttons beside it rather than like body text: the
 * two sit on the same row and do the same kind of thing, and a link that looked
 * like a link would read as a footnote next to a button.
 */
function StudyLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-rule bg-surface px-3.5 text-sm font-medium transition-colors hover:border-rule-strong hover:bg-surface-sunken"
    >
      {icon}
      {label}
    </Link>
  );
}
