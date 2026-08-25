"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, ErrorState } from "@/components/ui";
import { RESEND_COOLDOWN_SECONDS, type AuthFormState } from "@/features/auth/constants";
import { resendVerificationAction } from "@/features/auth/server/actions";

/**
 * Resend the confirmation code, with a visible countdown.
 *
 * The cooldown is shown rather than enforced silently: a disabled button with
 * no explanation reads as broken, and a student who cannot see why will click
 * it ten times and then email support. The server enforces the same window —
 * this countdown is a courtesy, not the control (US-A1).
 */
export function ResendVerification({ initialCooldown }: { initialCooldown: number }) {
  const [remaining, setRemaining] = useState(initialCooldown);
  const [state, setState] = useState<AuthFormState>({ status: "idle" });
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  function resend() {
    setSent(false);
    startTransition(async () => {
      const result = await resendVerificationAction();
      setState(result);
      if (result.status === "idle") {
        setSent(true);
        setRemaining(RESEND_COOLDOWN_SECONDS);
      }
    });
  }

  const waiting = remaining > 0;

  return (
    <div className="flex flex-col gap-3">
      {state.status === "error" && state.message && (
        <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
      )}

      <div className="flex items-center gap-3">
        <Button variant="subtle" onClick={resend} disabled={waiting || isPending}>
          {isPending ? "Sending…" : "Send a new code"}
        </Button>
        {waiting && (
          <span className="tabular text-sm text-ink-muted" aria-live="polite">
            You can resend in {remaining}s
          </span>
        )}
      </div>

      {sent && !waiting && (
        <p className="text-sm text-good" role="status">
          Sent. Check your inbox.
        </p>
      )}
      {sent && waiting && (
        <p className="text-sm text-good" role="status">
          Sent — check your inbox, and your spam folder.
        </p>
      )}
    </div>
  );
}
