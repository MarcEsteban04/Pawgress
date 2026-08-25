# Pawgress — Application Architecture

**Sprint 07 deliverable.** The boundaries: routing, data access, auth, storage, the AI service, and
how work that outlives a request gets done.

Companion documents: [`navigation.md`](navigation.md) (routes and screens) ·
[`design-system.md`](design-system.md) (primitives) · [`states.md`](states.md) (state handling)

Verified against the bundled Next.js 16.3.2 docs in `node_modules/next/dist/docs`, not from memory.

---

## 1. Shape

```text
Browser
  │
  ├── proxy.ts ................ optimistic cookie check, redirects only
  │
  ├── Server Components ....... read through the DAL
  ├── Server Actions .......... write through the DAL
  └── Route Handlers .......... uploads, AI streaming, the job runner
        │
        ├── src/server/ ....... Data Access Layer — the only place that talks to Supabase
        │     └── auth/session.ts   requireSession(), memoised per render
        │
        ├── src/lib/ai/ ....... provider-agnostic AI service
        └── Supabase .......... Postgres + RLS, Auth, Storage
```

One rule holds the whole thing together: **features never reach past the DAL.** No feature imports a
Supabase client, and no feature imports a model SDK. That is what makes RLS enforceable and the AI
provider swappable.

---

## 2. Routing

Route groups keep the four shells apart without adding URL segments.

```text
src/app/
  layout.tsx              html/body, fonts, theme script
  global-error.tsx        root-layout failure — own html/body, inline styles
  not-found.tsx           404, also "deleted while a tab was open"
  icon.svg                app icon and favicon
  (marketing)/page.tsx    /
  (auth)/                 centred card: /login, /register (+ reset, Sprint 12)
  (app)/                  sidebar shell: /dashboard, /subjects, /assistant,
                          /progress, /settings — layout + loading + error
  (focus)/                reserved: quiz attempt, flashcards (Sprints 44, 50)
```

### Why `(focus)` is a sibling group, not a nested layout

[`navigation.md`](navigation.md) originally put the quiz attempt at
`(app)/quizzes/[id]/attempt/layout.tsx`. That does not work: **nested layouts compose, they do not
replace.** A layout inside `(app)` renders *inside* the app shell, so it cannot remove the sidebar
that focus mode has to be rid of.

Focus routes therefore live in their own group with their own layout. Both groups require a session;
they differ only in chrome.

### Conventions

- **Page for anything deep-linkable**, dialog for short create/rename/confirm, side panel where the
  width exists. Never a quiz or a reviewer in a modal.
- **Filters, sort, tabs and question number live in the query string**, so a reload or a shared link
  preserves them.
- **Every navigable card and row is a real `<a>`/`<Link>`** — ctrl-click has to open a new tab.
- `loading.tsx` per segment, so navigation never shows a blank screen.

---

## 3. Auth: three layers, each assuming the others fail

Next.js 16's own guidance drives this, and it is the opposite of the common "middleware protects the
app" pattern.

| Layer | File | Does | Explicitly does *not* |
|---|---|---|---|
| **Proxy** | `src/proxy.ts` | Reads the session cookie; redirects signed-out visitors away from protected routes and signed-in ones away from `/login` | Touch the database. It runs on every request including prefetches |
| **DAL** | `src/server/auth/session.ts` | `requireSession()` — the real verification, memoised with React `cache()`. Called by `(app)/layout.tsx` and every server action | Trust anything the proxy concluded |
| **RLS** | Postgres policies (Sprint 14) | Owner-only rows, enforced in the database | Rely on the app getting the query right |

**`middleware.ts` is deprecated in Next.js 16** — the file is `proxy.ts`. A codemod exists
(`npx @next/codemod@canary middleware-to-proxy .`) if one ever gets written out of habit.

`unauthorized.tsx` / `forbidden.tsx` are still experimental behind the `authInterrupts` flag, so MVP
auth redirects to `/login` instead.

