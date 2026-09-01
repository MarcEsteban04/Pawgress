import { ArrowRight, UserRound } from "lucide-react";
import Link from "next/link";
import { Button, buttonStyles } from "@/components/ui";
import { signOutAction } from "@/features/auth/server/actions";

/**
 * Shown on `/login` when the browser already holds a session.
 *
 * WHY THIS EXISTS. `/login` used to be in the proxy's auth-route list, so a
 * signed-in visitor who clicked "Sign in" was redirected straight to the
 * dashboard. That is wrong twice over:
 *
 *  - **On a shared machine** — a school lab, a library PC, a sibling's laptop —
 *    the person clicking "Sign in" is usually a DIFFERENT person, and they were
 *    dropped into the previous student's subjects, materials and scores without
 *    ever being asked for a password.
 *  - **Even alone**, asking to sign in and simply arriving somewhere is
 *    startling, and it gives no way to reach a second account.
 *
 * So the request is answered instead of swallowed: here is who you are, carry
 * on, or sign that person out and use the form. Nothing is decided for them.
 *
 * The email is shown because it is the only thing that tells two accounts
 * apart, and it is the session's own — never a value from the URL.
 */
export function AlreadySignedIn({
  email,
  next,
  intent = "signin",
}: {
  email: string;
  next: string;
  /** Only changes one sentence — the choice offered is identical. */
  intent?: "signin" | "signup";
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">
          You are already signed in
        </h1>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">
          {intent === "signup"
            ? "This browser is still signed in. Sign out first to create a separate account."
            : "This browser is still signed in. Carry on, or sign out to use a different account."}
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

      <div className="flex flex-col gap-3">
        <Link href={next} className={buttonStyles({ variant: "accent" })}>
          Continue as this account
          <ArrowRight aria-hidden />
        </Link>

        {/* A form, not a link: signing out is a state change and must not be
            reachable by a prefetch or a crawler following an anchor. */}
        <form action={signOutAction}>
          <Button type="submit" variant="subtle" className="w-full">
            {intent === "signup" ? "Sign out and create a new account" : "Sign in as someone else"}
          </Button>
        </form>
      </div>
    </div>
  );
}
