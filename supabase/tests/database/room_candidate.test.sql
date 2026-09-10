-- Feature 002 Phases 2/3: schema, candidate RPC, security and real-session races.
-- UUID-only SQL fixtures consume no GoTrue signups. Controller fixtures/DDL roll
-- back; committed race fixtures have bounded owner cleanup on every exit.
-- Reuse the local CLI connection; never embed or print a password.
\connect -reuse-previous=on "user=supabase_admin"
begin;
set local search_path = pg_catalog, public, extensions;
set local statement_timeout = '15s';
set local lock_timeout = '5s';
create extension if not exists pgtap with schema extensions;
select no_plan();

-- T013: inspect the deployed function, independently of table RLS and role calls.
select has_function('public','ensure_room_candidate',array['uuid'],'candidate RPC exists with UUID input');
select results_eq(
  $$select p.proname::text collate "default",p.pronargs::integer,p.pronargdefaults::integer,
      p.proargnames collate "default",p.proargmodes,p.proallargtypes::regtype[]::text collate "default",
      p.proretset,p.prorettype::regtype::text collate "default"
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='ensure_room_candidate'$$,
  $$values ('ensure_room_candidate'::text,1,0,
    array['p_room_id','outcome','candidate_id','title','release_year','poster_key'],
    array['i','t','t','t','t','t']::"char"[],'{uuid,text,text,text,smallint,text}'::text,true,'record'::text)$$,
  'one input without default/identity argument, no overload, exact five ordered TABLE outputs'
);
select results_eq(
  $$select prosecdef,pg_get_userbyid(proowner)::text collate "default",proconfig collate "default",
      (select lanname::text collate "default" from pg_language where oid=prolang)
    from pg_proc where oid=to_regprocedure('public.ensure_room_candidate(uuid)')$$,
  $$values (true,'postgres'::text,array['search_path=""'],'plpgsql'::text)$$,
  'postgres-owned SECURITY DEFINER has only empty pinned search_path'
);
select results_eq(
  $$select a.grantee::regrole::text collate "default",a.privilege_type collate "default",a.is_grantable
    from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.oid=to_regprocedure('public.ensure_room_candidate(uuid)') order by 1,2$$,
  $$values ('authenticated'::text,'EXECUTE'::text,false),('postgres','EXECUTE',false)$$,
  'exact function ACL: only owner and authenticated EXECUTE; PUBLIC/anon absent'
);
select is(has_function_privilege('anon',to_regprocedure('public.ensure_room_candidate(uuid)'),'EXECUTE'),
  false,'anon has no effective EXECUTE');
select is(has_function_privilege('authenticated',to_regprocedure('public.ensure_room_candidate(uuid)'),'EXECUTE'),
  true,'authenticated has effective EXECUTE');
select ok((select prosrc !~* '\mexecute\M' and prosrc ~ 'auth.uid\(\)'
    and prosrc ~ 'public.rooms' and prosrc ~ 'public.movie_candidates'
    and prosrc ~* 'for update' and prosrc ~ 'pg_catalog.transaction_timestamp\(\)'
    and prosrc !~* 'pg_advisory|random|fixture-cardboard-comet|otteroom.test'
    from pg_proc where oid=to_regprocedure('public.ensure_room_candidate(uuid)')),
  'supplemental fixed qualified SQL/row-lock audit: no dynamic SQL, production test hook or hard-coded selection'
);
select results_eq(
  $$select proname::text collate "default" from pg_proc
    where pronamespace='public'::regnamespace order by proname$$,
  $$values ('create_room'::text),('ensure_room_candidate'),('join_room')$$,
  'exactly one new public application RPC, no public helper'
);

-- T015/T016: same local-only dblink controller/ACL conventions as room_session.
-- These independently committed trials precede all controller room/catalog locks.
create extension if not exists dblink with schema extensions;
do $restrict$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_depend d on d.objid=p.oid
    where d.classid='pg_proc'::regclass and d.refclassid='pg_extension'::regclass
      and d.refobjid=(select oid from pg_extension where extname='dblink') and d.deptype='e'
  loop execute format('revoke all on function %s from public, anon, authenticated',f); end loop;
end;
$restrict$;
select ok(not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0),
  'test-only dblink entry denied to PUBLIC and clients: ' || p.proname)
from pg_proc p join pg_depend d on d.objid=p.oid
where d.classid='pg_proc'::regclass and d.refclassid='pg_extension'::regclass
  and d.refobjid=(select oid from pg_extension where extname='dblink') and d.deptype='e';

create function pg_temp.require(condition boolean, message text) returns void language plpgsql as $helper$
begin
  if not coalesce(condition, false) then raise exception using message = message; end if;
end;
$helper$;

create function pg_temp.remote_json(connection text, query text) returns jsonb language plpgsql as $helper$
declare result jsonb;
begin
  select j into strict result from extensions.dblink(connection, query) as t(j jsonb);
  return result;
end;
$helper$;

create function pg_temp.await_ready(connection text) returns void language plpgsql as $helper$
declare deadline timestamptz := clock_timestamp() + interval '8 seconds';
begin
  while extensions.dblink_is_busy(connection) = 1 loop
    if clock_timestamp() > deadline then raise exception 'async result deadline exceeded'; end if;
  end loop;
end;
$helper$;

create function pg_temp.collect(connection text) returns jsonb language plpgsql as $helper$
declare result jsonb;
begin
  perform pg_temp.await_ready(connection);
  select j into strict result from extensions.dblink_get_result(connection) as t(j jsonb);
  -- libpq requires draining the terminal empty result before another command.
  perform j from extensions.dblink_get_result(connection) as t(j jsonb);
  return result;
end;
$helper$;

create function pg_temp.caller(connection text, subject uuid) returns void language plpgsql as $helper$
declare identity jsonb;
begin
  perform extensions.dblink_exec(connection, 'set role authenticated; begin isolation level read committed');
  perform pg_temp.remote_json(connection, format(
    'select to_jsonb(set_config(''request.jwt.claims'', %L, false))',
    jsonb_build_object('sub', subject, 'role', 'authenticated')::text));
  identity := pg_temp.remote_json(connection,
    'select jsonb_build_object(''role'', current_user, ''uid'', auth.uid(), ''isolation'', current_setting(''transaction_isolation''))');
  perform pg_temp.require(identity = jsonb_build_object('role','authenticated','uid',subject,'isolation','read committed'),
    'remote RPC caller must be claimed authenticated at READ COMMITTED');
end;
$helper$;


create function pg_temp.candidate_race(cancel_probe boolean default false, creator_votes boolean default true)
returns setof text language plpgsql as $trial$
declare
  ns text := 'candidate_' || encode(extensions.gen_random_bytes(8),'hex');
  own text := ns || '_owner'; a text := ns || '_a'; b text := ns || '_b';
  conninfo text := 'dbname=postgres user=postgres connect_timeout=3';
  h uuid := extensions.gen_random_uuid(); g uuid := extensions.gen_random_uuid();
  extra_a uuid := extensions.gen_random_uuid(); extra_b uuid := extensions.gen_random_uuid();
  members_before jsonb;
  rid uuid := extensions.gen_random_uuid(); request uuid := extensions.gen_random_uuid();
  code text := upper(encode(extensions.gen_random_bytes(5),'hex'));
  apid integer; bpid integer; opid integer; winner_pid integer; loser_pid integer;
  winner text; loser text; name text; round integer; updates_a integer; updates_b integer;
  baseline_a integer; baseline_b integer;
  initial jsonb; expected jsonb; first_commit jsonb; final_row jsonb;
  ra jsonb; rb jsonb; catalog_before jsonb; stamp_query text; count_query text;
  deadline timestamptz; failure text; failure_state text; cleanup_failure text;
  canceled boolean := false; cleanup_ok boolean := false;
  evidence text[] := array[]::text[];
  label text;