### What Sprint 09 wired up

`getSession()` now reads a real Supabase session: `supabase.auth.getUser()`, which asks the Auth
server who the token belongs to. `getSession()` on the Supabase client would be faster and is the
wrong call — it decodes the cookie without verifying it, and a cookie is attacker-controllable. React
`cache()` means the round trip is paid once per request however many components ask.

The proxy verifies the JWT with `getClaims()` and, more importantly, **refreshes the session**.
Only it can: a Server Component is not allowed to set cookies, so a token rotated during a page
render would be computed and thrown away. The visible symptom of getting this wrong is students being
signed out mid-session for no reason.

Three clients, three jobs — see [`supabase.md`](supabase.md):
`client.ts` (browser, auth calls only), `server.ts` (per request, RLS applies), and `admin.ts`
(service role, **bypasses RLS**, background jobs only).

### The preview gap is closed

Sprint 11 deleted the preview session that used to stand in before sign-in existed. There is no
longer any path that hands out a session without Supabase saying so, in any environment: no
configuration means no session, and `requireSession()` redirects.

Sign-out uses `scope: "local"`, which clears this browser only. Signing a student out of their phone
because they closed a tab in the library would be its own bug; a "sign out everywhere" control
belongs in settings (Sprint 15).

Protected responses carry `Cache-Control: no-store`. Without it, signing out and pressing Back can
repaint a fully rendered dashboard from the browser's cache — nothing new loads and the session is
gone, but a shared machine still shows the previous student's subjects and scores (US-A2).

Post-auth redirect targets go through `safeNextPath()` in [`src/lib/redirects.ts`](../src/lib/redirects.ts),
shared by sign-in and the email callback so the rule cannot be right in one place and forgotten in
the other. It rejects absolute URLs, scheme-relative `//evil.example`, and the auth routes
themselves.

---

## 4. Data access

- `src/server/` is server-only. A client component importing it is a bug, and the service-role key
  never leaves it.
- Reads happen in Server Components through the DAL. Writes happen in Server Actions, also through
  the DAL. There is no third way.
- Every server action starts with `requireSessionOrFail()` and validates its input with Zod before
  touching data (NFR-R3).
- Ownership is passed to Postgres, never assumed in TypeScript. RLS is the gate; a `WHERE user_id =`
  in application code is a convenience, not a control.
- Lists paginate at 25. No unbounded queries (NFR-F4).

### Storage

Buckets are private. Nothing is ever served from a public URL:

- Upload and download go through **short-lived signed URLs** minted server-side after the DAL has
  confirmed ownership.
- Storage policies mirror the row policies, so a leaked object path is not a leaked object.
- Deleting a material deletes its object, its extracted text, its chunks and its embeddings in one
  transaction — a partial delete leaving orphaned storage is a bug (US-B3).
- Uploaded filenames are untrusted input, including when they end up in a prompt (NFR-S5).

---

## 5. Background work — the decision

**The constraint.** Extracting, chunking and embedding a 50-page PDF does not fit in a request. And
`after()` does **not** solve it: the bundled docs are explicit that `after` runs within the
platform's configured max duration for the route. It is right for logging and usage accounting, and
wrong for this.

**Rejected alternatives.**

| Option | Why not |
|---|---|
| Do it in the request | Times out on real files, and the student stares at a spinner they cannot leave |
| `after()` / `waitUntil` | Same duration ceiling. Buys a faster response, not more compute |
| A third-party queue (Inngest, QStash) | Works, but adds a vendor, a second source of truth for job state, and a bill — for a solo build on free tiers |
| One long-running worker | Nothing in the Vercel + Supabase stack runs one without adding infrastructure |

**The decision: Postgres is the queue, and work is sliced.**

1. A `jobs` table is the single source of truth. It is also what the status UI reads, so "what the
   worker thinks" and "what the student sees" cannot drift (FR-P4).
