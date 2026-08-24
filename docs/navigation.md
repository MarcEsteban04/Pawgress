# Pawgress — Navigation & Screen Inventory

**Sprint 03 deliverable.** The information architecture: how a student moves through the app, the
route tree that implements it, and every screen that has to exist.

Companion documents: [`user-flows.md`](user-flows.md) · [`states.md`](states.md) ·
[`requirements.md`](requirements.md)

> **Next.js 16 note.** Route conventions below were verified against the bundled docs in
> `node_modules/next/dist/docs` for Next.js 16.3.2, not from memory. Two things differ from older
> App Router guidance: `middleware.ts` is **deprecated in favour of `proxy.ts`**, and
> `unauthorized.tsx` / `forbidden.tsx` are **experimental** behind the `authInterrupts` config flag.
> See [§6](#6-nextjs-16-conventions-that-affect-this-plan).

---

## 1. Navigation model

Pawgress is a **website**, so it navigates like one: a persistent sidebar, real URLs, a working back
button, and no imitation of native app chrome.

Three shells, chosen by what the student is doing.

| Shell | Used for | Chrome |
|---|---|---|
| **Marketing** | Landing page | Top header, sign in / register |
| **Auth** | Register, sign in, verify, reset | Centred card, logo, no nav |
| **App** | Everything after sign-in | Persistent left sidebar + top bar; sidebar becomes a drawer under 768 px |
| **Focus** | Taking a quiz or mock exam | No sidebar, no top bar; progress + one deliberate exit |

### Primary navigation

**One navigation, two containers.** The sidebar is the nav model at every width — persistent at
1024 px and up, an icon rail from 768 px, and a slide-in drawer below that. Same destinations, same
order, one implementation.

**MVP:**

```text
Home        Subjects        Ask        Progress
```

**V1 adds:**

```text
Plan        Planner
```

Rules:

- **Six destinations maximum.** A seventh means something belongs inside a screen, not beside it.
- **No bottom tab bar.** Bottom tabs are a native-app idiom; on a website they read as a fake app and
  they compete with browser chrome and the on-screen keyboard.
- The drawer under 768 px is the conventional web pattern, and it costs one tap. To pay that back,
  every screen's primary action stays in the content column within thumb reach, so the common actions
  never require opening the nav.
- Profile and settings live behind the avatar in the top bar, never in the primary nav — students open
  settings rarely and subjects constantly.
- The top bar carries global search and the account menu, and stays visible at every width.

### Web-app affordances

Things a website should do that a native app cannot, and which the design must therefore use:

| Affordance | Behaviour |
|---|---|
| **Real URLs** | Every view is linkable, bookmarkable, and shareable. Filters, sort, tabs, and quiz question number live in the query string |
| **Browser back / forward** | Always correct. Dialogs do not create history entries; a quiz exit confirms first |
| **Open in a new tab** | Every list row and card is a real `<a href>`, so middle-click and ctrl-click work — students keep a subject open per tab |
| **Global search** | Top-bar search across subjects, materials, and reviewers, with `/` to focus it and `⌘K` / `Ctrl+K` for the command palette (V1) |
| **Keyboard use** | Full tab order; arrow keys and `1`–`4` on quizzes; `space` to flip a flashcard. A laptop student should never need the mouse mid-session |
| **Browser zoom** | Layout survives 200% zoom without loss of function |
| **Multiple tabs of the same account** | Two tabs must not corrupt one quiz attempt — attempt state is server-authoritative on submit |
| **Print** | A reviewer prints cleanly to PDF via the browser. Students still print reviewers |

### Secondary navigation

- **Subject detail** is the hub: tabs for Materials · Reviewers · Quizzes · Progress. This is where
  most sessions actually happen, so it gets the deepest local navigation.
- **Breadcrumbs from 768 px up**, from the subject level down: `Subjects / Biology / Genetics`.
  Below that, a single back affordance in the top bar.
- **Assistant** is reachable from the sidebar (all subjects) and from within a subject (scoped), and
  on wide screens it opens as a side panel beside the material rather than a separate page. Scope is
  always displayed (US-E3).

### Modal vs page

| Pattern | Use for | Why |
|---|---|---|
| Page | Anything deep-linkable or long: subject, material, reviewer, quiz, results, progress | Must survive a shared link, a new tab, and a back button |
| Dialog | Short create/rename/confirm actions | Keeps context; nothing to link to |
| Side panel | Assistant beside a material, filters on wide screens | Uses the width a browser window actually has |
| Sheet | The same dialogs, below 768 px | Reachable and dismissible on a narrow viewport |
| Inline | Rename in place, mark flashcard known | No interruption for a one-field change |

**Never** put a quiz, a reviewer, or a material viewer in a modal. All three are content students
will want to link to, reload, and return to.

### Back-button and URL rules

1. Every meaningful view has a URL. Reloading returns to the same place.
2. Filters, sort, search, tabs, and quiz question number live in the **query string** so a reload or
   share preserves them.
3. Dialogs do not create history entries; the back button closes the dialog, it does not leave the page.
4. Leaving a quiz mid-attempt via back triggers the exit confirmation (US-G2).
5. After sign-in, the student continues to the route they originally requested (US-A3).

---

## 2. Route tree

Route groups keep the three shells separate without adding URL segments. `(marketing)`, `(auth)`,
and `(app)` do not appear in the path.

```text
src/
  proxy.ts                              Optimistic session check + redirects (see §6)
  app/
    layout.tsx                          html/body, fonts, theme, providers
    global-error.tsx                    Last-resort error UI (own html/body)
    not-found.tsx                       404
    (marketing)/
      page.tsx                          /                        Landing
    (auth)/
      layout.tsx                        Centred card shell
      login/page.tsx                    /login
      register/page.tsx                 /register
      verify-email/page.tsx             /verify-email
      forgot-password/page.tsx          /forgot-password         V1
      reset-password/page.tsx           /reset-password          V1
    (app)/
      layout.tsx                        verifySession() + app shell (tabs/sidebar/header)
      loading.tsx                       Shell-level skeleton
      error.tsx                         Shell-level error boundary
      dashboard/
        page.tsx                        /dashboard               Home
      subjects/
        page.tsx                        /subjects
        [subjectId]/
          page.tsx                      /subjects/:id            Overview
          materials/
            page.tsx                    .../materials
            [materialId]/page.tsx       .../materials/:id        Viewer
          topics/
            [topicId]/page.tsx          .../topics/:id
          reviewers/
            page.tsx                    .../reviewers
            [reviewerId]/
              page.tsx                  .../reviewers/:id
              flashcards/page.tsx       .../reviewers/:id/flashcards
              practice/page.tsx         .../reviewers/:id/practice
          quizzes/
            page.tsx                    .../quizzes
            new/page.tsx                .../quizzes/new          Setup
          progress/page.tsx             .../progress
      quizzes/
        [quizId]/
          attempt/
            layout.tsx                  Focus shell - no tabs/sidebar
            page.tsx                    /quizzes/:id/attempt
          attempts/
            [attemptId]/page.tsx        /quizzes/:id/attempts/:id  Results
      assistant/
        page.tsx                        /assistant
        [conversationId]/page.tsx       /assistant/:id           V1
      progress/
        page.tsx                        /progress
      planner/
        page.tsx                        /planner                 V1
      plan/
        page.tsx                        /plan                    V1
      settings/
        page.tsx                        /settings
        profile/page.tsx                /settings/profile        V1
    api/
      ...                               Route handlers: upload, AI streaming, jobs
```

### Route decisions worth defending

- **Materials, reviewers, and quizzes nest under a subject.** A material without a subject is
  meaningless in this product, and nesting makes ownership obvious in both the URL and the RLS policy.
- **Quiz attempts do not nest under a subject.** An attempt is a focus-mode session, not a place in
  the subject hierarchy — nesting it would force the subject shell into a screen that must have no
  shell.
- **`/assistant` and `/progress` exist at the top level and inside a subject.** Same components,
  different scope. The top-level version answers "across everything"; the nested one answers "in this
  class".
- **`/settings` is flat.** Two screens do not need a hierarchy.
- **Deferred routes are in the tree from day one** so URLs never have to change when the planner and
  plan ship.

### Correction applied in Sprint 07

The tree above nests the quiz attempt under `(app)` with its own layout. That does not work: nested
layouts **compose** rather than replace, so a layout inside `(app)` still renders inside the app
shell and cannot remove the sidebar that focus mode has to be rid of. Focus routes therefore live in
their own `(focus)` route group — see [`architecture.md` §2](architecture.md).

### Migration note (Sprint 07) — done

Today `src/app/page.tsx` is the default Next.js page at the root. Introducing `(marketing)/page.tsx`
means moving it — two files cannot both own `/`. This is an architecture task for Sprint 07, not a
Sprint 03 change.

---

## 3. Screen inventory

`Auth` — does the screen require a signed-in user. `Pri` — **M** = MVP, **V1**.
Every screen's states are specified in [`states.md`](states.md).

### Public & auth

| # | Screen | Route | Auth | Purpose | Primary action | Pri |
|---|---|---|---|---|---|---|
| 1 | Landing | `/` | no | Explain the loop in one screen | Get started | M |
| 2 | Register | `/register` | no | Create account | Create account | M |
| 3 | Sign in | `/login` | no | Return | Sign in | M |
| 4 | Verify email | `/verify-email` | partial | Confirm address, resend | Resend | M |
| 5 | Forgot password | `/forgot-password` | no | Request reset | Send link | V1 |
| 6 | Reset password | `/reset-password` | no | Set a new password | Save | V1 |

### Core app

| # | Screen | Route | Purpose | Primary action | Pri |
|---|---|---|---|---|---|
| 7 | Home / dashboard | `/dashboard` | Answer "what should I do today?" | Start the recommended thing | M (first-run) / V1 (full) |
| 8 | Subjects | `/subjects` | All classes, searchable | Create subject | M |
| 9 | Subject overview | `/subjects/:id` | Hub: materials, topics, progress, weak topics, activity | Upload or generate | M |
| 10 | Material library | `/subjects/:id/materials` | Find and manage files | Upload | M |
| 11 | Material viewer | `/subjects/:id/materials/:id` | Read the source, verify extraction | Generate from this | V1 |
| 12 | Topic detail | `/subjects/:id/topics/:id` | Everything for one topic | Practise this topic | M |
| 13 | Reviewer list | `/subjects/:id/reviewers` | Saved study material | Generate reviewer | M |
| 14 | Reviewer detail | `/subjects/:id/reviewers/:id` | Summary, concepts, terms, citations | Flashcards / quiz | M |
| 15 | Flashcards | `.../reviewers/:id/flashcards` | Drill | Flip / mark | M |
| 16 | Practice | `.../reviewers/:id/practice` | Low-stakes questions | Answer / reveal | M |
| 17 | Quiz list | `/subjects/:id/quizzes` | Past and available quizzes | New quiz | M |
| 18 | Quiz setup | `/subjects/:id/quizzes/new` | Topic, count, difficulty | Generate | M |
| 19 | Quiz attempt | `/quizzes/:id/attempt` | Focus mode | Submit | M |
| 20 | Results | `/quizzes/:id/attempts/:id` | Score, explanations, weak topics | Review weak topic | M |
| 21 | Subject progress | `/subjects/:id/progress` | Mastery for one class | Practise weakest | M |
| 22 | Progress | `/progress` | Mastery across classes | Open weakest subject | M |
| 23 | Assistant | `/assistant` | Ask across materials | Ask | M |
| 24 | Conversation | `/assistant/:id` | Resume a thread | Continue | V1 |
| 25 | Planner | `/planner` | Calendar and deadlines | Add event | V1 |
| 26 | Today's plan | `/plan` | The generated plan | Start item | V1 |
| 27 | Settings | `/settings` | Account, quota usage, sign out | — | M |
| 28 | Profile | `/settings/profile` | Name, avatar, year, school, session length | Save | V1 |

### System

| # | Screen | Convention | Purpose | Pri |
|---|---|---|---|---|
| 29 | Not found | `app/not-found.tsx` | 404 with a route back | M |
| 30 | Shell error | `(app)/error.tsx` | Recoverable error with retry | M |
| 31 | Global error | `app/global-error.tsx` | Root layout failure; defines its own `html`/`body` | M |
| 32 | Over quota | in-place, not a route | Explain the limit and the reset time | M |

**32 screens** — the roadmap's Sprint 04 list of 16 expands once nesting, focus mode, and system
screens are counted. Wireframes in Sprint 04 cover screens 1–23 and 27 for MVP; the V1 screens get
wireframed when their phase starts, so they do not go stale first.

---

## 4. Screen-to-flow map

Confirms every flow in [`user-flows.md`](user-flows.md) has screens, and every screen has a flow.

| Flow | Screens |
|---|---|
| F1 Onboarding | 1, 2, 3, 4, 7, 8, 9, 10 |
| F2 Cold start to practice | 9, 10, 13, 14, 15, 16 |
| F3 Quiz cycle | 17, 18, 19, 20, 21, 12 |
| F4 Ask | 23, 24, 11, 9 |
| F5 Review session | 14, 15, 16 |
| F6 Progress | 22, 21, 12 |
| F7 Plan a day (V1) | 7, 26 |
| F8 Planner (V1) | 25, 7 |
| F9 Recovery | 29, 30, 31, 32, plus in-screen states |

No orphans: every screen appears in at least one flow.

---

## 5. Responsive plan

| Breakpoint | Layout |
|---|---|
| 1280 px+ *(primary design target)* | Persistent 240 px sidebar, breadcrumbs, content capped at 1200 px, subject hub in 2–3 columns, assistant as a side panel, progress as real tables |
| 1024–1279 px | Persistent sidebar, 2 columns, side panel still available |
| 768–1023 px | Sidebar collapses to a 72 px icon rail, 2 columns where content earns it, dialogs |
| 360–767 px | Sidebar becomes a drawer, single column, sheets instead of dialogs, tables become stacked cards, primary action in the content column |

Rules:

- **Designed at 1280 px first, then adapted down** — this is a web app, and the desktop browser is
  where a student uploads, reads, and reviews.
- **Narrow viewports are a first-class adaptation, not a leftover.** Everything works at 360 px; the
  same components, one implementation, different container (NFR-A2).
- Tables become stacked cards below 768 px. No horizontal scrolling at any width except inside a
  deliberately scrollable container.
- Touch targets ≥ 44 px wherever touch is plausible, which now includes tablets and touch laptops.
- Hover states must always have a non-hover equivalent — a touch user never hovers.
- The quiz attempt screen is centred and capped at 720 px at every width: an exam-like screen should
  feel the same on a laptop and a phone.

---

## 6. Next.js 16 conventions that affect this plan

Verified in `node_modules/next/dist/docs`. These change how Sprint 07 and Sprint 11 should be built.

| Convention | What applies here |
|---|---|
| **`proxy.ts` replaces `middleware.ts`** | `middleware.js` is deprecated in Next.js 16 and renamed to `proxy.js`. The roadmap's Sprint 11 wording "authentication middleware" should be read as `src/proxy.ts`. A codemod exists: `npx @next/codemod@canary middleware-to-proxy .` |
| **Proxy is not the auth gate** | Next's own guidance: proxy runs on every request including prefetches, so it should do *optimistic* cookie-only checks and no database calls. The real check belongs in a Data Access Layer close to the data — a `verifySession()` in `src/server/` memoized with React `cache()`, called from `(app)/layout.tsx` and every server action. RLS (NFR-S1) remains the last line |
| **`loading.tsx`** | Per-segment loading UI via Suspense. Every list route gets one, so navigation is never a blank screen |
| **`error.tsx` nesting** | Errors bubble to the nearest boundary. One at the `(app)` shell, plus targeted boundaries around AI panels so a failed generation does not blank the page |
| **`catchError` from `next/error`** | Component-level error boundaries with a `retry()` callback. This is how the dashboard's "each panel fails independently" requirement (US-J3) gets built, rather than one boundary per route |
| **`global-error.tsx`** | Must define its own `html` and `body` tags since it replaces the root layout |
| **`unauthorized.tsx` / `forbidden.tsx`** | Experimental, behind the `authInterrupts` config flag. Do not build MVP auth around them — redirect to `/login` instead, and revisit if they stabilise |

Action item for Sprint 07: [`conventions.md`](conventions.md) says "authentication middleware"
implicitly via the roadmap; it should be updated to name `proxy.ts` and the DAL pattern so nobody
writes a `middleware.ts` out of habit.
