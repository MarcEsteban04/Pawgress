import { z } from "zod";

/**
 * Auth input schemas and the password strength rule.
 *
 * Shared by the form and the server action on purpose — the client copy exists
 * so a student gets an answer without a round trip, and the server copy exists
 * because the client one can be bypassed with two lines in a console. Neither
 * is decoration.
 */

/** FR-A1: minimum 8 characters. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * A long password is a strong password; a short one with a `$` in it is not.
 * The rule here is deliberately not "one uppercase, one number, one symbol" —
 * composition rules are known to push people toward `Password1!`, and NIST
 * dropped them in SP 800-63B. Length and variety are scored instead.
 */
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(72, "Passwords are limited to 72 characters.");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .pipe(z.email("That does not look like an email address."))
  .transform((value) => value.toLowerCase());

/**
 * Setting a new password during recovery.
 *
 * The confirm field is not security — anyone who has the code can set whatever
 * they like. It is there because a password you cannot see is a password you
 * can typo, and discovering that at the NEXT sign-in, locked out again, with a
 * code that has already been spent, is a genuinely bad afternoon.
 */
export const resetPasswordSchema = z
  .object({
    code: z.string(),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "Both passwords need to match.",
    path: ["confirm"],
  });

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const emailOnlySchema = z.object({ email: emailSchema });

/** Confirmation codes are 6 digits — matches `otp_length` in supabase/config.toml. */
export const OTP_LENGTH = 6;

/**
 * Strips everything that is not a digit before checking the length, so a code
 * pasted as "123 456" or "123-456" out of a mail client still works. Being
 * strict here would only punish the student for their email app's formatting.
 */
export const otpSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length === OTP_LENGTH, {
    message: `Enter all ${OTP_LENGTH} digits.`,
  });

/* -------------------------------------------------------------------------- */
/*  Password strength                                                          */
/* -------------------------------------------------------------------------- */

export type PasswordStrength = {
  /** 0–4. 0 is empty or hopeless, 4 is good. */
  score: 0 | 1 | 2 | 3 | 4;
  /** Shown next to the meter. Never colour alone (NFR-A3). */
  label: string;
  /** The single most useful thing to do next, or null when it is fine. */
  hint: string | null;
  /** Whether it clears FR-A1's minimum. Submit is blocked below this. */
  meetsMinimum: boolean;
};

/**
 * The passwords that show up at the top of every breach corpus. A student who
 * types one of these gets told, whatever its length — "password123" is eleven
 * characters and worthless.
 */
const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "iloveyou",
  "princess",
  "sunshine",
  "football",
  "baseball",
  "welcome1",
  "admin123",
  "letmein1",
  "abc12345",
]);

export function scorePassword(password: string): PasswordStrength {
  const value = password ?? "";
  const meetsMinimum = value.length >= MIN_PASSWORD_LENGTH && value.length <= 72;

  if (value.length === 0) {
    return { score: 0, label: "Empty", hint: null, meetsMinimum: false };
  }

  if (COMMON.has(value.toLowerCase())) {
    return {
      score: 0,
      label: "Too common",
      hint: "This is one of the most guessed passwords there is. Try something else.",
      meetsMinimum,
    };
  }

  if (value.length < MIN_PASSWORD_LENGTH) {
    return {
      score: 1,
      label: "Too short",
      hint: `${MIN_PASSWORD_LENGTH - value.length} more character${
        MIN_PASSWORD_LENGTH - value.length === 1 ? "" : "s"
      } to go.`,
      meetsMinimum: false,
    };
  }

  // Length carries most of the weight, variety the rest.
  const variety =
    (/[a-z]/.test(value) ? 1 : 0) +
    (/[A-Z]/.test(value) ? 1 : 0) +
    (/[0-9]/.test(value) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(value) ? 1 : 0);

  const lengthPoints = value.length >= 20 ? 3 : value.length >= 14 ? 2 : value.length >= 10 ? 1 : 0;
  const varietyPoints = variety >= 3 ? 2 : variety >= 2 ? 1 : 0;

  // A single repeated character or a straight run is long but not strong, and
  // it returns before the floor below — otherwise "aaaaaaaaaa" would be lifted
  // to "Okay" and score the same as a real password.
  const predictable = /^(.)\1+$/.test(value) || /^(?:0123456789|abcdefghij|qwertyuiop)/.test(value);
  if (predictable) {
    return {
      score: 1,
      label: "Too predictable",
      hint: "Repeated letters and keyboard runs are the first thing guessed.",
      meetsMinimum,
    };
  }

  // Anything that clears the minimum without being predictable starts at 2.
  const score = Math.min(Math.max(lengthPoints + varietyPoints, 2), 4) as 2 | 3 | 4;

  if (score >= 4) return { score: 4, label: "Strong", hint: null, meetsMinimum };
  if (score === 3) {
    return {
      score: 3,
      label: "Good",
      hint: "A few more characters would make it stronger.",
      meetsMinimum,
    };
  }
  return {
    score: 2,
    label: "Okay",
    hint: "Longer beats complicated — try adding another word.",
    meetsMinimum,
  };
}
