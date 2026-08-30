-- ============================================================================
-- Acadify — feedback on an answer (Sprint 42, FR-P9)
--
-- Every guardrail in this product is an assertion about behaviour we cannot
-- observe: that answers stay grounded, that citations are real, that Aki says
-- when the material does not cover something. The eval harness checks that
-- against cases WE wrote. This table is where the cases we did not write come
-- from — a student pressing "unhelpful" on an answer is the only signal that
-- reaches the failures nobody predicted.
--
-- Attached to a MESSAGE, not a conversation. "That answer was wrong" is about
-- one answer; recording it against the thread would lose which one, and a
-- thread of eight answers with one bad reply is not a bad thread.
--
-- `on delete cascade`: deleting a conversation deletes its feedback with it.
-- Keeping a rating whose answer no longer exists leaves a complaint about
-- something nobody can read.
-- ============================================================================

-- The composite key the feedback FK below points at. Added first, because a
-- foreign key cannot reference columns that are not yet provably unique.
alter table public.conversation_messages
  add constraint conversation_messages_id_user_key unique (id, user_id);

create table if not exists public.answer_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid not null references public.conversation_messages (id) on delete cascade,

  /* Two values, not five stars. A star rating asks a student to grade an answer
     they came here to READ, and the only distinction that changes what we do is
     whether it was any use. */
  rating text not null check (rating in ('helpful', 'unhelpful')),

  /* Optional and free text. The categories worth offering are the ones the
     reports teach us, and inventing them before reading any would shape the
     answers to fit the boxes. */
  reason text check (char_length(reason) <= 2000),

  created_at timestamptz not null default now(),

  /* One rating per message per student. Changing your mind updates the row;
     clicking twice does not stack. */
  constraint answer_feedback_one_per_message unique (user_id, message_id)
);

alter table public.answer_feedback
  drop constraint if exists answer_feedback_message_id_fkey;

alter table public.answer_feedback
  add constraint answer_feedback_message_fkey
  foreign key (message_id, user_id)
  references public.conversation_messages (id, user_id) on delete cascade;

create index if not exists answer_feedback_recent_idx
  on public.answer_feedback (user_id, created_at desc);

alter table public.answer_feedback enable row level security;

do $$
begin
  execute 'create policy answer_feedback_select_own on public.answer_feedback
             for select to authenticated using ((select auth.uid()) = user_id)';
  execute 'create policy answer_feedback_insert_own on public.answer_feedback
             for insert to authenticated with check ((select auth.uid()) = user_id)';
  execute 'create policy answer_feedback_update_own on public.answer_feedback
             for update to authenticated using ((select auth.uid()) = user_id)
             with check ((select auth.uid()) = user_id)';
  execute 'create policy answer_feedback_delete_own on public.answer_feedback
             for delete to authenticated using ((select auth.uid()) = user_id)';
end;
$$;
