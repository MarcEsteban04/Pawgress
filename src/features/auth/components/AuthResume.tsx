import { CalendarDays, Clock } from "lucide-react";
import { MasteryBar } from "@/components/ui";
import { NEXT_EXAM_RESUME } from "@/config/showcase";
import { cn } from "@/lib/utils";

const TINT = {
  1: "bg-cat-1-soft",
  2: "bg-cat-2-soft",
  3: "bg-cat-3-soft",
  4: "bg-cat-4-soft",
  5: "bg-cat-5-soft",
} as const;

/**
 * The floating object on the SIGN-IN aside.
 *
 * A different shape from `AuthProof`, which sells the outcome to someone who has
 * never used the product. A returning student is already sold — what they want
 * to know is what is waiting. So this is a countdown and a plan rather than a
 * claim and a citation, and it names a different subject, so the two asides
 * never read as the same card twice.
 */
export function AuthResume() {
  const exam = NEXT_EXAM_RESUME;

  return (
    <div className="w-full rounded-[1.25rem] border border-rule bg-surface p-5 shadow-[var(--shadow-float)]">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-4 text-ink-subtle" aria-hidden />
        <p className="text-xs font-medium text-ink-muted">Next exam</p>
        <span className="tabular ml-auto text-xs font-medium text-ink">in {exam.inDays} days</span>
      </div>

      <div className={cn("mt-3 rounded-[1rem] p-3.5", TINT[exam.tone])}>
        <p className="text-xs font-medium text-ink-muted">{exam.subject}</p>
        <p className="mt-0.5 leading-snug font-medium">{exam.title}</p>
      </div>

      <div className="mt-4">
        <MasteryBar
          dense
          hideEvidence
          label="Readiness"
          tone={exam.tone}
          value={exam.readiness}
          questionCount={exam.questionCount}
        />
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-rule pt-4">
        <Clock className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        <p className="text-sm text-ink-muted">
          <span className="tabular font-medium text-ink">{exam.plannedMinutes}m</span> planned today
          — review, practice, quiz
        </p>
      </div>
    </div>
  );
}
