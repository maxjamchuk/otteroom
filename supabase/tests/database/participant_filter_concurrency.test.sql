-- Feature 004 deterministic concurrency evidence runs before any controller
-- transaction has touched application rows or installed test triggers.
\connect -reuse-previous=on "user=supabase_admin"
begin;
set local statement_timeout='60s';
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select no_plan();

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
declare result jsonb;begin select j into strict result from extensions.dblink(connection,query) t(j jsonb);return result;end;
$f$;
create function pg_temp.await_ready(connection text) returns void language plpgsql as $f$
declare deadline timestamptz:=clock_timestamp()+interval '8s';begin
  while extensions.dblink_is_busy(connection)=1 loop
    if clock_timestamp()>deadline then raise exception 'filter async deadline';end if;
  end loop;
end;
$f$;
create function pg_temp.collect(connection text) returns jsonb language plpgsql as $f$
declare result jsonb;begin perform pg_temp.await_ready(connection);
  select j into strict result from extensions.dblink_get_result(connection) t(j jsonb);
  perform j from extensions.dblink_get_result(connection) t(j jsonb);return result;end;
$f$;
create function pg_temp.caller(connection text,subject uuid) returns void language plpgsql as $f$
declare identity jsonb;begin
  perform extensions.dblink_exec(connection,'set role authenticated;begin isolation level read committed');
  perform pg_temp.remote_json(connection,format('select to_jsonb(set_config(''request.jwt.claims'',%L,false))',
    jsonb_build_object('sub',subject,'role','authenticated')::text));
  identity:=pg_temp.remote_json(connection,
    'select jsonb_build_object(''role'',current_user,''uid'',auth.uid(),''isolation'',current_setting(''transaction_isolation''))');
  perform pg_temp.require(identity=jsonb_build_object('role','authenticated','uid',subject,'isolation','read committed'),
    'independent authenticated READ COMMITTED caller required');
end;
$f$;

create function pg_temp.concurrent_filter_trial(kind text) returns setof text language plpgsql as $trial$
declare
  ns text:='filter_concurrency_'||kind||'_'||encode(extensions.gen_random_bytes(4),'hex');
  own text; a text; b text; conninfo text:='dbname=postgres user=postgres connect_timeout=3';
  creator uuid:=extensions.gen_random_uuid();v1 uuid:=extensions.gen_random_uuid();v2 uuid:=extensions.gen_random_uuid();
  rid uuid:=extensions.gen_random_uuid();m0 uuid:=extensions.gen_random_uuid();m1 uuid:=extensions.gen_random_uuid();m2 uuid:=extensions.gen_random_uuid();
  code text:='B4'||upper(encode(extensions.gen_random_bytes(4),'hex'));
  apid integer;bpid integer;opid integer;first text;second text;firstpid integer;secondpid integer;
  ra jsonb;rb jsonb;deadline timestamptz;failure text;cleanup_failure text;name text;j jsonb;
  fa integer:=0;fb integer:=0;ua integer:=0;ub integer:=0;
  qa text;qb text;target integer:=3;initial integer:=case when kind in('final_two','edit_first','final_first') then 1 else 0 end;
  subject_a uuid;subject_b uuid;
  filter_stats text:='select to_jsonb(coalesce((select n_tup_ins+n_tup_upd from pg_stat_xact_user_tables where relid=''public.participant_filters''::regclass),0))';
  room_stats text:='select to_jsonb(coalesce((select n_tup_upd from pg_stat_xact_user_tables where relid=''public.rooms''::regclass),0))';
