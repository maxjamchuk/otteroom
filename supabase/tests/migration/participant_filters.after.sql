\set ON_ERROR_STOP on
begin;
set local statement_timeout='10s';
create temporary table expected_room as
  select value row from jsonb_array_elements((:'feature004_snapshot'::jsonb)->'rooms');
create temporary table expected_member as
  select value row from jsonb_array_elements((:'feature004_snapshot'::jsonb)->'members');
create function pg_temp.require(condition boolean) returns void language plpgsql as $f$
begin if condition is distinct from true then raise exception 'Feature 004 migration assertion failed'; end if; end;
$f$;
create function pg_temp.rpc(subject uuid, command text) returns jsonb language plpgsql as $f$
declare result jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
  execute 'select to_jsonb(x) from ('||command||') x' into result;
  reset role; return result;
exception when others then reset role; raise;
end;
$f$;
select pg_temp.require((select count(*)=4 from expected_room) and (select count(*)=8 from expected_member));
select pg_temp.require(not exists(
  select 1 from expected_room e join public.rooms r on r.id=(e.row->>'id')::uuid
  where (to_jsonb(r)-array['filter_completed_count','filter_resolution_status'])<>e.row
    or r.filter_completed_count<>0 or r.filter_resolution_status<>'pending'));
select pg_temp.require(not exists(
  select 1 from expected_member e join public.room_members m on m.id=(e.row->>'id')::uuid
  where to_jsonb(m)<>e.row));
select pg_temp.require((select count(*)=0 from public.participant_filters));
select pg_temp.require((select count(*)=1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='rooms'));
select pg_temp.require(not has_function_privilege('authenticated',
  'public.ensure_room_candidate(uuid)'::regprocedure,'EXECUTE'));
select pg_temp.require(has_function_privilege('authenticated',
  'public.get_my_participant_filter(uuid)'::regprocedure,'EXECUTE')
  and has_function_privilege('authenticated',
  'public.submit_my_participant_filter(uuid,participant_genre[],smallint,smallint)'::regprocedure,'EXECUTE')
  and has_function_privilege('authenticated',
  'public.resolve_common_filters(uuid)'::regprocedure,'EXECUTE'));
select pg_temp.require(to_regclass('private.room_filter_resolutions') is not null
  and to_regclass('private.room_filter_resolution_genre_clauses') is not null
  and not exists(select 1 from private.room_filter_resolutions)
  and not exists(select 1 from private.room_filter_resolution_genre_clauses));
select pg_temp.require((select count(*)=7 from pg_attribute a cross join lateral aclexplode(a.attacl) x
  where a.attrelid='public.rooms'::regclass and x.grantee='authenticated'::regrole::oid
    and x.privilege_type='SELECT'));

do $trial$
declare result jsonb; before_room jsonb;
begin
  result:=pg_temp.rpc('f4000000-0000-4000-8000-000000000001',
    $$select * from public.join_room('F410000001')$$);
  perform pg_temp.require(result->>'outcome'='already_member' and result->>'filter_completed_count'='0'
    and result->>'filter_resolution_status'='pending');
  result:=pg_temp.rpc('f4000000-0000-4000-8000-000000000001',
    $$select * from public.get_my_participant_filter('f4100000-0000-4000-8000-000000000001')$$);
  perform pg_temp.require(result->>'outcome'='not_ready' and result->>'filter_completed_count'='0');
  result:=pg_temp.rpc('f4000000-0000-4000-8000-000000000004',
    $$select * from public.get_my_participant_filter('f4100000-0000-4000-8000-000000000003')$$);
  perform pg_temp.require(result->>'outcome'='not_voter' and result->>'genres' is null);
  result:=pg_temp.rpc('f4000000-0000-4000-8000-000000000002',
    $$select * from public.get_my_participant_filter('f4100000-0000-4000-8000-000000000002')$$);
  perform pg_temp.require(result->>'outcome'='not_submitted' and result->>'filter_completed_count'='0');
  select to_jsonb(r)||jsonb_build_object('xmin',xmin::text) into before_room
    from public.rooms r where id='f4100000-0000-4000-8000-000000000004';
  begin
    perform pg_temp.rpc('f4000000-0000-4000-8000-000000000007',
      $$select * from public.ensure_room_candidate('f4100000-0000-4000-8000-000000000004')$$);
    raise exception 'Candidate RPC unexpectedly executable';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.require(before_room=(select to_jsonb(r)||jsonb_build_object('xmin',xmin::text)
    from public.rooms r where id='f4100000-0000-4000-8000-000000000004'));
end;
$trial$;

delete from public.rooms where id in(select (row->>'id')::uuid from expected_room);
delete from auth.users where id::text like 'f4000000-0000-4000-8000-00000000000%';
select pg_temp.require(not exists(select 1 from public.rooms)
  and not exists(select 1 from public.room_members)
  and not exists(select 1 from public.participant_filters)
  and not exists(select 1 from auth.users));
commit;
