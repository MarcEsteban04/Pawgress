import { AuthShell } from "@/components/layout/AuthShell";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <AuthShell>{children}</AuthShell>;
}
