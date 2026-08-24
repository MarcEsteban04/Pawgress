# Pawgress — User Stories & Acceptance Criteria

**Sprint 02 deliverable.** Every MVP requirement in [`requirements.md`](requirements.md) is covered
by at least one story here. Acceptance criteria are written to be verifiable — a criterion that
cannot be checked by looking at the running app is not a criterion.

Conventions:

- **ID** `US-<area><n>`. `Covers` lists the requirement IDs satisfied.
- `Pri` — **M** = MVP, **V1** = V1. Post-V1 items are not storied yet.
- Every story implicitly inherits the global criteria in [§Global](#global-acceptance-criteria).

---

## Epic A — Accounts

### US-A1 — Register (M) · Covers FR-A1, FR-A2

*As a student, I want to create an account with my email so my study material is saved to me.*

- Given valid email and password (≥ 8 chars), when I submit, then an account is created and I am told
  to check my email
- Password strength is shown live; submit is blocked below the minimum
- An already-registered email produces a clear message and a link to sign in — and does not reveal
  whether an unverified account exists beyond that
- Malformed email, network failure, and provider failure each produce a distinct, human message
- An unverified account can sign in but is prompted to verify, and the prompt can resend the email

### US-A2 — Sign in and stay signed in (M) · Covers FR-A3

*As a student, I want to stay signed in so I do not re-authenticate every time I open the app.*

- Correct credentials land me on the dashboard
- Wrong credentials produce one generic failure message and do not say which field was wrong
- Closing and reopening the browser keeps me signed in
- Sign out clears the session; the back button does not restore authenticated content

### US-A3 — Protected routes (M) · Covers FR-A4

*As a student, I want my pages to be private.*

- Visiting an app route while signed out redirects to sign-in
- After signing in I land on the route I originally requested, not a generic home page
- App routes are never server-rendered with another user's data

### US-A4 — Reset a forgotten password (V1) · Covers FR-A5, FR-A6

- Requesting a reset always shows the same confirmation, whether or not the email exists
- The reset link is single-use and expires
- An expired session mid-task returns me to the same page after re-auth, with unsaved input warned about rather than silently lost

### US-A5 — Manage my profile (V1) · Covers FR-A7, FR-A8

- I can set display name, avatar, year level, school, and preferred session length
- Deleting my account asks me to type a confirmation, then removes my uploads, extracted text,
  embeddings, and generated content

---

## Epic B — Subjects & topics

### US-B1 — Create a subject (M) · Covers FR-S1

*As a student, I want a place per class so my materials are not one big pile.*

- I can create a subject with a name, color, and icon; name is required and length-limited
- Duplicate names are allowed but flagged ("you already have a subject called this")
- Rename takes effect everywhere the subject appears
- Creation succeeds from a phone-width screen

### US-B2 — See my subjects (M) · Covers FR-S2

- Subjects list as cards showing name, color/icon, material count, and last activity
- Search filters by name; sort by name, recent activity, or created date
- With no subjects, the empty state explains what a subject is and offers one action: create one
- List loads with skeletons, never a blank screen

### US-B3 — Delete a subject safely (M) · Covers FR-S4

*As a student, I want to delete a subject without accidentally destroying a term of work.*

- The confirmation names exactly what will be deleted, with counts (topics, materials, reviewers, quizzes, attempts)
- Deletion is atomic — a partial delete never leaves orphaned materials or chunks
- Storage objects for the deleted materials are removed, not just their rows

### US-B4 — Organize with topics (M) · Covers FR-S3

- I can create, rename, and delete topics within a subject
- A material and a quiz can be tagged to a topic
- Deleting a topic keeps its materials, detaching them to the subject, and says so before I confirm

### US-B5 — Subject dashboard (M) · Covers FR-S5

- The subject page shows its materials, topics, overall progress, weakest topics, and recent activity
- Each section has its own empty state and never blocks the others from rendering
- Every section links to the action that fills it (upload, generate, quiz)

### US-B6 — Semesters and archiving (V1) · Covers FR-S6

- A subject can be assigned a semester and academic year, and the list can group by them
- Archiving hides a subject from the main list while keeping its data and progress readable

---

## Epic C — Upload & materials

### US-C1 — Upload a file (M) · Covers FR-U1, FR-U3

*As a student, I want to upload the handout my teacher gave us.*

- I can pick or drag PDF, DOCX, or PPTX into a subject, optionally tagging a topic
- Each file shows its own progress bar, and can be cancelled mid-upload
- Multiple files upload in one action; one file failing does not fail the others
- A failed upload offers retry without re-picking the file
- Navigating away and back shows the correct current state of each upload

### US-C2 — Be told why a file was rejected (M) · Covers FR-U2

- Oversized, unsupported, empty, or corrupt files are rejected with a message naming the reason and
  the limit, and suggesting a next step
- A password-protected or image-only PDF is identified as such, not reported as a generic failure
- Validation happens client-side for instant feedback and again server-side as the real gate

### US-C3 — Write notes directly (M) · Covers FR-U5

- I can create a titled text note in a subject/topic and edit it later
- A note is processed as source material like any uploaded file
- Editing a note re-processes it and supersedes its old chunks rather than duplicating them

### US-C4 — Manage my library (M) · Covers FR-U4

- Materials list with name, type, size, upload date, topic, and processing status
- Search by name; filter by type and status; sort by date or name
- Rename and delete, with delete confirmed and storage cleaned up

### US-C5 — Know my files are private (M) · Covers FR-U9, NFR-S1, NFR-S2

- Another signed-in user cannot read my materials, chunks, reviewers, quizzes, or attempts — enforced
  by RLS, verified by test
- Download links are signed and short-lived; a copied link stops working after expiry

### US-C6 — Preview a material (V1) · Covers FR-U6

- PDFs and images render in-app; other types offer download
- Metadata shows page count, size, upload date, and processing status

### US-C7 — Photograph my notes (V1) · Covers FR-U7

- I can upload JPG/PNG/HEIC and have text extracted by OCR
- Low-confidence extraction is flagged so I know the reviewer may be thin, and I can edit the text
- OCR failure is distinguishable from upload failure

---

## Epic D — Processing

### US-D1 — Watch my material get processed (M) · Covers FR-P4

*As a student, I want to know whether the app has actually read my file yet.*

- Status is visible per material: queued → extracting → embedding → ready → failed
- Status updates without a manual refresh
- I can leave the page and come back to accurate status
- Generation actions are disabled with an explanation until the material is `ready`

### US-D2 — Recover a failed material (M) · Covers FR-P5

- A failed material states the stage and reason it failed
- Retry re-runs from the failed stage without re-uploading
- A retry never creates duplicate chunks or embeddings (NFR-R1)
- Repeated failure on the same file stops retrying automatically and says so

### US-D3 — Text extracted faithfully (M) · Covers FR-P1, FR-P2

- Text is extracted from PDF, DOCX, and PPTX with page or slide numbers retained per chunk
- Headers, footers, and page numbers are stripped; hyphenated line breaks are rejoined
- Chunks respect semantic boundaries where structure exists rather than cutting mid-sentence at a fixed length

### US-D4 — Retrieval that cites (M) · Covers FR-P3, FR-P6

- A question returns ranked chunks above a relevance floor
- Each retrieved chunk carries material name and page/slide, and that reference reaches the UI
- Retrieval only ever searches the asking user's own materials

### US-D5 — One AI service layer (M) · Covers FR-P8, NFR-C3

- All model calls route through a single provider-agnostic interface
- Every call logs model, token counts, latency, outcome, and cost against a user
- Swapping the model is a configuration change, not a code change across features

---

## Epic E — Study assistant

### US-E1 — Ask about my material (M) · Covers FR-C1, FR-C2

*As a student, I want to ask what a slide means without reading the whole deck.*

- I ask a question and the answer streams in
- The answer lists its sources; opening one opens that material
- Loading, streaming, and error states are distinct, and a failed answer can be retried
- The conversation stays readable at 360 px width

### US-E2 — An assistant that admits ignorance (M) · Covers FR-C3

- When retrieval finds nothing relevant, the assistant says the material does not cover it
- It then offers a general-knowledge answer, clearly labeled as not from my material
- It does not invent citations, page numbers, or material names

### US-E3 — Subject-aware assistant (M) · Covers FR-C4

- The assistant defaults to the subject/topic I am in, and shows which scope is active
- I can widen scope to the whole subject or all subjects

### US-E4 — Keep my conversations (V1) · Covers FR-C5

- Conversations are saved, listed newest-first, resumable, renameable, and deletable
- A resumed conversation keeps its context

### US-E5 — Study modes (V1) · Covers FR-C6

- Explain, Tutor, Hint, Summarize, and Quiz me are selectable and behave measurably differently
- Tutor and Hint do not hand over final answers to a graded item (PRD open decision #5)

---

## Epic F — Reviewer generator

### US-F1 — Generate a reviewer (M) · Covers FR-R1

*As a student who has not read the material, I want a summary I can trust.*

- I select one or more `ready` materials and generate a reviewer
- Output contains a summary, key concepts, and key terms, each citing where it came from
- Generation shows progress and can be cancelled
- A partial or malformed model response never renders as broken content — it is reported as a failure and can be retried
- The reviewer content is about my material, not generic textbook filler

### US-F2 — Flashcards (M) · Covers FR-R2

- Flashcards are generated with a question front and answer back
- I can flip, mark known/unknown, and move through a session
- Session results are saved so a resumed session does not restart from zero
- Cards are usable by keyboard and by touch

### US-F3 — Practice questions (M) · Covers FR-R3

- MCQ, True/False, and Identification questions are generated with the correct answer and an explanation
- MCQ distractors are plausible and exactly one option is correct
- Every question is answerable from the source material

### US-F4 — Reviewer library (M) · Covers FR-R4

- Reviewers are saved automatically, listed with subject and date, searchable, filterable, and deletable
- Opening a saved reviewer never re-runs generation

### US-F5 — Fix what the AI got wrong (V1) · Covers FR-R5, FR-R6, FR-R7

- I can edit text, delete a section, and regenerate one section without regenerating the whole reviewer
- Duplicate or near-duplicate questions are filtered before display
- I can request easy, medium, or hard, and the difference is visible

---

## Epic G — Quizzes

### US-G1 — Generate a quiz (M) · Covers FR-Q1, FR-Q2

- I choose subject, optional topic, question count, and difficulty
- Questions come from my material and cover more than one part of it
- Generation failure is reported without creating an empty quiz

### US-G2 — Take a quiz (M) · Covers FR-Q3

- I see question number, total, and progress
- I can move between questions and change an answer before submitting
- Leaving mid-quiz asks for confirmation
- A refresh does not silently lose answered questions

### US-G3 — Submit and be scored (M) · Covers FR-Q4, FR-Q6

- Submitting scores immediately, records the attempt and every answer, and shows the score
- Scoring is atomic — an interrupted submit does not save a half-graded attempt (NFR-R2)
- Identification answers are matched case- and whitespace-insensitively, with a reasonable near-match rule
- Retaking creates a new attempt; history is preserved

### US-G4 — Learn from the results (M) · Covers FR-Q5

- Results show score, each question with my answer and the correct one, and an explanation
- The topics covered are listed with how I did on each
- Results link to the reviewer sections and materials behind the questions I missed

### US-G5 — Short answer, graded honestly (V1) · Covers FR-Q7

- Short-answer items are graded by AI and visibly labeled AI-graded
- I can dispute a grade and override it; the override is recorded and counted
- The grade shows the reasoning, so an unfair mark is understandable

### US-G6 — Mock exam (V1) · Covers FR-Q8, FR-Q9, FR-Q10

- A mock exam draws a larger randomized set across a subject with a timer
- The timer survives a refresh and expiry auto-submits
- An interrupted attempt can be resumed rather than lost
- Results include a readiness signal for the upcoming exam

---

## Epic H — Progress

### US-H1 — See what I have mastered (M) · Covers FR-G1, FR-G4

- Each topic shows a mastery percentage with the number of questions it is based on
- Low-evidence topics are marked as such rather than shown as confident numbers
- Progress is viewable overall, per subject, and per topic
- The formula is explained in-product

### US-H2 — See my quiz performance (M) · Covers FR-G2

- Per subject: attempts, latest score, best score, average
- Per quiz: attempt history in order

### US-H3 — Know what to fix (M) · Covers FR-G3

- Weak topics are ranked ascending by mastery, with the threshold stated
- Each weak topic links directly to reviewing or practising it
- With too little data, the app says so instead of naming a false weakest topic

### US-H4 — Track study time (V1) · Covers FR-G5, FR-G6

- Sessions record duration against a subject/topic, aggregated daily and weekly
- Mastery trend per topic is shown as improving, flat, or declining

---

## Epic I — Planner (V1)

### US-I1 — Record academic events · Covers FR-N1, FR-N2

- I can create an exam, quiz, assignment, project, presentation, or study session with subject, date, and optional time
- Month, week, and day views render the events; I can edit and delete inline
- Timezone handling is consistent — an event does not shift day

### US-I2 — Never miss a deadline · Covers FR-N3

- Upcoming deadlines are listed with days remaining; the next exam is counted down
- Overdue items are flagged distinctly, by more than color
- Priority is settable and affects ordering

### US-I3 — Run a study session · Covers FR-N4

- I can start a session against a subject/topic, then finish it, and the duration is recorded
- A session left running is capped rather than recording an absurd duration

---

## Epic J — Study plan & dashboard (V1)

### US-J1 — Get a plan for today · Covers FR-L1, FR-L2, FR-L3

- Given upcoming exams, weak topics, quiz history, and available minutes, I get a plan for today
- Each item names subject, activity, and minutes, and starts that activity in one click
- Items can be completed, and the plan shows what is left and what is next
- With no data yet, the plan tells me what to do to get one instead of inventing items

### US-J2 — A plan that reacts · Covers FR-L4

- A poor quiz result increases review and practice on that topic in the next plan
- A strong result raises difficulty or advances to the next topic
- I can see why an item is in my plan

### US-J3 — A dashboard that answers "what now?" · Covers FR-D1, FR-D2, FR-D3

- The dashboard shows greeting, next exam, readiness, today's plan, weak topics, upcoming events, and recent activity
- Readiness shows the inputs behind the number
- A brand-new account sees a first-run version pointing at one action: create a subject and upload something
- Each panel loads and fails independently — one slow query does not blank the page

---

## Global acceptance criteria

Apply to every story; not repeated above.

1. Works from 1920 px down to 360 px with no horizontal scroll at any width (NFR-A2)
2. Keyboard reachable end to end, with visible focus and accessible names — a laptop student should
   not need the mouse mid-session (NFR-A1)
3. Empty, loading, partial, and error states defined and implemented (NFR-A4)
4. All input validated with Zod at the server boundary; client validation is a convenience only (NFR-R3)
5. Data access is owner-scoped and enforced by RLS (NFR-S1)
6. Errors say what happened and what to do next; no raw stack traces or provider errors
7. Any AI-touching action respects the user quota and reports being over it clearly (NFR-C1)
8. Mutations are safe to repeat — a double-click or retry does not double-write (NFR-R1)
9. `npm run check` passes
