import { AccountSuggestion } from "@/features/auth/components/AccountSuggestion";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { getLastEmail } from "@/features/auth/server/pending";
import { getSession } from "@/server/auth/session";
import { safeNextPath } from "@/lib/redirects";

export const metadata = { title: "Sign in" };

/**
 * `?next=` is where the proxy put the route they originally asked for, so
 * signing in returns them there rather than to a generic home page (US-A3).
 * It is validated here as well as in the action — the value came from a URL,
 * which means it came from whoever wrote the link.
 *
 * THREE STATES, and the password is required in all of them:
 *
 *  1. A live session — offer that account, ask for its password, and offer to
 *     sign it out. Not redirected away by the proxy the way the other auth
 *     screens are: clicking "Sign in" is an explicit request, and on a shared
 *     machine the person clicking is often not the person the browser holds.
 *  2. No session, but this browser signed in before — offer that address, ask
 *     for the password, and offer to forget it.
 *  3. Nothing known — the plain form.
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(raw);

  const session = await getSession();
  if (session) {
    return <AccountSuggestion email={session.email} next={next} mode="session" />;
  }

  const remembered = await getLastEmail();
  if (remembered) {
    return <AccountSuggestion email={remembered} next={next} mode="remembered" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">
          Welcome back
        </h1>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">
          Pick up where your last quiz left off.
        </p>
      </div>

      <LoginForm next={next} />
    </div>
  );
}
