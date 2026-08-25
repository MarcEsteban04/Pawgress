import { AuthShell } from "@/components/layout/AuthShell";

/**
 * The real `/auth/*` segment — where Supabase's email links land. It shares the
 * centred card with the `(auth)` route group via `AuthShell`.
 *
 * `/auth/callback` is a Route Handler, so this layout never wraps it; only
 * `/auth/error` renders here.
 */
export default function AuthSegmentLayout({ children }: LayoutProps<"/auth">) {
  return <AuthShell>{children}</AuthShell>;
}
