# Feature Specification: TMDB Candidate Source

**Feature Branch**: `main` (existing branch; no feature branch created)

**Feature Number**: 006

**Feature Slug**: `tmdb-candidate-source`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Replace the synthetic Feature 002 candidate source
with the first real, authoritative TMDB movie satisfying the complete private
compatible Feature 005 constraint, while preserving one shared stable candidate,
privacy, concurrency safety and recovery."

## Scope

### Goals

- Continue the normal product flow from frozen voter filters and authoritative
  compatible common resolution to acquisition and display of the room's first
  real TMDB movie candidate.
- Guarantee that the assigned movie satisfies the complete server-private
  Feature 005 inclusive year range and exact AND-of-OR genre expression.
- Preserve one authoritative room candidate identity across authorized members,
  concurrent or repeated acquisition, reload, reconnect, re-entry and retry.
- Keep TMDB authoritative for title, release year and poster availability while
  Otteroom owns only its room assignment and other application state.
- Deliberately retire Feature 002's synthetic fixtures as the normal product
  source without rewriting Feature 002's completed historical slice.
- Define observable empty-result, external-failure, privacy and recovery states
  without choosing an endpoint, query encoding or backend architecture.

### Terminology and State Meanings

- **Authorized room member**: A voter in the fixed assembled group or the room's
  non-voting creator, under the membership and recovery rules inherited from
  Features 003–005.
- **Compatible handoff**: The one server-private Feature 005 result whose room
  status is authoritative `compatible` and whose complete frozen constraint has
  passed the integrity conditions in the Feature 005 → 006 contract.
- **Resolved common constraint**: An inclusive release-year interval plus zero
  or more nonempty genre clauses. A movie satisfies it when its year is inside
  the interval and its genres intersect every clause. Each clause is OR; the
  clauses are combined with AND. Zero clauses means no genre restriction.
- **Candidate acquisition pending**: The room has a compatible handoff but no
  authoritative candidate assignment yet, and an acquisition attempt is active.
- **Authoritative room candidate**: Exactly one Otteroom room assignment whose
  stable identity is the assigned TMDB movie identity. Every authorized room
  member observes this same current candidate; the assignment is not a client
  choice and is not separate per voter.
- **Transient acquisition failure**: An external, transport, rate-limit,
  malformed-response, integrity or other operational failure before assignment.
  It is not a successful empty result and creates no candidate.
- **Authoritative no-candidate result**: One bounded, error-free acquisition
  attempt completed every request, page and date shard required by the approved
  search algorithm and observed no movie satisfying the exact compatible
  constraint. It is a stable room state: every authorized member sees that the
  completed search found no eligible movie and receives an action to create a
  new room/selection session. Reload, reconnect and re-entry recover that outcome;
  the room does not retry candidate acquisition. Because TMDB does not document
  snapshot-consistent pagination, this result does not assert that no eligible
  movie existed globally in the live catalog at one instant.
- **Metadata unavailable**: A candidate identity is already authoritative, but
  its TMDB descriptive metadata or poster resource cannot currently be read or
  displayed. This condition cannot replace the assignment.
- **Explicit no-poster fallback**: TMDB successfully describes the assigned
  movie but reports no poster. The UI shows an understandable placeholder in
  place of an image; this is a valid completed display, not an external failure.

### Feature 005 → Feature 006 Handoff

Feature 006 consumes Feature 005's completed private handoff without reopening
or reinterpreting it:

- acquisition may begin only when the authoritative resolution is `compatible`,
  membership is Ready, Feature 004 remains frozen at N/N, and the private
  resolved payload passes the Feature 005 handoff integrity conditions;
- pending, incompatible, missing, unauthorized or integrity-invalid state yields
  no candidate query, assignment or display;
- the source is the persisted compatible result, not individual voter filters,
  a client calculation or a caller-supplied constraint;
- the inclusive year bounds are not widened, and every genre clause is retained
  with OR inside the clause and AND across all clauses; and
- a completed, bounded, error-free catalog search attempt with no eligible movie
  observed is a Feature 006 result and never changes Feature 005 from compatible
  to incompatible.

Clients receive only candidate acquisition/display state and approved candidate
data. They never receive the private resolved expression, its source filters,
clause structure or voter identities in order to query TMDB themselves.

### Deliberate Evolution from Feature 002

Feature 002 remains a completed proof of authority and recovery. Feature 006
preserves its useful product invariants:

- at most one authoritative current candidate per room;
- the same candidate identity for every authorized member;
- stable identity under concurrent/repeated access, reload, reconnect, re-entry,
  response loss and retry; and
