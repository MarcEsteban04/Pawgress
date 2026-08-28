/**
 * Auth form contract and constants.
 *
 * Separate from `server/actions.ts` because a `"use server"` module may export
 * **only async functions** — a single exported constant there makes the whole
 * module export nothing, and the build failure ("the module has no exports at
 * all") does not point at the constant that caused it.
 */

export type AuthFormState = {
  status: "idle" | "error";
  /** What happened. */
  message?: string;
  /** What to do about it. Required whenever `message` is set. */
  nextStep?: string;
  /** Set when the message belongs beside one field rather than above the form. */
  fieldErrors?: { email?: string; password?: string };
  /** Echoed back so a failed submit does not wipe what they typed. */
  email?: string;
  /** Renders the "already have an account" affordance more prominently. */
  existingAccount?: boolean;
};

export const initialAuthState: AuthFormState = { status: "idle" };

/** How long a student must wait between verification emails (US-A1). */
export const RESEND_COOLDOWN_SECONDS = 60;

export const PENDING_EMAIL_COOKIE = "acadify-pending-email";
export const LAST_SENT_COOKIE = "acadify-verification-sent-at";

/** Long enough to finish the flow, short enough not to linger. */
export const PENDING_MAX_AGE_SECONDS = 60 * 30;

/**
 * Recovery uses its own cookies rather than sharing the sign-up ones.
 *
 * The two flows can legitimately overlap — someone half-way through confirming
 * a new account can still ask to reset a password on an older one — and one
 * shared "pending email" slot would silently overwrite whichever came first.
 */
export const RECOVERY_EMAIL_COOKIE = "acadify-recovery-email";
export const RECOVERY_SENT_COOKIE = "acadify-recovery-sent-at";
