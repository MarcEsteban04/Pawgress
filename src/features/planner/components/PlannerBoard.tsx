"use client";

import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { type DateKey } from "@/features/planner/dates";
import { asCalendarSpan, plannerHref, type PlannerView } from "@/features/planner/view";
import { setEventCompletedAction } from "@/features/planner/server/actions";
import { DayView } from "./DayView";
import { EventDialog, type PlannerSubject } from "./EventDialog";
import { MonthGrid } from "./MonthGrid";
import { PlannerNav } from "./PlannerNav";
import { UpcomingView } from "./UpcomingView";
import { WeekView } from "./WeekView";
import { type Deadline, type DeadlineGroup } from "@/server/planner/deadlines";
import { type PlannerEvent } from "@/server/planner/queries";

/**
 * The calendar, and the one dialog it opens (Sprint 61).
 *
 * **One client component around three presentational views.** The views
 * differ in how many days are on screen and how much room each gets; they do
 * not differ in what an event is, what clicking one does, or which dialog
 * opens. Giving each its own dialog state would be three copies of the same
 * bookkeeping, and three chances for "click a chip in week view" to behave
 * differently from "click a chip in month view".
 *
 * **The data comes from the server, already scoped to the visible range.**
 * The URL carries the view and the anchor date (see `view.ts`), so paging is
 * an ordinary navigation and this component never fetches. What it owns is
 * exactly the state that has no business in a URL: which dialog is open, on
 * what.
 *
 * **Grouping happens here, once.** Every view needs "the events on this day",
 * and asking each cell to filter the array is 42 passes over it in a month.
 *
 * **The toolbar is inside this component, not in the page header.** "New
 * event" opens the same dialog an event chip does, and hoisting the button
 * into `PageHeader` would mean a second dialog with its own state — two
 * things that must agree about what is open, to save one prop.
 */
export function PlannerBoard({
  view,
  anchor,
  today,
  days,
  events,
  deadlines,
  subjects,
}: {
  view: PlannerView;
  anchor: DateKey;
  today: DateKey;
  /** The calendar views' days. Empty for the deadline list, which has no range. */
  days: DateKey[];
  events: PlannerEvent[];
  /** The deadline list, already grouped and scored. Null for a calendar view. */
  deadlines: { groups: DeadlineGroup[]; countdown: Deadline | null } | null;
  subjects: PlannerSubject[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ event: PlannerEvent | null; date: DateKey } | null>(null);
  /* Which row is mid-write, so its tick can dim rather than the whole page
     going pending. One at a time is enough: nobody ticks two boxes at once,
     and a set would be state to clear on every outcome. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const eventsByDay = new Map<DateKey, PlannerEvent[]>();
  for (const event of events) {
    const bucket = eventsByDay.get(event.dueOn);
    if (bucket) bucket.push(event);
    else eventsByDay.set(event.dueOn, [event]);
  }

  function openEvent(event: PlannerEvent) {
    setDialog({ event, date: event.dueOn });
  }

  function addOn(date: DateKey) {
    setDialog({ event: null, date });
  }

  function openDay(date: DateKey) {
    router.push(plannerHref("day", date, today), { scroll: false });
  }

  function toggleDone(event: PlannerEvent) {
    setBusyId(event.id);
    startTransition(async () => {
      await setEventCompletedAction(event.id, event.completedAt === null);
      /* The board is rendered from a Server Component's data, so the tick only
         becomes true once the server re-renders. The action revalidates; this
         asks for the result. */
      router.refresh();
      setBusyId(null);
    });
  }

  /**
   * The day a header-launched "New event" lands on.
   *
   * Today when today is on screen, and otherwise the day being looked at.
   * Somebody scrolled forward to March and pressing add is adding something in
   * March; defaulting to today would silently file it three months back.
   */
  const addDefault = asCalendarSpan(view) === null || days.includes(today) ? today : anchor;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <PlannerNav view={view} anchor={anchor} today={today} />
        </div>
        <Button variant="accent" onClick={() => addOn(addDefault)}>
          <CalendarPlus aria-hidden />
          New event
        </Button>
      </div>

      {view === "upcoming" && deadlines && (
        <UpcomingView
          groups={deadlines.groups}
          countdown={deadlines.countdown}
          today={today}
          onOpenEvent={openEvent}
          onAddOn={addOn}
          onToggleDone={toggleDone}
          busyId={busyId}
        />
      )}

      {view === "month" && (
        <MonthGrid
          days={days}
          anchor={anchor}
          today={today}
          eventsByDay={eventsByDay}
          onOpenEvent={openEvent}
          onAddOn={addOn}
          onOpenDay={openDay}
        />
      )}

      {view === "week" && (
        <WeekView
          days={days}
          today={today}
          eventsByDay={eventsByDay}
          onOpenEvent={openEvent}
          onAddOn={addOn}
        />
      )}

      {view === "day" && (
        <DayView
          day={anchor}
          events={eventsByDay.get(anchor) ?? []}
          onOpenEvent={openEvent}
          onAddOn={addOn}
          onToggleDone={toggleDone}
          busyId={busyId}
        />
      )}

      <EventDialog
        open={dialog !== null}
        /* Closing clears the seed as well as the flag. Keeping the last event
           around would make the next "add" open on a date nobody chose. */
        onOpenChange={(open) => !open && setDialog(null)}
        event={dialog?.event}
        defaultDate={dialog?.date ?? today}
        subjects={subjects}
      />
    </div>
  );
}
