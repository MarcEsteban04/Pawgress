import { cn, clamp, formatPercent } from "@/lib/utils";
import { LOW_EVIDENCE_QUESTIONS } from "@/types";

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
 * The bar is never red. 42% is information about what to do next, not a grade
 * the student was given (docs/branding.md §1), so the fill walks the single-hue
 * `--mastery-*` ramp — light at weak, deep at strong. Where a row's job is to
 * identify a SUBJECT rather than rank it, pass `tone` and the bar takes that
 * subject's fixed categorical hue instead.
 */

export type MasteryBarProps = {
  /** 0–1. */
  value: number;
  /** How many answered questions the value is derived from. */
  questionCount: number;
  label?: string;
  /**
   * Subject identity slot. When set, the fill uses the subject's categorical
   * hue instead of the mastery ramp — used where the row names a subject.
   */
  tone?: 1 | 2 | 3 | 4 | 5;
  /** Puts the label, count and value on one row with the bar beneath. */
  dense?: boolean;
  /** Hides the "from N questions" line when the caller renders its own. */
  hideEvidence?: boolean;
  className?: string;
};

/** Ordinal step for a mastery value — the ramp direction is the meaning. */
function masteryStep(value: number): 1 | 2 | 3 | 4 {
  if (value < 0.4) return 1;
  if (value < 0.6) return 2;
  if (value < 0.8) return 3;
  return 4;
}

const TONE_VAR = {
  1: "var(--cat-1)",
  2: "var(--cat-2)",
  3: "var(--cat-3)",
  4: "var(--cat-4)",
  5: "var(--cat-5)",
} as const;

const STEP_VAR = {
  1: "var(--mastery-1)",
  2: "var(--mastery-2)",
  3: "var(--mastery-3)",
  4: "var(--mastery-4)",
} as const;

export function MasteryBar({
  value,
  questionCount,
  label,
  tone,
  dense = false,
  hideEvidence = false,
  className,
}: MasteryBarProps) {
  const lowEvidence = questionCount < LOW_EVIDENCE_QUESTIONS;
  const pct = clamp(value, 0, 1);
  const fill = tone ? TONE_VAR[tone] : STEP_VAR[masteryStep(pct)];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {(label || !lowEvidence) && (
        <div className="flex items-baseline gap-3">
          {label && <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{label}</span>}
          {dense && (
            <span className="tabular text-xs text-ink-subtle">
              {lowEvidence ? `${questionCount}/${LOW_EVIDENCE_QUESTIONS} q` : `${questionCount} q`}
            </span>
          )}
          {!lowEvidence && (
            <span className="tabular text-sm font-medium">{formatPercent(pct)}</span>
          )}
        </div>
      )}

      <div
        className="h-2.5 overflow-hidden rounded-[var(--radius-pill)] bg-surface-sunken"
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
            className="h-full w-full opacity-50"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--rule-strong) 0 4px, transparent 4px 8px)",
            }}
          />
        ) : (
          <div
            className="h-full rounded-[var(--radius-pill)] transition-[width] duration-500"
            style={{ width: `${pct * 100}%`, backgroundColor: fill }}
          />
        )}
      </div>

      {!hideEvidence && !dense && (
        <p className="tabular text-xs text-ink-subtle">
          {lowEvidence
            ? `Not enough data yet — ${questionCount} of ${LOW_EVIDENCE_QUESTIONS} questions`
            : `from ${questionCount} questions`}
        </p>
      )}
    </div>
  );
}
