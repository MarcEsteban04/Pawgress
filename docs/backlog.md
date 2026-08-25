# Pawgress — Development Backlog

**Sprint 02 deliverable.** The ordered work queue derived from [`requirements.md`](requirements.md),
[`mvp-scope.md`](mvp-scope.md), and [`user-stories.md`](user-stories.md).

This is the working document — it changes every sprint. The roadmap says *what* order the phases go
in; this says what is actually next and what is blocking it.

Status values: `todo` · `in progress` · `done` · `blocked` · `deferred`

---

## Now

| Sprint | Item | Status | Note |
|---|---|---|---|
| 01 | Project initialization — repo, Next.js, TS, ESLint, Prettier, env, conventions, folder architecture | done | |
| 02 | Product requirements — PRD, MVP scope, user stories, acceptance criteria, backlog | done | |
| 03 | User flow mapping — flow diagrams, navigation structure, screen inventory, state inventory | done | |
| 04 | UX wireframes — MVP screens desktop-led, adapted to 360 px, plus responsive layout plan | done | |
| 05 | Branding — logo, mascot, type ramp, palette, icons, favicon | done | superseded by the "Daylight" redesign |
| 06 | Design system — tokens, type ramp, primitive set, landing page as the smoke test | done | re-cut for "Daylight" |
| 07 | Application architecture — route groups, app shell, DAL + `proxy.ts` auth, AI abstraction, job contract, error strategy | done | |
| 09 | Supabase setup — clients, proxy session refresh, env wiring, local stack | done | hosted project connected |
| 10 | Registration — sign-up, password strength, duplicate handling, 6-digit email code | done | applied to the hosted project via `npm run auth:configure` |
| 11 | Login & logout — sign in, sign out, session persistence, protected routes | done | preview-session branch deleted |
| 12 | Account recovery — forgot password, 6-digit reset code, session expiry | done | recovery template pushed to the hosted project |
| 13 | Database schema — 17 tables, foreign keys, indexes, constraints, RLS enabled | done | applied to the hosted project; policies are Sprint 14 |
| 14 | Row Level Security — 67 policies, composite-key ownership, 17 security tests | done | `npm run db:test:rls` passes against the live project |
| 15 | User profiles — name, year level, school, study block, timezone, account deletion | done | **profile picture deferred to Sprint 16**, which is when storage exists |
| 16 | Storage — private buckets, path-based ownership, avatar upload, 10 new security tests | done | account deletion removes files via the Storage API, not a DB trigger |
| 17 | Data validation — shared form parser, byte-sniffing upload checks, sanitisers, error shape | done | `docs/validation.md` |
| 18 | Database testing | **skipped** | product owner tested manually; concurrency remains uncovered — see roadmap |
| 19 | Subject creation — create, edit, delete with counted confirmation, colour and icon | done | dropped the unique-name constraint that contradicted US-B1 |
| 20 | Subject list — URL-driven search, sort and semester filter, cards, two empty states | done | delete counts moved off page load and onto dialog open |
| 21 | Topic management — create, rename, delete with detach-not-delete confirmation, per-topic mastery | done | added a minimal `/subjects/[id]` page for topics to live on; Sprint 23 expands it |
| 22 | Semesters and archiving — academic year column, grouping, archive/restore as a separate view | done | `academic_year` is a smallint start year, not free text — see the migration for why |
| 23 | Subject hub — readiness, weak topics, materials, upcoming, recent activity | done | six independent Suspense boundaries; panels say WHY they are empty rather than inventing numbers |
| 24 | Organization polish — topic reordering, `last_activity_at`, topic-aware search, per-panel error boundaries | done | `npm run db:test:reorder`; subject reordering deliberately NOT built — see note |
| — | **Redesign to direction "Daylight"** — floating canvas shell, validated data palette, charts, dashboard built out | done | out of sprint order, at the product owner's direction |

## Next three

| Sprint | Item | Depends on |
|---|---|---|
| 25 | File upload | 16, 17 |
| 26 | Material list and detail | 25 |
| 27 | Text extraction pipeline | 26 |

---

## Epic backlog

Ordered by dependency, not by preference. `Pri` follows the PRD (**M** = MVP, **V1**, **L** = later).
Row numbers are local to their epic, so adding work to one epic never renumbers another.

### E00 — Foundation (Phase 1–2, Sprints 01–07)

