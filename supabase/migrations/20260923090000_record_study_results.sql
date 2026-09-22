-- ============================================================================
-- Acadify — study sessions carry their result, and practice feeds progress
--
-- THE BUG THIS FIXES. `progress`, `study_sessions` and `quiz_attempts` have
-- existed since the Sprint 13 schema and the dashboard has read all three since
-- Sprint 23. Nothing has ever written to them. A student could work through a
-- deck and a practice set and the app would still say "nothing measured yet",
-- because it was true — the study features recorded nothing at all.
--
-- Two changes, and the reason for each:
--
--  1. `study_sessions` gains its RESULT. It records that a session happened but
--     not how it went, so "you studied for 12 minutes" was the most the product
--     could ever say. A session is where a subject-wide result has to live,
--     because `progress.topic_id` is NOT NULL and most reviewers are built from
--     a whole subject rather than one chapter.
--
--  2. `record_practice` upserts topic mastery atomically. PostgREST cannot
--     express `questions_answered = questions_answered + $1`, and a
--     read-then-write from the application would lose one of two sessions
--     finishing together. The increment belongs in the database.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. A session says how it went
-- ---------------------------------------------------------------------------
alter table public.study_sessions
  add column if not exists reviewer_id uuid,
  -- Null for activities with no score: reading, or a review with nothing marked.
  add column if not exists items_total int check (items_total >= 0),
  add column if not exists items_correct int check (items_correct >= 0);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'study_sessions_correct_within_total'
  ) then
    alter table public.study_sessions
      add constraint study_sessions_correct_within_total check (
        items_correct is null or items_total is null or items_correct <= items_total
      );
  end if;
end $$;

-- Composite, like every other ownership edge here: referencing (reviewer_id,
-- user_id) makes it impossible to point a session at someone else's reviewer,
-- so the RLS policies never have to check it.
alter table public.study_sessions
  drop constraint if exists study_sessions_reviewer_fkey;
alter table public.study_sessions
  add constraint study_sessions_reviewer_fkey
  foreign key (reviewer_id, user_id) references public.reviewers (id, user_id)
  on delete set null (reviewer_id);

-- The dashboard and the progress page both ask "what did I do lately", newest
-- first, scoped to me. This is that query.
create index if not exists study_sessions_recent_idx
  on public.study_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- 2. Topic mastery, incremented atomically
--
-- SECURITY DEFINER with an explicit ownership check rather than trusting the
-- caller: the function writes a row keyed by `auth.uid()` and refuses a topic
-- that is not the caller's, so it cannot be used to write into someone else's
-- progress by passing their topic id.
--
-- Mastery is plain accuracy over the evidence so far. That is deliberately
-- simple and deliberately honest — `MasteryBar` already withholds a percentage
-- below ten answered questions, so a thin sample is never shown as a figure.
-- The weighted formula with recency and difficulty is Sprint 56's job; putting
-- a half-invented one here would be the "mastery misleads students" risk in the
-- register, arriving early.
-- ---------------------------------------------------------------------------
create or replace function public.record_practice(
  p_topic_id uuid,
  p_answered int,
  p_correct int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_subject uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if p_answered <= 0 or p_correct < 0 or p_correct > p_answered then
    raise exception 'invalid tally: % correct of %', p_correct, p_answered;
  end if;

  -- The caller's own topic, or nothing. This is the ownership check.
  select subject_id into v_subject
  from public.topics
  where id = p_topic_id and user_id = v_user;

  if v_subject is null then
    raise exception 'topic not found';
  end if;

  insert into public.progress as pr (
    user_id, subject_id, topic_id,
    questions_answered, questions_correct, mastery, last_practised_at, updated_at
  )
  values (
    v_user, v_subject, p_topic_id,
    p_answered, p_correct, round(p_correct::numeric / p_answered, 3), now(), now()
  )
  on conflict (user_id, topic_id) do update
  set
    questions_answered = pr.questions_answered + excluded.questions_answered,
    questions_correct = pr.questions_correct + excluded.questions_correct,
    mastery = round(
      (pr.questions_correct + excluded.questions_correct)::numeric
        / (pr.questions_answered + excluded.questions_answered),
      3
    ),
    last_practised_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.record_practice(uuid, int, int) from public;
grant execute on function public.record_practice(uuid, int, int) to authenticated;
