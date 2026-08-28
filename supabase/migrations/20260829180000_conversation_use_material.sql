-- ============================================================================
-- Acadify — remembering whether a conversation uses the student's material
--
-- The assistant gained a toggle: search my files, or just talk. Without this
-- column that choice lives only in component state, so resuming a thread a day
-- later silently flips it back on — and the next answer starts citing files in
-- a conversation the student had deliberately made general.
--
-- A conversation already remembers its SCOPE (`subject_id`). This is the same
-- kind of fact about the same thing, so it belongs in the same row.
--
-- Defaults true because grounding in the student's own material is what the
-- product is for; turning it off is the deliberate act, not leaving it on.
-- ============================================================================
alter table public.conversations
  add column if not exists use_material boolean not null default true;

comment on column public.conversations.use_material is
  'False when the student asked Aki to answer without searching their files.';
