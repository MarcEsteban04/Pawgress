"use client";

import { Check, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonStyles } from "@/components/ui";
import { MATCH_ROUND_SIZE, shufflePairs, type MatchPair } from "@/features/reviewers/matching";
import { recordStudySessionAction } from "@/features/study/server/actions";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { cn } from "@/lib/utils";

/**
 * Matching type (Sprint 49).
 *
 * **Recognition, which is the one thing flashcards and practice both skip.** A
 * flashcard asks you to produce the answer with nothing to go on; a multiple
 * choice hands you four options for one question. Matching sits between them:
 * six definitions, six terms, and every wrong pairing costs you a pairing
 * somewhere else. It is the format that catches the student who knows five
 * terms and has quietly swapped two of them.
 *
 * **Pick a clue, then pick an answer.** Not drag and drop: dragging is a
 * gesture that fails on a phone, needs a fallback for the keyboard, and buys
 * nothing here — two taps say the same thing and work everywhere. The selected
 * clue stays lit so there is never a question of what the next tap applies to.
 *
 * **A wrong pair is shown and then forgiven.** It flashes, clears, and the
 * board stays put. The alternative — locking a wrong answer in — turns one
 * mistake into two, because the term it stole is now missing from somewhere
 * else, and a student cannot tell which of the two errors was theirs.
 *
 * **Scored on first attempt, not on finishing.** Everyone finishes a matching
 * board eventually; process of elimination guarantees it. The number worth
 * recording is how many were right the first time they were tried, which is the
 * only part that reflects what the student knew when they sat down.
 */

type Status = "idle" | "wrong";

