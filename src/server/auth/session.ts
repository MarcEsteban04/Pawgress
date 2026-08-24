import { cache } from "react";
import { redirect } from "next/navigation";
import { errors } from "@/lib/errors";

/**
 * The Data Access Layer's session gate.
 *
 * Next.js 16's own guidance: `proxy.ts` runs on every request including
 * prefetches, so it does OPTIMISTIC cookie-only checks and nothing more. The
 * real check belongs as close to the data as possible — here — and Row Level
 * Security is the last line behind that. Three layers, each assuming the others
 * might be bypassed.
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
 * Whether a real auth provider is wired up yet.
 *
 * Supabase lands in Sprint 09. Until then this returns a preview session so the
 * app shell is navigable — and it keys off configuration rather than an env
 * flag on purpose: production cannot be missing `NEXT_PUBLIC_SUPABASE_URL`, so
 * there is no switch anyone can forget to turn off. It also fails closed: no
 * Supabase in production means no session at all, not a free pass.
 *
 * REMOVE THIS BRANCH in Sprint 11, once sign-in works.
 */
function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

const PREVIEW_SESSION: Session = {
  userId: "preview-user",
  email: "preview@pawgress.local",
  emailVerified: true,
};

/**
 * Returns the current session, or `null`. Never throws.
 * Use this when a page renders differently for signed-out visitors.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!supabaseConfigured()) {
    // Preview scaffolding — see supabaseConfigured() above.
    return process.env.NODE_ENV === "production" ? null : PREVIEW_SESSION;
  }

  // Sprint 09–11: read the Supabase session from cookies, verify it against
  // the auth server, and map it onto Session. Deliberately not stubbed with
  // fake decoding — a half-real auth check is worse than an obvious gap.
  throw new Error(
    "Supabase is configured but session verification is not implemented yet (Sprint 09–11).",
  );
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
