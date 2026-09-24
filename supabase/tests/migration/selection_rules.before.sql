\set ON_ERROR_STOP on
begin;
set local statement_timeout='20s';
do $guard$ begin
  if to_regtype('public.candidate_progression_status') is null
    or exists(select 1 from public.rooms) or exists(select 1 from auth.users)
  then raise exception 'Feature 009 fixture precondition failed'; end if;
end; $guard$;

-- Owned synthetic users are database rows only; this fixture never calls GoTrue.
insert into auth.users(id) select ('f9000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid
  from generate_series(1,20) i;

insert into public.rooms(id,code,creation_request_id,creator_user_id,required_voter_count,
  voter_count,filter_completed_count,filter_resolution_status,candidate_acquisition_status,
  tmdb_movie_id,decision_completed_count,candidate_progression_status,candidate_sequence,
  created_at,updated_at) values
 ('f9100000-0000-4000-8000-000000000001','F910000001','f9200000-0000-4000-8000-000000000001','f9000000-0000-4000-8000-000000000001',2,1,0,'pending','pending',null,0,'inactive',0,'2026-09-01','2026-09-01 00:01'),
 ('f9100000-0000-4000-8000-000000000002','F910000002','f9200000-0000-4000-8000-000000000002','f9000000-0000-4000-8000-000000000002',2,2,1,'pending','pending',null,0,'inactive',0,'2026-09-01','2026-09-01 00:02'),
 ('f9100000-0000-4000-8000-000000000003','F910000003','f9200000-0000-4000-8000-000000000003','f9000000-0000-4000-8000-000000000003',2,2,2,'pending','pending',null,0,'inactive',0,'2026-09-01','2026-09-01 00:03'),
 ('f9100000-0000-4000-8000-000000000004','F910000004','f9200000-0000-4000-8000-000000000004','f9000000-0000-4000-8000-000000000004',2,2,2,'incompatible','pending',null,0,'inactive',0,'2026-09-01','2026-09-01 00:04'),
 ('f9100000-0000-4000-8000-000000000005','F910000005','f9200000-0000-4000-8000-000000000005','f9000000-0000-4000-8000-000000000005',2,2,2,'compatible','no_candidates',null,0,'inactive',0,'2026-09-01','2026-09-01 00:05'),
 ('f9100000-0000-4000-8000-000000000006','F910000006','f9200000-0000-4000-8000-000000000006','f9000000-0000-4000-8000-000000000006',2,2,2,'compatible','pending',null,0,'inactive',0,'2026-09-01','2026-09-01 00:06'),
 ('f9100000-0000-4000-8000-000000000007','F910000007','f9200000-0000-4000-8000-000000000007','f9000000-0000-4000-8000-000000000007',2,2,2,'compatible','pending',null,0,'advancing',1,'2026-09-01','2026-09-01 00:07'),
 ('f9100000-0000-4000-8000-000000000008','F910000008','f9200000-0000-4000-8000-000000000008','f9000000-0000-4000-8000-000000000008',2,2,2,'compatible','pending',null,0,'inactive',0,'2026-09-01','2026-09-01 00:08'),
 ('f9100000-0000-4000-8000-000000000009','F910000009','f9200000-0000-4000-8000-000000000009','f9000000-0000-4000-8000-000000000009',2,2,2,'compatible','no_candidates',null,0,'exhausted',1,'2026-09-01','2026-09-01 00:09'),
 ('f9100000-0000-4000-8000-000000000010','F910000010','f9200000-0000-4000-8000-000000000010','f9000000-0000-4000-8000-000000000010',3,3,0,'pending','pending',null,0,'inactive',0,'2026-09-01','2026-09-01 00:10');

do $members$ declare r record; i integer; uid uuid; mid uuid; begin
  for r in select id,required_voter_count,voter_count,creator_user_id from public.rooms order by id loop
    for i in 1..case when r.id='f9100000-0000-4000-8000-000000000001' then r.voter_count else r.required_voter_count end loop
      uid := case when i=1 then r.creator_user_id
        else ('f9000000-0000-4000-8000-'||lpad(((right(r.id::text,1)::integer*2+i)::text),12,'0'))::uuid end;
      mid := extensions.gen_random_uuid();
      insert into public.room_members(id,room_id,user_id,is_voter) values(mid,r.id,uid,true);
    end loop;
  end loop;
end; $members$;

insert into public.room_members(room_id,user_id,is_voter)
values('f9100000-0000-4000-8000-000000000001','f9000000-0000-4000-8000-000000000020',false);

-- One partial frozen filter and complete filters for the states whose snapshots
-- are expected to remain usable after cutover.
insert into public.participant_filters(room_member_id,genres,release_year_from,release_year_to)
select m.id, case when m.room_id='f9100000-0000-4000-8000-000000000004' then '{drama}'::public.participant_genre[] else '{}'::public.participant_genre[] end,
  2000,2026
from public.room_members m
where m.room_id in (
 'f9100000-0000-4000-8000-000000000002', 'f9100000-0000-4000-8000-000000000003',
 'f9100000-0000-4000-8000-000000000004', 'f9100000-0000-4000-8000-000000000005',
 'f9100000-0000-4000-8000-000000000006', 'f9100000-0000-4000-8000-000000000007',
 'f9100000-0000-4000-8000-000000000008', 'f9100000-0000-4000-8000-000000000009')
 and (m.room_id<>'f9100000-0000-4000-8000-000000000002'
   or m.user_id='f9000000-0000-4000-8000-000000000002');
update public.rooms set filter_completed_count=case when id='f9100000-0000-4000-8000-000000000002' then 1 else 2 end
 where id in ('f9100000-0000-4000-8000-000000000002','f9100000-0000-4000-8000-000000000003','f9100000-0000-4000-8000-000000000004','f9100000-0000-4000-8000-000000000005','f9100000-0000-4000-8000-000000000006','f9100000-0000-4000-8000-000000000007','f9100000-0000-4000-8000-000000000008','f9100000-0000-4000-8000-000000000009');
insert into private.room_filter_resolutions(room_id,release_year_from,release_year_to)
select id,2000,2026 from public.rooms where filter_resolution_status='compatible';

insert into public.room_candidate_occurrences(room_id,sequence,tmdb_movie_id,status,created_at,resolved_at)
values
 ('f9100000-0000-4000-8000-000000000006',1,906006,'collecting','2026-09-01 00:06',null),
 ('f9100000-0000-4000-8000-000000000007',1,906007,'rejected','2026-09-01 00:07','2026-09-01 00:07:30'),
 ('f9100000-0000-4000-8000-000000000008',1,906008,'agreed','2026-09-01 00:08','2026-09-01 00:08:30'),
 ('f9100000-0000-4000-8000-000000000009',1,906009,'rejected','2026-09-01 00:09','2026-09-01 00:09:30');

do $decisions$ declare r record; m record; i integer; begin
  for r in select * from public.rooms where id='f9100000-0000-4000-8000-000000000008' loop
    i := 0;
    for m in select id from public.room_members where room_id=r.id and is_voter order by id loop
      i := i + 1;
      insert into public.candidate_decisions(room_id,room_member_id,candidate_occurrence_id,decision,accepted_at)
      select r.id,m.id,o.id,'yes'::public.candidate_decision_value,('2026-09-01 00:08:40+00'::timestamptz+i*interval '1 second')
      from public.room_candidate_occurrences o where o.room_id=r.id and o.sequence=1;
    end loop;
  end loop;
end; $decisions$;

update public.rooms set candidate_acquisition_status='assigned',tmdb_movie_id=906006,
  candidate_progression_status='collecting',candidate_sequence=1
  where id='f9100000-0000-4000-8000-000000000006';
update public.rooms set candidate_acquisition_status='assigned',tmdb_movie_id=906008,
  candidate_progression_status='agreed',candidate_sequence=1,decision_completed_count=2
  where id='f9100000-0000-4000-8000-000000000008';
commit;

select jsonb_build_object(
 'rooms',(select jsonb_agg(to_jsonb(r)||jsonb_build_object('row_xmin',r.xmin::text) order by id) from public.rooms r),
 'members',(select jsonb_agg(to_jsonb(m)||jsonb_build_object('row_xmin',m.xmin::text) order by room_id,id) from public.room_members m),
 'filters',(select jsonb_agg(to_jsonb(f)||jsonb_build_object('row_xmin',f.xmin::text) order by room_member_id) from public.participant_filters f),
 'parents',(select jsonb_agg(to_jsonb(p)||jsonb_build_object('row_xmin',p.xmin::text) order by room_id) from private.room_filter_resolutions p),
 'occurrences',(select jsonb_agg(to_jsonb(o)||jsonb_build_object('row_xmin',o.xmin::text) order by room_id,sequence) from public.room_candidate_occurrences o),
 'decisions',(select jsonb_agg(to_jsonb(d)||jsonb_build_object('row_xmin',d.xmin::text) order by room_id,room_member_id) from public.candidate_decisions d));