- a usable title, release year and poster presentation.

Feature 006 deliberately replaces these Feature 002 constraints:

- a compatible Feature 005 handoff, not membership Ready alone, starts normal
  candidate acquisition;
- TMDB movies satisfying the exact common constraint, not four synthetic
  fixtures, form the normal product source;
- TMDB, not fixture rows or bundled assets, is authoritative for descriptive
  metadata; and
- fixture-specific assignment and poster paths are obsolete for the normal
  product flow.

Historical fixtures may remain development or test infrastructure. Their rows,
foreign keys or old assignments do not authorize normal display and cannot make
a pending, incompatible or compatible-but-unassigned room show a fixture. A
fixture must not reappear merely because historical internal state still exists.
Completed Feature 002 artifacts are not rewritten retrospectively.

### Feature 006 → Feature 007 Handoff

The successful output of Feature 006 is one authoritative current TMDB candidate
identity for the room plus the minimum TMDB-authored presentation needed to
consider it. Feature 007 may attach independent voter decisions only to this
shared authoritative identity. Feature 006 records no swipe, like/dislike,
decision completion, agreement or progression and never assigns a second
candidate. If no candidate is assigned, there is no Feature 007 decision target.

### Release Boundary and Non-Goals

This release ends when a compatible room has either its first stable real TMDB
candidate, an approved no-candidate outcome, or an explicit recoverable failure.
The candidate display is exactly title, release year, and a poster or explicit
no-poster fallback. No additional descriptive field is required in Feature 006.

This feature explicitly excludes:

- swipes, decisions, agreement, match behavior and candidate progression;
- a second candidate, candidate queue/deck, next/previous/skip and history;
- recommendation, scoring, ranking or popularity semantics unless required by
  the resolved selection-policy clarification;
- streaming providers or regional provider eligibility;
- a synchronized local canonical movie catalog or permanent metadata snapshot;
- dynamic membership, filter editing/re-resolution or changing the fixed group;
- TV, permanent accounts, cross-device identity transfer and native-only polish;
- an advanced details screen, overview, runtime, rating, cast/crew, backdrop or
  other metadata beyond the stated display minimum; and
- any particular TMDB endpoint, query strategy, page traversal, authentication
  mechanism, cache policy, persistence schema, API shape or Realtime mechanism.

## User Scenarios & Testing *(mandatory)*

Scenario numbers are unique across stories. Unless a scenario says otherwise,
rooms use the completed Features 003–005 behavior, independent authorized local
identities, normal connectivity and an authoritative compatible resolution.
Re-entry means same-local-identity recovery, not permanent-account recovery.

### User Story 1 - Acquire One Eligible Real Candidate (Priority: P1)

As an authorized member of a compatible room, I receive the room's first real
TMDB movie satisfying every frozen voter constraint so our group can consider
the same eligible movie.

**Why this priority**: This is the feature's core value and the required bridge
from common filters to later movie decisions.

**Independent Test**: Drive compatible two- and three-voter rooms through the
Feature 005 handoff, observe the first assignment, and verify the TMDB identity,
year and genres satisfy the complete private predicate while pending and
incompatible control rooms produce no candidate traffic or display.

**Acceptance Scenarios**:

1. **Given** a room below N/N filter completion or with resolution pending,
   **When** any authorized member observes, reloads or re-enters it, **Then** no
   TMDB candidate acquisition starts and no fixture or real candidate is shown.
2. **Given** a room with authoritative incompatible resolution, **When** any
   voter or non-voting creator observes or retries the room, **Then** no candidate
   acquisition starts, no candidate is assigned or displayed, and the existing
   incompatible new-room action remains authoritative.
3. **Given** a coherent authoritative compatible handoff and no room candidate,
   **When** the post-resolution flow continues, **Then** acquisition starts
   without another voter submission or disclosure of the private constraint.
4. **Given** an eligible TMDB movie with release year at either inclusive bound,
   **When** it is considered for assignment, **Then** the year boundary is
   accepted and no wider year is accepted.
5. **Given** multiple nonempty genre clauses, **When** a movie is considered,
   **Then** it is eligible only if its TMDB genres contain at least one genre
   from every clause, without clause omission, union-only matching or requiring
   all genres inside one clause.
6. **Given** a compatible constraint with zero genre clauses, **When** a movie is
   considered, **Then** genre is unrestricted but the inclusive year range still
   applies.
7. **Given** a valid eligible result, **When** assignment completes, **Then** the
   room has exactly one authoritative TMDB movie identity and no fixture identity
   is accepted as its normal product candidate.
