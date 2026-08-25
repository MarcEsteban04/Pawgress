"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "@/config/env";
import { type Database } from "@/types/database";

/**
 * The browser Supabase client.
 *
 * Used only for things that genuinely belong in the browser: the sign-in and
 * sign-up calls, and realtime subscriptions later on. Reading a student's data
 * happens on the server through the Data Access Layer, not here — see
 * docs/architecture.md §3.
 *
 * `createBrowserClient` stores the session in cookies rather than
 * `localStorage`, which is the whole reason for `@supabase/ssr`: a server
 * render has to be able to read the same session the browser holds.
 *
 * The instance is memoised. Creating a second client in the same tab gives you
 * two auth listeners racing to refresh the same token, which shows up as random
 * sign-outs that are extremely hard to reproduce.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const { url, anonKey } = requireSupabaseEnv();
    browserClient = createBrowserClient<Database>(url, anonKey);
  }
  return browserClient;
}
