---
description: "Task list for 001-mvp-mobile-core implementation"
---

# Tasks: 001 — MVP Mobile Core

**Input**: Design documents from `.specify/specs/001-mvp-mobile-core/`  
**Prerequisites**: `spec.md` (done), `plan.md` (done).  
**Note**: Tests are included as minimal smoke/unit tests (as per plan); expand later if needed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no direct dependency)
- **[Story]**: US1..US4
- All file paths are relative to repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create repository layout per plan and bootstrap tooling.

- [ ] T001 Create directories per plan:
  - `apps/mobile/`
  - `supabase/functions/`
  - `supabase/migrations/`
- [ ] T002 Add root `.gitignore` entries for Expo + Supabase + env files.
- [ ] T003 [P] Add `apps/mobile/README.md` (how to run the mobile app locally).
- [ ] T004 [P] Add `supabase/README.md` (how to run migrations/functions locally).
- [ ] T005 Add `.env.example` (root or `apps/mobile/.env.example`) with placeholders:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] T006 [P] Add `supabase/.env.example` for Edge Functions secrets placeholders:
  - `TMDB_API_TOKEN`
  - (optional) `TMDB_API_KEY` if you choose v3 key style later

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Supabase local workflow + DB schema + baseline contracts.  
**CRITICAL**: Do not start US1..US4 implementation until this phase is done.

### 2A — Documentation deliverables (required by plan)

- [ ] T010 Write `.specify/specs/001-mvp-mobile-core/research.md`:
  - TMDB endpoints you will use (genre list, discover, movie details)
  - localization parameters and fallback strategy
  - region handling
  - baseline anti-noise filters (vote_count threshold)
  - fallback strategy if fewer than 120 candidates
- [ ] T011 Write `.specify/specs/001-mvp-mobile-core/data-model.md`:
  - final table schemas + keys + indices
  - RLS strategy (edge-only writes; client reads scoped by membership)
- [ ] T012 Write `.specify/specs/001-mvp-mobile-core/contracts/edge-functions.md`:
  - request/response JSON for:
    - create-room
    - join-room
    - set-preferences
    - seed-queue
    - vote
- [ ] T013 Write `.specify/specs/001-mvp-mobile-core/contracts/realtime.md`:
  - what mobile subscribes to (rooms + matches)
  - authoritative fields and interpretation (status/current_movie_id/current_idx)
- [ ] T014 Write `.specify/specs/001-mvp-mobile-core/quickstart.md`:
  - local supabase start
  - applying migrations
  - running edge functions
  - running expo app

### 2B — Supabase CLI & local dev baseline

- [ ] T020 Initialize Supabase CLI project in `supabase/` (if not already):
  - config files
  - local start scripts documented in quickstart
- [ ] T021 [P] Configure function secrets workflow (local + prod):
  - where `TMDB_API_TOKEN` is stored locally
  - where it lives in GitHub Secrets for deploy

### 2C — Database schema & migrations (blocking)

- [ ] T030 Create migration `supabase/migrations/001_create_core_tables.sql` with:
  - `rooms`
  - `room_members`
  - `room_movies`
  - `votes`
  - `matches`
  - `watched_movies`
- [ ] T031 Add constraints/indexes in same migration:
  - `rooms.code` unique
  - `matches.room_id` PK (one match per room in MVP)
  - `votes` unique (room_id, movie_id, user_id)
  - `room_movies` unique (room_id, idx)
- [ ] T032 Add required columns to `rooms` in migration:
  - `language` (host language; fallback EN)
  - `region` (device region; nullable)
  - `max_members` default 2
  - `current_idx`, `current_movie_id`
  - `status` (lobby/voting/matched/closed)
- [ ] T033 Enable RLS on core tables and add baseline policies (MVP-safe):
  - users can read room state only if they are members
  - users can insert themselves into `room_members` only via Edge (preferred)
  - watched_movies readable/writable only for own user_id
  - votes writable only via Edge (preferred)
  *Note*: Keep write operations Edge-only where possible to reduce policy surface.
- [ ] T034 Validate migrations locally (`supabase start` + apply migrations).
- [ ] T035 [P] Add `supabase/seed.sql` optional (dev convenience):
  - NOT mandatory; can be empty placeholder.

**Checkpoint**: Foundation ready — user story work may begin.

---

## Phase 3: User Story 1 — Create room & Join via QR/code (Priority: P1) 🎯

**Goal**: Two phones can enter the same room quickly with QR/code.

