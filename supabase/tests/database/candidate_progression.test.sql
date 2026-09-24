-- Feature 008 candidate occurrence, complete-set resolution, source CAS, and privacy authority.
\connect -reuse-previous=on "user=supabase_admin"
begin;
set local search_path = pg_catalog, public, extensions;
set local statement_timeout = '60s';
create extension if not exists pgtap with schema extensions;
select no_plan();
create function pg_temp.require(condition boolean,message text default 'candidate progression assertion failed') returns void language plpgsql as $f$
begin if condition is distinct from true then raise exception '%',message;end if;end;$f$;

select ok(to_regtype('public.candidate_occurrence_status') is not null,
  'candidate occurrence status is a closed enum');
select ok(to_regtype('public.candidate_progression_status') is not null,
  'candidate progression status is a closed enum');
select is((select enum_range(null::public.candidate_occurrence_status)::text),
  '{collecting,rejected,agreed}', 'occurrence enum has the exact closed vocabulary');
select is((select enum_range(null::public.candidate_progression_status)::text),
  '{inactive,collecting,advancing,agreed,exhausted}',
  'progression enum has the exact closed vocabulary');
select ok(to_regclass('public.room_candidate_occurrences') is not null,
  'protected candidate occurrence ledger exists');
select ok((select relrowsecurity from pg_class where oid='public.room_candidate_occurrences'::regclass),
  'occurrence ledger has RLS enabled');
select ok(not has_table_privilege('authenticated','public.room_candidate_occurrences','select')
  and not has_table_privilege('anon','public.room_candidate_occurrences','select')
  and not has_table_privilege('authenticated','public.candidate_decisions','select'),
  'occurrence and decision detail remain grant-free');
select ok(has_column_privilege('authenticated','public.rooms','candidate_progression_status','select')
  and has_column_privilege('authenticated','public.rooms','candidate_sequence','select')
  and not has_column_privilege('authenticated','public.rooms','tmdb_movie_id','select'),
  'only safe progression fields are projected from rooms');
select is((select count(*)::integer from pg_publication_tables
    where pubname='supabase_realtime'), 1, 'Realtime still publishes exactly one relation');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='rooms'), 'rooms remains the sole Realtime relation');

select ok(to_regprocedure('private.candidate_agreement_threshold(uuid,integer)') is not null,
  'private bigint-safe snapshot-derived threshold helper exists');

select ok(to_regprocedure('public.get_room_candidate_decision(uuid,integer,bigint)') is not null
  and to_regprocedure('public.submit_room_candidate_decision(uuid,integer,bigint,public.candidate_decision_value)') is not null,
  'decision RPCs have the frozen progression-aware signatures');
select ok(to_regprocedure('public.prepare_room_tmdb_candidate(uuid,uuid)') is not null
  and to_regprocedure('public.commit_room_tmdb_candidate(uuid,uuid,integer,bigint,smallint,integer[],boolean,bigint,numeric)') is not null
  and to_regprocedure('public.commit_room_tmdb_no_candidates(uuid,uuid,integer)') is not null,
  'candidate prepare and commit RPCs have the frozen signatures');
select ok((select bool_and(pg_get_userbyid(proowner)='postgres' and prosecdef
    and proconfig=array['search_path=""']) from pg_proc where oid in(
      'public.get_room_candidate_decision(uuid,integer,bigint)'::regprocedure,
      'public.submit_room_candidate_decision(uuid,integer,bigint,public.candidate_decision_value)'::regprocedure,
      'public.prepare_room_tmdb_candidate(uuid,uuid)'::regprocedure,
      'public.commit_room_tmdb_candidate(uuid,uuid,integer,bigint,smallint,integer[],boolean,bigint,numeric)'::regprocedure,
      'public.commit_room_tmdb_no_candidates(uuid,uuid,integer)'::regprocedure)),
  'protected RPCs are postgres-owned security definers with empty search path');
select ok(has_function_privilege('authenticated',
    'public.get_room_candidate_decision(uuid,integer,bigint)','execute')
  and has_function_privilege('authenticated',
    'public.submit_room_candidate_decision(uuid,integer,bigint,public.candidate_decision_value)','execute')
  and not has_function_privilege('authenticated','public.prepare_room_tmdb_candidate(uuid,uuid)','execute')
  and has_function_privilege('service_role','public.prepare_room_tmdb_candidate(uuid,uuid)','execute'),
  'decision execution is authenticated and candidate authority is service-only');

