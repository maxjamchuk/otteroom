-- Phase 3 only: schema, constraints and direct-role read/write boundaries.
-- Fixtures contain UUIDs, not sessions/tokens; all setup is rolled back.
begin;
set local search_path = pg_catalog, public, extensions;
set local statement_timeout = '15s';
set local lock_timeout = '5s';
create extension if not exists pgtap with schema extensions;
select no_plan();

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

-- finish() and rollback leave neither room fixtures nor Auth fixture rows behind.
select * from finish();
rollback;
