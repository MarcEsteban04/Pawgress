"use client";

import { ArrowRight, Check, RotateCcw, Target, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, buttonStyles, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { recordStudySessionAction } from "@/features/study/server/actions";
import { type PracticeQuestion } from "@/server/practice/queries";

/**
 * A practice run (FR-C2, US-F3, Sprint 45).
 *
 * **A finished run IS recorded now, and the page says so.** It was
 * session-local on the argument that practice is not an exam — true, and it
 * left a student with no way to see that they had studied at all, which was
 * worse. What is recorded is what happened: how many questions, how many right,
 * how long it took, and WHICH ones were missed. A run is only recorded once it
 * is FINISHED — abandoning one at question two records nothing.
 *
 * **The verdicts are kept; the answers are not.** Storing which questions went
 * wrong is what makes "review my mistakes" possible at all, and it is the whole
 * of what that needs. What a student typed is never sent — see
 * `recordStudySessionAction`. The privacy line moved rather than disappeared,
 * and the summary screen says where it moved to.
 *
 * **`mode` changes the copy and nothing else.** A retry of four questions a
 * student already got wrong is the same interaction as a first pass, and
 * forking the component would be two screens to keep in step for the sake of a
 * heading. What it must not do is congratulate identically: "4/4" on a first
 * pass is a good set, and on a retry it is four mistakes cleared.
 *
 * Topic mastery moves only when the reviewer was scoped to a topic, because
 * that is the only case where "which topic is this evidence about" has an
 * answer. Graded, timed attempts are still Sprint 49's job.
 *
 * **Marked immediately, one question at a time.** Feedback delayed to the end
 * of a set is feedback nobody reads: the explanation for question three lands
 * when they have forgotten what they answered. The cost is that a student
 * cannot go back and change an answer, which is the right trade for practice
 * and the wrong one for a quiz.
 *
 * **Short answers are not marked by us at all.** Comparing a sentence to a
 * model answer with string matching is guessing dressed as grading: it marks
 * "mitochondrion" wrong against "mitochondria", and marks a one-word answer
 * right against a paragraph that happens to contain it. The model answer is
 * shown and the student says whether they had it. Identification IS compared —
 * it is one term, and leniently — but that can be overridden too, which is what
 * FR-Q7 will require of the graded version.
 */

type Verdict = "correct" | "incorrect";

export function PracticeSession({
  questions,
  quizId,
  reviewerId,
  subjectId,
  topicId,
  mode = "practice",
}: {
  questions: PracticeQuestion[];
  /** The set these came from. Null only if the set row could not be read. */
  quizId: string | null;
  reviewerId: string;
  subjectId: string;
  topicId: string | null;
  /** `review` is a retry of questions already missed — copy only. */
  mode?: "practice" | "review";
}) {
  const isReview = mode === "review";
  const router = useRouter();
  /**
   * When this run began, and whether it has been recorded.
   *
   * Refs, not state: neither must cause a render, and both must survive every
   * answer in between. Reset by "Go again", because a second pass is a second
   * session — timing it from the first would count however long the student
   * spent reading the explanations of the first.
   */
  /**
   * Zero until the screen is actually on, then set once from an effect.
   *
   * `useRef(Date.now())` reads the clock on EVERY render and throws all but
   * the first away — which the React Compiler lint rejects, correctly: an
   * impure call in render is a value that can change for reasons the component
   * did not ask for. Writing a ref from an effect is allowed and is the honest
   * moment anyway, because a session starts when the student can see it.
   */
  const startedAt = useRef(0);
  const recorded = useRef(false);
  /* The in-flight write, so "Go again" on a retry can wait for it before
     asking the server for a freshly derived list. Without this the refresh
     races the insert and hands back the list as it was. */
  const recording = useRef<Promise<void> | null>(null);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState("");
  /**
   * Answered, separately from marked.
   *
   * A short answer is revealed before it has a verdict — the student has not
   * said yet whether they had it. Folding the two into one flag would either
   * mark their answer for them or hide the model answer they need in order to
   * mark it themselves.
   */
  const [revealed, setRevealed] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  /* The verdict AND the question it was for, because the mistakes list is
     keyed by question — a bare list of rights and wrongs cannot say which. */
  const [results, setResults] = useState<{ questionId: string; verdict: Verdict }[]>([]);

  const question = questions[index];
  const finished = index >= questions.length;

  /**
   * On a retry, "go again" must ASK AGAIN rather than replay.
   *
   * The list this run was built from is stale the moment it finishes: three of
   * the four are cleared, and replaying all four would put a student back in
   * front of questions they have just got right. Refreshing re-derives it on
   * the server, which either hands back the shorter list or shows the empty
   * state — and the empty state on this route is the good ending.
   */
  async function again() {
    if (!isReview) {
      restart();
      return;
    }
    await recording.current;
    router.refresh();
  }

  function restart() {
    /* A second pass is a second session, timed from now. */
    startedAt.current = Date.now();
    recorded.current = false;
    setIndex(0);
    setGiven("");
    setRevealed(false);
    setVerdict(null);
    setResults([]);
  }

  function check(answer: string) {
    if (!question) return;
    setGiven(answer);
    setRevealed(true);
    /* Everything but a short answer gets a mark. A short answer gets none —
       see the header. */
    if (question.type !== "short_answer") {
      setVerdict(isCorrect(question, answer) ? "correct" : "incorrect");
    }
  }

  function next() {
    if (!verdict) return;

    const all = [...results, { questionId: question.id, verdict }];
    setResults(all);
    setIndex((previous) => previous + 1);
    setGiven("");
    setRevealed(false);
    setVerdict(null);

    /**
     * Recorded when the LAST question is answered, from inside the handler
     * that knows it was the last.
     *
     * Not from an effect watching `finished`: the React Compiler lint forbids
     * setState in effects, and an effect would fire again on every re-render
     * of the summary. This runs exactly once per completed run.
     *
     * Not awaited — the summary is already on screen, and a student who has
     * finished should not wait on our bookkeeping. The promise is kept only so
     * that "take what is left" can wait for it before asking the server for a
     * freshly derived mistakes list.
     */
    if (all.length === questions.length && !recorded.current) {
      recorded.current = true;
      recording.current = recordStudySessionAction({
        activity: "practice",
        subjectId,
        topicId,
        reviewerId,
        total: all.length,
        correct: all.filter((result) => result.verdict === "correct").length,
        durationSeconds: elapsedSince(startedAt.current),
        quizId,
        answers: all.map((result) => ({
          questionId: result.questionId,
          correct: result.verdict === "correct",
        })),
      });
    }
  }

  if (finished) {
    const correct = results.filter((result) => result.verdict === "correct").length;
    const missed = results.length - correct;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div>
          <p className="font-display text-5xl font-semibold tracking-[-0.03em] tabular-nums">
            {correct}
            <span className="text-ink-subtle">/{results.length}</span>
          </p>
          {/* The number, and what to do about it. No praise over half marks:
              this is a student about to sit an exam. */}
          <p className="mt-2 max-w-[26rem] text-sm text-ink-muted">
            {closingLine(mode, correct, results.length)}
          </p>
          <p className="mt-3 max-w-[26rem] text-xs text-ink-subtle">
            Saved to your progress. We keep which questions you missed so you can come back to them
            — never what you typed.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            onClick={() => void again()}
            variant={missed > 0 && !isReview ? "subtle" : "primary"}
          >
            <RotateCcw aria-hidden />
            {isReview ? "Take what is left" : "Go again"}
          </Button>

          {/* Straight to the ones just missed, rather than back to the reviewer
              to find the tile. The moment a student has seen what they got
              wrong is the moment they will fix it, if fixing it is one click. */}
          {missed > 0 && !isReview && (
            <Link href={`/reviewers/${reviewerId}/review`} className={buttonStyles()}>
              <Target aria-hidden />
              Review the {missed} you missed
            </Link>
          )}

          {isReview && (
            <Link href={`/reviewers/${reviewerId}`} className={buttonStyles({ variant: "subtle" })}>
              Back to the reviewer
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-3">
        <p className="text-sm text-ink-subtle tabular-nums">
          {index + 1} of {questions.length}
        </p>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${(index / questions.length) * 100}%` }}
          />
        </div>
        <p className="text-sm text-ink-subtle tabular-nums">
          {results.filter((result) => result.verdict === "correct").length} correct
        </p>
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

          {question.type === "mcq" || question.type === "true_false" ? (
            <Choices
              choices={question.type === "true_false" ? ["True", "False"] : question.choices}
              given={given}
              answer={question.answer}
              locked={revealed}
              onChoose={check}
            />
          ) : (
            <Written
              given={given}
              revealed={revealed}
              verdict={verdict}
              selfMark={question.type === "short_answer"}
              onChange={setGiven}
              onCheck={() => check(given)}
              onMark={setVerdict}
            />
          )}

          {revealed && (
            <div
              className={cn(
                "flex flex-col gap-2 rounded-[var(--radius-control)] border px-4 py-3",
                verdict === "correct" && "border-ok/30 bg-ok-soft",
                verdict === "incorrect" && "border-bad/30 bg-bad-soft",
                /* Neutral while a short answer waits to be marked. Colouring it
                 before the student has said whether they had it would be the
                 product making the call it just declined to make. */
                !verdict && "border-rule bg-surface-sunken",
              )}
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                {verdict === "correct" && <Check className="text-ok size-4 shrink-0" aria-hidden />}
                {verdict === "incorrect" && <X className="size-4 shrink-0 text-bad" aria-hidden />}
                {verdict === "correct" ? "Correct" : `Answer: ${question.answer}`}
              </p>
              {question.explanation && (
                <p className="text-[0.9375rem] leading-relaxed text-ink-muted">
                  {question.explanation}
                </p>
              )}
            </div>
          )}

          <div className="mt-auto flex items-center justify-end pt-2">
            <Button onClick={next} disabled={!verdict}>
              {index === questions.length - 1 ? "See how you did" : "Next"}
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-ink-subtle">
        Finish the set to save it to your progress. Leaving early records nothing.
      </p>
    </div>
  );
}

/**
 * Options, for the two types that have them.
 *
 * Once answered, the correct option is marked whether or not it was chosen. A
 * student who guessed wrong needs to see which one was right in the same glance
 * — telling them only that they were wrong is the version of this that teaches
 * nothing.
 */
function Choices({
  choices,
  given,
  answer,
  locked,
  onChoose,
}: {
  choices: string[];
  given: string;
  answer: string;
  locked: boolean;
  onChoose: (choice: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice) => {
        const isAnswer = choice.trim().toLowerCase() === answer.trim().toLowerCase();
        const isGiven = choice === given;

        return (
          <button
            key={choice}
            type="button"
            disabled={locked}
            onClick={() => onChoose(choice)}
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius-control)] border px-4 py-3.5 text-left text-[0.9375rem] transition-all sm:text-base",
              !locked &&
                "border-rule hover:-translate-y-px hover:border-rule-strong hover:bg-surface-sunken hover:shadow-[var(--shadow-pill)]",
              locked && isAnswer && "border-ok/40 bg-ok-soft",
              locked && isGiven && !isAnswer && "border-bad/40 bg-bad-soft",
              locked && !isAnswer && !isGiven && "border-rule opacity-50",
            )}
          >
            <span className="flex-1">{choice}</span>
            {locked && isAnswer && <Check className="text-ok size-4 shrink-0" aria-hidden />}
            {locked && isGiven && !isAnswer && (
              <X className="size-4 shrink-0 text-bad" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Identification and short answer: type it, then mark it. */
function Written({
  given,
  revealed,
  verdict,
  selfMark,
  onChange,
  onCheck,
  onMark,
}: {
  given: string;
  revealed: boolean;
  verdict: Verdict | null;
  selfMark: boolean;
  onChange: (value: string) => void;
  onCheck: () => void;
  onMark: (verdict: Verdict) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (given.trim() && !revealed) onCheck();
        }}
        className="flex gap-2"
      >
        <Input
          value={given}
          disabled={revealed}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Your answer"
          aria-label="Your answer"
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" variant="subtle" disabled={!given.trim() || revealed}>
          {selfMark ? "Show the answer" : "Check"}
        </Button>
      </form>

      {/* A short answer is marked here and nowhere else. */}
      {revealed && selfMark && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted">Did you have it?</span>
          <Button
            variant={verdict === "incorrect" ? "danger" : "subtle"}
            size="sm"
            onClick={() => onMark("incorrect")}
          >
            <X aria-hidden />
            Not quite
          </Button>
          <Button
            variant={verdict === "correct" ? "primary" : "subtle"}
            size="sm"
            onClick={() => onMark("correct")}
          >
            <Check aria-hidden />I had it
          </Button>
        </div>
      )}

      {/* An identification has already been marked; this is the override,
          offered both ways round, because a comparison crude enough to be wrong
          is crude enough to be wrong in either direction. */}
      {revealed && !selfMark && verdict && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
          <span>Not what you meant?</span>
          <button
            type="button"
            onClick={() => onMark(verdict === "correct" ? "incorrect" : "correct")}
            className="font-medium text-ink underline underline-offset-2 hover:text-accent"
          >
            {verdict === "correct" ? "Mark it wrong" : "I had it right"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * What to say at the end.
 *
 * A retry is scored against a different question. "3/4" on a first pass means a
 * decent set; on a retry it means three mistakes cleared and one still standing,
 * and that one is the only thing worth saying.
 */
function closingLine(mode: "practice" | "review", correct: number, total: number): string {
  const missed = total - correct;

  if (mode === "review") {
    if (missed === 0) {
      return total === 1
        ? "Cleared. That one is off your list."
        : "All of them, second time round. Your list is clear.";
    }
    return correct === 0
      ? "Still not sticking. Read the explanations properly, then try the deck or the reviewer itself — more of the same questions will not fix it."
      : `${correct} cleared, ${missed} still to get. The ones you missed again are still on your list.`;
  }

  return correct === total
    ? "All of them. Come back to this set in a few days and see whether it holds."
    : "Read the explanations on the ones you missed, then go again.";
}

const TYPE_LABEL: Record<PracticeQuestion["type"], string> = {
  mcq: "Multiple choice",
  true_false: "True or false",
  identification: "Identification",
  short_answer: "Short answer",
};

/**
 * Is this close enough?
 *
 * Choices are exact, because they were chosen from a list. An identification is
 * normalised — case, punctuation, a leading article — and then compared both
 * ways, so "the mitochondrion" matches "mitochondrion". That containment rule is
 * only safe because the expected value is ONE TERM; applied to a short answer it
 * would mark a single word right against a whole model sentence, which is why
 * short answers never reach this function.
 */
function isCorrect(question: PracticeQuestion, given: string): boolean {
  const expected = normalise(question.answer);
  const actual = normalise(given);
  if (!actual) return false;

  if (question.type === "mcq" || question.type === "true_false") return actual === expected;

  return actual === expected || expected.includes(actual) || actual.includes(expected);
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Seconds since the clock started, or 0 if it never did. */
function elapsedSince(startedAt: number): number {
  return startedAt === 0 ? 0 : Math.round((Date.now() - startedAt) / 1000);
}
