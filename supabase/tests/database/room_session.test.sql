-- Phase 3 schema/access regression plus Phase 4 RPC acceptance evidence.
-- UUID-only fixtures: controller setup rolls back; committed race fixtures are
-- explicitly cleaned through their separate owner connection on every path.
-- Local-only harness setup needs the extension owner to revoke dblink's own
-- default EXECUTE ACL. Reuse the pinned local CLI's connection parameters only;
-- no password is embedded or printed. RPC calls still SET ROLE to
-- authenticated/anon, and remote fixture ownership remains postgres.
\connect -reuse-previous=on "user=supabase_admin"
begin;
set local search_path = pg_catalog, public, extensions;
set local statement_timeout = '15s';
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

create function pg_temp.race(kind text, cancel_probe boolean default false) returns setof text language plpgsql as $trial$
declare
  ns text := 'phase4_' || encode(extensions.gen_random_bytes(8), 'hex');
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
  outcome_a text; outcome_b text; violation text;
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
        insert into public.rooms(id,code,creation_request_id,host_user_id) values (%1$L,%2$L,%3$L,%4$L);
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
        'select to_jsonb(count(*)) from public.rooms where host_user_id = %L and creation_request_id = %L', h,request)))::integer = 0,
        'T044 starts without the tested host/request');
      perform pg_temp.require((pg_temp.remote_json(own, format('select to_jsonb(count(*)) from public.rooms where code = %L',w)))::integer = 0,
        'winner code must be unused');
      perform pg_temp.remote_json(b, format('select jsonb_build_object(''locked'',pg_advisory_lock(44004,%s))',key));
    elsif kind <> 'duplicate_create' then
      perform extensions.dblink_exec(own, format('insert into public.rooms(id,code,creation_request_id,host_user_id) values (%L,%L,%L,%L)',rid,c,fixture_request,h));
      perform extensions.dblink_exec(own, 'begin');
      perform pg_temp.remote_json(own, format('select to_jsonb(id) from public.rooms where id = %L for update',rid));
    end if;

    perform pg_temp.caller(a, case when kind in ('duplicate_create','collision_winner','host_guest') then h else g end);
    perform pg_temp.caller(b, case when kind in ('duplicate_create','collision_winner') then h when kind = 'distinct_guests' then u else g end);
    if kind in ('duplicate_create','collision_winner') then
      if kind = 'collision_winner' then
        perform extensions.dblink_exec(a, 'set otteroom.test.create_room_fault_mode = ''collision_wait''');
        perform extensions.dblink_exec(b, 'set otteroom.test.create_room_fault_mode = ''winner''');
      end if;
      perform pg_temp.require(extensions.dblink_send_query(a, format('select to_jsonb(r) from public.create_room(%L) r',request)) = 1, 'A dispatched');
      deadline := clock_timestamp() + interval '8 seconds';
      if kind = 'duplicate_create' then
        perform pg_temp.await_ready(a); -- Do not collect or commit A yet.
        perform pg_temp.require(extensions.dblink_send_query(b, format('select to_jsonb(r) from public.create_room(%L) r',request)) = 1, 'B dispatched');
        loop
          exit when apid = any(pg_blocking_pids(bpid));
          if clock_timestamp() > deadline then raise exception 'duplicate B never blocked by uncommitted A'; end if;
        end loop;
        ra := pg_temp.collect(a);
        perform extensions.dblink_exec(a,'commit');
        rb := pg_temp.collect(b);
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
        perform pg_temp.require(extensions.dblink_send_query(b, format('select to_jsonb(r) from public.create_room(%L) r',request)) = 1, 'B dispatched after observed barrier');
        rb := pg_temp.collect(b);
        perform extensions.dblink_exec(b,'commit');
        perform pg_temp.require(rb->>'outcome'='created' and rb->>'room_code'=w, 'B creates the designated winner');
        rowdata := pg_temp.remote_json(own, format('select to_jsonb(r) from public.rooms r where host_user_id=%L and creation_request_id=%L',h,request));
        perform pg_temp.require(rowdata->>'id'=rb->>'room_id' and rowdata->>'code'=w
          and bpid=any(pg_blocking_pids(apid)), 'fresh owner sees committed B while A is still blocked');
        -- Both unique keys now conflict. Observe the real pinned-server arbiter
        -- in a rolled-back INSERT subtransaction; never synthesize SQLSTATE.
        perform extensions.dblink_exec(own, format($calibrate$
          do $c$ declare name text; begin
            begin
              insert into public.rooms(code,creation_request_id,host_user_id) values (%L,%L,%L);
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
        perform extensions.dblink_exec(a,'commit');
        perform pg_temp.require(ra->>'outcome'='already_created', 'A code-key handler recovers already committed B');
        perform pg_temp.require(before_collision = pg_temp.remote_json(own, format('select to_jsonb(r) from public.rooms r where id=%L',rid)),
          'unrelated collision owner row is byte-for-byte unchanged');
      end if;
      perform pg_temp.require((ra - 'outcome') = (rb - 'outcome') and ra->>'participant_role'='host'
        and ra->>'room_state'='waiting' and ra->>'participant_count'='1', 'create outcomes share exact accepted projection');
      perform pg_temp.require((pg_temp.remote_json(own, format(
        'select to_jsonb(count(*)) from public.rooms where host_user_id=%L',h)))::integer=1, 'one complete winner, no extra A room');
      rowdata := pg_temp.remote_json(own,format('select to_jsonb(r) from public.rooms r where host_user_id=%L',h));
      perform pg_temp.require(rowdata->>'id'=ra->>'room_id' and rowdata->>'code'=ra->>'room_code'
        and rowdata->>'creation_request_id'=request::text and rowdata->>'state'='waiting'
        and rowdata->>'guest_user_id' is null and rowdata->>'created_at' is not null and rowdata->>'updated_at' is not null,
        'committed create winner has every required authoritative field');
    else
      perform pg_temp.require(extensions.dblink_send_query(a,format('select to_jsonb(r) from public.join_room(%L) r',c))=1, 'join A dispatched');
      perform pg_temp.require(extensions.dblink_send_query(b,format('select to_jsonb(r) from public.join_room(%L) r',c))=1, 'join B dispatched');
      deadline := clock_timestamp()+interval '8 seconds';
      loop
        exit when cardinality(pg_blocking_pids(apid))>0 and cardinality(pg_blocking_pids(bpid))>0
          and (opid=any(pg_blocking_pids(apid)) or bpid=any(pg_blocking_pids(apid)))
          and (opid=any(pg_blocking_pids(bpid)) or apid=any(pg_blocking_pids(bpid)));
        if clock_timestamp()>deadline then raise exception 'both joins must overlap on owner-controlled lock chain'; end if;
      end loop;
      perform extensions.dblink_exec(own,'commit');
      deadline := clock_timestamp()+interval '8 seconds';
      loop
        if extensions.dblink_is_busy(a)=0 then first_caller:=a; exit; end if;
        if extensions.dblink_is_busy(b)=0 then first_caller:=b; exit; end if;
        if clock_timestamp()>deadline then raise exception 'no join winner completed'; end if;
      end loop;
      if first_caller=a then
        ra:=pg_temp.collect(a); perform extensions.dblink_exec(a,'commit');
        before_second_commit:=pg_temp.remote_json(own,format('select to_jsonb(r) from public.rooms r where id=%L',rid));
        rb:=pg_temp.collect(b); perform extensions.dblink_exec(b,'commit');
      else
        rb:=pg_temp.collect(b); perform extensions.dblink_exec(b,'commit');
        before_second_commit:=pg_temp.remote_json(own,format('select to_jsonb(r) from public.rooms r where id=%L',rid));
        ra:=pg_temp.collect(a); perform extensions.dblink_exec(a,'commit');
      end if;
      outcome_a:=ra->>'outcome'; outcome_b:=rb->>'outcome';
      if kind='distinct_guests' then
        perform pg_temp.require((outcome_a='joined' and outcome_b='full') or (outcome_b='joined' and outcome_a='full'), 'distinct guests: exactly one joined and one full');
        perform pg_temp.require((case when outcome_a='full' then ra else rb end) =
          jsonb_build_object('outcome','full','room_id',null,'room_code',null,'room_state',null,'participant_role',null,'participant_count',null),
          'concurrent full loser discloses only outcome');
      elsif kind='same_guest' then
        perform pg_temp.require((outcome_a='joined' and outcome_b='already_member') or (outcome_b='joined' and outcome_a='already_member'),
          'same guest: exactly one joined and one already_member');
        perform pg_temp.require((ra-'outcome')=(rb-'outcome'), 'same-guest concurrent projection is idempotent');
      else
        perform pg_temp.require(outcome_a='already_member' and ra->>'participant_role'='host' and outcome_b='joined', 'host repeat consumes no guest seat');
      end if;
      rowdata:=pg_temp.remote_json(own,format('select to_jsonb(r) from public.rooms r where id=%L',rid));
      if kind <> 'host_guest' then
        perform pg_temp.require(rowdata=before_second_commit, 'rejected/idempotent second commit preserves all winner fields and timestamps');
      end if;
      perform pg_temp.require(rowdata->>'guest_user_id'=(case when kind='distinct_guests' and outcome_b='joined' then u else g end)::text
        and rowdata->>'host_user_id'=h::text and rowdata->>'state'='ready', 'committed final seat is correct, distinct and Ready');
      perform pg_temp.require((case when outcome_a='joined' then ra else rb end)=jsonb_build_object(
        'outcome','joined','room_id',rid,'room_code',c,'room_state','ready','participant_role','guest','participant_count',2),
        'race winner returns exactly the six-field Ready projection');
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
      perform extensions.dblink_exec(own,format('begin; delete from public.rooms where host_user_id in (%L,%L,%L); delete from auth.users where id in (%L,%L,%L); commit',h,g,u,h,g,u));
      perform pg_temp.require((pg_temp.remote_json(own,format('select to_jsonb(count(*)) from public.rooms where host_user_id in (%L,%L,%L)',h,g,u)))::integer=0,'rooms cleaned');
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
    return next ok(failure is null, kind || ': actual caller roles, simultaneous dispatch, observed barrier, committed exact outcomes');
    if failure is not null then return next diag(failure); end if;
  end if;
  return next ok(cleanup_failure is null and not exists(select 1 from pg_stat_activity where pid in (apid,bpid)),
    kind || ': bounded caller/lock/trigger/schema/room/Auth cleanup');
  if cleanup_failure is not null then return next diag(cleanup_failure); end if;
end;
$trial$;
set local statement_timeout = '120s';
select * from pg_temp.race('collision_winner');
select * from pg_temp.race('collision_winner', true);
select * from pg_temp.race('duplicate_create');
select * from pg_temp.race('distinct_guests');
select * from pg_temp.race('same_guest');
select * from pg_temp.race('host_guest');
set local statement_timeout = '15s';

-- Privileged setup is deliberately separate from the caller-role tests below.
insert into auth.users (id) values
  ('00000000-0000-4000-a000-000000000001'), -- host
  ('00000000-0000-4000-a000-000000000002'), -- guest
  ('00000000-0000-4000-a000-000000000003'); -- unrelated participant

-- T030: inspect the real catalogs, including exact shape (no convenience fields).
-- Normalize catalog text collations so pgTAP can compare records with VALUES.
select results_eq(
  $$select c.relname::text collate "default" from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') order by c.relname$$,
  $$values ('rooms'::text)$$,
  'rooms is the only public application table'
);
select results_eq(
  $$select a.attname::text collate "default", format_type(a.atttypid, a.atttypmod) collate "default", a.attnotnull,
           a.attgenerated::text collate "default", a.attidentity::text collate "default"
    from pg_attribute a where a.attrelid = to_regclass('public.rooms')
      and a.attnum > 0 and not a.attisdropped order by a.attnum$$,
  $$values
    ('id'::text, 'uuid'::text, true, ''::text, ''::text),
    ('code', 'text', true, '', ''),
    ('creation_request_id', 'uuid', true, '', ''),
    ('host_user_id', 'uuid', true, '', ''),
    ('guest_user_id', 'uuid', false, '', ''),
    ('state', 'text', true, 's', ''),
    ('created_at', 'timestamp with time zone', true, '', ''),
    ('updated_at', 'timestamp with time zone', true, '', '')$$,
  'all eight columns have exact order, types, nullability and generated/identity flags'
);
select results_eq(
  $$select a.attname::text collate "default", pg_get_expr(d.adbin, d.adrelid) collate "default"
    from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = to_regclass('public.rooms') and a.attnum > 0
      and not a.attisdropped and a.attgenerated = '' order by a.attnum$$,
  $$values ('id'::text, 'extensions.gen_random_uuid()'::text), ('code', null),
    ('creation_request_id', null), ('host_user_id', null), ('guest_user_id', null),
    ('created_at', 'transaction_timestamp()'), ('updated_at', 'transaction_timestamp()')$$,
  'defaults are extension UUID, null guest and transaction timestamps; required inputs have none'
);
select results_eq(
  $$select btrim(regexp_replace(pg_get_expr(d.adbin, d.adrelid), '\s+', ' ', 'g')) collate "default"
    from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where a.attrelid = to_regclass('public.rooms') and a.attname = 'state'$$,
  $$values ($expression$CASE WHEN (guest_user_id IS NULL) THEN 'waiting'::text ELSE 'ready'::text END$expression$::text)$$,
  'stored state is exactly the guest-null waiting/ready expression'
);
select results_eq(
  $$select conname::text collate "default", contype::text collate "default", pg_get_constraintdef(oid) collate "default", convalidated,
           condeferrable, condeferred
    from pg_constraint where conrelid = to_regclass('public.rooms') order by conname$$,
  $$values
    ('rooms_code_format_check'::text, 'c'::text, $c$CHECK ((code ~ '^[0-9A-F]{10}$'::text))$c$::text, true, false, false),
    ('rooms_code_key', 'u', 'UNIQUE (code)', true, false, false),
    ('rooms_distinct_participants_check', 'c', 'CHECK (((guest_user_id IS NULL) OR (guest_user_id <> host_user_id)))', true, false, false),
    ('rooms_guest_user_id_fkey', 'f', 'FOREIGN KEY (guest_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT', true, false, false),
    ('rooms_host_creation_request_key', 'u', 'UNIQUE (host_user_id, creation_request_id)', true, false, false),
    ('rooms_host_user_id_fkey', 'f', 'FOREIGN KEY (host_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT', true, false, false),
    ('rooms_pkey', 'p', 'PRIMARY KEY (id)', true, false, false)$$,
  'exact stable constraint names, definitions and immediate validation'
);
select results_eq(
  $$select conname::text collate "default", confrelid::regclass::text collate "default",
           confupdtype::text collate "default", confdeltype::text collate "default"
    from pg_constraint where conrelid = to_regclass('public.rooms') and contype = 'f'
    order by conname$$,
  $$values ('rooms_guest_user_id_fkey'::text, 'auth.users'::text, 'a'::text, 'r'::text),
    ('rooms_host_user_id_fkey', 'auth.users', 'a', 'r')$$,
  'both Auth foreign keys use ON UPDATE NO ACTION and ON DELETE RESTRICT'
);
select results_eq(
  $$select i.relname::text collate "default", am.amname::text collate "default", x.indisunique, x.indisvalid, x.indisready,
           pg_get_indexdef(x.indexrelid, 1, true) collate "default",
           (case when x.indnkeyatts > 1 then pg_get_indexdef(x.indexrelid, 2, true) end) collate "default",
           x.indnkeyatts::integer, x.indnatts::integer, pg_get_expr(x.indpred, x.indrelid) collate "default"
    from pg_index x join pg_class i on i.oid = x.indexrelid join pg_am am on am.oid = i.relam
    where x.indrelid = to_regclass('public.rooms') order by i.relname$$,
  $$values
    ('rooms_code_key'::text, 'btree'::text, true, true, true, 'code'::text, null::text, 1, 1, null::text),
    ('rooms_guest_user_id_idx', 'btree', false, true, true, 'guest_user_id', null, 1, 1, '(guest_user_id IS NOT NULL)'),
    ('rooms_host_creation_request_key', 'btree', true, true, true, 'host_user_id', 'creation_request_id', 2, 2, null),
    ('rooms_pkey', 'btree', true, true, true, 'id', null, 1, 1, null)$$,
  'exact four B-tree indexes: host-leading unique key and partial guest lookup, no duplicates'
);
select results_eq(
  $$select n.nspname::text collate "default" from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto'$$,
  $$values ('extensions'::text)$$,
  'pgcrypto is installed in extensions'
);
select is(
  (select count(*) from pg_trigger where tgrelid = to_regclass('public.rooms') and not tgisinternal),
  0::bigint, 'no application timestamp or state trigger'
);

-- T032: owner-only fixtures exercise constraints, not an application write path.
select lives_ok(
  $$insert into public.rooms (code, creation_request_id, host_user_id)
    values ('ABCDEF0123', '20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001')$$,
  'owner fixture accepts canonical code and generates the omitted UUID/state/timestamps'
);
select ok(
  (select id is not null and id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    from public.rooms where code = 'ABCDEF0123'),
  'default id is a non-null random version-4 UUID'
);
select results_eq(
  $$select guest_user_id, state, created_at, updated_at from public.rooms where code = 'ABCDEF0123'$$,
  $$values (null::uuid, 'waiting'::text, transaction_timestamp(), transaction_timestamp())$$,
  'omitted guest is null, state waiting and both timestamps equal transaction time'
);
select lives_ok(
  $$update public.rooms set guest_user_id = '00000000-0000-4000-a000-000000000002'
    where code = 'ABCDEF0123'$$,
  'owner fixture fills only the guest seat'
);
select results_eq(
  $$select host_user_id, guest_user_id, state, created_at, updated_at from public.rooms where code = 'ABCDEF0123'$$,
  $$values ('00000000-0000-4000-a000-000000000001'::uuid, '00000000-0000-4000-a000-000000000002'::uuid,
    'ready'::text, transaction_timestamp(), transaction_timestamp())$$,
  'guest assignment derives ready without an independent state write or timestamp trigger'
);
-- A Waiting room and an unrelated owner's room coexist with the Ready fixture.
select lives_ok(
  $$insert into public.rooms (id, code, creation_request_id, host_user_id) values
    ('10000000-0000-4000-a000-000000000002', 'FEDCBA9876', '20000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000001'),
    ('10000000-0000-4000-a000-000000000003', '0123456789', '20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003')$$,
  'a new request for one host and the same request for another host are both legal'
);
select lives_ok(
  $$insert into public.rooms (code, creation_request_id, host_user_id) values
    ('0000000000', '20000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000001'),
    ('FFFFFFFFFF', '20000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000001')$$,
  'canonical all-zero and all-F codes are accepted'
);
delete from public.rooms where code in ('0000000000', 'FFFFFFFFFF');

-- Private transaction-local snapshot; never granted to a tested client role.
create temporary table phase3_rooms_before on commit drop as select * from public.rooms;

select throws_ok($$insert into public.rooms (id, code, creation_request_id, host_user_id) values (null, 'A000000001', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$, '23502', null, 'null primary key is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'null primary key: all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values (null, '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$, '23502', null, 'null code is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'null code: all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('A000000001', null, '00000000-0000-4000-a000-000000000001')$$, '23502', null, 'null creation request is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'null creation request: all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('A000000001', '20000000-0000-4000-a000-000000000009', null)$$, '23502', null, 'null host is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'null host: all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('abcdef0123', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$, '23514', null, 'invalid code "abcdef0123" is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'invalid code "abcdef0123": all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('ABCDEF012', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$, '23514', null, 'invalid code "ABCDEF012" is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'invalid code "ABCDEF012": all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('ABCDEF01234', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$, '23514', null, 'invalid code "ABCDEF01234" is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'invalid code "ABCDEF01234": all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('GBCDEF0123', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$, '23514', null, 'invalid code "GBCDEF0123" is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'invalid code "GBCDEF0123": all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values (' ABCDEF0123', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$, '23514', null, 'invalid code " ABCDEF0123" is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'invalid code " ABCDEF0123": all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('ABCDEF0123 ', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$, '23514', null, 'invalid code "ABCDEF0123 " is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'invalid code "ABCDEF0123 ": all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$, '23514', null, 'invalid code empty is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'invalid code empty: all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('ABCDEF0123', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$, '23505', null, 'duplicate code is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'duplicate code: all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('A000000001', '20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001')$$, '23505', null, 'duplicate host-request key is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'duplicate host-request key: all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (id, code, creation_request_id, host_user_id) values ('10000000-0000-4000-a000-000000000002', 'A000000001', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$, '23505', null, 'duplicate primary key is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'duplicate primary key: all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('A000000001', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000099')$$, '23503', null, 'missing host Auth row is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'missing host Auth row: all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id, guest_user_id) values ('A000000001', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000099')$$, '23503', null, 'missing guest Auth row is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'missing guest Auth row: all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id, guest_user_id) values ('A000000001', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001')$$, '23514', null, 'same host and guest on insert is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'same host and guest on insert: all eight fields and row count unchanged'
);

select throws_ok($$update public.rooms set guest_user_id = host_user_id where code = 'FEDCBA9876'$$, '23514', null, 'same host and guest on update is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'same host and guest on update: all eight fields and row count unchanged'
);

select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id, state) values ('A000000001', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001', 'ready')$$, '428C9', null, 'independent state on insert is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'independent state on insert: all eight fields and row count unchanged'
);

select throws_ok($$update public.rooms set state = 'waiting' where code = 'ABCDEF0123'$$, '428C9', null, 'independent state on update is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'independent state on update: all eight fields and row count unchanged'
);

select throws_ok($$update public.rooms set created_at = null where code = 'ABCDEF0123'$$, '23502', null, 'null created timestamp is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'null created timestamp: all eight fields and row count unchanged'
);

select throws_ok($$update public.rooms set updated_at = null where code = 'ABCDEF0123'$$, '23502', null, 'null updated timestamp is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'null updated timestamp: all eight fields and row count unchanged'
);

select throws_ok($$delete from auth.users where id = '00000000-0000-4000-a000-000000000001'$$, '23503', null, 'host deletion RESTRICT is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'host deletion RESTRICT: all eight fields and row count unchanged'
);

select throws_ok($$delete from auth.users where id = '00000000-0000-4000-a000-000000000002'$$, '23503', null, 'guest deletion RESTRICT is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'guest deletion RESTRICT: all eight fields and row count unchanged'
);

select throws_ok($$update auth.users set id = '00000000-0000-4000-a000-000000000091' where id = '00000000-0000-4000-a000-000000000001'$$, '23503', null, 'host update NO ACTION is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'host update NO ACTION: all eight fields and row count unchanged'
);

select throws_ok($$update auth.users set id = '00000000-0000-4000-a000-000000000092' where id = '00000000-0000-4000-a000-000000000002'$$, '23503', null, 'guest update NO ACTION is rejected');
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'guest update NO ACTION: all eight fields and row count unchanged'
);

