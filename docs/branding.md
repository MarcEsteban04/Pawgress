# Pawgress — Brand

**Direction "Daylight" is the Pawgress brand.** It replaces "Study Desk", which shipped in Sprint 05
and was superseded by a product-owner redesign against a reference dashboard. The reasoning behind
"Study Desk" and the two directions rejected alongside it is preserved in
[§7](#7-superseded-and-rejected) — none of them is to be revived without being asked.

The visual reference the direction was cut against is kept at
[`design/reference/reference.webp`](../design/reference/reference.webp). It is a *language*
reference — floating canvas, icon rail, pill controls, soft rounded cards, colour reserved for data.
Its content (a project-management dashboard) is not the model; Pawgress's own information
architecture is, unchanged from [`navigation.md`](navigation.md) and [`wireframes.md`](wireframes.md).

The values below are implemented as design tokens in [`src/app/globals.css`](../src/app/globals.css)
— that file is the runtime source of truth, this document is the reasoning behind it.

---

## 1. The idea

**A calm, bright workspace where the data is the only loud thing.**

The product's hardest emotional problem has not changed: it must tell a student something
unflattering — "Recursion 31%" — without that landing as a verdict. "Study Desk" solved it by making
the whole app quiet. "Daylight" solves it differently and, for a dashboard, better: the *chrome* goes
near-monochrome, and the entire saturated end of the palette is spent on data. A student's attention
lands on their own numbers rather than on the interface competing with them.

Three moves define the look:

1. **A floating canvas.** The app is one large rounded panel on a tinted gradient ground, not a
   full-bleed page. It reads as an instrument you are holding.
2. **Air over rules.** Panels are separated by whitespace and a low, wide shadow rather than by
   borders and dividers.
3. **Colour means something.** Chrome is ink, white and grey. A saturated hue on screen is always
   either a subject's identity or a mastery reading — never decoration.

**Voice:** plain, second person, no blame, no exclamation marks. Every recommendation states its
reason ("Weakest topic before Friday's exam"), because a plan a student cannot interrogate is just an
instruction to obey.

---

## 2. Colour

```text
Ground        page-1/2/3      #F6C99A #EEF1F6 #9DC0EA   the gradient behind the canvas

Surfaces      paper           #FBFBFD     the floating canvas
              surface         #FFFFFF     cards
              surface-sunken  #F3F4F8     wells, tracks, list rows, skeletons
              rule            #ECEDF2     hairlines
              rule-strong     #DCDEE6     hover borders

Ink           ink             #14161C     body text, headings, SOLID CONTROLS
              ink-muted       #656C7A     secondary text
              ink-subtle      #99A0AF     metadata, captions
              on-ink          #FFFFFF     text on an ink fill

Accent        accent          #7C3AED     brand moments, links, the logo pad
              accent-hover    #6D28D9
              accent-soft     #F3EEFF     tints, selection

Status        good            #047857     ready, mastered
              warn            #B45309     over quota, due soon, sample data
              bad             #BE123C     failed, wrong
              (each has a -soft companion for backgrounds)

Categorical   cat-1..5        #7C3AED #E11D48 #2563EB #0E9F6E #C2410C
              cat-*-soft      the pastel row tints for the same five slots

Mastery ramp  mastery-1..4    #8FB6F8 #5B93F3 #2E6FE0 #1A4AA8   weak -> strong
              mastery-none    #D8DBE3     no data yet
```

Five rules, all enforced in the token file and in the components that read it:

1. **Solid controls are ink, not the accent.** The primary button, the selected chip, the current nav
   item and the current tab are all the same near-black pill. The loudest thing on screen is never a
   button.
2. **Categorical hues carry identity, never magnitude.** A subject is assigned a slot and keeps it in
   every list, chart and chip it appears in. Filtering a list never repaints the survivors.
3. **Mastery is an ordered ramp, never a rainbow and never red.** `--mastery-*` is a single blue hue,
   light at weak and deep at strong. Red would turn information into a verdict.
4. **Status owns reserved steps** and is never reused as a data series, nor signalled by colour alone
   — every status pairs with an icon and a text label (`StatusBadge`).
5. **Both palettes are machine-checked, not eyeballed.** See
   [design-system.md §3](design-system.md) for the checks and how to re-run them.

### Dark mode

Implemented, not deferred — students study at night. Tokens are redefined three ways so both the
system preference and an explicit toggle work in both directions: bare `:root` for light,
`@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and
`:root[data-theme="dark"]`. Dark is a **selected** palette, not an inversion: the gradient becomes
deep plum-to-navy, the canvas `#101218`, cards `#171A21`, and every data hue is re-stepped and
re-validated against the dark surface rather than lightened by formula.

---

## 3. Type

| Role | Face | Weights | Used for |
|---|---|---|---|
| Display | **Outfit** | 500 / 600 | Page titles, card titles, hero figures, the wordmark |
| UI & body | **Inter** | 400–600 | Everything else |
| Numerals | *(Inter, tabular)* | — | Percentages, scores, counts |

Loaded through `next/font/google` in [`src/app/layout.tsx`](../src/app/layout.tsx), each with a
fallback stack. Rules:

- **16 px body minimum.** Smaller triggers iOS zoom-on-focus and is unreadable in daylight.
- **Numbers use `.tabular`, not a mono face.** "Daylight" carries no monospace: a third font in the
  chrome is noise, and Inter's tabular figures already stop a changing percentage from jittering. The
  `.tabular` class is `font-variant-numeric: tabular-nums`, so a number changes voice with nothing
  else on the page.
- **No serif on a hero figure.** A display serif on a number reads as decoration and undermines the
  claim that the figure is measured.
- Display face is for headings and figures only. It is not used below ~17 px.
- The ramp was checked against long compounds in English and Filipino, not lorem ipsum.

---

## 4. Logo, mascot, icons

**Logo** — paw mark beside the wordmark, set in Outfit semibold at −2% tracking. Toes take ink, the
pad takes the accent. [`src/components/shared/Logo.tsx`](../src/components/shared/Logo.tsx) exports
`Logo` (mark + wordmark), `PawMark` (mark alone) and `AppMark` (the mark on an ink tile, used at the
top of the icon rail — the only place the brand appears inside the authenticated shell).

**App icon and favicon** — [`src/app/icon.svg`](../src/app/icon.svg): the mark on an ink tile. At
favicon size the paw drops from four toes to three rather than shrinking all four; four toes at 16 px
turn to mud.

**Mascot** — an ink line-art cat, one stroke weight, no fill. It sits *beside* the work rather than
performing at you. Appears on: progress milestones, streaks (V1), and empty states. **Never** on an
error, a failed upload, or a failed generation.

**Icons** — Lucide, at **1.6 px stroke, round caps, 24 px grid**. Set once globally via the `.lucide`
rule in `globals.css`, because CSS overrides Lucide's `stroke-width` attribute — so no icon needs a
prop threaded through it.

---

## 5. Density

| Token | Value | Used for |
|---|---|---|
| `--radius-canvas` | 28 px | The app canvas, the landing hero frame |
| `--radius-card` | 20 px | Cards, dialogs, panels |
| `--radius-tile` | 16 px | List rows inside a card |
| `--radius-control` | 12 px | Inputs, selects, tooltips, skeletons |
| `--radius-pill` | full | Buttons, chips, nav items, avatars, bars |

| Token | Used for |
|---|---|
| `--shadow-canvas` | The floating panel — the only deep shadow in the system |
| `--shadow-card` | Cards. Low and wide; a card lifts, it does not pop |
| `--shadow-pill` | Solid controls, so an ink pill separates from an ink heading |
| `--shadow-pop` | Menus, dialogs, chart tooltips |

Controls are 44 px tall (`size="md"`) wherever touch is plausible. 36 px (`sm`) and the 32 px chip are
for pointer-first chrome only — the top-bar range switcher, a card-header toggle — never for something
a student is choosing on a phone.

---

## 6. Accessibility commitments

- WCAG 2.1 AA on body text in both themes.
- One focus treatment everywhere: a 2 px `--focus` outline at 2 px offset, always visible.
- Never colour alone (NFR-A3).
- **Every icon-only control has a real accessible name.** The nav rail is icon-only, which is only
  defensible because each item carries both an `sr-only` label and a visible hover/focus tooltip.
  A sixth destination would mean labels come back.
- `prefers-reduced-motion` collapses all transitions.
- Every mastery percentage carries its evidence count, and below 10 answered questions the number is
  withheld entirely — see [§8](#8-the-one-component-that-matters-most).

---

## 7. Superseded and rejected

Kept because the reasoning is worth more than the artwork.

**"Study Desk"** *(shipped Sprint 05–06, superseded)* — warm paper `#FAF6EF`, terracotta `#A8502F`,
Newsreader + Public Sans + IBM Plex Mono, 12 px radii. The calm-notebook idea was right about the
emotional problem and is carried forward into "Daylight" §1. It was superseded because it solved that
problem by making *everything* quiet, including the data: a warm, low-contrast, single-accent palette
has nowhere to put five subject identities and a mastery ramp, so a dense dashboard built in it turns
muddy. "Daylight" keeps the restraint and moves it into the chrome.

**"Trail"** — deep pine `#14452F` with an amber `#E8A33D` accent, Bricolage Grotesque, a geometric dog
and a paw-print progress trail. Most memorable of the original three and the easiest to grow into
streaks and achievements. Rejected because a bold brand makes 42% louder too, and it tips toward a
kids' app.

**"Lab"** — near-monochrome with indigo `#4A5AD8`, Space Grotesk, tabular numerals everywhere, a
reduced geometric owl. Most credible as a measurement tool and best suited to the college persona.
Rejected because it is the least comforting at 11pm before an exam, and indigo-on-white is the most
common look in this category.

---

## 8. The one component that matters most

`MasteryBar` ([`src/components/ui/MasteryBar.tsx`](../src/components/ui/MasteryBar.tsx)) is where the
brand either works or fails, so two rules are enforced in the component rather than left to callers:

1. A percentage is **always** shown with the number of questions it came from.
2. Below **10** answered questions the percentage is **withheld** — the bar renders as an
   indeterminate striped fill and the label says there is not enough data yet.

A confident-looking "100%" from three lucky answers is worse than no number at all. Thresholds live in
[`src/types/index.ts`](../src/types/index.ts) (`WEAK_TOPIC_THRESHOLD`, `LOW_EVIDENCE_QUESTIONS`) so
the number the UI shows and the number the engine uses cannot drift apart.
