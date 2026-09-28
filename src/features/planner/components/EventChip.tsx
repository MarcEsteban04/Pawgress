"use client";

import {
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Presentation,
  Hammer,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { type EventKind } from "@/features/planner/schema";
import { timeLabel } from "@/features/planner/dates";
import { type PlannerEvent } from "@/server/planner/queries";
import { cn } from "@/lib/utils";

/**
 * One event, at the size a calendar cell allows (Sprint 61).
 *
 * **The subject's colour is the identity, and the kind is the glyph.** Five
 * classes' worth of deadlines in one October is unreadable as a list of grey
 * lines; colour is the part of "which class is this" that survives being
 * skimmed, and it is the same tone the subject list, the reviewer library and
 * the study bar already use. An event with no subject gets no colour rather
 * than a sixth one — inventing a hue for "unfiled" would make it look like a
 * class.
 *
 * **Done is struck through, not hidden.** A calendar that removed a finished
 * exam from Tuesday would misrepresent what Tuesday was, and the whole reason
 * to mark something done is to see that it is.
 *
 * **Overdue is marked on the chip itself**, because the cell it sits in only
 * says which day it was — and a date in the past is not the same information
 * as "you have not done this".
 */

const KIND_ICON: Record<EventKind, LucideIcon> = {
  exam: GraduationCap,
  quiz: ClipboardCheck,
  assignment: FileText,
  project: Hammer,
  presentation: Presentation,
  study_session: BookOpen,
};

/** `createElement` rather than `const Glyph = …`, for the reason `SubjectGlyph`
    gives: assigning a component to a capitalised local reads to the static
    components lint as defining one mid-render. Every value here is a module
    constant, so the identity is stable. */
export function EventKindIcon({ kind, className }: { kind: EventKind; className?: string }) {
  return createElement(KIND_ICON[kind], { className, "aria-hidden": true });
}

export function EventChip({
  event,
  onOpen,
  className,
}: {
  event: PlannerEvent;
  onOpen: () => void;
  className?: string;
}) {
  const tone = event.colorSlot ? SUBJECT_TONE[event.colorSlot] : null;
  const done = event.completedAt !== null;
  const overdue = event.when === "overdue";
  const at = timeLabel(event.dueTime);

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${event.title}${event.subjectName ? ` · ${event.subjectName}` : ""}`}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-[var(--radius-control)] px-1.5 py-1 text-left",
        "text-xs transition-colors hover:bg-surface-sunken",
        done && "opacity-55",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", tone ? tone.dot : "bg-ink-subtle")}
      />
      <EventKindIcon kind={event.kind} className="size-3 shrink-0 text-ink-subtle" />
      <span className={cn("min-w-0 flex-1 truncate", done && "line-through")}>{event.title}</span>
      {/* One trailing fact, never two. A chip is roughly twenty characters
          wide; a time AND a badge leaves no room for the name. Overdue wins,
          because it is the one that needs acting on. */}
      {overdue ? (
        <span className="shrink-0 text-[0.625rem] font-semibold tracking-wide text-bad uppercase">
          Late
        </span>
      ) : (
        at && <span className="tabular shrink-0 text-[0.6875rem] text-ink-subtle">{at}</span>
      )}
    </button>
  );
}