2. Enqueueing **kicks an internal route handler** immediately, so a job starts in seconds rather
   than waiting for a schedule.
3. A handler processes **one bounded slice** — a few pages, a batch of chunks — records its cursor,
   and re-enqueues itself. Every invocation is comfortably inside the function limit whatever the
   plan allows, so the design does not depend on a duration number.
4. Workers **claim** work with `FOR UPDATE SKIP LOCKED` and hold a lease (`JOB_LEASE_SECONDS`), so
   two invocations never process the same slice.
5. A **sweeper** on a schedule reclaims expired leases and retries orphans, capped at
   `MAX_JOB_ATTEMPTS`, after which the job fails terminally with copy the student can act on
   (US-D2).
6. Every handler is **idempotent** (NFR-R1): writes are keyed on `(targetId, cursor)` and upsert, so
   a retry never produces duplicate chunks, embeddings or questions.

The contract is in [`src/server/jobs/types.ts`](../src/server/jobs/types.ts). The runner and the
table land in Sprints 13 and 31.

---

## 6. Errors: expected failures are values

The distinction that keeps screens useful:

| | Expected | Unexpected |
|---|---|---|
| Examples | Over quota, invalid file, not-found, malformed AI output | A bug, a null deref, an unhandled provider crash |
| Mechanism | `Result<T, AppError>` returned | Thrown |
| Rendered by | The page, in place | The nearest error boundary |

Throwing for a quota limit would replace a working screen with an error page. So `AppError`
([`src/lib/errors.ts`](../src/lib/errors.ts)) carries a `code`, a `message` (what happened) and a
**required `nextStep`** (what to do) — an error without a next step is a dead end.

Boundaries, innermost first:

| Level | File | Scope |
|---|---|---|
| Component / panel | `catchError` from `next/error` | One dashboard panel or AI generation, with its own `retry()` |
| Route segment | `error.tsx` in that segment | One feature area |
| App shell | `(app)/error.tsx` | Anything below; sidebar and top bar survive |
| Root layout | `global-error.tsx` | Own `html`/`body`, inline styles, a real document reload |

Nothing user-facing carries a raw provider message or a stack trace. `toAppError()` normalises
whatever was thrown into student-readable copy at the boundary.

---

## 7. The AI service

One interface, in [`src/lib/ai/types.ts`](../src/lib/ai/types.ts), used by the assistant, the
reviewer generator, the quiz generator and embeddings. Deliberate choices:

- **No raw `complete(prompt)` escape hatch.** Every call passes a schema; a schema miss is retried
  once inside the service, then surfaced as a generation failure. An unconstrained string endpoint
  would let a feature route around the "never render malformed output" rule (NFR-R4).
- **`context: RetrievedChunk[]` is required, and an empty array is meaningful.** It means retrieval
  found nothing, and the caller must say so rather than letting the model improvise (FR-C3).
- **Every call carries `userId`, a task kind and an idempotency key.** Cost is attributed, and a
  retried job is not paid for twice (NFR-C3, NFR-C4).
- **Quotas are in the contract, not in ops.** `AI_QUOTAS` sets daily generations and messages, pages
  per document, and stored bytes per user. A public site running an LLM over uploaded documents with
  no ceiling is the largest financial risk in this build (NFR-C1).

Providers implement the interface in Sprint 31. Swapping models is configuration; swapping providers
is one new implementation and no feature changes.

---

## 8. Open, and owned by a later sprint

| Question | Sprint |
|---|---|
| Rate-limit store — Postgres counters or an edge KV | 31 |
| Whether the sweeper runs on Vercel Cron or Supabase `pg_cron` (granularity differs by plan) | 13 |
| Streaming transport for the assistant — Server Actions vs a route handler | 37 |
| Global search implementation — Postgres full-text vs reusing the vector index | 20 |
| Error tracking vendor | 08 |
