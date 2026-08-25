"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AVATAR_MIME_TYPES,
  BUCKET_LIMITS,
  BUCKETS,
  objectPath,
  removeAllUserObjects,
} from "@/lib/supabase/storage";
import { DELETE_CONFIRMATION, profileSchema } from "@/lib/validation/profile";
import { requireSession } from "@/server/auth/session";
import { getProfile } from "@/server/profile/queries";
import { type SettingsFormState } from "../types";

/**
 * Settings actions (Sprint 15 — US-A5, FR-A7, FR-A8).
 *
 * Only async functions may be exported from a `"use server"` module, so the
 * state type and its initial value live in `../types.ts`.
 */

export async function updateProfileAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireSession();

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    yearLevel: formData.get("yearLevel"),
    school: formData.get("school"),
    preferredSessionMinutes: formData.get("preferredSessionMinutes"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      status: "error",
      message: "Check the details above.",
      nextStep: "Fix the highlighted field and save again.",
      fieldErrors: {
        displayName: flat.displayName?.[0],
        yearLevel: flat.yearLevel?.[0],
        school: flat.school?.[0],
      },
    };
  }

  const supabase = await createSupabaseServerClient();

  /* No `.eq("id", ...)`. RLS scopes the update to the caller's own row, and the
     policy's WITH CHECK stops it becoming someone else's. A filter here would
     look like the thing enforcing that, which is exactly the misreading that
     leads to it being removed later (docs/architecture.md §3). */
  const { error } = await supabase.from("profiles").update({
    display_name: parsed.data.displayName,
    year_level: parsed.data.yearLevel,
    school: parsed.data.school,
    preferred_session_minutes: parsed.data.preferredSessionMinutes,
    timezone: parsed.data.timezone,
  });

  if (error) {
    return {
      status: "error",
      message: "We could not save your profile.",
      nextStep: "Try again in a moment. Nothing was changed.",
    };
  }

  // The shell renders the display name, so the whole tree needs re-rendering.
  revalidatePath("/", "layout");
  return { status: "saved" };
}

/**
 * Delete the account and everything it owns (FR-A8, NFR-P3).
 *
 * This is one of the two jobs the service-role client exists for. Removing a
 * row from `auth.users` is something RLS is designed to forbid, and it is the
 * *only* way to trigger the cascade — every table's `user_id` references
 * `auth.users (id) on delete cascade`, so deleting the account takes uploads,
 * extracted text, embeddings and generated content with it. Deleting rows
 * table-by-table from application code would be a list somebody forgets to
 * update the next time a table is added.
 *
 * The typed confirmation is checked on the server as well as in the dialog.
 * A destructive action guarded only by client state is guarded by nothing.
 */
export async function deleteAccountAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await requireSession();
  const typed = String(formData.get("confirmation") ?? "").trim();

  if (typed !== DELETE_CONFIRMATION) {
    return {
      status: "error",
      message: `Type ${DELETE_CONFIRMATION} to confirm.`,
      nextStep: "Nothing has been deleted.",
      fieldErrors: { confirmation: `Type ${DELETE_CONFIRMATION} exactly.` },
    };
  }

  /* Files first, through the Storage API. Supabase blocks deleting
     `storage.objects` rows in SQL because the bytes would be orphaned, so this
     cannot ride the auth.users cascade the way every public table does.
     Doing it first also fails safe: if removal breaks, the account still
     exists and the student is told, rather than losing the account and keeping
     an unreachable pile of uploads. */
  const filesRemoved = await removeAllUserObjects(session.userId);
  if (!filesRemoved) {
    return {
      status: "error",
      message: "We could not remove your uploaded files.",
      nextStep: "Nothing has been deleted. Try again, and tell us if it keeps failing.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(session.userId);

  if (error) {
    return {
      status: "error",
      message: "We could not delete your account.",
      nextStep: "Nothing was removed. Try again, and tell us if it keeps failing.",
    };
  }

  // Clear the cookies for a session whose user no longer exists.
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });

  redirect("/?deleted=1");
}

/* -------------------------------------------------------------------------- */
/*  Avatar (Sprint 16 — FR-A7, deferred out of Sprint 15 until storage existed) */
/* -------------------------------------------------------------------------- */

/**
 * Upload a profile picture.
 *
 * Every check here is duplicated by the bucket itself (`file_size_limit`,
 * `allowed_mime_types`) and by the storage policies. These exist to produce a
 * sentence a student can act on instead of a 400 from the storage API — not to
 * be the thing standing between an attacker and the bucket.
 *
 * The old object is removed AFTER the new one is written, so a failed upload
 * leaves the student with the picture they already had rather than none.
 */
export async function uploadAvatarAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await requireSession();
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "No image was chosen.",
      nextStep: "Pick a JPG, PNG or WebP and try again.",
    };
  }

  if (file.size > BUCKET_LIMITS.avatars) {
    const limitMb = Math.round(BUCKET_LIMITS.avatars / (1024 * 1024));
    return {
      status: "error",
      message: `That image is larger than ${limitMb} MB.`,
      nextStep: "Crop it or pick a smaller one — an avatar is only shown at thumbnail size.",
    };
  }

  if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      status: "error",
      message: "That file type is not supported.",
      nextStep: "Use a JPG, PNG or WebP.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";

  /* A new name every time, rather than overwriting a fixed one. An avatar is
     served through a signed URL that a browser may still hold; reusing the path
     would show the previous picture until that URL expired. */
  const path = objectPath(session.userId, "avatars", `${Date.now()}.${extension}`);

  const { error: uploadError } = await supabase.storage
    .from(BUCKETS.avatars)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return {
      status: "error",
      message: "We could not upload that image.",
      nextStep: "Try again in a moment. Your current picture has not changed.",
    };
  }

  const previous = (await getProfile())?.avatarPath ?? null;

  const { error: saveError } = await supabase.from("profiles").update({ avatar_url: path });

  if (saveError) {
    // Do not strand the object: nothing points at it now.
    await supabase.storage.from(BUCKETS.avatars).remove([path]);
    return {
      status: "error",
      message: "We uploaded the image but could not save it to your profile.",
      nextStep: "Try again — nothing was changed.",
    };
  }

  // Best effort: an orphaned old file costs storage, not correctness.
  if (previous && previous !== path) {
    await supabase.storage.from(BUCKETS.avatars).remove([previous]);
  }

  revalidatePath("/", "layout");
  return { status: "saved" };
}

/** Remove the profile picture and fall back to initials. */
export async function removeAvatarAction(): Promise<SettingsFormState> {
  await requireSession();
  const current = (await getProfile())?.avatarPath ?? null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: null });

  if (error) {
    return {
      status: "error",
      message: "We could not remove your picture.",
      nextStep: "Try again in a moment.",
    };
  }

  if (current) await supabase.storage.from(BUCKETS.avatars).remove([current]);

  revalidatePath("/", "layout");
  return { status: "saved" };
}
