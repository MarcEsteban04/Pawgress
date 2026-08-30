"use client";

import { ArrowUp, FileSearch, Sparkles, Square, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { AcadifyMark } from "@/components/shared/Logo";
import { Button, Select, SourceChip } from "@/components/ui";
import { Markdown } from "@/features/assistant/markdown";
import { ConversationRail } from "@/features/assistant/components/ConversationRail";
import {
  appendTurnAction,
  createConversationAction,
} from "@/features/assistant/server/conversations";
import { TASK_MODES, type AssistantTask } from "@/features/assistant/tasks";
import { readFrames, type AssistantCitation, type ChatMessage } from "@/features/assistant/types";
import { cn } from "@/lib/utils";
import { type ConversationSummary, type StoredMessage } from "@/server/conversations/queries";

/**
 * The assistant conversation (FR-C1, FR-C3, US-E1).
 *
 * **History is saved, and saved AFTER the answer has streamed.** Writing it
 * inside the streaming route sounds tidier and is worse: the route would have
 * to hold the row open across a stream the browser may abandon, and a student
 * who pressed stop would still have the half they stopped saved as though they
 * had read it. Appending afterwards means what is stored is what was shown.
 *
 * The cost is honest: a browser that dies mid-answer loses that turn. Losing an
 * answer nobody read beats keeping one nobody saw.
 *
 * **Scope is subject AND topic, and it is inherited.** Retrieval has accepted
 * a topic since Sprint 36 and nothing ever passed one, so a student revising a
 * single chapter had every other chapter of the same class competing for the
 * eight chunks a question gets.
 *
 * Opening Ask from a subject or a topic carries that scope in the URL, and the
 * conversation remembers it. Arriving at "all your subjects" from a page that
 * knew better asks a student to answer a question the app had already answered.
 */

let messageCounter = 0;
function nextId(): string {
  messageCounter += 1;
  return `m${messageCounter}`;
}

/**
 * Stored rows back into the shapes the transcript renders.
 *
 * A saved thread has no `streaming` and no `error` — those are states a turn
 * passes through, not facts about it. Reconstructing them would be inventing a
 * history that did not happen. `ungrounded` IS a fact about the answer rather
 * than a phase of it, so it is stored and restored — an answer that carried the
 * "not from your material" label live must still carry it tomorrow.
 */
function hydrate(stored: StoredMessage[]): ChatMessage[] {
  return stored.map((message) =>
    message.role === "user"
      ? { id: message.id, role: "user" as const, text: message.content }
      : {
          id: message.id,
          role: "assistant" as const,
          question: "",
          text: message.content,
          citations: message.citations,
          /* Finished by definition — a saved turn is one that completed. */
          streaming: false,
          ungrounded: message.ungrounded,
        },
  );
}

export function AssistantChat({
  subjects,
  conversations,
  initial,
  prefill = "",
  prefillSubjectId = "",
  prefillTopicId = "",
}: {
  subjects: { id: string; name: string; topics: { id: string; name: string }[] }[];
  conversations: ConversationSummary[];
  /** The thread the URL asked for, already loaded on the server. */
  initial: {
    id: string;
    subjectId: string | null;
    topicId: string | null;
    useMaterial: boolean;
    messages: StoredMessage[];
  } | null;
  /** A question written for the student elsewhere in the app, not yet sent. */
  prefill?: string;
  prefillSubjectId?: string;
  prefillTopicId?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(() => hydrate(initial?.messages ?? []));
  const [question, setQuestion] = useState(prefill);
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? prefillSubjectId);
  const [topicId, setTopicId] = useState(initial?.topicId ?? prefillTopicId);
  /* On by default — grounding in the student's own material is what the
     product is for, so turning it off is the deliberate act. Restored from the
     thread when one is resumed, so a conversation kept as a general chat stays
     one. */
  const [useMaterial, setUseMaterial] = useState(initial?.useMaterial ?? true);
  /**
   * The study mode the composer is in (Sprint 41).
   *
   * Not persisted on the conversation, unlike the scope. A mode is what a
   * student wants from the NEXT message — they explain, then ask, then get
   * quizzed, inside one thread — where the scope is a property of the thread
   * itself. Storing it would restore "Quiz me" on a conversation someone came
   * back to in order to read.
   */
  const [mode, setMode] = useState<AssistantTask>("ask");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /* The thread being written to. A ref rather than state because `ask` needs
     the value it had when the answer finished, not the value of a render that
     may have happened since — and because changing it must not re-render the
     transcript mid-stream. */
  const conversationRef = useRef<string | null>(initial?.id ?? null);
  const [activeId, setActiveId] = useState<string | null>(initial?.id ?? null);

  /**
   * Save a finished turn, creating the thread if this was the first one.
   *
   * Failures are swallowed on purpose. The answer is on screen and the student
   * is reading it; interrupting that to report that a database write failed
   * would be telling them about our problem in the middle of their work. The
   * action logs it, and the next turn tries again.
   */
  const persist = useCallback(
    async (
      askedQuestion: string,
      answer: string,
      citations: AssistantCitation[],
      ungrounded: boolean,
    ) => {
      let id = conversationRef.current;

      if (!id) {
        const created = await createConversationAction({
          firstQuestion: askedQuestion,
          subjectId: subjectId || null,
          topicId: topicId || null,
          useMaterial,
        });
        if (created.status === "error") return;
        id = created.conversationId;
        conversationRef.current = id;
        setActiveId(id);
      }

      await appendTurnAction({
        conversationId: id,
        question: askedQuestion,
        answer,
        citations,
        ungrounded,
      });

      /* Refresh the server component so the rail shows the new thread and its
         new position, without a full navigation that would unmount the
         transcript the student is reading. */
      router.refresh();
    },
    [router, subjectId, topicId, useMaterial],
  );

  function startNew() {
    abortRef.current?.abort();
    conversationRef.current = null;
    setActiveId(null);
    setMessages([]);
    setQuestion("");
    router.push("/assistant");
  }

  function openConversation(id: string) {
    abortRef.current?.abort();
    /* Navigating rather than fetching here: the thread is a URL, so it can be
       linked, reloaded and reached with the back button — and the server
       already knows how to load one. */
    router.push(`/assistant?c=${id}`);
  }

  const ask = useCallback(
    async (text: string, task: AssistantTask = "ask", replaceId?: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);

      const answerId = replaceId ?? nextId();

      setMessages((current) => {
        const withoutReplaced = replaceId
          ? current.filter((message) => message.id !== replaceId)
          : current;
        const next: ChatMessage[] = replaceId
          ? [...withoutReplaced]
          : [...withoutReplaced, { id: nextId(), role: "user", text }];
        next.push({
          id: answerId,
          role: "assistant",
          question: text,
          text: "",
          citations: [],
          streaming: true,
          /* Assumed grounded until the server says otherwise. The label arrives
             as a frame rather than being predicted here — guessing it would
             mean the badge flickering off once the truth arrived. */
          ungrounded: false,
        });
        return next;
      });

      const patch = (update: Partial<Extract<ChatMessage, { role: "assistant" }>>) =>
        setMessages((current) =>
          current.map((message) =>
            message.id === answerId && message.role === "assistant"
              ? { ...message, ...update }
              : message,
          ),
        );

      try {
        const response = await fetch("/api/assistant/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: text,
            subjectId: subjectId || null,
            topicId: topicId || null,
            useMaterial,
            task,
          }),
          signal: controller.signal,
        });

        if (!response.body) throw new Error("no body");

        let streamed = "";
        let latestCitations: AssistantCitation[] = [];
        /* What the server actually said about this answer, not what the request
           hoped for. Saved with the turn so a resumed conversation carries the
           same label it showed live. */
        let wasUngrounded = false;
        for await (const chunkFrame of readFrames(response.body)) {
          switch (chunkFrame.type) {
            case "text":
              streamed += chunkFrame.value;
              patch({ text: streamed });
              break;
            case "citations":
              latestCitations = chunkFrame.value as AssistantCitation[];
              patch({ citations: latestCitations });
              break;
            case "ungrounded":
              wasUngrounded = true;
              /* Set from a frame the server sends before the first token, not
                 inferred from the answer's wording. A model asked to disclose
                 its own sourcing will sometimes forget; the empty chunk list
                 the server checked cannot. */
              patch({ ungrounded: true });
              break;
            case "error":
              patch({
                error: { message: chunkFrame.message, nextStep: chunkFrame.nextStep },
                streaming: false,
              });
              break;
          }
        }
        patch({ streaming: false });

        /* Saved once, with the finished answer. An empty one is not saved at
           all: a failed or refused turn is not history, and a list full of
           threads containing a single error is a list nobody opens. */
        if (streamed.trim().length > 0) {
          void persist(text, streamed, latestCitations, wasUngrounded);
        }
      } catch (thrown) {
        /* An abort is the student pressing stop, not a failure. Whatever had
           already streamed stays on screen — half an answer they asked to stop
           is still theirs to read. */
        if (thrown instanceof DOMException && thrown.name === "AbortError") {
          patch({ streaming: false });
        } else {
          patch({
            streaming: false,
            error: {
              message: "The connection dropped.",
              nextStep: "Ask again — your question is still in the box.",
            },
          });
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [persist, subjectId, topicId, useMaterial],
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (text.length === 0 || busy) return;
    setQuestion("");
    void ask(text, mode);
  }

  const subject = subjects.find((entry) => entry.id === subjectId);
  const topics = subject?.topics ?? [];
  const topic = topics.find((entry) => entry.id === topicId);

  /* The NARROWEST scope in force, because that is what a student needs to know
     before trusting an answer (US-E3). Naming the subject while a topic filter
     is quietly applied would be the same as not saying. */
  const scopeLabel = topic?.name ?? subject?.name ?? "all your subjects";

  return (
    /* The rail sits OUTSIDE the conversation surface, not inside it. It is a
       list of other conversations — putting it within the panel that shows
       one would say it belongs to that one. Below lg it moves above the chat
       rather than collapsing into a menu: on a narrow screen a student is
       picking a thread before they start reading, not while. */
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <ConversationRail
        conversations={conversations}
        activeId={activeId}
        onSelect={openConversation}
        onNew={startNew}
      />
      {/* One surface for the whole conversation, filling the column. The
          header, the transcript and the composer are parts of a single object
          rather than three things stacked with gaps between them — which is
          what a chat IS, and what a page header floating above a narrow strip
          failed to say. */}
      <div className="flex min-h-[calc(100vh-11rem)] min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-canvas)] border border-rule bg-surface shadow-[var(--shadow-card)]">
        {/**
         * One row, one control group.
         *
         * This had grown into a strip: a title, two lines of description, a
         * standalone switch, a floating "Asking about" label and a select — five
         * objects at four weights, above a conversation that is the actual
         * content. Chrome for a chat should be legible in a glance and then
         * forgotten.
         *
         * The two controls are segments of a single bordered group divided by a
         * hairline, the same language as the subject filter bar. A gap says
         * "different object"; a rule says "same object, next control". The
         * "Asking about" label is gone because the select already reads "All
         * your subjects" — labelling a control that says what it is twice.
         */}
        <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3.5 sm:px-7">
          {/* A wash behind the header only. The transcript below stays plain
              paper, because tinted ground under a long answer is the fastest
              way to make it harder to read. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(70% 150% at 0% 0%, var(--accent-soft) 0%, transparent 60%)",
            }}
          />

          <div className="relative flex min-w-0 items-center gap-3">
            {/* The product mark, not a generic sparkle. Aki is Acadify
                speaking, so she wears its face rather than the icon every
                assistant in the world already uses. */}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-ink text-on-ink shadow-[var(--shadow-pill)]">
              <AcadifyMark className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display leading-tight font-semibold tracking-[-0.02em]">Aki</h1>
              {/* One short line. The long version explained the product to
                  someone reading it for the twentieth time. */}
              <p className="truncate text-xs text-ink-subtle">
                {useMaterial ? "Answers cite the page they came from" : "Not searching your files"}
              </p>
            </div>
          </div>

          {/* Scope is always visible: a student has to know what "my material"
              means right now before they can trust an answer (US-E3). */}
          <div className="relative flex shrink-0 items-stretch overflow-hidden rounded-[var(--radius-pill)] border border-rule bg-surface shadow-[var(--shadow-pill)]">
            {/* A switch, not a checkbox in a menu. It changes what the next
                answer IS, so it belongs where the answer is about to appear and
                its state has to be readable without opening anything. */}
            <button
              type="button"
              role="switch"
              aria-checked={useMaterial}
              onClick={() => setUseMaterial((on) => !on)}
              title={
                useMaterial
                  ? "Aki searches your uploaded files and cites them"
                  : "Aki answers from general knowledge; your files are not searched"
              }
              className={cn(
                "inline-flex h-10 items-center gap-2 px-3.5 text-sm font-medium transition-colors",
                useMaterial
                  ? "bg-accent-soft text-accent"
                  : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              <FileSearch className="size-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap max-sm:sr-only">
                {useMaterial ? "Using my material" : "Just chatting"}
              </span>
            </button>

            <label htmlFor="assistant-scope" className="sr-only">
              Asking about
            </label>
            {/* Disabled rather than hidden when material is off: a control that
                vanishes makes the row jump, and it needs to stay visible so a
                student can see it will apply again when they switch back. */}
            <Select
              id="assistant-scope"
              value={subjectId}
              disabled={!useMaterial}
              onChange={(event) => {
                setSubjectId(event.target.value);
                /* The topic belonged to the old subject. Keeping it would
                   filter to a topic that is not in the subject being searched,
                   which matches nothing and looks like a broken assistant. */
                setTopicId("");
              }}
              className={cn(
                "h-10 w-auto rounded-none border-0 border-l border-rule bg-transparent pr-8 pl-3.5 text-sm shadow-none",
                !useMaterial && "opacity-50",
              )}
            >
              <option value="">All your subjects</option>
              {subjects.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>

            {/* Appears only once a subject is chosen AND that subject has
                topics. A topic filter over "all your subjects" has nothing to
                mean, and one over a subject with no topics can only ever
                narrow to nothing. */}
            {useMaterial && topics.length > 0 && (
              <>
                <label htmlFor="assistant-topic" className="sr-only">
                  Narrow to a topic
                </label>
                <Select
                  id="assistant-topic"
                  value={topicId}
                  onChange={(event) => setTopicId(event.target.value)}
                  className="h-10 w-auto rounded-none border-0 border-l border-rule bg-transparent pr-8 pl-3.5 text-sm shadow-none"
                >
                  <option value="">Every topic</option>
                  {topics.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
              </>
            )}
          </div>
        </header>

        {/* Full-width surface, READING-WIDTH transcript. Prose set across 1900px
          is not a wider page, it is an unreadable one — the eye loses the line
          it is returning to. The panel takes the space; the text keeps the
          measure. */}
        <div className="flex flex-1 flex-col gap-6 px-5 py-6 sm:px-7">
          <div className="mx-auto flex w-full max-w-[60rem] flex-1 flex-col gap-6">
            {messages.length === 0 ? (
              <EmptyConversation
                scopeLabel={scopeLabel}
                useMaterial={useMaterial}
                onPick={(text) => void ask(text, mode)}
              />
            ) : (
              messages.map((message) => (
                <Message key={message.id} message={message} onFollowUp={ask} />
              ))
            )}
          </div>
        </div>

        {/* Pinned to the bottom of the surface rather than floating over the
          transcript. The send control lives INSIDE the field: a button beside a
          text box is two objects, and a composer is one. */}
        <form
          onSubmit={submit}
          className="sticky bottom-0 border-t border-rule bg-surface px-5 py-4 sm:px-7"
        >
          <div className="mx-auto w-full max-w-[60rem]">
            <div className="flex items-end gap-2 rounded-[var(--radius-card)] border border-rule bg-surface px-3 py-2 shadow-[var(--shadow-pill)] transition-colors focus-within:border-rule-strong hover:border-rule-strong">
              {/* Inside the field, because the mode applies to what is typed
                  in it. A mode selector up in the header would sit beside the
                  SCOPE controls, which are properties of the conversation —
                  this is a property of the next message. */}
              <label htmlFor="assistant-mode" className="sr-only">
                What Aki should do
              </label>
              <Select
                id="assistant-mode"
                value={mode}
                onChange={(event) => setMode(event.target.value as AssistantTask)}
                className="h-9 w-auto shrink-0 rounded-[var(--radius-pill)] bg-surface-sunken pr-7 pl-3 text-xs font-medium shadow-none"
              >
                {TASK_MODES.map((entry) => (
                  <option key={entry.task} value={entry.task}>
                    {entry.label}
                  </option>
                ))}
              </Select>

              <label htmlFor="assistant-question" className="sr-only">
                Ask about {scopeLabel}
              </label>
              <textarea
                id="assistant-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  /* Enter sends, Shift+Enter breaks the line. A question is
                   usually one line, and reaching for a button after every one
                   is friction a student feels twenty times a session. */
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit(event);
                  }
                }}
                rows={1}
                autoFocus={prefill.length > 0}
                placeholder={
                  TASK_MODES.find((entry) => entry.task === mode)?.placeholder(scopeLabel) ??
                  `Ask Aki about ${scopeLabel}…`
                }
                className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1 py-1.5 text-base text-ink outline-none placeholder:text-ink-subtle"
              />

              {busy ? (
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  aria-label="Stop generating"
                  onClick={() => abortRef.current?.abort()}
                >
                  <Square aria-hidden />
                  Stop
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="accent"
                  aria-label="Send"
                  disabled={!question.trim()}
                  className="size-9 shrink-0 rounded-full p-0"
                >
                  <ArrowUp aria-hidden />
                </Button>
              )}
            </div>

            {/* Stated once, quietly. A student who has just discovered that
              Enter sends does not need telling again on every render, but a
              student who has not needs telling once. */}
            <p className="mt-2 text-xs text-ink-subtle">
              Enter to send · Shift + Enter for a new line
              {/* Said here rather than left for a student to assume. Practice
                  in chat is not a graded attempt, and a product whose premise
                  is honest measurement must not let one look like the other.
                  Recorded attempts arrive with quizzes in Sprint 52. */}
              {mode === "quiz" && " · Practice only — this does not count toward your progress"}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

function Message({
  message,
  onFollowUp,
}: {
  message: ChatMessage;
  onFollowUp: (text: string, task: AssistantTask) => Promise<void>;
}) {
  if (message.role === "user") {
    return (
      <p className="ml-auto max-w-[85%] rounded-[var(--radius-card)] rounded-br-md bg-ink px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-on-ink shadow-[var(--shadow-pill)]">
        {message.text}
      </p>
    );
  }

  return (
    /* A mark and a column, not a card. The conversation already sits on its
       own surface, and a card per turn would be a box inside a box — which is
       what made the old transcript read as a list of receipts. */
    <div className="flex gap-3.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
        <AcadifyMark className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pb-1">
        {message.ungrounded && (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-warn">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>Not from your material — this is general knowledge.</span>
          </p>
        )}

        {/* Rendered as Markdown rather than printed raw. A model writes
            `**bold**` and fenced code because that is how it has been trained
            to structure an explanation — showing the asterisks means showing
            the student the scaffolding instead of the answer.

            The caret is passed IN rather than placed after, so it sits at the
            end of the sentence being written instead of on a line below it. */}
        {message.text.length > 0 && (
          <Markdown
            text={message.text}
            trailing={
              message.streaming ? (
                <span
                  className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-ink-muted align-middle"
                  aria-hidden
                />
              ) : null
            }
          />
        )}

        {/* Waiting, with nothing to show yet. Distinct from an empty answer. */}
        {message.streaming && message.text.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
            <span className="size-1.5 animate-pulse rounded-full bg-ink-muted" aria-hidden />
            Reading your material…
          </p>
        )}

        {message.error && (
          <p className="flex items-start gap-2 text-sm leading-relaxed text-bad" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {message.error.message} {message.error.nextStep}
            </span>
          </p>
        )}

        {/**
         * Follow-ups, offered where the thing they act on already is.
         *
         * "Simpler" is the one action a student wants often enough to be worth
         * a permanent control: they have just read an answer and it did not
         * land. Putting it under the answer means they do not have to compose a
         * sentence asking for it — and the task prompt keeps every fact while
         * changing the words, which is what typing "explain simpler" would not
         * reliably get.
         *
         * Only on a finished answer with a question behind it. A hydrated turn
         * from a saved thread has no question stored, and re-asking an empty
         * one would send a blank request.
         */}
        {!message.streaming && message.text.length > 0 && message.question && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void onFollowUp(message.question, "simplify")}
              className="rounded-[var(--radius-pill)] border border-rule px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-rule-strong hover:text-ink"
            >
              Explain simpler
            </button>
            <button
              type="button"
              onClick={() => void onFollowUp(message.question, "explain")}
              className="rounded-[var(--radius-pill)] border border-rule px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-rule-strong hover:text-ink"
            >
              Go deeper
            </button>
          </div>
        )}

        {message.citations.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-3">
            <span className="text-[0.6875rem] font-medium tracking-[0.09em] text-ink-subtle uppercase">
              From
            </span>
            {message.citations.map((citation) => (
              <SourceChip
                key={`${citation.materialId}-${citation.page ?? "x"}`}
                material={citation.materialName}
                page={citation.page ?? undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The opening screen.
 *
 * Not an `EmptyState` with an icon and a sentence. An empty chat is the one
 * moment a student has no idea what this thing will do with their files, and a
 * centred "no messages yet" answers none of it. Three starters do — they are
 * the fastest way to learn that answers come from uploaded material, because
 * the first one returns a real citation.
 *
 * The prompts are generic on purpose. Generating them from the student's own
 * topics would need a model call before they have asked anything, which is
 * their quota spent on a suggestion they did not request.
 */
const STARTERS = [
  "What have I uploaded so far?",
  "Summarise the key points",
  "What are the most important terms to know?",
  "What should I revise first?",
];

function EmptyConversation({
  scopeLabel,
  useMaterial,
  onPick,
}: {
  scopeLabel: string;
  useMaterial: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-[var(--radius-tile)] bg-ink text-on-ink shadow-[var(--shadow-pill)]">
        <AcadifyMark className="size-8" />
      </span>

      <div className="max-w-[46ch]">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
          {useMaterial ? `Ask Aki about ${scopeLabel}` : "Chat with Aki"}
        </h2>
        <p className="mt-2 leading-relaxed text-ink-muted">
          {useMaterial
            ? "Answers are built from the files and notes you uploaded and show the page they came from. Aki also knows your library itself — how many subjects you have, what you have uploaded, what is still processing."
            : "Your files are not being searched, so this is an ordinary conversation. Aki still knows your library — your subjects, topics and uploads. Switch “Just chatting” back to “Using my material” to ask about what is inside your files."}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => onPick(starter)}
            className="rounded-[var(--radius-pill)] border border-rule bg-surface px-3.5 py-2 text-sm font-medium shadow-[var(--shadow-pill)] transition-colors hover:border-rule-strong hover:bg-surface-sunken"
          >
            {starter}
          </button>
        ))}
      </div>
    </div>
  );
}