select is((select count(*) from auth.users where id in
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003')),
  3::bigint, 'failed FK deletes/updates preserve every fixture identity');

-- No production RPC or definer helper is needed to test denied client attacks.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
select is(current_user::text, 'authenticated', 'seat attacks execute as authenticated, not the fixture owner');
select is(auth.uid(), '00000000-0000-4000-a000-000000000001'::uuid, 'seat attacks use explicit host claims');

select throws_ok($$update public.rooms set guest_user_id = null where code = 'ABCDEF0123'$$, '42501', null, 'host cannot clear occupied guest');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'clear occupied guest: all eight fields and row count unchanged'
);
set local role authenticated;

select throws_ok($$update public.rooms set guest_user_id = '00000000-0000-4000-a000-000000000003' where code = 'ABCDEF0123'$$, '42501', null, 'host cannot replace occupied guest');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'replace occupied guest: all eight fields and row count unchanged'
);
set local role authenticated;

select throws_ok($$update public.rooms set host_user_id = '00000000-0000-4000-a000-000000000003' where code = 'ABCDEF0123'$$, '42501', null, 'host cannot replace host');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'replace host: all eight fields and row count unchanged'
);
set local role authenticated;

select throws_ok($$update public.rooms set guest_user_id = '00000000-0000-4000-a000-000000000003' where code = 'FEDCBA9876'$$, '42501', null, 'host cannot claim guest directly');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'claim guest directly: all eight fields and row count unchanged'
);
set local role authenticated;

