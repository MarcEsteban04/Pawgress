/**
 * Regenerates `src/types/database.ts` from the hosted project's live schema.
 *
 *   npm run db:types:remote            # write
 *   npm run db:types:remote -- --check # fail if the file is stale, change nothing
 *
 * `supabase gen types --linked` does the same thing but needs the CLI linked
 * with the database password. This goes through the Management API with the
 * personal access token already in `.env.local`.
 *
 * The `--check` mode is the useful one in CI: a migration applied without
 * regenerating types leaves the app compiling happily against a schema that no
 * longer exists, and nothing catches it until a query fails at runtime.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src", "types", "database.ts");
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
if (!token) die("SUPABASE_ACCESS_TOKEN is not set in .env.local.");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) die("NEXT_PUBLIC_SUPABASE_URL is not set in .env.local.");
if (url.includes("localhost") || url.includes("127.0.0.1")) {
  die("NEXT_PUBLIC_SUPABASE_URL points at the local stack.", "Use `npm run db:types` there.");
}

const ref = new URL(url).hostname.split(".")[0];
const response = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`,
  { headers: { Authorization: `Bearer ${token}` } },
);

if (!response.ok) {
  die(`Could not generate types (HTTP ${response.status}).`, await response.text());
}

const { types } = await response.json();

const header = `/**
 * Generated database types — DO NOT EDIT BY HAND.
 *
 * Regenerate after every migration:
 *   npm run db:types:remote   # from the linked hosted project
 *   npm run db:types          # from the local stack (needs Docker)
 *
 * Committed rather than gitignored on purpose: a typecheck must not depend on
 * a database being reachable.
 */
`;

const next = header + types;
const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";

// `process.exitCode` rather than `process.exit()`: exiting hard while a fetch
// handle is still closing trips a libuv assertion on Windows, printing an
// alarming crash after an otherwise successful run.
if (current === next) {
  console.log("\n  src/types/database.ts is up to date.\n");
} else if (CHECK_ONLY) {
  console.log("\n  src/types/database.ts is STALE — the live schema has moved on.");
  console.log("  Run `npm run db:types:remote` and commit the result.\n");
  process.exitCode = 1;
} else {
  fs.writeFileSync(OUT, next);
  console.log(`\n  Regenerated src/types/database.ts from project ${ref}.\n`);
}
