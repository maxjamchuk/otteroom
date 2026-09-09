-- Publish the sole candidate RPC and its least-privilege ACL atomically.
begin;

create function public.ensure_room_candidate(p_room_id uuid)
returns table (
  outcome text,
  candidate_id text,
  title text,
  release_year smallint,
  poster_key text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_candidate public.movie_candidates%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  -- READ COMMITTED returns the current row after a competing locker commits.
  -- Make every membership/readiness/assignment decision under this row lock.
  select r.* into v_room from public.rooms as r where r.id = p_room_id for update;
  if not found then
    return query select 'not_found'::text, null::text, null::text, null::smallint, null::text;
    return;
  end if;
  if v_user_id is distinct from v_room.host_user_id
    and v_user_id is distinct from v_room.guest_user_id then
    return query select 'not_found'::text, null::text, null::text, null::smallint, null::text;
    return;
  end if;
  if v_room.guest_user_id is null then
    return query select 'not_ready'::text, null::text, null::text, null::smallint, null::text;
    return;
  end if;

  if v_room.movie_candidate_id is not null then
    select c.* into v_candidate from public.movie_candidates as c
      where c.id = v_room.movie_candidate_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'Room candidate integrity failure';
    end if;
    -- Existing assignments are read-only, including updated_at.
  else
    select c.* into v_candidate from public.movie_candidates as c
      order by c.sort_order asc limit 1;
    if not found then
      raise exception using errcode = 'P0001', message = 'Movie candidate catalog is empty';
    end if;
    update public.rooms as r set movie_candidate_id = v_candidate.id,
      updated_at = pg_catalog.transaction_timestamp() where r.id = v_room.id;
  end if;

  return query select 'available'::text, v_candidate.id, v_candidate.title,
    v_candidate.release_year, v_candidate.poster_key;
end;
$function$;

alter function public.ensure_room_candidate(uuid) owner to postgres;
revoke all on function public.ensure_room_candidate(uuid) from public, anon, authenticated;
grant execute on function public.ensure_room_candidate(uuid) to authenticated;

commit;
