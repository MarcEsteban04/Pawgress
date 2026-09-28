"use client";

import { Plus } from "lucide-react";
import { dayOfMonth, weekdayLabel, type DateKey } from "@/features/planner/dates";
import { EventChip } from "./EventChip";
import { type PlannerEvent } from "@/server/planner/queries";
import { cn } from "@/lib/utils";

/**
 * The week (Sprint 61).
 *
 * **Seven columns, not seven columns of an hour grid** — see `MonthGrid` for
 * why this product's calendar has no time axis. What the week adds over the
 * month is room: a column is wide enough for the full title and the subject
 * under it, so a week is where a student actually reads their deadlines rather
 * than counting them.
 *
 * **Below `md` it becomes seven stacked days**, because seven columns on a
 * phone is the month view with extra steps. Stacked, each day keeps its full
 * width and the whole week is one scroll — which is how a week is read on a
 * phone anyway.
 *
 * **Empty days say nothing at all.** A column reading "No events" seven times
 * is a week that looks broken; a quiet week SHOULD look quiet, and the add
 * control is on every column regardless.
 */
export function WeekView({
  days,
  today,
  eventsByDay,
  onOpenEvent,
  onAddOn,
}: {
  days: DateKey[];
  today: DateKey;
  eventsByDay: Map<DateKey, PlannerEvent[]>;
  onOpenEvent: (event: PlannerEvent) => void;
  onAddOn: (day: DateKey) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-rule bg-surface">
      <div className="grid md:grid-cols-7">
        {days.map((day) => {
          const events = eventsByDay.get(day) ?? [];
          const isToday = day === today;

          return (
            <div
              key={day}
              className={cn(
                "group flex min-w-0 flex-col border-b border-rule md:min-h-[16rem] md:border-r md:border-b-0",
                isToday && "bg-accent-soft/30",
              )}
            >
              <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
                <span className="text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
                  {weekdayLabel(day, "short")}
                </span>
                <span
                  className={cn(
                    "tabular flex size-6 items-center justify-center rounded-full text-xs",
                    isToday ? "bg-ink font-semibold text-on-ink" : "text-ink-muted",
                  )}
                >
                  {dayOfMonth(day)}
                </span>

                <button
                  type="button"
                  onClick={() => onAddOn(day)}
                  aria-label={`Add an event on ${day}`}
                  className="ml-auto flex size-6 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>

              {events.length > 0 && (
                <div className="flex min-w-0 flex-col gap-1 p-2">
                  {events.map((event) => (
                    <EventChip
                      key={event.id}
                      event={event}
                      onOpen={() => onOpenEvent(event)}
                      /* Roomier than a month cell, and two lines' worth of
                         padding, because this is the view someone reads rather
                         than scans. */
                      className="items-start py-1.5 text-[0.8125rem]"
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
