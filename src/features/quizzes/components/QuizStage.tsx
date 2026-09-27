"use client";

import { Clock, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ConfirmDialog } from "@/components/ui";
import { QuizRunner } from "@/features/quizzes/components/QuizRunner";
import { TIMER_OPTIONS } from "@/features/quizzes/schema";
import { setQuizTimeLimitAction } from "@/features/quizzes/server/actions";
import { type QuizQuestion } from "@/server/quizzes/queries";
import { cn } from "@/lib/utils";

/**
 * Start screen, then the quiz, then the way out (Sprint 50).
 *
 * **A quiz begins when a student says so.** Landing straight into question one
 * would start a timed sitting before they had decided to sit it — and the
 * timer is chosen here, which is only possible if there is a "here". The start
 * screen is also the only honest place to say how long this will take.
 *
 * **Leaving is guarded, and only when there is something to lose.** Answers
 * live in memory for the sitting, so closing the tab discards them. A
 * confirmation on every exit would be noise; one that fires only after an
 * answer exists is a warning people still read.
 */
export function QuizStage({
  quizId,
  questions,
  timeLimitSeconds,
  estimatedMinutes,
}: {
  quizId: string;
  questions: QuizQuestion[];
  timeLimitSeconds: number | null;
  estimatedMinutes: number;
}) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [limit, setLimit] = useState<number | null>(timeLimitSeconds);
  const [leaving, setLeaving] = useState(false);
  const [, startSaving] = useTransition();

  function choose(seconds: number | null) {
    setLimit(seconds);
    /* Fire-and-forget. The runner takes the value from state, so a failed
       write costs the student nothing this sitting — it only means the choice
       is not remembered next time. Blocking the start screen on it would be
       the wrong trade. */
    startSaving(async () => {
      await setQuizTimeLimitAction(quizId, seconds);
    });
  }

  if (!started) {
    return (
      <div className="mx-auto flex w-full max-w-[34rem] flex-1 flex-col justify-center gap-6 py-8">
        <div className="text-center">
          <p className="font-display text-4xl font-semibold tracking-[-0.03em] tabular-nums">
            {questions.length}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            questions · about {estimatedMinutes} minutes
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 flex w-full items-center gap-2 text-sm font-medium">
            <Clock className="size-4 text-ink-subtle" aria-hidden />
            Timer
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIMER_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={limit === option.seconds}
                onClick={() => choose(option.seconds)}
                className={cn(
                  "rounded-[var(--radius-control)] border px-3 py-2.5 text-sm font-medium transition-colors",
                  limit === option.seconds
                    ? "border-accent bg-accent-soft"
                    : "border-rule hover:border-rule-strong hover:bg-surface-sunken",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-ink-subtle">
            {limit === null
              ? "Untimed. Take as long as you need — this is the default, and it is the right one unless you are rehearsing an exam."
              : "When time runs out you go to your answers. Nothing is taken away."}
          </p>
        </fieldset>

        <Button size="lg" onClick={() => setStarted(true)} block>
          <Play aria-hidden />
          Start quiz
        </Button>

        <p className="text-center text-xs leading-relaxed text-ink-subtle">
          Nothing is marked while you are in it. You can skip questions and come back to them.
        </p>
      </div>
    );
  }

  return (
    <>
      <QuizRunner
        questions={questions}
        timeLimitSeconds={limit}
        onExit={(hasAnswers) => {
          /* Straight out when there is nothing to lose. Asking someone to
             confirm discarding an empty sitting is a dialog that only ever
             teaches them to dismiss dialogs. */
          if (!hasAnswers) {
            router.push("/quizzes");
            return;
          }
          setLeaving(true);
        }}
      />

      {leaving && (
        <ConfirmDialog
          open
          onOpenChange={(next) => setLeaving(next)}
          title="Leave this quiz?"
          consequences="Your answers are not saved until you hand the quiz in, so leaving now discards them. The quiz itself stays in your library and you can start it again."
          confirmLabel="Leave and discard"
          onConfirm={() => router.push("/quizzes")}
        />
      )}
    </>
  );
}
