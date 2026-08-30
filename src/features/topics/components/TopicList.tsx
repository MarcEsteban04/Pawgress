"use client";

import { ChevronDown, ChevronUp, GripVertical, Pencil, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Button, Card, CardBody, MasteryBar } from "@/components/ui";
import { DeleteTopicDialog } from "./DeleteTopicDialog";
import { TopicDialog } from "./TopicDialog";
import { UploadDialog } from "@/features/materials/components/UploadDialog";
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
 *
 * **Each row uploads into its own topic.** Filing a file was previously a
 * dropdown inside one upload dialog at the far end of the page — so adding
 * slides to "Chapter 3" meant scrolling past the topic that was already on
 * screen, opening a dialog, and picking it back out of a list. The action
 * belongs where the thing it acts on already is.
 */

type Props = { subjectId: string; topics: Topic[] };

export function TopicList({ subjectId, topics }: Props) {
  /**
   * Has ANY topic here been measured?
   *
   * When none has, every row draws the same striped low-evidence bar, and a
   * column of identical placeholders is not information — it is three copies
   * of a sentence better said once, taking a third of the row width to say it.
   * The bars come back the moment there is something to compare.
   */
  const anyMeasured = topics.some((topic) => topic.questionsAnswered > 0);
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
                  "group/row flex flex-col gap-2.5 px-4 py-2.5 transition-colors sm:flex-row sm:items-center sm:gap-3 sm:px-4",
                  dragging === topic.id ? "opacity-40" : "hover:bg-surface-sunken",
                  dropTarget === index && dragging !== topic.id && "bg-accent-soft",
                )}
              >
                {/* Handle and position, as one unit.

                    The number is the point of this list: a syllabus runs in an
                    order, and a row that shows its place says so far better
                    than a hint underneath. It also gives the left edge
                    something to hold, which is what the row was missing when
                    the mastery column went away.

                    The handle is decorative — the whole row is draggable, and a
                    handle that were the only drag target would make the row
                    harder to grab, not easier. Hidden from assistive tech
                    because the buttons at the end are the real control. */}
                <span className="flex shrink-0 items-center gap-2">
                  <GripVertical
                    className="hidden size-4 cursor-grab text-ink-subtle opacity-0 transition-opacity group-hover/row:opacity-100 active:cursor-grabbing sm:block"
                    aria-hidden
                  />
                  <span className="tabular w-4 text-right text-xs text-ink-subtle" aria-hidden>
                    {index + 1}
                  </span>
                </span>

                {/* Name and count on one line. A pill on its own row turned a
                    single fact into a second line of chrome per topic. */}
                <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
                  <p className="truncate font-medium">{topic.name}</p>
                  <span className="tabular shrink-0 text-xs text-ink-subtle">
                    {topic.materialCount} {topic.materialCount === 1 ? "file" : "files"}
                  </span>
                </div>

                {anyMeasured && (
                  <div className="w-full shrink-0 sm:w-44">
                    <MasteryBar
                      value={topic.mastery}
                      questionCount={topic.questionsAnswered}
                      dense
                      hideEvidence
                    />
                  </div>
                )}

                {/* Reorder first, then the rest, with a rule between them.
                    Five identical icon buttons in a row read as one undivided
                    toolbar, and the two that change the ORDER are the ones this
                    list exists for. The edit and delete pair stays quiet until
                    the row is hovered or focused, so a page of topics is a list
                    of names rather than a wall of controls. */}
                <div className="flex shrink-0 items-center gap-0.5">
                  <UploadDialog
                    subjectId={subjectId}
                    topics={ordered}
                    fixedTopic={{ id: topic.id, name: topic.name }}
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Upload files to ${topic.name}`}
                        title={`Upload files to ${topic.name}`}
                      >
                        <Upload aria-hidden />
                      </Button>
                    }
                  />

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

                  <span className="mx-1 h-5 w-px bg-rule" aria-hidden />

                  <span className="flex items-center gap-0.5 transition-opacity lg:opacity-0 lg:group-focus-within/row:opacity-100 lg:group-hover/row:opacity-100">
                    {/* Ask Aki about this topic, scoped to this subject, with
                        the question already written. A link rather than a
                        button because it goes somewhere — and it PREFILLS
                        rather than sends: a click that spends a generation from
                        a daily allowance should happen in the place that spends
                        it, where a student can still edit the question. */}
                    <Link
                      href={`/assistant?subject=${subjectId}&topic=${topic.id}&ask=${encodeURIComponent(`Explain ${topic.name}`)}`}
                      aria-label={`Ask Aki to explain ${topic.name}`}
                      title={`Ask Aki to explain ${topic.name}`}
                      className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
                    >
                      <Sparkles className="size-4" aria-hidden />
                    </Link>

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
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {ordered.length > 1 && (
        <p className="text-xs leading-relaxed text-ink-subtle">
          Drag a row, or use the arrows, to put topics in the order you study them.
          {!anyMeasured && (
            <>
              <br />
              Mastery appears beside each one once you have answered questions on it.
            </>
          )}
        </p>
      )}
    </div>
  );
}
