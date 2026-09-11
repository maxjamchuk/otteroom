-- Feature 005 adds one durable room-level status and a private, anonymous
-- common constraint. It preserves Feature 004 source rows and candidate
-- suppression and performs no eager resolution during installation.
begin;
lock table public.rooms in access exclusive mode;

create temporary table feature005_rooms_before on commit drop as
  select r.id,to_jsonb(r) row,r.xmin::text row_xmin from public.rooms r;
create temporary table feature005_members_before on commit drop as
  select m.id,to_jsonb(m) row,m.xmin::text row_xmin from public.room_members m;
create temporary table feature005_filters_before on commit drop as
  select f.room_member_id,to_jsonb(f) row,f.xmin::text row_xmin from public.participant_filters f;
create temporary table feature005_candidates_before on commit drop as
  select c.id,to_jsonb(c) row,c.xmin::text row_xmin from public.movie_candidates c;

create type public.filter_resolution_status as enum (
  'pending','compatible','incompatible'
);
alter type public.filter_resolution_status owner to postgres;

alter table public.rooms
  add column filter_resolution_status public.filter_resolution_status
    not null default 'pending'::public.filter_resolution_status,
  add constraint rooms_filter_resolution_requires_complete_check check (
    filter_resolution_status='pending'::public.filter_resolution_status
    or (state='ready' and filter_completed_count=required_voter_count)
  );

create table private.room_filter_resolutions (
  room_id uuid not null,
  release_year_from smallint not null,
  release_year_to smallint not null,
  constraint room_filter_resolutions_pkey primary key(room_id),
  constraint room_filter_resolutions_room_id_fkey foreign key(room_id)
    references public.rooms(id) on update no action on delete cascade,
  constraint room_filter_resolutions_release_year_check check (
    release_year_from>=1900 and release_year_from<=release_year_to
      and release_year_to<=9999
  )
);
alter table private.room_filter_resolutions owner to postgres;
alter table private.room_filter_resolutions enable row level security;
revoke all privileges on table private.room_filter_resolutions
  from public,anon,authenticated;

create table private.room_filter_resolution_genre_clauses (
  room_id uuid not null,
  clause_ordinal integer not null,
  genres public.participant_genre[] not null,
  constraint room_filter_resolution_genre_clauses_pkey
    primary key(room_id,clause_ordinal),
  constraint room_filter_resolution_genre_clauses_room_id_fkey
    foreign key(room_id) references private.room_filter_resolutions(room_id)
      on update no action on delete cascade,
  constraint room_filter_resolution_genre_clauses_ordinal_check
    check(clause_ordinal>=1),
  constraint room_filter_resolution_genre_clauses_genres_check
    check(pg_catalog.cardinality(genres)>0 and private.valid_participant_genres(genres))
);
alter table private.room_filter_resolution_genre_clauses owner to postgres;
alter table private.room_filter_resolution_genre_clauses enable row level security;
revoke all privileges on table private.room_filter_resolution_genre_clauses
  from public,anon,authenticated;

drop function public.create_room(uuid,integer,boolean);
create function public.create_room(
  p_creation_request_id uuid,p_required_voter_count integer,p_creator_is_voter boolean
)
returns table(
  outcome text,room_id uuid,room_code text,room_state text,
  is_creator boolean,is_voter boolean,voter_count integer,
  required_voter_count integer,filter_completed_count integer,
  filter_resolution_status public.filter_resolution_status
)
language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_room public.rooms%rowtype;
  v_existing record;
  v_is_voter boolean;
  v_code text;
  v_constraint text;
  v_outcome text:='already_created';
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='Authentication required';
  end if;
  if p_creation_request_id is null or p_required_voter_count is null
    or p_creator_is_voter is null then
    raise exception using errcode='22004',message='Creation configuration required';
  end if;
  if p_required_voter_count<2 then
    raise exception using errcode='22023',message='Invalid required voter count';
  end if;

  select r as room_row,m.is_voter into v_existing
    from public.rooms r left join public.room_members m
      on m.room_id=r.id and m.user_id=r.creator_user_id
    where r.creator_user_id=v_user_id
      and r.creation_request_id=p_creation_request_id;
  if found then
    v_room:=v_existing.room_row;
    v_is_voter:=v_existing.is_voter;
  else
    for v_attempt in 1..5 loop
      v_code:=pg_catalog.upper(pg_catalog.encode(extensions.gen_random_bytes(5),'hex'));
      begin
        insert into public.rooms as r
          (code,creation_request_id,creator_user_id,required_voter_count,voter_count)
          values(v_code,p_creation_request_id,v_user_id,p_required_voter_count,
            case when p_creator_is_voter then 1 else 0 end)
          returning r.* into v_room;
        insert into public.room_members as m(room_id,user_id,is_voter)
          values(v_room.id,v_user_id,p_creator_is_voter)
          returning m.is_voter into v_is_voter;
        v_outcome:='created';
        exit;
      exception when unique_violation then
        get stacked diagnostics v_constraint=constraint_name;
        if v_constraint not in('rooms_creator_creation_request_key','rooms_code_key') then raise;end if;
        select r as room_row,m.is_voter into v_existing
          from public.rooms r left join public.room_members m
            on m.room_id=r.id and m.user_id=r.creator_user_id
          where r.creator_user_id=v_user_id
            and r.creation_request_id=p_creation_request_id;
        if found then
          v_room:=v_existing.room_row;
          v_is_voter:=v_existing.is_voter;
          exit;
        end if;
        if v_constraint='rooms_creator_creation_request_key' then raise;end if;
        if v_attempt=5 then
          raise exception using errcode='P0001',message='Room code allocation exhausted';
        end if;
      end;
    end loop;
  end if;
  if v_is_voter is null then
    raise exception using errcode='P0001',message='Room membership integrity failure';
  end if;
  return query select v_outcome,v_room.id,v_room.code,v_room.state,true,v_is_voter,
    v_room.voter_count,v_room.required_voter_count,v_room.filter_completed_count,
    v_room.filter_resolution_status;
