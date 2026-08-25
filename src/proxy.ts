import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/config/env";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy — `middleware.ts` renamed in Next.js 16 (the old name is deprecated).
 *
 * Two jobs, in this order:
 *
 *  1. **Refresh the session.** Supabase rotates its access token, and only the
 *     proxy can write the rotated cookies onto the response — a Server
 *     Component is not allowed to set cookies. Skip this and students get
 *     signed out mid-session.
 *  2. **Redirect.** Signed-out visitors are bounced before a protected page
 *     renders; signed-in visitors skip the sign-in screen.
 *
 * It is still an OPTIMISTIC gate. Next's own guidance is explicit that proxy
 * must not be the only line of defence: it runs on every request including link
 * prefetches, and a redirect is not an authorisation decision. The real check is
 * `requireSession()` in the Data Access Layer (`src/server/auth/session.ts`),
 * with RLS behind that (docs/architecture.md §3).
 */

/** Routes that require a session. */
const PROTECTED = [
  "/dashboard",
  "/subjects",
  "/assistant",
  "/progress",
  "/planner",
  "/plan",
  "/settings",
  "/quizzes",
];

/** Auth screens a signed-in student has no reason to see. */
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

function isProtected(pathname: string): boolean {
  return PROTECTED.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // While Supabase is not configured there is no session to read, so protecting
  // these routes would make the app unreachable in local development. The DAL
  // still owns the real decision, and fails closed in production — see
  // session.ts.
  if (!supabaseConfigured()) return NextResponse.next();

  // Always refresh, even on public routes: a visitor reading the landing page
  // with an expiring token should have it rotated rather than be signed out the
  // moment they click through.
  const { response, userId } = await updateSession(request);
  const signedIn = userId !== null;

  if (!signedIn && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve where they were headed so sign-in can return them there (US-A3).
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    // Redirect from `response`, not a bare NextResponse, so the cookies the
    // refresh just wrote survive the redirect.
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  if (signedIn && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  /**
   * Authenticated pages are never stored (US-A2: "the back button does not
   * restore authenticated content").
   *
   * Without this, signing out and pressing Back can repaint a fully rendered
   * dashboard from the browser's cache — the session is gone and nothing new
   * loads, but a shared or library machine still shows the previous student's
   * subjects and scores. `no-store` is what stops the page being kept at all;
   * the rest are for older proxies that ignore it.
   */
  if (isProtected(pathname)) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
}

export const config = {
  /**
   * Next's auth guidance recommends running on all routes; we exclude only the
   * things that can never need a redirect or a session refresh. Static assets
   * and image optimisation are excluded because prefetch traffic through here
   * is pure overhead.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