8. **Given** multiple eligible movies, **When** the first assignment is made,
   **Then** any eligible movie is acceptable, the product makes no promise about
   ordering, ranking, recommendation, determinism or randomization, and the
   chosen identity is stable afterward.

---

### User Story 2 - Share and Recover the Same Candidate (Priority: P1)

As a voter or non-voting creator, I see and recover the same current movie as
everyone else so that room members never act on divergent candidates.

**Why this priority**: A room-level decision process is valid only when all
authorized observers converge on one identity despite concurrency and lifecycle
interruptions.

**Independent Test**: Start acquisition concurrently from multiple members,
lose one response, reload/reconnect/re-enter each role, and verify every
successful observation resolves to the one committed identity with no second
assignment.

**Acceptance Scenarios**:

9. **Given** two or more authorized members trigger first acquisition
   concurrently, **When** their attempts complete in any order, **Then** at most
   one identity becomes authoritative and no member is shown a conflicting
   successful candidate, even transiently.
10. **Given** an authoritative candidate, **When** acquisition is requested
    repeatedly or concurrently again, **Then** the existing assignment is
    returned or recovered without selecting or writing another candidate.
11. **Given** one voter first sees the candidate, **When** other voters and a
    non-voting creator synchronize, **Then** all observe that same candidate
    identity and minimum presentation; creator voting status changes neither
    candidate nor eligibility.
12. **Given** an assigned candidate, **When** any authorized member reloads,
    reconnects or re-enters by QR, invitation link or code with the same identity,
    **Then** they recover the same candidate without another assignment.
13. **Given** an authorized member missed the assignment notification, **When**
    normal room synchronization or canonical re-entry completes, **Then** they
    converge directly on the stored candidate without needing the missed event.
14. **Given** assignment committed but its response was lost before any client
    displayed it, **When** one or more members retry or recover, **Then** they
    receive the already committed identity and no alternate movie is assigned.
15. **Given** stale candidate success, failure or poster events from an earlier
    room or request generation, **When** the current room lifecycle continues,
    **Then** those events cannot replace, hide or contradict the current room's
    authoritative candidate.

---

### User Story 3 - Understand Empty and External-Failure Outcomes (Priority: P2)

As an authorized member, I can tell whether a completed search observed no
eligible movie or TMDB acquisition stopped incompletely, and I can recover safely
without changing an existing assignment.

**Why this priority**: Empty data and operational failure require different user
decisions; conflating them could incorrectly reject compatible filters or rotate
an already committed candidate.

**Independent Test**: Exercise a pre-assignment network/upstream failure, a
completed-empty acquisition, committed-response loss, metadata failure after
assignment, an absent poster and recovery after each while inspecting the
authoritative room state.

**Acceptance Scenarios**:

16. **Given** an acquisition request fails before assignment because of network,
    rate-limit, malformed or upstream failure, **When** the result is presented,
    **Then** the room remains compatible and unassigned, the state is identified
    as temporary, and an explicit bounded retry is available.
17. **Given** a controlled TMDB boundary lets one attempt successfully finish
    every request, page and date shard required by the approved bounded algorithm
    and none of the observed movies passes the exact server predicate, **When**
    the outcome is presented, **Then** it is identified as a completed search
    with no eligible movie observed rather than incompatibility or external
    failure, becomes a stable room state recovered by every authorized member,
    offers an action to create a new room/selection session, and does not offer
    acquisition Retry or claim global TMDB-catalog nonexistence.
18. **Given** a pre-assignment attempt failed, **When** retry later succeeds,
    **Then** one eligible movie may be assigned without retaining any partial or
    speculative identity from the failed attempt.
19. **Given** assignment committed but the response was lost, **When** retry is
    invoked, **Then** retry recovers the committed identity even if another
    eligible movie would now be returned by a fresh search.
20. **Given** candidate identity is authoritative but its descriptive metadata
    request fails, **When** the room is displayed, **Then** the candidate is not
    replaced, an understandable recoverable metadata failure is shown, and retry
    requests metadata for that same identity.
21. **Given** candidate identity and title/year metadata are authoritative but
    its poster resource temporarily fails, **When** poster retry succeeds,
    **Then** the same candidate and metadata remain in place and no acquisition
    retry or candidate rotation occurs.
22. **Given** TMDB successfully reports that the assigned movie has no poster,
    **When** the candidate is displayed, **Then** title and release year appear
    with the explicit no-poster fallback and the display counts as complete.

---

### User Story 4 - See Minimal TMDB Metadata Without Private Inputs (Priority: P2)

