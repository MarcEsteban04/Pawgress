# Pawgress — User Flows

**Sprint 03 deliverable.** Maps the primary student journey and every branch that can go wrong.
Requirement and story ids refer to [`requirements.md`](requirements.md) and
[`user-stories.md`](user-stories.md).

Companion documents: [`navigation.md`](navigation.md) (routes and screens) ·
[`states.md`](states.md) (empty / loading / error states).

Flows are grouped as **F0–F9**. Each names its entry point, its success exit, and its failure
branches. Diagrams render on GitHub.

---

## F0 — The full journey

The spine from [`pawgress.md`](pawgress.md), with the real-world branches drawn in.

```mermaid
flowchart TD
    A[Landing] --> B[Register]
    B --> C[Verify email]
    C --> D[First-run dashboard]
    D --> E[Create subject]
    E --> F[Create topic - optional]
    F --> G[Upload material]
    G --> H{Processing}
    H -->|failed| G
    H -->|ready| I[Generate reviewer]
    I --> J[Read summary and key terms]
    J --> K[Flashcards]
    K --> L[Practice questions]
    L --> M[Generate quiz]
    M --> N[Take quiz]
    N --> O[Submit]
    O --> P[Results and explanations]
    P --> Q[Topic mastery updated]
    Q --> R[Weak topics identified]
    R --> S[Study plan for today]
    S --> T[Study session]
    T --> U[Improve]
    U --> M
    Q -.-> V[Ask assistant about what I missed]
    V --> J
```

**MVP truncation:** the loop ends at *Weak topics* (R). `S`, `T`, `U` arrive in V1 with the planner
and plan engine. Until then, the weak-topic list links straight back to review or practice, closing
the loop manually.

---

## F1 — Onboarding

Entry: landing page or a shared link. Success exit: one subject with one `ready` material.

```mermaid
flowchart TD
    A[Landing] --> B{Has account?}
    B -->|no| C[Register form]
    B -->|yes| S[Sign in]
    C --> D{Valid?}
    D -->|email taken| E[Message + link to sign in]
    D -->|weak password| C
    D -->|ok| F[Account created]
    F --> G[Check your email]
    G --> H{Verify link clicked?}
    H -->|expired| I[Resend verification]
    I --> G
    H -->|ok| J[First-run dashboard]
    E --> S
    S --> J
    J --> K[Create your first subject]
    K --> L[Subject page - empty]
    L --> M[Upload your first material]
    M --> N[Processing status visible]
    N --> O[Ready: generate a reviewer]
```

Design rules:

- **No onboarding wizard, no tour.** The first-run dashboard is a single call to action:
  create a subject. Everything else is hidden until there is something to show.
- An unverified user **can** sign in and use the app, with a persistent banner to verify. Blocking at
  the door loses the crammer persona entirely.
- Post-verification lands on the dashboard, never back on the marketing page.

Failure branches: `email taken` · `verification expired` · `verification email never arrives`
(resend, with a rate limit) · `wrong credentials`.

Covers: US-A1, US-A2, US-B1, US-J3 · FR-A1–A4, FR-D3

---

## F2 — Cold start to practice *(critical path)*

The flow the product is judged on. Entry: subject page. Success exit: the student is answering
questions about their own material.

```mermaid
flowchart TD
    A[Subject page] --> B[Choose files]
    B --> C{Client validation}
    C -->|type/size wrong| D[Rejected with reason + limit]
    D --> B
    C -->|ok| E[Upload with progress]
    E --> F{Upload result}
    F -->|cancelled| B
    F -->|network failure| G[Retry without re-picking]
    G --> E
    F -->|stored| H[Queued]
    H --> I[Extracting]
    I --> J{Text found?}
    J -->|image-only PDF| K[Failed: no text - suggest OCR or notes]
    J -->|unparseable| L[Failed: file unreadable]
    J -->|ok| M[Chunking]
    M --> N[Embedding]
    N --> O{Embedding ok?}
    O -->|provider error| P[Failed: retryable]
    P --> I
    O -->|ok| Q[Ready]
    Q --> R[Generate reviewer]
    R --> S{Generation ok?}
    S -->|quota reached| T[Over quota: what resets and when]
    S -->|invalid output| U[Retry once, then fail cleanly]
    S -->|ok| V[Reviewer: summary, concepts, terms + citations]
    V --> W[Flashcards]
    V --> X[Practice questions]
```

