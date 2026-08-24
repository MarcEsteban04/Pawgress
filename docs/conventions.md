# Pawgress — Coding Conventions

Established in Sprint 01. These are the defaults; deviate only with a reason worth writing down.

## Language & typing

- TypeScript `strict` is on. Do not add `// @ts-ignore` — use `// @ts-expect-error` with a note, or
  fix the type.
- No `any`. Use `unknown` plus a narrowing check when a value is genuinely untyped.
- Prefer `type` aliases for object shapes; `interface` only when declaration merging is needed.
- Import types with the inline form: `import { type Subject } from "@/types"` (enforced by ESLint).

## Naming

| Thing | Convention | Example |
|---|---|---|
| Directories | kebab-case | `src/features/study-plan/` |
| React components | PascalCase file & export | `SubjectCard.tsx` |
| Hooks | `use` prefix, camelCase file | `useStudyPlan.ts` |
| Non-component modules | camelCase | `formatScore.ts` |
| Route segments | kebab-case | `app/(app)/study-plan/page.tsx` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_UPLOAD_BYTES` |
| Booleans | `is` / `has` / `can` prefix | `isProcessing` |
| DB tables & columns | snake_case (Postgres default) | `quiz_attempts.started_at` |

## Server vs client

- Components are **Server Components by default**. Add `"use client"` only when the component needs
  state, effects, or browser APIs, and push it as far down the tree as possible.
- Server-only modules (`src/server/**`, `src/config/env.ts` server exports, Supabase service-role
  client) must never be imported from a client component.
- Data mutations go through Server Actions or route handlers — never call the Supabase service-role
  key from the browser.

## File organization

- A feature's code lives in `src/features/<feature>/`. Promote a component to
  `src/components/shared/` only when a second feature needs it.
- `src/components/ui/` holds the primitive set ([`design-system.md`](design-system.md)). Restyle
  through the design tokens in `app/globals.css`; do not fork a primitive’s API. Every primitive
  takes `className` and merges it via `cn()`, so callers override rather than fork.
- Co-locate types with the feature (`features/quizzes/types.ts`); only cross-feature types go in
  `src/types/`.

## Styling

- Tailwind utility classes are the default. Reach for a component class only when the same long
  utility string repeats three or more times.
- Use the design tokens for colour — `bg-surface`, `text-ink-muted`, `border-rule` — never a raw hex.
  Adding a colour means adding a token to all three theme blocks in `app/globals.css`.
- Class order is managed by `prettier-plugin-tailwindcss`; don't hand-sort.

## Errors & validation

- Validate every external input (form bodies, route params, AI output) with Zod at the boundary.
- Prefer the `Result<T, E>` type in `src/types` for expected failures; throw only for programmer
  errors and truly exceptional cases.
- User-facing errors say what happened and what to do next. Never surface a raw stack trace.

## Git

- Work lands on `main`. Branch only for work that is genuinely risky or long-running.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`.
- Reference the sprint in the body, e.g. `Sprint 01 — Project Initialization`.
- Run `npm run check` before committing.

## Accessibility

- Every interactive element is keyboard reachable and has an accessible name.
- Never signal state by color alone — pair it with an icon, label, or shape.
- Target WCAG AA contrast (4.5:1 body text). Students use this app on cheap phone screens.