begin
  begin
    perform extensions.dblink_connect(own,conninfo);
    perform extensions.dblink_exec(own,'set statement_timeout=''10s''; set lock_timeout=''5s''');
    opid := pg_temp.remote_json(own,'select to_jsonb(pg_backend_pid())')::integer;
    -- Three voter slots; both creator modes use coherent committed member rows.
    perform extensions.dblink_exec(own,format(
      'begin; insert into auth.users(id) values (%1$L),(%2$L),(%3$L),(%4$L);
       insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,created_at,updated_at)
       values (%5$L,%6$L,%7$L,%1$L,3,3,''2020-01-01 UTC'',''2020-01-02 UTC'');
       insert into public.room_members(room_id,user_id,is_voter) values
         (%5$L,%1$L,%8$L),(%5$L,%2$L,true),(%5$L,%3$L,true);
       insert into public.room_members(room_id,user_id,is_voter)
         select %5$L,%4$L,true where not %8$L::boolean; commit',
      h,g,extra_a,extra_b,rid,code,request,creator_votes));
    members_before:=pg_temp.remote_json(own,format('select jsonb_agg(to_jsonb(m) order by id) from public.room_members m where room_id=%L',rid));
    stamp_query := format(
      'select jsonb_build_object(''row'',to_jsonb(r),''xmin'',r.xmin::text) from public.rooms r where id=%L',rid);
    count_query := 'select to_jsonb(coalesce((select n_tup_upd from pg_stat_xact_user_tables where relid=''public.rooms''::regclass),0))';
    initial := pg_temp.remote_json(own,stamp_query);
    perform pg_temp.require(initial->'row'->>'state'='ready' and initial->'row'->>'movie_candidate_id' is null,
      'race must start with committed Ready/NULL');
    catalog_before := pg_temp.remote_json(own,'select jsonb_agg(to_jsonb(c) order by sort_order) from public.movie_candidates c');
    expected := pg_temp.remote_json(own,
      'select jsonb_build_object(''outcome'',''available'',''candidate_id'',id,''title'',title,
       ''release_year'',release_year,''poster_key'',poster_key) from public.movie_candidates order by sort_order limit 1');
    perform pg_temp.require(jsonb_array_length(catalog_before)=4
      and expected->>'candidate_id'='fixture-cardboard-comet','approved four-row catalog and minimum required');

    perform extensions.dblink_connect(a,conninfo);
    perform extensions.dblink_connect(b,conninfo);
    foreach name in array array[a,b] loop
      perform extensions.dblink_exec(name,'set statement_timeout=''20s''; set lock_timeout=''15s''');
    end loop;
    apid := pg_temp.remote_json(a,'select to_jsonb(pg_backend_pid())')::integer;
    bpid := pg_temp.remote_json(b,'select to_jsonb(pg_backend_pid())')::integer;
    perform pg_temp.require(apid<>bpid and apid<>opid and bpid<>opid,'independent participant and owner backend PIDs');
    evidence := array_append(evidence,'independent creator/voter/owner backend PIDs and committed Ready/NULL fixture');

    -- First acquisition, then overlapping repeat access to the same assignment.
    for round in 1..2 loop
      label := case when round=1 then 'first acquisition' else 'overlapping repeat' end;
      perform pg_temp.caller(a,h);
      perform pg_temp.caller(b,g);
      -- Reused backends can retain unflushed counts from their prior transaction.
      -- Compare before/after within this same open transaction, before COMMIT.
      baseline_a:=pg_temp.remote_json(a,count_query)::integer;
      baseline_b:=pg_temp.remote_json(b,count_query)::integer;
      evidence := array_append(evidence,label || ': both authenticated roles, actual creator/voter auth.uid(), READ COMMITTED');

      perform extensions.dblink_exec(own,'begin');
      perform pg_temp.remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',rid));
      perform pg_temp.require(extensions.dblink_send_query(a,
        format('select to_jsonb(r) from public.ensure_room_candidate(%L) r',rid))=1,'real host RPC dispatched');
      perform pg_temp.require(extensions.dblink_send_query(b,
        format('select to_jsonb(r) from public.ensure_room_candidate(%L) r',rid))=1,'real guest RPC dispatched');
      deadline := clock_timestamp()+interval '8 seconds';
      loop
        exit when cardinality(pg_blocking_pids(apid))>0 and cardinality(pg_blocking_pids(bpid))>0
          and (opid=any(pg_blocking_pids(apid)) or bpid=any(pg_blocking_pids(apid)))
          and (opid=any(pg_blocking_pids(bpid)) or apid=any(pg_blocking_pids(bpid)))
          and (opid=any(pg_blocking_pids(apid)) or opid=any(pg_blocking_pids(bpid)))
          and exists(select 1 from pg_locks where pid=apid and not granted and locktype in ('tuple','transactionid'))
          and exists(select 1 from pg_locks where pid=bpid and not granted and locktype in ('tuple','transactionid'));
        if clock_timestamp()>deadline then raise exception 'both candidate RPCs must overlap in owner row-lock chain'; end if;
      end loop;
      perform pg_temp.require(extensions.dblink_is_busy(a)=1 and extensions.dblink_is_busy(b)=1,
        'both real RPC invocations outstanding at observed row-lock barrier');
      evidence := array_append(evidence,label || ': both RPCs outstanding and observably waiting in owner row-lock chain');

      if cancel_probe then
        canceled := pg_cancel_backend(apid);
        perform pg_temp.collect(a);
        raise exception 'blocked cancellation unexpectedly returned a business row';
      end if;

      perform extensions.dblink_exec(own,'commit');
      deadline := clock_timestamp()+interval '8 seconds';
      loop
        if extensions.dblink_is_busy(a)=0 then winner:=a; loser:=b; winner_pid:=apid; loser_pid:=bpid; exit; end if;
        if extensions.dblink_is_busy(b)=0 then winner:=b; loser:=a; winner_pid:=bpid; loser_pid:=apid; exit; end if;
        if clock_timestamp()>deadline then raise exception 'no candidate winner completed'; end if;
      end loop;
      -- The winner still owns its row lock: its RPC has returned, not committed.
      -- Prove a direct live wait on that caller before releasing its transaction.
      deadline := clock_timestamp()+interval '8 seconds';
      loop
        exit when winner_pid=any(pg_blocking_pids(loser_pid))
          and exists(select 1 from pg_locks where pid=loser_pid and not granted and locktype in ('tuple','transactionid'));
        if clock_timestamp()>deadline then raise exception 'second RPC never observed waiting on winner row lock'; end if;
      end loop;
      perform pg_temp.require(extensions.dblink_is_busy(loser)=1,'second RPC remains outstanding until winner commit');
      evidence := array_append(evidence,label || ': second RPC blocked directly by uncommitted winner on tuple/transaction lock');

      if winner=a then ra:=pg_temp.collect(a); else rb:=pg_temp.collect(b); end if;
      if winner=a then updates_a:=pg_temp.remote_json(a,count_query)::integer-baseline_a;
      else updates_b:=pg_temp.remote_json(b,count_query)::integer-baseline_b; end if;
      perform extensions.dblink_exec(winner,'commit');
      first_commit := pg_temp.remote_json(own,stamp_query);
      if loser=a then ra:=pg_temp.collect(a); else rb:=pg_temp.collect(b); end if;
      if loser=a then updates_a:=pg_temp.remote_json(a,count_query)::integer-baseline_a;
      else updates_b:=pg_temp.remote_json(b,count_query)::integer-baseline_b; end if;
      -- The second transaction has not committed at the snapshot above.
      perform extensions.dblink_exec(loser,'commit');
      final_row := pg_temp.remote_json(own,stamp_query);
      perform pg_temp.require(ra=expected and rb=expected,'both exact available rows match minimum-sort catalog metadata');
      perform pg_temp.require(final_row=first_commit,'second commit preserves winner whole row AND xmin');
      perform pg_temp.require(final_row->'row'->>'movie_candidate_id'=ra->>'candidate_id',
        'persisted FK matches both responses');
      perform pg_temp.require(((final_row->'row')-array['movie_candidate_id','updated_at'])=
        ((initial->'row')-array['movie_candidate_id','updated_at']),'all membership/state/identity/created fields preserved');
      if round=1 then
        perform pg_temp.require((case when winner=a then updates_a else updates_b end)=1
          and (case when loser=a then updates_a else updates_b end)=0,'winner exactly one room UPDATE; second caller exactly zero');
        perform pg_temp.require(first_commit->>'xmin'<>initial->>'xmin'
          and first_commit->'row'->>'updated_at'<>initial->'row'->>'updated_at','first assignment creates a new committed row version');
        evidence := array_append(evidence,label || ': transaction UPDATE counters winner=1, second=0; first xmin changes');
      else
        perform pg_temp.require(updates_a=0 and updates_b=0 and final_row=initial,'overlapping repeats issue zero UPDATEs and preserve original row/xmin');
        evidence := array_append(evidence,label || ': transaction UPDATE counters host=0, guest=0; established row/xmin unchanged');
      end if;
      evidence := array_append(evidence,label || ': identical five-field available results and persisted minimum-sort FK');
      evidence := array_append(evidence,label || ': winner snapshot taken before second commit; final whole row/xmin identical');
      evidence := array_append(evidence,label || ': creator/voter, Ready state, room identity and created_at preserved');
      perform pg_temp.require(pg_temp.remote_json(own,
        'select jsonb_agg(to_jsonb(c) order by sort_order) from public.movie_candidates c')=catalog_before,
        'all four catalog rows remain identical');
      perform pg_temp.require(pg_temp.remote_json(own,format(
        'select to_jsonb(count(*)) from public.rooms where creator_user_id in (%L,%L)',h,g))::integer=1,
        'exactly one trial room/assignment');
      evidence := array_append(evidence,label || ': exactly one persisted trial room; all four catalog rows unchanged');
      perform pg_temp.require(pg_temp.remote_json(own,format('select jsonb_agg(to_jsonb(m) order by id) from public.room_members m where room_id=%L',rid))=members_before,
        'all generalized members and immutable voting flags unchanged');
      perform pg_temp.require(pg_temp.remote_json(own,format('select to_jsonb(r.voter_count=(select count(*) from public.room_members m where m.room_id=r.id and m.is_voter)) from public.rooms r where id=%L',rid))::boolean,
        'room summary equals three voter rows after each candidate commit');
      initial:=final_row;
    end loop;
  exception when query_canceled or others then
    failure_state:=SQLSTATE;
    failure:=left(SQLSTATE || ': ' || SQLERRM,220);
  end;

  -- Same bounded, exact-connection cleanup discipline as Feature 001.
  foreach name in array array[a,b] loop
    begin
      if name=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
        if extensions.dblink_is_busy(name)=1 then
          perform extensions.dblink_cancel_query(name);
          begin perform pg_temp.await_ready(name); exception when query_canceled or others then
            perform pg_terminate_backend(case when name=a then apid else bpid end);
          end;
        end if;
        begin
          perform j from extensions.dblink_get_result(name,false) as t(j jsonb);
          perform j from extensions.dblink_get_result(name,false) as t(j jsonb);
          perform extensions.dblink_exec(name,'rollback');
        exception when query_canceled or others then
          perform pg_terminate_backend(case when name=a then apid else bpid end);
        end;
        perform extensions.dblink_disconnect(name);
      end if;
    exception when query_canceled or others then cleanup_failure:='candidate caller cleanup failed';
    end;
  end loop;
  begin
    if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      perform extensions.dblink_exec(own,'rollback');
      perform extensions.dblink_exec(own,format(
        'begin; delete from public.rooms where id=%L; delete from auth.users where id in (%L,%L,%L,%L); commit',rid,h,g,extra_a,extra_b));
      perform pg_temp.require(pg_temp.remote_json(own,format('select to_jsonb(count(*)) from public.rooms where id=%L',rid))::integer=0,'trial room removed');
      perform pg_temp.require(pg_temp.remote_json(own,format('select to_jsonb(count(*)) from auth.users where id in (%L,%L,%L,%L)',h,g,extra_a,extra_b))::integer=0,'both Auth fixtures removed');
      perform extensions.dblink_disconnect(own);
      cleanup_ok:=true;
    end if;
  exception when query_canceled or others then
    cleanup_failure:='candidate owner cleanup failed: ' || left(SQLSTATE || ': ' || SQLERRM,180);
    if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then perform extensions.dblink_disconnect(own); end if;
  end;
  deadline:=clock_timestamp()+interval '5 seconds';
  loop
    perform pg_stat_clear_snapshot();
    exit when not exists(select 1 from pg_stat_activity where pid in (apid,bpid,opid));
    if clock_timestamp()>deadline then cleanup_failure:='candidate backend remained'; exit; end if;
  end loop;
  if cancel_probe then
    return next ok(canceled and failure_state='57014','candidate cancellation: real blocked RPC canceled at observed barrier');
  else
    foreach label in array evidence loop return next ok(true,'candidate race: ' || label); end loop;
    return next ok(failure is null and cardinality(evidence)=17,'candidate race: both acquisition and repeat trials complete');
    if failure is not null then return next diag(failure); end if;
  end if;
  return next ok(cleanup_ok and cleanup_failure is null
    and not exists(select 1 from pg_stat_activity where pid in (apid,bpid,opid))
    and not (array[own,a,b] && coalesce(extensions.dblink_get_connections(),array[]::text[])),
    case when cancel_probe then 'candidate cancellation' else 'candidate race' end || ': exact connections, locks, committed room and Auth fixtures cleaned');
  if cleanup_failure is not null then return next diag(cleanup_failure); end if;
