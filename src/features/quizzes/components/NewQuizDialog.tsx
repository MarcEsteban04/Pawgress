"use client";

import { ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  Select,
} from "@/components/ui";
import { type QuizDifficulty } from "@/features/practice/schema";
import {
  DEFAULT_MOCK_EXAM_LENGTH,
  DEFAULT_QUIZ_LENGTH,
  DIFFICULTY_LABELS,
  MOCK_EXAM_LENGTHS,
  QUIZ_DIFFICULTIES,
  QUIZ_LENGTHS,
  estimateMinutes,
  mockExamSeconds,
} from "@/features/quizzes/schema";
import { createQuizAction } from "@/features/quizzes/server/actions";
import { cn } from "@/lib/utils";

export type QuizTarget = {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
};

/**
 * The four choices Sprint 49 is about: what, how much of it, how hard, how many.
 *
 * **Difficulty is the only one shown as cards rather than a dropdown.** It is
 * the choice a student has the least intuition about — "hard" could plausibly
 * mean longer, or obscurer, or trickier — and it is the one that most changes
 * what comes back. Three tiles with a sentence each answer the question before
 * it is asked; a `<select>` would hide exactly the information that makes the
 * choice meaningful.
 *
 * The topic list is reset by KEYING the select on the chosen subject rather
 * than clearing it in an effect. The render that follows a subject change
 * already knows the old topic is no longer valid.
 *
 * **A mock exam is a mode of this dialog, not a second one** (Sprint 54). It
 * asks the same four questions — what, how much, how hard, how many — and
 * differs only in the answers it allows: longer papers, and a clock that is
 * set rather than chosen. Two dialogs would drift apart the first time one of
 * those questions changed.
 */
export function NewQuizDialog({
  subjects,
  trigger,
}: {
  subjects: QuizTarget[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [topicId, setTopicId] = useState("");
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("medium");
  const [mock, setMock] = useState(false);
  const [count, setCount] = useState(DEFAULT_QUIZ_LENGTH);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const subjectFieldId = useId();
  const topicFieldId = useId();
  const countFieldId = useId();
  const titleFieldId = useId();

  const subject = subjects.find((entry) => entry.id === subjectId);

  function create() {
    if (!subjectId) return;
    setError(null);
    startTransition(async () => {
      const result = await createQuizAction({
        subjectId,
        topicId: topicId || null,
        difficulty,
        count,
        title,
        mock,
      });
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      router.push(`/quizzes/${result.quizId}`);
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="accent" disabled={subjects.length === 0}>
            <ClipboardCheck aria-hidden />
            New quiz
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>{mock ? "New mock exam" : "New quiz"}</DialogTitle>
        <DialogDescription>
          {mock
            ? "A full-length paper under exam conditions: timed, shuffled, and marked at the end — with a readiness verdict when you finish."
            : "Aki writes questions from the files you uploaded — not from a reviewer, so this can ask about anything in the material."}
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-4">
          <div
            role="group"
            aria-label="Kind"
            className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] border border-rule bg-surface-sunken p-1"
          >
            {(
              [
                [false, "Quiz", "Short, untimed, for revision"],
                [true, "Mock exam", "Long, timed, for rehearsal"],
              ] as const
            ).map(([value, label, blurb]) => (
              <button
                key={label}
                type="button"
                aria-pressed={mock === value}
                onClick={() => {
                  setMock(value);
                  /* The length follows the kind. Keeping a quiz's ten when
                     switching to a mock exam would submit a length the server
                     rejects for it, and silently correct. */
                  setCount(value ? DEFAULT_MOCK_EXAM_LENGTH : DEFAULT_QUIZ_LENGTH);
                }}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-[calc(var(--radius-control)-0.25rem)] px-3 py-2 text-left transition-colors",
                  mock === value ? "bg-surface shadow-[var(--shadow-pill)]" : "hover:bg-surface/60",
                )}
              >
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-ink-muted">{blurb}</span>
              </button>
            ))}
          </div>

          <Field label="Subject" htmlFor={subjectFieldId}>
            <Select
              id={subjectFieldId}
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                setTopicId("");
              }}
            >
              {subjects.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Topic"
            htmlFor={topicFieldId}
            hint="Leave this on the whole subject unless you are revising one chapter."
          >
            <Select
              key={subjectId}
              id={topicFieldId}
              value={topicId}
              disabled={!subject?.topics.length}
              onChange={(event) => setTopicId(event.target.value)}
            >
              <option value="">Whole subject</option>
              {subject?.topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </Select>
          </Field>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[0.9375rem] font-medium">Difficulty</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {QUIZ_DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={difficulty === level}
                  onClick={() => setDifficulty(level)}
                  className={cn(
                    "flex flex-col gap-1 rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-colors",
                    difficulty === level
                      ? "border-accent bg-accent-soft"
                      : "border-rule hover:border-rule-strong hover:bg-surface-sunken",
                  )}
                >
                  <span className="text-sm font-medium">{DIFFICULTY_LABELS[level].label}</span>
                  <span className="text-xs leading-snug text-ink-muted">
                    {DIFFICULTY_LABELS[level].blurb}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <Field
            label="Questions"
            htmlFor={countFieldId}
            /* The time estimate is the point of this hint. "20" means nothing;
               "about 15 minutes" is the number someone actually decides on. */
            hint={
              mock
                ? `${mockExamSeconds(count) / 60} minutes on the clock, or more with extra time.`
                : `About ${estimateMinutes(count)} minutes.`
            }
          >
            <Select
              id={countFieldId}
              value={String(count)}
              onChange={(event) => setCount(Number(event.target.value))}
            >
              {(mock ? MOCK_EXAM_LENGTHS : QUIZ_LENGTHS).map((length) => (
                <option key={length} value={length}>
                  {length} questions
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Name"
            htmlFor={titleFieldId}
            optional
            hint="Left blank, we name it for you."
          >
            <Input
              id={titleFieldId}
              value={title}
              maxLength={120}
              placeholder="Midterm practice"
              onChange={(event) => setTitle(event.target.value)}
            />
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
          <Button variant="accent" onClick={create} disabled={isPending || !subjectId}>
            <ClipboardCheck aria-hidden />
            {isPending ? "Starting…" : mock ? "Create mock exam" : "Create quiz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
