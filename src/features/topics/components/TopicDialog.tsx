"use client";

import { Check, Plus } from "lucide-react";
import { useActionState, useId } from "react";
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
import { createTopicAction, renameTopicAction } from "@/features/topics/server/actions";
import { initialTopicState } from "@/features/topics/types";
import { type Topic } from "@/server/topics/queries";

/**
 * Create or rename a topic (FR-S3, US-B4).
 *
 * One component for both — a topic is a name and nothing else, so there is
 * nothing for two components to differ about.
 *
 * Creating stays open on success and clears the field. Filling in a syllabus
 * means adding eight topics in a row, and re-opening a dialog eight times is
 * the kind of friction that makes a student stop after three. Renaming is
 * finished when it is saved, so it offers a Done button instead.
 *
 * The clearing is done by KEYING the form on the action's save counter rather
 * than by an effect. `setState` inside an effect is what the React Compiler
 * lint forbids, and rightly: the render that follows the save already knows
 * everything needed to decide the field should be empty.
 */

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending}>
      {pending ? "Saving…" : editing ? "Save name" : "Add topic"}
    </Button>
  );
}

export function TopicDialog({
  subjectId,
  topic,
  trigger,
}: {
  subjectId: string;
  topic?: Topic;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(topic);
  const [state, formAction] = useActionState(
    editing ? renameTopicAction : createTopicAction,
    initialTopicState,
  );
  const nameId = useId();

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="subtle">
            <Plus aria-hidden />
            Add topic
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>{editing ? "Rename topic" : "New topic"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "The new name shows up on every material and quiz filed under it."
            : "A chapter, unit or theme. Files and quizzes can be filed under it."}
        </DialogDescription>

        <form
          key={editing ? "edit" : `create-${state.saves ?? 0}`}
          action={formAction}
          className="mt-4 flex flex-col gap-4"
        >
          <input type="hidden" name="subjectId" value={subjectId} />
          {topic && <input type="hidden" name="id" value={topic.id} />}

          {state.status === "error" && state.message && !state.fieldErrors?.name && (
            <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
          )}

          <Field label="Name" htmlFor={nameId} error={state.fieldErrors?.name}>
            <Input
              id={nameId}
              name="name"
              defaultValue={topic?.name}
              required
              maxLength={160}
              placeholder="Cell division"
              autoFocus
            />
          </Field>

          {state.status === "saved" && !editing && (
            <p className="text-ok text-sm" role="status">
              Added. Type another, or close when you are done.
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle">{editing ? "Cancel" : "Done"}</Button>
            </DialogClose>
            {editing && state.status === "saved" ? (
              <DialogClose asChild>
                <Button variant="accent">
                  <Check aria-hidden />
                  Saved
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
