-- Feature 006 adds one irreversible TMDB candidate terminal while preserving
-- Feature 002 fixtures solely as denied historical test infrastructure.
begin;
lock table public.rooms in access exclusive mode;
create temporary table feature006_rooms_before on commit drop as
  select id,to_jsonb(r) row,xmin::text row_xmin from public.rooms r;
create temporary table feature006_members_before on commit drop as
  select id,to_jsonb(m) row,xmin::text row_xmin from public.room_members m;
create temporary table feature006_filters_before on commit drop as
  select room_member_id,to_jsonb(f) row,xmin::text row_xmin from public.participant_filters f;
create temporary table feature006_parents_before on commit drop as
  select room_id,to_jsonb(p) row,xmin::text row_xmin from private.room_filter_resolutions p;
create temporary table feature006_clauses_before on commit drop as
  select room_id,clause_ordinal,to_jsonb(c) row,xmin::text row_xmin
  from private.room_filter_resolution_genre_clauses c;
create temporary table feature006_fixtures_before on commit drop as
  select id,to_jsonb(c) row,xmin::text row_xmin from public.movie_candidates c;

create type public.candidate_acquisition_status as enum('pending','assigned','no_candidates');
alter type public.candidate_acquisition_status owner to postgres;

alter table public.rooms
 add column candidate_acquisition_status public.candidate_acquisition_status not null
   default 'pending'::public.candidate_acquisition_status,
 add column tmdb_movie_id bigint,
 add constraint rooms_tmdb_movie_id_positive_check check(tmdb_movie_id is null or tmdb_movie_id>0),
 add constraint rooms_candidate_status_id_check check(
   (candidate_acquisition_status='assigned')=(tmdb_movie_id is not null)),
 add constraint rooms_candidate_terminal_requires_compatible_check check(
   candidate_acquisition_status='pending' or (
     state='ready' and voter_count=required_voter_count
     and filter_completed_count=required_voter_count
     and filter_resolution_status='compatible'));

create table private.tmdb_movie_genres(
 participant_genre public.participant_genre primary key,
 tmdb_genre_id integer not null unique check(tmdb_genre_id>0)
);
alter table private.tmdb_movie_genres owner to postgres;
alter table private.tmdb_movie_genres enable row level security;
revoke all on table private.tmdb_movie_genres from public,anon,authenticated,service_role;
insert into private.tmdb_movie_genres values
 ('action',28),('adventure',12),('animation',16),('comedy',35),('crime',80),
 ('documentary',99),('drama',18),('family',10751),('fantasy',14),('history',36),
 ('horror',27),('music',10402),('mystery',9648),('romance',10749),
 ('science_fiction',878),('tv_movie',10770),('thriller',53),('war',10752),('western',37);

create function private.valid_tmdb_candidate_handoff(p_room_id uuid) returns boolean
language sql stable security definer set search_path='' as $f$
 select
   (select count(*)=1 and min(release_year_from)>=1900
      and min(release_year_from)<=min(release_year_to)
      and min(release_year_to)<=extract(year from transaction_timestamp() at time zone 'UTC')::smallint
    from private.room_filter_resolutions where room_id=p_room_id)
   and not exists(
     select 1 from private.room_filter_resolution_genre_clauses c where c.room_id=p_room_id and (
       c.clause_ordinal<1 or cardinality(c.genres)=0
       or not private.valid_participant_genres(c.genres)
       or c.genres<>(select array_agg(v order by v) from unnest(c.genres)v)
       or exists(select 1 from unnest(c.genres)g left join private.tmdb_movie_genres m
         on m.participant_genre=g where m.participant_genre is null)))
   and (not exists(select 1 from private.room_filter_resolution_genre_clauses where room_id=p_room_id)
     or exists(select 1 from private.room_filter_resolution_genre_clauses where room_id=p_room_id
       having min(clause_ordinal)=1 and max(clause_ordinal)=count(*)));
