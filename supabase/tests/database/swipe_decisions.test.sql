-- Feature 007 immutable decision authority and privacy-safe projections.
\connect -reuse-previous=on "user=supabase_admin"
begin;
set local search_path = pg_catalog, public, extensions;
set local statement_timeout = '60s';
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Independent READ COMMITTED sessions prove the room lock is the serialized
-- first-write boundary. Fixtures are committed through a dedicated connection
-- because controller-local rows are intentionally invisible to dblink.
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
create function pg_temp.decision_require(condition boolean,message text) returns void
language plpgsql as $f$ begin if not coalesce(condition,false) then raise exception using message=message;end if;end $f$;
create function pg_temp.decision_remote_json(connection text,query text) returns jsonb
language plpgsql as $f$ declare result jsonb;begin
  select j into strict result from extensions.dblink(connection,query) t(j jsonb);return result;
end $f$;
create function pg_temp.decision_await(connection text) returns void language plpgsql as $f$
declare deadline timestamptz:=clock_timestamp()+interval '8s';begin
  while extensions.dblink_is_busy(connection)=1 loop
    if clock_timestamp()>deadline then raise exception 'decision async deadline';end if;
  end loop;
end $f$;
create function pg_temp.decision_collect(connection text) returns jsonb language plpgsql as $f$
declare result jsonb;begin
  perform pg_temp.decision_await(connection);
  select j into strict result from extensions.dblink_get_result(connection) t(j jsonb);
  perform j from extensions.dblink_get_result(connection) t(j jsonb);
  return result;
end $f$;
create function pg_temp.decision_caller(connection text,subject uuid) returns void language plpgsql as $f$
declare identity jsonb;begin
  perform extensions.dblink_exec(connection,'set statement_timeout=''20s'';set lock_timeout=''15s'';set role authenticated;begin isolation level read committed');
  perform pg_temp.decision_remote_json(connection,format(
    'select to_jsonb(set_config(''request.jwt.claims'',%L,false))',
    jsonb_build_object('sub',subject,'role','authenticated')::text));
  identity:=pg_temp.decision_remote_json(connection,
    'select jsonb_build_object(''role'',current_user,''uid'',auth.uid(),''isolation'',current_setting(''transaction_isolation''))');
  perform pg_temp.decision_require(identity=jsonb_build_object('role','authenticated','uid',subject,'isolation','read committed'),
    'independent authenticated READ COMMITTED decision caller required');
end $f$;

create function pg_temp.concurrent_decision_trial(kind text) returns setof text language plpgsql as $trial$
declare
  ns text:='decision_concurrency_'||kind||'_'||encode(extensions.gen_random_bytes(4),'hex');
  own text:=ns||'_owner';a text:=ns||'_a';b text:=ns||'_b';
  conninfo text:='dbname=postgres user=postgres connect_timeout=3 application_name='||ns;
  u1 uuid:=extensions.gen_random_uuid();u2 uuid:=extensions.gen_random_uuid();
  rid uuid:=extensions.gen_random_uuid();m1 uuid:=extensions.gen_random_uuid();m2 uuid:=extensions.gen_random_uuid();
  code text:='D7'||upper(encode(extensions.gen_random_bytes(4),'hex'));
  opid integer;apid integer;bpid integer;first text;second text;firstpid integer;secondpid integer;
  ra jsonb;rb jsonb;final jsonb;deadline timestamptz;failure text;cleanup_failure text;name text;j jsonb;
  subject_b uuid:=case when kind='distinct' then u2 else u1 end;
  value_a text:=case when kind='same_no' then 'no' else 'yes' end;
  value_b text:=case when kind in('same_no','opposite') then 'no' else 'yes' end;
  qa text;qb text;da integer:=0;db integer:=0;ua integer:=0;ub integer:=0;
  detail_stats text:='select to_jsonb(coalesce((select n_tup_ins+n_tup_upd from pg_stat_xact_user_tables where relid=''public.candidate_decisions''::regclass),0))';
  room_stats text:='select to_jsonb(coalesce((select n_tup_upd from pg_stat_xact_user_tables where relid=''public.rooms''::regclass),0))';
