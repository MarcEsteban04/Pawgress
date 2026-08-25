/**
 * Reorder tests for `move_topic()` (Sprint 24, FR-S7).
 *
 *   npm run db:test:reorder
 *
 * Runs against the HOSTED project as two real accounts, through PostgREST, so
 * RLS is in force exactly as it is in the app. It creates its own users and
 * deletes them at the end.
 *
 * Why a script and not a unit test: the logic being checked is a Postgres
 * function. Mocking Postgres to test SQL proves the mock works. The off-by-one
 * in a reorder — does index 2 mean before or after the row being moved — is
 * only answered by the database that will answer it in production.
 */
import fs from "node:fs";
import path from "node:path";

for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET =
  process.env.SUPABASE_SERVICE_ROLE ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY;

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  ok    ${name}`);
  else {
    failures++;
    console.log(`  FAIL  ${name}\n          expected ${e}\n          got      ${a}`);
  }
}

async function makeUser() {
  const email = `move-test-${Date.now()}@pawgress.test`;
  const password = `move-${Math.random().toString(36).slice(2)}-Aa1!`;
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const user = await res.json();
  const signIn = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { id: user.id, token: (await signIn.json()).access_token };
}

const user = await makeUser();

function rest(pathname, { method = "GET", body, prefer } = {}) {
  return fetch(`${URL_BASE}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${user.token}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: JSON.parse((await r.text()) || "null") }));
}

const subject = await rest("subjects", {
  method: "POST",
  prefer: "return=representation",
  body: { user_id: user.id, name: "Move test", color_slot: 1 },
});
const subjectId = subject.body[0].id;

// A, B, C, D at 100, 200, 300, 400.
const names = ["A", "B", "C", "D"];
await rest("topics", {
  method: "POST",
  body: names.map((name, i) => ({
    user_id: user.id,
    subject_id: subjectId,
    name,
    position: (i + 1) * 100,
  })),
});

async function order() {
  const res = await rest(
    `topics?select=name,position&subject_id=eq.${subjectId}&order=position.asc,created_at.asc`,
  );
  return res.body.map((r) => r.name);
}

async function idOf(name) {
  const res = await rest(`topics?select=id&subject_id=eq.${subjectId}&name=eq.${name}`);
  return res.body[0].id;
}

async function move(name, toIndex) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/move_topic`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${user.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_topic_id: await idOf(name), p_to_index: toIndex }),
  });
  if (res.status >= 300) console.log("    rpc error:", res.status, await res.text());
}

console.log("\nmove_topic()\n");
check("starts A B C D", await order(), ["A", "B", "C", "D"]);

await move("D", 0);
check("last to first", await order(), ["D", "A", "B", "C"]);

await move("D", 3);
check("first to last", await order(), ["A", "B", "C", "D"]);

await move("A", 2);
check("forward into the middle", await order(), ["B", "C", "A", "D"]);

await move("D", 1);
check("backward into the middle", await order(), ["B", "D", "C", "A"]);

await move("B", 0);
check("move to where it already is", await order(), ["B", "D", "C", "A"]);

// Collapse the sparse gap: repeatedly drop into the same slot.
for (let i = 0; i < 12; i++) {
  await move("A", 1);
  await move("C", 1);
}
check("survives a collapsed gap", (await order()).length, 4);
const positions = (
  await rest(`topics?select=position&subject_id=eq.${subjectId}&order=position.asc`)
).body.map((r) => r.position);
check("positions stay distinct", new Set(positions).size, 4);
console.log("    positions after churn:", positions.join(", "));

// A second account must not be able to move them.
const stranger = await makeUser();
const forged = await fetch(`${URL_BASE}/rest/v1/rpc/move_topic`, {
  method: "POST",
  headers: {
    apikey: ANON,
    Authorization: `Bearer ${stranger.token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ p_topic_id: await idOf("A"), p_to_index: 0 }),
});
check("a stranger cannot move them", forged.status >= 400, true);

for (const u of [user, stranger]) {
  await fetch(`${URL_BASE}/auth/v1/admin/users/${u.id}`, {
    method: "DELETE",
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
  });
}

console.log(failures === 0 ? "\nall passed\n" : `\n${failures} failed\n`);
process.exitCode = failures === 0 ? 0 : 1;
