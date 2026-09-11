# Feature Specification: Participant Filters

**Feature Branch**: `main` (existing branch; no feature branch created)

**Feature Number**: 004

**Feature Slug**: `participant-filters`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "After the configured voting group has assembled,
let each voter independently configure persistent, recoverable genre and
release-year filters; expose room-level completion progress and stop at the
all-voters-complete handoff to Feature 005 without showing candidates."

## Scope

### Goals

- Give every voter in the fixed assembled group an individual movie-filter
  input containing at least genres and a release-year range.
- Preserve each voter's accepted filter values and completion state across
  reload, reconnect and same-identity re-entry.
- Let authorized room members understand how many of the required voters have
  completed filter input without exposing a participant roster solely for this
  purpose.
- Establish an authoritative all-voters-complete state for exactly the fixed
  assembled voting group as the handoff boundary to Feature 005.
- Deliberately replace the normal Feature 002/003 Ready-to-fixture-candidate flow
  with assembly-to-participant-filters, while preserving unrelated membership,
  invitation, isolation, concurrency and recovery guarantees.

### Terminology

- **Voter**: A voting member admitted under Feature 003. A voting creator is a
  voter; a normal admitted voter is a voter; a non-voting creator is not.
- **Fixed assembled voting group**: The authoritative Feature 003 group whose
  admitted voter count equals the configured required voter count. Disconnecting
  does not remove a voter, and new voters are not admitted after assembly.
- **Participant filters**: One voter's own genre selection and release-year
  range for the current room selection session.
- **Filter completion**: The authoritative indication that one required voter
  has supplied filter input satisfying this feature's approved input rules.
- **Any genre**: An empty genre selection. It deliberately imposes no genre
  restriction on that voter's future common-resolution input.
- **Editable filter period**: The interval after assembly and before the room
  first reaches all-voters-complete. During it, a voter may replace only their
  own accepted filters with another valid submission. All accepted filters lock
  when the room first reaches all-voters-complete.
- **Filter progress**: The number of completed voters out of the room's fixed
  required voter count. It is a summary, not a participant roster.
- **All-voters-complete**: The room-level condition in which every member of the
  fixed assembled voting group has completed their own filter input.
- **Common resolution**: The future operation that combines all voter filters
  into compatible room constraints. It belongs to Feature 005 and is not
  performed here.
- **Candidate browsing**: Any normal product display or interaction that presents
  a movie candidate for consideration. Historical fixture infrastructure is not
  normal browsing and must not become visible merely because membership is Ready.

### Deliberate Evolution from Features 002 and 003

Feature 003 remains the authority for creator role, voting membership, required
voter count, assembly, fixed-group membership, invitations and identity recovery.
Its membership Ready state continues to mean only that the configured voting
group is assembled.

Feature 004 deliberately changes what authorized clients observe next. In the
normal product flow, Ready leads to participant-filter configuration. It no
longer reveals Feature 002's fixture candidate. Membership Ready by itself, one
voter's completion, and even all-voters-complete are each insufficient to begin
candidate browsing: Feature 005 must still resolve common filters, and Feature
006 must later supply eligible TMDB candidates.

The existing fixture-candidate foundation may remain as historical or isolated
test infrastructure. This feature does not require deleting or redesigning it,
but it must not appear in, or control, the observable normal Feature 004 flow.
Previous specifications remain valid records of their completed slices and are
not retrospectively rewritten.

### Non-Goals

This feature explicitly excludes:

- common filter intersection, compatibility or empty-intersection handling;
- room-level resolved filter constraints of any kind;
- TMDB requests, candidate acquisition, catalog synchronization or movie metadata;
- candidate display, candidate browsing, fixture rotation or candidate progression;
- swipes, independent movie decisions, agreement rules and matches;
- streaming-provider filters or provider/region selection;
- participant roster display introduced only to support filter progress;
- dynamic voting membership, late voters, removal, replacement, promotion of a
  non-voting creator, or changes to required voter count or creator voting mode;
- a TV client, permanent accounts, cross-device identity recovery, notifications,
  analytics, recommendation algorithms and administrative tooling.

