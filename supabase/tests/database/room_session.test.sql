-- Feature 003 atomic membership cutover: evolved schema, security and RPC evidence.
-- UUID-only fixtures: controller setup rolls back; committed race fixtures are
-- explicitly cleaned through their separate owner connection on every path.
-- Local-only harness setup needs the extension owner to revoke dblink's own
-- default EXECUTE ACL. Reuse the pinned local CLI's connection parameters only;
-- no password is embedded or printed. RPC calls still SET ROLE to
-- authenticated/anon, and remote fixture ownership remains postgres.
\connect -reuse-previous=on "user=supabase_admin"
begin;
set local search_path = pg_catalog, public, extensions;
set local statement_timeout = '60s';
set local lock_timeout = '5s';
create extension if not exists pgtap with schema extensions;
select no_plan();

-- T041-T044 run before this controller touches rooms/Auth fixture relations.
-- Remote fixture DDL must not wait on locks held by the surrounding test txn.
create extension if not exists dblink with schema extensions;
do $restrict$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_depend d on d.objid = p.oid
    where d.classid = 'pg_proc'::regclass and d.refclassid = 'pg_extension'::regclass
      and d.refobjid = (select oid from pg_extension where extname = 'dblink') and d.deptype = 'e'
  loop execute format('revoke all on function %s from public, anon, authenticated', f); end loop;
end;
$restrict$;
select ok(not has_function_privilege('anon', p.oid, 'EXECUTE')
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'test-only dblink entry is inaccessible to clients: ' || p.proname)
from pg_proc p join pg_depend d on d.objid = p.oid
where d.classid = 'pg_proc'::regclass and d.refclassid = 'pg_extension'::regclass
  and d.refobjid = (select oid from pg_extension where extname='dblink') and d.deptype='e';

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

create function pg_temp.create_race(kind text, cancel_probe boolean default false, creator_votes boolean default true) returns setof text language plpgsql as $trial$
declare
  ns text := 'membership_create_' || encode(extensions.gen_random_bytes(8), 'hex');
  own text; a text; b text;
  conninfo text := 'dbname=postgres user=postgres connect_timeout=3';
  h uuid := extensions.gen_random_uuid(); g uuid := extensions.gen_random_uuid(); u uuid := extensions.gen_random_uuid();
  request uuid := extensions.gen_random_uuid(); fixture_request uuid := extensions.gen_random_uuid();
  rid uuid := extensions.gen_random_uuid();
  c text := upper(encode(extensions.gen_random_bytes(5), 'hex'));
  w text := upper(encode(extensions.gen_random_bytes(5), 'hex'));
  key integer := 1 + floor(random() * 2000000000)::integer;
  apid integer; bpid integer; opid integer; dbid oid := (select oid from pg_database where datname = current_database());
  ra jsonb; rb jsonb; rowdata jsonb; before_collision jsonb; before_second_commit jsonb;
  deadline timestamptz; first_caller text; name text; failure text; cleanup_failure text;
  violation text; base_a integer; base_b integer; member_a integer; member_b integer;
  updates_a integer; updates_b integer;
  winning_votes boolean := case when kind='collision_winner' then not creator_votes else creator_votes end;
  winning_target integer := case when kind='collision_winner' then 2 else 3 end;
  member_query text := 'select to_jsonb(coalesce((select n_tup_ins from pg_stat_xact_user_tables where relid=''public.room_members''::regclass),0))';
  update_query text := 'select to_jsonb(coalesce((select n_tup_upd from pg_stat_xact_user_tables where relid=''public.rooms''::regclass),0))';
  canceled_at_barrier boolean := false; failure_state text;
begin
  own := ns || '_owner'; a := ns || '_a'; b := ns || '_b';
  begin
    perform extensions.dblink_connect(own, conninfo);
    perform extensions.dblink_exec(own, 'set statement_timeout = ''10s''; set lock_timeout = ''5s''');
    opid := (pg_temp.remote_json(own, 'select to_jsonb(pg_backend_pid())'))::integer;
    perform extensions.dblink_exec(own, format('insert into auth.users(id) values (%L), (%L), (%L)', h,g,u));
    perform extensions.dblink_connect(a, conninfo);
    perform extensions.dblink_connect(b, conninfo);
    foreach name in array array[a,b] loop
      perform extensions.dblink_exec(name, 'set statement_timeout = ''20s''; set lock_timeout = ''15s''');
    end loop;
    apid := (pg_temp.remote_json(a, 'select to_jsonb(pg_backend_pid())'))::integer;
    bpid := (pg_temp.remote_json(b, 'select to_jsonb(pg_backend_pid())'))::integer;
    perform pg_temp.require(apid <> bpid and apid <> opid and bpid <> opid, 'three independent backends required');

    if kind = 'collision_winner' then
      -- Exact per-trial manifest: namespace, trigger, PIDs, UUIDs, codes and lock.
      -- The committed trigger is inert outside these PIDs AND explicit modes.
      perform pg_temp.require(c <> w, 'fixture codes must differ');
      perform extensions.dblink_exec(own, format($setup$
        begin;
        insert into public.rooms(id,code,creation_request_id,creator_user_id,voter_count) values (%1$L,%2$L,%3$L,%4$L,1);
        insert into public.room_members(room_id,user_id,is_voter) values (%1$L,%4$L,true);
        create schema %5$I;
        revoke all on schema %5$I from public, anon, authenticated;
        create function %5$I.fault() returns trigger language plpgsql set search_path = '' as $body$
        begin
          if pg_catalog.pg_backend_pid() = %6$s and pg_catalog.current_setting('otteroom.test.create_room_fault_mode', true) = 'collision_wait' then
            new.code := %2$L;
            perform pg_catalog.pg_advisory_lock(44004, %8$s);
            perform pg_catalog.pg_advisory_unlock(44004, %8$s);
          elsif pg_catalog.pg_backend_pid() = %7$s and pg_catalog.current_setting('otteroom.test.create_room_fault_mode', true) = 'winner' then
            new.code := %9$L;
          end if;
          return new;
        end;
        $body$;
        revoke all on function %5$I.fault() from public, anon, authenticated;
        create trigger %5$I before insert on public.rooms for each row execute function %5$I.fault();
        commit;
      $setup$, rid,c,fixture_request,u,ns,apid,bpid,key,w));
      before_collision := pg_temp.remote_json(own, format('select to_jsonb(r) from public.rooms r where id = %L', rid));
      perform pg_temp.require((pg_temp.remote_json(own, format(
        'select to_jsonb(count(*)) from public.rooms where creator_user_id = %L and creation_request_id = %L', h,request)))::integer = 0,
        'T044 starts without the tested host/request');
      perform pg_temp.require((pg_temp.remote_json(own, format('select to_jsonb(count(*)) from public.rooms where code = %L',w)))::integer = 0,
        'winner code must be unused');
      perform pg_temp.remote_json(b, format('select jsonb_build_object(''locked'',pg_advisory_lock(44004,%s))',key));

    end if;

    perform pg_temp.caller(a,h);
    perform pg_temp.caller(b,h);
    base_a:=pg_temp.remote_json(a,member_query)::integer;
    base_b:=pg_temp.remote_json(b,member_query)::integer;
    if kind in ('duplicate_create','collision_winner') then
      if kind = 'collision_winner' then
        perform extensions.dblink_exec(a, 'set otteroom.test.create_room_fault_mode = ''collision_wait''');
        perform extensions.dblink_exec(b, 'set otteroom.test.create_room_fault_mode = ''winner''');
      end if;
      perform pg_temp.require(extensions.dblink_send_query(a, format('select to_jsonb(r) from public.create_room(%L,3,%L) r',request,creator_votes)) = 1, 'A dispatched');
      deadline := clock_timestamp() + interval '8 seconds';
      if kind = 'duplicate_create' then
        perform pg_temp.await_ready(a); -- Do not collect or commit A yet.
        perform pg_temp.require(extensions.dblink_send_query(b, format('select to_jsonb(r) from public.create_room(%L,2,%L) r',request,not creator_votes)) = 1, 'B dispatched');
        loop
          exit when apid = any(pg_blocking_pids(bpid));
          if clock_timestamp() > deadline then raise exception 'duplicate B never blocked by uncommitted A'; end if;
        end loop;
        ra := pg_temp.collect(a);
        member_a:=pg_temp.remote_json(a,member_query)::integer-base_a;
        updates_a:=pg_temp.remote_json(a,update_query)::integer;
        perform extensions.dblink_exec(a,'commit');
        rb := pg_temp.collect(b);
        member_b:=pg_temp.remote_json(b,member_query)::integer-base_b;
        updates_b:=pg_temp.remote_json(b,update_query)::integer;
        perform extensions.dblink_exec(b,'commit');
        perform pg_temp.require(ra->>'outcome' = 'created' and rb->>'outcome' = 'already_created', 'duplicate create must elect A and recover A');
      else
        loop
          exit when bpid = any(pg_blocking_pids(apid)) and exists (
            select 1 from pg_locks la join pg_locks lb using (locktype,database,classid,objid,objsubid)
            where la.pid=apid and lb.pid=bpid and not la.granted and lb.granted
              and la.locktype='advisory' and la.database=dbid and la.classid=44004 and la.objid=key and la.objsubid=2);
          if clock_timestamp() > deadline then raise exception 'T044 exact advisory barrier not observed'; end if;
        end loop;
        if cancel_probe then
          canceled_at_barrier := pg_cancel_backend(apid);
          perform pg_temp.collect(a); -- Actual remote query_canceled, not a fake violation.
          raise exception 'cancellation probe unexpectedly returned a result';
        end if;
        perform pg_temp.require(extensions.dblink_send_query(b, format('select to_jsonb(r) from public.create_room(%L,2,%L) r',request,not creator_votes)) = 1, 'B dispatched after observed barrier');
        rb := pg_temp.collect(b);
        member_b:=pg_temp.remote_json(b,member_query)::integer-base_b;
        updates_b:=pg_temp.remote_json(b,update_query)::integer;
        perform extensions.dblink_exec(b,'commit');
        perform pg_temp.require(rb->>'outcome'='created' and rb->>'room_code'=w, 'B creates the designated winner');
        rowdata := pg_temp.remote_json(own, format('select to_jsonb(r) from public.rooms r where creator_user_id=%L and creation_request_id=%L',h,request));
        perform pg_temp.require(rowdata->>'id'=rb->>'room_id' and rowdata->>'code'=w
          and bpid=any(pg_blocking_pids(apid)), 'fresh owner sees committed B while A is still blocked');
        -- Both unique keys now conflict. Observe the real pinned-server arbiter
        -- in a rolled-back INSERT subtransaction; never synthesize SQLSTATE.
        perform extensions.dblink_exec(own, format($calibrate$
          do $c$ declare name text; begin
            begin
              insert into public.rooms(code,creation_request_id,creator_user_id) values (%L,%L,%L);
              raise exception 'calibration unexpectedly inserted';
            exception when unique_violation then get stacked diagnostics name=constraint_name;
              perform set_config('otteroom.test.constraint_seen',name,false);
            end;
          end; $c$;
        $calibrate$,c,request,h));
        violation := pg_temp.remote_json(own, 'select to_jsonb(current_setting(''otteroom.test.constraint_seen''))') #>> '{}';
        perform pg_temp.require(violation='rooms_code_key','T044 calibrated actual collision must be rooms_code_key');
        perform pg_temp.require((pg_temp.remote_json(b, format('select to_jsonb(pg_advisory_unlock(44004,%s))',key)))::boolean,
          'B explicitly releases its session lock after commit and calibration');
        ra := pg_temp.collect(a);
        member_a:=pg_temp.remote_json(a,member_query)::integer-base_a;
        updates_a:=pg_temp.remote_json(a,update_query)::integer;
        perform extensions.dblink_exec(a,'commit');
        perform pg_temp.require(ra->>'outcome'='already_created', 'A code-key handler recovers already committed B');
        perform pg_temp.require(before_collision = pg_temp.remote_json(own, format('select to_jsonb(r) from public.rooms r where id=%L',rid)),
          'unrelated collision owner row is byte-for-byte unchanged');
      end if;
      perform pg_temp.require((ra-'outcome')=(rb-'outcome') and ra->>'is_creator'='true'
        and (ra->>'is_voter')::boolean=winning_votes and (ra->>'required_voter_count')::integer=winning_target
        and (ra->>'voter_count')::integer=case when winning_votes then 1 else 0 end
        and ra->>'room_state'='waiting','conflicting valid calls recover exact winner configuration');
      perform pg_temp.require(member_a+member_b=1 and updates_a=0 and updates_b=0,
        'one creator-member INSERT across callers; ZERO initialization UPDATEs by either caller');
      perform pg_temp.require((pg_temp.remote_json(own,format('select to_jsonb(count(*)) from public.rooms where creator_user_id=%L',h)))::integer=1,
        'one complete room, no extra losing room');
      rowdata:=pg_temp.remote_json(own,format('select to_jsonb(r) from public.rooms r where creator_user_id=%L',h));
      perform pg_temp.require(rowdata->>'id'=ra->>'room_id' and rowdata->>'creation_request_id'=request::text
        and rowdata->>'state'='waiting' and (rowdata->>'required_voter_count')::integer=winning_target
        and (rowdata->>'voter_count')::integer=case when winning_votes then 1 else 0 end,
        'persisted request/count/configuration match accepted winner');
      perform pg_temp.require(pg_temp.remote_json(own,format(
        'select to_jsonb(count(*)=1 and bool_and(user_id=%L and is_voter=%L)) from public.room_members where room_id=%L',
        h,winning_votes,rowdata->>'id'))::boolean,'exactly one creator membership with original voting choice');
      perform pg_temp.require(pg_temp.remote_json(own,
        'select to_jsonb(not exists(select 1 from public.rooms r where r.voter_count<>(select count(*) from public.room_members m where m.room_id=r.id and m.is_voter)))')::boolean,
        'count/member equality after concurrent creation');

    end if;
  exception when query_canceled or others then
    failure_state := SQLSTATE;
    failure := left(SQLSTATE || ': ' || SQLERRM,220);
  end;

  -- Always close/cancel callers before owner DDL/row cleanup. Only exact named
  -- connections/PIDs and trial UUIDs are ever targeted; no global reset/prune.
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
          perform j from extensions.dblink_get_result(name, false) as t(j jsonb);
          perform j from extensions.dblink_get_result(name, false) as t(j jsonb);
          perform extensions.dblink_exec(name,'rollback');
        exception when query_canceled or others then
          -- A terminated exact PID has no result/transaction left to drain.
          perform pg_terminate_backend(case when name=a then apid else bpid end);
        end;
        -- Disconnect also releases session locks, including canceled trigger A.
        perform extensions.dblink_disconnect(name);
      end if;
    exception when query_canceled or others then cleanup_failure := 'caller cleanup failed';
    end;
  end loop;
  begin
    if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      perform extensions.dblink_exec(own,'rollback');
      if kind='collision_winner' then
        perform extensions.dblink_exec(own,format('begin; drop trigger if exists %1$I on public.rooms; drop schema if exists %1$I cascade; commit',ns));
      end if;
      perform extensions.dblink_exec(own,format('begin; delete from public.rooms where creator_user_id in (%L,%L,%L); delete from auth.users where id in (%L,%L,%L); commit',h,g,u,h,g,u));
      perform pg_temp.require((pg_temp.remote_json(own,format('select to_jsonb(count(*)) from public.rooms where creator_user_id in (%L,%L,%L)',h,g,u)))::integer=0,'rooms cleaned');
      perform pg_temp.require((pg_temp.remote_json(own,format('select to_jsonb(count(*)) from auth.users where id in (%L,%L,%L)',h,g,u)))::integer=0,'Auth fixtures cleaned');
      perform pg_temp.require((pg_temp.remote_json(own,format('select to_jsonb(count(*)) from pg_namespace where nspname=%L',ns)))::integer=0,'test namespace/function cleaned');
      perform pg_temp.require((pg_temp.remote_json(own,format('select to_jsonb(count(*)) from pg_trigger where tgname=%L',ns)))::integer=0,'test trigger cleaned');
      perform pg_temp.require(not exists(select 1 from pg_locks where locktype='advisory' and database=dbid and classid=44004 and objid=key), 'advisory key cleaned');
      perform extensions.dblink_disconnect(own);
    end if;
  exception when query_canceled or others then
    cleanup_failure := 'owner cleanup failed: ' || left(SQLSTATE || ': ' || SQLERRM,180);
    if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then perform extensions.dblink_disconnect(own); end if;
  end;
  deadline := clock_timestamp()+interval '5 seconds';
  loop
    perform pg_stat_clear_snapshot();
    exit when not exists(select 1 from pg_stat_activity where pid in (apid,bpid));
    if clock_timestamp()>deadline then cleanup_failure:='caller backend remained'; exit; end if;
  end loop;
  if cancel_probe then
    return next ok(canceled_at_barrier and failure_state='57014', kind || ': actual canceled blocked RPC follows bounded cleanup path');
  else
    return next ok(failure is null, kind || ' creator-voter='||creator_votes||': authenticated overlap/unique wait, original winner config, one room/member, zero UPDATEs');
    if failure is not null then return next diag(failure); end if;
  end if;
  return next ok(cleanup_failure is null and not exists(select 1 from pg_stat_activity where pid in (apid,bpid)),
    kind || ': bounded caller/lock/trigger/schema/room/Auth cleanup');
  if cleanup_failure is not null then return next diag(cleanup_failure); end if;
