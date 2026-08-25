import { AuthProof } from "./AuthProof";

/**
 * The aside for anyone who has not decided yet — sign-up, and the confirm
 * screen that follows it. It argues the product: what you get after one quiz,
 * and where the claim comes from.
 *
 * Sign-in has its own (`AuthAsideResume`), because a returning student does not
 * need the pitch again.
 */
export function AuthAsideDefault() {
  return (
    <>
      <div>
        <p className="text-sm text-ink-muted">For high school and college students</p>
        <h2 className="mt-3 font-display text-[clamp(2rem,3.2vw,3rem)] leading-[1.06] font-semibold tracking-[-0.03em]">
          Study what matters,
          <br />
          <span className="text-ink-subtle">not just more</span>
        </h2>
      </div>

      <AuthProof />

      <p className="text-sm leading-relaxed text-ink-muted">
        Every reviewer, flashcard and quiz question comes from material you uploaded — and cites the
        page it came from.
      </p>
    </>
  );
}
