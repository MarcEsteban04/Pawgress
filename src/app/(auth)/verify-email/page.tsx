import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonStyles, Card, CardBody, Hairline } from "@/components/ui";
import { ResendVerification } from "@/features/auth/components/ResendVerification";
import { getPendingEmail, getResendCooldown } from "@/features/auth/server/pending";
import { getSession } from "@/server/auth/session";

export const metadata = { title: "Check your email" };

/**
 * Screen 4 in docs/wireframes.md.
 *
 * Reached straight after sign-up. The address comes from an httpOnly cookie set
 * by the register action rather than a query string, so it stays out of browser
 * history, `Referer` headers and server logs.
 *
 * Landing here with nothing pending means the flow was never started (or the
 * cookie expired), so there is nothing to show and nothing to resend — send
 * them back to sign-up rather than render an empty screen.
 */
export default async function VerifyEmailPage() {
  const email = await getPendingEmail();
  const session = await getSession();

  if (!email && !session) redirect("/register");

  const cooldown = await getResendCooldown();
  const address = email ?? session?.email ?? "";

  return (
    <Card>
      <CardBody className="flex flex-col gap-6 pt-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
            Check your email
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
            We sent a confirmation link to{" "}
            <strong className="font-medium text-ink">{address}</strong>. Open it and you are done.
          </p>
        </div>

        <ResendVerification initialCooldown={cooldown} />

        <p className="text-[0.9375rem] text-ink-muted">
          Wrong address?{" "}
          <Link href="/register" className="font-medium text-accent underline underline-offset-4">
            Change it
          </Link>
        </p>

        {/*
          The wireframe puts a "Continue to Pawgress" button here, on the
          principle that a student cramming for Friday should not be blocked by
          an email. That only works when sign-up returned a session — which
          depends on whether the Supabase project requires confirmation before
          sign-in. Rather than render a button that would bounce them straight
          back to /login, it appears only when there is a session to continue
          with. See docs/supabase.md §6.
        */}
        {session && (
          <>
            <Hairline />
            <div className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed text-ink-muted">
                You can start using Pawgress now — we will keep reminding you.
              </p>
              <Link href="/dashboard" className={buttonStyles({ variant: "accent", block: true })}>
                Continue to Pawgress
              </Link>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
