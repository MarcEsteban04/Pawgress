# Acadify — Project Development Roadmap

## Goal

Build **Acadify** from initial project setup to a production-ready **Website**.

Acadify is an AI-powered study companion for high school and college students. The core product is based on the provided specification:

- Upload and organize study materials
- AI study assistant
- AI reviewer generator
- AI quiz generator
- Progress tracking
- Academic planner
- Personalized study plans
- Main dashboard
- Learning cycle: Upload → AI Analyze → Review → Practice → Quiz → Track → Identify Weaknesses → Personalized Plan → Improve

### Source Technology Direction

The original specification defines:

- **Web frontend:** Next.js, TypeScript, React, Tailwind CSS, shadcn/ui
- **Backend:** Supabase, PostgreSQL, Supabase Auth, Supabase Storage, Row Level Security
- **AI:** LLM API, embeddings, vector search / RAG
- **Deployment:** Vercel + Supabase
- **Future mobile app:** Android/iOS

Acadify is a **responsive web application** — it runs in a browser on desktops, laptops, tablets and
phones. There is no native app and no app store: the final deliverable is a production website.
Native mobile clients stay a post-V1 possibility, outside this roadmap.

---

# Roadmap Structure

**Total: 83 sprints**

Sprint numbering runs 01–84. Sprint 08 (CI/CD foundation) was removed and its number retired, so 08 is intentionally absent — every later sprint keeps its original number to stay consistent with the other planning docs.

Each sprint should represent one focused development milestone. A sprint can be shortened or expanded depending on workload, but the order is intentional.

### Phases

| Phase | Sprints | Focus |
|---|---:|---|
| 1 | 01–04 | Product foundation |
| 2 | 05–07 | Design system & architecture |
| 3 | 09–12 | Authentication |
| 4 | 13–18 | Database & storage |
| 5 | 19–24 | Subjects & organization |
| 6 | 25–30 | File uploads |
| 7 | 31–36 | AI document processing |
| 8 | 37–42 | AI study assistant |
| 9 | 43–48 | Reviewer generation |
| 10 | 49–54 | Quiz system |
| 11 | 55–59 | Progress tracking |
| 12 | 60–64 | Academic planner |
| 13 | 65–69 | Personalized study plans |
| 14 | 70–73 | Dashboard & gamification |
| 15 | 74–77 | Web production hardening |
| 16 | 78–80 | Installable web app & offline tolerance |
| 17 | 81–83 | Cross-browser & accessibility QA |
| 18 | 84 | Public launch |

---

# Phase 1 — Product Foundation

## Sprint 01 — Project Initialization

### Goals
- Define the Acadify project structure.
- Initialize Git repository.
- Create development branches.
- Configure environment variables.
- Establish coding conventions.

### Deliverables
- Git repository
- Next.js project
- TypeScript configuration
- ESLint
- Prettier
- `.env.example`
- README
- Initial folder architecture

---

## Sprint 02 — Product Requirements

### Goals
- Convert the Acadify specification into development requirements.
- Define MVP versus future functionality.
- Identify all primary user flows.

### Deliverables
- Product requirements document
- MVP feature list
- User stories
- Acceptance criteria
- Initial development backlog

---

## Sprint 03 — User Flow Mapping

### Goals
Map the primary student journey:

```text
Sign Up
   ↓
Create Profile
   ↓
Create Subject
   ↓
Upload Material
   ↓
AI Processes Material
   ↓
Review Material
   ↓
Practice
   ↓
Quiz
   ↓
Track Results
   ↓
Identify Weak Topics
   ↓
Study Plan
   ↓
Improve
```

### Deliverables
- User flow diagrams
- Navigation structure
- Screen inventory
- Empty/loading/error state inventory

---

## Sprint 04 — UX Wireframes

### Screens
- Landing page
- Login
- Registration
- Dashboard
- Subjects
- Subject details
- Upload
- Material viewer
- AI assistant
- Reviewer
- Quiz
- Results
- Progress
- Planner
- Study plan
- Profile/settings

### Deliverables
- Low-fidelity wireframes
- Mobile considerations
- Responsive layout plan