end;
$trial$;

-- T019 runs before controller row locks; each trial owns committed fixtures.
set local statement_timeout='120s';
select * from pg_temp.create_race('duplicate_create',false,true);
select * from pg_temp.create_race('duplicate_create',false,false);
select * from pg_temp.create_race('collision_winner',false,true);
select * from pg_temp.create_race('collision_winner',false,false);
select * from pg_temp.create_race('collision_winner',true);
set local statement_timeout='15s';

-- T020/T021: the same owner-lock/dblink/transaction-statistics mechanism as
-- candidate_race, generalized to 2/3 independent authenticated join sessions.
create function pg_temp.member_race(kind text) returns setof text language plpgsql as $trial$
declare
  ns text:='membership_join_'||encode(extensions.gen_random_bytes(8),'hex'); own text:=ns||'_owner';
  conninfo text:='dbname=postgres user=postgres connect_timeout=3'; names text[]:=array[]::text[];
  creator uuid:=extensions.gen_random_uuid(); voters uuid[]:=array[extensions.gen_random_uuid(),extensions.gen_random_uuid(),extensions.gen_random_uuid()];
  subjects uuid[]; rid uuid:=extensions.gen_random_uuid(); code text:=upper(encode(extensions.gen_random_bytes(5),'hex'));
  target integer:=case when kind='final_slot' then 2 else 3 end;
  initial integer:=case when kind='zero_to_three' then 0 when kind='member_recovery' then 2 else 1 end;
  pids integer[]:=array[]::integer[]; opid integer; base jsonb[]:=array[]::jsonb[]; results jsonb[];
  member_deltas integer[]; update_deltas integer[]; done boolean[]; n integer; i integer; winner integer;
  count_calls integer; committed integer:=0; admitted integer:=0; deadline timestamptz; snapshot jsonb; first_snapshot jsonb;
  failure text; cleanup_failure text; name text; row_query text; stats_query text;
  evidence text[]:=array[]::text[]; label text; identity_ok boolean; chain_ok boolean;