begin
  qa:=format('select to_jsonb(x) from public.submit_room_candidate_decision(%L,7701,%L::public.candidate_decision_value) x',rid,value_a);
  qb:=format('select to_jsonb(x) from public.submit_room_candidate_decision(%L,7701,%L::public.candidate_decision_value) x',rid,value_b);
  begin
    perform extensions.dblink_connect(own,conninfo);
    perform extensions.dblink_exec(own,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    perform extensions.dblink_exec(own,format(
      'insert into auth.users(id) values(%1$L),(%2$L);'
      'insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,filter_completed_count,filter_resolution_status,candidate_acquisition_status,tmdb_movie_id) values(%3$L,%4$L,%5$L,%1$L,2,2,2,''compatible'',''assigned'',7701);'
      'insert into public.room_members(id,room_id,user_id,is_voter) values(%6$L,%3$L,%1$L,true),(%7$L,%3$L,%2$L,true)',
      u1,u2,rid,code,extensions.gen_random_uuid(),m1,m2));
    perform extensions.dblink_connect(a,conninfo);perform extensions.dblink_connect(b,conninfo);
    perform pg_temp.decision_caller(a,u1);perform pg_temp.decision_caller(b,subject_b);
    opid:=pg_temp.decision_remote_json(own,'select to_jsonb(pg_backend_pid())')::integer;
    apid:=pg_temp.decision_remote_json(a,'select to_jsonb(pg_backend_pid())')::integer;
    bpid:=pg_temp.decision_remote_json(b,'select to_jsonb(pg_backend_pid())')::integer;
    perform pg_temp.decision_require(opid<>apid and opid<>bpid and apid<>bpid,'three distinct decision backends required');
    perform extensions.dblink_exec(own,'begin');
    perform pg_temp.decision_remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',rid));
    perform pg_temp.decision_require(extensions.dblink_send_query(a,qa)=1 and extensions.dblink_send_query(b,qb)=1,
      'both decision calls dispatched before release');
    deadline:=clock_timestamp()+interval '8s';loop
      exit when extensions.dblink_is_busy(a)=1 and extensions.dblink_is_busy(b)=1
        and cardinality(pg_blocking_pids(apid))>0 and cardinality(pg_blocking_pids(bpid))>0
        and (opid=any(pg_blocking_pids(apid)) or opid=any(pg_blocking_pids(bpid)))
        and exists(select 1 from pg_locks where pid in(apid,bpid) and not granted);
      if clock_timestamp()>deadline then raise exception 'decision callers did not reach owner lock boundary';end if;
    end loop;
    perform extensions.dblink_exec(own,'commit');
    deadline:=clock_timestamp()+interval '8s';loop
      if extensions.dblink_is_busy(a)=0 then first:=a;second:=b;firstpid:=apid;secondpid:=bpid;exit;end if;
      if extensions.dblink_is_busy(b)=0 then first:=b;second:=a;firstpid:=bpid;secondpid:=apid;exit;end if;
      if clock_timestamp()>deadline then raise exception 'decision serialized winner missing';end if;
    end loop;
    perform pg_temp.decision_require(extensions.dblink_is_busy(second)=1 and firstpid=any(pg_blocking_pids(secondpid)),
      'second decision remains bounded only by the first transaction');
    if first=a then
      ra:=pg_temp.decision_collect(a);da:=pg_temp.decision_remote_json(a,detail_stats)::integer;ua:=pg_temp.decision_remote_json(a,room_stats)::integer;
      perform extensions.dblink_exec(a,'commit');
      rb:=pg_temp.decision_collect(b);db:=pg_temp.decision_remote_json(b,detail_stats)::integer;ub:=pg_temp.decision_remote_json(b,room_stats)::integer;
      perform extensions.dblink_exec(b,'commit');
    else
      rb:=pg_temp.decision_collect(b);db:=pg_temp.decision_remote_json(b,detail_stats)::integer;ub:=pg_temp.decision_remote_json(b,room_stats)::integer;
      perform extensions.dblink_exec(b,'commit');
      ra:=pg_temp.decision_collect(a);da:=pg_temp.decision_remote_json(a,detail_stats)::integer;ua:=pg_temp.decision_remote_json(a,room_stats)::integer;
      perform extensions.dblink_exec(a,'commit');
    end if;
    final:=pg_temp.decision_remote_json(own,format(
      'select jsonb_build_object(''rows'',count(d.*),''count'',max(r.decision_completed_count),''candidate'',max(r.tmdb_movie_id),''values'',count(distinct d.decision)) from public.rooms r join public.room_members m on m.room_id=r.id left join public.candidate_decisions d on d.room_member_id=m.id and d.tmdb_movie_id=r.tmdb_movie_id where r.id=%L group by r.id',rid));
    if kind='distinct' then
      perform pg_temp.decision_require(ra->>'outcome'='accepted' and rb->>'outcome'='accepted'
        and array[(ra->>'decision_completed_count')::integer,(rb->>'decision_completed_count')::integer] @> array[1,2]
        and da=1 and db=1 and ua=1 and ub=1 and final=jsonb_build_object('rows',2,'count',2,'candidate',7701,'values',1),
        'different voters each commit one separately attributed decision');
    elsif kind in('same_yes','same_no') then
      perform pg_temp.decision_require(array[ra->>'outcome',rb->>'outcome'] @> array['accepted','unchanged']
        and ra->>'my_decision'=value_a and rb->>'my_decision'=value_a
        and da+db=1 and ua+ub=1 and final=jsonb_build_object('rows',1,'count',1,'candidate',7701,'values',1),
        'same-value overlap has one accepted immutable write');
    else
      perform pg_temp.decision_require(array[ra->>'outcome',rb->>'outcome'] @> array['accepted','conflict']
        and ra->>'my_decision'=rb->>'my_decision' and da+db=1 and ua+ub=1
        and final=jsonb_build_object('rows',1,'count',1,'candidate',7701,'values',1),
        'opposite overlap converges on one returned winner');
    end if;
  exception when others then failure:=sqlerrm;end;
  foreach name in array array[a,b] loop begin
    if name=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      if extensions.dblink_is_busy(name)=1 then perform extensions.dblink_cancel_query(name);perform pg_temp.decision_await(name);
        perform t.result from extensions.dblink_get_result(name,false) t(result jsonb);perform t.result from extensions.dblink_get_result(name,false) t(result jsonb);end if;
      perform extensions.dblink_exec(name,'rollback');perform extensions.dblink_disconnect(name);end if;
  exception when others then cleanup_failure:='client cleanup';end;end loop;
  begin if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
    perform extensions.dblink_exec(own,'rollback');
    perform extensions.dblink_exec(own,format('begin;delete from public.rooms where id=%L;delete from auth.users where id in(%L,%L);commit',rid,u1,u2));
    perform extensions.dblink_disconnect(own);end if;
  exception when others then cleanup_failure:='owner cleanup';end;
  return next diag(format('%s owner_pid=%s caller_a_pid=%s caller_b_pid=%s',
    kind,coalesce(opid,-1),coalesce(apid,-1),coalesce(bpid,-1)));
  return next ok(failure is null,kind||': authenticated decision concurrency/outcome/write trial');
  if failure is not null then return next diag(failure);end if;
  return next ok(cleanup_failure is null and not(array[a,b,own]&&coalesce(extensions.dblink_get_connections(),array[]::text[])),
    kind||': exact decision fixture/backend cleanup');
end;
$trial$;

select * from pg_temp.concurrent_decision_trial('same_yes');
select * from pg_temp.concurrent_decision_trial('same_no');
select * from pg_temp.concurrent_decision_trial('opposite');
select * from pg_temp.concurrent_decision_trial('distinct');

create function pg_temp.decision_fault_and_independence_trial() returns setof text
language plpgsql as $trial$
declare
  ns text:='decision_fault_'||encode(extensions.gen_random_bytes(4),'hex');
  own text:=ns||'_owner';a text:=ns||'_a';b text:=ns||'_b';
  conninfo text:='dbname=postgres user=postgres connect_timeout=3 application_name='||ns;
  u1 uuid:=extensions.gen_random_uuid();u2 uuid:=extensions.gen_random_uuid();
  r1 uuid:=extensions.gen_random_uuid();r2 uuid:=extensions.gen_random_uuid();
  m11 uuid:=extensions.gen_random_uuid();m12 uuid:=extensions.gen_random_uuid();
  m21 uuid:=extensions.gen_random_uuid();m22 uuid:=extensions.gen_random_uuid();
  c1 text:='E7'||upper(encode(extensions.gen_random_bytes(4),'hex'));
  c2 text:='F7'||upper(encode(extensions.gen_random_bytes(4),'hex'));
  opid integer;apid integer;lost jsonb;recovered jsonb;unrelated jsonb;blocked jsonb;state jsonb;
  deadline timestamptz;failure text;cleanup_failure text;name text;j jsonb;
  q1 text;
begin
  q1:=format('select to_jsonb(x) from public.submit_room_candidate_decision(%L,7801,''yes'') x',r1);
  begin
    perform extensions.dblink_connect(own,conninfo);
    perform extensions.dblink_exec(own,'set statement_timeout=''20s'';set lock_timeout=''15s''');
    perform extensions.dblink_exec(own,format(
      'insert into auth.users(id) values(%1$L),(%2$L);'
      'insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,filter_completed_count,filter_resolution_status,candidate_acquisition_status,tmdb_movie_id) values'
      '(%3$L,%4$L,%5$L,%1$L,2,2,2,''compatible'',''assigned'',7801),'
      '(%6$L,%7$L,%8$L,%1$L,2,2,2,''compatible'',''assigned'',7802);'
      'insert into public.room_members(id,room_id,user_id,is_voter) values'
      '(%9$L,%3$L,%1$L,true),(%10$L,%3$L,%2$L,true),'
      '(%11$L,%6$L,%1$L,true),(%12$L,%6$L,%2$L,true)',
      u1,u2,r1,c1,extensions.gen_random_uuid(),r2,c2,extensions.gen_random_uuid(),
      m11,m12,m21,m22));
    perform extensions.dblink_connect(a,conninfo);perform extensions.dblink_connect(b,conninfo);

    -- The RPC performs both writes, but the surrounding transaction aborts:
    -- neither private detail nor public count may survive.
    perform pg_temp.decision_caller(a,u1);
    lost:=pg_temp.decision_remote_json(a,q1);
    perform pg_temp.decision_require(lost->>'outcome'='accepted','rollback injection reached post-write result');
    perform extensions.dblink_exec(a,'rollback');
    state:=pg_temp.decision_remote_json(own,format(
      'select jsonb_build_object(''rows'',count(d.*),''count'',max(r.decision_completed_count)) from public.rooms r join public.room_members m on m.room_id=r.id left join public.candidate_decisions d on d.room_member_id=m.id where r.id=%L group by r.id',r1));
    perform pg_temp.decision_require(state=jsonb_build_object('rows',0,'count',0),
      'post-insert/count rollback removes both writes');

    -- Commit while deliberately discarding the submit response. A private read
    -- and opposite retry recover the one winner without another write.
    perform pg_temp.decision_caller(a,u1);
    perform pg_temp.decision_remote_json(a,q1);
    perform extensions.dblink_exec(a,'commit');
    perform pg_temp.decision_caller(b,u1);
    recovered:=pg_temp.decision_remote_json(b,format(
      'select to_jsonb(x) from public.get_room_candidate_decision(%L,7801) x',r1));
    perform pg_temp.decision_require(recovered->>'outcome'='decided' and recovered->>'my_decision'='yes'
      and (recovered->>'decision_completed_count')::integer=1,
      'discarded committed response is recovered as the own immutable winner');
    recovered:=pg_temp.decision_remote_json(b,format(
      'select to_jsonb(x) from public.submit_room_candidate_decision(%L,7801,''no'') x',r1));
    perform pg_temp.decision_require(recovered->>'outcome'='conflict' and recovered->>'my_decision'='yes'
      and (recovered->>'decision_completed_count')::integer=1,
      'opposite retry after response loss returns the stored winner');
    perform extensions.dblink_exec(b,'commit');

    -- A held target room cannot delay a submission in another room.
    perform extensions.dblink_exec(own,'begin');
    perform pg_temp.decision_remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',r1));
    perform pg_temp.decision_caller(a,u2);
    apid:=pg_temp.decision_remote_json(a,'select to_jsonb(pg_backend_pid())')::integer;
    opid:=pg_temp.decision_remote_json(own,'select to_jsonb(pg_backend_pid())')::integer;
    perform pg_temp.decision_require(extensions.dblink_send_query(a,format(
      'select to_jsonb(x) from public.submit_room_candidate_decision(%L,7801,''no'') x',r1))=1,
      'target-room blocked submit dispatched');
    deadline:=clock_timestamp()+interval '8s';loop
      exit when extensions.dblink_is_busy(a)=1 and opid=any(pg_blocking_pids(apid));
      if clock_timestamp()>deadline then raise exception 'target-room submit did not reach lock';end if;
    end loop;
    perform pg_temp.decision_caller(b,u1);
    unrelated:=pg_temp.decision_remote_json(b,format(
      'select to_jsonb(x) from public.submit_room_candidate_decision(%L,7802,''no'') x',r2));
    perform extensions.dblink_exec(b,'commit');
    perform pg_temp.decision_require(unrelated->>'outcome'='accepted'
      and (unrelated->>'decision_completed_count')::integer=1 and extensions.dblink_is_busy(a)=1,
      'unrelated-room decision commits while the target remains locked');
    perform extensions.dblink_exec(own,'commit');
    blocked:=pg_temp.decision_collect(a);perform extensions.dblink_exec(a,'commit');
    perform pg_temp.decision_require(blocked->>'outcome'='accepted'
      and (blocked->>'decision_completed_count')::integer=2,
      'blocked different voter completes after bounded serialization without acknowledgement');

    -- Cancellation while waiting is bounded and performs no additional write.
    perform extensions.dblink_exec(own,'begin');
    perform pg_temp.decision_remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',r1));
    perform pg_temp.decision_caller(a,u2);
    apid:=pg_temp.decision_remote_json(a,'select to_jsonb(pg_backend_pid())')::integer;
    perform pg_temp.decision_require(extensions.dblink_send_query(a,format(
      'select to_jsonb(x) from public.submit_room_candidate_decision(%L,7801,''no'') x',r1))=1,
      'cancellable duplicate dispatched');
    deadline:=clock_timestamp()+interval '8s';loop
      exit when extensions.dblink_is_busy(a)=1 and opid=any(pg_blocking_pids(apid));
      if clock_timestamp()>deadline then raise exception 'cancellable submit did not block';end if;
    end loop;
    perform pg_temp.decision_require(extensions.dblink_cancel_query(a)='OK','blocked decision cancellation accepted');
    perform pg_temp.decision_await(a);
    perform t.result from extensions.dblink_get_result(a,false) t(result jsonb);
    perform t.result from extensions.dblink_get_result(a,false) t(result jsonb);
    perform extensions.dblink_exec(a,'rollback');perform extensions.dblink_exec(own,'commit');
    state:=pg_temp.decision_remote_json(own,format(
      'select jsonb_build_object(''rows'',count(d.*),''count'',max(r.decision_completed_count),''candidate'',max(r.tmdb_movie_id)) from public.rooms r join public.room_members m on m.room_id=r.id left join public.candidate_decisions d on d.room_member_id=m.id and d.tmdb_movie_id=r.tmdb_movie_id where r.id=%L group by r.id',r1));
    perform pg_temp.decision_require(state=jsonb_build_object('rows',2,'count',2,'candidate',7801),
      'bounded cancellation leaves the exact committed state and candidate unchanged');
  exception when others then failure:=sqlerrm;end;
  foreach name in array array[a,b] loop begin
    if name=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      if extensions.dblink_is_busy(name)=1 then perform extensions.dblink_cancel_query(name);perform pg_temp.decision_await(name);
        perform t.result from extensions.dblink_get_result(name,false) t(result jsonb);perform t.result from extensions.dblink_get_result(name,false) t(result jsonb);end if;
      perform extensions.dblink_exec(name,'rollback',false);perform extensions.dblink_disconnect(name);end if;
  exception when others then cleanup_failure:='fault client cleanup';end;end loop;
  begin if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
    perform extensions.dblink_exec(own,'rollback',false);
    perform extensions.dblink_exec(own,format('begin;delete from public.rooms where id in(%L,%L);delete from auth.users where id in(%L,%L);commit',r1,r2,u1,u2));
    perform extensions.dblink_disconnect(own);end if;
  exception when others then cleanup_failure:='fault owner cleanup';end;
  return next ok(failure is null,'rollback/response-loss/unrelated-room/cancellation trial');
  if failure is not null then return next diag(failure);end if;
  return next ok(cleanup_failure is null and not(array[a,b,own]&&coalesce(extensions.dblink_get_connections(),array[]::text[])),
    'fault trial exact fixture/backend cleanup');
end;
$trial$;

select * from pg_temp.decision_fault_and_independence_trial();
select is((select count(*) from pg_stat_activity where application_name like 'decision_%'),0::bigint,
  'no decision concurrency backend remains');

create function pg_temp.decision_read_submit_trial() returns setof text language plpgsql as $trial$
declare
  ns text:='decision_read_submit_'||encode(extensions.gen_random_bytes(4),'hex');
  own text:=ns||'_owner';reader text:=ns||'_reader';writer text:=ns||'_writer';
  conninfo text:='dbname=postgres user=postgres connect_timeout=3 application_name='||ns;
  u1 uuid:=extensions.gen_random_uuid();u2 uuid:=extensions.gen_random_uuid();foreign_user uuid:=extensions.gen_random_uuid();
  rid uuid:=extensions.gen_random_uuid();m1 uuid:=extensions.gen_random_uuid();m2 uuid:=extensions.gen_random_uuid();
  code text:='A7'||upper(encode(extensions.gen_random_bytes(4),'hex'));
  reader_pid integer;writer_pid integer;owner_pid integer;old_read jsonb;new_read jsonb;
  submitted jsonb;masked jsonb;final jsonb;deadline timestamptz;
  failure text;cleanup_failure text;name text;j jsonb;
begin
  begin
    perform extensions.dblink_connect(own,conninfo);
    perform extensions.dblink_exec(own,format(
      'insert into auth.users(id) values(%1$L),(%2$L),(%3$L);'
      'insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,filter_completed_count,filter_resolution_status,candidate_acquisition_status,tmdb_movie_id) values(%4$L,%5$L,%6$L,%1$L,2,2,2,''compatible'',''assigned'',7901);'
      'insert into public.room_members(id,room_id,user_id,is_voter) values(%7$L,%4$L,%1$L,true),(%8$L,%4$L,%2$L,true)',
      u1,u2,foreign_user,rid,code,extensions.gen_random_uuid(),m1,m2));
    perform extensions.dblink_connect(reader,conninfo);perform extensions.dblink_connect(writer,conninfo);

    -- Read first: its coherent pre-submit projection and share lock are retained
    -- until commit, so the writer cannot produce a mixed count/detail view.
    perform pg_temp.decision_caller(reader,u1);perform pg_temp.decision_caller(writer,u1);
    reader_pid:=pg_temp.decision_remote_json(reader,'select to_jsonb(pg_backend_pid())')::integer;
    writer_pid:=pg_temp.decision_remote_json(writer,'select to_jsonb(pg_backend_pid())')::integer;
    old_read:=pg_temp.decision_remote_json(reader,format(
      'select to_jsonb(x) from public.get_room_candidate_decision(%L,7901) x',rid));
    perform pg_temp.decision_require(old_read=jsonb_build_object('outcome','not_decided','my_decision',null,
      'decision_completed_count',0,'required_voter_count',2,'decision_set_complete',false,
      'two_voter_agreement',false),'read-first returns one coherent pre-submit projection');
    perform pg_temp.decision_require(extensions.dblink_send_query(writer,format(
      'select to_jsonb(x) from public.submit_room_candidate_decision(%L,7901,''yes'') x',rid))=1,
      'read-first writer dispatched');
    deadline:=clock_timestamp()+interval '8s';loop
      exit when extensions.dblink_is_busy(writer)=1 and reader_pid=any(pg_blocking_pids(writer_pid));
      if clock_timestamp()>deadline then raise exception 'read-first writer did not wait on reader';end if;
    end loop;
    perform extensions.dblink_exec(reader,'commit');submitted:=pg_temp.decision_collect(writer);
    perform extensions.dblink_exec(writer,'commit');
    perform pg_temp.decision_require(submitted->>'outcome'='accepted'
      and (submitted->>'decision_completed_count')::integer=1,'read-first writer commits exact post-read state');

    -- Submit first: the private read waits and then observes the complete
    -- post-submit detail/count projection, never a false integrity failure.
    perform pg_temp.decision_caller(writer,u2);
    submitted:=pg_temp.decision_remote_json(writer,format(
      'select to_jsonb(x) from public.submit_room_candidate_decision(%L,7901,''no'') x',rid));
    perform pg_temp.decision_caller(reader,u2);
    reader_pid:=pg_temp.decision_remote_json(reader,'select to_jsonb(pg_backend_pid())')::integer;
    writer_pid:=pg_temp.decision_remote_json(writer,'select to_jsonb(pg_backend_pid())')::integer;
    perform pg_temp.decision_require(extensions.dblink_send_query(reader,format(
      'select to_jsonb(x) from public.get_room_candidate_decision(%L,7901) x',rid))=1,
      'submit-first reader dispatched');
    deadline:=clock_timestamp()+interval '8s';loop
      exit when extensions.dblink_is_busy(reader)=1 and writer_pid=any(pg_blocking_pids(reader_pid));
      if clock_timestamp()>deadline then raise exception 'submit-first reader did not wait on writer';end if;
    end loop;
    perform extensions.dblink_exec(writer,'commit');new_read:=pg_temp.decision_collect(reader);
    perform extensions.dblink_exec(reader,'commit');
    perform pg_temp.decision_require(submitted->>'outcome'='accepted'
      and new_read=jsonb_build_object('outcome','decided','my_decision','no',
        'decision_completed_count',2,'required_voter_count',2,'decision_set_complete',true,
        'two_voter_agreement',false),'submit-first read returns one coherent post-submit projection');

    -- Authorization precedes room locking: a foreign read returns while the
    -- target row is exclusively held and never joins its wait queue.
    perform extensions.dblink_exec(own,'begin');owner_pid:=pg_temp.decision_remote_json(own,
      'select to_jsonb(pg_backend_pid())')::integer;
    perform pg_temp.decision_remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',rid));
    perform pg_temp.decision_caller(reader,foreign_user);
    reader_pid:=pg_temp.decision_remote_json(reader,'select to_jsonb(pg_backend_pid())')::integer;
    masked:=pg_temp.decision_remote_json(reader,format(
      'select to_jsonb(x) from public.get_room_candidate_decision(%L,7901) x',rid));
    perform pg_temp.decision_require(masked=jsonb_build_object('outcome','not_found','my_decision',null,
      'decision_completed_count',null,'required_voter_count',null,'decision_set_complete',null,
      'two_voter_agreement',null) and not owner_pid=any(pg_blocking_pids(reader_pid)),
      'foreign read is masked without entering the locked target queue');
    perform extensions.dblink_exec(reader,'commit');perform extensions.dblink_exec(own,'commit');
    final:=pg_temp.decision_remote_json(own,format(
      'select jsonb_build_object(''rows'',count(d.*),''count'',max(r.decision_completed_count),''candidate'',max(r.tmdb_movie_id)) from public.rooms r join public.room_members m on m.room_id=r.id left join public.candidate_decisions d on d.room_member_id=m.id and d.tmdb_movie_id=r.tmdb_movie_id where r.id=%L group by r.id',rid));
    perform pg_temp.decision_require(final=jsonb_build_object('rows',2,'count',2,'candidate',7901),
      'read/submit trials preserve exact final authority and candidate');
  exception when others then failure:=sqlerrm;end;
  foreach name in array array[reader,writer] loop begin
    if name=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
      if extensions.dblink_is_busy(name)=1 then perform extensions.dblink_cancel_query(name);perform pg_temp.decision_await(name);
        perform t.result from extensions.dblink_get_result(name,false) t(result jsonb);perform t.result from extensions.dblink_get_result(name,false) t(result jsonb);end if;
      perform extensions.dblink_exec(name,'rollback',false);perform extensions.dblink_disconnect(name);end if;
  exception when others then cleanup_failure:='read client cleanup';end;end loop;
  begin if own=any(coalesce(extensions.dblink_get_connections(),array[]::text[])) then
    perform extensions.dblink_exec(own,'rollback',false);
    perform extensions.dblink_exec(own,format('begin;delete from public.rooms where id=%L;delete from auth.users where id in(%L,%L,%L);commit',rid,u1,u2,foreign_user));
    perform extensions.dblink_disconnect(own);end if;
  exception when others then cleanup_failure:='read owner cleanup';end;
  return next diag(format('read_submit owner_pid=%s reader_pid=%s writer_pid=%s',
    coalesce(owner_pid,-1),coalesce(reader_pid,-1),coalesce(writer_pid,-1)));
  return next ok(failure is null,'read-before-submit/submit-before-read/foreign-no-wait trial');
  if failure is not null then return next diag(failure);end if;
  return next ok(cleanup_failure is null and not(array[reader,writer,own]&&coalesce(extensions.dblink_get_connections(),array[]::text[])),
    'read/submit trial exact fixture/backend cleanup');
end;
$trial$;

select * from pg_temp.decision_read_submit_trial();

select has_type('public', 'candidate_decision_value', 'decision enum exists');
select enum_has_labels('public', 'candidate_decision_value', array['yes','no'],
  'decision enum has exact closed labels');
select has_table('public', 'candidate_decisions', 'private decision relation exists');
select columns_are('public', 'candidate_decisions',
  array['room_member_id','tmdb_movie_id','decision','accepted_at'],
  'decision relation has exact fields');
select col_type_is('public', 'candidate_decisions', 'tmdb_movie_id', 'bigint',
  'decision target is bigint');
select col_not_null('public', 'candidate_decisions', 'room_member_id', 'member is required');
select col_not_null('public', 'candidate_decisions', 'decision', 'decision is required');
select col_not_null('public', 'candidate_decisions', 'accepted_at', 'acceptance time is required');
select has_pk('public', 'candidate_decisions', 'decision relation has primary key');
select col_is_pk('public', 'candidate_decisions', array['room_member_id','tmdb_movie_id'],
  'decision identity is member plus TMDB ID');
select has_fk('public', 'candidate_decisions', 'decision relation has member cascade FK');
select has_check('public', 'candidate_decisions', 'positive TMDB identity is constrained');
select ok((select relrowsecurity and pg_get_userbyid(relowner) = 'postgres'
  from pg_class where oid = 'public.candidate_decisions'::regclass),
  'decision relation is postgres-owned with RLS enabled');
select is((select count(*) from pg_policy
  where polrelid = 'public.candidate_decisions'::regclass), 0::bigint,
  'decision relation has no client policy');
select ok(not has_table_privilege('anon', 'public.candidate_decisions', 'select')
  and not has_table_privilege('authenticated', 'public.candidate_decisions', 'select')
  and not has_table_privilege('authenticated', 'public.candidate_decisions', 'insert')
  and not has_table_privilege('authenticated', 'public.candidate_decisions', 'update')
  and not has_table_privilege('authenticated', 'public.candidate_decisions', 'delete'),
  'decision detail has no direct client privileges');
select has_column('public', 'rooms', 'decision_completed_count',
  'room exposes the privacy-safe decision watermark');
select col_type_is('public', 'rooms', 'decision_completed_count', 'integer',
  'decision watermark is integer');
select col_not_null('public', 'rooms', 'decision_completed_count',
  'decision watermark is non-null');
select col_default_is('public', 'rooms', 'decision_completed_count', '0',
  'decision watermark defaults to zero');
select ok(has_column_privilege('authenticated', 'public.rooms', 'decision_completed_count', 'select')
  and not has_column_privilege('authenticated', 'public.rooms', 'tmdb_movie_id', 'select'),
  'clients may read only the safe decision room field');
select is((select count(*) from pg_publication_tables where pubname = 'supabase_realtime'),
  1::bigint, 'Realtime still publishes exactly one relation');
select ok(exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime'
  and schemaname = 'public' and tablename = 'rooms')
  and not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime'
  and schemaname = 'public' and tablename = 'candidate_decisions'),
  'rooms remain the sole Realtime relation');

