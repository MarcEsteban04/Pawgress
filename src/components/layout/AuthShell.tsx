import Link from "next/link";
import { type ReactNode } from "react";
import { Logo } from "@/components/shared/Logo";

/**
 * The centred-card shell for every account screen.
 *
 * Nothing to distract from one task, and no rail to imply there is an app
 * behind the door yet (docs/navigation.md §1).
 *
 * It lives here rather than inside `(auth)/layout.tsx` because two route trees
 * need it: the `(auth)` group for `/login`, `/register` and `/verify-email`,
 * and the real `/auth/*` segment that Supabase redirects into. Duplicating the
 * markup across both would guarantee they drift.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-page px-5 py-12">
      <Link href="/" aria-label="Pawgress home">
        <Logo />
      </Link>
      <div className="w-full max-w-[25rem]">{children}</div>
      <p className="text-sm text-ink-muted">Don&rsquo;t just study more.</p>
    </div>
  );
}
