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

  /* Full width, and no PageHeader. A conversation is not a document with a
     masthead above it — the heading belonged inside the surface it describes,
     which is where it is now. The chat owns the whole column so its composer
     can sit on the page's own edge rather than floating in a narrow strip. */
  return (
    <AssistantChat subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))} />
  );
}
