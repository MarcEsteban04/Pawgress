# Pawgress — MVP Scope

**Sprint 02 deliverable.** Defines the first release a real student could use, and — more
importantly — what is deliberately *not* in it. Requirement IDs refer to
[`requirements.md`](requirements.md).

---

## The MVP bet

> A student can upload a real school file, get a reviewer and a quiz generated from that file, take
> the quiz, and be told which topics they are weakest in.

That is the whole loop, minus the automation on top of it. If this is not compelling, no amount of
planner, dashboard, or gamification work will save the product — so it ships first and nothing
outside it gets built until it works.

MVP is **Roadmap Sprints 01–59**, minus the deferrals listed below. Target milestone name: **v0.1**.

---

## In scope (MVP)

| Area | Included | Requirements |
|---|---|---|
| **Auth** | Email registration with verification, sign in/out, persistent sessions, protected routes | FR-A1–A4 |
| **Subjects** | Create/rename/delete subjects with color and icon, searchable list, subject detail page | FR-S1, S2, S4, S5 |
| **Topics** | Create/rename/delete topics inside a subject | FR-S3 |
| **Upload** | PDF, DOCX, PPTX; per-file progress, cancel, retry; validation with useful errors | FR-U1–U3 |
| **Notes** | Typed notes as a material, usable as AI source | FR-U5 |
| **Library** | List, search, filter, sort, rename, delete materials | FR-U4 |
| **Storage** | Private buckets, owner-only access, signed URLs | FR-U9, NFR-S2 |
| **Processing** | Text extraction, normalization, chunking with provenance, embeddings, visible status, retry | FR-P1–P5, P8 |
| **RAG** | Vector search, ranked retrieval, source references | FR-P6 |
| **Assistant** | Grounded streamed answers scoped to a subject, with sources, and honest "not in your materials" behavior | FR-C1–C4 |
| **Reviewer** | Summary, key concepts, key terms, flashcards with a review session, practice questions, saved library | FR-R1–R4 |
| **Quiz** | Generate from subject/topic, MCQ + True/False + Identification, take, submit, score, results with explanations, retake | FR-Q1–Q6 |
| **Progress** | Topic mastery, quiz analytics, weak-topic ranking, progress view | FR-G1–G4 |
| **Dashboard** | First-run guidance to the first upload; a minimal "continue where you left off" surface | FR-D3 |
| **Cross-cutting** | RLS everywhere, Zod validation at boundaries, AI usage quotas and logging, empty/loading/error states, WCAG AA, 360 px layout | NFR-* |

---

## Deferred to V1 (built, but after the loop works)

| Deferred | Why it waits | Requirements |
|---|---|---|
| **Password reset** | Real gap, but the MVP audience is a small test group who can be reset manually. First thing added after v0.1 | FR-A5, A6 |
| **Profile fields** | Only the study-plan engine actually consumes year level and preferred session length | FR-A7, A8 |
| **OCR for images** | The most-requested feature we are still deferring: it adds a second extraction pipeline, image preprocessing, and per-page cost, and handwriting accuracy is the least predictable part of the product. Ships in V1 with realistic expectations set in the UI | FR-U7 |
| **In-app material viewer** | Download is enough to check that extraction was correct | FR-U6 |
| **Short-answer questions** | Requires AI grading, which is the easiest place to lose student trust. Needs the labeling and override UX designed properly | FR-Q7 |
| **Mock exams, timers** | Value depends on the question bank already being good | FR-Q8, Q9 |
| **Conversation history, study modes** | The assistant is useful without a conversation manager | FR-C5–C7 |
| **Reviewer editing and difficulty control** | Regenerating is an acceptable substitute for editing in v0.1 | FR-R5–R7 |
| **Semesters and archiving** | Only matters after a student has used the app for a full term | FR-S6 |
| **Study time tracking** | Needs the planner to be meaningful | FR-G5 |
| **Planner, calendar, deadlines** | Whole of Phase 12 | FR-N1–N4 |
| **Study plans, adaptive plans** | Whole of Phase 13; depends on mastery data that only exists after real quiz usage | FR-L1–L4 |
| **Full dashboard, readiness score** | Cannot compute readiness before mastery and planner data exist | FR-D1, D2 |

---

## Out of scope (post-V1)

- Native mobile app or APK of any kind — Pawgress is a website; roadmap Phases 16–18 are installable
  web app, offline tolerance, cross-browser QA and launch
- Installable web app (manifest, standalone window) and offline reading — Sprints 78–79, after V1
- Achievements, streaks, celebrations — FR-D4
- Teacher, school, or parent accounts
- Shared or public reviewers, collaboration, social features
- Notifications of any kind, including email digests
- Offline mode
- Google sign-in (recommended for V1, not MVP) — FR-A9
- Mastery decay, smart scheduling, plan analytics — FR-G7, N5, L5
- Manual drag-reordering — FR-S7
- Payments, subscriptions, or usage billing

---

## MVP definition of done

A new student can complete this without help, in a browser, on a laptop **and** on a phone:

1. Register and verify their email
2. Sign in and land somewhere that tells them what to do first
3. Create a subject, then a topic
4. Upload a real lecture PDF and watch it reach `ready`
5. Generate a reviewer from it, and read a summary that is actually about their material
6. Run a flashcard session
7. Generate a 10-question quiz, take it, and submit
8. See their score, which answers were wrong, and why
9. Open progress and see per-topic mastery with the weakest topic named
10. Ask the assistant a question about the material and get an answer with a citation they can open

Plus, on the engineering side:

- Every table has RLS, verified by an unauthorized-access test
- A failed upload or failed processing job is visible, explained, and retryable
- AI usage is quota-limited and logged per user
- `npm run check` and `npm run build` pass before every commit to `main`

---

## Explicit MVP non-goals

Worth writing down because they are the tempting detours:

- **Perfect AI quality.** Good-enough-and-cited beats excellent-and-unverifiable. Prompt tuning is
  Sprint 48.
- **A beautiful dashboard.** The dashboard is the last thing built, not the first, because it is
  entirely derived from data that does not exist yet.
- **Broad file-format support.** Three formats plus typed notes covers most of what a student
  actually has.
- **Multi-device sync niceties.** The web app is the single client; there is nothing to sync.
