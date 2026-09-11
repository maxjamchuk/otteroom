# Feature Specification: Common Filter Resolution

**Feature Branch**: `main` (existing branch; no feature branch created)

**Feature Number**: 005

**Feature Slug**: `common-filter-resolution`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Derive one authoritative, stable and recoverable
common eligibility result from the fixed assembled voting group's accepted,
frozen genre and inclusive release-year filters, without fetching or displaying
movie candidates."

## Scope

### Goals

- Turn Feature 004's durable all-voters-complete handoff into exactly one
  authoritative room-level common-resolution outcome.
- Ensure every member of the fixed assembled voting group contributes their
  accepted constraints exactly once, while non-voting creators contribute none.
- Distinguish a compatible result that is ready for future Feature 006 candidate
  sourcing from an incompatible result that has explicit user-visible handling.
- Preserve convergence, reload/reconnect/re-entry recovery, filter privacy and
  candidate suppression throughout resolution.
- Define a bounded, independently testable Feature 005 slice without selecting
  candidate-source, schema, API, query or client-library details.

### Terminology

- **Fixed assembled voting group**: The authoritative Feature 003 membership set
  whose voter count reached the configured requirement and cannot change during
  this selection session.
- **Frozen voter filters**: Every fixed voter's accepted Feature 004 genre
  selection and inclusive release-year range after the room first reached N/N
  completion. They cannot be edited under Feature 004's completed guarantee.
- **Any genre**: Feature 004's empty genre selection, which contributes no genre
  restriction for that voter. It is not silently expanded into all genre values.
- **Resolution pending**: No usable common result exists because fewer than all
  fixed voters have frozen accepted filters.
- **Resolution failure**: All inputs are frozen, but a transient operational
  failure prevented recovery of an authoritative terminal result. It exposes no
  partial constraint, remains distinct from incompatibility and can be retried.
- **Compatible resolution**: The fixed voters' frozen constraints produce an
  overlapping inclusive year range and a stable room-level genre predicate
  suitable for future Feature 006 candidate sourcing.
- **Incompatible resolution**: The frozen year ranges have no inclusive overlap.
  This is a valid product outcome, not an operational failure and not permission
  to omit a voter. Valid Feature 004 genre selections are always expressible
  under this feature's per-voter OR / group AND rule and therefore do not alone
  produce Feature 005 incompatibility.
- **Authorized room member**: A voter in the fixed group or the room's
  non-voting creator, using the identity and room-access rules inherited from
  Feature 003.
- **Usable result**: Only an authoritative compatible result. Pending,
  incompatible, locally predicted or partially derived values cannot authorize
  candidate sourcing.

### Deliberate Evolution from Feature 004

Feature 004 remains authoritative for filter ownership, accepted input rules,
private per-voter values, the fixed completion denominator and the irreversible
freeze at the first N/N transition. Feature 005 does not reopen, replace or
reinterpret those accepted inputs. An incompatible outcome leaves the current
room frozen and terminal; another attempt requires a new room/selection session.

Feature 004 deliberately stopped at an all-filters-collected screen and did not
continue automatically. Feature 005 evolves that endpoint: after, and only
after, authoritative N/N completion and freeze, resolution begins without
requiring another voter submission. Before N/N, clients remain in the Feature
004 preparation flow and no usable result exists. Once resolution has produced
an authoritative compatible or incompatible outcome, that room-level outcome
becomes the shared post-filter state recovered by every authorized room member.

The fixed group, QR/link/code joining, same-identity recovery and the rooms-only
shared invalidation model remain the baseline. This feature introduces no need
for a participant roster or a stream of private filter details. Feature 002's
fixture candidate remains suppressed: N/N and either resolution outcome are not
authority to fetch or show any movie in Feature 005.

### Feature 006 Handoff

- A **compatible** authoritative result is the only Feature 005 output marked
  ready for future Feature 006 candidate sourcing. It supplies the complete
  stable common constraint but does not itself request or display a movie.
- An **incompatible** authoritative result is not candidate-ready. The current
  room remains frozen in that terminal state, and every authorized member is
  directed to create a new room/selection session for another attempt. It cannot
  be converted to compatible by dropping a voter or constraint.