begin
  subjects:=case when kind='same_identity' then array[voters[1],voters[1]]
    when kind='zero_to_three' then voters else array[voters[1],voters[2]] end;
  count_calls:=cardinality(subjects); done:=array_fill(false,array[count_calls]);
  results:=array_fill(null::jsonb,array[count_calls]); member_deltas:=array_fill(0,array[count_calls]); update_deltas:=array_fill(0,array[count_calls]);
  stats_query:='select jsonb_build_object(''members'',coalesce((select n_tup_ins from pg_stat_xact_user_tables where relid=''public.room_members''::regclass),0),
    ''updates'',coalesce((select n_tup_upd from pg_stat_xact_user_tables where relid=''public.rooms''::regclass),0))';
  row_query:=format('select jsonb_build_object(''row'',to_jsonb(r),''xmin'',xmin::text,
    ''members'',(select jsonb_agg(to_jsonb(m) order by m.id) from public.room_members m where m.room_id=r.id)) from public.rooms r where id=%L',rid);
  begin
    perform extensions.dblink_connect(own,conninfo);
    perform extensions.dblink_exec(own,'set statement_timeout=''10s''; set lock_timeout=''5s''');
    opid:=pg_temp.remote_json(own,'select to_jsonb(pg_backend_pid())')::integer;
    perform extensions.dblink_exec(own,format(
      'begin; insert into auth.users(id) values(%1$L),(%2$L),(%3$L),(%4$L);
       insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count)
         values(%5$L,%6$L,%7$L,%1$L,%8$s,%9$s);
       insert into public.room_members(room_id,user_id,is_voter) values(%5$L,%1$L,%10$L);
       insert into public.room_members(room_id,user_id,is_voter) select %5$L,%2$L,true where %11$L::boolean; commit',
      creator,voters[1],voters[2],voters[3],rid,code,extensions.gen_random_uuid(),target,initial,initial<>0,kind='member_recovery'));
    for i in 1..count_calls loop
      name:=ns||'_'||i; names:=array_append(names,name);
      perform extensions.dblink_connect(name,conninfo);
      perform extensions.dblink_exec(name,'set statement_timeout=''20s''; set lock_timeout=''15s''');
      pids:=array_append(pids,pg_temp.remote_json(name,'select to_jsonb(pg_backend_pid())')::integer);
      perform pg_temp.caller(name,subjects[i]);
      base:=array_append(base,pg_temp.remote_json(name,stats_query));
    end loop;
    perform pg_temp.require((select count(distinct pid) from unnest(pids||opid) pid)=count_calls+1,'independent caller/owner PIDs');
    evidence:=array_append(evidence,'independent authenticated subjects and READ COMMITTED verified');
    perform extensions.dblink_exec(own,'begin');
    perform pg_temp.remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',rid));
    for i in 1..count_calls loop
      perform pg_temp.require(extensions.dblink_send_query(names[i],format('select to_jsonb(r) from public.join_room(%L) r',code))=1,'real join dispatched');
    end loop;
    deadline:=clock_timestamp()+interval '8 seconds';
    loop
      chain_ok:=true;
      for i in 1..count_calls loop
        chain_ok:=chain_ok and extensions.dblink_is_busy(names[i])=1 and cardinality(pg_blocking_pids(pids[i]))>0
          and pg_blocking_pids(pids[i]) && (pids||opid)
          and exists(select 1 from pg_locks where pid=pids[i] and not granted and locktype in('tuple','transactionid'));
      end loop;
      exit when chain_ok and exists(select 1 from unnest(pids) pid where opid=any(pg_blocking_pids(pid)));
      if clock_timestamp()>deadline then raise exception 'all join calls did not overlap on observable owner row-lock chain'; end if;
    end loop;
    evidence:=array_append(evidence,'all real RPCs outstanding, pg_blocking_pids/pg_locks prove owner row-lock overlap');
    perform extensions.dblink_exec(own,'commit');
    while committed<count_calls loop
      deadline:=clock_timestamp()+interval '8 seconds'; winner:=null;
      loop
        for i in 1..count_calls loop
          if not done[i] and extensions.dblink_is_busy(names[i])=0 then winner:=i; exit; end if;
        end loop;
        exit when winner is not null;
        if clock_timestamp()>deadline then raise exception 'no serialized join completed'; end if;
      end loop;
      if committed<count_calls-1 then
        deadline:=clock_timestamp()+interval '8 seconds';
        loop
          exit when exists(select 1 from generate_series(1,count_calls) k where k<>winner and not done[k]
            and pids[winner]=any(pg_blocking_pids(pids[k])) and extensions.dblink_is_busy(names[k])=1
            and exists(select 1 from pg_locks where pid=pids[k] and not granted and locktype in('tuple','transactionid')));
          if clock_timestamp()>deadline then raise exception 'remaining caller never blocked directly on uncommitted winner'; end if;
        end loop;
        evidence:=array_append(evidence,'remaining real caller blocked directly on winner before its COMMIT');
      end if;
      results[winner]:=pg_temp.collect(names[winner]);
      snapshot:=pg_temp.remote_json(names[winner],stats_query);
      member_deltas[winner]:=(snapshot->>'members')::integer-(base[winner]->>'members')::integer;
      update_deltas[winner]:=(snapshot->>'updates')::integer-(base[winner]->>'updates')::integer;
      perform pg_temp.require(member_deltas[winner]=case when results[winner]->>'outcome'='joined' then 1 else 0 end
        and update_deltas[winner]=member_deltas[winner],'exact one/zero INSERT and room UPDATE for each actual outcome');
      admitted:=admitted+member_deltas[winner];
      perform extensions.dblink_exec(names[winner],'commit');
      snapshot:=pg_temp.remote_json(own,row_query);
      perform pg_temp.require((snapshot->'row'->>'voter_count')::integer=initial+admitted
        and (snapshot->'row'->>'required_voter_count')::integer=target
        and snapshot->'row'->>'state'=case when initial+admitted=target then 'ready' else 'waiting' end,
        'committed summary/state exact after EACH caller commit');
      perform pg_temp.require(pg_temp.remote_json(own,format(
        'select to_jsonb(r.voter_count=(select count(*) from public.room_members m where m.room_id=r.id and m.is_voter)
          and 1=(select count(*) from public.room_members m where m.room_id=r.id and m.user_id=r.creator_user_id)) from public.rooms r where id=%L',rid))::boolean,
        'summary equals persisted voter rows and exactly one creator after EACH commit');
      if committed=0 then first_snapshot:=snapshot;
      elsif kind in('same_identity','final_slot') then
        perform pg_temp.require(snapshot=first_snapshot,'no-write loser preserves whole room/member snapshot AND first-commit xmin');
      end if;
      done[winner]:=true; committed:=committed+1;
    end loop;
    if kind in('same_identity','final_slot') then
      perform pg_temp.require(admitted=1 and (select array_agg(v order by v) from unnest(member_deltas) v)=array[0,1],
        'one authoritative admission, caller INSERT/UPDATE deltas 1/0');
      perform pg_temp.require((select count(*) from unnest(results) r where r->>'outcome'='joined')=1
        and (select count(*) from unnest(results) r where r->>'outcome'=case when kind='same_identity' then 'already_member' else 'full' end)=1,
        'one joined and exact idempotent/full loser outcome');
      if kind='same_identity' then
        perform pg_temp.require(initial+admitted<target and (results[1]-'outcome')=(results[2]-'outcome'),
          'duplicate identity consumes one slot while another remains; identical projections');
      end if;
      evidence:=array_append(evidence,'winner INSERT/UPDATE=1/1; loser=0/0; first committed xmin unchanged by loser');
    elsif kind='member_recovery' then
      perform pg_temp.require(admitted=1 and results[1]->>'outcome'='already_member' and results[2]->>'outcome'='joined'
        and member_deltas=array[0,1] and update_deltas=array[0,1],'admitted voter recovery does not compete for the final slot');
      evidence:=array_append(evidence,'admitted recovery INSERT/UPDATE=0/0; final admission=1/1');
    else
      perform pg_temp.require(admitted=count_calls and member_deltas=array_fill(1,array[count_calls])
        and update_deltas=array_fill(1,array[count_calls]),'every distinct caller admitted with exactly one member INSERT and room UPDATE');
      evidence:=array_append(evidence,'each distinct caller INSERT/UPDATE=1/1; every available slot filled');
    end if;
    for i in 1..count_calls loop
      if results[i]->>'outcome'='full' then
        perform pg_temp.require(results[i]=jsonb_build_object('outcome','full','room_id',null,'room_code',null,'room_state',null,
          'is_creator',null,'is_voter',null,'voter_count',null,'required_voter_count',null,
          'filter_completed_count',null),'full exact all-null private projection');
      else
        perform pg_temp.require(results[i]=jsonb_build_object('outcome',results[i]->>'outcome','room_id',rid,'room_code',code,
          'room_state',results[i]->>'room_state','is_creator',false,'is_voter',true,
          'voter_count',(results[i]->>'voter_count')::integer,'required_voter_count',target,
          'filter_completed_count',0)
          and (results[i]->>'voter_count')::integer between initial and target
          and results[i]->>'room_state'=case when (results[i]->>'voter_count')::integer=target then 'ready' else 'waiting' end,
          'exact accepted generalized projection for actual voter');
      end if;
    end loop;
    perform pg_temp.require(pg_temp.remote_json(own,format('select to_jsonb(is_voter=%L) from public.room_members where room_id=%L and user_id=%L',initial<>0,rid,creator))::boolean,
      'creator original voting choice preserved');
    evidence:=array_append(evidence,'count/member equality after every commit; immutable creator choice; exact outcome shapes');
  exception when query_canceled or others then failure:=SQLSTATE||': '||left(SQLERRM,180);
  end;
  -- Only this trial's connections, PIDs and fixtures are owned by cleanup.
  for i in 1..cardinality(names) loop
    name:=names[i];
    begin
      if name=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
        if extensions.dblink_is_busy(name)=1 then
          perform extensions.dblink_cancel_query(name);
          begin perform pg_temp.await_ready(name); exception when query_canceled or others then perform pg_terminate_backend(pids[i]); end;
        end if;
        begin
          perform j from extensions.dblink_get_result(name,false) as t(j jsonb);
          perform j from extensions.dblink_get_result(name,false) as t(j jsonb);
          perform extensions.dblink_exec(name,'rollback');
        exception when query_canceled or others then perform pg_terminate_backend(pids[i]); end;
        perform extensions.dblink_disconnect(name);
      end if;
    exception when query_canceled or others then cleanup_failure:='caller cleanup failed'; end;
  end loop;
  begin
    if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      perform extensions.dblink_exec(own,'rollback');
      perform extensions.dblink_exec(own,format('begin; delete from public.rooms where id=%L; delete from auth.users where id in(%L,%L,%L,%L); commit',rid,creator,voters[1],voters[2],voters[3]));
      perform pg_temp.require(pg_temp.remote_json(own,format('select to_jsonb(not exists(select 1 from public.rooms where id=%L) and not exists(select 1 from public.room_members where room_id=%L) and not exists(select 1 from auth.users where id in(%L,%L,%L,%L)))',rid,rid,creator,voters[1],voters[2],voters[3]))::boolean,'owned rows/users/members cleaned');
      perform extensions.dblink_disconnect(own);
    end if;
  exception when query_canceled or others then
    cleanup_failure:='owner cleanup failed';
    if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then perform extensions.dblink_disconnect(own); end if;
  end;
  deadline:=clock_timestamp()+interval '5 seconds';
  loop
    perform pg_stat_clear_snapshot();
    exit when not exists(select 1 from pg_stat_activity where pid=any(pids||opid));
    if clock_timestamp()>deadline then cleanup_failure:='caller backend remained'; exit; end if;
  end loop;
  foreach label in array evidence loop return next ok(true,kind||': '||label); end loop;
  return next ok(failure is null and committed=count_calls,kind||': complete deterministic real-session trial');
  if failure is not null then return next diag(failure); end if;
  return next ok(cleanup_failure is null and not ((names||own)&&coalesce(extensions.dblink_get_connections(),array[]::text[])),kind||': exact fixture/backend cleanup');
  if cleanup_failure is not null then return next diag(cleanup_failure); end if;
end;
$trial$;
set local statement_timeout='120s';
select * from pg_temp.member_race('same_identity');
select * from pg_temp.member_race('final_slot');
select * from pg_temp.member_race('multiple_slots');
select * from pg_temp.member_race('zero_to_three');
select * from pg_temp.member_race('member_recovery');
set local statement_timeout='15s';

-- A blocked real admission in one room cannot hold an unrelated room hostage.
create function pg_temp.cross_room_trial() returns setof text language plpgsql as $trial$
declare
  ns text:='membership_cross_'||encode(extensions.gen_random_bytes(8),'hex');
  own text:=ns||'_owner'; a text:=ns||'_a'; b text:=ns||'_b'; name text;
  conninfo text:='dbname=postgres user=postgres connect_timeout=3';
  creator uuid:=extensions.gen_random_uuid(); voter uuid:=extensions.gen_random_uuid();
  r1 uuid:=extensions.gen_random_uuid(); r2 uuid:=extensions.gen_random_uuid();
  c1 text:=upper(encode(extensions.gen_random_bytes(5),'hex')); c2 text:=upper(encode(extensions.gen_random_bytes(5),'hex'));
  p1 integer; p2 integer; po integer; deadline timestamptz; result jsonb; failure text; cleaned boolean:=true;
begin
  begin
    perform extensions.dblink_connect(own,conninfo);
    perform extensions.dblink_exec(own,format('begin; insert into auth.users(id) values(%1$L),(%2$L);
      insert into public.rooms(id,code,creation_request_id,creator_user_id,voter_count) values
      (%3$L,%4$L,%5$L,%1$L,1),(%6$L,%7$L,%8$L,%1$L,1);
      insert into public.room_members(room_id,user_id,is_voter) values(%3$L,%1$L,true),(%6$L,%1$L,true); commit',
      creator,voter,r1,c1,extensions.gen_random_uuid(),r2,c2,extensions.gen_random_uuid()));
    perform extensions.dblink_connect(a,conninfo); perform extensions.dblink_connect(b,conninfo);
    perform pg_temp.caller(a,voter); perform pg_temp.caller(b,voter);
    p1:=pg_temp.remote_json(a,'select to_jsonb(pg_backend_pid())')::integer;
    p2:=pg_temp.remote_json(b,'select to_jsonb(pg_backend_pid())')::integer;
    po:=pg_temp.remote_json(own,'select to_jsonb(pg_backend_pid())')::integer;
    perform extensions.dblink_exec(own,'begin');
    perform pg_temp.remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',r1));
    perform extensions.dblink_send_query(a,format('select to_jsonb(r) from public.join_room(%L) r',c1));
    deadline:=clock_timestamp()+interval '5 seconds';
    loop
      exit when extensions.dblink_is_busy(a)=1 and po=any(pg_blocking_pids(p1))
        and exists(select 1 from pg_locks where pid=p1 and not granted and locktype in('transactionid','tuple'));
      if clock_timestamp()>deadline then raise exception 'first room lock not observed'; end if;
    end loop;
    perform extensions.dblink_send_query(b,format('select to_jsonb(r) from public.join_room(%L) r',c2));
    perform pg_temp.await_ready(b); result:=pg_temp.collect(b);
    perform pg_temp.require(result->>'outcome'='joined' and extensions.dblink_is_busy(a)=1
      and po=any(pg_blocking_pids(p1)),'unrelated real join completes while first room remains locked');
    perform extensions.dblink_exec(b,'commit');
    perform pg_temp.require(pg_temp.remote_json(own,format('select to_jsonb(voter_count=2 and state=''ready'' and
      voter_count=(select count(*) from public.room_members m where m.room_id=r.id and m.is_voter)) from public.rooms r where id=%L',r2))::boolean,
      'independent commit retains membership/count equality');
    perform extensions.dblink_exec(own,'commit');
    perform pg_temp.await_ready(a); result:=pg_temp.collect(a);
    perform pg_temp.require(result->>'outcome'='joined','blocked room resumes normally');
    perform extensions.dblink_exec(a,'commit');
  exception when query_canceled or others then failure:=SQLSTATE||': '||left(SQLERRM,160); end;
  foreach name in array array[a,b] loop
    begin
      if name=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
        if extensions.dblink_is_busy(name)=1 then perform extensions.dblink_cancel_query(name); perform pg_temp.await_ready(name); end if;
        perform j from extensions.dblink_get_result(name,false) as t(j jsonb);
        perform j from extensions.dblink_get_result(name,false) as t(j jsonb);
        perform extensions.dblink_exec(name,'rollback'); perform extensions.dblink_disconnect(name);
      end if;
    exception when query_canceled or others then
      cleaned:=false; perform pg_terminate_backend(case when name=a then p1 else p2 end);
      if name=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then perform extensions.dblink_disconnect(name); end if;
    end;
  end loop;
  begin
    perform extensions.dblink_exec(own,'rollback');
    perform extensions.dblink_exec(own,format('begin; delete from public.rooms where id in(%L,%L); delete from auth.users where id in(%L,%L); commit',r1,r2,creator,voter));
    perform extensions.dblink_disconnect(own);
  exception when query_canceled or others then cleaned:=false;
    if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then perform extensions.dblink_disconnect(own); end if;
  end;
  deadline:=clock_timestamp()+interval '5 seconds';
  loop
    perform pg_stat_clear_snapshot();
    exit when not exists(select 1 from pg_stat_activity where pid in(p1,p2,po));
    if clock_timestamp()>deadline then cleaned:=false; exit; end if;
  end loop;
  return next ok(failure is null,'two independent rooms: blocked admission cannot block unrelated real join/commit');
  if failure is not null then return next diag(failure); end if;
  return next ok(cleaned and not(array[a,b,own]&&coalesce(extensions.dblink_get_connections(),array[]::text[])),
    'independent rooms: only owned fixture/connections removed');
end;
$trial$;
select * from pg_temp.cross_room_trial();

-- Feature 003 T007: final catalogs before any owner fixtures or RPC calls.
select results_eq(
  $$select relname::text collate "default" from pg_class where relnamespace='public'::regnamespace
    and relkind in ('r','p') order by relname$$,
  $$values ('movie_candidates'::text),('participant_filters'),('room_members'),('rooms')$$,
  'exactly four application relations; separate membership and private filter authorities');
select results_eq(
  $$select attname::text collate "default",format_type(atttypid,atttypmod) collate "default",attnotnull,
    attgenerated::text collate "default" from pg_attribute
    where attrelid=to_regclass('public.rooms') and attnum>0 and not attisdropped order by attname$$,
  $$values ('code'::text,'text'::text,true,''::text),('created_at','timestamp with time zone',true,''),
    ('creation_request_id','uuid',true,''),('creator_user_id','uuid',true,''),
    ('filter_completed_count','integer',true,''),('id','uuid',true,''),
    ('movie_candidate_id','text',false,''),('required_voter_count','integer',true,''),
    ('state','text',true,'s'),('updated_at','timestamp with time zone',true,''),('voter_count','integer',true,'')$$,
  'exact eleven rooms columns/types/nullability/generated state; no host/guest');
select results_eq(
  $$select attname::text collate "default",format_type(atttypid,atttypmod) collate "default",attnotnull,
    attgenerated::text collate "default" from pg_attribute
    where attrelid=to_regclass('public.room_members') and attnum>0 and not attisdropped order by attname$$,
  $$values ('id'::text,'uuid'::text,true,''::text),('is_voter','boolean',true,''),
    ('joined_at','timestamp with time zone',true,''),('room_id','uuid',true,''),('user_id','uuid',true,'')$$,
  'exact five nonnullable member columns; no redundant creator flag or roster data');
select results_eq(
  $$select a.attname::text collate "default",pg_get_expr(d.adbin,d.adrelid) collate "default"
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=to_regclass('public.rooms') and a.attnum>0 and not a.attisdropped
    and a.attgenerated='' order by a.attname$$,
  $$values ('code'::text,null::text),('created_at','transaction_timestamp()'),('creation_request_id',null),
    ('creator_user_id',null),('filter_completed_count','0'),('id','extensions.gen_random_uuid()'),('movie_candidate_id',null),
    ('required_voter_count','2'),('updated_at','transaction_timestamp()'),('voter_count','0')$$,
  'room defaults retain UUID/timestamps; target2 and count0; no implicit public RPC choice');
select results_eq(
  $$select a.attname::text collate "default",pg_get_expr(d.adbin,d.adrelid) collate "default"
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=to_regclass('public.room_members') and a.attnum>0 and not a.attisdropped order by a.attname$$,
  $$values ('id'::text,'extensions.gen_random_uuid()'::text),('is_voter',null),
    ('joined_at','transaction_timestamp()'),('room_id',null),('user_id',null)$$,
  'member defaults require explicit membership/voting input');
select results_eq(
  $$select btrim(regexp_replace(pg_get_expr(d.adbin,d.adrelid),'\s+',' ','g')) collate "default"
    from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
    where a.attrelid=to_regclass('public.rooms') and a.attname='state'$$,
  $$values ($e$CASE WHEN (voter_count = required_voter_count) THEN 'ready'::text ELSE 'waiting'::text END$e$::text)$$,
  'generated state uses only voter count and target');
select results_eq(
  $$select conname::text collate "default",contype::text collate "default",pg_get_constraintdef(oid) collate "default",
    convalidated,condeferrable,condeferred from pg_constraint where conrelid=to_regclass('public.rooms') order by conname$$,
  $$values
    ('rooms_candidate_requires_ready_check'::text,'c'::text,'CHECK (((movie_candidate_id IS NULL) OR (voter_count = required_voter_count)))'::text,true,false,false),
    ('rooms_code_format_check','c',$c$CHECK ((code ~ '^[0-9A-F]{10}$'::text))$c$,true,false,false),
    ('rooms_code_key','u','UNIQUE (code)',true,false,false),
    ('rooms_creator_creation_request_key','u','UNIQUE (creator_user_id, creation_request_id)',true,false,false),
    ('rooms_creator_user_id_fkey','f','FOREIGN KEY (creator_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT',true,false,false),
    ('rooms_filter_completed_count_check','c','CHECK (((filter_completed_count >= 0) AND (filter_completed_count <= required_voter_count)))',true,false,false),
    ('rooms_filters_require_assembled_check','c',$c$CHECK (((filter_completed_count = 0) OR (voter_count = required_voter_count)))$c$,true,false,false),
    ('rooms_movie_candidate_id_fkey','f','FOREIGN KEY (movie_candidate_id) REFERENCES movie_candidates(id) ON DELETE RESTRICT',true,false,false),
    ('rooms_pkey','p','PRIMARY KEY (id)',true,false,false),
    ('rooms_required_voter_count_check','c','CHECK ((required_voter_count >= 2))',true,false,false),
    ('rooms_voter_count_check','c','CHECK (((voter_count >= 0) AND (voter_count <= required_voter_count)))',true,false,false)$$,
  'exact named validated immediate room constraints');
select results_eq(
  $$select conname::text collate "default",pg_get_constraintdef(oid) collate "default",convalidated,condeferrable,condeferred
    from pg_constraint where conrelid=to_regclass('public.room_members') order by conname$$,
  $$values ('room_members_pkey'::text,'PRIMARY KEY (id)'::text,true,false,false),
    ('room_members_room_id_fkey','FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE',true,false,false),
    ('room_members_room_user_key','UNIQUE (room_id, user_id)',true,false,false),
    ('room_members_user_id_fkey','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT',true,false,false)$$,
  'exact member constraints and cleanup/Auth deletion rules');
select ok(confupdtype='a' and confdeltype=case when conname='room_members_room_id_fkey' then 'c'::"char" else 'r'::"char" end,
  conname || ': exact FK actions') from pg_constraint
  where conrelid in (to_regclass('public.rooms'),to_regclass('public.room_members')) and contype='f';
select results_eq(
  $$select c.relname::text collate "default",am.amname::text collate "default",i.indisunique,i.indisvalid,i.indisready,
    pg_get_indexdef(i.indexrelid,1,true) collate "default",
    (case when i.indnkeyatts>1 then pg_get_indexdef(i.indexrelid,2,true) end) collate "default",
    i.indnkeyatts::integer,i.indnatts::integer,pg_get_expr(i.indpred,i.indrelid) collate "default"
    from pg_index i join pg_class c on c.oid=i.indexrelid join pg_am am on am.oid=c.relam
    where i.indrelid in (to_regclass('public.rooms'),to_regclass('public.room_members')) order by c.relname$$,
  $$values ('room_members_pkey'::text,'btree'::text,true,true,true,'id'::text,null::text,1,1,null::text),
    ('room_members_room_user_key','btree',true,true,true,'room_id','user_id',2,2,null),
    ('rooms_code_key','btree',true,true,true,'code',null,1,1,null),
    ('rooms_creator_creation_request_key','btree',true,true,true,'creator_user_id','creation_request_id',2,2,null),
    ('rooms_pkey','btree',true,true,true,'id',null,1,1,null)$$,
  'exact five valid unique B-tree indexes; no guest/speculative index');
select is((select count(*) from pg_trigger where tgrelid in (to_regclass('public.rooms'),to_regclass('public.room_members'))
  and not tgisinternal),0::bigint,'no count/state/timestamp application trigger');
-- Owner-only observation; each tested operation changes to authenticated with
-- an actual subject. These helpers are temporary, invoker functions, not APIs.
create function pg_temp.rpc(subject uuid, command text) returns jsonb language plpgsql as $f$
declare result jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
  if current_user<>'authenticated' or auth.uid() is distinct from subject then
    raise exception 'test caller identity mismatch';
  end if;
  execute 'select jsonb_agg(to_jsonb(r)) from (' || command || ') r' into result;
  reset role;
  return result;
exception when others then reset role; raise;
end;
$f$;
create function pg_temp.fails(subject uuid, command text, expected text) returns boolean language plpgsql as $f$
declare seen text;
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub','',true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
    if current_user<>'authenticated' or auth.uid() is distinct from subject then raise exception 'test caller identity mismatch'; end if;
    execute command;
  exception when others then seen:=SQLSTATE;
  end;
  reset role;
  return seen is not distinct from expected;
end;
$f$;
create function pg_temp.snapshot() returns jsonb language plpgsql as $f$
begin
  return jsonb_build_object('rooms',(select jsonb_agg(jsonb_build_object('row',to_jsonb(r),'xmin',xmin::text,'ctid',ctid::text) order by id) from public.rooms r),
    'members',(select jsonb_agg(jsonb_build_object('row',to_jsonb(m),'xmin',xmin::text,'ctid',ctid::text) order by id) from public.room_members m));
end;
$f$;
create function pg_temp.coherent() returns boolean language plpgsql as $f$
begin
  return not exists(select 1 from public.rooms r where
    r.voter_count<>(select count(*) from public.room_members m where m.room_id=r.id and m.is_voter)
    or 1<>(select count(*) from public.room_members m where m.room_id=r.id and m.user_id=r.creator_user_id)
    or exists(select 1 from public.room_members m where m.room_id=r.id and not m.is_voter and m.user_id<>r.creator_user_id));
end;
$f$;
create function pg_temp.stats() returns bigint[] language sql as $f$
  select array[
    coalesce((select n_tup_ins from pg_stat_xact_user_tables where relid='public.rooms'::regclass),0),
    coalesce((select n_tup_ins from pg_stat_xact_user_tables where relid='public.room_members'::regclass),0),
    coalesce((select n_tup_upd from pg_stat_xact_user_tables where relid='public.rooms'::regclass),0)]
$f$;

-- T008/T009: four complete configurations, real admissions and no-write paths.
create function pg_temp.configuration_trials() returns setof text language plpgsql as $trial$
declare
  target integer; voting boolean; creator uuid; subjects uuid[]; request uuid; rid uuid; code text;
  result jsonb; expected jsonb; before_state jsonb; before_counts bigint[]; after_counts bigint[];
  initial integer; n integer; who uuid; command text; label text; bad record;
begin
  foreach target in array array[2,3] loop
    foreach voting in array array[true,false] loop
      creator:=extensions.gen_random_uuid(); request:=extensions.gen_random_uuid();
      subjects:=array[extensions.gen_random_uuid(),extensions.gen_random_uuid(),extensions.gen_random_uuid(),extensions.gen_random_uuid()];
      insert into auth.users(id) values (creator);
      insert into auth.users(id) select unnest(subjects);
      initial:=case when voting then 1 else 0 end;
      label:=format('target%s creator-voter=%s',target,voting);
      before_counts:=pg_temp.stats();
      result:=pg_temp.rpc(creator,format('select * from public.create_room(%L,%s,%L)',request,target,voting));
      after_counts:=pg_temp.stats();
      return next ok(after_counts[1]-before_counts[1]=1 and after_counts[2]-before_counts[2]=1
        and after_counts[3]-before_counts[3]=0,label || ': one room INSERT, one member INSERT, ZERO initialization UPDATEs');
      rid:=(result->0->>'room_id')::uuid; code:=result->0->>'room_code';
      expected:=jsonb_build_array(jsonb_build_object('outcome','created','room_id',rid,'room_code',code,'room_state','waiting',
        'is_creator',true,'is_voter',voting,'voter_count',initial,'required_voter_count',target,
        'filter_completed_count',0));
      return next ok(result=expected and code ~ '^[0-9A-F]{10}$' and rid is not null,label || ': exact singleton nine-field created projection');
      return next ok((select creator_user_id=creator and creation_request_id=request and voter_count=initial
        and required_voter_count=target and state='waiting' and movie_candidate_id is null
        and created_at=transaction_timestamp() and updated_at=transaction_timestamp() from public.rooms where id=rid)
        and (select count(*)=1 and bool_and(is_voter=voting) from public.room_members where room_id=rid and user_id=creator)
        and pg_temp.coherent(),label || ': complete room plus exact immutable creator membership and count');
      before_state:=pg_temp.snapshot();
      result:=pg_temp.rpc(creator,format('select * from public.create_room(%L,%s,%L)',request,5,not voting));
      return next ok(result=jsonb_set(expected,'{0,outcome}','"already_created"') and pg_temp.snapshot()=before_state
        and pg_temp.coherent(),label || ': conflicting valid retry recovers original configuration without writes');
      result:=pg_temp.rpc(creator,format('select * from public.join_room(%L)','  '||lower(code)||'  '));
      return next ok(result=jsonb_set(expected,'{0,outcome}','"already_member"') and pg_temp.snapshot()=before_state
        and pg_temp.coherent(),label || ': normalized creator recovery consumes zero slots');
      for bad in select * from (values
        ('null,2,true','22004'),(quote_literal(request)||',null,true','22004'),
        (quote_literal(request)||',2,null','22004'),(quote_literal(request)||',1,true','22023'),
        (quote_literal(request)||',0,true','22023'),(quote_literal(request)||',-1,false','22023'),
        (quote_literal(request)||',''2.5''::integer,true','22P02'),
        (quote_literal(request)||',''abc''::integer,true','22P02'),
        (quote_literal(request)||',''2147483648''::integer,true','22003'),
        ('''bad''::uuid,2,true','22P02'),(quote_literal(request)||',2,''bad''::boolean','22P02')) x(args,code) loop
        return next ok(pg_temp.fails(creator,'select * from public.create_room('||bad.args||')',bad.code)
          and pg_temp.snapshot()=before_state and pg_temp.coherent(),label || ': invalid create/retry '||bad.code||' preserves coherent state');
      end loop;
      for n in 1..(target-initial) loop
        before_counts:=pg_temp.stats();
        result:=pg_temp.rpc(subjects[n],format('select * from public.join_room(%L)',lower(code)));
        after_counts:=pg_temp.stats();
        expected:=jsonb_build_array(jsonb_build_object('outcome','joined','room_id',rid,'room_code',code,
          'room_state',case when initial+n=target then 'ready' else 'waiting' end,'is_creator',false,'is_voter',true,
          'voter_count',initial+n,'required_voter_count',target,'filter_completed_count',0));
        return next ok(result=expected and after_counts[1]-before_counts[1]=0
          and after_counts[2]-before_counts[2]=1 and after_counts[3]-before_counts[3]=1,
          label || ': admission '||n||' exact result and one member/room mutation');
        return next ok(pg_temp.coherent() and (select voter_count=initial+n and updated_at=transaction_timestamp()
          and required_voter_count=target and creator_user_id=creator and creation_request_id=request
          from public.rooms where id=rid),label || ': count equals voter rows after each admission');
        before_state:=pg_temp.snapshot();
        result:=pg_temp.rpc(subjects[n],format('select * from public.join_room(%L)',code));
        return next ok(result=jsonb_set(expected,'{0,outcome}','"already_member"') and pg_temp.snapshot()=before_state
          and pg_temp.coherent(),label || ': admitted voter recovery preserves row versions/count at every occupancy');
      end loop;
      before_state:=pg_temp.snapshot();
      result:=pg_temp.rpc(creator,format('select * from public.create_room(%L,%s,%L)',request,7,not voting));
      expected:=jsonb_build_array(jsonb_build_object('outcome','already_created','room_id',rid,'room_code',code,
        'room_state','ready','is_creator',true,'is_voter',voting,'voter_count',target,
        'required_voter_count',target,'filter_completed_count',0));
      return next ok(result=expected and pg_temp.snapshot()=before_state and pg_temp.coherent(),label || ': Ready create retry returns original current configuration with ZERO UPDATE');
      result:=pg_temp.rpc(creator,format('select * from public.join_room(%L)',code));
      return next ok(result=jsonb_set(expected,'{0,outcome}','"already_member"') and pg_temp.snapshot()=before_state
        and pg_temp.coherent(),label || ': creator recovery before full preserves voting choice');
      result:=pg_temp.rpc(subjects[4],format('select * from public.join_room(%L)',code));
      return next ok(result=jsonb_build_array(jsonb_build_object('outcome','full','room_id',null,'room_code',null,'room_state',null,
        'is_creator',null,'is_voter',null,'voter_count',null,'required_voter_count',null,
        'filter_completed_count',null))
        and pg_temp.snapshot()=before_state and pg_temp.coherent(),label || ': new full rejection exact NULL shape and no writes');
      delete from public.rooms where id=rid;
      return next ok(not exists(select 1 from public.room_members where room_id=rid),label || ': whole-room test cleanup cascades members');
      delete from auth.users where id=creator or id=any(subjects);
    end loop;
  end loop;
end;
$trial$;
select * from pg_temp.configuration_trials();

-- T010: fault subtransactions restore exact IDs/flags; corrupt snapshots are
-- compared BEFORE rolling back corruption, so an illicit repair cannot hide.
create function pg_temp.integrity_trials() returns setof text language plpgsql as $trial$
declare
  voting boolean; assembled boolean; creator uuid; voter uuid; other uuid; request uuid; rid uuid; code text;
  original jsonb; corrupted jsonb; failed boolean; preserved boolean; recovery_failed boolean; member_id uuid; result jsonb; label text;
begin
  foreach voting in array array[true,false] loop
    foreach assembled in array array[false,true] loop
      creator:=extensions.gen_random_uuid(); voter:=extensions.gen_random_uuid(); other:=extensions.gen_random_uuid(); request:=extensions.gen_random_uuid();
      insert into auth.users(id) values(creator),(voter),(other);
      result:=pg_temp.rpc(creator,format('select * from public.create_room(%L,2,%L)',request,voting));
      rid:=(result->0->>'room_id')::uuid; code:=result->0->>'room_code';
      if assembled then
        perform pg_temp.rpc(voter,format('select * from public.join_room(%L)',code));
        if not voting then perform pg_temp.rpc(other,format('select * from public.join_room(%L)',code)); end if;
      end if;
      select id into member_id from public.room_members where room_id=rid and user_id=creator;
      original:=pg_temp.snapshot(); label:=format('creator-voter=%s assembled=%s',voting,assembled);
      begin
        delete from public.room_members where id=member_id;
        corrupted:=pg_temp.snapshot();
        failed:=pg_temp.fails(creator,format('select * from public.join_room(%L)',code),'P0001');
        preserved:=pg_temp.snapshot()=corrupted and not exists(select 1 from public.room_members where room_id=rid and user_id=creator);
        recovery_failed:=pg_temp.fails(creator,format('select * from public.create_room(%L,3,%L)',request,not voting),'P0001')
          and pg_temp.snapshot()=corrupted;
        raise exception using errcode='ZX001',message='restore controlled corruption';
      exception when sqlstate 'ZX001' then null;
      end;
      return next ok(failed and preserved,label || ': missing creator join throws BEFORE capacity, no repair/promotion/row write');
      return next ok(recovery_failed,label || ': creation recovery cannot repair missing member');
      return next ok(pg_temp.snapshot()=original and pg_temp.coherent()
        and (select id=member_id and is_voter=voting from public.room_members where room_id=rid and user_id=creator),
        label || ': exact original member ID/choice/count restored');
      result:=pg_temp.rpc(creator,format('select * from public.join_room(%L)',code));
      return next ok(result->0->>'outcome'='already_member' and (result->0->>'is_voter')::boolean=voting
        and pg_temp.snapshot()=original and pg_temp.coherent(),label || ': normal recovered creator retains original contribution');
      if not assembled then perform pg_temp.rpc(voter,format('select * from public.join_room(%L)',code)); end if;
      original:=pg_temp.snapshot();
      begin
        update public.room_members set is_voter=false where room_id=rid and user_id=voter;
        corrupted:=pg_temp.snapshot();
        failed:=pg_temp.fails(voter,format('select * from public.join_room(%L)',code),'P0001')
          and pg_temp.snapshot()=corrupted;
        raise exception using errcode='ZX001',message='restore controlled corruption';
      exception when sqlstate 'ZX001' then null;
      end;
      return next ok(failed,label || ': persisted false/false throws without projection/repair/write');
      return next ok(pg_temp.snapshot()=original and pg_temp.coherent(),label || ': false/false fault restoration exact');
      delete from public.rooms where id=rid;
      delete from auth.users where id in(creator,voter,other);
    end loop;
  end loop;
end;
$trial$;
select * from pg_temp.integrity_trials();

-- T011: exact function contracts and ACLs, independently of table RLS.
select results_eq(
  $$select p.proname::text collate "default",p.pronargs::integer,p.pronargdefaults::integer,
    p.proargnames collate "default",p.proargmodes,p.proallargtypes::regtype[]::text collate "default",p.proretset
    from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('create_room','join_room') order by p.proname$$,
  $$values ('create_room'::text,3,0,
    array['p_creation_request_id','p_required_voter_count','p_creator_is_voter','outcome','room_id','room_code','room_state','is_creator','is_voter','voter_count','required_voter_count','filter_completed_count'],
    array['i','i','i','t','t','t','t','t','t','t','t','t']::"char"[],
    '{uuid,integer,boolean,text,uuid,text,text,boolean,boolean,integer,integer,integer}'::text,true),
    ('join_room',1,0,array['p_room_code','outcome','room_id','room_code','room_state','is_creator','is_voter','voter_count','required_voter_count','filter_completed_count'],
    array['i','t','t','t','t','t','t','t','t','t']::"char"[],
    '{text,text,uuid,text,text,boolean,boolean,integer,integer,integer}',true)$$,
  'exact create/join arguments, no defaults/identity/old overload, nine ordered results');
select ok(to_regprocedure('public.create_room(uuid)') is null,'old one-argument create removed');
select results_eq(
  $$select n.nspname::text collate "default",p.proname::text collate "default",p.prosecdef,
    pg_get_userbyid(p.proowner)::text collate "default",p.proconfig collate "default",l.lanname::text collate "default",p.provolatile::text collate "default"
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
    where (n.nspname='public' and p.proname in ('create_room','join_room','ensure_room_candidate','get_my_participant_filter','submit_my_participant_filter'))
       or (n.nspname='private' and p.proname in ('is_room_member','valid_participant_genres')) order by n.nspname,p.proname$$,
  $$values ('private'::text,'is_room_member'::text,true,'postgres'::text,array['search_path=""'],'sql'::text,'s'::text),
    ('private','valid_participant_genres',false,'postgres',array['search_path=""'],'sql','i'),
    ('public','create_room',true,'postgres',array['search_path=""'],'plpgsql','v'),
    ('public','ensure_room_candidate',true,'postgres',array['search_path=""'],'plpgsql','v'),
    ('public','get_my_participant_filter',true,'postgres',array['search_path=""'],'plpgsql','v'),
    ('public','join_room',true,'postgres',array['search_path=""'],'plpgsql','v'),
    ('public','submit_my_participant_filter',true,'postgres',array['search_path=""'],'plpgsql','v')$$,
  'exact owners, SECURITY DEFINER, empty search_path, stable SQL helper');
select results_eq(
  $$select pronargs::integer,pronargdefaults::integer,proargnames collate "default",proargtypes::regtype[]::text collate "default",
    prorettype::regtype::text collate "default",proretset from pg_proc where oid=to_regprocedure('private.is_room_member(uuid)')$$,
  $$values (1,0,array['p_room_id'],'[0:0]={uuid}'::text,'boolean'::text,false)$$,
  'private helper has only room argument and scalar boolean result');
select ok((select array_agg(a.grantee::regrole::text||':'||a.privilege_type||':'||a.is_grantable order by a.grantee::regrole::text)
    from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=to_regprocedure(fn))
    =array['authenticated:EXECUTE:false','postgres:EXECUTE:false'],fn||': exact EXECUTE ACL, no PUBLIC/anon')
  from (values ('public.create_room(uuid,integer,boolean)'),('public.join_room(text)'),
    ('public.get_my_participant_filter(uuid)'),
    ('public.submit_my_participant_filter(uuid,participant_genre[],smallint,smallint)'),
    ('private.is_room_member(uuid)')) x(fn);
select ok(prosrc !~* '\mexecute\M|otteroom.test|pg_advisory' and prosrc ~ 'auth.uid\(\)' and prosrc ~ 'public.room_members',
  proname||': fixed qualified SQL, auth.uid only, no dynamic SQL/test hooks/advisory production lock')
  from pg_proc where oid in (to_regprocedure('public.create_room(uuid,integer,boolean)'),to_regprocedure('public.join_room(text)'),
    to_regprocedure('public.get_my_participant_filter(uuid)'),
    to_regprocedure('public.submit_my_participant_filter(uuid,participant_genre[],smallint,smallint)'),
    to_regprocedure('private.is_room_member(uuid)'));
select results_eq(
  $$select c.relname::text collate "default",c.relrowsecurity,pg_get_userbyid(c.relowner)::text collate "default"
    from pg_class c where c.oid in (to_regclass('public.rooms'),to_regclass('public.room_members'),to_regclass('public.movie_candidates'),to_regclass('public.participant_filters')) order by c.relname$$,
  $$values ('movie_candidates'::text,true,'postgres'::text),('participant_filters',true,'postgres'),('room_members',true,'postgres'),('rooms',true,'postgres')$$,
  'all application tables postgres-owned and RLS enabled');
select results_eq(
  $$select polname::text collate "default",polcmd::text collate "default",polpermissive,
    polroles=array['authenticated'::regrole::oid],pg_get_expr(polqual,polrelid) collate "default",polwithcheck is null
    from pg_policy where polrelid=to_regclass('public.rooms') order by polname$$,
  $$values ('rooms_select_member'::text,'r'::text,true,true,'private.is_room_member(id)'::text,true)$$,
  'one authenticated rooms SELECT policy through private member helper');
select is((select count(*) from pg_policy where polrelid in (to_regclass('public.room_members'),to_regclass('public.movie_candidates'),to_regclass('public.participant_filters'))),
  0::bigint,'member, filter and catalog have no client policy');
select is((select count(*) from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  where c.oid in (to_regclass('public.rooms'),to_regclass('public.room_members'),to_regclass('public.movie_candidates'),to_regclass('public.participant_filters'))
  and a.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid)),0::bigint,'no PUBLIC/client table-wide privileges');
select results_eq(
  $$select c.relname::text collate "default",a.attname::text collate "default",p.grantee::regrole::text collate "default",
    p.privilege_type collate "default",p.is_grantable from pg_attribute a join pg_class c on c.oid=a.attrelid
    cross join lateral aclexplode(a.attacl) p where a.attrelid in (to_regclass('public.rooms'),to_regclass('public.room_members'),to_regclass('public.movie_candidates'),to_regclass('public.participant_filters'))
    and p.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid) order by c.relname,a.attname,p.grantee,p.privilege_type$$,
  $$values ('rooms'::text,'code'::text,'authenticated'::text,'SELECT'::text,false),
    ('rooms','filter_completed_count','authenticated','SELECT',false),('rooms','id','authenticated','SELECT',false),
    ('rooms','required_voter_count','authenticated','SELECT',false),('rooms','state','authenticated','SELECT',false),
    ('rooms','voter_count','authenticated','SELECT',false)$$,
  'exact six column grants; no residual identity/request/member/filter/catalog privilege');
select ok(not has_table_privilege(role_name,table_name,privilege_name),role_name||' denied table-wide '||table_name||' '||privilege_name)
  from (values ('anon'),('authenticated')) r(role_name)
  cross join (values ('public.rooms'),('public.room_members'),('public.participant_filters'),('public.movie_candidates')) t(table_name)
  cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege_name);
select ok(not has_any_column_privilege(role_name,table_name,privilege_name),role_name||' denied column '||table_name||' '||privilege_name)
  from (values ('anon'),('authenticated')) r(role_name)
  cross join (values ('public.room_members'),('public.participant_filters'),('public.movie_candidates')) t(table_name)
  cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(privilege_name);
select ok(not has_any_column_privilege(role_name,'public.rooms',privilege_name),role_name||' denied rooms column '||privilege_name)
  from (values ('anon','SELECT'),('anon','INSERT'),('anon','UPDATE'),('anon','REFERENCES'),
    ('authenticated','INSERT'),('authenticated','UPDATE'),('authenticated','REFERENCES')) x(role_name,privilege_name);
select is((select count(*) from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
  where d.defaclrole='postgres'::regrole and d.defaclobjtype='r' and d.defaclnamespace in (0,'public'::regnamespace::oid)
  and a.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid)),0::bigint,'default table grants do not reopen clients');
select ok((select pg_get_userbyid(nspowner)='postgres' from pg_namespace where nspname='private')
  and has_schema_privilege('authenticated','private','USAGE') and not has_schema_privilege('authenticated','private','CREATE')
  and not has_schema_privilege('anon','private','USAGE') and not has_schema_privilege('anon','private','CREATE'),
  'private schema owner/USAGE and denied CREATE');
select is((select count(*) from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
  where n.nspname='private' and a.grantee in (0,'anon'::regrole::oid)),0::bigint,'private schema denied to PUBLIC/anon');
select ok(not exists(select 1 from pg_db_role_setting s cross join lateral unnest(s.setconfig) c
  where c ~ '^pgrst\.(db_schemas|db_extra_search_path)=' and c ~ '\mprivate\M'),
  'private is absent from API schemas/search-path role settings (config also validated at client gate)');
select results_eq($$select schemaname::text collate "default",tablename::text collate "default" from pg_publication_tables
    where pubname='supabase_realtime' order by 1,2$$,$$values ('public'::text,'rooms'::text)$$,'rooms-only Realtime; no member/catalog publication');
select ok((select not puballtables and pubupdate from pg_publication where pubname='supabase_realtime')
  and (select relreplident='d' from pg_class where oid='public.rooms'::regclass),'UPDATE publication with unchanged default replica identity');

create function pg_temp.access_trials(voting boolean default false) returns setof text language plpgsql as $trial$
declare
  creator uuid:=extensions.gen_random_uuid(); voter uuid:=extensions.gen_random_uuid(); foreign_user uuid:=extensions.gen_random_uuid();
  rid uuid; code text; result jsonb; before_state jsonb; command text; who uuid; kind text; column_name text; bad text;
begin
  insert into auth.users(id) values(creator),(voter),(foreign_user);
  result:=pg_temp.rpc(creator,format('select * from public.create_room(%L,%s,%L)',extensions.gen_random_uuid(),case when voting then 2 else 3 end,voting));
  rid:=(result->0->>'room_id')::uuid; code:=result->0->>'room_code';
  perform pg_temp.rpc(voter,format('select * from public.join_room(%L)',code));
  before_state:=pg_temp.snapshot();
  foreach who in array array[creator,voter,foreign_user] loop
    kind:=case when who=creator then case when voting then 'voting creator Ready' else 'non-voting creator Waiting' end when who=voter then 'admitted voter' else 'unrelated identity' end;
    result:=pg_temp.rpc(who,format('select private.is_room_member(%L) as member',rid));
    return next ok(result=jsonb_build_array(jsonb_build_object('member',who<>foreign_user)),kind||': helper own/foreign boolean');
    result:=pg_temp.rpc(who,format('select id,code,state,voter_count,required_voter_count,filter_completed_count from public.rooms where id=%L',rid));
    return next ok(case when who=foreign_user then result is null else result=jsonb_build_array(jsonb_build_object(
      'id',rid,'code',code,'state',case when voting then 'ready' else 'waiting' end,
      'voter_count',case when voting then 2 else 1 end,
      'required_voter_count',case when voting then 2 else 3 end,
      'filter_completed_count',0)) end,kind||': exact RLS projection or zero rows');
    return next ok(pg_temp.rpc(who,'select private.is_room_member(null) as member')='[{"member":false}]'::jsonb
      and pg_temp.rpc(who,format('select private.is_room_member(%L) as member',extensions.gen_random_uuid()))='[{"member":false}]'::jsonb,
      kind||': missing and NULL helper return false');
    foreach column_name in array array['creator_user_id','creation_request_id','movie_candidate_id','created_at','updated_at','*'] loop
      return next ok(pg_temp.fails(who,'select '||column_name||' from public.rooms','42501'),kind||': denied private room column '||column_name);
    end loop;
    foreach command in array array[
      'select * from public.room_members','select user_id from public.room_members','select * from public.movie_candidates',
      format('insert into public.rooms(code,creation_request_id,creator_user_id) values (%L,%L,%L)','ABCDEF0123',extensions.gen_random_uuid(),who),
      format('update public.rooms set creator_user_id=%L where id=%L',foreign_user,rid),
      format('update public.rooms set required_voter_count=4 where id=%L',rid),
      format('update public.rooms set voter_count=3 where id=%L',rid),
      format('update public.rooms set voter_count=0 where id=%L',rid),
      format('update public.rooms set movie_candidate_id=%L where id=%L','fixture-cardboard-comet',rid),
      format('delete from public.rooms where id=%L',rid),
      format('insert into public.room_members(room_id,user_id,is_voter) values (%L,%L,true)',rid,foreign_user),
      format('update public.room_members set is_voter=true where room_id=%L',rid),
      format('update public.room_members set user_id=%L where room_id=%L',foreign_user,rid),
      format('delete from public.room_members where room_id=%L',rid),
      'update public.movie_candidates set title=''changed''', 'delete from public.movie_candidates'
    ] loop
      return next ok(pg_temp.fails(who,command,'42501') and pg_temp.snapshot()=before_state and pg_temp.coherent(),
        kind||': direct browse/mutation denied with zero room/member change');
    end loop;
  end loop;
  return next ok(pg_temp.rpc(null,'select private.is_room_member(null) as member')='[{"member":false}]'::jsonb
    and pg_temp.rpc(null,format('select id,code,state,voter_count,required_voter_count,filter_completed_count from public.rooms where id=%L',rid)) is null,
    'authenticated without subject: helper false and RLS zero rows');
  return next ok(pg_temp.fails(null,'select * from public.create_room(null,null,null)','42501')
    and pg_temp.fails(null,'select * from public.join_room(null)','42501')
    and pg_temp.fails(null,'select * from public.get_my_participant_filter(null)','42501')
    and pg_temp.fails(null,'select * from public.submit_my_participant_filter(null,null,null,null)','42501'),
    'body authentication precedes invalid input in participant RPCs');
  foreach bad in array array[null,'','ABCDE','GGGGGGGGGG','ABCDEF01234','ABCDE F012',E'ABCDEF0123\n'] loop
    result:=pg_temp.rpc(foreign_user,format('select * from public.join_room(%L)',bad));
    return next ok(result=jsonb_build_array(jsonb_build_object('outcome','invalid_code','room_id',null,'room_code',null,'room_state',null,
      'is_creator',null,'is_voter',null,'voter_count',null,'required_voter_count',null,
      'filter_completed_count',null)) and pg_temp.snapshot()=before_state and pg_temp.coherent(),
      'malformed/NULL invitation exact rejection with zero writes');
  end loop;
  result:=pg_temp.rpc(foreign_user,'select * from public.join_room(''FFFFFFFFFF'')');
  return next ok(result=jsonb_build_array(jsonb_build_object('outcome','not_found','room_id',null,'room_code',null,'room_state',null,
    'is_creator',null,'is_voter',null,'voter_count',null,'required_voter_count',null,
    'filter_completed_count',null)) and pg_temp.snapshot()=before_state and pg_temp.coherent(),
    'well-formed nonexistent invitation exact rejection with zero writes');
  delete from public.rooms where id=rid;
  delete from auth.users where id in(creator,voter,foreign_user);
end;
$trial$;
select * from pg_temp.access_trials();
select * from pg_temp.access_trials(true);
set local role anon;
set local request.jwt.claim.sub='';
set local request.jwt.claims='{}';
select throws_ok($$select * from public.create_room(null,2,true)$$,'42501',null,'anon cannot execute create');
select throws_ok($$select * from public.join_room(null)$$,'42501',null,'anon cannot execute join');
select throws_ok($$select private.is_room_member(null)$$,'42501',null,'anon cannot execute private helper');
select throws_ok($$select id,code,state,voter_count,required_voter_count,filter_completed_count from public.rooms$$,'42501',null,'anon cannot read approved projection');
select throws_ok($$select * from public.room_members$$,'42501',null,'anon cannot browse member table');
reset role;

-- Declarative constraint behavior retained from Feature 001 with normalized
-- members. Every rejected mutation preserves both relations and physical rows.
create function pg_temp.constraint_trials() returns setof text language plpgsql as $trial$
declare
  creator uuid:=extensions.gen_random_uuid(); voter uuid:=extensions.gen_random_uuid(); outsider uuid:=extensions.gen_random_uuid();
  request uuid:=extensions.gen_random_uuid(); rid uuid; mid uuid; result jsonb; before_state jsonb; trial record; seen text;
begin
  insert into auth.users(id) values(creator),(voter),(outsider);
  result:=pg_temp.rpc(creator,format('select * from public.create_room(%L,3,true)',request));
  rid:=(result->0->>'room_id')::uuid;
  perform pg_temp.rpc(voter,format('select * from public.join_room(%L)',result->0->>'room_code'));
  select id into mid from public.room_members where room_id=rid and user_id=voter;
  before_state:=pg_temp.snapshot();
  for trial in select * from (values
    ('update public.rooms set id=null','23502'),('update public.rooms set code=null','23502'),
    ('update public.rooms set creator_user_id=null','23502'),('update public.rooms set creation_request_id=null','23502'),
    ('update public.rooms set required_voter_count=null','23502'),('update public.rooms set voter_count=null','23502'),
    ('update public.rooms set created_at=null','23502'),('update public.rooms set updated_at=null','23502'),
    ('update public.rooms set required_voter_count=1','23514'),('update public.rooms set voter_count=-1','23514'),
    ('update public.rooms set voter_count=4','23514'),('update public.rooms set code=''abcdef0123''','23514'),
    ('update public.rooms set code=''ABCDEF012''','23514'),('update public.rooms set code=''ABCDEF01234''','23514'),
    ('update public.rooms set code=''GBCDEF0123''','23514'),('update public.rooms set code='' ABCDEF0123''','23514'),
    ('update public.rooms set code=''ABCDEF0123 ''','23514'),('update public.rooms set code=''''','23514'),
    ('update public.rooms set state=''ready''','428C9'),
    ('update public.rooms set movie_candidate_id=''fixture-cardboard-comet''','23514'),
    ('update public.room_members set id=null','23502'),('update public.room_members set room_id=null','23502'),
    ('update public.room_members set user_id=null','23502'),('update public.room_members set is_voter=null','23502'),
    ('update public.room_members set joined_at=null','23502'),
    (format('update public.rooms set creator_user_id=%L',extensions.gen_random_uuid()),'23503'),
    (format('update public.room_members set user_id=%L where id=%L',extensions.gen_random_uuid(),mid),'23503'),
    (format('update public.room_members set room_id=%L',extensions.gen_random_uuid()),'23503'),
    (format('update public.room_members set user_id=%L where id=%L',creator,mid),'23505'),
    (format('insert into public.room_members(room_id,user_id,is_voter) values(%L,%L,true)',rid,voter),'23505'),
    (format('insert into public.room_members(id,room_id,user_id,is_voter) values(%L,%L,%L,true)',mid,rid,outsider),'23505'),
    (format('insert into public.rooms(id,code,creation_request_id,creator_user_id) values(%L,''0000000000'',%L,%L)',rid,extensions.gen_random_uuid(),creator),'23505'),
    (format('insert into public.rooms(code,creation_request_id,creator_user_id) values(%L,%L,%L)',result->0->>'room_code',extensions.gen_random_uuid(),creator),'23505'),
    (format('insert into public.rooms(code,creation_request_id,creator_user_id) values(''0000000000'',%L,%L)',request,creator),'23505'),
    (format('delete from auth.users where id=%L',creator),'23503'),(format('delete from auth.users where id=%L',voter),'23503'),
    (format('update auth.users set id=%L where id=%L',extensions.gen_random_uuid(),creator),'23503'),
    (format('update auth.users set id=%L where id=%L',extensions.gen_random_uuid(),voter),'23503')
  ) t(command,expected) loop
    seen:=null;
    begin execute trial.command; exception when others then seen:=SQLSTATE; end;
    return next ok(seen=trial.expected and pg_temp.snapshot()=before_state and pg_temp.coherent(),
      'declarative constraint '||trial.expected||': rejected mutation preserves all coherent room/member rows');
  end loop;
  -- No arbitrary upper product maximum; deliberate requests remain independent.
  result:=pg_temp.rpc(creator,format('select * from public.create_room(%L,2147483647,false)',extensions.gen_random_uuid()));
  return next ok(result->0->>'required_voter_count'='2147483647' and result->0->>'voter_count'='0'
    and pg_temp.coherent(),'technical integer upper bound accepted without product cap');
  result:=pg_temp.rpc(outsider,format('select * from public.create_room(%L,2,true)',request));
  return next ok(result->0->>'outcome'='created' and pg_temp.coherent(),'same request under another creator is independent');
  delete from public.rooms where creator_user_id in(creator,outsider);
  delete from auth.users where id in(creator,voter,outsider);
end;
$trial$;
select * from pg_temp.constraint_trials();

-- T022: real post-statement faults, isolated in this rollback-only controller.
-- Nontransactional sequence counts prove failed subtransactions reached writes.
create temporary sequence membership_fault_attempts;
grant usage,select on sequence pg_temp.membership_fault_attempts to postgres;
create function pg_temp.membership_fault() returns trigger language plpgsql as $fault$
begin
  if (tg_table_name='room_members' and current_setting('otteroom.test.membership_fault',true)='member')
    or (tg_table_name='rooms' and current_setting('otteroom.test.membership_fault',true)='count') then
    perform nextval('pg_temp.membership_fault_attempts');
    raise exception using errcode='P0001',message='controlled membership write failure';
  end if;
  return new;
end;
$fault$;
create trigger membership_fault after insert on public.room_members for each row execute function pg_temp.membership_fault();
create trigger membership_fault after update on public.rooms for each row execute function pg_temp.membership_fault();
create function pg_temp.transaction_faults() returns setof text language plpgsql as $trial$
declare
  voting boolean; creator uuid; voter uuid; request uuid; rid uuid; code text; result jsonb; before_state jsonb;
  attempts bigint; mode text;
begin
  foreach voting in array array[true,false] loop
    creator:=extensions.gen_random_uuid(); voter:=extensions.gen_random_uuid(); request:=extensions.gen_random_uuid();
    insert into auth.users(id) values(creator),(voter);
    before_state:=pg_temp.snapshot();
    perform set_config('otteroom.test.membership_fault','member',true);
    perform setval('pg_temp.membership_fault_attempts',1,false);
    return next ok(pg_temp.fails(creator,format('select * from public.create_room(%L,3,%L)',request,voting),'P0001')
      and pg_temp.snapshot()=before_state and pg_temp.coherent()
      and (select is_called and last_value=1 from pg_temp.membership_fault_attempts),
      'create member INSERT fault: actual write reached; room and member both roll back');
    perform set_config('otteroom.test.membership_fault','',true);
    result:=pg_temp.rpc(creator,format('select * from public.create_room(%L,3,%L)',request,voting));
    rid:=(result->0->>'room_id')::uuid; code:=result->0->>'room_code';
    return next ok(result->0->>'outcome'='created' and pg_temp.coherent(),'create retry after fault yields one coherent room/member');
    before_state:=pg_temp.snapshot();
    result:=pg_temp.rpc(creator,format('select * from public.create_room(%L,2,%L)',request,not voting));
    return next ok(result->0->>'outcome'='already_created' and pg_temp.snapshot()=before_state and pg_temp.coherent(),
      'retry of accepted creation stays idempotent after fault recovery');
    foreach mode in array array['member','count'] loop
      perform set_config('otteroom.test.membership_fault',mode,true);
      perform setval('pg_temp.membership_fault_attempts',1,false);
      return next ok(pg_temp.fails(voter,format('select * from public.join_room(%L)',code),'P0001')
        and (select is_called and last_value=1 from pg_temp.membership_fault_attempts)
        and pg_temp.snapshot()=before_state and pg_temp.coherent(),
        'join '||mode||' failure: reached real write, member/count/versions/config all roll back');
    end loop;
    perform set_config('otteroom.test.membership_fault','',true);
    result:=pg_temp.rpc(voter,format('select * from public.join_room(%L)',code));
    return next ok(result->0->>'outcome'='joined' and pg_temp.coherent(),'join retry after member/count faults admits once');
    before_state:=pg_temp.snapshot();
    result:=pg_temp.rpc(voter,format('select * from public.join_room(%L)',code));
    return next ok(result->0->>'outcome'='already_member' and pg_temp.snapshot()=before_state and pg_temp.coherent(),
      'accepted join recovery after faults has no duplicate membership/count UPDATE');
    delete from public.rooms where id=rid;
    delete from auth.users where id in(creator,voter);
  end loop;
end;
$trial$;
select * from pg_temp.transaction_faults();
drop trigger membership_fault on public.room_members;
drop trigger membership_fault on public.rooms;

-- Retained real code collision/regeneration/exhaustion/unrelated-constraint
-- oracles. Trigger/sequence are scoped to this test transaction and exact mode.
create temporary sequence room_code_attempts;
grant usage,select on sequence pg_temp.room_code_attempts to postgres;
create function pg_temp.code_fault() returns trigger language plpgsql as $fault$
declare mode text:=current_setting('otteroom.test.code_fault',true); attempt bigint;
begin
  if mode in ('once','exhaust') then
    attempt:=nextval('pg_temp.room_code_attempts');
    if mode='exhaust' or attempt=1 then new.code:=current_setting('otteroom.test.collision_code'); end if;
  end if;
  return new;
end;
$fault$;
create trigger room_code_fault before insert on public.rooms for each row execute function pg_temp.code_fault();
create function pg_temp.code_collision_trials() returns setof text language plpgsql as $trial$
declare creator uuid:=extensions.gen_random_uuid(); result jsonb; request uuid; original_id uuid; code text; before_state jsonb;
begin
  insert into auth.users(id) values(creator);
  result:=pg_temp.rpc(creator,format('select * from public.create_room(%L,2,true)',extensions.gen_random_uuid()));
  original_id:=(result->0->>'room_id')::uuid; code:=result->0->>'room_code';
  before_state:=pg_temp.snapshot();
  perform set_config('otteroom.test.collision_code',code,true);
  perform set_config('otteroom.test.code_fault','once',true);
  perform setval('pg_temp.room_code_attempts',1,false);
  request:=extensions.gen_random_uuid();
  result:=pg_temp.rpc(creator,format('select * from public.create_room(%L,3,false)',request));
  return next ok(result->0->>'outcome'='created' and result->0->>'room_code'<>code
    and (select last_value=2 from pg_temp.room_code_attempts) and pg_temp.coherent(),
    'real code collision regenerates successfully on exactly second INSERT attempt');
  return next ok((select to_jsonb(r) from public.rooms r where id=original_id)=before_state->'rooms'->0->'row',
    'code regeneration leaves original room fields unchanged');
  before_state:=pg_temp.snapshot();
  perform set_config('otteroom.test.code_fault','exhaust',true);
  perform setval('pg_temp.room_code_attempts',1,false);
  return next ok(pg_temp.fails(creator,format('select * from public.create_room(%L,3,false)',extensions.gen_random_uuid()),'P0001')
    and (select last_value=5 from pg_temp.room_code_attempts) and pg_temp.snapshot()=before_state and pg_temp.coherent(),
    'exactly five collisions exhaust exceptionally without partial room/member or unrelated mutation');
  perform set_config('otteroom.test.code_fault','',true);
  delete from public.rooms where creator_user_id=creator and id<>original_id;
  -- This rollback-only unrelated constraint must not enter code collision handling.
  alter table public.rooms add constraint membership_unexpected_unique unique(created_at);
  before_state:=pg_temp.snapshot();
  return next ok(pg_temp.fails(creator,format('select * from public.create_room(%L,2,true)',extensions.gen_random_uuid()),'23505')
    and pg_temp.snapshot()=before_state and pg_temp.coherent(),'unrelated real unique constraint is rethrown, not treated as code collision');
  alter table public.rooms drop constraint membership_unexpected_unique;
  delete from public.rooms where creator_user_id=creator;
  delete from auth.users where id=creator;
end;
$trial$;
select * from pg_temp.code_collision_trials();
drop trigger room_code_fault on public.rooms;
select is((select count(*) from pg_trigger where tgrelid in('public.rooms'::regclass,'public.room_members'::regclass) and not tgisinternal),
  0::bigint,'no production test trigger remains');
select ok(pg_temp.coherent(),'final controller fixtures retain exact member/count invariant');

-- Feature 004 schema, privacy and RPC contract.
select has_type('public', 'participant_genre', 'participant genre enum exists');
select has_table('public', 'participant_filters', 'private participant filter authority exists');
select has_column('public', 'rooms', 'filter_completed_count', 'rooms exposes persisted filter progress');
select has_function('public', 'get_my_participant_filter', array['uuid'], 'own-filter recovery RPC exists');
select has_function('public', 'submit_my_participant_filter',
  array['uuid','participant_genre[]','smallint','smallint'], 'own-filter submission RPC exists');

select results_eq(
  $$select e.enumlabel::text collate "default" from pg_enum e
    where e.enumtypid='public.participant_genre'::regtype order by e.enumsortorder$$,
  $$values ('action'::text),('adventure'),('animation'),('comedy'),('crime'),
    ('documentary'),('drama'),('family'),('fantasy'),('history'),('horror'),
    ('music'),('mystery'),('romance'),('science_fiction'),('tv_movie'),
    ('thriller'),('war'),('western')$$,
  'exact 19 genre slugs use canonical enum order');
select results_eq(
  $$select attname::text collate "default",format_type(atttypid,atttypmod)::text collate "default",attnotnull
    from pg_attribute where attrelid='public.participant_filters'::regclass
      and attnum>0 and not attisdropped order by attnum$$,
  $$values ('room_member_id'::text,'uuid'::text,true),
    ('genres','participant_genre[]',true),('release_year_from','smallint',true),
    ('release_year_to','smallint',true)$$,
  'participant_filters has exactly four non-null columns and no duplicated room/Auth/completion state');
select results_eq(
  $$select conname::text collate "default",contype::text collate "default",
      pg_get_constraintdef(oid)::text collate "default",condeferrable,condeferred
    from pg_constraint where conrelid='public.participant_filters'::regclass order by conname$$,
  $$values
    ('participant_filters_genres_unique_check'::text,'c'::text,
      'CHECK (private.valid_participant_genres(genres))'::text,false,false),
    ('participant_filters_pkey','p','PRIMARY KEY (room_member_id)',false,false),
    ('participant_filters_release_year_check','c',
      'CHECK (((release_year_from >= 1900) AND (release_year_from <= release_year_to) AND (release_year_to <= 9999)))',false,false),
    ('participant_filters_room_member_id_fkey','f',
      'FOREIGN KEY (room_member_id) REFERENCES room_members(id) ON DELETE CASCADE',false,false)$$,
  'filter PK/FK and static genre/year checks are exact');
select ok(pg_catalog.strpos(pg_catalog.upper((select pg_get_constraintdef(oid)
  from pg_constraint where conrelid='public.participant_filters'::regclass
  and conname='participant_filters_release_year_check')),'CURRENT')=0,
  'year CHECK contains no time-dependent current-year expression');
select is((select pg_get_expr(d.adbin,d.adrelid) from pg_attrdef d join pg_attribute a
  on a.attrelid=d.adrelid and a.attnum=d.adnum where a.attrelid='public.participant_filters'::regclass
  and a.attname='genres'),'''{}''::participant_genre[]','empty genre array is the sole storage default');
select results_eq(
  $$select p.prosecdef,p.provolatile::text collate "default",p.proisstrict,
      pg_get_userbyid(p.proowner)::text collate "default",p.proconfig collate "default",
      l.lanname::text collate "default"
    from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid='private.valid_participant_genres(participant_genre[])'::regprocedure$$,
  $$values (false,'i'::text,true,'postgres'::text,array['search_path=""'],'sql'::text)$$,
  'genre helper is postgres-owned immutable strict SECURITY INVOKER SQL with empty search_path');
select results_eq(
  $$select a.grantee::regrole::text collate "default",a.privilege_type::text collate "default",a.is_grantable
    from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.oid='private.valid_participant_genres(participant_genre[])'::regprocedure order by 1$$,
  $$values ('postgres'::text,'EXECUTE'::text,false)$$,
  'genre helper has owner-only effective ACL');
select results_eq(
  $$select p.proname::text collate "default",p.pronargs::integer,p.pronargdefaults::integer,
      p.proargnames collate "default",p.proargmodes,p.proallargtypes::regtype[]::text collate "default",p.proretset
    from pg_proc p where p.oid in(
      'public.get_my_participant_filter(uuid)'::regprocedure,
      'public.submit_my_participant_filter(uuid,participant_genre[],smallint,smallint)'::regprocedure)
    order by p.proname$$,
  $$values
    ('get_my_participant_filter'::text,1,0,
      array['p_room_id','outcome','genres','release_year_from','release_year_to','filter_completed_count','required_voter_count','allowed_release_year_max'],
      array['i','t','t','t','t','t','t','t']::"char"[],
      '{uuid,text,participant_genre[],smallint,smallint,integer,integer,smallint}'::text,true),
    ('submit_my_participant_filter',4,0,
      array['p_room_id','p_genres','p_release_year_from','p_release_year_to','outcome','genres','release_year_from','release_year_to','filter_completed_count','required_voter_count','allowed_release_year_max'],
      array['i','i','i','i','t','t','t','t','t','t','t']::"char"[],
      '{uuid,participant_genre[],smallint,smallint,text,participant_genre[],smallint,smallint,integer,integer,smallint}',true)$$,
  'filter RPCs have exact arguments and seven ordered outputs');
select ok(has_function_privilege('authenticated',fn,'EXECUTE')
    and not has_function_privilege('anon',fn,'EXECUTE')
    and not exists(select 1 from pg_proc p cross join lateral
      aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=fn and a.grantee=0),
  fn::text||': authenticated-only EXECUTE without PUBLIC/anon')
from unnest(array[
  'public.get_my_participant_filter(uuid)'::regprocedure,
  'public.submit_my_participant_filter(uuid,participant_genre[],smallint,smallint)'::regprocedure
]) fn;
select results_eq(
  $$select schemaname::text collate "default",tablename::text collate "default"
    from pg_publication_tables where pubname='supabase_realtime' order by 1,2$$,
  $$values ('public'::text,'rooms'::text)$$,
  'rooms remains the only Realtime publication; filter details are never published');

create function pg_temp.filter_rpc(subject uuid, command text) returns jsonb language plpgsql as $f$
declare result jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
  execute 'select jsonb_agg(to_jsonb(x)) from ('||command||') x' into result;
  reset role;
  return result;
exception when others then reset role; raise;
end;
$f$;
create function pg_temp.filter_sqlstate(subject uuid, command text) returns text language plpgsql as $f$
declare seen text;
begin
  begin perform pg_temp.filter_rpc(subject,command); exception when others then seen:=sqlstate; end;
  return seen;
end;
$f$;

-- Deterministic room-lock trials use committed owner fixtures and independent
-- authenticated READ COMMITTED backends. No timing sleep is a correctness oracle.
create function pg_temp.filter_lock_trial(kind text) returns setof text language plpgsql as $trial$
declare
  ns text:='filter_'||kind||'_'||encode(extensions.gen_random_bytes(5),'hex');
  own text; a text; b text; conninfo text:='dbname=postgres user=postgres connect_timeout=3';
  creator uuid:=extensions.gen_random_uuid(); voter1 uuid:=extensions.gen_random_uuid(); voter2 uuid:=extensions.gen_random_uuid();
  rid uuid:=extensions.gen_random_uuid(); code text:='A4'||upper(encode(extensions.gen_random_bytes(4),'hex'));
  mid0 uuid:=extensions.gen_random_uuid(); mid1 uuid:=extensions.gen_random_uuid(); mid2 uuid:=extensions.gen_random_uuid();
  apid integer; bpid integer; opid integer; first text; second text; first_pid integer; second_pid integer;
  ra jsonb; rb jsonb; deadline timestamptz; failure text; cleaned boolean:=true; name text; j jsonb;
  filter_a integer; filter_b integer; room_a integer; room_b integer;
  qa text; qb text; initial integer:=case when kind in('edit_first','final_first') then 1 else 0 end;
  target integer:=case when kind='same_equal' then 3 else case when kind in('edit_first','final_first') then 2 else 3 end end;
  filter_stats text:='select to_jsonb(coalesce((select n_tup_ins+n_tup_upd from pg_stat_xact_user_tables where relid=''public.participant_filters''::regclass),0))';
  room_stats text:='select to_jsonb(coalesce((select n_tup_upd from pg_stat_xact_user_tables where relid=''public.rooms''::regclass),0))';
begin
  own:=ns||'_owner';a:=ns||'_a';b:=ns||'_b';
  begin
    perform extensions.dblink_connect(own,conninfo);
    perform extensions.dblink_exec(own,'set statement_timeout=''15s'';set lock_timeout=''8s''');
    perform extensions.dblink_exec(own,format(
      'insert into auth.users(id) values(%1$L),(%2$L),(%3$L);'
      'insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,filter_completed_count) values(%4$L,%5$L,%6$L,%1$L,%7$s,%7$s,%8$s);'
      'insert into public.room_members(id,room_id,user_id,is_voter) values(%9$L,%4$L,%1$L,true),(%10$L,%4$L,%2$L,true);',
      creator,voter1,voter2,rid,code,extensions.gen_random_uuid(),target,initial,mid0,mid1,mid2));
    if target=3 then
      perform extensions.dblink_exec(own,format(
        'insert into public.room_members(id,room_id,user_id,is_voter) values(%L,%L,%L,true)',mid2,rid,voter2));
    end if;
    if initial=1 then
      perform extensions.dblink_exec(own,format(
        'insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to) values(%L,''{comedy}'',2000,2020)',mid0));
    end if;
    perform extensions.dblink_connect(a,conninfo);perform extensions.dblink_connect(b,conninfo);
    perform extensions.dblink_exec(a,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    perform extensions.dblink_exec(b,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    apid:=(pg_temp.remote_json(a,'select to_jsonb(pg_backend_pid())'))::integer;
    bpid:=(pg_temp.remote_json(b,'select to_jsonb(pg_backend_pid())'))::integer;
    opid:=(pg_temp.remote_json(own,'select to_jsonb(pg_backend_pid())'))::integer;
    perform pg_temp.require(apid<>bpid and apid<>opid and bpid<>opid,'independent filter PIDs required');
    perform pg_temp.caller(a,case when kind='same_equal' then creator else case when kind='final_first' then voter1 else creator end end);
    perform pg_temp.caller(b,case when kind in('same_equal','final_first') then creator else voter1 end);
    qa:=format('select to_jsonb(x) from public.submit_my_participant_filter(%L,%L::public.participant_genre[],%s::smallint,%s::smallint) x',
      rid,case when kind='final_first' then '{drama}' else case when kind='same_equal' then '{action,western}' else '{action}' end end,
      case when kind='final_first' then 1900 else 2001 end,case when kind='final_first' then 2026 else 2021 end);
    qb:=format('select to_jsonb(x) from public.submit_my_participant_filter(%L,%L::public.participant_genre[],1900::smallint,2026::smallint) x',
      rid,case when kind='same_equal' then '{western,action}' else '{drama}' end);
    perform extensions.dblink_exec(own,'begin');
    perform extensions.dblink_exec(own,format('select 1 from public.rooms where id=%L for update',rid));

    if kind in('edit_first','final_first') then
      perform extensions.dblink_send_query(a,qa);
      deadline:=clock_timestamp()+interval '8s';
      loop
        exit when extensions.dblink_is_busy(a)=1 and opid=any(pg_blocking_pids(apid));
        if clock_timestamp()>deadline then raise exception 'first ordered filter call did not block on owner';end if;
      end loop;
      perform extensions.dblink_exec(own,'commit');
      ra:=pg_temp.collect(a);filter_a:=pg_temp.remote_json(a,filter_stats)::integer;room_a:=pg_temp.remote_json(a,room_stats)::integer;
      perform extensions.dblink_send_query(b,qb);
      deadline:=clock_timestamp()+interval '8s';
      loop
        exit when extensions.dblink_is_busy(b)=1 and apid=any(pg_blocking_pids(bpid));
        if clock_timestamp()>deadline then raise exception 'second ordered filter call did not block on first';end if;
      end loop;
      perform extensions.dblink_exec(a,'commit');
      rb:=pg_temp.collect(b);filter_b:=pg_temp.remote_json(b,filter_stats)::integer;room_b:=pg_temp.remote_json(b,room_stats)::integer;
      perform extensions.dblink_exec(b,'commit');
    else
      perform extensions.dblink_send_query(a,qa);perform extensions.dblink_send_query(b,qb);
      deadline:=clock_timestamp()+interval '8s';
      loop
        exit when extensions.dblink_is_busy(a)=1 and extensions.dblink_is_busy(b)=1
          and opid=any(pg_blocking_pids(apid)) and opid=any(pg_blocking_pids(bpid));
        if clock_timestamp()>deadline then raise exception 'parallel filter calls did not block on owner';end if;
      end loop;
      perform extensions.dblink_exec(own,'commit');
      deadline:=clock_timestamp()+interval '8s';
      loop
        if extensions.dblink_is_busy(a)=0 then first:=a;second:=b;first_pid:=apid;second_pid:=bpid;exit;end if;
        if extensions.dblink_is_busy(b)=0 then first:=b;second:=a;first_pid:=bpid;second_pid:=apid;exit;end if;
        if clock_timestamp()>deadline then raise exception 'no first serialized filter result';end if;
      end loop;
      perform pg_temp.require(extensions.dblink_is_busy(second)=1 and first_pid=any(pg_blocking_pids(second_pid)),
        'second filter transaction blocks directly on uncommitted winner');
      if first=a then
        ra:=pg_temp.collect(a);filter_a:=pg_temp.remote_json(a,filter_stats)::integer;room_a:=pg_temp.remote_json(a,room_stats)::integer;
        perform extensions.dblink_exec(a,'commit');rb:=pg_temp.collect(b);filter_b:=pg_temp.remote_json(b,filter_stats)::integer;room_b:=pg_temp.remote_json(b,room_stats)::integer;perform extensions.dblink_exec(b,'commit');
      else
        rb:=pg_temp.collect(b);filter_b:=pg_temp.remote_json(b,filter_stats)::integer;room_b:=pg_temp.remote_json(b,room_stats)::integer;
        perform extensions.dblink_exec(b,'commit');ra:=pg_temp.collect(a);filter_a:=pg_temp.remote_json(a,filter_stats)::integer;room_a:=pg_temp.remote_json(a,room_stats)::integer;perform extensions.dblink_exec(a,'commit');
      end if;
    end if;

    if kind='distinct' then
      perform pg_temp.require(ra->>'outcome'='saved' and rb->>'outcome'='saved'
        and array[(ra->>'filter_completed_count')::integer,(rb->>'filter_completed_count')::integer] @> array[1,2]
        and filter_a=1 and filter_b=1 and room_a=1 and room_b=1,'distinct first saves serialize with exact per-caller writes');
    elsif kind='same_equal' then
      perform pg_temp.require((ra->>'outcome')<>(rb->>'outcome') and array[ra->>'outcome',rb->>'outcome'] @> array['saved','unchanged']
        and filter_a+filter_b=1 and room_a+room_b=1,'same-voter equal overlap inserts/counts once and loser is unchanged');
    elsif kind='edit_first' then
      perform pg_temp.require(ra->>'outcome'='saved' and rb->>'outcome'='saved' and filter_a=1 and room_a=0
        and filter_b=1 and room_b=1,'edit-first commits replacement before final insertion freezes N/N');
    else
      perform pg_temp.require(ra->>'outcome'='saved' and rb->>'outcome'='locked' and filter_a=1 and room_a=1
        and filter_b=0 and room_b=0,'final-first freezes N/N and blocked edit performs zero writes');
    end if;
    perform pg_temp.require((pg_temp.remote_json(own,format(
      'select to_jsonb(filter_completed_count=(select count(*) from public.participant_filters f join public.room_members m on m.id=f.room_member_id where m.room_id=%L and m.is_voter) and filter_completed_count<=required_voter_count) from public.rooms where id=%L',rid,rid)))::boolean,
      'serialized commits preserve exact bounded row/count invariant');
  exception when others then failure:=sqlerrm;
  end;
  foreach name in array array[a,b] loop
    begin
      if name=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
        if extensions.dblink_is_busy(name)=1 then
          perform extensions.dblink_cancel_query(name);perform pg_temp.await_ready(name);
          perform j from extensions.dblink_get_result(name,false) t(j jsonb);
          perform j from extensions.dblink_get_result(name,false) t(j jsonb);
        end if;
        perform extensions.dblink_exec(name,'rollback');perform extensions.dblink_disconnect(name);
      end if;
    exception when others then cleaned:=false;end;
  end loop;
  -- Exact PIDs belong to this trial; terminate only if a failed drain left one.
  perform pg_terminate_backend(p.pid) from pg_stat_activity p
    where p.pid=any(array[apid,bpid]) and p.pid<>pg_backend_pid();
  deadline:=clock_timestamp()+interval '5s';
  loop
    perform pg_stat_clear_snapshot();
    exit when not exists(select 1 from pg_stat_activity where pid=any(array[apid,bpid]));
    if clock_timestamp()>deadline then cleaned:=false;exit;end if;
  end loop;
  begin
    if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      perform extensions.dblink_exec(own,'rollback');
      perform extensions.dblink_disconnect(own);
    end if;
  exception when others then cleaned:=false;end;
  return next ok(failure is null,kind||': deterministic room-lock ordering and outcomes');
  if failure is not null then return next diag(failure);end if;
  return next ok(cleaned and not(array[a,b,own]&&coalesce(extensions.dblink_get_connections(),array[]::text[])),
    kind||': exact remote fixture/backend cleanup');
end;
$trial$;
insert into auth.users(id) values
  ('04400000-0000-4000-a000-000000000001'),
  ('04400000-0000-4000-a000-000000000002'),
  ('04400000-0000-4000-a000-000000000003'),
  ('04400000-0000-4000-a000-000000000004');
insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,
  filter_completed_count,created_at,updated_at) values
  ('04410000-0000-4000-a000-000000000001','D400000001','04420000-0000-4000-a000-000000000001','04400000-0000-4000-a000-000000000001',2,1,0,'2026-01-01','2026-01-01'),
  ('04410000-0000-4000-a000-000000000002','D400000002','04420000-0000-4000-a000-000000000002','04400000-0000-4000-a000-000000000001',2,2,0,'2026-01-01','2026-01-01'),
  ('04410000-0000-4000-a000-000000000003','D400000003','04420000-0000-4000-a000-000000000003','04400000-0000-4000-a000-000000000003',2,2,0,'2026-01-01','2026-01-01');
insert into public.room_members(id,room_id,user_id,is_voter) values
  ('04430000-0000-4000-a000-000000000001','04410000-0000-4000-a000-000000000001','04400000-0000-4000-a000-000000000001',true),
  ('04430000-0000-4000-a000-000000000002','04410000-0000-4000-a000-000000000002','04400000-0000-4000-a000-000000000001',true),
  ('04430000-0000-4000-a000-000000000003','04410000-0000-4000-a000-000000000002','04400000-0000-4000-a000-000000000002',true),
  ('04430000-0000-4000-a000-000000000004','04410000-0000-4000-a000-000000000003','04400000-0000-4000-a000-000000000003',false),
  ('04430000-0000-4000-a000-000000000005','04410000-0000-4000-a000-000000000003','04400000-0000-4000-a000-000000000001',true),
  ('04430000-0000-4000-a000-000000000006','04410000-0000-4000-a000-000000000003','04400000-0000-4000-a000-000000000002',true);

select is(pg_temp.filter_sqlstate(null,
  $$select * from public.submit_my_participant_filter(null,null,null,null)$$),'42501',
  'submit authenticates before business validation');
select is(pg_temp.filter_sqlstate(null,
  $$select * from public.get_my_participant_filter(null)$$),'42501',
  'recovery authenticates before room lookup');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.get_my_participant_filter('04410000-0000-4000-a000-000000000001')$$)->0->>'outcome',
  'not_ready','Waiting voter recovery returns not_ready without writing a default');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000003',
  $$select * from public.get_my_participant_filter('04410000-0000-4000-a000-000000000003')$$)->0->>'outcome',
  'not_voter','non-voting creator receives aggregate-only not_voter');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000004',
  $$select * from public.get_my_participant_filter('04410000-0000-4000-a000-000000000002')$$),
  '[{"outcome":"not_found","genres":null,"release_year_from":null,"release_year_to":null,"filter_completed_count":null,"required_voter_count":null,"allowed_release_year_max":null}]'::jsonb,
  'foreign and missing rooms share exact all-null not_found result');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.get_my_participant_filter('04410000-0000-4000-a000-000000000002')$$)->0->>'outcome',
  'not_submitted','Ready voter with no row recovers not_submitted');

