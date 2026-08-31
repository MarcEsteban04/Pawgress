-- ============================================================================
-- Acadify — initial schema (Sprint 13)
--
-- The sixteen core tables, their foreign keys, indexes and constraints.
--
-- Decisions that run through the whole file:
--
--   * EVERY table carries `user_id` referencing auth.users, even when ownership
--     could be derived by joining upward. Sprint 14's RLS policies then read
--     `auth.uid() = user_id` with no joins at all. A policy that has to walk
--     three tables to decide ownership is slow on every row and easy to get
--     subtly wrong, and it is the last line of defence.
--
--   * RLS is ENABLED here, in Sprint 13, with no policies yet. Supabase exposes
--     public tables through PostgREST, so a table with RLS off is readable by
--     anyone holding the anon key — which ships in the browser. Enabled with no
--     policies denies everything, which is the correct state to sit in until
--     Sprint 14 writes them.
--
--   * Deletes cascade from auth.users downward, so removing an account removes
--     the uploads, extracted text, embeddings and generated content with it
--     (NFR-P3). Nothing relies on application code to tidy up.
--
--   * Timestamps are timestamptz, always. A student in Manila and a server in
--     Singapore disagree about what "today" means, and study plans are built
--     around days.
-- ============================================================================

create extension if not exists "pgcrypto";
-- Similarity search over material chunks (FR-P3).
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- Enumerations
--
-- Enums rather than free text where the set is closed and the UI switches on
-- it. `job_status` mirrors src/types/index.ts exactly: one vocabulary, so the
-- label a student learns on a material is the same one they see on a reviewer
-- (docs/states.md §3).
-- ---------------------------------------------------------------------------
create type material_kind as enum ('pdf', 'pptx', 'docx', 'image', 'note');

create type job_status as enum (
  'queued', 'uploading', 'extracting', 'embedding',
  'generating', 'ready', 'failed', 'cancelled', 'over_quota'
);

create type reviewer_kind as enum ('summary', 'key_terms', 'concepts', 'practice');

create type question_type as enum ('mcq', 'true_false', 'identification', 'short_answer');

create type planner_event_kind as enum (
  'exam', 'quiz', 'assignment', 'project', 'presentation', 'study_session'
);

create type plan_activity as enum ('review', 'practice', 'quiz', 'flashcards');

create type study_activity as enum ('review', 'practice', 'quiz', 'flashcards', 'reading');

-- ---------------------------------------------------------------------------
-- `updated_at`, maintained by the database
--
-- An application that forgets to set this leaves a row that lies about when it
-- last changed, and nobody notices until they are debugging something else.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — the app's half of an account
--
-- auth.users is Supabase's and must not be written to directly. Everything the
-- product knows about a student lives here, keyed by the same id.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  avatar_url text,
  year_level text check (char_length(year_level) <= 40),
  school text check (char_length(school) <= 120),
  -- Feeds the study planner's block length (FR-L2).
  preferred_session_minutes int not null default 30
    check (preferred_session_minutes between 5 and 240),
  timezone text not null default 'UTC',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subjects and topics
-- ---------------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  -- The categorical slot from globals.css. A subject keeps its colour for life,
  -- so the constraint matches the five tokens that exist (docs/design-system.md §3).
  color_slot smallint not null default 1 check (color_slot between 1 and 5),
  icon text,
  semester text check (char_length(semester) <= 60),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Two subjects called "Biology" in one account is a mistake, not a feature.
  -- Case-insensitive, and scoped per student.
  constraint subjects_name_unique_per_user unique (user_id, name)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  -- Manual ordering (FR-S7). Sparse so a reorder does not rewrite every row.
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topics_name_unique_per_subject unique (subject_id, name)
);

