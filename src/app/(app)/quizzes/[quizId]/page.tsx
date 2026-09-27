import { TriangleAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui";
import { GeneratingOverlay, Ghost } from "@/features/jobs/components/GeneratingOverlay";
import { ProgressWatcher } from "@/features/jobs/components/ProgressWatcher";
import { QuizStage } from "@/features/quizzes/components/QuizStage";
import { DIFFICULTY_LABELS, estimateMinutes } from "@/features/quizzes/schema";
import { StudyShell } from "@/features/reviewers/components/StudyShell";
import { getQuiz, getQuizQuestions } from "@/server/quizzes/queries";

/**
 * One quiz (FR-Q1, US-G1, Sprint 49).
 *
 * **The page is the whole sitting** (Sprint 50): a start screen that sets the
 * timer, the questions themselves, and the review before handing in. A dialog
 * would have been wrong for all three — this is content a student will reload,
 * link to and come back to, which is the line `docs/navigation.md` §1 draws
 * between a page and a dialog.
 *
 * It reuses `StudyShell` because it IS a study screen: same full-width frame,
 * same subject colour, same back-to-the-library bar as a reviewer or a deck.
 */

export async function generateMetadata({ params }: PageProps<"/quizzes/[quizId]">) {
  const { quizId } = await params;
  const quiz = await getQuiz(quizId);
  return { title: quiz?.title ?? "Quiz" };
}

export default async function Page({ params }: PageProps<"/quizzes/[quizId]">) {
  const { quizId } = await params;
  const [quiz, questions] = await Promise.all([getQuiz(quizId), getQuizQuestions(quizId)]);

  if (!quiz) notFound();

  const working = quiz.status !== "ready" && quiz.status !== "failed";

  return (
    <StudyShell
      backHref="/quizzes"
      backLabel="your quizzes"
      eyebrow={[quiz.subjectName, quiz.topicName].filter(Boolean).join(" · ") || "Quiz"}
      title={quiz.title}
      colorSlot={quiz.colorSlot}
    >
      {/* Nudges the queue and refreshes while it is being written, so a lost
          kick recovers instead of leaving the quiz at `queued` for ever. */}
      <ProgressWatcher active={working} />

      {working ? (
        <GeneratingOverlay
          title={quiz.isMockExam ? "Aki is writing your mock exam" : "Aki is writing your quiz"}
          detail={
            /* A long paper is written in slices, and says how far it has got.
               "Usually under a minute" would be false for sixty questions, and a
               student watching a static line for three minutes assumes it
               stalled. The count comes from the job itself, not an estimate. */
            quiz.written !== null && quiz.written > 0
              ? `${quiz.written} of ${quiz.questionCount} questions written. Long papers are written in batches — this keeps going on its own.`
              : `Reading your material and writing ${quiz.questionCount} ${DIFFICULTY_LABELS[quiz.difficulty]?.label.toLowerCase()} questions. ${quiz.questionCount > 20 ? "A long paper takes a few minutes." : "Usually under a minute."}`
          }
          skeleton={<QuizSkeleton />}
        />
      ) : quiz.status === "failed" ? (
        <Card>
          <CardBody className="flex items-start gap-3 py-5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
            <p className="text-sm leading-relaxed">
              {quiz.failureMessage ?? "This quiz could not be written."} Your files are untouched —
              nothing was lost.
            </p>
          </CardBody>
        </Card>
      ) : questions.length === 0 ? (
        /* Ready, with nothing under it. A bug rather than a state a student
           caused, so it says so plainly instead of pretending to be empty. */
        <Card>
          <CardBody className="flex items-start gap-3 py-5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
            <p className="text-sm leading-relaxed">
              This quiz is marked as ready but has no questions saved. Delete it and make another —
              your files are untouched.
            </p>
          </CardBody>
        </Card>
      ) : (
        <QuizStage
          quizId={quiz.id}
          questions={questions}
          timeLimitSeconds={quiz.timeLimitSeconds}
          mock={quiz.isMockExam}
          estimatedMinutes={estimateMinutes(questions.length)}
        />
      )}
    </StudyShell>
  );
}

/** The shape of a quiz summary, before there is one. */
function QuizSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rise flex flex-col gap-2 rounded-[var(--radius-card)] border border-rule bg-surface p-4 shadow-[var(--shadow-card)]"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <Ghost className="h-2.5 w-20" delay={i * 90} />
            <Ghost className="h-5 w-16" delay={40 + i * 90} />
          </div>
        ))}
      </div>
      <div className="rise rounded-[var(--radius-card)] border border-rule bg-surface p-5 shadow-[var(--shadow-card)]">
        <Ghost className="h-3.5 w-full" delay={300} />
        <Ghost className="mt-2 h-3.5 w-[80%]" delay={350} />
      </div>
    </div>
  );
}
