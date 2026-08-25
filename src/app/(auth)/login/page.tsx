import Link from "next/link";
import { NotBuiltYet } from "@/components/shared/NotBuiltYet";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">
          Welcome back
        </h1>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">
          New here?{" "}
          <Link href="/register" className="font-medium text-accent underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>

      <NotBuiltYet what="Signing in" sprint="Sprint 11" />
    </div>
  );
}
