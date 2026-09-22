import { Layers, TriangleAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { FlashcardSession } from "@/features/flashcards/components/FlashcardSession";
import { GenerateFlashcardsButton } from "@/features/flashcards/components/GenerateFlashcardsButton";
import { GeneratingOverlay, Ghost } from "@/features/jobs/components/GeneratingOverlay";
import { ProgressWatcher } from "@/features/jobs/components/ProgressWatcher";
import { StudyShell } from "@/features/reviewers/components/StudyShell";
import { getFlashcardDeck } from "@/server/flashcards/queries";
import { getReviewer } from "@/server/reviewers/queries";

/**
 * A deck, and the session over it (FR-R2, US-F2, Sprint 44).
 *
 * Full width and full height through `StudyShell`: the whole point of the
 * format is that there is nothing else on screen, and the previous 52rem column
 * floating in the middle of a wide canvas was the opposite of that.
 *
 * Three states, and they are genuinely different — a deck to study, a deck
 * being written, and nothing yet. The middle one gets the overlay rather than a
 * sentence in a card, because a student who pressed generate is watching this
 * space and deserves to see the shape of what is coming.
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

  /* From the ROW, not the URL. The route no longer carries the subject, and
     reading it here means it can never disagree with the reviewer. */
  const id = reviewer.subjectId;

  /* Queued counts. A job nobody has claimed looks identical to one mid-flight
     from here, and both need the same nudge. */
  const generating = deck.cards.length === 0 && deck.status !== null && deck.status !== "failed";

  return (
    <StudyShell
      backHref={`/reviewers/${reviewerId}`}
      backLabel={reviewer.title}
      eyebrow="Flashcards"
      title={reviewer.title}
      colorSlot={reviewer.colorSlot}
      actions={
        deck.cards.length > 0 ? (
          <>
            <span className="hidden text-sm text-ink-subtle tabular-nums sm:inline">
              {deck.knownCount}/{deck.cards.length} known
            </span>
            <GenerateFlashcardsButton
              subjectId={id}
              reviewerId={reviewerId}
              regenerate
              variant="quiet"
              size="sm"
            />
          </>
        ) : null
      }
    >
      {/**
       * Generation is a job, and `enqueueJob` kicks the worker exactly once.
       * Lose that kick and nothing invokes it again — the job sits at `queued`
       * with zero attempts for ever, which is exactly what happened once. This
       * nudges the queue AND refreshes. Renders nothing.
       */}
      <ProgressWatcher active={generating} />

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
      ) : generating ? (
        <GeneratingOverlay
          title="Aki is writing your cards"
          detail="Reading the reviewer and turning it into questions worth answering. Usually under a minute — they appear here on their own."
          skeleton={<DeckSkeleton />}
        />
      ) : deck.status === "failed" ? (
        <EmptyState
          Icon={TriangleAlert}
          title="Those cards could not be written"
          description={`${deck.failureMessage ?? "We could not make cards from this reviewer."} Your reviewer is untouched.`}
          action={<GenerateFlashcardsButton subjectId={id} reviewerId={reviewerId} />}
        />
      ) : (
        <EmptyState
          Icon={Layers}
          title="No flashcards yet"
          description="Aki can turn this reviewer into cards — one idea each, question on the front, what you should be able to say on the back. Then you flip through them until they stick."
          action={<GenerateFlashcardsButton subjectId={id} reviewerId={reviewerId} />}
        />
      )}
    </StudyShell>
  );
}

/**
 * The shape of a card session, before there is one.
 *
 * Deliberately the REAL layout — progress rail, one big card, two answer
 * buttons — so nothing moves when the deck arrives. A generic grey box would
 * have to be replaced by something a different size, and the jump is what makes
 * a loading state feel cheap.
 */
function DeckSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <Ghost className="h-3 w-16" />
        <Ghost className="h-1 flex-1" delay={60} />
        <Ghost className="h-3 w-20" delay={120} />
      </div>

      <div className="rise flex flex-1 flex-col items-center justify-center gap-5 rounded-[var(--radius-card)] border border-rule bg-surface px-6 py-12 shadow-[var(--shadow-card)]">
        <Ghost className="h-6 w-[min(28rem,80%)]" delay={180} />
        <Ghost className="h-6 w-[min(20rem,60%)]" delay={240} />
        <Ghost className="mt-2 h-3 w-40" delay={300} />
      </div>

      <div className="flex items-center justify-center gap-3">
        <Ghost className="h-11 w-40 rounded-[var(--radius-pill)]" delay={360} />
        <Ghost className="h-11 w-40 rounded-[var(--radius-pill)]" delay={420} />
      </div>
    </div>
  );
}