select has_function('public', 'get_room_candidate_decision', array['uuid','bigint'],
  'decision recovery has exact signature');
select has_function('public', 'submit_room_candidate_decision',
  array['uuid','bigint','candidate_decision_value'], 'decision submission has exact signature');
select ok((select bool_and(pg_get_userbyid(proowner) = 'postgres' and prosecdef
    and proconfig = array['search_path=""'])
  from pg_proc where oid in (
    'public.get_room_candidate_decision(uuid,bigint)'::regprocedure,
    'public.submit_room_candidate_decision(uuid,bigint,public.candidate_decision_value)'::regprocedure
  )), 'decision RPCs are postgres-owned hardened definers');
select ok((select bool_and(not has_function_privilege('anon', oid, 'execute')
    and has_function_privilege('authenticated', oid, 'execute'))
  from pg_proc where oid in (
    'public.get_room_candidate_decision(uuid,bigint)'::regprocedure,
    'public.submit_room_candidate_decision(uuid,bigint,public.candidate_decision_value)'::regprocedure
  )), 'only authenticated clients may execute decision RPCs');

create function pg_temp.client_json(subject uuid, command text) returns jsonb
language plpgsql as $helper$
declare result jsonb;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', subject, 'role', 'authenticated')::text, true);
  execute 'select to_jsonb(q) from (' || command || ') q' into result;
  reset role;
  return result;