No schema, endpoint, state-management library, UI widget or filter-resolution
algorithm is selected by this specification.

### Release Boundary and Feature 005 Handoff

New behavior begins only after the Feature 003 voting group is assembled. It
ends when the room authoritatively knows either that some required voters still
need to complete filters or that all required voters have completed them. The
latter state, together with the fixed group and each voter's accepted values, is
the complete handoff to Feature 005.

Feature 004 does not derive common constraints, decide whether the submitted
filters are mutually compatible, or present any candidate after that handoff.
Any visible continuation beyond the approved all-complete state is future scope.

## User Scenarios & Testing *(mandatory)*

Acceptance scenario numbers are unique across the stories. Unless a scenario
states otherwise, rooms use valid independent local participant identities and
normal connectivity. Re-entry means Feature 003 same-identity recovery, not
permanent-account or cross-device recovery.

### User Story 1 - Each Assembled Voter Configures Their Own Filters (Priority: P1)

As a voter in the assembled group, I configure my own genre and release-year
preferences so my constraints are ready for later common resolution.

**Why this priority**: Individual voter input is the feature's core value and
the prerequisite for every later filter-resolution and candidate feature.

**Independent Test**: Assemble rooms in both creator modes, including a
three-voter room. Verify which clients receive filter input, submit distinct
valid values for individual voters, and confirm ownership and completion
without performing common resolution or revealing a movie.

**Acceptance Scenarios**:

1. **Given** a voting creator in a room whose configured voting group has just
   assembled, **When** the creator observes the normal next step, **Then** they
   can configure their own genres and release-year range and no candidate is shown.
2. **Given** a normal admitted voter in an assembled room, **When** they observe
   the normal next step, **Then** they can configure their own genres and
   release-year range independently of every other voter.
3. **Given** a non-voting creator observing an assembled room, **When** the
   filter phase begins, **Then** they are not asked or permitted to contribute
   voter filters and they consume no completion slot.
4. **Given** a room still below its configured required voter count, **When** an
   admitted voter or creator observes it, **Then** membership remains Waiting,
   voter filter submission is unavailable and no candidate is shown.
5. **Given** an assembled three-voter room, **When** all three voters open the
   filter step, **Then** each can configure a distinct personal genre selection
   and release-year range without assuming a two-person host/guest pair.
6. **Given** an assembled voter selects any allowed genres or leaves genre
   selection empty for Any genre, and supplies an inclusive range from 1900
   through the current calendar year, **When** their submission is accepted,
   **Then** exactly that voter becomes complete and their accepted values become
   their room filters. The untouched default is Any genre and the full allowed
   year range.
7. **Given** an assembled voter supplies an unknown genre, a year outside 1900
   through the current calendar year, an omitted year endpoint or a lower year
   greater than the upper year, **When** they attempt submission, **Then** they
   receive understandable corrective feedback, remain incomplete if they had
   not completed before, and no invalid values become accepted room input.
8. **Given** one voter has completed filters, **When** another voter opens or
   submits their own filter input, **Then** the second voter's initial and
   accepted values are not silently copied from or written into the first voter's filters.
9. **Given** an assembled voter manipulates their local client to identify
   another voter as the target, **When** they attempt to submit filters, **Then**
   they can affect only their own filter values and completion state.
10. **Given** membership is Ready but zero, some or all voters have completed
    filters, **When** any authorized room client views the normal flow, **Then**
    no fixture or other movie candidate is presented for browsing.

---

### User Story 2 - Personal Filters Survive Recovery and Concurrent Activity (Priority: P1)

As a voter, I recover my own accepted filters and completion after interruption
so reloading or reconnecting does not make me repeat or lose my input.

**Why this priority**: Filters cannot be a dependable input to Feature 005 if
identity recovery, retries or concurrent voters can lose, duplicate or exchange them.

**Independent Test**: Submit distinct filters from several voters, then reload,
disconnect/reconnect and re-enter each same-identity client. Exercise duplicate,
overlapping, failed and lost-confirmation submissions and verify stable personal
values, ownership and completion counts.