export function MatchingSession({
  pairs,
  reviewerId,
  reviewerTitle,
  subjectId,
  topicId,
  colorSlot,
}: {
  /** Already shuffled by the server — see `matching.ts`. */
  pairs: MatchPair[];
  reviewerId: string;
  reviewerTitle: string;
  subjectId: string;
  topicId: string | null;
  colorSlot: 1 | 2 | 3 | 4 | 5;
}) {
  const tone = SUBJECT_TONE[colorSlot];

  /**
   * The board, and the answer column beside it.
   *
   * Two independent orders on purpose: a board where the third clue's answer is
   * also third is a board that can be solved without reading either column.
   * Both are state rather than memos because "go again" reshuffles them, and
   * that is a deliberate act rather than a render.
   */
  const [round, setRound] = useState(0);
  const [board, setBoard] = useState<MatchPair[]>(() => pairs.slice(0, MATCH_ROUND_SIZE));
  const [answers, setAnswers] = useState<MatchPair[]>(() =>
    shufflePairs(pairs.slice(0, MATCH_ROUND_SIZE)),
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  /**
   * Clues that have ever had a wrong answer tried against them, across every
   * round of this run. The inverse of the score.
   *
   * Keyed by CLUE and kept for the whole run rather than reset per tap: a
   * student who guesses wrong, goes off to pair something else, and comes back
   * to get it right has still not known it. Tracking "was the last tap wrong"
   * instead would forgive exactly that, which is the commonest way of playing
   * a matching board.
   */
  const [missedOnce, setMissedOnce] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  /** Which answer flashed red, so only that one lights up. */
  const [rejected, setRejected] = useState<string | null>(null);

  const startedAt = useRef(0);
  const recorded = useRef(false);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const rounds = Math.ceil(pairs.length / MATCH_ROUND_SIZE);
  const finished = matched.length === board.length && board.length > 0;
  const isLastRound = round >= rounds - 1;

  function deal(next: number) {
    const slice = pairs.slice(next * MATCH_ROUND_SIZE, (next + 1) * MATCH_ROUND_SIZE);
    setRound(next);
    setBoard(slice);
    setAnswers(shufflePairs(slice));
    setSelected(null);
    setMatched([]);
    setStatus("idle");
    setRejected(null);
  }

  function restart() {
    /* A second pass is a second session, timed and scored from now. */
    startedAt.current = Date.now();
    recorded.current = false;
    setMissedOnce([]);
    deal(0);
  }

  function choose(answer: MatchPair) {
    if (!selected || matched.includes(answer.id)) return;

    if (answer.id === selected) {
      const nextMatched = [...matched, answer.id];

      setMatched(nextMatched);
      setSelected(null);
      setStatus("idle");
      setRejected(null);

      /**
       * Recorded when the LAST pair of the LAST round is matched, from inside
       * the handler that knows it was the last — not from an effect watching
       * `finished`, which would fire again on every re-render of the summary.
       *
       * `review` rather than `practice`: this is recall over the reviewer's own
       * terms, not answering questions, and only practice is allowed to move
       * topic mastery. Folding self-evident recognition into a mastery
       * percentage is the "mastery misleads students" risk in the register.
       */
      if (nextMatched.length === board.length && isLastRound && !recorded.current) {
        recorded.current = true;
        void recordStudySessionAction({
          activity: "review",
          subjectId,
          topicId,
          reviewerId,
          total: pairs.length,
          correct: pairs.length - missedOnce.length,
          durationSeconds: elapsedSince(startedAt.current),
        });
      }
      return;
    }

    /* Wrong. Shown, then forgiven — the board does not change, and the only
       lasting cost is that this clue no longer counts toward the score. */
    setStatus("wrong");
    setRejected(answer.id);
    setMissedOnce((previous) => (previous.includes(selected) ? previous : [...previous, selected]));
  }

  if (finished && isLastRound) {
    const firstTime = pairs.length - missedOnce.length;

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div>
          <p className="font-display text-5xl font-semibold tracking-[-0.03em] tabular-nums">
            {firstTime}
            <span className="text-ink-subtle">/{pairs.length}</span>
          </p>
          <p className="mt-2 max-w-[28rem] text-sm text-ink-muted">
            {firstTime === pairs.length
              ? "Every pair first time. These terms are yours — the practice questions will be a better use of the next ten minutes."
              : `First time on ${firstTime} of ${pairs.length}. The ones that took a second guess are the ones to read again in the reviewer.`}
          </p>
          <p className="mt-3 max-w-[28rem] text-xs text-ink-subtle">
            Saved to your progress as revision. Matching does not move your mastery score — only
            answering questions does.
          </p>
        </div>

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
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="tabular text-sm text-ink-subtle">
          {rounds > 1 ? `Round ${round + 1} of ${rounds} · ` : ""}
          {matched.length} of {board.length} paired
        </p>
        <div className="h-1 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className={cn("h-full rounded-full transition-[width] duration-300", tone.dot)}
            style={{ width: `${(matched.length / Math.max(1, board.length)) * 100}%` }}
          />
        </div>
        <p className="text-sm text-ink-subtle" role="status">
          {selected ? "Now pick its match" : "Pick a definition"}
        </p>
      </div>

      <div className="grid flex-1 gap-3 md:grid-cols-2 md:gap-5">
        {/* Clues. The long side, so it gets the first column on a wide screen
            and the top on a narrow one — you read before you choose. */}
        <ul className="flex flex-col gap-2.5">
          {board.map((pair) => {
            const done = matched.includes(pair.id);
            const active = selected === pair.id;

            return (
              <li key={pair.id}>
                <button
                  type="button"
                  disabled={done}
                  aria-pressed={active}
                  onClick={() => {
                    setSelected(active ? null : pair.id);
                    setStatus("idle");
                    setRejected(null);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-left text-[0.9375rem] leading-relaxed transition-all",
                    done && "border-rule bg-surface-sunken text-ink-subtle",
                    !done &&
                      !active &&
                      "border-rule bg-surface hover:-translate-y-px hover:border-rule-strong hover:shadow-[var(--shadow-pill)]",
                    active && "border-transparent shadow-[var(--shadow-pop)]",
                    active && tone.tint,
                  )}
                >
                  <span className="flex-1">{pair.clue}</span>
                  {done && <Check className="text-ok mt-0.5 size-4 shrink-0" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Answers. Short, so they sit as a column of pills rather than blocks. */}
        <ul className="flex flex-col gap-2.5 md:sticky md:top-0 md:self-start">
          {answers.map((pair) => {
            const done = matched.includes(pair.id);
            const wrong = rejected === pair.id;

            return (
              <li key={pair.id}>
                <button
                  type="button"
                  disabled={done || !selected}
                  onClick={() => choose(pair)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-left font-medium transition-all",
                    done && cn("border-transparent", tone.tint, tone.ink),
                    wrong && "shake border-bad/50 bg-bad-soft text-bad",
                    !done && !wrong && "border-rule bg-surface",
                    !done &&
                      !wrong &&
                      selected &&
                      "hover:-translate-y-px hover:border-rule-strong hover:shadow-[var(--shadow-pill)]",
                    /* Dimmed rather than hidden while nothing is selected: the
                       answers are half the information on this board, and a
                       student reads both columns before the first tap. */
                    !done && !selected && "opacity-70",
                  )}
                >
                  <span className="flex-1">{pair.answer}</span>
                  {done && <Check className="size-4 shrink-0" aria-hidden />}
                  {wrong && <X className="size-4 shrink-0" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Between rounds. A board that dealt itself would move under the hand of
          a student still looking at the pair they just got. */}
      {finished && !isLastRound && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <p className="text-sm text-ink-muted">Round {round + 1} done.</p>
          <Button onClick={() => deal(round + 1)}>Next round</Button>
        </div>
      )}

      <p className="text-center text-xs text-ink-subtle">
        {status === "wrong"
          ? "Not that one. Nothing is locked in — try another."
          : `Matching the ${reviewerTitle} key terms. A wrong pair costs you nothing but the first-time score.`}
      </p>
    </div>
  );
}

/** Seconds since the clock started, or 0 if it never did. */
function elapsedSince(startedAt: number): number {
  return startedAt === 0 ? 0 : Math.round((Date.now() - startedAt) / 1000);
}
