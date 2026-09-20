-- Feature 008: occurrence-bound decisions, complete-set resolution, and
-- exactly-once candidate progression. External TMDB work remains outside SQL.
begin;
lock table public.rooms, public.room_members, public.candidate_decisions in access exclusive mode;

-- Fail closed before transforming nonempty Feature 007 state.
do $precheck$
begin
  if exists(
    select 1 from public.candidate_decisions d
    left join public.room_members m on m.id=d.room_member_id
    left join public.rooms r on r.id=m.room_id
    where m.id is null or not m.is_voter or r.id is null
      or r.candidate_acquisition_status<>'assigned' or r.tmdb_movie_id<>d.tmdb_movie_id
  ) or exists(
    select 1 from public.rooms r where r.decision_completed_count<>
      (select count(*) from public.candidate_decisions d join public.room_members m on m.id=d.room_member_id
       where m.room_id=r.id and m.is_voter and d.tmdb_movie_id=r.tmdb_movie_id)
  ) then
    raise exception using errcode='P0001',message='Candidate progression cutover integrity failure';
  end if;
end;$precheck$;

create type public.candidate_occurrence_status as enum('collecting','rejected','agreed');
alter type public.candidate_occurrence_status owner to postgres;
create type public.candidate_progression_status as enum('inactive','collecting','advancing','agreed','exhausted');
alter type public.candidate_progression_status owner to postgres;

create function private.candidate_agreement_threshold(p_required_voter_count integer)
returns integer language plpgsql immutable strict security definer set search_path='' as $f$
begin
  if p_required_voter_count<2 then
    raise exception using errcode='22023',message='Invalid voter count';
  end if;
  if p_required_voter_count=2 then return 2;end if;
  return (((2::bigint*p_required_voter_count::bigint)+2::bigint)/3::bigint)::integer;
end;$f$;
alter function private.candidate_agreement_threshold(integer) owner to postgres;
revoke all on function private.candidate_agreement_threshold(integer) from public,anon,authenticated,service_role;

alter table public.room_members add constraint room_members_room_id_id_key unique(room_id,id);

create table public.room_candidate_occurrences(
  id uuid not null default extensions.gen_random_uuid(),
  room_id uuid not null,
  sequence integer not null,
  tmdb_movie_id bigint not null,
  status public.candidate_occurrence_status not null default 'collecting',
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  resolved_at timestamptz,
  constraint room_candidate_occurrences_pkey primary key(id),
  constraint room_candidate_occurrences_room_id_id_key unique(room_id,id),
  constraint room_candidate_occurrences_room_sequence_key unique(room_id,sequence),
  constraint room_candidate_occurrences_room_sequence_tmdb_key unique(room_id,sequence,tmdb_movie_id),
  constraint room_candidate_occurrences_room_tmdb_key unique(room_id,tmdb_movie_id),
  constraint room_candidate_occurrences_room_id_fkey foreign key(room_id)
    references public.rooms(id) on delete cascade,
  constraint room_candidate_occurrences_sequence_positive_check check(sequence>0),
  constraint room_candidate_occurrences_tmdb_positive_check check(tmdb_movie_id>0),
  constraint room_candidate_occurrences_resolution_check check(
    (status='collecting' and resolved_at is null)
    or (status in('rejected','agreed') and resolved_at is not null))
);
create unique index room_candidate_occurrences_one_current_idx
  on public.room_candidate_occurrences(room_id) where status in('collecting','agreed');
alter table public.room_candidate_occurrences owner to postgres;
alter table public.room_candidate_occurrences enable row level security;
revoke all on table public.room_candidate_occurrences from public,anon,authenticated,service_role;

alter table public.rooms
  add column candidate_progression_status public.candidate_progression_status not null default 'inactive',
  add column candidate_sequence integer not null default 0;

insert into public.room_candidate_occurrences(room_id,sequence,tmdb_movie_id,status,created_at,resolved_at)
select r.id,1,r.tmdb_movie_id,
  case when r.decision_completed_count<r.required_voter_count then 'collecting'::public.candidate_occurrence_status
       when (select count(*) from public.candidate_decisions d join public.room_members m on m.id=d.room_member_id
             where m.room_id=r.id and m.is_voter and d.tmdb_movie_id=r.tmdb_movie_id and d.decision='yes')
            >=private.candidate_agreement_threshold(r.required_voter_count)
         then 'agreed'::public.candidate_occurrence_status else 'rejected'::public.candidate_occurrence_status end,
  pg_catalog.transaction_timestamp(),
  case when r.decision_completed_count=r.required_voter_count then pg_catalog.transaction_timestamp() end
from public.rooms r where r.candidate_acquisition_status='assigned';

alter table public.candidate_decisions
  add column room_id uuid,
  add column candidate_occurrence_id uuid;
update public.candidate_decisions d set
  room_id=m.room_id,candidate_occurrence_id=o.id
