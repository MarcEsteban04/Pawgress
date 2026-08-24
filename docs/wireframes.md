# Pawgress — UX Wireframes

**Sprint 04 deliverable.** Low-fidelity layouts for the MVP screens, phone-first, plus the
responsive plan and the layout primitives that Sprint 06 turns into components.

Companion documents: [`navigation.md`](navigation.md) (screen numbers, routes) ·
[`states.md`](states.md) (every state referenced here) · [`user-flows.md`](user-flows.md)

**Visual canvas:** the ten highest-value screens are also drawn as a pan/zoom canvas —
<https://claude.ai/code/artifact/19171cd3-7d1d-4a00-a354-e8733823649c>. Source artboards live in
[`design/wireframes/`](../design/wireframes/) so the canvas can be rebuilt. The canvas is for judging
proportion and rhythm; this document is the source of truth for structure.

---

## 1. How to read these

- Boxes are **44 characters wide ≈ a 360 px phone**. If it does not fit here, it does not fit on the
  cheapest phone a student owns.
- These are **low fidelity on purpose**: no colour, no type choices, no illustration. Brand lands in
  Sprint 05, components in Sprint 06. Deciding visual style now would mean redrawing it twice.
- `[ Label ]` = button · `▸` = tappable row · `▓` = filled progress · `░` = empty progress ·
  `…` = truncation · `(A)` = avatar
- Desktop variants are drawn only where the layout genuinely changes. A single-column screen that
  just gets wider is noted, not redrawn.
