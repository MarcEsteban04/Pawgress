import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy — `middleware.ts` renamed in Next.js 16 (the old name is deprecated).
 *
 * This is an OPTIMISTIC gate and nothing more. It runs on every request,
 * including link prefetches, so it reads the session cookie and never touches
 * the database. Next's own guidance is explicit that proxy must not be the only
 * line of defence; the real check is `requireSession()` in the Data Access Layer
 * (`src/server/auth/session.ts`), with RLS behind that.
 *
 * What it buys us: signed-out visitors get bounced before a protected page
 * renders, and signed-in visitors skip the sign-in screen. Both are pure
 * redirect logic, which is exactly what belongs at the edge.
 */

/**
 * Supabase names its auth cookie `sb-<project-ref>-auth-token`, so we match on
 * the prefix rather than hard-coding a project reference.
 */
const SESSION_COOKIE_PREFIX = "sb-";
const SESSION_COOKIE_SUFFIX = "-auth-token";

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

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith(SESSION_COOKIE_PREFIX) &&
        cookie.name.includes(SESSION_COOKIE_SUFFIX) &&
        cookie.value.length > 0,
    );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // While Supabase is not configured (before Sprint 09) there is no cookie to
  // read, so protecting these routes would make the app unreachable. The DAL
  // still owns the real decision — see session.ts.
  const authConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!authConfigured) return NextResponse.next();

  const signedIn = hasSessionCookie(request);

  if (!signedIn && PROTECTED.some((route) => pathname.startsWith(route))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve where they were headed so sign-in can return them there.
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (signedIn && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Next's auth guidance recommends running on all routes; we exclude only the
   * things that can never need a redirect. Static assets and image
   * optimisation are excluded because prefetch traffic through here is pure
   * overhead.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