**Independent Test**: Host creates room, guest joins it (2 participants visible).

### Edge Functions (US1)

- [ ] T100 [US1] Implement `supabase/functions/create-room/index.ts`:
  - generate `code`
  - derive host language + region from request payload
  - create room row + host membership (role=host)
  - return `{room_id, code, language, region}`
- [ ] T101 [US1] Implement `supabase/functions/join-room/index.ts`:
  - accept `{code}`
  - enforce `max_members=2`
  - insert membership (role=member)
  - return `{room_id}`

### Mobile (US1)

- [ ] T110 [P] [US1] Bootstrap Expo app in `apps/mobile/` (TypeScript).
- [ ] T111 [P] [US1] Setup `expo-router` routes skeleton in `apps/mobile/app/`.
- [ ] T112 [P] [US1] Add `apps/mobile/src/services/supabase.ts`:
  - create supabase client using `EXPO_PUBLIC_*` env vars
- [ ] T113 [US1] Add Anonymous Auth bootstrap:
  - `apps/mobile/src/stores/auth.store.ts`
  - ensure session exists on app start
- [ ] T114 [US1] Create Home screen route:
  - Create Room / Join Room actions
- [ ] T115 [US1] Create Room screen:
  - calls `create-room` edge function
  - displays QR + code + shareable URL `otteroom.app/r/<code>`
- [ ] T116 [US1] Join Room screen:
  - input code + QR scan (expo-camera)
  - calls `join-room` edge function
- [ ] T117 [US1] Room state subscription (basic):
  - subscribe to `rooms` by room_id
  - show “waiting for guest” / “2 participants joined”

### Minimal Tests (US1)

- [ ] T120 [US1] Add smoke test for navigation + create/join flows:
  - `apps/mobile/src/__tests__/us1.create-join.test.tsx` (basic render + mocks)

**Checkpoint**: US1 demoable end-to-end (room created, join works).

---

## Phase 4: User Story 2 — Set preferences & seed synchronized deck (Priority: P1) 🎯

**Goal**: Both participants submit preferences; server seeds queue of 120 movies and sets first current_movie_id.

**Independent Test**: Both users see the same first movie card after preferences submitted.

### Edge Functions (US2)

- [ ] T200 [US2] Implement `supabase/functions/set-preferences/index.ts`:
  - upsert preferences for (room_id, user_id)
  - if both participants have preferences -> trigger seed (call internal seed function)
- [ ] T201 [US2] Implement `supabase/functions/seed-queue/index.ts`:
  - read room language/region
  - read both participants preferences (up to 5 genres each)
  - call TMDB discover via server token
  - enforce `include_adult=false`
  - build candidate list, de-duplicate, fill to 120 or apply softening strategy
  - exclude watched/hidden movies for both participants
  - write `room_movies` with idx 0..119
  - set `rooms.status='voting'`, `current_idx=0`, `current_movie_id=first`
- [ ] T202 [P] [US2] Implement TMDB client helper in `supabase/functions/_shared/tmdb.ts`:
  - request wrapper, language/region params, error handling
  - (optional) simple cache stub (later)

### Mobile (US2)

- [ ] T210 [US2] Implement Preferences screen:
  - fetch genre list (via Edge or TMDB proxy) and render selectable tags
  - enforce max 5 selected
  - optional filters (runtime bucket, years window, sort mode)
  - submit preferences -> call `set-preferences`
- [ ] T211 [US2] Realtime handling:
  - when room status becomes `voting` and `current_movie_id` set -> navigate to Voting screen
- [ ] T212 [US2] Implement “loading / waiting for other user” states.

### Minimal Tests (US2)

- [ ] T220 [US2] Edge function unit test for seeding count and invariants:
  - `supabase/functions/seed-queue/seed-queue.test.ts` (Deno)
  - assert: 120 queue items OR documented fallback behavior
  - assert: include_adult enforced in request builder
  - assert: language fallback to EN logic

**Checkpoint**: US2 demoable (preferences -> seed -> first card synced).

---

## Phase 5: User Story 3 — Vote on synced cards & produce match (Priority: P1) 🎯

**Goal**: Server-authoritative voting; mutual like creates match exactly once; any dislike advances after both voted.

**Independent Test**: Two phones swipe on same movie; match created once or next card advanced.

### Edge Functions (US3)

