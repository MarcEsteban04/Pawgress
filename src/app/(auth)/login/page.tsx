import { AccountChooser } from "@/features/auth/components/AccountChooser";
import { AccountSuggestion } from "@/features/auth/components/AccountSuggestion";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { getAccounts } from "@/features/auth/server/pending";
import { getSession } from "@/server/auth/session";
import { safeNextPath } from "@/lib/redirects";

export const metadata = { title: "Sign in" };

/**
 * `?next=` is where the proxy put the route they originally asked for, so
 * signing in returns them there rather than to a generic home page (US-A3).
 * It is validated here as well as in the action — the value came from a URL,
 * which means it came from whoever wrote the link.
 *
 * FOUR STATES, and the password is required in every one of them:
 *
 *  1. A live session — offer that account, ask for its password, offer to sign
 *     it out. Not redirected away by the proxy the way the other auth screens
 *     are: clicking "Sign in" is an explicit request, and on a shared machine
 *     the person clicking is often not the person the browser holds.
 *  2. `?i=<n>` — a row was chosen from the chooser. Its address is filled in and
 *     locked, and the password is asked.
 *  3. Accounts remembered, nothing chosen — the chooser.
 *  4. Nothing remembered, or `?i=new` — the plain form.
 *
 * `?i=` is a POSITION, never an address. An email in a URL ends up in browser
 * history, in any `Referer` the page sends, and in server logs; a position
 * leaks nothing and is resolved here against the same cookie that rendered the
 * list.
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const next = safeNextPath(one("next"));

  const session = await getSession();
  if (session) {
    return <AccountSuggestion email={session.email} next={next} mode="session" />;
  }

  const accounts = await getAccounts();
  const chosen = one("i");

  if (chosen !== undefined && chosen !== "new") {
    const index = Number(chosen);
    const email = Number.isInteger(index) ? accounts[index] : undefined;
    /* An out-of-range position falls through to the plain form rather than
       erroring. The list can shrink between render and click — another tab
       signing out, the × on this very row — and a 404 for a stale suggestion
       would be a worse answer than an empty email box. */
    if (email) {
      return <AccountSuggestion email={email} next={next} mode="remembered" />;
    }
  }

  if (chosen === undefined && accounts.length > 0) {
    return <AccountChooser accounts={accounts} next={next} />;
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
