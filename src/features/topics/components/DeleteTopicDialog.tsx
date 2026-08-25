"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
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
  Skeleton,
} from "@/components/ui";
import {
  deleteTopicAction,
  loadTopicDeletionSummaryAction,
} from "@/features/topics/server/actions";
import { initialTopicState } from "@/features/topics/types";
import { type TopicDeletionSummary } from "@/server/topics/queries";

/**
 * Delete a topic (US-B4, FR-S4).
 *
 * The one thing this dialog exists to say is that **the files stay**. "Delete
 * topic" reads like "delete my notes", and a student who believes that will
 * never tidy their subject. The foreign key detaches materials to the subject
 * rather than removing them, so the dialog states it in those words, with the
 * count, before anything is confirmed.
 *
 * No type-to-confirm, unlike deleting a subject. Friction should match the
 * loss: this one is close to reversible — re-create the topic and re-file the
 * files. Making both feel equally dangerous teaches students to click through
 * the one that isn't.
 */

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "Deleting…" : "Delete topic"}
    </Button>
  );
}

export function DeleteTopicDialog({ topicId, topicName }: { topicId: string; topicName: string }) {
  const [state, formAction] = useActionState(deleteTopicAction, initialTopicState);
  const [summary, setSummary] = useState<TopicDeletionSummary | null>(null);
  const [isLoading, startLoading] = useTransition();

  function onOpenChange(open: boolean) {
    if (!open) return;
    setSummary(null);
    startLoading(async () => setSummary(await loadTopicDeletionSummaryAction(topicId)));
  }

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Delete ${topicName}`}>
          <Trash2 aria-hidden />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>Delete “{topicName}”?</DialogTitle>
        <DialogDescription>
          The topic itself goes. What is filed under it does not.
        </DialogDescription>

        {/* Held back until the counts arrive rather than guessing zeros. */}
        {isLoading && !summary ? (
          <div className="mt-4 flex flex-col gap-2 rounded-[var(--radius-tile)] bg-surface-sunken p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          summary && (
            <ul className="mt-4 flex flex-col gap-2 rounded-[var(--radius-tile)] bg-surface-sunken p-4 text-sm">
              <li>
                <span className="tabular font-medium">{summary.materials}</span>{" "}
                {summary.materials === 1 ? "file moves" : "files move"} back to the subject, still
                uploaded and still searchable.
              </li>
              {summary.reviewers > 0 && (
                <li>
                  <span className="tabular font-medium">{summary.reviewers}</span>{" "}
                  {summary.reviewers === 1 ? "reviewer keeps" : "reviewers keep"} working; they just
                  stop being filed here.
                </li>
              )}
              {summary.quizzes > 0 && (
                <li>
                  <span className="tabular font-medium">{summary.quizzes}</span>{" "}
                  {summary.quizzes === 1 ? "quiz keeps" : "quizzes keep"} their questions and past
                  attempts.
                </li>
              )}
              <li className="text-ink-muted">
                Mastery recorded against this topic is removed — it is a score for a topic that will
                no longer exist.
              </li>
            </ul>
          )
        )}

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="id" value={topicId} />

          {state.status === "error" && state.message && (
            <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle">Keep it</Button>
            </DialogClose>
            <ConfirmButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
