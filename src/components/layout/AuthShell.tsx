import Link from "next/link";
import { type ReactNode } from "react";
import { Logo } from "@/components/shared/Logo";
import { AuthProof } from "@/features/auth/components/AuthProof";

/**
 * The account screens — sign in, register, confirm.
 *
 * Same materials as the landing page (neutral ground, white frame, dot-grid
 * texture, floating product object, two-tone display headline) arranged the
 * opposite way, so the two never feel like the same screen:
 *
 * | Landing | Auth |
 * |---|---|
 * | Symmetric, centred | Asymmetric split |
 * | Texture spans the full width | Texture confined to one column |
 * | Six objects, cropped by the edges | One object, whole and centred |
 * | The headline is the hero | The form is the hero; the headline supports it |
 *
 * The aside is dropped below `lg` rather than stacked. On a phone it would push
 * the form below the fold, and a student who came here to sign in does not need
 * to be sold to again.
 *
 * It lives here rather than inside `(auth)/layout.tsx` because two route trees
 * need it: the `(auth)` group for `/login`, `/register` and `/verify-email`,
 * and the real `/auth/*` segment that Supabase redirects into.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-frame lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Aside — the reason to bother, from `lg` up. */}
      <aside className="dot-grid relative hidden flex-col justify-between border-r border-rule p-10 lg:flex xl:p-14">
        <Link href="/" aria-label="Pawgress home" className="w-fit">
          <Logo />
        </Link>

        <div className="flex flex-col gap-8 py-10">
          <div>
            <p className="text-sm text-ink-muted">For high school and college students</p>
            <h2 className="mt-3 max-w-[16ch] font-display text-[clamp(2rem,3.2vw,3rem)] leading-[1.06] font-semibold tracking-[-0.03em]">
              Study what matters,
              <br />
              <span className="text-ink-subtle">not just more</span>
            </h2>
          </div>

          <AuthProof />
        </div>

        <p className="max-w-[42ch] text-sm leading-relaxed text-ink-muted">
          Every reviewer, flashcard and quiz question comes from material you uploaded — and cites
          the page it came from.
        </p>
      </aside>

      {/* Form column. */}
      <main className="flex flex-1 flex-col">
        {/* The brand only appears here below `lg`, where the aside is gone. */}
        <div className="flex h-16 items-center px-5 sm:px-8 lg:hidden">
          <Link href="/" aria-label="Pawgress home">
            <Logo />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8 lg:py-12">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
      </main>
    </div>
  );
}
