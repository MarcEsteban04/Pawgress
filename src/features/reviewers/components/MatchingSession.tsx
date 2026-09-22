"use client";

import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonStyles } from "@/components/ui";
import { shufflePairs, type MatchPair } from "@/features/reviewers/matching";
import { recordStudySessionAction } from "@/features/study/server/actions";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { cn } from "@/lib/utils";

/**
 * Matching type (Sprint 49).
 *
 * **Answered blind, marked at the end.** The first version marked every pairing
 * as it was made, which meant a student could tap answers until one turned
 * green — and a board you can brute-force scores everybody the same. Nothing is
 * revealed until the last pair is placed, so the only route to a good score is
 * knowing the terms, which is what the score was supposed to mean.
 *
 * **One definition at a time, and the choice is final.** A whole board on screen
 * let a student do the easy pairs first and leave the rest to elimination.
 * Stepping through them removes that; locking each pick removes the other half.
 * There is deliberately no undo: with nothing revealed it would change no score,
 * and would only invite second-guessing a test that is meant to be one.
 *
 * **Terms are spent, exactly as on paper.** Each matches one definition, so
 * picking it takes it out of the bank. One mistake therefore costs two marks —
 * the definition it was wrong for, and the one it was right for — which is
 * inherent to the format rather than a flaw in it. The results screen shows the
 * swap, instead of leaving a student to work out why two went red.
 *
 * **The bank shrinks as it goes**, which is the natural shape of a matching
 * test: hardest at the start when nothing has been given away, and a short tail
 * the student has already earned.
 */

