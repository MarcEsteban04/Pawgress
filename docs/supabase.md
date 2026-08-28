# Acadify — Supabase

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
| Sign-up, resend, confirmation callback | [`src/features/auth/`](../src/features/auth/), [`src/app/auth/callback/`](../src/app/auth/callback/route.ts) |
| Env access | [`src/config/env.ts`](../src/config/env.ts) |
| Local stack config | [`supabase/config.toml`](../supabase/config.toml) |
| Generated row types | [`src/types/database.ts`](../src/types/database.ts) |

### Two schemas, and why auth works before Sprint 13

A reasonable question on seeing "database schema — Sprint 13" while sign-in already works: *what is
it storing accounts in?*

There are two schemas in the database, owned by different people:

| Schema | Owner | Contains |
|---|---|---|
| `auth` | **Supabase** — created with the project | `auth.users`: email, hashed password, `email_confirmed_at`, sessions, refresh tokens |
| `storage` | **Supabase** — created with the project | Bucket and object metadata |
| `public` | **Us** — created in Sprint 13 | `profiles`, `subjects`, `topics`, `materials`, … |

Registration, confirmation, sign-in and password reset live entirely in `auth`. Not one of them
touches a table we wrote, which is why the whole of Phase 3 works with `public` still empty.

Phase 3 shipped before `public` held a single table, which is why sign-in worked with nothing of
ours in the database. Sprint 13 filled it in — see §9 — including the trigger and backfill that give
every account a `profiles` row, since three sprints of students had already registered by then.

The dashboard still renders labelled sample data. The tables exist now, but nothing writes to them
until subjects and uploads arrive in Sprint 19+.

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

The public pages still render with no Supabase at all — `supabaseConfigured()` returns false and the
proxy passes every request through — but **nothing behind sign-in works**, in any environment.
Sprint 11 deleted the preview session that used to stand in here, so there is no longer a path that
hands out a session without Supabase saying so. Landing on `/dashboard` redirects to `/login`.

---

## 3. Creating the hosted project — needs a human

These two steps cannot be done from the repository. They need someone signed in to Supabase.

