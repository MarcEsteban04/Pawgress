"use server";

import { redirect } from "next/navigation";
import { type AuthFormState } from "@/features/auth/constants";
import {
  clearPendingEmail,
  clearRecoveryEmail,
  getPendingEmail,
  getRecoveryCooldown,
  getRecoveryEmail,
  getResendCooldown,
  forgetAccount,
  rememberAccount,
  setPendingEmail,
  setRecoveryEmail,
} from "./pending";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirects";
import {
  emailOnlySchema,
  otpSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

/**
 * Registration server actions (Sprint 10 — US-A1, FR-A1, FR-A2).
 *
 * These are Server Actions rather than browser calls to Supabase so the form
 * works without JavaScript, and so every failure is mapped to product copy on
 * the way out. Nothing a provider says reaches a student verbatim: Supabase
 * messages are written for developers, and some of them leak more than we want
 * (NFR-R3, docs/states.md §5).
 *
 * Only async functions may be exported from this file — the state type and the
 * constants live in `../constants.ts` for that reason.
 */

function fail(state: Omit<AuthFormState, "status">): AuthFormState {
  return { status: "error", ...state };
}

/**
 * Maps a Supabase auth failure onto something a student can act on.
 * The default is deliberately vague about causes and specific about next steps.
 */
function mapAuthError(status: number | undefined, code: string | undefined): AuthFormState {
  if (code === "over_email_send_rate_limit" || status === 429) {
    return fail({
      message: "Too many attempts in a short time.",
      nextStep: "Wait a minute and try again — nothing was lost.",
    });
  }
  if (code === "weak_password") {
    return fail({
      message: "That password is too easy to guess.",
      nextStep: "Try a longer one — three unrelated words beats a short complicated one.",
      fieldErrors: { password: "Too easy to guess." },
    });
  }
  if (code === "email_address_invalid" || code === "validation_failed") {
    return fail({
      message: "That email address was rejected.",
      nextStep: "Check it for typos and try again.",
      fieldErrors: { email: "Check this address." },
    });
  }
  if (code === "signup_disabled") {
    return fail({
      message: "New accounts are paused right now.",
      nextStep: "Try again later — this is on our side, not yours.",
    });
  }
  return fail({
    message: "We could not create your account just now.",
    nextStep: "Try again in a moment. If it keeps happening, it is not you — it is us.",
  });
}

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const submittedEmail = String(formData.get("email") ?? "");

  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return fail({
      email: submittedEmail,
      message: "Check the details above.",
      nextStep: "Fix the highlighted field and submit again.",
      fieldErrors: { email: flat.email?.[0], password: flat.password?.[0] },
    });
  }

  const { email, password } = parsed.data;
  const supabase = await createSupabaseServerClient();

  // No `emailRedirectTo`: the confirmation email carries a 6-digit code, not a
  // link, so there is nowhere for Supabase to send them. Which one gets sent is
  // decided entirely by the email template — see supabase/templates/.
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { ...mapAuthError(error.status, error.code), email };
  }

  /**
   * Duplicate account.
   *
   * With email confirmation on, Supabase deliberately does NOT error for an
   * address that already exists — it returns a decoy user with an empty
   * `identities` array, so an attacker cannot enumerate accounts by watching
   * for a different response. That is the only reliable signal, and it is what
   * US-A1 asks us to act on: say the address is taken and offer sign-in,
   * without revealing whether that account was ever verified.
   */
  const isExisting = data.user !== null && (data.user.identities?.length ?? 0) === 0;
  if (isExisting) {
    return fail({
      email,
      existingAccount: true,
      message: "That email already has an account.",
      nextStep: "Sign in instead — or use a different address if this was not you.",
    });
  }

  await setPendingEmail(email);

  // If the project has email confirmation switched off, sign-up returns a live
  // session and the student is already in. Handling both shapes means this
  // works whichever way the Supabase project is configured, rather than
  // stranding them on a "check your email" screen for an email never sent.
  if (data.session) redirect("/dashboard");

  redirect("/verify-email");
}