exception when others then reset role; raise;
end;
$helper$;

create function pg_temp.client_sqlstate(subject uuid, command text) returns text
language plpgsql as $helper$
declare result text;
begin
  begin
    execute 'set local role authenticated';
    if subject is not null then
      perform set_config('request.jwt.claims',
        jsonb_build_object('sub', subject, 'role', 'authenticated')::text, true);
    else
      perform set_config('request.jwt.claims', '{}', true);
    end if;
    execute command;
  exception when others then result := sqlstate;
  end;
  reset role;
  return result;
exception when others then reset role; raise;
end;
$helper$;

insert into auth.users(id) values
  ('77000000-0000-4000-a000-000000000001'),
  ('77000000-0000-4000-a000-000000000002'),
  ('77000000-0000-4000-a000-000000000003'),
  ('77000000-0000-4000-a000-000000000004'),
  ('77000000-0000-4000-a000-000000000005'),
  ('77000000-0000-4000-a000-000000000006');

insert into public.rooms(
  id, code, creation_request_id, creator_user_id, required_voter_count,
  voter_count, filter_completed_count, filter_resolution_status,
  candidate_acquisition_status, tmdb_movie_id, created_at, updated_at
) values
  ('77100000-0000-4000-a000-000000000001','F700000001',
   '77200000-0000-4000-a000-000000000001','77000000-0000-4000-a000-000000000001',
   2,2,2,'compatible','assigned',7001,'2026-01-01','2026-01-01'),
  ('77100000-0000-4000-a000-000000000002','F700000002',
   '77200000-0000-4000-a000-000000000002','77000000-0000-4000-a000-000000000003',
   2,2,2,'compatible','assigned',7002,'2026-01-01','2026-01-01'),
  ('77100000-0000-4000-a000-000000000003','F700000003',
   '77200000-0000-4000-a000-000000000003','77000000-0000-4000-a000-000000000001',
   3,3,3,'compatible','assigned',7003,'2026-01-01','2026-01-01'),
  ('77100000-0000-4000-a000-000000000004','F700000004',
   '77200000-0000-4000-a000-000000000004','77000000-0000-4000-a000-000000000001',
   2,2,2,'compatible','pending',null,'2026-01-01','2026-01-01');

