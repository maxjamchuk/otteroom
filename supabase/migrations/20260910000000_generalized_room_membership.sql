-- Atomic DB contract cutover. Apply with application traffic stopped; the
-- generalized client/types ship with this migration as one coherent release.
begin;
lock table public.rooms in access exclusive mode;

drop function public.create_room(uuid);
drop function public.join_room(text);
drop policy rooms_select_member on public.rooms;

alter table public.rooms rename column host_user_id to creator_user_id;
alter table public.rooms rename constraint rooms_host_user_id_fkey to rooms_creator_user_id_fkey;
alter table public.rooms rename constraint rooms_host_creation_request_key to rooms_creator_creation_request_key;
alter table public.rooms
  add column required_voter_count integer not null default 2,
  add column voter_count integer not null default 0;

create table public.room_members (
  id uuid not null default extensions.gen_random_uuid(),
  room_id uuid not null,
  user_id uuid not null,
  is_voter boolean not null,
  joined_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint room_members_pkey primary key (id),
  constraint room_members_room_user_key unique (room_id, user_id),
  constraint room_members_room_id_fkey foreign key (room_id)
    references public.rooms(id) on update no action on delete cascade,
  constraint room_members_user_id_fkey foreign key (user_id)
    references auth.users(id) on update no action on delete restrict
);
alter table public.room_members owner to postgres;
revoke all privileges on table public.room_members from public, anon, authenticated;
alter table public.room_members enable row level security;

-- Legacy membership is materialized now; updated_at is not a recovered guest
-- admission timestamp. Preserve both existing room timestamps and candidate FK.
update public.rooms set voter_count = case when guest_user_id is null then 1 else 2 end;
insert into public.room_members(room_id, user_id, is_voter)
  select r.id, r.creator_user_id, true from public.rooms as r;
insert into public.room_members(room_id, user_id, is_voter)
  select r.id, r.guest_user_id, true from public.rooms as r where r.guest_user_id is not null;

alter table public.rooms alter column state set expression as (
  case when voter_count = required_voter_count then 'ready'::text else 'waiting'::text end
);
alter table public.rooms
  add constraint rooms_required_voter_count_check check (required_voter_count >= 2),
  add constraint rooms_voter_count_check check (voter_count >= 0 and voter_count <= required_voter_count),
  add constraint rooms_candidate_requires_ready_check check (movie_candidate_id is null or voter_count = required_voter_count),
  drop constraint rooms_candidate_requires_guest_check;

-- A private boolean lookup permits room RLS without granting a member roster.
create schema if not exists private;
alter schema private owner to postgres;
revoke all privileges on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create function private.is_room_member(p_room_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.room_members as m
    where m.room_id = p_room_id and m.user_id = auth.uid()
  );
$function$;
alter function private.is_room_member(uuid) owner to postgres;
revoke all on function private.is_room_member(uuid) from public, anon, authenticated;
grant execute on function private.is_room_member(uuid) to authenticated;

revoke all privileges on table public.rooms from public, anon, authenticated;
-- Table-level REVOKE alone does not remove the historical column grants.
revoke all privileges (id, code, creation_request_id, creator_user_id, guest_user_id,
  state, created_at, updated_at, movie_candidate_id, required_voter_count, voter_count)
  on public.rooms from public, anon, authenticated;
grant select (id, code, state, voter_count, required_voter_count) on public.rooms to authenticated;
create policy rooms_select_member on public.rooms for select to authenticated
  using (private.is_room_member(id));

