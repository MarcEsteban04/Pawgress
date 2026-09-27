"use client";

import { Timer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ConfirmDialog, StatusBadge } from "@/components/ui";
import { DIFFICULTY_LABELS } from "@/features/quizzes/schema";
import { deleteQuizAction } from "@/features/quizzes/server/actions";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { type QuizSummary } from "@/server/quizzes/queries";
import { cn } from "@/lib/utils";

/**
 * One quiz in the library (Sprint 49).
 *
 * **The last score is the headline once there is one.** Before a quiz has been
 * sat, what matters is what it covers and how long it will take; afterwards,
 * the only question anyone opens this list to answer is "how did I do". The
 * card changes what it leads with rather than showing both and making the eye
 * hunt.
 *
 * The whole card is the link and the delete control is a sibling of the anchor,
 * not a child: a button inside a link is invalid HTML and behaves
 * unpredictably when either is activated from the keyboard.
 */
export function QuizCard({ quiz }: { quiz: QuizSummary }) {
  const router = useRouter();
  const [isDeleting, startDeleting] = useTransition();
  const tone = SUBJECT_TONE[quiz.colorSlot];

  const ready = quiz.status === "ready";
  const percent = quiz.lastScore
    ? Math.round((quiz.lastScore.correct / quiz.lastScore.total) * 100)
    : null;

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-[var(--radius-card)] border border-rule bg-surface p-4 shadow-[var(--shadow-card)] transition-colors hover:border-rule-strong",
        isDeleting && "pointer-events-none opacity-50",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", tone.dot)} aria-hidden />

        <div className="min-w-0 flex-1">
          <Link
            href={`/quizzes/${quiz.id}`}
            className="font-display leading-snug font-semibold tracking-[-0.01em] before:absolute before:inset-0 before:content-['']"
          >
            {quiz.title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-ink-subtle">
            {[quiz.subjectName, quiz.topicName, DIFFICULTY_LABELS[quiz.difficulty]?.label]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {/* Status first when there is one — "still being written" matters more
            than what kind of paper it will be. */}
        {!ready ? (
          <StatusBadge status={quiz.status} />
        ) : (
          quiz.isMockExam && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] bg-ink px-2 py-0.5 text-[0.6875rem] font-semibold tracking-[0.04em] text-on-ink uppercase">
              <Timer className="size-3" aria-hidden />
              Mock exam
            </span>
          )
        )}
      </div>

      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          {percent !== null ? (
            <>
              <p className="font-display text-2xl leading-none font-semibold tabular-nums">
                {percent}%
              </p>
              <p className="mt-1 text-xs text-ink-subtle tabular-nums">
                {quiz.lastScore?.correct}/{quiz.lastScore?.total} · {quiz.attempts}{" "}
                {quiz.attempts === 1 ? "attempt" : "attempts"}
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-subtle tabular-nums">
              {/* Before it is ready this number is the REQUEST, so it is worded
                  as one. Saying "12 questions" over a queued quiz would promise
                  something that does not exist yet. */}
              {ready
                ? `${quiz.questionCount} questions · not attempted`
                : `${quiz.questionCount} questions requested`}
            </p>
          )}
        </div>

        <ConfirmDialog
          trigger={
            <button
              type="button"
              aria-label={`Delete ${quiz.title}`}
              className="relative z-10 rounded-full p-1.5 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-bad-soft hover:text-bad focus-visible:opacity-100"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          }
          title={`Delete ${quiz.title}?`}
          /* The attempts are named because they are the part a student would
             not expect to lose and cannot get back. */
          consequences={
            quiz.attempts > 0
              ? `This removes the quiz and your ${quiz.attempts} recorded ${quiz.attempts === 1 ? "attempt" : "attempts"}. Your files and your reviewers are untouched.`
              : "This removes the quiz. Your files and your reviewers are untouched."
          }
          confirmLabel="Delete quiz"
          onConfirm={() =>
            startDeleting(async () => {
              await deleteQuizAction(quiz.id);
              router.refresh();
            })
          }
        />
      </div>
    </div>
  );
}
