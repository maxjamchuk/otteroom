-- Feature 009: immutable room selection-rule snapshots, retained eligibility, and
-- ordered candidate-source/decision cutover.  This is the only schema migration
-- for the feature; prior migrations remain historical evidence.
begin;

lock table public.rooms, public.room_members, public.participant_filters,
  private.room_filter_resolutions, private.room_filter_resolution_genre_clauses,
  public.candidate_decisions, public.room_candidate_occurrences in access exclusive mode;

create table private.room_selection_rules(
  room_id uuid not null,
  rule_set_kind text not null,
  candidate_ordering text not null,
  minimum_vote_count bigint,
  minimum_average_rating numeric,
  metadata_language text not null,
  genre_mode text not null,
  agreement_numerator integer not null,
  agreement_denominator integer not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint room_selection_rules_pkey primary key(room_id),
  constraint room_selection_rules_room_id_fkey foreign key(room_id)
    references public.rooms(id) on delete cascade,
  constraint room_selection_rules_kind_check check(
    rule_set_kind in('legacy_005_006_008','configured_009_v1')),
  constraint room_selection_rules_ordering_check check(
    candidate_ordering in('legacy_source_order','vote_count_desc','average_rating_desc',
      'popularity_desc','title_asc')),
  constraint room_selection_rules_vote_count_check check(
    minimum_vote_count is null or minimum_vote_count>=0),
  constraint room_selection_rules_rating_check check(
    minimum_average_rating is null or
      (minimum_average_rating::text not in('NaN','Infinity','-Infinity')
       and minimum_average_rating>=0 and minimum_average_rating<=10)),
  constraint room_selection_rules_language_check check(
    metadata_language in(
      'ar-AE','ar-SA','be-BY','bg-BG','bn-BD','ca-ES','ch-GU','cn-CN',
      'cs-CZ','da-DK','de-AT','de-CH','de-DE','el-GR','en-AU','en-CA',
      'en-GB','en-IE','en-NZ','en-US','eo-EO','es-ES','es-MX','et-EE',
      'eu-ES','fa-IR','fi-FI','fr-CA','fr-FR','gl-ES','he-IL','hi-IN',
      'hu-HU','id-ID','it-IT','ja-JP','ka-GE','kk-KZ','kn-IN','ko-KR',
      'lt-LT','lv-LV','ml-IN','ms-MY','ms-SG','nb-NO','nl-NL','no-NO',
      'pl-PL','pt-BR','pt-PT','ro-RO','ru-RU','si-LK','sk-SK','sl-SI',
      'sq-AL','sr-RS','sv-SE','ta-IN','te-IN','th-TH','tl-PH','tr-TR',
      'uk-UA','vi-VN','zh-CN','zh-HK','zh-TW','zu-ZA')),
  constraint room_selection_rules_genre_mode_check check(genre_mode in('or','and')),
  constraint room_selection_rules_fraction_check check(
    agreement_numerator>0 and agreement_denominator>0
      and agreement_numerator<=agreement_denominator
      and pg_catalog.gcd(agreement_numerator,agreement_denominator)=1
      and agreement_numerator<=2147483647 and agreement_denominator<=2147483647),
  constraint room_selection_rules_kind_shape_check check(
    (rule_set_kind='legacy_005_006_008'
      and candidate_ordering='legacy_source_order'
      and minimum_vote_count is null and minimum_average_rating is null
      and metadata_language='en-US' and genre_mode='or'
      and agreement_numerator=2 and agreement_denominator=3)
    or (rule_set_kind='configured_009_v1'
      and candidate_ordering<>'legacy_source_order'
      and minimum_vote_count is not null
      and agreement_numerator<=agreement_denominator))
);
alter table private.room_selection_rules owner to postgres;
alter table private.room_selection_rules enable row level security;
revoke all privileges on table private.room_selection_rules from public,anon,authenticated,service_role;

create function private.prevent_room_selection_rules_mutation()
returns trigger language plpgsql security definer set search_path='' as $f$
begin
  if tg_op='DELETE' and not exists(select 1 from public.rooms where id=old.room_id) then
    return old;
  end if;
  raise exception using errcode='55000',message='Selection rule snapshots are immutable';
end;$f$;
alter function private.prevent_room_selection_rules_mutation() owner to postgres;
revoke all on function private.prevent_room_selection_rules_mutation() from public,anon,authenticated,service_role;
create trigger room_selection_rules_immutable
  before update or delete on private.room_selection_rules
  for each row execute function private.prevent_room_selection_rules_mutation();

do $precheck$
begin
  if exists(select 1 from public.rooms r where r.id is null)
    or exists(select 1 from public.room_members m where m.room_id is null)
    or exists(select 1 from public.participant_filters f where f.room_member_id is null)
    or exists(select 1 from public.room_candidate_occurrences o where o.room_id is null)
    or exists(select 1 from public.candidate_decisions d where d.room_id is null) then
    raise exception using errcode='P0001',message='Selection rule snapshot cutover integrity failure';
  end if;
end;$precheck$;

insert into private.room_selection_rules(
  room_id,rule_set_kind,candidate_ordering,minimum_vote_count,
  minimum_average_rating,metadata_language,genre_mode,agreement_numerator,
  agreement_denominator)
select r.id,'legacy_005_006_008','legacy_source_order',null,null,'en-US','or',2,3
from public.rooms r;

create function private.room_selection_rules_coherent(p_room_id uuid)
returns boolean language sql stable security definer set search_path='' as $f$
  select count(*)=1 and bool_and(
    (rule_set_kind='legacy_005_006_008'
      and candidate_ordering='legacy_source_order'
      and minimum_vote_count is null and minimum_average_rating is null
      and metadata_language='en-US' and genre_mode='or'
      and agreement_numerator=2 and agreement_denominator=3)
    or (rule_set_kind='configured_009_v1'
      and candidate_ordering in('vote_count_desc','average_rating_desc','popularity_desc','title_asc')
      and minimum_vote_count is not null and minimum_vote_count>=0
      and (minimum_average_rating is null or
        (minimum_average_rating::text not in('NaN','Infinity','-Infinity')
          and minimum_average_rating>=0 and minimum_average_rating<=10))
      and metadata_language in(
        'ar-AE','ar-SA','be-BY','bg-BG','bn-BD','ca-ES','ch-GU','cn-CN',
        'cs-CZ','da-DK','de-AT','de-CH','de-DE','el-GR','en-AU','en-CA',
        'en-GB','en-IE','en-NZ','en-US','eo-EO','es-ES','es-MX','et-EE',
        'eu-ES','fa-IR','fi-FI','fr-CA','fr-FR','gl-ES','he-IL','hi-IN',
        'hu-HU','id-ID','it-IT','ja-JP','ka-GE','kk-KZ','kn-IN','ko-KR',
        'lt-LT','lv-LV','ml-IN','ms-MY','ms-SG','nb-NO','nl-NL','no-NO',
        'pl-PL','pt-BR','pt-PT','ro-RO','ru-RU','si-LK','sk-SK','sl-SI',
        'sq-AL','sr-RS','sv-SE','ta-IN','te-IN','th-TH','tl-PH','tr-TR',
        'uk-UA','vi-VN','zh-CN','zh-HK','zh-TW','zu-ZA')
      and genre_mode in('or','and')
      and agreement_numerator>0 and agreement_denominator>0
      and agreement_numerator<=agreement_denominator
      and pg_catalog.gcd(agreement_numerator,agreement_denominator)=1
      and agreement_numerator<=2147483647 and agreement_denominator<=2147483647))
  from private.room_selection_rules where room_id=p_room_id;
