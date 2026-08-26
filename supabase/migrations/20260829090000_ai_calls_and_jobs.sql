-- ---------------------------------------------------------------------------
-- Sprint 31 — the AI service layer's two tables.
--
--   ai_calls  every model call, for cost accounting, quotas and rate limiting
--   jobs      the background queue decided in Sprint 07 (docs/architecture.md §5)
--
-- Both are user-owned and both carry RLS, for the same reason every other table
-- does: the application is not the gate.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- ai_calls
-- ---------------------------------------------------------------------------

-- Which feature spent the money. Matches AiTaskKind in src/lib/ai/types.ts.
create type public.ai_task_kind as enum (
  'assistant',
  'reviewer',
  'flashcards',
  'practice_questions',
  'quiz',
  'short_answer_grade',
  'embedding'
);

create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task ai_task_kind not null,
  model text not null,

  /* The row is written BEFORE the call and updated after, so a call that
     crashes mid-flight still counts against the quota. Counting only completed
     calls would let a student retry a failing generation without limit. */
  outcome text not null default 'started'
    check (outcome in ('started', 'ok', 'refused', 'failed', 'invalid_output')),

  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  cache_read_tokens int not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens int not null default 0 check (cache_write_tokens >= 0),

  /* Computed from the model's published rates at call time and stored, not
     derived on read. Prices change; what a call cost does not. */
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  latency_ms int check (latency_ms >= 0),

  /* Stable hash of the request. Two identical requests must not be paid for
     twice, and a retried job must not double-charge (NFR-C4, NFR-C5). */
  idempotency_key text not null,

  -- Never a provider string or a stack trace; student-readable or null.
  failure_code text,

  created_at timestamptz not null default now(),
  completed_at timestamptz
);

/* One row per (user, key): a repeat of the same request finds the existing row
   instead of starting a second call. This is what makes the cache in NFR-C5
   enforceable rather than advisory. */
create unique index ai_calls_idempotency_idx
  on public.ai_calls (user_id, idempotency_key);

/* The quota query — "how many generations has this user made today?" — and the
   rate-limit query, which is the same shape over a minute. */
create index ai_calls_user_recent_idx
  on public.ai_calls (user_id, created_at desc);

alter table public.ai_calls enable row level security;

/* Read-only to the student: they can see what they have spent, and the shell's
   quota meter reads it. Writes go through the service role, because a client
   able to insert its own usage rows could grant itself unlimited quota. */
create policy "ai_calls_select_own" on public.ai_calls
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------

create type public.job_kind as enum (
  'extract_text',
  'chunk_text',
  'embed_chunks',
  'ocr_image',
  'generate_reviewer',
  'generate_quiz'
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind job_kind not null,
  subject_id uuid references public.subjects (id) on delete cascade,
  -- The thing the job is about: a material id, a reviewer id.
  target_id uuid not null,

  -- Reuses the vocabulary the UI already speaks (docs/states.md §3).
  status job_status not null default 'queued',

  /* Slice cursor. A handler processes a bounded slice, saves progress and
     re-enqueues, so no single invocation can outrun the platform's function
     duration (docs/architecture.md §5). */
  /* Named `slice_cursor`, not `cursor`: CURSOR is a reserved word in SQL and a
     column called that has to be quoted at every single use site. */
  slice_cursor int check (slice_cursor >= 0),
  total_slices int check (total_slices >= 0),

  attempts int not null default 0 check (attempts >= 0),
  failure_message text,
  failure_next_step text,

  /* Set when a worker claims the job. An expired lease is reclaimable, which is
     what stops a crashed invocation from stranding a material forever. */
  leased_until timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A failure has to say what happened AND what to do next (docs/states.md §5).
  constraint jobs_failure_is_explained check (
    status <> 'failed' or (failure_message is not null and failure_next_step is not null)
  ),

  /* One live job per (kind, target). Re-enqueueing the same work is then a
     no-op rather than a second worker racing the first — idempotency enforced
     by the database instead of by every caller remembering (NFR-R1). */
  constraint jobs_one_per_target unique (kind, target_id)
);

/* The claim query's index: oldest runnable work first, ignoring anything a
   worker currently holds. */
create index jobs_claimable_idx
  on public.jobs (status, leased_until, created_at)
  where status in ('queued', 'extracting', 'embedding', 'generating');

create index jobs_user_idx on public.jobs (user_id, created_at desc);

alter table public.jobs enable row level security;

/* Students may watch their own jobs — that is what the status UI reads. Only
   the service role writes: a client that could set its own job to 'ready'
   could claim a material was processed when it was not. */
create policy "jobs_select_own" on public.jobs
  for select using (auth.uid() = user_id);

create trigger jobs_touch_updated_at
  before update on public.jobs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Claiming work
-- ---------------------------------------------------------------------------

/*
 * Atomically claim up to `max_jobs` runnable jobs.
 *
 * `for update skip locked` is the whole point, and it cannot be expressed
 * through the REST client: two workers running the same select would both read
 * the same row and both process it. Skipping locked rows means concurrent
 * workers take disjoint sets without any of them waiting.
 *
 * A job is runnable when it is unfinished and either has never been leased or
 * its lease has expired. `security definer` because the caller is the service
 * role acting for many users, and RLS would otherwise scope this to nobody.
 */
create or replace function public.claim_jobs(
  max_jobs int default 5,
  lease_seconds int default 120
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select j.id
    from public.jobs j
    where j.status in ('queued', 'extracting', 'embedding', 'generating')
      and (j.leased_until is null or j.leased_until < now())
    order by j.created_at
    limit max_jobs
    for update skip locked
  )
  update public.jobs j
  set leased_until = now() + make_interval(secs => lease_seconds),
      attempts = j.attempts + 1
  from claimed c
  where j.id = c.id
  returning j.*;
end;
$$;

-- Only the service role runs the worker; no student calls this.
revoke all on function public.claim_jobs(int, int) from public, anon, authenticated;

comment on function public.claim_jobs is
  'Sprint 31: atomically lease runnable jobs for one worker invocation. Service role only.';
