"use client";

import { FileImage, FileText, Pencil, Presentation, Trash2, TriangleAlert } from "lucide-react";
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
  Select,
  StatusBadge,
  Tag,
} from "@/components/ui";
import {
  deleteMaterialAction,
  renameMaterialAction,
  setMaterialTopicAction,
} from "@/features/materials/server/actions";
import { initialMaterialState } from "@/features/materials/types";
import { formatBytes, KIND_LABELS } from "@/features/materials/upload";
import { type Material } from "@/server/materials/queries";
import { type MaterialKind } from "@/types";
import { cn } from "@/lib/utils";

/**
 * One file in the library (FR-U4, US-C4).
 *
 * Name, type, size, upload date, topic and processing status — the six things
 * US-C4 names, because a library that shows only names makes a student open
 * files to find out what they are.
 *
 * Rename edits the TITLE, not the stored object. They are different things: the
 * path was generated at upload and is referenced by the row, so renaming the
 * object would mean rewriting that reference for no gain, and failing halfway
 * would leave a row pointing at a file that no longer exists.
 */

const KIND_ICONS: Record<MaterialKind, typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  pptx: Presentation,
  image: FileImage,
  note: FileText,
};

/** "3 days ago" beats a date a student has to subtract from today. */
function relative(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "Deleting…" : "Delete file"}
    </Button>
  );
}

function RenameDialog({ material }: { material: Material }) {
  const [state, formAction] = useActionState(renameMaterialAction, initialMaterialState);
  const titleId = useId();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Rename ${material.title}`}>
          <Pencil aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Rename file</DialogTitle>
        <DialogDescription>
          This changes what the file is called in Pawgress. The original upload is untouched.
        </DialogDescription>

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="id" value={material.id} />

          {state.status === "error" && state.message && (
            <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
          )}

          <Field label="Name" htmlFor={titleId}>
            <Input
              id={titleId}
              name="title"
              defaultValue={material.title}
              required
              maxLength={300}
              autoFocus
            />
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle">Cancel</Button>
            </DialogClose>
            {state.status === "saved" ? (
              <DialogClose asChild>
                <Button variant="accent">Saved</Button>
              </DialogClose>
            ) : (
              <SubmitButton label="Save name" pendingLabel="Saving…" />
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Deleting a file (US-C4).
 *
 * Confirmed, but without the type-to-confirm a subject demands. Friction should
 * match the loss: a subject takes a term of work with it, one file takes
 * itself. Making both feel equally dangerous is what teaches students to click
 * through the one that matters.
 *
 * What the copy has to be honest about is that the FILE goes, not just the
 * entry — a student who thinks the original is still somewhere will not keep
 * their own copy.
 */
function DeleteMaterialDialog({ material }: { material: Material }) {
  const [state, formAction] = useActionState(deleteMaterialAction, initialMaterialState);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Delete ${material.title}`}>
          <Trash2 aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete “{material.title}”?</DialogTitle>
        <DialogDescription>
          The uploaded file is removed from storage, not just hidden. Anything generated from it
          goes with it, and there is no copy.
        </DialogDescription>

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="id" value={material.id} />

          {state.status === "error" && state.message && (
            <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle">Keep it</Button>
            </DialogClose>
            <DeleteButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MaterialRow({
  material,
  topics,
}: {
  material: Material;
  topics: { id: string; name: string }[];
}) {
  const Icon = KIND_ICONS[material.kind];
  const [isMoving, startMoving] = useTransition();
  const [moveError, setMoveError] = useState<string | null>(null);
  const topicSelectId = useId();

  function moveToTopic(next: string) {
    setMoveError(null);
    startMoving(async () => {
      const result = await setMaterialTopicAction(material.id, next || null);
      if (result.status === "error") setMoveError(result.message ?? "That did not save.");
    });
  }

  return (
    <li className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface-sunken sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <Icon className="hidden size-4 shrink-0 text-ink-subtle sm:block" aria-hidden />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{material.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-subtle">
          <span>{KIND_LABELS[material.kind]}</span>
          {material.byteSize !== null && (
            <>
              <span aria-hidden>·</span>
              <span className="tabular">{formatBytes(material.byteSize)}</span>
            </>
          )}
          {material.pageCount !== null && (
            <>
              <span aria-hidden>·</span>
              <span className="tabular">{material.pageCount} pages</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{relative(material.createdAt)}</span>
        </div>

        {/* A failure states the stage AND what to do, never just "failed"
            (docs/states.md §5). */}
        {material.failureMessage && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-bad">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {material.failureMessage} {material.failureNextStep}
            </span>
          </p>
        )}

        {moveError && (
          <p role="alert" className="mt-1.5 text-xs text-bad">
            {moveError}
          </p>
        )}
      </div>

      {/* Re-filing from the library, because the topic a file belongs to is the
          thing students most often get wrong at upload time — it did not exist
          yet, or the file turned out to be about something else. */}
      {topics.length > 0 ? (
        <div className="shrink-0 sm:w-44">
          <label htmlFor={topicSelectId} className="sr-only">
            Topic for {material.title}
          </label>
          <Select
            id={topicSelectId}
            value={material.topicId ?? ""}
            disabled={isMoving}
            onChange={(event) => moveToTopic(event.target.value)}
            className={cn("h-9 text-sm", isMoving && "opacity-70")}
          >
            <option value="">No topic</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        material.topicName && <Tag className="shrink-0">{material.topicName}</Tag>
      )}

      <div className="flex shrink-0 items-center gap-1">
        <StatusBadge status={material.status} />
        <RenameDialog material={material} />
        <DeleteMaterialDialog material={material} />
      </div>
    </li>
  );
}