end;
$function$;
alter function public.create_room(uuid,integer,boolean) owner to postgres;
revoke all on function public.create_room(uuid,integer,boolean)
  from public,anon,authenticated;
grant execute on function public.create_room(uuid,integer,boolean) to authenticated;

drop function public.join_room(text);
create function public.join_room(p_room_code text)
returns table(
  outcome text,room_id uuid,room_code text,room_state text,
  is_creator boolean,is_voter boolean,voter_count integer,
  required_voter_count integer,filter_completed_count integer,
  filter_resolution_status public.filter_resolution_status
)
language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_room public.rooms%rowtype;
  v_code text;
  v_is_voter boolean;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='Authentication required';
  end if;
  v_code:=pg_catalog.upper(pg_catalog.btrim(p_room_code));
  if v_code is null or v_code!~'^[0-9A-F]{10}$' then
    return query select 'invalid_code'::text,null::uuid,null::text,null::text,
      null::boolean,null::boolean,null::integer,null::integer,null::integer,
      null::public.filter_resolution_status;
    return;
  end if;
  select r.* into v_room from public.rooms r where r.code=v_code for update;
  if not found then
    return query select 'not_found'::text,null::uuid,null::text,null::text,
      null::boolean,null::boolean,null::integer,null::integer,null::integer,
      null::public.filter_resolution_status;
    return;
  end if;
  select m.is_voter into v_is_voter from public.room_members m
    where m.room_id=v_room.id and m.user_id=v_user_id;
  if found then
    if v_user_id<>v_room.creator_user_id and not v_is_voter then
      raise exception using errcode='P0001',message='Room membership integrity failure';
    end if;
    return query select 'already_member'::text,v_room.id,v_room.code,v_room.state,
      v_user_id=v_room.creator_user_id,v_is_voter,v_room.voter_count,
      v_room.required_voter_count,v_room.filter_completed_count,
      v_room.filter_resolution_status;
    return;
  end if;
  if v_user_id=v_room.creator_user_id then
    raise exception using errcode='P0001',message='Room membership integrity failure';
  end if;
  if v_room.voter_count=v_room.required_voter_count then
    return query select 'full'::text,null::uuid,null::text,null::text,
      null::boolean,null::boolean,null::integer,null::integer,null::integer,
      null::public.filter_resolution_status;
    return;
  end if;
  insert into public.room_members(room_id,user_id,is_voter)
    values(v_room.id,v_user_id,true);
  update public.rooms r set voter_count=r.voter_count+1,
    updated_at=pg_catalog.transaction_timestamp()
    where r.id=v_room.id returning r.* into v_room;
  return query select 'joined'::text,v_room.id,v_room.code,v_room.state,
    false,true,v_room.voter_count,v_room.required_voter_count,
    v_room.filter_completed_count,v_room.filter_resolution_status;
end;
$function$;
alter function public.join_room(text) owner to postgres;
revoke all on function public.join_room(text) from public,anon,authenticated;
grant execute on function public.join_room(text) to authenticated;

