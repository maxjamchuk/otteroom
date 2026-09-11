-- Feature 004 is one additive DB/client contract cutover. Existing room,
-- membership and fixture-candidate data is preserved; normal candidate authority
-- is removed from participant roles.
begin;
lock table public.rooms in access exclusive mode;

create temporary table feature004_rooms_before on commit drop as
  select r.id, to_jsonb(r) as row from public.rooms as r;
create temporary table feature004_members_before on commit drop as
  select m.id, to_jsonb(m) as row from public.room_members as m;

alter table public.rooms
  add column filter_completed_count integer not null default 0,
  add constraint rooms_filter_completed_count_check
    check (filter_completed_count >= 0 and filter_completed_count <= required_voter_count),
  add constraint rooms_filters_require_assembled_check
    check (filter_completed_count = 0 or voter_count = required_voter_count);

create type public.participant_genre as enum (
  'action', 'adventure', 'animation', 'comedy', 'crime', 'documentary',
  'drama', 'family', 'fantasy', 'history', 'horror', 'music', 'mystery',
  'romance', 'science_fiction', 'tv_movie', 'thriller', 'war', 'western'
);
alter type public.participant_genre owner to postgres;

create function private.valid_participant_genres(p_genres public.participant_genre[])
returns boolean
language sql immutable strict security invoker set search_path = ''
as $function$
  select
    (pg_catalog.cardinality(p_genres) = 0 or pg_catalog.array_ndims(p_genres) = 1)
    and pg_catalog.array_position(p_genres, null::public.participant_genre) is null
    and pg_catalog.cardinality(p_genres) = (
      select pg_catalog.count(distinct value)
      from pg_catalog.unnest(p_genres) as valueset(value)
    );
$function$;
alter function private.valid_participant_genres(public.participant_genre[]) owner to postgres;
revoke all on function private.valid_participant_genres(public.participant_genre[])
  from public, anon, authenticated;

create table public.participant_filters (
  room_member_id uuid not null,
  genres public.participant_genre[] not null default '{}'::public.participant_genre[],
  release_year_from smallint not null,
  release_year_to smallint not null,
  constraint participant_filters_pkey primary key (room_member_id),
  constraint participant_filters_room_member_id_fkey foreign key (room_member_id)
    references public.room_members(id) on update no action on delete cascade,
  constraint participant_filters_genres_unique_check
    check (private.valid_participant_genres(genres)),
  constraint participant_filters_release_year_check
    check (release_year_from >= 1900 and release_year_from <= release_year_to
      and release_year_to <= 9999)
);
alter table public.participant_filters owner to postgres;
alter table public.participant_filters enable row level security;
revoke all privileges on table public.participant_filters from public, anon, authenticated;

drop function public.create_room(uuid, integer, boolean);
create function public.create_room(
  p_creation_request_id uuid, p_required_voter_count integer, p_creator_is_voter boolean
)
returns table (
  outcome text, room_id uuid, room_code text, room_state text,
  is_creator boolean, is_voter boolean, voter_count integer,
  required_voter_count integer, filter_completed_count integer
)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_existing record;
  v_is_voter boolean;
  v_code text;
  v_constraint text;
  v_outcome text := 'already_created';
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_creation_request_id is null or p_required_voter_count is null or p_creator_is_voter is null then
    raise exception using errcode = '22004', message = 'Creation configuration required';
  end if;
  if p_required_voter_count < 2 then
    raise exception using errcode = '22023', message = 'Invalid required voter count';
  end if;

  select r as room_row, m.is_voter into v_existing
    from public.rooms as r left join public.room_members as m
      on m.room_id = r.id and m.user_id = r.creator_user_id
    where r.creator_user_id = v_user_id and r.creation_request_id = p_creation_request_id;
  if found then
    v_room := v_existing.room_row;
    v_is_voter := v_existing.is_voter;
  else
    for v_attempt in 1..5 loop
      v_code := pg_catalog.upper(pg_catalog.encode(extensions.gen_random_bytes(5), 'hex'));
      begin
        insert into public.rooms as r
          (code, creation_request_id, creator_user_id, required_voter_count, voter_count)
          values (v_code, p_creation_request_id, v_user_id, p_required_voter_count,
            case when p_creator_is_voter then 1 else 0 end)
          returning r.* into v_room;
        insert into public.room_members as m (room_id, user_id, is_voter)
          values (v_room.id, v_user_id, p_creator_is_voter)
          returning m.is_voter into v_is_voter;
        v_outcome := 'created';
        exit;
      exception when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint not in ('rooms_creator_creation_request_key', 'rooms_code_key') then raise; end if;
        select r as room_row, m.is_voter into v_existing
          from public.rooms as r left join public.room_members as m
            on m.room_id = r.id and m.user_id = r.creator_user_id
          where r.creator_user_id = v_user_id and r.creation_request_id = p_creation_request_id;
        if found then
          v_room := v_existing.room_row;
          v_is_voter := v_existing.is_voter;
          exit;
        end if;
        if v_constraint = 'rooms_creator_creation_request_key' then raise; end if;
        if v_attempt = 5 then
          raise exception using errcode = 'P0001', message = 'Room code allocation exhausted';
        end if;
      end;
    end loop;
  end if;
  if v_is_voter is null then
    raise exception using errcode = 'P0001', message = 'Room membership integrity failure';
  end if;
  return query select v_outcome, v_room.id, v_room.code, v_room.state,
    true, v_is_voter, v_room.voter_count, v_room.required_voter_count,
    v_room.filter_completed_count;
