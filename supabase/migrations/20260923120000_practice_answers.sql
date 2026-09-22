-- ============================================================================
-- Acadify — practice remembers WHICH questions were missed
--
-- No new tables. `quiz_attempts` and `quiz_answers` have existed with the right
-- shape and the right RLS since the Sprint 13 schema and nothing has ever
-- written to them; the mistakes list is what they were for.
--
-- WHAT IS STORED, AND WHAT IS DELIBERATELY NOT. A row per question per attempt,
-- carrying `is_correct` and nothing else — `given_answer` stays NULL. Keeping
-- the text a student typed is what would make this a record of how badly
-- somebody was doing, and none of it is needed: "you missed this one, here it
-- is again" only requires the verdict. The privacy line the practice screen
-- already drew moves rather than disappears.
--
-- The index is the whole migration. The mistakes list asks one question —
-- "for each of these questions, was my most recent answer wrong?" — and without
-- an index that is a scan of every answer the student has ever given.
-- ============================================================================

create index if not exists quiz_answers_latest_idx
  on public.quiz_answers (user_id, question_id, answered_at desc);

-- Attempts are read newest-first for one quiz, when a run is being recorded.
create index if not exists quiz_attempts_quiz_recent_idx
  on public.quiz_attempts (user_id, quiz_id, started_at desc);
