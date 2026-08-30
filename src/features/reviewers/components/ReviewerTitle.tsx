"use client";

import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { updateReviewerAction } from "@/features/reviewers/server/edit";

/**
 * The reviewer's name, renameable in place (FR-R5, Sprint 46).
 *
 * A generated title is a guess at what a student would call this, and it is the
 * one field they will want to change most: it is what they look for in a list
 * of thirty. Editing it where it is displayed means never having to find a
 * settings screen for one string.
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
      <div className="group flex items-start gap-2">
        <h1 className="mt-1 font-display text-2xl leading-tight font-semibold tracking-[-0.02em]">
          {title}
        </h1>
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
          className="mt-1.5 rounded-full p-1.5 text-ink-subtle opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          <Pencil className="size-4" aria-hidden />
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
      className="mt-1 flex flex-col gap-1.5"
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
          className="min-w-0 flex-1"
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