---

# Phase 2 — Design System & Architecture

## Sprint 05 — Acadify Branding

### Goals
Create the visual identity.

### Deliverables
- Acadify logo
- Animal mascot direction
- Typography
- Brand colors
- Icon style
- App icon concept
- Favicon

---

## Sprint 06 — Design System

### Components
- Buttons
- Inputs
- Selects
- Cards
- Dialogs
- Tabs
- Dropdowns
- Toasts
- Progress bars
- Badges
- Avatar
- Skeleton loaders

### Deliverables
- Acadify design tokens (light and dark)
- Component standards
- Primitive set built on Radix + cva, in the shadcn/ui architecture

> The specification names shadcn/ui. We use its architecture — Radix primitives, `cva` variants,
> `tailwind-merge` — but author the components in-repo rather than pulling them from the registry.
> Reason: registry components ship their own token vocabulary (`--background`, `--foreground`), which
> would fight the Acadify brand tokens. See `docs/design-system.md` §7.

---

## Sprint 07 — Application Architecture

### Goals
Define application boundaries.

### Deliverables
- Frontend architecture
- API/service architecture
- Supabase architecture
- AI service abstraction
- Storage architecture
- Error-handling strategy

---

# Phase 3 — Authentication

## Sprint 09 — Supabase Setup

### Deliverables
- Supabase project
- PostgreSQL connection
- Environment configuration
- Local development configuration

---

## Sprint 10 — Registration

### Features
- Email registration
- Password validation
- Duplicate account handling
- Registration errors
- Email verification

---

## Sprint 11 — Login & Logout

### Features
- Login
- Logout
- Session persistence
- Protected routes
- Authentication middleware

---

## Sprint 12 — Account Recovery

### Features
- Forgot password
- Password reset
- Email verification handling
- Session expiration handling

---

# Phase 4 — Database & Storage

## Sprint 13 — Database Schema

### Core tables

```text
profiles
subjects
topics
materials
material_chunks
reviewers
flashcards
quizzes
quiz_questions
quiz_attempts
quiz_answers
study_sessions
planner_events
study_plans
progress
achievements
```

### Deliverables
- Initial SQL migrations
- Foreign keys
- Indexes
- Constraints

---

## Sprint 14 — Row Level Security

### Goals
Ensure students can only access their own data.

### Deliverables
- RLS policies
- Ownership rules
- Security tests

---

## Sprint 15 — User Profiles

### Features
- Name
- Profile picture
- Grade/year level
- School
- Preferred study duration
- Learning preferences

---

## Sprint 16 — Supabase Storage

### Goals
Create secure storage for uploaded study materials.

### Deliverables
- Storage buckets
- File ownership rules
- Upload permissions
- Download permissions
- Delete permissions

---

## Sprint 17 — Data Validation

### Deliverables
- Schema validation
- API validation
- File validation
- Input sanitization
- Error response standards

---

## Sprint 18 — Database Testing *(skipped)*

**Skipped at the product owner's direction — verified manually instead.**

Most of this sprint's list was already automated by then, in `npm run db:test:rls` (27 assertions,
built across Sprints 14 and 16) and the Sprint 19 subject smoke test:

| Item | Covered by |
|---|---|
| RLS | `db:test:rls` — isolation, cross-parent writes, ownership handover |
| Unauthorized access | `db:test:rls` — anon and cross-user, tables and storage |
| Foreign keys | `db:test:rls` composite-key checks; cascade checks on delete |
| CRUD operations | Sprint 19 smoke test — create, rename, delete, cascade |
| **Concurrent requests** | **Not covered.** Nothing exercises two writers racing for the same row |

The gap worth naming is the last one. It has no consequence yet — every write so far is a single
row owned by one student — and it starts to matter at Sprint 52, where two tabs can submit the same
quiz attempt, and Sprint 31, where a worker and a retry can claim the same job.

---

# Phase 5 — Subjects & Organization

## Sprint 19 — Subject Creation

### Features
- Create subject
- Edit subject
- Delete subject
- Subject color/icon

---

