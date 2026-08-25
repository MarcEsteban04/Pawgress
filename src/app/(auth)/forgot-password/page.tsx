import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.025em]">
          Reset your password
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
          Tell us your email and we will send a 6-digit code. Nothing you have uploaded is affected.
        </p>
      </div>

      <ForgotPasswordForm />
    </div>
  );
}
