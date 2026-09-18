-- Feature 007 adds immutable voter decisions for the already assigned TMDB
-- candidate. PostgreSQL remains the sole authority for identity, candidate
-- binding, first-write-wins behavior, and the privacy-safe room watermark.
begin;
lock table public.rooms in access exclusive mode;

create temporary table feature007_rooms_before on commit drop as
  select r.id, to_jsonb(r) as row, r.xmin::text as row_xmin
  from public.rooms as r;

create type public.candidate_decision_value as enum ('yes', 'no');
alter type public.candidate_decision_value owner to postgres;

alter table public.rooms
  add column decision_completed_count integer not null default 0,
  add constraint rooms_decision_completed_count_bounds_check check (
    decision_completed_count >= 0
    and decision_completed_count <= required_voter_count
  ),
  add constraint rooms_decisions_require_assigned_candidate_check check (
    decision_completed_count = 0 or (
      state = 'ready'
      and voter_count = required_voter_count
      and filter_completed_count = required_voter_count
      and filter_resolution_status = 'compatible'
      and candidate_acquisition_status = 'assigned'
      and tmdb_movie_id is not null
    )
  );

create table public.candidate_decisions (
  room_member_id uuid not null,
  tmdb_movie_id bigint not null,
  decision public.candidate_decision_value not null,
  accepted_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint candidate_decisions_pkey primary key (room_member_id, tmdb_movie_id),
  constraint candidate_decisions_room_member_id_fkey foreign key (room_member_id)
    references public.room_members(id) on update no action on delete cascade,
  constraint candidate_decisions_tmdb_movie_id_positive_check check (tmdb_movie_id > 0)
);
alter table public.candidate_decisions owner to postgres;
alter table public.candidate_decisions enable row level security;
revoke all privileges on table public.candidate_decisions from public, anon, authenticated;

