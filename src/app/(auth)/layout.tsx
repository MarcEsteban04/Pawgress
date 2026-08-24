import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

/**
 * Auth shell — a centred card, no navigation.
 *
 * Nothing to distract from one task, and no sidebar to imply there is an app
 * behind the door yet (docs/navigation.md §1).
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-12">
      <Link href="/" aria-label="Pawgress home">
        <Logo />
      </Link>
      <div className="w-full max-w-[24rem]">{children}</div>
      <p className="font-mono text-xs text-ink-subtle">Don&rsquo;t just study more.</p>
    </div>
  );
}
