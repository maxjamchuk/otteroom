-- Feature 004 preserves fixture integrity while retiring every participant
-- candidate path. This suite is rollback-only and creates no GoTrue identity.
begin;
set local statement_timeout = '20s';
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_function('public','ensure_room_candidate',array['uuid'],
  'historical candidate RPC remains installed');
select results_eq(
  $$select a.grantee::regrole::text collate "default", a.privilege_type collate "default", a.is_grantable
    from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.oid=to_regprocedure('public.ensure_room_candidate(uuid)') order by 1,2$$,
  $$values ('postgres'::text,'EXECUTE'::text,false)$$,
  'candidate RPC has owner-only EXECUTE ACL');
select ok(not has_function_privilege('anon',to_regprocedure('public.ensure_room_candidate(uuid)'),'EXECUTE'),
  'anon candidate EXECUTE denied');
select ok(not has_function_privilege('authenticated',to_regprocedure('public.ensure_room_candidate(uuid)'),'EXECUTE'),
  'authenticated candidate EXECUTE denied');
select ok(not exists(select 1 from pg_proc p cross join lateral
  aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid=to_regprocedure('public.ensure_room_candidate(uuid)') and a.grantee=0),
  'PUBLIC candidate EXECUTE denied');
select results_eq(
  $$select prosecdef,pg_get_userbyid(proowner)::text collate "default",proconfig collate "default",
      (select lanname::text collate "default" from pg_language where oid=prolang)
    from pg_proc where oid=to_regprocedure('public.ensure_room_candidate(uuid)')$$,
  $$values (true,'postgres'::text,array['search_path=""'],'plpgsql'::text)$$,
  'historical function remains hardened and postgres-owned');

select results_eq(
  $$select id::text collate "default",title::text collate "default",release_year,poster_key::text collate "default",sort_order
    from public.movie_candidates order by sort_order$$,
  $$values
    ('fixture-cardboard-comet'::text,'The Cardboard Comet'::text,2020::smallint,'cardboard-comet'::text,10),
    ('fixture-pebble-bay-lanterns','Lanterns of Pebble Bay',2021::smallint,'pebble-bay-lanterns',20),
    ('fixture-cloud-tram-four','Cloud Tram Number Four',2022::smallint,'cloud-tram-four',30),
    ('fixture-clockwork-orchard','The Clockwork Orchard',2023::smallint,'clockwork-orchard',40)$$,
  'exact four historical fixtures remain byte-logically intact');
select results_eq(
  $$select conname::text collate "default",pg_get_constraintdef(oid)::text collate "default"
    from pg_constraint where conrelid='public.rooms'::regclass and conname='rooms_movie_candidate_id_fkey'$$,
  $$values ('rooms_movie_candidate_id_fkey'::text,
    'FOREIGN KEY (movie_candidate_id) REFERENCES movie_candidates(id) ON DELETE RESTRICT'::text)$$,
  'candidate FK remains protected by NO ACTION/RESTRICT');
select results_eq(
  $$select relrowsecurity,pg_get_userbyid(relowner)::text collate "default"
    from pg_class where oid='public.movie_candidates'::regclass$$,
  $$values (true,'postgres'::text)$$,'fixture catalog remains RLS-enabled and postgres-owned');
select is((select count(*) from pg_policy where polrelid='public.movie_candidates'::regclass),0::bigint,
  'fixture catalog has no client policy');
select is((select count(*) from pg_class c cross join lateral
  aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  where c.oid='public.movie_candidates'::regclass
    and a.grantee in(0,'anon'::regrole::oid,'authenticated'::regrole::oid)),0::bigint,
  'fixture catalog has no PUBLIC/anon/authenticated table privilege');
select ok(not has_column_privilege(role_name,'public.rooms','movie_candidate_id',privilege_name),
  role_name||' has no hidden candidate column '||privilege_name)
