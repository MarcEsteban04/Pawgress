"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, ErrorState } from "@/components/ui";
import { initialAuthState } from "@/features/auth/constants";
import { verifyOtpAction } from "@/features/auth/server/actions";
import { OTP_LENGTH } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

/**
 * The 6-digit confirmation code (FR-A2).
 *
 * **One real input, six painted cells.** Six separate `<input>`s are the usual
 * way this is built and they break in every direction: pasting a code fills
 * only the first box, `autocomplete="one-time-code"` stops working, backspace
 * behaviour has to be hand-written, and a screen reader announces six unlabelled
 * fields. Here a single input sits transparently on top of six styled divs — the
 * look of the segmented control, the behaviour of a plain text field, and OS
 * autofill of the emailed code still works.
 */

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="accent" block disabled={disabled || pending}>
      {pending ? "Confirming…" : "Confirm email"}
    </Button>
  );
}

export function VerifyCodeForm() {
  const [state, formAction] = useActionState(verifyOtpAction, initialAuthState);
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputId = useId();

  // The code is the only thing on this screen, so take the caret without
  // making them click it.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Submit as soon as the sixth digit lands. Making someone type six digits and
  // then reach for a button is a step with no decision in it.
  useEffect(() => {
    if (code.length === OTP_LENGTH) formRef.current?.requestSubmit();
  }, [code]);

  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => code[i] ?? "");

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      {state.status === "error" && state.message && (
        <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-[0.9375rem] font-medium">
          Confirmation code
        </label>

        <div className="relative">
          <input
            ref={inputRef}
            id={inputId}
            name="code"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
            }
            inputMode="numeric"
            // Lets iOS and Android offer the code straight from the email.
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH}
            aria-describedby={`${inputId}-hint`}
            aria-invalid={state.status === "error"}
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
                    state.status === "error" && "border-bad",
                  )}
                >
                  {digit}
                </div>
              );
            })}
          </div>
        </div>

        <p id={`${inputId}-hint`} className="text-sm text-ink-subtle">
          {OTP_LENGTH} digits, from the email we just sent.
        </p>
      </div>

      <SubmitButton disabled={code.length < OTP_LENGTH} />
    </form>
  );
}
