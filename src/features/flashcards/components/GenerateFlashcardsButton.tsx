"use client";

import { Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { generateFlashcardsAction } from "@/features/flashcards/server/actions";

/**
 * Ask for a deck (FR-R2, US-F2).
 *
 * Navigates to the deck rather than staying put, for the same reason the
 * reviewer button does: generation takes a while, and a button that leaves a
 * student where they were gives them nothing to watch, so they press it again.
 *
 * `regenerate` only changes the words. Making it a separate component to say
 * "Regenerate" would be two components that differ by a string.
 */
export function GenerateFlashcardsButton({
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
      const result = await generateFlashcardsAction({ subjectId, reviewerId });
      if (result.status === "error") {
        setError(`${result.message} ${result.nextStep}`);
        return;
      }
      router.push(`/subjects/${subjectId}/reviewers/${reviewerId}/flashcards`);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <Button variant={variant} size={size} onClick={generate} disabled={isPending}>
        <Layers aria-hidden />
        {isPending ? "Starting…" : regenerate ? "Regenerate cards" : "Make flashcards"}
      </Button>
      {/* On screen rather than in a toast: "this reviewer is not finished yet"
          is something to act on, not something to acknowledge. */}
      {error && (
        <span role="alert" className="text-xs text-bad">
          {error}
        </span>
      )}
      {/* Said before the press that costs something, not after. Regenerating
          replaces the deck, and a student who has worked through it twice
          deserves to know that before the cards disappear. */}
      {regenerate && !error && (
        <span className="text-xs text-ink-subtle">Replaces this deck and its progress.</span>
      )}
    </span>
  );
}