$f$;
alter function private.valid_tmdb_candidate_handoff(uuid) owner to postgres;
revoke all on function private.valid_tmdb_candidate_handoff(uuid) from public,anon,authenticated,service_role;

create function public.prepare_room_tmdb_candidate(p_room_id uuid,p_actor_user_id uuid)
returns table(outcome text,tmdb_movie_id bigint,release_year_from smallint,
 release_year_to smallint,genre_clauses_tmdb_ids jsonb)
language plpgsql security definer set search_path='' as $f$
declare v_room public.rooms%rowtype;v_parent private.room_filter_resolutions%rowtype;v_clauses jsonb;
begin
 select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id
  where r.id=p_room_id and m.user_id=p_actor_user_id
    and (m.is_voter or p_actor_user_id=r.creator_user_id);
 if not found then return query select 'not_found',null::bigint,null::smallint,null::smallint,null::jsonb;return;end if;
 if v_room.candidate_acquisition_status='assigned' then
  return query select 'assigned',v_room.tmdb_movie_id,null::smallint,null::smallint,null::jsonb;return;
 elsif v_room.candidate_acquisition_status='no_candidates' then
  return query select 'no_candidates',null::bigint,null::smallint,null::smallint,null::jsonb;return;
 end if;
 if v_room.state<>'ready' or v_room.voter_count<>v_room.required_voter_count
   or v_room.filter_completed_count<>v_room.required_voter_count
   or v_room.filter_resolution_status<>'compatible'
   or not private.valid_tmdb_candidate_handoff(v_room.id) then
  return query select 'not_ready',null::bigint,null::smallint,null::smallint,null::jsonb;return;
 end if;
 select * into strict v_parent from private.room_filter_resolutions p where p.room_id=v_room.id;
 select coalesce(jsonb_agg(to_jsonb(q.ids) order by q.clause_ordinal),'[]'::jsonb) into v_clauses
 from (select c.clause_ordinal,array_agg(m.tmdb_genre_id order by m.tmdb_genre_id) ids
   from private.room_filter_resolution_genre_clauses c cross join unnest(c.genres)g
   join private.tmdb_movie_genres m on m.participant_genre=g
   where c.room_id=v_room.id group by c.clause_ordinal)q;
 return query select 'acquire',null::bigint,v_parent.release_year_from,v_parent.release_year_to,v_clauses;
