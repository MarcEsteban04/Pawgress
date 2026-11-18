/**
 * The celebration hand-off between a server action and the next page
 * (Sprint 73). Shared by `grantAchievements`, the app layout that reads it,
 * and the client component that shows it once and clears it.
 */

export const CELEBRATION_COOKIE = "acadify-celebrate";

/** Results below this earn the milestone but not the celebration — see `grantAchievements`. */
export const CELEBRATE_FROM = 0.6;

export type Celebration = { title: string; name: string | null; earned: string };

/** Read the cookie defensively: it came from a browser, so it is untrusted text. */
export function parseCelebration(value: string | undefined): Celebration[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Celebration =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Celebration).title === "string" &&
          typeof (item as Celebration).earned === "string",
      )
      .slice(0, 3)
      .map((item) => ({
        title: item.title.slice(0, 80),
        name: typeof item.name === "string" ? item.name.slice(0, 120) : null,
        earned: item.earned.slice(0, 200),
      }));
  } catch {
    return [];
  }
}
