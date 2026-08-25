# Pawgress — Product Requirements

**Sprint 02 deliverable.** Converts [`pawgress.md`](pawgress.md) (the specification) into
development requirements. This document is the scope contract: if something is not here, it is not
being built yet.

Companion documents:

- [`mvp-scope.md`](mvp-scope.md) — what ships in the first usable release
- [`user-stories.md`](user-stories.md) — user stories and acceptance criteria
- [`backlog.md`](backlog.md) — ordered development backlog

---

## 1. Product definition

Pawgress is a responsive **web application** where a student uploads their own schoolwork and gets
back study material generated from *that* material — reviewers, flashcards, practice questions,
quizzes — plus a record of what they actually understand, so the app can answer one question:

> **"What should I study today?"**

The differentiator is not "AI in a chat box." It is that every generated artifact is **grounded in
the student's own uploads**, and every quiz result **feeds back into what the app recommends next**.
A feature that does not participate in that loop is a candidate for cutting.

### The loop (non-negotiable product spine)

```text
Upload → Extract → Review → Practice → Quiz → Track → Weak topics → Study plan → Improve
```

### Platform scope

Pawgress is a **responsive web application** and nothing else. It runs in a browser — desktop,
laptop, tablet, phone — deployed on Vercel. There is no native app, no app store, and no APK.

- **Desktop and laptop browsers are the primary design target.** Layouts are designed at 1280 px
  first, then adapted down.
- **Mobile browsers are fully supported**, down to a 360 px viewport. Not a separate product, not a
  cut-down version — the same website, laid out for a narrow viewport.
- Installing to a home screen or desktop is a browser feature (web app manifest, Sprint 78), not a
  native app.

Native mobile clients are a post-V1 possibility only, and no sprint in the roadmap builds one.

---

## 2. Users

| Persona | Context | What they need from Pawgress |
|---|---|---|
| **Grade 11 student** | 6–8 subjects, mostly teacher handouts and PPTX decks. Uploads and studies on a laptop at home, drills on a phone browser in between classes | Turn a deck they barely read into something drillable in 20 minutes; be told which subject is most at risk |
| **2nd-year college student** | Fewer subjects, denser PDFs, exams cluster in a single week. Works on a laptop with the material open beside the app | Mock-exam-grade practice from lecture PDFs; a realistic plan across a hell week |
| **The crammer** | Exam in 2 days, has not opened the material, whatever device is nearest | Fastest possible path from upload to practice questions; no setup ceremony |

Design consequences:

- **Desktop is where the work happens; the phone browser is where the drilling happens.** Uploading,
  reading, and reviewing suit a large screen; flashcards and quizzes get done on a phone. Both are the
  same website, so neither can be an afterthought.
