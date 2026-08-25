"use client";

import { Trash2, Upload } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Avatar, Button, ErrorState } from "@/components/ui";
import { downscaleImage, formatBytes } from "@/features/settings/downscale";
import { initialSettingsState } from "@/features/settings/types";
import { removeAvatarAction, uploadAvatarAction } from "@/features/settings/server/actions";
import { AVATAR_MIME_TYPES, BUCKET_LIMITS } from "@/features/settings/limits";

/**
 * Profile picture (FR-A7).
 *
 * The file input is hidden behind a real button rather than styled directly:
 * `input[type=file]` cannot be restyled consistently across browsers, and the
 * usual workarounds break keyboard focus. This keeps one focusable control that
 * forwards its click.
 *
 * Submitting on selection removes a step nobody wants — nobody picks an avatar
 * and then reconsiders whether to press Save.
 *
 * **The picked file is shrunk before it is sent.** See `../downscale.ts`: an
 * avatar renders at 64px, so a phone photo would otherwise be stored and
 * re-served at full size on every page that shows it. The resized file is put
 * back into the input through a `DataTransfer` so the ordinary form submission
 * carries it — no hand-rolled fetch, and the action keeps working exactly as
 * it did. If resizing fails for any reason the original is submitted, and the
 * server's own validation is unchanged either way.
 */

/** Lives inside the form so useFormStatus can see the submission. */
function ChooseButton({ onPick, preparing }: { onPick: () => void; preparing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="button"
      variant="subtle"
      size="sm"
      onClick={onPick}
      disabled={pending || preparing}
    >
      <Upload aria-hidden />
      {preparing ? "Preparing…" : pending ? "Uploading…" : "Change picture"}
    </Button>
  );
}

export function AvatarField({
  name,
  avatarUrl,
  hasAvatar,
}: {
  name: string;
  avatarUrl: string | null;
  hasAvatar: boolean;
}) {
  const [state, formAction] = useActionState(uploadAvatarAction, initialSettingsState);
  const [removeState, setRemoveState] = useState(initialSettingsState);
  const [isRemoving, startRemoving] = useTransition();
  const [preparing, setPreparing] = useState(false);
  const [resizeNote, setResizeNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const limitMb = Math.round(BUCKET_LIMITS.avatars / (1024 * 1024));
  const error =
    state.status === "error" ? state : removeState.status === "error" ? removeState : null;

  async function onPicked() {
    const picked = fileInput.current?.files?.[0];
    if (!picked) return;

    setPreparing(true);
    setResizeNote(null);

    try {
      const result = await downscaleImage(picked);

      /* Writing to `input.files` does not fire another change event, so this
         cannot loop back into itself. `DataTransfer` is the only way to build a
         FileList — it cannot be constructed directly. */
      if (result.changed && fileInput.current && typeof DataTransfer !== "undefined") {
        const transfer = new DataTransfer();
        transfer.items.add(result.file);
        fileInput.current.files = transfer.files;
        setResizeNote(
          `Resized ${formatBytes(result.originalBytes)} → ${formatBytes(result.file.size)} before upload.`,
        );
      }
    } finally {
      // Submit either way: a failed resize is not a failed upload.
      setPreparing(false);
      formRef.current?.requestSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error?.message && <ErrorState title={error.message} nextStep={error.nextStep ?? ""} />}

      <div className="flex items-center gap-4">
        <Avatar name={name} src={avatarUrl} size="lg" tone={1} className="size-16 text-base" />

        <div className="flex flex-col gap-2">
          <form ref={formRef} action={formAction} className="contents">
            <input
              ref={fileInput}
              type="file"
              name="avatar"
              accept={AVATAR_MIME_TYPES.join(",")}
              className="sr-only"
              onChange={onPicked}
            />
            <div className="flex flex-wrap items-center gap-2">
              <ChooseButton onPick={() => fileInput.current?.click()} preparing={preparing} />

              {hasAvatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isRemoving}
                  onClick={() =>
                    startRemoving(async () => setRemoveState(await removeAvatarAction()))
                  }
                >
                  <Trash2 aria-hidden />
                  {isRemoving ? "Removing…" : "Remove"}
                </Button>
              )}
            </div>
          </form>

          <p className="text-sm text-ink-subtle">
            JPG, PNG or WebP, up to {limitMb} MB. Large pictures are shrunk automatically. Only you
            can see it.
          </p>

          {state.status === "saved" && resizeNote && (
            <p className="text-ok text-sm" role="status">
              {resizeNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