$f$;
alter function private.room_selection_rules_coherent(uuid) owner to postgres;
revoke all on function private.room_selection_rules_coherent(uuid) from public,anon,authenticated,service_role;

-- Recompute the anonymous handoff from frozen filters and the retained genre mode.
create or replace function private.valid_tmdb_candidate_handoff(p_room_id uuid)
returns boolean language sql stable security definer set search_path='' as $f$
  with expected as(
    select row_number() over(order by f.genres,m.id,g.ordinality)::integer as clause_ordinal,
      case when s.genre_mode='and' then array[g.genre]::public.participant_genre[]
           else f.genres end as genres
    from public.participant_filters f
    join public.room_members m on m.id=f.room_member_id and m.is_voter
    cross join private.room_selection_rules s
    left join lateral unnest(
      case when s.genre_mode='and' then f.genres else array[null::public.participant_genre] end
    ) with ordinality g(genre,ordinality) on true
    where m.room_id=p_room_id and s.room_id=p_room_id and
      (s.genre_mode='or' or g.genre is not null) and pg_catalog.cardinality(f.genres)>0
  ), stored as(
    select c.clause_ordinal,c.genres
    from private.room_filter_resolution_genre_clauses c where c.room_id=p_room_id
  )
  select private.room_selection_rules_coherent(p_room_id)
    and (select count(*)=1 and min(release_year_from)>=1900
      and min(release_year_from)<=min(release_year_to)
      and min(release_year_to)<=extract(year from transaction_timestamp() at time zone 'UTC')::smallint
      from private.room_filter_resolutions where room_id=p_room_id)
    and (
      (select rule_set_kind='legacy_005_006_008'
       from private.room_selection_rules where room_id=p_room_id)
      or (select count(*)=(select count(*) from public.room_members where room_id=p_room_id and is_voter)
        from public.participant_filters f join public.room_members m on m.id=f.room_member_id
        where m.room_id=p_room_id and m.is_voter)
    )
    and not exists(
      select 1 from private.room_filter_resolution_genre_clauses c where c.room_id=p_room_id and (
        c.clause_ordinal<1 or cardinality(c.genres)=0
        or not private.valid_participant_genres(c.genres)
        or c.genres<>(select array_agg(v order by v) from unnest(c.genres)v)
        or exists(select 1 from unnest(c.genres)g left join private.tmdb_movie_genres m
          on m.participant_genre=g where m.participant_genre is null)))
    and (
      (select rule_set_kind='legacy_005_006_008'
       from private.room_selection_rules where room_id=p_room_id)
      or (not exists(select 1 from stored s full join expected e
          on s.clause_ordinal=e.clause_ordinal and s.genres=e.genres
          where s.clause_ordinal is null or e.clause_ordinal is null)
        and (select count(*) from stored)=(select count(*) from expected))
    );
$f$;
alter function private.valid_tmdb_candidate_handoff(uuid) owner to postgres;
revoke all on function private.valid_tmdb_candidate_handoff(uuid) from public,anon,authenticated,service_role;

-- The authenticated resolver is recreated only to make AND a sequence of singleton
-- clauses.  Its authorization, year intersection, idempotency, and status surface
-- remain the Feature 005 contract.
create or replace function public.resolve_common_filters(p_room_id uuid)
returns table(outcome text,filter_resolution_status public.filter_resolution_status)
language plpgsql security definer set search_path='' as $f$
declare
  v_user_id uuid:=auth.uid(); v_room public.rooms%rowtype; v_member public.room_members%rowtype;
  v_parent_count integer; v_clause_count integer; v_actual_voters integer; v_actual_filters integer;
  v_nonvoter_filters integer; v_invalid_nonvoters integer; v_invalid_sources integer;
  v_common_from smallint; v_common_to smallint; v_max smallint:=extract(year from
    transaction_timestamp() at time zone 'UTC')::smallint; v_mode text;
