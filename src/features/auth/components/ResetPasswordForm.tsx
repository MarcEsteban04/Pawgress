"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, ErrorState, Field, Input } from "@/components/ui";
import { PasswordStrength } from "./PasswordStrength";
import { initialAuthState } from "@/features/auth/constants";
import { resetPasswordAction } from "@/features/auth/server/actions";
import { MIN_PASSWORD_LENGTH, OTP_LENGTH, scorePassword } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

/**
 * Code plus new password, on one screen.
 *
 * Deliberately not two steps. Splitting them means a student who fumbles the
 * password has already spent the code, and single-use codes make that a dead
 * end — they would have to go back and request another. One submit spends the
 * code and sets the password together, so a typo costs a retry rather than a
 * fresh email.
 *
 * The code input reuses the pattern from confirmation: one real input under six
 * painted cells, so paste and OS autofill keep working.
 */

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="accent" block disabled={disabled || pending}>
      {pending ? "Setting your password…" : "Set new password"}
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, initialAuthState);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const codeId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const strengthId = useId();

  const { meetsMinimum } = scorePassword(password);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => code[i] ?? "");
  const blocked = code.length < OTP_LENGTH || !meetsMinimum;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && state.message && (
        <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={codeId} className="text-[0.9375rem] font-medium">
          Code from your email
        </label>

        <div className="relative">
          <input
            id={codeId}
            name="code"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH}
            autoFocus
            className="absolute inset-0 z-10 w-full bg-transparent text-transparent caret-transparent outline-none"
          />

          <div aria-hidden className="flex gap-2">
            {digits.map((digit, index) => {
              const active = index === Math.min(code.length, OTP_LENGTH - 1);
              return (
                <div
                  key={index}
                  className={cn(
                    "flex h-14 flex-1 items-center justify-center rounded-[var(--radius-control)]",
                    "border bg-surface text-2xl font-semibold tabular-nums transition-colors",
                    digit
                      ? "border-rule-strong text-ink"
                      : active
                        ? "border-accent text-ink"
                        : "border-rule text-ink-subtle",
                  )}
                >
                  {digit}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Field label="New password" htmlFor={passwordId} error={state.fieldErrors?.password}>
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
            aria-describedby={strengthId}
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

      <PasswordStrength password={password} id={strengthId} />

      <Field label="Confirm new password" htmlFor={confirmId}>
        <Input
          id={confirmId}
          name="confirm"
          type={revealed ? "text" : "password"}
          autoComplete="new-password"
          required
        />
      </Field>

      <SubmitButton disabled={blocked} />
    </form>
  );
}
