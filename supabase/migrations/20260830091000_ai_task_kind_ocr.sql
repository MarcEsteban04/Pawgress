-- ---------------------------------------------------------------------------
-- Sprint 33 — OCR is its own kind of AI call.
--
-- Alone in its own migration on purpose: `alter type ... add value` has
-- restrictions about running alongside statements that USE the new value, and
-- keeping it isolated means it can never be the statement that breaks a batch.
--
-- It is also append-only rather than an edit to the Sprint 31 migration that
-- created the type. A migration that has been shared is history, and rewriting
-- history is how one machine ends up with a schema nobody else has.
--
-- Why OCR needs a kind at all: reading a photo is a real model call with a real
-- cost, and the first version of this routed it through 'embedding', which is
-- deliberately unmetered. That would have left a paid call outside the daily
-- ceiling — precisely the hole the ceiling exists to close (NFR-C1).
-- ---------------------------------------------------------------------------

alter type public.ai_task_kind add value if not exists 'ocr';
