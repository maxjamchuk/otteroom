\set ON_ERROR_STOP on
begin;
set local statement_timeout='15s';
create function pg_temp.require(condition boolean) returns void language plpgsql as $f$
begin if condition is distinct from true then raise exception 'Feature 006 migration assertion failed';end if;end;$f$;
create temporary table expected_rooms as select value row from jsonb_array_elements((:'feature006_snapshot'::jsonb)->'rooms');
create temporary table expected_members as select value row from jsonb_array_elements((:'feature006_snapshot'::jsonb)->'members');
create temporary table expected_parents as select value row from jsonb_array_elements((:'feature006_snapshot'::jsonb)->'parents');
create temporary table expected_clauses as select value row from jsonb_array_elements((:'feature006_snapshot'::jsonb)->'clauses');
create temporary table expected_candidates as select value row from jsonb_array_elements((:'feature006_snapshot'::jsonb)->'candidates');
select pg_temp.require(not exists(select 1 from expected_rooms e join public.rooms r on r.id=(e.row->>'id')::uuid
 where ((to_jsonb(r)-'candidate_acquisition_status'-'tmdb_movie_id')||jsonb_build_object('row_xmin',r.xmin::text))<>e.row)
 and (select count(*)=6 from public.rooms where candidate_acquisition_status='pending' and tmdb_movie_id is null));
select pg_temp.require(not exists(select 1 from expected_members e join public.room_members m on m.id=(e.row->>'id')::uuid
 where (to_jsonb(m)||jsonb_build_object('row_xmin',m.xmin::text))<>e.row));
select pg_temp.require(not exists(select 1 from expected_parents e join private.room_filter_resolutions p
 on p.room_id=(e.row->>'room_id')::uuid where (to_jsonb(p)||jsonb_build_object('row_xmin',p.xmin::text))<>e.row));
select pg_temp.require(not exists(select 1 from expected_clauses e join private.room_filter_resolution_genre_clauses c
 on c.room_id=(e.row->>'room_id')::uuid and c.clause_ordinal=(e.row->>'clause_ordinal')::integer
 where (to_jsonb(c)||jsonb_build_object('row_xmin',c.xmin::text))<>e.row));
select pg_temp.require(not exists(select 1 from expected_candidates e join public.movie_candidates c on c.id=e.row->>'id'
 where (to_jsonb(c)||jsonb_build_object('row_xmin',c.xmin::text))<>e.row));
select pg_temp.require((select count(*)=19 from private.tmdb_movie_genres)
 and not has_table_privilege('authenticated','private.tmdb_movie_genres','select'));
select pg_temp.require((select count(*)=1 from pg_publication_tables where pubname='supabase_realtime'
 and schemaname='public' and tablename='rooms'));
select pg_temp.require((select count(*)=8 from pg_attribute a cross join lateral aclexplode(a.attacl)x
 where a.attrelid='public.rooms'::regclass and x.grantee='authenticated'::regrole::oid and x.privilege_type='SELECT')
 and not has_column_privilege('authenticated','public.rooms','tmdb_movie_id','select'));
select pg_temp.require((select bool_and(has_function_privilege('service_role',oid,'execute')
 and not has_function_privilege('authenticated',oid,'execute')) from pg_proc where oid in(
 'public.prepare_room_tmdb_candidate(uuid,uuid)'::regprocedure,
 'public.commit_room_tmdb_candidate(uuid,uuid,bigint,smallint,integer[],boolean)'::regprocedure,
 'public.commit_room_tmdb_no_candidates(uuid,uuid)'::regprocedure)));
set local role service_role;
select pg_temp.require((select outcome='acquire' from public.prepare_room_tmdb_candidate(
 'f6100000-0000-4000-8000-000000000003','f6000000-0000-4000-8000-000000000005')));
select pg_temp.require((select outcome='acquire' from public.prepare_room_tmdb_candidate(
 'f6100000-0000-4000-8000-000000000004','f6000000-0000-4000-8000-000000000007')));
select pg_temp.require((select outcome='not_ready' from public.prepare_room_tmdb_candidate(
 'f6100000-0000-4000-8000-000000000005','f6000000-0000-4000-8000-000000000009')));
reset role;
select pg_temp.require((select movie_candidate_id='fixture-cloud-tram-four' and tmdb_movie_id is null
 from public.rooms where id='f6100000-0000-4000-8000-000000000004'));
delete from public.rooms;delete from auth.users where id::text like 'f6000000-0000-4000-8000-%';
select pg_temp.require(not exists(select 1 from public.rooms) and not exists(select 1 from auth.users));
commit;
