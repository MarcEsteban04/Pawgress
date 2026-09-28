"use client";

import { AlertTriangle, Check, ChevronRight, Flame } from "lucide-react";
import { Card, CardBody, Tag } from "@/components/ui";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { EVENT_KIND_INFO } from "@/features/planner/schema";
import { timeLabel } from "@/features/planner/dates";
import { type UrgencyBand } from "@/features/planner/urgency";
import { EventKindIcon } from "./EventChip";
import { type Deadline } from "@/server/planner/deadlines";
import { cn } from "@/lib/utils";

/**
 * One deadline, in the list (FR-N3, US-I2, Sprint 62).
 *
 * **Overdue is marked three ways, not one.** US-I2 requires it to be
 * distinguishable "by more than colour", which is also WCAG 1.4.1: the row
 * carries a warning glyph, the word *Overdue*, and it sits in a section headed
 * Overdue. Take every colour off this page and the meaning survives — which is
 * the test, and the reason the tint is the last thing applied rather than the
 * first.
 *
 * **The countdown is the loudest thing on the row**, because it is the fact
 * the student came for. Everything else — kind, subject, why it is pressing —
 * is a line of supporting text under the title.
 */

const BAND_STYLE: Record<UrgencyBand, { spine: string; text: string }> = {
  overdue: { spine: "bg-bad", text: "text-bad" },
  critical: { spine: "bg-warn", text: "text-warn" },
  soon: { spine: "bg-rule-strong", text: "text-ink" },
  ahead: { spine: "bg-rule", text: "text-ink-muted" },
  done: { spine: "bg-ok", text: "text-ink-subtle" },
};

/**
 * The countdown itself.
 *
 * Words for the three days a student thinks in words about, and a number after
 * that. "In 1 days" is the kind of thing that makes an app feel unfinished,
 * and "Today" carries an urgency that "In 0 days" does not.
 */
export function countdownText(daysAway: number): string {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  if (daysAway === -1) return "1 day late";
  if (daysAway < 0) return `${Math.abs(daysAway)} days late`;
  if (daysAway < 14) return `In ${daysAway} days`;
  if (daysAway < 60) return `In ${Math.round(daysAway / 7)} weeks`;
  return `In ${Math.round(daysAway / 30)} months`;
}

export function DeadlineRow({
  deadline,
  onOpen,
  onToggleDone,
  busy,
}: {
  deadline: Deadline;
  onOpen: () => void;
  onToggleDone: () => void;
  busy: boolean;
}) {
  const tone = deadline.colorSlot ? SUBJECT_TONE[deadline.colorSlot] : null;
  const band = BAND_STYLE[deadline.urgency.band];
  const info = EVENT_KIND_INFO[deadline.kind];
  const at = timeLabel(deadline.dueTime);
  const overdue = deadline.urgency.band === "overdue";
  const critical = deadline.urgency.band === "critical";

  return (
    <Card className="overflow-hidden">
      <div className="flex items-stretch">
        {/* Urgency on the spine, not the subject — this is the one list where
            "how soon" outranks "which class". The subject keeps its dot on the
            detail line below. */}
        <span aria-hidden className={cn("w-1 shrink-0", band.spine)} />

        <CardBody className="flex min-w-0 flex-1 items-start gap-3 py-3.5">
          <button
            type="button"
            onClick={onToggleDone}
            disabled={busy}
            aria-label={`Mark ${deadline.title} done`}
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[0.375rem] border transition-colors",
              "border-rule-strong hover:border-ink hover:bg-surface-sunken",
              busy && "opacity-50",
            )}
          >
            <Check className="size-3.5 opacity-0" aria-hidden />
          </button>

          <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-display leading-snug font-semibold tracking-[-0.01em]">
                {deadline.title}
              </span>
              {/* The word, beside the title, for anyone who cannot see the
                  spine or the section heading. */}
              {overdue && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-bad uppercase">
                  <AlertTriangle className="size-3" aria-hidden />
                  Overdue
                </span>
              )}
              {critical && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-warn uppercase">
                  <Flame className="size-3" aria-hidden />
                  Start now
                </span>
              )}
            </span>

            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
              <Tag className="gap-1">
                <EventKindIcon kind={deadline.kind} className="size-3" />
                {info.label}
              </Tag>
              {deadline.subjectName && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      tone ? tone.dot : "bg-ink-subtle",
                    )}
                  />
                  <span className="truncate">{deadline.subjectName}</span>
                </span>
              )}
              {deadline.topicName && (
                <>
                  <span aria-hidden>·</span>
                  <span className="truncate">{deadline.topicName}</span>
                </>
              )}
              {at && (
                <>
                  <span aria-hidden>·</span>
                  <span className="tabular">{at}</span>
                </>
              )}
            </span>

            {/* The sentence only this product can write. Absent rather than
                padded out when there is nothing true to say. */}
            {deadline.reason && (
              <span className={cn("mt-1.5 block text-sm font-medium", band.text)}>
                {deadline.reason}
              </span>
            )}
          </button>

          <div className="flex shrink-0 items-center gap-1 pl-1">
            <span className={cn("tabular text-sm font-semibold whitespace-nowrap", band.text)}>
              {countdownText(deadline.daysAway)}
            </span>
            <ChevronRight className="size-4 text-ink-subtle" aria-hidden />
          </div>
        </CardBody>
      </div>
    </Card>
  );
}