| # | Item | Pri | Sprint | Notes |
|---|---|---|---|---|
| 1 | Flow diagrams for F0–F9 including recovery branches | M | 03 | **done** — `user-flows.md` |
| 2 | Navigation model, route tree, 32-screen inventory | M | 03 | **done** — `navigation.md` |
| 3 | Empty / loading / partial / error / working / over-quota state inventory | M | 03 | **done** — `states.md`; NFR-A4 is now a checklist |
| 4 | Low-fidelity wireframes, desktop-led, MVP screens 1–23 and 27 | M | 04 | **done** — `wireframes.md` + canvas in `design/wireframes/` |
| 5 | Responsive plan (1440 → 360) and cross-device constraints | M | 04 | **done** — `wireframes.md` §12–13 |
| 6 | Brand — logo, mascot, type ramp, palette, icon rules, favicon | M | 05 | **done, then replaced** — direction "Daylight" supersedes "Study Desk"; both recorded in `branding.md` §7 |
| 7 | Design tokens (light + dark), type ramp via `next/font`, `cn()` | M | 06 | **done** — `app/globals.css`, `app/layout.tsx`, `lib/utils.ts` |
| 8 | Primitive set — Button, Card, Field/Input/Textarea/Select, Chip/ChipGroup/Tag, SourceChip, MasteryBar, QuotaMeter, EmptyState, ErrorState, Skeleton, Dialog/ConfirmDialog, Menu, SegmentedNav, Avatar | M | 06 | **done** — `components/ui/`, documented in `design-system.md` |
| 9 | `StatusBadge` driven by the shared `JobStatus` vocabulary | M | 06 | **done** — `states.md` §3 encoded in `types/index.ts` |
| 10 | Landing page built from the primitives, as the smoke test | M | 06 | **done** — `app/(marketing)/page.tsx`; hero is the real `Donut` and `MasteryBar`, not a screenshot |
| 10e | Data-visualisation rules and a machine-checked chart palette | M | 06 | **done** — `design-system.md` §3; `Donut`, `TrendChart`, `MasteryBar` tones |
| 10f | Dashboard grid built against sample data, labelled as sample on screen | M | 06 | **done** — `features/dashboard/`; delete the sample file in Sprint 70 |
| 10b | Toasts | M | 10 | **deferred with reason** — nothing to announce until the first server action exists |
| 10c | App shell: `SideNav`, top bar, `FocusShell`, `PageHeader`, theme toggle | M | 07 | **done** — `components/layout/`; `SidePanel` waits for the assistant (Sprint 39) |
| 10d | Domain composites: `EntityCard`, `ListRow`, `QuizOption`, `Flashcard`, `UploadDropzone` | M | 19+ | Belong to their features, not to `ui/` |
| 11 | Route groups `(marketing)` `(auth)` `(app)`, plus `(focus)` reserved | M | 07 | **done** — nested layouts compose, so focus mode needs a sibling group rather than a nested layout |
| 12 | Auth pattern: `src/proxy.ts` optimistic check + `requireSession()` DAL memoised with React `cache()` | M | 07 | **done** — `proxy.ts`, `server/auth/session.ts`. Preview-session branch to delete in Sprint 11 |
| 13 | Error strategy: `AppError` taxonomy with a required `nextStep`, `Result` helpers, `global-error`, shell `error.tsx`, `not-found` | M | 07 | **done** — `lib/errors.ts` + boundaries |
| 14 | AI service abstraction (interface, quotas, usage accounting, citations) | M | 07 | **done** — `lib/ai/types.ts`; providers in Sprint 31 |
| 15 | Background job strategy for long AI work | M | 07 | **done, decided** — Postgres queue with sliced work. `after()` was ruled out: it shares the route duration cap. `server/jobs/types.ts`, `architecture.md` §5 |
| 16 | Update `conventions.md` for Next.js 16 | M | 07 | **done** |

### E01 — Authentication (Phase 3, Sprints 09–12)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | Supabase clients, proxy session refresh, local dev config, env wiring | M | 09 | **done** — `lib/supabase/`, `supabase/config.toml`, `docs/supabase.md`. Creating the *hosted* project needs a Supabase account and is still open |
| 2 | Registration + email verification | M | 10 | **done** — `features/auth/`. Confirmation is a **6-digit code**, not a link. Unverified sign-in is NOT supported; Supabase has no such mode — see `supabase.md` §6 |
| 3 | Sign in, sign out, session persistence | M | 11 | **done** — `LoginForm`, `SignOutItem`, one generic credential error |
| 4 | Route protection via proxy.ts + `requireSession()` DAL | M | 11 | **done** — preview session deleted, `?next=` honoured through `safeNextPath()`, `no-store` on protected routes |
| 5 | Password reset and session-expiry handling | V1 | 12 | **done** — code-based reset, not link; see `supabase.md` §7. Expiry returns to the route via `?next=`; the unsaved-input warning waits for the first real form (Sprint 19+) |
| 6 | Google sign-in | L | — | PRD open decision #3 |