As an authorized room member, I see enough TMDB-authored information to
recognize the shared candidate without receiving secrets, other voters' filters
or internal assignment details.

**Why this priority**: The new external source must improve the product without
moving privileged credentials or private eligibility logic into clients.

**Independent Test**: Compare voter and non-voting-creator displays with TMDB
source data, exercise a cross-room caller and attempted caller-supplied
constraint, and inspect ordinary client-visible traffic/state for secrets and
private filter expressions.

**Acceptance Scenarios**:

23. **Given** an assigned TMDB movie with a poster, **When** any authorized member
    views it, **Then** they see its nonempty TMDB title, release year and visible
    poster, and no advanced metadata field is required.
24. **Given** voters and a non-voting creator view the assigned candidate,
    **When** their room state is compared, **Then** all identify the same movie
    and receive the same approved display-field set.
25. **Given** an ordinary client observes or initiates acquisition, **When** its
    inputs and outputs are inspected, **Then** it receives neither TMDB secrets
    nor the common year range, genre clauses, individual filters or source
    identities, and it cannot supply a substitute resolved constraint.
26. **Given** a member of another room or an unauthorized person guesses room or
    movie identifiers, **When** they attempt candidate access or acquisition,
    **Then** they learn no private assignment, filter information or room state
    and cannot create or change an assignment.
27. **Given** a historical fixture row, foreign key or assignment remains in
    internal state, **When** the normal Feature 006 flow is entered, **Then** it
    cannot be rendered as the room's candidate or used as fallback for pending,
    incompatible, empty or failed TMDB acquisition.
28. **Given** candidate presentation is requested, **When** TMDB metadata is
    selected for display and eligibility, **Then** the room consistently uses the
    English `en-US` metadata variant and explicitly excludes adult titles.

### Edge Cases

- Feature 005 status says compatible but the private payload is missing,
  malformed or contradictory: fail closed, expose no private detail, make no
  TMDB query and assign no candidate.
- Two acquisition attempts find different eligible movies before either
  assignment is visible: only one may commit; the loser recovers the winner.
- A selected TMDB movie disappears or changes metadata after assignment: the
  identity remains authoritative; an unavailable read becomes a recoverable
  metadata state and never permits silent replacement.
- TMDB metadata changes after assignment so a displayed field or genre no longer
  matches the value observed during acquisition: the committed identity remains
  stable; Feature 006 does not reopen frozen filters or rotate the candidate.
- A movie has a release date at an inclusive boundary: it remains eligible.
- A movie matches all but one duplicated or equal genre clause: every clause is
  still evaluated, and no deduplication may weaken the predicate.
- TMDB returns duplicates or the same movie through multiple result pages: one
  TMDB identity is considered once for assignment purposes.
- TMDB pagination changes while a multi-page attempt is running without exposing
  inconsistent counters: if every operation required by the algorithm still
  completes successfully and no observed movie is eligible, `no_candidates`
  retains its attempt-scoped meaning and makes no global snapshot claim.
- Timeout, 429, any 4xx/5xx, malformed data, request/time budget exhaustion,
  single-day overflow, or any incomplete page/shard traversal: the room remains
  pending with retryable `search_incomplete`; none can produce `no_candidates`.
- TMDB reports no poster versus a poster request fails: the former uses the
  completed no-poster fallback; the latter remains recoverable for the same movie.
- A stale fixture assignment coexists with a compatible resolution: historical
  state cannot win over or substitute for Feature 006 authority.
- A non-voting creator initiates or observes acquisition: they may use the same
  authorized room operation but contribute no filter and see the same candidate.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Candidate acquisition MUST begin only from an authoritative
  compatible Feature 005 handoff satisfying all of its status, frozen-completion,
  private-payload and integrity preconditions.
- **FR-002**: Pending, incompatible, missing, unauthorized and integrity-invalid
  rooms MUST produce zero normal TMDB candidate queries, assignments and displays.
- **FR-003**: Acquisition MUST consume the persisted private Feature 005
  constraint and MUST NOT recompute it from individual voter filters.
- **FR-004**: Every assigned movie MUST have a release year inside the complete
  inclusive resolved interval and MUST intersect every genre clause, with OR
  inside each clause and AND across clauses.
- **FR-005**: Acquisition MUST NOT broaden years, drop or merge away a clause,
  treat all clauses as one union, require all genres inside a clause or use an
  ineligible fallback.
- **FR-006**: The constraint with zero genre clauses MUST impose no genre
  restriction while retaining the complete year restriction.
- **FR-007**: Candidate eligibility MUST come only from server-authoritative room
  state; clients MUST NOT submit, override or weaken a resolved constraint.