end;
$trial$;

set local statement_timeout='120s';
select * from pg_temp.candidate_race();
select * from pg_temp.candidate_race(false,false);
select * from pg_temp.candidate_race(true);
set local statement_timeout='15s';

-- T013/T014: rollback-only owner fixtures, before any catalog row is referenced.
insert into auth.users(id) values
  ('03000000-0000-4000-a000-000000000001'),
  ('03000000-0000-4000-a000-000000000002'),
  ('03000000-0000-4000-a000-000000000003'),
  ('03000000-0000-4000-a000-000000000004');
insert into public.rooms(id,code,creation_request_id,creator_user_id,voter_count,created_at,updated_at)
select ('03100000-0000-4000-a000-' || lpad(n::text,12,'0'))::uuid,
  'C30000000' || n,('03200000-0000-4000-a000-' || lpad(n::text,12,'0'))::uuid,
  (case when n<=3 then '03000000-0000-4000-a000-000000000001' else '03000000-0000-4000-a000-000000000003' end)::uuid,
  case when n in (1,4) then 1 else 2 end,'2020-01-01 UTC','2020-01-02 UTC'
from generate_series(1,6) n;
insert into public.room_members(room_id,user_id,is_voter) select id,creator_user_id,true from public.rooms;
insert into public.room_members(room_id,user_id,is_voter)
  select id,(case when code<='C300000003' then '03000000-0000-4000-a000-000000000002'
    else '03000000-0000-4000-a000-000000000004' end)::uuid,true from public.rooms where voter_count=2;
create temporary table candidate_members_before on commit drop as select * from public.room_members;

create temporary table candidate_rpc_before on commit drop as
  select to_jsonb(r) as rowdata,r.xmin::text as version,r.ctid::text as location from public.rooms r;
-- ctid supplements xmin within one SQL test transaction, where another UPDATE
-- can reuse the transaction ID. Independent committed races also compare xmin.
set local request.jwt.claim.sub='';
set local request.jwt.claims='{}';
set local role anon;
select is(current_user::text,'anon','RPC signed-out trial is actually anon');
select is(auth.uid(),null::uuid,'RPC signed-out trial has no subject');
select throws_ok($$select * from public.ensure_room_candidate(null)$$,'42501',null,
  'signed-out role cannot execute RPC at all');
set local request.jwt.claims='{"sub":"03000000-0000-4000-a000-000000000001","role":"authenticated"}';
select throws_ok($$select * from public.ensure_room_candidate('03100000-0000-4000-a000-000000000002')$$,
  '42501',null,'claims cannot bypass anon function EXECUTE denial');
set local role authenticated;
set local request.jwt.claims='{}';
select is(auth.uid(),null::uuid,'authenticated without subject has no inferred identity');
select throws_ok($$select * from public.ensure_room_candidate(null)$$,'42501','Authentication required',
  'independent body authentication guard precedes NULL room outcome');
select throws_ok($$select * from public.ensure_room_candidate('03100000-0000-4000-a000-000000000002')$$,
  '42501','Authentication required','missing subject cannot acquire an existing Ready candidate');
reset role;

-- Delete the catalog only inside an exception subtransaction, then call as host.
-- Even an unexpected successful response is rolled back and fails the assertion.
create function pg_temp.empty_candidate_trial() returns setof text language plpgsql as $trial$
declare
  before_rows jsonb; before_catalog jsonb; seen_empty boolean:=false; caller_ok boolean:=false;
  waiting_result jsonb; failure_state text; failure_message text;
begin
  select jsonb_agg(jsonb_build_object('row',to_jsonb(r),'xmin',r.xmin::text,'ctid',r.ctid::text) order by r.id)
    into before_rows from public.rooms r;
  select jsonb_agg(to_jsonb(c) order by sort_order) into before_catalog from public.movie_candidates c;
  begin
    delete from public.movie_candidates;
    select count(*)=0 into seen_empty from public.movie_candidates;
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"03000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
    caller_ok:=current_user='authenticated' and auth.uid()='03000000-0000-4000-a000-000000000001'::uuid;
    select jsonb_agg(to_jsonb(r)) into waiting_result
      from public.ensure_room_candidate('03100000-0000-4000-a000-000000000001') r;
    perform * from public.ensure_room_candidate('03100000-0000-4000-a000-000000000002');
    raise exception using errcode='ZX001',message='empty catalog unexpectedly returned a business row';
  exception when others then
    failure_state:=SQLSTATE; failure_message:=SQLERRM;
  end;
  return next ok(seen_empty and caller_ok,'empty catalog: zero rows and actual authenticated host established');
  return next is(waiting_result,
    '[{"outcome":"not_ready","candidate_id":null,"title":null,"release_year":null,"poster_key":null}]'::jsonb,
    'empty catalog: Waiting still returns exactly one not_ready with four NULLs');
  return next is(failure_state,'P0001','empty catalog: Ready raises an exception, never a normal outcome');
  return next is(failure_message,'Movie candidate catalog is empty','empty catalog: controlled exceptional configuration failure');
  return next is((select jsonb_agg(jsonb_build_object('row',to_jsonb(r),'xmin',r.xmin::text,'ctid',r.ctid::text) order by r.id)
    from public.rooms r),before_rows,'empty catalog: all room fields/versions preserved, Ready remains NULL');
  return next is((select jsonb_agg(to_jsonb(c) order by sort_order) from public.movie_candidates c),
    before_catalog,'empty catalog: every fixture restored by subtransaction rollback');
