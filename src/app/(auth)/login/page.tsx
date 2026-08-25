import { LoginForm } from "@/features/auth/components/LoginForm";
import { safeNextPath } from "@/lib/redirects";

export const metadata = { title: "Sign in" };

/**
 * `?next=` is where the proxy put the route they originally asked for, so
 * signing in returns them there rather than to a generic home page (US-A3).
 * It is validated here as well as in the action — the value came from a URL,
 * which means it came from whoever wrote the link.
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(raw);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">
          Welcome back
        </h1>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">
          Pick up where your last quiz left off.
        </p>
      </div>

      <LoginForm next={next} />
    </div>
  );
}
