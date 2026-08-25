-- ============================================================================
-- Pawgress — raise the avatar size limit to 25 MB
--
-- At the product owner's direction. The previous 2 MB was chosen because an
-- avatar renders at 36px and everything past that is bytes nobody sees; 25 MB
-- matches the materials bucket, so a photo straight off a phone is accepted
-- without a student having to resize it first.
--
-- **What this costs, recorded here so the trade is visible later.** The bucket
-- stores whatever is uploaded, and the app serves that same object — there is
-- no image pipeline yet. A 20 MB photo becomes a 20 MB download behind a 36px
-- circle, on every page that renders the avatar, for the account that uploaded
-- it. The fix is downscaling before upload (a canvas resize client-side, or a
-- transform on read), not a smaller number here: a limit is a refusal, and a
-- resize is the thing that makes the refusal unnecessary.
--
-- The limit is raised in three places that must agree, and the other two are
-- mirrors of this one: `src/lib/supabase/storage.ts` and
-- `src/features/settings/limits.ts`. This is the one that cannot be edited out
-- in a browser console.
-- ============================================================================
update storage.buckets
   set file_size_limit = 26214400
 where id = 'avatars';
