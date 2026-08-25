import { AuthAsideDefault } from "@/features/auth/components/AuthAsideDefault";

/**
 * The aside for every account screen that does not override it — sign-up, and
 * the confirm screen that follows it.
 *
 * `default.tsx` is what makes an unmatched slot render something rather than
 * 404, and it is also the sensible fallback here: a screen with no opinion of
 * its own gets the product pitch.
 */
export default function AsideDefault() {
  return <AuthAsideDefault />;
}