from (values('anon'),('authenticated')) r(role_name)
cross join (values('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(privilege_name);

create function pg_temp.client_sqlstate(subject uuid, command text)
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
exception when others then reset role; raise;
end;
$f$;
create function pg_temp.client_json(subject uuid, command text)
returns jsonb language plpgsql as $f$
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

insert into auth.users(id) values
  ('04200000-0000-4000-a000-000000000001'),
  ('04200000-0000-4000-a000-000000000002'),
  ('04200000-0000-4000-a000-000000000003');
insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,
  filter_completed_count,movie_candidate_id,created_at,updated_at) values
  ('04210000-0000-4000-a000-000000000001','F400000001','04220000-0000-4000-a000-000000000001','04200000-0000-4000-a000-000000000001',2,1,0,null,'2026-01-01','2026-01-01'),
  ('04210000-0000-4000-a000-000000000002','F400000002','04220000-0000-4000-a000-000000000002','04200000-0000-4000-a000-000000000001',2,2,0,null,'2026-01-01','2026-01-01'),
  ('04210000-0000-4000-a000-000000000003','F400000003','04220000-0000-4000-a000-000000000003','04200000-0000-4000-a000-000000000001',2,2,1,null,'2026-01-01','2026-01-01'),
  ('04210000-0000-4000-a000-000000000004','F400000004','04220000-0000-4000-a000-000000000004','04200000-0000-4000-a000-000000000001',2,2,2,null,'2026-01-01','2026-01-01'),
  ('04210000-0000-4000-a000-000000000005','F400000005','04220000-0000-4000-a000-000000000005','04200000-0000-4000-a000-000000000001',2,2,0,'fixture-clockwork-orchard','2026-01-01','2026-01-01');
insert into public.room_members(id,room_id,user_id,is_voter) values
  ('04230000-0000-4000-a000-000000000001','04210000-0000-4000-a000-000000000001','04200000-0000-4000-a000-000000000001',true),
  ('04230000-0000-4000-a000-000000000002','04210000-0000-4000-a000-000000000002','04200000-0000-4000-a000-000000000001',true),
  ('04230000-0000-4000-a000-000000000003','04210000-0000-4000-a000-000000000002','04200000-0000-4000-a000-000000000002',true),
  ('04230000-0000-4000-a000-000000000004','04210000-0000-4000-a000-000000000003','04200000-0000-4000-a000-000000000001',true),
  ('04230000-0000-4000-a000-000000000005','04210000-0000-4000-a000-000000000003','04200000-0000-4000-a000-000000000002',true),
  ('04230000-0000-4000-a000-000000000006','04210000-0000-4000-a000-000000000004','04200000-0000-4000-a000-000000000001',true),
  ('04230000-0000-4000-a000-000000000007','04210000-0000-4000-a000-000000000004','04200000-0000-4000-a000-000000000002',true),
  ('04230000-0000-4000-a000-000000000008','04210000-0000-4000-a000-000000000005','04200000-0000-4000-a000-000000000001',true),
  ('04230000-0000-4000-a000-000000000009','04210000-0000-4000-a000-000000000005','04200000-0000-4000-a000-000000000002',true);
insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to) values
  ('04230000-0000-4000-a000-000000000004','{action}',2000,2020),
  ('04230000-0000-4000-a000-000000000006','{action}',2000,2020),
  ('04230000-0000-4000-a000-000000000007','{comedy}',2001,2021);

create temporary table candidate_rooms_before as
  select r.*,xmin::text as row_xmin from public.rooms r where code like 'F40000000%' order by code;
create temporary table candidate_catalog_before as
  select c.*,xmin::text as row_xmin from public.movie_candidates c order by sort_order;

select is(pg_temp.client_sqlstate(subject,format('select * from public.ensure_room_candidate(%L)',room_id)),
  '42501',phase||': participant candidate invocation denied before any assignment')