**Acceptance Scenarios**:

11. **Given** a voter has an accepted filter submission, **When** they reload,
    **Then** they recover their own accepted genre and year values and remain complete.
12. **Given** a voter has an accepted filter submission, **When** they disconnect
    and later reconnect, **Then** filter ownership, accepted values and completion
    remain attached to the same voting membership.
13. **Given** a voter has an accepted filter submission, **When** the same local
    identity re-enters through a room link, QR-derived invitation or code,
    **Then** they recover that existing membership and its filters without
    creating another voter or completion slot.
14. **Given** an assembled voter has not completed filters, **When** they
    disconnect while other voters submit, **Then** they remain a required,
    incomplete member of the fixed group and reconnect as that same owner.
15. **Given** the same voter repeats or overlaps the same submission action,
    **When** the attempts are processed, **Then** the room records at most one
    completed voter and one current accepted filter set for that membership.
16. **Given** two or more distinct voters submit valid filters concurrently,
    **When** their actions succeed, **Then** each submission is associated with
    its correct owner and room progress increases once per newly completed voter.
17. **Given** a submission was accepted but its confirmation did not reach the
    voter, **When** the same identity retries or recovers the room, **Then** they
    recover the accepted values and completed status rather than creating a duplicate.
18. **Given** a submission fails before acceptance, **When** the failure is
    shown, **Then** previously accepted filters and all voters' completion states
    remain unchanged, and a later valid retry can succeed.
19. **Given** a voter already has accepted filters and the room is not yet
    all-voters-complete, **When** that voter submits a valid replacement, **Then**
    their own accepted values are replaced and they remain complete; another
    voter's submission, retry, failure or reconnect cannot change those values,
    and an invalid replacement leaves the last accepted values intact.
20. **Given** a person authorized only for another room, **When** they guess or
    substitute internal room or participant information, **Then** they cannot
    read or change this room's filter values or completion state.
21. **Given** a non-voting creator manipulates local state or an invitation,
    **When** they attempt to submit voter filters, **Then** they remain non-voting,
    no filter ownership is created and room progress does not change.

---

### User Story 3 - The Room Tracks Completion and Stops at the Next-Feature Boundary (Priority: P2)

As an authorized room member, I can understand the group's filter-completion
progress so I know whether the fixed voting group is still preparing or is
ready for future common resolution.

**Why this priority**: Room-level completion is the bounded output of this
feature, but it depends on the individual filter behavior in Story 1.

**Independent Test**: Start from an assembled room with prepared accepted
filters, transition progress from zero through the required voter count in
two- and three-voter rooms, and verify automatic convergence, recovery and the
absence of candidate/common-resolution behavior.

**Acceptance Scenarios**:

22. **Given** an assembled room with no completed voter filters, **When** an
    authorized voter or non-voting creator views it, **Then** they see zero
    completed out of the fixed required voter count without seeing another
    voter's filter details or a participant roster solely for progress.
23. **Given** an assembled room with some but not all voter filters complete,
    **When** a completed voter observes it, **Then** they see their own saved
    values, an understandable saved-and-waiting state and the shared completed
    count over the required count; every other authorized room member sees that
    same progress but not the completed voter's filter details.
24. **Given** a three-voter room, **When** the first and second voters complete
    filters independently, **Then** authoritative progress becomes 1 of 3 and
    then 2 of 3 while the room remains not ready for Feature 005.
25. **Given** exactly one incomplete voter remains, **When** that voter completes
    valid filters, **Then** progress reaches the required count exactly once,
    the room becomes all-voters-complete and every accepted filter set becomes
    locked against further editing for this selection session.
26. **Given** the final two incomplete voters submit concurrently in a room with
    more than two voters, **When** both succeed, **Then** progress never exceeds
    the fixed required voter count and all authorized clients converge on
    all-voters-complete.
27. **Given** a non-voting creator observes progress while voters complete
    filters, **When** the last voter completes, **Then** the creator remains
    outside the numerator and denominator contribution rules and, like every
    authorized room member, sees that all filters are collected and common
    resolution is the next step, without seeing individual filter details.
