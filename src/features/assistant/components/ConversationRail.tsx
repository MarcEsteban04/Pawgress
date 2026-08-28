"use client";

import { MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import {
  deleteConversationAction,
  renameConversationAction,
} from "@/features/assistant/server/conversations";
import { type ConversationSummary } from "@/server/conversations/queries";
import { cn } from "@/lib/utils";

/**
 * The list of saved conversations (FR-C6, US-E5).
 *
 * A rail beside the chat rather than a dropdown above it. A thread list is
 * scanned, not selected from — a student looking for "the one about mitosis"
 * reads titles, and a control that hides them behind a click makes that a
 * search instead of a glance.
 *
 * **Renaming is inline.** A dialog for a single text field is a modal asking
 * permission to edit one word. Escape cancels, Enter commits, blur commits —
 * the three things a person tries.
 *
 * Deleting is confirmed once, in place, and does not ask a student to type
 * anything: a conversation is recoverable by asking again, which a term of
 * uploaded work is not, and friction should match the loss.
 */
export function ConversationRail({
  conversations,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function commitRename(id: string) {
    const title = draft.trim();
    setRenaming(null);
    if (title.length === 0) return;
    startTransition(async () => {
      await renameConversationAction(id, title);
    });
  }

  function remove(id: string) {
    setConfirming(null);
    startTransition(async () => {
      await deleteConversationAction(id);
      if (id === activeId) onNew();
    });
  }

  return (
    <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-64">
      <Button variant="subtle" onClick={onNew} className="w-full justify-start">
        <Plus aria-hidden />
        New chat
      </Button>

      {conversations.length === 0 ? (
        /* Not an empty state with an icon and an apology. The rail is empty
           because nothing has been asked yet, and the composer beside it
           already says what to do. One quiet line is the whole message. */
        <p className="px-1 text-sm leading-relaxed text-ink-subtle">
          Your conversations are saved here once you ask something.
        </p>
      ) : (
        <ul className={cn("flex flex-col gap-1", isPending && "opacity-70 transition-opacity")}>
          {conversations.map((conversation) => {
            const active = conversation.id === activeId;

            return (
              <li key={conversation.id}>
                {renaming === conversation.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => commitRename(conversation.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitRename(conversation.id);
                      }
                      if (event.key === "Escape") setRenaming(null);
                    }}
                    maxLength={300}
                    aria-label="Conversation name"
                    className="w-full rounded-[var(--radius-control)] border border-rule-strong bg-surface px-3 py-2 text-sm outline-none"
                  />
                ) : confirming === conversation.id ? (
                  <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-bad/30 bg-bad-soft/40 p-2.5">
                    <p className="text-xs leading-relaxed">Delete this conversation?</p>
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" onClick={() => remove(conversation.id)}>
                        Delete
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                        Keep
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* An accent spine on the open thread, not just a grey fill.
                     A fill alone is the same signal as hover, so at a glance the
                     list has two rows that look selected — the one under the
                     cursor and the one actually open. */
                  <div
                    className={cn(
                      "group relative flex items-center gap-1 rounded-[var(--radius-control)] transition-colors",
                      active
                        ? "bg-surface-sunken before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent before:content-['']"
                        : "hover:bg-surface-sunken",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(conversation.id)}
                      aria-current={active ? "true" : undefined}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 text-left"
                    >
                      <MessageSquare
                        className={cn(
                          "size-3.5 shrink-0",
                          active ? "text-accent" : "text-ink-subtle",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm",
                            active ? "font-medium" : "text-ink-muted",
                          )}
                        >
                          {conversation.title}
                        </span>
                        {conversation.subjectName && (
                          <span className="block truncate text-xs text-ink-subtle">
                            {conversation.subjectName}
                          </span>
                        )}
                      </span>
                    </button>

                    {/* Revealed on hover on pointer devices, always present
                        under lg where there is no hover to reveal them. */}
                    <div className="flex shrink-0 items-center gap-0.5 pr-1 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label={`Rename ${conversation.title}`}
                        onClick={() => {
                          setDraft(conversation.title);
                          setRenaming(conversation.id);
                        }}
                        className="rounded-full p-1.5 text-ink-subtle transition-colors hover:text-ink"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${conversation.title}`}
                        onClick={() => setConfirming(conversation.id)}
                        className="rounded-full p-1.5 text-ink-subtle transition-colors hover:text-bad"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