insert into public.room_members(id, room_id, user_id, is_voter) values
  ('77300000-0000-4000-a000-000000000001','77100000-0000-4000-a000-000000000001','77000000-0000-4000-a000-000000000001',true),
  ('77300000-0000-4000-a000-000000000002','77100000-0000-4000-a000-000000000001','77000000-0000-4000-a000-000000000002',true),
  ('77300000-0000-4000-a000-000000000003','77100000-0000-4000-a000-000000000002','77000000-0000-4000-a000-000000000003',false),
  ('77300000-0000-4000-a000-000000000004','77100000-0000-4000-a000-000000000002','77000000-0000-4000-a000-000000000001',true),
  ('77300000-0000-4000-a000-000000000005','77100000-0000-4000-a000-000000000002','77000000-0000-4000-a000-000000000002',true),
  ('77300000-0000-4000-a000-000000000006','77100000-0000-4000-a000-000000000003','77000000-0000-4000-a000-000000000001',true),
  ('77300000-0000-4000-a000-000000000007','77100000-0000-4000-a000-000000000003','77000000-0000-4000-a000-000000000002',true),
  ('77300000-0000-4000-a000-000000000008','77100000-0000-4000-a000-000000000003','77000000-0000-4000-a000-000000000004',true),
  ('77300000-0000-4000-a000-000000000009','77100000-0000-4000-a000-000000000004','77000000-0000-4000-a000-000000000001',true),
  ('77300000-0000-4000-a000-000000000010','77100000-0000-4000-a000-000000000004','77000000-0000-4000-a000-000000000002',true);