end;
$trial$;
select * from pg_temp.empty_candidate_trial();

-- Actual AFTER UPDATE fault; the sequence survives the failed subtransaction
-- to prove the assignment write was reached. All DDL is controller rollback-only.
create temporary sequence candidate_fault_updates;
grant usage,select on sequence pg_temp.candidate_fault_updates to postgres;
create function pg_temp.candidate_post_update_fault() returns trigger language plpgsql as $fault$
begin
  if new.id='03100000-0000-4000-a000-000000000002' then
    if old.movie_candidate_id is not null or new.movie_candidate_id is null then
      raise exception 'fault must observe the actual NULL-to-assigned UPDATE';
    end if;
    perform nextval('pg_temp.candidate_fault_updates');
    raise exception using errcode='P0001',message='controlled candidate post-update failure';
  end if;
  return new;
end;
$fault$;
create trigger candidate_post_update_fault after update of movie_candidate_id on public.rooms
  for each row execute function pg_temp.candidate_post_update_fault();
set local role authenticated;
set local request.jwt.claims='{"sub":"03000000-0000-4000-a000-000000000001","role":"authenticated"}';
select throws_ok($$select * from public.ensure_room_candidate('03100000-0000-4000-a000-000000000002')$$,
  'P0001','controlled candidate post-update failure','actual post-assignment exception returns no business row');
reset role;
drop trigger candidate_post_update_fault on public.rooms;
select ok((select is_called and last_value=1 from pg_temp.candidate_fault_updates),
  'post-update fault observed exactly one attempted assignment UPDATE');
select results_eq(
  $$select to_jsonb(r),r.xmin::text,r.ctid::text from public.rooms r order by r.id$$,
  $$select rowdata,version,location from pg_temp.candidate_rpc_before order by rowdata->>'id'$$,
  'auth/empty/post-UPDATE failures preserve every room field and physical version');

-- Existing non-lowest assignments are privileged setup only.
update public.rooms set movie_candidate_id='fixture-clockwork-orchard'
  where id in ('03100000-0000-4000-a000-000000000003','03100000-0000-4000-a000-000000000006');
truncate pg_temp.candidate_rpc_before;
insert into pg_temp.candidate_rpc_before
  select to_jsonb(r),r.xmin::text,r.ctid::text from public.rooms r;
set local role authenticated;
set local request.jwt.claims='{"sub":"03000000-0000-4000-a000-000000000001","role":"authenticated"}';
select is(current_user::text,'authenticated','business outcomes use real authenticated role');
select is(auth.uid(),'03000000-0000-4000-a000-000000000001'::uuid,'business outcomes use own creator subject only');
select results_eq($$select * from public.ensure_room_candidate('03100000-0000-4000-a000-000000000001')$$,
  $$values ('not_ready'::text,null::text,null::text,null::smallint,null::text)$$,
  'own Waiting returns exactly one row with four NULL candidate fields');
select results_eq(
  format('select * from public.ensure_room_candidate(%L::uuid)',room_id),
  $$values ('not_found'::text,null::text,null::text,null::smallint,null::text)$$,
  'non-disclosure: ' || label || ' returns the identical one-row/five-field not_found')
from (values
  (1,null::text,'NULL room input'),
  (2,'03100000-0000-4000-a000-000000000099','nonexistent room'),
  (3,'03100000-0000-4000-a000-000000000004','unrelated Waiting'),
  (4,'03100000-0000-4000-a000-000000000005','unrelated Ready/NULL'),
  (5,'03100000-0000-4000-a000-000000000006','unrelated Ready/assigned')
) cases(n,room_id,label) order by n;
select is((select jsonb_agg(to_jsonb(r)) from public.ensure_room_candidate('03100000-0000-4000-a000-000000000004') r),
  (select jsonb_agg(to_jsonb(r)) from public.ensure_room_candidate('03100000-0000-4000-a000-000000000099') r),
  'existing unrelated and absent results have identical keys, values, NULLs and cardinality');
reset role;
select results_eq(
  $$select to_jsonb(r),r.xmin::text,r.ctid::text from public.rooms r order by r.id$$,
  $$select rowdata,version,location from pg_temp.candidate_rpc_before order by rowdata->>'id'$$,
  'Waiting/denied outcomes do not UPDATE any row, assignment, timestamp or membership');

set local role authenticated;
set local request.jwt.claims='{"sub":"03000000-0000-4000-a000-000000000001","role":"authenticated"}';
create temporary table candidate_first_result on commit drop as
  select * from public.ensure_room_candidate('03100000-0000-4000-a000-000000000002');
select results_eq($$select * from pg_temp.candidate_first_result$$,
  $$values ('available'::text,'fixture-cardboard-comet'::text,'The Cardboard Comet'::text,2020::smallint,'cardboard-comet'::text)$$,
  'first Ready call (retry after rollback) returns one complete lowest-sort fixture');
select is((select array_agg(k order by k) from jsonb_object_keys((select to_jsonb(r) from pg_temp.candidate_first_result r)) k),
  array['candidate_id','outcome','poster_key','release_year','title'],
  'available projection contains exactly five approved keys, no membership or internal row metadata');
reset role;
select results_eq(
  $$select f.candidate_id,f.title,f.release_year,f.poster_key
    from pg_temp.candidate_first_result f$$,
  $$select id,title,release_year,poster_key from public.movie_candidates order by sort_order limit 1$$,
  'all returned fields belong to the same actual minimum-sort catalog row');
select ok((select r.movie_candidate_id=f.candidate_id and r.updated_at=transaction_timestamp()
    and (to_jsonb(r)-array['movie_candidate_id','updated_at'])=(b.rowdata-array['movie_candidate_id','updated_at'])
    from public.rooms r join pg_temp.candidate_rpc_before b on b.rowdata->>'id'=r.id::text
    cross join pg_temp.candidate_first_result f where r.id='03100000-0000-4000-a000-000000000002'),
  'first assignment changes only FK and transaction updated_at; Ready/membership/created_at unchanged');
truncate pg_temp.candidate_rpc_before;
insert into pg_temp.candidate_rpc_before select to_jsonb(r),r.xmin::text,r.ctid::text from public.rooms r;

set local role authenticated;
select results_eq($$select * from public.ensure_room_candidate('03100000-0000-4000-a000-000000000002')$$,
  $$select * from pg_temp.candidate_first_result$$,'host sequential repeat returns the identical full candidate');
set local request.jwt.claims='{"sub":"03000000-0000-4000-a000-000000000002","role":"authenticated"}';
select is(auth.uid(),'03000000-0000-4000-a000-000000000002'::uuid,'repeat uses actual voter subject');
select results_eq($$select * from public.ensure_room_candidate('03100000-0000-4000-a000-000000000002')$$,
  $$select * from pg_temp.candidate_first_result$$,'guest receives the same established candidate');
select results_eq($$select * from public.ensure_room_candidate('03100000-0000-4000-a000-000000000003')$$,
  $$values ('available'::text,'fixture-clockwork-orchard'::text,'The Clockwork Orchard'::text,2023::smallint,'clockwork-orchard'::text)$$,
  'existing non-lowest assignment is returned without reselection');
reset role;
select results_eq(
  $$select to_jsonb(r),r.xmin::text,r.ctid::text from public.rooms r order by r.id$$,
  $$select rowdata,version,location from pg_temp.candidate_rpc_before order by rowdata->>'id'$$,
  'creator/voter repeats and existing non-lowest read preserve all rows, timestamps, xmin and ctid: no second UPDATE');

-- The FK normally makes this branch unreachable. Only this rollback-scoped
-- owner fault removes it, proving broken integrity cannot rotate an assignment.
create function pg_temp.missing_candidate_trial() returns setof text language plpgsql as $trial$
declare
  before_catalog jsonb; missing boolean:=false; caller_ok boolean:=false;
  failure_state text; failure_message text;