28. **Given** an all-voters-complete room, **When** any voter or non-voting
    creator reloads, reconnects or re-enters with the same identity, **Then** the
    room remains all-voters-complete with the same fixed group and filter ownership.
29. **Given** all voters have completed filters, **When** the Feature 004 flow
    reaches its endpoint, **Then** every authorized room member sees an
    understandable all-filters-collected state identifying common resolution as
    the next step, without automatic continuation, while the room provides the
    durable handoff condition for Feature 005 and does not calculate common
    constraints or assess compatibility.
30. **Given** zero, some or all voters have completed filters, **When** the room
    state changes or a client recovers, **Then** no candidate browsing, swipe,
    progression or match interaction begins.
31. **Given** an assembled room, **When** a new person attempts to join as a voter,
    **Then** Feature 003's fixed-group rejection remains authoritative and neither
    filter ownership nor completion progress changes.

### Edge Cases

- A voter loads a stale pre-assembly view while the final member assembles the
  group: authoritative membership determines when filter input becomes available.
- A voting creator and another voter submit at the same time: each can complete
  only their own fixed membership, and progress counts each at most once.
- The last incomplete voter loses the success confirmation: recovery must reveal
  whether completion was accepted without creating a second completion.
- A disconnected incomplete voter keeps the room below all-voters-complete even
  when every currently connected voter has submitted.
- A disconnected completed voter continues to count because connection status
  does not redefine the fixed voting group.
- An accepted filter set contains a boundary year or genre combination: validity
  follows the clarified rules and is identical before and after recovery.
- A client holds locally changed values while authoritative accepted values exist:
  the product must not silently report the local changes as accepted.
- A voter attempts to edit after the room first becomes all-voters-complete: the
  locked accepted values and completion progress remain unchanged.
- An old fixture candidate already exists for a room created under completed
  infrastructure: it is not shown as part of the normal filter-first flow and
  does not satisfy the Feature 005 handoff.
- Room progress changes while an observer misses an update: recovery converges
  on the authoritative count without manual room recreation or a roster.
- An unauthorized client probes success and failure paths: neither path may
  disclose another voter's filter values, participant identity or room-private state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Participant-filter input MUST become available only after the room's
  configured voting group is assembled under Feature 003.
- **FR-002**: Membership Ready MUST remain distinct from filter completion and
  MUST NOT by itself authorize or display candidate browsing.
- **FR-003**: Every voter in the fixed assembled group, including a voting creator,
  MUST be able to configure exactly one personal filter set for the room.
- **FR-004**: Every normal admitted voter MUST receive the same filter capabilities
  and ownership rules as a voting creator; behavior MUST NOT assume exactly two voters.
- **FR-005**: A non-voting creator MUST NOT be asked or permitted to contribute
  voter filters, own a voter filter set or count toward filter completion.
- **FR-006**: The participant-filter surface MUST include genre selection and a
  release-year range.
- **FR-007**: Genre input MUST use this fixed temporary pre-TMDB vocabulary,
  based on the TMDB movie-genre categories: Action, Adventure, Animation,
  Comedy, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Music,
  Mystery, Romance, Science Fiction, TV Movie, Thriller, War and Western. A
  voter MAY select any combination without duplicates. An empty selection MUST
  be valid, MUST mean Any genre and MUST be the default; it MUST NOT be replaced
  silently with all individual genres.
- **FR-008**: The release-year range MUST be inclusive, MUST allow values from
  1900 through the current calendar year, and MUST default to that full allowed
  range. Both endpoints MUST be present; neither side is unbounded. Before the
  room first reaches all-voters-complete, a completed voter MUST be able to
  replace only their own accepted filters with another valid submission. Once
  the room reaches all-voters-complete, every accepted filter set MUST lock for
  the selection session.
- **FR-009**: A release-year range with both endpoints MUST reject a lower bound
  greater than its upper bound; any additional completeness and boundary rules
  are governed by FR-008.
- **FR-010**: Invalid or incomplete input MUST produce understandable corrective
  feedback, MUST NOT become the voter's accepted filters and MUST NOT mark the
  voter complete.
