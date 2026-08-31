-- ============================================================================
-- Acadify — Row Level Security (Sprint 14)
--
-- Sprint 13 enabled RLS with no policies, which denies everything. This file
-- opens it up to exactly one rule: a student sees and writes their own rows.
--
-- Two mechanisms, because a policy alone is not enough:
--
--   1. POLICIES answer "is this row mine?" — `auth.uid() = user_id`.
--
--   2. COMPOSITE FOREIGN KEYS answer "is this row's PARENT mine?", which
--      policies do not. Every child carries `user_id`, so a policy is happy to
--      let me insert a topic with MY user_id pointing at YOUR subject: the row
--      is mine, so the check passes. The plain foreign key is happy too,
--      because that subject exists. Nothing catches it.
--
--      Referencing `(subject_id, user_id) -> subjects (id, user_id)` makes it
--      structurally impossible: the parent row must match on owner as well as
--      id. No subquery in the hot path, and it holds for the service-role key
--      too, which bypasses policies entirely.
--
-- Postgres 17 is required for `on delete set null (column)` — plain SET NULL on
-- a composite key would try to null `user_id` as well, which is NOT NULL.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Parents become addressable by (id, user_id)
--
-- `id` is already the primary key, so these add an index that is nearly free
-- and never used for lookups — they exist so the composite keys below have
-- something to reference.
-- ---------------------------------------------------------------------------
alter table public.subjects add constraint subjects_id_user_key unique (id, user_id);
alter table public.topics add constraint topics_id_user_key unique (id, user_id);
alter table public.materials add constraint materials_id_user_key unique (id, user_id);
alter table public.reviewers add constraint reviewers_id_user_key unique (id, user_id);
alter table public.quizzes add constraint quizzes_id_user_key unique (id, user_id);
alter table public.quiz_questions add constraint quiz_questions_id_user_key unique (id, user_id);
alter table public.quiz_attempts add constraint quiz_attempts_id_user_key unique (id, user_id);
alter table public.study_plans add constraint study_plans_id_user_key unique (id, user_id);

-- ---------------------------------------------------------------------------
-- 2. Children reference parent AND owner together
--
-- Nullable child columns use MATCH SIMPLE (the default): when the reference is
-- null the constraint is not checked at all, which is what lets a material sit
-- in a subject with no topic yet.
-- ---------------------------------------------------------------------------

-- topics -> subjects
alter table public.topics drop constraint topics_subject_id_fkey;
alter table public.topics add constraint topics_subject_fkey
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade;

-- materials -> subjects, topics
alter table public.materials drop constraint materials_subject_id_fkey;
alter table public.materials add constraint materials_subject_fkey
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade;
alter table public.materials drop constraint materials_topic_id_fkey;
alter table public.materials add constraint materials_topic_fkey
  foreign key (topic_id, user_id) references public.topics (id, user_id)
  on delete set null (topic_id);

-- material_chunks -> materials
alter table public.material_chunks drop constraint material_chunks_material_id_fkey;
alter table public.material_chunks add constraint material_chunks_material_fkey
  foreign key (material_id, user_id) references public.materials (id, user_id) on delete cascade;

-- reviewers -> subjects, topics
alter table public.reviewers drop constraint reviewers_subject_id_fkey;
alter table public.reviewers add constraint reviewers_subject_fkey
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade;
alter table public.reviewers drop constraint reviewers_topic_id_fkey;
alter table public.reviewers add constraint reviewers_topic_fkey
  foreign key (topic_id, user_id) references public.topics (id, user_id)
  on delete set null (topic_id);

-- flashcards -> reviewers, subjects, topics, materials
alter table public.flashcards drop constraint flashcards_reviewer_id_fkey;
alter table public.flashcards add constraint flashcards_reviewer_fkey
  foreign key (reviewer_id, user_id) references public.reviewers (id, user_id) on delete cascade;
alter table public.flashcards drop constraint flashcards_subject_id_fkey;
alter table public.flashcards add constraint flashcards_subject_fkey
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade;
alter table public.flashcards drop constraint flashcards_topic_id_fkey;
alter table public.flashcards add constraint flashcards_topic_fkey
  foreign key (topic_id, user_id) references public.topics (id, user_id)
  on delete set null (topic_id);
alter table public.flashcards drop constraint flashcards_source_material_id_fkey;
alter table public.flashcards add constraint flashcards_source_material_fkey
  foreign key (source_material_id, user_id) references public.materials (id, user_id)
  on delete set null (source_material_id);

-- quizzes -> subjects, topics
alter table public.quizzes drop constraint quizzes_subject_id_fkey;
alter table public.quizzes add constraint quizzes_subject_fkey
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade;
alter table public.quizzes drop constraint quizzes_topic_id_fkey;
alter table public.quizzes add constraint quizzes_topic_fkey
  foreign key (topic_id, user_id) references public.topics (id, user_id)
  on delete set null (topic_id);

-- quiz_questions -> quizzes, topics, materials
alter table public.quiz_questions drop constraint quiz_questions_quiz_id_fkey;
alter table public.quiz_questions add constraint quiz_questions_quiz_fkey
  foreign key (quiz_id, user_id) references public.quizzes (id, user_id) on delete cascade;
