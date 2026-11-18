"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Select,
} from "@/components/ui";
import { startTimedSessionAction } from "@/features/study/server/timer";
import { SESSION_CAP_MINUTES } from "@/features/study/timer";
import { type SessionTarget } from "@/server/study/queries";
import { type SessionPreset } from "./StudySessionProvider";

/**
 * Start a session (FR-N4, US-I3, Sprint 63).
 *
 * **Two questions, and the subject is not optional.** The table would accept
 * a session with no subject, and it would be an hour that counts toward the
 * streak and nowhere else — no subject's minutes, no planned session ticked
 * off. Asking one question up front is cheaper than an hour nobody can place.
 * The topic is optional: "revising Biology" is a perfectly good session.
 *
 * **The subject is guessed only when the guess is safe.** On a subject's own
 * page it is that subject; with exactly one subject there is nothing to
 * choose. Anywhere else the student picks — defaulting to the most recently
 * active subject would file the hour under whatever they did yesterday.
 */
export function StartSessionDialog({
  open,
  onOpenChange,
  preset,
  initialError,
  targets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: SessionPreset | null;
  initialError: string | null;
  targets: SessionTarget[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {open && (
          <StartForm
            /* Fresh state per opening, so a planner row's subject does not
               linger into the next top-bar Start. */
            key={`${preset?.subjectId ?? ""}:${preset?.topicId ?? ""}:${initialError ?? ""}`}
            preset={preset}
            initialError={initialError}
            targets={targets}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StartForm({
  preset,
  initialError,
  targets,
  onDone,
}: {
  preset: SessionPreset | null;
  initialError: string | null;
  targets: SessionTarget[];
  onDone: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const fromPage = /^\/subjects\/([0-9a-f-]{36})/i.exec(pathname)?.[1] ?? null;
  const guess =
    preset?.subjectId ??
    (fromPage && targets.some((target) => target.id === fromPage) ? fromPage : null) ??
    (targets.length === 1 ? targets[0]!.id : "");

  const [subjectId, setSubjectId] = useState(guess);
  const [topicId, setTopicId] = useState(preset?.topicId ?? "");
  const [error, setError] = useState(initialError);
  const [isPending, startTransition] = useTransition();

  const subjectFieldId = useId();
  const topicFieldId = useId();
  const subject = targets.find((target) => target.id === subjectId);

  function start() {
    if (!subjectId) {
      setError("Choose a subject first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await startTimedSessionAction({ subjectId, topicId: topicId || null });
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  if (targets.length === 0) {
    return (
      <>
        <DialogTitle>Start a study session</DialogTitle>
        <DialogDescription>
          A session is time on a subject, so there needs to be a subject to put it on. Add the
          classes you are taking and come back.
        </DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Not now</Button>
          </DialogClose>
          <Link href="/subjects" onClick={onDone} className={buttonStyles({ variant: "accent" })}>
            Add a subject
          </Link>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogTitle>Start a study session</DialogTitle>
      <DialogDescription>
        The clock keeps running if you change page or close the tab — finish it from the top bar
        when you are done. Sessions over {SESSION_CAP_MINUTES / 60} hours are capped.
      </DialogDescription>

      <div className="mt-1 flex flex-col gap-4">
        <Field label="Subject" htmlFor={subjectFieldId}>
          <Select
            id={subjectFieldId}
            value={subjectId}
            autoFocus={!subjectId}
            onChange={(field) => {
              setSubjectId(field.target.value);
              setTopicId("");
              setError(null);
            }}
          >
            <option value="" disabled>
              Choose a subject
            </option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Topic" htmlFor={topicFieldId} optional>
          {/* Keyed on the subject, so switching subject resets the topic in
              the same render that knows the old one no longer applies. */}
          <Select
            key={subjectId}
            id={topicFieldId}
            value={topicId}
            disabled={!subject?.topics.length}
            onChange={(field) => setTopicId(field.target.value)}
          >
            <option value="">
              {!subject
                ? "Choose a subject first"
                : subject.topics.length
                  ? "Whole subject"
                  : "No topics yet — whole subject"}
            </option>
            {subject?.topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </Select>
        </Field>

        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button variant="accent" onClick={start} disabled={isPending || !subjectId}>
          <Play aria-hidden />
          {isPending ? "Starting…" : "Start the clock"}
        </Button>
      </DialogFooter>
    </>
  );
}
