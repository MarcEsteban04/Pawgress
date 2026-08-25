import "server-only";

import { createSupabaseServerClient } from "./server";

/**
 * Storage paths and signed URLs (Sprint 16 — FR-U9, NFR-S2).
 *
 * **The path convention is the security model.** Storage policies decide
 * ownership by comparing the first folder segment of an object's name against
 * `auth.uid()`, so an object written anywhere else is either rejected or —
 * worse, if the policies were ever loosened — orphaned from its owner. Building
 * paths by hand at each call site is how that goes wrong, so every path in the
 * app comes from `objectPath()` below.
 */

export const BUCKETS = {
  materials: "materials",
  avatars: "avatars",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Mirrors `file_size_limit` on the buckets. The database is the real limit. */
export const BUCKET_LIMITS = {
  materials: 25 * 1024 * 1024,
  avatars: 2 * 1024 * 1024,
} as const;

export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** How long a signed URL lives. Long enough to load a page, short enough to be
 *  useless if it leaks into a log or a `Referer` header. */
const SIGNED_URL_SECONDS = 60 * 30;

/**
 * Strips a filename down to something safe to put in a path.
 *
 * Uploaded filenames are untrusted input (NFR-S5). This one is not about
 * injection into a prompt — it is about `../` climbing out of the owner's
 * folder, and about the assorted characters that make an object name
 * unaddressable later.
 */
export function safeFileName(raw: string): string {
  const trimmed = raw.normalize("NFKD").replace(/[^\w.\- ]+/g, "");
  const cleaned = trimmed
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, "-")
    .replace(/^[.-]+/, "");
  const fallback = cleaned.length > 0 ? cleaned : "file";
  // Object names have a length limit and a very long one helps nobody.
  return fallback.slice(-120);
}

/**
 * The only way a path should ever be built.
 *
 * `userId` first, always — that segment is what every storage policy reads.
 */
export function objectPath(userId: string, ...segments: string[]): string {
  const parts = segments
    .filter((segment) => segment.length > 0)
    .map((segment) => safeFileName(segment));
  return [userId, ...parts].join("/");
}

/** True when a path belongs to this user. Used to refuse a path from a form. */
export function pathBelongsTo(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`);
}

/**
 * A short-lived URL for a private object (NFR-S2).
 *
 * Returns null rather than throwing: a missing avatar should render the
 * initials fallback, not take the settings page down with it.
 */
export async function createSignedUrl(
  bucket: BucketName,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Every object a student owns, across both buckets.
 *
 * `list()` is not recursive, so this walks one level of prefixes — which is all
 * the layout has: `{userId}/avatars/…` and `{userId}/materials/…`.
 */
async function listUserObjects(bucket: BucketName, userId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const paths: string[] = [];

  const { data: top } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
  for (const entry of top ?? []) {
    // A folder has no `id`; a file does.
    if (entry.id) {
      paths.push(`${userId}/${entry.name}`);
      continue;
    }
    const { data: inner } = await supabase.storage
      .from(bucket)
      .list(`${userId}/${entry.name}`, { limit: 1000 });
    for (const file of inner ?? []) {
      if (file.id) paths.push(`${userId}/${entry.name}/${file.name}`);
    }
  }

  return paths;
}

/**
 * Removes everything a student owns, through the Storage API (NFR-P3).
 *
 * This cannot be done in SQL: Supabase blocks `delete from storage.objects`
 * precisely because the row is only the index entry and the bytes would be left
 * behind, unreachable and still billed. Account deletion calls this BEFORE
 * removing the auth user, so a failure here leaves the account intact rather
 * than orphaning a semester of uploads.
 *
 * Returns false if any bucket failed, so the caller can stop.
 */
export async function removeAllUserObjects(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  for (const bucket of Object.values(BUCKETS)) {
    const paths = await listUserObjects(bucket, userId);
    if (paths.length === 0) continue;

    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) return false;
  }

  return true;
}