create function public.create_room(
  p_creation_request_id uuid, p_required_voter_count integer, p_creator_is_voter boolean
)
returns table (
  outcome text, room_id uuid, room_code text, room_state text,
  is_creator boolean, is_voter boolean, voter_count integer, required_voter_count integer
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

  -- One coherent statement sees both persisted configuration and creator flag.
  -- LEFT JOIN deliberately distinguishes a missing member from a new request.
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
        insert into public.rooms as r (code, creation_request_id, creator_user_id, required_voter_count, voter_count)
          values (v_code, p_creation_request_id, v_user_id, p_required_voter_count,
            case when p_creator_is_voter then 1 else 0 end)
          returning r.* into v_room;
        insert into public.room_members as m (room_id, user_id, is_voter)
          values (v_room.id, v_user_id, p_creator_is_voter) returning m.is_voter into v_is_voter;
        v_outcome := 'created';
        exit;
      exception when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint not in ('rooms_creator_creation_request_key', 'rooms_code_key') then raise; end if;
        -- READ COMMITTED sees the committed winner after a unique-index wait.
        -- A logical winner also outranks a new random-code attempt.
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
    true, v_is_voter, v_room.voter_count, v_room.required_voter_count;
end;
$function$;
alter function public.create_room(uuid, integer, boolean) owner to postgres;
revoke all on function public.create_room(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.create_room(uuid, integer, boolean) to authenticated;

create function public.join_room(p_room_code text)
returns table (
  outcome text, room_id uuid, room_code text, room_state text,
  is_creator boolean, is_voter boolean, voter_count integer, required_voter_count integer
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
      null::boolean, null::boolean, null::integer, null::integer;
    return;
  end if;
  select r.* into v_room from public.rooms as r where r.code = v_code for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text,
      null::boolean, null::boolean, null::integer, null::integer;
    return;
  end if;
  -- Read membership only after acquiring the current room row. The winner's
  -- committed member is visible here to a previously blocked READ COMMITTED call.
  select m.is_voter into v_is_voter from public.room_members as m
    where m.room_id = v_room.id and m.user_id = v_user_id;
  if found then
    if v_user_id <> v_room.creator_user_id and not v_is_voter then
      raise exception using errcode = 'P0001', message = 'Room membership integrity failure';
    end if;
    return query select 'already_member'::text, v_room.id, v_room.code, v_room.state,
      v_user_id = v_room.creator_user_id, v_is_voter, v_room.voter_count, v_room.required_voter_count;
    return;
  end if;
  if v_user_id = v_room.creator_user_id then
    raise exception using errcode = 'P0001', message = 'Room membership integrity failure';
  end if;
  if v_room.voter_count = v_room.required_voter_count then
    return query select 'full'::text, null::uuid, null::text, null::text,
      null::boolean, null::boolean, null::integer, null::integer;
    return;
  end if;
  insert into public.room_members(room_id, user_id, is_voter) values (v_room.id, v_user_id, true);
  update public.rooms as r set voter_count = r.voter_count + 1,
    updated_at = pg_catalog.transaction_timestamp() where r.id = v_room.id returning r.* into v_room;
  return query select 'joined'::text, v_room.id, v_room.code, v_room.state,
    false, true, v_room.voter_count, v_room.required_voter_count;
end;
$function$;
alter function public.join_room(text) owner to postgres;
revoke all on function public.join_room(text) from public, anon, authenticated;
grant execute on function public.join_room(text) to authenticated;

-- Preserve the complete candidate interface/assignment algorithm.
create or replace function public.ensure_room_candidate(p_room_id uuid)
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
  if not exists (select 1 from public.room_members as m
    where m.room_id = v_room.id and m.user_id = v_user_id) then
    return query select 'not_found'::text, null::text, null::text, null::smallint, null::text;
    return;
  end if;
  if v_room.voter_count < v_room.required_voter_count then
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

-- All consumers now use normalized membership; retire each obsolete dependency.
alter table public.rooms
  drop constraint rooms_distinct_participants_check,
  drop constraint rooms_guest_user_id_fkey;
drop index public.rooms_guest_user_id_idx;
alter table public.rooms drop column guest_user_id restrict;

-- Fail the whole migration if materialization violates the approved authority.
do $verify$
begin
  if exists (
    select 1 from public.rooms as r
    where r.voter_count <> (select pg_catalog.count(*) from public.room_members as m where m.room_id = r.id and m.is_voter)
      or 1 <> (select pg_catalog.count(*) from public.room_members as m where m.room_id = r.id and m.user_id = r.creator_user_id)
  ) then
    raise exception using errcode = 'P0001', message = 'Room membership cutover integrity failure';
  end if;
end;
$verify$;

-- PostgreSQL 17 SET EXPRESSION rewrites state and removes its statistics.
analyze public.rooms;
-- Notification is delivered only after the complete transaction commits.
notify pgrst, 'reload schema';
commit;