begin
  if v_user_id is null then raise exception using errcode='42501',message='Authentication required';end if;
  select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id
    where r.id=p_room_id and m.user_id=v_user_id for update of r;
  select m.* into v_member from public.room_members m where m.room_id=p_room_id and m.user_id=v_user_id;
  if not found then return query select 'not_found',null::public.filter_resolution_status;return;end if;
  if not v_member.is_voter and v_member.user_id<>v_room.creator_user_id then
    raise exception using errcode='P0001',message='Common filter resolution integrity failure';end if;
  if not private.room_selection_rules_coherent(v_room.id) then
    raise exception using errcode='P0001',message='Common filter resolution integrity failure';end if;
  select genre_mode into v_mode from private.room_selection_rules where room_id=v_room.id;
  select count(*) into v_parent_count from private.room_filter_resolutions where room_id=v_room.id;
  select count(*) into v_clause_count from private.room_filter_resolution_genre_clauses where room_id=v_room.id;
  if v_room.filter_resolution_status<>'pending' then
    if v_room.state<>'ready' or v_room.voter_count<>v_room.required_voter_count
      or v_room.filter_completed_count<>v_room.required_voter_count
      or (v_room.filter_resolution_status='compatible' and not private.valid_tmdb_candidate_handoff(v_room.id))
      or (v_room.filter_resolution_status='incompatible' and (v_parent_count<>0 or v_clause_count<>0)) then
      raise exception using errcode='P0001',message='Common filter resolution integrity failure';
    end if;
    return query select v_room.filter_resolution_status::text,v_room.filter_resolution_status;return;
  end if;
  if v_parent_count<>0 or v_clause_count<>0 then
    raise exception using errcode='P0001',message='Common filter resolution integrity failure';end if;
  if v_room.state<>'ready' or v_room.voter_count<v_room.required_voter_count
    or v_room.filter_completed_count<v_room.required_voter_count then
    return query select 'pending', 'pending'::public.filter_resolution_status;return;end if;
  if v_room.voter_count<>v_room.required_voter_count or v_room.filter_completed_count<>v_room.required_voter_count then
    raise exception using errcode='P0001',message='Common filter resolution integrity failure';end if;
  select count(*) into v_actual_voters from public.room_members where room_id=v_room.id and is_voter;
  select count(*) into v_actual_filters from public.participant_filters f join public.room_members m on m.id=f.room_member_id
    where m.room_id=v_room.id and m.is_voter;
  select count(*) into v_nonvoter_filters from public.participant_filters f join public.room_members m on m.id=f.room_member_id
    where m.room_id=v_room.id and not m.is_voter;
  select count(*) into v_invalid_nonvoters from public.room_members where room_id=v_room.id and not is_voter
    and user_id<>v_room.creator_user_id;
  select count(*) into v_invalid_sources from public.participant_filters f join public.room_members m on m.id=f.room_member_id
    where m.room_id=v_room.id and m.is_voter and (
      not private.valid_participant_genres(f.genres)
      or f.genres<>(select coalesce(array_agg(value order by value),'{}'::public.participant_genre[])
        from unnest(f.genres) valueset(value))
      or f.release_year_from<1900 or f.release_year_from>f.release_year_to or f.release_year_to>v_max);
  if v_actual_voters<>v_room.required_voter_count or v_actual_filters<>v_room.required_voter_count
    or v_nonvoter_filters<>0 or v_invalid_nonvoters<>0 or v_invalid_sources<>0 then
    raise exception using errcode='P0001',message='Common filter resolution integrity failure';end if;
  select max(f.release_year_from)::smallint,min(f.release_year_to)::smallint into v_common_from,v_common_to
    from public.participant_filters f join public.room_members m on m.id=f.room_member_id
    where m.room_id=v_room.id and m.is_voter;
  if v_common_from>v_common_to then
    update public.rooms set filter_resolution_status='incompatible',updated_at=transaction_timestamp() where id=v_room.id;
    return query select 'incompatible','incompatible'::public.filter_resolution_status;return;
  end if;
  insert into private.room_filter_resolutions(room_id,release_year_from,release_year_to)
    values(v_room.id,v_common_from,v_common_to);
  if v_mode='and' then
    insert into private.room_filter_resolution_genre_clauses(room_id,clause_ordinal,genres)
      select v_room.id,row_number() over(order by f.genres,m.id,g.genre)::integer,array[g.genre]::public.participant_genre[]
      from public.participant_filters f join public.room_members m on m.id=f.room_member_id and m.is_voter
      cross join lateral unnest(f.genres) g(genre)
      where m.room_id=v_room.id and cardinality(f.genres)>0;
  else
    insert into private.room_filter_resolution_genre_clauses(room_id,clause_ordinal,genres)
      select v_room.id,row_number() over(order by f.genres,m.id)::integer,f.genres
      from public.participant_filters f join public.room_members m on m.id=f.room_member_id and m.is_voter
      where m.room_id=v_room.id and cardinality(f.genres)>0;
  end if;
  update public.rooms set filter_resolution_status='compatible',updated_at=transaction_timestamp() where id=v_room.id;
  return query select 'compatible','compatible'::public.filter_resolution_status;
end;$f$;
alter function public.resolve_common_filters(uuid) owner to postgres;
revoke all on function public.resolve_common_filters(uuid) from public,anon,authenticated;
grant execute on function public.resolve_common_filters(uuid) to authenticated;

-- Snapshot-derived exact agreement.  The old fixed-count helper is deliberately
-- removed; callers must provide the locked room context.
drop function private.candidate_agreement_threshold(integer);
create function private.candidate_agreement_threshold(p_room_id uuid,p_required_voter_count integer)
returns integer language plpgsql stable security definer set search_path='' as $f$
declare v_p bigint; v_q bigint; v_expected integer;
begin
  if p_room_id is null or p_required_voter_count<2
    or not private.room_selection_rules_coherent(p_room_id) then
    raise exception using errcode='P0001',message='Room decision integrity failure';end if;
  select r.required_voter_count,s.agreement_numerator,s.agreement_denominator
    into v_expected,v_p,v_q
    from public.rooms r join private.room_selection_rules s on s.room_id=r.id
    where r.id=p_room_id;
  if v_expected is null or v_expected<>p_required_voter_count or v_p is null or v_q is null
    or v_p<=0 or v_q<=0 or v_p>v_q or pg_catalog.gcd(v_p,v_q)<>1 then
    raise exception using errcode='P0001',message='Room decision integrity failure';end if;
  if p_required_voter_count=2 then return 2;end if;
  return (((p_required_voter_count::bigint*v_p)+v_q-1)/v_q)::integer;
end;$f$;
alter function private.candidate_agreement_threshold(uuid,integer) owner to postgres;
revoke all on function private.candidate_agreement_threshold(uuid,integer) from public,anon,authenticated,service_role;

-- Trusted room creation receives only the already normalized startup generation.
drop function public.create_room(uuid,integer,boolean);
create function public.create_room_with_selection_rules(
  p_actor_user_id uuid,p_creation_request_id uuid,p_required_voter_count integer,
  p_creator_is_voter boolean,p_rule_set_kind text,p_candidate_ordering text,
  p_minimum_vote_count bigint,p_minimum_average_rating numeric,p_metadata_language text,
  p_genre_mode text,p_agreement_numerator integer,p_agreement_denominator integer)
returns table(outcome text,room_id uuid,room_code text,room_state text,is_creator boolean,is_voter boolean,
  voter_count integer,required_voter_count integer,filter_completed_count integer,
  filter_resolution_status public.filter_resolution_status,candidate_acquisition_status public.candidate_acquisition_status,
  candidate_progression_status public.candidate_progression_status,candidate_sequence integer,decision_completed_count integer)
language plpgsql security definer set search_path='' as $f$
declare v_room public.rooms%rowtype; v_existing record; v_is_voter boolean; v_code text;
  v_constraint text; v_outcome text:='already_created'; v_attempt integer;
