"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
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
import { deleteMaterialAction, renameMaterialAction } from "@/features/materials/server/actions";
import { initialMaterialState } from "@/features/materials/types";
import { type Material } from "@/server/materials/queries";

/**
 * Rename and delete, shared by the library row and the file viewer.
 *
 * Extracted in Sprint 29 rather than copied: two dialogs that delete the same
 * thing will drift, and the copy here is doing real work — a student who thinks
 * the original upload survives will not keep their own copy.
 */

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

export function RenameMaterialDialog({
  material,
  trigger,
}: {
  material: Material;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  /* Remounts the form on every open. Without it `state.status` stays "saved"
     for the life of the page — and the footer swaps the submit button away on
     exactly that condition, so a file could be renamed once and then never
     again without a reload. Same fault as SubjectDialog; see the note there. */
  const [instance, setInstance] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setInstance((n) => n + 1);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" aria-label={`Rename ${material.title}`}>
            <Pencil aria-hidden />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <RenameMaterialForm key={instance} material={material} />
      </DialogContent>
    </Dialog>
  );
}

function RenameMaterialForm({ material }: { material: Material }) {
  const [state, formAction] = useActionState(renameMaterialAction, initialMaterialState);
  const titleId = useId();

  return (
    <>
      <DialogTitle>Rename file</DialogTitle>
      <DialogDescription>
        This changes what the file is called in Acadify. The original upload is untouched.
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
    </>
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
 * `redirectTo` exists because deleting from the viewer destroys the page it was
 * triggered from. Without it, revalidation re-renders a route whose material no
 * longer exists and the student lands on a 404 they did not ask for.
 */
export function DeleteMaterialDialog({
  material,
  redirectTo,
  trigger,
}: {
  material: Material;
  redirectTo?: string;
  trigger?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(deleteMaterialAction, initialMaterialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "saved" && redirectTo) {
      // `replace`, not `push`: the deleted file's URL must not be one Back returns to.
      router.replace(redirectTo);
    }
  }, [state.status, redirectTo, router]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" aria-label={`Delete ${material.title}`}>
            <Trash2 aria-hidden />
          </Button>
        )}
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