from public.room_members m join public.room_candidate_occurrences o on o.room_id=m.room_id
where m.id=d.room_member_id and o.tmdb_movie_id=d.tmdb_movie_id;
alter table public.candidate_decisions drop constraint candidate_decisions_pkey;
alter table public.candidate_decisions drop constraint candidate_decisions_room_member_id_fkey;
alter table public.candidate_decisions drop constraint candidate_decisions_tmdb_movie_id_positive_check;
alter table public.candidate_decisions drop column tmdb_movie_id;
alter table public.candidate_decisions alter column room_id set not null;
alter table public.candidate_decisions alter column candidate_occurrence_id set not null;
alter table public.candidate_decisions
  add constraint candidate_decisions_pkey primary key(room_member_id,candidate_occurrence_id),
  add constraint candidate_decisions_room_member_same_room_fkey foreign key(room_id,room_member_id)
    references public.room_members(room_id,id) on delete cascade,
  add constraint candidate_decisions_occurrence_same_room_fkey foreign key(room_id,candidate_occurrence_id)
    references public.room_candidate_occurrences(room_id,id) on delete cascade;

update public.rooms r set
  candidate_progression_status=case
    when r.candidate_acquisition_status<>'assigned' then 'inactive'::public.candidate_progression_status
    when r.decision_completed_count<r.required_voter_count then 'collecting'::public.candidate_progression_status
    when o.status='agreed' then 'agreed'::public.candidate_progression_status
    else 'advancing'::public.candidate_progression_status end,
  candidate_sequence=case when r.candidate_acquisition_status='assigned' then 1 else 0 end,
  candidate_acquisition_status=case when o.status='rejected' then 'pending'::public.candidate_acquisition_status
    else r.candidate_acquisition_status end,
  tmdb_movie_id=case when o.status='rejected' then null else r.tmdb_movie_id end,
  decision_completed_count=case when o.status='rejected' then 0 else r.decision_completed_count end
from public.room_candidate_occurrences o where o.room_id=r.id;

alter table public.rooms drop constraint rooms_candidate_status_id_check;
alter table public.rooms drop constraint rooms_candidate_terminal_requires_compatible_check;
alter table public.rooms drop constraint rooms_decisions_require_assigned_candidate_check;
alter table public.rooms drop constraint rooms_decision_completed_count_bounds_check;
alter table public.rooms
  add constraint rooms_candidate_sequence_nonnegative_check check(candidate_sequence>=0),
  add constraint rooms_candidate_progression_shape_check check(
    (candidate_progression_status='inactive' and candidate_sequence=0 and tmdb_movie_id is null
      and decision_completed_count=0 and candidate_acquisition_status in('pending','no_candidates'))
    or (candidate_progression_status='collecting' and candidate_sequence>=1 and tmdb_movie_id is not null
      and candidate_acquisition_status='assigned' and decision_completed_count>=0
      and decision_completed_count<required_voter_count)
    or (candidate_progression_status='agreed' and candidate_sequence>=1 and tmdb_movie_id is not null
      and candidate_acquisition_status='assigned' and decision_completed_count=required_voter_count)
    or (candidate_progression_status='advancing' and candidate_sequence>=1 and tmdb_movie_id is null
      and candidate_acquisition_status='pending' and decision_completed_count=0)
    or (candidate_progression_status='exhausted' and candidate_sequence>=1 and tmdb_movie_id is null
      and candidate_acquisition_status='no_candidates' and decision_completed_count=0)),
  add constraint rooms_progression_ready_compatible_check check(
    candidate_progression_status='inactive' or (
      state='ready' and voter_count=required_voter_count
      and filter_completed_count=required_voter_count and filter_resolution_status='compatible')),
  add constraint rooms_current_candidate_occurrence_fkey foreign key(id,candidate_sequence,tmdb_movie_id)
    references public.room_candidate_occurrences(room_id,sequence,tmdb_movie_id);

-- Replace Feature 007 signatures.
drop function public.get_room_candidate_decision(uuid,bigint);
drop function public.submit_room_candidate_decision(uuid,bigint,public.candidate_decision_value);

create function public.get_room_candidate_decision(p_room_id uuid,p_expected_candidate_sequence integer,
  p_expected_tmdb_movie_id bigint)
returns table(outcome text,my_decision public.candidate_decision_value,candidate_sequence integer,
 decision_completed_count integer,required_voter_count integer,decision_set_complete boolean,
 agreement_threshold integer,candidate_outcome public.candidate_occurrence_status,
 candidate_progression_status public.candidate_progression_status)
language plpgsql security definer set search_path='' as $f$
declare v_user uuid:=auth.uid();v_room public.rooms%rowtype;v_member public.room_members%rowtype;
 v_occ public.room_candidate_occurrences%rowtype;v_count integer;v_mine public.candidate_decision_value;