/** Resend the confirmation email, respecting the cooldown (US-A1). */
export async function resendVerificationAction(): Promise<AuthFormState> {
  const email = await getPendingEmail();
  if (!email) {
    return fail({
      message: "We do not know which address to send to.",
      nextStep: "Enter your email again to restart sign-up.",
    });
  }

  // Enforced here, not only in the countdown: the client control is a courtesy
  // and can be skipped by calling the action directly.
  const remaining = await getResendCooldown();
  if (remaining > 0) {
    return fail({
      message: `Another code can be sent in ${remaining}s.`,
      nextStep: "Check your spam folder while you wait — it is usually there.",
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  if (error) return { ...mapAuthError(error.status, error.code), email };

  await setPendingEmail(email);
  return { status: "idle", email };
}

/**
 * Confirms the account with the 6-digit code from the email (FR-A2).
 *
 * On success Supabase returns a live session, which the server client writes
 * straight to cookies — so the student is signed in the moment they confirm,
 * with no second trip through sign-in.
 *
 * The address comes from the httpOnly cookie rather than the form: taking it
 * from user input would turn this into an oracle where anyone could brute-force
 * codes against an address they do not own.
 */
export async function verifyOtpAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = await getPendingEmail();
  if (!email) {
    return fail({
      message: "We do not know which address to confirm.",
      nextStep: "Enter your email again to restart sign-up.",
    });
  }

  const parsed = otpSchema.safeParse(formData.get("code") ?? "");
  if (!parsed.success) {
    return fail({
      email,
      message: parsed.error.issues[0]?.message ?? "That code is not right.",
      nextStep: "Check the email and type the code again.",
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: parsed.data,
    type: "signup",
  });

  if (error) {
    // Supabase reports a wrong code and an expired code with the same status,
    // so the copy has to cover both without guessing which happened.
    if (error.status === 403 || error.code === "otp_expired") {
      return fail({
        email,
        message: "That code did not work.",
        nextStep: "Codes expire after an hour — check the newest email, or send a fresh code.",
      });
    }
    return { ...mapAuthError(error.status, error.code), email };
  }

  if (!data.session) {
    return fail({
      email,
      message: "The code was accepted but we could not sign you in.",
      nextStep: "Try signing in with your email and password.",
    });
  }

  await clearPendingEmail();
  redirect("/dashboard");
}

/**
 * Sign in (US-A2, FR-A3).
 *
 * One generic failure for every credential problem. Saying "no account with
 * that email" turns the form into an account-existence oracle, and saying
 * "wrong password" confirms the address is real — either one hands an attacker
 * half the work. A student who genuinely mistyped is no worse off: the fix is
 * the same in both cases.
 *
 * The exception is an unconfirmed address, which is not a credential problem at
 * all. Telling that student to check their password would be actively wrong, so
 * they go to the code screen instead.
 */
export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return fail({
      email,
      message: "Enter your email and password.",
      nextStep: "Both fields are needed to sign in.",
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      // They have an account but never confirmed it. Put the address back in the
      // pending cookie so /verify-email knows who to resend to.
      await setPendingEmail(email);
      redirect("/verify-email");
    }

    if (error.code === "over_request_rate_limit" || error.status === 429) {
      return fail({
        email,
        message: "Too many sign-in attempts.",
        nextStep: "Wait a minute and try again — your account is fine.",
      });
    }

    return fail({
      email,
      message: "That email and password do not match.",
      nextStep: "Check both and try again. If you have forgotten your password, create a new code.",
    });
  }

  /* Only on success. Remembering a failed attempt would suggest an address that
     may have been a typo, and on a shared machine it would leave a stranger's
     guess in the list for the next person. */
  await rememberAccount(email);

  redirect(next);
}

/**
 * The × on a row of the account chooser.
 *
 * The control that makes remembering acceptable on a shared machine: every
 * suggestion is visibly refusable in one click, without signing anyone in
 * first and without touching the other accounts on the list.
 *
 * Takes the address from the form rather than an index — see `forgetAccount`
 * for why removing by position is a way to remove the wrong one.
 */
export async function forgetAccountAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  if (email) await forgetAccount(email);
  redirect("/login");
}

/**
 * Sign out (US-A2, FR-A3).
 *
 * `scope: "local"` clears this browser only. Signing a student out of their
 * phone because they closed a tab in the library would be its own bug — global
 * sign-out belongs behind an explicit "sign out everywhere" control, which is a
 * Sprint 15 settings concern.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  // Sign-in, not the landing page. Someone who just signed out of a study app is
  // far more likely to be switching accounts or handing over a shared machine
  // than to want the marketing pitch again.
  redirect("/login");
}

/* -------------------------------------------------------------------------- */
/*  Account recovery (Sprint 12 — US-A4, FR-A5)                                */
/* -------------------------------------------------------------------------- */

/**
 * Ask for a reset code.
 *
 * **Always reports the same outcome**, whether or not that address has an
 * account (US-A4). "No account with that email" here would be a free
 * account-enumeration endpoint that needs no password and no rate limit to
 * abuse. Supabase already declines to distinguish the two; this keeps our side
 * of it honest, including when the send itself fails — the student's next step
 * is identical either way, so a different message would only leak.
 *
 * Recovery sends a 6-digit code, not a link, matching confirmation. A link
 * assumes the student opens their email on the same device they are resetting
 * on, which for a phone inbox and a laptop browser is exactly backwards. Codes
 * also survive corporate mail scanners, which follow links and can spend a
 * single-use token before the student ever sees it.
 */
export async function requestPasswordResetAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return fail({
      email: String(formData.get("email") ?? ""),
      message: "That does not look like an email address.",
      nextStep: "Check it for typos and try again.",
      fieldErrors: { email: "Check this address." },
    });
  }

  const { email } = parsed.data;
  const supabase = await createSupabaseServerClient();

  // The result is deliberately ignored. Whatever happened, the student is told
  // the same thing and sent to the same screen.
  await supabase.auth.resetPasswordForEmail(email);

  await setRecoveryEmail(email);
  redirect("/reset-password");
}

