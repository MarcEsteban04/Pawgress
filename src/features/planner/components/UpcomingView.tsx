"use client";

import { CalendarPlus, PartyPopper } from "lucide-react";
import { Button, Card, CardBody, EmptyState } from "@/components/ui";
import { type DateKey } from "@/features/planner/dates";
import { DeadlineRow } from "./DeadlineRow";
import { ExamCountdown } from "./ExamCountdown";
import { type Deadline, type DeadlineGroup } from "@/server/planner/deadlines";
import { type PlannerEvent } from "@/server/planner/queries";

/**
 * Everything still to do (FR-N3, US-I2, Sprint 62).
 *
 * **The planner's default view**, because "what is due" is the question
 * someone opens a planner to ask. The month grid is for orientation — where
 * does this fall, how busy is that week — and putting the map in front of the
 * directions is what Sprint 61 did for want of anything else.
 *
 * **Cut into the five buckets a student thinks in**, which are the same five
 * `whenIs` has returned since Sprint 60 — so this page and the dashboard can
 * never disagree about what "this week" means. Pressure orders each bucket;
 * it never reorders across one. See `byUrgency`.
 *
 * **Empty here is a good ending, not a gap.** A student with nothing due is
 * not missing a feature, and the copy should not treat them as though they
 * were.
 */
export function UpcomingView({
  groups,
  countdown,
  today,
  onOpenEvent,
  onAddOn,
  onToggleDone,
  busyId,
}: {
  groups: DeadlineGroup[];
  /** The soonest assessed event, or null when nothing is being marked. */
  countdown: Deadline | null;
  today: DateKey;
  onOpenEvent: (event: PlannerEvent) => void;
  onAddOn: (day: DateKey) => void;
  onToggleDone: (event: PlannerEvent) => void;
  busyId: string | null;
}) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardBody className="py-4">
          <EmptyState
            Icon={PartyPopper}
            title="Nothing due"
            description="No exams, deadlines or sessions ahead of you — and nothing overdue behind you. Add what is coming and this becomes the list you check first."
            action={
              <Button variant="accent" onClick={() => onAddOn(today)}>
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
    <div className="flex flex-col gap-5">
      {countdown && <ExamCountdown deadline={countdown} />}

      {groups.map((group) => (
        <section key={group.when} className="flex flex-col gap-2">
          <h2 className="flex items-baseline gap-2 text-xs font-semibold tracking-[0.08em] text-ink-subtle uppercase">
            {group.label}
            {/* The count in the heading, so "Overdue" is a number a student
                can decide about rather than a warning they have to expand. */}
            <span className="tabular font-normal normal-case">{group.deadlines.length}</span>
          </h2>

          <ul className="flex flex-col gap-2">
            {group.deadlines.map((deadline) => (
              <li key={deadline.id}>
                <DeadlineRow
                  deadline={deadline}
                  onOpen={() => onOpenEvent(deadline)}
                  onToggleDone={() => onToggleDone(deadline)}
                  busy={busyId === deadline.id}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