- **FR-011**: On accepted submission, the system MUST associate the filter values
  and completion with the authenticated caller's existing voting membership,
  never with a participant identifier supplied only by the client.
- **FR-012**: One voter MUST NOT be able to create, replace or complete another
  voter's filter set through normal interaction, local manipulation or retries.
- **FR-013**: Accepted filter values and completion MUST persist for the room
  selection session and be recoverable by the same local participant identity
  after reload, reconnect and re-entry.
- **FR-014**: Temporary disconnect MUST NOT change filter ownership, accepted
  values or completion and MUST NOT remove an incomplete voter from the required group.
- **FR-015**: The product MUST distinguish local unaccepted input from the
  voter's authoritative accepted filters and MUST NOT present unaccepted changes
  as durable or include them in completion.
- **FR-016**: Repeated, duplicate or overlapping submissions by one voter MUST
  leave at most one current accepted filter set and one completion contribution
  for that voter.
- **FR-017**: Distinct voters MUST be able to submit independently, including
  concurrently, without swapping, merging or overwriting one another's values.
- **FR-018**: A failed submission before acceptance MUST leave every authoritative
  filter set and completion contribution unchanged and provide a recoverable result.
- **FR-019**: If acceptance succeeds but confirmation is lost, same-identity
  retry or recovery MUST reveal the accepted filter set and MUST NOT add another
  completion contribution.
- **FR-020**: The room MUST authoritatively determine filter progress as the
  number of distinct completed memberships in the fixed assembled voting group
  out of the configured required voter count.
- **FR-021**: After accepted submission while others remain incomplete, the
  submitting voter MUST see their own saved values, an understandable indication
  that their filters are saved and they are waiting for others, and shared
  progress as completed voters over required voters. Other authorized room
  members MUST see the same progress but MUST NOT see that voter's filter details.
  At all-voters-complete, every authorized room member MUST see that all filters
  are collected and that common resolution is the next step, without automatic
  continuation or candidate display. Exact wording is a presentation choice,
  but these meanings MUST remain unambiguous.
- **FR-022**: Authorized room members MUST be able to understand the current
  completed count and required count without a participant roster introduced
  solely for filter progress.
- **FR-023**: Progress MUST count each voting membership at most once, MUST
  exclude non-voting creators and connected devices, and MUST never exceed the
  fixed required voter count.
- **FR-024**: The room MUST become all-voters-complete exactly when every member
  of the fixed assembled group has an accepted complete filter set under the
  approved rules. That transition MUST lock all accepted filter sets and MUST
  NOT be reversed by a later edit attempt or connection change.
- **FR-025**: Existing authorized room clients MUST converge on authoritative
  filter progress and all-voters-complete after accepted submissions without
  manual refresh or room recreation under normal connectivity.
- **FR-026**: Reload, reconnect and same-identity re-entry MUST recover the
  authoritative progress and all-voters-complete state as well as the caller's
  own accepted filters where applicable.
- **FR-027**: Feature 003's required voter count, creator voting choice, admitted
  memberships and fixed assembled group MUST remain authoritative throughout
  filter configuration and recovery.
- **FR-028**: An attempted late voting join, creator-mode change, required-count
  change or local membership manipulation MUST NOT create filter ownership,
  invalidate existing filters or alter completion progress.
- **FR-029**: Unauthorized people MUST NOT read or change room-private filter
  state or completion by guessing identifiers or substituting unrelated local data.
- **FR-030**: Participant-facing filter and progress displays and failures MUST
  NOT expose internal user/Auth identifiers.
- **FR-031**: The normal product flow after assembly MUST lead to participant
  filters and MUST NOT show Feature 002's fixture candidate at Ready, during
  partial filter completion or at the all-voters-complete boundary.
- **FR-032**: All-voters-complete MUST be a durable handoff condition to Feature
  005 and MUST NOT trigger common filter resolution in this feature.
- **FR-033**: Feature 004 MUST NOT fetch TMDB data, acquire a production candidate,
  determine candidate eligibility or implement candidate interaction/progression.
