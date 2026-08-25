/**
 * Post-auth redirect targets.
 *
 * Every one of these values arrives from a query string, which means it arrives
 * from whoever wrote the link. Sending a student who has just signed in — or
 * just proved they own their inbox — to an attacker's page, on the strength of
 * a URL that genuinely came from us, is the classic open-redirect bug, and auth
 * flows are exactly where it lives.
 *
 * Shared by `/auth/callback` and sign-in so the rule cannot be right in one
 * place and forgotten in the other.
 */

/** Where a student goes when there is no valid target. */
export const DEFAULT_SIGNED_IN_PATH = "/dashboard";

/**
 * Returns `raw` when it is a safe same-origin path, otherwise the default.
 *
 * Rejects, in order:
 *  - anything not starting with `/` — absolute URLs and scheme-relative junk
 *  - `//evil.example`, which a browser reads as a full URL with the current
 *    protocol, and which is the single most missed case here
 *  - `/\evil.example`, which some browsers normalise the same way
 *  - the auth routes themselves, so a stale `?next=/login` cannot bounce a
 *    signed-in student straight back out of the app
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_SIGNED_IN_PATH;
  if (!raw.startsWith("/")) return DEFAULT_SIGNED_IN_PATH;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return DEFAULT_SIGNED_IN_PATH;

  const path = raw.split(/[?#]/)[0] ?? "";
  const bounces = ["/login", "/register", "/verify-email", "/auth"];
  if (bounces.some((route) => path === route || path.startsWith(`${route}/`))) {
    return DEFAULT_SIGNED_IN_PATH;
  }

  return raw;
}