begin
  if kind in('edit_first','final_first') then target:=2;end if;
  own:=ns||'_owner';a:=ns||'_a';b:=ns||'_b';
  subject_a:=case when kind='same_equal' or kind='same_different' or kind='edit_first' then creator
    when kind='final_two' then v1
    when kind='final_first' then v1 else creator end;
  subject_b:=case when kind in('same_equal','same_different','final_first') then creator
    when kind='final_two' then v2 else v1 end;
  qa:=format('select to_jsonb(x) from public.submit_my_participant_filter(%L,%L::public.participant_genre[],%s::smallint,%s::smallint) x',
    rid,case when kind='final_first' then '{drama}' else '{action}' end,
    case when kind='final_first' then 1900 else 2000 end,case when kind='final_first' then 2026 else 2020 end);
  qb:=format('select to_jsonb(x) from public.submit_my_participant_filter(%L,%L::public.participant_genre[],%s::smallint,%s::smallint) x',
    rid,case when kind='same_equal' then '{action}' else case when kind='same_different' then '{western}' else '{drama}' end end,
    case when kind='same_equal' then 2000 else 1900 end,
    case when kind='same_equal' then 2020 else 2026 end);
  begin
    perform extensions.dblink_connect(own,conninfo);
    perform extensions.dblink_exec(own,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    perform extensions.dblink_exec(own,format(
      'insert into auth.users(id) values(%1$L),(%2$L),(%3$L);'
      'insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,filter_completed_count) values(%4$L,%5$L,%6$L,%7$L,%8$s,%8$s,%9$s);'
      'insert into public.room_members(id,room_id,user_id,is_voter) values(%10$L,%4$L,%1$L,true),(%11$L,%4$L,%2$L,true);',
      creator,v1,v2,rid,code,extensions.gen_random_uuid(),creator,target,initial,m0,m1));
    if target=3 then perform extensions.dblink_exec(own,format(
      'insert into public.room_members(id,room_id,user_id,is_voter) values(%L,%L,%L,true)',m2,rid,v2));end if;
    if initial=1 then perform extensions.dblink_exec(own,format(
      'insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to) values(%L,''{comedy}'',2000,2020)',m0));end if;
    perform extensions.dblink_connect(a,conninfo);perform extensions.dblink_connect(b,conninfo);
    perform extensions.dblink_exec(a,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    perform extensions.dblink_exec(b,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    apid:=pg_temp.remote_json(a,'select to_jsonb(pg_backend_pid())')::integer;
    bpid:=pg_temp.remote_json(b,'select to_jsonb(pg_backend_pid())')::integer;
    opid:=pg_temp.remote_json(own,'select to_jsonb(pg_backend_pid())')::integer;
    perform pg_temp.require(apid<>bpid and apid<>opid and bpid<>opid,'three independent filter backends');
    perform pg_temp.caller(a,subject_a);perform pg_temp.caller(b,subject_b);
    perform extensions.dblink_exec(own,'begin');
    perform pg_temp.remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',rid));

    if kind in('edit_first','final_first') then
      perform pg_temp.require(extensions.dblink_send_query(a,qa)=1,'first ordered filter call dispatched');
      deadline:=clock_timestamp()+interval '8s';loop
        exit when extensions.dblink_is_busy(a)=1 and opid=any(pg_blocking_pids(apid));
        if clock_timestamp()>deadline then raise exception 'first call did not block on owner room lock';end if;end loop;
      perform pg_temp.require(exists(select 1 from pg_locks where pid=apid and not granted),
        'first ordered caller exposes an ungranted lock while blocked');
      perform extensions.dblink_exec(own,'commit');
      ra:=pg_temp.collect(a);fa:=pg_temp.remote_json(a,filter_stats)::integer;ua:=pg_temp.remote_json(a,room_stats)::integer;
      perform pg_temp.require(extensions.dblink_send_query(b,qb)=1,'second ordered filter call dispatched');
      deadline:=clock_timestamp()+interval '8s';loop
        exit when extensions.dblink_is_busy(b)=1 and apid=any(pg_blocking_pids(bpid));
        if clock_timestamp()>deadline then raise exception 'second call did not block directly on first';end if;end loop;
      perform pg_temp.require(exists(select 1 from pg_locks where pid=bpid and not granted),
        'second ordered caller exposes an ungranted lock while blocked');
      perform extensions.dblink_exec(a,'commit');
      rb:=pg_temp.collect(b);fb:=pg_temp.remote_json(b,filter_stats)::integer;ub:=pg_temp.remote_json(b,room_stats)::integer;
      perform extensions.dblink_exec(b,'commit');
    else
      perform pg_temp.require(extensions.dblink_send_query(a,qa)=1 and extensions.dblink_send_query(b,qb)=1,
        'parallel filter calls dispatched');
      deadline:=clock_timestamp()+interval '8s';loop
        exit when extensions.dblink_is_busy(a)=1 and extensions.dblink_is_busy(b)=1
          and cardinality(pg_blocking_pids(apid))>0 and cardinality(pg_blocking_pids(bpid))>0
          and (opid=any(pg_blocking_pids(apid)) or opid=any(pg_blocking_pids(bpid)));
        if clock_timestamp()>deadline then raise exception 'parallel calls did not block on owner room lock';end if;end loop;
      perform pg_temp.require(exists(select 1 from pg_locks where pid in(apid,bpid) and not granted),
        'parallel callers expose an ungranted room-lock wait');
      perform extensions.dblink_exec(own,'commit');
      deadline:=clock_timestamp()+interval '8s';loop
        if extensions.dblink_is_busy(a)=0 then first:=a;second:=b;firstpid:=apid;secondpid:=bpid;exit;end if;
        if extensions.dblink_is_busy(b)=0 then first:=b;second:=a;firstpid:=bpid;secondpid:=apid;exit;end if;
        if clock_timestamp()>deadline then raise exception 'serialized winner missing';end if;end loop;
      perform pg_temp.require(extensions.dblink_is_busy(second)=1 and firstpid=any(pg_blocking_pids(secondpid)),
        'loser blocks on winner transaction after owner release');
      perform pg_temp.require(exists(select 1 from pg_locks where pid=secondpid and not granted),
        'serialized loser exposes an ungranted lock');
      if first=a then
        ra:=pg_temp.collect(a);fa:=pg_temp.remote_json(a,filter_stats)::integer;ua:=pg_temp.remote_json(a,room_stats)::integer;
        perform extensions.dblink_exec(a,'commit');rb:=pg_temp.collect(b);fb:=pg_temp.remote_json(b,filter_stats)::integer;ub:=pg_temp.remote_json(b,room_stats)::integer;perform extensions.dblink_exec(b,'commit');
      else
        rb:=pg_temp.collect(b);fb:=pg_temp.remote_json(b,filter_stats)::integer;ub:=pg_temp.remote_json(b,room_stats)::integer;
        perform extensions.dblink_exec(b,'commit');ra:=pg_temp.collect(a);fa:=pg_temp.remote_json(a,filter_stats)::integer;ua:=pg_temp.remote_json(a,room_stats)::integer;perform extensions.dblink_exec(a,'commit');
      end if;
    end if;
    if kind='distinct' then perform pg_temp.require(ra->>'outcome'='saved' and rb->>'outcome'='saved'
      and array[(ra->>'filter_completed_count')::integer,(rb->>'filter_completed_count')::integer] @> array[1,2]
      and fa=1 and fb=1 and ua=1 and ub=1,'two distinct first owners insert/count exactly once');
    elsif kind='final_two' then perform pg_temp.require(ra->>'outcome'='saved' and rb->>'outcome'='saved'
      and array[(ra->>'filter_completed_count')::integer,(rb->>'filter_completed_count')::integer] @> array[2,3]
      and fa=1 and fb=1 and ua=1 and ub=1,format('final-two actual=%s/%s counts=%s/%s writes=%s,%s/%s,%s',
        ra->>'outcome',rb->>'outcome',ra->>'filter_completed_count',rb->>'filter_completed_count',fa,fb,ua,ub));
    elsif kind='same_equal' then perform pg_temp.require(array[ra->>'outcome',rb->>'outcome'] @> array['saved','unchanged']
      and fa+fb=1 and ua+ub=1,format('same-equal actual=%s/%s writes=%s,%s/%s,%s',
        ra->>'outcome',rb->>'outcome',fa,fb,ua,ub));
    elsif kind='same_different' then perform pg_temp.require(ra->>'outcome'='saved' and rb->>'outcome'='saved'
      and fa+fb=2 and ua+ub=1,'same owner different overlap leaves one row/contribution and serial replacement');
    elsif kind='edit_first' then perform pg_temp.require(ra->>'outcome'='saved' and rb->>'outcome'='saved'
      and fa=1 and ua=0 and fb=1 and ub=1,'edit-first replacement commits before final freeze');
    else perform pg_temp.require(ra->>'outcome'='saved' and rb->>'outcome'='locked'
      and fa=1 and ua=1 and fb=0 and ub=0,'final-first freezes and blocked edit performs zero writes');end if;
    perform pg_temp.require(pg_temp.remote_json(own,format(
      'select to_jsonb(filter_completed_count=(select count(*) from public.participant_filters f join public.room_members m on m.id=f.room_member_id where m.room_id=%L and m.is_voter) and filter_completed_count<=required_voter_count) from public.rooms where id=%L',rid,rid))::boolean,
      'exact row/count invariant holds after every serialized commit');
  exception when others then failure:=sqlerrm;end;
  foreach name in array array[a,b] loop begin
    if name=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      if extensions.dblink_is_busy(name)=1 then perform extensions.dblink_cancel_query(name);perform pg_temp.await_ready(name);
        perform j from extensions.dblink_get_result(name,false) t(j jsonb);perform j from extensions.dblink_get_result(name,false) t(j jsonb);end if;
      perform extensions.dblink_exec(name,'rollback');perform extensions.dblink_disconnect(name);end if;
  exception when others then cleanup_failure:='client cleanup';end;end loop;
  begin if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
    perform extensions.dblink_exec(own,'rollback');
    perform extensions.dblink_exec(own,format('begin;delete from public.rooms where id=%L;delete from auth.users where id in(%L,%L,%L);commit',rid,creator,v1,v2));
    perform extensions.dblink_disconnect(own);end if;
  exception when others then cleanup_failure:='owner cleanup';end;
  return next ok(failure is null,kind||': deterministic lock/outcome/write trial');
  if failure is not null then return next diag(failure);end if;
  return next ok(cleanup_failure is null and not(array[a,b,own]&&coalesce(extensions.dblink_get_connections(),array[]::text[])),
    kind||': exact fixture/backend cleanup');
end;
$trial$;

select * from pg_temp.concurrent_filter_trial('distinct');
select * from pg_temp.concurrent_filter_trial('final_two');
select * from pg_temp.concurrent_filter_trial('same_equal');
select * from pg_temp.concurrent_filter_trial('same_different');
select * from pg_temp.concurrent_filter_trial('edit_first');
select * from pg_temp.concurrent_filter_trial('final_first');

select ok(
  pg_get_functiondef('public.get_my_participant_filter(uuid)'::regprocedure)
    not like '%select pg_catalog.count(*)::integer into v_actual%'
  and pg_get_functiondef('public.get_my_participant_filter(uuid)'::regprocedure)
    not like '%select f.* into v_filter%'
  and pg_get_functiondef('public.get_my_participant_filter(uuid)'::regprocedure)
    like '%f as filter_row%'
  and pg_get_functiondef('public.get_my_participant_filter(uuid)'::regprocedure)
    like '%as actual_filter_count%'
  and pg_get_functiondef('public.get_my_participant_filter(uuid)'::regprocedure)
    like '%left join public.participant_filters as f%',
  'recovery room/member/own-filter/actual-count authority is one SQL statement');

-- Hold the private table in the submitting transaction so recovery reaches its
-- participant-filter read and blocks without a timing sleep. The real final
-- submit then commits before recovery continues. A recovery assembled from
-- multiple READ COMMITTED statements mixes the old room row with the new
-- filter count and raises a false integrity failure; one statement returns a
-- coherent old or new business snapshot.
create function pg_temp.recovery_submit_snapshot_trial() returns setof text language plpgsql as $trial$
declare
  ns text:='filter_concurrency_recovery_'||encode(extensions.gen_random_bytes(4),'hex');
  own text:=ns||'_owner';recoverer text:=ns||'_recoverer';submitter text:=ns||'_submitter';
  conninfo text:='dbname=postgres user=postgres connect_timeout=3';
  recovering_user uuid:=extensions.gen_random_uuid();other_user uuid:=extensions.gen_random_uuid();
  rid uuid:=extensions.gen_random_uuid();recovering_member uuid:=extensions.gen_random_uuid();
  other_member uuid:=extensions.gen_random_uuid();code text:='C4'||upper(encode(extensions.gen_random_bytes(4),'hex'));
  recoverer_pid integer;submitter_pid integer;result jsonb;submitted jsonb;final_state jsonb;
  recover_filter_writes integer:=0;recover_room_writes integer:=0;
  submit_filter_writes integer:=0;submit_room_writes integer:=0;
  deadline timestamptz;failure text;cleanup_failure text;name text;j jsonb;
  filter_stats text:='select to_jsonb(coalesce((select n_tup_ins+n_tup_upd from pg_stat_xact_user_tables where relid=''public.participant_filters''::regclass),0))';
  room_stats text:='select to_jsonb(coalesce((select n_tup_upd from pg_stat_xact_user_tables where relid=''public.rooms''::regclass),0))';
begin
  begin
    perform extensions.dblink_connect(own,conninfo);
    perform extensions.dblink_exec(own,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    perform extensions.dblink_exec(own,format(
      'insert into auth.users(id) values(%1$L),(%2$L);'
      'insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,filter_completed_count) values(%3$L,%4$L,%5$L,%1$L,2,2,1);'
      'insert into public.room_members(id,room_id,user_id,is_voter) values(%6$L,%3$L,%1$L,true),(%7$L,%3$L,%2$L,true);'
      'insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to) values(%7$L,''{comedy}'',2000,2020)',
      recovering_user,other_user,rid,code,extensions.gen_random_uuid(),recovering_member,other_member));

    perform extensions.dblink_connect(recoverer,conninfo);
    perform extensions.dblink_connect(submitter,conninfo);
    perform extensions.dblink_exec(recoverer,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    perform extensions.dblink_exec(submitter,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    recoverer_pid:=pg_temp.remote_json(recoverer,'select to_jsonb(pg_backend_pid())')::integer;
    submitter_pid:=pg_temp.remote_json(submitter,'select to_jsonb(pg_backend_pid())')::integer;
    perform pg_temp.require(recoverer_pid<>submitter_pid,'recovery and submit use independent backends');
    perform pg_temp.caller(recoverer,recovering_user);

    -- The privileged connection acquires only the deterministic test barrier;
    -- the actual RPC still runs as authenticated with the caller's JWT.
    perform extensions.dblink_exec(submitter,
      'begin isolation level read committed;lock table public.participant_filters in access exclusive mode;set role authenticated');
    perform pg_temp.remote_json(submitter,format(
      'select to_jsonb(set_config(''request.jwt.claims'',%L,false))',
      jsonb_build_object('sub',recovering_user,'role','authenticated')::text));
    perform pg_temp.require(pg_temp.remote_json(submitter,
      'select jsonb_build_object(''role'',current_user,''uid'',auth.uid(),''isolation'',current_setting(''transaction_isolation''))')
      =jsonb_build_object('role','authenticated','uid',recovering_user,'isolation','read committed'),
      'real submit runs in an independent authenticated READ COMMITTED session');

    perform pg_temp.require(extensions.dblink_send_query(recoverer,format(
      'select to_jsonb(x) from public.get_my_participant_filter(%L) x',rid))=1,
      'own-filter recovery dispatched while final submit barrier is held');
    deadline:=clock_timestamp()+interval '8s';
    loop
      exit when extensions.dblink_is_busy(recoverer)=1
        and submitter_pid=any(pg_blocking_pids(recoverer_pid))
        and exists(select 1 from pg_locks where pid=recoverer_pid and relation='public.participant_filters'::regclass and not granted);
      if clock_timestamp()>deadline then raise exception 'recovery did not reach deterministic participant-filter barrier';end if;
    end loop;

    submitted:=pg_temp.remote_json(submitter,format(
      'select to_jsonb(x) from public.submit_my_participant_filter(%L,''{action}''::public.participant_genre[],1900::smallint,extract(year from transaction_timestamp() at time zone ''UTC'')::smallint) x',rid));
    submit_filter_writes:=pg_temp.remote_json(submitter,filter_stats)::integer;
    submit_room_writes:=pg_temp.remote_json(submitter,room_stats)::integer;
    perform extensions.dblink_exec(submitter,'commit');

    result:=pg_temp.collect(recoverer);
    recover_filter_writes:=pg_temp.remote_json(recoverer,filter_stats)::integer;
    recover_room_writes:=pg_temp.remote_json(recoverer,room_stats)::integer;
    perform extensions.dblink_exec(recoverer,'commit');

    perform pg_temp.require(submitted->>'outcome'='saved'
      and (submitted->>'filter_completed_count')::integer=2
      and submit_filter_writes=1 and submit_room_writes=1,
      'overlapped real final submit reaches N/N with exact one filter/room write');
    perform pg_temp.require(
      (result->>'outcome'='not_submitted' and result->'genres'='null'::jsonb
        and result->'release_year_from'='null'::jsonb and result->'release_year_to'='null'::jsonb
        and (result->>'filter_completed_count')::integer=1)
      or (result->>'outcome'='locked' and result->'genres'='["action"]'::jsonb
        and (result->>'release_year_from')::integer=1900
        and result->>'release_year_to'=result->>'allowed_release_year_max'
        and (result->>'filter_completed_count')::integer=2),
      'recovery returns one coherent old-or-new own-filter business snapshot');
    perform pg_temp.require((result->>'required_voter_count')::integer=2
      and recover_filter_writes=0 and recover_room_writes=0,
      'overlapped recovery performs zero filter/room writes');
    final_state:=pg_temp.remote_json(own,format(
      'select jsonb_build_object(''count'',r.filter_completed_count,''rows'',count(f.*),''own'',count(f.*) filter(where f.room_member_id=%L)) from public.rooms r join public.room_members m on m.room_id=r.id left join public.participant_filters f on f.room_member_id=m.id where r.id=%L group by r.filter_completed_count',recovering_member,rid));
    perform pg_temp.require(final_state=jsonb_build_object('count',2,'rows',2,'own',1),
      'final recovery/submit state preserves exact row/count ownership');
  exception when others then failure:=sqlerrm;end;

  foreach name in array array[recoverer,submitter] loop begin
    if name=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      if extensions.dblink_is_busy(name)=1 then perform extensions.dblink_cancel_query(name);perform pg_temp.await_ready(name);
        perform j from extensions.dblink_get_result(name,false) t(j jsonb);perform j from extensions.dblink_get_result(name,false) t(j jsonb);end if;
      perform extensions.dblink_exec(name,'rollback');perform extensions.dblink_disconnect(name);end if;
  exception when others then cleanup_failure:='client cleanup';end;end loop;
  begin if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
    perform extensions.dblink_exec(own,'rollback');
    perform extensions.dblink_exec(own,format(
      'begin;delete from public.rooms where id=%L;delete from auth.users where id in(%L,%L);commit',rid,recovering_user,other_user));
    perform extensions.dblink_disconnect(own);end if;
  exception when others then cleanup_failure:='owner cleanup';end;
  return next ok(failure is null,'recovery-vs-submit uses one coherent MVCC statement snapshot');
  if failure is not null then return next diag(failure);end if;
  return next ok(cleanup_failure is null and not(array[recoverer,submitter,own]&&coalesce(extensions.dblink_get_connections(),array[]::text[])),
    'recovery-vs-submit exact fixture/backend cleanup');
end;
$trial$;

select * from pg_temp.recovery_submit_snapshot_trial();
select is((select count(*) from pg_stat_activity where application_name like 'filter_concurrency_%'),0::bigint,
  'no filter concurrency backend remains');

-- Feature 005 must consume the frozen N/N set without reopening or rewriting it.
create function pg_temp.resolution_client(subject uuid,command text)
returns jsonb language plpgsql as $f$
declare result jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
  execute 'select to_jsonb(x) from ('||command||')x' into result;
  reset role;return result;
exception when others then reset role;raise;
end;
$f$;
insert into auth.users(id) values
  ('05200000-0000-4000-a000-000000000001'),('05200000-0000-4000-a000-000000000002');
insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,
  voter_count,filter_completed_count) values
  ('05210000-0000-4000-a000-000000000001','F500000101','05220000-0000-4000-a000-000000000001',
   '05200000-0000-4000-a000-000000000001',2,2,2);
insert into public.room_members(id,room_id,user_id,is_voter) values
  ('05230000-0000-4000-a000-000000000001','05210000-0000-4000-a000-000000000001','05200000-0000-4000-a000-000000000001',true),
  ('05230000-0000-4000-a000-000000000002','05210000-0000-4000-a000-000000000001','05200000-0000-4000-a000-000000000002',true);
insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to) values
  ('05230000-0000-4000-a000-000000000001','{action}',2000,2020),
  ('05230000-0000-4000-a000-000000000002','{drama}',2005,2015);
create temporary table feature005_frozen_before as
  select f.*,f.xmin::text row_xmin from public.participant_filters f order by room_member_id;
select is(pg_temp.resolution_client('05200000-0000-4000-a000-000000000001',
  $$select * from public.resolve_common_filters('05210000-0000-4000-a000-000000000001')$$)->>'outcome',
  'compatible','resolution consumes the frozen set without a filter mutation');
select results_eq(
  $$select f.*,f.xmin::text row_xmin from public.participant_filters f order by room_member_id$$,
  $$select * from feature005_frozen_before$$,
  'resolution preserves every Feature 004 filter value and xmin');
select is(pg_temp.resolution_client('05200000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('05210000-0000-4000-a000-000000000001','{western}'::public.participant_genre[],2000::smallint,2020::smallint)$$)->>'outcome',
  'locked','terminal resolution does not reopen Feature 004 editing');
select results_eq(
  $$select f.*,f.xmin::text row_xmin from public.participant_filters f order by room_member_id$$,
  $$select * from feature005_frozen_before$$,
  'post-resolution edit remains a zero-write frozen no-op');
select * from finish();
rollback;
