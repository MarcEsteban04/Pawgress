"use server";

import { redirect } from "next/navigation";
import { publicEnv } from "@/config/env";
import { type AuthFormState } from "@/features/auth/constants";
import { getPendingEmail, getResendCooldown, setPendingEmail } from "./pending";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerSchema } from "@/lib/validation/auth";

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Where Supabase sends them from the confirmation email. This URL must
      // also be allowlisted in the dashboard under Authentication → URL
      // Configuration, or the link silently bounces to the site root.
      emailRedirectTo: `${publicEnv.appUrl}/auth/callback?next=/dashboard`,
    },
  });

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
      message: `Another link can be sent in ${remaining}s.`,
      nextStep: "Check your spam folder while you wait — it is usually there.",
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${publicEnv.appUrl}/auth/callback?next=/dashboard` },
  });

  if (error) return { ...mapAuthError(error.status, error.code), email };

  await setPendingEmail(email);
  return { status: "idle", email };
}
