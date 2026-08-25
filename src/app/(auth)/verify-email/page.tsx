import Link from "next/link";
import { redirect } from "next/navigation";
import { ResendVerification } from "@/features/auth/components/ResendVerification";
import { VerifyCodeForm } from "@/features/auth/components/VerifyCodeForm";
import { getPendingEmail, getResendCooldown } from "@/features/auth/server/pending";
import { getSession } from "@/server/auth/session";

export const metadata = { title: "Confirm your email" };

/**
 * Screen 4 in docs/wireframes.md, rebuilt around a 6-digit code.
 *
 * The address comes from an httpOnly cookie set by the register action rather
 * than a query string, so it stays out of browser history, `Referer` headers
 * and server logs.
 *
 * Landing here with nothing pending means the flow was never started, or the
 * cookie expired. There is nothing to confirm and nothing to resend, so send
 * them back to sign-up rather than render an empty screen.
 */
export default async function VerifyEmailPage() {
  const email = await getPendingEmail();
  const session = await getSession();

  if (!email && !session) redirect("/register");

  const cooldown = await getResendCooldown();
  const address = email ?? session?.email ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">
          Enter your code
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
          We sent a 6-digit code to <strong className="font-medium text-ink">{address}</strong>.
        </p>
      </div>

      <VerifyCodeForm />

      <div className="flex flex-col gap-3 border-t border-rule pt-5">
        <ResendVerification initialCooldown={cooldown} />
        <p className="text-[0.9375rem] text-ink-muted">
          Wrong address?{" "}
          <Link href="/register" className="font-medium text-accent underline underline-offset-4">
            Start again
          </Link>
        </p>
      </div>
    </div>
  );
}
