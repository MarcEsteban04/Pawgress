import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabaseEnv } from "@/config/env";
import { type Database } from "@/types/database";

/**
 * Refreshes the Supabase session on every request and writes the rotated
 * cookies onto the response.
 *
 * This has to happen in the proxy and cannot happen in a page: Server
 * Components are not allowed to set cookies, so if the only place the session
 * were touched was a page render, a refreshed token would be computed and then
 * thrown away. The visible symptom is a student being signed out mid-session
 * for no reason.
 *
 * `getClaims()` — not `getSession()` — is what makes this safe. Cookies are
 * attacker-controllable, so a session read straight out of one is unverified.
 * `getClaims()` verifies the JWT signature (locally against the project's JWKS
 * where it can, otherwise against the auth server), so a forged cookie fails
 * here rather than being trusted all the way down.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  userId: string | null;
}> {
  const { url, anonKey } = requireSupabaseEnv();

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Rebuild the response so the rotated cookies are visible both to the
        // rest of this request and to the browser.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // The library hands back `Cache-Control: private, no-store` and friends.
        // They are not optional: a CDN that caches a response carrying auth
        // cookies will serve one student's session to the next visitor.
        for (const [key, headerValue] of Object.entries(headers)) {
          response.headers.set(key, headerValue);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const userId = !error && data?.claims?.sub ? String(data.claims.sub) : null;

  return { response, userId };
}