begin
  if p_actor_user_id is null or p_creation_request_id is null or p_required_voter_count is null
    or p_creator_is_voter is null then raise exception using errcode='22004',message='Creation configuration required';end if;
  if p_required_voter_count<2 then raise exception using errcode='22023',message='Invalid required voter count';end if;
  if p_rule_set_kind<>'configured_009_v1' or p_candidate_ordering not in(
      'vote_count_desc','average_rating_desc','popularity_desc','title_asc')
    or p_minimum_vote_count is null or p_minimum_vote_count<0
    or p_minimum_average_rating::text in('NaN','Infinity','-Infinity')
    or (p_minimum_average_rating is not null and (p_minimum_average_rating<0 or p_minimum_average_rating>10))
    or p_metadata_language not in(
      'ar-AE','ar-SA','be-BY','bg-BG','bn-BD','ca-ES','ch-GU','cn-CN','cs-CZ','da-DK',
      'de-AT','de-CH','de-DE','el-GR','en-AU','en-CA','en-GB','en-IE','en-NZ','en-US',
      'eo-EO','es-ES','es-MX','et-EE','eu-ES','fa-IR','fi-FI','fr-CA','fr-FR','gl-ES',
      'he-IL','hi-IN','hu-HU','id-ID','it-IT','ja-JP','ka-GE','kk-KZ','kn-IN','ko-KR',
      'lt-LT','lv-LV','ml-IN','ms-MY','ms-SG','nb-NO','nl-NL','no-NO','pl-PL','pt-BR',
      'pt-PT','ro-RO','ru-RU','si-LK','sk-SK','sl-SI','sq-AL','sr-RS','sv-SE','ta-IN',
      'te-IN','th-TH','tl-PH','tr-TR','uk-UA','vi-VN','zh-CN','zh-HK','zh-TW','zu-ZA')
    or p_genre_mode not in('or','and') or p_agreement_numerator is null
    or p_agreement_denominator is null or p_agreement_numerator<=0
    or p_agreement_denominator<=0 or p_agreement_numerator>p_agreement_denominator
    or p_agreement_numerator>2147483647 or p_agreement_denominator>2147483647
    or pg_catalog.gcd(p_agreement_numerator,p_agreement_denominator)<>1 then
    raise exception using errcode='22023',message='Invalid selection rules';end if;
  select r as room_row,m.is_voter into v_existing from public.rooms r left join public.room_members m
    on m.room_id=r.id and m.user_id=p_actor_user_id
    where r.creator_user_id=p_actor_user_id and r.creation_request_id=p_creation_request_id;
  if found then
    v_room:=v_existing.room_row;v_is_voter:=v_existing.is_voter;
    if not private.room_selection_rules_coherent(v_room.id) then
      raise exception using errcode='P0001',message='Room selection rule integrity failure';end if;
  else
    for v_attempt in 1..5 loop
      v_code:=upper(encode(extensions.gen_random_bytes(5),'hex'));
      begin
        insert into public.rooms as r(code,creation_request_id,creator_user_id,required_voter_count,voter_count)
          values(v_code,p_creation_request_id,p_actor_user_id,p_required_voter_count,
            case when p_creator_is_voter then 1 else 0 end) returning r.* into v_room;
        insert into public.room_members as m(room_id,user_id,is_voter)
          values(v_room.id,p_actor_user_id,p_creator_is_voter) returning m.is_voter into v_is_voter;
        insert into private.room_selection_rules(room_id,rule_set_kind,candidate_ordering,minimum_vote_count,
          minimum_average_rating,metadata_language,genre_mode,agreement_numerator,agreement_denominator)
          values(v_room.id,p_rule_set_kind,p_candidate_ordering,p_minimum_vote_count,p_minimum_average_rating,
            p_metadata_language,p_genre_mode,p_agreement_numerator,p_agreement_denominator);
        v_outcome:='created'; exit;
      exception when unique_violation then
        get stacked diagnostics v_constraint=constraint_name;
        if v_constraint not in('rooms_creator_creation_request_key','rooms_code_key') then raise;end if;
        select r as room_row,m.is_voter into v_existing from public.rooms r left join public.room_members m
          on m.room_id=r.id and m.user_id=p_actor_user_id where r.creator_user_id=p_actor_user_id
          and r.creation_request_id=p_creation_request_id;
        if found then
          v_room:=v_existing.room_row;v_is_voter:=v_existing.is_voter;
          if not private.room_selection_rules_coherent(v_room.id) then
            raise exception using errcode='P0001',message='Room selection rule integrity failure';end if;
          exit;
        end if;
        if v_constraint='rooms_creator_creation_request_key' then raise;end if;
        if v_attempt=5 then raise exception using errcode='P0001',message='Room code allocation exhausted';end if;
      end;
    end loop;
  end if;
  if v_is_voter is null then raise exception using errcode='P0001',message='Room membership integrity failure';end if;
  return query select v_outcome,v_room.id,v_room.code,v_room.state,true,v_is_voter,v_room.voter_count,
    v_room.required_voter_count,v_room.filter_completed_count,v_room.filter_resolution_status,
    v_room.candidate_acquisition_status,v_room.candidate_progression_status,v_room.candidate_sequence,
    v_room.decision_completed_count;
