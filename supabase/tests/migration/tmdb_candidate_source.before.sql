\set ON_ERROR_STOP on
begin;
set local statement_timeout='10s';
do $guard$ begin
  if to_regtype('public.filter_resolution_status') is null
    or to_regtype('public.candidate_acquisition_status') is not null
    or exists(select 1 from public.rooms) or exists(select 1 from auth.users)
  then raise exception 'Feature 006 fixture precondition failed';end if;
end;$guard$;
insert into auth.users(id) select ('f6000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid
  from generate_series(1,9)i;
insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,
 filter_completed_count,filter_resolution_status,movie_candidate_id,created_at,updated_at) values
('f6100000-0000-4000-8000-000000000001','F610000001','f6200000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000001',2,1,0,'pending',null,'2026-09-01','2026-09-01 00:01'),
('f6100000-0000-4000-8000-000000000002','F610000002','f6200000-0000-4000-8000-000000000002','f6000000-0000-4000-8000-000000000002',2,2,1,'pending','fixture-clockwork-orchard','2026-09-01','2026-09-01 00:02'),
('f6100000-0000-4000-8000-000000000003','F610000003','f6200000-0000-4000-8000-000000000003','f6000000-0000-4000-8000-000000000003',2,2,2,'compatible',null,'2026-09-01','2026-09-01 00:03'),
('f6100000-0000-4000-8000-000000000004','F610000004','f6200000-0000-4000-8000-000000000004','f6000000-0000-4000-8000-000000000004',2,2,2,'compatible','fixture-cloud-tram-four','2026-09-01','2026-09-01 00:04'),
('f6100000-0000-4000-8000-000000000005','F610000005','f6200000-0000-4000-8000-000000000005','f6000000-0000-4000-8000-000000000005',2,2,2,'incompatible',null,'2026-09-01','2026-09-01 00:05'),
('f6100000-0000-4000-8000-000000000006','F610000006','f6200000-0000-4000-8000-000000000006','f6000000-0000-4000-8000-000000000006',2,2,2,'incompatible','fixture-pebble-bay-lanterns','2026-09-01','2026-09-01 00:06');
insert into public.room_members(id,room_id,user_id,is_voter)
select ('f6300000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 ('f6100000-0000-4000-8000-'||lpad(((i+1)/2)::text,12,'0'))::uuid,
 ('f6000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,true
from generate_series(1,8)i;
insert into public.room_members(id,room_id,user_id,is_voter) values
('f6300000-0000-4000-8000-000000000009','f6100000-0000-4000-8000-000000000005','f6000000-0000-4000-8000-000000000009',true);
insert into private.room_filter_resolutions values
('f6100000-0000-4000-8000-000000000003',1990,2010),
('f6100000-0000-4000-8000-000000000004',2000,2020);
insert into private.room_filter_resolution_genre_clauses values
('f6100000-0000-4000-8000-000000000003',1,'{action,adventure}'),
('f6100000-0000-4000-8000-000000000003',2,'{drama}'),
('f6100000-0000-4000-8000-000000000004',1,'{comedy}');
commit;
select jsonb_build_object(
 'rooms',(select jsonb_agg(to_jsonb(r)||jsonb_build_object('row_xmin',xmin::text) order by id) from public.rooms r),
 'members',(select jsonb_agg(to_jsonb(m)||jsonb_build_object('row_xmin',xmin::text) order by id) from public.room_members m),
 'parents',(select jsonb_agg(to_jsonb(p)||jsonb_build_object('row_xmin',xmin::text) order by room_id) from private.room_filter_resolutions p),
 'clauses',(select jsonb_agg(to_jsonb(c)||jsonb_build_object('row_xmin',xmin::text) order by room_id,clause_ordinal) from private.room_filter_resolution_genre_clauses c),
 'candidates',(select jsonb_agg(to_jsonb(c)||jsonb_build_object('row_xmin',xmin::text) order by sort_order) from public.movie_candidates c));
