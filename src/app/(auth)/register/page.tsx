import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata = { title: "Create your account" };

export default function RegisterPage() {
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
