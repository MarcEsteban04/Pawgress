/**
 * Security tests for Row Level Security (Sprint 14 deliverable).
 *
 *   npm run db:test:rls
 *
 * Creates two throwaway accounts, has each try to reach the other's rows
 * through PostgREST exactly as a browser would, and deletes them afterwards.
 * Nothing here uses the service-role key for the assertions themselves —
 * service-role bypasses RLS, so a test written with it would pass no matter how
 * broken the policies were. It is used only to create and destroy the fixtures.
 *
 * Why a script rather than a unit test: RLS is enforced by Postgres, not by any
 * code in this repo. The only way to know it works is to ask the real database
 * the same questions an attacker would.
 *
 * Exits non-zero on the first genuine failure, so it can gate a release.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

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

loadEnvLocal();

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!URL_BASE || !ANON || !SECRET) {
  console.error("\n  Needs NEXT_PUBLIC_SUPABASE_URL, the anon key and the service-role key.\n");
  process.exit(1);
}

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** A PostgREST request as a given identity. `token` null means anonymous. */
async function rest(pathname, { token, method = "GET", body, prefer } = {}) {
  const headers = {
    apikey: ANON,
    Authorization: `Bearer ${token ?? ANON}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${URL_BASE}/rest/v1/${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: response.status, body: json };
}

async function admin(pathname, { method = "GET", body } = {}) {
  const response = await fetch(`${URL_BASE}/auth/v1/${pathname}`, {
    method,
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

/** Fixture accounts. Confirmed on creation so they can sign in immediately. */
async function createUser(label) {
  const email = `rls-test-${label}-${Date.now()}@pawgress.test`;
  const password = `rls-test-${Math.random().toString(36).slice(2)}-Aa1!`;

  const created = await admin("admin/users", {
    method: "POST",
    body: { email, password, email_confirm: true },
  });
  if (created.status >= 300) throw new Error(`could not create ${label}: ${created.status}`);

  const signedIn = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const session = await signedIn.json();
  if (!session.access_token) throw new Error(`could not sign in ${label}`);

  return { id: created.body.id, email, token: session.access_token };
}

const created = [];

try {
  console.log(`\n  RLS security tests — ${new URL(URL_BASE).hostname}\n`);

  const alice = await createUser("alice");
  created.push(alice.id);
  const bob = await createUser("bob");
  created.push(bob.id);

  /* ---------------------------------------------------------------------- */
  console.log("\n  Anonymous (the key that ships in the browser)");

  for (const table of ["profiles", "subjects", "materials", "quiz_answers"]) {
    const r = await rest(`${table}?select=*`, { token: null });
    check(
      `anon reads no ${table}`,
      r.status === 200 && Array.isArray(r.body) && r.body.length === 0,
      `HTTP ${r.status}, ${Array.isArray(r.body) ? r.body.length + " rows" : "non-array"}`,
    );
  }

  const anonWrite = await rest("subjects", {
    token: null,
    method: "POST",
    body: { user_id: alice.id, name: "anon injected" },
  });
  check("anon cannot insert", anonWrite.status >= 400, `HTTP ${anonWrite.status}`);

  /* ---------------------------------------------------------------------- */
  console.log("\n  Ownership — Alice's own rows");

  const made = await rest("subjects", {
    token: alice.token,
    method: "POST",
    prefer: "return=representation",
    body: { user_id: alice.id, name: "Alice Biology", color_slot: 4 },
  });
  check("alice creates her subject", made.status === 201, `HTTP ${made.status}`);
  const subjectId = Array.isArray(made.body) ? made.body[0]?.id : made.body?.id;

  const mine = await rest("subjects?select=*", { token: alice.token });
  check("alice reads her subject", mine.status === 200 && mine.body.length === 1);

  const myProfile = await rest("profiles?select=*", { token: alice.token });
  check("alice reads her profile", myProfile.status === 200 && myProfile.body.length === 1);

  /* ---------------------------------------------------------------------- */
  console.log("\n  Isolation — Bob against Alice");

  const bobReads = await rest("subjects?select=*", { token: bob.token });
  check("bob cannot read alice's subject", bobReads.body.length === 0);

  /* Negative control. "Bob saw nothing" is only evidence if there was something
     to see — otherwise an empty table passes every isolation test ever written.
     Service-role bypasses RLS, so this asks the database directly whether the
     row Bob could not reach actually exists. */
  const bypass = await fetch(`${URL_BASE}/rest/v1/subjects?select=id&id=eq.${subjectId}`, {
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
  });
  const bypassRows = await bypass.json();
  check(
    "control: the row Bob could not see does exist",
    Array.isArray(bypassRows) && bypassRows.length === 1,
    "if this fails the isolation tests above are vacuous",
  );

  const bobReadsProfile = await rest(`profiles?select=*&id=eq.${alice.id}`, { token: bob.token });
  check("bob cannot read alice's profile", bobReadsProfile.body.length === 0);

  const bobUpdates = await rest(`subjects?id=eq.${subjectId}`, {
    token: bob.token,
    method: "PATCH",
    prefer: "return=representation",
    body: { name: "owned by bob now" },
  });
  check(
    "bob cannot update alice's subject",
    Array.isArray(bobUpdates.body) && bobUpdates.body.length === 0,
    `HTTP ${bobUpdates.status}`,
  );

  const bobDeletes = await rest(`subjects?id=eq.${subjectId}`, {
    token: bob.token,
    method: "DELETE",
    prefer: "return=representation",
  });
  check(
    "bob cannot delete alice's subject",
    Array.isArray(bobDeletes.body) && bobDeletes.body.length === 0,
    `HTTP ${bobDeletes.status}`,
  );

  /* ---------------------------------------------------------------------- */
  console.log("\n  The gap policies alone would leave");

  // Bob's own user_id, Alice's subject. The policy is satisfied — the row IS
  // his — so only the composite foreign key can refuse this.
  const crossParent = await rest("topics", {
    token: bob.token,
    method: "POST",
    body: { user_id: bob.id, subject_id: subjectId, name: "smuggled into alice's subject" },
  });
  check(
    "bob cannot attach a topic to alice's subject",
    crossParent.status >= 400,
    `HTTP ${crossParent.status}`,
  );

  // Writing a row that claims to belong to someone else.
  const forged = await rest("subjects", {
    token: bob.token,
    method: "POST",
    body: { user_id: alice.id, name: "planted in alice's account" },
  });
  check("bob cannot insert a row owned by alice", forged.status >= 400, `HTTP ${forged.status}`);

  // Giving your own row away — blocked by WITH CHECK on UPDATE, not USING.
  const ownSubject = await rest("subjects", {
    token: bob.token,
    method: "POST",
    prefer: "return=representation",
    body: { user_id: bob.id, name: "Bob Chemistry", color_slot: 5 },
  });
  const bobSubjectId = Array.isArray(ownSubject.body) ? ownSubject.body[0]?.id : null;
  const handover = await rest(`subjects?id=eq.${bobSubjectId}`, {
    token: bob.token,
    method: "PATCH",
    body: { user_id: alice.id },
  });
  check("bob cannot hand his own row to alice", handover.status >= 400, `HTTP ${handover.status}`);

  /* ---------------------------------------------------------------------- */
  console.log("\n  Storage — files are private at the storage layer (FR-U9)");

  /**
   * Storage speaks its own API, not PostgREST.
   * `keyOverride` is only for the service-role cleanup check at the end.
   */
  async function storage(pathname, { token, method = "GET", body, contentType } = {}, keyOverride) {
    const key = keyOverride ?? ANON;
    const headers = { apikey: key, Authorization: `Bearer ${token ?? key}` };
    if (contentType) headers["Content-Type"] = contentType;
    const response = await fetch(`${URL_BASE}/storage/v1/${pathname}`, { method, headers, body });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: response.status, body: json };
  }

  const aliceObject = `${alice.id}/avatars/probe.txt`;
  const put = await storage(`object/avatars/${aliceObject}`, {
    token: alice.token,
    method: "POST",
    contentType: "text/plain",
    body: "alice's bytes",
  });
  /* The bucket refuses text/plain by `allowed_mime_types`, which is itself the
     point — but it means this fixture has to use an allowed type to get far
     enough to test ownership. */
  const objectPath = `${alice.id}/avatars/probe.png`;
  const putPng = await storage(`object/avatars/${objectPath}`, {
    token: alice.token,
    method: "POST",
    contentType: "image/png",
    body: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });
  check(
    "bucket rejects a disallowed mime type",
    put.status >= 400,
    `text/plain returned HTTP ${put.status}`,
  );
  check("alice uploads into her own folder", putPng.status < 300, `HTTP ${putPng.status}`);

  const bobDownloads = await storage(`object/avatars/${objectPath}`, { token: bob.token });
  check(
    "bob cannot download alice's file",
    bobDownloads.status >= 400,
    `HTTP ${bobDownloads.status}`,
  );

  const anonDownloads = await storage(`object/avatars/${objectPath}`, { token: null });
  check(
    "anon cannot download it either",
    anonDownloads.status >= 400,
    `HTTP ${anonDownloads.status}`,
  );

  const bobSigns = await storage(`object/sign/avatars/${objectPath}`, {
    token: bob.token,
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({ expiresIn: 60 }),
  });
  check(
    "bob cannot sign a URL for alice's file",
    bobSigns.status >= 400,
    `HTTP ${bobSigns.status}`,
  );

  // Writing INTO someone else's folder — the case the path convention exists for.
  const bobIntrudes = await storage(`object/avatars/${alice.id}/avatars/planted.png`, {
    token: bob.token,
    method: "POST",
    contentType: "image/png",
    body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  });
  check(
    "bob cannot write into alice's folder",
    bobIntrudes.status >= 400,
    `HTTP ${bobIntrudes.status}`,
  );

  const bobDeletes2 = await storage(`object/avatars/${objectPath}`, {
    token: bob.token,
    method: "DELETE",
  });
  check("bob cannot delete alice's file", bobDeletes2.status >= 400, `HTTP ${bobDeletes2.status}`);

  /* ---------------------------------------------------------------------- */
  console.log("\n  Cascade — deleting an account takes its data (NFR-P3)");

  /* The same two steps, in the same order, that `deleteAccountAction` performs.
     Files cannot ride the auth.users cascade — Supabase blocks deleting
     `storage.objects` rows in SQL, because the bytes behind them would be
     orphaned — so removing them is application work, and it happens FIRST so a
     failure leaves the account intact. */
  const purge = await storage(`object/avatars`, {
    token: alice.token,
    method: "DELETE",
    contentType: "application/json",
    body: JSON.stringify({ prefixes: [objectPath] }),
  });
  check("files can be removed through the Storage API", purge.status < 300, `HTTP ${purge.status}`);

  const removed = await admin(`admin/users/${alice.id}`, { method: "DELETE" });
  check("the account itself deletes", removed.status < 300, `HTTP ${removed.status}`);
  created.splice(created.indexOf(alice.id), 1);

  const leftovers = await fetch(`${URL_BASE}/rest/v1/subjects?select=id&user_id=eq.${alice.id}`, {
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
  });
  const rows = await leftovers.json();
  check("alice's subjects went with her account", Array.isArray(rows) && rows.length === 0);

  /* The public tables cascade from auth.users, but storage.objects is not ours
     and has no foreign key to cascade along — the trigger added in Sprint 16 is
     what clears it, and this is the check that the trigger actually fired. */
  const objectsLeft = await storage(
    `object/list/avatars`,
    {
      token: null,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({ prefix: `${alice.id}/`, limit: 10 }),
    },
    SECRET,
  );
  check(
    "alice's files went with her account too",
    Array.isArray(objectsLeft.body) && objectsLeft.body.length === 0,
    `HTTP ${objectsLeft.status}, ${Array.isArray(objectsLeft.body) ? objectsLeft.body.length + " objects" : "unexpected body"}`,
  );
} catch (error) {
  failures.push(`threw: ${error.message}`);
  console.log(`\n  ERROR  ${error.message}`);
} finally {
  for (const id of created) await admin(`admin/users/${id}`, { method: "DELETE" });
}

console.log(`\n  ${passed} passed, ${failures.length} failed\n`);
if (failures.length > 0) {
  for (const name of failures) console.log(`    - ${name}`);
  console.log("");
  process.exitCode = 1;
}
