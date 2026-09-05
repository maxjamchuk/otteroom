# Feature Specification: Create and Join a Two-Person Room

**Feature Branch**: `main` (no feature branch created)

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "Enable a host and guest to establish the same private,
two-person room and observe that it is ready for the next stage."

## Scope

### Goals

- Let a host create a room without creating a permanent account and receive both
  human-enterable and shareable invitation information.
- Let one guest join the same room through either invitation method.
- Make Waiting and Ready membership state visible and consistent to both
  participants without manual refresh.
- Enforce exactly two distinct active participants, including during concurrent
  attempts to occupy the final seat.
- Let an existing local participant session re-enter without duplicating its
  membership.
- Preserve authoritative membership and room isolation when an operation fails
  or a participant supplies invalid or unrelated invitation information.

### Terminology

- **Room** is the shared authoritative room state, distinct from any local state
  held by a participant.
- **Participant** is a person acting through a local participant session.
- **Local participant session** is the continuity boundary for this slice.
  Repeated joins and reconnects from the same local session represent the same
  participant; a different local session represents a distinct participant for
  room-capacity purposes.
- **Active participant** is a local participant session that holds a room seat.
  Temporary connection loss does not remove that membership or free its seat.
  Leaving, replacement, expiration, and cross-device identity are outside this
  feature.

### Non-Goals

This feature explicitly excludes:

- movie catalogue integration, movie candidate generation, and TMDB or any
  other external movie source;
- participant preferences, genres, filters, queues, swiping, voting, matches,
  watched or hidden movies, and viewing history;
- QR code generation and camera scanning;
- permanent account registration and cross-device identity recovery;
- room expiration, cleanup, host transfer, participant removal, and leaving and
  replacing a participant;
- rooms with more than two participants;
- localization scope and selection of mobile, web, desktop, or TV platforms;
- offline operation, push notifications, chat, profiles, social features,
  analytics, moderation, administration, and administrative tooling; and
- any behavior after the room reaches Ready, including movie selection.

### Release Boundary

This slice begins when a participant asks to create or join a room and ends when
the authoritative room state is either Waiting, Ready, or a clear non-mutating
failure result. Reaching Ready MUST NOT initiate any later product behavior.
Room expiration and cleanup are outside this release boundary.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Host Creates a Room (Priority: P1)

As a host, I create a new room without registering a permanent account so that I
can invite one other person and see that the room is waiting for them.

**Why this priority**: A room and its invitation information are the prerequisite
for every other outcome in this slice.

**Independent Test**: Create a room from a new local participant session and
verify that the host receives a room code, an invitation link, one occupied seat,
and the Waiting state.

**Acceptance Scenarios**:

1. **Given** a participant who has not created a permanent account, **When** the
   participant successfully creates a room, **Then** the participant becomes the
   host, occupies one seat, receives a human-enterable room code and a shareable
   invitation link for that same room, and sees the Waiting state.
2. **Given** a new local participant session, **When** room creation fails before
   acceptance, **Then** the participant receives a clear failure result and no
   room or invitation information is presented as usable.

---

### User Story 2 - Guest Joins the Room (Priority: P1)

As a guest, I join a host's room using either invitation method so that both of
us can see that the shared room is ready for the next stage.

**Why this priority**: A successful two-person join produces the primary
observable value of this vertical slice.

**Independent Test**: Starting with a given Waiting room, join once by invitation
link and once in a separate test by manual code; verify identical membership and
Ready outcomes for both participants.

**Acceptance Scenarios**:

3. **Given** a valid invitation link for a Waiting room, **When** a distinct guest
   opens the link and joins, **Then** the guest occupies the second seat and the
   room becomes Ready.
4. **Given** a valid room code for a Waiting room, **When** a distinct guest enters
   the code and joins, **Then** the guest occupies the second seat and the room
   reaches the same Ready membership state as the invitation-link flow.
5. **Given** a host observing a Waiting room and a guest completing a successful
   join, **When** the authoritative membership reaches two participants, **Then**
   both participants see two occupied seats and Ready without manually
   refreshing, and no post-Ready product behavior begins.
6. **Given** a room code or well-formed invitation link that identifies no
   existing room, **When** a guest tries to join with it, **Then** the guest
   receives a clear invalid-room result and no room membership changes.
7. **Given** malformed invitation information, **When** a guest tries to use it,
   **Then** the guest receives a clear malformed-invitation result and no room
   membership changes.
8. **Given** a Waiting room whose membership has not changed, **When** a guest's
   join operation fails before acceptance, **Then** the guest receives a clear
   failure result and the room remains in exactly its previous Waiting state.

---

