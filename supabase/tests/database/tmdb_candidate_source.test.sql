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
  array['uuid','uuid','integer','bigint','smallint','integer[]','boolean','bigint','numeric'],
  'candidate commit accepts transient retained-cutoff evidence');
select has_function('public','commit_room_tmdb_no_candidates',array['uuid','uuid','integer'],
  'empty commit adds only the server expected sequence');
select ok(to_regprocedure('public.commit_room_tmdb_candidate(uuid,uuid,bigint,smallint,integer[],boolean)') is null
  and to_regprocedure('public.commit_room_tmdb_no_candidates(uuid,uuid)') is null,
  'obsolete unsequenced commit signatures are absent');
select ok((select bool_and(not has_function_privilege('authenticated',oid,'execute')
  and has_function_privilege('service_role',oid,'execute')) from pg_proc where oid in(
    'public.prepare_room_tmdb_candidate(uuid,uuid)'::regprocedure,
    'public.commit_room_tmdb_candidate(uuid,uuid,integer,bigint,smallint,integer[],boolean,bigint,numeric)'::regprocedure,
    'public.commit_room_tmdb_no_candidates(uuid,uuid,integer)'::regprocedure)),
  'candidate source authority remains service-role-only');

insert into auth.users(id) values
('66000000-0000-4000-a000-000000000001'),('66000000-0000-4000-a000-000000000002');
insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,
 filter_completed_count,filter_resolution_status)
values('66100000-0000-4000-a000-000000000001','F600000001',
 '66200000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001',2,2,2,'compatible');
insert into private.room_selection_rules(room_id,rule_set_kind,candidate_ordering,metadata_language,genre_mode,agreement_numerator,agreement_denominator)
values('66100000-0000-4000-a000-000000000001','legacy_005_006_008','legacy_source_order','en-US','or',2,3);
insert into public.room_members(id,room_id,user_id,is_voter) values
('66300000-0000-4000-a000-000000000001','66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001',true),
('66300000-0000-4000-a000-000000000002','66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000002',true);
insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to)
values('66300000-0000-4000-a000-000000000001','{}'::public.participant_genre[],2000,2026),
      ('66300000-0000-4000-a000-000000000002','{}'::public.participant_genre[],2000,2026);
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
  0,6001,2020::smallint,'{}'::integer[],false,null::bigint,null::numeric)),'assigned',
  'eligible first candidate commits as occurrence one');
select ok((select candidate_sequence=1 and candidate_progression_status='collecting'
  and candidate_acquisition_status='assigned' and tmdb_movie_id=6001
  from public.rooms where id='66100000-0000-4000-a000-000000000001'),
  'initial commit installs exact collecting room projection');
select is((select outcome from public.commit_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001',
  0,6002,2020::smallint,'{}'::integer[],false,null::bigint,null::numeric)),'assigned',
  'same-step replay adopts the installed database winner');
select is((select count(*) from public.room_candidate_occurrences),1::bigint,
  'same-step replay creates no hidden occurrence');
select is((select outcome from public.prepare_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001')),
  'assigned','assigned preflight bypasses discovery for metadata recovery');
select results_eq(
  $$select rule_set_kind,candidate_ordering,minimum_vote_count,minimum_average_rating,metadata_language,genre_mode
      from public.prepare_room_tmdb_candidate(
        '66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001')$$,
  $$values (null::text,null::text,null::bigint,null::numeric,'en-US'::text,null::text)$$,
  'assigned preflight exposes only the retained metadata language');

-- Configured snapshots consume only the retained cutoff evidence.  The default
-- configured generation requires vote_count and omits vote_average, so a
-- missing/under-cutoff vote count is rejected while a valid equality value is
-- accepted without requiring a rating metric.
insert into auth.users(id) values
('66000000-0000-4000-a000-000000000003'),('66000000-0000-4000-a000-000000000004'),
('66000000-0000-4000-a000-000000000005'),('66000000-0000-4000-a000-000000000006');
insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,
 filter_completed_count,filter_resolution_status)
values
 ('66100000-0000-4000-a000-000000000002','F600000002',
  '66200000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000003',2,2,2,'compatible'),
 ('66100000-0000-4000-a000-000000000003','F600000003',
  '66200000-0000-4000-a000-000000000003','66000000-0000-4000-a000-000000000005',2,2,2,'compatible');
insert into private.room_selection_rules(room_id,rule_set_kind,candidate_ordering,minimum_vote_count,
  minimum_average_rating,metadata_language,genre_mode,agreement_numerator,agreement_denominator)
values
 ('66100000-0000-4000-a000-000000000002','configured_009_v1','vote_count_desc',500,null,'en-US','or',2,3),
 ('66100000-0000-4000-a000-000000000003','configured_009_v1','average_rating_desc',0,7.5,'en-US','or',2,3);
insert into public.room_members(id,room_id,user_id,is_voter) values
 ('66300000-0000-4000-a000-000000000003','66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000003',true),
 ('66300000-0000-4000-a000-000000000004','66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000004',true),
 ('66300000-0000-4000-a000-000000000005','66100000-0000-4000-a000-000000000003','66000000-0000-4000-a000-000000000005',true),
 ('66300000-0000-4000-a000-000000000006','66100000-0000-4000-a000-000000000003','66000000-0000-4000-a000-000000000006',true);
insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to)
select id,'{}'::public.participant_genre[],2000,2026 from public.room_members
where room_id in ('66100000-0000-4000-a000-000000000002','66100000-0000-4000-a000-000000000003');
insert into private.room_filter_resolutions(room_id,release_year_from,release_year_to)
values ('66100000-0000-4000-a000-000000000002',2000,2026),
       ('66100000-0000-4000-a000-000000000003',2000,2026);

select is((select minimum_vote_count from public.prepare_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000003')),
  500::bigint,'configured preflight returns the retained vote cutoff');
select is((select minimum_average_rating from public.prepare_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000003')),
  null::numeric,'omitted rating cutoff remains null in the retained constraint');
select throws_ok($$select * from public.commit_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000003',
  0,6010,2020::smallint,'{}'::integer[],false,null::bigint,null::numeric)$$,
  '22023',null,'missing required vote count evidence is incomplete');
select throws_ok($$select * from public.commit_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000003',
  0,6010,2020::smallint,'{}'::integer[],false,499::bigint,null::numeric)$$,
  '22023',null,'below-cutoff vote count evidence is rejected');
select is((select outcome from public.commit_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000003',
  0,6010,2020::smallint,'{}'::integer[],false,500::bigint,null::numeric)),
  'assigned','cutoff equality commits and omitted rating evidence is accepted');

select is((select minimum_average_rating from public.prepare_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000003','66000000-0000-4000-a000-000000000005')),
  7.5::numeric,'configured average-order preflight returns the retained rating cutoff');
select throws_ok($$select * from public.commit_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000003','66000000-0000-4000-a000-000000000005',
  0,6020,2020::smallint,'{}'::integer[],false,0::bigint,null::numeric)$$,
  '22023',null,'missing required average rating evidence is incomplete');
select throws_ok($$select * from public.commit_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000003','66000000-0000-4000-a000-000000000005',
  0,6020,2020::smallint,'{}'::integer[],false,0::bigint,7.49::numeric)$$,
  '22023',null,'below-cutoff average rating evidence is rejected');
select is((select outcome from public.commit_room_tmdb_candidate(
  '66100000-0000-4000-a000-000000000003','66000000-0000-4000-a000-000000000005',
  0,6020,2020::smallint,'{}'::integer[],false,0::bigint,7.5::numeric)),
  'assigned','average cutoff equality commits with valid vote evidence');

select * from finish();
rollback;
