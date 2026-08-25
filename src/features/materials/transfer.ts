/**
 * Uploading one file, with progress and a way to stop (FR-U3, US-C1).
 *
 * **XHR, not `fetch`, and not `supabase.storage.uploadToSignedUrl()`.** This is
 * the one place in the app that reaches for `XMLHttpRequest`, and the reason is
 * narrow: `fetch` still cannot report REQUEST progress in any browser. It
 * exposes a readable stream for the response and nothing for the body going
 * out, so a 20 MB upload through `fetch` is a spinner that ends when it ends.
 * `xhr.upload.onprogress` is the only way to answer "how far along is it?".
 *
 * Supabase's own helper wraps `fetch`, so it inherits the same blindness. The
 * signed URL it hands out is an ordinary endpoint, though, and a PUT against it
 * works exactly the same from XHR — so this trades one convenience method for
 * the two things US-C1 actually asks for.
 *
 * Cancellation is a real abort of the request, not a flag that hides the row.
 * A student who cancels a 20 MB upload on a phone plan means "stop sending
 * this", and continuing in the background while pretending to have stopped
 * would be spending their data behind their back.
 */

export type TransferProgress = {
  /** 0–1. Stays at 0 until the first progress event arrives. */
  ratio: number;
  loadedBytes: number;
  totalBytes: number;
};

export type TransferResult =
  | { status: "done" }
  | { status: "cancelled" }
  | { status: "error"; message: string; nextStep: string };

export function putWithProgress({
  url,
  file,
  onProgress,
  signal,
}: {
  url: string;
  file: File;
  onProgress: (progress: TransferProgress) => void;
  signal: AbortSignal;
}): Promise<TransferResult> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve({ status: "cancelled" });
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type);
    /* The path was minted for this upload and nothing should be sitting at it.
       Refusing to overwrite turns a collision into an error rather than the
       silent loss of whatever was there. */
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (event) => {
      /* `lengthComputable` is false while a proxy is buffering, and reporting
         a made-up ratio there is worse than reporting none — a bar that jumps
         to 90% and sits there is how progress bars lost their credibility. */
      if (!event.lengthComputable) return;
      onProgress({
        ratio: event.total > 0 ? event.loaded / event.total : 0,
        loadedBytes: event.loaded,
        totalBytes: event.total,
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // A completed upload is 100%, whether or not a final event arrived.
        onProgress({ ratio: 1, loadedBytes: file.size, totalBytes: file.size });
        resolve({ status: "done" });
        return;
      }

      /* 413 is the bucket refusing the size. It is worth separating because
         the student can act on it, and because reaching it means the size was
         wrong before the upload — which is a bug worth seeing in the message
         rather than a mystery. */
      resolve({
        status: "error",
        message:
          xhr.status === 413
            ? "That file is larger than the upload limit."
            : "That file did not finish uploading.",
        nextStep:
          xhr.status === 413
            ? "Export a smaller version, or split it into parts."
            : "Check your connection and try again.",
      });
    };

    xhr.onerror = () =>
      resolve({
        status: "error",
        message: "The connection dropped during that upload.",
        nextStep: "Check your connection and try again.",
      });

    xhr.ontimeout = () =>
      resolve({
        status: "error",
        message: "That upload timed out.",
        nextStep: "Try again — a slower connection may need a smaller file.",
      });

    xhr.onabort = () => resolve({ status: "cancelled" });

    signal.addEventListener("abort", () => xhr.abort(), { once: true });

    xhr.send(file);
  });
}

/**
 * Runs tasks with a ceiling on how many are in flight.
 *
 * Sprint 25 uploaded strictly one at a time, because ten stalled rows with no
 * progress tell a student nothing. Now that every row has its own bar the
 * argument changes, but only partly: unlimited concurrency makes every bar
 * crawl at once and the browser caps connections per host anyway.
 *
 * Two is the useful number. It overlaps one file's transfer with the next
 * file's ticket round trip — which is pure latency, not bandwidth — without
 * splitting the pipe so far that nothing visibly finishes.
 */
export async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit = 2): Promise<void> {
  let next = 0;

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const index = next++;
      await tasks[index]();
    }
  });

  await Promise.all(workers);
}
