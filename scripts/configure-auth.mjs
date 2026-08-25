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
  senderName: process.env.SMTP_SENDER_NAME ?? "Pawgress",
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
/*  2. Templates                                                               */
/* -------------------------------------------------------------------------- */

/** Sprint 12's password-recovery template gets added here, not pasted by hand. */
const TEMPLATES = [
  {
    label: "Confirm signup",
    file: "supabase/templates/confirm-signup.html",
    subjectField: "mailer_subjects_confirmation",
    contentField: "mailer_templates_confirmation_content",
    subject: "Your Pawgress confirmation code",
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
/*  3. Apply                                                                   */
/* -------------------------------------------------------------------------- */

if (Object.keys(payload).length === 0) {
  console.log("\n  Nothing to do.\n");
  process.exit(0);
}

if (CHECK_ONLY) {
  console.log("\n  --check: nothing was changed. Re-run without it to apply.\n");
  process.exit(1);
}

const applied = await fetch(endpoint, { method: "PATCH", headers, body: JSON.stringify(payload) });
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