begin
 if v_user is null then raise exception using errcode='42501',message='Authentication required';end if;
 if p_room_id is null or p_expected_candidate_sequence is null or p_expected_candidate_sequence<=0
   or p_expected_tmdb_movie_id is null or p_expected_tmdb_movie_id<=0
 then raise exception using errcode='22023',message='Invalid decision target';end if;
 select m.* into v_member from public.room_members m join public.rooms r on r.id=m.room_id
  where r.id=p_room_id and m.user_id=v_user and(m.is_voter or r.creator_user_id=v_user);
 if not found then return query select 'not_found',null::public.candidate_decision_value,null::integer,
  null::integer,null::integer,null::boolean,null::integer,null::public.candidate_occurrence_status,
  null::public.candidate_progression_status;return;end if;
 select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id and m.id=v_member.id
  where r.id=p_room_id and m.user_id=v_user for share of r;
 if not found then return query select 'not_found',null::public.candidate_decision_value,null::integer,
  null::integer,null::integer,null::boolean,null::integer,null::public.candidate_occurrence_status,
  null::public.candidate_progression_status;return;end if;
 if v_room.candidate_sequence<>p_expected_candidate_sequence
   or v_room.candidate_progression_status not in('collecting','agreed')
   or v_room.tmdb_movie_id is distinct from p_expected_tmdb_movie_id then
  return query select case when v_room.candidate_sequence=0 then 'not_ready' else 'candidate_changed' end,
   null::public.candidate_decision_value,null::integer,null::integer,null::integer,null::boolean,
   null::integer,null::public.candidate_occurrence_status,null::public.candidate_progression_status;return;
 end if;
 select o.* into strict v_occ from public.room_candidate_occurrences o where o.room_id=v_room.id
  and o.sequence=v_room.candidate_sequence and o.tmdb_movie_id=v_room.tmdb_movie_id;
 select count(*)::integer into v_count from public.candidate_decisions d join public.room_members m
  on(m.room_id,m.id)=(d.room_id,d.room_member_id)
  where d.room_id=v_room.id and d.candidate_occurrence_id=v_occ.id and m.is_voter;
 if v_count<>v_room.decision_completed_count or v_room.voter_count<>v_room.required_voter_count
   or (v_room.candidate_progression_status='collecting' and v_occ.status<>'collecting')
   or (v_room.candidate_progression_status='agreed' and(v_occ.status<>'agreed' or v_count<>v_room.required_voter_count))
 then raise exception using errcode='P0001',message='Room decision integrity failure';end if;
 if v_member.is_voter then select d.decision into v_mine from public.candidate_decisions d
  where d.room_member_id=v_member.id and d.candidate_occurrence_id=v_occ.id;end if;
 return query select case when not v_member.is_voter then 'observer'
   when v_mine is null then 'not_decided' else 'decided' end,v_mine,v_occ.sequence,v_count,
   v_room.required_voter_count,v_occ.status<>'collecting',
   private.candidate_agreement_threshold(v_room.required_voter_count),v_occ.status,
   v_room.candidate_progression_status;
end;$f$;
alter function public.get_room_candidate_decision(uuid,integer,bigint) owner to postgres;
revoke all on function public.get_room_candidate_decision(uuid,integer,bigint) from public,anon,authenticated;
grant execute on function public.get_room_candidate_decision(uuid,integer,bigint) to authenticated;

create function public.submit_room_candidate_decision(p_room_id uuid,p_expected_candidate_sequence integer,
 p_expected_tmdb_movie_id bigint,p_decision public.candidate_decision_value)
returns table(outcome text,my_decision public.candidate_decision_value,candidate_sequence integer,
 decision_completed_count integer,required_voter_count integer,decision_set_complete boolean,
 agreement_threshold integer,candidate_outcome public.candidate_occurrence_status,
 candidate_progression_status public.candidate_progression_status)
language plpgsql security definer set search_path='' as $f$
declare v_user uuid:=auth.uid();v_room public.rooms%rowtype;v_member public.room_members%rowtype;
 v_occ public.room_candidate_occurrences%rowtype;v_count integer;v_yes integer;
 v_stored public.candidate_decision_value;v_result text;v_candidate_outcome public.candidate_occurrence_status;