- A **pending** or operationally failed resolution is not candidate-ready. A
  retry or recovery may obtain the same deterministic result from the unchanged
  frozen inputs; it cannot expose a partial result.

Feature 006 may consume only the compatible handoff. It must not infer
eligibility from individual private filters, treat an incompatible result as an
empty/omitted filter, or begin candidate acquisition from N/N alone.

### Non-Goals

This feature explicitly excludes:

- TMDB calls, external catalog searches, movie metadata and candidate
  acquisition, assignment or display;
- use of Feature 002 synthetic fixtures as candidates or as proof that a
  resolved constraint has catalog matches;
- ranking, recommendations, scoring, result ordering or fallback broadening;
- swipes, candidate progression, agreement policy, matches and providers;
- changes to the fixed voting group, late voters, member removal/replacement,
  required-count changes or creator voting-mode changes;
- a participant roster or disclosure of another voter's filter details;
- TV behavior, permanent accounts, cross-device identity recovery or synthetic
  fixture restoration;
- implementation choices for storage, schema, transactions, functions,
  endpoints, queries, libraries or external-service integration.

## User Scenarios & Testing *(mandatory)*

Acceptance scenario numbers are unique across stories. Unless stated otherwise,
rooms use independent authorized local identities, normal connectivity and the
completed Feature 004 behavior. Re-entry means same-local-identity recovery,
not permanent-account or cross-device recovery.

### User Story 1 - Resolve Every Frozen Voter Constraint (Priority: P1)

As a member of a room whose voters have finished their filters, I receive one
authoritative compatibility outcome based on the complete fixed group so the
room has a trustworthy prerequisite for later candidate sourcing.

**Why this priority**: Correct complete-group resolution is the feature's core
value and the only valid handoff to Feature 006.

**Independent Test**: Drive two- and three-voter rooms from partial Feature 004
completion through N/N using distinct genre and year inputs, then verify that no
usable result exists early and that the final result follows every accepted
filter without a candidate request or display.

**Acceptance Scenarios**:

1. **Given** a room below membership assembly, **When** an authorized client
   observes or re-enters it, **Then** filter resolution does not begin, no usable
   result exists and no candidate is fetched or shown.
2. **Given** an assembled room with zero or some but not all voter filters
   complete, **When** any authorized member observes the room, **Then** the room
   remains resolution-pending, no partial constraint is exposed as usable and no
   candidate is fetched or shown.
3. **Given** exactly one required voter remains incomplete, **When** any other
   member reloads or reconnects, **Then** the disconnected or incomplete voter
   remains part of the fixed denominator and resolution cannot ignore them.
4. **Given** the last required voter submits valid filters and Feature 004
   authoritatively reaches N/N and freezes all accepted filters, **When** the
   post-filter flow continues, **Then** common resolution begins from exactly
   those frozen inputs and requires no additional voter submission.
5. **Given** a voting creator and normal voters in a three-voter room have
   distinct frozen filters, **When** resolution completes, **Then** each of the
   three accepted constraint sets is represented exactly once under the
   per-voter OR / group AND genre rule and the inclusive common year rule.
6. **Given** a non-voting creator and three external voters, **When** resolution
   completes, **Then** all three voter filters contribute, the creator
   contributes no genre or year constraint, and the outcome is not affected by
   the creator's connection state.
7. **Given** frozen year ranges with an overlapping inclusive interval, **When**
   they are resolved, **Then** the common year range starts at the greatest
   voter lower bound and ends at the least voter upper bound, including both
   boundary years.
8. **Given** any voter chose Any genre, **When** genre constraints are resolved,
   **Then** that empty selection imposes no genre restriction and does not erase,
   broaden or masquerade as another voter's selected genres.
9. **Given** all inputs are frozen, **When** resolution is retried or derived
   again after a lost response, **Then** the room obtains the same canonical
   outcome and no voter's constraint is duplicated or omitted.

---

### User Story 2 - Converge on Compatible or Incompatible (Priority: P1)

As an authorized room member, I can distinguish whether the group's frozen
filters are compatible so I know whether the room can proceed toward movies or
must follow the explicit incompatible path.

**Why this priority**: An ambiguous or client-local outcome could cause members
to diverge or allow later sourcing to ignore constraints.

