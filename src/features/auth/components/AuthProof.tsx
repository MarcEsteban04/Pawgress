import { MasteryBar, SourceChip } from "@/components/ui";

/**
 * The single floating object in the auth aside.
 *
 * Deliberately NOT one of the landing hero's objects. The landing scatters six
 * cards to say "there is a lot here"; the auth aside shows exactly one, to say
 * "this is the thing you are signing up for". Same materials, opposite move.
 *
 * Built from the real `MasteryBar` and `SourceChip`, so it carries the real
 * low-evidence rule and breaks loudly if a token changes.
 */
export function AuthProof() {
  // No width of its own: the aside sizes the whole block, so a cap here would
  // leave the card narrower than the headline above it and break the left edge.
  return (
    <div className="w-full rounded-[1.25rem] border border-rule bg-surface p-5 shadow-[var(--shadow-float)]">
      <p className="text-xs font-medium text-ink-muted">After your first quiz</p>

      <div className="mt-4 flex flex-col gap-4">
        <MasteryBar dense hideEvidence label="Recursion" tone={1} value={0.31} questionCount={16} />
        <MasteryBar
          dense
          hideEvidence
          label="Cell structure"
          tone={4}
          value={0.88}
          questionCount={22}
        />
      </div>

      <p className="mt-5 border-t border-rule pt-4 text-[0.9375rem] leading-relaxed">
        Recursion is holding you back. Twenty minutes today would move it more than anything else.
      </p>

      <div className="mt-3">
        <SourceChip material="Lecture 9.pdf" page={4} />
      </div>
    </div>
  );
}
