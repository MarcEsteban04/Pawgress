"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, ErrorState, Field, Input } from "@/components/ui";
import { initialAuthState } from "@/features/auth/constants";
import { signInAction } from "@/features/auth/server/actions";

/**
 * Sign in — screen 3 in docs/wireframes.md.
 *
 * One generic error above the form, never beside a field. "No account with that
 * email" turns this into an account-existence oracle and "wrong password"
 * confirms the address is real; both hand an attacker half the work, and
 * neither helps a student who simply mistyped (US-A2).
 *
 * `next` rides along as a hidden field rather than being read from the URL in
 * the action, so it survives a failed attempt — otherwise a typo would quietly
 * drop someone back on the dashboard instead of the page they asked for.
 *
 * `knownEmail` is the re-authentication mode, used when the browser already
 * holds a session. The address is filled in and locked, and the password is
 * still required — the suggestion is a convenience, never a way past the
 * password. Nothing else changes: the same action, the same generic error, so
 * there is exactly one sign-in path to reason about.
 *
 * Locking the field client-side is not the protection and is not meant to be.
 * Anyone can edit the value; they still need that account's password, because
 * the action authenticates whatever pair it is handed.
 */

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="accent" block disabled={pending}>
      {pending ? "Signing you in…" : label}
    </Button>
  );
}

export function LoginForm({ next, knownEmail }: { next: string; knownEmail?: string }) {
  const [state, formAction] = useActionState(signInAction, initialAuthState);
  const [revealed, setRevealed] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.status === "error" && state.message && (
        <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
      )}

      {/* Read-only rather than hidden when the account is known: a password
          manager keys on a visible email field, and hiding it would stop the
          browser offering the saved password for that exact account. */}
      <Field label="Email" htmlFor={emailId}>
        <Input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          readOnly={Boolean(knownEmail)}
          defaultValue={knownEmail ?? state.email}
          placeholder="you@school.edu"
          className={knownEmail ? "cursor-default text-ink-muted" : undefined}
        />
      </Field>

      <Field label="Password" htmlFor={passwordId}>
        <div className="relative">
          <Input
            id={passwordId}
            name="password"
            type={revealed ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[var(--radius-control)] text-ink-subtle transition-colors hover:text-ink"
          >
            {revealed ? (
              <EyeOff className="size-[1.125rem]" />
            ) : (
              <Eye className="size-[1.125rem]" />
            )}
          </button>
        </div>
      </Field>

      <div className="-mt-1 text-right">
        <Link
          href="/forgot-password"
          className="text-sm text-ink-muted underline underline-offset-4 transition-colors hover:text-ink"
        >
          Forgot your password?
        </Link>
      </div>

      <SubmitButton label={knownEmail ? "Confirm and continue" : "Sign in"} />

      {/* Only for someone who is actually signed out. Offering "create an
          account" to a browser that already holds a session sends them to a
          screen whose only real action is signing this one out. */}
      {!knownEmail && (
        <p className="text-center text-[0.9375rem] text-ink-muted">
          New here?{" "}
          <Link href="/register" className="font-medium text-accent underline underline-offset-4">
            Create an account
          </Link>
        </p>
      )}
    </form>
  );
}