select throws_ok($$update public.rooms set guest_user_id = null, updated_at = transaction_timestamp() where code = 'ABCDEF0123'$$, '42501', null, 'host cannot regress Ready by clearing guest');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'regress Ready by clearing guest: all eight fields and row count unchanged'
);
set local role authenticated;

select throws_ok($$delete from public.rooms where code = 'ABCDEF0123'$$, '42501', null, 'host cannot delete Ready room');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'delete Ready room: all eight fields and row count unchanged'
);
set local role authenticated;

-- Generated-column assignment can be rejected by PostgreSQL before its ACL check;
-- column privilege assertions in T033 separately prove the absence of UPDATE.
select throws_ok($$update public.rooms set state = 'waiting' where code = 'ABCDEF0123'$$,
  '428C9', null, 'client cannot independently regress generated Ready state');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'client state assignment: all eight fields and row count unchanged'
);

-- T093: publication survives clean replay; the following T033 catalog AND real
-- caller assertions must still pass with publication enabled, without broader ACLs.
select results_eq(
  $$select schemaname::text collate "default", tablename::text collate "default"
    from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime'
    order by schemaname, tablename$$,
  $$values ('public'::text, 'rooms'::text)$$,
  'Realtime publishes exactly public.rooms, no unrelated object'
);
select results_eq(
  $$select puballtables, pubupdate from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'$$,
  $$values (false, true)$$,
  'Realtime permits UPDATE delivery without an all-tables publication'
);

