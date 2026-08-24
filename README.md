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
| [`docs/backlog.md`](docs/backlog.md) | Ordered development backlog and risk register |
| [`docs/conventions.md`](docs/conventions.md) | Coding conventions |

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| UI | React 19, Tailwind CSS v4, shadcn/ui *(Sprint 06)* |
| Backend | Supabase — PostgreSQL, Auth, Storage, RLS *(Sprint 09+)* |
| AI | LLM API + embeddings / vector search *(Sprint 31+)* |
| Hosting | Vercel + Supabase |

## Requirements

- Node.js **20.9+** (repo is developed on Node 24 — see `.nvmrc`)
- npm 10+

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
| `npm run format:check` | Prettier check (CI) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | typecheck + lint + format check — run before committing |

## Project structure

```text
src/
  app/                  App Router routes, layouts, and route handlers
  components/
    ui/                 shadcn/ui primitives (generated, rarely hand-edited)
    layout/             Shells: header, sidebar, nav
    shared/             App-wide composites used by 2+ features
  features/             Feature modules (subjects, materials, quizzes, ...)
  hooks/                Shared React hooks
  lib/
    supabase/           Supabase browser/server clients
    ai/                 LLM + embedding provider abstraction
    validation/         Zod schemas shared by forms and server code
    utils.ts            Small generic helpers
  server/               Server-only logic: server actions, data access
  config/               Static config (site.ts) and env access (env.ts)
  types/                Shared and generated types
  styles/               Global style partials beyond app/globals.css
supabase/
  migrations/           SQL migrations (Sprint 13+)
docs/                   Product spec, roadmap, requirements, flows, wireframes
design/
  wireframes/           Canvas artboards behind docs/wireframes.md (Sprint 04)
```

A `feature` module owns its own components, server logic, and types:

```text
src/features/subjects/
  components/
  server/
  types.ts
```

## Environment variables

All variables are documented in [`.env.example`](.env.example). Read them through
`src/config/env.ts` rather than touching `process.env` directly — a missing value should fail loudly
at the boundary. Anything without a `NEXT_PUBLIC_` prefix is server-only and must never be imported
into a client component.

## Roadmap status

| Phase | Sprints | Status |
|---|---|---|
| 1 — Product foundation | 01–04 | Complete ✅ |
| 2 — Design system & architecture | 05–08 | Sprint 05 next |
| 3 — Authentication | 09–12 | Not started |
| 4+ | 13–84 | Not started |
