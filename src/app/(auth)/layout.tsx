import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

/**
 * Auth shell — a centred card floating on the same gradient as the app canvas.
 *
 * Nothing to distract from one task, and no rail to imply there is an app
 * behind the door yet (docs/navigation.md §1).
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-7 px-5 py-12">
      <Link href="/" aria-label="Pawgress home">
        <Logo />
      </Link>
      <div className="w-full max-w-[25rem]">{children}</div>
      <p className="text-sm text-ink-muted">Don&rsquo;t just study more.</p>
    </div>
  );
}
