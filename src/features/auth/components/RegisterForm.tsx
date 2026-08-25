"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, ErrorState, Field, Input } from "@/components/ui";
import { PasswordStrength } from "./PasswordStrength";
import { initialAuthState } from "@/features/auth/constants";
import { registerAction } from "@/features/auth/server/actions";
import { MIN_PASSWORD_LENGTH, scorePassword } from "@/lib/validation/auth";

/**
 * Create-account form — screen 2 in docs/wireframes.md.
 *
 * Two fields and nothing else. Name and year level are asked later, inside the
 * app, where they are actually used; every extra field here is a student who
 * closes the tab.
 *
 * Built on `useActionState`, so the whole thing submits and reports errors with
 * JavaScript disabled — the action is the same code either way. The strength
 * meter and the reveal toggle are the only parts that need the client.
 */

function SubmitButton({ disabled }: { disabled: boolean }) {
  // `useFormStatus` must be read by a CHILD of the form, which is the only
  // reason this is its own component.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="accent" block disabled={disabled || pending}>
      {pending ? "Creating your account…" : "Create account"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialAuthState);
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const strengthId = useId();

  const { meetsMinimum } = scorePassword(password);
  // Blocked below the minimum (US-A1), but never blocked on an empty field —
  // a button that is disabled before you have typed anything reads as broken.
  const blocked = password.length > 0 && !meetsMinimum;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && !state.fieldErrors && state.message && (
        <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
      )}

      <Field
        label="Email"
        htmlFor={emailId}
        error={state.fieldErrors?.email}
        hint="Use the address you check — the confirmation link goes there."
      >
        <Input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? `${emailId}-error` : `${emailId}-hint`}
          placeholder="you@school.edu"
        />
      </Field>

      <Field label="Password" htmlFor={passwordId} error={state.fieldErrors?.password}>
        <div className="relative">
          <Input
            id={passwordId}
            name="password"
            type={revealed ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={strengthId}
            className="pr-12"
          />
          {/* Phone keyboards make typos, and a student who cannot see what they
              typed will retype an invisible password three times and leave. */}
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

      <PasswordStrength password={password} id={strengthId} />

      <SubmitButton disabled={blocked} />

      {state.existingAccount && (
        <Link
          href="/login"
          className="text-center text-[0.9375rem] font-medium text-accent underline underline-offset-4"
        >
          Sign in to that account instead
        </Link>
      )}

      <p className="text-center text-[0.9375rem] text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
