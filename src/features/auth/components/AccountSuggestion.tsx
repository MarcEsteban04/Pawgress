import { UserRound } from "lucide-react";
import Link from "next/link";
import { Button, buttonStyles } from "@/components/ui";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { signOutAction } from "@/features/auth/server/actions";

/**
 * `/login` and `/register` when this browser already knows an account.
 *
 * WHY IT EXISTS. Both pages used to be in the proxy's auth-route list, so a
 * signed-in visitor who clicked "Sign in" was redirected to the dashboard
 * without a word. On a shared machine — a school lab, a library PC, a sibling's
 * laptop — the person clicking is usually a DIFFERENT person, and they were
 * dropped into the previous student's subjects and scores having never been
 * asked for anything.
 *
 * THE SUGGESTION IS A CONVENIENCE, NEVER A KEY. The account is named and its
 * address filled in so nobody retypes it; the password is still required every
 * time. Recognising a browser is worth something, and treating recognition as
 * proof of identity is exactly what created the problem above.
 *
 * TWO WAYS TO KNOW THE ACCOUNT, and the difference is only in what is being
 * offered:
 *
 *  - `session` — a live session is present. The secondary action signs it out,
 *    because leaving it alive is what put someone else's data on screen.
 *  - `remembered` — no session, but this browser has signed in here before and
 *    this row was chosen. The secondary action goes back to the chooser;
 *    nothing is signed in, so there is nothing to sign out. FORGETTING lives on
 *    the × in `AccountChooser`, not here — a screen for one account is the
 *    wrong place to manage the list.
 *
 * WHAT IT DOES NOT DO, said plainly so it is not mistaken for more: in
 * `session` mode the existing session stays valid while this screen is shown,
 * so typing `/dashboard` directly still works without a password. This covers
 * the path people actually click. What ends an unattended session is the
 * inactivity and timebox limits in `supabase/config.toml`.
 */
export function AccountSuggestion({
  email,
  next,
  mode,
  intent = "signin",
}: {
  email: string;
  next: string;
  mode: "session" | "remembered";
  /** On `/register` the primary action is signing out, so no password is asked. */
  intent?: "signin" | "signup";
}) {
  const signup = intent === "signup";
  const live = mode === "session";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">
          {signup ? "You are already signed in" : live ? "Confirm it is you" : "Welcome back"}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">
          {signup
            ? "This browser is still signed in. Sign out first to create a separate account."
            : live
              ? "This browser is still signed in. Enter the password to carry on, or sign out to use a different account."
              : "Enter your password to pick up where your last quiz left off."}
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-rule bg-surface-sunken p-4">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
          <UserRound className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">{live ? "Signed in as" : "Last signed in as"}</p>
          <p className="truncate font-medium">{email}</p>
        </div>
      </div>

      {/* The ordinary sign-in form with the address locked, rather than a second
          path of its own: one action, one error shape, one thing to reason
          about when the rules change. */}
      {!signup && <LoginForm next={next} knownEmail={email} />}

      {/* Signing out is a state change, so it is a form — never reachable by a
          prefetch or a crawler following an anchor. Going back to the chooser
          changes nothing, so it is an ordinary link. */}
      {live ? (
        <form action={signOutAction}>
          <Button type="submit" variant="subtle" block>
            {signup ? "Sign out and create a new account" : "Sign in as someone else"}
          </Button>
        </form>
      ) : (
        <Link href="/login" className={buttonStyles({ variant: "subtle", block: true })}>
          Not you? Choose another account
        </Link>
      )}
    </div>
  );
}
