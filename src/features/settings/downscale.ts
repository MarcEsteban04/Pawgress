/**
 * Shrink an image in the browser before it is uploaded.
 *
 * An avatar renders at 36–64px. Without this, a photo straight off a phone is
 * stored at 20 MB and served at 20 MB behind that circle, on every page that
 * shows it — the student pays for it in load time, and the project pays for it
 * in egress. Raising the upload limit made this worse, not better: a limit is a
 * refusal, and a resize is what makes the refusal unnecessary.
 *
 * **This is a courtesy, not a control.** It runs in the browser, so it can be
 * skipped by anyone who wants to — the bucket's `file_size_limit`,
 * `allowed_mime_types` and the server's byte-sniffing check in
 * `validateUpload` are what actually decide whether an upload is accepted. If
 * anything here fails, the original file is returned and the server has the
 * final say, exactly as it did before.
 */

/**
 * 512px, not 64px.
 *
 * The largest place an avatar appears is 64px, and a 2× display asks for 128
 * real pixels. 512 leaves room for a larger use later — a profile header, an
 * export — without a re-upload, and still turns a 4000px photo into something
 * measured in tens of kilobytes.
 */
const MAX_EDGE = 512;

/** Quality 0.82 is where WebP stops being distinguishable at this size. */
const QUALITY = 0.82;

/** Below this, re-encoding is more likely to add bytes than remove them. */
const SKIP_UNDER_BYTES = 96 * 1024;

export type DownscaleResult = {
  file: File;
  /** True when the file was actually re-encoded, for the "saved N%" line. */
  changed: boolean;
  originalBytes: number;
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

export async function downscaleImage(file: File): Promise<DownscaleResult> {
  const unchanged: DownscaleResult = { file, changed: false, originalBytes: file.size };

  // A small file is already small. Re-encoding a 20 KB PNG icon can double it.
  if (file.size < SKIP_UNDER_BYTES) return unchanged;
  if (typeof createImageBitmap !== "function") return unchanged;

  try {
    /* `imageOrientation: "from-image"` applies the EXIF rotation tag. Without
       it, every portrait photo from a phone uploads sideways — the tag says
       "rotate 90°" and a canvas draw ignores it unless asked. */
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return unchanged;
    }

    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    /* WebP where it encodes, JPEG otherwise. Both are in AVATAR_MIME_TYPES, so
       either passes the server's check. PNG is deliberately not a target: a
       photograph in PNG is several times the size for no visible gain, and the
       one thing PNG is good at — transparency — an avatar is cropped to a
       circle anyway. */
    const blob =
      (await canvasToBlob(canvas, "image/webp")) ?? (await canvasToBlob(canvas, "image/jpeg"));

    if (!blob || blob.size >= file.size) return unchanged;

    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "avatar";

    return {
      file: new File([blob], `${base}.${extension}`, { type: blob.type }),
      changed: true,
      originalBytes: file.size,
    };
  } catch {
    // Any failure — an unreadable file, a browser without toBlob for WebP —
    // falls back to uploading what was picked. The server still validates it.
    return unchanged;
  }
}

/** "4.2 MB", "312 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