from (values
  ('waiting','04200000-0000-4000-a000-000000000001'::uuid,'04210000-0000-4000-a000-000000000001'::uuid),
  ('ready-0/N','04200000-0000-4000-a000-000000000001','04210000-0000-4000-a000-000000000002'),
  ('partial','04200000-0000-4000-a000-000000000002','04210000-0000-4000-a000-000000000003'),
  ('N/N','04200000-0000-4000-a000-000000000002','04210000-0000-4000-a000-000000000004'),
  ('preassigned','04200000-0000-4000-a000-000000000001','04210000-0000-4000-a000-000000000005'),
  ('foreign','04200000-0000-4000-a000-000000000003','04210000-0000-4000-a000-000000000002')
) x(phase,subject,room_id);
select is(pg_temp.client_sqlstate(null,'select * from public.ensure_room_candidate(null)'),
  '42501','missing-subject candidate invocation denied at ACL boundary');
select results_eq(
  $$select r.*,xmin::text as row_xmin from public.rooms r where code like 'F40000000%' order by code$$,
  $$select * from candidate_rooms_before order by code$$,
  'all denied candidate calls leave Waiting/Ready/partial/N/N/preassigned rooms unchanged');
select results_eq(
  $$select c.*,xmin::text as row_xmin from public.movie_candidates c order by sort_order$$,
  $$select * from candidate_catalog_before order by sort_order$$,
  'all denied candidate calls leave catalog and row versions unchanged');

select is(pg_temp.client_sqlstate(subject,command),'42501',description)
from (values
  ('04200000-0000-4000-a000-000000000001'::uuid,'select * from public.movie_candidates','member catalog SELECT denied'),
  ('04200000-0000-4000-a000-000000000001','select movie_candidate_id from public.rooms','member hidden candidate SELECT denied'),
  ('04200000-0000-4000-a000-000000000001','update public.rooms set movie_candidate_id=null','member candidate UPDATE denied'),
  ('04200000-0000-4000-a000-000000000001','update public.movie_candidates set title=''changed''','member catalog UPDATE denied'),
  ('04200000-0000-4000-a000-000000000003','select * from public.movie_candidates','foreign catalog SELECT denied')
) x(subject,command,description);
select is(pg_temp.client_json('04200000-0000-4000-a000-000000000001',
  $$select id,code,state,voter_count,required_voter_count,filter_completed_count from public.rooms where id='04210000-0000-4000-a000-000000000005'$$),
  '[{"id":"04210000-0000-4000-a000-000000000005","code":"F400000005","state":"ready","voter_count":2,"required_voter_count":2,"filter_completed_count":0}]'::jsonb,
  'authorized preassigned room projection reveals progress but no movie metadata');

select is(pg_temp.client_json('04200000-0000-4000-a000-000000000001',
  $$select * from public.get_my_participant_filter('04210000-0000-4000-a000-000000000002')$$)->0->>'outcome',
  'not_submitted','filter recovery performs no candidate assignment');
select is(pg_temp.client_json('04200000-0000-4000-a000-000000000001',
  $$select * from public.submit_my_participant_filter('04210000-0000-4000-a000-000000000002','{}'::participant_genre[],1900::smallint,2026::smallint)$$)->0->>'outcome',
  'saved','filter submission succeeds without candidate authority');
select is((select movie_candidate_id from public.rooms where id='04210000-0000-4000-a000-000000000002'),
  null::text,'filter recovery/submission leave candidate NULL');
select results_eq(
  $$select c.*,xmin::text as row_xmin from public.movie_candidates c order by sort_order$$,
  $$select * from candidate_catalog_before order by sort_order$$,
  'filter flow never mutates historical fixture catalog');

select throws_ok($$delete from public.movie_candidates where id='fixture-clockwork-orchard'$$,
  '23503',null,'preassigned non-lowest fixture remains FK protected');
select is((select movie_candidate_id from public.rooms where id='04210000-0000-4000-a000-000000000005'),
  'fixture-clockwork-orchard','failed fixture delete preserves preassigned FK');

delete from public.rooms where code like 'F40000000%';
delete from auth.users where id::text like '04200000-0000-4000-a000-00000000000%';
select ok(not exists(select 1 from public.rooms where code like 'F40000000%'),
  'owned suppression fixtures cleaned through room/member/filter cascade');

select * from finish();
rollback;