create function pg_temp.progression_room(p_n integer,p_yes integer,p_tmdb bigint,
  p_final public.candidate_decision_value) returns jsonb language plpgsql as $f$
declare rid uuid:=extensions.gen_random_uuid();oid uuid:=extensions.gen_random_uuid();uid uuid;mid uuid;i integer;result jsonb;
begin
  uid:=extensions.gen_random_uuid();
  insert into auth.users(id) values(uid);
  insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,
    voter_count,filter_completed_count,filter_resolution_status,candidate_acquisition_status,
    candidate_progression_status,candidate_sequence,decision_completed_count)
  values(rid,upper(encode(extensions.gen_random_bytes(5),'hex')),extensions.gen_random_uuid(),uid,
    p_n,p_n,p_n,'compatible','pending','inactive',0,0);
  insert into private.room_selection_rules(room_id,rule_set_kind,candidate_ordering,metadata_language,genre_mode,agreement_numerator,agreement_denominator)
    values(rid,'legacy_005_006_008','legacy_source_order','en-US','or',2,3);
  insert into private.room_filter_resolutions(room_id,release_year_from,release_year_to)
    values(rid,2000,2026);
  for i in 1..p_n loop
    if i>1 then uid:=extensions.gen_random_uuid();insert into auth.users(id) values(uid);end if;
    mid:=extensions.gen_random_uuid();
    insert into public.room_members(id,room_id,user_id,is_voter) values(mid,rid,uid,true);
  end loop;
  insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to)
    select id,'{}'::public.participant_genre[],2000,2026 from public.room_members where room_id=rid;
  -- Install the occurrence after every fixed voter exists so same-room FKs are exercised.
  insert into public.room_candidate_occurrences(id,room_id,sequence,tmdb_movie_id,status)
    values(oid,rid,1,p_tmdb,'collecting');
  update public.rooms set candidate_acquisition_status='assigned',
    candidate_progression_status='collecting',candidate_sequence=1,tmdb_movie_id=p_tmdb where id=rid;
  i:=0;
  for mid,uid in select m.id,m.user_id from public.room_members m where m.room_id=rid order by m.id loop
    i:=i+1;
    if i<p_n then
      insert into public.candidate_decisions(room_id,room_member_id,candidate_occurrence_id,decision)
        values(rid,mid,oid,(case when i<=p_yes then 'yes' else 'no' end)::public.candidate_decision_value);
    else
      perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
    end if;
  end loop;
  update public.rooms set decision_completed_count=p_n-1 where id=rid;
  select to_jsonb(x) into result from public.submit_room_candidate_decision(rid,1,p_tmdb,p_final) x;
  return result||jsonb_build_object('room_id',rid);
end;$f$;

-- Exact T-1/T classification for every supported normative example. The final
-- value is selected so each completed multiset lands on the requested boundary.
create temporary table progression_threshold_results(n integer,t integer,below jsonb,at jsonb);
do $matrix$ declare n integer;t integer;begin
  for n in 2..10 loop
    t:=case when n=2 then 2 else ((n::bigint*2+3-1)/3)::integer end;
    insert into progression_threshold_results values(n,t,
      pg_temp.progression_room(n,t-1,800000+n*10,'no'),
      pg_temp.progression_room(n,t-1,800001+n*10,'yes'));
  end loop;
end;$matrix$;
select ok(not exists(select 1 from progression_threshold_results
  where below->>'candidate_outcome'<>'rejected' or below->>'candidate_progression_status'<>'advancing'
     or at->>'candidate_outcome'<>'agreed' or at->>'candidate_progression_status'<>'agreed'
     or (below->>'decision_completed_count')::integer<>n
     or (at->>'decision_completed_count')::integer<>n
     or (below->>'agreement_threshold')::integer<>t
     or (at->>'agreement_threshold')::integer<>t),
  'N=2..10 resolves only at N/N with exact T-1 rejected and T agreed');

