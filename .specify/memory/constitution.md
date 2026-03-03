# Otteroom Constitution

## Core Principles

### I. Server-Authoritative Room State (NON-NEGOTIABLE)
All business-critical state transitions MUST be executed server-side and atomically via Supabase Edge Functions:
- seeding the movie queue
- writing votes
- advancing to the next card
- creating a match
Clients must never compute a match or advance the queue locally.

### II. Supabase-Only Backend (No FastAPI)
For MVP and releases 1–3, Otteroom uses Supabase only:
- Postgres as the source of truth
- Realtime subscriptions for updates
- Edge Functions for all server logic
No separate FastAPI (or any other custom backend service) is allowed.

### III. TMDB Access via Server Proxy Only
TMDB is the content source, but:
- TMDB API keys and any TMDB user access tokens MUST never ship to clients.
- All TMDB calls are performed only via Supabase Edge Functions (proxy).
- Adult content is always disabled (include_adult=false).

### IV. Synchronized Deck
All participants in a room must see the same `current_movie_id` at the same time.
A room has a single authoritative deck order and pointer:
- `current_idx`
- `current_movie_id`
These are written only by server logic.

### V. Localization & Region Rules
UI localization targets (required): RU, EN, DE, FR, ES, PT, TR, PL, IT.
- UI language follows the device locale (fallback EN).
- Room content language (movie title/overview) = host device language (fallback EN).
- Region follows device settings.

### VI. Preferences & Queue Constraints
- Users can choose up to 5 genres.
- Queue size per room is 120 movies.
- If candidates are insufficient, the system applies a controlled softening strategy (never producing an empty experience without a user-visible prompt).

### VII. Identity Without UI Registration
- MVP uses Supabase Anonymous Auth (no registration UI).
- User persistence features (watched/hidden) must work without signup.
- Future identity upgrades may link identities without losing data.

### VIII. Display Clients Are Read-Only
Release-2/3 introduces “display clients” (web/TV):
- They do not vote.
- They only subscribe to room state and match state.
- They may show QR/code and current card, but must not mutate core room state.

## Architecture Constraints

### Data Model (Minimum Required Tables)
The system must support (at minimum):
- rooms
- room_members
- room_movies
- votes
- matches
- watched_movies
- (later) tmdb_links

### Security
- Supabase Service Role key must never be shipped to clients.
- Any TMDB tokens must be stored server-side with client read access denied (RLS/edge-only access).
- Realtime channels must be scoped by room membership and not leak room state publicly.

### Observability (Minimum)
- Client crash reporting is required for public releases (Sentry or equivalent).
- Server functions must log request IDs and key state transitions.

## Development Workflow

### Spec-Driven Development
- Specifications live in this repository under `.specify/`.
- Each stage/feature is developed as: spec → plan → tasks → implement.
- The constitution supersedes all specs, plans, and tasks.

### Releases (Fixed Roadmap)
- Stage 0: MVP (Mobile Core)
- Stage 1: Release-1 (Stability + Store)
- Stage 2: Release-2 (Big Screen Web Display)
- Stage 3: Release-3 (TV apps: Tizen/webOS packaging of Web Display)

## Governance
- Constitution is the top-level authority. If a spec/plan/task conflicts with this document, the spec/plan/task must be amended.
- Any amendment must include:
  - rationale
  - impacted stages/specs
  - migration plan (if applicable)

**Version**: 1.0.0 | **Ratified**: 2026-03-03 | **Last Amended**: 2026-03-03