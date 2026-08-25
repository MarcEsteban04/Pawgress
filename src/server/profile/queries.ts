import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/server/auth/session";

/**
 * Profile reads, in the Data Access Layer.
 *
 * No `user_id` filter anywhere below, and that is deliberate rather than an
 * oversight: RLS restricts the query to the caller's own row before it returns
 * (Sprint 14). Adding `.eq("id", session.userId)` on top would read as the
 * thing keeping other students out, and the day someone removed it nothing
 * would appear to break — see docs/architecture.md §3.
 *
 * `cache()` memoises per render pass, so a layout and a page asking for the
 * same profile in one request produce one query.
 */

export type Profile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  yearLevel: string | null;
  school: string | null;
  preferredSessionMinutes: number;
  timezone: string;
  onboardedAt: string | null;
};

export const getProfile = cache(async (): Promise<Profile | null> => {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, year_level, school, preferred_session_minutes, timezone, onboarded_at",
    )
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    /* The trigger seeds this from the address, but a row can predate the
       trigger or have been cleared. Falling back to the local part keeps the
       shell from rendering an empty name. */
    displayName: data.display_name ?? session.email.split("@")[0] ?? "You",
    avatarUrl: data.avatar_url,
    yearLevel: data.year_level,
    school: data.school,
    preferredSessionMinutes: data.preferred_session_minutes,
    timezone: data.timezone,
    onboardedAt: data.onboarded_at,
  };
});