Design rules:

- Processing is **never blocking**. The student can navigate away, and status is accurate when they
  return (US-D1).
- Each failure names its **stage** and its **cause**, and offers the specific next step. "Processing
  failed" alone is not acceptable copy.
- An image-only PDF is detected and named as such — it is the single most likely real-world failure
  with teacher handouts.
- Retry resumes at the failed stage and never duplicates chunks or embeddings (NFR-R1).

Covers: US-C1, US-C2, US-D1–D4, US-F1–F3 · FR-U1–U3, FR-P1–P6, FR-R1–R3

---

## F3 — Quiz cycle

Entry: subject page, reviewer, or weak topic. Success exit: an attempt recorded and mastery updated.

```mermaid
flowchart TD
    A[Quiz setup: topic, count, difficulty] --> B{Enough ready material?}
    B -->|no| C[Explain what to upload first]
    B -->|yes| D[Generating]
    D --> E{Generated?}
    E -->|failed| F[Failure - no empty quiz created]
    E -->|ok| G[Question 1 - focus mode]
    G --> H[Answer and navigate]
    H --> I{Exit attempted?}
    I -->|yes| J[Confirm: progress kept]
    J --> H
    H --> K{Refresh or disconnect?}
    K -->|yes| L[Answers restored]
    L --> H
    H --> M[Review answers]
    M --> N[Submit]
    N --> O{Scoring atomic}
    O -->|interrupted| P[Nothing saved - resubmit]
    P --> N
    O -->|ok| Q[Results: score, per-question, explanations]
    Q --> R[Per-topic breakdown]
    R --> S{Weak topic found?}
    S -->|yes| T[Review or practise that topic]
    S -->|no| U[Harder quiz or next topic]
    T --> A
    U --> A
    Q --> V[Ask assistant: why was I wrong?]
```

Design rules:

- Quiz taking is **focus mode**: no sidebar, no bottom nav, one deliberate exit.
- Answers persist locally as they are given, so a phone browser reload does not lose the attempt
  (US-G2).
- Results always name the next action. A score with no next step breaks the loop.

Covers: US-G1–G4, US-H3 · FR-Q1–Q6, FR-G1, FR-G3

---

## F4 — Ask the assistant

Entry: subject page, material viewer, or a wrong answer on a results screen.

```mermaid
flowchart TD
    A[Open assistant in a subject] --> B[Ask a question]
    B --> C{Over quota?}
    C -->|yes| D[Quota message + reset time]
    C -->|no| E[Retrieve from my materials]
    E --> F{Relevant chunks found?}
    F -->|no| G[Not in your materials]
    G --> H[Offer general answer - labeled]
    F -->|yes| I[Stream grounded answer]
    I --> J[Sources listed]
    J --> K[Open a source]
    K --> L[Material viewer at that page]
    I --> M{Stream interrupted?}
    M -->|yes| N[Partial answer kept + retry]
    N --> I
    I --> O[Follow up in context]
    O --> B
```

Design rules:

- Scope is always **visible** — the student knows whether they are asking about one topic, one
  subject, or everything (US-E3).
- Citations are the product. An answer with no source, where sources were expected, is a defect
  (NFR success measure: ≥ 95% cited).
- Never invent a citation to satisfy the format.

Covers: US-E1–E3 · FR-C1–C4

---

## F5 — Review session

Entry: reviewer or weak topic.

```mermaid
flowchart TD
    A[Open reviewer] --> B{Section}
    B --> C[Summary and key concepts]
    B --> D[Key terms]
    B --> E[Flashcards]
    B --> F[Practice questions]
    E --> G[Flip card]
    G --> H[Mark known / unknown]
    H --> I{More cards?}
    I -->|yes| G
    I -->|no| J[Session summary: known vs unknown]
    J --> K[Redo unknown only]
    K --> G
    J --> L[Take a quiz on this]
    F --> M[Answer]
    M --> N[Reveal answer + explanation]
    N --> O{More?}
    O -->|yes| M
    O -->|no| L
```

Design rules:

