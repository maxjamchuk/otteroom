-- Feature 002 Phase 2: schema, fixed catalog, assignment invariant and ACLs.
-- All owner-only synthetic data and temporary snapshots roll back. No GoTrue
-- signup, new application function, candidate RPC or concurrency harness here.
begin;
set local search_path = pg_catalog, public, extensions;
set local statement_timeout = '15s';
set local lock_timeout = '5s';
create extension if not exists pgtap with schema extensions;
select no_plan();

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
      and conname in ('rooms_movie_candidate_id_fkey', 'rooms_candidate_requires_guest_check')
    order by conname$$,
  $$values
    ('rooms_candidate_requires_guest_check'::text, 'CHECK (((movie_candidate_id IS NULL) OR (guest_user_id IS NOT NULL)))'::text, true, false, false),
    ('rooms_movie_candidate_id_fkey', 'FOREIGN KEY (movie_candidate_id) REFERENCES movie_candidates(id) ON DELETE RESTRICT', true, false, false)$$,
  'exact named room FK and guest-occupancy check are immediately validated'
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
  $$insert into public.rooms(code,creation_request_id,host_user_id) values
    ('C200000001','02100000-0000-4000-a000-000000000001','02000000-0000-4000-a000-000000000001'),
    ('C200000004','02100000-0000-4000-a000-000000000004','02000000-0000-4000-a000-000000000003')$$,
  'Waiting + omitted NULL assignment is valid for existing-style room inserts'
);
select lives_ok(
  $$insert into public.rooms(code,creation_request_id,host_user_id,guest_user_id) values
    ('C200000002','02100000-0000-4000-a000-000000000002','02000000-0000-4000-a000-000000000001','02000000-0000-4000-a000-000000000002'),
    ('C200000003','02100000-0000-4000-a000-000000000003','02000000-0000-4000-a000-000000000001','02000000-0000-4000-a000-000000000002'),
    ('C200000005','02100000-0000-4000-a000-000000000005','02000000-0000-4000-a000-000000000003','02000000-0000-4000-a000-000000000004')$$,
  'Ready + omitted NULL assignment is valid for existing-style room inserts'
);
select results_eq(
  $$select code,state,movie_candidate_id from public.rooms where code like 'C20000000%' order by code$$,
  $$values ('C200000001'::text,'waiting'::text,null::text),('C200000002','ready',null),
    ('C200000003','ready',null),('C200000004','waiting',null),('C200000005','ready',null)$$,
  'neither Waiting nor Ready inserts synthesize a candidate assignment'
);
select throws_ok(
  $$update public.rooms set movie_candidate_id='fixture-cardboard-comet' where code='C200000001'$$,
  '23514','new row for relation "rooms" violates check constraint "rooms_candidate_requires_guest_check"',
  'Waiting + assigned is rejected by the named invariant'
);
select throws_ok(
  $$insert into public.rooms(code,creation_request_id,host_user_id,movie_candidate_id) values
    ('C200000006','02100000-0000-4000-a000-000000000006','02000000-0000-4000-a000-000000000001','fixture-cardboard-comet')$$,
  '23514','new row for relation "rooms" violates check constraint "rooms_candidate_requires_guest_check"',
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
  $$update public.rooms set guest_user_id=null where code='C200000003'$$,
  '23514','new row for relation "rooms" violates check constraint "rooms_candidate_requires_guest_check"',
  'an assigned room cannot be made Waiting by removing its guest'
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
    ('id','authenticated','SELECT',false),('state','authenticated','SELECT',false)$$,
  'only the existing authenticated id/code/state column projection is granted'
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
    '((( SELECT auth.uid() AS uid) = host_user_id) OR (( SELECT auth.uid() AS uid) = guest_user_id))'::text,true)$$,
  'the existing member-only SELECT policy is unchanged'
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
  (10,$$insert into public.rooms(code,creation_request_id,host_user_id,guest_user_id,movie_candidate_id) values ('C200000007','02100000-0000-4000-a000-000000000007','02000000-0000-4000-a000-000000000001','02000000-0000-4000-a000-000000000002','fixture-cardboard-comet')$$,'direct room INSERT with assignment denied')
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
select is(current_user::text,'authenticated','host: actual client role');
select is(auth.uid(),'02000000-0000-4000-a000-000000000001'::uuid,'host: explicit subject claim');
select results_eq(
  $$select code,state from public.rooms where code like 'C20000000%' order by code$$,
  $$values ('C200000001'::text,'waiting'::text),('C200000002','ready'),('C200000003','ready')$$,
  'host: existing room projection exposes only own memberships, including assigned rooms'
);
select throws_ok(query,'42501',null,'host: ' || description)
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
  (10,$$insert into public.rooms(code,creation_request_id,host_user_id,guest_user_id,movie_candidate_id) values ('C200000007','02100000-0000-4000-a000-000000000007','02000000-0000-4000-a000-000000000001','02000000-0000-4000-a000-000000000002','fixture-cardboard-comet')$$,'direct room INSERT with assignment denied')
) attacks(n,query,description) order by n;
reset role;
select results_eq(
  $$select * from public.movie_candidates order by sort_order$$,
  $$select * from pg_temp.candidate_catalog_before order by sort_order$$,
  'host: denied access preserves every catalog field and row'
);
select results_eq(
  $$select * from public.rooms where code like 'C20000000%' order by code$$,
  $$select * from pg_temp.candidate_rooms_before order by code$$,
  'host: denied access preserves complete room rows and assignments'
);

-- Actual guest access: privileged fixture setup has ended.
set local role authenticated;
set local request.jwt.claims = '{"sub":"02000000-0000-4000-a000-000000000002","role":"authenticated"}';
select is(current_user::text,'authenticated','guest: actual client role');
select is(auth.uid(),'02000000-0000-4000-a000-000000000002'::uuid,'guest: explicit subject claim');
select results_eq(
  $$select code,state from public.rooms where code like 'C20000000%' order by code$$,
  $$values ('C200000002'::text,'ready'::text),('C200000003','ready')$$,
  'guest: existing room projection exposes only own memberships, including assigned rooms'
);
select throws_ok(query,'42501',null,'guest: ' || description)
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
  (10,$$insert into public.rooms(code,creation_request_id,host_user_id,guest_user_id,movie_candidate_id) values ('C200000007','02100000-0000-4000-a000-000000000007','02000000-0000-4000-a000-000000000001','02000000-0000-4000-a000-000000000002','fixture-cardboard-comet')$$,'direct room INSERT with assignment denied')
) attacks(n,query,description) order by n;
reset role;
select results_eq(
  $$select * from public.movie_candidates order by sort_order$$,
  $$select * from pg_temp.candidate_catalog_before order by sort_order$$,
  'guest: denied access preserves every catalog field and row'
);
select results_eq(
  $$select * from public.rooms where code like 'C20000000%' order by code$$,
  $$select * from pg_temp.candidate_rooms_before order by code$$,
  'guest: denied access preserves complete room rows and assignments'
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
  (10,$$insert into public.rooms(code,creation_request_id,host_user_id,guest_user_id,movie_candidate_id) values ('C200000007','02100000-0000-4000-a000-000000000007','02000000-0000-4000-a000-000000000001','02000000-0000-4000-a000-000000000002','fixture-cardboard-comet')$$,'direct room INSERT with assignment denied')
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

select * from finish();
rollback;
