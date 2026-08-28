import { AssistantChat } from "@/features/assistant/components/AssistantChat";
import { getConversation, listConversations } from "@/server/conversations/queries";
import { listSubjects } from "@/server/subjects/queries";

export const metadata = { title: "Ask" };

/**
 * The assistant (FR-C1, FR-C6, US-E1, US-E5).
 *
 * A server component that loads the subject list, the saved conversations and —
 * when the URL names one — that thread's messages, then hands them to a client
 * component. Only the conversation itself needs to be client-side; the shell
 * around it has no reason to ship JavaScript.
 *
 * **The open thread is a URL, not component state.** `?c=<id>` means a
 * conversation can be linked, reloaded and reached with the back button, and it
 * means the messages arrive already rendered rather than after a fetch the
 * student watches happen.
 *
 * Full width, and no PageHeader. A conversation is not a document with a
 * masthead above it — the heading belongs inside the surface it describes.
 */
export default async function Page({ searchParams }: PageProps<"/assistant">) {
  const params = await searchParams;
  const raw = params.c;
  const requested = Array.isArray(raw) ? raw[0] : raw;

  const [subjects, conversations, thread] = await Promise.all([
    listSubjects(),
    listConversations(),
    requested ? getConversation(requested) : Promise.resolve(null),
  ]);

  return (
    <AssistantChat
      subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
      conversations={conversations}
      /* An unknown or deleted id opens a new chat rather than erroring. A stale
         link from a bookmark is not a failure worth a page for — the student
         wanted to ask something, and the composer is right there. */
      initial={
        thread
          ? {
              id: thread.conversation.id,
              subjectId: thread.conversation.subjectId,
              messages: thread.messages,
            }
          : null
      }
    />
  );
}
