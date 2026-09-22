import { Target } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles, EmptyState } from "@/components/ui";
import { PracticeSession } from "@/features/practice/components/PracticeSession";
import { StudyShell } from "@/features/reviewers/components/StudyShell";
import { getMissedQuestions, getPracticeSet } from "@/server/practice/queries";
import { getReviewer } from "@/server/reviewers/queries";

/**
 * The questions you got wrong, again (Sprint 49).
 *
 * **The point of practice is the second attempt.** A set answered once and
 * scored tells a student where they stand and leaves them there; the questions
 * they missed are the only ones with anything left to teach, and until now the
 * product forgot them the moment the summary screen closed. This is that list,
 * and it is the same session component — a retry is not a different interaction
 * from a first pass, it is the same one aimed at a smaller set.
 *
 * **It clears itself.** Membership is "your most recent answer to this question
 * was wrong", so getting one right here takes it off the list, and getting it
 * wrong again leaves it on. There is nothing to tick off and no list that only
 * grows — see `getMissedQuestions`.
 *
 * **Empty is the good ending, and it says so.** An empty mistakes list is not a
 * missing feature; it is the state a student is working toward. The two ways of
 * reaching it are genuinely different, though — nothing missed yet, versus
 * nothing left — and telling someone who has never practised that they are all
 * caught up would be a lie the first time they saw this screen.
 */

export async function generateMetadata({ params }: PageProps<"/reviewers/[reviewerId]/review">) {
  const { reviewerId } = await params;
  const reviewer = await getReviewer(reviewerId);
  return { title: reviewer ? `Review mistakes · ${reviewer.title}` : "Review mistakes" };
}

export default async function Page({ params }: PageProps<"/reviewers/[reviewerId]/review">) {
  const { reviewerId } = await params;
  const [reviewer, set, missed] = await Promise.all([
    getReviewer(reviewerId),
    getPracticeSet(reviewerId),
    getMissedQuestions(reviewerId),
  ]);

  if (!reviewer) notFound();

  /* Never practised at all, versus practised and nothing outstanding. The same
     empty box with the same copy for both would tell a first-time visitor they
     had cleared a list they have never had. */
  const neverPractised = set.questions.length === 0 || set.status !== "ready";

  return (
    <StudyShell
      backHref={`/reviewers/${reviewerId}`}
      backLabel={reviewer.title}
      eyebrow="Review mistakes"
      title={reviewer.title}
      colorSlot={reviewer.colorSlot}
      actions={
        missed.length > 0 ? (
          <span className="tabular hidden text-sm text-ink-subtle sm:inline">
            {missed.length} to get right
          </span>
        ) : null
      }
    >
      {missed.length > 0 ? (
        /* Keyed on the questions, so clearing one and coming back starts a
           genuinely new run rather than dropping a shorter list into an index
           the student had already reached. */
        <PracticeSession
          key={missed.map((question) => question.id).join(":")}
          questions={missed}
          quizId={set.id}
          reviewerId={reviewerId}
          subjectId={reviewer.subjectId}
          topicId={reviewer.topicId}
          mode="review"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            Icon={Target}
            title={neverPractised ? "Nothing to review yet" : "Nothing left to fix"}
            description={
              neverPractised
                ? "Work through the practice questions first. Anything you get wrong lands here, so you can come back and get it right rather than starting the whole set again."
                : "Every question you have missed, you have since got right. Take the full set again in a few days and see whether it holds."
            }
            action={
              <Link
                href={`/reviewers/${reviewerId}/practice`}
                className={buttonStyles({ variant: "accent" })}
              >
                {neverPractised ? "Start practising" : "Take the full set"}
              </Link>
            }
          />
        </div>
      )}
    </StudyShell>
  );
}