-- One rejected step installs exact k+1, retains history, starts with zero, and
-- replays to the same database winner.
do $successor$ declare rejected jsonb;rid uuid;actor uuid;winner jsonb;replay jsonb;begin
  rejected:=pg_temp.progression_room(2,0,880001,'yes');
  rid:=(rejected->>'room_id')::uuid;
  select user_id into actor from public.room_members where room_id=rid and is_voter limit 1;
  select to_jsonb(x) into winner from public.commit_room_tmdb_candidate(
    rid,actor,1,880002::bigint,2020::smallint,'{}'::integer[],false,null::bigint,null::numeric) x;
  select to_jsonb(x) into replay from public.commit_room_tmdb_candidate(
    rid,actor,1,880003::bigint,2020::smallint,'{}'::integer[],false,null::bigint,null::numeric) x;
  perform pg_temp.require((winner->>'outcome')='assigned'
    and (winner->>'candidate_sequence')::integer=2
    and replay->>'tmdb_movie_id'=winner->>'tmdb_movie_id'
    and (select count(*)=2 from public.room_candidate_occurrences where room_id=rid)
    and (select decision_completed_count=0 and candidate_sequence=2
      and candidate_progression_status='collecting' from public.rooms where id=rid));
end;$successor$;
select pass('successor CAS installs one exact k+1 winner with a fresh decision set');

-- A completed, error-free empty traversal at an advancing step preserves the
-- rejected occurrence sequence and installs one stable exhaustion terminal.
-- Stale/wrong-sequence attempts and same-step replay are all zero-write.
do $exhaustion$
declare rejected jsonb;rid uuid;actor uuid;stale jsonb;terminal jsonb;replay jsonb;
 wrong jsonb;terminal_ctid tid;final_ctid tid;begin
  rejected:=pg_temp.progression_room(2,0,880011,'yes');
  rid:=(rejected->>'room_id')::uuid;
  select user_id into actor from public.room_members where room_id=rid and is_voter limit 1;
  select to_jsonb(x) into stale from public.commit_room_tmdb_no_candidates(rid,actor,0) x;
  perform pg_temp.require(stale->>'outcome'='refresh_required'
    and (select candidate_sequence=1 and candidate_progression_status='advancing'
      and candidate_acquisition_status='pending' and tmdb_movie_id is null
      from public.rooms where id=rid),'stale empty commit cannot exhaust advancing room');
  select to_jsonb(x) into terminal from public.commit_room_tmdb_no_candidates(rid,actor,1) x;
  select ctid into terminal_ctid from public.rooms where id=rid;
  select to_jsonb(x) into replay from public.commit_room_tmdb_no_candidates(rid,actor,1) x;
  select to_jsonb(x) into wrong from public.commit_room_tmdb_no_candidates(rid,actor,2) x;
  select ctid into final_ctid from public.rooms where id=rid;
  perform pg_temp.require(terminal=jsonb_build_object('outcome','exhausted',
      'candidate_sequence',1,'candidate_progression_status','exhausted','tmdb_movie_id',null)
    and replay=terminal and wrong->>'outcome'='refresh_required'
    and terminal_ctid=final_ctid
    and (select candidate_sequence=1 and candidate_progression_status='exhausted'
      and candidate_acquisition_status='no_candidates' and tmdb_movie_id is null
      and decision_completed_count=0 from public.rooms where id=rid)
    and (select count(*)=1 and bool_and(sequence=1 and status='rejected')
      from public.room_candidate_occurrences where room_id=rid),
    'completed-empty exhaustion preserves sequence and replay/wrong sequence write nothing');
end;$exhaustion$;
select pass('completed-empty commit installs stable exhaustion only at the exact advancing sequence');

-- Deterministic READ COMMITTED races: owner-held room locks are the barrier;
-- foreign callers finish before release because authorization precedes locking.
create extension if not exists dblink with schema extensions;
create function pg_temp.remote_json(connection text,query text) returns jsonb language plpgsql as $f$
declare result jsonb;begin select j into strict result from extensions.dblink(connection,query)t(j jsonb);return result;end;$f$;
create function pg_temp.await(connection text) returns void language plpgsql as $f$
declare deadline timestamptz:=clock_timestamp()+interval '8 seconds';begin
 while extensions.dblink_is_busy(connection)=1 loop if clock_timestamp()>deadline then raise exception 'race deadline';end if;end loop;
end;$f$;

do $decision_race$
declare ns text:='p8d_'||encode(extensions.gen_random_bytes(4),'hex');own text:=ns||'o';a text:=ns||'a';b text:=ns||'b';f text:=ns||'f';
 conn text:='dbname=postgres user=postgres connect_timeout=3';rid uuid:=extensions.gen_random_uuid();oid uuid:=extensions.gen_random_uuid();
 u1 uuid:=extensions.gen_random_uuid();u2 uuid:=extensions.gen_random_uuid();uf uuid:=extensions.gen_random_uuid();
 m1 uuid:=extensions.gen_random_uuid();m2 uuid:=extensions.gen_random_uuid();ra jsonb;rb jsonb;rf jsonb;state jsonb;
