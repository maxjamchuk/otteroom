# Implementation Plan: 001 — MVP Mobile Core

**Branch**: `001-mvp-mobile-core` | **Date**: 2026-03-03 | **Spec**: `.specify/specs/001-mvp-mobile-core/spec.md`  
**Input**: Feature specification from `.specify/specs/001-mvp-mobile-core/spec.md`

## Summary

Implement the mobile core Otteroom flow for 2 users:
- create/join a room via QR/code
- set preferences (up to 5 genres + optional quick filters)
- server seeds a queue of 120 TMDB movie IDs
- synchronized deck voting (same current movie for both users)
- atomic match on mutual like; advance on any dislike after both voted
- persist watched/hidden without UI registration via Supabase Anonymous Auth
- realtime updates via Supabase Realtime on `rooms` + `matches`

Server authority and atomicity are enforced via Supabase Edge Functions; TMDB is accessed only via Edge Functions proxy.

## Technical Context

**Language/Version**:
- Mobile: TypeScript (React Native + Expo)
- Server logic: TypeScript (Supabase Edge Functions running on Deno)

**Primary Dependencies**:
- Mobile: Expo, expo-router, Zustand, supabase-js, expo-camera, react-native-deck-swiper, i18n library (e.g., i18next)
- Server: Supabase Edge Functions, Supabase Postgres/Realtime

**Storage**:
- Supabase Postgres (source of truth)
- Realtime subscriptions (Supabase Realtime)

**Testing**:
- Mobile: Jest + React Native Testing Library (smoke tests for key screens / state flows)
- Edge Functions: Deno test runner (unit tests for vote idempotency, match creation rules)
- Optional (later): Supabase local integration tests (seed → vote → match end-to-end)

**Target Platform**:
- iOS + Android (Expo-managed)
- (Web display is out of scope for this feature; planned for Release-2)

**Project Type**:
- Mobile app + backendless Supabase project (DB + functions)

**Performance Goals**:
- Room create/join < 30s for 2 devices
- First synchronized card appears within ~5s after both set preferences (network dependent)
- Smooth swipe UX (~60fps target)

**Constraints**:
- No FastAPI (Supabase only)
- TMDB keys/tokens never in client
- include_adult=false always
- Room content language = host language (RU/EN/DE/FR/ES/PT/TR/PL/IT; fallback EN)
- Region from device settings
- Genres <= 5
- Queue size = 120
- Server-authoritative state transitions only

**Scale/Scope**:
- MVP for 2-user rooms
- One match per room

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [PASS] Supabase-only backend; no custom API service
- [PASS] TMDB access only via Edge Functions proxy
- [PASS] Server-authoritative/atomic transitions for vote/advance/match
- [PASS] Synchronized deck via `rooms.current_movie_id` + `current_idx`
- [PASS] i18n support for RU/EN/DE/FR/ES/PT/TR/PL/IT
- [PASS] Room language = host language; region = device
- [PASS] Anonymous auth; watched/hidden persisted server-side
- [PASS] Display clients read-only (not in this feature)

## Project Structure

### Documentation (this feature)

.specify/specs/001-mvp-mobile-core/
├── spec.md              # Feature specification (done)
├── plan.md              # This file
├── research.md          # Phase 0 output (TMDB params, supabase constraints, rate/limits notes)
├── data-model.md        # Phase 1 output (tables, indices, RLS approach)
├── quickstart.md        # Phase 1 output (local dev setup)
├── contracts/
│   ├── edge-functions.md # HTTP contracts for Edge Functions (request/response JSON)
│   └── realtime.md       # Realtime contract: what clients subscribe to and how to interpret states
└── tasks.md             # Phase 2 output (/speckit.tasks) - created next

### Source Code (repository root)

apps/
└── mobile/
    ├── app/                 # expo-router routes
    ├── src/
    │   ├── components/
    │   ├── screens/          # if not using route-collocation
    │   ├── stores/           # Zustand stores (auth, room, voting)
    │   ├── services/         # supabase client, edge function client
    │   ├── i18n/             # dictionaries + init
    │   └── utils/
    ├── assets/
    └── package.json

supabase/
├── functions/
│   ├── create-room/
│   ├── join-room/
│   ├── set-preferences/
│   ├── seed-queue/
│   └── vote/
├── migrations/
└── seed.sql (optional)

**Structure Decision**:

* Monorepo with `apps/mobile` for the Expo app and `supabase/` for database migrations and Edge Functions.
* This keeps SDD docs co-located and enables Release-2/3 to add `apps/display` later without refactor.

## Phase 0 — Research (deliverables: research.md)

1. TMDB usage decisions to validate and document:

* endpoint choices for:

  * genre list (dynamic genre IDs)
  * discover movies for seeding
  * movie details for card rendering (poster/title/overview/runtime/etc.)
* localization parameters (language) and region handling
* minimum anti-noise filter strategy (vote_count threshold baseline)
* fallback strategy when discover yields insufficient candidates

2. Supabase decisions to validate and document:

* recommended RLS approach for MVP (client reads vs edge-only writes)
* Realtime subscriptions best practice for `rooms` + `matches`
* local dev workflow (Supabase CLI start + migrations)

## Phase 1 — Design (deliverables: data-model.md, contracts/*, quickstart.md)

### Data model

Define tables and constraints for:

* rooms, room_members, room_movies, votes, matches, watched_movies
  Key constraints:
* unique match per room (matches.room_id PK)
* unique vote per (room_id, movie_id, user_id)
* deterministic deck order (room_movies unique (room_id, idx))
* room language/region stored at creation

### Contracts

Write explicit request/response contracts for Edge Functions:

* POST create-room → {room_id, code, language, region}
* POST join-room → {room_id}
* POST set-preferences → {room_id, status}
* POST seed-queue → {room_id, status, current_movie_id}
* POST vote → {room_status, current_movie_id, current_idx, match?}

Write realtime contract:

* clients subscribe to rooms by room_id:

  * authoritative fields: status, current_movie_id, current_idx
* clients subscribe to matches by room_id:

  * match is terminal for MVP

### Quickstart

Document local setup:

* node + package manager (pnpm/npm)
* Supabase CLI workflow (`supabase start`, apply migrations, function env)
* running Expo app and pointing to Supabase URL/anon key

## Phase 2 — Build (output: tasks.md, then implementation)

* Implement Supabase migrations (tables, indices, RLS baseline)
* Implement Edge Functions (create/join/preferences/seed/vote)

  * enforce atomicity/idempotency
  * enforce include_adult=false
  * enforce room language and region
  * exclude watched/hidden in seeding
* Implement mobile app screens:

  * anonymous auth bootstrap
  * create/join room (QR + code)
  * preferences (up to 5 genres; genre list fetched server-side or cached)
  * voting deck synced by room state
  * match screen + watched/hidden
* Integrate Realtime subscriptions and reconnect handling
* Add minimal tests:

  * vote idempotency and match uniqueness (Edge)
  * screen smoke tests (Mobile)