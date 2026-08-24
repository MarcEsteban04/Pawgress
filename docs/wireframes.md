# Pawgress — UX Wireframes

**Sprint 04 deliverable.** Low-fidelity layouts for the MVP screens of the Pawgress **web app** —
desktop-led, adapted down to a phone browser — plus the responsive plan and the layout primitives
that Sprint 06 turns into components.

Companion documents: [`navigation.md`](navigation.md) (screen numbers, routes) ·
[`states.md`](states.md) (every state referenced here) · [`user-flows.md`](user-flows.md)

**Visual canvas:** the ten highest-value screens are also drawn as a pan/zoom canvas —
<https://claude.ai/code/artifact/19171cd3-7d1d-4a00-a354-e8733823649c>. Source artboards live in
[`design/wireframes/`](../design/wireframes/) so the canvas can be rebuilt. The canvas is for judging
proportion and rhythm; this document is the source of truth for structure.

---

## 1. How to read these

Pawgress is a **responsive web app**: one website, from a 1920 px monitor down to a 360 px phone
browser. It is not a mobile app and it does not imitate one — no bottom tab bar, no fake native
chrome. See [`navigation.md` §1](navigation.md#1-navigation-model).

- **Desktop is the primary design target**, drawn at 1280 px. That is where a student uploads,
  reads, and reviews.
- **Narrow-viewport layouts are drawn at 360 px** and are a first-class adaptation, not a leftover —
  flashcards and quizzes get done on a phone browser between classes. Same components, one
  implementation, different container.
- Wide boxes (≈ 88 characters) are desktop; narrow boxes (44 characters) are the 360 px viewport.
- These are **low fidelity on purpose**: no colour, no type choices, no illustration. Brand lands in
  Sprint 05, components in Sprint 06. Deciding visual style now would mean redrawing it twice.
- `[ Label ]` = button · `▸` = link row · `▓` = filled progress · `░` = empty progress ·
  `…` = truncation · `(A)` = avatar · `■` = current nav item
- A screen is drawn at both widths only where the layout genuinely changes. A single-column screen
  that just gets wider is noted, not redrawn.
- Screen numbers match [`navigation.md` §3](navigation.md#3-screen-inventory).

**Scope:** MVP screens only — 1–4, 7–10, 12–23, 27. V1 screens (planner, plan, full dashboard,
conversations, profile, material viewer) are deliberately not wireframed until their phase, so they
are not stale before they are built.

---

## 2. Global layout

### Desktop shell (≥ 1024 px) — the primary layout

```text
┌────────────┬────────────────────────────────────────────────────────────────────┐
│  Pawgress  │  Subjects / Biology / Genetics    🔍 Search        (A) Ana ▾       │
│            ├────────────────────────────────────────────────────────────────────┤
│  ▸ Home    │                                                                    │
│  ▸ Subjects│                                                                    │
│  ▸ Ask     │                     content, max 1200px, centred                   │
│  ▸ Progress│                                                                    │
│            │                                                                    │
│  ────────  │                                                                    │
│  ▸ Settings│                                                                    │
│            │                                                                    │
│  AI today  │                                                                    │
│  ▓▓▓░░ 6/20│                                                                    │
└────────────┴────────────────────────────────────────────────────────────────────┘
```

Rules:

- **Sidebar 240 px, persistent.** Navigation on a website is always visible; it does not hide behind
  a button on a screen with room for it.
- **Top bar carries breadcrumbs, global search, and the account menu.** Search is a top-level
  affordance because a student with six subjects and thirty files needs it more than another button.
- **Content caps at 1200 px and centres.** A 4K monitor gets margin, not 300-character lines.
- **Quota lives in the sidebar footer.** If a limit can stop a student, they should see it coming
  without opening settings.
- Every nav item and card is a real `<a href>`, so ctrl-click opens a subject in a new tab.

### Narrow viewport (< 768 px)

```text
┌────────────────────────────────────────────┐
│ ☰   Biology                    🔍    (A)   │  top bar 52px, sticky
├────────────────────────────────────────────┤
│                                            │
│                                            │
│                 content                    │  scrolls
│                                            │
│                                            │
│  [ Primary action                       ]  │  in the content column
│                                            │
└────────────────────────────────────────────┘
```

Rules:

- **The sidebar becomes a drawer** behind `☰` — the conventional web pattern. One nav, two
  containers, one implementation.
- **No bottom tab bar.** Bottom tabs are native-app chrome; on a website they read as an imitation
  app and they fight the browser's own bottom bar and the on-screen keyboard.
- The drawer costs one tap, so it is paid back by keeping **every screen's primary action in the
  content column**, within thumb reach. Common actions never require opening the nav.
- Chrome is 52 px of a ~640 px viewport. Nothing else is sticky.

### Focus shell (quiz, flashcards — every width)

No sidebar, no top bar. Centred, capped at 720 px, progress plus one deliberate exit. An exam-like
screen should feel identical on a laptop and a phone.

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
│ ☰  Pawgress                    🔍    (A)   │
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
└────────────────────────────────────────────┘
```

Notes: **no empty panels.** A skeleton "Next exam — none" and "Readiness — 0%" on day one teaches a
student the app is empty and useless. Three steps, one action, current step marked. The full dashboard
(next exam, readiness, today's plan) replaces this in V1 when there is data to put in it.

### 7 — Returning dashboard, MVP shape

```text
┌────────────────────────────────────────────┐
│ ☰  Home                        🔍    (A)   │
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
└────────────────────────────────────────────┘
```

### 7 — Returning dashboard, desktop

```text
┌────────────┬────────────────────────────────────────────────────────────────────┐
│  Pawgress  │  Home                             🔍 Search       (A) Ana ▾       │
│            ├────────────────────────────────────────────────────────────────────┤
│  ▸ Home  ■ │  Good morning, Ana                                                 │
│  ▸ Subjects│                                                                    │
│  ▸ Ask     │  ┌────────────────────────────────┐  ┌───────────────────────────┐ │
│  ▸ Progress│  │ Pick up where you left off     │  │ Needs work                │ │
│            │  │ Biology · Genetics             │  │ Genetics    ▓▓▓▓░░░░  42% │ │
│  ────────  │  │ Flashcards — card 12 of 30     │  │ from 12 questions         │ │
│  ▸ Settings│  │ [ Continue ]                   │  │ Inheritance ▓▓▓▓▓░░░  51% │ │
│            │  └────────────────────────────────┘  │ from 8 questions          │ │
│  AI today  │                                      │ [ Review ] [ Practise ]   │ │
│  ▓▓▓░░ 6/20│  ┌────────────────────────────────┐  └───────────────────────────┘ │
│            │  │ Still processing               │                                │
│            │  │ ⏱ Lecture 5.pdf — indexing…    │  ┌───────────────────────────┐ │
│            │  └────────────────────────────────┘  │ Your subjects             │ │
│            │                                      │ 🧬 Biology     6 files  ▸ │ │
│            │  ┌────────────────────────────────┐  │ 📐 Mathematics 2 files  ▸ │ │
│            │  │ Recent activity                │  │ 💻 Programming 1 file   ▸ │ │
│            │  │ Quiz · Genetics · 6/10 · Tue   │  │ [ + New subject ]         │ │
│            │  │ Reviewer · Lecture 4 · Mon      │ └───────────────────────────┘ │
│            │  └────────────────────────────────┘                                │
└────────────┴────────────────────────────────────────────────────────────────────┘
```

Notes: the MVP home answers "what should I do today?" with the only two honest answers it has —
*resume what you started* and *your weakest topic*. Evidence count sits under the mastery bars so a
3-question 100% never reads as mastery. Each panel loads and fails independently (`catchError`), which
is why the desktop layout is a two-column grid of independent cards rather than one composed view — a
slow readiness query must not blank the page.

The width buys **more panels visible at once**, not bigger panels. On a narrow viewport the same cards
stack in the same order: resume, weak topics, processing, subjects, recent.

---

## 5. Subjects

### 8 — Subjects `/subjects`

```text
┌────────────────────────────────────────────┐
│ ☰  Subjects                    🔍    (A)   │
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
│ ‹  🧬 Biology                     ⋯  (A)   │
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
└────────────────────────────────────────────┘
```

Notes: the **weak-topic banner sits at the top** — this is the whole product in one card, so it gets
the best position. Tabs keep the hub from becoming an endless scroll. Material rows carry status
inline with the shared vocabulary from [`states.md` §3](states.md#3-job-status-vocabulary); a failed
file gets a fix action, not just an error.

### 9 — Subject overview, desktop

```text
┌────────────┬────────────────────────────────────────────────────────────────────┐
│  Pawgress  │  Subjects / Biology               🔍 Search       (A) Ana ▾       │
│            ├────────────────────────────────────────────────────────────────────┤
│  ▸ Home    │  🧬 Biology                                    [ + Upload ]  ⋯    │
│  ▸ Subjects│  ─────────────────────────────────────────────────────────────     │
│      ■     │  Materials │ Reviewers │ Quizzes │ Progress                        │
│  ▸ Ask     │  ══════════                                                        │
│  ▸ Progress│                                                                    │
│            │  ┌──────────────────────────────────────────────────────────────┐  │
│  ────────  │  │ Genetics is your weakest topic — 42% from 12 questions        │  │
│  ▸ Settings│  │ [ Review ]   [ Practise ]   [ Quiz ]                          │  │
│            │  └──────────────────────────────────────────────────────────────┘  │
│  AI today  │                                                                    │
│  ▓▓▓░░ 6/20│  ┌───────────────────────────────────┐  ┌──────────────────────┐  │
│            │  │ Materials                      4  │  │ Topics               │  │
│            │  │ 📄 Lecture 4.pdf                  │  │ ( Cell structure )   │  │
│            │  │    ✓ Ready · Genetics · 18 p.  ▸  │  │ ( Genetics )         │  │
│            │  │ 📄 Lecture 5.pdf                  │  │ ( + Add )            │  │
│            │  │    ⏱ Indexing  ▓▓▓▓▓▓░░░          │  └──────────────────────┘  │
│            │  │ 📊 Cell deck.pptx                 │  ┌──────────────────────┐  │
│            │  │    ⚠ No readable text — a scan    │  │ Recent               │  │
│            │  │    [ Retry ] [ How to fix ]       │  │ Quiz · 6/10 · Tue    │  │
│            │  │ 📝 My notes — mitosis             │  │ Reviewer · L4 · Mon  │  │
│            │  │    ✓ Ready · Cell structure    ▸  │  └──────────────────────┘  │
│            │  └───────────────────────────────────┘                            │
└────────────┴────────────────────────────────────────────────────────────────────┘
```

Notes: two columns — materials get the wide one because that is the working list; topics and recent
activity are reference. The primary action moves **into the page header** on desktop (`[ + Upload ]`),
where a web app puts it, rather than pinning a bar to the bottom of the window.

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
└────────────────────────────────────────────┘
```

Notes: **page citations on every section** — the product principle made visible, and the fastest way a
student builds trust. The AI notice is stated once at the top, not repeated per section. The sticky
action is `Quiz me`, because the reviewer exists to lead into the loop, not to be read and closed.

### 14 — Reviewer + assistant side panel, desktop

The layout that only a browser window can give you: read the reviewer and interrogate it at once.

```text
┌────────────┬──────────────────────────────────────────┬─────────────────────────┐
│  Pawgress  │ Biology / Reviewers / Genetics    (A) ▾  │  Ask                 ✕  │
│            ├──────────────────────────────────────────┼─────────────────────────┤
│  ▸ Home    │ From Lecture 4.pdf · today               │ Asking about            │
│  ▸ Subjects│ ✨ AI-generated — check what matters      │ ( Genetics reviewer ▾ ) │
│      ■     │                                          │ ─────────────────────── │
│  ▸ Ask     │ Summary                                  │        ┌──────────────┐ │
│  ▸ Progress│ Genetics studies how traits pass from     │        │ Explain      │ │
│            │ parents to offspring. Mendel's work on    │        │ Punnett      │ │
│  ────────  │ pea plants established dominant and       │        │ squares      │ │
│  ▸ Settings│ recessive inheritance…            p.2 ▸   │        └──────────────┘ │
│            │                                          │ ┌─────────────────────┐ │
│  AI today  │ Key concepts                        5    │ │ A Punnett square is │ │
│  ▓▓▓░░ 6/20│ ▸ Dominant vs recessive          p.3     │ │ a grid for working  │ │
│            │ ▸ Genotype vs phenotype          p.4     │ │ out what offspring  │ │
│            │ ▸ Punnett squares                p.6     │ │ two parents can…    │ │
│            │                                          │ │ 📄 p.6  📄 p.7      │ │
│            │ Key terms                          12    │ └─────────────────────┘ │
│            │ ▸ Allele — one version of a gene         │                         │
│            │ ▸ Homozygous — two identical alleles     │ ┌─────────────────────┐ │
│            │                          Show all        │ │ Ask about this…  ➤  │ │
│            │                                          │ └─────────────────────┘ │
│            │ [ 24 flashcards ]  [ 12 practice ]       │ 14 of 20 left today     │
│            │ [ Quiz me on this ]                      │                         │
└────────────┴──────────────────────────────────────────┴─────────────────────────┘
```

Notes: the panel is scoped to **the thing on screen** — "Asking about: Genetics reviewer" — so the
student never has to explain context. Below 1024 px the panel becomes a full-page route (`/assistant`)
and the scope selector carries over. Same components either way.

Narrow viewport: summary and concepts stack; terms and the two session cards follow; the sticky right
rail becomes inline cards.

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
│ ☰  Progress                    🔍    (A)   │
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

## 12. Cross-device considerations

One website, two very different contexts. Neither is a second-class citizen.

### Desktop and laptop browsers *(primary)*

| Concern | Decision |
|---|---|
| **Use the width, don't fill it** | Extra width buys more panels visible at once, not wider text. Content caps at 1200 px |
| **Primary action in the page header** | Where a web app puts it. Nothing pinned to the bottom of the window |
| **Keyboard first** | Full tab order, visible focus, `/` for search, `⌘K`/`Ctrl+K` palette (V1), `1`–`4` and arrows in quizzes, `space` to flip a flashcard |
| **Real links** | Cards and rows are `<a href>`, so ctrl-click and middle-click open a subject in a new tab. Students keep one tab per subject |
| **Hover is a bonus, never the only route** | Every hover affordance has a persistent equivalent — touch laptops and tablets exist |
| **Side panels over navigation** | Assistant beside a material, filters beside a list. Fewer round trips than pushing a new page |
| **Drag and drop upload** | The window is the dropzone; the file picker stays as the accessible path |
| **Browser zoom** | Function preserved to 200%. A student with poor eyesight zooms rather than squinting |
| **Multiple tabs** | Two tabs of the same account must not corrupt one quiz attempt — submission is server-authoritative |
| **Print** | A reviewer prints cleanly to PDF from the browser. Students still print reviewers before exams |

### Phone and tablet browsers

| Concern | Decision |
|---|---|
| **Thumb zone** | Primary action sits in the content column within thumb reach. Destructive actions deliberately out of it |
| **Touch targets** | ≥ 44 × 44 px, ≥ 8 px apart. Quiz options are full-width rows, not radio dots |
| **Chrome budget** | 52 px top bar and nothing else sticky — the browser already owns part of the viewport |
| **No fake native chrome** | No bottom tab bar, no imitation status bar. It is a website in a browser and should look like one |
| **On-screen keyboard** | The assistant composer and note editor stay above the keyboard; the focused field is never covered |
| **One-handed quiz** | Options, navigation, and progress all reachable with one thumb — quizzes get taken on buses |
| **Data cost** | No autoplay, no decorative imagery, lazy-loaded previews. Students are often on metered data |
| **Interruption** | Backgrounding the browser must not lose an attempt. Quiz answers and flashcard progress persist locally on every interaction |
| **Cheap screens** | WCAG AA minimum, checked at low brightness. Never colour alone (NFR-A3) |
| **Small text** | 16 px body minimum — anything smaller triggers iOS zoom-on-focus and is unreadable in daylight |
| **Long file names** | Middle-truncate: `Lecture 4 — Genet….pdf`, with the full name on the detail screen |
| **Offline** | Persistent banner; reads from cache where possible, writes blocked with a clear reason rather than silently dropped |

---

## 13. Responsive layout plan

| Breakpoint | Shell | Grid | Notable changes |
|---|---|---|---|
| **1440 px+** | Sidebar 240 px | Content stays 1200 px, centred | Extra width becomes margin, not longer lines |
| **1280–1439 px** *(primary design width)* | Sidebar 240 px | 2–3 columns, max 1200 px | Assistant as a right panel. Reviewer gets a sticky right rail. Progress renders as real tables. Subject hub 2-column |
| **1024–1279 px** | Sidebar 240 px | 2 columns | Side panel still available; tables narrow before stacking |
| **768–1023 px** | Icon rail 72 px | 2 columns where content earns it | Dialogs, not sheets. Breadcrumbs still shown. Subject cards 2-up |
| **600–767 px** | Drawer behind `☰` | 1 column, 24 px gutters, max 640 px | Tables become cards. Back affordance replaces breadcrumbs |
| **360–599 px** | Drawer behind `☰` | 1 column, 16 px gutters | Sheets for filters and upload. Subject hub tabs scroll horizontally. Primary action in the content column |

Cross-breakpoint rules:

1. **Desktop is authored first, at 1280 px, then adapted down.** That is where uploading, reading and reviewing happen.
2. **Narrow viewports are adapted, never amputated.** Every feature works at 360 px. Nothing is desktop-only.
3. **Content width caps at 1200 px.** Reading lines stay 60–75 characters; a 4K monitor does not get 300-character paragraphs.
4. **Focus mode ignores breakpoints.** The quiz attempt is centred, max 720 px, no shell at any width.
5. **One component per screen, not two.** Responsive containers, not a mobile build and a desktop build. Divergent implementations drift.
6. **Sidebar → icon rail → drawer is the only navigation change.** Same destinations, same order, one implementation.
7. **Test at 1440, 1280, 768 and 360 px.** Those four catch essentially everything.

---

## 14. Layout primitives for Sprint 06

What the wireframes above actually need built. This is the shopping list for the design system.

| Primitive | Used by | Notes |
|---|---|---|
| `AppShell` | every app screen | Sidebar + top bar + content column; sidebar renders as rail or drawer by width |
| `SideNav` | app shell | One nav, three containers: 240 px sidebar, 72 px rail, drawer |
| `TopBar` | app shell | Breadcrumbs or back, global search, account menu |
| `SidePanel` | assistant, filters | Right-hand panel ≥ 1024 px; becomes a route or sheet below |
| `FocusShell` | flashcards, quiz attempt | Progress + single exit, no nav, capped at 720 px |
| `PageHeader` | all | Title, primary action, overflow menu — the desktop home for primary actions |
| `PrimaryAction` | narrow viewports | Full-width action in the content column, safe-area aware |
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