begin
 perform extensions.dblink_connect(own,conn);perform extensions.dblink_connect(a,conn);perform extensions.dblink_connect(b,conn);perform extensions.dblink_connect(f,conn);
 perform extensions.dblink_exec(own,format(
  'insert into auth.users(id)values(%1$L),(%2$L),(%3$L);'
  'insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,filter_completed_count,filter_resolution_status)values(%4$L,%5$L,%6$L,%1$L,2,2,2,''compatible'');'
  'insert into private.room_selection_rules(room_id,rule_set_kind,candidate_ordering,metadata_language,genre_mode,agreement_numerator,agreement_denominator)values(%4$L,''legacy_005_006_008'',''legacy_source_order'',''en-US'',''or'',2,3);'
  'insert into public.room_members(id,room_id,user_id,is_voter)values(%7$L,%4$L,%1$L,true),(%8$L,%4$L,%2$L,true);'
  'insert into private.room_filter_resolutions(room_id,release_year_from,release_year_to)values(%4$L,2000,2026);'
  'insert into public.room_candidate_occurrences(id,room_id,sequence,tmdb_movie_id)values(%9$L,%4$L,1,890001);'
  'update public.rooms set candidate_acquisition_status=''assigned'',candidate_progression_status=''collecting'',candidate_sequence=1,tmdb_movie_id=890001 where id=%4$L',
  u1,u2,uf,rid,upper(encode(extensions.gen_random_bytes(5),'hex')),extensions.gen_random_uuid(),m1,m2,oid));
 perform extensions.dblink_exec(a,'set role authenticated');perform extensions.dblink_exec(b,'set role authenticated');perform extensions.dblink_exec(f,'set role authenticated');
 perform pg_temp.remote_json(a,format('select to_jsonb(set_config(''request.jwt.claims'',%L,false))',jsonb_build_object('sub',u1,'role','authenticated')::text));
 perform pg_temp.remote_json(b,format('select to_jsonb(set_config(''request.jwt.claims'',%L,false))',jsonb_build_object('sub',u2,'role','authenticated')::text));
 perform pg_temp.remote_json(f,format('select to_jsonb(set_config(''request.jwt.claims'',%L,false))',jsonb_build_object('sub',uf,'role','authenticated')::text));
 perform extensions.dblink_exec(own,'begin');perform pg_temp.remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',rid));
 perform pg_temp.require(extensions.dblink_send_query(a,format('select to_jsonb(x) from public.submit_room_candidate_decision(%L,1,890001,''yes'')x',rid))=1
  and extensions.dblink_send_query(b,format('select to_jsonb(x) from public.submit_room_candidate_decision(%L,1,890001,''yes'')x',rid))=1,
  'two final voters dispatched');
 rf:=pg_temp.remote_json(f,format('select to_jsonb(x) from public.get_room_candidate_decision(%L,1,890001)x',rid));
 perform pg_temp.require(rf->>'outcome'='not_found','foreign caller does not join held room lock queue');
 perform extensions.dblink_exec(own,'commit');perform pg_temp.await(a);perform pg_temp.await(b);
 select j into ra from extensions.dblink_get_result(a)t(j jsonb);perform j from extensions.dblink_get_result(a)t(j jsonb);
 select j into rb from extensions.dblink_get_result(b)t(j jsonb);perform j from extensions.dblink_get_result(b)t(j jsonb);
 state:=pg_temp.remote_json(own,format('select jsonb_build_object(''rows'',count(d.*),''status'',max(r.candidate_progression_status::text)) from public.rooms r left join public.candidate_decisions d on d.room_id=r.id where r.id=%L group by r.id',rid));
 perform pg_temp.require(ra->>'outcome'='accepted' and rb->>'outcome'='accepted'
  and array[ra->>'candidate_outcome',rb->>'candidate_outcome']@>array['collecting','agreed']
  and state=jsonb_build_object('rows',2,'status','agreed'),'concurrent final voters preserve both decisions and one outcome');
 perform extensions.dblink_exec(own,format('delete from public.rooms where id=%L;delete from auth.users where id in(%L,%L,%L)',rid,u1,u2,uf));
 perform extensions.dblink_disconnect(a);perform extensions.dblink_disconnect(b);perform extensions.dblink_disconnect(f);perform extensions.dblink_disconnect(own);
