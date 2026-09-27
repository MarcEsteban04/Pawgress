"use client";

import { Check, ChevronDown, Lightbulb, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { overrideAnswerAction } from "@/features/quizzes/server/submit";
import { type Attempt, type AttemptAnswer } from "@/server/quizzes/queries";
import { cn } from "@/lib/utils";

/**
 * How you did, and why (FR-Q5, FR-Q6, FR-Q7, US-G3, Sprint 53).
 *
 * **Three things, in the order a student needs them.** The score, because it
 * is the question they walked in with. Then where it came from — which topics
 * held up and which did not — because a score of 14/20 is not something anyone
 * can act on, and "you dropped five of the six on Respiration" is. Then every
 * question, with the right answer and the reason, because that is where the
 * learning actually is.
 *
 * **Wrong answers first, by default.** A student reviewing a quiz is there for
 * the ones they missed. Showing twenty rows in paper order makes them scroll
 * past fourteen they already knew to find the six that matter; the filter puts
 * those six on top and keeps the rest one click away.
 *
 * **No congratulation and no grade letter.** "Nice work!" over 11/20 is the
 * product lying to someone about to sit an exam; a red F on a first attempt
 * punishes them for measuring themselves. The number is the number.
 */

type Filter = "wrong" | "all" | "right";

export function AttemptResult({ attempt }: { attempt: Attempt }) {
  const percent = attempt.total > 0 ? Math.round((attempt.correct / attempt.total) * 100) : 0;
  const skipped = attempt.answers.filter((answer) => !answer.given?.trim()).length;
  const disputable = attempt.answers.filter((answer) => answer.gradedByAi).length;
  const wrongCount = attempt.answers.filter((answer) => !answer.correct).length;

  /* Nothing to filter for someone who got everything right — the default has
     to land on a list that has something in it. */
  const [filter, setFilter] = useState<Filter>(wrongCount > 0 ? "wrong" : "all");

  const shown = attempt.answers.filter((answer) =>
    filter === "all" ? true : filter === "wrong" ? !answer.correct : answer.correct,
  );

  return (
    <div className="mx-auto flex w-full max-w-[48rem] flex-col gap-6">
      <div className="text-center">
        <p className="font-display text-5xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
          {attempt.correct}
          <span className="text-ink-subtle">/{attempt.total}</span>
        </p>
        <p className="mt-2 text-sm text-ink-muted tabular-nums">
          {percent}%{attempt.durationSeconds ? ` · ${formatDuration(attempt.durationSeconds)}` : ""}
          {skipped > 0 ? ` · ${skipped} left blank` : ""}
        </p>
      </div>

      <TopicBreakdown answers={attempt.answers} />

      {disputable > 0 && (
        /* Said once, above the list, rather than beside every row. A student
           needs to know the option exists; they do not need telling twelve
           times. */
        <p className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-rule bg-surface-sunken px-4 py-3 text-sm leading-relaxed text-ink-muted">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          Aki marked {disputable === 1 ? "one written answer" : `${disputable} written answers`}. If
          it got one wrong, change the mark — your score updates with it.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">Every question</h2>

          <div
            role="group"
            aria-label="Show"
            className="inline-flex rounded-[var(--radius-pill)] border border-rule bg-surface p-0.5"
          >
            {(
              [
                ["wrong", `Missed ${wrongCount}`],
                ["right", `Right ${attempt.answers.length - wrongCount}`],
                ["all", "All"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-[var(--radius-pill)] px-3 py-1 text-xs font-medium tabular-nums transition-colors",
                  filter === value ? "bg-ink text-on-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="rounded-[var(--radius-control)] border border-dashed border-rule-strong px-4 py-6 text-center text-sm text-ink-muted">
            {filter === "wrong" ? "Nothing missed. Every answer was right." : "None here."}
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {shown.map((answer) => (
              <AnswerRow
                key={answer.id}
                answer={answer}
                /* The number from the PAPER, not from the filtered list — "question
                   7" has to mean the same question whichever filter is on. */
                position={attempt.answers.indexOf(answer) + 1}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/**
 * Where the score came from.
 *
 * **Counts, not percentages.** One sitting holds two or three questions per
 * topic, and "33%" from three answers is noise wearing the costume of a
 * measurement — the same rule `MasteryBar` applies everywhere else. "1 of 3" is
 * true and cannot be misread as more certain than it is. The weakest topic is
 * still singled out, because pointing at one place to start is the useful part.
 *
 * Shown only when the quiz spans more than one known topic. A quiz on a single
 * chapter already has its breakdown: it is the score above.
 */
function TopicBreakdown({ answers }: { answers: AttemptAnswer[] }) {
  const topics = useMemo(() => {
    const byTopic = new Map<string, { name: string; right: number; total: number }>();
    for (const answer of answers) {
      if (!answer.topicId || !answer.topicName) continue;
      const entry = byTopic.get(answer.topicId) ?? { name: answer.topicName, right: 0, total: 0 };
      entry.total += 1;
      if (answer.correct) entry.right += 1;
      byTopic.set(answer.topicId, entry);
    }
    /* Worst first, by share of questions missed; ties go to the topic with
       more questions, because missing three of four says more than one of
       one. */
    return [...byTopic.values()].sort(
      (a, b) => a.right / a.total - b.right / b.total || b.total - a.total,
    );
  }, [answers]);

  const untagged = answers.filter((answer) => !answer.topicId).length;

  if (topics.length < 2) return null;

  const weakest = topics[0];
  const weakestMissed = weakest.total - weakest.right;

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-rule bg-surface p-5 shadow-[var(--shadow-card)]">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">By topic</h2>
        {weakestMissed > 0 ? (
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Start with <span className="font-medium text-ink">{weakest.name}</span> — you missed{" "}
            {weakestMissed} of its {weakest.total}. From one sitting, so treat it as a hint rather
            than a verdict.
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">Nothing missed in any topic.</p>
        )}
      </div>

      <ul className="flex flex-col gap-2.5">
        {topics.map((topic) => (
          <li key={topic.name} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm sm:w-52">{topic.name}</span>
            {/* One block per question rather than a proportional bar. With three
                questions a bar at 33% implies a precision the data does not
                have; three blocks, one filled, say exactly what happened. */}
            <span className="flex min-w-0 flex-1 gap-1" aria-hidden>
              {Array.from({ length: topic.total }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2 max-w-10 flex-1 rounded-full",
                    i < topic.right ? "bg-ok" : "bg-bad/30",
                  )}
                />
              ))}
            </span>
            <span className="w-14 shrink-0 text-right text-sm text-ink-muted tabular-nums">
              {topic.right} of {topic.total}
            </span>
          </li>
        ))}
      </ul>

      {untagged > 0 && (
        <p className="text-xs text-ink-subtle">
          {untagged} {untagged === 1 ? "question is" : "questions are"} not linked to a topic.
        </p>
      )}
    </section>
  );
}

function AnswerRow({ answer, position }: { answer: AttemptAnswer; position: number }) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  /* Explanations open by default on the ones missed — that is what the row is
     for — and closed on the ones got right, where a student mostly wants to
     confirm and move on. */
  const [open, setOpen] = useState(!answer.correct);

  const given = answer.given?.trim();

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-control)] border bg-surface px-4 py-3.5 transition-colors",
        answer.correct ? "border-ok/30" : "border-bad/30",
        isSaving && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
            answer.correct ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad",
          )}
        >
          {answer.correct ? (
            <Check className="size-3" aria-label="Correct" />
          ) : (
            <X className="size-3" aria-label="Not correct" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-subtle tabular-nums">
            Question {position}
            {answer.topicName ? ` · ${answer.topicName}` : ""}
          </p>
          <p className="mt-0.5 text-[0.9375rem] leading-snug">{answer.prompt}</p>

          <dl className="mt-2.5 flex flex-col gap-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-ink-subtle">You wrote</dt>
              <dd className={cn("min-w-0", given ? "text-ink" : "text-warn")}>
                {given || "Left blank"}
              </dd>
            </div>
            {/* The answer only where it adds something. On a question they got
                right it would be their own answer printed twice. */}
            {!answer.correct && answer.correctAnswer && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-ink-subtle">
                  {answer.type === "short_answer" ? "A good answer" : "Answer"}
                </dt>
                <dd className="text-ok min-w-0 font-medium">{answer.correctAnswer}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {answer.explanation && (
        <div className="pl-8">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((previous) => !previous)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <Lightbulb className="size-3.5" aria-hidden />
            Why
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </button>
          {open && (
            <p className="mt-1.5 rounded-[var(--radius-control)] bg-surface-sunken px-3 py-2.5 text-sm leading-relaxed text-ink-muted">
              {answer.explanation}
            </p>
          )}
        </div>
      )}

      {/* Offered only on marks a MODEL made. A multiple-choice answer was
          compared against the option that was picked; an override there would
          be an edit button on your own score. */}
      {answer.gradedByAi && given && (
        <div className="flex flex-wrap items-center gap-2 pl-8">
          <span className="text-xs text-ink-subtle">
            {answer.overridden ? "You changed this mark." : "Marked by Aki."}
          </span>
          <Button
            variant="quiet"
            size="sm"
            disabled={isSaving}
            onClick={() =>
              startSaving(async () => {
                await overrideAnswerAction(answer.id, !answer.correct);
                router.refresh();
              })
            }
          >
            {answer.correct ? "Mark it wrong" : "I had it right"}
          </Button>
        </div>
      )}
    </li>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}
