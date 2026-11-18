"use client";

import { AlertTriangle, CalendarCheck, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  Button,
  buttonStyles,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Field,
  Input,
} from "@/components/ui";
import { SUBJECT_TONE } from "@/features/subjects/components/SubjectIcon";
import { discardTimedSessionAction, finishTimedSessionAction } from "@/features/study/server/timer";
import {
  ceilingSeconds,
  clockLabel,
  durationLabel,
  isLeftRunning,
  MIN_SESSION_SECONDS,
  SESSION_CAP_MINUTES,
} from "@/features/study/timer";
import { type RunningSession } from "@/server/study/queries";
import { cn } from "@/lib/utils";

/**
 * Finish a session, and say what was recorded (FR-N4, US-I3, Sprint 63).
 *
 * **The minutes are the clock's until the student says otherwise.** Most
 * finishes are one press. The field is there for the honest correction —
 * "twenty of that was lunch" — and it can only go DOWN: the server clamps any
 * figure to the clock and to the cap, so the field is a way to be accurate,
 * not a way to pad a streak.
 *
 * **A session left running says so, in words, before it is recorded.** US-I3
 * asks for the cap; a cap the student never hears about is the product quietly
 * rewriting their number. So the dialog states how long the clock actually
 * ran, what will be recorded instead, and that they can change it.
 *
 * **It ends on a summary, not on a closed dialog.** Finishing is the one
 * moment the product can say "that counted" — minutes added, a planned session
 * ticked off — and silently closing would leave the student checking the
 * progress page to find out whether it worked.
 */

type Outcome =
  | {
      kind: "recorded";
      seconds: number;
      capped: boolean;
      completedPlan: string | null;
      subject: string;
      topic: string | null;
    }
  | { kind: "too-short" };

