-- ---------------------------------------------------------------------------
-- Sprint 36 — vector search.
--
-- This has to be a database function. The REST client cannot express `<=>`, so
-- there is no way to order by vector distance from application code: the
-- alternative is fetching every chunk and sorting in TypeScript, which is the
-- version that works on a demo account and falls over on a real one.
--
-- **`security invoker`, deliberately — the opposite of `claim_jobs`.** The
-- worker runs as the service role because it acts for every student; this runs
-- as the CALLER, so Row Level Security applies and a search can only ever see
-- the asking student's own chunks. A `security definer` here would be a
-- cross-account data leak wearing a performance optimisation's clothes.
-- ---------------------------------------------------------------------------

create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_count int default 8,
  min_similarity float default 0.25,
  p_subject_id uuid default null,
  p_topic_id uuid default null
)
returns table (
  chunk_id uuid,
  material_id uuid,
  material_title text,
  page_from int,
  page_to int,
  content text,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  with candidates as (
    select
      c.id,
      c.material_id,
      m.title as material_title,
      c.page_from,
      c.page_to,
      c.content,
      /* The index is `hnsw (embedding vector_cosine_ops)`, so `<=>` is cosine
         distance and 1 - distance is the similarity a person can reason about.
         Using any other operator here would silently stop using the index. */
      1 - (c.embedding <=> query_embedding) as similarity
    from public.material_chunks c
    join public.materials m on m.id = c.material_id
    where c.embedding is not null
      and (p_subject_id is null or c.subject_id = p_subject_id)
      /* Topic comes through the material rather than the chunk. Sprint 34
         deliberately did not denormalise it: a material is re-filed to a
         different topic whenever a student changes their mind, and a stale topic
         on ten thousand chunks would misattribute mastery. */
      and (p_topic_id is null or m.topic_id = p_topic_id)
    order by c.embedding <=> query_embedding
    /* Over-fetch. HNSW is approximate, and a `where` clause on top of an
       approximate scan can return fewer rows than asked for — the classic
       filtered-vector-search trap, where scoping a query to one of six subjects
       quietly halves the results. Asking for more than we need and trimming
       afterwards costs one cheap sort and makes the result predictable. */
    limit greatest(match_count * 8, 64)
  )
  select
    id as chunk_id,
    material_id,
    material_title,
    page_from,
    page_to,
    content,
    similarity
  from candidates
  /* The relevance floor is what makes "your materials do not cover this" a real
     answer rather than a polite fiction (FR-C3). Without it the nearest
     neighbours are always returned, however far away they are, and the model is
     handed irrelevant text and asked to be helpful with it — which is where
     confident nonsense comes from. */
  where similarity >= min_similarity
  order by similarity desc
  limit match_count;
$$;

comment on function public.match_chunks is
  'Sprint 36: cosine vector search over the caller''s own chunks. security invoker so RLS applies. Over-fetches then trims, because HNSW plus a filter can under-return.';
