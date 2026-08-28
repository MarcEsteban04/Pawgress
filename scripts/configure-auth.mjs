/**
 * Configures the hosted Supabase project's auth email: custom SMTP, then the
 * templates in `supabase/templates/`.
 *
 *   npm run auth:configure            # apply
 *   npm run auth:configure -- --check # compare only, change nothing
 *
 * Why both in one script: Supabase refuses to let you edit email templates
 * until custom SMTP is configured, so the two steps are a chain, not a choice.
 * Doing them together means one command instead of a dashboard visit, and the
 * template stays in the repo where it can be reviewed rather than in a textarea
 * where it silently drifts (docs/supabase.md §6).
 *
 * Needs a Supabase **personal access token** — account-wide, NOT any project
 * key. Create one at https://supabase.com/dashboard/account/tokens.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHECK_ONLY = process.argv.includes("--check");

/** Minimal .env.local reader — no dependency, and it never logs a value. */
function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

function die(message, hint) {
  console.error(`\n  ${message}`);
  if (hint) console.error(`  ${hint}`);
  console.error("");
  process.exit(1);
}

loadEnvLocal();

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  die(
    "SUPABASE_ACCESS_TOKEN is not set.",
    "Create one at https://supabase.com/dashboard/account/tokens and add it to .env.local.\n  It is a personal access token (sbp_...), not the anon or service-role key.",
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) die("NEXT_PUBLIC_SUPABASE_URL is not set in .env.local.");
if (url.includes("localhost") || url.includes("127.0.0.1")) {
  die(
    "NEXT_PUBLIC_SUPABASE_URL points at the local stack.",
    "Local auth email is already configured through supabase/config.toml, and Mailpit catches\n  every message. This script is only for the hosted project.",
  );
}

const ref = new URL(url).hostname.split(".")[0];
const endpoint = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const response = await fetch(endpoint, { headers });
if (!response.ok) {
  const detail =
    response.status === 401
      ? "The access token was rejected. Check SUPABASE_ACCESS_TOKEN."
      : await response.text();
  die(`Could not read the auth config for project ${ref} (HTTP ${response.status}).`, detail);
}
const config = await response.json();

const payload = {};

/* -------------------------------------------------------------------------- */
/*  1. SMTP                                                                    */
/* -------------------------------------------------------------------------- */

const smtp = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  senderEmail: process.env.SMTP_SENDER_EMAIL,
  senderName: process.env.SMTP_SENDER_NAME ?? "Acadify",
};

const smtpProvided = Boolean(smtp.host && smtp.port && smtp.user && smtp.pass && smtp.senderEmail);
const smtpConfigured = Boolean(config.smtp_host);

if (smtpProvided) {
  const unchanged =
    config.smtp_host === smtp.host &&
    String(config.smtp_port) === String(smtp.port) &&
    config.smtp_user === smtp.user &&
    config.smtp_admin_email === smtp.senderEmail &&
    config.smtp_sender_name === smtp.senderName;

  if (unchanged) {
    console.log(`  ✓ SMTP — already set to ${smtp.host}`);
  } else {
    console.log(`  → SMTP — setting ${smtp.host}:${smtp.port} as ${smtp.senderEmail}`);
    Object.assign(payload, {
      external_email_enabled: true,
      smtp_host: smtp.host,
      smtp_port: String(smtp.port),
      smtp_user: smtp.user,
      // The only place the password is used. It is never printed.
      smtp_pass: smtp.pass,
      smtp_admin_email: smtp.senderEmail,
      smtp_sender_name: smtp.senderName,
    });
  }
} else if (smtpConfigured) {
  console.log(`  ✓ SMTP — already configured on the project (${config.smtp_host})`);
} else {
  die(
    "Custom SMTP is not configured, and no SMTP_* values are set in .env.local.",
    [
      "Supabase will not accept a custom email template until SMTP is set up, and its built-in",
      "  sender is rate limited to a few messages an hour and is not for production.",
      "",
      "  Add these to .env.local and re-run (see docs/supabase.md §6 for a provider):",
      "    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER_EMAIL",
    ].join("\n"),
  );
}

/* -------------------------------------------------------------------------- */
/*  2. Settings the app depends on                                             */
/* -------------------------------------------------------------------------- */

