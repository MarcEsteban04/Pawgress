import { AppShell } from "@/components/layout/AppShell";
import { AI_QUOTAS } from "@/lib/ai/types";
import { requireSession } from "@/server/auth/session";

/**
 * The authenticated shell.
 *
 * `requireSession()` here is the real gate — `proxy.ts` only did an optimistic
 * cookie check, and RLS sits behind both (docs/architecture.md §3). It is
 * memoised with React `cache()`, so pages and server components below can call
 * it again for free.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();

  return (
    <AppShell
      user={{ name: session.email.split("@")[0] ?? "You", email: session.email }}
      // Usage comes from the AI call log once Sprint 31 lands; the shell already
      // has somewhere to show it so the quota is never a surprise.
      quota={{ used: 0, limit: AI_QUOTAS.generationsPerDay, resetsAt: "midnight" }}
    >
      {children}
    </AppShell>
  );
}
