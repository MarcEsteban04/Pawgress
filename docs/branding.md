# Pawgress — Brand

**Sprint 05 deliverable — decided.** Direction **"Study Desk"** is the Pawgress brand. The two
alternatives considered are recorded in [§7](#7-considered-and-rejected) so the reasoning survives,
but they are closed.

The values below are implemented as design tokens in [`src/app/globals.css`](../src/app/globals.css)
— that file is the runtime source of truth, this document is the reasoning behind it.

---

## 1. The idea

**The calm of a good notebook.** Warm paper, ink text, one restrained accent.

The product's hardest emotional problem is that it must tell a student something unflattering —
"Genetics 42%" — without that landing as a verdict. A quiet, papery brand makes a low number read as
*something to do next*. A bright or clinical brand makes the same number read as a grade.

Everything else follows from that.

**Voice:** plain, second person, no blame, no exclamation marks. The mascot celebrates progress; it
never apologises for a bug.

---

## 2. Colour

```text
Surfaces      paper           #FAF6EF     the page
              surface         #FFFDF9     cards, raised things
              surface-sunken  #F4EFE6     wells, tracks, skeletons
              rule            #E3DCD0     hairlines and borders
              rule-strong     #D3C9B8     hover borders

Ink           ink             #23201C     body text, headings
              ink-muted       #5C554B     secondary text
              ink-subtle      #8C8478     metadata, captions

Accent        accent          #A8502F     the one brand colour
              accent-hover    #8D4026
              accent-soft     #F3E4DC     tints, selection, icon wells

Status        good            #5E7A5A     ready, mastered
              warn            #B4741B     over quota, due soon
              bad             #8C3A2B     failed, wrong
              (each has a -soft companion for backgrounds)

Subjects      #CFD9DD  #DED6C6  #D2DCCD  #DECFD5  #CFD1DE  #E0D9C2
```

Three rules, all enforced in the token file:

1. **Subject colours are deliberately quiet and carry no meaning.** Status owns the saturated end of
   the palette. A subject must never be mistakable for a failed one.
2. **Status is never signalled by colour alone.** Every status pairs with an icon and a text label —
   see `StatusBadge`.
3. **The mastery bar is not red at low values.** It uses the accent below the weak threshold and
   `good` above it. Red would turn information into a verdict.

### Dark mode

Implemented, not deferred — students study at night. Tokens are redefined three ways so both the
system preference and an explicit toggle work in both directions: bare `:root` for light,
`@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and
`:root[data-theme="dark"]`. Paper becomes `#1A1815`, ink becomes `#F2ECE2`, and the accent lifts to
`#D9764F` to hold contrast against a dark ground.

---

## 3. Type

| Role | Face | Weights | Used for |
|---|---|---|---|
| Display | **Newsreader** | 400 / 500 / 600 | Page titles, hero, empty-state headings |
| UI & body | **Public Sans** | 400 / 500 / 600 / 700 | Everything else |
| Numerals | **IBM Plex Mono** | 400 / 500 | Percentages, scores, counts, metadata |

Loaded through `next/font/google` in [`src/app/layout.tsx`](../src/app/layout.tsx), each with a
fallback stack. Rules:

- **16 px body minimum.** Smaller triggers iOS zoom-on-focus and is unreadable in daylight.
- **Every number is mono and tabular** (`.tabular`, or `font-mono`). Percentages update in place;
  proportional digits make them jitter.
- Display face is for headings only. It is not used below ~18 px.
- The ramp was checked against long compounds in English and Filipino, not lorem ipsum.

---

## 4. Logo, mascot, icons

**Logo** — paw mark beside the wordmark, set in the display face. Toes take ink, the pad takes the
accent. [`src/components/shared/Logo.tsx`](../src/components/shared/Logo.tsx) exports `Logo` (mark +
wordmark) and `PawMark` (mark alone).

**App icon and favicon** — [`src/app/icon.svg`](../src/app/icon.svg): the mark on an ink tile. At
favicon size the paw drops from four toes to three rather than shrinking all four; four toes at 16 px
turn to mud.

**Mascot** — an ink line-art cat, one stroke weight, no fill. It sits *beside* the work rather than
performing at you. Appears on: progress milestones, streaks (V1), and empty states. **Never** on an
error, a failed upload, or a failed generation.

**Icons** — Lucide, at **1.7 px stroke, round caps, 24 px grid**. Set once globally via the `.lucide`
rule in `globals.css`, because CSS overrides Lucide's `stroke-width` attribute — so no icon needs a
prop threaded through it.

---

## 5. Density

| Token | Value | Used for |
|---|---|---|
| `--radius-card` | 12 px | Cards, dialogs, panels |
| `--radius-control` | 8 px | Buttons, inputs, chips-as-tags |
| `--radius-pill` | full | Chips, avatars, mastery bars |

Controls are 44 px tall (`size="md"`) wherever touch is plausible; 36 px (`sm`) is for dense rows on
pointer-first surfaces only.

---

## 6. Accessibility commitments

- WCAG 2.1 AA on body text in both themes.
- One focus treatment everywhere: a 2 px `--focus` outline at 2 px offset, always visible.
- Never colour alone (NFR-A3).
- `prefers-reduced-motion` collapses all transitions.
- Every mastery percentage carries its evidence count, and below 10 answered questions the number is
  withheld entirely — see [§8](#8-the-one-component-that-matters-most).

---

## 7. Considered and rejected

Kept because the reasoning is worth more than the artwork.

**"Trail"** — deep pine `#14452F` with an amber `#E8A33D` accent, Bricolage Grotesque, a geometric
dog and a paw-print progress trail. Most memorable of the three and the easiest to grow into streaks
and achievements. Rejected because a bold brand makes 42% louder too, and it tips toward a kids' app.

**"Lab"** — near-monochrome with indigo `#4A5AD8`, Space Grotesk, tabular numerals everywhere, a
reduced geometric owl. Most credible as a measurement tool and best suited to the college persona.
Rejected because it is the least comforting at 11pm before an exam, and indigo-on-white is the most
common look in this category.

Neither is to be revived without being asked.

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
