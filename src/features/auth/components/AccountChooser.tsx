import { ChevronRight, UserRound, X } from "lucide-react";
import Link from "next/link";
import { forgetAccountAction } from "@/features/auth/server/actions";

/**
 * Pick an account, then enter its password.
 *
 * The pattern every student already knows from Google's "Choose an account":
 * the addresses that have signed in on this browser, each with an × to forget
 * it, and one row to use a different one.
 *
 * **A suggestion, never a key.** Choosing a row does not sign anybody in — it
 * fills the address into the sign-in form and asks for that account's password.
 * That is the whole distinction the earlier version got wrong: recognising a
 * browser is worth something, and treating recognition as proof of identity is
 * what let one student land in another's account with a single click.
 *
 * THE ROW LINKS BY POSITION, NOT BY ADDRESS. `pending.ts` explains why an email
 * never goes in a URL: it would end up in browser history, in any `Referer` the
 * page sends, and in server logs. `?i=0` leaks nothing, and the page resolves it
 * against the same cookie it rendered from.
 *
 * The × is a separate sibling form rather than nested inside the row's link —
 * a form inside an anchor is invalid HTML, and a button inside a link is a
 * click target with two meanings.
 */
export function AccountChooser({ accounts, next }: { accounts: string[]; next: string }) {
  const params = (index: number) => {
    const search = new URLSearchParams({ i: String(index) });
    if (next) search.set("next", next);
    return `/login?${search.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">
          Choose an account
        </h1>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">
          You will still be asked for the password.
        </p>
      </div>

      <ul className="divide-y divide-rule overflow-hidden rounded-[var(--radius-card)] border border-rule bg-surface">
        {accounts.map((email, index) => (
          <li key={email} className="flex items-center">
            <Link
              href={params(index)}
              className="flex min-w-0 flex-1 items-center gap-3 p-4 transition-colors hover:bg-surface-sunken"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
                <UserRound className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{email}</span>
              <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
            </Link>

            {/* A form, not a link: forgetting an account is a state change and
                must not be reachable by a prefetch or a crawler. */}
            <form action={forgetAccountAction} className="shrink-0 pr-2">
              <input type="hidden" name="email" value={email} />
              <button
                type="submit"
                aria-label={`Forget ${email}`}
                className="flex size-9 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </form>
          </li>
        ))}

        <li>
          <Link
            href={next ? `/login?i=new&next=${encodeURIComponent(next)}` : "/login?i=new"}
            className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-sunken"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-rule-strong text-ink-subtle">
              <UserRound className="size-4" aria-hidden />
            </span>
            <span className="flex-1 font-medium text-ink-muted">Use another account</span>
            <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
          </Link>
        </li>
      </ul>
    </div>
  );
}