-- ---------------------------------------------------------------------------
-- materials and their chunks
-- ---------------------------------------------------------------------------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  -- A material may sit in a subject without being filed under a topic yet, and
  -- deleting a topic must not delete the file (FR-S4).
  topic_id uuid references public.topics (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  kind material_kind not null,
  -- Path in the private storage bucket. Null for typed notes, which have no file.
  storage_path text,
  byte_size bigint check (byte_size >= 0),
  page_count int check (page_count >= 0),
  -- Normalised text from extraction (FR-P1). Null until the job runs.
  extracted_text text,
  /* Content hash of the uploaded bytes. Re-processing an unchanged material
     reuses existing extraction and embeddings rather than paying for them
     twice (FR-P7, NFR-C4). */
  content_hash text,
  status job_status not null default 'queued',
  failure_message text,
  failure_next_step text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A note has no file; anything else must have one.
  constraint materials_file_matches_kind check (
    (kind = 'note' and storage_path is null) or (kind <> 'note' and storage_path is not null)
  ),
  -- A failure has to say what happened AND what to do next (docs/states.md §5).
  constraint materials_failure_is_explained check (
    status <> 'failed' or (failure_message is not null and failure_next_step is not null)
  )
);

create table public.material_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  -- Order within the material; also the idempotency key for the embed job.
  chunk_index int not null check (chunk_index >= 0),
  content text not null,
  -- Provenance, so every citation can name a page (FR-P2, FR-P6).
  page_from int check (page_from >= 0),
  page_to int check (page_to >= 0),
  token_count int check (token_count >= 0),
  /* 1536 dimensions matches the common small embedding models. The dimension is
     fixed at the column level, so switching to a model with a different width
     is a migration, not a config change — see EMBEDDINGS_MODEL in .env.example. */
  embedding vector(1536),
  created_at timestamptz not null default now(),
  -- Jobs are idempotent (NFR-R1): re-running one upserts rather than duplicating.
  constraint material_chunks_unique_position unique (material_id, chunk_index),
  constraint material_chunks_pages_ordered check (
    page_from is null or page_to is null or page_to >= page_from
  )
);

-- ---------------------------------------------------------------------------
-- generated study content
-- ---------------------------------------------------------------------------
create table public.reviewers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  kind reviewer_kind not null default 'summary',
  /* Sections as JSON rather than a table: they are always read as a whole
     document, never queried across, and their shape changes per kind. A
     `reviewer_sections` table would buy joins nobody needs. */
  content jsonb not null default '{}'::jsonb,
  /* Which materials this was generated from. Kept as an array rather than a
     join table because it is written once and only ever read whole. */
  source_material_ids uuid[] not null default '{}',
  status job_status not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reviewer_id uuid references public.reviewers (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  front text not null check (char_length(front) between 1 and 2000),
  back text not null check (char_length(back) between 1 and 4000),
  source_material_id uuid references public.materials (id) on delete set null,
  source_page int check (source_page >= 0),
  -- Review state (FR-R2). Enough for known/unknown now, and for spacing later.
  times_seen int not null default 0 check (times_seen >= 0),
  times_known int not null default 0 check (times_known >= 0),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flashcards_known_within_seen check (times_known <= times_seen)
);

-- ---------------------------------------------------------------------------
-- quizzes
-- ---------------------------------------------------------------------------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  question_count int not null default 0 check (question_count >= 0),
  time_limit_seconds int check (time_limit_seconds > 0),
  is_mock_exam boolean not null default false,
  source_material_ids uuid[] not null default '{}',
  status job_status not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  position int not null check (position >= 0),
  type question_type not null,
  prompt text not null check (char_length(prompt) between 1 and 4000),
  /* Choices for MCQ, as ["...", "..."]. Empty for other types. */
  choices jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text,
  -- Every generated question points back at the page it came from (FR-C2).
  source_material_id uuid references public.materials (id) on delete set null,
  source_page int check (source_page >= 0),
  created_at timestamptz not null default now(),
  constraint quiz_questions_unique_position unique (quiz_id, position),
  -- An MCQ without options is not answerable.
  constraint quiz_questions_mcq_has_choices check (
    type <> 'mcq' or jsonb_array_length(choices) >= 2
  )
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  started_at timestamptz not null default now(),
  -- Null while in progress, so an interrupted attempt can be resumed (FR-Q10).
  submitted_at timestamptz,
  score_correct int check (score_correct >= 0),
  score_total int check (score_total >= 0),
  duration_seconds int check (duration_seconds >= 0),
  constraint quiz_attempts_score_within_total check (
    score_correct is null or score_total is null or score_correct <= score_total
  ),
  -- A submitted attempt has a score; an unsubmitted one does not.
  constraint quiz_attempts_scored_when_submitted check (
    (submitted_at is null and score_correct is null)
    or (submitted_at is not null and score_correct is not null)
  )
);

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  -- Null means seen but skipped, which is different from answered wrongly.
  given_answer text,
  is_correct boolean,
  /* Short answers are graded by a model and must say so, and the student can
     override that judgement (FR-Q7). Both facts are stored, not inferred. */
  graded_by_ai boolean not null default false,
  student_override boolean,
  answered_at timestamptz not null default now(),
  -- Changing an answer updates the row rather than adding a second one.
  constraint quiz_answers_one_per_question unique (attempt_id, question_id)
);

