"use client";

import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { type PracticeQuestion } from "@/server/practice/queries";

/**
 * A practice run (FR-C2, US-F3, Sprint 45).
 *
 * **Nothing is saved, and the page says so.** A student answering questions to
 * learn the material is not sitting an exam, and quietly recording their first
 * pass would build a score history out of their worst attempt — in a product
 * whose entire claim is that its numbers mean something. Graded attempts arrive
 * in Sprint 49; this is deliberately session-local.
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

export function PracticeSession({ questions }: { questions: PracticeQuestion[] }) {
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
  const [results, setResults] = useState<Verdict[]>([]);

  const question = questions[index];
  const finished = index >= questions.length;

  function restart() {
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
    setResults((previous) => [...previous, verdict]);
    setIndex((previous) => previous + 1);
    setGiven("");
    setRevealed(false);
    setVerdict(null);
  }

  if (finished) {
    const correct = results.filter((result) => result === "correct").length;
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
            {correct === results.length
              ? "All of them. Come back to this set in a few days and see whether it holds."
              : "Read the explanations on the ones you missed, then go again."}
          </p>
          <p className="mt-3 text-xs text-ink-subtle">
            Practice is not recorded — this does not affect your progress.
          </p>
        </div>
        <Button onClick={restart}>
          <RotateCcw aria-hidden />
          Go again
        </Button>
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
          {results.filter((result) => result === "correct").length} correct
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-5 rounded-[var(--radius-card)] border border-rule bg-surface px-6 py-6 shadow-[var(--shadow-card)] sm:px-8 sm:py-7">
        <div>
          <p className="text-xs tracking-[0.08em] text-ink-subtle uppercase">
            {TYPE_LABEL[question.type]}
          </p>
          <h2 className="mt-2 font-display text-lg leading-snug font-semibold tracking-[-0.01em] sm:text-xl">
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

        <div className="mt-auto flex items-center justify-end pt-1">
          <Button onClick={next} disabled={!verdict}>
            {index === questions.length - 1 ? "See how you did" : "Next"}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>

      <p className="text-center text-xs text-ink-subtle">
        Practice only — nothing here is recorded against your progress.
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
              "flex items-center gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-left text-[0.9375rem] transition-colors",
              !locked && "border-rule hover:border-rule-strong hover:bg-surface-sunken",
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