end;$decision_race$;
select pass('decision race serializes once and foreign authorization never queues on the room');

do $source_race$
declare ns text:='p8s_'||encode(extensions.gen_random_bytes(4),'hex');own text:=ns||'o';a text:=ns||'a';b text:=ns||'b';
 conn text:='dbname=postgres user=postgres connect_timeout=3';rid uuid:=extensions.gen_random_uuid();oid uuid:=extensions.gen_random_uuid();
 u1 uuid:=extensions.gen_random_uuid();u2 uuid:=extensions.gen_random_uuid();ra jsonb;rb jsonb;state jsonb;
begin
 perform extensions.dblink_connect(own,conn);perform extensions.dblink_connect(a,conn);perform extensions.dblink_connect(b,conn);
 perform extensions.dblink_exec(own,format(
  'insert into auth.users(id)values(%1$L),(%2$L);'
  'insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,filter_completed_count,filter_resolution_status,candidate_progression_status,candidate_sequence)values(%3$L,%4$L,%5$L,%1$L,2,2,2,''compatible'',''advancing'',1);'
  'insert into private.room_selection_rules(room_id,rule_set_kind,candidate_ordering,metadata_language,genre_mode,agreement_numerator,agreement_denominator)values(%3$L,''legacy_005_006_008'',''legacy_source_order'',''en-US'',''or'',2,3);'
  'insert into public.room_members(room_id,user_id,is_voter)values(%3$L,%1$L,true),(%3$L,%2$L,true);'
  'insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to)select id,''{}''::public.participant_genre[],2000,2026 from public.room_members where room_id=%3$L;'
  'insert into private.room_filter_resolutions(room_id,release_year_from,release_year_to)values(%3$L,2000,2026);'
  'insert into public.room_candidate_occurrences(id,room_id,sequence,tmdb_movie_id,status,resolved_at)values(%6$L,%3$L,1,891001,''rejected'',transaction_timestamp())',
  u1,u2,rid,upper(encode(extensions.gen_random_bytes(5),'hex')),extensions.gen_random_uuid(),oid));
 perform extensions.dblink_exec(own,'begin');perform pg_temp.remote_json(own,format('select to_jsonb(id) from public.rooms where id=%L for update',rid));
 perform pg_temp.require(extensions.dblink_send_query(a,format('select to_jsonb(x) from public.commit_room_tmdb_candidate(%L,%L,1,891002,2020::smallint,''{}''::integer[],false,null::bigint,null::numeric)x',rid,u1))=1
  and extensions.dblink_send_query(b,format('select to_jsonb(x) from public.commit_room_tmdb_candidate(%L,%L,1,891003,2020::smallint,''{}''::integer[],false,null::bigint,null::numeric)x',rid,u2))=1,
  'two source proposals dispatched');
 perform extensions.dblink_exec(own,'commit');perform pg_temp.await(a);perform pg_temp.await(b);
 select j into ra from extensions.dblink_get_result(a)t(j jsonb);perform j from extensions.dblink_get_result(a)t(j jsonb);
 select j into rb from extensions.dblink_get_result(b)t(j jsonb);perform j from extensions.dblink_get_result(b)t(j jsonb);
 state:=pg_temp.remote_json(own,format('select jsonb_build_object(''occurrences'',count(o.*),''sequence'',max(r.candidate_sequence),''tmdb'',max(r.tmdb_movie_id)) from public.rooms r join public.room_candidate_occurrences o on o.room_id=r.id where r.id=%L group by r.id',rid));
 perform pg_temp.require(ra->>'outcome'='assigned' and rb->>'outcome'='assigned'
  and ra->>'tmdb_movie_id'=rb->>'tmdb_movie_id' and state->>'occurrences'='2' and state->>'sequence'='2',
  'competing proposals converge on one exact k+1 winner');
 perform extensions.dblink_exec(own,format('delete from public.rooms where id=%L;delete from auth.users where id in(%L,%L)',rid,u1,u2));
 perform extensions.dblink_disconnect(a);perform extensions.dblink_disconnect(b);perform extensions.dblink_disconnect(own);
end;$source_race$;
select pass('source proposal race installs one winner and no skipped occurrence');

select * from finish();
rollback;
