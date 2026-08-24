# Pawgress — Development Backlog

**Sprint 02 deliverable.** The ordered work queue derived from [`requirements.md`](requirements.md),
[`mvp-scope.md`](mvp-scope.md), and [`user-stories.md`](user-stories.md).

This is the working document — it changes every sprint. The roadmap says *what* order the phases go
in; this says what is actually next and what is blocking it.

Status values: `todo` · `in progress` · `done` · `blocked` · `deferred`

---

## Now

| Sprint | Item | Status |
|---|---|---|
| 01 | Project initialization — repo, Next.js, TS, ESLint, Prettier, env, conventions, folder architecture | done |
| 02 | Product requirements — PRD, MVP scope, user stories, acceptance criteria, backlog | done |
| 03 | User flow mapping — flow diagrams, navigation structure, screen inventory, state inventory | done |
| 04 | UX wireframes — MVP screens phone-first, plus responsive layout plan | todo |

## Next three

| Sprint | Item | Depends on |
|---|---|---|
| 05 | Branding — logo, mascot direction, typography, color, icon style, favicon | 04 |
| 06 | Design system — shadcn/ui setup, design tokens, component standards | 05 |
| 07 | Application architecture — route groups, DAL + `proxy.ts` auth pattern, AI abstraction, background jobs, error strategy | 06 |

---

## Epic backlog

Ordered by dependency, not by preference. `Pri` follows the PRD (**M** = MVP, **V1**, **L** = later).

### E00 — Foundation (Phase 1–2, Sprints 01–08)

| # | Item | Pri | Sprint | Notes |
|---|---|---|---|---|
| 1 | Flow diagrams for F0–F9 including recovery branches | M | 03 | **done** — `user-flows.md` |
| 2 | Navigation model, route tree, 32-screen inventory | M | 03 | **done** — `navigation.md` |
| 3 | Empty / loading / partial / error / working / over-quota state inventory | M | 03 | **done** — `states.md`; NFR-A4 is now a checklist |
| 4 | Low-fidelity wireframes, phone-first, MVP screens 1–23 and 27 | M | 04 | Phone layout drawn before desktop |
| 5 | Brand identity and favicon | M | 05 | |
| 6 | Design tokens + shadcn/ui configuration | M | 06 | Tokens land before any feature UI |
| 7 | Core component set (button, input, select, card, dialog, tabs, dropdown, toast, progress, badge, avatar, skeleton) | M | 06 | |
| 8 | Job status component driven by the shared status vocabulary | M | 06 | `states.md` §3 — one vocabulary across materials, reviewers, quizzes |
| 9 | Application architecture: route groups, server-action conventions | M | 07 | Includes moving `app/page.tsx` into `(marketing)/` |
| 10 | Auth pattern: `src/proxy.ts` optimistic check + `verifySession()` DAL memoized with React `cache()` | M | 07 | Next.js 16 deprecates `middleware.ts`; proxy must not be the only gate |
| 11 | Error-boundary strategy: `global-error`, shell `error.tsx`, segment boundaries, `catchError` panels, `Result<T,E>` for expected failures | M | 07 | `states.md` §4 |
| 12 | AI service abstraction design (interface, config, logging, usage accounting) | M | 07 | Designed here, built in Sprint 31 |
| 13 | Background job strategy for long AI work | M | 07 | **Architectural risk** — Vercel request timeouts; decide the mechanism before Sprint 31 |
| 14 | Update `conventions.md` for Next.js 16: `proxy.ts` not `middleware.ts`, DAL pattern, error conventions | M | 07 | Prevents writing a deprecated `middleware.ts` out of habit |
| 15 | CI: typecheck, lint, format, build on push | M | 08 | NFR-O1 |
| 16 | Dev / staging / production environments | M | 08 | |

### E01 — Authentication (Phase 3, Sprints 09–12)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 13 | Supabase project, local dev config, env wiring | M | 09 | — |
| 14 | Registration + email verification | M | 10 | US-A1 |
| 15 | Sign in, sign out, session persistence | M | 11 | US-A2 |
| 16 | Route protection and auth middleware | M | 11 | US-A3 |
| 17 | Password reset and session-expiry handling | V1 | 12 | US-A4 |
| 18 | Google sign-in | L | — | PRD open decision #3 |

### E02 — Data & storage (Phase 4, Sprints 13–18)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 19 | Schema migrations for the 16 core tables, with keys, indexes, constraints | M | 13 | — |
| 20 | RLS policies on every user-data table | M | 14 | US-C5 |
| 21 | Unauthorized-access test suite | M | 18 | US-C5 |
| 22 | Storage buckets with owner-only policies and signed URLs | M | 16 | US-C5 |
| 23 | Shared Zod schemas + error response standard | M | 17 | Global criterion 4 |
| 24 | Profile table and profile UI | V1 | 15 | US-A5 |
| 25 | Account deletion cascade across DB and storage | V1 | 15 | US-A5, NFR-P3 |