select is(pg_temp.client_json('77000000-0000-4000-a000-000000000001',
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000099',7001)$$),
  '{"outcome":"not_found","my_decision":null,"decision_completed_count":null,"required_voter_count":null,"decision_set_complete":null,"two_voter_agreement":null}'::jsonb,
  'missing and foreign recovery share the exact masked shape');
create temporary table feature007_rejected_read_before as
  select r.id,r.xmin::text room_xmin,r.updated_at from public.rooms r
  where r.id in('77100000-0000-4000-a000-000000000001','77100000-0000-4000-a000-000000000004');
select lives_ok($$select pg_temp.client_json('77000000-0000-4000-a000-000000000001',
  'select * from public.get_room_candidate_decision(''77100000-0000-4000-a000-000000000004'',7004)')$$,
  'not-ready private recovery remains a safe result');
select lives_ok($$select pg_temp.client_json('77000000-0000-4000-a000-000000000001',
  'select * from public.get_room_candidate_decision(''77100000-0000-4000-a000-000000000001'',7999)')$$,
  'stale private recovery remains a safe result');
select results_eq(
  $$select r.id,r.xmin::text,r.updated_at from public.rooms r
    where r.id in('77100000-0000-4000-a000-000000000001','77100000-0000-4000-a000-000000000004') order by r.id$$,
  $$select id,room_xmin,updated_at from feature007_rejected_read_before order by id$$,
  'not-ready and stale private reads perform zero room writes');

update public.rooms set decision_completed_count=1 where id='77100000-0000-4000-a000-000000000001';
select is(pg_temp.client_sqlstate('77000000-0000-4000-a000-000000000001',
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000001',7001)$$),
  'P0001','count without private detail fails closed');
update public.rooms set decision_completed_count=0 where id='77100000-0000-4000-a000-000000000001';
insert into public.candidate_decisions(room_member_id,tmdb_movie_id,decision)
  values('77300000-0000-4000-a000-000000000004',7002,'yes');
select is(pg_temp.client_sqlstate('77000000-0000-4000-a000-000000000001',
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000002',7002)$$),
  'P0001','private detail without room count fails closed');
delete from public.candidate_decisions where room_member_id='77300000-0000-4000-a000-000000000004';

select is(pg_temp.client_sqlstate(null,
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000001',7001)$$),
  '42501', 'recovery requires authentication');
select is(pg_temp.client_sqlstate('77000000-0000-4000-a000-000000000001',
  $$select * from public.get_room_candidate_decision(null,7001)$$),
  '22023', 'recovery rejects a null room target');
select is(pg_temp.client_sqlstate('77000000-0000-4000-a000-000000000001',
  $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000001',0,'yes')$$),
  '22023', 'submission rejects a nonpositive expected identity');

select is(pg_temp.client_json('77000000-0000-4000-a000-000000000005',
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000001',7001)$$),
  '{"outcome":"not_found","my_decision":null,"decision_completed_count":null,"required_voter_count":null,"decision_set_complete":null,"two_voter_agreement":null}'::jsonb,
  'foreign recovery is masked with all protected fields null');
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000001',
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000001',7999)$$)->>'outcome',
  'candidate_changed', 'stale expected identity is rejected');
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000001',
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000004',7004)$$)->>'outcome',
  'not_ready', 'unassigned room is rejected');
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000001',
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000001',7001)$$),
  '{"outcome":"not_decided","my_decision":null,"decision_completed_count":0,"required_voter_count":2,"decision_set_complete":false,"two_voter_agreement":false}'::jsonb,
  'eligible voter recovers the exact undecided projection');
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000003',
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000002',7002)$$)->>'outcome',
  'observer', 'authorized non-voting creator receives observer projection');
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000003',
  $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000002',7002,'yes')$$)->>'outcome',
  'not_voter', 'authorized observer cannot submit');

create temporary table feature007_candidate_before as
  select candidate_acquisition_status, tmdb_movie_id from public.rooms
  where id = '77100000-0000-4000-a000-000000000001';
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000001',
  $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000001',7001,'yes')$$),
  '{"outcome":"accepted","my_decision":"yes","decision_completed_count":1,"required_voter_count":2,"decision_set_complete":false,"two_voter_agreement":false}'::jsonb,
  'first valid yes is accepted atomically');
