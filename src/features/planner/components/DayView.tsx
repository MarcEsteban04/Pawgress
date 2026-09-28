"use client";

import { CalendarPlus, Check } from "lucide-react";
import { Button, Card, CardBody, EmptyState, Tag } from "@/components/ui";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { EVENT_KIND_INFO } from "@/features/planner/schema";
import { longDayLabel, timeLabel, type DateKey } from "@/features/planner/dates";
import { EventKindIcon } from "./EventChip";
import { type PlannerEvent } from "@/server/planner/queries";
import { cn } from "@/lib/utils";

/**
 * One day (Sprint 61).
 *
 * **The only view that shows an event whole.** A month cell has room for a
 * title; this has room for the notes, which is where "chapters 4–6, no
 * calculator" lives — and notes a student cannot read without opening a dialog
 * are notes they will not write again.
 *
 * **Done is a real control here, not just a state.** Ticking something off is
 * the most common thing anyone does to a planner, and making it a trip through
 * the edit dialog is how a planner stops being updated. The row is still
 * clickable to edit; the tick is its own target beside it.
 */
export function DayView({
  day,
  events,
  onOpenEvent,
  onAddOn,
  onToggleDone,
  busyId,
}: {
  day: DateKey;
  events: PlannerEvent[];
  onOpenEvent: (event: PlannerEvent) => void;
  onAddOn: (day: DateKey) => void;
  onToggleDone: (event: PlannerEvent) => void;
  /** The event currently being written, so its tick can say so. */
  busyId: string | null;
}) {
  if (events.length === 0) {
    return (
      <Card>
        <CardBody className="py-4">
          <EmptyState
            Icon={CalendarPlus}
            title="Nothing on this day"
            description={`${longDayLabel(day)} is clear. Add an exam, a deadline or a study session and it will show up here and on your dashboard.`}
            action={
              <Button variant="accent" onClick={() => onAddOn(day)}>
                <CalendarPlus aria-hidden />
                Add an event
              </Button>
            }
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {events.map((event) => {
        const tone = event.colorSlot ? SUBJECT_TONE[event.colorSlot] : null;
        const done = event.completedAt !== null;
        const at = timeLabel(event.dueTime);
        const info = EVENT_KIND_INFO[event.kind];

        return (
          <li key={event.id}>
            <Card className={cn("overflow-hidden", done && "opacity-70")}>
              {/* The subject's colour as a spine down the card, rather than a
                  tinted background: a whole card in a category colour fights
                  every other card on the page, and five of them is a paint
                  chart. */}
              <div className="flex items-stretch">
                <span
                  aria-hidden
                  className={cn("w-1 shrink-0", tone ? tone.dot : "bg-rule-strong")}
                />

                <CardBody className="flex min-w-0 flex-1 items-start gap-3 py-4">
                  <button
                    type="button"
                    onClick={() => onToggleDone(event)}
                    disabled={busyId === event.id}
                    aria-pressed={done}
                    aria-label={done ? `Mark ${event.title} not done` : `Mark ${event.title} done`}
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[0.375rem] border transition-colors",
                      done
                        ? "border-ok bg-ok text-on-ink"
                        : "border-rule-strong hover:border-ink hover:bg-surface-sunken",
                      busyId === event.id && "opacity-50",
                    )}
                  >
                    {done && <Check className="size-3.5" aria-hidden />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenEvent(event)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "font-display leading-snug font-semibold tracking-[-0.01em]",
                          done && "line-through",
                        )}
                      >
                        {event.title}
                      </span>
                      {event.when === "overdue" && (
                        <span className="text-xs font-semibold tracking-wide text-bad uppercase">
                          Overdue
                        </span>
                      )}
                    </span>

                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                      <Tag className="gap-1">
                        <EventKindIcon kind={event.kind} className="size-3" />
                        {info.label}
                      </Tag>
                      {at && <span className="tabular">{at}</span>}
                      {event.subjectName && (
                        <>
                          {at && <span aria-hidden>·</span>}
                          <span className="truncate">{event.subjectName}</span>
                        </>
                      )}
                      {event.topicName && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">{event.topicName}</span>
                        </>
                      )}
                    </span>

                    {event.notes && (
                      <span className="mt-2 block text-sm leading-relaxed whitespace-pre-line text-ink-muted">
                        {event.notes}
                      </span>
                    )}
                  </button>
                </CardBody>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
