"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { resetFlashcardsAction, reviewFlashcardAction } from "@/features/flashcards/server/actions";
import { recordStudySessionAction } from "@/features/study/server/actions";
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
  subjectId,
  topicId,
}: {
  cards: Flashcard[];
  reviewerId: string;
  reviewerTitle: string;
  subjectId: string;
  topicId: string | null;
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

  /**
   * When this run began.
   *
   * A ref, not state: it must not cause a render, and it must survive every
   * flip and answer in between. Reset by "Go again", because a second pass is
   * a second session — recording it as one long sitting would inflate the
   * study time by however long the student left the tab open.
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
  /* Recorded once. A refresh or a re-render must not log the same run twice. */
  const recorded = useRef(false);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const card = deck[index];
  const finished = index >= deck.length;

  const answer = useCallback(
    (value: Answer) => {
      const current = deck[index];
      if (!current) return;

      const next = [...answers, value];
      setAnswers(next);
      setIndex((previous) => previous + 1);
      setRevealed(false);

      /**
       * The session is recorded when the LAST card is answered, from inside
       * the handler that knows it was the last.
       *
       * Not in an effect watching `finished`: the React Compiler lint forbids
       * setState in effects for good reasons, and an effect here would also
       * fire again on every re-render of the summary screen. The handler runs
       * exactly once per run, which is exactly how often this should happen.
       *
       * Fire-and-forget. A student who has finished a deck should not be made
       * to wait on our bookkeeping, and the summary is already on screen.
       */
      if (next.length === deck.length && !recorded.current) {
        recorded.current = true;
        void recordStudySessionAction({
          activity: "flashcards",
          subjectId,
          topicId,
          reviewerId,
          total: next.length,
          correct: next.filter((entry) => entry === "known").length,
          durationSeconds: elapsedSince(startedAt.current),
        });
      }

      /* Not awaited, and not in a transition. The next card is already on
         screen; a pending state here would only put a spinner over a card the
         student is reading. */
      void reviewFlashcardAction(current.id, value === "known");
    },
    [answers, deck, index, reviewerId, subjectId, topicId],
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
          /* A second pass is a second session, timed from now. */
          startedAt.current = Date.now();
          recorded.current = false;
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

      {/**
       * The flip.
       *
       * **Two faces on one sheet, rotated about Y.** The alternative — swapping
       * the text and cross-fading — is the animation a card does not have: a
       * flashcard has a back, and the gesture a student already knows is turning
       * it over. `preserve-3d` on the sheet and `backface-hidden` on each face
       * is what makes the far side genuinely hide rather than show through
       * mirrored.
       *
       * The perspective lives on the SCENE, not the sheet. On the sheet it is
       * applied per element and a wide card flattens out; on the parent, every
       * point of the card shares one vanishing point and it reads as one object
       * turning.
       *
       * **The question is on the back too**, smaller and quieter. A card that
       * hides what it asked leaves a student reading an answer to a question
       * they are trying to remember, which tests the wrong thing.
       *
       * The button is still a button — flipping is an action, and a keyboard
       * user arriving by tab should be told so by the browser. The global
       * `prefers-reduced-motion` rule collapses the transition, so the flip
       * becomes an instant cut for anyone who asked for that.
       */}
      <button
        type="button"
        onClick={() => setRevealed(true)}
        aria-label={revealed ? "Answer shown" : "Show the answer"}
        className={cn(
          "group relative flex min-h-0 flex-1 perspective-[1600px]",
          !revealed && "cursor-pointer",
        )}
      >
        {/**
         * Keyed on the card, and that key is doing real work.
         *
         * Answering advances the index AND clears `revealed` in the same
         * render. Without the key the same element would still be at 180deg and
         * would rotate BACK over two thirds of a second — showing the next
         * card's answer, face on, before its question. A flashcard that spoils
         * itself on the way in is worse than one with no animation at all.
         *
         * A new key mounts a new element, already at 0deg, so there is nothing
         * to transition from and the next card simply arrives.
         */}
        <span
          key={card.id}
          className={cn(
            "absolute inset-0 transition-transform duration-[650ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] transform-3d",
            revealed && "rotate-y-180",
          )}
        >
          <CardFace
            hoverable={!revealed}
            /* Hidden from assistive tech once turned: a screen reader reading
               the front and then the back would announce the question twice. */
            hidden={revealed}
          >
            <p className="max-w-[46rem] font-display text-2xl leading-[1.25] font-semibold tracking-[-0.02em] text-balance sm:text-3xl lg:text-[2rem]">
              {card.front}
            </p>
            <span className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-rule px-3 py-1.5 text-xs tracking-[0.06em] text-ink-subtle uppercase transition-colors group-hover:border-rule-strong group-hover:text-ink-muted">
              Space to reveal
            </span>
          </CardFace>

          <CardFace back hidden={!revealed}>
            <p className="max-w-[40rem] text-base leading-snug text-balance text-ink-subtle">
              {card.front}
            </p>
            <span className="h-px w-16 bg-rule-strong" aria-hidden />
            <p className="max-w-[42rem] font-display text-xl leading-snug font-semibold tracking-[-0.01em] text-balance sm:text-2xl">
              {card.back}
            </p>

            {/* On the BACK only. Telling a student they got this right twice
                before they try again hands them the confidence without the
                recall. */}
            {card.timesSeen > 0 && (
              <span className="absolute top-4 right-5 text-xs text-ink-subtle tabular-nums">
                {card.timesKnown}/{card.timesSeen} correct so far
              </span>
            )}
          </CardFace>
        </span>
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

/**
 * One side of the card.
 *
 * Both faces are absolutely positioned on the same sheet, because a flip needs
 * them to occupy the same space — a back that sits below the front would
 * double the card's height and the rotation would swing through nothing.
 */
function CardFace({
  back = false,
  hoverable = false,
  hidden,
  children,
}: {
  back?: boolean;
  hoverable?: boolean;
  hidden: boolean;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden={hidden}
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-6 overflow-hidden rounded-[var(--radius-canvas)] border border-rule bg-surface px-6 py-14 text-center shadow-[var(--shadow-card)] backface-hidden sm:px-12",
        hoverable &&
          "transition-[border-color,box-shadow] group-hover:border-rule-strong group-hover:shadow-[var(--shadow-pop)]",
        back && "rotate-y-180",
      )}
    >
      {/* A wash from the top, so a very tall card does not read as an empty
          sheet with one sentence lost in the middle of it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-surface-sunken/60 to-transparent"
      />
      {children}
    </span>
  );
}

/** Seconds since the clock started, or 0 if it never did. */
function elapsedSince(startedAt: number): number {
  return startedAt === 0 ? 0 : Math.round((Date.now() - startedAt) / 1000);
}
