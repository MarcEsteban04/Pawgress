"use client";

import { CircleCheck, FileText, Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Field,
  Select,
} from "@/components/ui";
import { hashFile } from "@/features/materials/hash";
import {
  createUploadTicketAction,
  discardUploadAction,
  recordMaterialAction,
  verifyUploadAction,
} from "@/features/materials/server/actions";
import { type DuplicateMaterial } from "@/features/materials/types";
import {
  formatBytes,
  MATERIAL_EXTENSIONS,
  MATERIAL_MIME_TYPES,
  materialKindFor,
  titleFromFileName,
} from "@/features/materials/upload";
import { BUCKET_LIMITS } from "@/features/settings/limits";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { validateUpload } from "@/lib/validation/files";
import { type Topic } from "@/server/topics/queries";
import { cn } from "@/lib/utils";

/**
 * Upload files into a subject (FR-U1, FR-U2, FR-U8, US-C1, US-C2).
 *
 * **The bytes go browser → Supabase Storage, never through Next.** A Server
 * Action body is capped at 1 MB by default and around 4.5 MB on a serverless
 * host, both well under the 25 MB the bucket accepts, so proxying the file
 * would fail on exactly the files students most want to upload. Instead a
 * Server Action mints a signed upload URL, the browser PUTs to it, a second
 * action verifies what landed, and a third records the row. See `../upload.ts`.
 *
 * **Four checks, and only one of them is a gate.** In order:
 *
 *  1. `validateUpload()` here, reading the file's leading bytes — instant
 *     feedback, so a student is not told after 20 MB has travelled. Runs in a
 *     browser, so it proves nothing.
 *  2. A SHA-256 of the contents, to ask whether this file is already in the
 *     library before spending the upload at all (FR-U8).
 *  3. The ticket action, which checks type, size, name and subject ownership
 *     before anything can be written.
 *  4. `verifyUploadAction()`, which reads what is actually in the bucket. This
 *     is the gate — everything above it can be skipped by anyone who wants to.
 *
 * **One file failing does not fail the others** (US-C1). Each is tracked
 * independently and reported by name, because "3 of 5 uploaded" with no names
 * leaves a student re-picking all five.
 *
 * Per-file progress bars and cancel are Sprint 27. The plumbing here is chosen
 * so they can be added without rewriting it: a browser upload can report
 * progress and be aborted, which a Server Action cannot.
 */

type FileState = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "duplicate" | "done" | "error";
  message?: string;
  nextStep?: string;
  /** Set when the same bytes are already in the library (FR-U8). */
  duplicate?: DuplicateMaterial;
  /** True once the student has chosen to upload despite the duplicate. */
  allowDuplicate?: boolean;
};

let counter = 0;
const nextId = () => `file-${(counter += 1)}`;