**Independent Test**: Resolve one compatible and one incompatible room in both
creator modes; verify every member reaches the same status, only compatible is
candidate-ready, and neither outcome shows or fetches a movie.

**Acceptance Scenarios**:

10. **Given** frozen filters with an inclusive common year overlap, **When**
    resolution completes, **Then** the room records one authoritative compatible
    outcome containing the per-voter OR / group AND genre predicate and marked
    ready only for future Feature 006.
11. **Given** frozen year ranges for which the greatest lower bound exceeds the
    least upper bound, **When** resolution completes, **Then** the room records
    one authoritative incompatible outcome and no common year range is presented
    as usable.
12. **Given** two voters choose disjoint nonempty genre sets and their year
    ranges overlap, **When** resolution completes, **Then** the room remains
    compatible because a multi-genre movie may satisfy at least one selected
    genre for each voter; the result preserves both clauses without taking their
    literal intersection or consulting a movie catalog.
13. **Given** one member observes compatible and another observes incompatible
    due to stale local state, **When** authoritative room state is recovered,
    **Then** both converge on the same authoritative outcome and the stale view
    cannot authorize candidate sourcing.
14. **Given** an incompatible outcome, **When** any voter or non-voting creator
    observes it, **Then** they see that the frozen filters are incompatible and
    that another attempt requires creating a new room/selection session, with no
    editing, silent broadening, ignored voter, candidate fetch or candidate display.
15. **Given** a compatible outcome, **When** any authorized member observes it,
    **Then** they see compatible status and understand that the room is ready for
    future candidate sourcing, but receive no resolved genre or year details and
    no candidate appears in this feature.
16. **Given** a pending, compatible or incompatible room, **When** a client
    attempts to use local calculations or stale data as a different terminal
    outcome, **Then** only the authoritative room result governs the shared state.

---

### User Story 3 - Recover a Stable Private Resolution (Priority: P2)

As an authorized room member, I recover the room's authoritative resolution
after interruption without learning another voter's private filters or causing
the result to change.

**Why this priority**: Feature 006 cannot safely depend on a result that is lost,
changes across clients or exposes its source inputs during recovery.

**Independent Test**: Resolve rooms, then exercise reload, reconnect,
same-identity QR/link/code re-entry, missed updates, retry and unrelated-room
access while checking stable status-only visibility, private source filters
and continued candidate suppression.

**Acceptance Scenarios**:

17. **Given** an authoritative compatible result, **When** a voter or non-voting
    creator reloads, reconnects or re-enters with the same identity, **Then** they
    recover the same compatible status and next-step meaning, but no exact
    resolved constraint, without initiating a second contradictory result.
18. **Given** an authoritative incompatible result, **When** a voter or
    non-voting creator reloads, reconnects or re-enters with the same identity,
    **Then** they recover the same incompatible status and new-room/session action.
19. **Given** authorized clients miss the update that completed resolution,
    **When** synchronization recovers, **Then** they converge directly from
    pending to the authoritative terminal outcome without needing every
    intermediate event or manual room recreation.
20. **Given** a resolution attempt fails before an authoritative terminal result
    exists, **When** the failure is shown, **Then** it is distinguishable from
    incompatibility, no partial result is usable, frozen filters remain unchanged
    and a bounded retry or recovery can obtain the result.
21. **Given** resolution succeeded but confirmation was lost, **When** an
    authorized client retries or recovers, **Then** it receives the existing
    outcome without creating a different result or changing any filter.
22. **Given** one voter reloads after resolution, **When** their own Feature 004
    detail is recovered, **Then** they may see only their own accepted filters
    plus the room's status and next action, and cannot see the exact resolved
    constraint or any other voter's genres or years.
23. **Given** a non-voting creator observes or recovers the result, **When** the
    room state is presented, **Then** they see only the room-level status and
    next action, never the exact resolved constraint, any voter's individual
    filters or a derived roster.
24. **Given** a person authorized only for another room guesses or substitutes
    room or participant information, **When** they try to read or influence this
    room's result, **Then** they learn no room-private resolution or voter-filter
    information and cannot change either room.
25. **Given** any authorized member observes a recovered compatible or
    incompatible result, **When** they inspect the normal Feature 005 flow,
    **Then** no fixture or production candidate, movie metadata, swipe,
    progression or match interaction is fetched or displayed.

