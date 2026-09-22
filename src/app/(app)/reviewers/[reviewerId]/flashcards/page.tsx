import { ArrowLeft, Layers, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui";
import { FlashcardSession } from "@/features/flashcards/components/FlashcardSession";
import { GenerateFlashcardsButton } from "@/features/flashcards/components/GenerateFlashcardsButton";
import { ProgressWatcher } from "@/features/jobs/components/ProgressWatcher";
import { getFlashcardDeck } from "@/server/flashcards/queries";
import { getReviewer } from "@/server/reviewers/queries";

/**
 * A deck, and the session over it (FR-R2, US-F2, Sprint 44).
 *
 * The page is a full-height column so the card can take the space that is left:
 * a flashcard in a 20rem box surrounded by chrome is a paragraph, and the point
 * of the format is that there is nothing else to look at.
 *
 * Like the reviewer page, this does not poll. Generation is a job; the state on
 * screen is honest about it and a reload is one key.
 */

export async function generateMetadata({
  params,
}: PageProps<"/reviewers/[reviewerId]/flashcards">) {
  const { reviewerId } = await params;
  const reviewer = await getReviewer(reviewerId);
  return { title: reviewer ? `Flashcards · ${reviewer.title}` : "Flashcards" };
}

export default async function Page({ params }: PageProps<"/reviewers/[reviewerId]/flashcards">) {
  const { reviewerId } = await params;
  const [reviewer, deck] = await Promise.all([
    getReviewer(reviewerId),
    getFlashcardDeck(reviewerId),
  ]);

  if (!reviewer) notFound();

  /* From the ROW, not the URL. The old route carried the subject in its path;
     this one does not, and reading it here means it can never disagree with the
     reviewer it belongs to. */
  const id = reviewer.subjectId;

  /* Queued counts. A job nobody has claimed looks identical to one mid-flight
     from here, and both need the same nudge. */
  const generating = deck.cards.length === 0 && deck.status !== null && deck.status !== "failed";

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

        {deck.cards.length > 0 && (
          <GenerateFlashcardsButton
            subjectId={id}
            reviewerId={reviewerId}
            regenerate
            variant="quiet"
            size="sm"
          />
        )}
      </div>

      {deck.cards.length > 0 ? (
        /* Keyed on the deck so regenerating starts a genuinely new session
           rather than dropping different cards into the index a student had
           already reached. */
        <FlashcardSession
          key={deck.cards.map((card) => card.id).join(":")}
          cards={deck.cards}
          reviewerId={reviewerId}
          reviewerTitle={reviewer.title}
        />
      ) : (
        <Card>
          <CardBody className="flex items-start gap-3 py-5">
            {deck.status === "failed" ? (
              <>
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm leading-relaxed">
                    {deck.failureMessage ?? "We could not make cards from this reviewer."} Your
                    reviewer is untouched.
                  </p>
                  <GenerateFlashcardsButton subjectId={id} reviewerId={reviewerId} size="sm" />
                </div>
              </>
            ) : deck.status === null ? (
              <>
                <Layers className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm leading-relaxed text-ink-muted">
                    No cards from this reviewer yet.
                  </p>
                  <GenerateFlashcardsButton subjectId={id} reviewerId={reviewerId} size="sm" />
                </div>
              </>
            ) : (
              <>
                <Sparkles
                  className="mt-0.5 size-4 shrink-0 animate-pulse text-accent"
                  aria-hidden
                />
                <p className="text-sm leading-relaxed text-ink-muted">
                  Aki is turning this reviewer into cards. It usually takes under a minute, and they
                  appear here on their own.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