-- The room RPC projections append the watermark and preserve every prior
-- branch, authorization check, and all-null rejected shape.
drop function public.create_room(uuid, integer, boolean);
create function public.create_room(
  p_creation_request_id uuid,
  p_required_voter_count integer,
  p_creator_is_voter boolean
)
returns table (
  outcome text,
  room_id uuid,
  room_code text,
  room_state text,
  is_creator boolean,
  is_voter boolean,
  voter_count integer,
  required_voter_count integer,
  filter_completed_count integer,
  filter_resolution_status public.filter_resolution_status,
  candidate_acquisition_status public.candidate_acquisition_status,
  decision_completed_count integer
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
  v_attempt integer;
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
  from public.rooms as r
  left join public.room_members as m
    on m.room_id = r.id and m.user_id = r.creator_user_id
  where r.creator_user_id = v_user_id
    and r.creation_request_id = p_creation_request_id;

  if found then
    v_room := v_existing.room_row;
    v_is_voter := v_existing.is_voter;
  else
    for v_attempt in 1..5 loop
      v_code := pg_catalog.upper(pg_catalog.encode(extensions.gen_random_bytes(5), 'hex'));
      begin
        insert into public.rooms as r
          (code, creation_request_id, creator_user_id, required_voter_count, voter_count)
        values (
          v_code, p_creation_request_id, v_user_id, p_required_voter_count,
          case when p_creator_is_voter then 1 else 0 end
        ) returning r.* into v_room;
        insert into public.room_members as m (room_id, user_id, is_voter)
          values (v_room.id, v_user_id, p_creator_is_voter)
          returning m.is_voter into v_is_voter;
        v_outcome := 'created';
        exit;
      exception when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint not in ('rooms_creator_creation_request_key', 'rooms_code_key') then raise; end if;
        select r as room_row, m.is_voter into v_existing
        from public.rooms as r
        left join public.room_members as m
          on m.room_id = r.id and m.user_id = r.creator_user_id
        where r.creator_user_id = v_user_id
          and r.creation_request_id = p_creation_request_id;
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
  return query select v_outcome, v_room.id, v_room.code, v_room.state, true,
    v_is_voter, v_room.voter_count, v_room.required_voter_count,
    v_room.filter_completed_count, v_room.filter_resolution_status,
    v_room.candidate_acquisition_status, v_room.decision_completed_count;
end;
$function$;
alter function public.create_room(uuid, integer, boolean) owner to postgres;
revoke all on function public.create_room(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.create_room(uuid, integer, boolean) to authenticated;

drop function public.join_room(text);
create function public.join_room(p_room_code text)
returns table (
  outcome text,
  room_id uuid,
  room_code text,
  room_state text,
  is_creator boolean,
  is_voter boolean,
  voter_count integer,
  required_voter_count integer,
  filter_completed_count integer,
  filter_resolution_status public.filter_resolution_status,
  candidate_acquisition_status public.candidate_acquisition_status,
  decision_completed_count integer
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
      null::boolean, null::boolean, null::integer, null::integer, null::integer,
      null::public.filter_resolution_status, null::public.candidate_acquisition_status,
      null::integer;
    return;
  end if;

  select r.* into v_room from public.rooms as r where r.code = v_code for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text,
      null::boolean, null::boolean, null::integer, null::integer, null::integer,
      null::public.filter_resolution_status, null::public.candidate_acquisition_status,
      null::integer;
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
      v_room.required_voter_count, v_room.filter_completed_count,
      v_room.filter_resolution_status, v_room.candidate_acquisition_status,
      v_room.decision_completed_count;
    return;
  end if;

  if v_user_id = v_room.creator_user_id then
    raise exception using errcode = 'P0001', message = 'Room membership integrity failure';
  end if;
  if v_room.voter_count = v_room.required_voter_count then
    return query select 'full'::text, null::uuid, null::text, null::text,
      null::boolean, null::boolean, null::integer, null::integer, null::integer,
      null::public.filter_resolution_status, null::public.candidate_acquisition_status,
      null::integer;
    return;
  end if;

  insert into public.room_members (room_id, user_id, is_voter)
    values (v_room.id, v_user_id, true);
  update public.rooms as r
    set voter_count = r.voter_count + 1,
      updated_at = pg_catalog.transaction_timestamp()
    where r.id = v_room.id returning r.* into v_room;
  return query select 'joined'::text, v_room.id, v_room.code, v_room.state,
    false, true, v_room.voter_count, v_room.required_voter_count,
    v_room.filter_completed_count, v_room.filter_resolution_status,
    v_room.candidate_acquisition_status, v_room.decision_completed_count;
end;
$function$;
alter function public.join_room(text) owner to postgres;
revoke all on function public.join_room(text) from public, anon, authenticated;
grant execute on function public.join_room(text) to authenticated;

create function public.get_room_candidate_decision(
  p_room_id uuid,
  p_expected_tmdb_movie_id bigint
)
returns table (
  outcome text,
  my_decision public.candidate_decision_value,
  decision_completed_count integer,
  required_voter_count integer,
  decision_set_complete boolean,
  two_voter_agreement boolean
)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_member public.room_members%rowtype;
  v_detail_count integer;
  v_yes_count integer;
  v_my_decision public.candidate_decision_value;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_room_id is null or p_expected_tmdb_movie_id is null or p_expected_tmdb_movie_id <= 0 then
    raise exception using errcode = '22023', message = 'Invalid decision target';
  end if;

  -- Establish authorization before taking a room lock. A foreign caller never
  -- joins the locked room's wait queue.
  select m.* into v_member
  from public.room_members as m
  join public.rooms as r on r.id = m.room_id
  where r.id = p_room_id and m.user_id = v_user_id
    and (m.is_voter or r.creator_user_id = v_user_id);
  if not found then
    return query select 'not_found'::text, null::public.candidate_decision_value,
      null::integer, null::integer, null::boolean, null::boolean;
    return;
  end if;

  select r.* into v_room
  from public.rooms as r
  join public.room_members as m on m.room_id = r.id and m.id = v_member.id
  where r.id = p_room_id and m.user_id = v_user_id
  for share of r;
  if not found then
    return query select 'not_found'::text, null::public.candidate_decision_value,
      null::integer, null::integer, null::boolean, null::boolean;
    return;
  end if;

  if v_room.state <> 'ready'
    or v_room.voter_count <> v_room.required_voter_count
    or v_room.filter_completed_count <> v_room.required_voter_count
    or v_room.filter_resolution_status <> 'compatible'
    or v_room.candidate_acquisition_status <> 'assigned'
    or v_room.tmdb_movie_id is null then
    return query select 'not_ready'::text, null::public.candidate_decision_value,
      null::integer, null::integer, null::boolean, null::boolean;
    return;
  end if;
  if v_room.tmdb_movie_id <> p_expected_tmdb_movie_id then
    return query select 'candidate_changed'::text, null::public.candidate_decision_value,
      null::integer, null::integer, null::boolean, null::boolean;
    return;
  end if;

  select pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (where d.decision = 'yes')::integer
  into v_detail_count, v_yes_count
  from public.candidate_decisions as d
  join public.room_members as m on m.id = d.room_member_id
  where m.room_id = v_room.id and m.is_voter
    and d.tmdb_movie_id = v_room.tmdb_movie_id;
  if v_detail_count <> v_room.decision_completed_count then
    raise exception using errcode = 'P0001', message = 'Room decision integrity failure';
  end if;

  if v_member.is_voter then
    select d.decision into v_my_decision
    from public.candidate_decisions as d
    where d.room_member_id = v_member.id
      and d.tmdb_movie_id = v_room.tmdb_movie_id;
  end if;

  return query select
    case when not v_member.is_voter then 'observer'
      when v_my_decision is null then 'not_decided' else 'decided' end,
    v_my_decision,
    v_room.decision_completed_count,
    v_room.required_voter_count,
    v_room.decision_completed_count = v_room.required_voter_count,
    case when v_room.required_voter_count = 2
      then v_detail_count = 2 and v_yes_count = 2 else null::boolean end;
end;
$function$;
alter function public.get_room_candidate_decision(uuid, bigint) owner to postgres;
revoke all on function public.get_room_candidate_decision(uuid, bigint) from public, anon, authenticated;
grant execute on function public.get_room_candidate_decision(uuid, bigint) to authenticated;

create function public.submit_room_candidate_decision(
  p_room_id uuid,
  p_expected_tmdb_movie_id bigint,
  p_decision public.candidate_decision_value
)
returns table (
  outcome text,
  my_decision public.candidate_decision_value,
  decision_completed_count integer,
  required_voter_count integer,
  decision_set_complete boolean,
  two_voter_agreement boolean
)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_member public.room_members%rowtype;
  v_detail_count integer;
  v_yes_count integer;
  v_stored public.candidate_decision_value;
  v_outcome text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_room_id is null or p_expected_tmdb_movie_id is null
    or p_expected_tmdb_movie_id <= 0 or p_decision is null then
    raise exception using errcode = '22023', message = 'Invalid decision submission';
  end if;

  select r.* into v_room from public.rooms as r where r.id = p_room_id for update;
  if not found then
    return query select 'not_found'::text, null::public.candidate_decision_value,
      null::integer, null::integer, null::boolean, null::boolean;
    return;
  end if;
  select m.* into v_member from public.room_members as m
  where m.room_id = v_room.id and m.user_id = v_user_id
    and (m.is_voter or v_room.creator_user_id = v_user_id);
  if not found then
    return query select 'not_found'::text, null::public.candidate_decision_value,
      null::integer, null::integer, null::boolean, null::boolean;
    return;
  end if;

  if not v_member.is_voter then
    select pg_catalog.count(*)::integer,
      pg_catalog.count(*) filter (where d.decision = 'yes')::integer
    into v_detail_count, v_yes_count
    from public.candidate_decisions as d
    join public.room_members as m on m.id = d.room_member_id
    where m.room_id = v_room.id and m.is_voter
      and d.tmdb_movie_id = v_room.tmdb_movie_id;
    if v_detail_count <> v_room.decision_completed_count then
      raise exception using errcode = 'P0001', message = 'Room decision integrity failure';
    end if;
    return query select 'not_voter'::text, null::public.candidate_decision_value,
      v_room.decision_completed_count, v_room.required_voter_count,
      v_room.decision_completed_count = v_room.required_voter_count,
      case when v_room.required_voter_count = 2
        then v_detail_count = 2 and v_yes_count = 2 else null::boolean end;
    return;
  end if;

  if v_room.state <> 'ready'
    or v_room.voter_count <> v_room.required_voter_count
    or v_room.filter_completed_count <> v_room.required_voter_count
    or v_room.filter_resolution_status <> 'compatible'
    or v_room.candidate_acquisition_status <> 'assigned'
    or v_room.tmdb_movie_id is null then
    return query select 'not_ready'::text, null::public.candidate_decision_value,
      null::integer, null::integer, null::boolean, null::boolean;
    return;
  end if;
  if v_room.tmdb_movie_id <> p_expected_tmdb_movie_id then
    return query select 'candidate_changed'::text, null::public.candidate_decision_value,
      null::integer, null::integer, null::boolean, null::boolean;
    return;
  end if;

  select pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (where d.decision = 'yes')::integer
  into v_detail_count, v_yes_count
  from public.candidate_decisions as d
  join public.room_members as m on m.id = d.room_member_id
  where m.room_id = v_room.id and m.is_voter
    and d.tmdb_movie_id = v_room.tmdb_movie_id;
  if v_detail_count <> v_room.decision_completed_count then
    raise exception using errcode = 'P0001', message = 'Room decision integrity failure';
  end if;

  select d.decision into v_stored
  from public.candidate_decisions as d
  where d.room_member_id = v_member.id
    and d.tmdb_movie_id = v_room.tmdb_movie_id;
  if found then
    v_outcome := case when v_stored = p_decision then 'unchanged' else 'conflict' end;
  else
    insert into public.candidate_decisions (room_member_id, tmdb_movie_id, decision)
      values (v_member.id, v_room.tmdb_movie_id, p_decision)
      returning decision into v_stored;
    update public.rooms as r
      set decision_completed_count = r.decision_completed_count + 1,
        updated_at = pg_catalog.transaction_timestamp()
      where r.id = v_room.id
      returning r.* into v_room;
    v_detail_count := v_detail_count + 1;
    if v_stored = 'yes' then v_yes_count := v_yes_count + 1; end if;
    v_outcome := 'accepted';
  end if;

  return query select v_outcome, v_stored, v_room.decision_completed_count,
    v_room.required_voter_count,
    v_room.decision_completed_count = v_room.required_voter_count,
    case when v_room.required_voter_count = 2
      then v_detail_count = 2 and v_yes_count = 2 else null::boolean end;
end;
$function$;
alter function public.submit_room_candidate_decision(uuid, bigint, public.candidate_decision_value) owner to postgres;
revoke all on function public.submit_room_candidate_decision(uuid, bigint, public.candidate_decision_value)
  from public, anon, authenticated;
grant execute on function public.submit_room_candidate_decision(uuid, bigint, public.candidate_decision_value)
  to authenticated;

-- Rebuild the exact safe room projection. TMDB identity and decision detail
-- remain denied to ordinary clients.
revoke all privileges (
  id, code, creation_request_id, creator_user_id, state, created_at, updated_at,
  movie_candidate_id, required_voter_count, voter_count, filter_completed_count,
  filter_resolution_status, candidate_acquisition_status, tmdb_movie_id,
  decision_completed_count
) on public.rooms from public, anon, authenticated;
grant select (
  id, code, state, voter_count, required_voter_count, filter_completed_count,
  filter_resolution_status, candidate_acquisition_status, decision_completed_count
) on public.rooms to authenticated;

do $verify$
begin
  if exists (
    select 1 from feature007_rooms_before as b
    join public.rooms as r on r.id = b.id
    where (to_jsonb(r) - 'decision_completed_count') <> b.row
      or r.xmin::text <> b.row_xmin
  ) or exists (select 1 from public.rooms where decision_completed_count <> 0)
    or exists (select 1 from public.candidate_decisions)
  then
    raise exception using errcode = 'P0001', message = 'Swipe decision cutover integrity failure';
  end if;
  if (select pg_catalog.count(*) from pg_publication_tables
      where pubname = 'supabase_realtime') <> 1
    or not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'rooms'
    )
  then
    raise exception using errcode = 'P0001', message = 'Realtime publication integrity failure';
  end if;
end;
$verify$;

notify pgrst, 'reload schema';
commit;
