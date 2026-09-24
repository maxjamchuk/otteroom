\set ON_ERROR_STOP on
begin;
set local statement_timeout='20s';
create function pg_temp.require(condition boolean) returns void language plpgsql as $f$
begin if condition is distinct from true then raise exception 'Feature 009 migration assertion failed'; end if; end; $f$;
create temporary table expected_rooms as select value row from jsonb_array_elements((:'feature009_snapshot'::jsonb)->'rooms');
create temporary table expected_members as select value row from jsonb_array_elements((:'feature009_snapshot'::jsonb)->'members');
create temporary table expected_filters as select value row from jsonb_array_elements((:'feature009_snapshot'::jsonb)->'filters');
create temporary table expected_parents as select value row from jsonb_array_elements((:'feature009_snapshot'::jsonb)->'parents');
create temporary table expected_occurrences as select value row from jsonb_array_elements((:'feature009_snapshot'::jsonb)->'occurrences');
create temporary table expected_decisions as select value row from jsonb_array_elements((:'feature009_snapshot'::jsonb)->'decisions');

select pg_temp.require((select count(*) from public.rooms)=(select count(*) from private.room_selection_rules));
select pg_temp.require((select count(*) from private.room_selection_rules where rule_set_kind='legacy_005_006_008')=(select count(*) from public.rooms));
select pg_temp.require(not exists(select 1 from private.room_selection_rules where
  rule_set_kind<>'legacy_005_006_008' or candidate_ordering<>'legacy_source_order'
  or minimum_vote_count is not null or minimum_average_rating is not null
  or metadata_language<>'en-US' or genre_mode<>'or'
  or agreement_numerator<>2 or agreement_denominator<>3));

select pg_temp.require(not exists(select 1 from expected_rooms e join public.rooms r on r.id=(e.row->>'id')::uuid
  where (to_jsonb(r)||jsonb_build_object('row_xmin',r.xmin::text))<>e.row));
select pg_temp.require(not exists(select 1 from expected_members e join public.room_members m on m.id=(e.row->>'id')::uuid
  where (to_jsonb(m)||jsonb_build_object('row_xmin',m.xmin::text))<>e.row));
select pg_temp.require(not exists(select 1 from expected_filters e join public.participant_filters f on f.room_member_id=(e.row->>'room_member_id')::uuid
  where (to_jsonb(f)||jsonb_build_object('row_xmin',f.xmin::text))<>e.row));
select pg_temp.require(not exists(select 1 from expected_parents e join private.room_filter_resolutions p on p.room_id=(e.row->>'room_id')::uuid
  where (to_jsonb(p)||jsonb_build_object('row_xmin',p.xmin::text))<>e.row));
select pg_temp.require(not exists(select 1 from expected_occurrences e join public.room_candidate_occurrences o on o.id=(e.row->>'id')::uuid
  where (to_jsonb(o)||jsonb_build_object('row_xmin',o.xmin::text))<>e.row));
select pg_temp.require(not exists(select 1 from expected_decisions e join public.candidate_decisions d on d.room_member_id=(e.row->>'room_member_id')::uuid and d.candidate_occurrence_id=(e.row->>'candidate_occurrence_id')::uuid
  where (to_jsonb(d)||jsonb_build_object('row_xmin',d.xmin::text))<>e.row));

select pg_temp.require(not has_table_privilege('anon','private.room_selection_rules','select')
  and not has_table_privilege('authenticated','private.room_selection_rules','select')
  and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='private' and tablename='room_selection_rules'));
select pg_temp.require(to_regprocedure('public.create_room(uuid,integer,boolean)') is null
  and to_regprocedure('public.create_room_with_selection_rules(uuid,uuid,integer,boolean,text,text,bigint,numeric,text,text,integer,integer)') is not null);

-- A newly created room receives one frozen configured generation atomically;
-- retrying the same actor/request returns the winner without rewriting either
-- the room projection or its private snapshot.
do $create$
declare first_result jsonb; second_result jsonb; rid uuid; before_room jsonb; before_rules jsonb;
begin
  set local role service_role;
  select to_jsonb(x) into first_result from public.create_room_with_selection_rules(
    'f9000000-0000-4000-8000-000000000020','f9200000-0000-4000-8000-000000000020',3,false,
    'configured_009_v1','vote_count_desc',500,null,'en-US','or',2,3) x;
  reset role;
  perform pg_temp.require(first_result->>'outcome'='created'
    and first_result->>'required_voter_count'='3'
    and first_result->>'voter_count'='0'
    and first_result->>'is_voter'='false'
    and (select count(*)=14 from jsonb_object_keys(first_result)));
  rid:=(first_result->>'room_id')::uuid;
  select to_jsonb(r)||jsonb_build_object('xmin',r.xmin::text) into before_room from public.rooms r where r.id=rid;
  select to_jsonb(s)||jsonb_build_object('xmin',s.xmin::text) into before_rules
    from private.room_selection_rules s where s.room_id=rid;
  perform pg_temp.require(before_rules->>'rule_set_kind'='configured_009_v1'
    and before_rules->>'candidate_ordering'='vote_count_desc'
    and before_rules->>'minimum_vote_count'='500'
    and before_rules->>'minimum_average_rating' is null
    and before_rules->>'metadata_language'='en-US' and before_rules->>'genre_mode'='or'
    and before_rules->>'agreement_numerator'='2' and before_rules->>'agreement_denominator'='3');
  set local role service_role;
  select to_jsonb(x) into second_result from public.create_room_with_selection_rules(
    'f9000000-0000-4000-8000-000000000020','f9200000-0000-4000-8000-000000000020',2,true,
    'configured_009_v1','title_asc',0,9.9,'de-DE','and',1,1) x;
  reset role;
  perform pg_temp.require(second_result->>'outcome'='already_created'
    and (second_result-'outcome')=(first_result-'outcome')
    and before_room=(select to_jsonb(r)||jsonb_build_object('xmin',r.xmin::text) from public.rooms r where r.id=rid)
    and before_rules=(select to_jsonb(s)||jsonb_build_object('xmin',s.xmin::text)
      from private.room_selection_rules s where s.room_id=rid)
    and (select count(*)=1 from public.rooms where creation_request_id='f9200000-0000-4000-8000-000000000020')
    and (select count(*)=1 from public.room_members where room_id=rid)
    and (select count(*)=1 from private.room_selection_rules where room_id=rid));
end;
$create$;

delete from public.rooms;
delete from auth.users where id::text like 'f9000000-0000-4000-8000-%';
select pg_temp.require(not exists(select 1 from public.rooms) and not exists(select 1 from private.room_selection_rules)
  and not exists(select 1 from auth.users where id::text like 'f9000000-0000-4000-8000-%'));
commit;
