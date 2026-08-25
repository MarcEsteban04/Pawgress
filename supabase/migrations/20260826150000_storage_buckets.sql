-- ============================================================================
-- Pawgress — storage buckets and their policies (Sprint 16)
--
-- FR-U9: files are private to their owner AT THE STORAGE LAYER, not merely
-- hidden in the UI. NFR-S2: objects are private and reached only through
-- short-lived signed URLs.
--
-- Ownership is carried by the object PATH. Every object is stored at
-- `{user_id}/…`, and the policies compare the first folder segment against
-- `auth.uid()`. That is the pattern Supabase's own storage RLS is built for:
-- `storage.objects` has no `user_id` column to join on, and its `owner` column
-- records whoever uploaded the row rather than who the file belongs to — which
-- is the same thing today and stops being the same thing the moment a
-- background job writes on a student's behalf.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Buckets
--
-- `public = false` on both. A public bucket serves every object to anyone with
-- the URL, forever, with no policy consulted — for a student's lecture notes
-- that is the whole security model gone.
--
-- Limits are enforced HERE as well as in the upload form. The form's limit is a
-- courtesy that saves a wasted upload; this one is the one that cannot be
-- edited out in a browser console.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
  false,
  -- 25 MB. The PRD assumes most uploads are under 10 MB (§7); the headroom is
  -- for the scanned PDF that is three times the size of a text one.
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-powerpoint',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  -- 2 MB at the time this shipped. RAISED TO 25 MB by
  -- 20260827120000_avatar_size_limit.sql — a replay of this file from empty
  -- lands on 2 MB and the later migration corrects it, which is the point of
  -- not editing history.
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies
--
-- `storage.objects` already has RLS enabled by Supabase, so — exactly as in
-- Sprint 13 — the tables are currently denying everything. These open them to
-- one rule per bucket: the first path segment must be the caller's own id.
--
-- `(select auth.uid())` for the same InitPlan reason as Sprint 14: evaluated
-- once per statement rather than once per object, which matters on a listing.
--
-- UPDATE carries both USING and WITH CHECK. Without WITH CHECK a student could
-- rename their own object to `{someone-else-id}/notes.pdf` and drop a file into
-- another account's folder.
-- ---------------------------------------------------------------------------
do $$
declare
  b text;
begin
  foreach b in array array['materials', 'avatars'] loop
    execute format(
      'create policy %I on storage.objects for select to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_read_own', b);

    execute format(
      'create policy %I on storage.objects for insert to authenticated
         with check (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_insert_own', b);

    execute format(
      'create policy %I on storage.objects for update to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)
         with check (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_update_own', b, b);

    execute format(
      'create policy %I on storage.objects for delete to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_delete_own', b);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deleting an account must take its files too (NFR-P3)
--
-- The cascade on `auth.users` clears every public table, but `storage.objects`
-- is not one of ours and has no foreign key to cascade along — the rows, and
-- the bytes behind them, would simply stay.
--
-- SECURITY DEFINER because the trigger runs while the auth user is being
-- deleted, and `search_path` is pinned for the usual reason: a definer function
-- resolving names through a caller-controlled path is an escalation route.
-- ---------------------------------------------------------------------------
create or replace function public.handle_deleted_user_storage()
returns trigger
language plpgsql
security definer
set search_path = storage, pg_temp
as $$
begin
  delete from storage.objects
  where bucket_id in ('materials', 'avatars')
    and (storage.foldername(name))[1] = old.id::text;
  return old;
end;
$$;

create trigger on_auth_user_deleted_clear_storage
  before delete on auth.users
  for each row execute function public.handle_deleted_user_storage();
