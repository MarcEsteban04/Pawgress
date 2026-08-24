# Pawgress — State Inventory

**Sprint 03 deliverable.** Every screen's empty, loading, partial, and error states, so NFR-A4 is a
checklist rather than an aspiration.

Companion documents: [`navigation.md`](navigation.md) (screen numbers used below) ·
[`user-flows.md`](user-flows.md) · [`requirements.md`](requirements.md)

---

## 1. The five states

Every data-bearing surface has all five defined before it is built.

| State | Meaning | Default treatment |
|---|---|---|
| **Empty** | Nothing exists yet, and that is normal | Explain what goes here + exactly one action |
| **Loading** | First load, nothing to show yet | Skeleton matching the real layout's shape |
| **Partial** | Some data ready, some still coming or failed | Render what is ready; the rest degrades locally |
| **Error** | The request failed | What happened, what to do, a retry |
| **Ready** | The normal case | — |

Two states specific to this product, since AI work is slow and metered:

| State | Meaning | Treatment |
|---|---|---|
| **Working** | A long job is running: upload, extraction, embedding, generation | Stage label + progress; the student can leave |
| **Over quota** | The per-user AI limit is reached (NFR-C1) | Name the limit, what it covers, when it resets |

### Rules

1. **No spinner-only screens.** Skeletons mirror the layout they replace so nothing jumps.
2. **Never blank on partial failure.** One failed panel does not blank a page — see
   [§4 Error boundaries](#4-error-boundaries).
3. **Empty states are onboarding.** For a new account, the empty state *is* the tutorial.
4. **Loading has a floor and a ceiling.** No flash for sub-200 ms responses; after ~10 s the copy
   changes to acknowledge the wait rather than looking hung.
5. **State is never colour alone** (NFR-A3): pair every status with an icon and a text label.
6. **Optimistic only when reversible.** Renames and flashcard marks apply instantly and roll back on
   failure. Deletes, submissions, and generations never pretend.

---

## 2. Per-screen states

Screen numbers are from [`navigation.md` §3](navigation.md#3-screen-inventory).

### Auth screens (2–6)

| Screen | Empty | Loading | Error |
|---|---|---|---|
| Register (2) | — | Button spinner, form disabled | Field-level: invalid email, weak password. Form-level: email taken with a sign-in link; provider down |
| Sign in (3) | — | Button spinner | One generic "email or password is incorrect" — never say which. Separate copy for network failure |
| Verify email (4) | "Waiting on you" state with resend | Resend spinner + cooldown | Link expired → resend. Already verified → continue to dashboard |
| Forgot password (5) | — | Button spinner | Same confirmation regardless of whether the email exists |
| Reset password (6) | — | Button spinner | Expired/used link → request a new one |

### Dashboard (7)

| State | Treatment |
|---|---|
| Empty — new account | First-run: "Add your first subject" and nothing else. No fake panels, no sample data |
| Empty — subject but no material | "Upload something to study" pointing at that subject |
| Empty — material but no quiz | "Take your first quiz to see what you know" |
| Loading | Skeleton per panel; panels resolve independently |
| Partial | Each panel loads and fails on its own — a broken readiness score does not hide today's plan (US-J3) |
| Error | Per-panel error with retry; the shell survives |

### Subjects (8)

| State | Treatment |
|---|---|
| Empty | What a subject is, one Create subject button, nothing else |
| Empty — search | "No subjects match X" + clear search. Distinct from having no subjects at all |
| Loading | 4 card skeletons |
| Partial | Cards render before per-subject progress arrives; progress fills in |
| Error | Full-width error with retry |

### Subject overview (9)

Sections load independently; each has its own set.

| Section | Empty | Loading | Error |
|---|---|---|---|
| Materials | "Upload your first material" | 3 row skeletons | Retry in place |
| Topics | "Topics are optional — add one to track mastery separately" | 3 chip skeletons | Retry in place |
| Progress | "Take a quiz to see progress" | Bar skeleton | Retry in place |
| Weak topics | "Not enough quiz data yet" — never guess a weakest topic | List skeleton | Retry in place |
| Recent activity | "Nothing yet" | 3 line skeletons | Retry in place |

### Material library (10) & viewer (11)

| State | Treatment |
|---|---|
| Empty | Upload prompt with accepted formats and the size limit stated up front |
| Empty — filter | "No PDFs here" + clear filter |
| Loading | Row skeletons |
| **Working** | Per-file: `uploading 40%` → `queued` → `extracting` → `embedding`, cancellable while uploading |
| Error — rejected | Named cause + the limit + what to do: wrong type, too large, empty, corrupt, password-protected, image-only PDF |
| Error — processing failed | Stage + reason + Retry. After repeated failure, stop and say so (US-D2) |
| Ready but unusable | `ready` with almost no extracted text → warn that generation will be thin, suggest notes or OCR |
| Viewer — unsupported type | Offer download instead of a broken preview |

### Topic detail (12)

Empty: "No materials tagged to this topic yet" + tag existing material or upload. Weak-topic and
mastery sections use the low-evidence copy rather than a number.

### Reviewer list (13) & detail (14)

| State | Treatment |
|---|---|
| Empty — list | "Generate a reviewer from your materials", disabled with an explanation if nothing is `ready` |
| Empty — no ready material | "Your material is still processing" + link to its status. Never a dead disabled button |
| **Working** | Generating, with stage and a cancel. Sections stream in as they complete |
| Partial | Summary rendered while flashcards still generate |
| Error — quota | Over-quota copy: limit, scope, reset time |
| Error — invalid output | One silent retry, then "Generation failed" + Retry. Never render malformed content (NFR-R4) |
| Error — uncited | Treated as a generation failure, not shown as a reviewer (product principle 1) |

### Flashcards (15) & practice (16)

| State | Treatment |
|---|---|
| Empty | "No cards yet" + generate |
| Loading | Card-shaped skeleton |
| Resume | "You stopped at card 12 of 30" — Continue or Start over |
| Complete | Known vs unknown counts, Redo unknown, Take a quiz |
| Error mid-session | Progress kept; retry loads the next card without restarting |

### Quiz list (17) & setup (18)

| State | Treatment |
|---|---|
| Empty | "Generate your first quiz" |
| Blocked | Not enough `ready` material: say how much is needed and what to upload |
| **Working** | Generating N questions, cancellable |
| Error | Failure without creating an empty quiz (US-G1) |

### Quiz attempt (19)

The state work here matters most — this is where a student loses effort.

| State | Treatment |
|---|---|
| Loading | Question skeleton in focus shell |
| Working — submit | Submit disabled with a spinner; double-submit impossible |
| Restored | "We restored your answers" after a reload or reconnect (US-G2) |
| Offline | Banner: answers saved locally, submit blocked until reconnected — never silently dropped |
| Error — submit failed | Nothing scored, answers intact, Retry submit (US-G3) |
| Exit attempt | Confirmation stating that progress is kept |
| Timer expiry (V1) | Auto-submit with a clear notice |

### Results (20)

| State | Treatment |
|---|---|
| Loading | Score skeleton then per-question list |
| Partial | Score and correctness first; AI explanations stream in after |
| Missing explanation | The question still renders with "Explanation unavailable" — never hide the question |
| Empty — no topics tagged | Show the score without a fabricated topic breakdown |

### Progress (21, 22)

| State | Treatment |
|---|---|
| Empty | "Take a quiz to start tracking" |
| Low evidence | "Based on 3 questions" instead of a confident percentage (US-H1) |
| Loading | Bar skeletons |
| Partial | Subject-level totals before per-topic detail |
| Empty — weak topics | "Nothing looks weak yet — or there is not enough data to tell." Both cases stated honestly |

### Assistant (23, 24)

| State | Treatment |
|---|---|
| Empty — no material | "Upload something first so I can answer from your material" |
| Empty — has material | Suggested first questions drawn from the actual subject |
| Loading | Thinking indicator, then streaming tokens |
| Partial | Interrupted stream keeps the partial answer, marks it incomplete, offers retry |
| No retrieval hit | "This is not in your materials" + labeled general-knowledge option (US-E2) |
| Error — quota | Over-quota copy with reset time |
| Error — provider | "The assistant is unavailable right now" + retry; the question stays in the box |

### Planner (25) & plan (26) — V1

| State | Treatment |
|---|---|
| Empty — planner | "Add your exams so Pawgress can plan around them" |
| Empty — plan, no data | What to do to get a plan: add an exam or take a quiz. Never invent plan items |
| Empty — plan, all done | Completion state + an optional extra suggestion |
| Loading | Calendar grid / plan item skeletons |
| Partial | Plan renders while readiness still computes |

### Settings (27) & profile (28)

Loading: field skeletons. Saving: disabled form + spinner. Error: field-level validation plus a
form-level failure. Quota usage shown here so "over quota" elsewhere is never a surprise.

### System screens (29–32)

| Screen | Treatment |
|---|---|
| Not found (29) | What is missing, plus routes back to Subjects and Home. Covers deleted-while-open |
| Shell error (30) | "Something broke on this page" + Retry; nav chrome intact |
| Global error (31) | Minimal self-contained page with a reload; own `html`/`body` |
| Over quota (32) | Not a route — an in-place panel stating the limit, its scope, and the reset time |

---

## 3. Job status vocabulary

One vocabulary everywhere a long job appears. Used by materials (FR-P4), generations, and quizzes.

| Status | Student-facing label | Icon | Terminal | Retryable |
|---|---|---|---|---|
| `queued` | Waiting to start | clock | no | — |
| `extracting` | Reading your file | document | no | — |
| `embedding` | Indexing for search | sparkle | no | — |
| `generating` | Writing your reviewer / quiz | sparkle | no | — |
| `ready` | Ready | check | yes | — |
| `failed` | Failed — reason shown | alert | yes | yes |
| `cancelled` | Cancelled | slash | yes | yes |
| `over_quota` | Daily limit reached | gauge | yes | after reset |

Rules: every non-terminal status updates without a manual refresh; every terminal failure carries a
reason and a next step; the status vocabulary is identical in the library, on cards, and in
notifications, so students learn it once.

---

## 4. Error boundaries

Mapped onto the verified Next.js 16 conventions (see [`navigation.md` §6](navigation.md#6-nextjs-16-conventions-that-affect-this-plan)).

| Level | Mechanism | Scope |
|---|---|---|
| Root layout failure | `app/global-error.tsx` | Whole app; own `html`/`body` |
| App shell | `(app)/error.tsx` | Any unhandled route error; nav survives |
| Route segment | `error.tsx` in that segment | Subject, quiz, assistant sections |
| Component / panel | `catchError` from `next/error` | Dashboard panels, subject sections, AI generations — each with its own `retry()` |
| Expected failures | `Result<T, E>` returns, not throws | Validation, quota, not-found, AI generation failure |

Expected failures never reach an error boundary. A quota limit, an invalid file, or a failed
generation is a **result**, rendered in place — throwing for these would replace a useful screen with
an error page.

---

## 5. Copy rules

| Do | Do not |
|---|---|
| "This PDF has no readable text — it looks like a scan. Try typing notes instead." | "Extraction failed" |
| "You have used your 20 generations for today. They reset at midnight." | "Quota exceeded" |
| "We could not reach the assistant. Your question is still here — try again." | "Error 503" |
| "This file is 34 MB. The limit is 25 MB." | "File too large" |
| "Not enough quiz data yet to find weak topics." | Showing a fabricated weakest topic |
| "Based on 3 questions" | "100% mastery" |

Voice: plain, second person, no blame, no exclamation marks, no cute error mascots on failures. The
mascot celebrates progress; it does not apologise for bugs.

---

## 6. Definition of done for any screen

A screen is not finished until:

1. Empty, loading, partial, error, and — where relevant — working and over-quota states exist
2. Empty state names exactly one next action
3. Every failure states a cause and a next step, with no raw provider or stack output
4. Skeletons match the real layout's shape, so nothing shifts on load
5. Status is conveyed by icon **and** text, not colour alone
6. It works at 360 px with no horizontal scroll
7. It is keyboard reachable with visible focus and accessible names
8. Retry paths are idempotent — retrying never double-writes