create function public.resolve_common_filters(p_room_id uuid)
returns table(outcome text,filter_resolution_status public.filter_resolution_status)
language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_room public.rooms%rowtype;
  v_member public.room_members%rowtype;
  v_context record;
  v_parent_count integer;
  v_clause_count integer;
  v_invalid_clause_count integer;
  v_actual_voters integer;
  v_actual_filters integer;
  v_nonvoter_filters integer;
  v_invalid_nonvoters integer;
  v_invalid_sources integer;
  v_common_from smallint;
  v_common_to smallint;
  v_max smallint:=extract(year from pg_catalog.transaction_timestamp()
    at time zone 'UTC')::smallint;
begin
  if v_user_id is null then
    raise exception using errcode='42501',message='Authentication required';
  end if;

  select r as room_row,m as member_row into v_context
    from public.rooms r join public.room_members m on m.room_id=r.id
    where r.id=p_room_id and m.user_id=v_user_id
    for update of r;
  if not found then
    return query select 'not_found'::text,null::public.filter_resolution_status;
    return;
  end if;
  v_room:=v_context.room_row;
  v_member:=v_context.member_row;
  if not v_member.is_voter and v_member.user_id<>v_room.creator_user_id then
    raise exception using errcode='P0001',message='Common filter resolution integrity failure';
  end if;

  select pg_catalog.count(*)::integer into v_parent_count
    from private.room_filter_resolutions p where p.room_id=v_room.id;
  select pg_catalog.count(*)::integer into v_clause_count
    from private.room_filter_resolution_genre_clauses c where c.room_id=v_room.id;

  if v_room.filter_resolution_status<>'pending'::public.filter_resolution_status then
    if v_room.state<>'ready' or v_room.voter_count<>v_room.required_voter_count
      or v_room.filter_completed_count<>v_room.required_voter_count then
      raise exception using errcode='P0001',message='Common filter resolution integrity failure';
    end if;
    if v_room.filter_resolution_status='compatible'::public.filter_resolution_status then
      select pg_catalog.count(*)::integer into v_invalid_clause_count
        from private.room_filter_resolution_genre_clauses c
        where c.room_id=v_room.id and (
          pg_catalog.cardinality(c.genres)=0
          or not private.valid_participant_genres(c.genres)
          or c.genres<>(select pg_catalog.array_agg(value order by value)
            from pg_catalog.unnest(c.genres) valueset(value))
        );
      if v_parent_count<>1 or v_invalid_clause_count<>0 or (
        v_clause_count>0 and not exists(
          select 1 from private.room_filter_resolution_genre_clauses c
          where c.room_id=v_room.id
          having pg_catalog.min(c.clause_ordinal)=1
            and pg_catalog.max(c.clause_ordinal)=pg_catalog.count(*)
        )
      ) then
        raise exception using errcode='P0001',message='Common filter resolution integrity failure';
      end if;
      return query select 'compatible'::text,'compatible'::public.filter_resolution_status;
      return;
    end if;
    if v_room.filter_resolution_status='incompatible'::public.filter_resolution_status then
      if v_parent_count<>0 or v_clause_count<>0 then
        raise exception using errcode='P0001',message='Common filter resolution integrity failure';
      end if;
      return query select 'incompatible'::text,'incompatible'::public.filter_resolution_status;
      return;
    end if;
    raise exception using errcode='P0001',message='Common filter resolution integrity failure';
  end if;

  if v_parent_count<>0 or v_clause_count<>0 then
    raise exception using errcode='P0001',message='Common filter resolution integrity failure';
  end if;
  if v_room.state<>'ready' or v_room.voter_count<v_room.required_voter_count
    or v_room.filter_completed_count<v_room.required_voter_count then
    return query select 'pending'::text,'pending'::public.filter_resolution_status;
    return;
  end if;
  if v_room.voter_count<>v_room.required_voter_count
    or v_room.filter_completed_count<>v_room.required_voter_count then
    raise exception using errcode='P0001',message='Common filter resolution integrity failure';
  end if;

  select pg_catalog.count(*)::integer into v_actual_voters
    from public.room_members m where m.room_id=v_room.id and m.is_voter;
  select pg_catalog.count(*)::integer into v_actual_filters
    from public.participant_filters f join public.room_members m
      on m.id=f.room_member_id
    where m.room_id=v_room.id and m.is_voter;
  select pg_catalog.count(*)::integer into v_nonvoter_filters
    from public.participant_filters f join public.room_members m
      on m.id=f.room_member_id
    where m.room_id=v_room.id and not m.is_voter;
  select pg_catalog.count(*)::integer into v_invalid_nonvoters
    from public.room_members m where m.room_id=v_room.id and not m.is_voter
      and m.user_id<>v_room.creator_user_id;
  select pg_catalog.count(*)::integer into v_invalid_sources
    from public.participant_filters f join public.room_members m
      on m.id=f.room_member_id
    where m.room_id=v_room.id and m.is_voter and (
      not private.valid_participant_genres(f.genres)
      or f.genres<>(select coalesce(pg_catalog.array_agg(value order by value),
          '{}'::public.participant_genre[])
        from pg_catalog.unnest(f.genres) valueset(value))
      or f.release_year_from<1900 or f.release_year_from>f.release_year_to
      or f.release_year_to>v_max
    );
  if v_actual_voters<>v_room.required_voter_count
    or v_actual_filters<>v_room.required_voter_count
    or v_nonvoter_filters<>0 or v_invalid_nonvoters<>0 or v_invalid_sources<>0 then
    raise exception using errcode='P0001',message='Common filter resolution integrity failure';
  end if;

  select pg_catalog.max(f.release_year_from)::smallint,
      pg_catalog.min(f.release_year_to)::smallint
    into v_common_from,v_common_to
    from public.participant_filters f join public.room_members m
      on m.id=f.room_member_id
    where m.room_id=v_room.id and m.is_voter;

  if v_common_from>v_common_to then
    update public.rooms r set
      filter_resolution_status='incompatible'::public.filter_resolution_status,
      updated_at=pg_catalog.transaction_timestamp()
      where r.id=v_room.id;
    return query select 'incompatible'::text,'incompatible'::public.filter_resolution_status;
    return;
  end if;

  insert into private.room_filter_resolutions(room_id,release_year_from,release_year_to)
    values(v_room.id,v_common_from,v_common_to);
  insert into private.room_filter_resolution_genre_clauses(room_id,clause_ordinal,genres)
    select v_room.id,
      pg_catalog.row_number() over(order by f.genres,m.id)::integer,
      f.genres
    from public.participant_filters f join public.room_members m
      on m.id=f.room_member_id
    where m.room_id=v_room.id and m.is_voter
      and pg_catalog.cardinality(f.genres)>0
    order by f.genres,m.id;
  update public.rooms r set
    filter_resolution_status='compatible'::public.filter_resolution_status,
    updated_at=pg_catalog.transaction_timestamp()
    where r.id=v_room.id;
  return query select 'compatible'::text,'compatible'::public.filter_resolution_status;
