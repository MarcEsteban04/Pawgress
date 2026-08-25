import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "@/config/env";
import { type Database } from "@/types/database";

/**
 * The server Supabase client, scoped to one request's cookies.
 *
 * A NEW client per request, never a module-level singleton: the client carries
 * the caller's session, so sharing one across requests would serve one
 * student's data to another. `server-only` at the top makes importing this from
 * a client component a build error rather than a runtime surprise.
 *
 * Queries made through this client run as the signed-in user, so Row Level
 * Security applies. That is the point — it is the last of the three layers in
 * docs/architecture.md §3, and the only one that still holds if the other two
 * are bypassed.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. That is expected and safe:
          // the proxy already refreshed the session for this request and wrote
          // the new cookies onto the response, so the only thing lost here is a
          // duplicate write. Swallowing it is correct; throwing would break
          // every page that merely reads the session.
          //
          // This is ONLY safe because `updateSession` runs in src/proxy.ts.
          // Remove that and sessions start expiring mid-visit.
        }
      },
    },
  });
}
