"use client";

import { Card, CardBody } from "@/components/ui";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { EVENT_KIND_INFO } from "@/features/planner/schema";
import { PractiseButton } from "@/features/mastery/components/PractiseButton";
import { EventKindIcon } from "./EventChip";
import { type Deadline } from "@/server/planner/deadlines";
import { cn } from "@/lib/utils";

/**
 * The countdown to the next thing anyone else is marking (FR-N3, US-I2,
 * Sprint 62).
 *
 * **Assessed only.** A countdown to a study session a student scheduled for
 * themselves is a countdown to nothing; the `assessed` flag has sat on
 * `EVENT_KIND_INFO` since Sprint 60 waiting for exactly this distinction.
 *
 * **It counts down to the SOONEST, and says something about the most
 * pressing.** A clock that skipped the next exam because a later one worried
 * us more would not be a clock. What readiness changes is the sentence
 * underneath, and whether there is a button.
 *
 * **It ends in an action, not an observation.** "You are weak on Genetics" is
 * a fact a student can do nothing with at the moment they read it. The same
 * fact with a button that writes them a quiz on Genetics is the whole product
 * in one card — and it is the same `PractiseButton` the weak-topic list uses,
 * so the two cannot drift.
 */
export function ExamCountdown({ deadline }: { deadline: Deadline }) {
  const tone = deadline.colorSlot ? SUBJECT_TONE[deadline.colorSlot] : null;
  const info = EVENT_KIND_INFO[deadline.kind];
  const days = deadline.daysAway;
  const pressing = deadline.urgency.band === "critical" || deadline.urgency.band === "overdue";

  return (
    <Card className="overflow-hidden">
      <div className="flex items-stretch">
        <span aria-hidden className={cn("w-1.5 shrink-0", tone ? tone.dot : "bg-ink")} />

        <CardBody className="flex flex-1 flex-col gap-3 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-ink-subtle uppercase">
                <EventKindIcon kind={deadline.kind} className="size-3.5" />
                Next {info.label.toLowerCase()}
              </p>
              <p className="mt-1.5 font-display text-xl leading-tight font-semibold tracking-[-0.02em]">
                {deadline.title}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {[deadline.subjectName, deadline.topicName].filter(Boolean).join(" · ") ||
                  "No subject"}
              </p>
            </div>

            {/* The number, at the size the fact deserves. Tabular so it does
                not shuffle as the count falls from 10 to 9. */}
            <div className="text-right">
              <p
                className={cn(
                  "font-display text-4xl leading-none font-semibold tracking-[-0.03em] tabular-nums",
                  pressing && "text-warn",
                  days < 0 && "text-bad",
                )}
              >
                {Math.abs(days)}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {days < 0
                  ? days === -1
                    ? "day ago"
                    : "days ago"
                  : days === 1
                    ? "day away"
                    : "days away"}
              </p>
            </div>
          </div>

          {/* What the product knows that the date does not. */}
          {deadline.reason && (
            <p className={cn("text-sm font-medium", pressing ? "text-warn" : "text-ink")}>
              {capitalise(deadline.reason)}.
            </p>
          )}

          {/* Offered only where it would help. A student who is strong on the
              material does not need to be sold a quiz, and a countdown that
              always ends in the same button stops being read. */}
          {deadline.subjectId && (deadline.readiness === "weak" || pressing) && (
            <div>
              <PractiseButton
                subjectId={deadline.subjectId}
                topicId={deadline.topicId}
                /* Weak means the fundamentals are not there, so an easier set
                   is the one that will actually move the score. Anything else
                   is under time pressure rather than under-prepared, and a
                   medium set is the better rehearsal. */
                difficulty={deadline.readiness === "weak" ? "easy" : "medium"}
                label={
                  deadline.topicName
                    ? `Quiz me on ${deadline.topicName}`
                    : `Quiz me on ${deadline.subjectName || "this"}`
                }
              />
            </div>
          )}
        </CardBody>
      </div>
    </Card>
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
