"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { type Difficulty } from "@/features/mastery/formula";
import { createQuizAction } from "@/features/quizzes/server/actions";

/**
 * One click from "this topic is weak" to a quiz on it (Sprint 59).
 *
 * **Detection that ends in a report is half a feature.** The old panels said
 * "Needs attention" and linked to the subject list, leaving the student to
 * work out what attention meant. This writes the quiz for them: scoped to the
 * topic, at the difficulty the pattern of their mistakes suggests, ten
 * questions long — enough to move the topic's evidence, short enough to do
 * now.
 *
 * It navigates to the quiz straight away, where the generation overlay takes
 * over. Staying here with a spinner would leave a student watching a button.
 */
export function PractiseButton({
  subjectId,
  topicId,
  difficulty,
  label,
}: {
  subjectId: string;
  topicId: string;
  difficulty: Difficulty;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await createQuizAction({
              subjectId,
              topicId,
              difficulty,
              count: 10,
            });
            if (result.status === "error") {
              setError(`${result.message} ${result.nextStep}`);
              return;
            }
            router.push(`/quizzes/${result.quizId}`);
          });
        }}
        className={cn(
          "group inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] border border-rule bg-surface px-3 text-sm font-medium transition-colors",
          "hover:border-rule-strong hover:bg-surface-sunken disabled:opacity-60",
        )}
      >
        {isPending ? "Writing your quiz…" : label}
        <ArrowRight
          className="size-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </button>
      {error && (
        <span role="alert" className="text-xs text-bad">
          {error}
        </span>
      )}
    </span>
  );
}
