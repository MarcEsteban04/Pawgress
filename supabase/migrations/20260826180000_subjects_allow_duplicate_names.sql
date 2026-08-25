-- ============================================================================
-- Subjects: allow duplicate names (Sprint 19)
--
-- Sprint 13 added `unique (user_id, name)` with the comment "two subjects
-- called Biology in one account is a mistake, not a feature". That was wrong,
-- and it contradicted a requirement written three sprints earlier.
--
-- US-B1: "Duplicate names are ALLOWED but flagged (you already have a subject
-- called this)."
--
-- The requirement is right and the constraint was not. The same table carries a
-- `semester` column, so "Biology" in first semester and "Biology" in second is
-- an ordinary case the constraint made impossible — and a student who genuinely
-- wants two is not served by the database refusing.
--
-- The warning moves to where warnings belong: the create form tells them, and
-- they decide.
-- ============================================================================

alter table public.subjects drop constraint if exists subjects_name_unique_per_user;

-- Still worth an index: the duplicate check runs on every create and rename.
create index if not exists subjects_user_name_idx on public.subjects (user_id, lower(name));
