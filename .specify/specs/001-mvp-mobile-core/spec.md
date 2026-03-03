# Feature Specification: 001 — MVP Mobile Core

**Feature Branch**: `001-mvp-mobile-core`  
**Created**: 2026-03-03  
**Status**: Draft  
**Input**: User description: "Mobile-first app for picking a movie together via QR/code room, synced swipe cards, match on mutual like. No UI registration. Supabase backendless. TMDB via Edge Functions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Create room & join via QR/code (Priority: P1)

Two people can get into the same room quickly. Host creates a room and shares a QR/code. Guest joins by scanning QR or entering the code.

**Why this priority**: Without room creation/join, nothing else matters. This is the entry point to all value.

**Independent Test**: On two phones, host creates a room and guest joins the same room within 30 seconds.

**Acceptance Scenarios**:
1. **Given** user is signed in anonymously, **When** they tap Create Room, **Then** the system returns a room with a code and a QR that encodes a join URL.
2. **Given** a room exists and is not full, **When** guest scans QR or enters code, **Then** guest is added to room_members and both clients see that 2 participants are present.
3. **Given** a room is full (max_members=2), **When** a third device attempts to join, **Then** join is rejected with a user-friendly error.

---

### User Story 2 — Set preferences and start a synchronized deck (Priority: P1)

Both participants pick up to 5 genres (and optional quick filters). After both are ready, the server seeds a queue of 120 movies from TMDB, and voting starts.

**Why this priority**: This creates the actual content stream; without the deck there is nothing to vote on.

**Independent Test**: In a room with two participants, both set preferences and the first movie card becomes visible on both devices with the same movie ID.

**Acceptance Scenarios**:
1. **Given** two participants are in lobby state, **When** both submit preferences, **Then** the server seeds 120 movies and sets `current_movie_id` for the room.
2. **Given** room content language is host language, **When** queue is seeded, **Then** movie titles/overviews returned for cards are localized to the room language (fallback EN).
3. **Given** adult content must be excluded, **When** seeding from TMDB, **Then** the request enforces `include_adult=false`.

---

### User Story 3 — Vote on synced cards and produce a match (Priority: P1)

Participants vote by swiping left (dislike) or right (like) on the current movie. If both like the same movie, a match is created and the room ends. If anyone dislikes, the system advances to the next card after both voted.

**Why this priority**: This is the core “magic”: mutual like selects the film without negotiation.

**Independent Test**: In a seeded room, both users can swipe on the same card; mutual like creates exactly one match record; mismatch advances to next card.

**Acceptance Scenarios**:
1. **Given** both users see the same current_movie_id, **When** both vote like, **Then** a match is created exactly once and room status becomes matched.
2. **Given** both users see the same current_movie_id, **When** at least one votes dislike and both have voted, **Then** the server advances to the next card (current_idx++) and updates current_movie_id.
3. **Given** a user has unstable network, **When** the same vote request is retried, **Then** the result is idempotent (no duplicated votes, no duplicated match, no skipped cards).

---

### User Story 4 — Mark watched/hidden without registration (Priority: P2)

After a match, users can mark the movie as watched or hidden. This preference is stored per-user even without a registration UI and affects future queues.

**Why this priority**: Reduces repeated suggestions and builds long-term value.

**Independent Test**: A user marks a movie watched/hidden; on next room seed that movie is excluded for that user.

**Acceptance Scenarios**:
1. **Given** a match exists, **When** user marks the movie watched, **Then** watched_movies is upserted for (user_id, movie_id, watched).
2. **Given** a match exists, **When** user marks the movie hidden, **Then** watched_movies is upserted for (user_id, movie_id, hidden).
3. **Given** seeding a new room for the same user, **When** queue is generated, **Then** hidden (and optionally watched) movies are excluded for that user.

---

### Edge Cases

- What happens when TMDB returns fewer than 120 candidates for the chosen filters?
- What happens when a participant leaves mid-room (app closed) during voting?
- What happens when realtime subscription drops and reconnects (stale current_movie_id)?
- What happens if the room is created but the guest never joins (stale rooms cleanup)?
- What happens when host language is unsupported (fallback EN)?
- What happens when device region is missing/unknown?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a host to create a room and obtain a join code and QR payload.
- **FR-002**: System MUST allow a guest to join a room via QR/code if the room is not full.
- **FR-003**: System MUST support preferences including up to 5 genres per user and optional quick filters (runtime bucket, recency window, sort mode).
- **FR-004**: System MUST seed a queue of 120 movie IDs per room using TMDB via Supabase Edge Functions only.
- **FR-005**: System MUST enforce `include_adult=false` on all TMDB content queries.
- **FR-006**: System MUST keep room content language equal to host device language (supported set) with fallback to EN.
- **FR-007**: System MUST derive region from device settings.
- **FR-008**: System MUST ensure all participants see the same current_movie_id at the same time (server-authoritative room state).
- **FR-009**: System MUST implement voting as server-authoritative and atomic; match creation and deck advancement are not allowed client-side.
- **FR-010**: System MUST create at most one match per room in MVP (unique by room_id).
- **FR-011**: System MUST persist watched/hidden per user without registration UI using Supabase Anonymous Auth.
- **FR-012**: System MUST provide realtime updates for room state and match state to clients.

### Key Entities *(include if feature involves data)*

- **Room**: session container; has code, status, language, region, current_idx/current_movie_id, settings.
- **RoomMember**: participant membership + role + preferences.
- **RoomMovie**: seeded queue item (movie_id, idx).
- **Vote**: user’s vote for a movie in a room (like/dislike), idempotent.
- **Match**: selected movie for the room (single record in MVP).
- **WatchedMovie**: per-user exclusion list entries (watched/hidden).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Two users can create and join the same room in under 30 seconds.
- **SC-002**: After both submit preferences, the first synchronized card appears on both devices within 5 seconds (excluding TMDB/network variability).
- **SC-003**: Mutual like creates a match exactly once; no duplicated match records across retries.
- **SC-004**: 90%+ of test sessions reach a match within 30 swipes (baseline target; tune via seeding strategy).