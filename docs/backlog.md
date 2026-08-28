# Acadify — Development Backlog

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
| 25 | Upload UI — drag/drop, multi-file, topic tagging, direct-to-storage | done | bytes bypass Next entirely; typed **notes deferred to Sprint 30** (FR-U5), progress/cancel to 27 |
| 26 | File validation — stored-byte check, PDF encryption/truncation, duplicate detection | done | image-only PDF detection needs the extractor, deferred to 32/33 |
| 27 | Upload progress — per-file bars, cancel, retry, concurrency of 2 | done | XHR not fetch (fetch cannot report request progress); **resumability deliberately deferred** |
| 28 | Material library — list, search, filter by type/status/topic, sort, rename, re-file, delete | done | its own route `/subjects/[id]/materials`; nine job statuses collapse to three filters |
| 29 | Material preview — browser PDF viewer, image preview, metadata, download, delete | done | native viewer, not pdf.js; page deep-links via `#page=N` ready for Sprint 36 |
| 30 | Typed notes — write, edit, file to a topic, re-index on change | done | no migration needed: a note's text IS its `extracted_text`, and the Sprint 13 CHECK constraint already allowed it |
| 31 | AI service layer — provider chain, usage log, quotas, rate limiting | done | migrations through `20260831090000` applied and recorded; **provider switched from Anthropic to Groq → Gemini → OpenAI** at the product owner’s direction |
| 32 | Text extraction — PDF, DOCX, PPTX, normalisation, and the job runner that drives it | done | **migration `20260829120000` also pending.** Needs `JOBS_SECRET` and the `pg_cron` sweeper from `architecture.md` §5 |
| 33 | OCR — reads photos through the vision model, self-reported confidence, correctable transcription | done | two more pending migrations (`20260830090000`, `20260830091000`). Costs AI quota, unlike Tesseract — reasoning in `lib/extraction/ocr.ts` |
| 34 | Chunking — structure-first splitting, page provenance, overlap, subject-scoped storage | done | migration `20260830120000`. `ready` now means chunked, not just extracted |
| 35 | Embeddings — OpenAI text-embedding-3-small, batched and sliced, stored in pgvector | done | no migration — 1536 dims already matched. Needs `EMBEDDINGS_API_KEY`. `ready` now means fully indexed |
| 36 | Retrieval — cosine vector search, relevance floor, per-material diversity, context assembly, the RAG loop | done | migration `20260831090000`. UI is Sprint 37; the relevance floor is uncalibrated until there is real usage |
| 37 | Assistant chat — streaming answers, citations, stop, subject scope, the honest empty case | done | no migration. History is in-session only; persistence is Sprint 40 |
| 40 | Conversation history — new chat, save, resume, rename, delete | done | pulled forward at the product owner’s request; migration `20260829150000`. Turns are saved AFTER streaming, never during |
| — | **Redesign to direction "Daylight"** — floating canvas shell, validated data palette, charts, dashboard built out | done | out of sprint order, at the product owner's direction |

## Next three

| Sprint | Item | Depends on |
|---|---|---|
| 38 | Material-aware questions — explain, hint, why was I wrong | 37 |
| 39 | Subject context — scope inherited from the page, topic scoping | 38 |

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
| 5 | Typed notes as material, with re-processing on edit | M | 30 | **done** — US-C3. Stored as `kind='note'` with the text in `extracted_text`, so every downstream consumer reads one column whatever the material came from. Editing hashes the text first: a title-only change keeps its chunks and embeddings, a text change deletes them so the next indexing run cannot cite a removed sentence |
| 6 | In-app PDF/image viewer and download | V1 | 29 | **done** — US-C6. Browser PDF viewer rather than pdf.js: ~1 MB of JS to render what the browser already renders, on metered data, and `#page=N` deep links come free. Traded against iframed PDFs being unreliable on mobile, so narrow viewports get a real Open button instead of a blank frame |
| 8 | pdf.js, if page highlighting or in-app text selection is ever required | L | — | Only `MaterialPreview.tsx` would change |
| 7 | Duplicate detection by content hash | V1 | 26 | — |

### E05 — Processing & RAG (Phase 7, Sprints 31–36)