### E02 — Data & storage (Phase 4, Sprints 13–18)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | Schema migrations for the 16 core tables, with keys, indexes, constraints | M | 13 | — |
| 2 | RLS policies on every user-data table | M | 14 | US-C5 |
| 3 | Unauthorized-access test suite | M | 18 | US-C5 |
| 4 | Storage buckets with owner-only policies and signed URLs | M | 16 | US-C5 |
| 5 | Shared Zod schemas + error response standard | M | 17 | Global criterion 4 |
| 6 | Profile table and profile UI | V1 | 15 | US-A5 |
| 7 | Account deletion cascade across DB and storage | V1 | 15 | US-A5, NFR-P3 |

### E03 — Subjects & topics (Phase 5, Sprints 19–24)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | Subject CRUD with color and icon | M | 19 | US-B1 |
| 2 | Cascading subject delete with a counted confirmation | M | 19 | US-B3 |
| 3 | Subject list: cards, search, sort, empty state | M | 20 | US-B2 |
| 4 | Topic CRUD and material/quiz tagging | M | 21 | US-B4 |
| 5 | Subject detail page composed of independent sections | M | 23 | US-B5 |
| 6 | Semester grouping and archiving | V1 | 22 | US-B6 |
| 7 | Organization polish: reordering, filter and search tuning | L | 24 | — |

### E04 — Uploads & materials (Phase 6, Sprints 25–30)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | Upload UI: picker, drag-drop, multi-file, topic tagging | M | 25 | US-C1 |
| 2 | Two-layer validation (type, size, emptiness, parseability) with specific messages | M | 26 | US-C2 |
| 3 | Per-file progress, cancel, retry, failed state | M | 27 | US-C1 |
| 4 | Material library: list, search, filter, sort, rename, delete + storage cleanup | M | 28 | US-C4 |
| 5 | Typed notes as material, with re-processing on edit | M | 30 | US-C3 |
| 6 | In-app PDF/image viewer and download | V1 | 29 | US-C6 |
| 7 | Duplicate detection by content hash | V1 | 26 | — |

### E05 — Processing & RAG (Phase 7, Sprints 31–36)

The highest-risk epic. Nothing downstream works if this is wrong.

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | AI service layer: interface, model config, logging, usage accounting, error taxonomy | M | 31 | US-D5 |
| 2 | Per-user AI quotas and rate limiting | M | 31 | NFR-C1, NFR-S4 |
| 3 | Job runner: queued, retryable, idempotent, status-reporting | M | 31 | US-D1, US-D2 |
| 4 | PDF / DOCX / PPTX extraction + normalization | M | 32 | US-D3 |
| 5 | Chunking with page/slide provenance | M | 34 | US-D3 |
| 6 | Embedding pipeline, pgvector storage, reuse on unchanged material | M | 35 | US-D4, NFR-C4 |
| 7 | Retrieval: vector search, ranking, relevance floor, context assembly, source references | M | 36 | US-D4 |
| 8 | Material status UI with live updates | M | 31–35 | US-D1 |
| 9 | OCR pipeline for images, with confidence signalling | V1 | 33 | US-C7 |

### E06 — Assistant (Phase 8, Sprints 37–42)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | Chat UI with streaming, loading, and error states | M | 37 | US-E1 |
| 2 | Grounded answers with clickable citations | M | 38 | US-E1 |
| 3 | Subject/topic scoping with visible active scope | M | 39 | US-E3 |
| 4 | No-context behavior and labeled general-knowledge fallback | M | 42 | US-E2 |
| 5 | Prompt-injection hardening on extracted text and filenames | M | 42 | NFR-S5 |
| 6 | Conversation persistence, rename, resume, delete | V1 | 40 | US-E4 |
| 7 | Study modes | V1 | 41 | US-E5 |
| 8 | Answer feedback capture | V1 | 42 | — |

### E07 — Reviewer (Phase 9, Sprints 43–48)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | Reviewer generation: summary, key concepts, key terms, with citations | M | 43 | US-F1 |
| 2 | Schema-validated generation output with one retry, then a clean failure | M | 43 | NFR-R4 |
| 3 | Flashcards + review session with saved progress | M | 44 | US-F2 |
| 4 | Practice question generation (MCQ, T/F, Identification) with explanations | M | 45 | US-F3 |
| 5 | Reviewer library: list, search, filter, delete | M | 47 | US-F4 |
| 6 | Reviewer editor with per-section regeneration | V1 | 46 | US-F5 |
| 7 | Duplicate-question filtering and difficulty control | V1 | 48 | US-F5 |

### E08 — Quizzes (Phase 10, Sprints 49–54)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | Quiz generation with count, topic, difficulty | M | 49 | US-G1 |
| 2 | Quiz-taking UI: navigation, progress, exit confirmation, refresh safety | M | 50 | US-G2 |
| 3 | Question-type rendering and answer capture | M | 51 | US-G2 |
| 4 | Atomic submission, scoring, attempt and answer persistence | M | 52 | US-G3 |
| 5 | Identification matching rules (normalization, near-match) | M | 52 | US-G3 |
| 6 | Results screen with explanations and per-topic breakdown | M | 53 | US-G4 |
| 7 | AI-graded short answer with labeling and student override | V1 | 51 | US-G5 |
| 8 | Timer, attempt resume, mock exams | V1 | 50, 54 | US-G6 |

