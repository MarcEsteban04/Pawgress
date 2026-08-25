import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/AppShell";
import { parseSidebarState, SIDEBAR_COOKIE } from "@/features/shell/sidebar";
import { AI_QUOTAS } from "@/lib/ai/types";
import { requireSession } from "@/server/auth/session";
import { getProfile } from "@/server/profile/queries";

/**
 * The authenticated shell.
 *
 * `requireSession()` here is the real gate — `proxy.ts` only did an optimistic
 * cookie check, and RLS sits behind both (docs/architecture.md §3). It is
 * memoised with React `cache()`, so pages and server components below can call
 * it again for free.
 *
 * `toolbar` is a parallel route slot (`@toolbar`). It lets a page put its own
 * control in the shell's top bar without this layout knowing which page is
 * rendering — see `@toolbar/default.tsx`.
 */
export default async function AppLayout({ children, toolbar }: LayoutProps<"/">) {
  const session = await requireSession();
  const cookieStore = await cookies();
  const sidebar = parseSidebarState(cookieStore.get(SIDEBAR_COOKIE)?.value);
  // The name the student chose, not the part of their address before the @.
  const profile = await getProfile();

  return (
    <AppShell
      user={{
        name: profile?.displayName ?? session.email.split("@")[0] ?? "You",
        email: session.email,
      }}
      toolbar={toolbar}
      initialSidebar={sidebar}
      // Usage comes from the AI call log once Sprint 31 lands; the shell already
      // has somewhere to show it so the quota is never a surprise.
      quota={{ used: 0, limit: AI_QUOTAS.generationsPerDay, resetsAt: "midnight" }}
    >
      {children}
    </AppShell>
  );
}
