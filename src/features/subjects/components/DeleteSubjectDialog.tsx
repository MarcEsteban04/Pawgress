"use client";

import { Trash2, TriangleAlert } from "lucide-react";
import { useActionState, useId, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  ErrorState,
  Field,
  Input,
} from "@/components/ui";
import { initialSubjectState } from "@/features/subjects/types";
import { deleteSubjectAction, loadDeletionSummaryAction } from "@/features/subjects/server/actions";
import { DELETE_SUBJECT_CONFIRMATION } from "@/lib/validation/subject";
import { Skeleton } from "@/components/ui";
import { type DeletionSummary } from "@/server/subjects/queries";

/**
 * Delete a subject (US-B3, FR-S4).
 *
 * The confirmation names real counts, not "and related content". A student
 * about to lose a term of work deserves to see the number — and a count of
 * zero is worth showing too, because "0 quizzes" is what makes the list
 * trustworthy rather than boilerplate.
 *
 * Counts are fetched when the dialog opens, so they describe the subject at the
 * moment they are read rather than whenever the page last loaded.
 */

const LABELS: [keyof Omit<DeletionSummary, "storagePaths">, string, string][] = [
  ["topics", "topic", "topics"],
  ["materials", "file", "files"],
  ["reviewers", "reviewer", "reviewers"],
  ["flashcards", "flashcard", "flashcards"],
  ["quizzes", "quiz", "quizzes"],
  ["attempts", "quiz attempt", "quiz attempts"],
];

function ConfirmButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={!enabled || pending}>
      {pending ? "Deleting…" : "Delete subject"}
    </Button>
  );
}

export function DeleteSubjectDialog({
  subjectId,
  subjectName,
}: {
  subjectId: string;
  subjectName: string;
}) {
  const [state, formAction] = useActionState(deleteSubjectAction, initialSubjectState);
  const [typed, setTyped] = useState("");
  const [summary, setSummary] = useState<DeletionSummary | null>(null);
  const [isLoading, startLoading] = useTransition();
  const confirmId = useId();

  /* Counts are fetched when the dialog OPENS, not for every card on the page.
     Six count queries per subject was fine for three subjects and would be
     ninety for fifteen, nearly all of them discarded. Fetching here also means
     the numbers are current at the moment they are read, which is the property
     that matters in a destructive confirmation. */
  function onOpenChange(open: boolean) {
    if (!open) return;
    setSummary(null);
    startLoading(async () => setSummary(await loadDeletionSummaryAction(subjectId)));
  }

  const total = summary ? LABELS.reduce((sum, [key]) => sum + summary[key], 0) : 0;

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Delete ${subjectName}`}>
          <Trash2 aria-hidden />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>Delete “{subjectName}”?</DialogTitle>
        <DialogDescription>
          {isLoading || !summary
            ? "Checking what is inside…"
            : total === 0
              ? "This subject is empty, so nothing else goes with it."
              : "Everything below is deleted with it. There is no undo and no copy."}
        </DialogDescription>

        {/* The list is held back until the real counts arrive. Showing zeros
            while loading would be a confident, wrong answer in the one dialog
            that must not give one. */}
        {isLoading && !summary && (
          <div className="mt-4 flex flex-col gap-2 rounded-[var(--radius-tile)] bg-surface-sunken p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        )}

        {summary && total > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 rounded-[var(--radius-tile)] bg-surface-sunken p-4">
            {LABELS.map(([key, singular, plural]) => (
              <li key={key} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-muted">{summary[key] === 1 ? singular : plural}</span>
                <span className="tabular font-medium">{summary[key]}</span>
              </li>
            ))}
          </ul>
        )}

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="id" value={subjectId} />

          {state.status === "error" && state.message && (
            <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
          )}

          <Field
            label={`Type ${DELETE_SUBJECT_CONFIRMATION} to confirm`}
            htmlFor={confirmId}
            error={state.fieldErrors?.confirmation}
          >
            <Input
              id={confirmId}
              name="confirmation"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </Field>

          {summary && summary.storagePaths.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-ink-muted">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
              <p>
                The {summary.storagePaths.length === 1 ? "file" : "files"} you uploaded are removed
                from storage too, not just hidden.
              </p>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle">Keep it</Button>
            </DialogClose>
            <ConfirmButton enabled={typed.trim() === DELETE_SUBJECT_CONFIRMATION && !isLoading} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