-- T033: catalog ACL evidence and actual caller execution are independent checks.
select results_eq(
  $$select relrowsecurity, pg_get_userbyid(relowner)::text collate "default"
    from pg_class where oid = 'public.rooms'::regclass$$,
  $$values (true, 'postgres'::text)$$,
  'rooms enables RLS and is owned by postgres, never a client role'
);
select results_eq(
  $$select polname::text collate "default", polcmd::text collate "default", polpermissive,
      polroles = array['authenticated'::regrole::oid],
      btrim(regexp_replace(pg_get_expr(polqual, polrelid), '\s+', ' ', 'g')) collate "default",
      polwithcheck is null
    from pg_policy where polrelid = 'public.rooms'::regclass order by polname$$,
  $$values ('rooms_select_member'::text, 'r'::text, true, true,
    '((( SELECT auth.uid() AS uid) = host_user_id) OR (( SELECT auth.uid() AS uid) = guest_user_id))'::text, true)$$,
  'only authenticated SELECT policy uses the two scalar auth.uid() membership predicates'
);
select is(
  (select count(*) from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) p
    where c.oid = 'public.rooms'::regclass and p.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)),
  0::bigint, 'PUBLIC and client roles have no table-wide privileges'
);
select results_eq(
  $$select a.attname::text collate "default", p.grantee::regrole::text collate "default",
      p.privilege_type collate "default", p.is_grantable
    from pg_attribute a cross join lateral aclexplode(a.attacl) p
    where a.attrelid = 'public.rooms'::regclass and p.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)
    order by a.attname, p.grantee, p.privilege_type$$,
  $$values ('code'::text, 'authenticated'::text, 'SELECT'::text, false),
    ('id', 'authenticated', 'SELECT', false), ('state', 'authenticated', 'SELECT', false)$$,
  'the only client column grants are non-grantable authenticated SELECT on id/code/state'
);
select is(
  (select count(*) from pg_default_acl d cross join lateral aclexplode(d.defaclacl) p
    where d.defaclrole = 'postgres'::regrole and d.defaclobjtype = 'r'
      and d.defaclnamespace in (0, 'public'::regnamespace::oid)
      and p.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)),
  0::bigint, 'postgres default table privileges do not re-expose public tables to client roles'
);
select results_eq(
  $$select rolname::text collate "default", rolsuper, rolbypassrls
    from pg_roles where rolname in ('anon', 'authenticated') order by rolname$$,
  $$values ('anon'::text, false, false), ('authenticated', false, false)$$,
  'roles under test are not superusers and cannot bypass RLS'
);
select ok(not has_table_privilege(role_name, 'public.rooms', privilege_name),
  role_name || ' has no table-wide ' || privilege_name)