- **FR-034**: QR, invitation-link and code joining and all existing creator/voter
  re-entry behavior MUST remain governed by Feature 003; filter work MUST NOT
  create a separate identity or invitation model.
- **FR-035**: Historical fixture-candidate infrastructure MAY remain for
  isolated compatibility tests, but it MUST NOT be exposed as the observable
  normal flow or treated as evidence that filter or Feature 005 prerequisites
  have been satisfied.

### Non-Functional Requirements

- **NFR-001 — Consistency**: Under normal connectivity, authorized clients MUST
  converge on the same completion count and all-voters-complete condition after
  successful submission and recovery, including groups with more than two voters.
- **NFR-002 — Ownership and concurrency safety**: Sequential, repeated and
  concurrent operations MUST preserve one owner, one current accepted filter set
  and at most one completion contribution per voting membership.
- **NFR-003 — Security and isolation**: Access MUST be denied by default outside
  authorized room membership. A voter may recover only their own filter details;
  other voters and non-voting creators receive room-level progress but no other
  voter's filter details. No caller may gain authority to act for another voter.
- **NFR-004 — Recoverability**: Every accepted filter set and completion state
  MUST survive reload, temporary disconnection and same-identity re-entry without
  requiring a permanent account or continuous connection.
- **NFR-005 — Usability**: Voters MUST be able to distinguish membership Waiting,
  their filter-input step, validation failure, accepted personal completion and
  room-level completion progress without internal identifiers or movie content.
- **NFR-006 — Baseline continuity**: The feature MUST preserve Feature 003's
  generalized membership, invitation, RLS/isolation, duplicate/concurrent-operation
  and recovery guarantees. It introduces no observable need for a roster or a
  departure from the established single rooms-only Realtime observation model.

### Key Entities

- **Participant filter set**: One fixed voting membership's accepted genre and
  release-year values for one room, together with its completion status. It has
  exactly one voter owner and no non-voting owner.
- **Filter completion contribution**: Whether one member of the fixed assembled
  group currently satisfies the approved participant-filter completion rules.
- **Room filter progress**: The authoritative completed-voter count over the
  room's fixed required voter count, excluding non-voting clients and connection state.
- **All-voters-complete state**: The condition that every fixed voting membership
  has a complete accepted filter set; it is the output boundary for Feature 005,
  not a resolved common filter or candidate-ready state.
- **Fixed assembled voting group**: The unchanged Feature 003 membership set
  that defines filter owners and the completion denominator.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every tested assembled room, 100% of voting creators and normal
  admitted voters can submit their own valid genres and year range, while 0%
  of non-voting creators can contribute a filter set or completion slot.
- **SC-002**: Two-voter and three-voter rooms report exact completion progress
  from 0 through their configured required voter count, never below zero or
  above the fixed count.
- **SC-003**: In 100% of tested reload, reconnect and same-identity re-entry
  scenarios, a voter's accepted filter values, ownership and completion are
  recovered without another voting membership or completion contribution.
- **SC-004**: Across every tested sequential, duplicate and concurrent submission
  scenario, each voting membership has at most one current filter set and each
  newly completed voter changes progress at most once.
- **SC-005**: In every tested cross-voter and cross-room manipulation scenario,
  there are zero unauthorized filter reads, filter writes, ownership changes or
  completion changes.
- **SC-006**: Under normal connectivity, every authorized client in tested two-
  and three-voter rooms observes the correct completion count and final
  all-voters-complete state without manual refresh or room recreation.
- **SC-007**: In every tested disconnected-voter scenario, the voter retains
  their fixed membership and prior completion status; connection changes alone
  cause zero filter ownership or progress changes.
- **SC-008**: Invalid filter submissions are rejected in 100% of boundary cases
  defined by the approved genre and year rules, with zero invalid accepted sets
  and zero false completion contributions. Empty genre selections are accepted
  as Any genre, while unknown genres, missing year endpoints, reversed ranges
  and years outside 1900 through the current year are rejected.
- **SC-009**: Across all Feature 004 acceptance scenarios, zero normal product
  screens show a fixture or production movie candidate before, during or after
  participant-filter completion.