/**
 * Spend the code and set the new password.
 *
 * Two steps, in this order: `verifyOtp({ type: "recovery" })` proves ownership
 * and returns a session, and only then does `updateUser` change the password.
 * Without the first, this would be an endpoint that rewrites any account's
 * password given only an email address.
 */
export async function resetPasswordAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = await getRecoveryEmail();
  if (!email) {
    return fail({
      message: "We do not know which account to reset.",
      nextStep: "Ask for a new code — the last request has expired.",
    });
  }

  const parsed = resetPasswordSchema.safeParse({
    code: formData.get("code"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return fail({
      email,
      message: flat.confirm?.[0] ?? flat.password?.[0] ?? "Check the details above.",
      nextStep: "Fix the highlighted field and try again.",
      fieldErrors: { password: flat.password?.[0] ?? flat.confirm?.[0] },
    });
  }

  const code = otpSchema.safeParse(parsed.data.code);
  if (!code.success) {
    return fail({
      email,
      message: code.error.issues[0]?.message ?? "That code is not right.",
      nextStep: "Check the email and type the code again.",
    });
  }

  const supabase = await createSupabaseServerClient();

  const { error: otpError } = await supabase.auth.verifyOtp({
    email,
    token: code.data,
    type: "recovery",
  });

  if (otpError) {
    if (otpError.status === 403 || otpError.code === "otp_expired") {
      return fail({
        email,
        message: "That code did not work.",
        nextStep: "Codes expire after an hour and can only be used once. Send yourself a new one.",
      });
    }
    return { ...mapAuthError(otpError.status, otpError.code), email };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (updateError) {
    if (updateError.code === "same_password") {
      return fail({
        email,
        message: "That is the password you already had.",
        nextStep: "Choose a different one.",
        fieldErrors: { password: "Pick a new password." },
      });
    }
    return { ...mapAuthError(updateError.status, updateError.code), email };
  }

  // The code is spent and the session is live, so there is nothing left pending.
  await clearRecoveryEmail();
  redirect("/dashboard");
}

/** Resend a recovery code, respecting the same cooldown as confirmation. */
export async function resendRecoveryAction(): Promise<AuthFormState> {
  const email = await getRecoveryEmail();
  if (!email) {
    return fail({
      message: "We do not know which address to send to.",
      nextStep: "Enter your email again to start over.",
    });
  }

  const remaining = await getRecoveryCooldown();
  if (remaining > 0) {
    return fail({
      message: `Another code can be sent in ${remaining}s.`,
      nextStep: "Check your spam folder while you wait — it is usually there.",
    });
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email);
  await setRecoveryEmail(email);
  return { status: "idle", email };
}