from (values ('anon'), ('authenticated')) as roles(role_name)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) as privileges(privilege_name)
order by role_name, privilege_name;
select is(has_column_privilege('authenticated', 'public.rooms', column_name, 'SELECT'), allowed,
  'authenticated SELECT projection: ' || column_name)
from (values ('id', true), ('code', true), ('state', true), ('creation_request_id', false),
  ('host_user_id', false), ('guest_user_id', false), ('created_at', false), ('updated_at', false)) as columns(column_name, allowed)
order by column_name;
select ok(not has_any_column_privilege(role_name, 'public.rooms', privilege_name),
  role_name || ' has no column-level ' || privilege_name)
from (values ('anon', 'SELECT'), ('anon', 'INSERT'), ('anon', 'UPDATE'), ('anon', 'REFERENCES'),
  ('authenticated', 'INSERT'), ('authenticated', 'UPDATE'), ('authenticated', 'REFERENCES')) as privileges(role_name, privilege_name)
order by role_name, privilege_name;

set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{}';
set local role anon;
select is(current_user::text, 'anon', 'signed-out tests execute as anon, not owner');
select is(auth.uid(), null::uuid, 'signed-out tests have no user claim');
select throws_ok($$select id, code, state from public.rooms$$, '42501', null,
  'anon exact-column read is denied by missing SQL grants, not merely an empty RLS result');
select throws_ok($$select * from public.rooms$$, '42501', null, 'anon wildcard read is denied');
select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id)
  values ('A000000001', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$,
  '42501', null, 'anon INSERT is denied');
select throws_ok($$update public.rooms set guest_user_id = null where code = 'ABCDEF0123'$$,
  '42501', null, 'anon UPDATE is denied');
select throws_ok($$delete from public.rooms where code = 'ABCDEF0123'$$, '42501', null, 'anon DELETE is denied');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
select throws_ok($$select id, code, state from public.rooms$$, '42501', null,
  'claims alone cannot grant room access to database role anon');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'signed-out attacks preserve all rows and fields'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
select is(current_user::text, 'authenticated', 'host tests use authenticated role');
select is(auth.uid(), '00000000-0000-4000-a000-000000000001'::uuid, 'host tests use only their explicit subject claim');
select results_eq(
  $$select code, state from public.rooms order by code$$,
  $$values ('ABCDEF0123'::text, 'ready'::text), ('FEDCBA9876'::text, 'waiting'::text)$$,
  'host sees all and only its own exact-column room projections'
);
select lives_ok($$select id, code, state from public.rooms$$,
  'host may read the full approved projection including internal id');
select is((select count(id) from public.rooms where code = '0123456789'), 0::bigint,
  'host cannot read a different known room code: RLS returns zero, not a grant error');
select is((select count(id) from public.rooms where id = '10000000-0000-4000-a000-000000000003'),
  0::bigint, 'host cannot bypass RLS using a known unrelated immutable id');
select throws_ok($$select creation_request_id from public.rooms$$, '42501', null,
  'host cannot read creation_request_id despite having readable rows');
