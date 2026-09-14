-- Feature 006 terminal candidate authority. Rollback-only fixtures use no GoTrue signup.
\connect -reuse-previous=on "user=supabase_admin"
begin;
set local search_path=pg_catalog,public,extensions;
set local statement_timeout='60s';
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_type('public','candidate_acquisition_status','candidate status enum exists');
select enum_has_labels('public','candidate_acquisition_status',array['pending','assigned','no_candidates'],
  'candidate status has exact closed labels');
select has_column('public','rooms','candidate_acquisition_status','rooms expose safe candidate status');
select has_column('public','rooms','tmdb_movie_id','rooms store TMDB identity');
select col_default_is('public','rooms','candidate_acquisition_status','pending'::public.candidate_acquisition_status,
  'candidate status defaults pending');
select col_type_is('public','rooms','tmdb_movie_id','bigint','TMDB identity is bigint');
select col_not_null('public','rooms','candidate_acquisition_status','candidate status is non-null');
select col_is_null('public','rooms','tmdb_movie_id','TMDB identity is nullable');
select has_check('public','rooms','candidate state checks exist');
select ok(not exists(select 1 from information_schema.columns where table_schema='public'
  and table_name='rooms' and column_name in('candidate_title','poster_url','acquiring','failed','lease_id')),
  'no descriptive or transient durable fields exist');
select ok(to_regclass('public.tmdb_movies') is null,'no synchronized public movie catalog exists');

select has_table('private','tmdb_movie_genres','private genre mapping exists');
select columns_are('private','tmdb_movie_genres',array['participant_genre','tmdb_genre_id'],
  'mapping has exact reference fields');
select is((select count(*) from private.tmdb_movie_genres),19::bigint,'mapping has exact 19 rows');
select results_eq($$select participant_genre::text,tmdb_genre_id from private.tmdb_movie_genres order by participant_genre$$,
$$values ('action',28),('adventure',12),('animation',16),('comedy',35),('crime',80),
('documentary',99),('drama',18),('family',10751),('fantasy',14),('history',36),('horror',27),
('music',10402),('mystery',9648),('romance',10749),('science_fiction',878),('thriller',53),
('tv_movie',10770),('war',10752),('western',37)$$,'mapping is canonical');
select ok((select relrowsecurity and pg_get_userbyid(relowner)='postgres' from pg_class
  where oid='private.tmdb_movie_genres'::regclass),'mapping is RLS-enabled and postgres-owned');
select is((select count(*) from pg_policy where polrelid='private.tmdb_movie_genres'::regclass),0::bigint,
  'mapping has no policies');

select has_function('public','prepare_room_tmdb_candidate',array['uuid','uuid'],'preflight exact signature');
select has_function('public','commit_room_tmdb_candidate',array['uuid','uuid','bigint','smallint','integer[]','boolean'],
  'assignment exact signature');
select has_function('public','commit_room_tmdb_no_candidates',array['uuid','uuid'],'empty exact signature');
select ok((select bool_and(pg_get_userbyid(proowner)='postgres' and prosecdef
  and proconfig=array['search_path=""']) from pg_proc where oid in(
  'public.prepare_room_tmdb_candidate(uuid,uuid)'::regprocedure,
  'public.commit_room_tmdb_candidate(uuid,uuid,bigint,smallint,integer[],boolean)'::regprocedure,
  'public.commit_room_tmdb_no_candidates(uuid,uuid)'::regprocedure)),
  'server candidate functions are postgres-owned hardened definers');
select ok((select bool_and(not has_function_privilege('anon',oid,'execute')
  and not has_function_privilege('authenticated',oid,'execute')
  and has_function_privilege('service_role',oid,'execute')) from pg_proc where oid in(
  'public.prepare_room_tmdb_candidate(uuid,uuid)'::regprocedure,
  'public.commit_room_tmdb_candidate(uuid,uuid,bigint,smallint,integer[],boolean)'::regprocedure,
  'public.commit_room_tmdb_no_candidates(uuid,uuid)'::regprocedure)),
  'only service role can execute candidate functions');
select ok(not has_table_privilege('authenticated','private.tmdb_movie_genres','select')
  and not has_column_privilege('authenticated','public.rooms','tmdb_movie_id','select')
  and has_column_privilege('authenticated','public.rooms','candidate_acquisition_status','select'),
  'ordinary clients see status but no mapping or identity');
