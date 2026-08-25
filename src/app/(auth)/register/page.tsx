import { Card, CardBody } from "@/components/ui";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata = { title: "Create your account" };

export default function RegisterPage() {
  return (
    <Card>
      <CardBody className="flex flex-col gap-6 pt-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
            Create your account
          </h1>
          <p className="mt-2 text-[0.9375rem] text-ink-muted">
            Two fields. Everything else can wait until you are inside.
          </p>
        </div>

        <RegisterForm />
      </CardBody>
    </Card>
  );
}
