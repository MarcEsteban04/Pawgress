import Link from "next/link";
import { type ReactNode } from "react";
import { Logo } from "@/components/shared/Logo";
import { AuthAsideDefault } from "@/features/auth/components/AuthAsideDefault";

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
 *
 * `aside` is filled by the `@aside` parallel route, so each screen can argue its
 * own case — someone signing in has already been sold and wants to know what is
 * waiting, which is a different message from someone deciding whether to start.
 * A slot rather than a prop, because the layout must not have to know which page
 * is underneath it.
 */
export function AuthShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-frame lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Aside — the reason to bother, from `lg` up. */}
      <aside className="dot-grid relative hidden flex-col border-r border-rule p-10 lg:flex xl:p-14">
        {/* The mark stays pinned to the corner. It is chrome, not part of the
            composition — centring it with everything else reads as a splash
            screen rather than a page. */}
        <Link href="/" aria-label="Acadify home" className="w-fit shrink-0">
          <Logo />
        </Link>

        {/*
          One centred block, rather than three pieces pinned to top, middle and
          bottom. This column is far wider than its content, so spreading them to
          the edges left a void down the right and a gap under the card.

          Text stays left-aligned inside the block: a centred ragged edge makes a
          three-line paragraph measurably slower to scan, and centring the card's
          own rows would be worse still.
        */}
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="flex w-full max-w-[26rem] flex-col gap-8">
            {aside ?? <AuthAsideDefault />}
          </div>
        </div>
      </aside>

      {/* Form column. */}
      <main className="flex flex-1 flex-col">
        {/* The brand only appears here below `lg`, where the aside is gone. */}
        <div className="flex h-16 items-center px-5 sm:px-8 lg:hidden">
          <Link href="/" aria-label="Acadify home">
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
