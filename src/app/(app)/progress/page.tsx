import { PageHeader } from "@/components/layout/PageHeader";
import { NotBuiltYet } from "@/components/shared/NotBuiltYet";

export const metadata = { title: "Progress" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Progress"
        description="Topic mastery, quiz history and the topics holding you back."
      />
      <NotBuiltYet what="Progress tracking" sprint="Sprint 55" />
    </div>
  );
}
