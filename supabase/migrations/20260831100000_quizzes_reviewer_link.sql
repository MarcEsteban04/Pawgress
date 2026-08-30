-- ============================================================================
-- Acadify — practice questions know which reviewer they came from (Sprint 45)
--
-- `quizzes` was designed in Sprint 13 as a subject/topic-scoped set, which is
-- what a mock exam is. A practice set is narrower: it is the questions for ONE
-- reviewer, and without the link there is no way to open a reviewer and find
-- them again, nor to replace a set when the reviewer is regenerated.
--
-- Nullable, and `on delete set null` rather than cascade: a student who deletes
-- a reviewer has not asked to lose the questions they have been practising. The
-- set survives as a subject-scoped one, which is exactly what Sprint 49 will
-- treat as a quiz.
-- ============================================================================
alter table public.quizzes
  add column if not exists reviewer_id uuid;

-- Composite, like every other ownership edge in this schema: referencing
-- (reviewer_id, user_id) makes it impossible to point a row at someone else's
-- reviewer, so the RLS policies never have to check it (see the Sprint 14
-- migration's header).
alter table public.quizzes
  drop constraint if exists quizzes_reviewer_fkey;
alter table public.quizzes
  add constraint quizzes_reviewer_fkey
  foreign key (reviewer_id, user_id) references public.reviewers (id, user_id)
  on delete set null (reviewer_id);

-- One practice set per reviewer. Regenerating replaces it rather than adding a
-- second, so the reviewer page never has to ask which one a student meant.
create unique index if not exists quizzes_reviewer_unique_idx
  on public.quizzes (reviewer_id)
  where reviewer_id is not null;
