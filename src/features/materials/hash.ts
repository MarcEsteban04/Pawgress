/**
 * Content hash of a file, computed in the browser (FR-U8, US-C1).
 *
 * The hash identifies the BYTES, not the file. Two students uploading the same
 * lecture deck under different names produce the same hash; one student
 * uploading the same file twice under the same name also does. That is exactly
 * the question a duplicate check asks — "have I already got this?" — and a
 * filename cannot answer it, because the same handout arrives as
 * `lecture3.pdf`, `lecture3 (1).pdf` and `Lecture 3 FINAL.pdf`.
 *
 * Computed here rather than on the server for the same reason the upload
 * happens here: the server never sees these bytes. That makes the hash a CLAIM
 * rather than a proof, and it is treated as one — it is used to offer a
 * shortcut ("you already have this file"), never to grant access to anything.
 * The worst a forged hash achieves is being shown one's own existing material.
 *
 * SHA-256 via SubtleCrypto, which is hardware-accelerated and available in
 * every browser this app supports. It needs a secure context, so it is present
 * on https and on localhost, and absent on a plain-http origin — hence the
 * null return rather than a throw: a missing hash disables duplicate detection
 * and nothing else.
 */
export async function hashFile(file: File): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;

  try {
    /* The whole file is read into memory. At the 25 MB bucket limit that is
       acceptable; a browser holding one 25 MB ArrayBuffer briefly is far less
       than the tab already uses. If materials ever grow past that, this becomes
       an incremental hash over a stream — the call site would not change. */
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);

    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    // A file that cannot be read will fail the upload itself with a better
    // message than this function could produce.
    return null;
  }
}
