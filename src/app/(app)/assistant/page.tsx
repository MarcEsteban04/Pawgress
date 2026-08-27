import { PageHeader } from "@/components/layout/PageHeader";
import { AssistantChat } from "@/features/assistant/components/AssistantChat";
import { listSubjects } from "@/server/subjects/queries";

export const metadata = { title: "Ask" };

/**
 * The assistant (FR-C1, US-E1).
 *
 * A server component that fetches the subject list and hands it to a client
 * component. Only the conversation needs to be client-side; the shell around it
 * has no reason to ship JavaScript.
 */
export default async function Page() {
  const subjects = await listSubjects();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader
        eyebrow="Answers grounded in your own files"
        title="Ask"
        description="Every answer comes from what you uploaded, with the sources shown so you can check them."
      />
      <AssistantChat
        subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
      />
    </div>
  );
}
