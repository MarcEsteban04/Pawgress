"use client";

import { Plus } from "lucide-react";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { dayOfMonth, sameMonth, weekdayLabel, type DateKey } from "@/features/planner/dates";
import { EventChip } from "./EventChip";
import { type PlannerEvent } from "@/server/planner/queries";
import { cn } from "@/lib/utils";

/**
 * The month (Sprint 61).
 *
 * **Day cells holding lists, not an hour grid.** Every calendar people know
 * looks like Google's, and Google's is built for someone whose day is
 * meetings: a 24-row time axis, events as blocks with a start and an end. A
 * student's planner holds deadlines — "Bio exam Friday", "essay in by 23:59" —
 * which are DAYS with an optional time and no duration at all. Rendering them
 * on an hour axis would mean 95% empty space and inventing a length for every
 * event, and a 2pm exam would look like a one-hour commitment rather than the
 * thing the whole week points at. So each zoom level is day cells containing
 * lists, and the only thing that changes is how many days are on screen.
 *
 * **Below `sm` the chips become dots.** Seven columns of readable chips does
 * not fit a 360px screen, and shrinking the text until it does produces a grid
 * nobody can read. Dots say "three things, two subjects, one late" — which is
 * all a month view is for on a phone — and tapping the day opens it.
 *
 * **Clicking empty space in a cell adds an event there.** The date is the most
 * tedious field in the form and the cell already knows it.
 */

/** How many chips fit a cell before the rest become a count. Four is what the
    row height allows without the grid growing a scrollbar per cell. */
const CHIPS_PER_CELL = 4;

export function MonthGrid({
  days,
  anchor,
  today,
  eventsByDay,
  onOpenEvent,
  onAddOn,
  onOpenDay,
}: {
  days: DateKey[];
  /** Any day in the month being shown — decides which cells are "other month". */
  anchor: DateKey;
  today: DateKey;
  eventsByDay: Map<DateKey, PlannerEvent[]>;
  onOpenEvent: (event: PlannerEvent) => void;
  onAddOn: (day: DateKey) => void;
  onOpenDay: (day: DateKey) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-rule bg-surface">
      {/* The weekday header. Labels come from the first week's own dates, so
          they are localised and cannot fall out of step with the columns. */}
      <div className="grid grid-cols-7 border-b border-rule bg-surface-sunken">
        {days.slice(0, 7).map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-subtle uppercase"
          >
            <span className="hidden sm:inline">{weekdayLabel(day, "short")}</span>
            <span className="sm:hidden">{weekdayLabel(day, "narrow")}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const events = eventsByDay.get(day) ?? [];
          const outside = !sameMonth(day, anchor);
          const isToday = day === today;
          const overflow = events.length - CHIPS_PER_CELL;

          return (
            <div
              key={day}
              className={cn(
                /* Right and bottom borders only, with the last column and row
                   trimmed by the container's overflow — cheaper than
                   nth-child rules and it survives a 5- or 6-row month. */
                "group relative min-h-[4.5rem] border-r border-b border-rule sm:min-h-[7.5rem]",
                outside && "bg-surface-sunken/40",
              )}
            >
              {/* The empty space of the cell, as one target. FIRST in the DOM
                  and absolutely placed; everything below is `relative`, so the
                  chips and the day number paint over it and take their own
                  clicks. Clicking anywhere else in the cell adds an event on
                  that day — the date is the most tedious field in the form and
                  the cell already knows it. */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={() => onAddOn(day)}
                className="absolute inset-0 cursor-pointer"
              />

              <div className="relative flex h-full flex-col gap-1 p-1.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onOpenDay(day)}
                    aria-label={`Open ${day}`}
                    className={cn(
                      "tabular flex size-6 items-center justify-center rounded-full text-xs transition-colors",
                      isToday
                        ? "bg-ink font-semibold text-on-ink"
                        : outside
                          ? "text-ink-subtle hover:bg-surface-sunken"
                          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                    )}
                  >
                    {dayOfMonth(day)}
                  </button>

                  {/* Pointer-only, and that is deliberate: it appears on hover,
                    which a touch device has no equivalent of. The whole cell
                    is tappable below, so nothing is lost there. */}
                  <button
                    type="button"
                    onClick={() => onAddOn(day)}
                    aria-label={`Add an event on ${day}`}
                    className="hidden size-6 items-center justify-center rounded-full text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-sunken hover:text-ink focus-visible:opacity-100 sm:flex"
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </button>
                </div>

                {/* Chips from `sm` up. */}
                <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                  {events.slice(0, CHIPS_PER_CELL).map((event) => (
                    <EventChip key={event.id} event={event} onOpen={() => onOpenEvent(event)} />
                  ))}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenDay(day)}
                      className="px-1.5 text-left text-[0.6875rem] font-medium text-ink-muted hover:text-ink"
                    >
                      +{overflow} more
                    </button>
                  )}
                </div>

                {/* Dots below it. */}
                {events.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenDay(day)}
                    aria-label={`${events.length} on ${day}`}
                    className="flex flex-wrap items-center gap-1 px-0.5 sm:hidden"
                  >
                    {events.slice(0, 4).map((event) => (
                      <span
                        key={event.id}
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full",
                          event.completedAt
                            ? "bg-ink-subtle/40"
                            : event.when === "overdue"
                              ? "bg-bad"
                              : event.colorSlot
                                ? SUBJECT_TONE[event.colorSlot].dot
                                : "bg-ink-subtle",
                        )}
                      />
                    ))}
                    {events.length > 4 && (
                      <span className="tabular text-[0.625rem] text-ink-subtle">
                        +{events.length - 4}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
