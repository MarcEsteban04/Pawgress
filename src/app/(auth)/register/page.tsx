import Link from "next/link";
import { Card, CardBody } from "@/components/ui";
import { NotBuiltYet } from "@/components/shared/NotBuiltYet";

export const metadata = { title: "Create your account" };

export default function RegisterPage() {
  return (
    <Card>
      <CardBody className="flex flex-col gap-5 pt-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
            Create your account
          </h1>
          <p className="mt-2 text-[0.9375rem] text-ink-muted">
            Already have one?{" "}
            <Link href="/login" className="font-semibold text-accent underline">
              Sign in
            </Link>
          </p>
        </div>
        <NotBuiltYet what="Registration and email verification" sprint="Sprint 10" />
      </CardBody>
    </Card>
  );
}
