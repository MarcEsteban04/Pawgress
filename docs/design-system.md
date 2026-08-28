# Acadify — Design System

The primitive set every feature builds on, and the standards that keep it coherent. Brand values live
in [`branding.md`](branding.md); the layouts these serve are in [`wireframes.md`](wireframes.md).

Originally a Sprint 06 deliverable in direction "Study Desk"; re-cut for direction **"Daylight"**.

---

## 1. Where things live

```text
src/app/globals.css              design tokens (light + dark), base layer, icon defaults
src/app/layout.tsx               type ramp wired via next/font
src/lib/utils.ts                 cn() — class merge, so callers can always override
src/types/index.ts               JobStatus vocabulary + mastery thresholds
src/components/ui/               the primitives, exported from index.ts
src/components/layout/           AppShell, SideNav, PageHeader, FocusShell, ThemeToggle
src/components/shared/           Logo, AcadifyMark, AppMark, BrandLockup, NotBuiltYet
src/features/<feature>/          feature components — promoted to ui/ only when a second feature needs them
```

Import from the barrel, not the file:

```tsx
import { Button, Card, MasteryBar, StatusBadge } from "@/components/ui";
```

## 2. Tokens, not values

Colour, radius, shadow and type come from tokens. Tailwind utilities map onto them, so
`bg-surface text-ink border-rule` is the vocabulary — never `bg-[#FFFFFF]`.

| Tailwind class | Token |
|---|---|
| `bg-page` `bg-frame` `.dot-grid` | the ground, the white window, its textured panel |
| `bg-paper` `bg-surface` `bg-surface-sunken` | surfaces |
| `text-ink` `text-ink-muted` `text-ink-subtle` `text-on-ink` | ink ramp |
| `border-rule` `border-rule-strong` | hairlines |
| `bg-accent` `text-accent` `bg-accent-soft` `text-on-accent` | brand accent |
| `text-good` `text-warn` `text-bad` (+ `-soft` grounds) | status |
| `bg-cat-1` … `bg-cat-5`, `bg-cat-1-soft` … | categorical — subject **identity** |
| `bg-mastery-1` … `bg-mastery-4`, `bg-mastery-none` | the ordinal mastery ramp |
| `font-display` `font-sans` `font-hand`, `.tabular` | type ramp and tabular figures |
| `rounded-[var(--radius-frame\|canvas\|card\|tile\|control\|pill)]` | density |
| `shadow-[var(--shadow-canvas\|card\|pill\|pop\|float)]` | elevation |
| `.drift` | the hero objects' slow float; collapses under `prefers-reduced-motion` |

Adding a colour means adding a token in all three theme blocks in `globals.css`, never a one-off hex
in a component. The one sanctioned exception is a chart passing `var(--cat-3)` as an SVG `stroke` or
`fill`, where a Tailwind class cannot reach.

## 3. Data visualisation

The dashboard is the product, so the chart rules are part of the design system rather than a matter
of taste per panel.

**The four colour jobs.** Every hue on screen is doing exactly one of these:

| Job | Token set | Rule |
|---|---|---|
| Identity (which subject) | `--cat-1..5` | Fixed slot order, never cycled, never recoloured by rank |
| Magnitude (how much mastery) | `--mastery-1..4` | One hue (teal), light→dark. The ramp direction *is* the meaning |
| State (ready / failed / over quota) | `--good` `--warn` `--bad` | Reserved. Never a data series, never colour alone |
| Action (press this) | `--accent` | The CTA blue. Never a data mark |
| Chrome | ink / surface / rule | Everything else |

The mastery ramp is teal specifically so it cannot collide with the other two blues in the system —
the accent and the `cat-3` subject hue. A bar that reads as a button, or as Mathematics, is a bug.

**Hard rules.**

- **Never a dual-axis chart.** Two measures of different units get two charts or a common index. A
  second y-scale invents a correlation that is not in the data. `TrendChart` takes two series only
  because both are percentages on one 0–100 axis.
- **Colour follows the entity, not its rank.** Filtering a list must not repaint the survivors.
- **No value-ramp on nominal categories.** Bar length already encodes magnitude; spending hue on it
  too burns the only channel left for identity.
- **Legend always present for two or more series**, so identity is never colour-alone.
- **Thin marks, solid hairline grid.** Dashed gridlines read as a threshold that is not there. 2 px
  lines with `vectorEffect="non-scaling-stroke"`, ≥ 8 px hover markers with a 2 px surface ring, a
  2 px surface gap between adjacent fills instead of a drawn border.
- **Axis labels are real HTML around the SVG**, not `<text>` inside it — so labels never scale with
  the plot, never clip, and a card never grows a nested scrollbar to reach its x-axis.
- **Values are printed, not hidden behind hover** wherever there is room. `Donut` puts every count and
  percentage in the legend; hovering only emphasises. A tooltip that is the *only* way to read a
  number fails on touch and in print.

