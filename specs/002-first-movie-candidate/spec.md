# Feature Specification: Show the First Shared Movie Candidate

**Feature Branch**: `main` (existing branch)

**Feature Number**: 002

**Feature Slug**: `first-movie-candidate`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "When a two-person room becomes Ready, show both
participants one authoritative movie candidate from a fixed supplied catalog,
with the same title, release year, and poster; preserve it across concurrent
access, repeated access, reload, reconnect, and safe recovery from loading failure."

## Scope

### Goals

- Give both participants in a Ready room the same movie to look at, without
  requiring either participant to select it.
- Show a complete title, release year, and poster from the fixed supplied catalog.
- Establish one authoritative room candidate and preserve it throughout this
  feature, including concurrent access and recovery.
- Preserve the existing room experience, membership, and privacy while adding
  the first movie-related result after Ready.

### Terminology

- **Room**: The existing two-participant shared room from Feature 001.
- **Ready room**: A room in which both participant seats are occupied, as already
  defined by Feature 001.
- **Movie candidate**: One movie record eligible to be shown by this feature,
  with a stable identity, non-empty display title, release year, and poster
  suitable for display. Candidate identity is a system concept that distinguishes
  movie records; it is not required or permitted as user-facing movie data.
- **Room candidate**: The single authoritative assignment of one movie candidate
  to exactly one Ready room, shared by that room's host and guest. Otteroom owns
  this assignment; neither participant independently decides which movie it is.
  Separate rooms may be assigned the same movie candidate, but each room has its
  own assignment.
- **Fixed catalog**: The approved, non-empty collection of movie candidates
  supplied with the application/project for this feature.

### Non-Goals

This feature explicitly excludes:

- TMDB, any external movie API, external movie metadata lookup, external
  recommendation services, remote movie synchronization, and large movie catalog
  ingestion;
- a candidate queue/deck, more than one candidate per room, next/previous movie,
  candidate replacement, skip, and shuffle;
- swipe gestures, like/dislike, voting, and match detection;
- personalization, preferences, genres/filters, recommendation/ranking
  algorithms, popularity or genre balancing, and requirements for randomization
  or deterministic selection;
- watched/hidden/history, movie search, and a movie detail page;
- runtime, rating, synopsis, cast/crew, and streaming-provider data;
- localization expansion and permanent accounts;
- participant removal/replacement and room expiration/cleanup;
- analytics, notifications, and administration; and
- production deployment changes.

### Release Boundary

This slice preserves the existing Waiting experience and adds its movie-related
behavior only once the room is Ready. Its successful result is one room candidate
visible to both participants, with continuity through repeated access, reload,
reconnect, and retry. An unsuccessful load leaves the room Ready, preserves
membership, and offers recovery without conflicting candidates. There is no
progression to another movie or further movie interaction in this release.