export function UploadDialog({
  subjectId,
  topics,
  trigger,
}: {
  subjectId: string;
  topics: Topic[];
  trigger?: React.ReactNode;
}) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [topicId, setTopicId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const topicSelectId = useId();

  const limitMb = Math.round(BUCKET_LIMITS.materials / (1024 * 1024));
  const queued = files.filter((entry) => entry.status === "pending" || entry.status === "error");
  const duplicates = files.filter((entry) => entry.status === "duplicate").length;
  const uploaded = files.filter((entry) => entry.status === "done").length;

  function addFiles(picked: FileList | File[]) {
    const incoming = Array.from(picked).map((file) => ({
      id: nextId(),
      file,
      status: "pending" as const,
    }));
    /* Appended rather than replacing: dropping a second batch should add to the
       first, which is what "multiple files in one action" means in practice. */
    setFiles((current) => [...current, ...incoming]);
  }

  function removeFile(id: string) {
    setFiles((current) => current.filter((item) => item.id !== id));
  }

  /** Uploads one file end to end. Never throws — the caller runs a batch. */
  async function uploadOne(entry: FileState): Promise<FileState> {
    const checked = await validateUpload(entry.file, {
      accept: MATERIAL_MIME_TYPES,
      maxBytes: BUCKET_LIMITS.materials,
      label: "PDF, Word, PowerPoint file or image",
    });

    if (!checked.ok) {
      return {
        ...entry,
        status: "error",
        message: checked.error.message,
        nextStep: checked.error.nextStep,
      };
    }

    /* Hashed before a ticket is asked for, so a file already in the library
       never costs the upload. Null when SubtleCrypto is unavailable, which
       disables duplicate detection rather than blocking anything. */
    const contentHash = await hashFile(entry.file);

    const ticket = await createUploadTicketAction({
      subjectId,
      fileName: entry.file.name,
      mimeType: entry.file.type,
      byteSize: entry.file.size,
      contentHash,
      allowDuplicate: entry.allowDuplicate ?? false,
    });

    if (ticket.status === "duplicate") {
      return { ...entry, status: "duplicate", duplicate: ticket.existing };
    }

    if (ticket.status === "error") {
      return { ...entry, status: "error", message: ticket.message, nextStep: ticket.nextStep };
    }

    const { path, token } = ticket.ticket;
    const supabase = getSupabaseBrowserClient();

    const { error: uploadError } = await supabase.storage
      .from("materials")
      .uploadToSignedUrl(path, token, entry.file, { contentType: entry.file.type });

    if (uploadError) {
      return {
        ...entry,
        status: "error",
        message: "That file did not finish uploading.",
        nextStep: "Check your connection and try again.",
      };
    }

    /* The real gate. Everything before this ran in a browser and could have
       been skipped; this reads what actually landed in the bucket. A file that
       fails is removed by the action, so there is nothing to clean up here. */
    const verified = await verifyUploadAction({ path, mimeType: entry.file.type });

    if (verified.status === "error") {
      return { ...entry, status: "error", message: verified.message, nextStep: verified.nextStep };
    }

    const recorded = await recordMaterialAction({
      subjectId,
      topicId: topicId || null,
      path,
      fileName: entry.file.name,
      title: titleFromFileName(entry.file.name),
      mimeType: entry.file.type,
      byteSize: entry.file.size,
      contentHash,
    });

    if (recorded.status === "error") {
      // The bytes landed but nothing points at them. Do not leave them behind.
      await discardUploadAction(path);
      return {
        ...entry,
        status: "error",
        message: recorded.message,
        nextStep: recorded.nextStep,
      };
    }

    return {
      ...entry,
      status: "done",
      message: undefined,
      nextStep: undefined,
      duplicate: undefined,
    };
  }

  /** "Upload it anyway" on a duplicate — retried with the check waived. */
  async function uploadAnyway(id: string) {
    const entry = files.find((item) => item.id === id);
    if (!entry) return;

    setBusy(true);
    setFiles((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: "uploading" as const, duplicate: undefined } : item,
      ),
    );

    const result = await uploadOne({ ...entry, allowDuplicate: true });
    setFiles((current) => current.map((item) => (item.id === id ? result : item)));
    setBusy(false);
  }

  async function uploadAll() {
    setBusy(true);

    /* A file already flagged as a duplicate is skipped. The student has been
       asked and has not answered, and uploading it regardless would be
       answering for them. */
    const skip = (entry: FileState) => entry.status === "done" || entry.status === "duplicate";
    const targets = files.filter((entry) => !skip(entry));

    setFiles((current) =>
      current.map((entry) => (skip(entry) ? entry : { ...entry, status: "uploading" as const })),
    );

    /* Sequential, not concurrent. Ten parallel 20 MB uploads compete for one
       connection and every one of them gets slower; worse, a student watching
       ten stalled rows cannot tell whether anything is happening. One at a time
       finishes files in a visible order. Concurrency is a Sprint 27 decision,
       once there are real progress bars to justify it. */
    for (const entry of targets) {
      const result = await uploadOne(entry);
      setFiles((current) => current.map((item) => (item.id === entry.id ? result : item)));
    }

    setBusy(false);
  }

  function reset() {
    setFiles([]);
    setTopicId("");
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <Dialog onOpenChange={(open) => !open && reset()}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="accent">
            <Upload aria-hidden />
            Upload files
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>Upload to this subject</DialogTitle>
        <DialogDescription>
          PDF, Word, PowerPoint or photos, up to {limitMb} MB each. Everything Pawgress generates is
          built from these.
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-4">
          {/* A label wrapping a hidden input, so the whole zone is one keyboard
              target rather than a div with a click handler beside a button. */}
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-tile)] border border-dashed px-4 py-8 text-center transition-colors",
              dragging ? "border-accent bg-accent-soft" : "border-rule-strong hover:border-ink",
            )}
          >
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={`${MATERIAL_MIME_TYPES.join(",")},${MATERIAL_EXTENSIONS}`}
              className="sr-only"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
              }}
            />
            <Upload className="size-5 text-ink-subtle" aria-hidden />
            <span className="text-[0.9375rem] font-medium">
              Drop files here, or click to choose
            </span>
            <span className="text-sm text-ink-subtle">You can pick more than one.</span>
          </label>

          {topics.length > 0 && (
            <Field label="File under a topic" htmlFor={topicSelectId} optional>
              <Select
                id={topicSelectId}
                value={topicId}
                onChange={(event) => setTopicId(event.target.value)}
              >
                <option value="">Just the subject</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {files.length > 0 && (
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {files.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 rounded-[var(--radius-tile)] bg-surface-sunken p-3"
                >
                  {entry.status === "done" ? (
                    <CircleCheck className="text-ok mt-0.5 size-4 shrink-0" aria-hidden />
                  ) : (
                    <FileText className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.file.name}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      {formatBytes(entry.file.size)}
                      {materialKindFor(entry.file.type) === null && " · unsupported type"}
                      {entry.status === "uploading" && " · uploading…"}
                      {entry.status === "done" && " · added"}
                    </p>

                    {/* A duplicate is not an error and is not styled as one.
                        Re-using the same handout in a second subject is a
                        legitimate thing to want, so this names what was found
                        and offers both answers (FR-U8, US-C1). */}
                    {entry.status === "duplicate" && entry.duplicate && (
                      <div className="mt-1.5 flex flex-col items-start gap-1.5">
                        <p className="text-xs text-warn">
                          You already have these exact contents as “{entry.duplicate.title}”
                          {entry.duplicate.sameSubject
                            ? " in this subject."
                            : " in " + entry.duplicate.subjectName + "."}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="subtle"
                            size="sm"
                            disabled={busy}
                            onClick={() => uploadAnyway(entry.id)}
                          >
                            Upload anyway
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => removeFile(entry.id)}>
                            Skip it
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* The reason AND the next step, per file, by name. A batch
                        that reports "2 failed" makes a student re-pick all of
                        them (US-C2). */}
                    {entry.status === "error" && (
                      <p className="mt-1 text-xs text-bad">
                        {entry.message} {entry.nextStep}
                      </p>
                    )}
                  </div>

                  {entry.status !== "uploading" && (
                    <button
                      type="button"
                      aria-label={`Remove ${entry.file.name}`}
                      onClick={() => removeFile(entry.id)}
                      className="shrink-0 rounded-full p-1 text-ink-subtle transition-colors hover:text-ink"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {duplicates > 0 && (
            <p className="text-sm text-ink-muted" role="status">
              {duplicates} {duplicates === 1 ? "file is" : "files are"} already in your library.
              Choose what to do with {duplicates === 1 ? "it" : "them"} above.
            </p>
          )}

          {uploaded > 0 && (
            <p className="text-ok text-sm" role="status">
              {uploaded} {uploaded === 1 ? "file" : "files"} added. They are queued for processing —
              text extraction arrives in a later sprint.
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="subtle">{uploaded > 0 ? "Done" : "Cancel"}</Button>
          </DialogClose>
          <Button variant="accent" onClick={uploadAll} disabled={busy || queued.length === 0}>
            {busy
              ? "Uploading…"
              : queued.some((entry) => entry.status === "error")
                ? `Retry ${queued.length}`
                : `Upload ${queued.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