-- ---------------------------------------------------------------------------
-- study activity, planning and progress
-- ---------------------------------------------------------------------------
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  activity study_activity not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int check (duration_seconds >= 0),
  constraint study_sessions_ends_after_start check (ended_at is null or ended_at >= started_at)
);

create table public.planner_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  kind planner_event_kind not null,
  /* A date, not a timestamp: "Biology exam on Friday" is a day, and storing it
     as an instant means it moves when the student travels or the server does
     not agree about the timezone. */
  due_on date not null,
  due_time time,
  notes text check (char_length(notes) <= 2000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_date date not null,
  total_minutes int not null default 0 check (total_minutes >= 0),
  /* The inputs the plan was built from — upcoming exams, weak topics, quiz
     results, available time. Stored so the plan can explain itself rather than
     asking the student to trust it (FR-D2, docs/branding.md §1). */
  rationale jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  -- One plan per day per student; regenerating replaces it.
  constraint study_plans_one_per_day unique (user_id, plan_date)
);

/* Not in the Sprint 13 table list, but a plan with no items cannot satisfy
   FR-L2 or FR-L3 — "a plan item is concrete: subject, activity, minutes, and a
   link that starts it", with per-item completion. The alternative was a jsonb
   blob that per-item completion would have to rewrite wholesale. */
create table public.study_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.study_plans (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  position int not null check (position >= 0),
  activity plan_activity not null,
  minutes int not null check (minutes between 1 and 480),
  -- Why this block, in the student's words. Never "recommended for you".
  reason text check (char_length(reason) <= 300),
  completed_at timestamptz,
  constraint study_plan_items_unique_position unique (plan_id, position)
);

/* Per-topic mastery. A cache of what quiz_answers already imply (FR-G1), kept
   because the dashboard reads it on every load and recomputing across every
   answer per request does not scale past a few hundred rows. */
create table public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  -- 0–1, matching MasteryBar's `value`.
  mastery numeric(4, 3) not null default 0 check (mastery between 0 and 1),
  /* The evidence behind the number. MasteryBar withholds a percentage below ten
     answered questions, so the count is not optional metadata — it decides
     whether a figure may be shown at all (US-H1). */
  questions_answered int not null default 0 check (questions_answered >= 0),
  questions_correct int not null default 0 check (questions_correct >= 0),
  last_practised_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint progress_one_row_per_topic unique (user_id, topic_id),
  constraint progress_correct_within_answered check (questions_correct <= questions_answered)
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Stable identifier for the achievement kind, e.g. 'first_upload'.
  code text not null check (char_length(code) between 1 and 60),
  earned_at timestamptz not null default now(),
  -- Anything the badge needs to render, e.g. streak length.
  metadata jsonb not null default '{}'::jsonb,
  -- Earned once. A second grant updates nothing rather than duplicating.
  constraint achievements_earned_once unique (user_id, code)
);

-- ---------------------------------------------------------------------------
-- Indexes
--
-- Postgres indexes primary keys and unique constraints automatically, but NOT
-- foreign keys. Every one of these supports a query the product actually makes:
-- "this student's subjects", "this material's chunks in order", "what is due".
-- ---------------------------------------------------------------------------
create index subjects_user_idx on public.subjects (user_id) where archived_at is null;
create index topics_subject_idx on public.topics (subject_id, position);
create index topics_user_idx on public.topics (user_id);

create index materials_subject_idx on public.materials (subject_id, created_at desc);
create index materials_user_idx on public.materials (user_id);
create index materials_topic_idx on public.materials (topic_id);
-- The processing queue view, and the retry list.
create index materials_pending_idx on public.materials (status) where status <> 'ready';
-- Reuse extraction for an identical re-upload (FR-P7).
create index materials_content_hash_idx on public.materials (user_id, content_hash)
  where content_hash is not null;

