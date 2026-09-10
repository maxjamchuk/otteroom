\set ON_ERROR_STOP on
-- This file is deliberately outside database/: only the owned upgrade runner
-- executes it, after a version-limited reset, without GoTrue/browser traffic.
begin;
set local statement_timeout='10s';
do $guard$
begin
  if to_regclass('public.room_members') is not null
    or exists(select 1 from public.rooms) or exists(select 1 from auth.users)
    or to_regprocedure('public.create_room(uuid)') is null then
    raise exception 'Legacy migration fixture precondition failed';
  end if;
end;
$guard$;
insert into auth.users(id) values
  ('d3000000-0000-4000-8000-000000000001'),
  ('d3000000-0000-4000-8000-000000000002'),
  ('d3000000-0000-4000-8000-000000000003'),
  ('d3000000-0000-4000-8000-000000000004'),
  ('d3000000-0000-4000-8000-000000000005');
insert into public.rooms(id,code,creation_request_id,host_user_id,guest_user_id,created_at,updated_at,movie_candidate_id) values
  ('d3000000-0000-4000-8000-000000000101','D300000001','d3000000-0000-4000-8000-000000000201',
   'd3000000-0000-4000-8000-000000000001',null,'2026-09-01 01:00:00+00','2026-09-01 01:00:00+00',null),
  ('d3000000-0000-4000-8000-000000000102','D300000002','d3000000-0000-4000-8000-000000000202',
   'd3000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000003',
   '2026-09-01 02:00:00+00','2026-09-02 02:00:00+00',null),
  ('d3000000-0000-4000-8000-000000000103','D300000003','d3000000-0000-4000-8000-000000000203',
   'd3000000-0000-4000-8000-000000000004','d3000000-0000-4000-8000-000000000005',
   '2026-09-01 03:00:00+00','2026-09-02 03:00:00+00','fixture-clockwork-orchard');
commit;
-- The runner validates and retains only this bounded snapshot in memory. Never
-- emit its raw contents to diagnostic output or a file.
select jsonb_agg(to_jsonb(r) order by id) from public.rooms r;