begin
 if v_user is null then raise exception using errcode='42501',message='Authentication required';end if;
 if p_room_id is null or p_expected_candidate_sequence is null or p_expected_candidate_sequence<=0
  or p_expected_tmdb_movie_id is null or p_expected_tmdb_movie_id<=0 or p_decision is null
 then raise exception using errcode='22023',message='Invalid decision submission';end if;
 select m.* into v_member from public.room_members m join public.rooms r on r.id=m.room_id
  where r.id=p_room_id and m.user_id=v_user and(m.is_voter or r.creator_user_id=v_user);
 if not found then return query select 'not_found',null::public.candidate_decision_value,null::integer,
  null::integer,null::integer,null::boolean,null::integer,null::public.candidate_occurrence_status,
  null::public.candidate_progression_status;return;end if;
 select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id and m.id=v_member.id
  where r.id=p_room_id and m.user_id=v_user for update of r;
 if not found then return query select 'not_found',null::public.candidate_decision_value,null::integer,
  null::integer,null::integer,null::boolean,null::integer,null::public.candidate_occurrence_status,
  null::public.candidate_progression_status;return;end if;
 if v_room.candidate_sequence<>p_expected_candidate_sequence
  or v_room.candidate_progression_status not in('collecting','agreed')
  or v_room.tmdb_movie_id is distinct from p_expected_tmdb_movie_id then
  return query select case when v_room.candidate_sequence=0 then 'not_ready' else 'candidate_changed' end,
   null::public.candidate_decision_value,null::integer,null::integer,null::integer,null::boolean,
   null::integer,null::public.candidate_occurrence_status,null::public.candidate_progression_status;return;
 end if;
 select o.* into strict v_occ from public.room_candidate_occurrences o where o.room_id=v_room.id
  and o.sequence=v_room.candidate_sequence and o.tmdb_movie_id=v_room.tmdb_movie_id;
 select count(*)::integer,count(*) filter(where d.decision='yes')::integer into v_count,v_yes
 from public.candidate_decisions d join public.room_members m
  on(m.room_id,m.id)=(d.room_id,d.room_member_id)
 where d.room_id=v_room.id and d.candidate_occurrence_id=v_occ.id and m.is_voter;
 if v_count<>v_room.decision_completed_count or v_room.voter_count<>v_room.required_voter_count
  or (v_room.candidate_progression_status='collecting' and v_occ.status<>'collecting')
  or (v_room.candidate_progression_status='agreed' and(v_occ.status<>'agreed' or v_count<>v_room.required_voter_count))
 then raise exception using errcode='P0001',message='Room decision integrity failure';end if;
 if not v_member.is_voter then
  return query select 'not_voter',null::public.candidate_decision_value,v_occ.sequence,v_count,
   v_room.required_voter_count,v_occ.status<>'collecting',private.candidate_agreement_threshold(v_room.required_voter_count),
   v_occ.status,v_room.candidate_progression_status;return;
 end if;
 select d.decision into v_stored from public.candidate_decisions d where d.room_member_id=v_member.id
  and d.candidate_occurrence_id=v_occ.id;
 if found then v_result:=case when v_stored=p_decision then 'unchanged' else 'conflict' end;
  return query select v_result,v_stored,v_occ.sequence,v_count,v_room.required_voter_count,
   v_occ.status<>'collecting',private.candidate_agreement_threshold(v_room.required_voter_count),
   v_occ.status,v_room.candidate_progression_status;return;
 end if;
 if v_room.candidate_progression_status<>'collecting' then
  raise exception using errcode='P0001',message='Room decision integrity failure';end if;
 insert into public.candidate_decisions(room_id,room_member_id,candidate_occurrence_id,decision)
  values(v_room.id,v_member.id,v_occ.id,p_decision) returning decision into v_stored;
 v_count:=v_count+1;if v_stored='yes' then v_yes:=v_yes+1;end if;
 if v_count<v_room.required_voter_count then
  update public.rooms set decision_completed_count=v_count,updated_at=transaction_timestamp()
   where id=v_room.id returning * into v_room;v_candidate_outcome:='collecting';
 elsif v_count=v_room.required_voter_count then
  if v_yes>=private.candidate_agreement_threshold(v_room.required_voter_count) then
   update public.room_candidate_occurrences set status='agreed',resolved_at=transaction_timestamp()
    where id=v_occ.id;
   update public.rooms set candidate_progression_status='agreed',decision_completed_count=v_count,
    updated_at=transaction_timestamp() where id=v_room.id returning * into v_room;
   v_candidate_outcome:='agreed';
  else
   update public.room_candidate_occurrences set status='rejected',resolved_at=transaction_timestamp()
    where id=v_occ.id;
   update public.rooms set candidate_progression_status='advancing',candidate_acquisition_status='pending',
    tmdb_movie_id=null,decision_completed_count=0,updated_at=transaction_timestamp()
    where id=v_room.id returning * into v_room;
   v_candidate_outcome:='rejected';
  end if;
 else raise exception using errcode='P0001',message='Room decision integrity failure';end if;
 return query select 'accepted',v_stored,v_occ.sequence,v_count,v_room.required_voter_count,
  v_count=v_room.required_voter_count,private.candidate_agreement_threshold(v_room.required_voter_count),
  v_candidate_outcome,v_room.candidate_progression_status;
end;$f$;
alter function public.submit_room_candidate_decision(uuid,integer,bigint,public.candidate_decision_value) owner to postgres;
revoke all on function public.submit_room_candidate_decision(uuid,integer,bigint,public.candidate_decision_value)
 from public,anon,authenticated;
grant execute on function public.submit_room_candidate_decision(uuid,integer,bigint,public.candidate_decision_value)
 to authenticated;

-- Source prepare/commit functions preserve the public Edge body while making
-- expected sequence and exclusions server-owned.
drop function public.prepare_room_tmdb_candidate(uuid,uuid);
drop function public.commit_room_tmdb_candidate(uuid,uuid,bigint,smallint,integer[],boolean);
drop function public.commit_room_tmdb_no_candidates(uuid,uuid);

create function public.prepare_room_tmdb_candidate(p_room_id uuid,p_actor_user_id uuid)
returns table(outcome text,candidate_sequence integer,
 candidate_progression_status public.candidate_progression_status,tmdb_movie_id bigint,
 release_year_from smallint,release_year_to smallint,genre_clauses_tmdb_ids jsonb,
 excluded_tmdb_movie_ids jsonb)
