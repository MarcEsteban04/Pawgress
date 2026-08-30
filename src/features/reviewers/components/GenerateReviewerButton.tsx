"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { generateReviewerAction } from "@/features/reviewers/server/actions";

/**
 * Ask for a reviewer (FR-R1, US-F1).
 *
 * **It navigates to the new reviewer rather than staying put.** Generation
 * takes a minute, and a button that returns a student to the page they were
 * already on gives them nothing to watch — so they press it again. Landing on
 * the reviewer, in its generating state, is both the receipt and the place the
 * result will appear.
 */
export function GenerateReviewerButton({
  subjectId,
  topicId = null,
  label = "Generate reviewer",
  size,
}: {
  subjectId: string;
  topicId?: string | null;
  label?: string;
  size?: "sm";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateReviewerAction({ subjectId, topicId });
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      router.push(`/subjects/${subjectId}/reviewers/${result.reviewerId}`);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <Button variant="subtle" size={size} onClick={generate} disabled={isPending}>
        <Sparkles aria-hidden />
        {isPending ? "Starting…" : label}
      </Button>
      {/* The reason is on screen rather than in a toast: "there is nothing to
          build from" is something to act on, not something to acknowledge. */}
      {error && (
        <span role="alert" className="text-xs text-bad">
          {error}
        </span>
      )}
    </span>
  );
}
