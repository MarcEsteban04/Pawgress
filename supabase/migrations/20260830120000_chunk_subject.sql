-- ---------------------------------------------------------------------------
-- Sprint 34 — which subject a chunk belongs to.
--
-- Retrieval is almost always scoped: the assistant answers about the subject a
-- student is looking at (FR-C4). Reaching that through a join to `materials`
-- works, but it fights the vector index — pgvector's approximate search returns
-- its k nearest neighbours and THEN the join throws some away, so a query
-- scoped to one of six subjects can come back with far fewer rows than asked
-- for, or none. A filter column on the chunk lets the search be scoped without
-- that.
--
-- `subject_id` only, deliberately. A material's topic is re-filed from the
-- library whenever a student changes their mind, and a denormalised topic on
-- ten thousand chunks would go stale the moment they did — misattributing
-- mastery to the wrong topic, which is worse than a join. A material's SUBJECT
-- never changes: there is no move-between-subjects action, by design.
-- ---------------------------------------------------------------------------

-- Nullable first, so this replays on a table that already has rows.
alter table public.material_chunks
  add column subject_id uuid;

update public.material_chunks c
set subject_id = m.subject_id
from public.materials m
where m.id = c.material_id
  and c.subject_id is null;

alter table public.material_chunks
  alter column subject_id set not null;

/* The composite-ownership pattern from Sprint 14: the reference includes
   `user_id`, so a row cannot point at another student's subject even if the
   application asked it to. A plain `references subjects(id)` would let a forged
   id through to a real row owned by somebody else. */
alter table public.material_chunks
  add constraint material_chunks_subject_fkey
  foreign key (subject_id, user_id)
  references public.subjects (id, user_id)
  on delete cascade;

/* The scoped-retrieval index. Subject first because that is the equality
   predicate; the vector index stays separate and does the ordering. */
create index material_chunks_subject_idx
  on public.material_chunks (subject_id);

comment on column public.material_chunks.subject_id is
  'Sprint 34: denormalised from materials so scoped vector search can filter without a join. Safe to denormalise because a material never changes subject; topic deliberately is NOT denormalised, because it does.';
