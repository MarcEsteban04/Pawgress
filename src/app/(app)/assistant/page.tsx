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
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const requested = first("c");

  /* A question handed over from somewhere else in the app — a topic row asking
     Aki to explain it. Prefilled, never auto-sent: a click that spends a
     generation from a daily allowance should happen where a student can still
     read and edit the question first. */
  const prefill = first("ask") ?? "";
  const prefillSubjectId = first("subject") ?? "";

  const [subjects, conversations, thread] = await Promise.all([
    listSubjects(),
    listConversations(),
    requested ? getConversation(requested) : Promise.resolve(null),
  ]);

  return (
    <AssistantChat
      /**
       * Keyed on the thread, and that is load-bearing.
       *
       * The transcript, the scope and the active id are all `useState`
       * initialisers, and an initialiser runs on MOUNT and never again.
       * Navigating from one conversation to another re-rendered the same
       * instance with new props, so the old messages stayed on screen and the
       * new ones were never read — clicking a thread appeared to do nothing.
       *
       * A different conversation is a different thing, so it gets a different
       * component. The key also drops any answer still streaming from the
       * thread being left, which is the correct outcome rather than a side
       * effect: that answer belongs to the conversation it was asked in.
       *
       * `"new"` for the unsaved case, and it stays `"new"` after the first
       * turn creates a row — the URL is deliberately not rewritten there, so
       * the key does not change and the transcript a student is reading is not
       * torn down underneath them.
       */
      key={thread?.conversation.id ?? "new"}
      subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
      conversations={conversations}
      prefill={requested ? "" : prefill}
      prefillSubjectId={requested ? "" : prefillSubjectId}
      /* An unknown or deleted id opens a new chat rather than erroring. A stale
         link from a bookmark is not a failure worth a page for — the student
         wanted to ask something, and the composer is right there. */
      initial={
        thread
          ? {
              id: thread.conversation.id,
              subjectId: thread.conversation.subjectId,
              useMaterial: thread.conversation.useMaterial,
              messages: thread.messages,
            }
          : null
      }
    />
  );
}
