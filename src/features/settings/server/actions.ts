"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DELETE_CONFIRMATION, profileSchema } from "@/lib/validation/profile";
import { requireSession } from "@/server/auth/session";
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