select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000002',null,1900::smallint,2026::smallint)$$)->0->>'outcome',
  'invalid_genres','NULL genres rejected without completion');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000002','{action,action}'::participant_genre[],1900::smallint,2026::smallint)$$)->0->>'outcome',
  'invalid_genres','duplicate genres rejected without completion');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000002','{}'::participant_genre[],1899::smallint,2026::smallint)$$)->0->>'outcome',
  'invalid_year_range','lower year below 1900 rejected');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000002','{}'::participant_genre[],2020::smallint,2019::smallint)$$)->0->>'outcome',
  'invalid_year_range','reversed inclusive year range rejected');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000002','{}'::participant_genre[],1900::smallint,9999::smallint)$$)->0->>'outcome',
  'invalid_year_range','server UTC future year rejected');
select is((select filter_completed_count from public.rooms where id='04410000-0000-4000-a000-000000000002'),
  0,'all invalid attempts preserve zero completion');

create temporary table filter_room_before as select updated_at,xmin::text as row_xmin
  from public.rooms where id='04410000-0000-4000-a000-000000000002';
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000002','{western,action,science_fiction}'::participant_genre[],1900::smallint,2026::smallint)$$)->0,
  jsonb_build_object('outcome','saved','genres',array['action','science_fiction','western'],
    'release_year_from',1900,'release_year_to',2026,'filter_completed_count',1,
    'required_voter_count',2,'allowed_release_year_max',2026),
  'first save returns exact canonical own values and 1/2 progress');
