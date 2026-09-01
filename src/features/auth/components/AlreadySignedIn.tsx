import { UserRound } from "lucide-react";
import { Button } from "@/components/ui";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { signOutAction } from "@/features/auth/server/actions";

/**
 * Shown on `/login` and `/register` when the browser already holds a session.
 *
 * WHY THIS EXISTS. Both pages used to be in the proxy's auth-route list, so a
 * signed-in visitor who clicked "Sign in" was redirected to the dashboard
 * without a word. On a shared machine — a school lab, a library PC, a sibling's
 * laptop — the person clicking is usually a DIFFERENT person, and they were
 * dropped into the previous student's subjects, materials and scores having
 * never been asked for anything.
 *
 * THE SUGGESTION IS A CONVENIENCE, NOT A KEY. The account is named and its
 * address filled in so nobody retypes it, and then the password is still
 * required. Recognising the browser is worth something; treating recognition as
 * proof of identity is what created the problem above.
 *
 * WHAT THIS DOES NOT DO, stated so nobody mistakes it for more: the existing
 * session stays valid while this screen is shown, so typing `/dashboard`
 * directly still works without a password. This gate covers the sign-in path,
 * which is the one people actually click. The thing that ends an unattended
 * session is the inactivity and timebox limits in `supabase/config.toml`.
 *
 * The email shown is the session's own, never a value from the URL.
 */
export function AlreadySignedIn({
  email,
  next,
  intent = "signin",
}: {
  email: string;
  next: string;
  /** On `/register` the primary action is signing out, so no password is asked. */
  intent?: "signin" | "signup";
}) {
  const signup = intent === "signup";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">
          {signup ? "You are already signed in" : "Confirm it is you"}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">
          {signup
            ? "This browser is still signed in. Sign out first to create a separate account."
            : "This browser is still signed in. Enter the password to carry on, or sign out to use a different account."}
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-rule bg-surface-sunken p-4">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
          <UserRound className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">Signed in as</p>
          <p className="truncate font-medium">{email}</p>
        </div>
      </div>

      {/* The ordinary sign-in form with the address locked, rather than a second
          path of its own: one action, one error shape, one thing to reason
          about when the rules change. */}
      {!signup && <LoginForm next={next} knownEmail={email} />}

      {/* A form, not a link: signing out is a state change and must not be
          reachable by a prefetch or a crawler following an anchor. */}
      <form action={signOutAction}>
        <Button type="submit" variant="subtle" block>
          {signup ? "Sign out and create a new account" : "Sign in as someone else"}
        </Button>
      </form>
    </div>
  );
}