end;
$function$;
alter function public.create_room(uuid, integer, boolean) owner to postgres;
revoke all on function public.create_room(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.create_room(uuid, integer, boolean) to authenticated;

drop function public.join_room(text);
create function public.join_room(p_room_code text)
returns table (
  outcome text, room_id uuid, room_code text, room_state text,
  is_creator boolean, is_voter boolean, voter_count integer,
  required_voter_count integer, filter_completed_count integer
)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_code text;
  v_is_voter boolean;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  v_code := pg_catalog.upper(pg_catalog.btrim(p_room_code));
  if v_code is null or v_code !~ '^[0-9A-F]{10}$' then
    return query select 'invalid_code'::text, null::uuid, null::text, null::text,
      null::boolean, null::boolean, null::integer, null::integer, null::integer;
    return;
  end if;
  select r.* into v_room from public.rooms as r where r.code = v_code for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text,
      null::boolean, null::boolean, null::integer, null::integer, null::integer;
    return;
  end if;
  select m.is_voter into v_is_voter from public.room_members as m
    where m.room_id = v_room.id and m.user_id = v_user_id;
  if found then
    if v_user_id <> v_room.creator_user_id and not v_is_voter then
      raise exception using errcode = 'P0001', message = 'Room membership integrity failure';
    end if;
    return query select 'already_member'::text, v_room.id, v_room.code, v_room.state,
      v_user_id = v_room.creator_user_id, v_is_voter, v_room.voter_count,
      v_room.required_voter_count, v_room.filter_completed_count;
    return;
  end if;
  if v_user_id = v_room.creator_user_id then
    raise exception using errcode = 'P0001', message = 'Room membership integrity failure';
  end if;
  if v_room.voter_count = v_room.required_voter_count then
    return query select 'full'::text, null::uuid, null::text, null::text,
      null::boolean, null::boolean, null::integer, null::integer, null::integer;
    return;
  end if;
  insert into public.room_members(room_id, user_id, is_voter)
    values (v_room.id, v_user_id, true);
  update public.rooms as r set voter_count = r.voter_count + 1,
    updated_at = pg_catalog.transaction_timestamp()
    where r.id = v_room.id returning r.* into v_room;
  return query select 'joined'::text, v_room.id, v_room.code, v_room.state,
    false, true, v_room.voter_count, v_room.required_voter_count,
    v_room.filter_completed_count;
end;
$function$;
alter function public.join_room(text) owner to postgres;
revoke all on function public.join_room(text) from public, anon, authenticated;
grant execute on function public.join_room(text) to authenticated;

create function public.get_my_participant_filter(p_room_id uuid)
returns table (
  outcome text, genres public.participant_genre[], release_year_from smallint,
  release_year_to smallint, filter_completed_count integer,
  required_voter_count integer, allowed_release_year_max smallint
)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_member public.room_members%rowtype;
  v_context record;
  v_filter public.participant_filters%rowtype;
  v_actual integer;
  v_has_filter boolean;
  v_max smallint := extract(year from
    pg_catalog.transaction_timestamp() at time zone 'UTC')::smallint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select r as room_row, m as member_row, f as filter_row,
      f.room_member_id is not null as has_filter,
      (select pg_catalog.count(*)::integer
        from public.participant_filters as submitted
        join public.room_members as voter on voter.id = submitted.room_member_id
        where voter.room_id = r.id and voter.is_voter) as actual_filter_count
    into v_context
    from public.rooms as r
    join public.room_members as m on m.room_id = r.id
    left join public.participant_filters as f on f.room_member_id = m.id
    where r.id = p_room_id and m.user_id = v_user_id;
  if not found then
    return query select 'not_found'::text, null::public.participant_genre[],
      null::smallint, null::smallint, null::integer, null::integer, null::smallint;
    return;
  end if;
  v_room := v_context.room_row;
  v_member := v_context.member_row;
  v_filter := v_context.filter_row;
  v_has_filter := v_context.has_filter;
  v_actual := v_context.actual_filter_count;
  if v_actual <> v_room.filter_completed_count
    or (v_room.filter_completed_count > 0 and v_room.state <> 'ready') then
    raise exception using errcode = 'P0001', message = 'Participant filter integrity failure';
  end if;
  if not v_member.is_voter then
    if v_member.user_id <> v_room.creator_user_id or v_has_filter then
      raise exception using errcode = 'P0001', message = 'Participant filter integrity failure';
    end if;
    return query select 'not_voter'::text, null::public.participant_genre[],
      null::smallint, null::smallint, v_room.filter_completed_count,
      v_room.required_voter_count, v_max;
    return;
  end if;
  if v_room.state <> 'ready' then
    if v_has_filter or v_room.filter_completed_count <> 0 then
      raise exception using errcode = 'P0001', message = 'Participant filter integrity failure';
    end if;
    return query select 'not_ready'::text, null::public.participant_genre[],
      null::smallint, null::smallint, v_room.filter_completed_count,
      v_room.required_voter_count, v_max;
    return;
  end if;
  if not v_has_filter then
    if v_room.filter_completed_count = v_room.required_voter_count then
      raise exception using errcode = 'P0001', message = 'Participant filter integrity failure';
    end if;
    return query select 'not_submitted'::text, null::public.participant_genre[],
      null::smallint, null::smallint, v_room.filter_completed_count,
      v_room.required_voter_count, v_max;
    return;
  end if;
  return query select
    case when v_room.filter_completed_count = v_room.required_voter_count
      then 'locked'::text else 'saved'::text end,
    v_filter.genres, v_filter.release_year_from, v_filter.release_year_to,
    v_room.filter_completed_count, v_room.required_voter_count, v_max;
end;
$function$;
alter function public.get_my_participant_filter(uuid) owner to postgres;
revoke all on function public.get_my_participant_filter(uuid) from public, anon, authenticated;
grant execute on function public.get_my_participant_filter(uuid) to authenticated;

create function public.submit_my_participant_filter(
  p_room_id uuid, p_genres public.participant_genre[],
  p_release_year_from smallint, p_release_year_to smallint
)
returns table (
  outcome text, genres public.participant_genre[], release_year_from smallint,
  release_year_to smallint, filter_completed_count integer,
  required_voter_count integer, allowed_release_year_max smallint
)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_member public.room_members%rowtype;
  v_context record;
  v_filter public.participant_filters%rowtype;
  v_canonical public.participant_genre[];
  v_actual integer;
  v_has_filter boolean;
  v_max smallint := extract(year from
    pg_catalog.transaction_timestamp() at time zone 'UTC')::smallint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select r as room_row, m as member_row into v_context
    from public.rooms as r join public.room_members as m on m.room_id = r.id
    where r.id = p_room_id and m.user_id = v_user_id
    for update of r;
  if not found then
    return query select 'not_found'::text, null::public.participant_genre[],
      null::smallint, null::smallint, null::integer, null::integer, null::smallint;
    return;
  end if;
  v_room := v_context.room_row;
  v_member := v_context.member_row;
  select pg_catalog.count(*)::integer into v_actual
    from public.participant_filters as f join public.room_members as m
      on m.id = f.room_member_id
    where m.room_id = v_room.id and m.is_voter;
  if v_actual <> v_room.filter_completed_count
    or (v_room.filter_completed_count > 0 and v_room.state <> 'ready') then
    raise exception using errcode = 'P0001', message = 'Participant filter integrity failure';
  end if;
  select f.* into v_filter from public.participant_filters as f
    where f.room_member_id = v_member.id;
  v_has_filter := found;
  if not v_member.is_voter then
    if v_member.user_id <> v_room.creator_user_id or v_has_filter then
      raise exception using errcode = 'P0001', message = 'Participant filter integrity failure';
    end if;
    return query select 'not_voter'::text, null::public.participant_genre[],
      null::smallint, null::smallint, v_room.filter_completed_count,
      v_room.required_voter_count, v_max;
    return;
  end if;
  if v_room.state <> 'ready' then
    if v_has_filter or v_room.filter_completed_count <> 0 then
      raise exception using errcode = 'P0001', message = 'Participant filter integrity failure';
    end if;
    return query select 'not_ready'::text, null::public.participant_genre[],
      null::smallint, null::smallint, v_room.filter_completed_count,
      v_room.required_voter_count, v_max;
    return;
  end if;
  if v_has_filter and v_room.filter_completed_count = v_room.required_voter_count then
    if p_genres is not null and private.valid_participant_genres(p_genres)
      and p_release_year_from is not null and p_release_year_to is not null
      and p_release_year_from >= 1900 and p_release_year_from <= p_release_year_to
      and p_release_year_to <= v_max then
      select coalesce(pg_catalog.array_agg(value order by value),
        '{}'::public.participant_genre[]) into v_canonical
        from pg_catalog.unnest(p_genres) as valueset(value);
    end if;
    return query select
      case when v_canonical = v_filter.genres
        and p_release_year_from = v_filter.release_year_from
        and p_release_year_to = v_filter.release_year_to
        then 'unchanged'::text else 'locked'::text end,
      v_filter.genres, v_filter.release_year_from, v_filter.release_year_to,
      v_room.filter_completed_count, v_room.required_voter_count, v_max;
    return;
  elsif not v_has_filter and v_room.filter_completed_count = v_room.required_voter_count then
    raise exception using errcode = 'P0001', message = 'Participant filter integrity failure';
  end if;
  if p_genres is null or not private.valid_participant_genres(p_genres) then
    return query select 'invalid_genres'::text, null::public.participant_genre[],
      null::smallint, null::smallint, v_room.filter_completed_count,
      v_room.required_voter_count, v_max;
    return;
  end if;
  if p_release_year_from is null or p_release_year_to is null
    or p_release_year_from < 1900 or p_release_year_from > p_release_year_to
    or p_release_year_to > v_max then
    return query select 'invalid_year_range'::text, null::public.participant_genre[],
      null::smallint, null::smallint, v_room.filter_completed_count,
      v_room.required_voter_count, v_max;
    return;
  end if;
  select coalesce(pg_catalog.array_agg(value order by value),
    '{}'::public.participant_genre[]) into v_canonical
    from pg_catalog.unnest(p_genres) as valueset(value);
  if v_has_filter then
    if v_canonical = v_filter.genres
      and p_release_year_from = v_filter.release_year_from
      and p_release_year_to = v_filter.release_year_to then
      return query select 'unchanged'::text, v_filter.genres,
        v_filter.release_year_from, v_filter.release_year_to,
        v_room.filter_completed_count, v_room.required_voter_count, v_max;
      return;
    end if;
    update public.participant_filters as f set genres = v_canonical,
      release_year_from = p_release_year_from, release_year_to = p_release_year_to
      where f.room_member_id = v_member.id returning f.* into v_filter;
  else
    insert into public.participant_filters as f
      (room_member_id, genres, release_year_from, release_year_to)
      values (v_member.id, v_canonical, p_release_year_from, p_release_year_to)
      returning f.* into v_filter;
    update public.rooms as r set filter_completed_count = r.filter_completed_count + 1,
      updated_at = pg_catalog.transaction_timestamp()
      where r.id = v_room.id returning r.* into v_room;
  end if;
  return query select 'saved'::text, v_filter.genres, v_filter.release_year_from,
    v_filter.release_year_to, v_room.filter_completed_count,
    v_room.required_voter_count, v_max;
end;
$function$;
alter function public.submit_my_participant_filter(
  uuid, public.participant_genre[], smallint, smallint) owner to postgres;
revoke all on function public.submit_my_participant_filter(
  uuid, public.participant_genre[], smallint, smallint) from public, anon, authenticated;
grant execute on function public.submit_my_participant_filter(
  uuid, public.participant_genre[], smallint, smallint) to authenticated;

revoke all privileges (id, code, creation_request_id, creator_user_id, state,
  created_at, updated_at, movie_candidate_id, required_voter_count, voter_count,
  filter_completed_count) on public.rooms from public, anon, authenticated;
grant select (id, code, state, voter_count, required_voter_count,
  filter_completed_count) on public.rooms to authenticated;

revoke execute on function public.ensure_room_candidate(uuid) from authenticated;

do $verify$
begin
  if exists (
    select 1 from feature004_rooms_before as b join public.rooms as r on r.id = b.id
    where (to_jsonb(r) - 'filter_completed_count') <> b.row
  ) or (select pg_catalog.count(*) from feature004_rooms_before)
    <> (select pg_catalog.count(*) from public.rooms)
  or exists (
    select 1 from feature004_members_before as b join public.room_members as m on m.id = b.id
    where to_jsonb(m) <> b.row
  ) or (select pg_catalog.count(*) from feature004_members_before)
    <> (select pg_catalog.count(*) from public.room_members)
  or exists (select 1 from public.rooms where filter_completed_count <> 0)
  or exists (select 1 from public.participant_filters)
  or exists (
    select 1 from public.rooms as r
    where r.filter_completed_count <> (
      select pg_catalog.count(*) from public.participant_filters as f
      join public.room_members as m on m.id = f.room_member_id
      where m.room_id = r.id and m.is_voter
    )
  ) then
    raise exception using errcode = 'P0001', message = 'Participant filter cutover integrity failure';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime') <> 1
    or not exists (select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename = 'rooms') then
    raise exception using errcode = 'P0001', message = 'Realtime publication integrity failure';
  end if;
end;
$verify$;

notify pgrst, 'reload schema';
commit;
