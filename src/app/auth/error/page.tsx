import Link from "next/link";
import { buttonStyles, Card, CardBody } from "@/components/ui";

export const metadata = { title: "That link did not work" };

/**
 * Where a confirmation link lands when it cannot be used.
 *
 * Each reason gets its own copy, because "invalid or expired link" leaves a
 * student with nothing to do. An expired link means *ask for another one*; an
 * already-used link usually means they are simply signed in already, and the
 * right advice is to go and check rather than to start over
 * (docs/states.md §5).
 */
const REASONS = {
  expired: {
    title: "That link has expired",
    body: "Confirmation links are short-lived so that an old email in your inbox cannot be used to take over your account.",
    action: { href: "/verify-email", label: "Send a new link" },
  },
  used: {
    title: "That link has already been used",
    body: "Confirmation links work once. If you clicked it before, your email is already confirmed and you can just sign in.",
    action: { href: "/login", label: "Sign in" },
  },
  invalid: {
    title: "That link did not work",
    body: "It may have been cut in half by your email app — that happens with long links. Asking for a fresh one usually fixes it.",
    action: { href: "/verify-email", label: "Send a new link" },
  },
} as const;

type Reason = keyof typeof REASONS;

function isReason(value: string | undefined): value is Reason {
  return value === "expired" || value === "used" || value === "invalid";
}

export default async function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  const params = await searchParams;
  const raw = Array.isArray(params.reason) ? params.reason[0] : params.reason;
  const { title, body, action } = REASONS[isReason(raw) ? raw : "invalid"];

  return (
    <Card>
      <CardBody className="flex flex-col gap-5 pt-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{body}</p>
        </div>

        <Link href={action.href} className={buttonStyles({ variant: "accent", block: true })}>
          {action.label}
        </Link>

        <p className="text-center text-[0.9375rem] text-ink-muted">
          Nothing you have uploaded is affected.
        </p>
      </CardBody>
    </Card>
  );
}
