# Pawgress — Supabase

**Sprint 09 deliverable.** How the database, auth and storage are wired, how to run the stack
locally, and the two steps that need a human with a Supabase account.

Architecture reasoning lives in [`architecture.md`](architecture.md) §3–§4; this is the runbook.

---

## 1. What exists after Sprint 09

| Piece | Where |
|---|---|
| Browser client | [`src/lib/supabase/client.ts`](../src/lib/supabase/client.ts) |
| Server client (per request, RLS applies) | [`src/lib/supabase/server.ts`](../src/lib/supabase/server.ts) |
| Service-role client (**bypasses RLS**) | [`src/lib/supabase/admin.ts`](../src/lib/supabase/admin.ts) |
| Session refresh in the proxy | [`src/lib/supabase/proxy.ts`](../src/lib/supabase/proxy.ts) |
| Session gate (the DAL) | [`src/server/auth/session.ts`](../src/server/auth/session.ts) |
| Env access | [`src/config/env.ts`](../src/config/env.ts) |
| Local stack config | [`supabase/config.toml`](../supabase/config.toml) |
| Generated row types | [`src/types/database.ts`](../src/types/database.ts) |

There is **no schema yet** — that is Sprint 13. Registration and sign-in are Sprints 10–11. What
Sprint 09 delivers is the connection and the plumbing around it.

---

## 2. Running the stack locally

Requires Docker Desktop running.

```bash
npm run db:start     # boots Postgres, Auth, Storage, Studio, and a mail catcher
npm run db:status    # prints the URL and keys to paste into .env.local
```

`db:start` prints something like:

```text
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Mailpit URL: http://127.0.0.1:54324
publishable key: sb_publishable_...
secret key: sb_secret_...
```

Copy them into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."
```

Those local keys are **fixed demo values, identical on every machine**. They are safe to paste into
a chat or a ticket, and they are worthless outside your own Docker.

| Command | What it does |
|---|---|
| `npm run db:start` / `db:stop` | Boot / shut down the local stack |
| `npm run db:status` | Print URLs and keys again |
| `npm run db:reset` | Drop, re-run every migration, then apply `supabase/seed.sql` |
| `npm run db:diff -- <name>` | Capture schema changes made in Studio as a migration file |
| `npm run db:push` | Apply local migrations to the linked hosted project |
| `npm run db:types` | Regenerate `src/types/database.ts` from the local stack |

**Email verification is ON locally** (`enable_confirmations = true`), because FR-A1 requires it and a
local stack that silently skips it hides the entire Sprint 10 flow. Nothing is actually sent —
confirmation links land in the Mailpit inbox at <http://127.0.0.1:54324>.

### Without Docker

The app runs fine with no Supabase at all. `supabaseConfigured()` returns false, the proxy passes
every request through, and the DAL hands out a preview session **in development only**. In
production the same branch returns `null`, so a missing configuration locks the app rather than
opening it.

---

## 3. Creating the hosted project — needs a human

These two steps cannot be done from the repository. They need someone signed in to Supabase.

1. **Create the project.** <https://supabase.com/dashboard> → New project.
   - Name `pawgress`, region closest to your students (`Southeast Asia (Singapore)` for the
     Philippines).
   - Save the database password in a password manager — Supabase shows it once.
2. **Link and configure.**
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
   Then in the dashboard, under **Authentication → URL Configuration**, set:
   - Site URL: your production URL (and `http://localhost:3000` while developing)
   - Redirect URLs: `http://localhost:3000/**` and `https://<your-domain>/**`

   Under **Project Settings → API keys**, copy the publishable and secret keys into `.env.local` and
   into Vercel's environment variables.

Until then, everything in §2 works and Sprints 10–12 can be built and reviewed locally.

---

## 4. The three layers, and why the middle one is not optional

```text
proxy.ts          optimistic  — verifies the JWT, refreshes it, redirects
   ↓
requireSession()  real check  — asks the Auth server who this token belongs to
   ↓
RLS policies      last line   — the database refuses rows that are not yours
```

Each layer assumes the other two might be bypassed.

- **The proxy is not authorisation.** It runs on every request including link prefetches, and a
  redirect is a routing decision, not a permission. It is there to refresh the session — which only
  it can do, because a Server Component is not allowed to set cookies — and to save a signed-out
  visitor from rendering a page they cannot use.
- **`requireSession()` uses `getUser()`, not `getSession()`.** `getSession()` decodes the cookie
  without verifying it, and a cookie is attacker-controllable. `getUser()` costs a round trip and is
  memoised with React `cache()`, so it is paid once per request no matter how many components ask.
- **RLS is written in Sprint 13** with the schema. Until it exists, no table is safe to expose.

---

## 5. Rules for the secret key

`SUPABASE_SECRET_KEY` (the old `service_role` key) bypasses Row Level Security completely. It exists
for background jobs with no user session — extraction, embedding, generation from Sprint 31 — and for
administrative maintenance.

**If you are reaching for it to fix a "row not found" or a permission error in a normal request, the
bug is in the RLS policy.** Using it to step around a policy removes the last line of defence for
every row in that table, and does it silently. `src/lib/supabase/admin.ts` carries the same warning
at the point of use.

It is guarded three ways: `server-only` at the top of the module, no `NEXT_PUBLIC_` prefix, and a
getter in `config/env.ts` so importing the module never loads a key the request did not need.

---

## 6. Migrations

Every schema change ships as a migration in `supabase/migrations/` (NFR-O3). Nothing is changed by
hand in the hosted dashboard — a change made there and not captured is a change that will be missing
on the next reset, and nobody finds out until it matters.

```bash
# after editing schema in local Studio
npm run db:diff -- add_subjects_table
npm run db:reset          # prove the migration replays from empty
npm run db:types          # regenerate row types
```
