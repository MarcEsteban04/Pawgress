"use client";

import { Check, Plus } from "lucide-react";
import { useActionState, useId, useState } from "react";
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
import { SUBJECT_TONE, subjectIconFor } from "./SubjectIcon";
import { initialSubjectState } from "@/features/subjects/types";
import { createSubjectAction, updateSubjectAction } from "@/features/subjects/server/actions";
import { COLOR_SLOTS, SUBJECT_ICONS } from "@/lib/validation/subject";
import { type Subject } from "@/server/subjects/queries";
import { cn } from "@/lib/utils";

/**
 * Create or rename a subject (FR-S1, US-B1).
 *
 * One component for both, because the fields are identical and two would drift.
 * `subject` present means edit.
 *
 * The colour and icon pickers are real radio groups behind the styling — a grid
 * of `<button>`s would need arrow-key handling written by hand, and radios get
 * it, plus a name and a checked state, for free.
 */

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending}>
      {pending ? "Saving…" : editing ? "Save changes" : "Create subject"}
    </Button>
  );
}

export function SubjectDialog({
  subject,
  trigger,
}: {
  subject?: Subject;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(subject);
  const [state, formAction] = useActionState(
    editing ? updateSubjectAction : createSubjectAction,
    initialSubjectState,
  );
  const [colorSlot, setColorSlot] = useState<number>(subject?.colorSlot ?? 1);
  const [icon, setIcon] = useState<string>(subject?.icon ?? "book");
  const nameId = useId();
  const semesterId = useId();

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="accent">
            <Plus aria-hidden />
            New subject
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>{editing ? "Edit subject" : "New subject"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "A rename shows up everywhere this subject appears."
            : "One per class. Files, topics and quizzes live inside it."}
        </DialogDescription>

        <form action={formAction} className="mt-4 flex flex-col gap-5">
          {subject && <input type="hidden" name="id" value={subject.id} />}

          {state.status === "error" && state.message && !state.fieldErrors?.name && (
            <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
          )}

          <Field label="Name" htmlFor={nameId} error={state.fieldErrors?.name}>
            <Input
              id={nameId}
              name="name"
              defaultValue={subject?.name}
              required
              maxLength={120}
              placeholder="Biology"
              autoFocus={!editing}
            />
          </Field>

          {/* Duplicates are allowed; the student is told and decides (US-B1). */}
          {state.duplicateWarning && (
            <p className="text-sm text-warn" role="status">
              {state.duplicateWarning}
            </p>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[0.9375rem] font-medium">Colour</legend>
            <p className="text-sm text-ink-subtle">
              This subject keeps it everywhere — lists, charts and your plan.
            </p>
            <div className="mt-1 flex gap-2">
              {COLOR_SLOTS.map((slot) => (
                <label
                  key={slot}
                  className={cn(
                    "flex size-10 cursor-pointer items-center justify-center rounded-full border-2 transition-colors",
                    colorSlot === slot ? "border-ink" : "border-transparent",
                  )}
                >
                  <input
                    type="radio"
                    name="colorSlot"
                    value={slot}
                    checked={colorSlot === slot}
                    onChange={() => setColorSlot(slot)}
                    className="sr-only"
                  />
                  <span className={cn("size-7 rounded-full", SUBJECT_TONE[slot].dot)} />
                  <span className="sr-only">Colour {slot}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[0.9375rem] font-medium">Icon</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {SUBJECT_ICONS.map((key) => {
                const Glyph = subjectIconFor(key);
                const selected = icon === key;
                return (
                  <label
                    key={key}
                    className={cn(
                      "flex size-10 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border transition-colors",
                      selected
                        ? cn("border-ink", SUBJECT_TONE[colorSlot as 1].tint)
                        : "border-rule hover:border-rule-strong",
                    )}
                  >
                    <input
                      type="radio"
                      name="icon"
                      value={key}
                      checked={selected}
                      onChange={() => setIcon(key)}
                      className="sr-only"
                    />
                    <Glyph className="size-[1.125rem]" aria-hidden />
                    <span className="sr-only">{key}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Field label="Semester" htmlFor={semesterId} optional>
            <Input
              id={semesterId}
              name="semester"
              defaultValue={subject?.semester ?? ""}
              maxLength={60}
              placeholder="1st sem 2026"
            />
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle">Cancel</Button>
            </DialogClose>
            {state.status === "saved" ? (
              <DialogClose asChild>
                <Button variant="accent">
                  <Check aria-hidden />
                  Done
                </Button>
              </DialogClose>
            ) : (
              <SubmitButton editing={editing} />
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
