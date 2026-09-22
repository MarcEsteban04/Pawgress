import { Shuffle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles, EmptyState } from "@/components/ui";
import { MatchingSession } from "@/features/reviewers/components/MatchingSession";
import { StudyShell } from "@/features/reviewers/components/StudyShell";
import { MATCH_MINIMUM, matchPairs, shufflePairs } from "@/features/reviewers/matching";
import { getReviewer } from "@/server/reviewers/queries";

/**
 * Matching type (Sprint 49).
 *
 * **Nothing is generated for this.** The board is the reviewer's own key terms
 * and their definitions, which are already written and already short. That is
 * the reason this mode exists at the price it does: every other way to study a
 * reviewer costs a generation job and a minute of waiting, and this one is
 * playable the second the reviewer is ready.
 *
 * **Shuffled HERE, on the server.** A client component that shuffles on mount
 * renders one order into the HTML and a different one on hydration, which React
 * discards and repaints — visible as the whole board jumping. Shuffling before
 * the markup exists means there is nothing to disagree about; the session
 * reshuffles for "go again", which happens long after hydration.
 */

export async function generateMetadata({ params }: PageProps<"/reviewers/[reviewerId]/matching">) {
  const { reviewerId } = await params;
  const reviewer = await getReviewer(reviewerId);
  return { title: reviewer ? `Matching · ${reviewer.title}` : "Matching" };
}

export default async function Page({ params }: PageProps<"/reviewers/[reviewerId]/matching">) {
  const { reviewerId } = await params;
  const reviewer = await getReviewer(reviewerId);

  if (!reviewer) notFound();

  const pairs = reviewer.content ? shufflePairs(matchPairs(reviewer.content)) : [];

  return (
    <StudyShell
      backHref={`/reviewers/${reviewerId}`}
      backLabel={reviewer.title}
      eyebrow="Matching"
      title={reviewer.title}
      colorSlot={reviewer.colorSlot}
      actions={
        pairs.length >= MATCH_MINIMUM ? (
          <span className="tabular hidden text-sm text-ink-subtle sm:inline">
            {pairs.length} pairs
          </span>
        ) : null
      }
    >
      {pairs.length >= MATCH_MINIMUM ? (
        <MatchingSession
          pairs={pairs}
          reviewerId={reviewerId}
          reviewerTitle={reviewer.title}
          subjectId={reviewer.subjectId}
          topicId={reviewer.topicId}
          colorSlot={reviewer.colorSlot}
        />
      ) : (
        /* Not a failure, and not worth a job to fix. The key terms section is
           editable on the reviewer itself, so the way out is to add some — and
           the button goes there rather than offering a rewrite, because a
           rewrite of a reviewer that produced two terms will usually produce
           two again. */
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            Icon={Shuffle}
            title="Not enough to match yet"
            description={`Matching needs at least ${MATCH_MINIMUM} key terms or concepts, and this reviewer has fewer. Open it and add a few of your own, or ask Aki to rewrite the key terms section.`}
            action={
              <Link
                href={`/reviewers/${reviewerId}`}
                className={buttonStyles({ variant: "accent" })}
              >
                Open the reviewer
              </Link>
            }
          />
        </div>
      )}
    </StudyShell>
  );
}
