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
 *
 * WRITTEN FOR TWO AUDIENCES since sign-in became the landing page's primary
 * call to action: most people here are returning, but a first-time visitor now
 * arrives on this screen too. Nothing on it may assume they have been here
 * before — "Welcome back" to someone who has never signed up is a small lie in
 * the first sentence they read. The card is illustrative either way.
 */
export function AuthAsideResume() {
  return (
    <>
      <div>
        <p className="text-sm text-ink-muted">What is waiting for you</p>
        <h2 className="mt-3 font-display text-[clamp(2rem,3.2vw,3rem)] leading-[1.06] font-semibold tracking-[-0.03em]">
          Your next hour,
          <br />
          <span className="text-ink-subtle">already planned</span>
        </h2>
      </div>

      <AuthResume />

      <p className="text-sm leading-relaxed text-ink-muted">
        The plan is rebuilt from what you actually know today — not from what you missed.
      </p>
    </>
  );
}
