# Pawgress 🐾

> An AI-powered study companion that helps students organize, understand, and master their schoolwork.

Pawgress lets high school and college students upload their school materials, then turns those
materials into reviewers, flashcards, and quizzes — and tracks what they actually understand, so the
app can tell them what to study next.

It is a **responsive web app**: one website that runs in a browser on desktops, laptops, tablets and
phones. There is no native app and no APK — desktop browsers are the primary design target, and
mobile browsers are fully supported down to a 360 px viewport.

| Document | What it is |
|---|---|
| [`docs/pawgress.md`](docs/pawgress.md) | Product specification |
| [`docs/pawgress_development_roadmap.md`](docs/pawgress_development_roadmap.md) | Roadmap (84 sprints) |
| [`docs/requirements.md`](docs/requirements.md) | Product requirements — scope contract, FR/NFR ids, open decisions |
| [`docs/mvp-scope.md`](docs/mvp-scope.md) | What ships in v0.1, and what is deliberately deferred |
| [`docs/user-stories.md`](docs/user-stories.md) | User stories with acceptance criteria |
| [`docs/user-flows.md`](docs/user-flows.md) | Flow diagrams for every journey, including recovery |
| [`docs/navigation.md`](docs/navigation.md) | Navigation model, route tree, screen inventory |
| [`docs/states.md`](docs/states.md) | Empty / loading / error state inventory and copy rules |
| [`docs/wireframes.md`](docs/wireframes.md) | Low-fidelity screen layouts, mobile constraints, responsive plan |
| [`docs/branding.md`](docs/branding.md) | Brand spec — palette, type ramp, logo, mascot, icon rules |
| [`docs/design-system.md`](docs/design-system.md) | Primitive set, token vocabulary, component standards |
| [`docs/architecture.md`](docs/architecture.md) | Routing, auth layers, data access, background jobs, errors |
| [`docs/supabase.md`](docs/supabase.md) | Supabase runbook — local stack, hosted project, the three auth layers |
| [`docs/backlog.md`](docs/backlog.md) | Ordered development backlog and risk register |
| [`docs/conventions.md`](docs/conventions.md) | Coding conventions |

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| UI | React 19, Tailwind CSS v4, Radix primitives, Lucide icons |
| Backend | Supabase — PostgreSQL, Auth, Storage, RLS |
| AI | LLM API + embeddings / vector search *(Sprint 31+)* |
| Hosting | Vercel + Supabase |

## Requirements

- Node.js **20.9+** (repo is developed on Node 24 — see `.nvmrc`)
- npm 10+
- Docker Desktop — only to run the local Supabase stack; the app runs without it

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values as each service comes online
npm run dev
```

The app runs at http://localhost:3000.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with autofix |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | typecheck + lint + format check — run before committing |
| `npm run db:start` / `db:stop` | Boot / stop the local Supabase stack |
| `npm run db:reset` | Re-run every migration, then seed |
| `npm run db:types` | Regenerate `src/types/database.ts` |
| `npm run db:push:remote` | Apply pending migrations to the hosted project (no Docker needed) |
| `npm run db:types:remote` | Regenerate types from the hosted schema; `-- --check` fails if stale |

## Project structure

```text
src/
  proxy.ts              Optimistic auth redirects (Next 16: not middleware.ts)
  app/
    (marketing)/        Landing page
    (auth)/             Centred-card shell: sign in, register
    (app)/              Sidebar shell: dashboard, subjects, ask, progress, settings
  components/
    ui/                 Primitive set — see docs/design-system.md
    layout/             Shells: sidebar, top bar, focus shell (Sprint 07)
    shared/             App-wide composites used by 2+ features
  features/             Feature modules (subjects, materials, quizzes, ...)
  hooks/                Shared React hooks
  lib/
    supabase/           Supabase browser/server clients
    ai/                 LLM + embedding provider abstraction
    validation/         Zod schemas shared by forms and server code
    utils.ts            Small generic helpers
  server/
    auth/session.ts     requireSession() — the real auth gate
    jobs/               Background job contract
  config/               Static config (site.ts) and env access (env.ts)
  types/                Shared and generated types
  styles/               Global style partials beyond app/globals.css
supabase/
  config.toml           local stack config (ports, auth rules)
  migrations/           SQL migrations — the schema's source of truth
  templates/            auth email templates (6-digit codes)
  seed.sql              local seed data, applied by `db:reset`
docs/                   Product spec, roadmap, requirements, flows, wireframes
design/
  wireframes/           Wireframe artboards, reference only (Sprint 04)
  brand/                Brand exploration artboards, reference only (Sprint 05)
```

A `feature` module owns its own components, server logic, and types:

```text
src/features/subjects/
  components/
  server/
  types.ts
```

## Environment variables

All variables are documented in [`.env.example`](.env.example), and the Supabase setup — local
stack, hosted project, and the two steps that need a human — is in [`docs/supabase.md`](docs/supabase.md). Read them through
`src/config/env.ts` rather than touching `process.env` directly — a missing value should fail loudly
at the boundary. Anything without a `NEXT_PUBLIC_` prefix is server-only and must never be imported
into a client component.

## Roadmap status

| Phase | Sprints | Status |
|---|---|---|
| 1 — Product foundation | 01–04 | Complete ✅ |
| 2 — Design system & architecture | 05–07 | Complete ✅ · redesigned to direction "Daylight" |
| 3 — Authentication | 09–12 | Complete ✅ |
| 4 — Database & storage | 13–18 | Sprint 13 ✅ · Sprint 14 next |
