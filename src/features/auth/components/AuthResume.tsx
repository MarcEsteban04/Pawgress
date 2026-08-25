import { CalendarDays, Clock } from "lucide-react";
import { MasteryBar } from "@/components/ui";

/**
 * The floating object on the SIGN-IN aside.
 *
 * Deliberately a different shape from `AuthProof`, which sells the outcome to
 * someone who has never used the product. A returning student is already sold —
 * what they want to know is what is waiting for them. So this one is a
 * countdown and a plan rather than a claim and a citation: an exam with days
 * left, a readiness reading, and the blocks that would move it.
 *
 * Built from the real `MasteryBar`, so the low-evidence rule still applies here.
 */
export function AuthResume() {
  return (
    <div className="w-full rounded-[1.25rem] border border-rule bg-surface p-5 shadow-[var(--shadow-float)]">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-4 text-ink-subtle" aria-hidden />
        <p className="text-xs font-medium text-ink-muted">Next exam</p>
        <span className="tabular ml-auto text-xs font-medium text-ink">in 4 days</span>
      </div>

      <div className="mt-3 rounded-[1rem] bg-cat-1-soft p-3.5">
        <p className="text-xs font-medium text-ink-muted">Programming</p>
        <p className="mt-0.5 leading-snug font-medium">Recursion &amp; complexity</p>
      </div>

      <div className="mt-4">
        <MasteryBar dense hideEvidence label="Readiness" tone={1} value={0.44} questionCount={37} />
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-rule pt-4">
        <Clock className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        <p className="text-sm text-ink-muted">
          <span className="tabular font-medium text-ink">45m</span> planned today — review,
          practice, quiz
        </p>
      </div>
    </div>
  );
}