end;
$function$;
alter function public.resolve_common_filters(uuid) owner to postgres;
revoke all on function public.resolve_common_filters(uuid)
  from public,anon,authenticated;
grant execute on function public.resolve_common_filters(uuid) to authenticated;

revoke all privileges(id,code,creation_request_id,creator_user_id,state,created_at,
  updated_at,movie_candidate_id,required_voter_count,voter_count,
  filter_completed_count,filter_resolution_status) on public.rooms
  from public,anon,authenticated;
grant select(id,code,state,voter_count,required_voter_count,
  filter_completed_count,filter_resolution_status) on public.rooms to authenticated;

do $verify$
begin
  if exists(
    select 1 from feature005_rooms_before b join public.rooms r on r.id=b.id
    where (to_jsonb(r)-'filter_resolution_status')<>b.row or r.xmin::text<>b.row_xmin
  ) or (select pg_catalog.count(*) from feature005_rooms_before)
      <>(select pg_catalog.count(*) from public.rooms)
  or exists(select 1 from public.rooms
      where filter_resolution_status<>'pending'::public.filter_resolution_status)
  or exists(
    select 1 from feature005_members_before b join public.room_members m on m.id=b.id
    where to_jsonb(m)<>b.row or m.xmin::text<>b.row_xmin
  ) or (select pg_catalog.count(*) from feature005_members_before)
      <>(select pg_catalog.count(*) from public.room_members)
  or exists(
    select 1 from feature005_filters_before b join public.participant_filters f
      on f.room_member_id=b.room_member_id
    where to_jsonb(f)<>b.row or f.xmin::text<>b.row_xmin
  ) or (select pg_catalog.count(*) from feature005_filters_before)
      <>(select pg_catalog.count(*) from public.participant_filters)
  or exists(
    select 1 from feature005_candidates_before b join public.movie_candidates c on c.id=b.id
    where to_jsonb(c)<>b.row or c.xmin::text<>b.row_xmin
  ) or (select pg_catalog.count(*) from feature005_candidates_before)
      <>(select pg_catalog.count(*) from public.movie_candidates)
  or exists(select 1 from private.room_filter_resolutions)
  or exists(select 1 from private.room_filter_resolution_genre_clauses) then
    raise exception using errcode='P0001',message='Common filter resolution cutover integrity failure';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_publication_tables
      where pubname='supabase_realtime')<>1
    or not exists(select 1 from pg_catalog.pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='rooms') then
    raise exception using errcode='P0001',message='Realtime publication integrity failure';
  end if;
end;
$verify$;

notify pgrst,'reload schema';
commit;