select throws_ok($$select host_user_id from public.rooms$$, '42501', null,
  'host cannot read host_user_id despite having readable rows');
select throws_ok($$select guest_user_id from public.rooms$$, '42501', null,
  'host cannot read guest_user_id despite having readable rows');
select throws_ok($$select created_at from public.rooms$$, '42501', null,
  'host cannot read created_at despite having readable rows');
select throws_ok($$select updated_at from public.rooms$$, '42501', null,
  'host cannot read updated_at despite having readable rows');
select throws_ok($$select * from public.rooms$$, '42501', null,
  'host cannot read wildcard despite having readable rows');
select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('A000000001', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000001')$$, '42501', null, 'host direct INSERT is denied by SQL grants');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'host INSERT: all rows and fields preserved'
);
set local role authenticated;
select throws_ok($$update public.rooms set guest_user_id = null where code = 'ABCDEF0123'$$, '42501', null, 'host direct UPDATE is denied by SQL grants');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'host UPDATE: all rows and fields preserved'
);
set local role authenticated;
select throws_ok($$delete from public.rooms where code = 'ABCDEF0123'$$, '42501', null, 'host direct DELETE is denied by SQL grants');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'host DELETE: all rows and fields preserved'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}';
select is(current_user::text, 'authenticated', 'guest tests use authenticated role');
select is(auth.uid(), '00000000-0000-4000-a000-000000000002'::uuid, 'guest tests use only their explicit subject claim');
select results_eq(
  $$select code, state from public.rooms order by code$$,
  $$values ('ABCDEF0123'::text, 'ready'::text)$$,
  'guest sees all and only its own exact-column room projections'
);
select lives_ok($$select id, code, state from public.rooms$$,
  'guest may read the full approved projection including internal id');
select is((select count(id) from public.rooms where code = 'FEDCBA9876'), 0::bigint,
  'guest cannot read a different known room code: RLS returns zero, not a grant error');
select is((select count(id) from public.rooms where id = '10000000-0000-4000-a000-000000000002'),
  0::bigint, 'guest cannot bypass RLS using a known unrelated immutable id');
select throws_ok($$select creation_request_id from public.rooms$$, '42501', null,
  'guest cannot read creation_request_id despite having readable rows');
select throws_ok($$select host_user_id from public.rooms$$, '42501', null,
  'guest cannot read host_user_id despite having readable rows');
select throws_ok($$select guest_user_id from public.rooms$$, '42501', null,
  'guest cannot read guest_user_id despite having readable rows');
select throws_ok($$select created_at from public.rooms$$, '42501', null,
  'guest cannot read created_at despite having readable rows');
select throws_ok($$select updated_at from public.rooms$$, '42501', null,
  'guest cannot read updated_at despite having readable rows');
select throws_ok($$select * from public.rooms$$, '42501', null,
  'guest cannot read wildcard despite having readable rows');
select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('A000000001', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000002')$$, '42501', null, 'guest direct INSERT is denied by SQL grants');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'guest INSERT: all rows and fields preserved'
);
set local role authenticated;
select throws_ok($$update public.rooms set guest_user_id = null where code = 'ABCDEF0123'$$, '42501', null, 'guest direct UPDATE is denied by SQL grants');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'guest UPDATE: all rows and fields preserved'
);
set local role authenticated;
select throws_ok($$delete from public.rooms where code = 'ABCDEF0123'$$, '42501', null, 'guest direct DELETE is denied by SQL grants');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'guest DELETE: all rows and fields preserved'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated"}';
select is(current_user::text, 'authenticated', 'unrelated owner tests use authenticated role');
select is(auth.uid(), '00000000-0000-4000-a000-000000000003'::uuid, 'unrelated owner tests use only their explicit subject claim');
select results_eq(
  $$select code, state from public.rooms order by code$$,
  $$values ('0123456789'::text, 'waiting'::text)$$,
  'unrelated owner sees all and only its own exact-column room projections'
);
select lives_ok($$select id, code, state from public.rooms$$,
  'unrelated owner may read the full approved projection including internal id');
select is((select count(id) from public.rooms where code = 'FEDCBA9876'), 0::bigint,
  'unrelated owner cannot read a different known room code: RLS returns zero, not a grant error');
select is((select count(id) from public.rooms where id = '10000000-0000-4000-a000-000000000002'),
  0::bigint, 'unrelated owner cannot bypass RLS using a known unrelated immutable id');
select throws_ok($$select creation_request_id from public.rooms$$, '42501', null,
  'unrelated owner cannot read creation_request_id despite having readable rows');
select throws_ok($$select host_user_id from public.rooms$$, '42501', null,
  'unrelated owner cannot read host_user_id despite having readable rows');
select throws_ok($$select guest_user_id from public.rooms$$, '42501', null,
  'unrelated owner cannot read guest_user_id despite having readable rows');
select throws_ok($$select created_at from public.rooms$$, '42501', null,
  'unrelated owner cannot read created_at despite having readable rows');
select throws_ok($$select updated_at from public.rooms$$, '42501', null,
  'unrelated owner cannot read updated_at despite having readable rows');
select throws_ok($$select * from public.rooms$$, '42501', null,
  'unrelated owner cannot read wildcard despite having readable rows');
select throws_ok($$insert into public.rooms (code, creation_request_id, host_user_id) values ('A000000001', '20000000-0000-4000-a000-000000000009', '00000000-0000-4000-a000-000000000003')$$, '42501', null, 'unrelated owner direct INSERT is denied by SQL grants');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'unrelated owner INSERT: all rows and fields preserved'
);
set local role authenticated;
select throws_ok($$update public.rooms set guest_user_id = null where code = 'ABCDEF0123'$$, '42501', null, 'unrelated owner direct UPDATE is denied by SQL grants');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'unrelated owner UPDATE: all rows and fields preserved'
);
set local role authenticated;
select throws_ok($$delete from public.rooms where code = 'ABCDEF0123'$$, '42501', null, 'unrelated owner direct DELETE is denied by SQL grants');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'unrelated owner DELETE: all rows and fields preserved'
);

set local role authenticated;
set local request.jwt.claims = '{}';
select is(auth.uid(), null::uuid, 'authenticated without claims has no implied participant');
select is((select count(id) from public.rooms), 0::bigint,
  'authenticated without subject can execute the readable projection but RLS returns zero rows');
reset role;

