\set ON_ERROR_STOP on
begin;
set local statement_timeout='15s';
create temporary table expected_room as
  select value row from jsonb_array_elements((:'feature005_snapshot'::jsonb)->'rooms');
create temporary table expected_member as
  select value row from jsonb_array_elements((:'feature005_snapshot'::jsonb)->'members');
create temporary table expected_filter as
  select value row from jsonb_array_elements((:'feature005_snapshot'::jsonb)->'filters');
create temporary table expected_candidate as
  select value row from jsonb_array_elements((:'feature005_snapshot'::jsonb)->'candidates');
create function pg_temp.require(condition boolean) returns void language plpgsql as $f$
begin if condition is distinct from true then raise exception 'Feature 005 migration assertion failed';end if;end;
$f$;
create function pg_temp.rpc(subject uuid,command text) returns jsonb language plpgsql as $f$
declare result jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
  execute 'select to_jsonb(x) from ('||command||')x' into result;
  reset role;return result;
exception when others then reset role;raise;
end;
$f$;
create function pg_temp.sqlstate(subject uuid,command text) returns text language plpgsql as $f$
declare result text;
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
    execute command;
  exception when others then result:=sqlstate;
  end;
  reset role;return result;
exception when others then reset role;raise;
end;
$f$;

select pg_temp.require((select count(*)=4 from expected_room)
  and (select count(*)=10 from expected_member)
  and (select count(*)=6 from expected_filter)
  and (select count(*)=4 from expected_candidate));
select pg_temp.require(not exists(
  select 1 from expected_room e join public.rooms r on r.id=(e.row->>'id')::uuid
  where ((to_jsonb(r)-'filter_resolution_status')||jsonb_build_object('row_xmin',r.xmin::text))<>e.row
    or r.filter_resolution_status<>'pending'));
select pg_temp.require(not exists(
  select 1 from expected_member e join public.room_members m on m.id=(e.row->>'id')::uuid
  where (to_jsonb(m)||jsonb_build_object('row_xmin',m.xmin::text))<>e.row));
select pg_temp.require(not exists(
  select 1 from expected_filter e join public.participant_filters f
    on f.room_member_id=(e.row->>'room_member_id')::uuid
  where (to_jsonb(f)||jsonb_build_object('row_xmin',f.xmin::text))<>e.row));
select pg_temp.require(not exists(
  select 1 from expected_candidate e join public.movie_candidates c on c.id=e.row->>'id'
  where (to_jsonb(c)||jsonb_build_object('row_xmin',c.xmin::text))<>e.row));
select pg_temp.require(not exists(select 1 from private.room_filter_resolutions)
  and not exists(select 1 from private.room_filter_resolution_genre_clauses));

select pg_temp.require(to_regtype('public.filter_resolution_status') is not null
  and (select array_agg(enumlabel::text order by enumsortorder)=array['pending','compatible','incompatible']
    from pg_enum where enumtypid='public.filter_resolution_status'::regtype));
select pg_temp.require(to_regclass('private.room_filter_resolutions') is not null
  and to_regclass('private.room_filter_resolution_genre_clauses') is not null
  and (select bool_and(relrowsecurity and pg_get_userbyid(relowner)='postgres')
    from pg_class where oid in('private.room_filter_resolutions'::regclass,
      'private.room_filter_resolution_genre_clauses'::regclass)));
select pg_temp.require((select count(*)=0 from pg_policy where polrelid in(
  'private.room_filter_resolutions'::regclass,
  'private.room_filter_resolution_genre_clauses'::regclass))
  and not has_table_privilege('authenticated','private.room_filter_resolutions','SELECT')
  and not has_table_privilege('authenticated','private.room_filter_resolution_genre_clauses','SELECT'));
select pg_temp.require(to_regprocedure('public.resolve_common_filters(uuid)') is not null
  and has_function_privilege('authenticated','public.resolve_common_filters(uuid)'::regprocedure,'EXECUTE')
  and not has_function_privilege('anon','public.resolve_common_filters(uuid)'::regprocedure,'EXECUTE')
  and pg_get_userbyid((select proowner from pg_proc where oid='public.resolve_common_filters(uuid)'::regprocedure))='postgres'
  and (select proconfig=array['search_path=""'] from pg_proc where oid='public.resolve_common_filters(uuid)'::regprocedure));
select pg_temp.require((select count(*)=7 from pg_attribute a cross join lateral aclexplode(a.attacl)x
  where a.attrelid='public.rooms'::regclass and x.grantee='authenticated'::regrole::oid
    and x.privilege_type='SELECT'));
select pg_temp.require((select count(*)=1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='rooms'));
select pg_temp.require(not has_function_privilege('authenticated',
  'public.ensure_room_candidate(uuid)'::regprocedure,'EXECUTE'));

