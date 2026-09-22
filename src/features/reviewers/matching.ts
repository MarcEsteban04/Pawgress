import { type ReviewerDocument } from "@/features/reviewers/schema";

/**
 * The pairs a matching round is played with (Sprint 49).
 *
 * **Built from the reviewer itself, not generated.** The key terms and the
 * concepts are already a list of names and the things they mean — which is what
 * a matching-type question IS — so this mode costs no generation, no job, no
 * waiting and no tokens. It works the instant a reviewer is ready, which is
 * also why it is worth having: every other study mode on this page makes a
 * student press a button and wait a minute first.
 *
 * **Terms first, concepts to top up.** A term and its definition is the tighter
 * pair: short on both sides, and the thing an exam actually asks for. Concepts
 * are added only when the terms alone would make a thin board, because a
 * concept's explanation runs to three sentences and a column of those is a
 * reading exercise rather than a matching one.
 *
 * **Rounds of six, and the cap is the design.** Twelve pairs on one board is
 * twenty-four things to hold in view; the matching gets harder because the
 * scanning does, which is difficulty of the wrong kind. Six is a board a
 * student can see at once on a laptop and still scroll on a phone.
 */

export type MatchPair = {
  /** Stable across a reshuffle, so React keys survive "go again". */
  id: string;
  /** The side a student reads. */
  clue: string;
  /** The side they are looking for. Short by construction. */
  answer: string;
  /** Where it came from, so the board can say so. */
  kind: "term" | "concept";
};

/** Below this a board is not a game — four pairs is two guesses and a gimme. */
export const MATCH_MINIMUM = 4;

/** One round's worth. See the header for why it is six and not twelve. */
export const MATCH_ROUND_SIZE = 6;

/**
 * Every pair a reviewer can offer, in a stable order.
 *
 * Stable because the shuffle belongs to the caller: the page shuffles on the
 * server so the markup it sends matches the markup it hydrates, and the session
 * reshuffles after that, where there is no server to disagree with.
 */
export function matchPairs(document: ReviewerDocument): MatchPair[] {
  const terms: MatchPair[] = document.terms.map((term) => ({
    id: `term:${term.term}`,
    clue: term.definition,
    answer: term.term,
    kind: "term",
  }));

  if (terms.length >= MATCH_ROUND_SIZE) return terms;

  /* Only as far as a full round. Beyond that the extra concepts add length
     without adding a round, and lengthen the answer column for nothing. */
  const concepts: MatchPair[] = document.concepts
    .slice(0, Math.max(0, MATCH_ROUND_SIZE - terms.length))
    .map((concept) => ({
      id: `concept:${concept.name}`,
      clue: concept.explanation,
      answer: concept.name,
      kind: "concept",
    }));

  return [...terms, ...concepts];
}

/** Whether this reviewer can be played at all. */
export function canMatch(document: ReviewerDocument | null): boolean {
  return document !== null && matchPairs(document).length >= MATCH_MINIMUM;
}

/**
 * Fisher–Yates. Same as the flashcard deck's, and deliberately not shared with
 * it: that one lives next to the session that uses it, and a two-line helper is
 * cheaper duplicated than imported across two features.
 */
export function shufflePairs<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
