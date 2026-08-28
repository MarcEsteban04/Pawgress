"use client";

import { ArrowUp, Sparkles, Square, TriangleAlert } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button, Select, SourceChip } from "@/components/ui";
import { Markdown } from "@/features/assistant/markdown";
import { readFrames, type AssistantCitation, type ChatMessage } from "@/features/assistant/types";

/**
 * The assistant conversation (FR-C1, FR-C3, US-E1).
 *
 * **History lives in this component, not in the database.** Saving, renaming and
 * resuming conversations is Sprint 40; until then a reload starts fresh, which
 * is honest — a half-built persistence layer that loses messages on a refresh
 * would be worse than one that never claimed to keep them.
 *
 * The subject selector is here because retrieval already takes a scope and an
 * assistant that searches everything is a worse product than one that does not.
 * Making it CONTEXTUAL — inheriting the subject from the page a student is on,
 * scoping to a topic, remembering the choice — is Sprint 39.
 */

let messageCounter = 0;
function nextId(): string {
  messageCounter += 1;
  return `m${messageCounter}`;
}

export function AssistantChat({ subjects }: { subjects: { id: string; name: string }[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const ask = useCallback(
    async (text: string, allowUngrounded: boolean, replaceId?: string) => {
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
          ungrounded: allowUngrounded,
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
            allowUngrounded,
          }),
          signal: controller.signal,
        });

        if (!response.body) throw new Error("no body");

        let streamed = "";
        for await (const chunkFrame of readFrames(response.body)) {
          switch (chunkFrame.type) {
            case "text":
              streamed += chunkFrame.value;
              patch({ text: streamed });
              break;
            case "citations":
              patch({ citations: chunkFrame.value as AssistantCitation[] });
              break;
            case "no_material":
              patch({ noMaterial: true, streaming: false });
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
    [subjectId],
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (text.length === 0 || busy) return;
    setQuestion("");
    void ask(text, false);
  }

  const scopeLabel =
    subjects.find((subject) => subject.id === subjectId)?.name ?? "all your subjects";

  return (
    /* One surface for the whole conversation, filling the column. The header,
       the transcript and the composer are parts of a single object rather than
       three things stacked with gaps between them — which is what a chat IS,
       and what the previous layout of a page header floating above a narrow
       strip failed to say. */
    <div className="flex min-h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-[var(--radius-canvas)] border border-rule bg-surface shadow-[var(--shadow-card)]">
      <header className="relative flex flex-col gap-4 border-b border-rule px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
        {/* A wash behind the header only. The transcript below stays plain
            paper, because tinted ground under a long answer is the fastest way
            to make it harder to read. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 160% at 0% 0%, var(--accent-soft) 0%, transparent 62%)",
          }}
        />

        <div className="relative flex items-start gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-xl leading-tight font-semibold tracking-[-0.02em]">
              Ask
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Answers come from what you uploaded, with the sources shown so you can check them.
            </p>
          </div>
        </div>

        {/* Scope is always visible: a student has to know what "my materials"
            means right now before they can trust an answer (US-E3). */}
        <div className="relative flex shrink-0 items-center gap-2">
          <label htmlFor="assistant-scope" className="text-sm whitespace-nowrap text-ink-muted">
            Asking about
          </label>
          <Select
            id="assistant-scope"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            className="h-10 w-auto min-w-48 rounded-[var(--radius-pill)] text-sm"
          >
            <option value="">All your subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </Select>
        </div>
      </header>

      {/* Full-width surface, READING-WIDTH transcript. Prose set across 1900px
          is not a wider page, it is an unreadable one — the eye loses the line
          it is returning to. The panel takes the space; the text keeps the
          measure. */}
      <div className="flex flex-1 flex-col gap-6 px-5 py-7 sm:px-7">
        <div className="mx-auto flex w-full max-w-[52rem] flex-1 flex-col gap-6">
          {messages.length === 0 ? (
            <EmptyConversation scopeLabel={scopeLabel} onPick={(text) => void ask(text, false)} />
          ) : (
            messages.map((message) => <Message key={message.id} message={message} onAsk={ask} />)
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
        <div className="mx-auto w-full max-w-[52rem]">
          <div className="flex items-end gap-2 rounded-[var(--radius-card)] border border-rule bg-surface px-3 py-2 shadow-[var(--shadow-pill)] transition-colors focus-within:border-rule-strong hover:border-rule-strong">
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
              placeholder={`Ask about ${scopeLabel}…`}
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
          </p>
        </div>
      </form>
    </div>
  );
}

function Message({
  message,
  onAsk,
}: {
  message: ChatMessage;
  onAsk: (text: string, allowUngrounded: boolean, replaceId?: string) => Promise<void>;
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
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Sparkles className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pb-1">
        {message.ungrounded && !message.noMaterial && (
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

        {/* The honest empty case, and the explicit opt-in (FR-C3). Never
            answered from general knowledge without the student choosing it. */}
        {message.noMaterial && (
          <div className="flex flex-col gap-3">
            <p className="flex items-start gap-2 text-[0.9375rem] leading-relaxed">
              <TriangleAlert className="mt-1 size-4 shrink-0 text-warn" aria-hidden />
              <span>
                Your material does not cover this. Nothing you have uploaded is close enough to
                answer from.
              </span>
            </p>
            <div>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => void onAsk(message.question, true, message.id)}
              >
                Answer without my material
              </Button>
            </div>
          </div>
        )}

        {message.error && (
          <p className="flex items-start gap-2 text-sm leading-relaxed text-bad" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {message.error.message} {message.error.nextStep}
            </span>
          </p>
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
  "Summarise the key points",
  "What are the most important terms to know?",
  "Explain this in simpler words",
  "What should I revise first?",
];

function EmptyConversation({
  scopeLabel,
  onPick,
}: {
  scopeLabel: string;
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-[var(--radius-tile)] bg-accent-soft text-accent">
        <Sparkles className="size-6" aria-hidden />
      </span>

      <div className="max-w-[46ch]">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
          Ask about {scopeLabel}
        </h2>
        <p className="mt-2 leading-relaxed text-ink-muted">
          Every answer is built from the files and notes you uploaded, and shows the page it came
          from. If your material does not cover something, Acadify says so rather than guessing.
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
