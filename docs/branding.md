# Pawgress — Branding

**Sprint 05 deliverable.** Three brand directions, the constraints they were designed against, and
the values Sprint 06 turns into design tokens.

**Visual canvas:** <https://claude.ai/code/artifact/ae93e67f-b9f2-4686-97c1-0133ea6148bd> ·
source artboards in [`design/brand/`](../design/brand/)

> **Status: awaiting a decision.** Sprint 05 is not closed until one direction is chosen. Brand
> identity is a taste call, and three near-identical options would be no choice at all — so these
> differ on a real axis rather than on decoration. Once a direction is picked, this document is
> rewritten as the single brand spec and the losing directions move to an appendix.

---

## 1. The constraints

Not preferences — these come out of the product, and every direction had to satisfy all six.

| # | Constraint | Where it comes from |
|---|---|---|
| 1 | **A low number must not feel like a verdict.** A student will see "Genetics 42%" | The mastery model in [`requirements.md`](requirements.md) FR-G1 makes this unavoidable, and it is the hardest thing here to get right |
| 2 | **Subject colour must never read as status colour.** A red subject would look like a failed one | Flagged in [`wireframes.md` §15](wireframes.md) |
| 3 | **Legible on a cheap phone at low brightness.** WCAG AA body text, 16 px floor, never colour alone | NFR-A1, NFR-A3 |
| 4 | **Two registers, one voice** — trustworthy on a laptop, warm at 11pm before an exam | The personas in [`requirements.md` §2](requirements.md) |
| 5 | **The mascot celebrates; it never apologises.** Progress, streaks, empty states only — absent from every error | [`states.md` §5](states.md#5-copy-rules) |
| 6 | **Type survives long words in two languages.** English and Filipino, tested on real compounds | PRD open decision #6 |

### Constraint 2, resolved the same way in all three

Subject colours are a **muted, low-chroma family** and carry no meaning; status colours keep the
saturated end of the palette to themselves. A subject is never allowed to borrow a status colour, and
status is always paired with an icon and a label.

---

## 2. The directions

They answer one question differently — *what is "42%"?*

| | **A — Study Desk** | **B — Trail** | **C — Lab** |
|---|---|---|---|
| 42% is… | information | momentum | a measurement |
| Feeling | calm, editorial, paper | energetic, motivating | precise, instrumented |
| Mascot | ink line-art cat, sits beside the work | flat geometric dog with a paw trail | geometric owl, closer to a mark than a character |
| Logo logic | paw mark beside a serif wordmark | paw in a filled badge + heavy wordmark | monogram tile + letter-spaced wordmark |
| Display face | Newsreader 500 | Bricolage Grotesque 800 | Space Grotesk 600 |
| UI / body | Public Sans | Figtree | Space Grotesk |
| Numerals | IBM Plex Mono | the display face | IBM Plex Mono, tabular |
| Icon style | 1.7 px stroke, round caps | 2.2 px stroke, round caps | 1.5 px stroke, square caps |
| Radius | 8–12 px | 16–20 px, pill buttons | 5–6 px |
| Risk | may feel unexciting | may feel like a kids' app | may feel like another gradebook |

### A — Study Desk *(recommended)*

```text
paper      #FAF6EF      surface    #FFFDF9      rule    #E3DCD0
muted ink  #5C554B      ink        #23201C
accent     #A8502F      good       #5E7A5A      warn    #B4741B    bad  #8C3A2B
subjects   #CFD9DD  #DED6C6  #D2DCCD  #DECFD5  #CFD1DE  #E0D9C2
```

**Why:** every AI study app looks like a bright purple SaaS dashboard; this looks like a good
notebook, which is what students already trust. The warmth does real work — it lets the app tell you
something unflattering without it stinging (constraint 1, the one that matters most).

**Trade-off:** quiet by design, so it will not pop in a screenshot, and it gives up the momentum that
streaks and celebrations trade on. A serif display needs care at 13 px and below.

### B — Trail

```text
surface    #F3F7F4      card       #FFFFFF      rule    #D8E3DB
muted ink  #3E5449      primary    #14452F
accent     #E8A33D      good       #2F8F6B      warn    #C87A1E    bad  #A8382B
subjects   #CCDFD4  #E5DAC3  #CFDCE5  #E2D3D8  #D6D5E4  #DDE4C8
```

**Why:** momentum is what students actually lack, and this is built to supply it — the paw trail is
the progress metaphor, and there is room to grow into streaks and achievements later. Most memorable
of the three.

**Trade-off:** energy cuts both ways — a bold brand makes 42% louder too, and it can tip toward a
kids' app.

### C — Lab

```text
surface    #FBFBFC      card       #FFFFFF      rule    #E4E6EC
muted ink  #4A5160      ink        #14161A
accent     #4A5AD8      good       #1F7A5A      warn    #9A6A10    bad  #A02F2F
subjects   #C9CEE8  #D2D6EC  #C6D2E4  #CEDAE2  #D6D2E4  #DADEE8
```

**Why:** the product's real claim is that it *measures* what you know, and this makes that claim
credible — tabular numerals, sample sizes, trends beside every figure. Ages best as the data features
land; suits the college persona most.

**Trade-off:** coolest of the three and least comforting before an exam; indigo-on-white is also the
most common look in this category.

---

## 3. What a decision locks

Picking a direction settles, in one go:

- **Logo** and its small-size reduction, plus the app icon at 64 / 32 px and the favicon at 16 px
  (all three drop detail deliberately at 16 px rather than shrinking the full mark)
- **Mascot direction** — species, drawing style, and the rule that it never appears on a failure
- **Type ramp** — display, UI, and numeral faces, all from Google Fonts with fallback stacks
- **Palette** — surface, ink, rule, one accent, three status colours, six subject tints
- **Icon style** — stroke weight, cap style, 24 px grid
- **Radius and density**, which is most of what makes the three feel different in the UI

Then Sprint 06 turns it into `--tokens` in `app/globals.css`, a Tailwind theme, and the shadcn/ui
component set, against the primitive list in [`wireframes.md` §14](wireframes.md).

## 4. Deliberately still open

- **Dark mode.** A token-level decision in Sprint 06, not a retrofit. All three palettes were chosen
  with a dark counterpart in mind, but none is drawn yet.
- **Mascot beyond one pose.** One pose proves the style; the set (celebrating, empty state, thinking)
  is only worth drawing once a direction is chosen.
- **Illustration style** for empty states, beyond the mascot itself.
- **Motion.** One considered reveal beats scattered micro-interactions; specified in Sprint 06.