select ok((select r.filter_completed_count=1 and r.updated_at<>b.updated_at and r.xmin::text<>b.row_xmin
  from public.rooms r cross join filter_room_before b where r.id='04410000-0000-4000-a000-000000000002'),
  'first accepted row increments count and updates room timestamp/version once');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.get_my_participant_filter('04410000-0000-4000-a000-000000000002')$$)->0->>'outcome',
  'saved','owner recovery returns saved before N/N');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000002',
  $$select * from public.get_my_participant_filter('04410000-0000-4000-a000-000000000002')$$)->0->>'genres',
  null,'another voter receives no owner filter details');

create temporary table filter_edit_before as
  select (select xmin::text from public.rooms where id='04410000-0000-4000-a000-000000000002') room_xmin,
    (select xmin::text from public.participant_filters where room_member_id='04430000-0000-4000-a000-000000000002') filter_xmin;
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000002','{comedy}'::participant_genre[],2000::smallint,2020::smallint)$$)->0->>'outcome',
  'saved','valid pre-lock replacement is accepted');
select ok((select r.xmin::text=b.room_xmin and f.xmin::text<>b.filter_xmin and r.filter_completed_count=1
  from public.rooms r join public.room_members m on m.room_id=r.id
  join public.participant_filters f on f.room_member_id=m.id cross join filter_edit_before b
  where r.id='04410000-0000-4000-a000-000000000002' and m.user_id='04400000-0000-4000-a000-000000000001'),
  'replacement updates only own filter row and not shared room/count');