The highest-risk epic. Nothing downstream works if this is wrong.

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | AI service layer: three-provider chain with pricing, request logging, usage accounting, error mapping | M | 31 | **done** — US-D5. Groq → Gemini → OpenAI over one OpenAI-protocol SDK; `chat.completions.parse()` with a Zod schema so malformed output never reaches a screen, and no raw `complete()` for a feature to route around it. `npm run ai:test` |
| 2 | Per-user AI quotas and rate limiting | M | 31 | **done** — NFR-C1, NFR-S4. Counted from `ai_calls`, so one source of truth; claimed BEFORE the call so a crashed generation still counts |
| 3 | Job runner: queued, retryable, idempotent, status-reporting | M | 32 | **done** — lease-based claim via `claim_jobs()`, retry under `MAX_JOB_ATTEMPTS` without alarming the student, terminal failure surfaced with copy they can act on. Kicked immediately on enqueue via `after()`; swept every minute by `pg_cron` |
| 3b | Embeddings provider | M | 35 | **done** — a separate service, not a method on `AiService`. Groq publishes no embeddings endpoint and the vector width is fixed at 1536 by the schema, so embeddings cannot follow whichever chat provider answered |
| 4 | PDF / DOCX / PPTX extraction + normalization | M | 32 | **done** — US-D3. `unpdf` for PDF (per-page, so citations get page numbers); DOCX and PPTX read directly from their zipped XML with `fflate`, because no library gives slide numbers and both formats are a handful of tag matches. Normalisation rejoins hyphens, drops running page numbers, and detects repeated headers/footers rather than being told about them |
| 4b | Image-only PDF detection | M | 32 | **done** — deferred from Sprint 26 because it needs the extractor. A PDF yielding under 40 characters is named as a scan, with what to do instead |
| 5 | Chunking with page/slide provenance | M | 34 | **done** — US-D3. ~350 tokens with 15% overlap, split on the document's own structure (blank line, then line, then sentence) before any arithmetic. Page ranges come from the `page_offsets` column added in Sprint 32, so a chunk spanning a page break reports both pages. `subject_id` denormalised onto chunks for scoped vector search; topic deliberately not, because re-filing a material would leave it stale |
| 6 | Embedding pipeline, pgvector storage, reuse on unchanged material | M | 35 | **done** — US-D4, NFR-C4. OpenAI text-embedding-3-small at 1536 dims, so no migration. Batched against all three documented API limits at once; sliced across invocations — the first genuine use of the `continue` path from Sprint 07. Idempotent by SELECTION (only chunks with a null embedding), so a retry or a second worker converge rather than duplicate |
| 6b | Stall guard on re-enqueued slices | M | 35 | **done** — a slice that asks for another turn without advancing is failed rather than trusted. A paid loop with no exit is the worst failure mode in the runner |
| 7 | Retrieval: vector search, ranking, relevance floor, context assembly, source references | M | 36 | **done** — US-D4. `match_chunks` is `security invoker`, so RLS scopes a search to the caller's own chunks. Over-fetches then trims, because HNSW plus a `where` clause under-returns. Per-material diversity cap so one long lecture series cannot take every slot from a better two-page handout. Context is assembled in READING order, not score order |
| 7b | Calibrate the relevance floor | M | — | 0.25 is a starting point chosen deliberately permissive: a missed relevant chunk is worse than a marginal one, because the model can ignore a weak chunk but cannot invent a missing one. Needs real questions against real material to tune |
| 8 | Material status UI with live updates | M | 31–35 | US-D1 |
| 9 | OCR pipeline for images, with confidence signalling | V1 | 33 | **done** — US-C7. Reads photos through the vision model rather than Tesseract: handwriting is the main case, and Tesseract is poor at it. Confidence is asked for and stored, so a shaky reading is flagged in the library and on the viewer, and the student can correct the text — which then stops being a guess |
| 9b | Shrink photos in the browser before upload | V1 | — | `features/settings/downscale.ts` already does this for avatars. Would remove the 5 MB OCR refusal, cut storage and save metered data. Left as a follow-up rather than changing a working upload path mid-sprint |
| 9c | HEIC conversion | L | — | The API does not accept HEIC, so an iPhone photo is refused with instructions to change the camera format. Converting in the browser is the real fix and needs a decoder browsers do not all have |

### E06 — Assistant (Phase 8, Sprints 37–42)

| # | Item | Pri | Sprint | Story |
|---|---|---|---|---|
| 1 | Chat UI with streaming, loading, and error states | M | 37 | **done** — US-E1. NDJSON over a route handler rather than a Server Action, because a stream that cannot be ABORTED keeps spending tokens for a student who has left. Stop button, citations as source chips, and the honest empty case with an explicit opt-in |
| 1b | Conversation history | V1 | 40 | In-session only for now. A reload starts fresh, which is honest — a half-built persistence layer that loses messages on refresh is worse than one that never claimed to keep them |
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
| Native mobile clients | Not in this roadmap. Acadify is a web app; Phases 16–18 are web work |

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
