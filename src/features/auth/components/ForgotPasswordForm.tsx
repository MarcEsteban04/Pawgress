"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { Button, ErrorState, Field, Input } from "@/components/ui";
import { initialAuthState } from "@/features/auth/constants";
import { requestPasswordResetAction } from "@/features/auth/server/actions";

/**
 * Ask for a reset code.
 *
 * There is no "we could not find that account" state, by design: the action
 * reports the same outcome whether or not the address exists, so this form only
 * ever fails on a malformed address (US-A4).
 */

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="accent" block disabled={pending}>
      {pending ? "Sending…" : "Send me a code"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialAuthState);
  const emailId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && state.message && !state.fieldErrors && (
        <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
      )}

      <Field
        label="Email"
        htmlFor={emailId}
        error={state.fieldErrors?.email}
        hint="The address you signed up with."
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
          placeholder="you@school.edu"
        />
      </Field>

      <SubmitButton />

      <p className="text-center text-[0.9375rem] text-ink-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-accent underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