### User Story 3 - Room Capacity Is Enforced (Priority: P1)

As either participant in a Ready room, I rely on the room remaining limited to
the two accepted participants so that its membership is private and predictable.

**Why this priority**: The two-person capacity is a defining invariant and must
hold even when join attempts overlap.

**Independent Test**: Starting with a full room and with a one-seat-open room,
exercise sequential and concurrent third-party joins and verify that membership
never exceeds two distinct participants.

**Acceptance Scenarios**:

9. **Given** a Ready room with two distinct active participants, **When** a third
   distinct participant attempts to join, **Then** that participant receives a
   clear room-full result and the existing membership and Ready state remain
   unchanged.
10. **Given** a Waiting room with one available seat, **When** two distinct guests
   attempt to claim that final seat concurrently, **Then** exactly one guest is
   accepted, the other receives a room-full result, and the room contains exactly
   two distinct active participants in Ready.
11. **Given** two unrelated rooms and a participant authorized only for one of
    them, **When** the participant manipulates unrelated local room state or tries
    to observe the other room without its valid invitation information, **Then**
    the other room's private membership state is neither disclosed nor changed.
12. **Given** a room with authoritative membership, **When** a participant uses
    manipulated local state to occupy another seat, add a participant directly,
    or change another participant's membership, **Then** the attempt is rejected,
    membership and room stage remain unchanged, and capacity is not exceeded.

---

### User Story 4 - Existing Participant Reconnects (Priority: P2)

As an accepted host or guest, I can return from a temporary connection loss so
that I recover the current room state without taking another seat.

**Why this priority**: Re-entry is necessary for continuity but follows the core
creation, join, and capacity outcomes.

**Independent Test**: Starting with an accepted participant session, repeat its
join and reconnect after a simulated temporary connection loss; verify that the
same membership is recovered and no duplicate appears.

**Acceptance Scenarios**:

13. **Given** a participant session that already occupies a room seat, **When**
    that same session repeats its join request, **Then** it recovers its existing
    membership and current room state without creating a duplicate participant
    or consuming another seat.
14. **Given** an accepted participant session that temporarily loses connection,
    **When** the same local session reconnects to the active room, **Then** it
    recovers the authoritative Waiting or Ready state and its single existing
    membership without manual reconstruction.

### Edge Cases

- A participant submits invitation information containing accidental surrounding
  whitespace or capitalization differences; the result is deterministic and
  does not target an unintended room, while the exact normalization rules remain
  a later contract decision.
- An invitation identifies a room that becomes full between the participant
  starting and completing the join; the participant receives room-full and the
  accepted membership remains unchanged.
- An existing participant repeats a join while another participant is attempting
  to occupy the final seat; the repeat remains the existing membership and does
  not compete for or consume that seat.
- A participant reconnects after the room changes from Waiting to Ready; the
  participant observes the current Ready state rather than stale Waiting state.
- A creation attempt fails before completion; no incomplete room or invitation
  information is presented as usable.
- Multiple duplicate join attempts from the same local participant session arrive
  concurrently; together they still represent exactly one membership.
- A participant supplies valid invitation information for one room while holding
  unrelated local state from another; only the room identified by the validated
  invitation can be joined or observed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a participant to create a new room without
  creating a permanent account.
- **FR-002**: A successful creation MUST assign the creator as host, occupy
  exactly one room seat, and place the room in Waiting.
- **FR-003**: A successful creation MUST provide the host with a human-enterable
  room code and a shareable invitation link that identify the same room.
- **FR-004**: The host MUST be able to distinguish Waiting from Ready and see the
  number of occupied participant seats.
- **FR-005**: A distinct guest with a valid invitation link for a Waiting room
  MUST be able to join that room without creating a permanent account.
- **FR-006**: A distinct guest with a valid room code for a Waiting room MUST be
  able to join that room under the same membership rules as the link flow.
- **FR-007**: A room MUST contain no more than two distinct active participants
  under every sequential and concurrent execution path.
- **FR-008**: Waiting MUST mean exactly one participant currently occupies the
  room, and Ready MUST mean both participant seats are occupied.
- **FR-009**: When distinct participants concurrently attempt to occupy the final
  seat, the outcome MUST accept exactly one and reject every other attempt as
  room-full without exceeding two memberships.
- **FR-010**: A join attempt by a third distinct participant against a Ready room
  MUST return a clear room-full result and MUST NOT change existing membership.
- **FR-011**: Repeating a join from a local participant session that already
  occupies a seat MUST return its existing membership and MUST NOT create a
  duplicate or consume another seat.
- **FR-012**: After a temporary connection loss, the same local participant
  session MUST be able to recover its existing membership and the current
  authoritative room state.