- A flashcard session **resumes** where it stopped; a student on a bus does not restart at card 1.
- "Redo unknown only" is the whole point of marking cards — without it, marking is decoration.
- Practice questions are untracked deliberately: practice is low-stakes, quizzes are what feed
  mastery. Mixing them would corrupt the mastery signal.

Covers: US-F2, US-F3 · FR-R2, FR-R3

---

## F6 — Progress and weakness

Entry: dashboard, subject page, or after results.

```mermaid
flowchart TD
    A[Progress] --> B{Enough evidence?}
    B -->|no| C[Low evidence - take a quiz to find out]
    B -->|yes| D[Overall mastery]
    D --> E[Per subject]
    E --> F[Per topic]
    F --> G[Weak topics ranked]
    G --> H{Chosen action}
    H --> I[Review the topic]
    H --> J[Practise the topic]
    H --> K[Quiz the topic]
    I --> L[Mastery recalculated after next quiz]
    J --> L
    K --> L
```

Design rule: a mastery number without its evidence count is misleading. One lucky 3-question quiz is
not 100% mastery, and the UI must not say it is (US-H1).

Covers: US-H1–H3 · FR-G1–G4

---

## F7 — Plan a day (V1)

```mermaid
flowchart TD
    A[Dashboard] --> B{Plan exists for today?}
    B -->|no data yet| C[Tell me what to do to get one]
    B -->|no| D[Generate plan]
    B -->|yes| E[Today's plan]
    D --> E
    E --> F[Item: subject, activity, minutes]
    F --> G[Start item]
    G --> H[Activity: review / practise / quiz]
    H --> I[Finish session]
    I --> J[Duration + results recorded]
    J --> K{Result strength}
    K -->|weak| L[More review and practice next time]
    K -->|strong| M[Harder, or next topic]
    L --> E
    M --> E
    E --> N[Plan complete - next activity suggested]
```

Covers: US-J1, US-J2 · FR-L1–L4

---

## F8 — Planner (V1)

```mermaid
flowchart TD
    A[Planner] --> B[Create event]
    B --> C[Type, subject, date, priority]
    C --> D[Calendar: month / week / day]
    D --> E[Upcoming deadlines]
    E --> F{Status}
    F -->|due soon| G[Countdown]
    F -->|overdue| H[Flagged - icon and label, not colour alone]
    G --> I[Feeds study plan]
    H --> I
    D --> J[Start a study session]
    J --> K[Finish - duration recorded]
```

Covers: US-I1–I3 · FR-N1–N4

---

## F9 — Recovery flows

Every one of these is a real state a student will hit. Each needs a designed screen, not a stack
trace.

| Situation | Behaviour | Story |
|---|---|---|
| Session expired mid-task | Re-auth in place, return to the same route, warn about unsaved input before losing it | US-A4 |
| Signed out, deep link clicked | Redirect to sign-in, then continue to the original destination | US-A3 |
| Upload fails mid-file | Per-file failed state with retry; other files in the batch continue | US-C1 |
| Processing fails | Stage + reason shown, retry from that stage, auto-stop after repeated failure | US-D2 |
| Generation returns malformed output | One silent retry, then a clean failure — never render partial junk | NFR-R4 |
| Over AI quota | State the limit, what it applies to, and when it resets | NFR-C1 |
| Quiz interrupted by reload or connection loss | Answers restored from local state; attempt resumable | US-G2, US-G6 |
| Submit interrupted | Nothing scored, resubmit available — no half-graded attempt | US-G3 |
| Subject or material deleted while open elsewhere | Not-found screen with a route back, not a crash | — |
| Offline | Reads show cached content where possible; writes queue or fail loudly. Never a silent no-op | — |
| Empty everything, new account | Every screen has a first-run state that names the one useful action | — |

---

## Cross-flow rules

1. **Every dead end has an exit.** No screen may leave the student with nothing to click.
2. **Every failure names a cause and a next step.** "Something went wrong" is a bug, not copy.
3. **Long work never blocks navigation.** Upload, processing, and generation all run in the
   background with status the student can leave and come back to.
4. **Destructive actions confirm with counts** — how many materials, quizzes, and attempts disappear.
5. **The loop always closes.** Results lead to weak topics; weak topics lead to review, practice, or
   a quiz. No terminal screens.
6. **Focus mode for quizzes only.** Everywhere else keeps the app shell so the student never feels
   lost.
