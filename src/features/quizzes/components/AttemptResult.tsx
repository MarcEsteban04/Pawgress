"use client";

import { Check, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui";
import { overrideAnswerAction } from "@/features/quizzes/server/submit";
import { type Attempt, type AttemptAnswer } from "@/server/quizzes/queries";
import { cn } from "@/lib/utils";

/**
 * How you did (FR-Q5, FR-Q7, US-G3, Sprint 52).
 *
 * **The score, then every question marked.** This sprint answers "did I get it
 * right"; the reasons, the correct answers and the weak-topic breakdown belong
 * to quiz results, which is next. Showing half of that now would mean building
 * it twice.
 *
 * **No congratulation and no grade letter.** A score of 11/20 with "Nice work!"
 * is the product lying to someone about to sit an exam, and a red F on a first
 * attempt punishes them for measuring themselves. The number is the number, and
 * the only offer is to go again.
 */
export function AttemptResult({ attempt }: { attempt: Attempt }) {
  const percent = attempt.total > 0 ? Math.round((attempt.correct / attempt.total) * 100) : 0;
  const skipped = attempt.answers.filter((answer) => !answer.given?.trim()).length;
  const disputable = attempt.answers.filter((answer) => answer.gradedByAi).length;

  return (
    <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-6">
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

      {disputable > 0 && (
        /* Said once, above the list, rather than repeated beside every row.
           A student needs to know the option exists; they do not need telling
           twelve times. */
        <p className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-rule bg-surface-sunken px-4 py-3 text-sm leading-relaxed text-ink-muted">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          Aki marked {disputable === 1 ? "one written answer" : `${disputable} written answers`}. If
          it got one wrong, change the mark — your score updates with it.
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {attempt.answers.map((answer, position) => (
          <AnswerRow key={answer.id} answer={answer} position={position + 1} />
        ))}
      </ol>
    </div>
  );
}

function AnswerRow({ answer, position }: { answer: AttemptAnswer; position: number }) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-[var(--radius-control)] border px-4 py-3 transition-colors",
        answer.correct ? "border-ok/30 bg-ok-soft" : "border-bad/30 bg-bad-soft",
        isSaving && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-5 shrink-0 text-xs text-ink-subtle tabular-nums">{position}</span>

        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] leading-snug">{answer.prompt}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {/* Their own words, quoted back. It is how they judge whether the
                marking was fair, and nobody can sensibly overrule a verdict on
                an answer they can no longer see. */}
            {answer.given?.trim() ? (
              <>
                You wrote: <span className="text-ink">{answer.given}</span>
              </>
            ) : (
              <span className="text-warn">Left blank</span>
            )}
          </p>
        </div>

        {answer.correct ? (
          <Check className="text-ok mt-0.5 size-4 shrink-0" aria-label="Correct" />
        ) : (
          <X className="mt-0.5 size-4 shrink-0 text-bad" aria-label="Not correct" />
        )}
      </div>

      {/* Offered only on marks a MODEL made. A multiple-choice answer was
          compared against the option that was picked; an override there would
          not be fairness, it would be an edit button on your own score. */}
      {answer.gradedByAi && answer.given?.trim() && (
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