create temporary table feature007_first_write as
  select d.accepted_at, d.xmin::text as decision_xmin, r.updated_at,
    r.xmin::text as room_xmin
  from public.candidate_decisions as d
  join public.room_members as m on m.id = d.room_member_id
  join public.rooms as r on r.id = m.room_id
  where m.user_id = '77000000-0000-4000-a000-000000000001'
    and r.id = '77100000-0000-4000-a000-000000000001';
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000001',
  $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000001',7001,'yes')$$)->>'outcome',
  'unchanged', 'same-value retry is idempotent');
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000001',
  $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000001',7001,'no')$$),
  '{"outcome":"conflict","my_decision":"yes","decision_completed_count":1,"required_voter_count":2,"decision_set_complete":false,"two_voter_agreement":false}'::jsonb,
  'opposite retry reports the immutable stored winner');
select results_eq(
  $$select d.accepted_at,d.xmin::text,r.updated_at,r.xmin::text
    from public.candidate_decisions d join public.room_members m on m.id=d.room_member_id
    join public.rooms r on r.id=m.room_id
    where m.user_id='77000000-0000-4000-a000-000000000001'
      and r.id='77100000-0000-4000-a000-000000000001'$$,
  $$select accepted_at,decision_xmin,updated_at,room_xmin from feature007_first_write$$,
  'unchanged and conflict paths perform no row rewrite');
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000001',
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000001',7001)$$)->>'outcome',
  'decided', 'private recovery finds only the caller decision');
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000002',
  $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000001',7001,'no')$$),
  '{"outcome":"accepted","my_decision":"no","decision_completed_count":2,"required_voter_count":2,"decision_set_complete":true,"two_voter_agreement":false}'::jsonb,
  'second voter completes the exact-two room without false agreement');
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000002',
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000001',7001)$$),
  '{"outcome":"decided","my_decision":"no","decision_completed_count":2,"required_voter_count":2,"decision_set_complete":true,"two_voter_agreement":false}'::jsonb,
  'second voter privately recovers own no without peer identity value or timestamp');
