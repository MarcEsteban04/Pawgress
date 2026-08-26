-- ---------------------------------------------------------------------------
-- Sprint 32 — where each page starts in the extracted text.
--
-- Extraction reads a document page by page, then stores one normalised string
-- in `materials.extracted_text` because that is what every downstream consumer
-- wants to read. Joining the pages throws away which page a sentence came from,
-- and that is the one fact every citation depends on (FR-P2, FR-P6).
--
-- So the boundaries are kept alongside the text: an array of
-- `{ "page": 1, "start": 0, "end": 1840 }`, character offsets into
-- `extracted_text`. Sprint 34 maps a chunk's range onto a page with a lookup
-- rather than re-parsing the file.
--
-- Why offsets and not one row per page: chunks do not respect page boundaries.
-- A paragraph that runs across a page break is one chunk spanning two pages,
-- which a page-per-row table makes awkward and a range lookup makes trivial.
-- ---------------------------------------------------------------------------

alter table public.materials
  add column page_offsets jsonb;

comment on column public.materials.page_offsets is
  'Sprint 32: [{page, start, end}] character offsets into extracted_text, so a chunk can name the page it came from. Null until extraction runs, and null for typed notes, which have no pages.';
