# Pawgress — Project Development Roadmap

## Goal

Build **Pawgress** from initial project setup to a production-ready **Android APK**.

Pawgress is an AI-powered study companion for high school and college students. The core product is based on the provided specification:

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

This roadmap keeps the specified web stack and adds a dedicated mobile layer for the final Android APK.

---

# Roadmap Structure

**Total: 84 sprints**

Each sprint should represent one focused development milestone. A sprint can be shortened or expanded depending on workload, but the order is intentional.

### Phases

| Phase | Sprints | Focus |
|---|---:|---|
| 1 | 01–04 | Product foundation |
| 2 | 05–08 | Design system & architecture |
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
| 16 | 78–80 | Mobile foundation |
| 17 | 81–83 | Android integration & testing |
| 18 | 84 | Release APK |

---

# Phase 1 — Product Foundation

## Sprint 01 — Project Initialization

### Goals
- Define the Pawgress project structure.
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
- Convert the Pawgress specification into development requirements.
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

## Sprint 05 — Pawgress Branding

### Goals
Create the visual identity.

### Deliverables
- Pawgress logo
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
- shadcn/ui configuration
- Pawgress design tokens
- Component standards

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

## Sprint 08 — CI/CD Foundation

### Deliverables
- GitHub workflow
- Development environment
- Staging environment
- Production environment
- Automated linting
- Automated type checking
- Automated builds

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

## Sprint 18 — Database Testing

### Test
- CRUD operations
- RLS
- Foreign keys
- Concurrent requests
- Unauthorized access

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

# Phase 16 — Mobile Foundation

## Sprint 78 — Android App Architecture

### Goal

Create the Pawgress mobile application.

Because the original specification defines a React/Next.js web application and lists mobile as a future feature, this phase introduces a mobile client while keeping Supabase and the backend architecture shared.

### Deliverables
- React Native/Expo project
- Android project
- Shared API/service conventions
- Environment configuration

---

## Sprint 79 — Mobile Design System

### Recreate
- Pawgress branding
- Colors
- Typography
- Buttons
- Cards
- Inputs
- Navigation
- Loading states
- Error states

---

## Sprint 80 — Mobile Authentication

### Features
- Login
- Registration
- Logout
- Password reset
- Persistent session
- Secure token storage

---

# Phase 17 — Android Feature Integration

## Sprint 81 — Mobile Dashboard

### Implement
- Greeting
- Next exam
- Readiness
- Today's study plan
- Weak topics
- Upcoming events

---

## Sprint 82 — Mobile Study Experience

### Implement
- Subjects
- Materials
- Reviewer
- Flashcards
- Quiz
- Results
- Progress
- Planner

---

## Sprint 83 — Mobile AI & Upload Integration

### Implement
- Camera/OCR scanning
- File upload
- AI assistant
- Reviewer generation
- Quiz generation
- RAG-backed questions
- Offline-aware states

---

# Phase 18 — Final Android Release

## Sprint 84 — Final QA → APK

### Functional Testing

Test every major flow:

```text
Install APK
   ↓
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

### Android Testing

Test on:

- Low-end Android device
- Mid-range Android device
- High-end Android device
- Small screen
- Large screen
- Slow internet
- No internet
- Interrupted uploads
- Background/foreground transitions

### Final Security Checks

- Remove development secrets
- Verify production API keys
- Verify Supabase RLS
- Verify storage permissions
- Verify authentication
- Verify AI API protection

### Performance Checks

- App startup
- Navigation
- Upload speed
- AI response handling
- Memory usage
- Battery usage
- Crash rate

### Release Build

Create:

```text
Pawgress-release.apk
```

### Release Checklist

- [ ] Production backend configured
- [ ] Production database configured
- [ ] RLS enabled
- [ ] Storage secured
- [ ] AI service configured
- [ ] Android package name finalized
- [ ] App icon finalized
- [ ] Splash screen finalized
- [ ] Version number configured
- [ ] App permissions reviewed
- [ ] Release signing configured
- [ ] APK generated
- [ ] APK installed successfully
- [ ] APK tested on physical Android device
- [ ] Critical bugs fixed
- [ ] Final APK archived

---

# Definition of Done

Pawgress is considered **v1 complete** when a student can:

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
24. Use the Android application.
25. Install and run the final APK successfully.

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
Mobile App
   ↓
Android QA
   ↓
APK
```

---

# MVP Milestone

A useful early MVP can be reached before all 84 sprints.

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

After this point, the product already demonstrates the primary Pawgress learning loop.

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
Android App
+
Final APK
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
iOS Release
```

---

# Final Product Vision

Pawgress should feel like a **personal academic assistant** that knows:

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
"Pawgress understands it."
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

## Pawgress

> **Don't just study more. Study what matters.**