begin
  select jsonb_agg(to_jsonb(c) order by sort_order) into before_catalog from public.movie_candidates c;
  begin
    alter table public.rooms drop constraint rooms_movie_candidate_id_fkey;
    delete from public.movie_candidates where id='fixture-clockwork-orchard';
    select not exists(select 1 from public.movie_candidates where id='fixture-clockwork-orchard') into missing;
    set local role authenticated;
    perform set_config('request.jwt.claims','{"sub":"03000000-0000-4000-a000-000000000002","role":"authenticated"}',true);
    caller_ok:=current_user='authenticated' and auth.uid()='03000000-0000-4000-a000-000000000002'::uuid;
    perform * from public.ensure_room_candidate('03100000-0000-4000-a000-000000000003');
    raise exception using errcode='ZX001',message='broken reference unexpectedly returned a business row';
  exception when others then
    failure_state:=SQLSTATE; failure_message:=SQLERRM;
  end;
  return next ok(missing and caller_ok,'integrity fault: actual missing reference and authenticated guest established');
  return next is(failure_state,'P0001','integrity fault: exception instead of fallback selection or normal outcome');
  return next is(failure_message,'Room candidate integrity failure','integrity fault: exceptional missing referenced record');
  return next results_eq(
    'select to_jsonb(r),r.xmin::text,r.ctid::text from public.rooms r order by r.id',
    'select rowdata,version,location from pg_temp.candidate_rpc_before order by rowdata->>''id''',
    'integrity fault: every established assignment, room field and physical version preserved');
  return next is((select jsonb_agg(to_jsonb(c) order by sort_order) from public.movie_candidates c),
    before_catalog,'integrity fault: full catalog restored by rollback');
  return next ok((select convalidated and confdeltype='r' and confupdtype='a'
    from pg_constraint where conrelid='public.rooms'::regclass and conname='rooms_movie_candidate_id_fkey'),
    'integrity fault: original validated FK restored by rollback');
end;
$trial$;
select * from pg_temp.missing_candidate_trial();

select ok((select jsonb_agg(to_jsonb(m) order by id) from public.room_members m)=
  (select jsonb_agg(to_jsonb(m) order by id) from pg_temp.candidate_members_before m),
  'all candidate successes/faults/retries preserve exact member rows and flags');
select ok(not exists(select 1 from public.rooms r where r.voter_count<>
  (select count(*) from public.room_members m where m.room_id=r.id and m.is_voter)),
  'all candidate operations preserve summary/member equality');

