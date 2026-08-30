"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { resetFlashcardsAction, reviewFlashcardAction } from "@/features/flashcards/server/actions";
import { type Flashcard } from "@/server/flashcards/queries";

/**
 * A flashcard session (FR-R2, US-F2, Sprint 44).
 *
 * **One card, filling the screen, and nothing else.** A grid of cards is a
 * document; a deck you can scroll ahead in is a document you have already read.
 * Recall only works if the answer is genuinely not visible when the question
 * is, so the session shows exactly one card and no way to skim.
 *
 * **The whole deck is in memory and answers are written in the background.** A
 * card that waits for a round trip before flipping is a card a student stops
 * using — this is a keyboard-speed interaction, and the local state is the
 * source of truth for the session. Writes are fire-and-forget; the worst
 * failure is one answer not counted, and stopping the session to report it
 * would cost more than it saves.
 *
 * Keyboard first: space flips, 1 and 2 answer. Students do a hundred of these
 * in a sitting, and a hundred mouse trips is the reason they stop.
 */

type Answer = "known" | "unknown";

export function FlashcardSession({
  cards,
  reviewerId,
  reviewerTitle,
}: {
  cards: Flashcard[];
  reviewerId: string;
  reviewerTitle: string;
}) {
  const router = useRouter();

  /**
   * Shuffled once per mount.
   *
   * Order is a crutch: a deck learned in sequence is a deck where the third
   * card is remembered because it followed the second. Shuffling breaks that,
   * and a `useMemo` keyed on the deck means it happens when the deck arrives
   * rather than on every render — which would reshuffle under a student
   * mid-card.
   */
  const deck = useMemo(() => shuffle(cards), [cards]);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const card = deck[index];
  const finished = index >= deck.length;

  const answer = useCallback(
    (value: Answer) => {
      const current = deck[index];
      if (!current) return;

      setAnswers((previous) => [...previous, value]);
      setIndex((previous) => previous + 1);
      setRevealed(false);

      /* Not awaited, and not in a transition. The next card is already on
         screen; a pending state here would only put a spinner over a card the
         student is reading. */
      void reviewFlashcardAction(current.id, value === "known");
    },
    [deck, index],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea")) return;
      if (finished) return;

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        /* Space flips, and once flipped does nothing. Making space also mean
           "known" would let someone tap through a deck and be told they knew
           all of it. */
        setRevealed(true);
        return;
      }

      if (!revealed) return;

      if (event.key === "1" || event.key === "ArrowLeft") {
        event.preventDefault();
        answer("unknown");
      } else if (event.key === "2" || event.key === "ArrowRight") {
        event.preventDefault();
        answer("known");
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, finished, revealed]);

  if (finished) {
    return (
      <SessionSummary
        known={answers.filter((value) => value === "known").length}
        total={deck.length}
        reviewerId={reviewerId}
        onAgain={() => {
          setIndex(0);
          setAnswers([]);
          setRevealed(false);
        }}
        onReset={() => router.refresh()}
      />
    );
  }

  if (!card) return null;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-ink-subtle tabular-nums">
          {index + 1} of {deck.length}
        </p>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${(index / deck.length) * 100}%` }}
          />
        </div>
        <p className="text-sm text-ink-subtle tabular-nums">
          {answers.filter((value) => value === "known").length} known
        </p>
      </div>

      {/* The card is a button, not a div with a click handler: flipping is an
          action, and a keyboard user reaching it by tab should be told so by the
          browser rather than by an aria-label we remembered to write. */}
      <button
        type="button"
        onClick={() => setRevealed(true)}
        aria-label={revealed ? "Answer shown" : "Show the answer"}
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center gap-6 rounded-[var(--radius-card)] border border-rule bg-surface px-6 py-12 text-center shadow-[var(--shadow-card)] transition-colors",
          !revealed && "cursor-pointer hover:border-rule-strong",
        )}
      >
        <p className="max-w-[42rem] font-display text-xl leading-snug font-semibold tracking-[-0.01em] text-balance sm:text-2xl">
          {card.front}
        </p>

        {revealed ? (
          <>
            <span className="h-px w-16 bg-rule" aria-hidden />
            <p className="max-w-[38rem] text-[0.9375rem] leading-relaxed text-balance text-ink-muted sm:text-base">
              {card.back}
            </p>
          </>
        ) : (
          <span className="text-xs tracking-[0.08em] text-ink-subtle uppercase">
            Click or press space to reveal
          </span>
        )}

        {/* Only after the flip. Telling a student they got this right twice
            BEFORE they try again hands them the confidence without the recall. */}
        {revealed && card.timesSeen > 0 && (
          <span className="absolute top-4 right-5 text-xs text-ink-subtle tabular-nums">
            {card.timesKnown}/{card.timesSeen} correct so far
          </span>
        )}
      </button>

      {/* Held in the layout whether or not the card is flipped, so revealing
          does not shove the card upward under the reader's eyes. */}
      <div
        className={cn(
          "flex items-center justify-center gap-3 transition-opacity",
          revealed ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <Button variant="subtle" onClick={() => answer("unknown")} className="min-w-[10rem]">
          <X aria-hidden />
          Still learning
          <kbd className="ml-1 text-xs font-normal text-ink-subtle">1</kbd>
        </Button>
        <Button variant="primary" onClick={() => answer("known")} className="min-w-[10rem]">
          <Check aria-hidden />
          Got it
          <kbd className="ml-1 text-xs font-normal opacity-60">2</kbd>
        </Button>
      </div>

      <p className="text-center text-xs text-ink-subtle">
        {reviewerTitle} · space to flip, 1 and 2 to answer
      </p>
    </div>
  );
}

/**
 * The end of a session.
 *
 * **No praise and no grade.** "Great job!" over 6 out of 12 is the product
 * lying to someone about to sit an exam, and a red F on a first pass through new
 * material punishes them for learning. The number is the number, and the only
 * thing offered is the obvious next move.
 */
function SessionSummary({
  known,
  total,
  reviewerId,
  onAgain,
  onReset,
}: {
  known: number;
  total: number;
  reviewerId: string;
  onAgain: () => void;
  onReset: () => void;
}) {
  const [isResetting, setIsResetting] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div>
        <p className="font-display text-5xl font-semibold tracking-[-0.03em] tabular-nums">
          {known}
          <span className="text-ink-subtle">/{total}</span>
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          {known === total
            ? "Every card, first time. Come back tomorrow and see whether it holds."
            : `${total - known} still to learn. That is what a second pass is for.`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onAgain}>
          <RotateCcw aria-hidden />
          Go again
        </Button>
        <Button
          variant="subtle"
          disabled={isResetting}
          onClick={() => {
            /* Separate from "Go again", because they are different asks. Going
               again reshuffles the same deck; this throws away the record of
               ever having seen it, which is a decision rather than a
               convenience. */
            setIsResetting(true);
            void resetFlashcardsAction(reviewerId).then(onReset);
          }}
        >
          {isResetting ? "Clearing…" : "Clear my progress"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Fisher–Yates, on a copy.
 *
 * Written out rather than `sort(() => Math.random() - 0.5)`, which is not a
 * shuffle: it hands an inconsistent comparator to a sort that assumes one, and
 * leaves the first cards near the front often enough to notice on a 12-card
 * deck.
 */
function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
