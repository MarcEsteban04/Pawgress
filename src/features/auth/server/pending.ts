import "server-only";

import { cookies } from "next/headers";
import {
  ACCOUNTS_COOKIE,
  ACCOUNTS_MAX,
  ACCOUNTS_MAX_AGE_SECONDS,
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

/* -------------------------------------------------------------------------- */
/*  Remembered accounts                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The accounts this browser has signed in with, newest first.
 *
 * Parsed defensively: the value is a cookie, so it is whatever the client sent.
 * Anything that is not a list of plausible addresses is treated as absent
 * rather than repaired — a corrupt suggestion list is worth nothing, and the
 * cost of dropping it is that someone types their email once.
 */
export async function getAccounts(): Promise<string[]> {
  const store = await cookies();
  const raw = store.get(ACCOUNTS_COOKIE)?.value;
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value.length <= 320 && value.includes("@"))
      .slice(0, ACCOUNTS_MAX);
  } catch {
    return [];
  }
}

async function writeAccounts(emails: string[]) {
  const store = await cookies();

  if (emails.length === 0) {
    store.delete(ACCOUNTS_COOKIE);
    return;
  }

  store.set(ACCOUNTS_COOKIE, JSON.stringify(emails), {
    /* httpOnly like every other address this app stores: it is the one piece of
       personal data in the auth flow, and script on the page has no reason to
       read it. Nothing here is a credential — the password is always asked. */
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCOUNTS_MAX_AGE_SECONDS,
  });
}

/**
 * Remember an account, newest first.
 *
 * Written on a SUCCESSFUL sign-in only. Remembering a failed attempt would
 * suggest an address that may simply have been a typo, and on a shared machine
 * it would leave a stranger's guess in the list for the next person.
 *
 * Matching is case-insensitive so one account cannot occupy two rows, but the
 * address is stored as the student typed it — an email local part is
 * case-sensitive by the spec even though no real provider treats it that way,
 * and lowercasing what goes back into the form is not ours to do.
 */
export async function rememberAccount(email: string) {
  const existing = await getAccounts();
  const lower = email.toLowerCase();
  const next = [email, ...existing.filter((value) => value.toLowerCase() !== lower)].slice(
    0,
    ACCOUNTS_MAX,
  );
  await writeAccounts(next);
}

/**
 * Drop one account from the list — the × on its row.
 *
 * By VALUE rather than by index: the list can change between the page being
 * rendered and the button being pressed (another tab signing in, reordering
 * the rows), and an index would then remove whichever account had moved into
 * that position. Removing the wrong account is a small betrayal of a control
 * whose whole job is "forget this one".
 */
export async function forgetAccount(email: string) {
  const existing = await getAccounts();
  const lower = email.toLowerCase();
  await writeAccounts(existing.filter((value) => value.toLowerCase() !== lower));
}
