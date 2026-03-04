# 001 MVP — Research

## Goals
Document the concrete external/internal choices required to implement MVP without guessing:
- TMDB endpoints and parameters we will rely on
- localization & region behavior
- anti-noise filters
- fallback strategy when we can’t fill 120 movies
- Supabase/RLS approach & Realtime subscription contract assumptions

---

## TMDB API usage

> We use TMDB only via Supabase Edge Functions. No keys/tokens in clients.

### Endpoints (v3-style; verify exact routes/params in current TMDB docs)
- Genre list (dynamic IDs):
  - `GET /genre/movie/list?language=<lang>`
- Discover movies (seed queue):
  - `GET /discover/movie?...`
- Movie details for cards:
  - `GET /movie/{movie_id}?language=<lang>`
  - (optional) `append_to_response=images,videos` later
- Movie images (poster paths):
  - Use base image URL + `poster_path` (no direct API call needed for basic posters)

### Localization
- `language` parameter MUST be `rooms.language` (host language).
- If room language is unsupported -> store EN at room creation (fallback).
- If a specific movie has no localized overview/title -> show original title and empty/short overview.

### Region
- `rooms.region` is derived from host device region and stored at room creation.
- For MVP, region may be used lightly (e.g., future watch providers). If TMDB endpoint ignores it, that’s OK.
- Do not block if region is absent; proceed without it.

### Adult content
- Always enforce `include_adult=false` in discovery/queries.

### Genres logic (intersection + softening)
- Users can select up to 5 genres.
- Baseline seeding:
  - Prefer intersection-first approach:
    - `intersection_genres = common(guest.genres, host.genres)`
    - If intersection is non-empty: use that as primary.
    - If empty: use union with softening rules (see fallback).
- Note: TMDB supports AND/OR semantics via delimiter patterns in `with_genres` depending on API.
  - MVP strategy: intersection -> strict; fallback -> union.

### Anti-noise filters (baseline)
Use a minimal threshold to avoid junk:
- `vote_count.gte` baseline: 200 (tune later)
- Sort mode:
  - default `popularity.desc`
  - optional `vote_average.desc` with `vote_count.gte` guard

### Queue size = 120
We seed 120 movie IDs per room.

#### Fallback strategy (must not produce empty experience)
If we cannot collect 120 unique candidates:
1) Reduce `vote_count.gte` stepwise (e.g., 200 -> 100 -> 50)
2) Expand year window if set (e.g., last 5 years -> 10 -> any)
3) Relax genre strictness:
   - intersection -> union
4) Increase pages fetched (pagination)
If still insufficient:
- Seed as many as available (>= 30 target), and mark room as `voting`.
- If < 30 total candidates, return an actionable message:
  - “Not enough movies. Try fewer genres or broaden filters.”

---

## Supabase approach

### RLS philosophy (MVP-safe)
- Prefer “edge-only writes” for:
  - rooms
  - room_members
  - room_movies
  - votes
  - matches
- Allow client reads scoped by membership:
  - rooms: members can SELECT their room
  - matches: members can SELECT match for their room
- watched_movies: user can SELECT/UPSERT their own rows (or edge-only write; either is acceptable)

### Realtime
- Mobile subscribes to:
  - `rooms` filtered by `room_id` (status/current_movie_id/current_idx)
  - `matches` filtered by `room_id` (terminal state)
- Realtime reconnect:
  - on reconnect, client should re-fetch current room state (single SELECT) to avoid stale UI.

---

## Notes / Open tuning knobs
- vote_count threshold (start at 200)
- default sort mode (start popularity)
- how strictly to exclude `watched` vs `hidden`:
  - MVP recommendation:
    - always exclude `hidden`
    - exclude `watched` only if user opts in later (MVP-2)