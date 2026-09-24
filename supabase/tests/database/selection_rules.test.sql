-- Feature 009 schema/catalog/ACL contract. Runtime tests are intentionally
-- below browser scope and execute after the Feature 009 migration is present.
\connect -reuse-previous=on "user=supabase_admin"
begin;
set local search_path=pg_catalog,public,extensions;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('private','room_selection_rules','protected room rule snapshots exist');
select has_pk('private','room_selection_rules','room snapshots have a primary key');
select col_is_pk('private','room_selection_rules','room_id','room id is the snapshot key');
select ok(exists(select 1 from pg_constraint c where c.conrelid='private.room_selection_rules'::regclass
  and c.contype='f' and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='room_id')::smallint]
  and c.confrelid='public.rooms'::regclass), 'snapshot is one-to-one with rooms');
select col_not_null('private','room_selection_rules','rule_set_kind','snapshot kind is explicit');
select col_not_null('private','room_selection_rules','candidate_ordering','snapshot ordering is explicit');
select col_not_null('private','room_selection_rules','metadata_language','snapshot language is explicit');
select col_not_null('private','room_selection_rules','agreement_numerator','snapshot numerator is explicit');
select col_not_null('private','room_selection_rules','agreement_denominator','snapshot denominator is explicit');
select ok((select count(*) from pg_publication_tables where pubname='supabase_realtime'
  and schemaname='private' and tablename='room_selection_rules')=0,
  'room snapshots are outside rooms-only Realtime');
select ok(not has_table_privilege('anon','private.room_selection_rules','select')
  and not has_table_privilege('authenticated','private.room_selection_rules','select'),
  'direct client snapshot reads are denied');
select ok((select count(*) from public.rooms)=(select count(*) from private.room_selection_rules),
  'every room has exactly one snapshot');
select ok(not has_function_privilege('authenticated','public.create_room_with_selection_rules(uuid,uuid,integer,boolean,text,text,bigint,numeric,text,text,integer,integer)','execute')
  and has_function_privilege('service_role','public.create_room_with_selection_rules(uuid,uuid,integer,boolean,text,text,bigint,numeric,text,text,integer,integer)','execute'),
  'normalized snapshot creation is service-role-only');
select ok(to_regprocedure('public.create_room(uuid,integer,boolean)') is null,
  'authenticated direct create signature is retired');
select ok(not has_function_privilege('authenticated','public.create_room_with_selection_rules(uuid,uuid,integer,boolean,text,text,bigint,numeric,text,text,integer,integer)','execute'),
  'authenticated callers cannot forge snapshot input');

select * from finish();
rollback;
