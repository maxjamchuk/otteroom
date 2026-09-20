-- Feature 007 immutable-decision regression under the Feature 008 occurrence contract.
\connect -reuse-previous=on "user=supabase_admin"
begin;
set local search_path=pg_catalog,public,extensions;
set local statement_timeout='60s';
create extension if not exists pgtap with schema extensions;
select no_plan();

select columns_are('public','candidate_decisions',
  array['room_id','room_member_id','candidate_occurrence_id','decision','accepted_at'],
  'decisions have exact occurrence-bound fields');
select col_type_is('public','candidate_decisions','candidate_occurrence_id','uuid',
  'decision target is an occurrence UUID');
select col_type_is('public','candidate_decisions','room_id','uuid',
  'decision carries the same-room join component');
select ok((select count(*)=1 from pg_constraint where conrelid='public.candidate_decisions'::regclass
    and conname='candidate_decisions_pkey'), 'decision primary key exists');
select ok(not has_table_privilege('authenticated','public.candidate_decisions','select')
  and not has_table_privilege('authenticated','public.candidate_decisions','insert'),
  'decision table stays private and grant-free');
select has_function('public','get_room_candidate_decision',array['uuid','integer','bigint'],
  'decision recovery has the progression-aware signature');
select has_function('public','submit_room_candidate_decision',
  array['uuid','integer','bigint','candidate_decision_value'],
  'decision submission has the progression-aware signature');
select ok(to_regprocedure('public.get_room_candidate_decision(uuid,bigint)') is null
  and to_regprocedure('public.submit_room_candidate_decision(uuid,bigint,candidate_decision_value)') is null,
  'obsolete movie-only signatures are absent');

create function pg_temp.call(subject uuid,command text) returns jsonb language plpgsql as $f$
declare result jsonb;begin
 set local role authenticated;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
 execute 'select to_jsonb(x) from ('||command||')x' into result;
 reset role;return result;
exception when others then reset role;raise;end;$f$;

insert into auth.users(id) values
('77000000-0000-4000-a000-000000000001'),('77000000-0000-4000-a000-000000000002'),
('77000000-0000-4000-a000-000000000003'),('77000000-0000-4000-a000-000000000004');
insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,
 filter_completed_count,filter_resolution_status,candidate_acquisition_status,
 candidate_progression_status,candidate_sequence,decision_completed_count)
values('77100000-0000-4000-a000-000000000001','F700000001',
 '77200000-0000-4000-a000-000000000001','77000000-0000-4000-a000-000000000003',2,2,2,
 'compatible','pending','inactive',0,0);
insert into public.room_members(id,room_id,user_id,is_voter) values
('77300000-0000-4000-a000-000000000001','77100000-0000-4000-a000-000000000001','77000000-0000-4000-a000-000000000001',true),
('77300000-0000-4000-a000-000000000002','77100000-0000-4000-a000-000000000001','77000000-0000-4000-a000-000000000002',true),
('77300000-0000-4000-a000-000000000003','77100000-0000-4000-a000-000000000001','77000000-0000-4000-a000-000000000003',false);
insert into private.room_filter_resolutions(room_id,release_year_from,release_year_to)
values('77100000-0000-4000-a000-000000000001',2000,2026);
insert into public.room_candidate_occurrences(id,room_id,sequence,tmdb_movie_id)
values('77400000-0000-4000-a000-000000000001','77100000-0000-4000-a000-000000000001',1,7001);
update public.rooms set candidate_acquisition_status='assigned',candidate_progression_status='collecting',
 candidate_sequence=1,tmdb_movie_id=7001 where id='77100000-0000-4000-a000-000000000001';

select is(pg_temp.call('77000000-0000-4000-a000-000000000001',
 $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000001',1,7001)$$)->>'outcome',
 'not_decided','current voter begins undecided');
select is(pg_temp.call('77000000-0000-4000-a000-000000000003',
 $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000001',1,7001)$$)->>'outcome',
 'observer','non-voting creator observes without a decision');
select is(pg_temp.call('77000000-0000-4000-a000-000000000001',
 $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000001',1,7001,'yes')$$)->>'outcome',
 'accepted','first value is accepted once');
select is(pg_temp.call('77000000-0000-4000-a000-000000000001',
 $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000001',1,7001,'yes')$$)->>'outcome',
 'unchanged','same-value replay performs no second decision');
select is(pg_temp.call('77000000-0000-4000-a000-000000000001',
 $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000001',1,7001,'no')$$)->>'outcome',
 'conflict','opposite replay returns the immutable stored winner');
select is((select count(*) from public.candidate_decisions),1::bigint,
  'duplicate and conflict retain one immutable row');
select is(pg_temp.call('77000000-0000-4000-a000-000000000004',
 $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000001',1,7001)$$),
 jsonb_build_object('outcome','not_found','my_decision',null,'candidate_sequence',null,
  'decision_completed_count',null,'required_voter_count',null,'decision_set_complete',null,
  'agreement_threshold',null,'candidate_outcome',null,'candidate_progression_status',null),
 'foreign caller receives the exact all-null protected shape');
select is(pg_temp.call('77000000-0000-4000-a000-000000000001',
 $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000001',2,7001)$$)->>'outcome',
 'candidate_changed','stale sequence is masked and cannot retarget locally');

select * from finish();
rollback;
