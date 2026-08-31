"use client";

import { Copy, FileText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import {
  deleteReviewerAction,
  duplicateReviewerAction,
  loadReviewerImpactAction,
} from "@/features/reviewers/server/actions";
import { type ReviewerListItem } from "@/server/reviewers/queries";

/**
 * One reviewer in the library (Sprint 47).
 *
 * A row rather than a card: a student scanning forty reviewers is comparing
 * titles and subjects, and cards force that comparison into two dimensions for
 * no gain. The subject is on every row because this list crosses subjects —
 * without it a title like "Chapter 4" is unidentifiable.
 */

type Impact = { flashcards: number; quizzes: number };

function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * The consequence line.
 *
 * Both children are named even at zero, because "0 flashcards" is what makes
 * the sentence trustworthy rather than boilerplate. The asymmetry is stated
 * outright — a student has no way to guess that flashcards die and quizzes do
 * not, and the whole point of the dialog is that they should not have to.
 */
function consequenceText(impact: Impact): string {
  const cards = countLabel(impact.flashcards, "flashcard", "flashcards");

  if (impact.quizzes === 0) {
    return impact.flashcards === 0
      ? "Nothing was generated from this reviewer, so nothing else goes with it."
      : `${cards} generated from it are deleted too, along with what you had marked as known. There is no undo.`;
  }

  const quizzes = countLabel(impact.quizzes, "quiz", "quizzes");
  return impact.flashcards === 0
    ? `${quizzes} stay — they are your own work and are kept, just no longer linked to a reviewer.`
    : `${cards} generated from it are deleted too, along with what you had marked as known. ${quizzes} are kept — your answers are your own work — but will no longer be linked to a reviewer.`;
}

export function ReviewerLibraryRow({ reviewer }: { reviewer: ReviewerListItem }) {
  const [impact, setImpact] = useState<Impact | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isBusy, startBusy] = useTransition();

  const href = `/subjects/${reviewer.subjectId}/reviewers/${reviewer.id}`;
  const isReady = reviewer.status === "ready";

  /* Counts are read when the dialog opens, not for every row on the page. */
  function onOpenChange(open: boolean) {
    if (!open) return;
    setImpact(null);
    startLoading(async () => setImpact(await loadReviewerImpactAction(reviewer.id)));
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-sunken">
      <FileText className="size-[1.125rem] shrink-0 text-ink-subtle" aria-hidden />

      <Link href={href} className="min-w-0 flex-1">
        <span className="block truncate font-medium">{reviewer.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-muted">
          <span className="truncate">{reviewer.subjectName}</span>
          {reviewer.topicName && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{reviewer.topicName}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span className="tabular">{countLabel(reviewer.sourceCount, "source", "sources")}</span>
        </span>
      </Link>

      {!isReady && <StatusBadge status={reviewer.status} />}

      {/* Duplicate is offered only on a finished reviewer. Copying one that is
          still generating would produce a permanent orphan — the copy has no
          job pointing at it, so it would sit at "generating" for ever. */}
      {isReady && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Duplicate ${reviewer.title}`}
          disabled={isBusy}
          onClick={() => startBusy(async () => void (await duplicateReviewerAction(reviewer.id)))}
        >
          <Copy aria-hidden />
        </Button>
      )}

      <Dialog onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Delete ${reviewer.title}`}>
            <Trash2 aria-hidden />
          </Button>
        </DialogTrigger>

        <DialogContent>
          <DialogTitle>Delete “{reviewer.title}”?</DialogTitle>
          <DialogDescription>
            {isLoading || !impact
              ? "Checking what was generated from it…"
              : consequenceText(impact)}
          </DialogDescription>

          {/* Held back until the real counts arrive. Showing zeros while loading
              would be a confident, wrong answer in the one dialog that must not
              give one. */}
          {isLoading && !impact && <Skeleton className="mt-4 h-4 w-full" />}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle">Keep it</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                variant="danger"
                disabled={isBusy}
                onClick={() =>
                  startBusy(async () => void (await deleteReviewerAction(reviewer.id)))
                }
              >
                Delete reviewer
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