- **FR-008**: A compatible room MUST have at most one authoritative Feature 006
  current candidate identity, represented by its TMDB movie identity.
- **FR-009**: Concurrent, duplicate and repeated acquisition MUST converge on the
  existing assignment and MUST NOT commit or display divergent successful
  candidates.
- **FR-010**: Once assignment commits, its candidate identity MUST remain stable
  throughout Feature 006 despite response loss, retries, metadata changes or
  failures, poster failures, reload, reconnect, re-entry and missed notifications.
- **FR-011**: Every authorized voter and non-voting creator MUST observe the same
  authoritative room candidate; no role or device receives a separate candidate.
- **FR-012**: Normal acquisition MUST select a real TMDB movie and MUST NOT select
  a Feature 002 fixture or fixture-owned metadata.
- **FR-013**: Historical fixture rows, foreign keys and assignments MUST NOT make
  a fixture candidate reappear in the normal product flow or act as fallback.
- **FR-014**: TMDB MUST remain authoritative for the candidate's descriptive
  movie metadata; Otteroom MUST NOT define a synchronized canonical movie catalog.
- **FR-015**: Otteroom MAY retain the TMDB movie identity, authoritative room
  assignment and stable external identifiers needed for application state, but
  such state MUST NOT redefine descriptive metadata ownership.
- **FR-016**: A successful candidate display MUST contain exactly a nonempty
  title, release year and either a visible poster or explicit no-poster fallback;
  no additional movie-detail field is required.
- **FR-017**: A successful TMDB response reporting no poster MUST produce an
  understandable no-poster fallback and MUST NOT be mislabeled as acquisition or
  metadata failure.
- **FR-018**: Selection among multiple eligible movies MUST follow the resolved
  product policy in Scenario 8: any eligible movie is acceptable, and the product
  MUST create no ordering, ranking, recommendation, determinism or randomization
  promise beyond stable identity after assignment.
- **FR-019**: A request failure before assignment MUST create no candidate,
  remain distinguishable from both Feature 005 incompatibility and an
  authoritative no-candidate result, and offer one explicit retry action per
  failed attempt.
- **FR-020**: An authoritative no-candidate result MUST be committed only when
  one bounded, error-free acquisition attempt finished every request, page and
  date shard required by the approved search algorithm and observed no movie
  passing the exact server predicate. It MUST leave Feature 005 compatible,
  become a stable room state recoverable by every authorized member, show an
  understandable completed-search/no-eligible-movie-observed message and
  new-room/session action, offer no acquisition Retry, and MUST NOT invent a
  fixture, broaden the constraint, or claim global catalog nonexistence.
- **FR-021**: A failed attempt MUST NOT retain or expose a partial, speculative
  or locally selected candidate identity as authoritative.
- **FR-022**: If assignment commits but its response is lost, retry and recovery
  MUST return the committed candidate and MUST NOT perform a contradictory
  assignment.
- **FR-023**: Failure to read descriptive metadata after assignment MUST preserve
  the candidate identity, show a safe recoverable metadata state and retry only
  recovery of metadata for that identity.
- **FR-024**: Poster transport failure after assignment MUST preserve identity,
  title and release year; poster retry MUST NOT select another candidate.
- **FR-025**: Reload, reconnect, same-identity QR/link/code re-entry and recovery
  from a missed update MUST converge on the existing assignment without manual
  room recreation or continuous client presence.
- **FR-026**: Candidate availability MUST recover from canonical room state and
  MUST NOT depend on receiving every realtime notification.
- **FR-027**: Ordinary clients MUST NOT receive TMDB credentials, secrets or any
  privileged server credential in code, configuration, traffic, state, logs or
  diagnostics.
- **FR-028**: Ordinary clients MUST NOT receive the exact resolved year range,
  genre clauses, individual voter filters, their owners or a derived roster
  through acquisition, display, failure or recovery.
- **FR-029**: Candidate access and acquisition MUST be limited to authorized room
  members; unauthorized and cross-room callers MUST learn no private assignment
  or eligibility state and MUST NOT create or change one.
- **FR-030**: Participant-visible failures MUST be safe and understandable and
  MUST NOT expose upstream payloads, request details, credentials, internal
  identifiers, private constraints or another room's candidate.
- **FR-031**: Candidate identity MAY be used internally for authoritative state
  but MUST NOT be presented as descriptive movie information.
- **FR-032**: Metadata language/locale and adult-title eligibility MUST follow
  the resolved product decision in Scenario 28: Feature 006 MUST use the English
  `en-US` TMDB metadata variant and MUST explicitly exclude adult titles for
  acquisition, eligibility evidence and display.
