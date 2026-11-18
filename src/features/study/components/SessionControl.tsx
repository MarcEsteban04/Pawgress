"use client";

import { Play, Timer } from "lucide-react";
import { IconButton } from "@/components/ui";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { clockLabel, durationLabel, isLeftRunning } from "@/features/study/timer";
import { cn } from "@/lib/utils";
import { useStudySession } from "./StudySessionProvider";

/**
 * The session in the top bar (FR-N4, US-I3, Sprint 63).
 *
 * **Idle, it is one quiet icon; running, it is the only ink pill in the bar.**
 * A timer is chrome, so it is ink, never the accent blue — the blue belongs to
 * whatever the page wants pressed next (docs/branding.md). Running, it earns
 * the weight: it is the one piece of state that follows the student off the
 * page they started on, and a clock they cannot find is a clock they forget
 * to stop.
 *
 * **No live region on the ticking time.** Announcing a clock every second
 * would drown a screen reader; the label says what is running, and the
 * dialog behind it reads the time once, when asked.
 */
export function SessionControl() {
  const study = useStudySession();
  if (!study) return null;

  const { running, elapsed, openStart, openFinish } = study;

  if (!running) {
    return (
      <IconButton label="Start a study session" onClick={() => openStart()}>
        <Timer aria-hidden />
      </IconButton>
    );
  }

  const tone = SUBJECT_TONE[running.colorSlot];
  const stale = isLeftRunning(elapsed);
  const face = elapsed < 86_400 ? clockLabel(elapsed) : durationLabel(elapsed);

  return (
    <button
      type="button"
      onClick={openFinish}
      aria-label={`Study session running: ${running.subjectName}${
        running.topicName ? `, ${running.topicName}` : ""
      }, ${durationLabel(elapsed)}. Finish or discard it.`}
      title={stale ? "Still running — was this left on?" : "Finish this session"}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] pr-3.5 pl-3",
        "bg-ink text-sm font-medium text-on-ink shadow-[var(--shadow-pill)]",
        "transition-colors hover:bg-ink/90",
      )}
    >
      {/* The subject's dot, pulsing while the clock runs — still for anyone
          who has asked for less motion. A left-on session stops pulsing and
          goes amber: nothing is happening, it is just counting. */}
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          stale ? "bg-warn" : cn(tone.dot, "motion-safe:animate-pulse"),
        )}
      />
      <span className="max-w-[9rem] truncate max-sm:hidden">{running.subjectName}</span>
      <span className="tabular-nums">{face}</span>
    </button>
  );
}

/**
 * Start a PLANNED session from its planner row.
 *
 * Only offered on today's and overdue plans — starting Friday's session on a
 * Wednesday is just starting a session, and the top bar does that. When the
 * plan already names a subject it starts in one press; when it does not, the
 * Start dialog asks. The row the running session belongs to says so instead.
 */
export function StartSessionButton({
  subjectId,
  topicId,
  title,
}: {
  subjectId: string | null;
  topicId: string | null;
  title: string;
}) {
  const study = useStudySession();
  if (!study) return null;

  const { running, startNow, openFinish, starting } = study;
  const isThis =
    running !== null &&
    subjectId !== null &&
    running.subjectId === subjectId &&
    (topicId === null || running.topicId === topicId);

  if (isThis) {
    return (
      <button
        type="button"
        onClick={openFinish}
        aria-label={`${title} is running — finish it`}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface-sunken px-3 text-xs font-semibold text-ink tabular-nums"
      >
        <span aria-hidden className="size-1.5 rounded-full bg-ink motion-safe:animate-pulse" />
        {clockLabel(study.elapsed)}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={starting}
      onClick={() => startNow({ subjectId, topicId })}
      aria-label={`Start ${title}`}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-rule bg-surface px-3",
        "text-xs font-semibold text-ink transition-colors hover:border-rule-strong hover:bg-surface-sunken",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      <Play className="size-3 fill-current" aria-hidden />
      Start
    </button>
  );
}