### Edge Cases

- The final two voters submit concurrently: Feature 004 still freezes one
  complete set at N/N, and Feature 005 cannot see or publish a partial mix.
- An edit races the final Feature 004 completion: the completed freeze ordering
  decides the accepted inputs; Feature 005 never reopens or chooses between drafts.
- One or more Any-genre voters coexist with constrained voters: Any remains
  neutral and the constrained voters remain represented.
- Every voter chooses Any genre: the genre portion remains unrestricted rather
  than becoming an empty incompatible genre set.
- Voters choose disjoint nonempty genre sets: the resolved predicate keeps one
  alternative clause per constrained voter, allowing a multi-genre movie to
  satisfy all voters without requiring a literally shared genre value.
- Year ranges overlap at exactly one year: that single inclusive year is a valid
  common range.
- Year ranges are disjoint by one year or more: the result is incompatible.
- A disconnected voter had submitted before N/N: their frozen accepted filters
  still contribute because connection state cannot redefine membership.
- A stale client still displays X/N while resolution is terminal: recovery may
  skip intermediate state but cannot invent a different terminal result.
- A pre-existing fixture candidate remains attached in historical infrastructure:
  it stays invisible and cannot make pending or incompatible candidate-ready.
- A transient operational failure occurs while deriving the result: it remains
  distinct from a valid incompatible outcome and cannot leak filter details.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Resolution MUST begin only after the fixed assembled voting group
  has reached Feature 004 all-voters-complete and every accepted voter filter is frozen.
- **FR-002**: Before N/N, the room MUST have no usable common-resolution result;
  no subset of voters, connected-voter subset or locally available subset may
  authorize a partial result.
- **FR-003**: The authoritative resolution MUST use exactly one accepted frozen
  filter set for every voter in the fixed assembled group, including a voting creator.
- **FR-004**: A non-voting creator MUST contribute no genre selection, year
  range, default, completion slot or substitute constraint to resolution.
- **FR-005**: Resolution behavior MUST support the configured fixed group and
  MUST NOT assume exactly two voters or a host/guest pair.
- **FR-006**: The common inclusive release-year range MUST be the greatest
  accepted lower bound through the least accepted upper bound across all fixed
  voters. It is compatible exactly when the resulting lower bound is less than
  or equal to the resulting upper bound.
- **FR-007**: Any genre MUST remain neutral during genre resolution; it MUST NOT
  be expanded into all genres, treated as an incompatible empty choice or used
  to erase another voter's restriction.
- **FR-008**: Genre compatibility MUST use OR within each constrained voter's
  selection and AND across the fixed voting group. A future candidate satisfies
  the resolved genre predicate exactly when, for every voter with a nonempty
  genre selection, the candidate contains at least one genre from that voter's
  selection. The resolved constraint MUST preserve every such voter clause; it
  MUST NOT replace them with the literal intersection of selected genre values.
- **FR-009**: The room MUST produce exactly one authoritative terminal status:
  compatible when the inclusive common year range is nonempty, or incompatible
  when that range is empty. Valid Feature 004 genre inputs MUST always form a
  usable predicate under FR-007 and FR-008; an actual catalog containing no
  matching movies is not Feature 005 incompatibility.
- **FR-010**: A compatible result MUST contain the complete stable common
  constraint needed by future Feature 006 and MUST be the only result marked
  candidate-source-ready.
- **FR-011**: An incompatible result MUST be a first-class authoritative outcome,
  MUST NOT contain a usable common constraint and MUST NOT become compatible by
  dropping or weakening any voter's frozen input.
- **FR-012**: After an incompatible result, the current room MUST remain frozen
  in a terminal incompatible state. Every authorized member MUST receive an
  understandable action to create a new room/selection session for another
  attempt. Feature 005 MUST NOT reopen editing or reset filters in that room.
- **FR-013**: Every authorized room member MUST be able to distinguish pending,
  compatible, incompatible and transient operational failure meanings.
- **FR-014**: Participant clients MUST receive only the room-level resolution
  status and its next-step meaning: continue waiting while pending, ready for
  future candidate sourcing when compatible, create a new room/selection session
  when incompatible, or retry/recover after a transient failure. They MUST NOT
  receive the exact resolved genres, genre clauses or common year range.
