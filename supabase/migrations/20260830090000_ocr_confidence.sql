-- ---------------------------------------------------------------------------
-- Sprint 33 — how much to trust text that came out of a photograph.
--
-- Extraction from a PDF is either right or it failed. OCR is neither: a clear
-- photo of printed text transcribes almost perfectly, and a phone snap of
-- someone's handwriting at an angle in bad light produces something that reads
-- like the original but is not.
--
-- US-C7 requires that a student be told when the reading is shaky, so the
-- confidence has to be stored rather than inferred. Without it the app would
-- present a guess with the same authority as a certainty — and then build a
-- quiz on it.
-- ---------------------------------------------------------------------------

alter table public.materials
  add column ocr_confidence numeric(3, 2)
    check (ocr_confidence >= 0 and ocr_confidence <= 1);

comment on column public.materials.ocr_confidence is
  'Sprint 33: 0-1 self-reported transcription confidence. Null for anything that did not go through OCR, which is every material except images.';
