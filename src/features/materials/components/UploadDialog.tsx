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
import {
  createUploadTicketAction,
  discardUploadAction,
  recordMaterialAction,
} from "@/features/materials/server/actions";
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
 * Upload files into a subject (FR-U1, US-C1).
 *
 * **The bytes go browser → Supabase Storage, never through Next.** A Server
 * Action body is capped at 1 MB by default and around 4.5 MB on a serverless
 * host, both well under the 25 MB the bucket accepts, so proxying the file
 * would fail on exactly the files students most want to upload. Instead a
 * Server Action mints a signed upload URL, the browser PUTs to it, and a second
 * action records the row. See `../upload.ts`.
 *
 * **Files are validated here AND on the server, and neither is redundant.**
 * This side reads the leading bytes with the same Sprint 17 validator so a
 * student learns a file is wrong before waiting for 20 MB to travel. The server
 * checks type, size and subject ownership before minting a ticket, and the
 * bucket enforces its own limits — client checks are for speed, not for safety
 * (US-C2).
 *
 * **One file failing does not fail the others** (US-C1). Each is tracked
 * independently and reported by name, because "3 of 5 uploaded" with no names
 * leaves a student re-picking all five.
 *
 * Per-file progress bars, cancel and retry are Sprint 27. The plumbing here is
 * chosen so they can be added without rewriting this: a browser upload can
 * report progress and be aborted, which is another thing a Server Action
 * cannot do.
 */

type FileState = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  message?: string;
  nextStep?: string;
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

    const ticket = await createUploadTicketAction({
      subjectId,
      fileName: entry.file.name,
      mimeType: entry.file.type,
      byteSize: entry.file.size,
    });

    if (ticket.status === "error") {
      return { ...entry, status: "error", message: ticket.message, nextStep: ticket.nextStep };
    }

    const supabase = getSupabaseBrowserClient();
    const { error: uploadError } = await supabase.storage
      .from("materials")
      .uploadToSignedUrl(ticket.ticket.path, ticket.ticket.token, entry.file, {
        contentType: entry.file.type,
      });

    if (uploadError) {
      return {
        ...entry,
        status: "error",
        message: "That file did not finish uploading.",
        nextStep: "Check your connection and try again.",
      };
    }

    const recorded = await recordMaterialAction({
      subjectId,
      topicId: topicId || null,
      path: ticket.ticket.path,
      fileName: entry.file.name,
      title: titleFromFileName(entry.file.name),
      mimeType: entry.file.type,
      byteSize: entry.file.size,
    });

    if (recorded.status === "error") {
      // The bytes landed but nothing points at them. Do not leave them behind.
      await discardUploadAction(ticket.ticket.path);
      return {
        ...entry,
        status: "error",
        message: recorded.message,
        nextStep: recorded.nextStep,
      };
    }

    return { ...entry, status: "done", message: undefined, nextStep: undefined };
  }

  async function uploadAll() {
    setBusy(true);
    const targets = files.filter((entry) => entry.status !== "done");
    setFiles((current) =>
      current.map((entry) =>
        entry.status === "done" ? entry : { ...entry, status: "uploading" as const },
      ),
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
                      onClick={() =>
                        setFiles((current) => current.filter((item) => item.id !== entry.id))
                      }
                      className="shrink-0 rounded-full p-1 text-ink-subtle transition-colors hover:text-ink"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
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
          <Button
            variant="accent"
            onClick={uploadAll}
            disabled={busy || queued.length === 0}
            /* Labelled with the count so it is obvious how many are about to
               go, and which ones are retries. */
          >
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
