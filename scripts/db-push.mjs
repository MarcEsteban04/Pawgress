/**
 * Applies pending migrations from `supabase/migrations/` to the hosted project.
 *
 *   npm run db:push:remote            # apply
 *   npm run db:push:remote -- --check # list what is pending, change nothing
 *
 * Why this exists alongside the Supabase CLI: `supabase db push` needs the
 * database password, and `db reset` / `db diff` need Docker. Neither is
 * available on every machine that has to ship a schema change. This goes
 * through the Management API with the same personal access token the auth
 * configuration already uses.
 *
 * It records what it applied in `supabase_migrations.schema_migrations` — the
 * same table the CLI reads — so switching back to `supabase db push` later
 * picks up exactly where this left off rather than trying to replay everything.
 *
 * **This is not a substitute for `db reset`.** Applying a migration forward is
 * not proof it replays from empty, and only Docker can prove that. See
 * docs/supabase.md.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const CHECK_ONLY = process.argv.includes("--check");

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
    "Create one at https://supabase.com/dashboard/account/tokens and add it to .env.local.",
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) die("NEXT_PUBLIC_SUPABASE_URL is not set in .env.local.");
if (url.includes("localhost") || url.includes("127.0.0.1")) {
  die(
    "NEXT_PUBLIC_SUPABASE_URL points at the local stack.",
    "Use `npm run db:reset` there — it replays every migration from empty, which is\n  the check this script cannot perform.",
  );
}

const ref = new URL(url).hostname.split(".")[0];
const endpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

/** Runs SQL and returns the rows, or throws with the server's own message. */
async function run(query) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) {
    let detail = text;
    try {
      detail = JSON.parse(text).message ?? text;
    } catch {
      // Not JSON; the raw body is the best message available.
    }
    throw new Error(detail);
  }
  return text ? JSON.parse(text) : [];
}

// The CLI's own bookkeeping table. Creating it here keeps the two interchangeable.
await run(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    name text,
    statements text[]
  );
`);

const applied = new Set(
  (await run("select version from supabase_migrations.schema_migrations;")).map((r) => r.version),
);

const files = fs.existsSync(MIGRATIONS_DIR)
  ? fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith(".sql"))
      .sort()
  : [];

const pending = files.filter((name) => !applied.has(name.split("_")[0]));

console.log(`\n  project ${ref} — ${applied.size} applied, ${pending.length} pending\n`);

if (pending.length === 0) {
  console.log("  Nothing to do.\n");
  process.exit(0);
}

for (const name of pending) console.log(`  → ${name}`);

if (CHECK_ONLY) {
  console.log("\n  --check: nothing was applied.\n");
  process.exitCode = 1;
} else {
  for (const name of pending) {
    const version = name.split("_")[0];
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");

    process.stdout.write(`\n  applying ${name} … `);
    try {
      await run(sql);
    } catch (error) {
      console.log("failed");
      die(
        `${name} did not apply.`,
        `${error.message}\n\n  Nothing after this migration was attempted. Postgres runs each statement\n  in the same transaction, so the database is as it was before this file.`,
      );
    }

    await run(`
      insert into supabase_migrations.schema_migrations (version, name)
      values ('${version}', '${name.replace(/'/g, "''")}')
      on conflict (version) do nothing;
    `);
    console.log("ok");
  }

  console.log(`\n  Applied ${pending.length} migration(s).`);
  console.log("  Run `npm run db:types:remote` to regenerate src/types/database.ts.\n");
}
