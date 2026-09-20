\set ON_ERROR_STOP on
begin;
set local statement_timeout='20s';
do $guard$ begin
  if to_regtype('public.candidate_decision_value') is null
    or to_regtype('public.candidate_progression_status') is not null
    or exists(select 1 from public.rooms) or exists(select 1 from auth.users)
  then raise exception 'Feature 008 fixture precondition failed';end if;
end;$guard$;

insert into auth.users(id) select ('f8000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid
from generate_series(1,18)i;
insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,voter_count,
 filter_completed_count,filter_resolution_status,candidate_acquisition_status,tmdb_movie_id,
 decision_completed_count,created_at,updated_at) values
('f8100000-0000-4000-8000-000000000001','F810000001','f8200000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000001',2,1,0,'pending','pending',null,0,'2026-09-01','2026-09-01 00:01'),
('f8100000-0000-4000-8000-000000000002','F810000002','f8200000-0000-4000-8000-000000000002','f8000000-0000-4000-8000-000000000002',2,2,2,'compatible','no_candidates',null,0,'2026-09-01','2026-09-01 00:02'),
('f8100000-0000-4000-8000-000000000003','F810000003','f8200000-0000-4000-8000-000000000003','f8000000-0000-4000-8000-000000000003',2,2,2,'compatible','assigned',8103,0,'2026-09-01','2026-09-01 00:03'),
('f8100000-0000-4000-8000-000000000004','F810000004','f8200000-0000-4000-8000-000000000004','f8000000-0000-4000-8000-000000000004',2,2,2,'compatible','assigned',8104,1,'2026-09-01','2026-09-01 00:04'),
('f8100000-0000-4000-8000-000000000005','F810000005','f8200000-0000-4000-8000-000000000005','f8000000-0000-4000-8000-000000000005',2,2,2,'compatible','assigned',8105,2,'2026-09-01','2026-09-01 00:05'),
('f8100000-0000-4000-8000-000000000006','F810000006','f8200000-0000-4000-8000-000000000006','f8000000-0000-4000-8000-000000000006',2,2,2,'compatible','assigned',8106,2,'2026-09-01','2026-09-01 00:06'),
('f8100000-0000-4000-8000-000000000007','F810000007','f8200000-0000-4000-8000-000000000007','f8000000-0000-4000-8000-000000000007',3,3,3,'compatible','assigned',8107,3,'2026-09-01','2026-09-01 00:07'),
('f8100000-0000-4000-8000-000000000008','F810000008','f8200000-0000-4000-8000-000000000008','f8000000-0000-4000-8000-000000000008',3,3,3,'compatible','assigned',8108,3,'2026-09-01','2026-09-01 00:08');

do $members$ declare r record;i integer;uid uuid;mid uuid;begin
 for r in select id,required_voter_count,creator_user_id from public.rooms order by id loop
  for i in 1..r.required_voter_count loop
   uid:=case when i=1 then r.creator_user_id else extensions.gen_random_uuid() end;
   if i>1 then insert into auth.users(id) values(uid);end if;
   mid:=extensions.gen_random_uuid();
   insert into public.room_members(id,room_id,user_id,is_voter) values(mid,r.id,uid,true);
  end loop;
 end loop;
 insert into public.room_members(id,room_id,user_id,is_voter)
 values(extensions.gen_random_uuid(),'f8100000-0000-4000-8000-000000000007',
   'f8000000-0000-4000-8000-000000000018',false);
end;$members$;
insert into private.room_filter_resolutions(room_id,release_year_from,release_year_to)
select id,2000,2026 from public.rooms where filter_resolution_status='compatible';

do $decisions$ declare r record;m record;i integer;begin
 for r in select * from public.rooms where decision_completed_count>0 order by id loop
  i:=0;
  for m in select id from public.room_members where room_id=r.id and is_voter order by id loop
   i:=i+1;exit when i>r.decision_completed_count;
   insert into public.candidate_decisions(room_member_id,tmdb_movie_id,decision,accepted_at)
   values(m.id,r.tmdb_movie_id,
    case
      when r.id='f8100000-0000-4000-8000-000000000005' then 'yes'::public.candidate_decision_value
      when r.id='f8100000-0000-4000-8000-000000000006' and i=1 then 'yes'::public.candidate_decision_value
      when r.id='f8100000-0000-4000-8000-000000000007' and i<=2 then 'yes'::public.candidate_decision_value
      when r.id='f8100000-0000-4000-8000-000000000008' and i=1 then 'yes'::public.candidate_decision_value
      else 'no'::public.candidate_decision_value end,
    ('2026-09-02 00:00:00+00'::timestamptz+i*interval '1 minute'));
  end loop;
 end loop;
end;$decisions$;
commit;

select jsonb_build_object(
 'rooms',(select jsonb_agg(to_jsonb(r) order by id) from public.rooms r),
 'members',(select jsonb_agg(to_jsonb(m) order by room_id,id) from public.room_members m),
 'decisions',(select jsonb_agg(to_jsonb(d) order by room_member_id) from public.candidate_decisions d),
 'parents',(select jsonb_agg(to_jsonb(p) order by room_id) from private.room_filter_resolutions p));
