import { PageHeader } from "@/components/layout/PageHeader";
import { NotBuiltYet } from "@/components/shared/NotBuiltYet";

export const metadata = { title: "Settings" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Your account, today's AI usage, and appearance." />
      <NotBuiltYet what="Profile and account settings" sprint="Sprint 15" />
    </div>
  );
}