**Both palettes are validated, not eyeballed.** The categorical set and the ordinal ramp were checked
against a lightness band, a chroma floor, colour-vision-deficiency separation on adjacent pairs, and
contrast against each mode's surface — in light *and* dark. Re-run the checks before changing any
`--cat-*` or `--mastery-*` value:

```bash
# categorical, per mode
node <dataviz-skill>/scripts/validate_palette.js "#7C3AED,#E11D48,#2563EB,#0E9F6E,#C2410C" --mode light
node <dataviz-skill>/scripts/validate_palette.js "#9575F0,#EE5A78,#4E8DF0,#0FA36F,#D9682F" --mode dark

# ordinal mastery ramp, per mode
node <dataviz-skill>/scripts/validate_palette.js "#63BFB7,#33A29A,#147B75,#0B504C" --ordinal --mode light
node <dataviz-skill>/scripts/validate_palette.js "#175E5A,#22857E,#3FB3AA,#7FD6CE" --ordinal --mode dark
```

## 4. The primitives

| Component | Notes |
|---|---|
| `Button` | Variants `primary` (ink) `accent` `subtle` `quiet` `ghost` `danger`; sizes `sm` `md` `lg` `icon`; `shape` `pill` (default) or `square`; `block` for full width. Defaults to `type="button"`. No `asChild` — style a link with `buttonStyles()` |
| `IconButton` | The circular icon action in a card header or top bar. `label` is **required** and becomes the accessible name |
| `Card` + `CardHeader/Title/Actions/Body/Footer` | Self-contained panel. `CardActions` right-aligns header icons; `SectionLabel` is the quiet kicker; `Hairline` the divider |
| `TintRow` | A list row carrying a subject's identity tint. `tone` is the subject's fixed slot |
| `MasteryBar` | **The one to read first.** Enforces evidence counts and withholds low-evidence numbers. `tone` switches the fill from the mastery ramp to a subject's hue |
| `Donut` | Part-to-whole across ordered bands, values in the legend, headline figure in the centre. Six segments maximum |
| `ScoreChart` | One measure over time, crosshair + tooltip, clamped smoothing that cannot overshoot the data. No legend — one series needs none. Draws its own axes when empty, so a bare card never reads as broken |
| `StudyBars` | Minutes per day. A separate chart from `ScoreChart` because minutes and percentages are different units; every day is drawn, zeros included, so a patchy week cannot look consistent |
| `StatTile` | One headline figure with its evidence. When the story is a single number, a chart is that number with extra steps |
| `StatusBadge` | The single job-status vocabulary. Icon + label, never colour alone |
| `QuotaMeter` | Used / limit / reset time, shown before a limit blocks anyone |
| `EmptyState` | Illustration slot, explanation, and exactly one action |
| `ErrorState` | `title` (what happened) + `nextStep` (what to do) — both required |
| `Skeleton` | Shaped like what it replaces, so nothing shifts on load |
| `Field` + `Input` `Textarea` `Select` | Label, hint, error scaffolding. 16 px text, 44 px controls |
| `SearchField` | The wide pill search in a page header. A real `<input type="search">`, not a button that opens a modal |
| `Chip` `ChipGroup` `Tag` | Chips replace dropdowns for small option sets. `size="sm"` is pointer-first chrome only; `md` is the 44 px touch target |
| `SourceChip` | A citation. Renders as a real link when given `href` |
| `Dialog` + `ConfirmDialog` | Sheet under 640 px, centred dialog above. `ConfirmDialog` requires a consequences line with counts |
| `Menu` | Overflow and account menus. Secondary actions only |
| `SegmentedNav` | Route links in a pill track, not a JS tab widget — each view stays linkable |
| `Avatar` / `UserPill` | Initials fallback with an optional identity tint; `UserPill` adds name + context |
| `Logo` / `AcadifyMark` / `AppMark` / `BrandLockup` | Brand marks |

### Shell

| Component | Notes |
|---|---|
| `AppShell` | Sidebar + top bar + content column, full-bleed. Pinned viewport with an internal scroll from 768 px; page scroll below it. Owns the sidebar's collapsed state and writes the cookie |
| `SideNav` | One nav, three widths — 240 px expanded, 72 px collapsed with tooltips, 272 px labelled drawer below 768 px. Collapse is a remembered preference, not a breakpoint |
| `PageHeader` | Eyebrow, display title, and the page's own controls. Also re-renders the shell's toolbar below `lg` |
| `FocusShell` | Quizzes and flashcards. No rail, no top bar, one deliberate exit, capped at 720 px at every width |
| `ThemeToggle` | System / light / dark, read straight off the DOM so there is no flash and no cascading render |

### Marketing hero objects

