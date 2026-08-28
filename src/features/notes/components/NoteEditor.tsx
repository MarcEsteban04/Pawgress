"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Button,
  buttonStyles,
  Card,
  CardBody,
  ErrorState,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { createNoteAction, updateNoteAction } from "@/features/notes/server/actions";
import { initialNoteState } from "@/features/notes/types";
import { NOTE_BODY_MAX } from "@/lib/validation/note";

/**
 * Writing and editing a note (FR-U5, US-C3).
 *
 * A page, not a dialog. A note is long-form content a student may spend twenty
 * minutes on, and the rule from docs/navigation.md §1 applies: anything worth
 * linking to, reloading and returning to is a page. A modal over the library
 * would also put a 20-minute investment one stray Escape key from oblivion.
 *
 * One component serves create and edit because the fields, the bounds and the
 * failure copy are identical — the only difference is which action runs and
 * where it goes afterwards.
 */

function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export type NoteEditorProps = {
  subjectId: string;
  topics: { id: string; name: string }[];
  /** Present when editing. Absent when writing a new note. */
  note?: { id: string; title: string; body: string; topicId: string | null };
};

export function NoteEditor({ subjectId, topics, note }: NoteEditorProps) {
  const isEdit = Boolean(note);
  const [state, formAction] = useActionState(
    isEdit ? updateNoteAction : createNoteAction,
    initialNoteState,
  );

  const titleId = useId();
  const bodyId = useId();
  const topicFieldId = useId();

  /* All three fields are controlled, which is what makes "unsaved" a DERIVED
     fact rather than a flag to keep in step. Comparing against the props means a
     successful save clears the warning by itself: the action revalidates, this
     component re-renders with the saved values as its props, and `dirty` goes
     false with no effect involved. */
  const savedTitle = note?.title ?? "";
  const savedBody = note?.body ?? "";
  const savedTopic = note?.topicId ?? "";

  const [title, setTitle] = useState(savedTitle);
  const [body, setBody] = useState(savedBody);
  const [topic, setTopic] = useState(savedTopic);

  const dirty = title !== savedTitle || body !== savedBody || topic !== savedTopic;

  /* A note is typed, not uploaded, so until it saves the only copy is in this
     textarea. Closing the tab mid-sentence should cost a confirmation, not the
     whole note (docs/user-flows.md F9). */
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const remaining = NOTE_BODY_MAX - body.length;
  /* The counter only appears when it is close to mattering. A character count
     on an empty note is a limit advertised for no reason. */
  const showCount = body.length > NOTE_BODY_MAX * 0.8;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {isEdit ? (
        <input type="hidden" name="id" value={note!.id} />
      ) : (
        <input type="hidden" name="subjectId" value={subjectId} />
      )}

      {state.status === "error" && state.message && (
        <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
      )}

      {/* Saved-and-reindexed is worth distinguishing from saved-title-only:
          one means Acadify has to read the note again, the other does not. */}
      {state.status === "saved" && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-card)] border border-good/30 bg-good-soft px-4 py-3 text-sm text-good"
        >
          <span className="font-medium">Saved.</span>
          <span className="text-ink-muted">
            {state.reindexed
              ? "Acadify will read the new version before using it in reviewers or quizzes."
              : "Only the title or topic changed, so nothing needs re-reading."}
          </span>
          {isEdit && (
            <Link
              href={`/subjects/${subjectId}/materials/${note!.id}`}
              className="font-medium underline underline-offset-2"
            >
              View note
            </Link>
          )}
        </div>
      )}

      <Card>
        <CardBody className="flex flex-col gap-5 p-5">
          <Field
            label="Title"
            htmlFor={titleId}
            error={state.fieldErrors?.title}
            hint="What you will recognise it by in your library."
          >
            <Input
              id={titleId}
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={300}
              autoFocus={!isEdit}
              aria-invalid={state.fieldErrors?.title ? true : undefined}
              placeholder="Mitosis — key stages"
            />
          </Field>

          <Field
            label="Note"
            htmlFor={bodyId}
            error={state.fieldErrors?.body}
            hint="Paste or type anything. Acadify reads this the same way it reads an uploaded file."
          >
            <Textarea
              id={bodyId}
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
              maxLength={NOTE_BODY_MAX}
              rows={18}
              autoFocus={isEdit}
              aria-invalid={state.fieldErrors?.body ? true : undefined}
              className="min-h-[24rem] leading-relaxed font-normal"
              placeholder={"Prophase — chromosomes condense…\n\nMetaphase — …"}
            />
          </Field>

          {showCount && (
            <p
              className={`tabular text-xs ${remaining < 0 ? "text-bad" : "text-ink-subtle"}`}
              role="status"
            >
              {remaining < 0
                ? `${Math.abs(remaining).toLocaleString()} characters over the limit`
                : `${remaining.toLocaleString()} characters left`}
            </p>
          )}

          <Field
            label="Topic"
            htmlFor={topicFieldId}
            optional
            hint={
              topics.length === 0
                ? "This subject has no topics yet. Notes can be filed later."
                : "Filing it now means mastery for that topic includes this note."
            }
          >
            <Select
              id={topicFieldId}
              name="topicId"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              disabled={topics.length === 0}
            >
              <option value="">No topic</option>
              {topics.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <SaveButton
          label={isEdit ? "Save changes" : "Save note"}
          pendingLabel={isEdit ? "Saving…" : "Saving…"}
        />
        <Link
          href={
            isEdit
              ? `/subjects/${subjectId}/materials/${note!.id}`
              : `/subjects/${subjectId}/materials`
          }
          className={buttonStyles({ variant: "subtle" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
