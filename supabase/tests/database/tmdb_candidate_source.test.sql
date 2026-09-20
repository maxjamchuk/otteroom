-- Feature 006 candidate-source authority preserved under Feature 008 sequencing.
\connect -reuse-previous=on "user=supabase_admin"
begin;
set local search_path=pg_catalog,public,extensions;
create extension if not exists pgtap with schema extensions;
select no_plan();

select enum_has_labels('public','candidate_acquisition_status',array['pending','assigned','no_candidates'],
  'candidate acquisition vocabulary is unchanged');
select is((select count(*) from private.tmdb_movie_genres),19::bigint,
  'canonical Feature 006 genre mapping remains exact');
select has_function('public','prepare_room_tmdb_candidate',array['uuid','uuid'],
  'preflight signature remains actor and room only');
select has_function('public','commit_room_tmdb_candidate',
  array['uuid','uuid','integer','bigint','smallint','integer[]','boolean'],
  'candidate commit adds only the server expected sequence');
select has_function('public','commit_room_tmdb_no_candidates',array['uuid','uuid','integer'],
  'empty commit adds only the server expected sequence');
select ok(to_regprocedure('public.commit_room_tmdb_candidate(uuid,uuid,bigint,smallint,integer[],boolean)') is null
  and to_regprocedure('public.commit_room_tmdb_no_candidates(uuid,uuid)') is null,
  'obsolete unsequenced commit signatures are absent');
select ok((select bool_and(not has_function_privilege('authenticated',oid,'execute')
  and has_function_privilege('service_role',oid,'execute')) from pg_proc where oid in(
    'public.prepare_room_tmdb_candidate(uuid,uuid)'::regprocedure,
    'public.commit_room_tmdb_candidate(uuid,uuid,integer,bigint,smallint,integer[],boolean)'::regprocedure,
    'public.commit_room_tmdb_no_candidates(uuid,uuid,integer)'::regprocedure)),
  'candidate source authority remains service-role-only');

insert into auth.users(id) values
('66000000-0000-4000-a000-000000000001'),('66000000-0000-4000-a000-000000000002');
insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,
 filter_completed_count,filter_resolution_status)
values('66100000-0000-4000-a000-000000000001','F600000001',
 '66200000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001',2,2,2,'compatible');
insert into public.room_members(id,room_id,user_id,is_voter) values
('66300000-0000-4000-a000-000000000001','66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001',true),
('66300000-0000-4000-a000-000000000002','66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000002',true);
insert into private.room_filter_resolutions(room_id,release_year_from,release_year_to)
values('66100000-0000-4000-a000-000000000001',2000,2026);

select is((select outcome from public.prepare_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001')),
  'acquire','compatible initial room receives source preflight');
select is((select excluded_tmdb_movie_ids from public.prepare_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001')),
  '[]'::jsonb,'initial source exclusion history is server-derived and empty');
select is((select outcome from public.commit_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001',
  0,6001,2020::smallint,'{}'::integer[],false)),'assigned',
  'eligible first candidate commits as occurrence one');
select ok((select candidate_sequence=1 and candidate_progression_status='collecting'
  and candidate_acquisition_status='assigned' and tmdb_movie_id=6001
  from public.rooms where id='66100000-0000-4000-a000-000000000001'),
  'initial commit installs exact collecting room projection');
select is((select outcome from public.commit_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001',
  0,6002,2020::smallint,'{}'::integer[],false)),'assigned',
  'same-step replay adopts the installed database winner');
select is((select count(*) from public.room_candidate_occurrences),1::bigint,
  'same-step replay creates no hidden occurrence');
select is((select outcome from public.prepare_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001')),
  'assigned','assigned preflight bypasses discovery for metadata recovery');

select * from finish();
rollback;