1. **Create the project.** <https://supabase.com/dashboard> → New project.
   - Name `acadify`, region closest to your students (`Southeast Asia (Singapore)` for the
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
- **RLS carries 67 policies across all 17 tables (Sprint 14).** One rule — a student sees and
  writes their own rows — plus composite foreign keys for the case policies cannot see. Proven by
  `npm run db:test:rls`, which attacks the live database with two real accounts. See §10.

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

## 6. Email confirmation — a 6-digit code

Sign-up confirms with a **code the student types**, not a link they click.

Supabase decides link-vs-code purely by **which variable the email template renders**. There is no
separate setting:

| Template renders | What is sent |
|---|---|
| `{{ .ConfirmationURL }}` | A magic link |
| `{{ .Token }}` | A 6-digit code |

The local stack is already wired: [`supabase/config.toml`](../supabase/config.toml) points
`[auth.email.template.confirmation]` at
[`supabase/templates/confirm-signup.html`](../supabase/templates/confirm-signup.html). Nothing else
is needed to develop the flow.

### The hosted project needs custom SMTP first

**Supabase will not let you edit email templates until custom SMTP is configured.** The Subject and
Body fields on Authentication → Emails are read-only, behind a "Set up custom SMTP to edit
templates" notice, and the project keeps sending the stock link email.

This is not a nuisance to route around — Supabase's built-in sender is explicitly not for
production and is rate limited to a handful of emails per hour across the whole project. Check
Authentication → Rate Limits for the current number. A study app cannot onboard students on that
regardless of what the template says.

So the real dependency chain is:

```text
custom SMTP  →  template editing unlocks  →  6-digit codes on the hosted project
```

### Choosing a sender

| Option | Good for | The catch |
|---|---|---|
| **Gmail + App Password** | Getting unblocked today | ~500 messages/day, `From` is forced to your own address, no SPF/DKIM on your domain, and Google's terms do not contemplate app mail. Development only |
| **Brevo** | Testing against real addresses | 300/day free, no verified domain required |
| **Resend** | Production | Needs a verified domain before it will send to arbitrary addresses |
| **Mailgun / SES** | Scale | More setup than either of the above |

**Gmail is the right first move and the wrong last one.** It gets the flow working in ten minutes
without a new account, and it will quietly become a deliverability problem the moment real students
sign up: transactional mail from a personal Gmail lands in spam far more often, and there is no
domain alignment to fix that. Treat it as scaffolding, and move to a transactional provider before
launch — swapping is five environment variables and one command.

To use Gmail:

1. **2-Step Verification must be on** for the account — Google will not issue an App Password
   without it.
2. Create one at <https://myaccount.google.com/apppasswords>, named something like
   `Acadify Supabase`. Copy the 16 characters and **remove the spaces**.
3. Put the values in `.env.local` (see `.env.example`), where `SMTP_USER` and `SMTP_SENDER_EMAIL`
   are both the Gmail address — Gmail rewrites the `From` header to the authenticated account, so a
   different sender address is silently ignored.

### Applying it

```bash
npm run auth:configure -- --check   # show what would change
npm run auth:configure              # set SMTP, then push the templates
```

One command instead of a dashboard visit, and the template stays in the repo where it can be
reviewed rather than in a textarea where it silently drifts. It reads `SUPABASE_ACCESS_TOKEN` and
the `SMTP_*` values from `.env.local`, and never prints a secret.

**Until SMTP exists, develop against the local stack** (§2). Templates work there with no
restriction, Mailpit catches every message, and there are no send limits — Sprints 10 to 12 can be
built and reviewed end to end without touching the hosted project.

Code length and lifetime come from `otp_length = 6` and `otp_expiry = 3600` in `config.toml`;
match them in the dashboard under Authentication → Providers → Email if you change them.

`/auth/callback` is kept even though sign-up no longer uses it — the password-reset link in
Sprint 12 lands there. That is also why Redirect URLs should still include
`http://localhost:3000/**` and your production URL.

### The deviation

US-A1 says *"an unverified account can sign in but is prompted to verify"*, and the wireframe for
screen 4 says **verification does not block the app**. Supabase does not offer that shape. Its
"Confirm email" setting is binary:

| Setting | Behaviour |
|---|---|
| **On** | A verification email is sent, and sign-in is refused until the link is clicked |
| **Off** | The account is confirmed instantly and **no email is ever sent** |

There is no built-in "send the email but let them in meanwhile". Getting it would mean running our
own verification: a token table, our own email provider, our own expiry and resend logic, and a
second source of truth about whether an address is real. That is a sprint of work and a permanent
maintenance cost, to save a student roughly thirty seconds.

**We follow Supabase's model rather than build around it.** There is also a product reason: every
account can spend AI generations, and those cost real money, so an unverified account that can use
the app is an unmetered way to burn budget.

The code does not assume which way the switch is set. `registerAction` checks whether sign-up
returned a session:

- **Session returned** (confirmation off) → straight to `/dashboard`.
- **No session** (confirmation on) → `/verify-email`, where they type the code. Confirming returns a
  live session, so a student is signed in the moment they confirm — no second trip through sign-in.

If you want the wireframe's behaviour exactly, the honest options are: turn confirmation **off** and
drop the verification claim, or schedule the custom flow as its own sprint. Do not leave the
wireframe saying one thing while the app does another — pick one and update the other.

## 7. Password recovery uses a code too

`resetPasswordForEmail` sends the *recovery* template, which is wired the same way as confirmation:
[`supabase/templates/reset-password.html`](../supabase/templates/reset-password.html) renders the
token action, so a code is sent rather than a link. `npm run auth:configure` pushes both.

FR-A5 says "reset-by-**link** flow", and this is a code. Two reasons, and the requirement wording
should follow rather than the other way round:

- **A link assumes one device.** Students read email on a phone and reset on a laptop. A link opens
  the reset screen on the phone; a code can be typed wherever they already are.
- **Link scanners spend single-use tokens.** Corporate and school mail filters follow links to check
  them, which can consume a one-time reset token before the student ever clicks it. The failure looks
  exactly like "the link is broken".

It also keeps one pattern across the product: every code Acadify emails is six digits, entered on a
screen that looks the same.

The flow is `/forgot-password` → `/reset-password` (code + new password on ONE screen) →
`/dashboard`. One screen rather than two because splitting them spends the code before the password
is accepted, so a typo would strand the student with a used code and no way forward.

`/auth/callback` is now unused by any shipped flow — both emails carry codes. It is kept for Google
sign-in (FR-A9), which needs exactly that handler. Delete it if that gets cut.

## 8. Migrations

Every schema change ships as a migration in `supabase/migrations/` (NFR-O3). Nothing is changed by
hand in the hosted dashboard — a change made there and not captured is a change that will be missing
on the next reset, and nobody finds out until it matters.

**With Docker** (the full loop):

```bash
npm run db:diff -- add_subjects_table   # capture what you changed in local Studio
npm run db:reset                        # prove it replays from empty
npm run db:types                        # regenerate row types
npm run db:push                         # send it to the linked project
```

**Without Docker** (what Sprint 13 was applied with):

```bash
npm run db:push:remote -- --check   # list pending migrations
npm run db:push:remote              # apply them to the hosted project
npm run db:types:remote             # regenerate row types from the live schema
npm run db:types:remote -- --check  # fail if the committed types are stale
```

Both routes record what was applied in `supabase_migrations.schema_migrations`, the table the CLI
itself reads, so they are interchangeable.

### Applied so far

| Migration | Sprint | What it does |
|---|---|---|
| `20260826090000_initial_schema.sql` | 13 | 17 tables, enums, triggers, 61 indexes, RLS enabled with no policies |
| `20260826120000_rls_policies.sql` | 14 | 67 policies and the composite foreign keys that close the gap policies cannot see |
| `20260826150000_storage_buckets.sql` | 16 | Two private buckets and their path-ownership policies |
| `20260826170000_drop_storage_delete_trigger.sql` | 16 | Removes the trigger that broke account deletion — Supabase forbids `delete from storage.objects` |
| `20260826180000_subjects_allow_duplicate_names.sql` | 19 | Drops `unique (user_id, name)`, which contradicted US-B1 |
| `20260827090000_subjects_academic_year.sql` | 22 | Adds `academic_year`, plus partial indexes for grouping and for the archive |
| `20260827120000_avatar_size_limit.sql` | — | Raises the avatar bucket to 25 MB at the product owner’s direction |
| `20260828090000_subject_last_activity.sql` | 24 | `last_activity_at` on subjects, maintained by a trigger on materials |
| `20260828093000_reorder_topics.sql` | 24 | `move_topic()` — atomic sparse-position reordering with respacing |

**Why `academic_year` is a `smallint` and not text.** It stores the STARTING year — 2025 means
2025–2026 — and the UI renders the range. A free-text box produces "2025-2026", "2025–2026" (en
dash), "AY 2025-26" and "25/26" across four subjects, and every one of those becomes its own group.
Storing a number makes grouping exact by construction, makes the ordering numeric rather than
lexical, and leaves the dash style a display decision that can change without a data migration.

### Two functions, two security models

`handle_deleted_user_storage()` and `touch_subject_activity()` are SECURITY
DEFINER. `move_topic()` is SECURITY INVOKER. The difference is not stylistic:

- A definer function is needed when the trigger writes to a DIFFERENT table
  from the one the statement touched. `touch_subject_activity()` fires on
  `materials` and updates `subjects`; under invoker rights it would have to
  satisfy the subjects UPDATE policy from inside a materials statement. That
  holds today and would stop holding the first time a background job writes on
  a student's behalf — and the symptom would be a silently stale sort order.
- `move_topic()` writes to the same table the caller may already write to, so
  invoker rights give exactly the enforcement a direct UPDATE would. Making it
  a definer would hand out an escape from the policy for no reason: any student
  could reorder any other student's topics by passing their id.

Every definer function pins `search_path`. Resolving names through a
caller-controlled path is an escalation route, not a style preference.

**The Docker route is still the one that proves anything.** Applying a migration forward is not
evidence that it replays from an empty database — only `db:reset` shows that, and a migration that
cannot rebuild the schema from scratch is a migration you cannot recover from. Install Docker before
Sprint 14's RLS policies, where "it worked when I applied it" and "it is correct" diverge sharply.

## 9. Row Level Security

Run the tests before believing any of this:

```bash
npm run db:test:rls
```

It creates two throwaway accounts, has each try to reach the other's rows through PostgREST exactly
as a browser would, and deletes them afterwards. Seventeen checks, and it exits non-zero on failure
so it can gate a release. The assertions never use the service-role key — that bypasses RLS, so a
test written with it would pass no matter how broken the policies were.

### The rule

Every table: `(select auth.uid()) = user_id`, granted `to authenticated` only, with separate
policies per operation. `profiles` keys on `id` instead and has **no delete policy** — a profile is
half of an account, and deleting it alone leaves a signed-in student with no name and no settings
while the account still exists. Account deletion (Sprint 15) removes the auth user and the cascade
takes the profile.

Two details that matter more than they look:

- **`(select auth.uid())`, not `auth.uid()`.** The subquery form is evaluated once per statement as
  an InitPlan; the bare call is re-evaluated per row. On a thousand-row scan that is one call versus
  a thousand.
- **UPDATE needs both `using` and `with check`.** `using` decides which rows may be targeted;
  `with check` decides what they may become. Without the second, a student could update their own
  row and set `user_id` to someone else's, handing it away. The test suite covers exactly this.

### The gap policies alone would leave

Every child table carries `user_id`, so a policy is perfectly happy to let Bob insert a topic with
**his** user_id pointing at **Alice's** subject. The row is his, so the check passes. The plain
foreign key is happy too, because that subject exists. Nothing catches it.

Sprint 14 closes it structurally rather than with another predicate: parents gained
`unique (id, user_id)`, and children reference `(subject_id, user_id) -> subjects (id, user_id)`.
The parent row must now match on owner as well as id. No subquery in the hot path, and — unlike a
policy — it holds against the service-role key too.

This needs Postgres 15+ for `on delete set null (column)`; plain SET NULL on a composite key would
try to null `user_id`, which is NOT NULL. The project is on 17.6.

## 10. The schema

Sixteen tables from the Sprint 13 list, plus `study_plan_items` — a plan with no items cannot
satisfy FR-L2's "concrete and actionable" or FR-L3's per-item completion, and the alternative was a
jsonb blob that ticking one item would rewrite wholesale.

Three rules run through
[`20260826090000_initial_schema.sql`](../supabase/migrations/20260826090000_initial_schema.sql):

- **Every table carries `user_id`**, even where ownership could be derived by joining upward. Sprint
  14's policies then read `auth.uid() = user_id` with no joins. A policy that walks three tables to
  decide ownership is slow on every row, easy to get subtly wrong, and is the last line of defence.
- **RLS is enabled on all seventeen, with no policies yet.** That combination denies everything,
  which is the only safe state: Supabase exposes public tables through PostgREST, so a table with
  RLS *off* is readable by anyone holding the anon key — and the anon key ships in the browser.
  Verified against the live project: every table returns zero rows to the anon key.
- **Deletes cascade from `auth.users` down**, so removing an account removes uploads, extracted
  text, embeddings and generated content with it (NFR-P3), without relying on application code.

`profiles` is created for new sign-ups by a trigger on `auth.users`, and the migration backfills
everyone who registered during Sprints 10–12 — three sprints of accounts that would otherwise have
had no profile row.