-- T035: exact catalog contract, before any client type generation.
select results_eq(
  $$select p.proname::text collate "default", p.proargnames collate "default", p.proargmodes,
      p.proallargtypes::regtype[]::text collate "default", p.proretset,
      p.prorettype::regtype::text collate "default"
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('create_room', 'join_room') order by p.proname$$,
  $$values ('create_room'::text,
      array['p_creation_request_id','outcome','room_id','room_code','room_state','participant_role','participant_count'],
      array['i','t','t','t','t','t','t']::"char"[], '{uuid,text,uuid,text,text,text,smallint}', true, 'record'),
    ('join_room', array['p_room_code','outcome','room_id','room_code','room_state','participant_role','participant_count'],
      array['i','t','t','t','t','t','t']::"char"[], '{text,text,uuid,text,text,text,smallint}', true, 'record')$$,
  'RPCs have exactly one typed input and the ordered six physically nullable TABLE outputs'
);

-- T036: calls execute as authenticated; snapshots/fixtures execute as owner.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
create temporary table phase4_created on commit drop as
  select * from public.create_room('40000000-0000-4000-a000-000000000001');
select is((select count(*) from pg_temp.phase4_created), 1::bigint, 'create returns exactly one row');
select results_eq($$select outcome, room_state, participant_role, participant_count from pg_temp.phase4_created$$,
  $$values ('created'::text, 'waiting'::text, 'host'::text, 1::smallint)$$, 'new host is Waiting/1');
select ok((select room_id is not null and room_code ~ '^[0-9A-F]{10}$' from pg_temp.phase4_created),
  'server supplies UUID and canonical ten-character code');
select results_eq($$select * from public.create_room('40000000-0000-4000-a000-000000000001')$$,
  $$select 'already_created'::text, room_id, room_code, room_state, participant_role, participant_count from pg_temp.phase4_created$$,
  'same request recovers identical room, exactly one six-field result');
select is((select outcome from public.create_room('40000000-0000-4000-a000-000000000002')),
  'created', 'intentional new request creates another room');
select throws_ok($$select * from public.create_room(null)$$, '22004', null, 'null request raises, no result row');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}';
select is((select outcome from public.create_room('40000000-0000-4000-a000-000000000001')),
  'created', 'same request under another host is a distinct logical operation');
reset role;
select is((select count(*) from public.rooms where creation_request_id::text like '40000000-%'),
  3::bigint, 'all create operations leave exactly three complete rows');
select ok((select bool_and(host_user_id is not null and guest_user_id is null and state = 'waiting'
  and created_at is not null and updated_at is not null) from public.rooms where creation_request_id::text like '40000000-%'),
  'create persists complete authoritative rows, not partial output placeholders');

-- T038: member outcomes and non-member disclosure, all through the real RPC.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
select results_eq($$select * from public.join_room('  fedcba9876  ')$$,
  $$values ('already_member'::text, '10000000-0000-4000-a000-000000000002'::uuid,
    'FEDCBA9876'::text, 'waiting'::text, 'host'::text, 1::smallint)$$,
  'trim+uppercase resolves host re-entry before capacity, Waiting stays Waiting');
select results_eq($$select * from public.join_room('ABCDEF0123')$$,
  $$select 'already_member'::text, id, code, state, 'host'::text, 2::smallint from public.rooms where code = 'ABCDEF0123'$$,
  'host re-entry to Ready is not full');
select results_eq($$select * from public.create_room('20000000-0000-4000-a000-000000000001')$$,
  $$select 'already_created'::text, id, code, state, 'host'::text, 2::smallint from public.rooms where code = 'ABCDEF0123'$$,
  'retry create recovers current Ready projection, not stale Waiting');
select results_eq($$select * from public.join_room(null)$$,
  $$values ('invalid_code'::text, null::uuid, null::text, null::text, null::text, null::smallint)$$,
  'null join discloses no room');
select results_eq(format('select * from public.join_room(%L)', bad),
  $$values ('invalid_code'::text, null::uuid, null::text, null::text, null::text, null::smallint)$$,
  'malformed code reveals no room: ' || quote_nullable(bad))
from (values (''), ('ABCDE'), ('GGGGGGGGGG'), ('ABCDEF01234'), ('ABCDE F012'), (E'ABCDEF0123\n')) codes(bad);
select results_eq($$select * from public.join_room('FFFFFFFFFF')$$,
  $$values ('not_found'::text, null::uuid, null::text, null::text, null::text, null::smallint)$$,
  'unknown canonical code reveals no room');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}';
select results_eq($$select * from public.join_room(' abcdef0123 ')$$,
  $$select 'already_member'::text, id, code, state, 'guest'::text, 2::smallint from public.rooms where code = 'ABCDEF0123'$$,
  'existing guest is idempotent in full Ready room');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated"}';
select results_eq($$select * from public.join_room('ABCDEF0123')$$,
  $$values ('full'::text, null::uuid, null::text, null::text, null::text, null::smallint)$$,
  'third distinct participant receives only full, not internal id/code/state/role/count');
reset role;
select results_eq($$select row_to_json(r)::text from public.rooms r where code in ('ABCDEF0123','FEDCBA9876','0123456789') order by code$$,
  $$select row_to_json(r)::text from pg_temp.phase3_rooms_before r order by code$$,
  'invalid/missing/full/repeated member/create results preserve original rows byte-for-byte');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}';
select results_eq($$select * from public.join_room(' fedcba9876 ')$$,
  $$values ('joined'::text, '10000000-0000-4000-a000-000000000002'::uuid,
    'FEDCBA9876'::text, 'ready'::text, 'guest'::text, 2::smallint)$$,
  'guest seat claim returns exact authoritative Ready/2 projection');
reset role;
select ok((select r.guest_user_id = '00000000-0000-4000-a000-000000000002'
    and r.updated_at = transaction_timestamp() and r.host_user_id = b.host_user_id
    and r.created_at = b.created_at and r.creation_request_id = b.creation_request_id
    from public.rooms r join pg_temp.phase3_rooms_before b using (id) where r.code = 'FEDCBA9876'),
  'claim changes only guest, generated state and updated timestamp');

