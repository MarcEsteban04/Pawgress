"use client";

import { ChevronDown, ChevronUp, GripVertical, Pencil } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { Button, Card, CardBody, MasteryBar, Tag } from "@/components/ui";
import { DeleteTopicDialog } from "./DeleteTopicDialog";
import { TopicDialog } from "./TopicDialog";
import { moveTopicAction } from "@/features/topics/server/actions";
import { type Topic } from "@/server/topics/queries";
import { cn } from "@/lib/utils";

/**
 * The topics inside one subject, in an order the student controls (FR-S3,
 * FR-S7, US-B4).
 *
 * **Dragging is the shortcut, not the mechanism.** Every move is also available
 * as a pair of buttons, and they are not a grudging fallback — HTML5 drag and
 * drop is mouse-only, does not work on touch, and is invisible to a screen
 * reader. A reorder that can only be performed by dragging is a reorder a
 * portion of students simply cannot perform. The buttons are the accessible
 * path and the drag is sugar on top; both call the same action.
 *
 * The new order is applied optimistically with `useOptimistic`, so a drag lands
 * where it was dropped instead of snapping back for a round trip. If the server
 * rejects it, React discards the optimistic value on its own and the real order
 * returns — no manual rollback, and no local copy of the list to drift.
 *
 * Mastery is genuinely unknown until a quiz has been taken, so `MasteryBar`
 * renders its striped low-evidence state and says so rather than drawing a
 * confident 0% (US-H1). The real numbers arrive with Sprint 49 onward.
 */

type Props = { subjectId: string; topics: Topic[] };

export function TopicList({ subjectId, topics }: Props) {
  const [isPending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /* The optimistic reducer reorders a COPY. Mutating `topics` would edit the
     array React is rendering from and the change would survive a rejection. */
  const [ordered, applyMove] = useOptimistic(
    topics,
    (current, { id, toIndex }: { id: string; toIndex: number }) => {
      const from = current.findIndex((topic) => topic.id === id);
      if (from === -1) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      return next;
    },
  );

  function move(id: string, toIndex: number) {
    if (toIndex < 0 || toIndex >= ordered.length) return;
    setFailed(null);

    /* Inside the transition, so the optimistic value survives until the action
       settles. Calling it outside would revert on the very next render. */
    startTransition(async () => {
      applyMove({ id, toIndex });
      const result = await moveTopicAction(id, toIndex);
      if (result.status === "error") setFailed(result.message ?? "That move did not save.");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {failed && (
        <p role="alert" className="text-sm font-medium text-bad">
          {failed}
        </p>
      )}

      <Card>
        <CardBody className={cn("p-0 transition-opacity", isPending && "opacity-70")}>
          <ul className="divide-y divide-rule">
            {ordered.map((topic, index) => (
              <li
                key={topic.id}
                draggable
                onDragStart={(event) => {
                  setDragging(topic.id);
                  event.dataTransfer.effectAllowed = "move";
                  /* Firefox refuses to start a drag without payload, even one
                     nothing reads. */
                  event.dataTransfer.setData("text/plain", topic.id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setDropTarget(null);
                }}
                onDragOver={(event) => {
                  if (!dragging || dragging === topic.id) return;
                  event.preventDefault();
                  setDropTarget(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragging && dragging !== topic.id) move(dragging, index);
                  setDragging(null);
                  setDropTarget(null);
                }}
                className={cn(
                  "flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:px-5",
                  dragging === topic.id ? "opacity-40" : "hover:bg-surface-sunken",
                  dropTarget === index && dragging !== topic.id && "bg-accent-soft",
                )}
              >
                {/* The handle is decorative — the whole row is draggable, and a
                    handle that were the only drag target would make the row
                    harder to grab, not easier. Hidden from assistive tech
                    because the buttons beside it are the real control. */}
                <GripVertical
                  className="hidden size-4 shrink-0 cursor-grab text-ink-subtle active:cursor-grabbing sm:block"
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{topic.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Tag>
                      {topic.materialCount} {topic.materialCount === 1 ? "file" : "files"}
                    </Tag>
                  </div>
                </div>

                <div className="w-full shrink-0 sm:w-48">
                  <MasteryBar
                    value={topic.mastery}
                    questionCount={topic.questionsAnswered}
                    dense
                    hideEvidence
                  />
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {/* Disabled at the ends rather than hidden: a control that
                      disappears makes the row jump and the next click land on
                      something else. */}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === 0 || isPending}
                    onClick={() => move(topic.id, index - 1)}
                    aria-label={`Move ${topic.name} up`}
                  >
                    <ChevronUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === ordered.length - 1 || isPending}
                    onClick={() => move(topic.id, index + 1)}
                    aria-label={`Move ${topic.name} down`}
                  >
                    <ChevronDown aria-hidden />
                  </Button>

                  <TopicDialog
                    subjectId={subjectId}
                    topic={topic}
                    trigger={
                      <Button variant="ghost" size="sm" aria-label={`Rename ${topic.name}`}>
                        <Pencil aria-hidden />
                      </Button>
                    }
                  />
                  <DeleteTopicDialog topicId={topic.id} topicName={topic.name} />
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {ordered.length > 1 && (
        <p className="text-xs text-ink-subtle">
          Drag a row, or use the arrows, to put topics in the order you study them.
        </p>
      )}
    </div>
  );
}