### E03 — Subjects & topics (Phase 5, Sprints 19–24)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 26 | Subject CRUD with color and icon | M | 19 | US-B1 |
| 27 | Cascading subject delete with a counted confirmation | M | 19 | US-B3 |
| 28 | Subject list: cards, search, sort, empty state | M | 20 | US-B2 |
| 29 | Topic CRUD and material/quiz tagging | M | 21 | US-B4 |
| 30 | Subject detail page composed of independent sections | M | 23 | US-B5 |
| 31 | Semester grouping and archiving | V1 | 22 | US-B6 |
| 32 | Organization polish: reordering, filter and search tuning | L | 24 | — |

### E04 — Uploads & materials (Phase 6, Sprints 25–30)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 33 | Upload UI: picker, drag-drop, multi-file, topic tagging | M | 25 | US-C1 |
| 34 | Two-layer validation (type, size, emptiness, parseability) with specific messages | M | 26 | US-C2 |
| 35 | Per-file progress, cancel, retry, failed state | M | 27 | US-C1 |
| 36 | Material library: list, search, filter, sort, rename, delete + storage cleanup | M | 28 | US-C4 |
| 37 | Typed notes as material, with re-processing on edit | M | 30 | US-C3 |
| 38 | In-app PDF/image viewer and download | V1 | 29 | US-C6 |
| 39 | Duplicate detection by content hash | V1 | 26 | — |

### E05 — Processing & RAG (Phase 7, Sprints 31–36)

The highest-risk epic. Nothing downstream works if this is wrong.

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 40 | AI service layer: interface, model config, logging, usage accounting, error taxonomy | M | 31 | US-D5 |
| 41 | Per-user AI quotas and rate limiting | M | 31 | NFR-C1, NFR-S4 |
| 42 | Job runner: queued, retryable, idempotent, status-reporting | M | 31 | US-D1, US-D2 |
| 43 | PDF / DOCX / PPTX extraction + normalization | M | 32 | US-D3 |
| 44 | Chunking with page/slide provenance | M | 34 | US-D3 |
| 45 | Embedding pipeline, pgvector storage, reuse on unchanged material | M | 35 | US-D4, NFR-C4 |
| 46 | Retrieval: vector search, ranking, relevance floor, context assembly, source references | M | 36 | US-D4 |
| 47 | Material status UI with live updates | M | 31–35 | US-D1 |
| 48 | OCR pipeline for images, with confidence signalling | V1 | 33 | US-C7 |

### E06 — Assistant (Phase 8, Sprints 37–42)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 49 | Chat UI with streaming, loading, and error states | M | 37 | US-E1 |
| 50 | Grounded answers with clickable citations | M | 38 | US-E1 |
| 51 | Subject/topic scoping with visible active scope | M | 39 | US-E3 |
| 52 | No-context behavior and labeled general-knowledge fallback | M | 42 | US-E2 |
| 53 | Prompt-injection hardening on extracted text and filenames | M | 42 | NFR-S5 |
| 54 | Conversation persistence, rename, resume, delete | V1 | 40 | US-E4 |
| 55 | Study modes | V1 | 41 | US-E5 |
| 56 | Answer feedback capture | V1 | 42 | — |

### E07 — Reviewer (Phase 9, Sprints 43–48)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 57 | Reviewer generation: summary, key concepts, key terms, with citations | M | 43 | US-F1 |
| 58 | Schema-validated generation output with one retry, then a clean failure | M | 43 | NFR-R4 |
| 59 | Flashcards + review session with saved progress | M | 44 | US-F2 |
| 60 | Practice question generation (MCQ, T/F, Identification) with explanations | M | 45 | US-F3 |
| 61 | Reviewer library: list, search, filter, delete | M | 47 | US-F4 |
| 62 | Reviewer editor with per-section regeneration | V1 | 46 | US-F5 |
| 63 | Duplicate-question filtering and difficulty control | V1 | 48 | US-F5 |

### E08 — Quizzes (Phase 10, Sprints 49–54)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 64 | Quiz generation with count, topic, difficulty | M | 49 | US-G1 |
| 65 | Quiz-taking UI: navigation, progress, exit confirmation, refresh safety | M | 50 | US-G2 |
| 66 | Question-type rendering and answer capture | M | 51 | US-G2 |
| 67 | Atomic submission, scoring, attempt and answer persistence | M | 52 | US-G3 |
| 68 | Identification matching rules (normalization, near-match) | M | 52 | US-G3 |
| 69 | Results screen with explanations and per-topic breakdown | M | 53 | US-G4 |
| 70 | AI-graded short answer with labeling and student override | V1 | 51 | US-G5 |
| 71 | Timer, attempt resume, mock exams | V1 | 50, 54 | US-G6 |