-- T040: actual SQL grants and independent auth.uid() guards.
select results_eq($$select proname::text collate "default", prosecdef,
    pg_get_userbyid(proowner)::text collate "default", proconfig collate "default",
    (select lanname::text collate "default" from pg_language where oid = prolang)
    from pg_proc where oid in ('public.create_room(uuid)'::regprocedure, 'public.join_room(text)'::regprocedure) order by proname$$,
  $$values ('create_room'::text, true, 'postgres'::text, array['search_path=""'], 'plpgsql'::text),
    ('join_room', true, 'postgres', array['search_path=""'], 'plpgsql')$$,
  'only contained postgres-owned PLpgSQL definers with empty pinned search_path');
select ok(has_function_privilege('authenticated', fn, 'EXECUTE') and not has_function_privilege('anon', fn, 'EXECUTE'),
  fn || ': authenticated execute, anon denied') from (values ('public.create_room(uuid)'), ('public.join_room(text)')) f(fn);
select is((select count(*) from pg_proc p cross join lateral aclexplode(p.proacl) a
  where p.oid in ('public.create_room(uuid)'::regprocedure, 'public.join_room(text)'::regprocedure)
    and a.grantee = 0), 0::bigint, 'PUBLIC has no function execution ACL');
select ok(prosrc !~* '\mexecute\M' and prosrc ~ 'auth.uid\(\)' and prosrc ~ 'public.rooms',
  proname || ': supplemental containment source audit (not a replacement for role calls)')
  from pg_proc where oid in ('public.create_room(uuid)'::regprocedure, 'public.join_room(text)'::regprocedure);
set local request.jwt.claims = '{}';
set local role anon;
select throws_ok($$select * from public.create_room(null)$$, '42501', null, 'anon cannot execute create');
select throws_ok($$select * from public.join_room('ABCDEF0123')$$, '42501', null, 'anon cannot execute join');
set local role authenticated;
select throws_ok($$select * from public.create_room(null)$$, '42501', null, 'create auth guard precedes invalid input');
select throws_ok($$select * from public.join_room(null)$$, '42501', null, 'join auth guard precedes invalid input');
reset role;

-- Single-session rollback-only fault fixtures run after all remote trials.
-- nextval is deliberately nontransactional: a failed INSERT subtransaction must
-- not erase the observed attempt count. Sequence/function/trigger DDL rolls back.
create temporary sequence phase4_attempts;
create temporary table phase4_before_collision on commit drop as select * from public.rooms;
create function pg_temp.phase4_fault() returns trigger language plpgsql as $fault$
begin
  if new.creation_request_id = '40000000-0000-4000-a000-000000000003' then
    if nextval('pg_temp.phase4_attempts') = 1 then new.code := 'ABCDEF0123'; end if;
  elsif new.creation_request_id = '40000000-0000-4000-a000-000000000004' then
    perform nextval('pg_temp.phase4_attempts'); new.code := 'ABCDEF0123';
  end if;
  return new;
end;
$fault$;
create trigger phase4_fault before insert on public.rooms for each row execute function pg_temp.phase4_fault();
grant usage, select on sequence pg_temp.phase4_attempts to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
select is((select outcome from public.create_room('40000000-0000-4000-a000-000000000003')), 'created',
  'real rooms_code_key collision regenerates and succeeds');
select is((select last_value from pg_temp.phase4_attempts), 2::bigint, 'collision recovery made exactly two insert attempts');
reset role;
select results_eq(
  $$select row_to_json(r)::text from public.rooms r where creation_request_id <> '40000000-0000-4000-a000-000000000003' order by id$$,
  $$select row_to_json(r)::text from pg_temp.phase4_before_collision r order by id$$,
  'successful collision regeneration preserves all pre-existing rows byte-for-byte'
);
alter sequence pg_temp.phase4_attempts restart with 1;
-- Distinct fixture timestamps permit the later extra unique-constraint trial.
with times as (select id, row_number() over (order by id) as n from public.rooms)
update public.rooms r set created_at = '2020-01-01 UTC'::timestamptz + times.n * interval '1 second'
  from times where times.id = r.id;
create temporary table phase4_before_failures on commit drop as select * from public.rooms;
set local role authenticated;
select throws_ok($$select * from public.create_room('40000000-0000-4000-a000-000000000004')$$,
  'P0001', 'Room code allocation exhausted', 'five real code collisions are bounded and return no result');
select is((select last_value from pg_temp.phase4_attempts), 5::bigint, 'exhaustion performs exactly five insert attempts');
reset role;
drop trigger phase4_fault on public.rooms;
select results_eq($$select row_to_json(r)::text from public.rooms r order by id$$,
  $$select row_to_json(r)::text from pg_temp.phase4_before_failures r order by id$$,
  'exhaustion preserves every field/row, including collision owner');

-- A real, unrelated unique constraint must propagate its own diagnostics.
alter table public.rooms add constraint phase4_unexpected_unique unique (created_at);
create or replace function pg_temp.phase4_fault() returns trigger language plpgsql as $fault$
begin
  if new.creation_request_id = '40000000-0000-4000-a000-000000000005' then
    select created_at into new.created_at from public.rooms where code = 'ABCDEF0123';
  end if;
  return new;
end;
$fault$;
create trigger phase4_fault before insert on public.rooms for each row execute function pg_temp.phase4_fault();
set local role authenticated;
select throws_ok($$select * from public.create_room('40000000-0000-4000-a000-000000000005')$$,
  '23505', 'duplicate key value violates unique constraint "phase4_unexpected_unique"', 'unknown unique constraint is rethrown unchanged, not code collision');
reset role;
drop trigger phase4_fault on public.rooms;
alter table public.rooms drop constraint phase4_unexpected_unique;

create or replace function pg_temp.phase4_fault() returns trigger language plpgsql as $fault$
begin
  if new.code = '0123456789' then raise exception using errcode = 'P0001', message = 'controlled post-update failure'; end if;
  return new;
end;
$fault$;
create trigger phase4_fault after update on public.rooms for each row execute function pg_temp.phase4_fault();
set local role authenticated;
select throws_ok($$select * from public.join_room('0123456789')$$,
  'P0001', 'controlled post-update failure', 'post-seat-update exception returns no business result');
reset role;
drop trigger phase4_fault on public.rooms;
select results_eq($$select row_to_json(r)::text from public.rooms r order by id$$,
  $$select row_to_json(r)::text from pg_temp.phase4_before_failures r order by id$$,
  'unknown-constraint and post-UPDATE exceptions leave no partial row/seat or timestamp change');

-- finish() and rollback leave neither room fixtures nor Auth fixture rows behind.
select * from finish();
rollback;
