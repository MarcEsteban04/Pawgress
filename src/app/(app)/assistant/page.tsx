import { PageHeader } from "@/components/layout/PageHeader";
import { NotBuiltYet } from "@/components/shared/NotBuiltYet";

export const metadata = { title: "Ask" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ask"
        description="Ask questions about your own uploaded material, with citations you can open."
      />
      <NotBuiltYet what="The study assistant" sprint="Sprint 37" />
    </div>
  );
}
