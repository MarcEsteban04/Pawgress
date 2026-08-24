import Link from "next/link";
import { Card, CardBody } from "@/components/ui";
import { NotBuiltYet } from "@/components/shared/NotBuiltYet";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Card>
      <CardBody className="flex flex-col gap-5 pt-5">
        <div>
          <h1 className="font-display text-2xl font-medium">Welcome back</h1>
          <p className="mt-2 text-[0.9375rem] text-ink-muted">
            New here?{" "}
            <Link href="/register" className="font-semibold text-accent underline">
              Create an account
            </Link>
          </p>
        </div>
        <NotBuiltYet what="Signing in" sprint="Sprint 11" />
      </CardBody>
    </Card>
  );
}
