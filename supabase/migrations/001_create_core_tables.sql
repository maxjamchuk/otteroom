-- Extensions (uuid)
create extension if not exists "pgcrypto";

-- ROOMS
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'lobby', -- lobby | voting | matched | closed
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),

  language text not null default 'en',
  region text null,

  max_members int not null default 2,

  current_idx int not null default 0,
  current_movie_id int null,

  settings jsonb not null default '{}'::jsonb
);

-- ROOM MEMBERS
create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member', -- host | member | (later) display
  joined_at timestamptz not null default now(),
  is_active boolean not null default true,
  preferences jsonb not null default '{}'::jsonb,
  primary key (room_id, user_id)
);

create index if not exists idx_room_members_room on public.room_members(room_id);
create index if not exists idx_room_members_user on public.room_members(user_id);

-- ROOM MOVIES (QUEUE)
create table if not exists public.room_movies (
  room_id uuid not null references public.rooms(id) on delete cascade,
  movie_id int not null,
  idx int not null,
  primary key (room_id, movie_id),
  unique (room_id, idx)
);

create index if not exists idx_room_movies_room_idx on public.room_movies(room_id, idx);

-- VOTES
create table if not exists public.votes (
  room_id uuid not null references public.rooms(id) on delete cascade,
  movie_id int not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (room_id, movie_id, user_id)
);

create index if not exists idx_votes_room_movie on public.votes(room_id, movie_id);

-- MATCHES (one per room in MVP)
create table if not exists public.matches (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  movie_id int not null,
  created_at timestamptz not null default now()
);

-- WATCHED/HIDDEN (per user)
create table if not exists public.watched_movies (
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id int not null,
  status text not null check (status in ('watched', 'hidden')),
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

create index if not exists idx_watched_movies_user on public.watched_movies(user_id);

-- RLS
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_movies enable row level security;
alter table public.votes enable row level security;
alter table public.matches enable row level security;
alter table public.watched_movies enable row level security;

-- RLS POLICIES (MVP SAFE)

-- rooms: members can select their rooms
create policy "rooms_select_for_members"
on public.rooms for select
using (
  exists (
    select 1 from public.room_members rm
    where rm.room_id = rooms.id and rm.user_id = auth.uid()
  )
);

-- room_members: members can select membership rows for their room
create policy "room_members_select_for_members"
on public.room_members for select
using (
  exists (
    select 1 from public.room_members rm
    where rm.room_id = room_members.room_id and rm.user_id = auth.uid()
  )
);

-- matches: members can select match for their room
create policy "matches_select_for_members"
on public.matches for select
using (
  exists (
    select 1 from public.room_members rm
    where rm.room_id = matches.room_id and rm.user_id = auth.uid()
  )
);

-- watched_movies: owner can read/write own rows (if you later decide edge-only writes, remove insert/update)
create policy "watched_select_own"
on public.watched_movies for select
using (user_id = auth.uid());

create policy "watched_insert_own"
on public.watched_movies for insert
with check (user_id = auth.uid());

create policy "watched_update_own"
on public.watched_movies for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- NOTE:
-- We intentionally do NOT allow client inserts/updates for:
-- room_members, room_movies, votes, rooms, matches
-- Edge Functions (service role) will bypass RLS for writes.