create temporary table filter_equal_before as select xmin::text as filter_xmin from public.participant_filters
  where room_member_id='04430000-0000-4000-a000-000000000002';
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000002','{comedy}'::participant_genre[],2000::smallint,2020::smallint)$$)->0->>'outcome',
  'unchanged','equal canonical retry is a no-write unchanged outcome');
select is((select xmin::text from public.participant_filters where room_member_id='04430000-0000-4000-a000-000000000002'),
  (select filter_xmin from filter_equal_before),'equal retry preserves filter xmin');

select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000002',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000002','{}'::participant_genre[],1900::smallint,2026::smallint)$$)->0->>'filter_completed_count',
  '2','final voter atomically reaches exact N/N');
create temporary table filter_locked_before as
  select jsonb_agg(to_jsonb(f)||jsonb_build_object('xmin',f.xmin::text) order by f.room_member_id) rows
  from public.participant_filters f join public.room_members m on m.id=f.room_member_id
  where m.room_id='04410000-0000-4000-a000-000000000002';
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000002','{action}'::participant_genre[],1901::smallint,2025::smallint)$$)->0->>'outcome',
  'locked','different post-N/N edit is locked');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000002',null,null,null)$$)->0->>'outcome',
  'locked','function-level invalid post-N/N attempt stays locked');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000002','{comedy}'::participant_genre[],2000::smallint,2020::smallint)$$)->0->>'outcome',
  'unchanged','equal final retry remains no-write unchanged');
