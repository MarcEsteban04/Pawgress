import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnv, serverEnv } from "@/config/env";
import { type Database } from "@/types/database";

/**
 * The service-role client. **This bypasses Row Level Security entirely.**
 *
 * Every query made through it can read and write every student's data, so it
 * exists for exactly two jobs and no others:
 *
 *  1. Background workers that have no user session — document extraction,
 *     embedding, generation (Sprint 31+).
 *  2. Administrative maintenance that RLS is designed to forbid.
 *
 * If you are reaching for this to fix a "row not found" or a permissions error
 * in a normal request, the bug is in the RLS policy. Using the secret key to
 * step around a policy deletes the last line of defence for every row in the
 * table, and does it silently.
 *
 * Not memoised across requests: `createClient` is cheap, and a shared instance
 * is one accidental `.auth` call away from leaking state between jobs. It also
 * carries no session by design — `persistSession: false` so it can never pick
 * one up.
 */
export function createSupabaseAdminClient() {
  const { url } = requireSupabaseEnv();

  return createClient<Database>(url, serverEnv.supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
