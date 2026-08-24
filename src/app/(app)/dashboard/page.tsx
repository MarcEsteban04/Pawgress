import { PageHeader } from "@/components/layout/PageHeader";
import { NotBuiltYet } from "@/components/shared/NotBuiltYet";

export const metadata = { title: "Home" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Home" description="What should I do today?" />
      <NotBuiltYet
        what="Your dashboard — next exam, readiness, today's plan and weak topics"
        sprint="Sprint 70"
      />
    </div>
  );
}
