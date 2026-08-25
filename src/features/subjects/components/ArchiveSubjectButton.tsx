"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { setSubjectArchivedAction } from "@/features/subjects/server/actions";
import { initialSubjectState } from "@/features/subjects/types";

/**
 * Archive or restore a subject (FR-S6, US-B6).
 *
 * **No confirmation, on purpose.** Archiving destroys nothing and is undone by
 * one click, so a dialog asking "are you sure?" would be teaching a student to
 * dismiss dialogs — which is exactly the habit that makes the DELETE
 * confirmation useless when it matters. Friction is a budget, and it is spent
 * on the irreversible thing.
 *
 * A form and a Server Action rather than an `onClick` fetch: the button works
 * before hydration, and the list revalidates through the same path as every
 * other mutation instead of needing a refresh of its own.
 */

type Variant = "icon" | "labelled";

function SubmitButton({
  archived,
  subjectName,
  variant,
}: {
  archived: boolean;
  subjectName: string;
  variant: Variant;
}) {
  const { pending } = useFormStatus();
  const Icon = archived ? ArchiveRestore : Archive;
  const label = archived ? "Restore" : "Archive";

  return (
    <Button
      type="submit"
      variant={variant === "labelled" ? "subtle" : "ghost"}
      size="sm"
      disabled={pending}
      /* The icon-only form is in a row of icon buttons where a text label
         would not fit; it still carries a real name and a hover explanation.
         The labelled form is the primary way out of the archive, so it says so
         in words. */
      aria-label={variant === "icon" ? `${label} ${subjectName}` : undefined}
      title={archived ? "Restore to active subjects" : "Archive — keeps everything, hides the card"}
    >
      <Icon aria-hidden />
      {variant === "labelled" && (pending ? (archived ? "Restoring…" : "Archiving…") : label)}
    </Button>
  );
}

export function ArchiveSubjectButton({
  subjectId,
  subjectName,
  archived,
  variant = "icon",
}: {
  subjectId: string;
  subjectName: string;
  archived: boolean;
  variant?: Variant;
}) {
  const [state, formAction] = useActionState(setSubjectArchivedAction, initialSubjectState);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="id" value={subjectId} />
      {/* The value says what the subject should BECOME, so the action never has
          to read the current state and guess. */}
      <input type="hidden" name="archived" value={String(!archived)} />
      <SubmitButton archived={archived} subjectName={subjectName} variant={variant} />

      {/* Failure is silent otherwise — the card simply would not move, and a
          student would keep clicking. */}
      {state.status === "error" && state.message && (
        <p role="alert" className="text-xs font-medium text-bad">
          {state.message}
        </p>
      )}
    </form>
  );
}
