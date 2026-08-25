-- ============================================================================
-- Drop the storage-cleanup trigger added earlier in Sprint 16.
--
-- It was wrong, and it broke account deletion completely: every attempt
-- returned "Database error deleting user" (HTTP 500).
--
-- Supabase installs its own `protect_delete()` trigger on `storage.objects`:
--
--   ERROR: Direct deletion from storage tables is not allowed.
--          Use the Storage API instead.
--   HINT:  This prevents accidental data loss from orphaned objects.
--
-- and it is right to. A row in `storage.objects` is only the index entry; the
-- bytes live in object storage. Deleting the row in SQL removes the record and
-- leaves the file behind forever, paid for and unreachable.
--
-- So cleanup moves into `deleteAccountAction`, which removes the objects
-- through the Storage API FIRST and only then deletes the auth user. That
-- ordering is also the safer one: if the file removal fails, the account still
-- exists and the student is told, rather than losing their account and keeping
-- an unreachable pile of uploads.
--
-- Caught by `npm run db:test:rls` before it reached anyone.
-- ============================================================================

drop trigger if exists on_auth_user_deleted_clear_storage on auth.users;
drop function if exists public.handle_deleted_user_storage();
