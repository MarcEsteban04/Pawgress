"use client";

import { Check, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  Button,
  Chip,
  ChipGroup,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { EVENT_KINDS, EVENT_KIND_INFO, type EventInput } from "@/features/planner/schema";
import {
  createEventAction,
  deleteEventAction,
  setEventCompletedAction,
  updateEventAction,
} from "@/features/planner/server/actions";
import { type PlannerEvent } from "@/server/planner/queries";
import { type DateKey } from "@/features/planner/dates";

export type PlannerSubject = {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
};

/**
 * Add or change one event (FR-L1, US-J1, Sprint 61).
 *
 * **One dialog for both, because the fields are identical.** A separate "edit"
 * form would be the same seven inputs maintained twice, and the first change
 * to either would drift. What differs is the verbs — Add versus Save, plus the
 * two things only an existing event can do — and that is a handful of
 * conditionals rather than a second component.
 *
 * **Open state is owned by the caller**, not by a trigger inside here. The
 * calendar opens this from an event chip, from an empty cell, and from the
 * page header, and each needs to seed it differently: a chip with the event, a
 * cell with that cell's date. A `DialogTrigger` would force three copies.
 *
 * **Mark done lives here, beside Delete.** Both are things you do TO an event
 * rather than fields of it, and both need a way back — done is undoable with
 * the same button, and delete asks first.
 */
export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
  subjects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The event being edited. Absent means a new one. */
  event?: PlannerEvent | null;
  /** The day a new event starts on — the cell that was clicked. */
  defaultDate: DateKey;
  subjects: PlannerSubject[];
}) {
  /* Keyed on the event being edited, so opening the dialog on a different
     event RESETS the form. Without the key the inputs keep the last event's
     values, because state does not re-initialise from changed props. */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <EventForm
          key={event?.id ?? `new:${defaultDate}`}
          event={event ?? null}
          defaultDate={defaultDate}
          subjects={subjects}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  event,
  defaultDate,
  subjects,
  onDone,
}: {
  event: PlannerEvent | null;
  defaultDate: DateKey;
  subjects: PlannerSubject[];
  onDone: () => void;
}) {
  const router = useRouter();
  const editing = event !== null;

  const [title, setTitle] = useState(event?.title ?? "");
  const [kind, setKind] = useState(event?.kind ?? "exam");
  const [subjectId, setSubjectId] = useState(event?.subjectId ?? "");
  const [topicId, setTopicId] = useState(event?.topicId ?? "");
  const [dueOn, setDueOn] = useState(event?.dueOn ?? defaultDate);
  /* A time is opt-in. Most deadlines are a day, and pre-filling 23:59 on every
     one of them is the product inventing a precision the student did not. */
  const [timed, setTimed] = useState(event?.dueTime !== null && event?.dueTime !== undefined);
  const [dueTime, setDueTime] = useState(event?.dueTime ?? "23:59");
  const [notes, setNotes] = useState(event?.notes ?? "");

  const [error, setError] = useState<{ message: string; field?: keyof EventInput } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const titleId = useId();
  const subjectFieldId = useId();
  const topicFieldId = useId();
  const dateId = useId();
  const timeId = useId();
  const notesId = useId();
  const kindLabelId = useId();

  const subject = subjects.find((entry) => entry.id === subjectId);

  function save() {
    setError(null);
    const input: EventInput = {
      title,
      kind,
      subjectId: subjectId || null,
      topicId: topicId || null,
      dueOn,
      dueTime: timed ? dueTime : null,
      notes: notes.trim() || null,
    };

    startTransition(async () => {
      const result = editing
        ? await updateEventAction(event.id, input)
        : await createEventAction(input);

      if (result.status === "error") {
        setError({ message: `${result.message} ${result.nextStep}`, field: result.field });
        return;
      }
      /* The calendar is a Server Component reading a date range, so the new
         event only appears once the server re-renders it. `revalidatePath` in
         the action marks it stale; this is what asks for it. */
      router.refresh();
      onDone();
    });
  }

  function run(action: () => Promise<{ status: string; message?: string; nextStep?: string }>) {
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (result.status === "error") {
        setError({ message: `${result.message ?? ""} ${result.nextStep ?? ""}`.trim() });
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <>
      <DialogTitle>{editing ? "Edit event" : "Add to your planner"}</DialogTitle>
      <DialogDescription>
        {editing
          ? "Change any of it, or mark it done when it is behind you."
          : "Exams, quizzes and deadlines. What you add here is what the dashboard counts down to."}
      </DialogDescription>

      <div className="mt-1 flex flex-col gap-4">
        <Field
          label="What is it"
          htmlFor={titleId}
          error={error?.field === "title" ? error.message : undefined}
        >
          <Input
            id={titleId}
            value={title}
            autoFocus
            maxLength={300}
            onChange={(field) => setTitle(field.target.value)}
            placeholder="Unit 3 exam"
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <p id={kindLabelId} className="text-[0.9375rem] font-medium">
            Kind
          </p>
          {/* Chips, not a select: six options, all short, and the choice
              changes how every other surface treats the event — an exam is
              revised toward, an assignment is handed in. Worth seeing all of
              at once (docs/design-system.md, `Chip`). */}
          <ChipGroup role="group" aria-labelledby={kindLabelId}>
            {EVENT_KINDS.map((option) => (
              <Chip
                key={option}
                size="sm"
                selected={kind === option}
                onClick={() => setKind(option)}
              >
                {EVENT_KIND_INFO[option].label}
              </Chip>
            ))}
          </ChipGroup>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Date"
            htmlFor={dateId}
            error={error?.field === "dueOn" ? error.message : undefined}
          >
            <Input
              id={dateId}
              type="date"
              value={dueOn}
              onChange={(field) => setDueOn(field.target.value)}
            />
          </Field>

          <Field
            label="Time"
            htmlFor={timeId}
            optional
            hint={timed ? undefined : "No time — it is due that day."}
          >
            <div className="flex items-center gap-2">
              <Input
                id={timeId}
                type="time"
                value={dueTime}
                disabled={!timed}
                onChange={(field) => setDueTime(field.target.value)}
                className="flex-1"
              />
              <Button
                variant={timed ? "subtle" : "ghost"}
                size="sm"
                type="button"
                onClick={() => setTimed((previous) => !previous)}
              >
                {timed ? "Clear" : "Set"}
              </Button>
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject" htmlFor={subjectFieldId} optional>
            <Select
              id={subjectFieldId}
              value={subjectId}
              onChange={(field) => {
                setSubjectId(field.target.value);
                setTopicId("");
              }}
            >
              <option value="">No subject</option>
              {subjects.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Topic"
            htmlFor={topicFieldId}
            optional
            error={error?.field === "topicId" ? error.message : undefined}
          >
            {/* Keyed on the subject so changing it resets the topic in the
                render that already knows the old one is invalid. */}
            <Select
              key={subjectId}
              id={topicFieldId}
              value={topicId}
              disabled={!subject?.topics.length}
              onChange={(field) => setTopicId(field.target.value)}
            >
              <option value="">
                {subject?.topics.length ? "Whole subject" : "Choose a subject first"}
              </option>
              {subject?.topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Notes" htmlFor={notesId} optional>
          <Textarea
            id={notesId}
            value={notes}
            maxLength={2000}
            onChange={(field) => setNotes(field.target.value)}
            placeholder="Chapters 4–6, no calculator."
            className="min-h-20"
          />
        </Field>

        {error && !error.field && (
          <p role="alert" className="text-sm text-bad">
            {error.message}
          </p>
        )}
      </div>

      <DialogFooter className="items-center">
        {/* The two destructive-ish actions sit left, away from Save. Delete
            asks first, in place: a second dialog stacked on this one would
            trap focus twice and close the wrong thing on Escape. */}
        {editing && (
          <div className="mr-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => setEventCompletedAction(event.id, !event.completedAt))}
            >
              {event.completedAt ? <Undo2 aria-hidden /> : <Check aria-hidden />}
              {event.completedAt ? "Not done" : "Done"}
            </Button>

            {confirmingDelete ? (
              <Button
                variant="danger"
                size="sm"
                disabled={isPending}
                onClick={() => run(() => deleteEventAction(event.id))}
              >
                <Trash2 aria-hidden />
                Really delete
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Delete ${event.title}`}
                disabled={isPending}
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 aria-hidden />
              </Button>
            )}
          </div>
        )}

        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button variant="accent" onClick={save} disabled={isPending || !title.trim()}>
          {isPending ? "Saving…" : editing ? "Save" : "Add it"}
        </Button>
      </DialogFooter>
    </>
  );
}