- **FR-015**: Every authorized room member MUST converge on the same
  authoritative resolution status under normal connectivity; no member's local
  calculation may become a competing room outcome.
- **FR-016**: Reload, reconnect and same-identity QR/link/code re-entry MUST
  recover the authoritative status and next-step meaning without exposing the
  exact resolved constraint.
- **FR-017**: Retry, duplicate initiation, overlapping observation and lost
  confirmation MUST yield the same result from the same frozen inputs and MUST
  NOT create contradictory terminal outcomes.
- **FR-018**: A failure before an authoritative terminal result exists MUST
  preserve the frozen inputs, expose no usable partial result, remain visibly
  distinct from incompatibility and allow bounded retry or recovery.
- **FR-019**: Connection state, missed updates and stale client state MUST NOT
  add, remove or duplicate voter constraints or change a terminal outcome.
- **FR-020**: Voters MUST retain access only to their own accepted filter details;
  other voters and non-voting creators MUST NOT receive individual genres,
  years, ownership markers or a participant roster through resolution or recovery.
- **FR-021**: Unauthorized people and members of other rooms MUST NOT read or
  influence the room's resolution, source filters or candidate-readiness state.
- **FR-022**: Participant-facing states and failures MUST NOT expose
  internal user, authentication, membership or filter-record identifiers.
- **FR-023**: Feature 004's frozen inputs and N/N state MUST remain unchanged by
  resolution, retry, recovery, disconnection or stale client actions.
- **FR-024**: No Feature 005 state or action, including compatible,
  incompatible, retry, reload or re-entry, MUST fetch, assign or display a
  fixture or production movie candidate or movie metadata.
- **FR-025**: Compatible MUST hand off only the stable resolved constraint and
  candidate-source-ready meaning to Feature 006; pending and incompatible MUST
  block that handoff.
- **FR-026**: QR, invitation-link and code entry and identity recovery MUST
  remain governed by Feature 003 and MUST NOT create a resolution-specific
  identity or alter the fixed group.
- **FR-027**: The observable shared resolution and recovery needs MUST preserve
  the inherited single room-level shared-state model and MUST NOT require
  publication of participant-filter rows, a roster or private edit activity.

### Non-Functional Requirements

- **NFR-001 — Determinism and consistency**: The same complete frozen input set
  MUST produce one canonical result across sequential, repeated and concurrent
  attempts, and all authorized clients MUST converge on it.
- **NFR-002 — Recoverability**: An authoritative terminal result MUST survive
  reload, temporary disconnection and same-identity re-entry without room
  recreation or continuous client presence.
- **NFR-003 — Privacy and least privilege**: Access MUST be denied outside
  authorized room membership, individual filters MUST remain owner-private and
  participant-visible resolution MUST be limited to status and next-step meaning.
- **NFR-004 — Failure safety**: Partial processing, retries or lost confirmations
  MUST NOT expose a partial usable constraint, mutate frozen inputs, broaden
  eligibility or enable candidate sourcing.
- **NFR-005 — Usability**: Authorized members MUST be able to understand whether
  resolution is still pending, compatible, incompatible or temporarily failed,
  and what action is available, without internal identifiers or movie content.
- **NFR-006 — Baseline continuity**: The feature MUST preserve generalized fixed
  membership, voter/non-voter semantics, QR/link/code recovery, room isolation,
  candidate suppression, C1/R01 discipline and the existing shared-state
  architecture unless an approved impact review establishes a necessary evolution.

### Key Entities

- **Frozen voter filter input**: One fixed voter's accepted Feature 004 genres
  and inclusive year range. It remains privately owned and immutable for the
  selection session under the inherited baseline.
- **Common resolution**: The one authoritative room-level result derived from
  the complete frozen input set. It has pending, compatible or incompatible
  meaning and no movie candidate.
- **Resolved common constraint**: The canonical inclusive common year range and
  per-voter OR / group AND genre predicate carried only by a compatible result
  for future Feature 006 use and not exposed to participant clients.
- **Resolution visibility**: Only room-level status and next-step meaning shown
  to authorized clients, never the exact resolved constraint or individual
  source filters.