select results_eq(
  $$select candidate_acquisition_status,tmdb_movie_id from public.rooms
    where id='77100000-0000-4000-a000-000000000001'$$,
  $$select candidate_acquisition_status,tmdb_movie_id from feature007_candidate_before$$,
  'decision submissions never alter candidate authority');

select is(pg_temp.client_json('77000000-0000-4000-a000-000000000001',
  $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000003',7003,'yes')$$)->'two_voter_agreement',
  'null'::jsonb, 'larger-room agreement is always null');
select is((select count(*) from public.candidate_decisions), 3::bigint,
  'only three unique accepted voter/candidate facts exist');

select hasnt_column('public','rooms','two_voter_agreement',
  'agreement is derived and never stored on the room');
insert into public.rooms(
  id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,
  filter_completed_count,filter_resolution_status,candidate_acquisition_status,tmdb_movie_id
) values(
  '77100000-0000-4000-a000-000000000005','F700000005',
  '77200000-0000-4000-a000-000000000005','77000000-0000-4000-a000-000000000005',
  2,2,2,'compatible','assigned',7005
);
insert into public.room_members(id,room_id,user_id,is_voter) values
  ('77300000-0000-4000-a000-000000000011','77100000-0000-4000-a000-000000000005','77000000-0000-4000-a000-000000000005',true),
  ('77300000-0000-4000-a000-000000000012','77100000-0000-4000-a000-000000000005','77000000-0000-4000-a000-000000000006',true);
create temporary table feature007_truth_candidate_before as
  select state,filter_resolution_status,candidate_acquisition_status,tmdb_movie_id
  from public.rooms where id='77100000-0000-4000-a000-000000000005';
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000005',
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000005',7005)$$)->'two_voter_agreement',
  'false'::jsonb,'exact-two zero-decision agreement is non-null false');
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000005',
  $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000005',7005,'yes')$$),
  '{"outcome":"accepted","my_decision":"yes","decision_completed_count":1,"required_voter_count":2,"decision_set_complete":false,"two_voter_agreement":false}'::jsonb,
  'exact-two one-decision agreement remains false');

create function pg_temp.two_voter_truth(first_value public.candidate_decision_value,
  second_value public.candidate_decision_value) returns jsonb language plpgsql as $f$
declare result jsonb;
begin
  delete from public.candidate_decisions where room_member_id in(
    '77300000-0000-4000-a000-000000000011','77300000-0000-4000-a000-000000000012');
  update public.rooms set decision_completed_count=0
    where id='77100000-0000-4000-a000-000000000005';
  perform pg_temp.client_json('77000000-0000-4000-a000-000000000005',format(
    'select * from public.submit_room_candidate_decision(''77100000-0000-4000-a000-000000000005'',7005,%L)',first_value));
  result:=pg_temp.client_json('77000000-0000-4000-a000-000000000006',format(
    'select * from public.submit_room_candidate_decision(''77100000-0000-4000-a000-000000000005'',7005,%L)',second_value));
  return result;
end $f$;
select is(pg_temp.two_voter_truth('yes','yes')->'two_voter_agreement','true'::jsonb,
  'yes/yes is the only exact-two true agreement');
select is(pg_temp.two_voter_truth('yes','no')->'two_voter_agreement','false'::jsonb,
  'yes/no exact-two agreement is false');
select is(pg_temp.two_voter_truth('no','yes')->'two_voter_agreement','false'::jsonb,
  'no/yes exact-two agreement is false');
select is(pg_temp.two_voter_truth('no','no')->'two_voter_agreement','false'::jsonb,
  'no/no exact-two agreement is false');
select results_eq(
  $$select state,filter_resolution_status,candidate_acquisition_status,tmdb_movie_id
    from public.rooms where id='77100000-0000-4000-a000-000000000005'$$,
  $$select * from feature007_truth_candidate_before$$,
  'the complete exact-two truth table never changes candidate or room status');

select is(pg_temp.client_json('77000000-0000-4000-a000-000000000002',
  $$select * from public.get_room_candidate_decision('77100000-0000-4000-a000-000000000003',7003)$$)->'two_voter_agreement',
  'null'::jsonb,'larger-room agreement is null during partial progress');
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000002',
  $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000003',7003,'no')$$)->'two_voter_agreement',
  'null'::jsonb,'larger-room agreement remains null before completion');
select is(pg_temp.client_json('77000000-0000-4000-a000-000000000004',
  $$select * from public.submit_room_candidate_decision('77100000-0000-4000-a000-000000000003',7003,'yes')$$),
  '{"outcome":"accepted","my_decision":"yes","decision_completed_count":3,"required_voter_count":3,"decision_set_complete":true,"two_voter_agreement":null}'::jsonb,
  'larger room reaches exact N/N completion with agreement still null');

select * from finish();
rollback;