- Screen numbers match [`navigation.md` §3](navigation.md#3-screen-inventory).

**Scope:** MVP screens only — 1–4, 7–10, 12–23, 27. V1 screens (planner, plan, full dashboard,
conversations, profile, material viewer) are deliberately not wireframed until their phase, so they
are not stale before they are built.

---

## 2. Global layout

### Phone shell (< 768 px)

```text
┌────────────────────────────────────────────┐
│ ‹ Biology                            (A)   │  header 48px, sticky
├────────────────────────────────────────────┤
│                                            │
│                                            │
│                 content                    │  scrolls
│                                            │
│                                            │
├────────────────────────────────────────────┤
│  [ Primary action                       ]  │  sticky, thumb zone
├────────────────────────────────────────────┤
│   Home     Subjects     Ask     Progress   │  tabs 56px
└────────────────────────────────────────────┘
```

Rules:

- Header is **48 px and holds three things at most**: back or title, the screen name, the avatar.
  Every pixel of chrome is a pixel not spent on the material.
- The primary action is a **full-width sticky button**, not a floating circle. A labelled button is
  clearer, bigger, and reachable one-handed; a FAB is a mystery icon over content.
- Tab bar is always visible except in focus mode.
- Total chrome: 152 px of a ~640 px viewport. That is the budget — nothing else gets to be sticky.

### Desktop shell (≥ 1024 px)

```text
┌──────────┬──────────────────────────────────────────────────────────┐
│ Pawgress │ Subjects / Biology / Genetics                     (A)    │
│          ├──────────────────────────────────────────────────────────┤
│ ▸ Home   │                                                          │
│ ▸ Subj.  │                                                          │
│ ▸ Ask    │                     content, max 1200px                  │
│ ▸ Prog.  │                                                          │
│          │                                                          │
│ ──────── │                                                          │
│ ▸ Settings                                                          │
└──────────┴──────────────────────────────────────────────────────────┘
```

Sidebar 240 px, persistent, same order as the phone tabs. Breadcrumbs replace the back button.

---

## 3. Public & auth

### 1 — Landing `/`

One screenful that explains the loop. No feature grid, no testimonials, no pricing.

```text
┌────────────────────────────────────────────┐
│ Pawgress                    [ Sign in ]    │
├────────────────────────────────────────────┤
│                                            │
│         Don't just study more.             │
│         Study what matters.                │
│                                            │
│   Upload your schoolwork. Pawgress turns   │
│   it into reviewers, flashcards and        │
│   quizzes, then tells you what to study    │
│   next.                                    │
│                                            │
│   [ Get started — it's free           ]    │
│                                            │
│   ┌──────────────────────────────────────┐ │
│   │  Upload  →  Review  →  Quiz          │ │
│   │       ↘  Track  ↙                    │ │
│   │     "Genetics 42% — study this"      │ │
│   └──────────────────────────────────────┘ │
│                                            │
│   Works with PDF, PPTX, DOCX and your      │
│   own notes.                               │
│                                            │
└────────────────────────────────────────────┘
```

Notes: the loop diagram *is* the marketing. One CTA above the fold; the format line answers the only
real objection ("will it read my teacher's file?"). Desktop: same content, two columns, diagram right.

### 2 — Register `/register`

```text
┌────────────────────────────────────────────┐
│              Pawgress                      │
│                                            │
│         Create your account                │
│                                            │
│   Email                                    │
│   ┌──────────────────────────────────────┐ │
│   │                                      │ │
│   └──────────────────────────────────────┘ │
│                                            │
│   Password                            👁   │
│   ┌──────────────────────────────────────┐ │
│   │                                      │ │
│   └──────────────────────────────────────┘ │
│   ▓▓▓▓▓░░░░░  Add one more word            │
│                                            │
│   [ Create account                    ]    │
│                                            │
│   Already have an account? Sign in         │
│                                            │
└────────────────────────────────────────────┘
```

Notes: two fields, nothing else — name and year level are asked later, inside the app, where they are
actually used. Strength meter is a bar plus words, never colour alone. Show-password toggle, because
phone keyboards make typos and students will retype an invisible password three times and leave.

### 3 — Sign in `/login`

Same shell: email, password, `[ Sign in ]`, "Forgot password?" (V1), "Create one". A single generic
error above the form — never "wrong password" (US-A2).

### 4 — Verify email `/verify-email`

```text
┌────────────────────────────────────────────┐
│              Pawgress                      │
│                                            │
│          Check your email                  │
│                                            │
│   We sent a link to                        │
│   ana@example.com                          │
│                                            │
│   [ Resend link ]   (wait 42s)             │
│                                            │
│   Wrong address? Change it                 │
│                                            │
│   ──────────────────────────────────────   │
│   You can start using Pawgress now —       │
│   we'll keep reminding you.                │
│                                            │
│   [ Continue to Pawgress              ]    │
│                                            │
└────────────────────────────────────────────┘
```

Notes: **verification does not block the app.** The crammer with an exam in two days is not waiting on
an email. Resend has a visible cooldown so it cannot be hammered.

---

## 4. Home

### 7 — First-run dashboard `/dashboard` *(MVP)*

```text
┌────────────────────────────────────────────┐
│ Pawgress                             (A)   │
├────────────────────────────────────────────┤
│                                            │
│  Welcome to Pawgress 🐾                    │
│                                            │
│  Three steps to your first quiz:           │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ 1  Add a subject            ← you    │  │
│  │ 2  Upload a file or notes            │  │
│  │ 3  Generate a reviewer               │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  Verify your email to keep your    ✕ │  │
│  │  account. Resend link                │  │
│  └──────────────────────────────────────┘  │
│                                            │
├────────────────────────────────────────────┤
│  [ Add your first subject              ]   │
├────────────────────────────────────────────┤
│   Home     Subjects     Ask     Progress   │
└────────────────────────────────────────────┘
```

Notes: **no empty panels.** A skeleton "Next exam — none" and "Readiness — 0%" on day one teaches a
student the app is empty and useless. Three steps, one action, current step marked. The full dashboard
(next exam, readiness, today's plan) replaces this in V1 when there is data to put in it.

### 7 — Returning dashboard, MVP shape

```text
┌────────────────────────────────────────────┐
│ Good morning                         (A)   │
├────────────────────────────────────────────┤
│  Pick up where you left off                │
│  ┌──────────────────────────────────────┐  │
│  │ Biology · Genetics                   │  │
│  │ Flashcards — card 12 of 30           │  │
│  │ [ Continue ]                         │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Weakest right now                         │
│  ┌──────────────────────────────────────┐  │
│  │ Genetics       ▓▓▓▓░░░░░░  42%    ▸  │  │
│  │ Inheritance    ▓▓▓▓▓░░░░░  51%    ▸  │  │
│  │ Based on 24 questions                │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Still processing                          │
│  ┌──────────────────────────────────────┐  │
│  │ ⏱ Lecture 4.pdf — indexing…          │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Your subjects                             │
│  ┌────────────┐ ┌────────────┐             │
│  │ Biology    │ │ Math       │             │
│  │ 4 files    │ │ 2 files    │             │
│  └────────────┘ └────────────┘             │
├────────────────────────────────────────────┤
│   Home     Subjects     Ask     Progress   │
└────────────────────────────────────────────┘
```

Notes: the MVP home answers "what should I do today?" with the only two honest answers it has —
*resume what you started* and *your weakest topic*. Evidence count sits under the mastery bars so a
3-question 100% never reads as mastery. Each panel loads and fails independently (`catchError`).

---

## 5. Subjects

### 8 — Subjects `/subjects`

```text
┌────────────────────────────────────────────┐
│ Subjects                             (A)   │
├────────────────────────────────────────────┤
│ ┌────────────────────────────┐ ┌─────────┐ │
│ │ 🔍 Search                  │ │ Sort ▾  │ │
│ └────────────────────────────┘ └─────────┘ │
│                                            │
│ ┌──────────────────────────────────────┐   │
│ │ 🧬  Biology                          │   │
│ │     6 files · 3 topics               │   │
│ │     ▓▓▓▓▓▓░░░░  61%                  │   │
│ │     2 topics need work            ▸  │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ 📐  Mathematics                      │   │
│ │     2 files · no quizzes yet         │   │
│ │     Take a quiz to see progress   ▸  │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ 💻  Programming                      │   │
│ │     1 file · ⏱ 1 processing          │   │
│ │                                   ▸  │   │
│ └──────────────────────────────────────┘   │
├────────────────────────────────────────────┤
│  [ + New subject                       ]   │
├────────────────────────────────────────────┤
│   Home     Subjects     Ask     Progress   │
└────────────────────────────────────────────┘
```

Notes: one card per subject, full width — a 2-up grid at 360 px would truncate the one line that
matters ("2 topics need work"). Cards carry a **next-action hint**, not just stats. Desktop: 3-up grid,
search and sort inline in the header.

### Empty state

```text
│                                            │
│              ┌────────┐                    │
│              │  🐾    │                    │
│              └────────┘                    │
│         No subjects yet                    │
│                                            │
│   A subject is one class — Biology,        │
│   Math, whatever you are studying.         │
│   Your files and quizzes live inside it.   │
│                                            │
│   [ Add your first subject             ]   │
│                                            │
```

### New subject — dialog / bottom sheet

```text
┌────────────────────────────────────────────┐
│                                       ✕    │
│  New subject                               │
│                                            │
│  Name                                      │
│  ┌──────────────────────────────────────┐  │
│  │ Biology                              │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Icon                                      │
│  🧬  📐  💻  🌍  🧪  📖  🎨  🎵  ⚗️  +      │
│                                            │
│  Colour                                    │
│  ●  ●  ●  ●  ●  ●  ●  ●                    │
│                                            │
│  [ Create subject                      ]   │
└────────────────────────────────────────────┘
```

Notes: sheet from the bottom on phones, centred dialog on desktop. Icon and colour are pre-selected so
a student can create a subject with one field and one tap. Colour swatches carry a checkmark when
selected — never selection by colour alone.

### 9 — Subject overview `/subjects/:id`

```text
┌────────────────────────────────────────────┐
│ ‹ 🧬 Biology                      ⋯  (A)   │
├────────────────────────────────────────────┤
│ Materials │ Reviewers │ Quizzes │ Progress │
│ ═════════                                  │
├────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  │
│  │ Genetics is your weakest topic — 42% │  │
│  │ [ Review ]  [ Practise ]  [ Quiz ]   │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Topics                                    │
│  ( Cell structure )( Genetics )( + Add )   │
│                                            │
│  Materials                          4      │
│  ┌──────────────────────────────────────┐  │
│  │ 📄 Lecture 4.pdf                     │  │
│  │    Genetics · 18 pages · Ready    ▸  │  │
│  ├──────────────────────────────────────┤  │
│  │ 📄 Lecture 5.pdf                     │  │
│  │    ⏱ Indexing for search…            │  │
│  ├──────────────────────────────────────┤  │
│  │ 📊 Cell deck.pptx                    │  │
│  │    ⚠ No readable text — it's a scan  │  │
│  │    [ How to fix ]                    │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Recent                                    │
│  · Quiz — Genetics — 6/10 — yesterday      │
│  · Reviewer — Lecture 4 — 2 days ago       │
├────────────────────────────────────────────┤
│  [ + Upload material                   ]   │
├────────────────────────────────────────────┤
│   Home     Subjects     Ask     Progress   │
└────────────────────────────────────────────┘
```

Notes: the **weak-topic banner sits at the top** — this is the whole product in one card, so it gets
the best position. Tabs keep the hub from becoming an endless scroll. Material rows carry status
inline with the shared vocabulary from [`states.md` §3](states.md#3-job-status-vocabulary); a failed
file gets a fix action, not just an error.

Desktop: two columns — weak topic + materials left, topics + recent activity right.

### 12 — Topic detail `/subjects/:id/topics/:id`

Same shell as the subject hub, scoped to one topic: mastery bar with evidence count, materials tagged
here, reviewers, quiz history, and a sticky `[ Practise this topic ]`.

---

## 6. Materials

### 10 — Material library `/subjects/:id/materials`

```text
┌────────────────────────────────────────────┐
│ ‹ Materials                          (A)   │
├────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌─────────┐ ┌───────┐ │
│ │ 🔍 Search        │ │ Type ▾  │ │Sort ▾ │ │
│ └──────────────────┘ └─────────┘ └───────┘ │
│                                            │
│ ┌──────────────────────────────────────┐   │
│ │ 📄 Lecture 4.pdf                  ⋯  │   │
│ │    18 pages · 2.1 MB · Genetics      │   │
│ │    ✓ Ready                        ▸  │   │
│ ├──────────────────────────────────────┤   │
│ │ 📄 Lecture 5.pdf                  ⋯  │   │
│ │    24 pages · 3.4 MB                 │   │
│ │    ⏱ Indexing for search   ▓▓▓▓▓░░░  │   │
│ ├──────────────────────────────────────┤   │
│ │ 📝 My notes — mitosis             ⋯  │   │
│ │    Edited today · Cell structure     │   │
│ │    ✓ Ready                        ▸  │   │
│ ├──────────────────────────────────────┤   │
│ │ 📊 Cell deck.pptx                 ⋯  │   │
│ │    ⚠ Failed — no readable text       │   │
│ │    [ Retry ]  [ Why? ]               │   │
│ └──────────────────────────────────────┘   │
├────────────────────────────────────────────┤
│  [ + Upload ]        [ ✎ Write notes ]     │
└────────────────────────────────────────────┘
```

Notes: two primary actions here, because **typed notes are a first-class material** (FR-U5) and hiding
them behind an upload menu would kill the feature. `⋯` holds rename, retag, download, delete.

### Upload sheet + progress

```text
┌────────────────────────────────────────────┐
│                                       ✕    │
│  Upload to Biology                         │
│                                            │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│    Tap to choose files, or drop here       │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│  PDF, DOCX, PPTX · up to 25 MB each        │
│                                            │
│  Tag to a topic (optional)                 │
│  ┌──────────────────────────────────────┐  │
│  │ Genetics                          ▾  │  │
│  └──────────────────────────────────────┘  │
│  ──────────────────────────────────────    │
│  Lecture 5.pdf     ▓▓▓▓▓▓▓░░░  68%    ✕    │
│  Lecture 6.pdf     ✓ Uploaded              │
│  Huge.pdf          ⚠ 34 MB — limit is 25   │
│                                    [ Fix ] │
│                                            │
│  [ Done ]                                  │
└────────────────────────────────────────────┘
```

Notes: **limits are stated before the picker opens**, not after a failed upload. One file failing does
not fail the batch. Cancel per file. The sheet can be dismissed — uploads continue and status shows in
the library (US-C1).

---

## 7. Reviewers

### 13 — Reviewer list `/subjects/:id/reviewers`

Cards: title, source material, date, section counts (`24 cards · 12 questions`), and a
`[ + Generate reviewer ]` sticky action. When nothing is `ready`, the action is replaced — not just
disabled — by a row pointing at the processing material.

### 14 — Reviewer detail `/subjects/:id/reviewers/:id`

```text
┌────────────────────────────────────────────┐
│ ‹ Genetics reviewer               ⋯  (A)   │
├────────────────────────────────────────────┤
│ From Lecture 4.pdf · generated today       │
│ ✨ AI-generated — check anything important │
│                                            │
│  Summary                                   │
│  Genetics studies how traits pass from     │
│  parents to offspring. Mendel's work on    │
│  pea plants established dominant and       │
│  recessive inheritance…              p.2 ▸ │
│                                            │
│  Key concepts                          5   │
│  ▸ Dominant vs recessive           p.3     │
│  ▸ Genotype vs phenotype           p.4     │
│  ▸ Punnett squares                 p.6     │
│                                            │
│  Key terms                            12   │
│  ▸ Allele        one version of a gene     │
│  ▸ Homozygous    two identical alleles     │
│                                  Show all  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ 24 flashcards        [ Start ]       │  │
│  ├──────────────────────────────────────┤  │
│  │ 12 practice questions [ Start ]      │  │
│  └──────────────────────────────────────┘  │
├────────────────────────────────────────────┤
│  [ Quiz me on this                     ]   │
├────────────────────────────────────────────┤
│   Home     Subjects     Ask     Progress   │
└────────────────────────────────────────────┘
```

Notes: **page citations on every section** — the product principle made visible, and the fastest way a
student builds trust. The AI notice is stated once at the top, not repeated per section. The sticky
action is `Quiz me`, because the reviewer exists to lead into the loop, not to be read and closed.

Desktop: summary and concepts left, a sticky right rail with terms and the two session cards.

### 15 — Flashcards `.../flashcards`

```text
┌────────────────────────────────────────────┐
│ ✕                          12 / 30    ⏸    │
│ ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░               │
├────────────────────────────────────────────┤
│                                            │
│                                            │
│   ┌──────────────────────────────────────┐ │
│   │                                      │ │
│   │   What does homozygous mean?         │ │
│   │                                      │ │
│   │                                      │ │
│   │            Tap to flip               │ │
│   │                                p.4   │ │
│   └──────────────────────────────────────┘ │
│                                            │
│                                            │
├────────────────────────────────────────────┤
│  [ ✗ Still learning ]  [ ✓ I knew it ]     │
└────────────────────────────────────────────┘
```

Notes: focus mode — no tabs. The card owns the screen; the two verdict buttons own the thumb zone.
Buttons are only enabled after the flip, so a student cannot mark a card they have not seen. Exit
keeps progress; `⏸` is explicit about that. Page reference stays on the card so a doubtful answer can
be checked.

### Session complete

```text
│         Session complete 🐾                │
│   ┌──────────────────────────────────────┐ │
│   │  ✓ Knew it            22             │ │
│   │  ✗ Still learning      8             │ │
│   └──────────────────────────────────────┘ │
│   [ Redo the 8 I missed                ]   │
│   [ Quiz me on this topic              ]   │
│   Back to reviewer                         │
```

### 16 — Practice `.../practice`

One question per screen, options as full-width rows, `[ Check answer ]` → inline correct/incorrect
with explanation and page reference, then `[ Next ]`. A "Practice — not scored" chip in the header, so
students understand why it does not move their mastery.

---

## 8. Quizzes

### 17 / 18 — Quiz list and setup

```text
┌────────────────────────────────────────────┐
│ ‹ New quiz                           (A)   │
├────────────────────────────────────────────┤
│  Topic                                     │
│  ( All )( Cell structure )( Genetics )     │
│                                            │
│  Questions                                 │
│  ( 5 )( 10 )( 20 )                         │
│                                            │
│  Difficulty                                │
│  ( Easy )( Mixed )( Hard )                 │
│                                            │
│  Question types                            │
│  ☑ Multiple choice                         │
│  ☑ True / false                            │
│  ☑ Identification                          │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ From 2 ready materials · 18 pages    │  │
│  │ Uses 1 of your 20 daily generations  │  │
│  └──────────────────────────────────────┘  │
├────────────────────────────────────────────┤
│  [ Generate quiz                       ]   │
└────────────────────────────────────────────┘
```

Notes: **the quota cost is shown before the tap**, not after (NFR-C1). Chip groups instead of dropdowns
— three taps, no pickers. The source line prevents the "why is this quiz about the wrong chapter?"
complaint.

### 19 — Quiz attempt `/quizzes/:id/attempt` — focus mode

```text
┌────────────────────────────────────────────┐
│ ✕                     Question 3 of 10     │
│ ▓▓▓░░░░░░░                                 │
├────────────────────────────────────────────┤
│                                            │
│  Which describes a heterozygous            │
│  genotype?                                 │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  A   Two identical alleles           │  │
│  ├──────────────────────────────────────┤  │
│  │  B   Two different alleles        ●  │  │
│  ├──────────────────────────────────────┤  │
│  │  C   No alleles present              │  │
│  ├──────────────────────────────────────┤  │
│  │  D   Three or more alleles           │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ● ● ◉ ○ ○ ○ ○ ○ ○ ○                       │
├────────────────────────────────────────────┤
│  [ ‹ Back ]            [ Next ›        ]   │
└────────────────────────────────────────────┘
```

Notes: **no tabs, no sidebar, one exit.** Options are full-width rows — comfortably tappable on a
phone, and selection is shown by a filled marker *and* a border, never colour alone. The dot strip
doubles as a jump control and an answered/unanswered map. Answers save locally on every tap, so a
reload restores them (US-G2). Last question swaps `Next` for `[ Review answers ]`.

### Exit confirmation

```text
│  Leave this quiz?                          │
│  Your answers are saved — you can pick up  │
│  where you left off.                       │
│  [ Keep going ]        [ Leave ]           │
```

### 20 — Results `/quizzes/:id/attempts/:id`

```text
┌────────────────────────────────────────────┐
│ ‹ Results                            (A)   │
├────────────────────────────────────────────┤
│                                            │
│              7 / 10                        │
│            ▓▓▓▓▓▓▓░░░                      │
│      Better than your last try (6/10)      │
│                                            │
│  By topic                                  │
│  Cell structure  ▓▓▓▓▓▓▓▓░░  4/5           │
│  Genetics        ▓▓▓░░░░░░░  2/5     ▸     │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ Genetics is holding you back          │ │
│  │ [ Review ]  [ Practise ]  [ Retry ]  │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Your answers                              │
│  ┌──────────────────────────────────────┐  │
│  │ ✗ 3. Which describes a heterozygous… │  │
│  │   You said:    Two identical alleles │  │
│  │   Correct:     Two different alleles │  │
│  │   Heterozygous means the two alleles │  │
│  │   differ…                      p.4 ▸ │  │
│  │   [ Ask why I got this wrong ]        │ │
│  ├──────────────────────────────────────┤  │
│  │ ✓ 4. A homozygous genotype has…      │  │
│  └──────────────────────────────────────┘  │
├────────────────────────────────────────────┤
│  [ Study Genetics now                  ]   │
└────────────────────────────────────────────┘
```

Notes: the score is **not** the point — the next action is. Comparison to the last attempt gives
progress meaning. Wrong answers expand by default, correct ones collapse. "Ask why I got this wrong"
routes into the assistant with the question as context (F4), which is the highest-value link in the
whole app.

---

## 9. Progress

### 22 — Progress `/progress` · 21 — subject progress

```text
┌────────────────────────────────────────────┐
│ Progress                             (A)   │
├────────────────────────────────────────────┤
│  ( All time )( This week )                 │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ Overall            ▓▓▓▓▓▓░░░░  58%   │  │
│  │ 7 quizzes · 68 questions answered    │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Needs work                                │
│  ┌──────────────────────────────────────┐  │
│  │ Genetics · Biology                   │  │
│  │ ▓▓▓▓░░░░░░  42%   from 12 questions  │  │
│  │ [ Review ]  [ Practise ]  [ Quiz ]   │  │
│  ├──────────────────────────────────────┤  │
│  │ Inheritance · Biology                │  │
│  │ ▓▓▓▓▓░░░░░  51%   from 8 questions   │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  By subject                                │
│  🧬 Biology       ▓▓▓▓▓▓░░░░  61%    ▸     │
│  📐 Mathematics   not enough data    ▸     │
│  💻 Programming   ▓▓▓▓▓▓▓▓░░  78%    ▸     │
│                                            │
│  ⓘ How mastery is calculated               │
├────────────────────────────────────────────┤
│   Home     Subjects     Ask     Progress   │
└────────────────────────────────────────────┘
```

Notes: **every bar carries its evidence count**, and a subject with too little data says so instead of
showing a number (US-H1). "Needs work" is above "By subject" — the weakness list is the reason to open
this screen. The mastery explainer is a link, satisfying "documented formula" without a wall of text.

---

## 10. Assistant

### 23 — Assistant `/assistant`

```text
┌────────────────────────────────────────────┐
│ ‹ Ask                                (A)   │
├────────────────────────────────────────────┤
│  Asking about: ( Biology ▾ )               │
├────────────────────────────────────────────┤
│                                            │
│                    ┌─────────────────────┐ │
│                    │ Explain Punnett     │ │
│                    │ squares simply      │ │
│                    └─────────────────────┘ │
│                                            │
│  ┌───────────────────────────────────┐     │
│  │ A Punnett square is a grid for    │     │
│  │ working out what offspring you    │     │
│  │ could get from two parents…       │     │
│  │                                   │     │
│  │ 📄 Lecture 4.pdf p.6  📄 p.7      │     │
│  │ 👍 👎                             │     │
│  └───────────────────────────────────┘     │
│                                            │
│  ┌───────────────────────────────────┐     │
│  │ ⚠ Your materials don't cover      │     │
│  │ mitochondrial inheritance.        │     │
│  │ [ Answer without my materials ]   │     │
│  └───────────────────────────────────┘     │
│                                            │
├────────────────────────────────────────────┤
│ ┌────────────────────────────────┐ ┌─────┐ │
│ │ Ask about Biology…             │ │  ➤  │ │
│ └────────────────────────────────┘ └─────┘ │
│ 14 of 20 messages left today               │
└────────────────────────────────────────────┘
```

Notes: **scope selector is pinned to the top** — a student must always know what "my materials" means
right now. Source chips are tappable and open the material. The no-context case is a distinct card
with an explicit opt-in, so a general-knowledge answer can never be mistaken for a grounded one
(US-E2). Quota remaining sits under the composer, where it prevents surprise.

Empty state: three suggested questions generated from the subject's actual topics — never a generic
"How can I help?".

Desktop ≥ 1024 px: assistant becomes a right-hand panel beside a material or reviewer, so a student
can read and ask at once. Same components, different container.

---

## 11. Settings

### 27 — Settings `/settings`

```text
┌────────────────────────────────────────────┐
│ ‹ Settings                                 │
├────────────────────────────────────────────┤
│  (A)  ana@example.com                      │
│       ✓ Verified                           │
│                                            │
│  Today's usage                             │
│  ┌──────────────────────────────────────┐  │
│  │ AI generations   ▓▓▓▓░░░░░░  6 / 20  │  │
│  │ Assistant        ▓▓▓░░░░░░░  6 / 20  │  │
│  │ Storage          ▓▓░░░░░░░░  48 MB   │  │
│  │ Resets at midnight                   │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ▸ Appearance              System ▾        │
│  ▸ Profile                       (V1)      │
│  ▸ Delete account                (V1)      │
│                                            │
│  [ Sign out ]                              │
│                                            │
│  Pawgress v0.1 · Terms · Privacy           │
└────────────────────────────────────────────┘
```

Notes: usage is on the **first** settings screen. If a student can be stopped by a quota, they must be
able to see it coming without hunting (NFR-C1).

---

## 12. Mobile considerations

The primary target, not an adaptation.

| Concern | Decision |
|---|---|
| **Thumb zone** | Every primary action within the bottom third. Destructive actions deliberately out of it |
| **Touch targets** | ≥ 44 × 44 px, ≥ 8 px apart. Quiz options are full-width rows, not radio dots |
| **Chrome budget** | 48 px header + 56 px tabs + 56 px action = 152 px. Nothing else may be sticky |
| **Keyboard** | The assistant composer and note editor sit above the keyboard; the focused field is never covered. No sticky footer competing with the keyboard |
| **One-handed quiz** | Options, navigation, and progress all reachable with one thumb — quizzes get taken on buses |
| **Data cost** | No autoplay, no decorative imagery, lazy-loaded material previews. Students are on metered data |
| **Interruption** | Every long action survives backgrounding. Quiz answers and flashcard progress persist locally on each interaction |
| **Cheap screens** | WCAG AA minimum, tested at low brightness. Never colour alone (NFR-A3) |
| **Small text** | 16 px body minimum — anything smaller triggers iOS zoom-on-focus and is unreadable in daylight |
| **Long file names** | Middle-truncate: `Lecture 4 — Genet….pdf`, with the full name available on the detail screen |
| **Offline** | Persistent banner; reads served from cache where possible, writes blocked with a clear reason rather than silently dropped |

---

## 13. Responsive layout plan

| Breakpoint | Shell | Grid | Notable changes |
|---|---|---|---|
| **360–599 px** *(primary)* | Bottom tabs, sticky action | 1 column, 16 px gutters | Sheets for filters and upload. Tables become cards. Subject hub tabs scroll horizontally |
| **600–767 px** | Bottom tabs | 1 column, 24 px gutters, max 640 px | Subject cards 2-up. Larger type scale |
| **768–1023 px** | Icon-rail sidebar 72 px | 2 columns | Dialogs replace sheets. Subject hub becomes 2-column. Breadcrumbs appear |
| **1024–1439 px** | Full sidebar 240 px | 2–3 columns, max 1200 px | Assistant available as a right panel. Reviewer gets a sticky right rail. Progress tables render as tables |
| **1440 px+** | Full sidebar | Content stays 1200 px, centred | No new layout — extra width becomes margin, not longer lines |

Cross-breakpoint rules:

1. **Phone layout is authored first.** Every screen is designed at 360 px and widened, never narrowed.
2. **Content width caps at 1200 px.** Reading lines stay 60–75 characters; a 4K monitor does not get 300-character paragraphs.
3. **Focus mode ignores breakpoints.** The quiz attempt is centred, max 720 px, no shell at any width — an exam-like screen should feel the same everywhere.
4. **One component per screen, not two.** Responsive containers, not a mobile and a desktop implementation. Divergent implementations drift.
5. **Tabs → sidebar is the only navigation swap.** Same destinations, same order, so muscle memory transfers.
6. **Test at 360, 768, and 1280 px.** Those three catch essentially everything.

---

## 14. Layout primitives for Sprint 06

What the wireframes above actually need built. This is the shopping list for the design system.

| Primitive | Used by | Notes |
|---|---|---|
| `AppShell` | every app screen | Header + tabs/sidebar + sticky action slot |
| `FocusShell` | flashcards, quiz attempt | Progress + single exit, no nav |
| `PageHeader` | all | Back or title, actions, avatar |
| `StickyAction` | most | Full-width primary action, safe-area aware |
| `EntityCard` | subjects, reviewers, quizzes | Icon, title, meta, progress, next-action hint |
| `ListRow` | materials, terms, answers | Icon, two-line text, status, `⋯` menu, chevron |
| `StatusBadge` | materials, generations | Drives the [job-status vocabulary](states.md#3-job-status-vocabulary) — icon + label |
| `MasteryBar` | progress, subjects, results | Bar + percentage + **evidence count**; low-evidence variant |
| `ChipGroup` | quiz setup, filters, topics | Single and multi select, horizontally scrollable |
| `SourceChip` | assistant, reviewer, results | Material + page, tappable |
| `QuizOption` | quiz, practice | Full-width, selected / correct / incorrect states |
| `Flashcard` | flashcards | Flip, front/back, page reference |
| `EmptyState` | everywhere | Illustration slot, explanation, exactly one action |
| `ErrorState` | everywhere | Cause, next step, retry |
| `UploadDropzone` | upload sheet | Limits stated, per-file progress rows |
| `QuotaMeter` | settings, quiz setup, assistant | Used / limit / reset time |
| `Sheet` / `Dialog` | create, filter, confirm | Same content, sheet under 768 px |
| `ConfirmDialog` | deletes | Counts of what disappears |

---

## 15. What Sprint 05 and 06 must decide

Deliberately left open here — these are brand and system decisions, not layout ones.

1. **Mascot role.** Celebration and empty states only, per [`states.md` §5](states.md#5-copy-rules). Where exactly it appears, and how often, is Sprint 05.
2. **Type scale and font.** Must survive 16 px body on a 360 px screen with long Filipino and English words.
3. **Colour system.** Subject colours must be distinguishable from status colours, or a red subject reads as a failed one.
4. **Mastery bar palette.** Needs to read at a glance without implying pass/fail — students are sensitive about this, and colour alone is out (NFR-A3).
5. **Icon set.** One family, including the file-type and status icons used throughout these wireframes.
6. **Dark mode.** Students study at night. It is a Sprint 06 token decision, not a retrofit.
