import { ListChecks, TriangleAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { GeneratingOverlay, Ghost } from "@/features/jobs/components/GeneratingOverlay";
import { ProgressWatcher } from "@/features/jobs/components/ProgressWatcher";
import { GenerateQuestionsButton } from "@/features/practice/components/GenerateQuestionsButton";
import { PracticeSession } from "@/features/practice/components/PracticeSession";
import { StudyShell } from "@/features/reviewers/components/StudyShell";
import { getPracticeSet } from "@/server/practice/queries";
import { getReviewer } from "@/server/reviewers/queries";

/**
 * Practice questions for one reviewer (FR-C2, US-F3, Sprint 45).
 *
 * The same full-width shell as the flashcard deck, because it is the same
 * screen with different contents: one thing to answer, and nothing else
 * competing for the eye.
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

  const id = reviewer.subjectId;

  /* Queued counts. A job nobody has claimed looks identical to one mid-flight
     from here, and both need the same nudge. */
  const generating = set.questions.length === 0 && set.status !== null && set.status !== "failed";

  return (
    <StudyShell
      backHref={`/reviewers/${reviewerId}`}
      backLabel={reviewer.title}
      eyebrow="Practice"
      title={reviewer.title}
      colorSlot={reviewer.colorSlot}
      actions={
        set.questions.length > 0 ? (
          <>
            <span className="hidden text-sm text-ink-subtle tabular-nums sm:inline">
              {set.questions.length} questions
            </span>
            <GenerateQuestionsButton
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
      <ProgressWatcher active={generating} />

      {set.questions.length > 0 ? (
        /* Keyed on the questions so regenerating starts a genuinely new run
           rather than dropping different questions into the index a student had
           already reached. */
        <PracticeSession
          key={set.questions.map((question) => question.id).join(":")}
          questions={set.questions}
        />
      ) : generating ? (
        <GeneratingOverlay
          title="Aki is writing your questions"
          detail="Multiple choice, true or false, identification and short answer — each with an explanation for when you get it wrong. Usually under a minute."
          skeleton={<QuestionSkeleton />}
        />
      ) : set.status === "failed" ? (
        <EmptyState
          Icon={TriangleAlert}
          title="Those questions could not be written"
          description={`${set.failureMessage ?? "We could not write questions from this reviewer."} Your reviewer is untouched.`}
          action={<GenerateQuestionsButton subjectId={id} reviewerId={reviewerId} />}
        />
      ) : (
        <EmptyState
          Icon={ListChecks}
          title="No practice questions yet"
          description="Aki can turn this reviewer into questions — four kinds, each with an explanation of why the answer is right. Nothing here is recorded against your progress, so a bad first pass costs you nothing."
          action={<GenerateQuestionsButton subjectId={id} reviewerId={reviewerId} />}
        />
      )}
    </StudyShell>
  );
}

/**
 * The shape of a question, before there is one.
 *
 * Four ghost options under a two-line prompt: the real layout, so nothing jumps
 * when the set lands, and a student can see at a glance what they are waiting
 * for.
 */
function QuestionSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <Ghost className="h-3 w-16" />
        <Ghost className="h-1 flex-1" delay={60} />
        <Ghost className="h-3 w-20" delay={120} />
      </div>

      <div className="rise flex flex-1 flex-col gap-6 rounded-[var(--radius-card)] border border-rule bg-surface px-6 py-7 shadow-[var(--shadow-card)] sm:px-8">
        <div className="flex flex-col gap-2.5">
          <Ghost className="h-2.5 w-28" delay={180} />
          <Ghost className="h-5 w-[min(34rem,90%)]" delay={220} />
          <Ghost className="h-5 w-[min(22rem,65%)]" delay={260} />
        </div>

        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Ghost
              key={i}
              className="h-12 w-full rounded-[var(--radius-control)]"
              delay={320 + i * 70}
            />
          ))}
        </div>

        <Ghost className="mt-auto h-11 w-32 self-end rounded-[var(--radius-pill)]" delay={620} />
      </div>
    </div>
  );
}