alter table public.quiz_questions drop constraint quiz_questions_topic_id_fkey;
alter table public.quiz_questions add constraint quiz_questions_topic_fkey
  foreign key (topic_id, user_id) references public.topics (id, user_id)
  on delete set null (topic_id);
alter table public.quiz_questions drop constraint quiz_questions_source_material_id_fkey;
alter table public.quiz_questions add constraint quiz_questions_source_material_fkey
  foreign key (source_material_id, user_id) references public.materials (id, user_id)
  on delete set null (source_material_id);

-- quiz_attempts -> quizzes
alter table public.quiz_attempts drop constraint quiz_attempts_quiz_id_fkey;
alter table public.quiz_attempts add constraint quiz_attempts_quiz_fkey
  foreign key (quiz_id, user_id) references public.quizzes (id, user_id) on delete cascade;

-- quiz_answers -> attempts, questions
alter table public.quiz_answers drop constraint quiz_answers_attempt_id_fkey;
alter table public.quiz_answers add constraint quiz_answers_attempt_fkey
  foreign key (attempt_id, user_id) references public.quiz_attempts (id, user_id) on delete cascade;
alter table public.quiz_answers drop constraint quiz_answers_question_id_fkey;
alter table public.quiz_answers add constraint quiz_answers_question_fkey
  foreign key (question_id, user_id) references public.quiz_questions (id, user_id)
  on delete cascade;

-- study_sessions -> subjects, topics
alter table public.study_sessions drop constraint study_sessions_subject_id_fkey;
alter table public.study_sessions add constraint study_sessions_subject_fkey
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade;
alter table public.study_sessions drop constraint study_sessions_topic_id_fkey;
alter table public.study_sessions add constraint study_sessions_topic_fkey
  foreign key (topic_id, user_id) references public.topics (id, user_id)
  on delete set null (topic_id);

-- planner_events -> subjects, topics
alter table public.planner_events drop constraint planner_events_subject_id_fkey;
alter table public.planner_events add constraint planner_events_subject_fkey
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade;
alter table public.planner_events drop constraint planner_events_topic_id_fkey;
alter table public.planner_events add constraint planner_events_topic_fkey
  foreign key (topic_id, user_id) references public.topics (id, user_id)
  on delete set null (topic_id);

-- study_plan_items -> plans, subjects, topics
alter table public.study_plan_items drop constraint study_plan_items_plan_id_fkey;
alter table public.study_plan_items add constraint study_plan_items_plan_fkey
  foreign key (plan_id, user_id) references public.study_plans (id, user_id) on delete cascade;
alter table public.study_plan_items drop constraint study_plan_items_subject_id_fkey;
alter table public.study_plan_items add constraint study_plan_items_subject_fkey
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade;
alter table public.study_plan_items drop constraint study_plan_items_topic_id_fkey;
alter table public.study_plan_items add constraint study_plan_items_topic_fkey
  foreign key (topic_id, user_id) references public.topics (id, user_id)
  on delete set null (topic_id);

-- progress -> subjects, topics
alter table public.progress drop constraint progress_subject_id_fkey;
alter table public.progress add constraint progress_subject_fkey
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade;
alter table public.progress drop constraint progress_topic_id_fkey;
alter table public.progress add constraint progress_topic_fkey
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. Policies
--
-- Sixteen tables take the identical rule, so it is written ONCE and applied
-- from a list. The list is the thing to audit: a table missing from it has no
-- policies and therefore denies everything, which fails safe. Sixty-four
-- hand-written blocks would invite a typo in the twelfth that nobody spots.
--
-- Two details that matter more than they look:
--
--   * `(select auth.uid())` rather than `auth.uid()`. The subquery form is
--     evaluated ONCE per statement as an InitPlan; the bare call is re-evaluated
--     per row. On a thousand-row scan that is the difference between one call
--     and a thousand.
--
--   * `to authenticated` rather than the default (all roles). The anon role is
--     never granted anything here, so a signed-out request is refused without
--     evaluating a predicate at all.
--
-- UPDATE gets both USING and WITH CHECK: USING decides which rows may be
-- targeted, WITH CHECK decides what they may become. Without the second, a
-- student could update their own row and set `user_id` to someone else's,
-- handing the row away.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  owned_tables text[] := array[
    'subjects', 'topics', 'materials', 'material_chunks',
    'reviewers', 'flashcards',
    'quizzes', 'quiz_questions', 'quiz_attempts', 'quiz_answers',
    'study_sessions', 'planner_events',
    'study_plans', 'study_plan_items',
    'progress', 'achievements'
  ];
begin
  foreach t in array owned_tables loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select auth.uid()) = user_id)', t || '_select_own', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)', t || '_insert_own', t);

    execute format(
      'create policy %I on public.%I for update to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t || '_update_own', t);

    execute format(
      'create policy %I on public.%I for delete to authenticated
         using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles is the exception
--
-- Keyed by `id`, not `user_id`, and deliberately has NO delete policy. A
-- profile is half of an account: deleting the row on its own would leave a
-- signed-in student with no name, no settings and no way to get them back,
-- while the account still exists. Account deletion (FR-A8, Sprint 15) removes
-- the auth user, and the cascade takes the profile with it.
--
-- INSERT is allowed even though the `on_auth_user_created` trigger normally
-- does it, so a profile can be recreated if that ever fails. The primary key
-- stops it being used twice.
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