export function FinishSessionDialog({
  open,
  onOpenChange,
  running,
  elapsed,
  notice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  running: RunningSession | null;
  elapsed: number;
  notice: string | null;
}) {
  /* Held here rather than in the form, because the form unmounts the moment
     the refresh after finishing removes the running session — and the
     summary is about that session. */
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  function close(next: boolean) {
    if (!next) setOutcome(null);
    onOpenChange(next);
  }

  const showing = open && (outcome !== null || running !== null);

  return (
    <Dialog open={showing} onOpenChange={close}>
      <DialogContent size="sm">
        {outcome ? (
          <Summary outcome={outcome} onClose={() => close(false)} />
        ) : running ? (
          <FinishForm
            key={running.id}
            running={running}
            elapsed={elapsed}
            notice={notice}
            onOutcome={setOutcome}
            onDiscarded={() => close(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FinishForm({
  running,
  elapsed,
  notice,
  onOutcome,
  onDiscarded,
}: {
  running: RunningSession;
  elapsed: number;
  notice: string | null;
  onOutcome: (outcome: Outcome) => void;
  onDiscarded: () => void;
}) {
  const router = useRouter();
  const minutesId = useId();
  const tone = SUBJECT_TONE[running.colorSlot];

  /* Null means "take the clock", and the field shows the clock's figure,
     ticking. A string is the student's own — kept as typed, so clearing the
     box to retype does not snap it back to the clock mid-edit. */
  const [claimed, setClaimed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [isPending, startTransition] = useTransition();

  const leftRunning = isLeftRunning(elapsed);
  const ceilingMinutes = Math.floor(ceilingSeconds(elapsed) / 60);
  const shown = claimed ?? String(ceilingMinutes);
  const underMinute = claimed === null && elapsed < MIN_SESSION_SECONDS;

  const started = new Date(running.startedAt);
  const startedLabel = started.toLocaleString(undefined, {
    /* A weekday only when it is not obviously today — "Started Tue 9:14 pm"
       is the clue that this one was left on. */
    ...(elapsed > 12 * 3600 ? { weekday: "short" as const } : {}),
    hour: "numeric",
    minute: "2-digit",
  });

  function finish() {
    let minutes: number | null = null;
    if (claimed !== null) {
      minutes = Number(claimed);
      if (claimed.trim() === "" || !Number.isFinite(minutes) || minutes < 0) {
        setError("Enter how many minutes you studied, or reset it to the clock.");
        return;
      }
    }

    setError(null);
    startTransition(async () => {
      const result = await finishTimedSessionAction(running.id, minutes);

      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        /* Finished elsewhere: the top bar is out of date, so bring it up to
           date rather than leaving a Finish button that can never work. */
        router.refresh();
        return;
      }

      onOutcome(
        result.status === "ok"
          ? {
              kind: "recorded",
              seconds: result.seconds,
              capped: result.capped,
              completedPlan: result.completedPlan,
              subject: running.subjectName,
              topic: running.topicName,
            }
          : { kind: "too-short" },
      );
      router.refresh();
    });
  }

  function discard() {
    startTransition(async () => {
      const result = await discardTimedSessionAction(running.id);
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      router.refresh();
      onDiscarded();
    });
  }

  return (
    <>
      <DialogTitle>Finish your session</DialogTitle>
      <DialogDescription>
        {notice ?? "Recorded against the subject, and counted in your study time and streak."}
      </DialogDescription>

      <div className="mt-1 flex flex-col gap-4">
        {/* The session itself: what, since when, and the clock, large. */}
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface-sunken px-4 py-3.5">
          <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", tone.dot)} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {running.subjectName}
              {running.topicName ? ` · ${running.topicName}` : ""}
            </span>
            <span className="block text-xs text-ink-subtle">Started {startedLabel}</span>
          </span>
          <span className="font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums">
            {elapsed < 86_400 ? clockLabel(elapsed) : durationLabel(elapsed)}
          </span>
        </div>

        {leftRunning && (
          <p className="flex gap-2.5 rounded-[var(--radius-card)] bg-warn-soft px-4 py-3 text-sm leading-relaxed">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
            <span>
              The clock has run for <strong>{durationLabel(elapsed)}</strong> — longer than anyone
              studies in one sitting, so it was probably left on. It will be recorded as{" "}
              {SESSION_CAP_MINUTES / 60} hours unless you change it below.
            </span>
          </p>
        )}

        <Field
          label="Minutes to record"
          htmlFor={minutesId}
          error={error ?? undefined}
          hint={
            underMinute
              ? "Under a minute so far — finishing now records nothing."
              : claimed === null
                ? leftRunning
                  ? `Capped at ${SESSION_CAP_MINUTES} minutes.`
                  : "From the clock. Lower it if you stepped away."
                : `At most ${ceilingMinutes} — the time the clock ran${leftRunning ? ", capped" : ""}.`
          }
        >
          <div className="flex items-center gap-2">
            <Input
              id={minutesId}
              type="number"
              inputMode="numeric"
              min={0}
              max={ceilingMinutes}
              value={shown}
              onChange={(field) => {
                setClaimed(field.target.value);
                setError(null);
              }}
              className="w-28 tabular-nums"
            />
            {claimed !== null && (
              <Button variant="ghost" size="sm" onClick={() => setClaimed(null)}>
                Use the clock
              </Button>
            )}
          </div>
        </Field>
      </div>

      <DialogFooter className="items-center">
        {/* Discard sits left, away from Finish, and asks in place — the same
            pattern as deleting an event. */}
        <div className="mr-auto">
          {confirmingDiscard ? (
            <Button variant="danger" size="sm" disabled={isPending} onClick={discard}>
              <Trash2 aria-hidden />
              Really discard
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => setConfirmingDiscard(true)}
            >
              <Trash2 aria-hidden />
              Discard
            </Button>
          )}
        </div>

        <DialogClose asChild>
          <Button variant="ghost">Keep going</Button>
        </DialogClose>
        <Button variant="accent" onClick={finish} disabled={isPending}>
          <Square aria-hidden className="fill-current" />
          {isPending ? "Recording…" : "Finish"}
        </Button>
      </DialogFooter>
    </>
  );
}

function Summary({ outcome, onClose }: { outcome: Outcome; onClose: () => void }) {
  if (outcome.kind === "too-short") {
    return (
      <>
        <DialogTitle>Nothing recorded</DialogTitle>
        <DialogDescription>
          That session was under a minute, so it was not added to your history. Start another
          whenever you are ready.
        </DialogDescription>
        <DialogFooter>
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogTitle>Session recorded</DialogTitle>
      <DialogDescription>
        <strong className="font-semibold text-ink">{durationLabel(outcome.seconds)}</strong> of{" "}
        {outcome.subject}
        {outcome.topic ? ` · ${outcome.topic}` : ""}, added to your study time.
        {outcome.capped &&
          ` The clock had run past ${SESSION_CAP_MINUTES / 60} hours, so it was capped there.`}
      </DialogDescription>

      {outcome.completedPlan && (
        <p className="mt-1 flex items-center gap-2.5 rounded-[var(--radius-card)] bg-good-soft px-4 py-3 text-sm">
          <CalendarCheck className="size-4 shrink-0 text-good" aria-hidden />
          <span>
            Ticked off <span className="font-medium">“{outcome.completedPlan}”</span> in your
            planner.
          </span>
        </p>
      )}

      <DialogFooter>
        <Link href="/progress" onClick={onClose} className={buttonStyles({ variant: "ghost" })}>
          See progress
        </Link>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
