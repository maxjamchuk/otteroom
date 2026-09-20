\set ON_ERROR_STOP on
begin;
set local statement_timeout = '20s';
create function pg_temp.require(condition boolean) returns void language plpgsql as $f$
begin if condition is distinct from true then raise exception 'Feature 007 migration assertion failed'; end if; end;
$f$;
create temporary table expected_rooms as select value row from jsonb_array_elements((:'feature007_snapshot'::jsonb)->'rooms');
create temporary table expected_members as select value row from jsonb_array_elements((:'feature007_snapshot'::jsonb)->'members');
create temporary table expected_filters as select value row from jsonb_array_elements((:'feature007_snapshot'::jsonb)->'filters');
create temporary table expected_parents as select value row from jsonb_array_elements((:'feature007_snapshot'::jsonb)->'parents');
create temporary table expected_clauses as select value row from jsonb_array_elements((:'feature007_snapshot'::jsonb)->'clauses');
create temporary table expected_candidates as select value row from jsonb_array_elements((:'feature007_snapshot'::jsonb)->'candidates');

select pg_temp.require(not exists(
  select 1 from expected_rooms e join public.rooms r on r.id=(e.row->>'id')::uuid
  where (to_jsonb(r)-'decision_completed_count'-'candidate_progression_status'-'candidate_sequence')<>(e.row-'row_xmin')
) and (select count(*)=8 from public.rooms where decision_completed_count=0)
 and (select count(*)=4 from public.rooms where candidate_progression_status='collecting' and candidate_sequence=1)
 and (select count(*)=4 from public.rooms where candidate_progression_status='inactive' and candidate_sequence=0));
select pg_temp.require(not exists(
  select 1 from expected_members e join public.room_members m on m.id=(e.row->>'id')::uuid
  where (to_jsonb(m)||jsonb_build_object('row_xmin',m.xmin::text))<>e.row));
select pg_temp.require(not exists(
  select 1 from expected_filters e join public.participant_filters f on f.room_member_id=(e.row->>'room_member_id')::uuid
  where (to_jsonb(f)||jsonb_build_object('row_xmin',f.xmin::text))<>e.row));
select pg_temp.require(not exists(
  select 1 from expected_parents e join private.room_filter_resolutions p on p.room_id=(e.row->>'room_id')::uuid
  where (to_jsonb(p)||jsonb_build_object('row_xmin',p.xmin::text))<>e.row));
select pg_temp.require(not exists(
  select 1 from expected_clauses e join private.room_filter_resolution_genre_clauses c
    on c.room_id=(e.row->>'room_id')::uuid and c.clause_ordinal=(e.row->>'clause_ordinal')::integer
  where (to_jsonb(c)||jsonb_build_object('row_xmin',c.xmin::text))<>e.row));
select pg_temp.require(not exists(
  select 1 from expected_candidates e join public.movie_candidates c on c.id=e.row->>'id'
  where (to_jsonb(c)||jsonb_build_object('row_xmin',c.xmin::text))<>e.row));

select pg_temp.require(not exists(select 1 from public.candidate_decisions)
  and to_regtype('public.candidate_decision_value') is not null
  and (select count(*)=1 from pg_publication_tables where pubname='supabase_realtime')
  and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='candidate_decisions'));
select pg_temp.require(not has_table_privilege('authenticated','public.candidate_decisions','select')
  and has_column_privilege('authenticated','public.rooms','decision_completed_count','select')
  and not has_column_privilege('authenticated','public.rooms','tmdb_movie_id','select'));
select pg_temp.require((select bool_and(pg_get_userbyid(proowner)='postgres' and prosecdef
  and proconfig=array['search_path=""']) from pg_proc where oid in(
  'public.get_room_candidate_decision(uuid,integer,bigint)'::regprocedure,
  'public.submit_room_candidate_decision(uuid,integer,bigint,public.candidate_decision_value)'::regprocedure)));

-- Existing member re-entry returns the new zero watermark without mutating the room.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f7000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select pg_temp.require((select outcome='already_member' and decision_completed_count=0
  and candidate_progression_status='collecting' and candidate_sequence=1
  from public.join_room('F710000004')));
select pg_temp.require((select outcome='not_decided' and decision_completed_count=0
  from public.get_room_candidate_decision('f7100000-0000-4000-8000-000000000004',1,7104)));
reset role;

delete from public.rooms;
delete from auth.users where id::text like 'f7000000-0000-4000-8000-%';
select pg_temp.require(not exists(select 1 from public.rooms)
  and not exists(select 1 from public.candidate_decisions)
  and not exists(select 1 from public.room_candidate_occurrences)
  and not exists(select 1 from auth.users));
commit;