- **SC-010**: The all-voters-complete output contains sufficient durable state
  for every fixed voter and is recoverable in 100% of handoff tests, while zero
  Feature 004 tests require common resolution or candidate acquisition to pass.
- **SC-011**: Feature 004 acceptance covers at least one voting-creator room, one
  non-voting-creator room and one room with three voters, with the same ownership,
  progress and recovery invariants in each applicable role.
- **SC-012**: The feature introduces zero participant roster views, dynamic
  membership operations, TMDB calls, swipe/progression/match interactions or
  streaming-provider behavior.
- **SC-013**: Before all-voters-complete, 100% of valid own-filter edits replace
  only the submitting voter's accepted values without changing their one
  completion contribution; after all-voters-complete, 100% of edit attempts
  leave every accepted value and the completion state unchanged.
- **SC-014**: In every visibility acceptance scenario, a voter can recover their
  own accepted values, while other voters and non-voting creators receive only
  the shared completion count and all-complete meaning, with zero disclosure of
  another voter's filter details.

## Assumptions

- Features 001–003 are complete at baseline
  `c0801694c0685f165c2132a9e1ea216265ad128b`; Feature 003 is the current runtime
  and product baseline for room access, membership, invitations and recovery.
- The existing local participant identity remains the continuity boundary.
  Same-session recovery is supported; a fresh independent session or device is
  not assumed to recover another person's voting membership or filters.
- Normal connectivity exists except in scenarios explicitly exercising failure
  or disconnection. Voting membership and accepted filter state do not depend on
  continuous presence.
- A filter becomes authoritative only through an accepted submission. This
  feature does not promise recovery of unaccepted local draft input.
- Progress can be communicated as a completed count over the required count;
  participant names or a roster are not necessary for the required behavior.
- Feature 005 will consume the fixed voting group and accepted participant
  filters but may not assume compatibility until it performs its own approved
  common-resolution behavior.

## Dependencies and Preserved Guarantees

- The [constitution](../../.specify/memory/constitution.md),
  [product vision](../../docs/product-vision.md) and
  [MVP roadmap](../../docs/mvp-roadmap.md) govern scope and product intent.
- [Feature 003](../003-generalized-room-membership-qr/spec.md) supplies the
  generalized fixed voting group, voting/non-voting creator distinction,
  join/re-entry/reconnect behavior, invitation paths, capacity safety and room
  isolation. Those guarantees remain authoritative and are not weakened here.
- Feature 002's candidate authority/recovery work remains historical foundation,
  but its immediate Ready-to-fixture display is the precise observable behavior
  deliberately superseded by this feature's filter-first flow.
- Downstream planning and validation must retain Feature 003's approved security
  and reproducibility constraints, including C1, R01 and R02, with no exception
  authorized by this specification.
- No approved observable behavior in this feature requires a participant roster
  or a second state-delivery channel. The existing one rooms-only Realtime
  architecture remains the inherited planning baseline unless a separately
  approved specification establishes a genuine observable need to change it.
- Feature 005 depends on this feature's accepted per-voter values, completion
  ownership, fixed denominator and durable all-voters-complete state. Feature
  004 has no dependency on Feature 005 implementation to be independently tested.

## Resolved Product Decisions

- **Genre semantics and vocabulary**: An empty selection means Any genre. The
  filter uses the fixed 19-category temporary vocabulary listed in FR-007,
  chosen for direct future mapping to TMDB movie genres without fetching TMDB
  data in this feature.
- **Year and edit policy**: The inclusive allowed and default range is 1900
  through the current calendar year, with both endpoints required. A voter can
  replace their own accepted filters until the room first becomes
  all-voters-complete; that transition locks all filters.
- **Post-submission UX and privacy**: A completed voter sees their own saved
  values, saved/waiting meaning and shared X/N progress. Other authorized members
  see progress only. At completion, everyone sees that filters are collected
  and common resolution is next, with no automatic continuation or candidate.

No unresolved product decision remains at the Feature 004 specification level.
Common resolution and all candidate behavior remain later-feature decisions.
