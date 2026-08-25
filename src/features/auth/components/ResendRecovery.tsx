"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, ErrorState } from "@/components/ui";
import { RESEND_COOLDOWN_SECONDS, type AuthFormState } from "@/features/auth/constants";
import { resendRecoveryAction } from "@/features/auth/server/actions";

/**
 * Send another recovery code, with a visible countdown.
 *
 * The server enforces the same window — this is a courtesy so a disabled button
 * does not read as broken, not the control itself.
 */
export function ResendRecovery({ initialCooldown }: { initialCooldown: number }) {
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
      const result = await resendRecoveryAction();
      setState(result);
      if (result.status === "idle") {
        setSent(true);
        setRemaining(RESEND_COOLDOWN_SECONDS);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {state.status === "error" && state.message && (
        <ErrorState title={state.message} nextStep={state.nextStep ?? ""} />
      )}

      <div className="flex items-center gap-3">
        <Button variant="subtle" onClick={resend} disabled={remaining > 0 || isPending}>
          {isPending ? "Sending…" : "Send a new code"}
        </Button>
        {remaining > 0 && (
          <span className="tabular text-sm text-ink-muted" aria-live="polite">
            You can resend in {remaining}s
          </span>
        )}
      </div>

      {sent && (
        <p className="text-sm text-good" role="status">
          Sent — check your inbox, and your spam folder.
        </p>
      )}
    </div>
  );
}