/**
 * Two project settings the UI silently assumes, both wrong by default:
 *
 *  - `mailer_otp_length` ships as 8. The verify screen renders six cells and
 *    `otpSchema` rejects anything else, so an 8-digit code cannot be entered at
 *    all — the student gets a code that physically does not fit the form.
 *  - `rate_limit_email_sent` ships as 2 per hour for the WHOLE project, which
 *    is the cap on Supabase's built-in sender. With custom SMTP the limit is
 *    the provider's, not Supabase's, and leaving it at 2 blocks the third test
 *    signup of the day with an error that names no cause.
 *
 * Both live here rather than in a runbook step, because a setting nobody can
 * see from the repo is a setting that drifts back.
 */
const EXPECTED_OTP_LENGTH = 6;
/** Comfortably under Gmail's own limit; the provider is the real ceiling. */
const EXPECTED_EMAIL_RATE_LIMIT = 30;

if (Number(config.mailer_otp_length) !== EXPECTED_OTP_LENGTH) {
  console.log(
    `  → OTP length — ${config.mailer_otp_length} digits, the app expects ${EXPECTED_OTP_LENGTH}`,
  );
  payload.mailer_otp_length = EXPECTED_OTP_LENGTH;
} else {
  console.log(`  ✓ OTP length — ${EXPECTED_OTP_LENGTH} digits`);
}

if (Number(config.rate_limit_email_sent) < EXPECTED_EMAIL_RATE_LIMIT) {
  console.log(
    `  → Email rate limit — ${config.rate_limit_email_sent}/hour, raising to ${EXPECTED_EMAIL_RATE_LIMIT}`,
  );
  payload.rate_limit_email_sent = EXPECTED_EMAIL_RATE_LIMIT;
} else {
  console.log(`  ✓ Email rate limit — ${config.rate_limit_email_sent}/hour`);
}

/* -------------------------------------------------------------------------- */
/*  3. Templates                                                               */
/* -------------------------------------------------------------------------- */

const TEMPLATES = [
  {
    label: "Confirm signup",
    file: "supabase/templates/confirm-signup.html",
    subjectField: "mailer_subjects_confirmation",
    contentField: "mailer_templates_confirmation_content",
    subject: "Your Acadify confirmation code",
  },
  {
    label: "Reset password",
    file: "supabase/templates/reset-password.html",
    subjectField: "mailer_subjects_recovery",
    contentField: "mailer_templates_recovery_content",
    subject: "Your Acadify password reset code",
  },
];

for (const template of TEMPLATES) {
  const filePath = path.join(ROOT, template.file);
  if (!fs.existsSync(filePath)) die(`Missing template file: ${template.file}`);
  const content = fs.readFileSync(filePath, "utf8");

  const contentMatches = (config[template.contentField] ?? "") === content;
  const subjectMatches = (config[template.subjectField] ?? "") === template.subject;

  if (contentMatches && subjectMatches) {
    console.log(`  ✓ ${template.label} — already up to date`);
    continue;
  }

  const sendsCode = content.includes("{{ .Token }}");
  console.log(
    `  → ${template.label} — updating (${sendsCode ? "sends a 6-digit code" : "sends a link"})`,
  );
  payload[template.contentField] = content;
  payload[template.subjectField] = template.subject;
}

/* -------------------------------------------------------------------------- */
/*  4. Apply                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `process.exitCode` rather than `process.exit()` from here down: exiting hard
 * while a fetch handle is still closing trips a libuv assertion on Windows
 * ("!(handle->flags & UV_HANDLE_CLOSING)"), which prints an alarming crash
 * after an otherwise successful run. Letting the event loop drain is quieter
 * and correct.
 */
const nothingToDo = Object.keys(payload).length === 0;

if (nothingToDo) {
  console.log("\n  Nothing to do.\n");
} else if (CHECK_ONLY) {
  console.log("\n  --check: nothing was changed. Re-run without it to apply.\n");
  // Non-zero so this can gate a release later without reading the output.
  process.exitCode = 1;
} else {
  const applied = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });

  if (!applied.ok) {
    const body = await applied.text();
    die(
      `Update failed (HTTP ${applied.status}).`,
      applied.status === 400 && body.includes("smtp")
        ? `${body}\n\n  A rejected SMTP block usually means the sender address is not verified with\n  your provider yet. Verify ${smtp.senderEmail} in their dashboard and re-run.`
        : body,
    );
  }

  console.log(`\n  Applied to project ${ref}.`);
  console.log("  Register a test account — the email should carry a 6-digit code.\n");
}