-- End the new fixture block before the unchanged Phase 2 schema/ACL trials.
delete from public.rooms where id in (
  select ('03100000-0000-4000-a000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,6) n);
delete from auth.users where id in (
  select ('03000000-0000-4000-a000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,4) n);
select is((select count(*) from public.rooms),0::bigint,'RPC fixtures cleaned before Phase 2 regression');
select is((select count(*) from pg_trigger where tgrelid='public.rooms'::regclass and not tgisinternal),
  0::bigint,'no application/test trigger remains after fault trial');

-- T007: inspect actual catalogs and execute rejected/accepted writes.
select has_table('public', 'movie_candidates', 'the fixture catalog exists');
select results_eq(
  $$select a.attname::text collate "default",
      format_type(a.atttypid, a.atttypmod) collate "default", a.attnotnull,
      a.attgenerated::text collate "default", a.attidentity::text collate "default",
      pg_get_expr(d.adbin, d.adrelid) collate "default"
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=to_regclass('public.movie_candidates') and a.attnum>0
      and not a.attisdropped order by a.attnum$$,
  $$values ('id'::text, 'text'::text, true, ''::text, ''::text, null::text),
    ('title', 'text', true, '', '', null),
    ('release_year', 'smallint', true, '', '', null),
    ('poster_key', 'text', true, '', '', null),
    ('sort_order', 'integer', true, '', '', null)$$,
  'exact five ordered fields, types, NOT NULL, no defaults/generated/identity fields'
);
select results_eq(
  $$select conname::text collate "default", contype::text collate "default",
      pg_get_constraintdef(oid) collate "default", convalidated, condeferrable, condeferred
    from pg_constraint where conrelid=to_regclass('public.movie_candidates') order by conname$$,
  $$values
    ('movie_candidates_id_format_check'::text, 'c'::text, $c$CHECK ((id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))$c$::text, true, false, false),
    ('movie_candidates_pkey', 'p', 'PRIMARY KEY (id)', true, false, false),
    ('movie_candidates_poster_key_format_check', 'c', $c$CHECK ((poster_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))$c$, true, false, false),
    ('movie_candidates_poster_key_key', 'u', 'UNIQUE (poster_key)', true, false, false),
    ('movie_candidates_release_year_check', 'c', 'CHECK (((release_year >= 1888) AND (release_year <= 9999)))', true, false, false),
    ('movie_candidates_sort_order_check', 'c', 'CHECK ((sort_order > 0))', true, false, false),
    ('movie_candidates_sort_order_key', 'u', 'UNIQUE (sort_order)', true, false, false),
    ('movie_candidates_title_check', 'c', 'CHECK (((title = btrim(title)) AND (length(btrim(title)) > 0)))', true, false, false)$$,
  'exact named catalog constraints are immediately enforced and validated'
);
select results_eq(
  $$select i.relname::text collate "default", am.amname::text collate "default",
      x.indisunique, x.indisvalid, x.indisready,
      pg_get_indexdef(x.indexrelid, 1, true) collate "default",
      x.indnkeyatts::integer, x.indnatts::integer, x.indpred is null
    from pg_index x join pg_class i on i.oid=x.indexrelid join pg_am am on am.oid=i.relam
    where x.indrelid=to_regclass('public.movie_candidates') order by i.relname$$,
  $$values ('movie_candidates_pkey'::text, 'btree'::text, true, true, true, 'id'::text, 1, 1, true),
    ('movie_candidates_poster_key_key', 'btree', true, true, true, 'poster_key', 1, 1, true),
    ('movie_candidates_sort_order_key', 'btree', true, true, true, 'sort_order', 1, 1, true)$$,
  'only primary/unique indexes exist; no extra selection infrastructure'
);
select results_eq(
  $$select a.attname::text collate "default",
      format_type(a.atttypid, a.atttypmod) collate "default", a.attnotnull,
      a.attgenerated::text collate "default", a.attidentity::text collate "default",
      pg_get_expr(d.adbin, d.adrelid) collate "default"
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=to_regclass('public.rooms') and a.attname='movie_candidate_id'$$,
  $$values ('movie_candidate_id'::text, 'text'::text, false, ''::text, ''::text, null::text)$$,
  'room assignment is nullable text with no default or generated value'
);
select results_eq(
  $$select conname::text collate "default", pg_get_constraintdef(oid) collate "default",
      convalidated, condeferrable, condeferred
    from pg_constraint where conrelid=to_regclass('public.rooms')
      and conname in ('rooms_movie_candidate_id_fkey', 'rooms_candidate_requires_ready_check')
    order by conname$$,
  $$values
    ('rooms_candidate_requires_ready_check'::text, 'CHECK (((movie_candidate_id IS NULL) OR (voter_count = required_voter_count)))'::text, true, false, false),
    ('rooms_movie_candidate_id_fkey', 'FOREIGN KEY (movie_candidate_id) REFERENCES movie_candidates(id) ON DELETE RESTRICT', true, false, false)$$,
  'exact named room FK and voter-readiness check are immediately validated'
);
select results_eq(
  $$select confrelid::regclass::text collate "default", confupdtype::text collate "default",
      confdeltype::text collate "default", confmatchtype::text collate "default"
    from pg_constraint where conrelid=to_regclass('public.rooms')
      and conname='rooms_movie_candidate_id_fkey'$$,
  $$values ('movie_candidates'::text, 'a'::text, 'r'::text, 's'::text)$$,
  'assignment FK targets catalog with NO ACTION update, RESTRICT delete and SIMPLE match'
);
select results_eq(
  $$select id, title, release_year, poster_key, sort_order
    from public.movie_candidates order by sort_order$$,
  $$values
    ('fixture-cardboard-comet'::text, 'The Cardboard Comet'::text, 2020::smallint, 'cardboard-comet'::text, 10),
    ('fixture-pebble-bay-lanterns', 'Lanterns of Pebble Bay', 2021::smallint, 'pebble-bay-lanterns', 20),
    ('fixture-cloud-tram-four', 'Cloud Tram Number Four', 2022::smallint, 'cloud-tram-four', 30),
    ('fixture-clockwork-orchard', 'The Clockwork Orchard', 2023::smallint, 'clockwork-orchard', 40)$$,
  'reset supplies exactly four complete fixed rows in approved order'
);
create temporary table candidate_catalog_before on commit drop as select * from public.movie_candidates;

-- One valid row varied per trial: every NULL, malformed, duplicate or boundary
-- violation must fail through the real constraints rather than a metadata check.
select throws_ok(
  format('insert into public.movie_candidates(id,title,release_year,poster_key,sort_order) values (%L,%L,%L,%L,%L)',
    id, title, release_year, poster_key, sort_order),
  sqlstate, null, description)
from (values
  (1, null::text, 'Test title'::text, 2020, 'test-poster'::text, 50, '23502'::text, 'NULL id rejected'::text),
  (2, 'test-id', null, 2020, 'test-poster', 50, '23502', 'NULL title rejected'),
  (3, 'test-id', 'Test title', null, 'test-poster', 50, '23502', 'NULL year rejected'),
  (4, 'test-id', 'Test title', 2020, null, 50, '23502', 'NULL poster key rejected'),
  (5, 'test-id', 'Test title', 2020, 'test-poster', null, '23502', 'NULL order rejected'),
  (6, '', 'Test title', 2020, 'test-poster', 50, '23514', 'empty id rejected'),
  (7, 'Test-id', 'Test title', 2020, 'test-poster', 50, '23514', 'uppercase id rejected'),
  (8, 'test_id', 'Test title', 2020, 'test-poster', 50, '23514', 'underscore id rejected'),
  (9, '-test-id', 'Test title', 2020, 'test-poster', 50, '23514', 'leading id separator rejected'),
  (10, 'test-id-', 'Test title', 2020, 'test-poster', 50, '23514', 'trailing id separator rejected'),
  (11, 'test--id', 'Test title', 2020, 'test-poster', 50, '23514', 'repeated id separator rejected'),
  (12, 'test id', 'Test title', 2020, 'test-poster', 50, '23514', 'id whitespace rejected'),
  (13, 'test-id', '', 2020, 'test-poster', 50, '23514', 'empty title rejected'),
  (14, 'test-id', '   ', 2020, 'test-poster', 50, '23514', 'blank title rejected'),
  (15, 'test-id', ' Test title', 2020, 'test-poster', 50, '23514', 'leading title space rejected'),
  (16, 'test-id', 'Test title ', 2020, 'test-poster', 50, '23514', 'trailing title space rejected'),
  (17, 'test-id', 'Test title', 1887, 'test-poster', 50, '23514', 'year below 1888 rejected'),
  (18, 'test-id', 'Test title', 10000, 'test-poster', 50, '23514', 'year above 9999 rejected'),
  (19, 'test-id', 'Test title', 2020, '', 50, '23514', 'empty poster key rejected'),
  (20, 'test-id', 'Test title', 2020, 'Test-poster', 50, '23514', 'uppercase poster key rejected'),
  (21, 'test-id', 'Test title', 2020, 'test_poster', 50, '23514', 'underscore poster key rejected'),
  (22, 'test-id', 'Test title', 2020, '-test-poster', 50, '23514', 'leading poster separator rejected'),
  (23, 'test-id', 'Test title', 2020, 'test-poster-', 50, '23514', 'trailing poster separator rejected'),
  (24, 'test-id', 'Test title', 2020, 'test--poster', 50, '23514', 'repeated poster separator rejected'),
  (25, 'test-id', 'Test title', 2020, 'test poster', 50, '23514', 'poster whitespace rejected'),
  (26, 'test-id', 'Test title', 2020, 'https://invalid.example/poster.png', 50, '23514', 'poster URL rejected'),
  (27, 'test-id', 'Test title', 2020, 'test-poster', 0, '23514', 'zero order rejected'),
  (28, 'test-id', 'Test title', 2020, 'test-poster', -1, '23514', 'negative order rejected'),
  (29, 'fixture-cardboard-comet', 'Test title', 2020, 'test-poster', 50, '23505', 'duplicate id rejected'),
  (30, 'test-id', 'Test title', 2020, 'cardboard-comet', 50, '23505', 'duplicate poster key rejected'),
  (31, 'test-id', 'Test title', 2020, 'test-poster', 10, '23505', 'duplicate order rejected')
) cases(n,id,title,release_year,poster_key,sort_order,sqlstate,description)
order by n;

select lives_ok(
  $$insert into public.movie_candidates(id,title,release_year,poster_key,sort_order) values
    ('test-year-low','Shared test title',1888,'test-year-low',1),
    ('test-year-high','Shared test title',9999,'test-year-high',2147483647)$$,
  'inclusive year bounds, positive integer order bounds and duplicate titles are valid'
);
delete from public.movie_candidates where id in ('test-year-low','test-year-high');
select results_eq(
  $$select * from public.movie_candidates order by sort_order$$,
  $$select * from pg_temp.candidate_catalog_before order by sort_order$$,
  'constraint trials preserve every original catalog row and field'
);

-- UUID-only test identities, no passwords/tokens or GoTrue calls.
insert into auth.users(id) values
  ('02000000-0000-4000-a000-000000000001'),
  ('02000000-0000-4000-a000-000000000002'),
  ('02000000-0000-4000-a000-000000000003'),
  ('02000000-0000-4000-a000-000000000004');
select lives_ok(
  $$insert into public.rooms(code,creation_request_id,creator_user_id,voter_count) values
    ('C200000001','02100000-0000-4000-a000-000000000001','02000000-0000-4000-a000-000000000001',1),
    ('C200000004','02100000-0000-4000-a000-000000000004','02000000-0000-4000-a000-000000000003',1)$$,
  'Waiting + omitted NULL assignment is valid for existing-style room inserts'
);
select lives_ok(
  $$insert into public.rooms(code,creation_request_id,creator_user_id,voter_count) values
    ('C200000002','02100000-0000-4000-a000-000000000002','02000000-0000-4000-a000-000000000001',2),
    ('C200000003','02100000-0000-4000-a000-000000000003','02000000-0000-4000-a000-000000000001',2),
    ('C200000005','02100000-0000-4000-a000-000000000005','02000000-0000-4000-a000-000000000003',2)$$,
  'Ready + omitted NULL assignment is valid for existing-style room inserts'
);
insert into public.room_members(room_id,user_id,is_voter)
  select id,creator_user_id,true from public.rooms where code like 'C20000000%';
insert into public.room_members(room_id,user_id,is_voter)
  select id,(case when code='C200000005' then '02000000-0000-4000-a000-000000000004'
    else '02000000-0000-4000-a000-000000000002' end)::uuid,true from public.rooms where voter_count=2;
select results_eq(
  $$select code,state,movie_candidate_id from public.rooms where code like 'C20000000%' order by code$$,
  $$values ('C200000001'::text,'waiting'::text,null::text),('C200000002','ready',null),
    ('C200000003','ready',null),('C200000004','waiting',null),('C200000005','ready',null)$$,
  'neither Waiting nor Ready inserts synthesize a candidate assignment'
);
select throws_ok(
  $$update public.rooms set movie_candidate_id='fixture-cardboard-comet' where code='C200000001'$$,
  '23514','new row for relation "rooms" violates check constraint "rooms_candidate_requires_ready_check"',
  'Waiting + assigned is rejected by the named invariant'
);
select throws_ok(
  $$insert into public.rooms(code,creation_request_id,creator_user_id,movie_candidate_id) values
    ('C200000006','02100000-0000-4000-a000-000000000006','02000000-0000-4000-a000-000000000001','fixture-cardboard-comet')$$,
  '23514','new row for relation "rooms" violates check constraint "rooms_candidate_requires_ready_check"',
  'an INSERT cannot bypass the Waiting assignment invariant'
);
select throws_ok(
  $$update public.rooms set movie_candidate_id='absent-fixture' where code='C200000002'$$,
  '23503',null,'Ready cannot reference a nonexistent catalog candidate'
);
select lives_ok(
  $$update public.rooms set movie_candidate_id='fixture-cardboard-comet' where code in ('C200000003','C200000005')$$,
  'owner-only fixtures permit Ready + assigned, including the same candidate in unrelated rooms'
);
select results_eq(
  $$select code,state,movie_candidate_id from public.rooms where code like 'C20000000%' order by code$$,
  $$values ('C200000001'::text,'waiting'::text,null::text),('C200000002','ready',null),
    ('C200000003','ready','fixture-cardboard-comet'),('C200000004','waiting',null),
    ('C200000005','ready','fixture-cardboard-comet')$$,
  'all permitted states coexist and rejected writes establish no assignment'
);
create temporary table candidate_rooms_before on commit drop as
  select * from public.rooms where code like 'C20000000%';
select throws_ok(
  $$delete from public.movie_candidates where id='fixture-cardboard-comet'$$,
  '23503',null,'ON DELETE RESTRICT rejects deletion of a referenced candidate'
);
select throws_ok(
  $$update public.movie_candidates set id='replacement-id' where id='fixture-cardboard-comet'$$,
  '23503',null,'ON UPDATE NO ACTION rejects changing a referenced catalog id'
);
select throws_ok(
  $$update public.rooms set voter_count=1 where code='C200000003'$$,
  '23514','new row for relation "rooms" violates check constraint "rooms_candidate_requires_ready_check"',
  'an assigned room cannot be made Waiting by decreasing its voter count'
);
select results_eq(
  $$select * from public.rooms where code like 'C20000000%' order by code$$,
  $$select * from pg_temp.candidate_rooms_before order by code$$,
  'failed FK/invariant operations preserve membership, state, timestamps and assignment'
);
select results_eq(
  $$select * from public.movie_candidates order by sort_order$$,
  $$select * from pg_temp.candidate_catalog_before order by sort_order$$,
  'failed referenced-row operations preserve the complete four-row catalog'
);

-- T008: inspect explicit ACLs and effective privileges independently of calls.
select results_eq(
  $$select relrowsecurity, pg_get_userbyid(relowner)::text collate "default"
    from pg_class where oid='public.movie_candidates'::regclass$$,
  $$values (true, 'postgres'::text)$$,
  'catalog is postgres-owned with RLS enabled'
);
select is((select count(*) from pg_policy where polrelid='public.movie_candidates'::regclass),
  0::bigint, 'catalog has no client policies');
select is(
  (select count(*) from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) p
    where c.oid='public.movie_candidates'::regclass
      and p.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid)),
  0::bigint, 'PUBLIC/anon/authenticated have no catalog table privileges'
);
select is(
  (select count(*) from pg_attribute a cross join lateral aclexplode(a.attacl) p
    where a.attrelid='public.movie_candidates'::regclass
      and p.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid)),
  0::bigint, 'PUBLIC/anon/authenticated have no catalog column privileges'
);
select ok(not has_table_privilege(role_name,'public.movie_candidates',privilege_name),
  role_name || ' has no catalog ' || privilege_name)
from (values ('anon'),('authenticated')) roles(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) privileges(privilege_name)
order by role_name,privilege_name;
select ok(not has_column_privilege(role_name,'public.movie_candidates',column_name,privilege_name),
  role_name || ' has no catalog column ' || column_name || ' ' || privilege_name)
from (values ('anon'),('authenticated')) roles(role_name)
cross join (values ('id'),('title'),('release_year'),('poster_key'),('sort_order')) columns(column_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) privileges(privilege_name)
order by role_name,column_name,privilege_name;
select is(
  (select count(*) from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) p
    where c.oid='public.rooms'::regclass
      and p.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid)),
  0::bigint, 'room extension adds no PUBLIC or client table grant'
);
select results_eq(
  $$select a.attname::text collate "default", p.grantee::regrole::text collate "default",
      p.privilege_type collate "default", p.is_grantable
    from pg_attribute a cross join lateral aclexplode(a.attacl) p
    where a.attrelid='public.rooms'::regclass
      and p.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid)
    order by a.attname,p.grantee,p.privilege_type$$,
  $$values ('code'::text,'authenticated'::text,'SELECT'::text,false),
    ('id','authenticated','SELECT',false),('required_voter_count','authenticated','SELECT',false),
    ('state','authenticated','SELECT',false),('voter_count','authenticated','SELECT',false)$$,
  'only the approved generalized five-field projection is granted'
);
select ok(not has_column_privilege(role_name,'public.rooms','movie_candidate_id',privilege_name),
  role_name || ' has no assignment-column ' || privilege_name)
