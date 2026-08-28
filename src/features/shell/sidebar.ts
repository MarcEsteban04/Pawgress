/**
 * Sidebar collapse state, remembered across visits.
 *
 * A COOKIE rather than `localStorage`, and the difference matters: the server
 * renders the shell, so it has to know the width before the first paint.
 * `localStorage` is only readable after hydration, which means every page load
 * would paint the default width and then snap to the remembered one — the same
 * flash the theme script exists to prevent.
 *
 * Not httpOnly, because the client writes it on toggle. There is nothing
 * sensitive in "is the sidebar open"; the cost of it being readable is zero.
 */

export const SIDEBAR_COOKIE = "acadify-sidebar";

/** A year: this is a preference, not a session. */
const MAX_AGE = 60 * 60 * 24 * 365;

export type SidebarState = "expanded" | "collapsed";

export function parseSidebarState(value: string | undefined): SidebarState {
  return value === "collapsed" ? "collapsed" : "expanded";
}

/** Client-side write. Cheap enough not to need a server action for a width. */
export function persistSidebarState(state: SidebarState) {
  try {
    document.cookie = `${SIDEBAR_COOKIE}=${state}; path=/; max-age=${MAX_AGE}; samesite=lax`;
  } catch {
    // Blocked cookies mean the choice applies to this page view only, which is
    // a fine outcome for a preference of this size.
  }
}
