import { cn, clamp, formatPercent } from "@/lib/utils";
import { LOW_EVIDENCE_QUESTIONS, WEAK_TOPIC_THRESHOLD } from "@/types";

/**
 * The single most consequential component in the product.
 *
 * A student will see "Genetics 42%". Two rules are enforced here rather than
 * left to callers, because getting them wrong makes the app lie:
 *
 *  1. A percentage is ALWAYS accompanied by the number of questions it came
 *     from. One lucky 3-question quiz is not mastery (US-H1).
 *  2. Below LOW_EVIDENCE_QUESTIONS the number is withheld entirely — the bar
 *     renders as indeterminate and the label says so. A confident-looking 100%
 *     from three answers is worse than no number at all.
 *
 * The bar is deliberately not red at low values. 42% is information about what
 * to do next, not a grade the student was given (docs/branding.md §1).
 */
export type MasteryBarProps = {
  /** 0–1. */
  value: number;
  /** How many answered questions the value is derived from. */
  questionCount: number;
  label?: string;
  /** Hides the "from N questions" line when the caller renders its own. */
  hideEvidence?: boolean;
  className?: string;
};

export function MasteryBar({
  value,
  questionCount,
  label,
  hideEvidence = false,
  className,
}: MasteryBarProps) {
  const lowEvidence = questionCount < LOW_EVIDENCE_QUESTIONS;
  const pct = clamp(value, 0, 1);
  const isWeak = pct < WEAK_TOPIC_THRESHOLD;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || !lowEvidence) && (
        <div className="flex items-baseline gap-3">
          {label && <span className="flex-1 text-[0.9375rem] font-semibold">{label}</span>}
          {!lowEvidence && <span className="tabular text-sm">{formatPercent(pct)}</span>}
        </div>
      )}

      <div
        className="h-2 overflow-hidden rounded-full border border-rule bg-surface-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={lowEvidence ? undefined : Math.round(pct * 100)}
        aria-valuetext={
          lowEvidence
            ? `Not enough data yet — ${questionCount} of ${LOW_EVIDENCE_QUESTIONS} questions answered`
            : `${formatPercent(pct)} mastery from ${questionCount} questions`
        }
        aria-label={label ? `${label} mastery` : "Mastery"}
      >
        {/* Low evidence gets a striped, muted fill: visibly not a real reading. */}
        {lowEvidence ? (
          <div
            className="h-full w-full opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--rule-strong) 0 4px, transparent 4px 8px)",
            }}
          />
        ) : (
          <div
            className={cn("h-full rounded-full", isWeak ? "bg-accent" : "bg-good")}
            style={{ width: `${pct * 100}%` }}
          />
        )}
      </div>

      {!hideEvidence && (
        <p className="font-mono text-xs text-ink-subtle">
          {lowEvidence
            ? `Not enough data yet — ${questionCount} of ${LOW_EVIDENCE_QUESTIONS} questions`
            : `from ${questionCount} questions`}
        </p>
      )}
    </div>
  );
}