from (values ('anon'),('authenticated')) roles(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) privileges(privilege_name)
order by role_name,privilege_name;
select results_eq(
  $$select relrowsecurity, pg_get_userbyid(relowner)::text collate "default"
    from pg_class where oid='public.rooms'::regclass$$,
  $$values (true,'postgres'::text)$$,'rooms RLS/owner remain intact'
);
select results_eq(
  $$select polname::text collate "default", polcmd::text collate "default", polpermissive,
      polroles=array['authenticated'::regrole::oid],
      btrim(regexp_replace(pg_get_expr(polqual,polrelid),'\s+',' ','g')) collate "default", polwithcheck is null
    from pg_policy where polrelid='public.rooms'::regclass order by polname$$,
  $$values ('rooms_select_member'::text,'r'::text,true,true,
    'private.is_room_member(id)'::text,true)$$,
  'member-only SELECT policy uses generalized authorization'
);
select results_eq(
  $$select schemaname::text collate "default",tablename::text collate "default"
    from pg_publication_tables where pubname='supabase_realtime' order by schemaname,tablename$$,
  $$values ('public'::text,'rooms'::text)$$,
  'Realtime publication still contains rooms only, never the catalog'
);

-- Actual signed-out access: privileged fixture setup has ended.
set local role anon;
set local request.jwt.claims = '{}';
select is(current_user::text,'anon','signed-out: actual client role');
select is(auth.uid(),null::uuid,'signed-out: explicit subject claim');
select throws_ok($$select id,code,state from public.rooms$$,'42501',null,'signed-out: room projection denied');
select throws_ok(query,'42501',null,'signed-out: ' || description)
from (values
  (1,$$select * from public.movie_candidates$$,'catalog SELECT denied'),
  (2,$$insert into public.movie_candidates(id,title,release_year,poster_key,sort_order) values ('client-insert','Client title',2024,'client-poster',50)$$,'catalog INSERT denied'),
  (3,$$update public.movie_candidates set title='Client title' where id='fixture-cardboard-comet'$$,'catalog UPDATE denied'),
  (4,$$delete from public.movie_candidates where id='fixture-pebble-bay-lanterns'$$,'catalog DELETE denied even without references'),
  (5,$$select movie_candidate_id from public.rooms$$,'assignment SELECT denied'),
  (6,$$select * from public.rooms$$,'full room SELECT denied'),
  (7,$$update public.rooms set movie_candidate_id='fixture-cardboard-comet' where code='C200000002'$$,'direct first assignment denied'),
  (8,$$update public.rooms set movie_candidate_id='fixture-pebble-bay-lanterns' where code='C200000003'$$,'direct replacement denied'),
  (9,$$update public.rooms set movie_candidate_id=null where code='C200000003'$$,'direct assignment clearing denied'),
  (10,$$insert into public.rooms(code,creation_request_id,creator_user_id,voter_count,movie_candidate_id) values ('C200000007','02100000-0000-4000-a000-000000000007','02000000-0000-4000-a000-000000000001',2,'fixture-cardboard-comet')$$,'direct room INSERT with assignment denied')
) attacks(n,query,description) order by n;
reset role;
select results_eq(
  $$select * from public.movie_candidates order by sort_order$$,
  $$select * from pg_temp.candidate_catalog_before order by sort_order$$,
  'signed-out: denied access preserves every catalog field and row'
);
select results_eq(
  $$select * from public.rooms where code like 'C20000000%' order by code$$,
  $$select * from pg_temp.candidate_rooms_before order by code$$,
  'signed-out: denied access preserves complete room rows and assignments'
);

-- Actual host access: privileged fixture setup has ended.
set local role authenticated;
set local request.jwt.claims = '{"sub":"02000000-0000-4000-a000-000000000001","role":"authenticated"}';
select is(current_user::text,'authenticated','creator: actual client role');
select is(auth.uid(),'02000000-0000-4000-a000-000000000001'::uuid,'creator: explicit subject claim');
select results_eq(
  $$select code,state from public.rooms where code like 'C20000000%' order by code$$,
  $$values ('C200000001'::text,'waiting'::text),('C200000002','ready'),('C200000003','ready')$$,
  'creator: existing room projection exposes only own memberships, including assigned rooms'
);
select throws_ok(query,'42501',null,'creator: ' || description)
from (values
  (1,$$select * from public.movie_candidates$$,'catalog SELECT denied'),
  (2,$$insert into public.movie_candidates(id,title,release_year,poster_key,sort_order) values ('client-insert','Client title',2024,'client-poster',50)$$,'catalog INSERT denied'),
  (3,$$update public.movie_candidates set title='Client title' where id='fixture-cardboard-comet'$$,'catalog UPDATE denied'),
  (4,$$delete from public.movie_candidates where id='fixture-pebble-bay-lanterns'$$,'catalog DELETE denied even without references'),
  (5,$$select movie_candidate_id from public.rooms$$,'assignment SELECT denied'),
  (6,$$select * from public.rooms$$,'full room SELECT denied'),
  (7,$$update public.rooms set movie_candidate_id='fixture-cardboard-comet' where code='C200000002'$$,'direct first assignment denied'),
  (8,$$update public.rooms set movie_candidate_id='fixture-pebble-bay-lanterns' where code='C200000003'$$,'direct replacement denied'),
  (9,$$update public.rooms set movie_candidate_id=null where code='C200000003'$$,'direct assignment clearing denied'),
  (10,$$insert into public.rooms(code,creation_request_id,creator_user_id,voter_count,movie_candidate_id) values ('C200000007','02100000-0000-4000-a000-000000000007','02000000-0000-4000-a000-000000000001',2,'fixture-cardboard-comet')$$,'direct room INSERT with assignment denied')
) attacks(n,query,description) order by n;
reset role;
select results_eq(
  $$select * from public.movie_candidates order by sort_order$$,
  $$select * from pg_temp.candidate_catalog_before order by sort_order$$,
  'creator: denied access preserves every catalog field and row'
);
select results_eq(
  $$select * from public.rooms where code like 'C20000000%' order by code$$,
  $$select * from pg_temp.candidate_rooms_before order by code$$,
  'creator: denied access preserves complete room rows and assignments'
);