## Sprint 20 — Subject List

### Features
- Search
- Sorting
- Filtering
- Empty state
- Subject cards

---

## Sprint 21 — Topic Management

### Features
- Create topic
- Rename topic
- Delete topic
- Topic progress

---

## Sprint 22 — Semester Organization

### Features
- Semester
- Academic year
- Subject grouping
- Archive subjects

---

## Sprint 23 — Subject Dashboard

### Show
- Materials
- Topics
- Progress
- Upcoming quizzes
- Weak topics
- Recent activity

---

## Sprint 24 — Organization Polish

### Deliverables
- Drag/reorder where useful
- Better filtering
- Search optimization
- Empty states
- Loading states
- Error states

---

# Phase 6 — File Uploads

## Sprint 25 — Upload UI

### Supported formats
- PDF
- PPTX
- DOCX
- Images
- Notes
- Activities

---

## Sprint 26 — File Validation

### Validate
- File type
- File size
- File name
- Duplicate files
- Corrupted files

---

## Sprint 27 — Upload Progress

### Features
- Upload percentage
- Cancel upload
- Retry upload
- Failed upload state

---

## Sprint 28 — Material Library

### Features
- List files
- Search files
- Filter by type
- Sort by date
- Rename
- Delete

---

## Sprint 29 — Material Viewer

### Features
- PDF preview
- Image preview
- Document metadata
- Download
- Delete

---

## Sprint 30 — Notes & Activities

### Features
- Create text notes
- Edit notes
- Attach notes to subjects/topics
- Convert notes into AI study material

---

# Phase 7 — AI Document Processing

## Sprint 31 — AI Service Layer

### Goals
Create a provider-independent AI abstraction.

### Deliverables
- AI service interface
- Model configuration
- Request logging
- Error handling
- Usage tracking

---

## Sprint 32 — Text Extraction

### Goals
Extract text from uploaded materials.

### Deliverables
- PDF extraction
- DOCX extraction
- PPTX extraction
- Text normalization

---

## Sprint 33 — OCR

### Goals
Extract text from images.

### Deliverables
- OCR pipeline
- Image preprocessing
- OCR failure handling

---

## Sprint 34 — Document Chunking

### Goals
Split documents into useful semantic chunks.

### Deliverables
- Chunking strategy
- Metadata
- Subject/topic association
- Chunk storage

---

## Sprint 35 — Embeddings

### Goals
Generate embeddings for searchable content.

### Deliverables
- Embedding pipeline
- Vector storage
- Embedding regeneration
- Failure/retry handling

---

## Sprint 36 — RAG Pipeline

### Goals
Implement:

```text
Question
   ↓
Embedding
   ↓
Vector Search
   ↓
Relevant Chunks
   ↓
LLM
   ↓
Grounded Answer
```

### Deliverables
- Vector search
- Retrieval ranking
- Context assembly
- Source references

---

# Phase 8 — AI Study Assistant

## Sprint 37 — Chat UI

### Features
- Message history
- User messages
- AI responses
- Loading state
- Error state

---

## Sprint 38 — Material-Aware Questions

### Features
Ask:

- "Explain this topic."
- "Give me a hint."
- "Why is my answer wrong?"
- "Make this easier to understand."

---

## Sprint 39 — Subject Context

### Goals
Make AI aware of the active subject and topic.

---

## Sprint 40 — Conversation History

### Features
- Save conversations
- Rename conversations
- Delete conversations
- Continue previous conversations

---

## Sprint 41 — Study Modes

### Modes
- Explain
- Tutor
- Hint
- Summarize
- Quiz me

---

## Sprint 42 — AI Safety & Quality

### Goals
- Reduce hallucinations
- Cite uploaded sources
- Handle missing information
- Refuse unsupported claims
- Add AI feedback mechanism

---

# Phase 9 — AI Reviewer Generator

## Sprint 43 — Reviewer Generator

### Generate
- Reviewer
- Summary
- Key concepts
- Key terms

---

## Sprint 44 — Flashcards

### Features
- Generate flashcards
- Flip card
- Mark known/unknown
- Review session

