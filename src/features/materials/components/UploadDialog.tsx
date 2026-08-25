"use client";

import { CircleCheck, FileText, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
import { putWithProgress, runWithConcurrency } from "@/features/materials/transfer";
import { type DuplicateMaterial } from "@/features/materials/types";
import {
  formatBytes,
  MATERIAL_EXTENSIONS,
  MATERIAL_MIME_TYPES,
  materialKindFor,
  titleFromFileName,
} from "@/features/materials/upload";
import { BUCKET_LIMITS } from "@/features/settings/limits";
import { validateUpload } from "@/lib/validation/files";
import { type Topic } from "@/server/topics/queries";
import { cn } from "@/lib/utils";

/**
 * Upload files into a subject (FR-U1, FR-U2, FR-U3, FR-U8, US-C1, US-C2).
 *
 * **The bytes go browser → Supabase Storage, never through Next.** A Server
 * Action body is capped at 1 MB by default and around 4.5 MB on a serverless
 * host, both well under the 25 MB the bucket accepts, so proxying the file
 * would fail on exactly the files students most want to upload. A Server Action
 * mints a signed upload URL, the browser PUTs to it, a second action verifies
 * what landed, and a third records the row. See `../upload.ts`.
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
 * **Every file is its own transfer, with its own bar, its own cancel and its
 * own retry** (FR-U3). One failing does not fail the others, and each is named
 * — "3 of 5 uploaded" with no names leaves a student re-picking all five.
 *
 * What is deliberately NOT here is resumability. A cancelled or dropped upload
 * starts over rather than continuing from where it stopped; that needs a
 * resumable protocol (Supabase speaks TUS) and is worth its own sprint at a
 * file size where it matters. At 25 MB, retrying is cheaper than the machinery.
 */

type FileState = {
  id: string;
  file: File;
  status: "pending" | "hashing" | "uploading" | "checking" | "duplicate" | "done" | "error";
  /** 0–1 while uploading. */
  progress: number;
  message?: string;
  nextStep?: string;
  /** Set when the same bytes are already in the library (FR-U8). */
  duplicate?: DuplicateMaterial;
  /** True once the student has chosen to upload despite the duplicate. */
  allowDuplicate?: boolean;
};

const BUSY_STATUSES: FileState["status"][] = ["hashing", "uploading", "checking"];
const isBusy = (entry: FileState) => BUSY_STATUSES.includes(entry.status);

let counter = 0;
const nextId = () => `file-${(counter += 1)}`;

export function UploadDialog({
  subjectId,
  topics,
  fixedTopic,
  trigger,
}: {
  subjectId: string;
  topics: Topic[];
  /**
   * Opened from a topic row, so the destination is already decided.
   *
   * The select is not merely pre-filled — it is removed. A student who clicked
   * "upload" ON a topic has already answered that question, and leaving the
   * control there invites them to answer it twice and disagree with themselves.
   */
  fixedTopic?: { id: string; name: string };
  trigger?: React.ReactNode;
}) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [topicId, setTopicId] = useState(fixedTopic?.id ?? "");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const topicSelectId = useId();

  /* One controller per file, outside state: aborting is an imperative act on a
     live request, and holding a controller in state would let a stale render
     abort a request that had already finished. */
  const controllers = useRef(new Map<string, AbortController>());

  const limitMb = Math.round(BUCKET_LIMITS.materials / (1024 * 1024));
  const queued = files.filter((entry) => entry.status === "pending" || entry.status === "error");
  const duplicates = files.filter((entry) => entry.status === "duplicate").length;
  const uploaded = files.filter((entry) => entry.status === "done").length;
  const inFlight = files.some(isBusy);

  /**
   * Closing the tab mid-upload loses the transfer, so say so.
   *
   * Registered only while something is actually in flight. A permanent
   * `beforeunload` handler is the reason browsers started ignoring them.
   */
  useEffect(() => {
    if (!inFlight) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [inFlight]);

  function update(id: string, patch: Partial<FileState>) {
    setFiles((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  function addFiles(picked: FileList | File[]) {
    const incoming = Array.from(picked).map((file) => ({
      id: nextId(),
      file,
      status: "pending" as const,
      progress: 0,
    }));
    /* Appended rather than replacing: dropping a second batch should add to the
       first, which is what "multiple files in one action" means in practice. */
    setFiles((current) => [...current, ...incoming]);
  }

  function removeFile(id: string) {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    setFiles((current) => current.filter((entry) => entry.id !== id));
  }

  function cancelFile(id: string) {
    controllers.current.get(id)?.abort();
  }

  /** Uploads one file end to end. Never throws — the caller runs a batch. */
  async function uploadOne(entry: FileState): Promise<void> {
    const controller = new AbortController();
    controllers.current.set(entry.id, controller);

    const finish = (patch: Partial<FileState>) => {
      controllers.current.delete(entry.id);
      update(entry.id, patch);
    };

    const checked = await validateUpload(entry.file, {
      accept: MATERIAL_MIME_TYPES,
      maxBytes: BUCKET_LIMITS.materials,
      label: "PDF, Word, PowerPoint file or image",
    });

    if (!checked.ok) {
      finish({
        status: "error",
        message: checked.error.message,
        nextStep: checked.error.nextStep,
      });
      return;
    }

    /* Hashing a 20 MB file is not instantaneous, so it gets its own status
       rather than sitting under "uploading" — a bar at 0% that has not started
       moving reads as a stall. */
    update(entry.id, { status: "hashing", progress: 0 });
    const contentHash = await hashFile(entry.file);
    if (controller.signal.aborted) {
      finish({ status: "pending", progress: 0 });
      return;
    }

    const ticket = await createUploadTicketAction({
      subjectId,
      fileName: entry.file.name,
      mimeType: entry.file.type,
      byteSize: entry.file.size,
      contentHash,
      allowDuplicate: entry.allowDuplicate ?? false,
    });

    if (ticket.status === "duplicate") {
      finish({ status: "duplicate", duplicate: ticket.existing });
      return;
    }

    if (ticket.status === "error") {
      finish({ status: "error", message: ticket.message, nextStep: ticket.nextStep });
      return;
    }

    const { path, signedUrl } = ticket.ticket;

    update(entry.id, { status: "uploading", progress: 0 });
    const transfer = await putWithProgress({
      url: signedUrl,
      file: entry.file,
      signal: controller.signal,
      onProgress: ({ ratio }) => update(entry.id, { progress: ratio }),
    });

    if (transfer.status === "cancelled") {
      /* A cancelled PUT may still have written a partial object. Removing it
         costs one call and avoids paying for bytes nothing points at. */
      await discardUploadAction(path);
      finish({ status: "pending", progress: 0 });
      return;
    }

    if (transfer.status === "error") {
      finish({ status: "error", message: transfer.message, nextStep: transfer.nextStep });
      return;
    }

    /* The real gate. Everything before this ran in a browser and could have
       been skipped; this reads what actually landed in the bucket. A file that
       fails is removed by the action, so there is nothing to clean up here. */
    update(entry.id, { status: "checking" });
    const verified = await verifyUploadAction({ path, mimeType: entry.file.type });

    if (verified.status === "error") {
      finish({ status: "error", message: verified.message, nextStep: verified.nextStep });
      return;
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
      finish({ status: "error", message: recorded.message, nextStep: recorded.nextStep });
      return;
    }

    finish({
      status: "done",
      progress: 1,
      message: undefined,
      nextStep: undefined,
      duplicate: undefined,
    });
  }

  async function runBatch(entries: FileState[]) {
    if (entries.length === 0) return;
    setBusy(true);
    await runWithConcurrency(entries.map((entry) => () => uploadOne(entry)));
    setBusy(false);
  }

  /** Retry one file without re-picking it (US-C1). */
  function retryOne(id: string) {
    const entry = files.find((item) => item.id === id);
    if (entry) void runBatch([{ ...entry, status: "pending", message: undefined }]);
  }

  /** "Upload it anyway" on a duplicate — retried with the check waived. */
  function uploadAnyway(id: string) {
    const entry = files.find((item) => item.id === id);
    if (entry) void runBatch([{ ...entry, allowDuplicate: true, duplicate: undefined }]);
  }

  function uploadAll() {
    /* A file already flagged as a duplicate is skipped. The student has been
       asked and has not answered, and uploading it regardless would be
       answering for them. */
    void runBatch(files.filter((entry) => entry.status === "pending" || entry.status === "error"));
  }

  function reset() {
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();
    setFiles([]);
    setTopicId(fixedTopic?.id ?? "");
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
        <DialogTitle>
          {fixedTopic ? "Upload to " + fixedTopic.name : "Upload to this subject"}
        </DialogTitle>
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

          {topics.length > 0 && !fixedTopic && (
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
            <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
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
                    <p className="tabular mt-0.5 text-xs text-ink-subtle">
                      {formatBytes(entry.file.size)}
                      {materialKindFor(entry.file.type) === null && " · unsupported type"}
                      {entry.status === "hashing" && " · checking for a duplicate…"}
                      {entry.status === "uploading" &&
                        ` · ${Math.round(entry.progress * 100)}% uploaded`}
                      {entry.status === "checking" && " · verifying…"}
                      {entry.status === "done" && " · added"}
                    </p>

                    {/* A real bar, driven by real bytes. `checking` keeps it
                        full rather than hiding it, because the transfer IS
                        finished — what follows is the server reading it. */}
                    {(entry.status === "uploading" || entry.status === "checking") && (
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-rule"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(entry.progress * 100)}
                        aria-label={`Uploading ${entry.file.name}`}
                      >
                        <div
                          className="h-full rounded-[var(--radius-pill)] bg-accent transition-[width] duration-200 ease-out"
                          style={{ width: `${Math.max(2, entry.progress * 100)}%` }}
                        />
                      </div>
                    )}

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

                    {/* The reason, the next step, and a retry that does not ask
                        for the file again (US-C1). */}
                    {entry.status === "error" && (
                      <div className="mt-1.5 flex flex-col items-start gap-1.5">
                        <p className="text-xs text-bad">
                          {entry.message} {entry.nextStep}
                        </p>
                        <Button
                          variant="subtle"
                          size="sm"
                          disabled={busy}
                          onClick={() => retryOne(entry.id)}
                        >
                          Try this one again
                        </Button>
                      </div>
                    )}
                  </div>

                  {isBusy(entry) ? (
                    <button
                      type="button"
                      onClick={() => cancelFile(entry.id)}
                      className="shrink-0 rounded-[var(--radius-pill)] px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:text-bad"
                    >
                      Cancel
                    </button>
                  ) : (
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
