import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseConfigured } from "@/config/env";
import { errors } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The Data Access Layer's session gate.
 *
 * Next.js 16's own guidance: `proxy.ts` runs on every request including
 * prefetches, so it does OPTIMISTIC checks and nothing more. The real check
 * belongs as close to the data as possible — here — and Row Level Security is
 * the last line behind that. Three layers, each assuming the others might be
 * bypassed (docs/architecture.md §3).
 *
 * `cache()` memoises per render pass, so a layout and five server components
 * calling this in one request produce one verification, not six.
 */

export type Session = {
  userId: string;
  email: string;
  emailVerified: boolean;
};

/**
 * Preview scaffolding for local work before a Supabase project exists.
 *
 * It keys off configuration rather than an env flag on purpose: a flag is
 * something a person can forget to turn off. Production either has
 * `NEXT_PUBLIC_SUPABASE_URL` or it does not, and the branch below fails closed
 * when it does not — no Supabase in production means no session at all, never a
 * free pass.
 *
 * REMOVE THIS in Sprint 11, once sign-in works end to end.
 */
const PREVIEW_SESSION: Session = {
  userId: "preview-user",
  email: "preview@pawgress.local",
  emailVerified: true,
};

/**
 * Returns the current session, or `null`. Never throws.
 * Use this when a page renders differently for signed-out visitors.
 *
 * Uses `getUser()`, which asks the Auth server who this token belongs to.
 * `getSession()` would be faster and is the wrong call here: it decodes the
 * cookie without verifying it, and a cookie is attacker-controllable. The extra
 * round trip is the price of the guarantee, and `cache()` means it is paid once
 * per request rather than once per component.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!supabaseConfigured()) {
    return process.env.NODE_ENV === "production" ? null : PREVIEW_SESSION;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    // Supabase sets this once the student follows the verification link.
    // Registration (Sprint 10) is what makes it meaningful; it is surfaced here
    // so a feature can gate on a verified address without re-deriving it.
    emailVerified: Boolean(data.user.email_confirmed_at),
  };
});

/**
 * Requires a session. Redirects to sign-in when there is none, preserving the
 * route the student asked for so they land back on it (US-A3).
 *
 * Call this in `(app)/layout.tsx` and at the top of every server action that
 * touches user data. Calling it twice in one request is free.
 */
export const requireSession = cache(async (returnTo?: string): Promise<Session> => {
  const session = await getSession();
  if (!session) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${next}`);
  }
  return session;
});

/**
 * For server actions and route handlers, where a redirect is the wrong answer —
 * they should return a failure the caller can render.
 */
export async function requireSessionOrFail(): Promise<Session> {
  const session = await getSession();
  if (!session) throw errors.unauthenticated();
  return session;
}