language plpgsql security definer set search_path='' as $f$
declare v_room public.rooms%rowtype;v_parent private.room_filter_resolutions%rowtype;v_clauses jsonb;v_excluded jsonb;
begin
 if p_room_id is null or p_actor_user_id is null then raise exception using errcode='22023',message='Invalid candidate request';end if;
 perform 1 from public.room_members m join public.rooms r on r.id=m.room_id where r.id=p_room_id
  and m.user_id=p_actor_user_id and(m.is_voter or r.creator_user_id=p_actor_user_id);
 if not found then return query select 'not_found',null::integer,null::public.candidate_progression_status,
  null::bigint,null::smallint,null::smallint,null::jsonb,null::jsonb;return;end if;
 select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id
  where r.id=p_room_id and m.user_id=p_actor_user_id and(m.is_voter or r.creator_user_id=p_actor_user_id)
  for update of r;
 if not found then return query select 'not_found',null::integer,null::public.candidate_progression_status,
  null::bigint,null::smallint,null::smallint,null::jsonb,null::jsonb;return;end if;
 if v_room.candidate_progression_status in('collecting','agreed') then
  return query select 'assigned',v_room.candidate_sequence,v_room.candidate_progression_status,
   v_room.tmdb_movie_id,null::smallint,null::smallint,null::jsonb,null::jsonb;return;
 elsif v_room.candidate_progression_status='exhausted' then
  return query select 'exhausted',v_room.candidate_sequence,v_room.candidate_progression_status,
   null::bigint,null::smallint,null::smallint,null::jsonb,null::jsonb;return;
 elsif v_room.candidate_progression_status='inactive' and v_room.candidate_acquisition_status='no_candidates' then
  return query select 'no_candidates',0,v_room.candidate_progression_status,null::bigint,
   null::smallint,null::smallint,null::jsonb,null::jsonb;return;
 end if;
 if not((v_room.candidate_progression_status='inactive' and v_room.candidate_sequence=0
       and v_room.candidate_acquisition_status='pending')
    or(v_room.candidate_progression_status='advancing' and v_room.candidate_sequence>0
       and v_room.candidate_acquisition_status='pending'
       and exists(select 1 from public.room_candidate_occurrences o where o.room_id=v_room.id
        and o.sequence=v_room.candidate_sequence and o.status='rejected')))
   or v_room.state<>'ready' or v_room.voter_count<>v_room.required_voter_count
   or v_room.filter_completed_count<>v_room.required_voter_count
   or v_room.filter_resolution_status<>'compatible' or not private.valid_tmdb_candidate_handoff(v_room.id)
 then return query select 'not_ready',null::integer,null::public.candidate_progression_status,
   null::bigint,null::smallint,null::smallint,null::jsonb,null::jsonb;return;end if;
 select * into strict v_parent from private.room_filter_resolutions where room_id=v_room.id;
 select coalesce(jsonb_agg(to_jsonb(q.ids) order by q.clause_ordinal),'[]'::jsonb) into v_clauses
 from(select c.clause_ordinal,array_agg(m.tmdb_genre_id order by m.tmdb_genre_id) ids
  from private.room_filter_resolution_genre_clauses c cross join unnest(c.genres)g
  join private.tmdb_movie_genres m on m.participant_genre=g where c.room_id=v_room.id group by c.clause_ordinal)q;
 select coalesce(jsonb_agg(o.tmdb_movie_id order by o.sequence),'[]'::jsonb) into v_excluded
 from public.room_candidate_occurrences o where o.room_id=v_room.id;
 return query select 'acquire',v_room.candidate_sequence,v_room.candidate_progression_status,null::bigint,
  v_parent.release_year_from,v_parent.release_year_to,v_clauses,v_excluded;