select is((select count(*) from pg_publication_tables where pubname='supabase_realtime'),1::bigint,
  'Realtime still publishes one relation');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
  and schemaname='public' and tablename='rooms'),'rooms remain the sole Realtime relation');

create function pg_temp.call_as(role_name text,command text) returns jsonb language plpgsql as $f$
declare result jsonb;begin execute format('set local role %I',role_name);
  execute 'select to_jsonb(x) from ('||command||')x' into result;reset role;return result;
exception when others then reset role;raise;end;$f$;
create function pg_temp.sqlstate_as(role_name text,command text) returns text language plpgsql as $f$
declare result text;begin begin execute format('set local role %I',role_name);execute command;
exception when others then result:=sqlstate;end;reset role;return result;
exception when others then reset role;raise;end;$f$;

insert into auth.users(id) values
('66000000-0000-4000-a000-000000000001'),('66000000-0000-4000-a000-000000000002'),
('66000000-0000-4000-a000-000000000003');
insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,
 filter_completed_count,filter_resolution_status,movie_candidate_id,created_at,updated_at) values
('66100000-0000-4000-a000-000000000001','F600000001','66200000-0000-4000-a000-000000000001',
 '66000000-0000-4000-a000-000000000001',2,2,2,'compatible','fixture-clockwork-orchard','2026-01-01','2026-01-01'),
('66100000-0000-4000-a000-000000000002','F600000002','66200000-0000-4000-a000-000000000002',
 '66000000-0000-4000-a000-000000000001',2,2,2,'compatible',null,'2026-01-01','2026-01-01'),
('66100000-0000-4000-a000-000000000003','F600000003','66200000-0000-4000-a000-000000000003',
 '66000000-0000-4000-a000-000000000001',2,2,2,'incompatible',null,'2026-01-01','2026-01-01'),
('66100000-0000-4000-a000-000000000004','F600000004','66200000-0000-4000-a000-000000000004',
 '66000000-0000-4000-a000-000000000001',2,2,2,'compatible',null,'2026-01-01','2026-01-01'),
('66100000-0000-4000-a000-000000000005','F600000005','66200000-0000-4000-a000-000000000005',
 '66000000-0000-4000-a000-000000000001',2,2,2,'compatible',null,'2026-01-01','2026-01-01');
insert into public.room_members(id,room_id,user_id,is_voter) values
('66300000-0000-4000-a000-000000000001','66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001',true),
('66300000-0000-4000-a000-000000000002','66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000002',true),
('66300000-0000-4000-a000-000000000003','66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000001',true),
('66300000-0000-4000-a000-000000000004','66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000002',true),
('66300000-0000-4000-a000-000000000005','66100000-0000-4000-a000-000000000003','66000000-0000-4000-a000-000000000001',true),
('66300000-0000-4000-a000-000000000006','66100000-0000-4000-a000-000000000003','66000000-0000-4000-a000-000000000002',true);
insert into public.room_members(id,room_id,user_id,is_voter) values
('66300000-0000-4000-a000-000000000007','66100000-0000-4000-a000-000000000004','66000000-0000-4000-a000-000000000001',true),
('66300000-0000-4000-a000-000000000008','66100000-0000-4000-a000-000000000004','66000000-0000-4000-a000-000000000002',true),
('66300000-0000-4000-a000-000000000009','66100000-0000-4000-a000-000000000005','66000000-0000-4000-a000-000000000001',true),
('66300000-0000-4000-a000-000000000010','66100000-0000-4000-a000-000000000005','66000000-0000-4000-a000-000000000002',true);
insert into private.room_filter_resolutions values
('66100000-0000-4000-a000-000000000001',2000,2010),
('66100000-0000-4000-a000-000000000002',2000,2010),
('66100000-0000-4000-a000-000000000004',2000,2010),
('66100000-0000-4000-a000-000000000005',2000,2010);
insert into private.room_filter_resolution_genre_clauses values
('66100000-0000-4000-a000-000000000001',1,'{action,science_fiction}'),
('66100000-0000-4000-a000-000000000001',2,'{drama,thriller}'),
('66100000-0000-4000-a000-000000000001',3,'{drama,thriller}'),
('66100000-0000-4000-a000-000000000002',1,'{action}');
insert into private.room_filter_resolution_genre_clauses values
('66100000-0000-4000-a000-000000000005',2,'{action}');