end;$f$;
alter function public.prepare_room_tmdb_candidate(uuid,uuid) owner to postgres;
revoke all on function public.prepare_room_tmdb_candidate(uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_room_tmdb_candidate(uuid,uuid) to service_role;

create function public.commit_room_tmdb_candidate(p_room_id uuid,p_actor_user_id uuid,
 p_tmdb_movie_id bigint,p_release_year smallint,p_tmdb_genre_ids integer[],p_adult boolean)
returns table(outcome text,tmdb_movie_id bigint)
language plpgsql security definer set search_path='' as $f$
declare v_room public.rooms%rowtype;v_parent private.room_filter_resolutions%rowtype;
begin
 select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id
  where r.id=p_room_id and m.user_id=p_actor_user_id
    and (m.is_voter or p_actor_user_id=r.creator_user_id) for update of r;
 if not found then return query select 'not_found',null::bigint;return;end if;
 if v_room.candidate_acquisition_status='assigned' then
  return query select 'assigned',v_room.tmdb_movie_id;return;
 elsif v_room.candidate_acquisition_status='no_candidates' then
  return query select 'no_candidates',null::bigint;return;
 end if;
 if v_room.state<>'ready' or v_room.voter_count<>v_room.required_voter_count
   or v_room.filter_completed_count<>v_room.required_voter_count
   or v_room.filter_resolution_status<>'compatible'
   or not private.valid_tmdb_candidate_handoff(v_room.id) then
  return query select 'not_ready',null::bigint;return;
 end if;
 if p_tmdb_movie_id is null or p_tmdb_movie_id<=0 or p_release_year is null
   or p_tmdb_genre_ids is null or p_adult is distinct from false
   or (cardinality(p_tmdb_genre_ids)>0 and array_ndims(p_tmdb_genre_ids)<>1)
   or array_position(p_tmdb_genre_ids,null::integer) is not null
   or p_tmdb_genre_ids<>(select coalesce(array_agg(distinct g order by g),'{}'::integer[]) from unnest(p_tmdb_genre_ids)g)
   or exists(select 1 from unnest(p_tmdb_genre_ids)g left join private.tmdb_movie_genres m
      on m.tmdb_genre_id=g where m.tmdb_genre_id is null)
 then raise exception using errcode='22023',message='Invalid candidate evidence';end if;
 select * into strict v_parent from private.room_filter_resolutions p where p.room_id=v_room.id;
 if p_release_year<v_parent.release_year_from or p_release_year>v_parent.release_year_to
   or exists(select 1 from private.room_filter_resolution_genre_clauses c where c.room_id=v_room.id
      and not p_tmdb_genre_ids && array(select m.tmdb_genre_id from unnest(c.genres)g
        join private.tmdb_movie_genres m on m.participant_genre=g order by m.tmdb_genre_id))
 then raise exception using errcode='22023',message='Ineligible candidate evidence';end if;
 update public.rooms r set candidate_acquisition_status='assigned',tmdb_movie_id=p_tmdb_movie_id,
   updated_at=transaction_timestamp() where r.id=v_room.id;
 return query select 'assigned',p_tmdb_movie_id;
end;$f$;
alter function public.commit_room_tmdb_candidate(uuid,uuid,bigint,smallint,integer[],boolean) owner to postgres;
revoke all on function public.commit_room_tmdb_candidate(uuid,uuid,bigint,smallint,integer[],boolean)
 from public,anon,authenticated;
grant execute on function public.commit_room_tmdb_candidate(uuid,uuid,bigint,smallint,integer[],boolean) to service_role;

create function public.commit_room_tmdb_no_candidates(p_room_id uuid,p_actor_user_id uuid)
returns table(outcome text,tmdb_movie_id bigint)
language plpgsql security definer set search_path='' as $f$
declare v_room public.rooms%rowtype;
begin
 select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id
  where r.id=p_room_id and m.user_id=p_actor_user_id
    and (m.is_voter or p_actor_user_id=r.creator_user_id) for update of r;
 if not found then return query select 'not_found',null::bigint;return;end if;
 if v_room.candidate_acquisition_status='assigned' then return query select 'assigned',v_room.tmdb_movie_id;return;
 elsif v_room.candidate_acquisition_status='no_candidates' then return query select 'no_candidates',null::bigint;return;end if;
 if v_room.state<>'ready' or v_room.voter_count<>v_room.required_voter_count
   or v_room.filter_completed_count<>v_room.required_voter_count
   or v_room.filter_resolution_status<>'compatible'
   or not private.valid_tmdb_candidate_handoff(v_room.id) then
  return query select 'not_ready',null::bigint;return;
 end if;
 update public.rooms r set candidate_acquisition_status='no_candidates',tmdb_movie_id=null,
  updated_at=transaction_timestamp() where r.id=v_room.id;
 return query select 'no_candidates',null::bigint;
end;$f$;
alter function public.commit_room_tmdb_no_candidates(uuid,uuid) owner to postgres;
revoke all on function public.commit_room_tmdb_no_candidates(uuid,uuid) from public,anon,authenticated;
grant execute on function public.commit_room_tmdb_no_candidates(uuid,uuid) to service_role;

drop function public.create_room(uuid,integer,boolean);
create function public.create_room(p_creation_request_id uuid,p_required_voter_count integer,p_creator_is_voter boolean)
returns table(outcome text,room_id uuid,room_code text,room_state text,is_creator boolean,is_voter boolean,
 voter_count integer,required_voter_count integer,filter_completed_count integer,
 filter_resolution_status public.filter_resolution_status,candidate_acquisition_status public.candidate_acquisition_status)
language plpgsql security definer set search_path='' as $f$
declare v_user_id uuid:=auth.uid();v_room public.rooms%rowtype;v_existing record;v_is_voter boolean;
 v_code text;v_constraint text;v_outcome text:='already_created';v_attempt integer;
begin
 if v_user_id is null then raise exception using errcode='42501',message='Authentication required';end if;
 if p_creation_request_id is null or p_required_voter_count is null or p_creator_is_voter is null
  then raise exception using errcode='22004',message='Creation configuration required';end if;
 if p_required_voter_count<2 then raise exception using errcode='22023',message='Invalid required voter count';end if;
 select r as room_row,m.is_voter into v_existing from public.rooms r left join public.room_members m
  on m.room_id=r.id and m.user_id=r.creator_user_id where r.creator_user_id=v_user_id
  and r.creation_request_id=p_creation_request_id;
 if found then v_room:=v_existing.room_row;v_is_voter:=v_existing.is_voter;
 else for v_attempt in 1..5 loop
  v_code:=upper(encode(extensions.gen_random_bytes(5),'hex'));
  begin
   insert into public.rooms as r(code,creation_request_id,creator_user_id,required_voter_count,voter_count)
    values(v_code,p_creation_request_id,v_user_id,p_required_voter_count,case when p_creator_is_voter then 1 else 0 end)
    returning r.* into v_room;
   insert into public.room_members as m(room_id,user_id,is_voter) values(v_room.id,v_user_id,p_creator_is_voter)
    returning m.is_voter into v_is_voter;v_outcome:='created';exit;
  exception when unique_violation then get stacked diagnostics v_constraint=constraint_name;
   if v_constraint not in('rooms_creator_creation_request_key','rooms_code_key') then raise;end if;
   select r as room_row,m.is_voter into v_existing from public.rooms r left join public.room_members m
    on m.room_id=r.id and m.user_id=r.creator_user_id where r.creator_user_id=v_user_id
    and r.creation_request_id=p_creation_request_id;
   if found then v_room:=v_existing.room_row;v_is_voter:=v_existing.is_voter;exit;end if;
   if v_constraint='rooms_creator_creation_request_key' then raise;end if;
   if v_attempt=5 then raise exception using errcode='P0001',message='Room code allocation exhausted';end if;
  end;end loop;end if;
 if v_is_voter is null then raise exception using errcode='P0001',message='Room membership integrity failure';end if;
 return query select v_outcome,v_room.id,v_room.code,v_room.state,true,v_is_voter,v_room.voter_count,
  v_room.required_voter_count,v_room.filter_completed_count,v_room.filter_resolution_status,
  v_room.candidate_acquisition_status;
end;$f$;
alter function public.create_room(uuid,integer,boolean) owner to postgres;
revoke all on function public.create_room(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.create_room(uuid,integer,boolean) to authenticated;

drop function public.join_room(text);
create function public.join_room(p_room_code text)
returns table(outcome text,room_id uuid,room_code text,room_state text,is_creator boolean,is_voter boolean,
 voter_count integer,required_voter_count integer,filter_completed_count integer,
 filter_resolution_status public.filter_resolution_status,candidate_acquisition_status public.candidate_acquisition_status)
language plpgsql security definer set search_path='' as $f$
declare v_user_id uuid:=auth.uid();v_room public.rooms%rowtype;v_code text;v_is_voter boolean;
begin
 if v_user_id is null then raise exception using errcode='42501',message='Authentication required';end if;
 v_code:=upper(btrim(p_room_code));
 if v_code is null or v_code!~'^[0-9A-F]{10}$' then return query select 'invalid_code',null::uuid,null::text,
  null::text,null::boolean,null::boolean,null::integer,null::integer,null::integer,
  null::public.filter_resolution_status,null::public.candidate_acquisition_status;return;end if;
 select r.* into v_room from public.rooms r where r.code=v_code for update;
 if not found then return query select 'not_found',null::uuid,null::text,null::text,null::boolean,null::boolean,
  null::integer,null::integer,null::integer,null::public.filter_resolution_status,
  null::public.candidate_acquisition_status;return;end if;
 select m.is_voter into v_is_voter from public.room_members m where m.room_id=v_room.id and m.user_id=v_user_id;
 if found then
  if v_user_id<>v_room.creator_user_id and not v_is_voter then raise exception using errcode='P0001',message='Room membership integrity failure';end if;
  return query select 'already_member',v_room.id,v_room.code,v_room.state,v_user_id=v_room.creator_user_id,
   v_is_voter,v_room.voter_count,v_room.required_voter_count,v_room.filter_completed_count,
   v_room.filter_resolution_status,v_room.candidate_acquisition_status;return;
 end if;
 if v_user_id=v_room.creator_user_id then raise exception using errcode='P0001',message='Room membership integrity failure';end if;
 if v_room.voter_count=v_room.required_voter_count then return query select 'full',null::uuid,null::text,null::text,
  null::boolean,null::boolean,null::integer,null::integer,null::integer,null::public.filter_resolution_status,
  null::public.candidate_acquisition_status;return;end if;
 insert into public.room_members(room_id,user_id,is_voter) values(v_room.id,v_user_id,true);
 update public.rooms r set voter_count=r.voter_count+1,updated_at=transaction_timestamp()
  where r.id=v_room.id returning r.* into v_room;
 return query select 'joined',v_room.id,v_room.code,v_room.state,false,true,v_room.voter_count,
  v_room.required_voter_count,v_room.filter_completed_count,v_room.filter_resolution_status,
  v_room.candidate_acquisition_status;
end;$f$;
alter function public.join_room(text) owner to postgres;
revoke all on function public.join_room(text) from public,anon,authenticated;
grant execute on function public.join_room(text) to authenticated;

revoke all privileges(id,code,creation_request_id,creator_user_id,state,created_at,updated_at,
 movie_candidate_id,required_voter_count,voter_count,filter_completed_count,filter_resolution_status,
 candidate_acquisition_status,tmdb_movie_id) on public.rooms from public,anon,authenticated;
grant select(id,code,state,voter_count,required_voter_count,filter_completed_count,
 filter_resolution_status,candidate_acquisition_status) on public.rooms to authenticated;

do $verify$ begin
 if exists(select 1 from feature006_rooms_before b join public.rooms r on r.id=b.id
   where (to_jsonb(r)-'candidate_acquisition_status'-'tmdb_movie_id')<>b.row or r.xmin::text<>b.row_xmin)
 or exists(select 1 from public.rooms where candidate_acquisition_status<>'pending' or tmdb_movie_id is not null)
 or exists(select 1 from feature006_members_before b join public.room_members m on m.id=b.id where to_jsonb(m)<>b.row or m.xmin::text<>b.row_xmin)
 or exists(select 1 from feature006_filters_before b join public.participant_filters f on f.room_member_id=b.room_member_id where to_jsonb(f)<>b.row or f.xmin::text<>b.row_xmin)
 or exists(select 1 from feature006_parents_before b join private.room_filter_resolutions p on p.room_id=b.room_id where to_jsonb(p)<>b.row or p.xmin::text<>b.row_xmin)
 or exists(select 1 from feature006_clauses_before b join private.room_filter_resolution_genre_clauses c on c.room_id=b.room_id and c.clause_ordinal=b.clause_ordinal where to_jsonb(c)<>b.row or c.xmin::text<>b.row_xmin)
 or exists(select 1 from feature006_fixtures_before b join public.movie_candidates c on c.id=b.id where to_jsonb(c)<>b.row or c.xmin::text<>b.row_xmin)
 or (select count(*) from private.tmdb_movie_genres)<>19
 then raise exception using errcode='P0001',message='TMDB candidate cutover integrity failure';end if;
 if (select count(*) from pg_publication_tables where pubname='supabase_realtime')<>1
  or not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='rooms')
 then raise exception using errcode='P0001',message='Realtime publication integrity failure';end if;
end;$verify$;
notify pgrst,'reload schema';
commit;
