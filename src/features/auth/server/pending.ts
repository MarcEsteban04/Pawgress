import "server-only";

import { cookies } from "next/headers";
import {
  LAST_SENT_COOKIE,
  PENDING_EMAIL_COOKIE,
  PENDING_MAX_AGE_SECONDS,
  RECOVERY_EMAIL_COOKIE,
  RECOVERY_SENT_COOKIE,
  RESEND_COOLDOWN_SECONDS,
} from "@/features/auth/constants";

/**
 * The pending-verification cookies.
 *
 * These are plain server helpers, deliberately NOT Server Actions: everything
 * exported from a `"use server"` module becomes a callable endpoint, and a
 * reader that a page happens to need should not also be a POST route the whole
 * internet can hit.
 *
 * The address is carried in an httpOnly cookie rather than a query string. An
 * email in a URL ends up in browser history, in any `Referer` the page sends,
 * and in server logs — a cookie ends up in none of those, and this address is
 * the one piece of personal data the sign-up flow handles.
 */

export async function setPendingEmail(email: string) {
  const store = await cookies();
  const shared = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_MAX_AGE_SECONDS,
  };
  store.set(PENDING_EMAIL_COOKIE, email, shared);
  store.set(LAST_SENT_COOKIE, String(Date.now()), shared);
}

/** Drops the cookies once the address is confirmed — nothing pending to keep. */
export async function clearPendingEmail() {
  const store = await cookies();
  store.delete(PENDING_EMAIL_COOKIE);
  store.delete(LAST_SENT_COOKIE);
}

export async function getPendingEmail(): Promise<string | null> {
  const store = await cookies();
  return store.get(PENDING_EMAIL_COOKIE)?.value ?? null;
}

/** Seconds still to wait before another email may be sent. 0 when ready. */
export async function getResendCooldown(): Promise<number> {
  const store = await cookies();
  const raw = store.get(LAST_SENT_COOKIE)?.value;
  if (!raw) return 0;
  const elapsed = (Date.now() - Number(raw)) / 1000;
  if (!Number.isFinite(elapsed)) return 0;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}

/* -------------------------------------------------------------------------- */
/*  Password recovery                                                          */
/* -------------------------------------------------------------------------- */

export async function setRecoveryEmail(email: string) {
  const store = await cookies();
  const shared = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_MAX_AGE_SECONDS,
  };
  store.set(RECOVERY_EMAIL_COOKIE, email, shared);
  store.set(RECOVERY_SENT_COOKIE, String(Date.now()), shared);
}

export async function getRecoveryEmail(): Promise<string | null> {
  const store = await cookies();
  return store.get(RECOVERY_EMAIL_COOKIE)?.value ?? null;
}

export async function clearRecoveryEmail() {
  const store = await cookies();
  store.delete(RECOVERY_EMAIL_COOKIE);
  store.delete(RECOVERY_SENT_COOKIE);
}

/** Seconds still to wait before another recovery code may be sent. */
export async function getRecoveryCooldown(): Promise<number> {
  const store = await cookies();
  const raw = store.get(RECOVERY_SENT_COOKIE)?.value;
  if (!raw) return 0;
  const elapsed = (Date.now() - Number(raw)) / 1000;
  if (!Number.isFinite(elapsed)) return 0;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}