select is((select jsonb_agg(to_jsonb(f)||jsonb_build_object('xmin',f.xmin::text) order by f.room_member_id)
  from public.participant_filters f join public.room_members m on m.id=f.room_member_id
  where m.room_id='04410000-0000-4000-a000-000000000002'),
  (select rows from filter_locked_before),'all castable post-N/N attempts preserve every accepted row/xmin');

-- A rollback-only test trigger injects a failure after the private INSERT reaches
-- the room UPDATE. The real RPC must roll the statement back atomically.
create temporary sequence filter_fault_attempts;
grant usage,select on sequence pg_temp.filter_fault_attempts to postgres;
create function pg_temp.filter_fault() returns trigger language plpgsql as $fault$
begin
  if new.id='04410000-0000-4000-a000-000000000003'::uuid
    and current_setting('otteroom.test.filter_fault',true)='on' then
    perform nextval('pg_temp.filter_fault_attempts');
    raise exception using errcode='P0001',message='controlled filter summary failure';
  end if;
  return new;
end;
$fault$;
create trigger filter_fault before update on public.rooms for each row execute function pg_temp.filter_fault();
select set_config('otteroom.test.filter_fault','on',true);
select is(pg_temp.filter_sqlstate('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000003','{drama}'::participant_genre[],1900::smallint,2026::smallint)$$),
  'P0001','fault between private insert and room summary returns exceptional failure');
