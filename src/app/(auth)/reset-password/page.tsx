import Link from "next/link";
import { redirect } from "next/navigation";
import { ResendRecovery } from "@/features/auth/components/ResendRecovery";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { getRecoveryCooldown, getRecoveryEmail } from "@/features/auth/server/pending";

export const metadata = { title: "Choose a new password" };

/**
 * Landing here with no recovery pending means the request was never made, or
 * the cookie expired — there is no address to reset and no code to check, so
 * send them back rather than render a form that cannot succeed.
 */
export default async function ResetPasswordPage() {
  const email = await getRecoveryEmail();
  if (!email) redirect("/forgot-password");

  const cooldown = await getRecoveryCooldown();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">
          Choose a new password
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
          If <strong className="font-medium text-ink">{email}</strong> has an account, a 6-digit
          code is on its way.
        </p>
      </div>

      <ResetPasswordForm />

      <div className="flex flex-col gap-3 border-t border-rule pt-5">
        <ResendRecovery initialCooldown={cooldown} />
        <p className="text-[0.9375rem] text-ink-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-accent underline underline-offset-4">
            Sign in instead
          </Link>
        </p>
      </div>
    </div>
  );
}
