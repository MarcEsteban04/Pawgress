-- ============================================================================
-- Acadify — academic year on subjects (Sprint 22)
--
-- FR-S6 / US-B6: "a subject can be assigned a semester AND academic year, and
-- the list can group by them". `semester` already exists as free text; this
-- adds the year it belongs to.
--
-- A SMALLINT holding the starting year, not text.
--
-- The obvious alternative — a second free-text box — is what makes grouping
-- quietly useless. A student typing the year by hand produces "2025-2026",
-- "2025–2026" (en dash), "AY 2025-26" and "25/26" across four subjects, and
-- every one of those is a separate group. Storing 2025 and rendering
-- "2025–2026" means the grouping is exact by construction, the ordering is
-- numeric rather than lexical, and the dash style is a display decision that
-- can be changed later without a data migration.
--
-- The bound is a sanity check, not a policy: it catches a mistyped 202 or
-- 20255 while leaving room for a student entering next year's classes early.
-- ============================================================================
alter table public.subjects
  add column if not exists academic_year smallint
    check (academic_year between 2000 and 2100);

comment on column public.subjects.academic_year is
  'Starting year of the academic year (2025 means 2025-2026). Null when unset.';

-- ---------------------------------------------------------------------------
-- Index
--
-- Grouping reads every non-archived subject for one student and orders by year
-- then semester, so the index carries all three in that order. `user_id` leads
-- because RLS makes every statement start with it.
--
-- Partial on `archived_at is null`: the main list never asks for archived rows,
-- and keeping them out of the index keeps it the size of a student's ACTIVE
-- term rather than their whole degree.
-- ---------------------------------------------------------------------------
create index if not exists subjects_grouping_idx
  on public.subjects (user_id, academic_year, semester)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- Archived subjects (US-B6)
--
-- No schema change needed — `archived_at` has existed since Sprint 13 and the
-- RLS policies already cover it, because they are written per table rather
-- than per row state. What was missing is an index for the one query that asks
-- for archived rows specifically, which would otherwise scan every subject the
-- student has ever created to find the four they retired.
-- ---------------------------------------------------------------------------
create index if not exists subjects_archived_idx
  on public.subjects (user_id, archived_at desc)
  where archived_at is not null;
