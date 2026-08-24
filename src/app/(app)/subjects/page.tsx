import { PageHeader } from "@/components/layout/PageHeader";
import { NotBuiltYet } from "@/components/shared/NotBuiltYet";

export const metadata = { title: "Subjects" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Subjects"
        description="One place per class. Your files, topics and quizzes live inside a subject."
      />
      <NotBuiltYet what="Creating and browsing subjects" sprint="Sprint 19" />
    </div>
  );
}
