# 001 MVP — Data Model

## Tables (MVP)

### rooms
- id (uuid PK)
- code (text UNIQUE) — short join code
- status (text) — lobby | voting | matched | closed
- created_by (uuid) — auth.users.id
- created_at (timestamptz)
- language (text) — room content language; host device language; fallback EN
- region (text, nullable) — host device region
- max_members (int) — default 2
- current_idx (int) — default 0
- current_movie_id (int, nullable)
- settings (jsonb) — optional filters (runtime bucket, years window, sort mode)

### room_members
- room_id (uuid FK rooms.id)
- user_id (uuid FK auth.users.id)
- role (text) — host | member | (later) display
- joined_at (timestamptz)
- is_active (bool)
- preferences (jsonb) — genres + optional filters per user
PK (room_id, user_id)

### room_movies
- room_id (uuid FK)
- movie_id (int)
- idx (int)
PK (room_id, movie_id)
UNIQUE (room_id, idx)

### votes
- room_id (uuid)
- movie_id (int)
- user_id (uuid)
- vote (smallint) — -1/1
- created_at (timestamptz)
PK (room_id, movie_id, user_id)

### matches
- room_id (uuid PK) — single match per room in MVP
- movie_id (int)
- created_at (timestamptz)

### watched_movies
- user_id (uuid)
- movie_id (int)
- status (text) — watched | hidden
- created_at (timestamptz)
PK (user_id, movie_id)

---

## Constraints & Indexes
- rooms.code UNIQUE
- matches.room_id PK
- votes PK ensures idempotent upsert per user/movie/room
- room_movies UNIQUE(room_id, idx) for deterministic deck order
- indexes:
  - room_members(room_id), room_members(user_id)
  - room_movies(room_id, idx)
  - votes(room_id, movie_id)
  - watched_movies(user_id)

---

## RLS Strategy (MVP-safe)

### Reads allowed to clients (scoped)
- rooms: SELECT if exists room_members(room_id, auth.uid())
- matches: SELECT if exists room_members(room_id, auth.uid())
- watched_movies: SELECT/UPSERT only where user_id = auth.uid()

### Writes (recommended Edge-only)
To reduce policy complexity, keep INSERT/UPDATE/DELETE for:
- rooms, room_members, room_movies, votes, matches
as Edge Functions only (using service role).

watched_movies can be:
- client-writable with strict owner-only policies, or
- edge-writable only (simpler and consistent)

---

## Atomicity for voting
Supabase JS does not provide multi-statement transactions across multiple requests reliably.
To guarantee atomic match/advance and retry safety:
- implement an RPC (Postgres function) for casting a vote and advancing the room atomically, OR
- implement all vote logic in a single server-side DB function called from Edge.

MVP recommendation:
- Use a SECURITY DEFINER Postgres function `otter_cast_vote(...)` with one transaction.