import { AuthResume } from "./AuthResume";

/**
 * The aside for sign-in.
 *
 * A returning student has already been persuaded — repeating the pitch at them
 * is noise. What earns attention here is continuity: the exam that is coming,
 * how ready they are for it, and what today was already going to be.
 *
 * The closing line is the anti-guilt clause. Study apps are unusually good at
 * making someone feel bad for having been away, and a returning student is
 * exactly the person that lands hardest on.
 */
export function AuthAsideResume() {
  return (
    <>
      <div>
        <p className="text-sm text-ink-muted">Welcome back</p>
        <h2 className="mt-3 font-display text-[clamp(2rem,3.2vw,3rem)] leading-[1.06] font-semibold tracking-[-0.03em]">
          Your next hour,
          <br />
          <span className="text-ink-subtle">already planned</span>
        </h2>
      </div>

      <AuthResume />

      <p className="text-sm leading-relaxed text-ink-muted">
        However long you have been away, the plan is rebuilt from what you actually know today — not
        from what you missed.
      </p>
    </>
  );
}
