import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { notFound } from "next/navigation";
import { buttonStyles } from "@/components/ui";
import { AttemptResult } from "@/features/quizzes/components/AttemptResult";
import { StudyShell } from "@/features/reviewers/components/StudyShell";
import { getAttempt } from "@/server/quizzes/queries";

/**
 * One finished attempt (FR-Q5, US-G3, Sprint 52).
 *
 * **Its own URL, under the quiz it belongs to.** An attempt is a record a
 * student will come back to, link to and compare against a later one — which is
 * the line `docs/navigation.md` §1 draws between a page and a screen inside
 * another component. It also means a failed navigation after submission costs
 * nothing: the marking is saved, and the address is enough to find it again.
 */

export async function generateMetadata({
  params,
}: PageProps<"/quizzes/[quizId]/attempts/[attemptId]">) {
  const { attemptId } = await params;
  const attempt = await getAttempt(attemptId);
  return {
    title: attempt ? `${attempt.correct}/${attempt.total} · ${attempt.quizTitle}` : "Attempt",
  };
}

export default async function Page({
  params,
}: PageProps<"/quizzes/[quizId]/attempts/[attemptId]">) {
  const { quizId, attemptId } = await params;
  const attempt = await getAttempt(attemptId);

  /* Belongs to this quiz, or it is not this page. Guessing an attempt id from
     another quiz would otherwise render it under the wrong title — RLS already
     stops it being another student's. */
  if (!attempt || attempt.quizId !== quizId) notFound();

  return (
    <StudyShell
      backHref="/quizzes"
      backLabel="your quizzes"
      eyebrow={attempt.subjectName || "Quiz"}
      title={attempt.quizTitle}
      colorSlot={attempt.colorSlot}
      actions={
        /* The only thing on offer. Sitting it again is the useful next move;
           anything else here would be decoration over a number. */
        <Link
          href={`/quizzes/${quizId}`}
          className={buttonStyles({ variant: "subtle", size: "sm" })}
        >
          <RotateCcw aria-hidden />
          Sit it again
        </Link>
      }
    >
      <AttemptResult attempt={attempt} />
    </StudyShell>
  );
}