end;$f$;
alter function public.prepare_room_tmdb_candidate(uuid,uuid) owner to postgres;
revoke all on function public.prepare_room_tmdb_candidate(uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_room_tmdb_candidate(uuid,uuid) to service_role;

create function public.commit_room_tmdb_candidate(p_room_id uuid,p_actor_user_id uuid,
 p_expected_candidate_sequence integer,p_tmdb_movie_id bigint,p_release_year smallint,
 p_tmdb_genre_ids integer[],p_adult boolean)
returns table(outcome text,candidate_sequence integer,
 candidate_progression_status public.candidate_progression_status,tmdb_movie_id bigint)
language plpgsql security definer set search_path='' as $f$
declare v_room public.rooms%rowtype;v_parent private.room_filter_resolutions%rowtype;v_next integer;
begin
 if p_room_id is null or p_actor_user_id is null or p_expected_candidate_sequence is null
  or p_expected_candidate_sequence<0 then raise exception using errcode='22023',message='Invalid candidate request';end if;
 perform 1 from public.room_members m join public.rooms r on r.id=m.room_id where r.id=p_room_id
  and m.user_id=p_actor_user_id and(m.is_voter or r.creator_user_id=p_actor_user_id);
 if not found then return query select 'not_found',null::integer,null::public.candidate_progression_status,null::bigint;return;end if;
 select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id
  where r.id=p_room_id and m.user_id=p_actor_user_id and(m.is_voter or r.creator_user_id=p_actor_user_id)
  for update of r;
 if not found then return query select 'not_found',null::integer,null::public.candidate_progression_status,null::bigint;return;end if;
 if v_room.candidate_sequence=p_expected_candidate_sequence+1
   and v_room.candidate_progression_status in('collecting','agreed') then
  return query select 'assigned',v_room.candidate_sequence,v_room.candidate_progression_status,v_room.tmdb_movie_id;return;
 elsif v_room.candidate_sequence=p_expected_candidate_sequence and v_room.candidate_progression_status='exhausted' then
  return query select 'exhausted',v_room.candidate_sequence,v_room.candidate_progression_status,null::bigint;return;
 elsif v_room.candidate_sequence=0 and p_expected_candidate_sequence=0
   and v_room.candidate_progression_status='inactive' and v_room.candidate_acquisition_status='no_candidates' then
  return query select 'no_candidates',0,v_room.candidate_progression_status,null::bigint;return;
 elsif v_room.candidate_sequence<>p_expected_candidate_sequence
   or v_room.candidate_progression_status not in('inactive','advancing') then
  return query select 'refresh_required',null::integer,null::public.candidate_progression_status,null::bigint;return;
 end if;
 if not((v_room.candidate_progression_status='inactive' and v_room.candidate_sequence=0)
   or(v_room.candidate_progression_status='advancing' and exists(select 1 from public.room_candidate_occurrences o
      where o.room_id=v_room.id and o.sequence=v_room.candidate_sequence and o.status='rejected')))
  or v_room.candidate_acquisition_status<>'pending' or v_room.state<>'ready'
  or v_room.voter_count<>v_room.required_voter_count or v_room.filter_completed_count<>v_room.required_voter_count
  or v_room.filter_resolution_status<>'compatible' or not private.valid_tmdb_candidate_handoff(v_room.id)
 then return query select 'not_ready',null::integer,null::public.candidate_progression_status,null::bigint;return;end if;
 if p_tmdb_movie_id is null or p_tmdb_movie_id<=0 or p_release_year is null or p_tmdb_genre_ids is null
  or p_adult is distinct from false or(cardinality(p_tmdb_genre_ids)>0 and array_ndims(p_tmdb_genre_ids)<>1)
  or array_position(p_tmdb_genre_ids,null::integer) is not null
  or p_tmdb_genre_ids<>(select coalesce(array_agg(distinct g order by g),'{}'::integer[]) from unnest(p_tmdb_genre_ids)g)
  or exists(select 1 from unnest(p_tmdb_genre_ids)g left join private.tmdb_movie_genres m
    on m.tmdb_genre_id=g where m.tmdb_genre_id is null)
 then raise exception using errcode='22023',message='Invalid candidate evidence';end if;
 select * into strict v_parent from private.room_filter_resolutions where room_id=v_room.id;
 if p_release_year<v_parent.release_year_from or p_release_year>v_parent.release_year_to
  or exists(select 1 from private.room_filter_resolution_genre_clauses c where c.room_id=v_room.id
    and not p_tmdb_genre_ids&&array(select m.tmdb_genre_id from unnest(c.genres)g
      join private.tmdb_movie_genres m on m.participant_genre=g order by m.tmdb_genre_id))
  or exists(select 1 from public.room_candidate_occurrences o where o.room_id=v_room.id and o.tmdb_movie_id=p_tmdb_movie_id)
 then raise exception using errcode='22023',message='Ineligible candidate evidence';end if;
 v_next:=p_expected_candidate_sequence+1;
 insert into public.room_candidate_occurrences(room_id,sequence,tmdb_movie_id) values(v_room.id,v_next,p_tmdb_movie_id);
 update public.rooms set candidate_progression_status='collecting',candidate_sequence=v_next,
  candidate_acquisition_status='assigned',tmdb_movie_id=p_tmdb_movie_id,decision_completed_count=0,
  updated_at=transaction_timestamp() where id=v_room.id returning * into v_room;
 return query select 'assigned',v_room.candidate_sequence,v_room.candidate_progression_status,v_room.tmdb_movie_id;
end;$f$;
alter function public.commit_room_tmdb_candidate(uuid,uuid,integer,bigint,smallint,integer[],boolean) owner to postgres;
revoke all on function public.commit_room_tmdb_candidate(uuid,uuid,integer,bigint,smallint,integer[],boolean)
 from public,anon,authenticated;
grant execute on function public.commit_room_tmdb_candidate(uuid,uuid,integer,bigint,smallint,integer[],boolean) to service_role;

create function public.commit_room_tmdb_no_candidates(p_room_id uuid,p_actor_user_id uuid,
 p_expected_candidate_sequence integer)
returns table(outcome text,candidate_sequence integer,
 candidate_progression_status public.candidate_progression_status,tmdb_movie_id bigint)
language plpgsql security definer set search_path='' as $f$
declare v_room public.rooms%rowtype;
begin
 if p_room_id is null or p_actor_user_id is null or p_expected_candidate_sequence is null
  or p_expected_candidate_sequence<0 then raise exception using errcode='22023',message='Invalid candidate request';end if;
 perform 1 from public.room_members m join public.rooms r on r.id=m.room_id where r.id=p_room_id
  and m.user_id=p_actor_user_id and(m.is_voter or r.creator_user_id=p_actor_user_id);
 if not found then return query select 'not_found',null::integer,null::public.candidate_progression_status,null::bigint;return;end if;
 select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id
  where r.id=p_room_id and m.user_id=p_actor_user_id and(m.is_voter or r.creator_user_id=p_actor_user_id)
  for update of r;
 if not found then return query select 'not_found',null::integer,null::public.candidate_progression_status,null::bigint;return;end if;
 if v_room.candidate_sequence=p_expected_candidate_sequence+1
   and v_room.candidate_progression_status in('collecting','agreed') then
  return query select 'assigned',v_room.candidate_sequence,v_room.candidate_progression_status,v_room.tmdb_movie_id;return;
 elsif v_room.candidate_sequence=p_expected_candidate_sequence and v_room.candidate_progression_status='exhausted' then
  return query select 'exhausted',v_room.candidate_sequence,v_room.candidate_progression_status,null::bigint;return;
 elsif v_room.candidate_sequence=0 and p_expected_candidate_sequence=0
   and v_room.candidate_progression_status='inactive' and v_room.candidate_acquisition_status='no_candidates' then
  return query select 'no_candidates',0,v_room.candidate_progression_status,null::bigint;return;
 elsif v_room.candidate_sequence<>p_expected_candidate_sequence
   or v_room.candidate_progression_status not in('inactive','advancing') then
  return query select 'refresh_required',null::integer,null::public.candidate_progression_status,null::bigint;return;
 end if;
 if v_room.candidate_acquisition_status<>'pending' or v_room.state<>'ready'
  or v_room.voter_count<>v_room.required_voter_count or v_room.filter_completed_count<>v_room.required_voter_count
  or v_room.filter_resolution_status<>'compatible' or not private.valid_tmdb_candidate_handoff(v_room.id)
  or(v_room.candidate_progression_status='advancing' and not exists(select 1 from public.room_candidate_occurrences o
    where o.room_id=v_room.id and o.sequence=v_room.candidate_sequence and o.status='rejected'))
 then return query select 'not_ready',null::integer,null::public.candidate_progression_status,null::bigint;return;end if;
	 update public.rooms as room set candidate_progression_status=case when room.candidate_sequence=0 then 'inactive'::public.candidate_progression_status
	    else 'exhausted'::public.candidate_progression_status end,
	  candidate_acquisition_status='no_candidates',tmdb_movie_id=null,decision_completed_count=0,
	  updated_at=transaction_timestamp() where room.id=v_room.id returning room.* into v_room;
 return query select case when v_room.candidate_sequence=0 then 'no_candidates' else 'exhausted' end,
  v_room.candidate_sequence,v_room.candidate_progression_status,null::bigint;
end;$f$;
alter function public.commit_room_tmdb_no_candidates(uuid,uuid,integer) owner to postgres;
revoke all on function public.commit_room_tmdb_no_candidates(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.commit_room_tmdb_no_candidates(uuid,uuid,integer) to service_role;

-- Append safe progression fields to room create/join projections.
drop function public.create_room(uuid,integer,boolean);
create function public.create_room(p_creation_request_id uuid,p_required_voter_count integer,p_creator_is_voter boolean)
returns table(outcome text,room_id uuid,room_code text,room_state text,is_creator boolean,is_voter boolean,
 voter_count integer,required_voter_count integer,filter_completed_count integer,
 filter_resolution_status public.filter_resolution_status,candidate_acquisition_status public.candidate_acquisition_status,
 candidate_progression_status public.candidate_progression_status,candidate_sequence integer,decision_completed_count integer)
language plpgsql security definer set search_path='' as $f$
declare v_user uuid:=auth.uid();v_room public.rooms%rowtype;v_existing record;v_is_voter boolean;
 v_code text;v_constraint text;v_outcome text:='already_created';v_attempt integer;
begin
 if v_user is null then raise exception using errcode='42501',message='Authentication required';end if;
 if p_creation_request_id is null or p_required_voter_count is null or p_creator_is_voter is null
  then raise exception using errcode='22004',message='Creation configuration required';end if;
 if p_required_voter_count<2 then raise exception using errcode='22023',message='Invalid required voter count';end if;
 select r as room_row,m.is_voter into v_existing from public.rooms r left join public.room_members m
  on m.room_id=r.id and m.user_id=r.creator_user_id where r.creator_user_id=v_user
  and r.creation_request_id=p_creation_request_id;
 if found then v_room:=v_existing.room_row;v_is_voter:=v_existing.is_voter;
 else for v_attempt in 1..5 loop v_code:=upper(encode(extensions.gen_random_bytes(5),'hex'));
  begin
   insert into public.rooms as r(code,creation_request_id,creator_user_id,required_voter_count,voter_count)
    values(v_code,p_creation_request_id,v_user,p_required_voter_count,case when p_creator_is_voter then 1 else 0 end)
    returning r.* into v_room;
   insert into public.room_members as m(room_id,user_id,is_voter) values(v_room.id,v_user,p_creator_is_voter)
    returning m.is_voter into v_is_voter;v_outcome:='created';exit;
  exception when unique_violation then get stacked diagnostics v_constraint=constraint_name;
   if v_constraint not in('rooms_creator_creation_request_key','rooms_code_key') then raise;end if;
   select r as room_row,m.is_voter into v_existing from public.rooms r left join public.room_members m
    on m.room_id=r.id and m.user_id=r.creator_user_id where r.creator_user_id=v_user
    and r.creation_request_id=p_creation_request_id;
   if found then v_room:=v_existing.room_row;v_is_voter:=v_existing.is_voter;exit;end if;
   if v_constraint='rooms_creator_creation_request_key' then raise;end if;
   if v_attempt=5 then raise exception using errcode='P0001',message='Room code allocation exhausted';end if;
  end;end loop;end if;
 if v_is_voter is null then raise exception using errcode='P0001',message='Room membership integrity failure';end if;
 return query select v_outcome,v_room.id,v_room.code,v_room.state,true,v_is_voter,v_room.voter_count,
  v_room.required_voter_count,v_room.filter_completed_count,v_room.filter_resolution_status,
  v_room.candidate_acquisition_status,v_room.candidate_progression_status,v_room.candidate_sequence,
  v_room.decision_completed_count;
end;$f$;
alter function public.create_room(uuid,integer,boolean) owner to postgres;
revoke all on function public.create_room(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.create_room(uuid,integer,boolean) to authenticated;

drop function public.join_room(text);
create function public.join_room(p_room_code text)
returns table(outcome text,room_id uuid,room_code text,room_state text,is_creator boolean,is_voter boolean,
 voter_count integer,required_voter_count integer,filter_completed_count integer,
 filter_resolution_status public.filter_resolution_status,candidate_acquisition_status public.candidate_acquisition_status,
 candidate_progression_status public.candidate_progression_status,candidate_sequence integer,decision_completed_count integer)
language plpgsql security definer set search_path='' as $f$
declare v_user uuid:=auth.uid();v_room public.rooms%rowtype;v_code text;v_is_voter boolean;
begin
 if v_user is null then raise exception using errcode='42501',message='Authentication required';end if;
 v_code:=upper(btrim(p_room_code));
 if v_code is null or v_code!~'^[0-9A-F]{10}$' then return query select 'invalid_code',null::uuid,null::text,
  null::text,null::boolean,null::boolean,null::integer,null::integer,null::integer,
  null::public.filter_resolution_status,null::public.candidate_acquisition_status,
  null::public.candidate_progression_status,null::integer,null::integer;return;end if;
 select r.* into v_room from public.rooms r where r.code=v_code for update;
 if not found then return query select 'not_found',null::uuid,null::text,null::text,null::boolean,null::boolean,
  null::integer,null::integer,null::integer,null::public.filter_resolution_status,
  null::public.candidate_acquisition_status,null::public.candidate_progression_status,null::integer,null::integer;return;end if;
 select m.is_voter into v_is_voter from public.room_members m where m.room_id=v_room.id and m.user_id=v_user;
 if found then
  if v_user<>v_room.creator_user_id and not v_is_voter then raise exception using errcode='P0001',message='Room membership integrity failure';end if;
  return query select 'already_member',v_room.id,v_room.code,v_room.state,v_user=v_room.creator_user_id,
   v_is_voter,v_room.voter_count,v_room.required_voter_count,v_room.filter_completed_count,
   v_room.filter_resolution_status,v_room.candidate_acquisition_status,v_room.candidate_progression_status,
   v_room.candidate_sequence,v_room.decision_completed_count;return;
 end if;
 if v_user=v_room.creator_user_id then raise exception using errcode='P0001',message='Room membership integrity failure';end if;
 if v_room.voter_count=v_room.required_voter_count then return query select 'full',null::uuid,null::text,null::text,
  null::boolean,null::boolean,null::integer,null::integer,null::integer,null::public.filter_resolution_status,
  null::public.candidate_acquisition_status,null::public.candidate_progression_status,null::integer,null::integer;return;end if;
 insert into public.room_members(room_id,user_id,is_voter) values(v_room.id,v_user,true);
 update public.rooms as r set voter_count=r.voter_count+1,updated_at=transaction_timestamp()
  where r.id=v_room.id returning r.* into v_room;
 return query select 'joined',v_room.id,v_room.code,v_room.state,false,true,v_room.voter_count,
  v_room.required_voter_count,v_room.filter_completed_count,v_room.filter_resolution_status,
  v_room.candidate_acquisition_status,v_room.candidate_progression_status,v_room.candidate_sequence,
  v_room.decision_completed_count;
end;$f$;
alter function public.join_room(text) owner to postgres;
revoke all on function public.join_room(text) from public,anon,authenticated;
grant execute on function public.join_room(text) to authenticated;

revoke all privileges(id,code,creation_request_id,creator_user_id,state,created_at,updated_at,
 movie_candidate_id,required_voter_count,voter_count,filter_completed_count,filter_resolution_status,
 candidate_acquisition_status,tmdb_movie_id,decision_completed_count,candidate_progression_status,candidate_sequence)
 on public.rooms from public,anon,authenticated;
grant select(id,code,state,voter_count,required_voter_count,filter_completed_count,
 filter_resolution_status,candidate_acquisition_status,candidate_progression_status,candidate_sequence,
 decision_completed_count) on public.rooms to authenticated;

do $verify$ begin
 if exists(select 1 from public.candidate_decisions d join public.room_members m on m.id=d.room_member_id
  join public.room_candidate_occurrences o on o.id=d.candidate_occurrence_id
  where d.room_id<>m.room_id or d.room_id<>o.room_id)
 or exists(select 1 from public.rooms r where not(
   (r.candidate_sequence=0 and r.candidate_progression_status='inactive')
   or exists(select 1 from public.room_candidate_occurrences o where o.room_id=r.id and o.sequence=r.candidate_sequence)))
 then raise exception using errcode='P0001',message='Candidate progression cutover integrity failure';end if;
 if(select count(*) from pg_publication_tables where pubname='supabase_realtime')<>1
  or not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='rooms')
 then raise exception using errcode='P0001',message='Realtime publication integrity failure';end if;
end;$verify$;
notify pgrst,'reload schema';
commit;
