"use client";

import { Clock, Play, Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button, ConfirmDialog } from "@/components/ui";
import { QuizRunner } from "@/features/quizzes/components/QuizRunner";
import { EXTRA_TIME_FACTOR, TIMER_OPTIONS, mockExamSeconds } from "@/features/quizzes/schema";
import { setQuizTimeLimitAction } from "@/features/quizzes/server/actions";
import { submitQuizAction } from "@/features/quizzes/server/submit";
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
 *
 * **A mock exam changes three rules and nothing else** (Sprint 54). The clock
 * cannot be switched off, only lengthened for extra time; the questions are
 * shuffled every sitting, so a second attempt tests the material rather than
 * the memory of where question twelve was; and time running out hands the
 * paper in.
 */
export function QuizStage({
  quizId,
  questions,
  timeLimitSeconds,
  estimatedMinutes,
  mock = false,
}: {
  quizId: string;
  questions: QuizQuestion[];
  timeLimitSeconds: number | null;
  estimatedMinutes: number;
  mock?: boolean;
}) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  /**
   * A mock exam's standard clock, from the questions it ACTUALLY has.
   *
   * The stored limit was set at creation from the length asked for. If the
   * material ran dry at forty-two of fifty, timing forty-two questions on a
   * fifty-question clock would make the rehearsal easier than the exam.
   */
  const standard = mockExamSeconds(questions.length);
  const [limit, setLimit] = useState<number | null>(mock ? standard : timeLimitSeconds);
  /* Fixed when Start is pressed, and never again. See QuizRunner's deadline. */
  const [deadline, setDeadline] = useState<number | null>(null);
  /* The order this sitting runs in. Set on Start, so a reload mid-sitting —
     which loses the answers anyway — is the only thing that reshuffles it. */
  const [order, setOrder] = useState<QuizQuestion[]>(questions);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmitting] = useTransition();
  const [, startSaving] = useTransition();

  /**
   * When the sitting began.
   *
   * Zero until the Start button is pressed — reading the clock during render
   * is what the React Compiler lint forbids, and the honest start is the press
   * anyway. The duration goes on the attempt, so a paper handed in after two
   * minutes is visibly different from one that took twenty.
   */
  const startedAt = useRef(0);

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
            {mock ? "Exam time" : "Timer"}
          </legend>
          <div className={cn("grid gap-2", mock ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
            {(mock
              ? [
                  { label: `Standard · ${standard / 60} min`, seconds: standard },
                  {
                    label: `Extra time · ${Math.round((standard * EXTRA_TIME_FACTOR) / 60)} min`,
                    seconds: Math.round(standard * EXTRA_TIME_FACTOR),
                  },
                ]
              : TIMER_OPTIONS
            ).map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={limit === option.seconds}
                /* A mock exam's choice is not saved. The stored clock is the
                   STANDARD one, and remembering extra time would quietly make
                   it the standard next time. */
                onClick={() => (mock ? setLimit(option.seconds) : choose(option.seconds))}
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
            {mock
              ? "Exam conditions. When time runs out your paper is handed in as it stands. Extra time is here for anyone who has it in their real exams."
              : limit === null
                ? "Untimed. Take as long as you need — this is the default, and it is the right one unless you are rehearsing an exam."
                : "When time runs out you go to your answers. Nothing is taken away."}
          </p>
        </fieldset>

        <Button
          size="lg"
          onClick={() => {
            /* Reading the clock and shuffling here, in the handler, rather than
               during render — both are impure, and this is the moment they
               genuinely belong to anyway. */
            const now = Date.now();
            startedAt.current = now;
            setDeadline(limit !== null ? now + limit * 1000 : null);
            if (mock) setOrder(shuffled(questions));
            setStarted(true);
          }}
          block
        >
          <Play aria-hidden />
          {mock ? "Start the exam" : "Start quiz"}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs leading-relaxed text-ink-subtle">
          {mock ? (
            <>
              <Shuffle className="size-3.5" aria-hidden />
              Questions come in a new order every sitting. Nothing is marked until the end.
            </>
          ) : (
            "Nothing is marked while you are in it. You can skip questions and come back to them."
          )}
        </p>
      </div>
    );
  }

  return (
    <>
      <QuizRunner
        questions={order}
        deadline={deadline}
        timeLimitSeconds={limit}
        mock={mock}
        submitting={submitting}
        submitError={error}
        onSubmit={(answers) => {
          setError(null);
          startSubmitting(async () => {
            const result = await submitQuizAction({
              quizId,
              answers,
              durationSeconds:
                startedAt.current === 0 ? 0 : Math.round((Date.now() - startedAt.current) / 1000),
            });

            if (result.status === "error") {
              /* Kept on the review screen with the answers intact. A failed
                 submission must never cost a student the paper they just
                 sat — they press it again. */
              setError(`${result.message} ${result.nextStep}`);
              return;
            }

            router.push(`/quizzes/${quizId}/attempts/${result.attemptId}`);
          });
        }}
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
          title={mock ? "Leave this exam?" : "Leave this quiz?"}
          consequences="Your answers are not saved until you hand the quiz in, so leaving now discards them. The quiz itself stays in your library and you can start it again."
          confirmLabel="Leave and discard"
          onConfirm={() => router.push("/quizzes")}
        />
      )}
    </>
  );
}

/**
 * Fisher–Yates, on a copy.
 *
 * Not `sort(() => Math.random() - 0.5)`, which is not a shuffle: it hands an
 * inconsistent comparator to a sort that assumes one, and leaves the early
 * questions near the front often enough to notice on a sixty-question paper.
 */
function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
