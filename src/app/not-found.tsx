import Link from "next/link";
import { buttonStyles } from "@/components/ui";
import { Logo } from "@/components/shared/Logo";

/**
 * 404. Also the screen a student hits when something was deleted while another
 * tab had it open — so it offers routes back rather than just apologising
 * (docs/user-flows.md F9).
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 text-center">
      <Logo />
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">
          This page isn&rsquo;t here
        </h1>
        <p className="mt-3 max-w-[42ch] leading-relaxed text-ink-muted">
          The link may be out of date, or whatever was here was deleted. Nothing else is affected.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/subjects" className={buttonStyles()}>
          Go to your subjects
        </Link>
        <Link href="/dashboard" className={buttonStyles({ variant: "subtle" })}>
          Home
        </Link>
      </div>
    </div>
  );
}
