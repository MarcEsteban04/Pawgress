-- ============================================================================
-- Acadify — a job kind for flashcard generation (Sprint 44)
--
-- Alone in its own migration, and deliberately so. Postgres will not let a new
-- enum value be USED in the transaction that adds it, and this runner puts a
-- whole file in one transaction — so anything referencing
-- 'generate_flashcards' has to land in a later file than the ALTER TYPE that
-- creates it.
-- ============================================================================
alter type public.job_kind add value if not exists 'generate_flashcards';