-- Actual guest access: privileged fixture setup has ended.
set local role authenticated;
set local request.jwt.claims = '{"sub":"02000000-0000-4000-a000-000000000002","role":"authenticated"}';
select is(current_user::text,'authenticated','voter: actual client role');
select is(auth.uid(),'02000000-0000-4000-a000-000000000002'::uuid,'voter: explicit subject claim');
select results_eq(
  $$select code,state from public.rooms where code like 'C20000000%' order by code$$,
  $$values ('C200000002'::text,'ready'::text),('C200000003','ready')$$,
  'voter: existing room projection exposes only own memberships, including assigned rooms'
);
select throws_ok(query,'42501',null,'voter: ' || description)
from (values
  (1,$$select * from public.movie_candidates$$,'catalog SELECT denied'),
  (2,$$insert into public.movie_candidates(id,title,release_year,poster_key,sort_order) values ('client-insert','Client title',2024,'client-poster',50)$$,'catalog INSERT denied'),
  (3,$$update public.movie_candidates set title='Client title' where id='fixture-cardboard-comet'$$,'catalog UPDATE denied'),
  (4,$$delete from public.movie_candidates where id='fixture-pebble-bay-lanterns'$$,'catalog DELETE denied even without references'),
  (5,$$select movie_candidate_id from public.rooms$$,'assignment SELECT denied'),
  (6,$$select * from public.rooms$$,'full room SELECT denied'),
  (7,$$update public.rooms set movie_candidate_id='fixture-cardboard-comet' where code='C200000002'$$,'direct first assignment denied'),
  (8,$$update public.rooms set movie_candidate_id='fixture-pebble-bay-lanterns' where code='C200000003'$$,'direct replacement denied'),
  (9,$$update public.rooms set movie_candidate_id=null where code='C200000003'$$,'direct assignment clearing denied'),
  (10,$$insert into public.rooms(code,creation_request_id,creator_user_id,voter_count,movie_candidate_id) values ('C200000007','02100000-0000-4000-a000-000000000007','02000000-0000-4000-a000-000000000001',2,'fixture-cardboard-comet')$$,'direct room INSERT with assignment denied')
) attacks(n,query,description) order by n;
reset role;
select results_eq(
  $$select * from public.movie_candidates order by sort_order$$,
  $$select * from pg_temp.candidate_catalog_before order by sort_order$$,
  'voter: denied access preserves every catalog field and row'
);
select results_eq(
  $$select * from public.rooms where code like 'C20000000%' order by code$$,
  $$select * from pg_temp.candidate_rooms_before order by code$$,
  'voter: denied access preserves complete room rows and assignments'
);

-- Actual unrelated participant access: privileged fixture setup has ended.
set local role authenticated;
set local request.jwt.claims = '{"sub":"02000000-0000-4000-a000-000000000003","role":"authenticated"}';
select is(current_user::text,'authenticated','unrelated participant: actual client role');
select is(auth.uid(),'02000000-0000-4000-a000-000000000003'::uuid,'unrelated participant: explicit subject claim');
select results_eq(
  $$select code,state from public.rooms where code like 'C20000000%' order by code$$,
  $$values ('C200000004'::text,'waiting'::text),('C200000005','ready')$$,
  'unrelated participant: existing room projection exposes only own memberships, including assigned rooms'
);
select throws_ok(query,'42501',null,'unrelated participant: ' || description)
from (values
  (1,$$select * from public.movie_candidates$$,'catalog SELECT denied'),
  (2,$$insert into public.movie_candidates(id,title,release_year,poster_key,sort_order) values ('client-insert','Client title',2024,'client-poster',50)$$,'catalog INSERT denied'),
  (3,$$update public.movie_candidates set title='Client title' where id='fixture-cardboard-comet'$$,'catalog UPDATE denied'),
  (4,$$delete from public.movie_candidates where id='fixture-pebble-bay-lanterns'$$,'catalog DELETE denied even without references'),
  (5,$$select movie_candidate_id from public.rooms$$,'assignment SELECT denied'),
  (6,$$select * from public.rooms$$,'full room SELECT denied'),
  (7,$$update public.rooms set movie_candidate_id='fixture-cardboard-comet' where code='C200000002'$$,'direct first assignment denied'),
  (8,$$update public.rooms set movie_candidate_id='fixture-pebble-bay-lanterns' where code='C200000003'$$,'direct replacement denied'),
  (9,$$update public.rooms set movie_candidate_id=null where code='C200000003'$$,'direct assignment clearing denied'),
  (10,$$insert into public.rooms(code,creation_request_id,creator_user_id,voter_count,movie_candidate_id) values ('C200000007','02100000-0000-4000-a000-000000000007','02000000-0000-4000-a000-000000000001',2,'fixture-cardboard-comet')$$,'direct room INSERT with assignment denied')
) attacks(n,query,description) order by n;
reset role;
select results_eq(
  $$select * from public.movie_candidates order by sort_order$$,
  $$select * from pg_temp.candidate_catalog_before order by sort_order$$,
  'unrelated participant: denied access preserves every catalog field and row'
);
select results_eq(
  $$select * from public.rooms where code like 'C20000000%' order by code$$,
  $$select * from pg_temp.candidate_rooms_before order by code$$,
  'unrelated participant: denied access preserves complete room rows and assignments'
);

-- Feature 003: every authorized combination in both three-voter creator modes.
create function pg_temp.member_rpc(subject uuid, command text) returns jsonb language plpgsql as $f$
declare result jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
  if current_user<>'authenticated' or auth.uid() is distinct from subject then raise exception 'incorrect test caller'; end if;
  execute 'select jsonb_agg(to_jsonb(r)) from ('||command||') r' into result;
  reset role;
  return result;
exception when others then reset role; raise;
end;
$f$;
create function pg_temp.generalized_candidates() returns setof text language plpgsql as $trial$
declare
  voting boolean; creator uuid; voters uuid[]; users uuid[]; rid uuid; code text; who uuid;
  initial integer; n integer; result jsonb; expected jsonb; members_before jsonb; room_before jsonb; room_after jsonb;
begin
  foreach voting in array array[true,false] loop
    creator:=extensions.gen_random_uuid(); voters:=array[extensions.gen_random_uuid(),extensions.gen_random_uuid(),extensions.gen_random_uuid()];
    insert into auth.users(id) values(creator);
    insert into auth.users(id) select unnest(voters);
    result:=pg_temp.member_rpc(creator,format('select * from public.create_room(%L,3,%L)',extensions.gen_random_uuid(),voting));
    rid:=(result->0->>'room_id')::uuid; code:=result->0->>'room_code'; initial:=case when voting then 1 else 0 end;
    users:=array[creator];
    for n in initial..3 loop
      select jsonb_agg(to_jsonb(m) order by id) into members_before from public.room_members m where room_id=rid;
      select jsonb_build_object('row',to_jsonb(r),'xmin',xmin::text,'ctid',ctid::text) into room_before from public.rooms r where id=rid;
      foreach who in array users loop
        result:=pg_temp.member_rpc(who,format('select * from public.ensure_room_candidate(%L)',rid));
        expected:=case when n<3 then '[{"outcome":"not_ready","candidate_id":null,"title":null,"release_year":null,"poster_key":null}]'::jsonb
          else '[{"outcome":"available","candidate_id":"fixture-cardboard-comet","title":"The Cardboard Comet","release_year":2020,"poster_key":"cardboard-comet"}]'::jsonb end;
        return next ok(result=expected,format('generalized candidate: creator-voter=%s count=%s, every authorized caller exact result',voting,n));
        select jsonb_build_object('row',to_jsonb(r),'xmin',xmin::text,'ctid',ctid::text) into room_after from public.rooms r where id=rid;
        return next ok((n=3 or room_after=room_before)
          and ((room_after->'row')-array['movie_candidate_id','updated_at'])=((room_before->'row')-array['movie_candidate_id','updated_at'])
          and members_before=(select jsonb_agg(to_jsonb(m) order by id) from public.room_members m where room_id=rid)
          and (select voter_count=(select count(*) from public.room_members m where m.room_id=r.id and m.is_voter) from public.rooms r where id=rid),
          'generalized candidate: Waiting no UPDATE; all calls preserve membership/config/count invariant');
        if n=3 then
          result:=pg_temp.member_rpc(who,format('select * from public.ensure_room_candidate(%L)',rid));
          return next ok(result=expected and room_after=(select jsonb_build_object('row',to_jsonb(r),'xmin',xmin::text,'ctid',ctid::text) from public.rooms r where id=rid),
            'generalized Ready repeat preserves candidate and physical row version');
        end if;
      end loop;
      if n<3 then
        who:=voters[n-initial+1];
        perform pg_temp.member_rpc(who,format('select * from public.join_room(%L)',code));
        users:=array_append(users,who);
      end if;
    end loop;
    return next ok((select is_voter=voting from public.room_members where room_id=rid and user_id=creator)
      and (select voter_count=3 and state='ready' from public.rooms where id=rid),'creator choice survives assembly and all candidate calls');
    delete from public.rooms where id=rid;
    delete from auth.users where id=creator or id=any(voters);
  end loop;
end;
$trial$;
select * from pg_temp.generalized_candidates();

select * from finish();
rollback;
