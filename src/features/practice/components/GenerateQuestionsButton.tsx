"use client";

import { ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { generateQuestionsAction } from "@/features/practice/server/actions";

/**
 * Ask for a practice set (FR-C2, US-F3).
 *
 * Navigates to the set rather than staying put, for the reason the reviewer and
 * flashcard buttons do: generation takes a minute, and a button that leaves a
 * student where they were gives them nothing to watch, so they press it again.
 */
export function GenerateQuestionsButton({
  subjectId,
  reviewerId,
  regenerate = false,
  variant = "subtle",
  size,
}: {
  subjectId: string;
  reviewerId: string;
  regenerate?: boolean;
  variant?: "primary" | "subtle" | "quiet";
  size?: "sm";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateQuestionsAction({ subjectId, reviewerId });
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      router.push(`/subjects/${subjectId}/reviewers/${reviewerId}/practice`);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <Button variant={variant} size={size} onClick={generate} disabled={isPending}>
        <ListChecks aria-hidden />
        {isPending ? "Starting…" : regenerate ? "New questions" : "Practice questions"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-bad">
          {error}
        </span>
      )}
      {/* Said before the press that costs something, not after. Nothing is lost
          — practice was never recorded — but a student mid-way through a set
          should know the questions are about to change. */}
      {regenerate && !error && (
        <span className="text-xs text-ink-subtle">Replaces this set with fresh questions.</span>
      )}
    </span>
  );
}
