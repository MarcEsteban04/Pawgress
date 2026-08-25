/**
 * Upload limits, safe to import from a client component.
 *
 * `lib/supabase/storage.ts` carries `import "server-only"`, so the form cannot
 * read them from there. These are mirrors for display and a first-pass check;
 * the bucket's own `file_size_limit` and `allowed_mime_types` are what actually
 * enforce them, and they cannot be edited out in a browser console.
 *
 * Keep in step with supabase/migrations/20260826150000_storage_buckets.sql.
 */
export const BUCKET_LIMITS = {
  materials: 25 * 1024 * 1024,
  avatars: 25 * 1024 * 1024,
} as const;

export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
