import { AuthShell } from "@/components/layout/AuthShell";

/**
 * `aside` is a parallel route slot (`@aside`), so each account screen can argue
 * its own case without this layout knowing which page is underneath it.
 */
export default function AuthLayout({ children, aside }: LayoutProps<"/">) {
  return <AuthShell aside={aside}>{children}</AuthShell>;
}