`src/features/marketing/components/` holds the objects scattered around the landing hero —
`StickyNote`, `CheckTile`, `MarkTile`, `PlanCard`, `ReminderCard`, `FormatsCard`, `Stopwatch`.
Two rules keep them from rotting:

- **They are built from real primitives.** `PlanCard` is `MasteryBar`, `ReminderCard` is
  `StatusBadge`, `FormatsCard` is `SourceChip`. A hero assembled from bespoke mock markup drifts
  away from the product within one sprint; this one breaks loudly instead.
- **Composition is separate from content.** `HeroObjects` renders plain blocks; `HeroDecor` places
  them. Below 1280 px the scattered layout is dropped entirely for `HeroStack` — a single card —
  because the composition needs horizontal room a laptop does not have, and shrinking it produces a
  mess rather than a smaller version.

The whole cluster is `aria-hidden`: every claim it makes is also made in real text on the page, so
announcing six decorative cards ahead of the headline would be hostile with nothing gained.

## 5. Standards

**Server by default.** A component gets `"use client"` only when it needs state, effects or browser
APIs. `AppShell`, `SideNav`, `Dialog`, `Menu`, `ThemeToggle`, `Donut` and `TrendChart` are client;
everything else renders on the server. `ErrorState` becomes client at the point a caller passes
`onRetry`.

**Every component takes `className` and merges it through `cn()`.** A caller can always override a
default without forking the component.

**Composition over configuration.** `Card` is five small parts rather than a dozen props. When a
component needs a fifth boolean, it wants splitting.

**Real links for anything navigable.** Cards and rows that lead somewhere are `<a>`/`<Link>`, so
ctrl-click and middle-click open a new tab. Never an `onClick` on a `div` that navigates.

**A page owns its top-bar control via the `@toolbar` parallel route**, not via a prop threaded down
through the layout. The layout must never have to know which page is underneath it.

**States are the component's job, not the caller's.** If a surface can be empty, loading, or failed,
the primitive covers it — see [`states.md`](states.md).

**Placeholder data says so on screen.** `NotBuiltYet` and `PanelEmpty` are how an unfinished
screen admits what it is. A designed dashboard full of invented figures that does not label them is
the fastest way for this product to lose the trust its whole pitch depends on.

**Accessibility is not a later pass.** Every interactive element is keyboard reachable with a visible
focus ring and an accessible name; every icon-only control carries both an `sr-only` label and a
visible tooltip; every status carries an icon and a label; `aria-valuetext` on `MasteryBar` reads the
evidence count, not just the percentage.

## 6. Deliberately not built yet

Named so nobody assumes they exist.

| Missing | Why, and when |
|---|---|
| **Toasts** | Nothing to announce yet — there are no mutations until Sprint 10. A toast system built before that would be guesswork. Lands with the first server action |
| **Data behind most dashboard panels** | The dashboard now reads the real database. Subjects appear; materials, quiz results, progress, planner events and plans stay empty until the features that write them land (Sprints 25, 52, 56, 60, 65). `PanelEmpty` says which of the two kinds of empty each panel is in |
| **Domain composites** (`EntityCard`, `QuizOption`, `Flashcard`, `UploadDropzone`) | Feature components. They belong to their features (Sprints 19+), not to `ui/` — promoting them early would fix decisions the features have not made yet |
| **Notifications and help** | The top-bar buttons exist as chrome with no destination. They stay inert until there is something to notify about |

## 7. Why not the shadcn/ui CLI

The specification names shadcn/ui, and this **is** its architecture: Radix primitives for behaviour,
`cva` for variants, `tailwind-merge` so callers can override. What we skip is the registry.

Pulling components from the registry brings its token vocabulary with them — `--background`,
`--foreground`, `--muted`, in oklch — and those would sit alongside the Acadify tokens rather than
replacing them. Two parallel colour systems in one stylesheet is how a design system rots: the next
person cannot tell which one is authoritative, and `bg-background` and `bg-surface` slowly diverge.

Authoring in-repo costs a little more up front and buys one vocabulary, no upgrade drift, and
components that already know product rules a generic registry cannot — that `MasteryBar` must
withhold a low-evidence number, that `ConfirmDialog` needs a consequences line with counts, that
`StatusBadge` uses one shared status vocabulary, that a subject's hue is fixed for its lifetime.

Radix is still a dependency wherever behaviour is genuinely hard: focus trapping, restore-on-close,
typeahead in menus. Reimplementing those by hand would be the actual mistake.

## 8. Proving it

Two smoke tests, both built entirely from these primitives:

- **`/`** — the landing page, whose hero is the real `Donut` and `MasteryBar`, not a screenshot.
- **`/dashboard`** — the full three-column grid, every panel, both charts, light and dark.

If a token or a primitive is wrong, one of those two pages shows it.

```bash
npm run dev     # http://localhost:3000
npm run check   # typecheck + lint + format
npm run build   # production build
```
