import { AlreadySignedIn } from "@/features/auth/components/AlreadySignedIn";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { getSession } from "@/server/auth/session";
import { DEFAULT_SIGNED_IN_PATH } from "@/lib/redirects";

export const metadata = { title: "Create your account" };

/**
 * Not redirected away by the proxy when a session exists — see `AUTH_ROUTES`.
 * A new student on a shared machine clicking "Create account" was landing in
 * the previous student's dashboard, with no way to tell what had happened or to
 * get out of it.
 */
export default async function RegisterPage() {
  const session = await getSession();
  if (session) {
    return <AlreadySignedIn email={session.email} next={DEFAULT_SIGNED_IN_PATH} intent="signup" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">
          Create your account
        </h1>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">
          Two fields. Everything else can wait until you are inside.
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}