end;$f$;
alter function public.create_room_with_selection_rules(uuid,uuid,integer,boolean,text,text,bigint,numeric,text,text,integer,integer) owner to postgres;
revoke all on function public.create_room_with_selection_rules(uuid,uuid,integer,boolean,text,text,bigint,numeric,text,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.create_room_with_selection_rules(uuid,uuid,integer,boolean,text,text,bigint,numeric,text,text,integer,integer)
  to service_role;

-- Source preflight exposes only retained private values needed by the Edge search.
drop function public.prepare_room_tmdb_candidate(uuid,uuid);
create function public.prepare_room_tmdb_candidate(p_room_id uuid,p_actor_user_id uuid)
returns table(outcome text,candidate_sequence integer,candidate_progression_status public.candidate_progression_status,
  tmdb_movie_id bigint,release_year_from smallint,release_year_to smallint,genre_clauses_tmdb_ids jsonb,
  excluded_tmdb_movie_ids jsonb,rule_set_kind text,candidate_ordering text,minimum_vote_count bigint,
  minimum_average_rating numeric,metadata_language text,genre_mode text)
language plpgsql security definer set search_path='' as $f$
declare v_room public.rooms%rowtype;v_parent private.room_filter_resolutions%rowtype;v_rules private.room_selection_rules%rowtype;
  v_clauses jsonb;v_excluded jsonb;
begin
  if p_room_id is null or p_actor_user_id is null then raise exception using errcode='22023',message='Invalid candidate request';end if;
  perform 1 from public.room_members m join public.rooms r on r.id=m.room_id where r.id=p_room_id
    and m.user_id=p_actor_user_id and(m.is_voter or r.creator_user_id=p_actor_user_id);
  if not found then return query select 'not_found',null::integer,null::public.candidate_progression_status,null::bigint,
    null::smallint,null::smallint,null::jsonb,null::jsonb,null::text,null::text,null::bigint,null::numeric,null::text,null::text;return;end if;
  select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id
    where r.id=p_room_id and m.user_id=p_actor_user_id and(m.is_voter or r.creator_user_id=p_actor_user_id) for update of r;
  if not found then return query select 'not_found',null::integer,null::public.candidate_progression_status,null::bigint,
    null::smallint,null::smallint,null::jsonb,null::jsonb,null::text,null::text,null::bigint,null::numeric,null::text,null::text;return;end if;
  if not private.room_selection_rules_coherent(v_room.id) then
    raise exception using errcode='P0001',message='Room selection rule integrity failure';end if;
  select * into strict v_rules from private.room_selection_rules where room_id=v_room.id;
  if v_room.candidate_progression_status in('collecting','agreed') then
    return query select 'assigned',v_room.candidate_sequence,v_room.candidate_progression_status,v_room.tmdb_movie_id,
      null::smallint,null::smallint,null::jsonb,null::jsonb,null::text,null::text,null::bigint,null::numeric,
      v_rules.metadata_language,null::text;return;
  elsif v_room.candidate_progression_status='exhausted' then
    return query select 'exhausted',v_room.candidate_sequence,v_room.candidate_progression_status,null::bigint,
      null::smallint,null::smallint,null::jsonb,null::jsonb,null::text,null::text,null::bigint,null::numeric,null::text,null::text;return;
  elsif v_room.candidate_progression_status='inactive' and v_room.candidate_acquisition_status='no_candidates' then
    return query select 'no_candidates',0,v_room.candidate_progression_status,null::bigint,null::smallint,null::smallint,
      null::jsonb,null::jsonb,null::text,null::text,null::bigint,null::numeric,null::text,null::text;return;
  end if;
  if not((v_room.candidate_progression_status='inactive' and v_room.candidate_sequence=0
      and v_room.candidate_acquisition_status='pending') or
    (v_room.candidate_progression_status='advancing' and v_room.candidate_sequence>0
      and v_room.candidate_acquisition_status='pending' and exists(select 1 from public.room_candidate_occurrences o
        where o.room_id=v_room.id and o.sequence=v_room.candidate_sequence and o.status='rejected')))
    or v_room.state<>'ready' or v_room.voter_count<>v_room.required_voter_count
    or v_room.filter_completed_count<>v_room.required_voter_count
    or v_room.filter_resolution_status<>'compatible' or not private.valid_tmdb_candidate_handoff(v_room.id) then
    return query select 'not_ready',null::integer,null::public.candidate_progression_status,null::bigint,null::smallint,
      null::smallint,null::jsonb,null::jsonb,null::text,null::text,null::bigint,null::numeric,null::text,null::text;return;
  end if;
  select * into strict v_parent from private.room_filter_resolutions where room_id=v_room.id;
  select coalesce(jsonb_agg(to_jsonb(q.ids) order by q.clause_ordinal),'[]'::jsonb) into v_clauses
    from(select c.clause_ordinal,array_agg(m.tmdb_genre_id order by m.tmdb_genre_id) ids
      from private.room_filter_resolution_genre_clauses c cross join unnest(c.genres) g
      join private.tmdb_movie_genres m on m.participant_genre=g where c.room_id=v_room.id group by c.clause_ordinal)q;
  select coalesce(jsonb_agg(o.tmdb_movie_id order by o.sequence),'[]'::jsonb) into v_excluded
    from public.room_candidate_occurrences o where o.room_id=v_room.id;
  return query select 'acquire',v_room.candidate_sequence,v_room.candidate_progression_status,null::bigint,
    v_parent.release_year_from,v_parent.release_year_to,v_clauses,v_excluded,v_rules.rule_set_kind,
    v_rules.candidate_ordering,v_rules.minimum_vote_count,v_rules.minimum_average_rating,v_rules.metadata_language,
    v_rules.genre_mode;
end;$f$;
alter function public.prepare_room_tmdb_candidate(uuid,uuid) owner to postgres;
revoke all on function public.prepare_room_tmdb_candidate(uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_room_tmdb_candidate(uuid,uuid) to service_role;

-- Candidate commit remains the locked Feature 008 CAS and validates transient metrics
-- only when the retained snapshot consumes them.
drop function public.commit_room_tmdb_candidate(uuid,uuid,integer,bigint,smallint,integer[],boolean);
create function public.commit_room_tmdb_candidate(p_room_id uuid,p_actor_user_id uuid,
  p_expected_candidate_sequence integer,p_tmdb_movie_id bigint,p_release_year smallint,
  p_tmdb_genre_ids integer[],p_adult boolean,p_vote_count bigint,p_vote_average numeric)
returns table(outcome text,candidate_sequence integer,candidate_progression_status public.candidate_progression_status,tmdb_movie_id bigint)
language plpgsql security definer set search_path='' as $f$
declare v_room public.rooms%rowtype;v_parent private.room_filter_resolutions%rowtype;v_rules private.room_selection_rules%rowtype;v_next integer;
begin
  if p_room_id is null or p_actor_user_id is null or p_expected_candidate_sequence is null or p_expected_candidate_sequence<0
    then raise exception using errcode='22023',message='Invalid candidate request';end if;
  perform 1 from public.room_members m join public.rooms r on r.id=m.room_id where r.id=p_room_id
    and m.user_id=p_actor_user_id and(m.is_voter or r.creator_user_id=p_actor_user_id);
  if not found then return query select 'not_found',null::integer,null::public.candidate_progression_status,null::bigint;return;end if;
  select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id
    where r.id=p_room_id and m.user_id=p_actor_user_id and(m.is_voter or r.creator_user_id=p_actor_user_id) for update of r;
  if not found then return query select 'not_found',null::integer,null::public.candidate_progression_status,null::bigint;return;end if;
  if not private.room_selection_rules_coherent(v_room.id) then
    raise exception using errcode='P0001',message='Room selection rule integrity failure';end if;
  select * into strict v_rules from private.room_selection_rules where room_id=v_room.id;
  if v_room.candidate_sequence=p_expected_candidate_sequence+1 and v_room.candidate_progression_status in('collecting','agreed') then
    return query select 'assigned',v_room.candidate_sequence,v_room.candidate_progression_status,v_room.tmdb_movie_id;return;
  elsif v_room.candidate_sequence=p_expected_candidate_sequence and v_room.candidate_progression_status='exhausted' then
    return query select 'exhausted',v_room.candidate_sequence,v_room.candidate_progression_status,null::bigint;return;
  elsif v_room.candidate_sequence=0 and p_expected_candidate_sequence=0 and v_room.candidate_progression_status='inactive'
    and v_room.candidate_acquisition_status='no_candidates' then
    return query select 'no_candidates',0,v_room.candidate_progression_status,null::bigint;return;
  elsif v_room.candidate_sequence<>p_expected_candidate_sequence or v_room.candidate_progression_status not in('inactive','advancing') then
    return query select 'refresh_required',null::integer,null::public.candidate_progression_status,null::bigint;return;
  end if;
  if not((v_room.candidate_progression_status='inactive' and v_room.candidate_sequence=0) or
    (v_room.candidate_progression_status='advancing' and exists(select 1 from public.room_candidate_occurrences o
      where o.room_id=v_room.id and o.sequence=v_room.candidate_sequence and o.status='rejected')))
    or v_room.candidate_acquisition_status<>'pending' or v_room.state<>'ready'
    or v_room.voter_count<>v_room.required_voter_count or v_room.filter_completed_count<>v_room.required_voter_count
    or v_room.filter_resolution_status<>'compatible' or not private.valid_tmdb_candidate_handoff(v_room.id) then
    return query select 'not_ready',null::integer,null::public.candidate_progression_status,null::bigint;return;end if;
  if p_tmdb_movie_id is null or p_tmdb_movie_id<=0 or p_release_year is null or p_tmdb_genre_ids is null
    or p_adult is distinct from false or(cardinality(p_tmdb_genre_ids)>0 and array_ndims(p_tmdb_genre_ids)<>1)
    or array_position(p_tmdb_genre_ids,null::integer) is not null
    or p_tmdb_genre_ids<>(select coalesce(array_agg(distinct g order by g),'{}'::integer[]) from unnest(p_tmdb_genre_ids)g)
    or exists(select 1 from unnest(p_tmdb_genre_ids)g left join private.tmdb_movie_genres m on m.tmdb_genre_id=g
      where m.tmdb_genre_id is null) then raise exception using errcode='22023',message='Invalid candidate evidence';end if;
  if v_rules.minimum_vote_count is not null and (p_vote_count is null or p_vote_count<0) then
    raise exception using errcode='22023',message='Invalid candidate evidence';end if;
  if v_rules.minimum_average_rating is not null and
    (p_vote_average is null or p_vote_average::text in('NaN','Infinity','-Infinity') or p_vote_average<0 or p_vote_average>10) then
    raise exception using errcode='22023',message='Invalid candidate evidence';end if;
  select * into strict v_parent from private.room_filter_resolutions where room_id=v_room.id;
  if p_release_year<v_parent.release_year_from or p_release_year>v_parent.release_year_to
    or (v_rules.minimum_vote_count is not null and p_vote_count<v_rules.minimum_vote_count)
    or (v_rules.minimum_average_rating is not null and p_vote_average<v_rules.minimum_average_rating)
    or exists(select 1 from private.room_filter_resolution_genre_clauses c where c.room_id=v_room.id
      and not p_tmdb_genre_ids&&array(select m.tmdb_genre_id from unnest(c.genres)g join private.tmdb_movie_genres m
        on m.participant_genre=g order by m.tmdb_genre_id))
    or exists(select 1 from public.room_candidate_occurrences o where o.room_id=v_room.id and o.tmdb_movie_id=p_tmdb_movie_id)
    then raise exception using errcode='22023',message='Ineligible candidate evidence';end if;
  v_next:=p_expected_candidate_sequence+1;
  insert into public.room_candidate_occurrences(room_id,sequence,tmdb_movie_id) values(v_room.id,v_next,p_tmdb_movie_id);
  update public.rooms set candidate_progression_status='collecting',candidate_sequence=v_next,
    candidate_acquisition_status='assigned',tmdb_movie_id=p_tmdb_movie_id,decision_completed_count=0,
    updated_at=transaction_timestamp() where id=v_room.id returning * into v_room;
  return query select 'assigned',v_room.candidate_sequence,v_room.candidate_progression_status,v_room.tmdb_movie_id;
end;$f$;
alter function public.commit_room_tmdb_candidate(uuid,uuid,integer,bigint,smallint,integer[],boolean,bigint,numeric) owner to postgres;
revoke all on function public.commit_room_tmdb_candidate(uuid,uuid,integer,bigint,smallint,integer[],boolean,bigint,numeric)
  from public,anon,authenticated;
grant execute on function public.commit_room_tmdb_candidate(uuid,uuid,integer,bigint,smallint,integer[],boolean,bigint,numeric) to service_role;

drop function public.commit_room_tmdb_no_candidates(uuid,uuid,integer);
create function public.commit_room_tmdb_no_candidates(p_room_id uuid,p_actor_user_id uuid,p_expected_candidate_sequence integer)
returns table(outcome text,candidate_sequence integer,candidate_progression_status public.candidate_progression_status,tmdb_movie_id bigint)
language plpgsql security definer set search_path='' as $f$
declare v_room public.rooms%rowtype;
begin
  if p_room_id is null or p_actor_user_id is null or p_expected_candidate_sequence is null or p_expected_candidate_sequence<0
    then raise exception using errcode='22023',message='Invalid candidate request';end if;
  perform 1 from public.room_members m join public.rooms r on r.id=m.room_id where r.id=p_room_id
    and m.user_id=p_actor_user_id and(m.is_voter or r.creator_user_id=p_actor_user_id);
  if not found then return query select 'not_found',null::integer,null::public.candidate_progression_status,null::bigint;return;end if;
  select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id
    where r.id=p_room_id and m.user_id=p_actor_user_id and(m.is_voter or r.creator_user_id=p_actor_user_id) for update of r;
  if not private.room_selection_rules_coherent(v_room.id) then
    raise exception using errcode='P0001',message='Room selection rule integrity failure';end if;
  if v_room.candidate_sequence=p_expected_candidate_sequence+1 and v_room.candidate_progression_status in('collecting','agreed') then
    return query select 'assigned',v_room.candidate_sequence,v_room.candidate_progression_status,v_room.tmdb_movie_id;return;
  elsif v_room.candidate_sequence=p_expected_candidate_sequence and v_room.candidate_progression_status='exhausted' then
    return query select 'exhausted',v_room.candidate_sequence,v_room.candidate_progression_status,null::bigint;return;
  elsif v_room.candidate_sequence=0 and p_expected_candidate_sequence=0 and v_room.candidate_progression_status='inactive'
    and v_room.candidate_acquisition_status='no_candidates' then
    return query select 'no_candidates',0,v_room.candidate_progression_status,null::bigint;return;
  elsif v_room.candidate_sequence<>p_expected_candidate_sequence or v_room.candidate_progression_status not in('inactive','advancing') then
    return query select 'refresh_required',null::integer,null::public.candidate_progression_status,null::bigint;return;
  end if;
  if v_room.candidate_acquisition_status<>'pending' or v_room.state<>'ready'
    or v_room.voter_count<>v_room.required_voter_count or v_room.filter_completed_count<>v_room.required_voter_count
    or v_room.filter_resolution_status<>'compatible' or not private.valid_tmdb_candidate_handoff(v_room.id)
    or(v_room.candidate_progression_status='advancing' and not exists(select 1 from public.room_candidate_occurrences o
      where o.room_id=v_room.id and o.sequence=v_room.candidate_sequence and o.status='rejected')) then
    return query select 'not_ready',null::integer,null::public.candidate_progression_status,null::bigint;return;end if;
  update public.rooms as r set candidate_progression_status=case when r.candidate_sequence=0 then 'inactive'::public.candidate_progression_status
      else 'exhausted'::public.candidate_progression_status end,candidate_acquisition_status='no_candidates',tmdb_movie_id=null,
      decision_completed_count=0,updated_at=transaction_timestamp() where r.id=v_room.id returning r.* into v_room;
  return query select case when v_room.candidate_sequence=0 then 'no_candidates' else 'exhausted' end,
    v_room.candidate_sequence,v_room.candidate_progression_status,null::bigint;
end;$f$;
alter function public.commit_room_tmdb_no_candidates(uuid,uuid,integer) owner to postgres;
revoke all on function public.commit_room_tmdb_no_candidates(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.commit_room_tmdb_no_candidates(uuid,uuid,integer) to service_role;

-- Exact decision RPC replacements keep the nine-field Feature 008 surface.
drop function public.get_room_candidate_decision(uuid,integer,bigint);
drop function public.submit_room_candidate_decision(uuid,integer,bigint,public.candidate_decision_value);

create function public.get_room_candidate_decision(p_room_id uuid,p_expected_candidate_sequence integer,p_expected_tmdb_movie_id bigint)
returns table(outcome text,my_decision public.candidate_decision_value,candidate_sequence integer,decision_completed_count integer,
  required_voter_count integer,decision_set_complete boolean,agreement_threshold integer,
  candidate_outcome public.candidate_occurrence_status,candidate_progression_status public.candidate_progression_status)
language plpgsql security definer set search_path='' as $f$
declare v_user uuid:=auth.uid();v_room public.rooms%rowtype;v_member public.room_members%rowtype;v_occ public.room_candidate_occurrences%rowtype;
  v_count integer;v_mine public.candidate_decision_value;v_threshold integer;
begin
  if v_user is null then raise exception using errcode='42501',message='Authentication required';end if;
  if p_room_id is null or p_expected_candidate_sequence is null or p_expected_candidate_sequence<=0
    or p_expected_tmdb_movie_id is null or p_expected_tmdb_movie_id<=0 then raise exception using errcode='22023',message='Invalid decision target';end if;
  select m.* into v_member from public.room_members m join public.rooms r on r.id=m.room_id
    where r.id=p_room_id and m.user_id=v_user and(m.is_voter or r.creator_user_id=v_user);
  if not found then return query select 'not_found',null::public.candidate_decision_value,null::integer,null::integer,null::integer,null::boolean,null::integer,null::public.candidate_occurrence_status,null::public.candidate_progression_status;return;end if;
  select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id and m.id=v_member.id
    where r.id=p_room_id and m.user_id=v_user for share of r;
  if not private.room_selection_rules_coherent(v_room.id) then raise exception using errcode='P0001',message='Room decision integrity failure';end if;
  v_threshold:=private.candidate_agreement_threshold(v_room.id,v_room.required_voter_count);
  if v_room.candidate_sequence<>p_expected_candidate_sequence or v_room.candidate_progression_status not in('collecting','agreed')
    or v_room.tmdb_movie_id is distinct from p_expected_tmdb_movie_id then
    return query select case when v_room.candidate_sequence=0 then 'not_ready' else 'candidate_changed' end,
      null::public.candidate_decision_value,null::integer,null::integer,null::integer,null::boolean,null::integer,null::public.candidate_occurrence_status,null::public.candidate_progression_status;return;end if;
  select o.* into strict v_occ from public.room_candidate_occurrences o where o.room_id=v_room.id and o.sequence=v_room.candidate_sequence and o.tmdb_movie_id=v_room.tmdb_movie_id;
  select count(*)::integer into v_count from public.candidate_decisions d join public.room_members m on(m.room_id,m.id)=(d.room_id,d.room_member_id)
    where d.room_id=v_room.id and d.candidate_occurrence_id=v_occ.id and m.is_voter;
  if v_count<>v_room.decision_completed_count or v_room.voter_count<>v_room.required_voter_count
    or(v_room.candidate_progression_status='collecting' and v_occ.status<>'collecting')
    or(v_room.candidate_progression_status='agreed' and(v_occ.status<>'agreed' or v_count<>v_room.required_voter_count)) then
    raise exception using errcode='P0001',message='Room decision integrity failure';end if;
  if v_member.is_voter then select d.decision into v_mine from public.candidate_decisions d where d.room_member_id=v_member.id and d.candidate_occurrence_id=v_occ.id;end if;
  return query select case when not v_member.is_voter then 'observer' when v_mine is null then 'not_decided' else 'decided' end,
    v_mine,v_occ.sequence,v_count,v_room.required_voter_count,v_occ.status<>'collecting',v_threshold,v_occ.status,v_room.candidate_progression_status;
end;$f$;
alter function public.get_room_candidate_decision(uuid,integer,bigint) owner to postgres;
revoke all on function public.get_room_candidate_decision(uuid,integer,bigint) from public,anon,authenticated;
grant execute on function public.get_room_candidate_decision(uuid,integer,bigint) to authenticated;

create function public.submit_room_candidate_decision(p_room_id uuid,p_expected_candidate_sequence integer,p_expected_tmdb_movie_id bigint,p_decision public.candidate_decision_value)
returns table(outcome text,my_decision public.candidate_decision_value,candidate_sequence integer,decision_completed_count integer,
  required_voter_count integer,decision_set_complete boolean,agreement_threshold integer,
  candidate_outcome public.candidate_occurrence_status,candidate_progression_status public.candidate_progression_status)
language plpgsql security definer set search_path='' as $f$
declare v_user uuid:=auth.uid();v_room public.rooms%rowtype;v_member public.room_members%rowtype;v_occ public.room_candidate_occurrences%rowtype;
  v_count integer;v_yes integer;v_stored public.candidate_decision_value;v_result text;v_candidate_outcome public.candidate_occurrence_status;v_threshold integer;
begin
  if v_user is null then raise exception using errcode='42501',message='Authentication required';end if;
  if p_room_id is null or p_expected_candidate_sequence is null or p_expected_candidate_sequence<=0 or p_expected_tmdb_movie_id is null or p_expected_tmdb_movie_id<=0 or p_decision is null then raise exception using errcode='22023',message='Invalid decision submission';end if;
  select m.* into v_member from public.room_members m join public.rooms r on r.id=m.room_id where r.id=p_room_id and m.user_id=v_user and(m.is_voter or r.creator_user_id=v_user);
  if not found then return query select 'not_found',null::public.candidate_decision_value,null::integer,null::integer,null::integer,null::boolean,null::integer,null::public.candidate_occurrence_status,null::public.candidate_progression_status;return;end if;
  select r.* into v_room from public.rooms r join public.room_members m on m.room_id=r.id and m.id=v_member.id where r.id=p_room_id and m.user_id=v_user for update of r;
  if not private.room_selection_rules_coherent(v_room.id) then raise exception using errcode='P0001',message='Room decision integrity failure';end if;
  v_threshold:=private.candidate_agreement_threshold(v_room.id,v_room.required_voter_count);
  if v_room.candidate_sequence<>p_expected_candidate_sequence or v_room.candidate_progression_status not in('collecting','agreed') or v_room.tmdb_movie_id is distinct from p_expected_tmdb_movie_id then
    return query select case when v_room.candidate_sequence=0 then 'not_ready' else 'candidate_changed' end,null::public.candidate_decision_value,null::integer,null::integer,null::integer,null::boolean,null::integer,null::public.candidate_occurrence_status,null::public.candidate_progression_status;return;end if;
  select o.* into strict v_occ from public.room_candidate_occurrences o where o.room_id=v_room.id and o.sequence=v_room.candidate_sequence and o.tmdb_movie_id=v_room.tmdb_movie_id;
  select count(*)::integer,count(*) filter(where d.decision='yes')::integer into v_count,v_yes from public.candidate_decisions d join public.room_members m on(m.room_id,m.id)=(d.room_id,d.room_member_id) where d.room_id=v_room.id and d.candidate_occurrence_id=v_occ.id and m.is_voter;
  if v_count<>v_room.decision_completed_count or v_room.voter_count<>v_room.required_voter_count or(v_room.candidate_progression_status='collecting' and v_occ.status<>'collecting') or(v_room.candidate_progression_status='agreed' and(v_occ.status<>'agreed' or v_count<>v_room.required_voter_count)) then raise exception using errcode='P0001',message='Room decision integrity failure';end if;
  if not v_member.is_voter then return query select 'not_voter',null::public.candidate_decision_value,v_occ.sequence,v_count,v_room.required_voter_count,v_occ.status<>'collecting',v_threshold,v_occ.status,v_room.candidate_progression_status;return;end if;
  select d.decision into v_stored from public.candidate_decisions d where d.room_member_id=v_member.id and d.candidate_occurrence_id=v_occ.id;
  if found then v_result:=case when v_stored=p_decision then 'unchanged' else 'conflict' end;return query select v_result,v_stored,v_occ.sequence,v_count,v_room.required_voter_count,v_occ.status<>'collecting',v_threshold,v_occ.status,v_room.candidate_progression_status;return;end if;
  if v_room.candidate_progression_status<>'collecting' then raise exception using errcode='P0001',message='Room decision integrity failure';end if;
  insert into public.candidate_decisions(room_id,room_member_id,candidate_occurrence_id,decision) values(v_room.id,v_member.id,v_occ.id,p_decision) returning decision into v_stored;
  v_count:=v_count+1;if v_stored='yes' then v_yes:=v_yes+1;end if;
  if v_count<v_room.required_voter_count then update public.rooms set decision_completed_count=v_count,updated_at=transaction_timestamp() where id=v_room.id returning * into v_room;v_candidate_outcome:='collecting';
  elsif v_count=v_room.required_voter_count then
    if v_yes>=v_threshold then update public.room_candidate_occurrences set status='agreed',resolved_at=transaction_timestamp() where id=v_occ.id;update public.rooms set candidate_progression_status='agreed',decision_completed_count=v_count,updated_at=transaction_timestamp() where id=v_room.id returning * into v_room;v_candidate_outcome:='agreed';
    else update public.room_candidate_occurrences set status='rejected',resolved_at=transaction_timestamp() where id=v_occ.id;update public.rooms set candidate_progression_status='advancing',candidate_acquisition_status='pending',tmdb_movie_id=null,decision_completed_count=0,updated_at=transaction_timestamp() where id=v_room.id returning * into v_room;v_candidate_outcome:='rejected';end if;
  else raise exception using errcode='P0001',message='Room decision integrity failure';end if;
  return query select 'accepted',v_stored,v_occ.sequence,v_count,v_room.required_voter_count,v_count=v_room.required_voter_count,v_threshold,v_candidate_outcome,v_room.candidate_progression_status;
end;$f$;
alter function public.submit_room_candidate_decision(uuid,integer,bigint,public.candidate_decision_value) owner to postgres;
revoke all on function public.submit_room_candidate_decision(uuid,integer,bigint,public.candidate_decision_value) from public,anon,authenticated;
grant execute on function public.submit_room_candidate_decision(uuid,integer,bigint,public.candidate_decision_value) to authenticated;

do $verify$
begin
  if (select count(*) from public.rooms)<>(select count(*) from private.room_selection_rules)
    or exists(select 1 from public.rooms r where not private.room_selection_rules_coherent(r.id))
    or exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='private' and tablename='room_selection_rules')
    or to_regprocedure('public.create_room(uuid,integer,boolean)') is not null
    or to_regprocedure('public.create_room_with_selection_rules(uuid,uuid,integer,boolean,text,text,bigint,numeric,text,text,integer,integer)') is null then
    raise exception using errcode='P0001',message='Selection rule cutover integrity failure';end if;
end;$verify$;

notify pgrst,'reload schema';
commit;