---

## Sprint 45 — Practice Questions

### Generate
- Multiple choice
- True/False
- Identification
- Short answer

---

## Sprint 46 — Reviewer Editor

### Features
- Edit generated content
- Delete sections
- Add notes
- Regenerate sections

---

## Sprint 47 — Reviewer Library

### Features
- Save reviewer
- Search reviewer
- Filter by subject
- Duplicate reviewer
- Delete reviewer

---

## Sprint 48 — Reviewer Quality

### Goals
- Improve prompts
- Prevent duplicate questions
- Verify generated answers
- Improve difficulty control

---

# Phase 10 — Quiz System

## Sprint 49 — Quiz Creation

### Features
- Generate quiz from material
- Choose topic
- Choose difficulty
- Choose number of questions

---

## Sprint 50 — Quiz Interface

### Features
- Question navigation
- Answer selection
- Progress indicator
- Timer option
- Exit confirmation

---

## Sprint 51 — Question Types

Implement:

- Multiple choice
- True/False
- Identification
- Short answer

---

## Sprint 52 — Quiz Submission

### Features
- Submit answers
- Calculate score
- Record attempt
- Correct/incorrect states

---

## Sprint 53 — Quiz Results

### Show
- Score
- Correct answers
- Incorrect answers
- Weak topics
- Explanations

---

## Sprint 54 — Mock Exams

### Features
- Larger question sets
- Exam timer
- Randomized questions
- Final score
- Exam readiness indicator

---

# Phase 11 — Progress Tracking

## Sprint 55 — Quiz Analytics

### Track
- Attempts
- Scores
- Average score
- Best score
- Recent score

---

## Sprint 56 — Topic Mastery

### Track
- Topic mastery percentage
- Improvement
- Weak topics
- Strong topics

---

## Sprint 57 — Study Time

### Track
- Study sessions
- Minutes studied
- Daily study time
- Weekly study time

---

## Sprint 58 — Progress Dashboard

### Show
- Overall progress
- Subject progress
- Topic progress
- Quiz performance
- Study time

---

## Sprint 59 — Weakness Detection

### Goals
Identify topics requiring additional practice.

Example:

```text
Genetics       42%
Inheritance    51%
Photosynthesis 82%
```

---

# Phase 12 — Academic Planner

## Sprint 60 — Planner Database

### Events
- Exams
- Quizzes
- Assignments
- Projects
- Presentations
- Study sessions

---

## Sprint 61 — Calendar UI

### Features
- Monthly calendar
- Weekly view
- Daily view
- Event creation
- Event editing

---

## Sprint 62 — Deadlines

### Features
- Upcoming deadlines
- Exam countdown
- Overdue assignments
- Priority levels

---

## Sprint 63 — Study Sessions

### Features
- Schedule session
- Start session
- Finish session
- Record duration
- Link session to subject/topic

---

## Sprint 64 — Smart Scheduling

### Goals
Recommend study sessions around:

- Upcoming exams
- Deadlines
- Weak topics
- Available time

---

# Phase 13 — Personalized Study Plans

## Sprint 65 — Study Plan Engine

### Inputs
- Upcoming exams
- Weak topics
- Quiz results
- Available time
- Study history

---

## Sprint 66 — Study Recommendation

Generate recommendations such as:

```text
Study Biology — 35 minutes

10 min — Review
15 min — Practice
10 min — Flashcards
```

---

## Sprint 67 — Daily Plan

### Features
- Today's plan
- Completion tracking
- Remaining tasks
- Recommended next activity

---

## Sprint 68 — Adaptive Plans

### Behavior

If the student performs poorly:

```text
Quiz
 ↓
Weak result
 ↓
More review
 ↓
More practice
 ↓
Retry quiz
```

If the student performs well:

```text
Quiz
 ↓
Strong result
 ↓
Increase difficulty
 ↓
Move to next topic
```

---

## Sprint 69 — Plan Analytics

### Track
- Planned study time
- Completed study time
- Plan completion
- Recommended vs completed
- Improvement after plans

---

# Phase 14 — Dashboard & Gamification

