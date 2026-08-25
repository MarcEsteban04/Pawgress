/**
 * Pushes the auth email templates in `supabase/templates/` to the hosted
 * Supabase project, over the Management API.
 *
 * Why this exists: the template is the switch that decides whether sign-up
 * sends a magic link or a 6-digit code (docs/supabase.md §6). Leaving that in a
 * dashboard textarea means the repo and the live project drift, and the symptom
 * — students receiving links for a screen that asks for a code — looks like an
 * application bug rather than a config one.
 *
 *   npm run auth:sync-templates            # apply
 *   npm run auth:sync-templates -- --check # compare only, change nothing
 *
 * Needs a Supabase **personal access token**, which is NOT any of the project
 * keys. Create one at https://supabase.com/dashboard/account/tokens and put it
 * in .env.local as SUPABASE_ACCESS_TOKEN. It is account-wide, so it never goes
 * anywhere near the browser bundle or a deployment.
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
    "Create one at https://supabase.com/dashboard/account/tokens and add it to .env.local.\n  It is a personal access token (sbp_…), not the anon or service-role key.",
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) die("NEXT_PUBLIC_SUPABASE_URL is not set in .env.local.");

const ref = new URL(url).hostname.split(".")[0];
if (!ref || ref === "127" || url.includes("localhost")) {
  die(
    "NEXT_PUBLIC_SUPABASE_URL points at the local stack.",
    "The local templates are already wired through supabase/config.toml — this script is only for the hosted project.",
  );
}

/**
 * Each entry maps a file to the two Management API fields that carry it.
 * Add password-recovery here in Sprint 12 rather than pasting it by hand.
 */
const TEMPLATES = [
  {
    label: "Confirm signup",
    file: "supabase/templates/confirm-signup.html",
    subjectField: "mailer_subjects_confirmation",
    contentField: "mailer_templates_confirmation_content",
    subject: "Your Pawgress confirmation code",
  },
];

const endpoint = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const current = await fetch(endpoint, { headers });
if (!current.ok) {
  const detail = current.status === 401 ? "The access token was rejected." : await current.text();
  die(`Could not read the auth config for project ${ref} (HTTP ${current.status}).`, detail);
}
const config = await current.json();

const payload = {};
let changed = false;

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

  changed = true;
  const sendsCode = content.includes("{{ .Token }}");
  console.log(
    `  → ${template.label} — needs updating (${sendsCode ? "sends a 6-digit code" : "sends a link"})`,
  );
  payload[template.contentField] = content;
  payload[template.subjectField] = template.subject;
}

if (!changed) {
  console.log("\n  Nothing to do.\n");
  process.exit(0);
}

if (CHECK_ONLY) {
  console.log("\n  --check: nothing was changed. Re-run without it to apply.\n");
  process.exit(1);
}

const applied = await fetch(endpoint, { method: "PATCH", headers, body: JSON.stringify(payload) });
if (!applied.ok) {
  die(`Update failed (HTTP ${applied.status}).`, await applied.text());
}

console.log(`\n  Applied to project ${ref}.`);
console.log("  Register a test account — the email should now carry a 6-digit code.\n");