- **FR-033**: Feature 006 MUST expose one current candidate as the only possible
  Feature 007 decision target and MUST record no swipe, decision, agreement,
  progression or match behavior.
- **FR-034**: Candidate acquisition and recovery MUST preserve the fixed voting
  group, frozen filters, Feature 005 status and existing room membership.

### Non-Functional Requirements

- **NFR-001 — Consistency and atomic authority**: Assignment MUST be governed by
  the system boundary capable of guaranteeing one winner under concurrent and
  repeated attempts; caller convention alone is insufficient.
- **NFR-002 — Recoverability**: The authoritative candidate identity MUST survive
  reload, temporary disconnection, same-identity re-entry, missed notification,
  request replay and response loss without candidate rotation.
- **NFR-003 — Eligibility correctness**: Exact year and clause semantics MUST be
  verifiable for every assigned candidate, including boundaries, zero clauses,
  duplicate/equal clauses and multi-clause movies.
- **NFR-004 — Privacy and least privilege**: Secrets and private resolved/filter
  data MUST remain server-private; access MUST be denied by default and granted
  only for the approved room operation and authorized membership.
- **NFR-005 — Failure safety**: Partial external or internal failure MUST never
  produce an ineligible, fixture, incomplete-authority or replacement candidate,
  and incomplete traversal MUST never produce `no_candidates`.
- **NFR-006 — Usability and accessibility**: Members MUST be able to distinguish
  acquisition in progress, candidate available, no eligible candidate,
  recoverable acquisition/metadata failure and no-poster fallback through
  understandable accessible status and actions.
- **NFR-007 — Metadata authority continuity**: Refreshing or rereading mutable
  metadata MAY change descriptive presentation in later technical design, but it
  MUST NOT change the assigned identity or turn Otteroom into the catalog authority.
- **NFR-008 — Bounded scope**: The release MUST introduce only the first
  candidate and its recovery/display states, with no speculative progression,
  recommendation, provider, catalog-sync or advanced-details behavior.

### Key Entities

- **Resolved common constraint**: The stable server-private compatible Feature
  005 year interval and ordered AND-of-OR genre clauses. It is an eligibility
  input, never participant-visible candidate-query data.
- **TMDB movie identity**: The stable external identity of the selected movie and
  the identity portion of Otteroom's room assignment.
- **Authoritative room candidate assignment**: Otteroom application state linking
  one compatible room to at most one current TMDB movie identity. It remains
  stable while descriptive metadata may be reread from TMDB.
- **Candidate descriptive metadata**: TMDB-authored title, release year and
  poster availability/reference used for the minimum display. It is not an
  Otteroom canonical movie record.
- **Candidate acquisition outcome**: Pending, assigned, authoritative
  no-candidate, or transient failure meaning associated with the attempt/room;
  none redefines Feature 005 compatibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested pending, incomplete, incompatible, unauthorized
  and integrity-invalid rooms, zero candidate queries, assignments and movie
  displays occur.
- **SC-002**: In 100% of the year-boundary, zero-clause, Any-genre, duplicate-
  clause, disjoint-clause and multi-clause eligibility cases, every assigned
  movie satisfies the complete Feature 005 predicate and no ineligible fallback
  is accepted.
- **SC-003**: In every sequential and concurrent first-acquisition or retry test,
  each room ends with at most one authoritative TMDB identity and authorized
  clients observe zero conflicting successful candidates.
- **SC-004**: In 100% of reload, reconnect, re-entry, missed-update and
  committed-response-loss cases, all authorized members recover the original
  candidate identity with zero replacement assignments.
- **SC-005**: In every tested voting-creator and non-voting-creator room, all
  authorized members observe the same candidate and the non-voting creator
  contributes zero eligibility input.
- **SC-006**: In 100% of successful candidate presentations, title and release
  year come from TMDB and the UI displays either the movie's poster or the
  explicit no-poster fallback, with zero required advanced metadata fields.
- **SC-007**: In 100% of pre-assignment failure, completed-empty,
  committed-response-loss, post-assignment metadata failure and poster failure
  cases, members see the correct distinct state and every retry preserves the
  applicable authoritative assignment.
- **SC-008**: Across all privacy, ordinary-client and cross-room acceptance
  checks, there are zero disclosures of TMDB secrets, private common constraints,
  individual voter filters, internal source identities or foreign assignments,
  and zero unauthorized changes.