### E09 — Progress (Phase 11, Sprints 55–59)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 72 | Quiz analytics per subject and per quiz | M | 55 | US-H2 |
| 73 | Mastery calculation with documented, in-product formula | M | 56 | US-H1 |
| 74 | Low-evidence handling so thin data is not shown as confidence | M | 56 | US-H1 |
| 75 | Progress views: overall, subject, topic | M | 58 | US-H1 |
| 76 | Weak-topic detection with a stated threshold and direct practice links | M | 59 | US-H3 |
| 77 | Study-time tracking and aggregation | V1 | 57 | US-H4 |
| 78 | Mastery trend | V1 | 56 | US-H4 |

### E10 — Planner (Phase 12, Sprints 60–64)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 79 | Planner schema and event CRUD | V1 | 60 | US-I1 |
| 80 | Calendar month/week/day views with inline editing | V1 | 61 | US-I1 |
| 81 | Deadlines, exam countdown, overdue flagging, priority | V1 | 62 | US-I2 |
| 82 | Study session start/finish with duration capping | V1 | 63 | US-I3 |
| 83 | Smart scheduling suggestions | L | 64 | — |

### E11 — Study plans & dashboard (Phases 13–14, Sprints 65–73)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 84 | Study plan engine over exams, weak topics, results, available time | V1 | 65 | US-J1 |
| 85 | Actionable plan items that launch the activity | V1 | 66 | US-J1 |
| 86 | Today's plan with completion tracking and next-activity pointer | V1 | 67 | US-J1 |
| 87 | Adaptive difficulty and explained recommendations | V1 | 68 | US-J2 |
| 88 | First-run dashboard | M | 70 | US-J3 |
| 89 | Full dashboard with independently loading panels | V1 | 70 | US-J3 |
| 90 | Readiness score with visible inputs | V1 | 71 | US-J3 |
| 91 | Plan analytics | L | 69 | — |
| 92 | Achievements and streaks | L | 72–73 | — |

### E12 — Production hardening (Phase 15, Sprints 74–77)

| # | Item | Pri | Sprint |
|---|---|---|---|
| 93 | Responsive audit across phone, tablet, laptop, desktop | V1 | 74 |
| 94 | Performance: images, bundle, query and AI-call optimization, caching, lazy loading | V1 | 75 |
| 95 | Security audit: auth, RLS, storage, keys, validation, uploads, AI endpoint abuse | V1 | 76 |
| 96 | Production deploy: Vercel, Supabase, domain, HTTPS, monitoring, error tracking, backups | V1 | 77 |

### E13 — Post-V1

| Item | Notes |
|---|---|
| Native mobile app and APK | Roadmap Phases 16–18; conflicts with the current website goal — PRD open decision #1 |
| Teacher and school accounts, shared reviewers | Spec-listed future features |
| Notifications, offline mode | Spec-listed future features |

---

## Risk register

| Risk | Impact | Mitigation | Owner sprint |
|---|---|---|---|
| Long AI jobs exceed serverless request limits | Processing silently fails in production | Decide the background-job mechanism during architecture, not during Sprint 31 | 07 |
| AI cost scales with uploads, uncapped | Unbounded bill from a handful of heavy users | Quotas, page caps, embedding reuse, per-user cost logging | 31 |
| Extraction quality on real teacher files (scanned PDFs, dense decks) | Every downstream feature degrades | Test the pipeline on real files early; detect image-only PDFs and say so | 32 |
| Generated content is generic rather than material-specific | Core value proposition fails | Require citations; treat uncited output as a generation failure | 43 |
| Mixed-language and code-switched material | Poor reviewers for a likely-common case | Test before Sprint 43 (PRD open decision #6) | 43 |
| Mastery formula misleads students | Wrong study recommendations, lost trust | Weighted formula, low-evidence handling, explained in-product | 56 |
| Doc-only sprints 03–04 drift from what gets built | Docs become decoration | Keep wireframes low-fidelity; update these docs when reality diverges | 03–04 |
| Building against pre-16 App Router habits | Deprecated `middleware.ts`, wrong auth gate, blank pages on partial failure | Route conventions verified against the bundled Next.js 16 docs and recorded in `navigation.md` §6; `conventions.md` updated in Sprint 07 | 07 |
