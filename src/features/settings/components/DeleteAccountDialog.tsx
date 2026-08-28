"use client";

import { TriangleAlert } from "lucide-react";
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
import { initialSettingsState } from "@/features/settings/types";
import { deleteAccountAction } from "@/features/settings/server/actions";
import { DELETE_CONFIRMATION } from "@/lib/validation/profile";

/**
 * Delete the account (US-A5, FR-A8).
 *
 * Not `ConfirmDialog`: this one requires the student to TYPE a word, which is
 * the difference between an action you meant and a button you hit. The dialog
 * disables the button until the word matches, and the server checks it again —
 * a destructive action guarded only by client state is guarded by nothing.
 *
 * The consequences are listed as specifics rather than "this cannot be undone".
 * Someone about to lose a semester of uploads deserves to read what actually
 * goes (docs/design-system.md: ConfirmDialog requires a consequences line).
 */

function ConfirmButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={!enabled || pending}>
      {pending ? "Deleting…" : "Delete my account"}
    </Button>
  );
}

export function DeleteAccountDialog() {
  const [state, formAction] = useActionState(deleteAccountAction, initialSettingsState);
  const [typed, setTyped] = useState("");
  const confirmId = useId();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="danger">Delete account</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogDescription>
          This removes your uploads, the text extracted from them, everything Acadify generated, and
          every quiz result and mastery score. It cannot be undone, and there is no copy.
        </DialogDescription>

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          {state.status === "error" && state.message && (
            <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
          )}

          <Field
            label={`Type ${DELETE_CONFIRMATION} to confirm`}
            htmlFor={confirmId}
            error={state.fieldErrors?.confirmation}
          >
            <Input
              id={confirmId}
              name="confirmation"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              // Nothing here should be corrected, capitalised or predicted.
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={Boolean(state.fieldErrors?.confirmation)}
            />
          </Field>

          <div className="flex items-start gap-2 text-sm text-ink-muted">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
            <p>If you only want to sign out on this device, close this and use Sign out instead.</p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle">Keep my account</Button>
            </DialogClose>
            <ConfirmButton enabled={typed.trim() === DELETE_CONFIRMATION} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
