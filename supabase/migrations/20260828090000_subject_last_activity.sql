-- ============================================================================
-- Pawgress — last_activity_at on subjects (Sprint 24)
--
-- Sorting the subject list by "recent activity" meant reading EVERY material
-- row's `subject_id` and `created_at` on every page load and reducing them in
-- JavaScript. That was written knowing it was temporary — the comment in
-- `listSubjects` said it becomes a column maintained by a trigger once a
-- library outgrows a few hundred rows — and this is that migration.
--
-- The trade is the usual one: this moves work from every READ to every WRITE.
-- It is the right way round here because a subject list is read constantly and
-- materials are added occasionally, and because the read was unbounded — it
-- grew with the whole library, not with the page.
--
-- SECURITY DEFINER with a pinned search_path. The trigger writes to a DIFFERENT
-- table from the one being modified, so under the invoker's rights it would
-- have to satisfy the subjects UPDATE policy from inside a materials
-- statement. That happens to hold today (same owner, same user_id), but it
-- would silently stop holding the first time a background job writes a material
-- on a student's behalf — and the failure would be a stale sort order nobody
-- notices. Pinning search_path is mandatory for a definer function: resolving
-- names through a caller-controlled path is an escalation route.
-- ============================================================================

alter table public.subjects
  add column if not exists last_activity_at timestamptz not null default now();

comment on column public.subjects.last_activity_at is
  'Newest material added to this subject, else when the subject was created. Maintained by trigger.';

-- ---------------------------------------------------------------------------
-- Backfill, so the column is correct the moment it exists rather than after
-- the next upload. Mirrors exactly what the JavaScript reduction computed.
-- ---------------------------------------------------------------------------
update public.subjects s
   set last_activity_at = coalesce(
     (select max(m.created_at) from public.materials m where m.subject_id = s.id),
     s.created_at
   );

-- ---------------------------------------------------------------------------
-- Maintenance
--
-- INSERT and UPDATE take the cheap path: a material can only ever make its
-- subject MORE recent, so `greatest()` needs no lookup.
--
-- DELETE has to recompute, because removing the newest material must roll the
-- subject back rather than leave it looking active. That is a subquery, and it
-- is affordable precisely because deleting materials is rare.
--
-- An UPDATE that moves a material between subjects touches both: the new one
-- through `greatest()`, the old one through the same recompute DELETE uses.
-- ---------------------------------------------------------------------------
create or replace function public.touch_subject_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_subject uuid := case when tg_op in ('UPDATE', 'DELETE') then old.subject_id end;
  new_subject uuid := case when tg_op in ('INSERT', 'UPDATE') then new.subject_id end;
begin
  if new_subject is not null then
    update public.subjects
       set last_activity_at = greatest(last_activity_at, new.created_at)
     where id = new_subject;
  end if;

  if old_subject is not null and old_subject is distinct from new_subject then
    update public.subjects s
       set last_activity_at = coalesce(
         (select max(m.created_at) from public.materials m
           where m.subject_id = s.id and m.id <> old.id),
         s.created_at
       )
     where s.id = old_subject;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists materials_touch_subject_activity on public.materials;

create trigger materials_touch_subject_activity
  after insert or update of subject_id, created_at or delete on public.materials
  for each row execute function public.touch_subject_activity();

-- ---------------------------------------------------------------------------
-- The index the sort now uses. Partial on non-archived rows for the same
-- reason as the Sprint 22 grouping index: the main list never asks for
-- archived subjects, so their rows are dead weight in it.
-- ---------------------------------------------------------------------------
create index if not exists subjects_activity_idx
  on public.subjects (user_id, last_activity_at desc)
  where archived_at is null;
