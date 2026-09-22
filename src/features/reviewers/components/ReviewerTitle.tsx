"use client";

import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { STUDY_TITLE } from "@/features/reviewers/components/StudyShell";
import { updateReviewerAction } from "@/features/reviewers/server/edit";
import { cn } from "@/lib/utils";

/**
 * The reviewer's name, renameable in place (FR-R5, Sprint 46).
 *
 * A generated title is a guess at what a student would call this, and it is the
 * one field they will want to change most: it is what they look for in a list
 * of thirty. Editing it where it is displayed means never having to find a
 * settings screen for one string.
 *
 * **It IS the page's `<h1>`, sitting in the `StudyShell` bar.** It used to be a
 * second heading above the document while the bar printed the same title again,
 * which showed every reviewer its own name twice. Passing this in as the shell's
 * `title` is what collapses the two back into one — so it borrows `STUDY_TITLE`
 * rather than styling itself, and a restyle of the bar carries it along.
 */
export function ReviewerTitle({ reviewerId, title }: { reviewerId: string; title: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function save() {
    const next = draft.trim();
    if (!next || next === title) {
      setEditing(false);
      setDraft(title);
      return;
    }

    setError(null);
    startSaving(async () => {
      const result = await updateReviewerAction(reviewerId, { title: next });
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="mt-1 flex min-w-0 items-center gap-1.5">
        <h1 className={cn("min-w-0", STUDY_TITLE)}>{title}</h1>
        <button
          type="button"
          aria-label="Rename this reviewer"
          onClick={() => {
            setDraft(title);
            setEditing(true);
          }}
          /* Always reachable, not hover-only: this page is read on phones, and
             a control that only exists under a mouse pointer does not exist
             there at all. Dimmed until wanted rather than hidden. */
          className="shrink-0 rounded-full p-1 text-ink-subtle opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      /* Deliberately short controls (h-9, sm button). This form lives inside a
         strip of chrome, so a full-height field would visibly grow the bar and
         shove the document down the moment someone started typing. */
      className="mt-1 flex flex-col gap-1"
    >
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          autoFocus
          maxLength={120}
          aria-label="Reviewer name"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(title);
              setEditing(false);
            }
          }}
          className="h-9 min-w-0 flex-1"
        />
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
      {error && (
        <span role="alert" className="text-xs text-bad">
          {error}
        </span>
      )}
    </form>
  );
}
