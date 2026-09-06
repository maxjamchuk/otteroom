begin;

create function public.create_room(p_creation_request_id uuid)
returns table (
  outcome text, room_id uuid, room_code text, room_state text,
  participant_role text, participant_count smallint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_code text;
  v_constraint text;
  v_outcome text := 'already_created';
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_creation_request_id is null then
    raise exception using errcode = '22004', message = 'Creation request required';
  end if;

  select r.* into v_room from public.rooms as r
    where r.host_user_id = v_user_id and r.creation_request_id = p_creation_request_id;
  if not found then
    for v_attempt in 1..5 loop
      v_code := pg_catalog.upper(pg_catalog.encode(extensions.gen_random_bytes(5), 'hex'));
      begin
        insert into public.rooms as r (code, creation_request_id, host_user_id)
          values (v_code, p_creation_request_id, v_user_id) returning r.* into v_room;
        v_outcome := 'created';
        exit;
      exception when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'rooms_host_creation_request_key' then
          -- READ COMMITTED gets the committed winner after the unique-index wait.
          select r.* into v_room from public.rooms as r
            where r.host_user_id = v_user_id and r.creation_request_id = p_creation_request_id;
          if not found then raise; end if;
          exit;
        elsif v_constraint = 'rooms_code_key' then
          -- A concurrent logical winner outranks another random-code attempt.
          select r.* into v_room from public.rooms as r
            where r.host_user_id = v_user_id and r.creation_request_id = p_creation_request_id;
          if found then exit; end if;
          if v_attempt = 5 then
            raise exception using errcode = 'P0001', message = 'Room code allocation exhausted';
          end if;
        else
          raise;
        end if;
      end;
    end loop;
  end if;

  return query select v_outcome, v_room.id, v_room.code, v_room.state, 'host'::text,
    (case when v_room.guest_user_id is null then 1 else 2 end)::smallint;
end;
$function$;

alter function public.create_room(uuid) owner to postgres;
revoke all on function public.create_room(uuid) from public, anon, authenticated;
grant execute on function public.create_room(uuid) to authenticated;

create function public.join_room(p_room_code text)
returns table (
  outcome text, room_id uuid, room_code text, room_state text,
  participant_role text, participant_count smallint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_room public.rooms%rowtype;
  v_outcome text;
  v_role text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  v_code := pg_catalog.upper(pg_catalog.btrim(p_room_code));
  if v_code is null or v_code !~ '^[0-9A-F]{10}$' then
    return query select 'invalid_code'::text, null::uuid, null::text, null::text, null::text, null::smallint;
    return;
  end if;

  select r.* into v_room from public.rooms as r where r.code = v_code for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text, null::text, null::smallint;
    return;
  end if;
  if v_room.host_user_id = v_user_id then
    v_outcome := 'already_member'; v_role := 'host';
  elsif v_room.guest_user_id = v_user_id then
    v_outcome := 'already_member'; v_role := 'guest';
  elsif v_room.guest_user_id is null then
    update public.rooms as r set guest_user_id = v_user_id,
      updated_at = pg_catalog.transaction_timestamp() where r.id = v_room.id returning r.* into v_room;
    v_outcome := 'joined'; v_role := 'guest';
  else
    return query select 'full'::text, null::uuid, null::text, null::text, null::text, null::smallint;
    return;
  end if;
  return query select v_outcome, v_room.id, v_room.code, v_room.state, v_role,
    (case when v_room.guest_user_id is null then 1 else 2 end)::smallint;
end;
$function$;

alter function public.join_room(text) owner to postgres;
revoke all on function public.join_room(text) from public, anon, authenticated;
grant execute on function public.join_room(text) to authenticated;

commit;