select ok((select last_value=1 from pg_temp.filter_fault_attempts)
  and not exists(select 1 from public.participant_filters where room_member_id='04430000-0000-4000-a000-000000000005')
  and (select filter_completed_count=0 from public.rooms where id='04410000-0000-4000-a000-000000000003'),
  'post-insert room fault rolls back both filter row and completion summary');
select set_config('otteroom.test.filter_fault','',true);
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000003','{drama}'::participant_genre[],1900::smallint,2026::smallint)$$)->0->>'outcome',
  'saved','valid retry after rolled-back fault succeeds exactly once');
drop trigger filter_fault on public.rooms;
select is((select count(*) from pg_trigger where tgrelid='public.rooms'::regclass and not tgisinternal),
  0::bigint,'no filter fault trigger remains');

select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000003',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000003','{}'::participant_genre[],1900::smallint,2026::smallint)$$)->0->>'outcome',
  'not_voter','non-voting creator cannot own or complete filters');
select is(pg_temp.filter_rpc('04400000-0000-4000-a000-000000000004',
  $$select * from public.submit_my_participant_filter('04410000-0000-4000-a000-000000000003','{}'::participant_genre[],1900::smallint,2026::smallint)$$)->0->>'outcome',
  'not_found','foreign submit is masked and performs no write');

select ok(not has_table_privilege(role_name,'public.participant_filters',privilege_name),
  role_name||' has no filter table '||privilege_name)
from (values('anon'),('authenticated')) r(role_name)
cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege_name);
select is(pg_temp.filter_sqlstate('04400000-0000-4000-a000-000000000001',
  'select * from public.participant_filters'),'42501','owner direct filter SELECT denied');
select ok(pg_temp.fails('04400000-0000-4000-a000-000000000001',
  $$update public.participant_filters set release_year_from=1901$$,'42501'),
  'owner direct filter UPDATE denied');
select ok(not exists(select 1 from public.participant_filters f join public.room_members m
  on m.id=f.room_member_id where not m.is_voter)
  and not exists(select 1 from public.rooms r where r.filter_completed_count < 0
    or r.filter_completed_count>r.required_voter_count
    or r.filter_completed_count<>(select count(*) from public.participant_filters f
      join public.room_members m on m.id=f.room_member_id where m.room_id=r.id and m.is_voter)),
  'row existence and room summaries remain globally coherent and bounded');

delete from public.rooms where id::text like '0441%';
delete from auth.users where id::text like '0440%';
select ok(not exists(select 1 from public.participant_filters f where f.room_member_id::text like '0443%'),
  'owned filter fixtures cascade-cleaned with their room memberships');

select * from finish();
rollback;

-- Remote committed fixtures cannot be deleted while this controller retains
-- transaction-scoped locks. Clean their exact A4 manifest after rollback.
begin;
create temporary table filter_concurrency_users on commit drop as
  select distinct m.user_id from public.room_members m join public.rooms r on r.id=m.room_id
  where r.code like 'A4%';
delete from public.rooms where code like 'A4%';
delete from auth.users where id in(select user_id from filter_concurrency_users);
do $cleanup$
begin
  if exists(select 1 from public.rooms where code like 'A4%')
    or exists(select 1 from auth.users where id in(select user_id from filter_concurrency_users)) then
    raise exception 'Filter concurrency cleanup failed';
  end if;
end;
$cleanup$;
commit;
