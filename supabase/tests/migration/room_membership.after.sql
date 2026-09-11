\set ON_ERROR_STOP on
begin;
set local statement_timeout='10s';
-- psql variable is supplied through stdin, never command arguments or a file.
create temporary table legacy_expected as select value as row from jsonb_array_elements(:'legacy_snapshot'::jsonb);
create function pg_temp.require(condition boolean) returns void language plpgsql as $f$
begin if condition is distinct from true then raise exception 'Migration compatibility assertion failed'; end if; end;
$f$;
select pg_temp.require((select count(*)=3 from legacy_expected));
select pg_temp.require(not exists(select 1 from pg_attribute where attrelid='public.rooms'::regclass
  and attname in('host_user_id','guest_user_id') and not attisdropped));
select pg_temp.require(to_regprocedure('public.create_room(uuid)') is null
  and to_regprocedure('public.create_room(uuid,integer,boolean)') is not null);
select pg_temp.require(to_regclass('public.participant_filters') is not null
  and to_regprocedure('public.get_my_participant_filter(uuid)') is not null
  and to_regprocedure('public.submit_my_participant_filter(uuid,participant_genre[],smallint,smallint)') is not null
  and to_regprocedure('public.resolve_common_filters(uuid)') is not null
  and not has_function_privilege('authenticated','public.ensure_room_candidate(uuid)'::regprocedure,'EXECUTE')
  and (select count(*)=0 from public.participant_filters)
  and not exists(select 1 from private.room_filter_resolutions)
  and not exists(select 1 from private.room_filter_resolution_genre_clauses)
  and not exists(select 1 from public.rooms where filter_completed_count<>0
    or filter_resolution_status<>'pending'));
select pg_temp.require((select count(*)=1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='rooms'));
select pg_temp.require(not exists(select 1 from pg_constraint where conrelid='public.rooms'::regclass and conname like '%guest%'));
select pg_temp.require((select count(*)=1 from pg_policy where polrelid='public.rooms'::regclass
  and pg_get_expr(polqual,polrelid)='private.is_room_member(id)'));
-- This observes post-cutover ANALYZE itself on nonempty rows. No autovacuum wait,
-- fixed estimate or pre/post-rewrite physical tuple identity is assumed.
select pg_temp.require(exists(select 1 from pg_catalog.pg_statistic s join pg_attribute a
  on a.attrelid=s.starelid and a.attnum=s.staattnum
  where a.attrelid='public.rooms'::regclass and a.attname='state'));
select pg_temp.require((select count(*)=5 and count(distinct id)=5 from public.room_members));
do $trial$
declare
  old jsonb; r public.rooms%rowtype; member public.room_members%rowtype;
  expected_users uuid[]; before_row jsonb; before_members jsonb; result jsonb;
  subject uuid; command text;
begin
  for old in select row from legacy_expected order by row->>'id' loop
    select * into strict r from public.rooms where id=(old->>'id')::uuid;
    perform pg_temp.require((to_jsonb(r)-array['creator_user_id','required_voter_count','voter_count','filter_completed_count','filter_resolution_status'])
      =(old-array['host_user_id','guest_user_id'])
      and r.creator_user_id=(old->>'host_user_id')::uuid and r.required_voter_count=2
      and r.voter_count=case when old->>'guest_user_id' is null then 1 else 2 end
      and r.filter_completed_count=0);
    expected_users:=array_remove(array[(old->>'host_user_id')::uuid,(old->>'guest_user_id')::uuid],null);
    perform pg_temp.require((select array_agg(user_id order by user_id) from public.room_members where room_id=r.id)
      =(select array_agg(u order by u) from unnest(expected_users) u));
    perform pg_temp.require(r.voter_count=(select count(*) from public.room_members where room_id=r.id and is_voter));
    for member in select * from public.room_members where room_id=r.id loop
      perform pg_temp.require(member.is_voter and member.joined_at>r.updated_at and member.joined_at<=transaction_timestamp());
    end loop;
    select to_jsonb(x)||jsonb_build_object('xmin',xmin::text) into before_row from public.rooms x where id=r.id;
    select jsonb_agg(to_jsonb(m)||jsonb_build_object('xmin',xmin::text) order by id) into before_members from public.room_members m where room_id=r.id;
    foreach subject in array expected_users loop
      set local role authenticated;
      perform set_config('request.jwt.claim.sub','',true);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
      if current_user<>'authenticated' or auth.uid()<>subject then raise exception 'Caller precondition failed'; end if;
      select to_jsonb(x) into result from public.join_room(r.code) x;
      reset role;
      perform pg_temp.require(result=jsonb_build_object('outcome','already_member','room_id',r.id,'room_code',r.code,
        'room_state',r.state,'is_creator',subject=r.creator_user_id,'is_voter',true,
        'voter_count',r.voter_count,'required_voter_count',2,'filter_completed_count',0,
        'filter_resolution_status','pending'));
      if subject=r.creator_user_id then
        set local role authenticated;
        select to_jsonb(x) into result from public.create_room(r.creation_request_id,3,false) x;
        reset role;
        perform pg_temp.require(result=jsonb_build_object('outcome','already_created','room_id',r.id,'room_code',r.code,
          'room_state',r.state,'is_creator',true,'is_voter',true,'voter_count',r.voter_count,
          'required_voter_count',2,'filter_completed_count',0,
          'filter_resolution_status','pending'));
      end if;
      perform pg_temp.require(not has_function_privilege('authenticated',
        'public.ensure_room_candidate(uuid)'::regprocedure,'EXECUTE'));
      perform pg_temp.require(before_row=(select to_jsonb(x)||jsonb_build_object('xmin',xmin::text) from public.rooms x where id=r.id)
        and before_members=(select jsonb_agg(to_jsonb(m)||jsonb_build_object('xmin',xmin::text) order by id) from public.room_members m where room_id=r.id));
    end loop;
  end loop;
end;
$trial$;
-- Delete only IDs materialized by before.sql, with cascade for their members.
delete from public.rooms where id in(select (row->>'id')::uuid from legacy_expected);
delete from auth.users where id in(select (row->>'host_user_id')::uuid from legacy_expected
  union select (row->>'guest_user_id')::uuid from legacy_expected);
select pg_temp.require(not exists(select 1 from public.rooms) and not exists(select 1 from public.room_members)
  and not exists(select 1 from public.participant_filters) and not exists(select 1 from auth.users));
commit;
