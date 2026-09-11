-- Feature 005 common-filter authority, algebra, privacy and recovery evidence.
-- Ordinary fixtures are rollback-only. Deterministic multi-session trials below
-- own and clean their committed fixtures explicitly.
begin;
set local statement_timeout = '30s';
create extension if not exists pgtap with schema extensions;
select plan(74);

select has_type('public','filter_resolution_status','resolution status enum exists');
select results_eq(
  $$select e.enumlabel::text collate "default" from pg_enum e join pg_type t on t.oid=e.enumtypid
      join pg_namespace n on n.oid=t.typnamespace
      where n.nspname='public' and t.typname='filter_resolution_status' order by e.enumsortorder$$,
  $$values ('pending'::text),('compatible'::text),('incompatible'::text)$$,
  'resolution status enum is exact and ordered');
select col_type_is('public','rooms','filter_resolution_status','filter_resolution_status',
  'rooms stores the public status enum');
select col_not_null('public','rooms','filter_resolution_status','room status is non-null');
select is((select pg_get_expr(d.adbin,d.adrelid) from pg_attrdef d join pg_attribute a
    on a.attrelid=d.adrelid and a.attnum=d.adnum
    where d.adrelid='public.rooms'::regclass and a.attname='filter_resolution_status'),
  '''pending''::filter_resolution_status','room status defaults pending');
select ok(exists(select 1 from pg_constraint where conrelid='public.rooms'::regclass
    and conname='rooms_filter_resolution_requires_complete_check'
    and pg_get_constraintdef(oid) like '%filter_resolution_status = ''pending''%'
    and pg_get_constraintdef(oid) like '%filter_completed_count = required_voter_count%'),
  'terminal room status requires frozen N/N');

select has_table('private','room_filter_resolutions','private compatible parent exists');
select columns_are('private','room_filter_resolutions',
  array['room_id','release_year_from','release_year_to'],'parent columns are exact');
select col_type_is('private','room_filter_resolutions','room_id','uuid','parent room key is uuid');
select col_type_is('private','room_filter_resolutions','release_year_from','smallint','parent lower year is smallint');
select col_type_is('private','room_filter_resolutions','release_year_to','smallint','parent upper year is smallint');
select has_pk('private','room_filter_resolutions','parent has primary key');
select has_fk('private','room_filter_resolutions','parent has room foreign key');
select ok(exists(select 1 from pg_constraint where conrelid='private.room_filter_resolutions'::regclass
    and conname='room_filter_resolutions_release_year_check'),
  'parent has inclusive valid-year check');

select has_table('private','room_filter_resolution_genre_clauses','private genre clauses exist');
select columns_are('private','room_filter_resolution_genre_clauses',
  array['room_id','clause_ordinal','genres'],'clause columns contain no identity or movie data');
select col_type_is('private','room_filter_resolution_genre_clauses','room_id','uuid','clause room key is uuid');
select col_type_is('private','room_filter_resolution_genre_clauses','clause_ordinal','integer','clause ordinal is integer');
select col_type_is('private','room_filter_resolution_genre_clauses','genres','participant_genre[]','clause genres use exact enum array');
select has_pk('private','room_filter_resolution_genre_clauses','clauses have room/ordinal primary key');
select has_fk('private','room_filter_resolution_genre_clauses','clauses belong to compatible parent');
select ok(exists(select 1 from pg_constraint where conrelid='private.room_filter_resolution_genre_clauses'::regclass
    and conname='room_filter_resolution_genre_clauses_ordinal_check'),
  'clause ordinal is checked');
select ok(exists(select 1 from pg_constraint where conrelid='private.room_filter_resolution_genre_clauses'::regclass
    and conname='room_filter_resolution_genre_clauses_genres_check'),
  'clause arrays are checked nonempty and unique');
select results_eq(
  $$select c.relname::text collate "default",c.relrowsecurity,pg_get_userbyid(c.relowner)::text collate "default"
      from pg_class c where c.oid in('private.room_filter_resolutions'::regclass,
        'private.room_filter_resolution_genre_clauses'::regclass) order by 1$$,
  $$values ('room_filter_resolution_genre_clauses'::text,true,'postgres'::text),
            ('room_filter_resolutions'::text,true,'postgres'::text)$$,
  'private result relations are postgres-owned with RLS');
select is((select count(*) from pg_policy where polrelid in(
    'private.room_filter_resolutions'::regclass,
    'private.room_filter_resolution_genre_clauses'::regclass)),0::bigint,
  'private result relations have no client policy');
select is((select count(*) from pg_class c cross join lateral
    aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    where c.oid in('private.room_filter_resolutions'::regclass,
      'private.room_filter_resolution_genre_clauses'::regclass)
      and a.grantee in(0,'anon'::regrole::oid,'authenticated'::regrole::oid)),0::bigint,
  'private result relations have no PUBLIC or client grants');
select results_eq(
  $$select schemaname::text collate "default",tablename::text collate "default"
      from pg_publication_tables where pubname='supabase_realtime' order by 1,2$$,
  $$values ('public'::text,'rooms'::text)$$,
  'Realtime remains rooms-only');
select results_eq(
  $$select column_name::text collate "default" from information_schema.column_privileges
      where table_schema='public' and table_name='rooms' and grantee='authenticated'
        and privilege_type='SELECT' order by array_position(array[
          'id','code','state','voter_count','required_voter_count',
          'filter_completed_count','filter_resolution_status'],column_name::text)$$,
  $$values ('id'::text),('code'::text),('state'::text),('voter_count'::text),
            ('required_voter_count'::text),('filter_completed_count'::text),
            ('filter_resolution_status'::text)$$,
  'authenticated room projection grant is exactly seven safe columns');
select ok(not exists(select 1 from information_schema.columns where table_schema='private'
    and table_name in('room_filter_resolutions','room_filter_resolution_genre_clauses')
    and (column_name like '%member%' or column_name like '%user%' or column_name like '%filter_id%'
      or column_name like '%movie%' or column_name like '%tmdb%' or column_name like '%catalog%')),
  'private payload persists no source identity or movie/catalog field');

select has_function('public','resolve_common_filters',array['uuid'],'resolver exact signature exists');
select results_eq(
  $$select p.prosecdef,pg_get_userbyid(p.proowner)::text collate "default",p.proconfig collate "default",
      l.lanname::text collate "default"
    from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=to_regprocedure('public.resolve_common_filters(uuid)')$$,
  $$values (true,'postgres'::text,array['search_path=""'],'plpgsql'::text)$$,
  'resolver is postgres-owned hardened plpgsql');
select is(pg_get_function_result('public.resolve_common_filters(uuid)'::regprocedure),
  'TABLE(outcome text, filter_resolution_status filter_resolution_status)',
  'resolver returns only outcome and status');
select results_eq(
  $$select a.grantee::regrole::text collate "default",a.privilege_type::text collate "default",a.is_grantable
      from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=to_regprocedure('public.resolve_common_filters(uuid)') order by 1,2$$,
  $$values ('authenticated'::text,'EXECUTE'::text,false),('postgres'::text,'EXECUTE'::text,false)$$,
  'resolver EXECUTE is authenticated plus owner only');
select ok(not has_function_privilege('anon',to_regprocedure('public.resolve_common_filters(uuid)'),'EXECUTE'),
  'anon resolver EXECUTE denied');
select ok(not exists(select 1 from pg_proc p cross join lateral
    aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.oid=to_regprocedure('public.resolve_common_filters(uuid)') and a.grantee=0),
  'PUBLIC resolver EXECUTE denied');

create function pg_temp.client_json(subject uuid,command text)
returns jsonb language plpgsql as $f$
declare result jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
  execute 'select jsonb_agg(to_jsonb(x)) from ('||command||') x' into result;
  reset role;
  return result;
exception when others then reset role;raise;
end;
$f$;
create function pg_temp.client_sqlstate(subject uuid,command text)
returns text language plpgsql as $f$
declare seen text;
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub','',true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
    execute command;
  exception when others then seen:=sqlstate;
  end;
  reset role;
  return seen;
exception when others then reset role;raise;
end;
$f$;

insert into auth.users(id) values
  ('05100000-0000-4000-a000-000000000001'),
  ('05100000-0000-4000-a000-000000000002'),
  ('05100000-0000-4000-a000-000000000003'),
  ('05100000-0000-4000-a000-000000000004'),
  ('05100000-0000-4000-a000-000000000005'),
  ('05100000-0000-4000-a000-000000000006');
insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,
  voter_count,filter_completed_count,movie_candidate_id,created_at,updated_at) values
  ('05110000-0000-4000-a000-000000000001','F500000001','05120000-0000-4000-a000-000000000001','05100000-0000-4000-a000-000000000001',2,1,0,null,'2026-01-01','2026-01-01'),
  ('05110000-0000-4000-a000-000000000002','F500000002','05120000-0000-4000-a000-000000000002','05100000-0000-4000-a000-000000000001',2,2,1,null,'2026-01-01','2026-01-01'),
  ('05110000-0000-4000-a000-000000000003','F500000003','05120000-0000-4000-a000-000000000003','05100000-0000-4000-a000-000000000001',3,3,3,'fixture-clockwork-orchard','2026-01-01','2026-01-01'),
  ('05110000-0000-4000-a000-000000000004','F500000004','05120000-0000-4000-a000-000000000004','05100000-0000-4000-a000-000000000001',2,2,2,null,'2026-01-01','2026-01-01'),
  ('05110000-0000-4000-a000-000000000005','F500000005','05120000-0000-4000-a000-000000000005','05100000-0000-4000-a000-000000000004',2,2,2,null,'2026-01-01','2026-01-01'),
  ('05110000-0000-4000-a000-000000000006','F500000006','05120000-0000-4000-a000-000000000006','05100000-0000-4000-a000-000000000001',3,3,3,null,'2026-01-01','2026-01-01'),
  ('05110000-0000-4000-a000-000000000007','F500000007','05120000-0000-4000-a000-000000000007','05100000-0000-4000-a000-000000000001',2,2,2,null,'2026-01-01','2026-01-01'),
  ('05110000-0000-4000-a000-000000000008','F500000008','05120000-0000-4000-a000-000000000008','05100000-0000-4000-a000-000000000001',2,2,2,null,'2026-01-01','2026-01-01'),
  ('05110000-0000-4000-a000-000000000009','F500000009','05120000-0000-4000-a000-000000000009','05100000-0000-4000-a000-000000000001',2,2,2,null,'2026-01-01','2026-01-01');
insert into public.room_members(id,room_id,user_id,is_voter) values
  ('05130000-0000-4000-a000-000000000001','05110000-0000-4000-a000-000000000001','05100000-0000-4000-a000-000000000001',true),
  ('05130000-0000-4000-a000-000000000002','05110000-0000-4000-a000-000000000002','05100000-0000-4000-a000-000000000001',true),
  ('05130000-0000-4000-a000-000000000003','05110000-0000-4000-a000-000000000002','05100000-0000-4000-a000-000000000002',true),
  ('05130000-0000-4000-a000-000000000004','05110000-0000-4000-a000-000000000003','05100000-0000-4000-a000-000000000001',true),
  ('05130000-0000-4000-a000-000000000005','05110000-0000-4000-a000-000000000003','05100000-0000-4000-a000-000000000002',true),
  ('05130000-0000-4000-a000-000000000006','05110000-0000-4000-a000-000000000003','05100000-0000-4000-a000-000000000003',true),
  ('05130000-0000-4000-a000-000000000007','05110000-0000-4000-a000-000000000004','05100000-0000-4000-a000-000000000001',true),
  ('05130000-0000-4000-a000-000000000008','05110000-0000-4000-a000-000000000004','05100000-0000-4000-a000-000000000002',true),
  ('05130000-0000-4000-a000-000000000009','05110000-0000-4000-a000-000000000005','05100000-0000-4000-a000-000000000004',false),
  ('05130000-0000-4000-a000-000000000010','05110000-0000-4000-a000-000000000005','05100000-0000-4000-a000-000000000005',true),
  ('05130000-0000-4000-a000-000000000011','05110000-0000-4000-a000-000000000005','05100000-0000-4000-a000-000000000006',true),
  ('05130000-0000-4000-a000-000000000012','05110000-0000-4000-a000-000000000006','05100000-0000-4000-a000-000000000001',true),
  ('05130000-0000-4000-a000-000000000013','05110000-0000-4000-a000-000000000006','05100000-0000-4000-a000-000000000002',true),
  ('05130000-0000-4000-a000-000000000014','05110000-0000-4000-a000-000000000006','05100000-0000-4000-a000-000000000003',true),
  ('05130000-0000-4000-a000-000000000015','05110000-0000-4000-a000-000000000007','05100000-0000-4000-a000-000000000001',true),
  ('05130000-0000-4000-a000-000000000016','05110000-0000-4000-a000-000000000007','05100000-0000-4000-a000-000000000002',true),
  ('05130000-0000-4000-a000-000000000017','05110000-0000-4000-a000-000000000008','05100000-0000-4000-a000-000000000001',true),
  ('05130000-0000-4000-a000-000000000018','05110000-0000-4000-a000-000000000008','05100000-0000-4000-a000-000000000002',true),
  ('05130000-0000-4000-a000-000000000019','05110000-0000-4000-a000-000000000009','05100000-0000-4000-a000-000000000001',true);
insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to) values
  ('05130000-0000-4000-a000-000000000002','{action}',2000,2020),
  ('05130000-0000-4000-a000-000000000004','{comedy,drama}',1990,2020),
  ('05130000-0000-4000-a000-000000000005','{}',2005,2015),
  ('05130000-0000-4000-a000-000000000006','{action}',2000,2010),
  ('05130000-0000-4000-a000-000000000007','{action}',2000,2004),
  ('05130000-0000-4000-a000-000000000008','{drama}',2005,2010),
  ('05130000-0000-4000-a000-000000000010','{action}',2000,2020),
  ('05130000-0000-4000-a000-000000000011','{action}',2010,2026),
  ('05130000-0000-4000-a000-000000000012','{thriller,war}',2000,2010),
  ('05130000-0000-4000-a000-000000000013','{thriller,war}',2005,2015),
  ('05130000-0000-4000-a000-000000000014','{}',2010,2020),
  ('05130000-0000-4000-a000-000000000015','{action}',2000,2020),
  ('05130000-0000-4000-a000-000000000016','{drama}',2005,2015),
  ('05130000-0000-4000-a000-000000000017','{}',1900,2020),
  ('05130000-0000-4000-a000-000000000018','{}',2000,2010),
  ('05130000-0000-4000-a000-000000000019','{action}',2000,2020);

create temporary table resolution_rooms_before as
  select id,movie_candidate_id,filter_completed_count,updated_at,xmin::text row_xmin
    from public.rooms where code like 'F50000000%' order by id;
create temporary table resolution_filters_before as
  select f.*,f.xmin::text row_xmin from public.participant_filters f
    join public.room_members m on m.id=f.room_member_id
    where m.room_id in(select id from public.rooms where code like 'F50000000%') order by f.room_member_id;
create temporary table resolution_candidates_before as
  select c.*,c.xmin::text row_xmin from public.movie_candidates c order by sort_order;

select is(pg_temp.client_sqlstate(null,
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000001')$$),
  '42501','resolver requires Auth subject');
select is(pg_temp.client_json('05100000-0000-4000-a000-000000000006',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000001')$$),
  '[{"outcome":"not_found","filter_resolution_status":null}]'::jsonb,
  'foreign room is masked as not_found with exact nullability');
select is(pg_temp.client_json('05100000-0000-4000-a000-000000000001',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000001')$$),
  '[{"outcome":"pending","filter_resolution_status":"pending"}]'::jsonb,
  'below assembly returns pending without a partial result');
select is(pg_temp.client_json('05100000-0000-4000-a000-000000000002',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000002')$$),
  '[{"outcome":"pending","filter_resolution_status":"pending"}]'::jsonb,
  'partial X/N returns pending without writes');
select is((select count(*) from private.room_filter_resolutions),0::bigint,
  'early calls create no compatible payload');

select is(pg_temp.client_json('05100000-0000-4000-a000-000000000001',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000003')$$),
  '[{"outcome":"compatible","filter_resolution_status":"compatible"}]'::jsonb,
  'complete compatible room returns exact terminal row');
select results_eq(
  $$select room_id,release_year_from,release_year_to from private.room_filter_resolutions
      where room_id='05110000-0000-4000-a000-000000000003'$$,
  $$values ('05110000-0000-4000-a000-000000000003'::uuid,2005::smallint,2010::smallint)$$,
  'compatible parent uses max lower and min upper inclusive');
select results_eq(
  $$select clause_ordinal,genres from private.room_filter_resolution_genre_clauses
      where room_id='05110000-0000-4000-a000-000000000003' order by clause_ordinal$$,
  $$values (1,'{action}'::public.participant_genre[]),(2,'{comedy,drama}'::public.participant_genre[])$$,
  'Any is neutral and disjoint voter OR clauses remain separately ANDed in canonical order');
select is((select count(*) from private.room_filter_resolution_genre_clauses
    where room_id='05110000-0000-4000-a000-000000000003'),2::bigint,
  'each constrained voter contributes exactly one clause');

select is(pg_temp.client_json('05100000-0000-4000-a000-000000000002',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000004')$$),
  '[{"outcome":"incompatible","filter_resolution_status":"incompatible"}]'::jsonb,
  'empty inclusive year overlap returns exact incompatible row');
select ok(not exists(select 1 from private.room_filter_resolutions
    where room_id='05110000-0000-4000-a000-000000000004'),
  'incompatible room has no usable payload');
select is(pg_temp.client_json('05100000-0000-4000-a000-000000000004',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000005')$$)->0->>'outcome',
  'compatible','non-voting creator may resolve but contributes no input');
select results_eq(
  $$select release_year_from,release_year_to from private.room_filter_resolutions
      where room_id='05110000-0000-4000-a000-000000000005'$$,
  $$values (2010::smallint,2020::smallint)$$,
  'non-voting creator adds no year constraint');
select results_eq(
  $$select clause_ordinal,genres from private.room_filter_resolution_genre_clauses
      where room_id='05110000-0000-4000-a000-000000000005' order by 1$$,
  $$values (1,'{action}'::public.participant_genre[]),(2,'{action}'::public.participant_genre[])$$,
  'duplicate equal voter clauses are intentionally preserved with contiguous ordinals');

select is(pg_temp.client_json('05100000-0000-4000-a000-000000000003',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000006')$$)->0->>'outcome',
  'compatible','one-year overlap with all valid genre clauses remains compatible');
select results_eq(
  $$select release_year_from,release_year_to from private.room_filter_resolutions
      where room_id='05110000-0000-4000-a000-000000000006'$$,
  $$values (2010::smallint,2010::smallint)$$,
  'single inclusive boundary year is preserved');
select results_eq(
  $$select clause_ordinal,genres from private.room_filter_resolution_genre_clauses
      where room_id='05110000-0000-4000-a000-000000000006' order by 1$$,
  $$values (1,'{thriller,war}'::public.participant_genre[]),(2,'{thriller,war}'::public.participant_genre[])$$,
  'equal clauses are stable independent of source-row order and Any adds no row');

select is(pg_temp.client_json('05100000-0000-4000-a000-000000000001',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000008')$$)->0->>'outcome',
  'compatible','all-Any voters produce a compatible year-only result');
select is((select count(*) from private.room_filter_resolution_genre_clauses
    where room_id='05110000-0000-4000-a000-000000000008'),0::bigint,
  'all-Any compatible payload has zero genre clauses');
select is(pg_temp.client_sqlstate('05100000-0000-4000-a000-000000000001',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000009')$$),
  'P0001','N/N with an incomplete fixed voter/filter shape is rejected');

-- Raise after compatible internal work and prove the statement rolls back to
-- pending with its immutable sources intact, then remove the test-only object.
create function private.feature005_test_clause_fault() returns trigger
language plpgsql set search_path='' as $f$
begin
  if current_setting('otteroom.test.resolution_fault',true)='on' then
    raise exception using errcode='P0001',message='test resolution fault';
  end if;
  return new;
end;
$f$;
alter function private.feature005_test_clause_fault() owner to postgres;
revoke all on function private.feature005_test_clause_fault() from public,anon,authenticated;
create trigger feature005_test_clause_fault after insert on private.room_filter_resolution_genre_clauses
for each row execute function private.feature005_test_clause_fault();
select set_config('otteroom.test.resolution_fault','on',true);
select is(pg_temp.client_sqlstate('05100000-0000-4000-a000-000000000001',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000007')$$),
  'P0001','injected post-work exception escapes with no business row');
select set_config('otteroom.test.resolution_fault','off',true);
select is((select filter_resolution_status::text from public.rooms
    where id='05110000-0000-4000-a000-000000000007'),'pending',
  'post-work exception rolls room authority back to pending');
select ok(not exists(select 1 from private.room_filter_resolutions
    where room_id='05110000-0000-4000-a000-000000000007'),
  'post-work exception rolls parent and clauses back together');
drop trigger feature005_test_clause_fault on private.room_filter_resolution_genre_clauses;
drop function private.feature005_test_clause_fault();
select is(pg_temp.client_json('05100000-0000-4000-a000-000000000001',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000007')$$)->0->>'outcome',
  'compatible','retry after rollback resolves from the same frozen inputs');
select ok(to_regprocedure('private.feature005_test_clause_fault()') is null,
  'test-only fault function is removed');

create temporary table terminal_before as
  select r.id,r.filter_resolution_status,r.updated_at,r.xmin::text room_xmin,
    p.xmin::text parent_xmin from public.rooms r left join private.room_filter_resolutions p on p.room_id=r.id
    where r.id='05110000-0000-4000-a000-000000000003';
select is(pg_temp.client_json('05100000-0000-4000-a000-000000000002',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000003')$$)->0->>'outcome',
  'compatible','different authorized member recovers existing compatible result');
select results_eq(
  $$select r.id,r.filter_resolution_status,r.updated_at,r.xmin::text room_xmin,
      p.xmin::text parent_xmin from public.rooms r left join private.room_filter_resolutions p on p.room_id=r.id
      where r.id='05110000-0000-4000-a000-000000000003'$$,
  $$select * from terminal_before$$,
  'terminal retry is a verified zero-write no-op with stable xmin');
select results_eq(
  $$select f.*,f.xmin::text row_xmin from public.participant_filters f
      join public.room_members m on m.id=f.room_member_id
      where m.room_id in(select id from public.rooms where code like 'F50000000%') order by f.room_member_id$$,
  $$select * from resolution_filters_before$$,
  'resolution and retries never mutate frozen filter values or xmin');
select results_eq(
  $$select c.*,c.xmin::text row_xmin from public.movie_candidates c order by sort_order$$,
  $$select * from resolution_candidates_before$$,
  'resolution invokes no catalog/candidate mutation');
select is((select movie_candidate_id from public.rooms where id='05110000-0000-4000-a000-000000000003'),
  'fixture-clockwork-orchard','preassigned historical candidate FK remains unchanged and hidden');

select is(pg_temp.client_sqlstate('05100000-0000-4000-a000-000000000001',
    $$select * from private.room_filter_resolutions$$),'42501',
  'authorized member cannot read private compatible parent');
select is(pg_temp.client_sqlstate('05100000-0000-4000-a000-000000000001',
    $$select * from private.room_filter_resolution_genre_clauses$$),'42501',
  'authorized member cannot read private clauses');
select is(pg_temp.client_sqlstate('05100000-0000-4000-a000-000000000001',
    $$delete from private.room_filter_resolutions$$),'42501',
  'authorized member cannot mutate private payload');
select is(pg_temp.client_json('05100000-0000-4000-a000-000000000001',
    $$select id,code,state,voter_count,required_voter_count,filter_completed_count,filter_resolution_status
      from public.rooms where id='05110000-0000-4000-a000-000000000003'$$),
  '[{"id":"05110000-0000-4000-a000-000000000003","code":"F500000003","state":"ready","voter_count":3,"required_voter_count":3,"filter_completed_count":3,"filter_resolution_status":"compatible"}]'::jsonb,
  'room projection exposes status only');

-- Corrupt committed shapes are rejected, never repaired or reversed.
delete from private.room_filter_resolutions where room_id='05110000-0000-4000-a000-000000000003';
select is(pg_temp.client_sqlstate('05100000-0000-4000-a000-000000000001',
    $$select * from public.resolve_common_filters('05110000-0000-4000-a000-000000000003')$$),
  'P0001','terminal/payload contradiction fails closed');
select is((select filter_resolution_status::text from public.rooms
    where id='05110000-0000-4000-a000-000000000003'),'compatible',
  'integrity failure cannot reverse terminal status');

rollback;

-- Deterministic concurrent resolver trials use independent authenticated
-- READ COMMITTED backends. The controller owns no application-row locks.
\connect -reuse-previous=on "user=supabase_admin"
begin;
set local statement_timeout='60s';
create extension if not exists dblink with schema extensions;
do $restrict$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_depend d on d.objid=p.oid
    where d.classid='pg_proc'::regclass and d.refclassid='pg_extension'::regclass
      and d.refobjid=(select oid from pg_extension where extname='dblink') and d.deptype='e'
  loop execute format('revoke all on function %s from public,anon,authenticated',f);end loop;
end;
$restrict$;
create function pg_temp.require(condition boolean,message text) returns void language plpgsql as $f$
begin if not coalesce(condition,false) then raise exception using message=message;end if;end;
$f$;
create function pg_temp.remote_json(connection text,query text) returns jsonb language plpgsql as $f$
declare result jsonb;begin select j into strict result from extensions.dblink(connection,query)t(j jsonb);return result;end;
$f$;
create function pg_temp.await_ready(connection text) returns void language plpgsql as $f$
declare deadline timestamptz:=clock_timestamp()+interval '8s';begin while extensions.dblink_is_busy(connection)=1 loop
  if clock_timestamp()>deadline then raise exception 'resolution async deadline';end if;end loop;end;
$f$;
create function pg_temp.collect(connection text) returns jsonb language plpgsql as $f$
declare result jsonb;begin perform pg_temp.await_ready(connection);
  select j into strict result from extensions.dblink_get_result(connection)t(j jsonb);
  perform j from extensions.dblink_get_result(connection)t(j jsonb);return result;end;
$f$;
create function pg_temp.caller(connection text,subject uuid) returns void language plpgsql as $f$
declare identity jsonb;begin
  perform extensions.dblink_exec(connection,'set role authenticated;begin isolation level read committed');
  perform pg_temp.remote_json(connection,format('select to_jsonb(set_config(''request.jwt.claims'',%L,false))',
    jsonb_build_object('sub',subject,'role','authenticated')::text));
  identity:=pg_temp.remote_json(connection,
    'select jsonb_build_object(''role'',current_user,''uid'',auth.uid(),''isolation'',current_setting(''transaction_isolation''))');
  perform pg_temp.require(identity=jsonb_build_object('role','authenticated','uid',subject,'isolation','read committed'),
    'independent authenticated READ COMMITTED resolver caller required');
end;
$f$;

create function pg_temp.resolution_trial(kind text) returns setof text language plpgsql as $trial$
declare
  ns text:='resolution_'||kind||'_'||encode(extensions.gen_random_bytes(4),'hex');
  own text; a text; b text; conninfo text:='dbname=postgres user=postgres connect_timeout=3';
  u1 uuid:=extensions.gen_random_uuid();u2 uuid:=extensions.gen_random_uuid();u3 uuid:=extensions.gen_random_uuid();
  rid uuid:=extensions.gen_random_uuid();other_rid uuid:=extensions.gen_random_uuid();
  m1 uuid:=extensions.gen_random_uuid();m2 uuid:=extensions.gen_random_uuid();om1 uuid:=extensions.gen_random_uuid();om2 uuid:=extensions.gen_random_uuid();
  code text:=upper(encode(extensions.gen_random_bytes(5),'hex'));other_code text:=upper(encode(extensions.gen_random_bytes(5),'hex'));
  apid integer;bpid integer;opid integer;ra jsonb;rb jsonb;deadline timestamptz;failure text;name text;
  room_stats text:='select to_jsonb(coalesce((select n_tup_upd from pg_stat_xact_user_tables where relid=''public.rooms''::regclass),0))';
  parent_stats text:='select to_jsonb(coalesce((select n_tup_ins from pg_stat_xact_user_tables where relid=''private.room_filter_resolutions''::regclass),0))';
  clause_stats text:='select to_jsonb(coalesce((select n_tup_ins from pg_stat_xact_user_tables where relid=''private.room_filter_resolution_genre_clauses''::regclass),0))';
  filter_stats text:='select to_jsonb(coalesce((select n_tup_ins+n_tup_upd+n_tup_del from pg_stat_xact_user_tables where relid=''public.participant_filters''::regclass),0))';
  ua integer;ub integer;pa integer;pb integer;ca integer;cb integer;fa integer;fb integer;
  filters_before jsonb;
begin
  own:=ns||'_owner';a:=ns||'_a';b:=ns||'_b';
  begin
    perform extensions.dblink_connect(own,conninfo);
    perform extensions.dblink_exec(own,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    perform extensions.dblink_exec(own,format(
      'insert into auth.users(id) values(%1$L),(%2$L),(%3$L);'
      'insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,filter_completed_count) values(%4$L,%5$L,%6$L,%1$L,2,2,2),(%7$L,%8$L,%9$L,%1$L,2,2,2);'
      'insert into public.room_members(id,room_id,user_id,is_voter) values(%10$L,%4$L,%1$L,true),(%11$L,%4$L,%2$L,true),(%12$L,%7$L,%1$L,true),(%13$L,%7$L,%3$L,true);'
      'insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to) values(%10$L,''{action}'',2000,2010),(%11$L,''{drama}'',%14$s,%15$s),(%12$L,''{}'',2000,2020),(%13$L,''{comedy}'',2005,2015)',
      u1,u2,u3,rid,code,extensions.gen_random_uuid(),other_rid,other_code,extensions.gen_random_uuid(),
      m1,m2,om1,om2,case when kind='incompatible' then 2011 else 2005 end,
      case when kind='incompatible' then 2020 else 2015 end));
    perform extensions.dblink_connect(a,conninfo);perform extensions.dblink_connect(b,conninfo);
    perform extensions.dblink_exec(a,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    perform extensions.dblink_exec(b,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    apid:=pg_temp.remote_json(a,'select to_jsonb(pg_backend_pid())')::integer;
    bpid:=pg_temp.remote_json(b,'select to_jsonb(pg_backend_pid())')::integer;
    opid:=pg_temp.remote_json(own,'select to_jsonb(pg_backend_pid())')::integer;
    perform pg_temp.require(apid<>bpid and apid<>opid and bpid<>opid,'three independent resolver backends');
    filters_before:=pg_temp.remote_json(own,format(
      'select to_jsonb(array_agg(to_jsonb(x) order by x.room_member_id)) from (select f.*,f.xmin::text row_xmin from public.participant_filters f join public.room_members m on m.id=f.room_member_id where m.room_id=%L)x',rid));
    perform pg_temp.caller(a,u1);perform pg_temp.caller(b,u3);
    perform extensions.dblink_exec(own,'begin');
    perform pg_temp.remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',rid));
    rb:=pg_temp.remote_json(b,format('select to_jsonb(x) from public.resolve_common_filters(%L)x',rid));
    perform pg_temp.require(rb->>'outcome'='not_found','foreign resolver masks access without joining room lock queue');
    perform extensions.dblink_exec(b,'commit');
    perform pg_temp.caller(b,u2);
    perform pg_temp.require(extensions.dblink_send_query(a,format(
      'select to_jsonb(x) from public.resolve_common_filters(%L)x',rid))=1,'first resolver dispatched');
    deadline:=clock_timestamp()+interval '8s';loop
      exit when extensions.dblink_is_busy(a)=1 and opid=any(pg_blocking_pids(apid));
      if clock_timestamp()>deadline then raise exception 'first resolver did not block on owner room lock';end if;end loop;
    perform pg_temp.require(exists(select 1 from pg_locks where pid=apid and not granted),
      'first resolver exposes ungranted room lock');
    perform pg_temp.require(extensions.dblink_send_query(b,format(
      'select to_jsonb(x) from public.resolve_common_filters(%L)x',rid))=1,'second resolver dispatched');
    perform extensions.dblink_exec(own,'commit');
    ra:=pg_temp.collect(a);ua:=pg_temp.remote_json(a,room_stats)::integer;
    pa:=pg_temp.remote_json(a,parent_stats)::integer;ca:=pg_temp.remote_json(a,clause_stats)::integer;
    fa:=pg_temp.remote_json(a,filter_stats)::integer;
    perform pg_temp.require(apid=any(pg_blocking_pids(bpid)),
      'second resolver blocks on first uncommitted resolver');
    perform extensions.dblink_exec(a,'commit');
    rb:=pg_temp.collect(b);ub:=pg_temp.remote_json(b,room_stats)::integer;
    pb:=pg_temp.remote_json(b,parent_stats)::integer;cb:=pg_temp.remote_json(b,clause_stats)::integer;
    fb:=pg_temp.remote_json(b,filter_stats)::integer;
    perform extensions.dblink_exec(b,'commit');
    perform pg_temp.require(ra->>'outcome'=kind and rb->>'outcome'=kind,
      'both concurrent callers converge on one terminal outcome');
    perform pg_temp.require(ua+ub=1 and pa+pb=case when kind='compatible' then 1 else 0 end
      and ca+cb=case when kind='compatible' then 2 else 0 end and fa+fb=0,
      'concurrent first attempts perform exactly one status/payload write set');
    perform pg_temp.require((pg_temp.remote_json(own,format(
      'select to_jsonb(count(*)) from private.room_filter_resolutions where room_id=%L',rid)))::integer=
      case when kind='compatible' then 1 else 0 end,'terminal parent cardinality is exact');
    perform pg_temp.require(filters_before=pg_temp.remote_json(own,format(
      'select to_jsonb(array_agg(to_jsonb(x) order by x.room_member_id)) from (select f.*,f.xmin::text row_xmin from public.participant_filters f join public.room_members m on m.id=f.room_member_id where m.room_id=%L)x',rid)),
      'concurrent resolution leaves every frozen filter value and xmin exact');

    -- Unrelated room resolves while the first room is independently locked.
    perform extensions.dblink_exec(own,'begin');
    perform pg_temp.remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',rid));
    perform extensions.dblink_exec(a,'begin isolation level read committed');
    ra:=pg_temp.remote_json(a,format('select to_jsonb(x) from public.resolve_common_filters(%L)x',other_rid));
    perform extensions.dblink_exec(a,'commit');
    perform pg_temp.require(ra->>'outcome'='compatible','unrelated room resolves without global lock');
    perform extensions.dblink_exec(own,'rollback');
  exception when others then failure:=left(sqlstate||': '||sqlerrm,220);
  end;
  foreach name in array array[a,b] loop begin
    if name=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      if extensions.dblink_is_busy(name)=1 then perform pg_cancel_backend(
        pg_temp.remote_json(own,format('select to_jsonb(pid) from pg_stat_activity where application_name=%L',name))::integer);end if;
      begin perform extensions.dblink_exec(name,'rollback');exception when others then null;end;
      perform extensions.dblink_disconnect(name);
    end if;
  exception when others then null;end;end loop;
  begin
    if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      begin perform extensions.dblink_exec(own,'rollback');exception when others then null;end;
      perform extensions.dblink_exec(own,format('delete from public.rooms where id in(%L,%L);delete from auth.users where id in(%L,%L,%L)',rid,other_rid,u1,u2,u3));
      perform extensions.dblink_disconnect(own);
    end if;
  exception when others then if failure is null then failure:=left(sqlstate||': cleanup '||sqlerrm,220);end if;end;
  return next case when failure is null then
      'ok '||(case when kind='compatible' then 72 else 73 end)::text||' - deterministic concurrent '||kind||' resolution'
    else 'not ok '||(case when kind='compatible' then 72 else 73 end)::text
      ||' - deterministic concurrent '||kind||' resolution # '||failure end;
end;
$trial$;

select * from pg_temp.resolution_trial('compatible');
select * from pg_temp.resolution_trial('incompatible');
select case when not exists(select 1 from pg_stat_activity where application_name like 'resolution_%')
  then 'ok 74 - all resolver dblink backends are cleaned'
  else 'not ok 74 - all resolver dblink backends are cleaned' end;
rollback;