- **SC-009**: Across all normal product acquisition and display scenarios, zero
  Feature 002 fixture identities, fixture metadata or bundled fixture posters
  are selected or shown, including when historical fixture state remains.
- **SC-010**: Under normal connectivity and a responsive TMDB service, at least
  95% of compatible-room acquisition trials show their assigned minimum
  candidate presentation within 10 seconds of the compatible handoff.
- **SC-011**: Feature-owner real-stack browser acceptance uses no more than 9
  independent identities while covering compatible handoff, exact eligibility,
  shared convergence, metadata/poster display, no-result distinction, external
  failure/retry, recovery and both creator modes.
- **SC-012**: Feature 006 acceptance records zero swipes, decisions, candidate
  progressions, matches, provider restrictions, synchronized-catalog behavior or
  advanced-details requirements.

## Assumptions

- Features 003–005 are complete and define current runtime authority for fixed
  membership, voter/non-voter roles, frozen filters, room isolation, compatible
  status, private handoff and same-local-identity recovery.
- The Feature 005 compatible constraint remains immutable for the room; Feature
  006 does not repair or rederive it.
- TMDB is reachable and supplies a usable movie identity and descriptive
  metadata except in scenarios explicitly covering failure or empty results.
- A movie can be assigned only after the product has enough authoritative TMDB
  data to prove exact eligibility and the required title/release-year display;
  poster absence is allowed through the explicit fallback.
- A candidate's eligibility is established at assignment. Later mutable TMDB
  metadata does not reopen filters or authorize automatic replacement in this
  first-candidate-only feature.
- Existing local participant identity remains the recovery boundary; permanent
  accounts and cross-device identity transfer remain out of scope.

## Dependencies and Preserved Guarantees

- The [constitution](../../.specify/memory/constitution.md),
  [product vision](../../docs/product-vision.md),
  [MVP roadmap](../../docs/mvp-roadmap.md) and
  [testing strategy](../../docs/testing-strategy.md) govern this specification.
- [Feature 005](../005-common-filter-resolution/spec.md) and its
  [private Feature 006 handoff](../005-common-filter-resolution/contracts/feature-006-filter-handoff.md)
  supply the only authorized eligibility source and preserve status-only client
  visibility.
- Feature 003 supplies authorized fixed membership, creator role, invitations
  and same-identity room recovery; Feature 004 supplies frozen accepted filters.
- [Feature 002](../002-first-movie-candidate/spec.md) supplies historical evidence
  for shared assignment, display, concurrency and recovery. Feature 006 preserves
  those invariants while replacing its source and direct-Ready trigger.
- TMDB supplies candidate catalog results, stable movie identity and descriptive
  metadata. Current official TMDB behavior must be researched during planning;
  this specification freezes no technical endpoint or request assumption.

## Minimum Acceptance and Testing Strategy

`docs/testing-strategy.md` is normative. Planning MUST refine this bounded set
and MUST NOT mechanically rerun the full historical browser suite.

- **Current-feature real-stack owner acceptance (`F <= 9`)**:
  - **J01 — 3 identities maximum**: a voting creator plus two voters reach a
    compatible handoff with distinct clauses and bounded years; prove automatic
    real-TMDB acquisition, exact eligibility, concurrent convergence, stable
    reload/reconnect/re-entry and title/year/poster-or-fallback display.
  - **J02 — 4 identities maximum**: a non-voting creator plus three voters reach
    a compatible handoff; prove zero creator contribution, one shared candidate,
    missed-notification recovery, minimum metadata, privacy of the constraint and
    the approved no-candidate behavior in a second room using the same case identities.
  - **J03 — 2 identities maximum**: with the same two identities across bounded
    rooms, prove pre-assignment external failure and explicit retry,
    committed-response loss, post-assignment metadata/poster failure, same-ID
    recovery and no fixture fallback.
- **Permanent smoke inheritance**: retain C1 at 1 identity and the current
  G03/G04/G05/G08/H01 smoke intent at 16 identities. Update only assertions whose
  normal compatible endpoint deliberately evolves from Feature 005 status-only
  presentation to Feature 006 candidate appearance; preserve assembly, QR,
  ordinary-credential isolation, filter ownership and recovery intent.
- **Targeted historical browser impact**: Feature 006 changes Feature 002's
  direct-Ready source/display boundary and the F02 recovery, F04 authorization,
  F07 lost-response and F08 poster-source boundaries. Those fixture-specific
  cases MUST NOT be rerun unchanged as if fixtures remained the product source.
  Planning must either adapt only the still-valid boundary assertion into J01–J03
  or select the exact historical case once with its identity cost; it must not
  duplicate equivalent owner evidence. No E/G/H non-smoke case is selected by
  default because Auth bootstrap, capacity, QR decoding and Feature 004 save/freeze
  mechanics are not redefined here.
