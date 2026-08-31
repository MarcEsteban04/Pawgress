-- ============================================================================
-- Acadify — reordering topics (Sprint 24, FR-S7)
--
-- Topics have carried a sparse `position` since Sprint 21 (100, 200, 300…)
-- specifically so a move writes ONE row: the new position is the midpoint
-- between the two rows it lands between. Rewriting every row on every drag
-- would be n writes for a one-row change, and would fight any other tab that
-- was reordering at the same time.
--
-- Midpoints run out. Repeatedly dropping a topic into the same gap halves it
-- until two positions are adjacent integers and there is no midpoint left.
-- That is what this function is for: when the gap collapses, respace the whole
-- subject back to 100, 200, 300 and try again. It is O(n) but happens roughly
-- once per fifty moves, rather than on every one.
--
-- A function rather than application code because it must be ATOMIC. Read
-- positions, compute a midpoint, write it — done as three round trips from
-- Node, two tabs reordering at once can interleave and both land on the same
-- position. Inside one statement they cannot.
--
-- SECURITY INVOKER (the default) on purpose. This one writes to the same table
-- the caller is already allowed to write to, so RLS applies exactly as it does
-- to a direct UPDATE, and a student cannot reorder somebody else's topics by
-- calling it with their id. A definer here would be handing out an escape from
-- the policy for no reason.
-- ============================================================================

create or replace function public.move_topic(p_topic_id uuid, p_to_index int)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_subject uuid;
  v_before numeric;
  v_after numeric;
  v_new numeric;
begin
  -- RLS restricts this to the caller's own topics; a foreign id finds nothing.
  select subject_id into v_subject from public.topics where id = p_topic_id;
  if v_subject is null then
    raise exception 'topic not found' using errcode = 'no_data_found';
  end if;

  /* The neighbours are taken from the list WITHOUT the moved topic, because
     "drop it third" means third among the others. Counting the row being
     dragged would make the target index mean something different depending on
     which direction it came from — the classic off-by-one in every reorder. */
  with others as (
    select id, position, row_number() over (order by position, created_at) - 1 as idx
      from public.topics
     where subject_id = v_subject and id <> p_topic_id
  )
  select
    (select position from others where idx = p_to_index - 1),
    (select position from others where idx = p_to_index)
  into v_before, v_after;

  v_new := case
    when v_before is null and v_after is null then 100
    when v_before is null then v_after - 100
    when v_after is null then v_before + 100
    else (v_before + v_after) / 2.0
  end;

  /* The gap collapsed. Respace everything else, then land on a clean midpoint.
     `position` is an int, so "no midpoint left" means the neighbours differ by
     less than 2 — not by less than some epsilon. */
  if v_before is not null and v_after is not null and (v_after - v_before) < 2 then
    with respaced as (
      select id, (row_number() over (order by position, created_at)) * 100 as fresh
        from public.topics
       where subject_id = v_subject and id <> p_topic_id
    )
    update public.topics t
       set position = r.fresh
      from respaced r
     where t.id = r.id;

    v_new := (p_to_index * 100) + 50;
  end if;

  update public.topics set position = round(v_new) where id = p_topic_id;
end;
$$;

comment on function public.move_topic(uuid, int) is
  'Moves a topic to a zero-based index among its siblings. Atomic; respaces when sparse gaps collapse.';

revoke all on function public.move_topic(uuid, int) from public;
grant execute on function public.move_topic(uuid, int) to authenticated;