Feature 001's completed scope ends at Ready. Feature 002 adds the behavior after
that boundary; it does not redefine room capacity, host/guest membership,
invitation behavior, existing participant identity semantics, Waiting/Ready
definitions, or reconnect semantics. Those remain existing prerequisites from
[Feature 001](../001-room-session/spec.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ready Room Receives a Shared Movie Candidate (Priority: P1)

As a participant in a Ready room, I see the movie selected for our room so that
both of us can look at the same movie.

**Why this priority**: Seeing one shared movie is the first movie-related value
Otteroom provides and the complete initial result of this slice.

**Independent Test**: Start with an existing Waiting room, let a guest join using
the existing room behavior, and observe both participants. Verify that no movie
appears while Waiting and that both automatically see one identical catalog
candidate, including title, release year, and poster, after Ready. Repeat with
overlapping first access, unrelated rooms, and candidate-loading failure to
verify the same result and its safety boundaries.

**Acceptance Scenarios**:

1. **Given** a host in an existing Waiting room, **When** the host views the room
   or attempts to obtain its movie candidate before the guest joins, **Then** no
   authoritative room candidate exists, none is displayed or made available,
   the existing Waiting experience continues, and nothing implies that movie
   selection has begun.
2. **Given** an existing Waiting room with a host, **When** a guest joins and the
   room becomes Ready under the existing membership behavior, **Then** the guest
   eventually sees one room candidate with a non-empty title, release year, and
   visible poster, without manually selecting a movie or refreshing the page.
3. **Given** the original host is viewing the room when the guest joins,
   **When** the room becomes Ready and its candidate becomes available, **Then**
   the host eventually sees the same room candidate as the guest, without manual
   movie selection or page refresh.
4. **Given** a Ready room whose candidate is visible to both participants,
   **When** their movie information is compared with the approved catalog,
   **Then** both identify the same movie candidate and show identical title,
   release year, and poster image, with no internal candidate identifier displayed
   as movie information. A poster reference or missing-image indication without
   the image does not satisfy the visible-poster result.
5. **Given** a room has just become Ready and neither participant has obtained
   its first candidate, **When** host and guest first attempt to obtain it
   concurrently, **Then** exactly one room candidate becomes authoritative, both
   eventually receive that same candidate and its movie information, and there
   is no intermediate accepted state with two authoritative assignments, even
   before either participant sees the movie. Neither participant is presented
   with a conflicting authoritative candidate at any point.
6. **Given** two unrelated Ready rooms with separate participants and room
   candidates, **When** a participant from either room tries to obtain the other
   room's candidate assignment using its identifiers, **Then** no private
   assignment from the other room is disclosed, each participant's displayed
   candidate belongs to their own room, and neither assignment is changed.
   Repeat for initial, concurrent, and repeated access, reload, reconnect, and
   retry: neither movie information nor failure messages may reveal which
   candidate identity, title, release year, or poster is assigned to the other
   room.
7. **Given** a Ready room with no authoritative room candidate yet, **When** an
   attempt to establish its candidate fails before any assignment is established,
   **Then** the affected participant sees a recoverable generic candidate-loading
   failure with a way to retry, the room remains Ready with membership unchanged
   and zero authoritative candidates, and no incomplete or conflicting candidate
   is presented as a valid result.
8. **Given** the fixed catalog supplied with the project and no access to
   external movie services or movie-provider credentials, **When** the catalog
   is checked for eligibility and both participants obtain a Ready room's
   candidate, **Then** every selectable record has a stable identity and complete
   title, release year, and poster, and both participants see the same eligible
   movie from that catalog without any external movie metadata request.

---

### User Story 2 - Shared Candidate Remains Stable (Priority: P1)

As an existing room participant, I can reload or reconnect and still see the same
movie candidate so that temporary connection changes do not change our choice.

**Why this priority**: A shared movie is reliable only if both participants can
return to it and retry loading without changing the room's choice.

**Independent Test**: Start with an existing Ready room and an established room
candidate. Reload the host and guest separately, interrupt and restore each
participant's connection, and repeat candidate reads. Verify the same candidate
identity, title, release year, and poster after every recovery. Separately retry
failed initial loading, including when only one participant has already seen the
candidate or neither has seen an established assignment. Verify convergence
without another assignment and recovery of a poster image that failed to display.

**Acceptance Scenarios**:

9. **Given** a Ready room whose candidate is visible to both participants,
   **When** the host reloads the page in the existing participant session,
   **Then** the host recovers the same candidate identity, title, release year,
   and poster as before, agrees with the guest, and retains existing membership.
10. **Given** a Ready room whose candidate is visible to both participants,
    **When** the guest reloads the page in the existing participant session,
    **Then** the guest recovers the same candidate identity, title, release year,
    and poster as before, agrees with the host, and retains existing membership.
11. **Given** an existing participant has seen the room candidate, **When** that
    participant temporarily loses connection and reconnects in the same session,
    **Then** the same candidate and movie information are recovered and existing
    membership remains unchanged; this holds for host and guest separately.
12. **Given** a Ready room with an established room candidate, **When** host and
    guest repeatedly obtain it, including overlapping repeat attempts, **Then**
    every successful read returns the same candidate identity, title, release
    year, and poster, and no different room candidate is established.
13. **Given** initial candidate assignment failed and the Ready room still has no
    authoritative room candidate, **When** loading becomes possible and both
    participants retry, including concurrent retries, **Then** exactly one room
    candidate becomes authoritative and both see that candidate with matching
    movie information, without changing Ready or membership.
14. **Given** the guest sees the room candidate but the host receives a
    candidate-loading failure, **When** the host retries and loading succeeds,
    **Then** the host sees the guest's existing candidate and identical movie
    information, with no replacement or additional room candidate; the same
    outcome holds when the host sees the candidate first and the guest retries.
15. **Given** the host loses connection while Waiting and the guest subsequently
    joins and sees a candidate after Ready, **When** the original host reconnects
    in the existing session, **Then** the host sees the same room candidate and
    movie information as the guest, with existing membership unchanged.
16. **Given** a room candidate became authoritative but loading failed before
    either participant could see it, **When** both participants retry after the
    failure clears, including concurrent retries, **Then** both receive that
    previously established candidate identity, title, release year, and poster,
    with no second assignment or change to Ready or membership. The absence of
    an earlier visible movie does not permit a new choice.
17. **Given** a Ready room with an established candidate whose title and release
    year are available but whose poster image cannot currently be displayed,
    **When** a participant views the candidate and then retries after the image
    becomes displayable, **Then** the failed display is identified by a generic,
    recoverable candidate-loading failure and is not presented as a valid
    complete candidate. Recovery shows the original candidate with its title,
    release year, and visible poster image, while Ready, membership, and the
    authoritative assignment remain unchanged throughout.

### Edge Cases

- First access overlaps the transition to Ready: a Waiting room has zero
  authoritative room candidates and exposes none; access once Ready converges
  on one candidate.
- Multiple initial attempts or retries overlap: they cannot establish or expose
  different authoritative candidates for the same room.
- A candidate becomes authoritative but only one participant receives it before
  a loading failure: recovery retains that assignment and the other participant
  receives the same movie.
- No complete eligible catalog candidate is available: treat this as a
  recoverable candidate-loading failure without changing Ready or membership,
  showing an incomplete movie as the successful result, or seeking an external
  movie source.
- A poster temporarily cannot be displayed: the candidate display is not a
  complete success; recovery preserves any established assignment and the
  generic candidate-loading failure behavior applies.
- A participant reconnects after the other participant first obtained the
  candidate: recover that same authoritative candidate, including when the
  disconnected participant last observed Waiting.
- Two unrelated rooms may legitimately have the same movie candidate. No
  cross-room uniqueness is required, and a shared movie does not authorize
  disclosure of either room's private assignment.
- A participant uses another room's identifiers or retains unrelated room
  information: only their own room's candidate assignment may be disclosed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A Waiting room MUST have zero authoritative room candidates. The
  system MUST NOT display or make a room candidate available. It MUST preserve
  the existing Waiting experience and give no indication that movie selection
  has begun.
- **FR-002**: The system MUST make a room candidate available only for a Ready
  room. Once a room becomes Ready, the system MUST automatically establish one
  authoritative room candidate and eventually make it available to both
  participants. With a usable supplied catalog and normal connectivity, this
  result MUST follow once any candidate-loading failure has cleared; failure
  and recovery follow FR-017 through FR-019.
- **FR-003**: A Ready room MUST have at most one authoritative room candidate.
  Once established, its candidate identity, title, release year, and poster MUST
  remain unchanged for the duration of this feature.
- **FR-004**: Every room candidate MUST come only from the approved fixed catalog
  supplied with the application/project, without dependence on external movie
  services, external metadata lookup, or movie-provider credentials or secrets.
- **FR-005**: The supplied catalog MUST be non-empty and contain enough complete
  eligible movie candidates for development and acceptance testing. Every
  selectable candidate MUST have a stable identity, non-empty display title,
  release year, and poster suitable for display.
- **FR-006**: Host and guest in the same Ready room MUST receive the same movie
  candidate with the same stable candidate identity on every successful access.
- **FR-007**: Both participants MUST see the room candidate's non-empty display
  title, matching the approved catalog and each other.
- **FR-008**: Both participants MUST see the room candidate's release year,
  matching the approved catalog and each other.
- **FR-009**: Both participants MUST see the room candidate's poster as a visible
  image, matching the approved catalog and each other. Poster information alone,
  without the image being displayed, MUST NOT count as a successful poster display.
- **FR-010**: Internal candidate identifiers MUST NOT appear as movie information
  in the participant-facing display.
- **FR-011**: Concurrent first access by host and guest MUST converge on exactly
  one authoritative room candidate when loading succeeds, without presenting
  conflicting authoritative candidates even temporarily.
- **FR-012**: Repeated candidate reads, whether sequential or overlapping, MUST
  preserve the established candidate and return the same movie information on
  every successful read.
- **FR-013**: A host reloading within the existing participant session MUST
  recover the same room candidate and movie information without changing it.
- **FR-014**: A guest reloading within the existing participant session MUST
  recover the same room candidate and movie information without changing it.
- **FR-015**: An existing participant reconnecting after temporary connection
  loss MUST recover the established room candidate and movie information without
  selecting another movie, including if the room became Ready during the loss.
- **FR-016**: The system MUST disclose a room's private candidate assignment only
  to its existing authorized participants. Knowing unrelated room identifiers
  MUST NOT grant access; a participant's displayed candidate MUST belong to that
  participant's room.
- **FR-017**: Candidate assignment or loading failure MUST leave room membership
  unchanged and the room Ready, and MUST NOT present a conflicting or incomplete
  candidate as a valid result. If no assignment has been established, the failure
  MUST leave the room without a room candidate. If an assignment has been
  established, including by a concurrent attempt, the failure MUST preserve that
  candidate and its movie information, even when neither participant has seen
  it; failure MUST NOT silently replace it.
- **FR-018**: A participant unable to load the candidate MUST receive a generic,
  recoverable candidate-loading failure and a way to retry without changing room
  membership.
- **FR-019**: Retry after candidate-loading failure, including concurrent retries
  and a failure after only one participant received the candidate, MUST preserve
  any existing assignment and MUST NOT establish a second different room
  candidate. Successful recovery MUST give both participants the same candidate
  and movie information.
- **FR-020**: Initial candidate availability and display after Ready MUST require
  no manual movie choice or page refresh from either participant; neither
  participant selects a separate candidate independently.
- **FR-021**: Candidate access, display, reload, reconnect, failure, and retry
  MUST preserve the existing room membership and participant continuity behavior
  supplied by Feature 001.

### Non-Functional Requirements

- **NFR-001 — Reproducibility**: The complete Feature 002 acceptance suite MUST
  operate using the supplied fixed catalog without access to a third-party movie
  service, a movie API credential, a movie-provider secret, or an external movie
  metadata request.
- **NFR-002 — Consistency**: Participants in one room MUST never be presented
  with conflicting authoritative candidates under initial, concurrent, repeated,
  recovery, or failure conditions.
- **NFR-003 — Security/Isolation**: The authorization boundary in FR-016 MUST
  hold across initial, concurrent, and repeated access, reload, reconnect, and
  retry, for both successful results and failure messages. Neither candidate
  identity nor title, release year, or poster information may disclose which
  movie is assigned to an unrelated room.

### Key Entities

- **Room**: The existing shared room that supplies membership and Waiting/Ready
  state. Those existing rules are prerequisites, not new definitions here.
- **Movie Candidate**: An eligible movie record from the fixed catalog, with its
  stable identity and complete title, release year, and poster.
- **Room Candidate**: The single authoritative assignment associating exactly
  one Ready room with one movie candidate. It is shared by that room's authorized
  participants and does not change once established; another room's assignment
  remains separate even if it refers to the same movie candidate.
- **Fixed Catalog**: The supplied collection of eligible movie candidates from
  which a room candidate may be chosen. Any eligible candidate is acceptable;
  this feature imposes no particular selection algorithm.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of successful Ready-room acceptance scenarios, host and
  guest identify the same room candidate from the approved fixed catalog without
  manually choosing a movie or refreshing to obtain the initial display.
- **SC-002**: In 100% of successful candidate-display acceptance checks, both
  participants see a non-empty title, release year, and visible poster image
  that agree with the catalog and each other; no internal identifier appears as
  movie information.
- **SC-003**: In 100% of host reload, guest reload, reconnect, and repeated-access
  acceptance scenarios, the candidate identity and visible movie information
  remain unchanged for the existing room.
- **SC-004**: In every concurrent initial-access or retry acceptance scenario,
  there is no accepted state with more than one authoritative room candidate,
  including before either participant sees it. Every successful flow results in
  exactly one authoritative candidate received by both participants, with zero
  conflicting candidates observed during loading or recovery.
- **SC-005**: In 100% of Waiting-room acceptance checks, zero authoritative room
  candidates exist, none is available or displayed, and the existing Waiting
  experience remains intact.
- **SC-006**: In 100% of candidate-loading failure and retry acceptance
  scenarios, the room remains Ready, membership and any established candidate
  remain unchanged, and no divergent or incomplete candidate is presented as a
  valid result. Each failed load gives the affected participant a generic failure
  with a way to retry. Successful retries establish one shared candidate if none
  existed, or recover the original assignment if already established.
- **SC-007**: In 100% of room-isolation acceptance scenarios, unrelated
  participants obtain no private assignment from another room and each
  participant's displayed candidate belongs to their own room.
- **SC-008**: The complete Feature 002 acceptance suite runs with zero external
  movie API accesses, external movie metadata requests, or movie-provider secrets,
  and all successful candidates come from the supplied fixed catalog.

## Assumptions

- Feature 001 is already working and room membership is authoritative.
- Both participants can reach Ready through the existing room behavior.
- A fixed, non-empty candidate catalog is available to this feature.
- Every candidate used for successful acceptance has complete title, release
  year, and poster data.
- Normal local network connectivity exists except where a scenario explicitly
  exercises interruption or failure.
- Reload and reconnect refer to an existing participant session within Feature
  001's established continuity boundary.

## Dependencies

- The existing two-person room, host/guest participation, invitation behavior,
  authoritative membership, shared state convergence, and reload/reconnect
  preservation from [Feature 001](../001-room-session/spec.md).
- A fixed catalog supplied with the project that supports development and
  acceptance without external movie services or movie-provider secrets.
- Acceptance validation needs separate host and guest sessions, unrelated rooms,
  and reproducible concurrent access, temporary connection loss, and loading
  failure conditions. These validate Feature 002's candidate behavior using
  existing room behavior as a prerequisite.

## Unresolved Decisions

None at the product-specification level. Technical choices remain for planning
and must preserve the observable requirements above. The specific method of
choosing an eligible catalog candidate is not a product requirement.