export function MatchingSession({
  clues,
  answerBank,
  reviewerId,
  subjectId,
  topicId,
  colorSlot,
}: {
  /** The definitions, in the order they are asked. Shuffled by the server. */
  clues: MatchPair[];
  /** The same pairs in a DIFFERENT order — the bank of terms to pick from. */
  answerBank: MatchPair[];
  reviewerId: string;
  subjectId: string;
  topicId: string | null;
  colorSlot: 1 | 2 | 3 | 4 | 5;
}) {
  const tone = SUBJECT_TONE[colorSlot];

  /**
   * Both orders are state rather than derived, because "go again" reshuffles
   * them. That happens long after hydration, so it cannot disagree with the
   * server the way a shuffle on mount would — see the page for why that matters.
   */
  const [order, setOrder] = useState(clues);
  const [bank, setBank] = useState(answerBank);

  const [step, setStep] = useState(0);
  /** Which term was assigned to which definition. The answer sheet. */
  const [picks, setPicks] = useState<Record<string, string>>({});

  const startedAt = useRef(0);
  const recorded = useRef(false);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const current = order[step];
  const finished = step >= order.length;
  const used = new Set(Object.values(picks));

  function restart() {
    /* A second pass is a second session, timed and scored from now, and dealt
       differently — replaying the same order would be a memory test. */
    startedAt.current = Date.now();
    recorded.current = false;
    setOrder(shufflePairs(order));
    setBank(shufflePairs(bank));
    setStep(0);
    setPicks({});
  }

  function pick(answer: MatchPair) {
    if (!current || used.has(answer.id)) return;

    const next = { ...picks, [current.id]: answer.id };
    setPicks(next);
    setStep((previous) => previous + 1);

    /**
     * Recorded when the LAST definition is answered, from inside the handler
     * that knows it was the last — not from an effect watching `finished`,
     * which would fire again on every re-render of the results.
     *
     * Its own activity, not `practice`: this is recognition against a bank of
     * terms on screen, not answering a question cold, and only practice is
     * allowed to move topic mastery. Not `review` either — that means revision
     * with nothing measured, and this has a score.
     */
    if (Object.keys(next).length === order.length && !recorded.current) {
      recorded.current = true;
      void recordStudySessionAction({
        activity: "matching",
        subjectId,
        topicId,
        reviewerId,
        total: order.length,
        correct: order.filter((pair) => next[pair.id] === pair.id).length,
        durationSeconds: elapsedSince(startedAt.current),
      });
    }
  }

  if (finished) {
    const correct = order.filter((pair) => picks[pair.id] === pair.id).length;

    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="text-center">
          <p className="font-display text-5xl font-semibold tracking-[-0.03em] tabular-nums">
            {correct}
            <span className="text-ink-subtle">/{order.length}</span>
          </p>
          {/* A bare fraction is a number with no unit. Saying what was counted
              is what makes this a matching result rather than a score that
              could have come from any screen in the app. */}
          <p className="mt-1 text-sm font-medium">
            {correct === 1 ? "1 pair" : `${correct} pairs`} matched correctly
            {correct < order.length &&
              ` · ${order.length - correct} ${order.length - correct === 1 ? "pair" : "pairs"} wrong`}
          </p>
          <p className="mx-auto mt-2 max-w-[32rem] text-sm text-ink-muted">
            {correct === order.length
              ? "Every one. These terms are yours — the practice questions will be a better use of the next ten minutes."
              : "The rows in red are the pairs to read again. A term picked for the wrong definition also went missing from the right one, so mistakes here usually come in twos."}
          </p>
        </div>

        {/* The whole answer sheet, right and wrong together. A score with no
            paper behind it tells a student they were wrong four times and not
            which four, which is the version of this that teaches nothing. */}
        <ol className="mx-auto flex w-full max-w-[52rem] flex-col gap-2">
          {order.map((pair) => {
            const chosen = bank.find((candidate) => candidate.id === picks[pair.id]);
            const right = chosen?.id === pair.id;

            return (
              <li
                key={pair.id}
                className={cn(
                  "flex flex-col gap-2 rounded-[var(--radius-control)] border px-4 py-3 sm:flex-row sm:items-start sm:gap-4",
                  right ? "border-ok/30 bg-ok-soft" : "border-bad/30 bg-bad-soft",
                )}
              >
                <span className="mt-0.5 shrink-0">
                  {right ? (
                    <Check className="text-ok size-4" aria-hidden />
                  ) : (
                    <X className="size-4 text-bad" aria-hidden />
                  )}
                  <span className="sr-only">{right ? "Correct" : "Wrong"}</span>
                </span>

                <span className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed">{pair.clue}</span>

                <span className="flex shrink-0 flex-col gap-0.5 text-sm sm:w-56 sm:text-right">
                  <span className={cn("font-medium", !right && "text-bad line-through")}>
                    {chosen?.answer ?? "—"}
                  </span>
                  {/* Only when they differ. Printing the right answer beside a
                      right answer is noise on every row that went well. */}
                  {!right && <span className="font-medium">{pair.answer}</span>}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={restart}>
            <RotateCcw aria-hidden />
            Go again
          </Button>
          <Link
            href={`/reviewers/${reviewerId}/practice`}
            className={buttonStyles({ variant: "subtle" })}
          >
            Practice questions
          </Link>
        </div>

        <p className="text-center text-xs text-ink-subtle">
          Saved to your progress as a matching session, with this score. It does not move your
          mastery percentage — only answering questions does.
        </p>
      </div>
    );
  }

  if (!current) return null;

  const remaining = bank.filter((pair) => !used.has(pair.id));

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-3">
        <p className="tabular text-sm text-ink-subtle">
          {step + 1} of {order.length}
        </p>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className={cn("h-full rounded-full transition-[width] duration-300", tone.dot)}
            style={{ width: `${(step / order.length) * 100}%` }}
          />
        </div>
        <p className="tabular text-sm text-ink-subtle">{remaining.length} left</p>
      </div>

      <div className="flex flex-1 flex-col rounded-[var(--radius-canvas)] border border-rule bg-surface px-5 py-7 shadow-[var(--shadow-card)] sm:px-8 sm:py-9">
        <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col gap-6">
          <div>
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-surface-sunken px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-muted uppercase">
              {current.kind === "term" ? "Key term" : "Concept"}
            </span>
            <h2 className="mt-3 font-display text-xl leading-snug font-semibold tracking-[-0.015em] text-balance sm:text-2xl">
              {current.clue}
            </h2>
          </div>

          {/* Two columns rather than one: with a dozen terms to scan, one per
              row is a page of scrolling for every single definition. */}
          <div className="grid gap-2 sm:grid-cols-2">
            {remaining.map((pair) => (
              <button
                key={pair.id}
                type="button"
                onClick={() => pick(pair)}
                className="flex items-center gap-3 rounded-[var(--radius-control)] border border-rule px-4 py-3.5 text-left text-[0.9375rem] font-medium transition-all hover:-translate-y-px hover:border-rule-strong hover:bg-surface-sunken hover:shadow-[var(--shadow-pill)] sm:text-base"
              >
                <span className="flex-1">{pair.answer}</span>
                <ArrowRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
              </button>
            ))}
          </div>

          {/* What has been spent, so the bank visibly shrinks without any of it
              being marked. */}
          {used.size > 0 && (
            <div className="mt-auto border-t border-rule pt-4">
              <p className="text-xs font-semibold tracking-[0.08em] text-ink-subtle uppercase">
                Already used
              </p>
              <p className="mt-1.5 text-sm text-ink-subtle">
                {bank
                  .filter((pair) => used.has(pair.id))
                  .map((pair) => pair.answer)
                  .join(" · ")}
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-ink-subtle">
        Each term matches one definition, and a pick is final. Nothing is marked until the end.
      </p>
    </div>
  );
}

/** Seconds since the clock started, or 0 if it never did. */
function elapsedSince(startedAt: number): number {
  return startedAt === 0 ? 0 : Math.round((Date.now() - startedAt) / 1000);
}