- **Database authority**: exact compatible-gate enforcement, AND-of-OR and year
  predicate invariants, assignment uniqueness, deterministic concurrent winner,
  idempotent repeats, rollback, lost-response persistence, fixture non-authority,
  exact authorization and direct-write/read denial require database-level tests.
- **Client authority**: exact result parsing, state transitions, one-flight,
  stale-generation suppression, role-equal candidate display, distinct pending /
  empty / external / metadata / no-poster states, safe retry and privacy-safe
  presentation require focused client tests.
- **External boundary evidence**: controlled TMDB substitutes must cover completed-
  empty, incomplete, pagination, fault and metadata variants below the browser,
  but mocks do
  not replace the bounded real-stack owner flow. Planning must define reproducible
  official-source-grounded evidence without leaking credentials or depending on
  unstable catalog facts for exact test identity.
- **Other mandatory gates**: applicable nonempty migration and clean-reset paths,
  generated-type consistency, full database and client suites, lint, typecheck,
  build, supported exports, credential safety and finalized artifact scanning
  remain required at zero additional browser identities.
- **R02 projection**: with `F = 9` and no separately selected historical case,
  normal checkpoint is `1 + 16 + 9 = 26`, repeatability is
  `1 + 2 × (16 + 9) = 51`, and fresh checkout is `1 + 16 = 17` identities.
  Any justified targeted historical cost `T` is added once under the normative
  formulas and recorded before execution.

### Observable Impact Boundaries

- compatible Feature 005 handoff now continues to candidate acquisition and
  appearance; pending and incompatible remain candidate-suppressed;
- Feature 002's fixture assignment becomes a TMDB-identity assignment while
  preserving concurrency, retry and recovery authority;
- all voters and a non-voting creator converge on one candidate through the
  existing shared room lifecycle;
- candidate presentation changes from fixture-owned static metadata/posters to
  TMDB-authored title/year/poster-or-fallback;
- external acquisition, empty-result and post-assignment metadata failures add
  distinct observable recovery states; and
- candidate authorization and privacy now protect TMDB credentials and the
  Feature 005 private constraint as well as the room assignment.

Full historical browser acceptance is not the default Feature 006 gate. It is
required only by the triggers in `docs/testing-strategy.md`, such as an explicit
release checkpoint or a cross-cutting Auth/harness change.

## Planning Research Handoff

Feature 006 planning MUST use current official TMDB sources to research:

- API authentication;
- candidate discover/search capabilities required by the exact resolved filter;
- genre query semantics, including whether post-filtering is needed to preserve
  the Feature 005 AND-of-OR predicate;
- pagination and the conditions required to record a completed-empty acquisition
  without claiming a snapshot-consistent or globally exhaustive catalog result;
- rate limits or published usage guidance;
- image URL/configuration behavior and absent-image handling;
- attribution and branding requirements; and
- relevant content and localization parameters.

Research must inform the later technical plan without changing the product
decisions in this specification or exposing credentials/private constraints.

## Resolved Product Decisions

- **Candidate authority**: Otteroom owns one stable room assignment identified by
  a TMDB movie ID; TMDB owns mutable descriptive movie metadata.
- **Display minimum**: exactly title, release year and poster or explicit
  no-poster fallback. No advanced movie detail is required now.
- **Empty eligible result**: `no_candidates` means one bounded, error-free attempt
  completed every request, page and date shard required by the approved search
  algorithm and observed no eligible movie. It is stable for the room, recovered
  across lifecycle events, offers creation of a new room/session and has no
  acquisition Retry. TMDB pagination has no documented snapshot-consistency
  guarantee, so the state does not claim global catalog nonexistence at one time.
- **Selection policy**: any eligible movie is acceptable. Feature 006 promises
  no ordering, ranking, recommendation, deterministic or randomized selection;
  only the assigned identity must remain stable.
- **Localization and content eligibility**: candidate acquisition and display
  use English `en-US` TMDB metadata and explicitly exclude adult titles.
- **Eligibility**: the complete private Feature 005 inclusive year interval and
  every exact AND-of-OR genre clause are mandatory; no broadening is allowed.
- **Failure after assignment**: the candidate identity never rotates merely
  because response, metadata or poster delivery failed; recovery targets the
  same identity.
- **Feature 002 evolution**: synthetic fixtures may remain test infrastructure
  but cease to be the normal source or fallback.

## Unresolved Decisions

None.