### E09 — Progress (Phase 11, Sprints 55–59)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | Quiz analytics per subject and per quiz | M | 55 | US-H2 |
| 2 | Mastery calculation with documented, in-product formula | M | 56 | US-H1 |
| 3 | Low-evidence handling so thin data is not shown as confidence | M | 56 | US-H1 |
| 4 | Progress views: overall, subject, topic | M | 58 | US-H1 |
| 5 | Weak-topic detection with a stated threshold and direct practice links | M | 59 | US-H3 |
| 6 | Study-time tracking and aggregation | V1 | 57 | US-H4 |
| 7 | Mastery trend | V1 | 56 | US-H4 |

### E10 — Planner (Phase 12, Sprints 60–64)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | Planner schema and event CRUD | V1 | 60 | US-I1 |
| 2 | Calendar month/week/day views with inline editing | V1 | 61 | US-I1 |
| 3 | Deadlines, exam countdown, overdue flagging, priority | V1 | 62 | US-I2 |
| 4 | Study session start/finish with duration capping | V1 | 63 | US-I3 |
| 5 | Smart scheduling suggestions | L | 64 | — |

### E11 — Study plans & dashboard (Phases 13–14, Sprints 65–73)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | Study plan engine over exams, weak topics, results, available time | V1 | 65 | US-J1 |
| 2 | Actionable plan items that launch the activity | V1 | 66 | US-J1 |
| 3 | Today's plan with completion tracking and next-activity pointer | V1 | 67 | US-J1 |
| 4 | Adaptive difficulty and explained recommendations | V1 | 68 | US-J2 |
| 5 | First-run dashboard | M | 70 | US-J3 |
| 6 | Full dashboard with independently loading panels | V1 | 70 | US-J3 |
| 7 | Readiness score with visible inputs | V1 | 71 | US-J3 |
| 8 | Plan analytics | L | 69 | — |
| 9 | Achievements and streaks | L | 72–73 | — |

### E12 — Production hardening (Phase 15, Sprints 74–77)

| # | Item | Pri | Sprint |
|---|---|---|---|
| 1 | Responsive audit across phone, tablet, laptop, desktop | V1 | 74 |
| 2 | Performance: images, bundle, query and AI-call optimization, caching, lazy loading | V1 | 75 |
| 3 | Security audit: auth, RLS, storage, keys, validation, uploads, AI endpoint abuse | V1 | 76 |
| 4 | Production deploy: Vercel, Supabase, domain, HTTPS, monitoring, error tracking, backups | V1 | 77 |

### E13 — Post-V1

| Item | Notes |
|---|---|
| Installable web app (manifest, standalone window) | Roadmap Sprint 78 |
| Offline-tolerant reading | Roadmap Sprint 79 |
| Teacher and school accounts, shared reviewers | Spec-listed future features |
| Notifications | Spec-listed future feature |
| Native mobile clients | Not in this roadmap. Pawgress is a web app; Phases 16–18 are web work |

---

## Risk register

| Risk | Impact | Mitigation | Owner sprint |
|---|---|---|---|
| ~~Long AI jobs exceed serverless request limits~~ | — | **Resolved in Sprint 07.** Postgres queue, sliced work, lease plus sweeper. `after()` was ruled out — it shares the route duration cap. See `architecture.md` §5 | 07 |
| AI cost scales with uploads, uncapped | Unbounded bill from a handful of heavy users | Quotas, page caps, embedding reuse, per-user cost logging | 31 |
| Extraction quality on real teacher files (scanned PDFs, dense decks) | Every downstream feature degrades | Test the pipeline on real files early; detect image-only PDFs and say so | 32 |
| Generated content is generic rather than material-specific | Core value proposition fails | Require citations; treat uncited output as a generation failure | 43 |
| Mixed-language and code-switched material | Poor reviewers for a likely-common case | Test before Sprint 43 (PRD open decision #6) | 43 |
| Mastery formula misleads students | Wrong study recommendations, lost trust | Weighted formula, low-evidence handling, explained in-product | 56 |
| Doc-only sprints 03–04 drift from what gets built | Docs become decoration | Keep wireframes low-fidelity; update these docs when reality diverges | 03–04 |
| Building against pre-16 App Router habits | Deprecated `middleware.ts`, wrong auth gate, blank pages on partial failure | Route conventions verified against the bundled Next.js 16 docs and recorded in `navigation.md` §6; `conventions.md` updated in Sprint 07 | 07 |
