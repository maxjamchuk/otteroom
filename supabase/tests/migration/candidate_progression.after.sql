\set ON_ERROR_STOP on
begin;
set local statement_timeout='20s';
create function pg_temp.require(condition boolean) returns void language plpgsql as $f$
begin if condition is distinct from true then raise exception 'Feature 008 migration assertion failed';end if;end;$f$;
create temporary table expected_rooms as select value row from jsonb_array_elements((:'feature008_snapshot'::jsonb)->'rooms');
create temporary table expected_members as select value row from jsonb_array_elements((:'feature008_snapshot'::jsonb)->'members');
create temporary table expected_decisions as select value row from jsonb_array_elements((:'feature008_snapshot'::jsonb)->'decisions');

select pg_temp.require((select count(*)=6 from public.room_candidate_occurrences)
 and (select count(*)=6 from public.rooms where candidate_sequence=1)
 and (select count(*)=2 from public.rooms where candidate_sequence=0 and candidate_progression_status='inactive'));
select pg_temp.require((select candidate_progression_status='inactive' and candidate_sequence=0
 from public.rooms where id='f8100000-0000-4000-8000-000000000002'));
select pg_temp.require((select candidate_progression_status='collecting' and decision_completed_count=0
 from public.rooms where id='f8100000-0000-4000-8000-000000000003'));
select pg_temp.require((select candidate_progression_status='collecting' and decision_completed_count=1
 from public.rooms where id='f8100000-0000-4000-8000-000000000004'));
select pg_temp.require((select candidate_progression_status='agreed' and tmdb_movie_id=8105
 from public.rooms where id='f8100000-0000-4000-8000-000000000005'));
select pg_temp.require((select candidate_progression_status='advancing' and tmdb_movie_id is null
  and decision_completed_count=0 from public.rooms where id='f8100000-0000-4000-8000-000000000006'));
select pg_temp.require((select candidate_progression_status='agreed' from public.rooms
 where id='f8100000-0000-4000-8000-000000000007')
 and (select candidate_progression_status='advancing' from public.rooms
 where id='f8100000-0000-4000-8000-000000000008'));
select pg_temp.require(not exists(select 1 from expected_members e join public.room_members m
 on m.id=(e.row->>'id')::uuid where to_jsonb(m)<>e.row));
select pg_temp.require(not exists(select 1 from expected_decisions e join public.candidate_decisions d
 on d.room_member_id=(e.row->>'room_member_id')::uuid
 where d.decision::text<>e.row->>'decision' or d.accepted_at<>(e.row->>'accepted_at')::timestamptz));
select pg_temp.require(not exists(select 1 from public.candidate_decisions d
 join public.room_candidate_occurrences o on o.id=d.candidate_occurrence_id
 join public.room_members m on m.id=d.room_member_id
 where d.room_id<>o.room_id or d.room_id<>m.room_id));
select pg_temp.require((select count(*)=1 from pg_publication_tables where pubname='supabase_realtime')
 and not has_table_privilege('authenticated','public.room_candidate_occurrences','select')
 and has_column_privilege('authenticated','public.rooms','candidate_sequence','select'));

delete from public.rooms;
delete from auth.users where id::text like 'f8000000-0000-4000-8000-%'
 or id not in(select user_id from public.room_members);
select pg_temp.require(not exists(select 1 from public.rooms)
 and not exists(select 1 from public.room_candidate_occurrences)
 and not exists(select 1 from public.candidate_decisions));
commit;