- **FR-013**: After a successful second-participant join, both accepted
  participants MUST observe two occupied seats and Ready without manual refresh.
- **FR-014**: Both accepted participants MUST converge on the same authoritative
  membership and room stage after creation, join, repeat join, and reconnect.
- **FR-015**: A join attempt using a room code or well-formed invitation link that
  identifies no existing room MUST return a clear invalid-room result and MUST
  NOT create or alter membership.
- **FR-016**: Malformed invitation information MUST return a clear
  malformed-invitation result and MUST NOT create or alter membership.
- **FR-017**: Any unsuccessful join MUST leave the room's previous authoritative
  stage and membership unchanged.
- **FR-018**: A participant MUST NOT be able to occupy more than one seat in the
  same room, add another participant directly, or alter another participant's
  membership.
- **FR-019**: Manipulating unrelated local room state MUST NOT grant membership in
  or access to a room not identified by valid invitation information.
- **FR-020**: Private membership state for one room MUST NOT be disclosed to or
  changed by participants of an unrelated room.
- **FR-021**: The feature MUST stop at Ready and MUST NOT initiate movie selection
  or any later product behavior.
- **FR-022**: An unsuccessful room creation MUST return a clear failure result and
  MUST NOT present a partially created room or invitation information as usable.

### Non-Functional Requirements

- **NFR-001**: Capacity, membership uniqueness, room isolation, and non-mutating
  failure behavior MUST hold under sequential, repeated, and concurrent attempts.
- **NFR-002**: Under normal network connectivity, every successful final-seat join
  MUST produce the same Ready state for both accepted participant sessions
  without manual refresh or another user action.
- **NFR-003**: Waiting, Ready, invalid-room, malformed-invitation, room-full, and
  unsuccessful-join outcomes MUST be distinguishable to the affected participant
  without exposing another room's private state.
- **NFR-004**: Re-entry by the same local participant session MUST preserve
  continuity without requiring permanent identity or cross-device recovery.

### Key Entities

- **Room**: The shared two-person session, characterized by its invitation
  information, current user-visible stage, and occupied participant seats.
- **Participant Session**: A locally recognizable participant identity for this
  slice. It may be a host or guest and does not imply a permanent account or
  cross-device identity.
- **Room Membership**: The unique relationship between one participant session
  and one occupied seat in a room. A room has at most two distinct active
  memberships.
- **Invitation Information**: The human-enterable room code and shareable link
  that both identify the same room without defining their format.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of normal-connectivity end-to-end acceptance runs, a host
  and guest establish the same Ready room from new local sessions through each
  supported invitation flow without permanent account creation.
- **SC-002**: In 100% of successful final-seat join acceptance runs, both accepted
  participants display two occupied seats and Ready without manual refresh or
  another user action.
- **SC-003**: In 100% of capacity acceptance scenarios, including concurrent
  attempts, observed room membership never exceeds two distinct active
  participants.
- **SC-004**: In every controlled concurrent final-seat trial, exactly one new
  participant is accepted, every other distinct participant receives room-full,
  and the resulting room is Ready with exactly two memberships.
- **SC-005**: In 100% of repeated-join and reconnect acceptance scenarios, an
  already accepted local participant session has exactly one membership after
  recovery.
- **SC-006**: In 100% of invalid, malformed, room-full, and otherwise failed join
  scenarios, the room's prior authoritative membership and stage remain
  unchanged.
- **SC-007**: In 100% of isolation acceptance scenarios, a participant receives
  no private membership state from an unrelated room and causes no change to it.
- **SC-008**: In every outcome-comprehension acceptance check, the affected
  participant can distinguish Waiting, Ready, invalid-room,
  malformed-invitation, room-full, and unsuccessful-operation results without
  implementation knowledge or assistance.

## Assumptions

- The two intended participants deliberately use invitation information for the
  same room.
- Each participant has a separate local client session.
- Normal network connectivity is available for creation, joining, and state
  convergence.
- The same local participant session can be recognized during reconnect.
- Permanent identity is not required for this slice.
- The exact room-code format, invitation URL structure, identity representation,
  persistence method, concurrency mechanism, and state-distribution mechanism
  will be selected during planning and contract work without changing the
  observable requirements in this specification.

## Dependencies

- A guest needs invitation information intentionally shared by the host.
- Acceptance validation needs two separate local participant sessions and the
  ability to overlap final-seat join attempts.
- Platform and technical execution decisions are deferred to planning; this
  specification has no dependency on a selected implementation technology.

## Unresolved Decisions

None at the product-specification level. Technical choices deferred to planning
and contracts are not unresolved product behavior.