create index material_chunks_material_idx on public.material_chunks (material_id, chunk_index);
create index material_chunks_user_idx on public.material_chunks (user_id);
/* HNSW rather than IVFFlat: it needs no training pass, so it works on an empty
   table and stays correct as chunks arrive one upload at a time. Cosine, to
   match how the embedding models are normalised. */
create index material_chunks_embedding_idx on public.material_chunks
  using hnsw (embedding vector_cosine_ops);

create index reviewers_subject_idx on public.reviewers (subject_id, created_at desc);
create index reviewers_user_idx on public.reviewers (user_id);
create index flashcards_reviewer_idx on public.flashcards (reviewer_id);
create index flashcards_user_subject_idx on public.flashcards (user_id, subject_id);

create index quizzes_subject_idx on public.quizzes (subject_id, created_at desc);
create index quizzes_user_idx on public.quizzes (user_id);
create index quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);
create index quiz_questions_user_idx on public.quiz_questions (user_id);
create index quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id, started_at desc);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, started_at desc);
-- Resuming an interrupted attempt (FR-Q10).
create index quiz_attempts_open_idx on public.quiz_attempts (user_id) where submitted_at is null;
create index quiz_answers_attempt_idx on public.quiz_answers (attempt_id);
create index quiz_answers_user_idx on public.quiz_answers (user_id);

create index study_sessions_user_idx on public.study_sessions (user_id, started_at desc);
create index study_sessions_subject_idx on public.study_sessions (subject_id, started_at desc);

-- "What is coming up", the dashboard's most frequent question.
create index planner_events_upcoming_idx on public.planner_events (user_id, due_on)
  where completed_at is null;
create index planner_events_subject_idx on public.planner_events (subject_id);

create index study_plans_user_idx on public.study_plans (user_id, plan_date desc);
create index study_plan_items_plan_idx on public.study_plan_items (plan_id, position);
create index study_plan_items_user_idx on public.study_plan_items (user_id);

create index progress_user_idx on public.progress (user_id);
create index progress_subject_idx on public.progress (subject_id);
-- The weak-topic list, ranked (FR-G3).
create index progress_weak_idx on public.progress (user_id, mastery);

create index achievements_user_idx on public.achievements (user_id, earned_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger subjects_touch before update on public.subjects
  for each row execute function public.touch_updated_at();
create trigger topics_touch before update on public.topics
  for each row execute function public.touch_updated_at();
create trigger materials_touch before update on public.materials
  for each row execute function public.touch_updated_at();
create trigger reviewers_touch before update on public.reviewers
  for each row execute function public.touch_updated_at();
create trigger flashcards_touch before update on public.flashcards
  for each row execute function public.touch_updated_at();
create trigger quizzes_touch before update on public.quizzes
  for each row execute function public.touch_updated_at();
create trigger planner_events_touch before update on public.planner_events
  for each row execute function public.touch_updated_at();
create trigger progress_touch before update on public.progress
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- A profile for every account
--
-- The trigger covers everyone who signs up from now on. The backfill covers
-- the accounts that already exist — registration shipped in Sprint 10, three
-- sprints before this table, so without it the earliest students are exactly
-- the ones with no profile row.
--
-- SECURITY DEFINER because the trigger runs as the auth system, which has no
-- rights on public. `search_path` is pinned: a SECURITY DEFINER function that
-- resolves names through a caller-controlled search_path is a well-known
-- privilege-escalation route.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- The part of the address before the @, as a first guess at a name. The
    -- student changes it in settings (Sprint 15).
    nullif(split_part(coalesce(new.email, ''), '@', 1), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select u.id, nullif(split_part(coalesce(u.email, ''), '@', 1), '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Enabled now, policies in Sprint 14. Enabled with no policies denies every
-- read and write through the anon and authenticated roles, which is the only
-- safe state for a table that PostgREST will happily expose otherwise.
--
-- The service-role key bypasses all of this, which is exactly why
-- src/lib/supabase/admin.ts is restricted to background jobs.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.materials enable row level security;
alter table public.material_chunks enable row level security;
alter table public.reviewers enable row level security;
alter table public.flashcards enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.study_sessions enable row level security;
alter table public.planner_events enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_plan_items enable row level security;
alter table public.progress enable row level security;
alter table public.achievements enable row level security;
