"use client";

import { ArrowLeft, ArrowRight, Check, CircleAlert, Clock, ListChecks, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { type QuizQuestion } from "@/server/quizzes/queries";
import { cn } from "@/lib/utils";

/**
 * Sitting a quiz (FR-Q3, US-G2, Sprint 50).
 *
 * **Nothing is marked while you are in it, and that is the whole difference
 * from practice.** Practice marks each answer the moment it is given, because
 * its job is to teach; a quiz withholds every verdict until the end, because
 * its job is to measure. Telling a student question three was wrong changes how
 * they answer question four, which is exactly what a measurement must not do.
 *
 * It follows that this component never receives the answers — see `QuizQuestion`,
 * which has no `answer` field at all. Marking happens on the server in Sprint 52.
 *
 * **Free navigation, unlike practice's one-way run.** Skip, come back, change
 * your mind: that is how every exam works, and a quiz that forced an answer
 * before moving on would be measuring nerve rather than knowledge.
 *
 * **Answers live in memory for the sitting.** Nothing is written per keystroke —
 * a quiz is submitted once, and a half-finished attempt saved on every
 * character would be forty writes for a twenty-question set. The cost is that
 * closing the tab loses the sitting, which is why leaving is guarded.
 */

type Answers = Record<string, string>;

export function QuizRunner({
  questions,
  deadline,
  timeLimitSeconds,
  mock = false,
  onExit,
  onSubmit,
  submitting,
  submitError,
}: {
  questions: QuizQuestion[];
  /**
   * When time runs out, as an absolute timestamp fixed at the moment Start was
   * pressed. Null is untimed.
   *
   * Absolute rather than a duration, and that is the fix for a real bug. The
   * countdown used to set its own deadline when it mounted — so it restarted
   * every time the review screen swapped it out and back, and (because its
   * effect depended on an inline callback) every time a student typed a
   * letter. A clock that resets on use is not a clock.
   */
  deadline: number | null;
  /** The full limit, for the first frame before the countdown's first tick. */
  timeLimitSeconds: number | null;
  /**
   * Exam conditions (Sprint 54). When time runs out the paper is handed in,
   * not merely closed — a quiz sends a student to review their answers, a mock
   * exam takes them, because that is what an exam does.
   */
  mock?: boolean;
  /** Asks to leave. The page owns the confirmation, because it owns the route. */
  onExit: (hasAnswers: boolean) => void;
  /** Hands the paper in. The page owns this, because it owns the navigation after. */
  onSubmit: (answers: Answers) => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [reviewing, setReviewing] = useState(false);
  const [expired, setExpired] = useState(false);

  /* Fires once per sitting. The countdown is rendered on both the question
     screen and the review screen, so it mounts more than once — and each mount
     that finds the deadline passed would otherwise hand the paper in again. */
  const expiredRef = useRef(false);

  function handleExpire() {
    if (expiredRef.current) return;
    expiredRef.current = true;
    setExpired(true);
    setReviewing(true);
    if (mock) onSubmit(answers);
  }

  const clock =
    deadline !== null && timeLimitSeconds !== null ? (
      <Timer deadline={deadline} totalSeconds={timeLimitSeconds} onExpire={handleExpire} />
    ) : null;

  /* After a mock exam's time is up the paper is closed. Going back to change
     an answer would be the one thing an exam does not allow. */
  const locked = mock && expired;

  const question = questions[index];
  const answered = useMemo(
    () => questions.filter((entry) => (answers[entry.id] ?? "").trim().length > 0).length,
    [answers, questions],
  );

  const setAnswer = useCallback((id: string, value: string) => {
    setAnswers((previous) => ({ ...previous, [id]: value }));
  }, []);

  /**
   * The browser's own "are you sure" for a tab close or a reload.
   *
   * Registered only while there is something to lose. A page that fights every
   * navigation is a page people learn to click through without reading, which
   * is worse than not asking — the warning has to be rare to be heard.
   */
  useEffect(() => {
    if (answered === 0 || reviewing) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [answered, reviewing]);

  if (reviewing) {
    return (
      <ReviewScreen
        questions={questions}
        answers={answers}
        expired={expired}
        locked={locked}
        clock={clock}
        submitting={submitting}
        submitError={submitError}
        onJump={(target) => {
          setIndex(target);
          setReviewing(false);
        }}
        onBack={() => setReviewing(false)}
        onSubmit={() => onSubmit(answers)}
      />
    );
  }

  if (!question) return null;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-ink-subtle tabular-nums">
          Question {index + 1} of {questions.length}
        </p>

        {/* Segmented, one block per question, rather than one continuous bar.
            A bar says how far through you are; this says which ones are still
            blank, which is the thing worth knowing with four minutes left. */}
        <div className="flex min-w-0 flex-1 gap-0.5" aria-hidden>
          {questions.map((entry, position) => (
            <span
              key={entry.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                position === index
                  ? "bg-ink"
                  : (answers[entry.id] ?? "").trim()
                    ? "bg-accent"
                    : "bg-surface-sunken",
              )}
            />
          ))}
        </div>

        <p className="text-sm text-ink-subtle tabular-nums">
          {answered}/{questions.length} answered
        </p>

        {clock}
      </div>

      <div className="flex flex-1 flex-col rounded-[var(--radius-canvas)] border border-rule bg-surface px-5 py-7 shadow-[var(--shadow-card)] sm:px-8 sm:py-9">
        <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col gap-6">
          <div>
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-surface-sunken px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-muted uppercase">
              {TYPE_LABEL[question.type]}
            </span>
            <h2 className="mt-3 font-display text-xl leading-snug font-semibold tracking-[-0.015em] text-balance sm:text-2xl">
              {question.prompt}
            </h2>
          </div>

          <AnswerField
            /* Keyed on the question, so moving between them does not carry a
               stale uncontrolled value across. */
            key={question.id}
            question={question}
            value={answers[question.id] ?? ""}
            onChange={(value) => setAnswer(question.id, value)}
          />

          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
            <Button
              variant="subtle"
              disabled={index === 0}
              onClick={() => setIndex((previous) => previous - 1)}
            >
              <ArrowLeft aria-hidden />
              Back
            </Button>

            {/* Skipping is allowed and is not framed as failure. An unanswered
                question is a decision a student is entitled to make. */}
            {index === questions.length - 1 ? (
              <Button onClick={() => setReviewing(true)}>
                <ListChecks aria-hidden />
                Review answers
              </Button>
            ) : (
              <Button onClick={() => setIndex((previous) => previous + 1)}>
                {(answers[question.id] ?? "").trim() ? "Next" : "Skip"}
                <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onExit(answered > 0)}
          className="text-xs text-ink-subtle transition-colors hover:text-ink"
        >
          Leave this quiz
        </button>
        <p className="text-xs text-ink-subtle">Nothing is marked until you finish.</p>
      </div>
    </div>
  );
}

/**
 * The last screen before handing in.
 *
 * **Every question, with its state, and a way back to any of them.** This is
 * where "question navigation" stops being a Next button and becomes something
 * a student can act on: the blanks are listed, counted, and one click away.
 * Sprint 52 puts Submit here, which is why it exists now rather than being
 * bolted on later.
 */
function ReviewScreen({
  questions,
  answers,
  expired,
  locked,
  clock,
  submitting,
  submitError,
  onJump,
  onBack,
  onSubmit,
}: {
  questions: QuizQuestion[];
  answers: Answers;
  expired: boolean;
  /** A mock exam past its time: nothing may be changed, only handed in. */
  locked: boolean;
  /** The countdown keeps running here — review is not a pause button. */
  clock: React.ReactNode;
  submitting: boolean;
  submitError: string | null;
  onJump: (index: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const blanks = questions.filter((entry) => !(answers[entry.id] ?? "").trim());

  return (
    <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col gap-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold tracking-[-0.015em]">Your answers</h2>
          {!expired && clock}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          {locked
            ? "Time is up. Your paper has been handed in exactly as it stood."
            : expired
              ? "Time is up. Nothing was marked — here is what you had."
              : blanks.length === 0
                ? "Everything is answered. Check anything you want to change before you hand it in."
                : `${blanks.length} ${blanks.length === 1 ? "question is" : "questions are"} still blank.`}
        </p>
      </div>

      <ol className="flex flex-col gap-1.5">
        {questions.map((question, position) => {
          const given = (answers[question.id] ?? "").trim();
          return (
            <li key={question.id}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onJump(position)}
                className="flex w-full items-start gap-3 rounded-[var(--radius-control)] border border-rule bg-surface px-4 py-3 text-left transition-colors hover:border-rule-strong hover:bg-surface-sunken disabled:pointer-events-none"
              >
                <span className="mt-0.5 w-6 shrink-0 text-xs text-ink-subtle tabular-nums">
                  {position + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem]">{question.prompt}</span>
                  <span
                    className={cn(
                      "mt-0.5 block truncate text-xs",
                      given ? "text-ink-muted" : "text-warn",
                    )}
                  >
                    {given || "Not answered"}
                  </span>
                </span>
                {given ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {submitError && (
        <p role="alert" className="text-sm text-bad">
          {submitError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {locked ? (
          /* Nothing to go back to — but a failed hand-in must still be
             retryable, so the Submit button below stays. */
          <span />
        ) : (
          <Button variant="subtle" disabled={submitting} onClick={onBack}>
            <ArrowLeft aria-hidden />
            Back to the questions
          </Button>
        )}

        {/* **Blanks do not block it.** A student who decided not to answer four
            questions has made a decision, and a Submit that refused until every
            box was full would force guesses — worse data than a blank and worse
            revision than an honest gap. The count above already says what is
            missing. */}
        <Button disabled={submitting} onClick={onSubmit}>
          <Check aria-hidden />
          {submitting ? "Marking…" : "Hand it in"}
        </Button>
      </div>
    </div>
  );
}

/** The four types, as things to ANSWER rather than things to mark. */
function AnswerField({
  question,
  value,
  onChange,
}: {
  question: QuizQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  if (question.type === "mcq" || question.type === "true_false") {
    const choices = question.type === "true_false" ? ["True", "False"] : question.choices;

    return (
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Your answer">
        {choices.map((choice) => {
          const chosen = choice === value;
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={chosen}
              /* Clicking the chosen option again clears it. Without this a
                 student who answers by accident can never get back to blank,
                 and "I do not know" stops being expressible. */
              onClick={() => onChange(chosen ? "" : choice)}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-control)] border px-4 py-3.5 text-left text-[0.9375rem] transition-all sm:text-base",
                chosen
                  ? "border-accent bg-accent-soft"
                  : "border-rule hover:-translate-y-px hover:border-rule-strong hover:bg-surface-sunken",
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  chosen ? "border-accent bg-accent" : "border-rule-strong",
                )}
                aria-hidden
              >
                {chosen && <span className="size-1.5 rounded-full bg-on-accent" />}
              </span>
              <span className="flex-1">{choice}</span>
              {chosen && (
                <X className="size-3.5 shrink-0 text-ink-subtle" aria-label="Clear this answer" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "short_answer") {
    return (
      <Textarea
        value={value}
        rows={5}
        autoFocus
        aria-label="Your answer"
        placeholder="One or two sentences."
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <Input
      value={value}
      autoFocus
      autoComplete="off"
      aria-label="Your answer"
      placeholder="Your answer"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * The countdown.
 *
 * **Quiet until it matters.** A clock ticking in red from minute one is a
 * stress machine; this is plain text until the last minute, then it turns and
 * says so.
 *
 * **Display only — it owns no time.** The deadline is an absolute timestamp
 * fixed when the sitting began, so this component can mount, unmount and
 * remount (it does, every time the review screen swaps in) without the clock
 * moving. Each tick compares against the real clock, so a backgrounded tab —
 * where browsers throttle timers — shows the truth when it comes back.
 *
 * `onExpire` is read through a ref. The caller passes a fresh function every
 * render, and depending on it directly is what used to restart the whole
 * countdown on every keystroke.
 */
function Timer({
  deadline,
  totalSeconds,
  onExpire,
}: {
  deadline: number;
  totalSeconds: number;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expire = useRef(onExpire);

  useEffect(() => {
    expire.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) expire.current();
    };

    /* The first reading straight away rather than a second from now, so a
       remount after the review screen does not flash the full limit. Deferred
       a tick because a synchronous setState in an effect body is exactly what
       the React Compiler lint forbids. */
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [deadline]);

  const urgent = remaining <= 60;

  return (
    <p
      /* Polite, not assertive: a countdown that interrupts a screen reader
         every second would make the quiz unusable. */
      role="timer"
      aria-live="off"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm tabular-nums",
        urgent ? "font-medium text-bad" : "text-ink-subtle",
      )}
    >
      <Clock className="size-3.5" aria-hidden />
      {Math.floor(remaining / 3600) > 0 ? `${Math.floor(remaining / 3600)}:` : ""}
      {String(Math.floor((remaining % 3600) / 60)).padStart(remaining >= 3600 ? 2 : 1, "0")}:
      {String(remaining % 60).padStart(2, "0")}
    </p>
  );
}

const TYPE_LABEL: Record<QuizQuestion["type"], string> = {
  mcq: "Multiple choice",
  true_false: "True or false",
  identification: "Identification",
  short_answer: "Short answer",
};