- **Candidate-source readiness**: A handoff meaning attached only to an
  authoritative compatible result; it is not a candidate or movie-fetch action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested rooms, resolution starts only at N/N and zero
  pending or partial groups produce a candidate-source-ready result.
- **SC-002**: In every tested two- and three-voter room, 100% of fixed voters'
  accepted filters contribute exactly once and 0% of non-voting creators'
  choices or connection state contribute.
- **SC-003**: The inclusive common year result is correct in 100% of overlap,
  single-year-boundary and disjoint-range acceptance cases.
- **SC-004**: The per-voter OR / group AND genre rule produces the expected
  canonical predicate in 100% of Any, overlapping, disjoint and multi-voter
  acceptance cases, with every constrained voter clause represented.
- **SC-005**: Every tested authorized client converges on the same compatible or
  incompatible status without manual room recreation under normal connectivity.
- **SC-006**: In 100% of tested reload, reconnect, missed-update, lost-response
  and same-identity re-entry cases, clients recover the original authoritative
  terminal result and no contradictory result is created.
- **SC-007**: Across all incompatible acceptance cases, zero voter constraints
  are ignored or weakened, zero incompatible results become candidate-ready,
  and every authorized member receives the explicit new-room/session action.
- **SC-008**: In every privacy and cross-room acceptance case, there are zero
  disclosures of another voter's individual filters, internal identifiers or
  unauthorized resolution details, and zero unauthorized result changes.
- **SC-009**: Across all Feature 005 acceptance scenarios, zero fixture or
  production movie candidates or movie metadata are fetched, assigned or shown.
- **SC-010**: In 100% of retry, overlap and transient-failure acceptance cases,
  frozen inputs remain unchanged and no partial result becomes usable.
- **SC-011**: Feature-owner real-stack browser acceptance uses no more than 9
  independent identities while covering compatible, incompatible, voting-creator,
  non-voting-creator, three-voter, convergence, recovery, privacy and
  candidate-suppression behavior.
- **SC-012**: The specification and later acceptance introduce zero TMDB calls,
  candidate UI, filter ranking, swipes, progression, matches, provider behavior,
  dynamic membership or participant roster behavior.

## Assumptions

- Feature 004 is complete at baseline
  `e4f92a1a445baaf73a5c72d5546f2759977529da` and is the current runtime baseline.
- Feature 003 remains authoritative for generalized fixed membership, creator
  role, invitations, room isolation and same-local-identity recovery.
- Every resolution-eligible room already has one valid accepted filter set per
  fixed voter; integrity-invalid states are rejected as failures, not repaired by
  ignoring a voter or inventing defaults.
- The Feature 004 fixed 19-genre vocabulary and current-year validation define
  valid source inputs. Feature 005 neither refreshes that vocabulary nor calls TMDB.
- Normal connectivity exists except where a scenario explicitly covers missed
  updates, failure or disconnection.
- Catalog emptiness is not inferred in this feature. Compatibility is a property
  of the frozen constraint expressions themselves; Feature 006 later determines
  whether TMDB supplies actual movies satisfying a compatible constraint.
- The existing local participant identity is the recovery boundary; permanent
  accounts and cross-device identity transfer remain out of scope.

## Dependencies and Preserved Guarantees

- The [constitution](../../.specify/memory/constitution.md),
  [product vision](../../docs/product-vision.md),
  [MVP roadmap](../../docs/mvp-roadmap.md) and
  [testing strategy](../../docs/testing-strategy.md) govern this specification.
- [Feature 004](../004-participant-filters/spec.md) supplies the accepted private
  inputs, exact fixed denominator, authoritative N/N handoff and irreversible
  freeze. Its completed contracts remain authoritative until deliberately evolved.
- Feature 003 supplies generalized membership, voting/non-voting roles,
  invitations, fixed assembly, isolation and recovery. Feature 005 does not
  redefine any of them.
- Feature 002's candidate authority remains historical infrastructure only. Its
  normal display and participant candidate access stay suppressed throughout
  Feature 005.
- Feature 006 depends on a compatible Feature 005 result. Feature 005 has no
  dependency on TMDB or Feature 006 implementation to be independently accepted.

## Minimum Acceptance and Testing Strategy

`docs/testing-strategy.md` is normative. Planning MUST refine, not mechanically
expand, this bounded minimum set:

- **Current-feature real-stack owner acceptance (`F <= 9`)**:
  - **I01 — 3 identities maximum**: a voting creator plus two normal voters move
    from partial completion to a compatible result; prove complete-group input,
    genre/year semantics, convergence, reload/reconnect/re-entry, stable retry
    and zero candidate traffic/display.
  - **I02 — 4 identities maximum**: a non-voting creator plus three external
    voters reach an incompatible result through disjoint year ranges; prove zero
    creator contribution, explicit terminal behavior, status-only visibility,
    privacy, missed-update recovery and no candidate-ready handoff.
  - **I03 — 2 identities maximum**: exercise a transient resolution failure and
    lost confirmation with the same room identities; prove failure differs from
    incompatibility, no partial usable result, stable recovery and frozen inputs.
- **Permanent smoke**: inherit the current five-case G03/G04/G05/G08/H01 profile
  separately at 16 identities, updating only terminal assertions deliberately
  evolved by Feature 005 while preserving each smoke invariant.
- **Security gate**: inherit C1 separately at 1 identity with scanner zero.
- **Lower-layer authority**: exact complete-input validation, canonical genre/year
  calculation, invariant rejection, deterministic retry/concurrency behavior,
  unchanged frozen inputs, access control and private-row non-disclosure belong
  primarily to database-level evidence; parsing, state transitions, stale-result
  guards, failure presentation and no candidate calls belong primarily to client
  evidence. Browser cases prove only the representative cross-component journeys.
- **Other mandatory gates**: applicable nonempty migration and clean-reset checks,
  generated-type consistency, full database and client suites, lint, typecheck,
  build and supported exports remain required at zero browser identities.
- **R02 projection**: with `F = 9` and no targeted historical selection, the
  normal checkpoint is `1 + 16 + 9 = 26`, repeatability is
  `1 + 2 x (16 + 9) = 51`, and fresh checkout is `1 + 16 = 17` identities.
  Any targeted historical cost `T` is added once as required by the policy.

### Observable Boundaries for Later Impact Review

- Feature 004's N/N terminal presentation now continues into resolution; H01
  and the G03/G04 normal-flow assertions are already in permanent smoke and must
  preserve their intent under the new terminal states.
- The final-save/freeze-to-resolution boundary may affect H03 if the approved
  plan couples resolution to that observable transition; select H03 once as
  targeted regression only when the impact matrix confirms that risk.
- H02 is a targeted candidate only if implementation changes Feature 004's own
  recovery, retry or locked-detail behavior; resolution recovery alone does not
  justify rerunning it.
- Room-level shared-state convergence, stale-response handling and recovery are
  changed observable boundaries; database/client evidence remains primary for
  ordering and state-machine invariants, while I01/I02/I03 own the new browser flow.
- Result visibility introduces a new browser-facing privacy boundary. I02 owns
  authorized role visibility; database security evidence and permanent G08 own
  exact cross-room denial and representative ordinary-credential integration.
- Candidate suppression extends across new states but candidate authority does
  not change. Current-feature browser zero-call/display assertions plus
  database/client checks are sufficient unless the candidate access boundary is
  deliberately modified.
- Auth bootstrap, invitation decoding, QR rendering, join capacity and general
  context lifecycle are not changed by this specification; no non-smoke E/G case
  is inherited without a concrete plan-stage impact finding.

Full historical browser acceptance is not the default Feature 005 gate. It is
required only by the triggers in `docs/testing-strategy.md`, including an
explicit release checkpoint or a cross-cutting harness/Auth change.

## Resolved Product Decisions

- **Genre compatibility**: A selection is an OR-list of acceptable genres for
  that voter; the group combines those per-voter clauses with AND. Any genre is
  neutral. Literal set intersection is not used, so disjoint selections remain
  expressible through a movie carrying genres acceptable to different voters.
- **Incompatible result after freeze**: Empty inclusive year overlap produces a
  terminal incompatible state for the current room. Filters stay frozen and
  another attempt requires a new room/selection session.
- **Resolution visibility**: Authorized participant clients see only status and
  next-step meaning. Exact common years and genre clauses remain hidden, as do
  all other voters' individual filter details.

## Unresolved Decisions

None.
