# Pawgress — Design System

**Sprint 06 deliverable.** The primitive set every feature builds on, and the standards that keep it
coherent. Brand values live in [`branding.md`](branding.md); the layouts these serve are in
[`wireframes.md`](wireframes.md).

---

## 1. Where things live

```text
src/app/globals.css          design tokens (light + dark), base layer, icon defaults
src/app/layout.tsx           type ramp wired via next/font
src/lib/utils.ts             cn() — class merge, so callers can always override
src/types/index.ts           JobStatus vocabulary + mastery thresholds
src/components/ui/           the primitives, exported from index.ts
src/components/shared/       Logo, PawMark
```

Import from the barrel, not the file:

```tsx
import { Button, Card, MasteryBar, StatusBadge } from "@/components/ui";
```

## 2. Tokens, not values

Colour, radius and type come from tokens. Tailwind utilities map onto them, so
`bg-surface text-ink border-rule` is the vocabulary — never `bg-[#FFFDF9]`.

| Tailwind class | Token |
|---|---|
| `bg-paper` `bg-surface` `bg-surface-sunken` | surfaces |
| `text-ink` `text-ink-muted` `text-ink-subtle` | ink ramp |
| `border-rule` `border-rule-strong` | hairlines |
| `bg-accent` `text-accent` `bg-accent-soft` `text-on-accent` | the one accent |
| `text-good` `text-warn` `text-bad` (+ `-soft` grounds) | status |
| `bg-subject-1` … `bg-subject-6` | subject tints, no meaning attached |
| `font-display` `font-sans` `font-mono` | type ramp |
| `rounded-[var(--radius-card)]` `rounded-[var(--radius-control)]` | density |

Adding a colour means adding a token in all three theme blocks in `globals.css`, never a one-off hex
in a component.

## 3. The primitives

| Component | Notes |
|---|---|
| `Button` | Variants `primary` `outline` `subtle` `ghost` `danger`; sizes `sm` `md` `lg` `icon`; `block` for full width. Defaults to `type="button"`. No `asChild` — style a link with `buttonStyles()` instead |
| `Card` + `CardHeader/Title/Body/Footer` | Self-contained panel. `SectionLabel` is the uppercase kicker; `Hairline` the divider |
| `MasteryBar` | **The one to read first.** Enforces evidence counts and withholds low-evidence numbers |
| `StatusBadge` | The single job-status vocabulary. Icon + label, never colour alone |
| `QuotaMeter` | Used / limit / reset time, shown before a limit blocks anyone |
| `EmptyState` | Illustration slot, explanation, and exactly one action |
| `ErrorState` | `title` (what happened) + `nextStep` (what to do) — both required |
| `Skeleton` | Shaped like what it replaces, so nothing shifts on load |
| `Field` + `Input` `Textarea` `Select` | Label, hint, error scaffolding. 16 px text, 44 px controls |
| `Chip` `ChipGroup` `Tag` | Chips replace dropdowns for small option sets; scroll rather than wrap at narrow widths |
| `SourceChip` | A citation. Renders as a real link when given `href` |
| `Dialog` + `ConfirmDialog` | Sheet under 640 px, centred dialog above. `ConfirmDialog` requires a consequences line with counts |
| `Menu` | Overflow and account menus. Secondary actions only |
| `SegmentedNav` | Route links, not a JS tab widget — each view stays linkable |
| `Avatar` | Initials fallback, no image library for a 32 px circle |
| `Logo` / `PawMark` | Brand marks |

## 4. Standards

**Server by default.** A component gets `"use client"` only when it needs state, effects or browser
APIs. `Dialog` and `Menu` are client (focus management); everything else renders on the server.
`ErrorState` becomes client at the point a caller passes `onRetry`.

**Every component takes `className` and merges it through `cn()`.** A caller can always override a
default without forking the component.

**Composition over configuration.** `Card` is four small parts rather than a dozen props. When a
component needs a fifth boolean, it wants splitting.

**Real links for anything navigable.** Cards and rows that lead somewhere are `<a>`/`<Link>`, so
ctrl-click and middle-click open a new tab. Never an `onClick` on a `div` that navigates.

**States are the component's job, not the caller's.** If a surface can be empty, loading, or failed,
the primitive covers it — see [`states.md`](states.md).

**Accessibility is not a later pass.** Every interactive element is keyboard reachable with a visible
focus ring and an accessible name; every status carries an icon and a label; `aria-valuetext` on
`MasteryBar` reads the evidence count, not just the percentage.

## 5. Deliberately not built yet

Named so nobody assumes they exist.

| Missing | Why, and when |
|---|---|
| **Toasts** | Nothing to announce yet — there are no mutations until Sprint 10. A toast system built before that would be guesswork. Lands with the first server action |
| **App shell** (`SideNav`, `TopBar`, `SidePanel`, `FocusShell`) | Needs the route groups from Sprint 07. Building it before the routing model would hard-code the wrong structure |
| **Domain composites** (`EntityCard`, `ListRow`, `QuizOption`, `Flashcard`, `UploadDropzone`) | These are feature components. They belong to their features (Sprints 19+), not to `ui/` — promoting them early would fix decisions the features have not made yet |
| **Theme toggle** | Tokens already support `data-theme`; the control needs somewhere to live, which is the app shell |

## 6. Why not the shadcn/ui CLI

The specification names shadcn/ui, and this **is** its architecture: Radix primitives for behaviour,
`cva` for variants, `tailwind-merge` so callers can override. What we skip is the registry.

Pulling components from the registry brings its token vocabulary with them — `--background`,
`--foreground`, `--muted`, in oklch — and those would sit alongside the Pawgress tokens rather than
replacing them. Two parallel colour systems in one stylesheet is how a design system rots: the next
person cannot tell which one is authoritative, and `bg-background` and `bg-surface` slowly diverge.

Authoring in-repo costs a little more up front and buys one vocabulary, no upgrade drift, and
components that already know product rules a generic registry cannot — that `MasteryBar` must
withhold a low-evidence number, that `ConfirmDialog` needs a consequences line with counts, that
`StatusBadge` uses one shared status vocabulary.

Radix is still a dependency wherever behaviour is genuinely hard: focus trapping, restore-on-close,
typeahead in menus. Reimplementing those by hand would be the actual mistake.

## 7. Proving it

The landing page at `/` is built entirely from these primitives, including a live `MasteryBar` group.
It is the smoke test: if a token or a primitive is wrong, that page shows it.

```bash
npm run dev     # http://localhost:3000
npm run check   # typecheck + lint + format
npm run build   # production build
```