do $trial$
declare result jsonb;before_candidate jsonb;
begin
  result:=pg_temp.rpc('f5000000-0000-4000-8000-000000000001',
    $$select * from public.resolve_common_filters('f5100000-0000-4000-8000-000000000001')$$);
  perform pg_temp.require(result=jsonb_build_object('outcome','pending','filter_resolution_status','pending'));
  result:=pg_temp.rpc('f5000000-0000-4000-8000-000000000004',
    $$select * from public.resolve_common_filters('f5100000-0000-4000-8000-000000000002')$$);
  perform pg_temp.require(result=jsonb_build_object('outcome','pending','filter_resolution_status','pending'));
  perform pg_temp.require(not exists(select 1 from private.room_filter_resolutions));

  result:=pg_temp.rpc('f5000000-0000-4000-8000-000000000006',
    $$select * from public.resolve_common_filters('f5100000-0000-4000-8000-000000000003')$$);
  perform pg_temp.require(result=jsonb_build_object('outcome','compatible','filter_resolution_status','compatible'));
  perform pg_temp.require((select to_jsonb(x) from (
    select release_year_from,release_year_to from private.room_filter_resolutions
    where room_id='f5100000-0000-4000-8000-000000000003')x)
    =jsonb_build_object('release_year_from',2005,'release_year_to',2010));
  perform pg_temp.require((select jsonb_agg(jsonb_build_object('clause_ordinal',clause_ordinal,'genres',genres)
      order by clause_ordinal) from private.room_filter_resolution_genre_clauses
      where room_id='f5100000-0000-4000-8000-000000000003')
    ='[{"clause_ordinal":1,"genres":["action"]},{"clause_ordinal":2,"genres":["comedy","drama"]}]'::jsonb);

  select jsonb_agg(to_jsonb(c)||jsonb_build_object('row_xmin',c.xmin::text) order by sort_order)
    into before_candidate from public.movie_candidates c;
  result:=pg_temp.rpc('f5000000-0000-4000-8000-000000000008',
    $$select * from public.resolve_common_filters('f5100000-0000-4000-8000-000000000004')$$);
  perform pg_temp.require(result=jsonb_build_object('outcome','incompatible','filter_resolution_status','incompatible'));
  perform pg_temp.require(not exists(select 1 from private.room_filter_resolutions
    where room_id='f5100000-0000-4000-8000-000000000004'));
  perform pg_temp.require(before_candidate=(select jsonb_agg(to_jsonb(c)||jsonb_build_object('row_xmin',c.xmin::text)
    order by sort_order) from public.movie_candidates c));
  perform pg_temp.require((select movie_candidate_id='fixture-cloud-tram-four' from public.rooms
    where id='f5100000-0000-4000-8000-000000000004'));

  result:=pg_temp.rpc('f5000000-0000-4000-8000-000000000006',
    $$select * from public.join_room('F510000003')$$);
  perform pg_temp.require(result->>'outcome'='already_member'
    and result->>'filter_resolution_status'='compatible'
    and (select count(*) from jsonb_object_keys(result))=10);
  result:=pg_temp.rpc('f5000000-0000-4000-8000-000000000008',
    $$select * from public.join_room('F510000004')$$);
  perform pg_temp.require(result->>'outcome'='already_member'
    and result->>'filter_resolution_status'='incompatible'
    and (select count(*) from jsonb_object_keys(result))=10);
  result:=pg_temp.rpc('f5000000-0000-4000-8000-000000000001',
    $$select * from public.create_room('f5200000-0000-4000-8000-000000000099',2,true)$$);
  perform pg_temp.require(result->>'outcome'='created'
    and result->>'filter_resolution_status'='pending'
    and (select count(*) from jsonb_object_keys(result))=10);

  result:=pg_temp.rpc('f5000000-0000-4000-8000-000000000006',
    $$select * from public.get_my_participant_filter('f5100000-0000-4000-8000-000000000003')$$);
  perform pg_temp.require(result->>'outcome'='locked' and result->'genres'='[]'::jsonb);
  result:=pg_temp.rpc('f5000000-0000-4000-8000-000000000004',
    $$select * from public.get_my_participant_filter('f5100000-0000-4000-8000-000000000002')$$);
  perform pg_temp.require(result->>'outcome'='not_submitted' and result->'genres'='null'::jsonb);
  perform pg_temp.require(pg_temp.sqlstate('f5000000-0000-4000-8000-000000000006',
    'select * from private.room_filter_resolutions')='42501');
end;
$trial$;

select pg_temp.require(not exists(
  select 1 from expected_filter e join public.participant_filters f
    on f.room_member_id=(e.row->>'room_member_id')::uuid
  where (to_jsonb(f)||jsonb_build_object('row_xmin',f.xmin::text))<>e.row));
delete from public.rooms;
delete from auth.users where id::text like 'f5000000-0000-4000-8000-0000000000%';
select pg_temp.require(not exists(select 1 from public.rooms)
  and not exists(select 1 from public.room_members)
  and not exists(select 1 from public.participant_filters)
  and not exists(select 1 from private.room_filter_resolutions)
  and not exists(select 1 from private.room_filter_resolution_genre_clauses)
  and not exists(select 1 from auth.users));
commit;
