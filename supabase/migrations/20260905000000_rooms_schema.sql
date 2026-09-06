-- Publish the schema and its read boundary together, never an exposed interim table.
begin;

create extension if not exists pgcrypto with schema extensions;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

create table public.rooms (
  id uuid not null default extensions.gen_random_uuid(),
  code text not null,
  creation_request_id uuid not null,
  host_user_id uuid not null,
  guest_user_id uuid,
  state text generated always as (
    case when guest_user_id is null then 'waiting'::text else 'ready'::text end
  ) stored not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),

  constraint rooms_pkey primary key (id),
  constraint rooms_code_key unique (code),
  constraint rooms_host_creation_request_key unique (host_user_id, creation_request_id),
  constraint rooms_code_format_check check (code ~ '^[0-9A-F]{10}$'),
  constraint rooms_distinct_participants_check
    check (guest_user_id is null or guest_user_id <> host_user_id),
  constraint rooms_host_user_id_fkey foreign key (host_user_id)
    references auth.users (id) on update no action on delete restrict,
  constraint rooms_guest_user_id_fkey foreign key (guest_user_id)
    references auth.users (id) on update no action on delete restrict
);

-- The host-leading unique index already supports the host membership predicate.
create index rooms_guest_user_id_idx on public.rooms using btree (guest_user_id)
  where guest_user_id is not null;

revoke all privileges on table public.rooms from public, anon, authenticated;
alter table public.rooms enable row level security;
grant select (id, code, state) on public.rooms to authenticated;

create policy rooms_select_member on public.rooms
  for select to authenticated
  using ((select auth.uid()) = host_user_id or (select auth.uid()) = guest_user_id);

-- Client writes remain denied; the two authorized mutation RPCs are a later phase.
commit;