## Sprint 70 — Main Dashboard

The dashboard should answer:

> **"What should I do today?"**

### Components
- Greeting
- Next exam
- Readiness
- Today's study plan
- Weak topics
- Upcoming events
- Recent activity

---

## Sprint 71 — Readiness Score

### Calculate using
- Topic mastery
- Quiz results
- Study activity
- Upcoming exam
- Weak topics

---

## Sprint 72 — Achievements

Future specification includes achievements and streaks.

### Features
- First quiz
- Study streak
- Quiz milestone
- Subject mastery
- Study-time milestones

---

## Sprint 73 — Streaks

### Features
- Daily study streak
- Weekly activity
- Streak recovery
- Milestone celebrations

---

# Phase 15 — Web Production Hardening

## Sprint 74 — Responsive Web UI

### Test
- Desktop
- Laptop
- Tablet
- Mobile browser

---

## Sprint 75 — Performance

### Optimize
- Images
- Bundle size
- Database queries
- AI requests
- Lazy loading
- Caching

---

## Sprint 76 — Security Audit

### Check
- Authentication
- RLS
- Storage permissions
- API keys
- Input validation
- File uploads
- AI endpoint abuse

---

## Sprint 77 — Production Release

### Deliverables
- Production Vercel deployment
- Production Supabase
- Domain
- HTTPS
- Monitoring
- Error tracking
- Backup strategy

---

# Phase 16 — Installable Web App & Offline Tolerance

## Sprint 78 — Installable Web App

### Goals

Let a student install Acadify from the browser onto a phone home screen or a desktop — no app
store, no download, the same website running in a standalone window.

### Deliverables
- Web app manifest
- App icons and theme colour
- Standalone display mode
- Install prompt handling and dismissal
- Service worker registration strategy

---

## Sprint 79 — Offline-Tolerant Study

### Goals

A dropped connection should not end a study session. Material already opened stays readable, and
anything needing the network fails clearly rather than silently.

### Deliverables
- Cache strategy for opened materials and reviewers
- Offline banner and read-only mode
- Queued or clearly-failed writes, never a silent no-op
- Flashcard and quiz progress preserved across a disconnection
- Cache invalidation on deploy

---

## Sprint 80 — Cross-Browser Compatibility

### Test
- Chrome, Edge, Firefox and Safari on desktop
- Chrome on Android, Safari on iOS

### Deliverables
- Compatibility fixes
- Polyfill and fallback decisions
- Documented known issues

---

# Phase 17 — Cross-Browser & Accessibility QA

## Sprint 81 — Viewport & Device QA

### Test
- 1920, 1440 and 1280 desktop widths
- 1024 and 768 tablet widths
- 390 and 360 phone-browser widths
- Low-end devices and slow connections
- Browser zoom to 200% without loss of function

---

## Sprint 82 — Full Flow Regression

### Test every flow end to end

```text
Register
   ↓
Login
   ↓
Create Subject
   ↓
Upload Material
   ↓
AI Processes Material
   ↓
Ask AI
   ↓
Generate Reviewer
   ↓
Generate Quiz
   ↓
Take Quiz
   ↓
View Results
   ↓
Track Progress
   ↓
Create Planner Event
   ↓
Generate Study Plan
   ↓
Complete Study Session
```

Plus every failure path: failed upload, failed processing, interrupted quiz, expired session,
over-quota, offline.

---

## Sprint 83 — Accessibility & Performance Audit

### Deliverables
- WCAG 2.1 AA audit and fixes
- Keyboard-only navigation pass
- Screen reader pass over the core loop
- Core Web Vitals within budget on a mid-range device
- Bundle size and database query budgets

---

# Phase 18 — Public Launch

## Sprint 84 — Launch

### Final Security Checks

- Remove development secrets
- Verify production API keys
- Verify Supabase RLS on every table
- Verify storage permissions
- Verify authentication and route protection
- Verify AI endpoint protection and per-user quotas

### Performance Checks

- First load and navigation
- Upload throughput
- AI response handling under load
- Database query performance

### Launch Checklist

