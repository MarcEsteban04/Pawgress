-- ============================================================================
-- Acadify — a conversation can be scoped to a topic (Sprint 39, FR-C4)
--
-- Retrieval has taken a `topicId` since Sprint 36 and nothing has ever passed
-- one: the assistant could narrow to a subject and no further. A student
-- revising one chapter had every other chapter of the same class competing for
-- the eight chunks a question gets.
--
-- `on delete set null (topic_id)` through the composite key, matching what
-- materials do. Deleting a topic must not delete the conversations about it —
-- the thread survives and simply widens to its subject, which is recoverable.
-- Cascading would lose work nobody asked to lose.
-- ============================================================================
alter table public.conversations
  add column if not exists topic_id uuid references public.topics (id) on delete set null;

alter table public.conversations
  drop constraint if exists conversations_topic_id_fkey;

alter table public.conversations
  add constraint conversations_topic_fkey
  foreign key (topic_id, user_id)
  references public.topics (id, user_id) on delete set null (topic_id);

comment on column public.conversations.topic_id is
  'Narrower scope than subject_id. Null means the whole subject, or everything.';