select is((pg_temp.call_as('service_role',$$select * from public.prepare_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001')$$)->>'outcome'),
'acquire','compatible coherent room exposes private acquire only to server');
select is((select count(*) from jsonb_array_elements(pg_temp.call_as('service_role',$$select * from
 public.prepare_room_tmdb_candidate('66100000-0000-4000-a000-000000000001',
 '66000000-0000-4000-a000-000000000001')$$)->'genre_clauses_tmdb_ids')),3::bigint,
 'duplicate clauses remain represented');
select is((pg_temp.call_as('service_role',$$select * from public.prepare_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000003','66000000-0000-4000-a000-000000000001')$$)->>'outcome'),
'not_ready','incompatible has no acquisition payload');
select is((pg_temp.call_as('service_role',$$select * from public.prepare_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000003')$$)->>'outcome'),
'not_found','foreign actor is masked');
select is((pg_temp.call_as('service_role',$$select * from public.prepare_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000005','66000000-0000-4000-a000-000000000001')$$)->>'outcome'),
'not_ready','noncontiguous private clause payload fails closed');
select is(pg_temp.sqlstate_as('authenticated',$$select * from public.prepare_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001')$$),'42501',
'ordinary caller denied at ACL');

create temporary table before_sources as select r.id,r.movie_candidate_id,r.updated_at,r.xmin::text row_xmin
 from public.rooms r order by id;
select is((pg_temp.call_as('service_role',$$select * from public.commit_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000001',101::bigint,2000::smallint,
'{18,28}'::integer[],false)$$)->>'tmdb_movie_id')::bigint,101::bigint,'inclusive lower year and AND-of-OR commit');
select results_eq($$select candidate_acquisition_status::text,tmdb_movie_id,movie_candidate_id from public.rooms
 where id='66100000-0000-4000-a000-000000000001'$$,
 $$values ('assigned'::text,101::bigint,'fixture-clockwork-orchard'::text)$$,
 'TMDB assignment is separate from preserved legacy fixture');
create temporary table assigned_once as select updated_at,xmin::text row_xmin from public.rooms
 where id='66100000-0000-4000-a000-000000000001';
select is((pg_temp.call_as('service_role',$$select * from public.commit_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000002',999::bigint,(-1)::smallint,
null::integer[],true)$$)->>'tmdb_movie_id')::bigint,101::bigint,'losing invalid proposal adopts terminal winner before validation');
select results_eq($$select updated_at,xmin::text from public.rooms where id='66100000-0000-4000-a000-000000000001'$$,
 $$select updated_at,row_xmin from assigned_once$$,'repeat/loser performs zero rewrite');
select is((pg_temp.call_as('service_role',$$select * from public.prepare_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000001','66000000-0000-4000-a000-000000000002')$$)->>'tmdb_movie_id')::bigint,
101::bigint,'committed-response loss recovers same winner');

select is(pg_temp.sqlstate_as('service_role',$$select * from public.commit_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000001',102::bigint,1999::smallint,'{28}'::integer[],false)$$),
'22023','below lower year rejected');
select is(pg_temp.sqlstate_as('service_role',$$select * from public.commit_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000001',102::bigint,2011::smallint,'{28}'::integer[],false)$$),
'22023','above upper year rejected');
select is(pg_temp.sqlstate_as('service_role',$$select * from public.commit_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000001',102::bigint,2005::smallint,'{18}'::integer[],false)$$),
'22023','missing required clause rejected');
select is(pg_temp.sqlstate_as('service_role',$$select * from public.commit_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000001',102::bigint,2005::smallint,'{28}'::integer[],true)$$),
'22023','adult movie rejected');
select is(pg_temp.sqlstate_as('service_role',$$select * from public.commit_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000001',0::bigint,2005::smallint,'{28}'::integer[],false)$$),
'22023','nonpositive identity rejected');
select is((select candidate_acquisition_status::text from public.rooms where id='66100000-0000-4000-a000-000000000002'),
'pending','all rejected proposals roll back and remain pending');
select is((pg_temp.call_as('service_role',$$select * from public.commit_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000004','66000000-0000-4000-a000-000000000001',104::bigint,2010::smallint,
'{}'::integer[],false)$$)->>'tmdb_movie_id')::bigint,104::bigint,
'all-Any zero-clause room accepts empty genres at inclusive upper year');
select is((pg_temp.call_as('service_role',$$select * from public.commit_room_tmdb_no_candidates(
'66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000002')$$)->>'outcome'),
'no_candidates','completed-empty trusted CAS reaches terminal');
select results_eq($$select candidate_acquisition_status::text,tmdb_movie_id from public.rooms
 where id='66100000-0000-4000-a000-000000000002'$$,$$values ('no_candidates'::text,null::bigint)$$,
'empty terminal has no identity');
select is((pg_temp.call_as('service_role',$$select * from public.commit_room_tmdb_candidate(
'66100000-0000-4000-a000-000000000002','66000000-0000-4000-a000-000000000002',222::bigint,2005::smallint,
'{28}'::integer[],false)$$)->>'outcome'),'no_candidates','candidate cannot reverse empty winner');
select ok((select prosrc!~*'for[[:space:]]+update|update[[:space:]]+public\.rooms'
 from pg_proc where oid='public.prepare_room_tmdb_candidate(uuid,uuid)'::regprocedure),
 'preflight retains no room lock for the external HTTP interval');
select results_eq($$select id,title,release_year,poster_key,sort_order from public.movie_candidates order by sort_order$$,
$$values ('fixture-cardboard-comet', 'The Cardboard Comet',2020::smallint,'cardboard-comet',10),
('fixture-pebble-bay-lanterns','Lanterns of Pebble Bay',2021::smallint,'pebble-bay-lanterns',20),
('fixture-cloud-tram-four','Cloud Tram Number Four',2022::smallint,'cloud-tram-four',30),
('fixture-clockwork-orchard','The Clockwork Orchard',2023::smallint,'clockwork-orchard',40)$$,
'all four historical fixtures remain unchanged infrastructure');
select ok(not has_function_privilege('authenticated','public.ensure_room_candidate(uuid)'::regprocedure,'execute'),
'legacy fixture RPC remains revoked');

-- Deterministic READ COMMITTED terminal races. The owner-held row lock is the
-- barrier; the first caller stays uncommitted so the second must wait for it.
create extension if not exists dblink with schema extensions;
create function pg_temp.remote_json(c text,q text) returns jsonb language plpgsql as $f$
declare result jsonb;begin select j into strict result from extensions.dblink(c,q)t(j jsonb);return result;end;$f$;
create function pg_temp.await(c text) returns jsonb language plpgsql as $f$
declare result jsonb;deadline timestamptz:=clock_timestamp()+interval '8s';begin
 while extensions.dblink_is_busy(c)=1 loop if clock_timestamp()>deadline then raise exception 'race deadline';end if;end loop;
 select j into strict result from extensions.dblink_get_result(c)t(j jsonb);
 perform j from extensions.dblink_get_result(c)t(j jsonb);return result;end;$f$;
create function pg_temp.candidate_race(kind text) returns boolean language plpgsql as $f$
declare suffix text:=substr(md5(random()::text),1,8);own text:='f6o'||suffix;a text:='f6a'||suffix;b text:='f6b'||suffix;
 conn text:='dbname=postgres user=postgres connect_timeout=3';u1 uuid:=gen_random_uuid();u2 uuid:=gen_random_uuid();
 rid uuid:=gen_random_uuid();req uuid:=gen_random_uuid();code text:=upper(encode(gen_random_bytes(5),'hex'));
 apid integer;opid integer;bpid integer;ra jsonb;rb jsonb;before_xmin text;ua integer;ub integer;ok boolean:=false;
begin
 perform extensions.dblink_connect(own,conn);perform extensions.dblink_connect(a,conn);perform extensions.dblink_connect(b,conn);
 perform extensions.dblink_exec(own,format($q$insert into auth.users(id)values(%L),(%L);
 insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,filter_completed_count,filter_resolution_status)
 values(%L,%L,%L,%L,2,2,2,'compatible');
 insert into public.room_members(room_id,user_id,is_voter)values(%L,%L,true),(%L,%L,true);
 insert into private.room_filter_resolutions values(%L,2000,2010);
 insert into private.room_filter_resolution_genre_clauses values(%L,1,'{action}')$q$,
 u1,u2,rid,code,req,u1,rid,u1,rid,u2,rid,rid));
 before_xmin:=pg_temp.remote_json(own,format('select to_jsonb(xmin::text) from public.rooms where id=%L',rid))#>>'{}';
 perform extensions.dblink_exec(a,'set role service_role;begin isolation level read committed');
 perform extensions.dblink_exec(b,'set role service_role;begin isolation level read committed');
 apid:=(pg_temp.remote_json(a,'select to_jsonb(pg_backend_pid())'))::integer;
 bpid:=(pg_temp.remote_json(b,'select to_jsonb(pg_backend_pid())'))::integer;
 opid:=(pg_temp.remote_json(own,'select to_jsonb(pg_backend_pid())'))::integer;
 perform extensions.dblink_exec(own,'begin');
 perform pg_temp.remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',rid));
 perform extensions.dblink_send_query(a,format($q$select to_jsonb(x) from public.commit_room_tmdb_candidate(
 %L,%L,301::bigint,2005::smallint,'{28}'::integer[],false)x$q$,rid,u1));
 while not(opid=any(pg_blocking_pids(apid))) loop perform pg_sleep(0.01);end loop;
 perform extensions.dblink_send_query(b,case when kind='candidate' then format($q$select to_jsonb(x) from
 public.commit_room_tmdb_candidate(%L,%L,302::bigint,2005::smallint,'{28}'::integer[],false)x$q$,rid,u2)
 else format('select to_jsonb(x) from public.commit_room_tmdb_no_candidates(%L,%L)x',rid,u2) end);
 perform extensions.dblink_exec(own,'commit');ra:=pg_temp.await(a);
 ua:=(pg_temp.remote_json(a,$q$select to_jsonb(coalesce((select n_tup_upd from pg_stat_xact_user_tables
 where relid='public.rooms'::regclass),0))$q$))::integer;
 perform extensions.dblink_exec(a,'commit');rb:=pg_temp.await(b);
 ub:=(pg_temp.remote_json(b,$q$select to_jsonb(coalesce((select n_tup_upd from pg_stat_xact_user_tables
 where relid='public.rooms'::regclass),0))$q$))::integer;
 perform extensions.dblink_exec(b,'commit');
 ok:=ra=jsonb_build_object('outcome','assigned','tmdb_movie_id',301)
   and rb=ra and ua=1 and ub=0
   and pg_temp.remote_json(own,format($q$select jsonb_build_object('status',candidate_acquisition_status,
    'id',tmdb_movie_id,'changed',xmin::text<>%L) from public.rooms where id=%L$q$,before_xmin,rid))
     =jsonb_build_object('status','assigned','id',301,'changed',true);
 if not ok then raise notice 'race check kind=% first=% second=% writes=%/%',kind,ra,rb,ua,ub;end if;
 perform extensions.dblink_exec(own,format('delete from public.rooms where id=%L;delete from auth.users where id in(%L,%L)',rid,u1,u2));
 perform extensions.dblink_disconnect(a);perform extensions.dblink_disconnect(b);perform extensions.dblink_disconnect(own);
 return ok;
exception when others then
 raise notice 'race exception class=% message=%',sqlstate,left(sqlerrm,100);
 foreach suffix in array array[a,b,own] loop begin if suffix=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
  begin perform extensions.dblink_exec(suffix,'rollback');exception when others then null;end;
  if suffix=own then begin perform extensions.dblink_exec(suffix,format(
    'delete from public.rooms where id=%L;delete from auth.users where id in(%L,%L)',rid,u1,u2));
    exception when others then null;end;end if;
  perform extensions.dblink_disconnect(suffix);end if;exception when others then null;end;end loop;return false;
end;$f$;
select ok(pg_temp.candidate_race('candidate'),'dblink candidate/candidate first terminal writes once; loser adopts winner');
select ok(pg_temp.candidate_race('empty'),'dblink candidate/empty first terminal writes once; loser adopts winner');
select ok(not exists(select 1 from pg_stat_activity where application_name like 'f6%'),
 'all Feature 006 dblink race sessions are drained');

select * from finish();
rollback;