- **Time-to-value is measured in minutes.** Upload → usable reviewer in one sitting, no onboarding wizard.
- Users may be **minors**. See [§6.5 Privacy](#65-privacy--data-protection).

Not users in V1: teachers, schools, parents, study groups.

---

## 3. Product principles

1. **Grounded or nothing.** Generated content cites the uploaded material it came from. If retrieval
   finds nothing relevant, the app says so instead of inventing an answer.
2. **The loop closes.** Every quiz attempt updates topic mastery; mastery drives recommendations.
   No dead-end features.
3. **Cheap for us, fast for them.** AI work is queued, cached, and quota-bounded. The same document
   is never embedded twice.
4. **Never a blank screen.** Every list, generation, and upload has a defined empty, loading, partial,
   and error state.
5. **Honest about AI.** AI-generated and AI-graded content is labeled as such, and is editable by the
   student.

---

## 4. Functional requirements

Priority: **M** = MVP, **V1** = required for V1, **L** = later / post-V1.
`Sprint` points at the roadmap sprint that owns the work.

### 4.1 Accounts & profile

| ID | Requirement | Pri | Sprint |
|---|---|---|---|
| FR-A1 | Register with email + password; minimum 8 characters with a strength check | M | 10 |
| FR-A2 | Verify the email address before the account is fully trusted | M | 10 |
| FR-A3 | Sign in, sign out, and persist the session across reloads and browser restarts | M | 11 |
| FR-A4 | Unauthenticated visitors are redirected away from application routes | M | 11 |
| FR-A5 | Forgot-password request and reset-by-link flow | V1 | 12 |
| FR-A6 | Graceful expired/invalid session handling — re-auth without losing the current route | V1 | 12 |
| FR-A7 | Profile: display name, avatar, year level, school, preferred session length | V1 | 15–16 |
| FR-A8 | Delete account and all owned data on request | V1 | 15 |
| FR-A9 | Google sign-in | L | — |

### 4.2 Subjects, topics, organization

| ID | Requirement | Pri | Sprint |
|---|---|---|---|
| FR-S1 | Create, rename, and delete a subject; a subject has a name, color, and icon | M | 19 |
| FR-S2 | List subjects with search and sort; defined empty state | M | 20 |
| FR-S3 | Create, rename, and delete topics inside a subject | M | 21 |
| FR-S4 | Deleting a subject deletes or explicitly detaches its topics, materials, and generated content — the user is told which, and confirms | M | 19 |
| FR-S5 | Subject detail view: materials, topics, progress, weak topics, recent activity | M | 23 |
| FR-S6 | Group subjects by semester / academic year; archive a past subject | V1 | 22 |
| FR-S7 | Reorder subjects and topics manually | L | 24 |

### 4.3 Materials & upload

| ID | Requirement | Pri | Sprint |
|---|---|---|---|
| FR-U1 | Upload PDF, DOCX, and PPTX to a subject, optionally tagged to a topic | M | 25 |
| FR-U2 | Reject files that are oversized, of an unsupported type, or unparseable — with a message that says what to do next | M | 26 |
| FR-U3 | Show per-file upload progress; allow cancel and retry | M | 27 |
| FR-U4 | Material library: list, search, filter by type, sort by date, rename, delete | M | 28 |
| FR-U5 | Write typed notes as a first-class material, usable as AI source material | M | 30 |
| FR-U6 | Preview a material in-app (PDF and image viewer) and download the original | V1 | 29 |
| FR-U7 | Upload images (JPG/PNG/HEIC) of handwritten or printed notes and OCR them | V1 | 33 |
| FR-U8 | Detect a duplicate upload (same content hash) and offer to reuse the existing material | V1 | 26 |
| FR-U9 | Files are private to their owner at the storage layer, not merely hidden in the UI | M | 16 |

### 4.4 AI document processing

| ID | Requirement | Pri | Sprint |
|---|---|---|---|
| FR-P1 | Extract text from PDF, DOCX, and PPTX and normalize it (whitespace, hyphenation, page markers) | M | 32 |
| FR-P2 | Chunk extracted text semantically, retaining page/slide provenance per chunk | M | 34 |
| FR-P3 | Embed chunks and store vectors for similarity search | M | 35 |
| FR-P4 | Processing is asynchronous with a visible per-material status: queued → extracting → embedding → ready → failed | M | 31–35 |
| FR-P5 | A failed material can be retried without re-uploading, and reports why it failed | M | 31 |
| FR-P6 | Retrieval returns ranked chunks with source references (material name + page/slide) | M | 36 |
| FR-P7 | Re-processing an unchanged material reuses existing extraction and embeddings | V1 | 35 |
| FR-P8 | All AI calls go through one provider-agnostic service layer with logging and usage accounting | M | 31 |

### 4.5 AI study assistant

| ID | Requirement | Pri | Sprint |
|---|---|---|---|
| FR-C1 | Ask a question and get a streamed answer grounded in the active subject's materials | M | 37–38 |
| FR-C2 | Every answer shows its sources; opening a source opens that material | M | 38 |
| FR-C3 | When retrieval finds nothing relevant, the assistant says so and offers a clearly labeled general-knowledge answer instead | M | 42 |
| FR-C4 | The assistant is scoped to the active subject/topic by default, with a way to widen scope | M | 39 |
| FR-C5 | Conversations persist; can be renamed, resumed, and deleted | V1 | 40 |
| FR-C6 | Study modes: Explain, Tutor, Hint, Summarize, Quiz me | V1 | 41 |
| FR-C7 | Thumbs up/down feedback on an answer, stored with the exchange | V1 | 42 |

### 4.6 Reviewer generator

| ID | Requirement | Pri | Sprint |
|---|---|---|---|
| FR-R1 | Generate a reviewer from selected materials: summary, key concepts, key terms | M | 43 |
| FR-R2 | Generate flashcards; flip, mark known/unknown, run a review session | M | 44 |
| FR-R3 | Generate practice questions (MCQ, True/False, Identification) with answers and explanations | M | 45 |
| FR-R4 | Reviewers are saved, listed, searchable, filterable by subject, and deletable | M | 47 |
| FR-R5 | Edit generated content: fix text, delete a section, regenerate a single section | V1 | 46 |
| FR-R6 | Generation avoids near-duplicate questions within one reviewer | V1 | 48 |
| FR-R7 | Difficulty control (easy / medium / hard) at generation time | V1 | 48 |
| FR-R8 | Duplicate a reviewer | L | 47 |

### 4.7 Quizzes

| ID | Requirement | Pri | Sprint |
|---|---|---|---|
| FR-Q1 | Generate a quiz from a subject/topic with a chosen question count and difficulty | M | 49 |
| FR-Q2 | Question types MCQ, True/False, Identification | M | 51 |
| FR-Q3 | Take a quiz: navigate questions, change answers, see progress, confirm before exiting | M | 50 |
| FR-Q4 | Submit and score automatically; persist the attempt and every answer | M | 52 |
| FR-Q5 | Results: score, per-question correctness, explanations, and the topics touched | M | 53 |
| FR-Q6 | Retake a quiz; each attempt is recorded separately | M | 52 |
| FR-Q7 | Short-answer questions graded by AI, labeled as AI-graded, with a student override | V1 | 51 |
| FR-Q8 | Optional timer per quiz | V1 | 50 |
| FR-Q9 | Mock exam: larger randomized set across a subject, timed, with a readiness signal | V1 | 54 |
| FR-Q10 | Resume an interrupted attempt rather than losing it | V1 | 50 |

### 4.8 Progress tracking

| ID | Requirement | Pri | Sprint |
|---|---|---|---|
| FR-G1 | Per-topic mastery percentage derived from quiz answers, with a documented formula | M | 56 |
| FR-G2 | Quiz analytics per subject: attempts, latest, best, average | M | 55 |
| FR-G3 | Weak-topic list ranked by mastery, with a stated threshold | M | 59 |
| FR-G4 | Progress view: overall, per subject, per topic | M | 58 |
| FR-G5 | Study time recorded per session and aggregated daily/weekly | V1 | 57 |
| FR-G6 | Mastery trend over time (improving / flat / declining) | V1 | 56 |
| FR-G7 | Mastery decays with inactivity so stale knowledge is not shown as mastered | L | 56 |

### 4.9 Academic planner

| ID | Requirement | Pri | Sprint |
|---|---|---|---|
| FR-N1 | Create events typed exam / quiz / assignment / project / presentation / study session, with subject and due date | V1 | 60 |
| FR-N2 | Calendar with month, week, and day views; create and edit inline | V1 | 61 |
| FR-N3 | Upcoming deadlines list, exam countdown, overdue flagging, priority | V1 | 62 |
| FR-N4 | Start and finish a study session; duration recorded against subject/topic | V1 | 63 |
| FR-N5 | Suggest session slots from upcoming exams, deadlines, weak topics, and stated availability | L | 64 |

### 4.10 Personalized study plan

| ID | Requirement | Pri | Sprint |
|---|---|---|---|
| FR-L1 | Generate a daily plan from upcoming exams, weak topics, quiz results, and available time | V1 | 65–66 |
| FR-L2 | A plan item is concrete and actionable: subject, activity, minutes, and a link that starts it | V1 | 66 |
| FR-L3 | Today's plan with per-item completion tracking and a "next activity" pointer | V1 | 67 |
| FR-L4 | The plan adapts to results: weak → more review and practice; strong → harder material, next topic | V1 | 68 |
| FR-L5 | Plan analytics: planned vs completed time, completion rate, improvement after plans | L | 69 |

### 4.11 Dashboard

| ID | Requirement | Pri | Sprint |
|---|---|---|---|
| FR-D1 | Dashboard answers "what should I do today?": greeting, next exam, readiness, today's plan, weak topics, upcoming events, recent activity | V1 | 70 |
| FR-D2 | Readiness score per subject from mastery, quiz results, study activity, and days to exam, with its inputs shown | V1 | 71 |
| FR-D3 | A first-run dashboard that guides a brand-new account to its first upload | M | 70 |
| FR-D4 | Achievements and streaks | L | 72–73 |

---

## 5. Primary flows

Flow diagrams and the screen inventory are Sprint 03/04 deliverables. The flows this PRD commits to:

1. **Onboard** — register → verify → first subject → first upload
2. **Cold start to practice** *(the critical path)* — upload → processing → reviewer → practice questions
3. **Quiz cycle** — generate quiz → take → submit → results → weak topics
4. **Ask** — open subject → ask the assistant → follow a source back into the material
5. **Plan a day** — dashboard → today's plan → start item → finish session → progress updates
6. **Recover** — failed upload, failed processing, interrupted quiz, expired session

---

## 6. Non-functional requirements

### 6.1 Performance

| ID | Requirement |
|---|---|
| NFR-F1 | Dashboard and subject list interactive within 2.5 s LCP on a mid-range Android phone over 4G |
| NFR-F2 | Assistant answers stream, first token under 3 s at p90 |
| NFR-F3 | A 20-page PDF reaches `ready` within 60 s at p90; the UI never blocks waiting on it |
| NFR-F4 | List views paginate at 25 items; no unbounded queries |

### 6.2 Reliability & correctness

| ID | Requirement |
|---|---|
| NFR-R1 | Every AI job is retryable and idempotent; a retry never duplicates chunks, questions, or attempts |
| NFR-R2 | Quiz submission is atomic — a partial attempt is never scored |
| NFR-R3 | External input (forms, params, uploads, AI output) is validated with Zod at the boundary |
| NFR-R4 | AI output failing schema validation is retried once, then surfaced as a generation failure — never rendered raw |

### 6.3 Cost control

Product-critical, not an afterthought: a public site making LLM calls on uploaded documents is the
single largest financial risk in this build.

| ID | Requirement |
|---|---|
| NFR-C1 | Per-user daily quotas on AI generations and assistant messages, with a clear in-app message at the limit |
| NFR-C2 | Per-user caps on total stored bytes and on pages processed per document |
| NFR-C3 | Every AI call logs model, token counts, and cost, attributed to a user |
| NFR-C4 | Embeddings are computed once per material version and reused |
| NFR-C5 | Identical generation requests within a session are served from cache |

### 6.4 Security

| ID | Requirement |
|---|---|
| NFR-S1 | RLS enabled on every user-data table; ownership enforced in the database, not the UI |
| NFR-S2 | Storage objects are private; access only through short-lived signed URLs |
| NFR-S3 | Service-role and AI keys are server-only and never reach the browser bundle |
| NFR-S4 | AI and upload endpoints are authenticated and rate-limited |
| NFR-S5 | Uploaded filenames and extracted text are untrusted input, including when placed in prompts |

### 6.5 Privacy & data protection

| ID | Requirement |
|---|---|
| NFR-P1 | Users may be minors. Collect only what a feature needs; no advertising or third-party analytics on student content |
| NFR-P2 | Student material is not used to train models; the AI provider is configured accordingly |
| NFR-P3 | Account deletion removes uploads, extracted text, embeddings, and generated content |

### 6.6 Accessibility & UX

| ID | Requirement |
|---|---|
| NFR-A1 | WCAG 2.1 AA: contrast, keyboard reach, accessible names, visible focus |
| NFR-A2 | Usable from 1920 px down to 360 px, with no horizontal scrolling at any width |
| NFR-A3 | State is never signalled by color alone |
| NFR-A4 | Every screen defines empty, loading, partial, and error states |

### 6.7 Operability

| ID | Requirement |
|---|---|
| NFR-O1 | `npm run check` (typecheck, lint, format) and `npm run build` pass locally before any commit reaches `main` |
| NFR-O2 | Server errors and failed AI jobs are captured with enough context to reproduce |
| NFR-O3 | Every schema change ships as a migration in `supabase/migrations/` |

---

## 7. Constraints & assumptions

- The stack is fixed by the specification: Next.js + TypeScript + Tailwind + shadcn/ui-style
  primitives (Radix + `cva`, authored in-repo — see `design-system.md` §7), Supabase
  (Postgres, Auth, Storage, RLS), an LLM API with embeddings, deployed on Vercel + Supabase.
- Vercel serverless request timeouts mean long AI work must be **backgrounded**, not held open inside
  a request. This is a hard architectural constraint for Sprints 31–36.
- pgvector on Supabase is the vector store; no separate vector database.
- Solo developer, sequential sprints. Scope gets cut before quality does.
- Assumed material sizes: most uploads under 10 MB and under 50 pages.

---

## 8. Open decisions

Recorded rather than guessed at. Each one blocks the sprint named.

| # | Decision | Blocks | Recommendation |
|---|---|---|---|
| 1 | ~~Roadmap Phases 16–18 describe a React Native app and an APK~~ | — | **Resolved.** Pawgress is a web app only. Phases 16–18 are now installable web app, offline tolerance, cross-browser and accessibility QA, and public launch. Native clients are post-V1 |
| 2 | Free-only, or a paid tier once AI cost is real | 31, 77 | Ship free with hard quotas (NFR-C1); revisit with real usage data |
| 3 | Google sign-in at launch | 10 | Add it in V1 — students lose passwords, and it removes the email-verification drop-off |
| 4 | Mastery formula: raw percent correct vs. recency- and difficulty-weighted | 56 | Weighted, with the weights explained in-product; raw percent reads one lucky quiz as mastery |
| 5 | What happens when a student pastes a live assignment ("do my homework") | 42 | Answer in tutor mode — hints and explanations, not final answers |
| 6 | Languages beyond English (Filipino-language material and code-switching are likely) | 32, 43 | Does not block V1, but test the pipeline on mixed-language material before Sprint 43 |

---

## 9. Success measures

The product works if, per active student per week:

| Measure | Target |
|---|---|
| Materials uploaded that reach `ready` | ≥ 2 |
| Quiz attempts completed | ≥ 2 |
| Weak topics that improve after a recommended session | ≥ 1 |
| Sessions started from a dashboard recommendation | ≥ 50% of sessions |
| Assistant answers carrying at least one cited source | ≥ 95% |

Anti-signal: uploads that never lead to a reviewer or a quiz. That means the loop is broken, whatever
the AI quality looks like.
