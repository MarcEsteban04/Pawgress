"use client";

import { ArrowUp, MessageSquare, Sparkles, Square, TriangleAlert } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button, Card, CardBody, EmptyState, Select, SourceChip } from "@/components/ui";
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
    <div className="flex min-h-[60vh] flex-col gap-4">
      {/* Scope is always visible: a student has to know what "my materials"
          means right now before they can trust an answer (US-E3). */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="assistant-scope" className="text-sm text-ink-muted">
          Asking about
        </label>
        <Select
          id="assistant-scope"
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
          className="h-9 w-auto min-w-48 text-sm"
        >
          <option value="">All your subjects</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {messages.length === 0 ? (
          <EmptyState
            Icon={MessageSquare}
            title="Ask about your own material"
            description="Every answer comes from the files and notes you uploaded, with the sources shown so you can check them. If your material does not cover something, Acadify will say so rather than guess."
          />
        ) : (
          messages.map((message) => <Message key={message.id} message={message} onAsk={ask} />)
        )}
      </div>

      <form onSubmit={submit} className="sticky bottom-0 flex flex-col gap-2 bg-paper pt-2">
        <div className="flex items-end gap-2">
          <label htmlFor="assistant-question" className="sr-only">
            Ask about {scopeLabel}
          </label>
          <textarea
            id="assistant-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              /* Enter sends, Shift+Enter breaks the line. A question is usually
                 one line, and reaching for a button after every one is friction
                 a student feels twenty times a session. */
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(event);
              }
            }}
            rows={1}
            placeholder={`Ask about ${scopeLabel}…`}
            className="min-h-11 flex-1 resize-none rounded-[var(--radius-control)] border border-rule bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-subtle"
          />

          {busy ? (
            <Button
              type="button"
              variant="subtle"
              aria-label="Stop generating"
              onClick={() => abortRef.current?.abort()}
            >
              <Square aria-hidden />
              Stop
            </Button>
          ) : (
            <Button type="submit" variant="accent" aria-label="Send" disabled={!question.trim()}>
              <ArrowUp aria-hidden />
            </Button>
          )}
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
      <p className="ml-auto max-w-[85%] rounded-[var(--radius-card)] bg-ink px-4 py-2.5 text-[0.9375rem] leading-relaxed text-on-ink">
        {message.text}
      </p>
    );
  }

  return (
    <Card className="max-w-[92%]">
      <CardBody className="flex flex-col gap-3 p-4">
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
          <div className="flex flex-wrap gap-2 border-t border-rule pt-3">
            {message.citations.map((citation) => (
              <SourceChip
                key={`${citation.materialId}-${citation.page ?? "x"}`}
                material={citation.materialName}
                page={citation.page ?? undefined}
              />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