- [ ] T300 [US3] Implement `supabase/functions/vote/index.ts`:
  - upsert vote (room_id, movie_id=current_movie_id, user_id)
  - atomic transaction:
    - if already matched -> return match
    - count likes/dislikes for current_movie_id
    - if both voted:
      - if both like -> create match (one per room) and set room status matched
      - else -> advance to next card (current_idx++, current_movie_id = room_movies[idx])
      - if no more cards -> status closed (or documented fallback)
  - return updated room state + match if created
- [ ] T301 [US3] Add idempotency protections:
  - ensure retries don’t duplicate match
  - ensure retries don’t advance more than once
  - prefer DB constraints + transaction checks

### Mobile (US3)

- [ ] T310 [US3] Implement Voting screen with deck UI:
  - show poster/title/year/runtime/rating/tags
  - swipe left/right -> call `vote`
  - block input while vote in flight (avoid multi-send)
- [ ] T311 [US3] Subscribe to room updates:
  - when `current_movie_id` changes -> update card
  - when status becomes `matched` -> navigate to Match screen
- [ ] T312 [US3] Progress indicator:
  - minimal: show “waiting for other vote”
  - (optional) display count “1/2 voted” (requires server to expose per-card vote state; otherwise keep minimal)

### Minimal Tests (US3)

- [ ] T320 [US3] Edge unit tests for vote transaction:
  - mutual like -> single match
  - dislike -> advance exactly once after both voted
  - retry same vote -> no duplicate/advance
- [ ] T321 [US3] Mobile smoke test for Voting screen render (mock room state).

**Checkpoint**: US3 demoable as full core experience.

---

## Phase 6: User Story 4 — Mark watched/hidden without registration (Priority: P2)

**Goal**: Users can mark matched movie as watched/hidden; future seeds exclude these items per user.

**Independent Test**: Mark hidden; next seed doesn’t include that movie for the same user.

### Edge/DB (US4)

- [ ] T400 [US4] Add Edge function (or extend existing) to upsert watched/hidden:
  - Option A: new `supabase/functions/mark-movie/index.ts`
  - Option B: extend `vote` response flow to allow marking from Match screen via RPC
  - Return updated watched status
- [ ] T401 [US4] Ensure RLS for `watched_movies` allows only owner read/write (or edge-only write).

### Mobile (US4)

- [ ] T410 [US4] Add actions on Match screen:
  - “Mark watched”
  - “Hide”
  - call edge function to upsert `watched_movies`
- [ ] T411 [US4] Ensure next room seed respects watched/hidden for the user (server-side already).

### Minimal Tests (US4)

- [ ] T420 [US4] Edge test: after marking hidden, seed excludes that movie_id for that user.

**Checkpoint**: US4 demoable (persistence works without signup).

---

## Phase 7: Cross-Cutting Polish (MVP completion)

**Purpose**: Tighten UX + ensure i18n + env + release sanity.

- [ ] T500 [P] Add i18n scaffolding in `apps/mobile/src/i18n/`:
  - dictionaries for RU/EN/DE/FR/ES/PT/TR/PL/IT (minimal keys)
  - init + `t()` helper
- [ ] T501 Ensure all UI strings use i18n keys (no hardcoded strings).
- [ ] T502 Add “room language = host language” behavior:
  - host sends device language at create_room
  - server stores `rooms.language`
  - seed uses `rooms.language` for TMDB calls
- [ ] T503 Add device region capture on room creation (host) and persist to `rooms.region`.
- [ ] T504 Add minimal error UX:
  - join room full
  - tmdb fetch failure
  - seed failure
  - reconnect state
- [ ] T505 Add minimal “deadlock” fallback message if queue ends:
  - room status closed -> show message “No more options, adjust filters”
- [ ] T506 Validate `quickstart.md` steps on a clean machine/session.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 are blocking.
- Phase 2 (DB + contracts) blocks all user stories.
- US1 (create/join) is the first independently demoable slice.
- US2 depends on US1 (room exists).
- US3 depends on US2 (deck exists).
- US4 depends on US3 (match exists) and seed exclusion behavior.

Parallel opportunities:
- After Phase 2: mobile UI tasks and edge function tasks can proceed in parallel where marked [P].
- i18n scaffolding can be parallelized early but should be applied before “polish complete”.

---

## Implementation Strategy

1) Complete Phase 1–2 (foundation).
2) Implement US1 → demo create/join.
3) Implement US2 → demo seeded first synced card.
4) Implement US3 → demo full match flow.
5) Implement US4 → demo persistence (watched/hidden).
6) Cross-cutting polish + validate quickstart.