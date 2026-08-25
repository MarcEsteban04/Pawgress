import { MasteryBar, SourceChip } from "@/components/ui";
import { CITATION, PROOF_TOPICS } from "@/config/showcase";

/**
 * The floating object in the sign-up aside.
 *
 * Deliberately NOT one of the landing hero's objects. The landing scatters six
 * cards to say "there is a lot here"; this shows exactly one, to say "this is
 * the thing you are signing up for". Same materials, opposite move.
 *
 * Content comes from `config/showcase.ts` so the subject mix across the public
 * pages stays deliberate rather than drifting back to one subject. Built from
 * the real `MasteryBar` and `SourceChip`, so the low-evidence rule still applies.
 */
export function AuthProof() {
  const [weakest] = PROOF_TOPICS;

  // No width of its own: the aside sizes the whole block, so a cap here would
  // leave the card narrower than the headline above it and break the left edge.
  return (
    <div className="w-full rounded-[1.25rem] border border-rule bg-surface p-5 shadow-[var(--shadow-float)]">
      <p className="text-xs font-medium text-ink-muted">After your first quiz</p>

      <div className="mt-4 flex flex-col gap-4">
        {PROOF_TOPICS.map((topic) => (
          <MasteryBar
            key={topic.topic}
            dense
            hideEvidence
            label={topic.topic}
            tone={topic.tone}
            value={topic.value}
            questionCount={topic.questionCount}
          />
        ))}
      </div>

      <p className="mt-5 border-t border-rule pt-4 text-[0.9375rem] leading-relaxed">
        {weakest?.topic} is holding you back. Twenty minutes today would move it more than anything
        else.
      </p>

      <div className="mt-3">
        <SourceChip material={CITATION.material} page={CITATION.page} />
      </div>
    </div>
  );
}