- [ ] Production backend configured
- [ ] Production database configured
- [ ] RLS enabled and verified
- [ ] Storage secured
- [ ] AI service configured with quotas
- [ ] Domain and HTTPS configured
- [ ] Monitoring and error tracking live
- [ ] Backup strategy in place
- [ ] Web app manifest and icons finalised
- [ ] Analytics decision recorded — students may be minors, so privacy constraints apply
- [ ] Legal pages published (terms, privacy)
- [ ] Cross-browser QA signed off
- [ ] Accessibility audit signed off
- [ ] Critical bugs fixed
- [ ] Launch announced

---

# Definition of Done

Acadify is considered **v1 complete** when a student can:

1. Create an account.
2. Log in.
3. Create subjects.
4. Create topics.
5. Upload study materials.
6. Have materials processed by AI.
7. Ask questions about uploaded materials.
8. Generate reviewers.
9. Generate flashcards.
10. Generate practice questions.
11. Generate quizzes.
12. Take quizzes.
13. View quiz results.
14. Track topic mastery.
15. Track study time.
16. Identify weak topics.
17. Create academic events.
18. Track upcoming deadlines.
19. Schedule study sessions.
20. Receive a personalized study plan.
21. Complete study sessions.
22. View overall progress.
23. Use the main dashboard to understand what to study next.
24. Use Acadify on a laptop and a phone browser with the same account.
25. Install Acadify from the browser to their home screen or desktop.

---

# Recommended Development Order

The most important principle is:

> **Build the foundation before building intelligence.**

Do not start with advanced AI features before authentication, database, storage, and document processing are stable.

The dependency chain should be:

```text
Project
   ↓
Architecture
   ↓
Authentication
   ↓
Database
   ↓
Storage
   ↓
Subjects
   ↓
Uploads
   ↓
Text Extraction
   ↓
Chunking
   ↓
Embeddings
   ↓
RAG
   ↓
AI Assistant
   ↓
Reviewer
   ↓
Quiz
   ↓
Progress
   ↓
Planner
   ↓
Personalized Plans
   ↓
Dashboard
   ↓
Production Web App
   ↓
Installable Web App
   ↓
Offline Tolerance
   ↓
Cross-Browser QA
   ↓
Public Launch
```

---

# MVP Milestone

A useful early MVP can be reached before all 83 sprints.

### MVP Target

```text
Authentication
+
Subjects
+
File Upload
+
AI Processing
+
RAG
+
AI Assistant
+
Reviewer Generator
+
Quiz Generator
+
Basic Progress
```

After this point, the product already demonstrates the primary Acadify learning loop.

---

# V1 Target

The complete V1 should add:

```text
Academic Planner
+
Personalized Study Plans
+
Dashboard
+
Readiness Score
+
Achievements
+
Streaks
+
Production Hardening
+
Installable Web App
+
Public Launch
```

---

# Future After V1

The original specification identifies these as future features:

- 📱 Mobile expansion
- 👨‍🏫 Teacher accounts
- 🏫 School accounts
- 👥 Shared reviewers
- 🏆 Achievements and streaks
- 🔔 Smart notifications
- 📷 Camera/OCR scanning
- 📴 Offline study mode

Potential post-V1 work can therefore include:

```text
Teacher Platform
       ↓
School Platform
       ↓
Shared Study Materials
       ↓
Social / Collaborative Learning
       ↓
Advanced Notifications
       ↓
Offline-First Learning
       ↓
Native Mobile Apps
```

---

# Final Product Vision

Acadify should feel like a **personal academic assistant** that knows:

- What the student is studying
- What the student understands
- What the student struggles with
- What the student should study next
- When the student's exams are
- How the student has been progressing

The ultimate experience should be:

```text
"I upload my schoolwork."
          ↓
"Acadify understands it."
          ↓
"It teaches me."
          ↓
"It gives me something to practice."
          ↓
"It quizzes me."
          ↓
"It sees what I got wrong."
          ↓
"It knows my weak topics."
          ↓
"It builds my next study session."
          ↓
"I improve."
```

## Acadify

> **Don't just study more. Study what matters.**
