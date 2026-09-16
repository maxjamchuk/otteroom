# Feature Specification: Swipe Decisions

**Feature Branch**: `main` (existing branch; no feature branch created)

**Feature Number**: 007

**Feature Slug**: `swipe-decisions`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Let every voter in the fixed assembled room
independently swipe right/yes or left/no on the one shared current canonical
TMDB candidate, with exactly one authoritative durable decision per voter and
candidate, safe duplicate handling, mobile-first interaction, equivalent web
use, and two-voter agreement when both vote yes."

## Scope

### Goals

- Let every member of the fixed assembled voting group independently decide
  whether they want to watch the room's current authoritative TMDB candidate.
- Map right to yes/wants to watch and left to no/does not want to watch, with a
  mobile-first gesture and an equivalent usable web interaction.
- Preserve exactly one authoritative decision for each voter and current
  candidate across repeated input, concurrent input, response loss, reload,
  reconnect and same-identity re-entry.
- Keep the candidate room-scoped and shared while voters decide independently;
  recording any decision must neither select nor advance a movie.
- Establish that exactly two yes decisions from the two voters in a two-voter
  room constitute agreement, without implementing progression or final match UX.

### Terminology and State Meanings

- **Voting participant / voter**: A member of the fixed assembled voting group
  established by Feature 003. A voting creator is a voter; a non-voting creator
  is an authorized room observer but is not a voter and cannot decide.
- **Current canonical candidate**: The one authoritative TMDB movie identity
  assigned to the room by Feature 006. It is the only decision target. A title,
  poster, client-selected identity or local copy is not a separate candidate.
- **Decision**: One voter's authoritative answer for the current canonical
  candidate. `yes` means wants to watch and is expressed by swiping right;
  `no` means does not want to watch and is expressed by swiping left.
- **Decision pending locally**: The voter has initiated an interaction, but the
  system has not yet confirmed which authoritative decision, if any, was
  accepted. A pending presentation is not proof that a decision exists.
- **Accepted decision**: The first valid `yes` or `no` committed for the voter
  and current candidate. It is final for this candidate in Feature 007.
  Identical retries recover it; a later conflicting value cannot replace it.
- **Decision set complete**: Every voter in the fixed assembled group has one
  accepted decision for the same current candidate. Completion records no
  progression and does not itself define agreement for rooms larger than two.
- **Two-voter agreement**: In a room whose fixed group contains exactly two
  voters, both voters have accepted `yes` for the same current candidate.
  Any incomplete set, or a complete set containing `no`, is not agreement.
- **Same-identity recovery**: The local participant continuity already defined
  by Features 001 and 003. Permanent accounts and transfer to a new device are
  not introduced here.

### Feature 006 to Feature 007 Handoff

Feature 007 consumes, but does not alter, Feature 006's successful output:

- a decision is accepted only when the room has one authoritative current TMDB
  candidate and the caller is one of the room's fixed voters;
- the decision is bound to that authoritative room candidate, never to a
  caller-chosen movie or descriptive metadata;
- rooms still acquiring a candidate, in an authoritative no-candidate state,
  or without an assignment have no decision target and expose no active voting
  interaction;
- a temporary poster failure or explicit no-poster fallback does not create a
  second identity; title/year remain attached to the same decision target; and
- a decision cannot trigger candidate acquisition, reassignment, replacement,
  or another TMDB Discover operation.

Feature 006 remains authoritative for candidate identity and minimum movie
presentation. Feature 007 adds only voter-owned decisions associated with that
identity.

### Release Boundary and Non-Goals

This release begins when a fixed voter sees the shared current candidate and
ends when their decision is authoritatively recorded or a safe recoverable
outcome explains why it was not. The room may end this feature with an
incomplete or complete decision set. The current candidate remains unchanged.

This feature explicitly excludes:

- acquiring, choosing, advancing to, or presenting a next candidate;
- candidate queues, history, skip behavior, re-presentation rules and deck
  exhaustion, all of which belong to Feature 008 or later;
- an agreement threshold or policy for rooms with more than two voters;
- final match celebration, match details, shared-choice UX or post-match actions,
  which belong to Feature 009;
- changing TMDB acquisition, eligibility, metadata authority, current Discover
  sorting, pagination, attribution or Feature 006 failure semantics;
- changing the fixed voting group, adding late voters, removing or replacing a
  voter, or changing creator voting status;
- editing or retracting an accepted decision for the current candidate;
- permanent accounts, cross-device identity transfer, notifications, analytics,
  TV-specific interaction, haptics or a particular gesture/animation library;
  and
- any particular persistence schema, transport, endpoint, realtime mechanism,
  client framework or concurrency implementation.

## User Scenarios & Testing *(mandatory)*

Scenario numbers are unique across stories. Unless a scenario states otherwise,
the room has completed Features 003-006, has a fixed assembled voting group,
and all participants observe the same authoritative TMDB candidate. Re-entry
uses the same local identity.

### User Story 1 - Decide on the Shared Candidate (Priority: P1)

As a voter, I swipe right or left on the room's current movie so my own answer
is recorded without waiting for anyone else.

**Why this priority**: An independent authoritative yes/no decision is the core
value of this feature and the prerequisite for later progression.

**Independent Test**: Open the same two-voter room in two independent clients,
verify the candidate identity matches, then submit right/yes on one client and
left/no on the other in either order. Each client must receive its own accepted
answer without waiting for the other, and the candidate must not change.

**Acceptance Scenarios**:

1. **Given** a voter viewing the current canonical candidate, **When** they
   complete a right swipe, **Then** one `yes` decision is accepted for that voter
   and candidate and the recorded result is understandable without relying only
   on color or motion.
2. **Given** a voter viewing the current canonical candidate, **When** they
   complete a left swipe, **Then** one `no` decision is accepted for that voter
   and candidate and the recorded result is understandable without relying only
   on color or motion.
3. **Given** one voter has not decided, **When** another voter submits either
   answer, **Then** the submitter's decision can be accepted and confirmed
   without the other voter submitting, being connected or responding.
4. **Given** two voters viewing the room concurrently, **When** they submit
   different answers in either order, **Then** both voter-owned decisions are
   preserved, neither overwrites the other, and both clients continue to
   identify the same unchanged candidate.
5. **Given** a voting creator, **When** they decide, **Then** their decision has
   the same ownership and authority as any other fixed voter's decision.
6. **Given** a non-voting creator observing the candidate, **When** they use the
   room, **Then** no voting interaction lets them create a decision and their
   presence does not count toward decision completion.

---

### User Story 2 - Submit Once Without Duplicate or Conflicting State (Priority: P1)

As a voter, I get one stable answer for this candidate even if an action is
repeated, races, or its confirmation is lost.

**Why this priority**: A decision set cannot drive reliable future progression
unless retries and concurrent inputs converge on one authoritative value.

**Independent Test**: For one voter/candidate pair, exercise duplicate yes
submissions, overlapping yes/no submissions, a lost success response and a
later retry. Verify exactly one accepted decision exists and every recovery
returns the winning value without changing the candidate.

**Acceptance Scenarios**:

7. **Given** a voter has an accepted `yes`, **When** the same submission is
   repeated sequentially or concurrently, **Then** it succeeds as recovery of
   that same decision and creates no additional or divergent decision.
8. **Given** a voter has an accepted `no`, **When** the same submission is
   repeated sequentially or concurrently, **Then** it succeeds as recovery of
   that same decision and creates no additional or divergent decision.
9. **Given** no accepted decision for a voter/candidate pair, **When** `yes` and
   `no` submissions overlap, **Then** exactly one value becomes authoritative,
   the other cannot replace it, and subsequent reads return the winner.
10. **Given** a voter already has an accepted decision, **When** they attempt the
    opposite answer, **Then** the stored answer remains unchanged and the voter
    is shown the authoritative result rather than a false success for the
    conflicting answer.
11. **Given** a decision committed but its confirmation was lost, **When** the
    voter retries or restores the room, **Then** the accepted value is recovered
    and no second decision is created.
12. **Given** a submission fails before acceptance, **When** the voter sees the
    outcome, **Then** the interface does not claim an authoritative answer,
    preserves the same candidate, and offers a safe retry or reconciliation.

---

### User Story 3 - Recover Decisions and Preserve Room Convergence (Priority: P1)

As a voter, I recover my accepted answer after interruption while everyone in
the room remains on the same movie.

**Why this priority**: Durable personal decisions and a shared candidate are
the observable evidence that independent clients contribute to one room state.

**Independent Test**: Have two independent clients decide on the same candidate,
then reload one, disconnect/reconnect the other, miss an update, and re-enter
with the same identities. Verify that each recovers its own value and both still
show the original candidate identity.

**Acceptance Scenarios**:

13. **Given** a voter has an accepted decision, **When** they reload, reconnect
    or re-enter the room with the same identity, **Then** their accepted value
    and the same canonical candidate are restored without resubmission.
14. **Given** a voter missed the decision confirmation or a room update, **When**
    canonical synchronization completes, **Then** the stored decision is
    recovered without depending on the missed notification.
15. **Given** different voters decide while one or more clients are temporarily
    disconnected, **When** those clients reconnect, **Then** no voter-owned
    decision is lost or attributed to another voter and no client receives a
    different candidate.
16. **Given** stale success, failure or pending state from an earlier room or
    candidate generation, **When** the active room is restored, **Then** the
    stale state cannot create, replace, hide or mislabel the active voter's
    authoritative decision.
17. **Given** a caller is not the fixed voter they claim to represent or belongs
    to another room, **When** they try to read or submit a decision, **Then** they
    cannot learn or change that voter's decision or the room's decision state.
18. **Given** the room has no authoritative candidate assignment, **When** a
    voter opens or restores it, **Then** no active yes/no decision can be
    submitted or presented as accepted.

---

### User Story 4 - Use Mobile-First and Equivalent Web Controls (Priority: P2)

As a voter, I can clearly make the same yes/no choice on a touch-oriented mobile
surface or on the functional web version.

**Why this priority**: Swiping is the intended primary interaction, while web
must remain usable for access, development, testing and accessibility.

**Independent Test**: At a mobile-sized touch viewport, complete right and left
gestures and verify their mappings. At a desktop web viewport, complete both
answers using visible non-gesture controls and keyboard navigation, then compare
the resulting authoritative values.

**Acceptance Scenarios**:

19. **Given** the mobile-first candidate surface, **When** a voter performs a
    completed right or left gesture, **Then** the direction maps unambiguously to
    yes or no respectively, and an incomplete or cancelled gesture submits
    nothing.
20. **Given** a voter cannot or does not use a swipe gesture, **When** they use
    the explicit yes/no controls, **Then** they can record the same authoritative
    values with the same duplicate, error and recovery behavior.
21. **Given** a keyboard-operated web client, **When** the voter navigates and
    activates the yes/no controls, **Then** both actions are reachable, labeled
    with their meaning, and do not depend on drag input.
22. **Given** submission is in progress or has resolved, **When** the voter
    observes the surface, **Then** pending, accepted yes, accepted no and
    recoverable failure are distinguishable without relying solely on gesture,
    animation, position or color.

---

### User Story 5 - Establish Two-Voter Agreement Without Progression (Priority: P2)

As a two-voter room, we have an unambiguous agreement fact when both of us want
to watch the current movie, ready for later features to consume.

**Why this priority**: The two-person rule is a product invariant, but this slice
must not cross into candidate progression or final match presentation.

**Independent Test**: In separate two-voter rooms, record yes/yes, yes/no and an
incomplete single-yes set. Verify only yes/yes constitutes agreement and every
room retains its original candidate with no match UX or next candidate.

**Acceptance Scenarios**:

23. **Given** exactly two fixed voters and one accepted `yes` each for the same
    current candidate, **When** the authoritative decision set is evaluated,
    **Then** it constitutes agreement for that candidate.
24. **Given** exactly two fixed voters and a complete decision set containing at
    least one `no`, **When** the set is evaluated, **Then** it does not constitute
    agreement and Feature 007 neither advances nor replaces the candidate.
25. **Given** exactly two fixed voters but only one has decided, **When** the set
    is evaluated, **Then** it is incomplete, does not yet constitute agreement,
    and the accepted voter decision remains final and recoverable.
26. **Given** more than two fixed voters, **When** any or all submit decisions,
    **Then** their decisions and completion state may be recorded, but Feature
    007 derives no group agreement outcome and performs no progression.

### Edge Cases

- The voter releases a gesture before it qualifies as an intentional swipe;
  nothing is submitted and the same candidate remains ready for input.
- A voter taps an explicit control while a gesture submission is already in
  progress; both inputs are treated as repeated or conflicting attempts for the
  same voter/candidate pair and still produce at most one accepted value.
- Two devices or tabs using the same local voter identity submit the same or
  opposite values simultaneously; exactly one authoritative value is recovered
  on both.
- Two different voters submit at the same instant; both independent decisions
  can commit without either waiting for or overwriting the other.
- The decision confirmation is lost after acceptance; reconciliation recovers
  the stored value rather than inviting a contradictory replacement.
- The current candidate has an explicit no-poster fallback or a poster transport
  failure; the same identity remains the decision target and no replacement is
  requested.
- Candidate metadata is unavailable such that the movie cannot be recognized;
  the active voting surface is withheld until the same candidate can again be
  presented, and no speculative decision is shown as accepted.
- The room is in acquisition-pending, no-candidate or acquisition-failure state;
  no decision target or active voting interaction exists.
- A late or cross-room event refers to another candidate or participant; it is
  ignored and cannot alter current room state.
- A non-voting creator opens the room on multiple devices; this creates no voter
  slot and no decision.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST accept decisions only from members of the room's
  fixed assembled voting group; a voting creator is eligible and a non-voting
  creator is not.
- **FR-002**: The only valid target MUST be the room's authoritative current
  Feature 006 TMDB candidate identity.
- **FR-003**: A room without an authoritative current candidate MUST expose no
  active decision submission and MUST accept no decision.
- **FR-004**: Every eligible voter MUST be able to submit `yes` or `no` without
  waiting for another voter to decide, connect or acknowledge the action.
- **FR-005**: A completed right swipe MUST mean `yes`/wants to watch, and a
  completed left swipe MUST mean `no`/does not want to watch.
- **FR-006**: Incomplete or cancelled gestures MUST create no decision.
- **FR-007**: Explicit non-gesture yes/no controls MUST provide values and
  authority semantics equivalent to the swipe interaction.
- **FR-008**: Each voter/current-candidate pair MUST have at most one accepted
  authoritative decision and, after first acceptance, exactly that one value.
- **FR-009**: The first accepted decision for a voter/current-candidate pair
  MUST be final within Feature 007 and MUST NOT be edited, retracted or replaced.
- **FR-010**: Sequential and concurrent repetitions of the accepted value MUST
  recover that decision and MUST NOT create an additional authoritative
  decision or divergent participant-visible state.
- **FR-011**: Sequential or concurrent submission of the opposite value MUST NOT
  replace an accepted decision; the caller MUST reconcile to the stored value.
- **FR-012**: If opposite values race before either is accepted, exactly one MUST
  become authoritative and all subsequent reads/retries MUST return that winner.
- **FR-013**: Decisions from different voters MUST remain independently owned,
  and concurrent acceptance of one MUST NOT block, overwrite or misattribute
  another voter's decision.
- **FR-014**: Accepted decisions MUST survive reload, reconnect, same-identity
  re-entry, missed updates, response loss and retry.
- **FR-015**: Recovery MUST read authoritative room state and MUST NOT depend on
  receiving every live update or retaining optimistic local state.
- **FR-016**: A failure before acceptance MUST create no authoritative decision
  and MUST produce a safe, understandable retry or reconciliation path.
- **FR-017**: A lost response after acceptance MUST recover the committed value
  without creating or inviting an alternate decision.
- **FR-018**: Every voter and authorized observer MUST continue to identify the
  same unchanged room candidate before, during and after decision submission.
- **FR-019**: A decision submission, retry or recovery MUST NOT acquire, assign,
  advance, replace or locally select a candidate.
- **FR-020**: Stale, foreign-room, foreign-voter or non-current-candidate input
  MUST NOT create, replace, hide or mislabel an active decision.
- **FR-021**: A caller MUST be authorized as the voter who owns the submitted
  decision; caller-supplied room, voter or movie identity MUST NOT override
  authoritative membership and candidate state.
- **FR-022**: Unauthorized and cross-room callers MUST NOT read or change an
  individual's decision or protected room decision state.
- **FR-023**: Each voter MUST be able to see whether their own decision is
  pending, accepted as yes, accepted as no, absent or in recoverable failure.
- **FR-024**: Feature 007 MUST NOT disclose another voter's individual decision
  value. A room-level two-voter agreement fact may be exposed without exposing
  a separately attributed decision.
- **FR-025**: Decision presentation MUST be understandable without exposing
  internal participant identifiers, persistence identifiers or raw failures.
- **FR-026**: The decision set MUST be complete exactly when every member of the
  fixed assembled voting group has one accepted decision for the same current
  candidate; non-voters and connection status MUST NOT change that calculation.
- **FR-027**: For a room with exactly two fixed voters, agreement MUST be true
  exactly when both accepted decisions for the current candidate are `yes`.
- **FR-028**: An incomplete two-voter decision set or a complete set containing
  `no` MUST NOT be treated as agreement.
- **FR-029**: Feature 007 MUST NOT derive or present an agreement outcome for a
  room with more than two voters.
- **FR-030**: Completion or two-voter agreement MUST NOT trigger candidate
  progression or final match UX in this feature.
- **FR-031**: Mobile interaction MUST make directional swiping the primary
  decision affordance while retaining explicit, labeled alternatives.
- **FR-032**: Web interaction MUST allow both decisions without touch or drag,
  including keyboard-reachable and meaningfully labeled controls.
- **FR-033**: Pending, accepted yes, accepted no and recoverable failure states
  MUST be distinguishable without relying only on color, motion or position.
- **FR-034**: Feature 007 MUST preserve Feature 006 TMDB candidate acquisition,
  metadata authority, current Discover sorting and failure behavior unchanged.
- **FR-035**: Feature 007 MUST preserve the fixed voting group, accepted filters
  and compatible resolution that produced the current candidate.

### Non-Functional Requirements

- **NFR-001 - Atomic authority**: The boundary that owns decisions MUST enforce
  the one-decision invariant under duplicate, conflicting and concurrent input;
  client convention alone is insufficient.
- **NFR-002 - Independent availability**: One voter's accepted decision MUST not
  require another voter's connectivity, decision or acknowledgement. Bounded
  system-level coordination needed to enforce atomic shared-state invariants is
  permitted, but no voter waits on another person's action.
- **NFR-003 - Convergence**: All authorized clients MUST converge on one current
  candidate and the applicable authoritative decision state after retries,
  missed updates and lifecycle recovery.
- **NFR-004 - Durability**: Once accepted, a decision MUST remain recoverable for
  the life of the room selection session and current candidate.
- **NFR-005 - Authorization and privacy**: Decision access MUST be denied by
  default, limited to the approved room roles and projections, and must not
  expose another voter's individually attributed answer.
- **NFR-006 - Failure safety**: Partial failure, request replay and response loss
  MUST not fabricate acceptance, erase an accepted decision or change the
  candidate.
- **NFR-007 - Mobile and web usability**: The primary mobile gesture and the web
  alternatives MUST express the same two values with equivalent confirmation,
  failure and recovery outcomes.
- **NFR-008 - Accessibility**: Both decisions and all material states MUST be
  perceivable and operable without requiring a particular gesture, pointer,
  animation, direction-only cue or color perception.
- **NFR-009 - Responsiveness**: In the controlled healthy local full-stack
  profile—local services already healthy and warmed, one assigned recognizable
  candidate already displayed, workers set to one, attempts executed serially,
  and no injected transport or provider fault—the system MUST measure from an
  eligible button activation or qualifying gesture completion until the
  validated authoritative decision result is rendered. Across exactly 20 first-
  decision attempts in 10 preassembled assigned rooms using the same two
  identities, at least 19 attempts MUST finish within 2,000 milliseconds. Room
  assembly, candidate acquisition, navigation and metadata loading are outside
  the measurement interval. An actionable recoverable failure is recorded
  separately, does not count as a passing sample and invalidates the controlled
  performance run.
- **NFR-010 - Bounded scope**: The release MUST add decision capture and the
  exact two-voter agreement rule only, with no candidate progression, larger-
  group agreement policy or final match experience.

### Key Entities

- **Voting participant**: A fixed member authorized to own one decision for the
  current candidate. Their temporary connection state does not change ownership.
- **Current canonical candidate**: The room-owned TMDB movie identity from
  Feature 006 to which every Feature 007 decision is bound.
- **Authoritative decision**: The accepted immutable association among one room,
  one fixed voter, the current candidate and one value (`yes` or `no`), together
  with enough lifecycle identity to distinguish committed recovery from a new
  attempt.
- **Decision set**: The collection of authoritative decisions for the fixed
  voting group and current candidate. It is complete only at N of N voters.
- **Two-voter agreement fact**: The deterministic meaning of a complete decision
  set containing two `yes` values in an exactly-two-voter room. It does not
  create a match or progression state in Feature 007.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested valid right and left interactions, right records
  yes and left records no; cancelled gestures record zero decisions.
- **SC-002**: In every sequential and concurrent duplicate/conflict test, each
  voter/candidate pair ends with exactly one authoritative value and zero
  divergent values across clients.
- **SC-003**: In 100% of two-client independent-voting trials, either voter can
  receive confirmation while the other is idle or disconnected, and both
  clients continue to identify the same TMDB candidate.
- **SC-004**: In 100% of reload, reconnect, re-entry, missed-update and
  committed-response-loss tests, each voter recovers their original accepted
  value and the original candidate without resubmission or replacement.
- **SC-005**: Across all unauthorized, cross-room, non-voter and impersonation
  checks, zero prohibited decisions are created or changed and zero other-voter
  individual values are disclosed.
- **SC-006**: In all tested exactly-two-voter decision sets, agreement is true
  for yes/yes and false for incomplete, yes/no, no/yes and no/no combinations.
- **SC-007**: In every tested room with more than two voters, all voters can
  persist and recover their independent decisions while zero larger-group
  agreement outcome is produced.
- **SC-008**: In 100% of mobile-sized touch and desktop web acceptance trials,
  a voter can submit either answer through at least one clearly labeled,
  accessible interaction, and the resulting authoritative values are identical.
- **SC-009**: The controlled healthy local full-stack profile records exactly 20
  first-decision timing samples, at least 19 render the validated authoritative
  decision result within 2,000 milliseconds, and zero actionable recoverable
  failures or other non-authoritative outcomes occur during the run. The record
  contains the sample count, passing count and maximum duration.
- **SC-010**: Across the Feature 007 acceptance suite, zero candidate acquisition,
  candidate replacement, next-candidate presentation or final match experiences
  occur as a consequence of a decision.
- **SC-011**: The bounded real-stack owner acceptance uses no more than 6
  independent identities while proving two-client convergence, both decision
  values, duplicate/conflict safety, recovery, exact-two agreement, non-voting
  creator exclusion and a three-voter policy-deferred room.

## Assumptions

- Features 003-006 are complete and remain authoritative for fixed membership,
  voter roles, same-local-identity recovery, frozen filters, compatible
  resolution and the one shared current TMDB candidate.
- The phrase "exactly one authoritative decision" means the first accepted
  value is final for this candidate. Editing or retracting it would be a new
  lifecycle capability and is outside this feature.
- Existing local participant identity remains the continuity boundary;
  permanent-account and cross-device recovery are not implied.
- Individual decision values are private to their voter in Feature 007. The
  deterministic two-voter agreement fact may be shared without introducing the
  final match experience.
- A candidate must be recognizable through Feature 006's minimum presentation
  before the active decision interaction is offered. An explicit no-poster
  fallback still satisfies that presentation; total metadata unavailability
  temporarily withholds the voting surface without changing candidate identity.
- Feature 007 ends without changing the candidate even when all decisions are
  complete or exact-two agreement exists. Feature 008 owns what happens next.

## Dependencies and Preserved Guarantees

- The [constitution](../../.specify/memory/constitution.md),
  [product vision](../../docs/product-vision.md),
  [MVP roadmap](../../docs/mvp-roadmap.md) and
  [testing strategy](../../docs/testing-strategy.md) govern this specification.
- [Feature 003](../003-generalized-room-membership-qr/spec.md) supplies the fixed
  assembled voting group, voting/non-voting creator distinction, authorization
  and same-identity membership recovery.
- [Feature 004](../004-participant-filters/spec.md) and
  [Feature 005](../005-common-filter-resolution/spec.md) supply the frozen input
  and compatible resolution that Feature 007 must not reopen.
- [Feature 006](../006-tmdb-candidate-source/spec.md) supplies the only current
  decision target, shared-candidate convergence, TMDB metadata presentation and
  candidate recovery semantics.
- Feature 008 may consume Feature 007's authoritative decision set and the
  exact-two agreement rule, but Feature 007 does not depend on progression.
- Feature 009 may consume a later authoritative match outcome; no final match UX
  or shared choice is created here.

## Minimum Acceptance and Testing Strategy

`docs/testing-strategy.md` is normative. Planning MUST refine this bounded set
and MUST NOT mechanically rerun all historical browser cases.

- **Current-feature real-stack owner acceptance (`F <= 6`)**:
  - **K01 - 2 identities maximum**: two fixed voters on two independent clients
    verify the same TMDB identity; submit yes/no independently; exercise
    duplicate and conflicting input, response loss, reload/reconnect/re-entry,
    mobile-sized swipe behavior, web controls, privacy and unchanged candidate;
    reuse those identities in bounded rooms to prove the full exact-two outcome
    matrix, including yes/yes agreement.
  - **K02 - 4 identities maximum**: one non-voting creator plus three voters
    prove creator exclusion, concurrent independent submissions, N-of-N
    completion, recovery and zero larger-group agreement or progression.
- **Permanent smoke inheritance**: retain the current C1 security run and the
  G03/G04/G05/G08/H01 smoke intent. Update only terminal assertions whose normal
  compatible flow deliberately evolves from candidate display to a decision
  surface; preserve assembly, QR, room isolation, filter ownership and candidate
  convergence intent.
- **Targeted historical browser impact**: planning MUST inspect Feature 006's
  shared-candidate/recovery owner paths and the permanent smoke phase transition.
  It should select an historical case only if its browser-specific cooperation
  changes beyond what K01/K02 and updated smoke already cover; overlapping
  evidence must not be rerun without a recorded reason.
- **Authoritative state evidence**: deterministic tests MUST prove exact
  decision ownership, authorization, at-most-one storage, same-value idempotency,
  conflicting-value winner behavior, independent-voter concurrency, rollback,
  response-loss recovery, completion and exact-two agreement truth tables.
- **Client evidence**: focused tests MUST prove gesture thresholds/cancellation,
  right/left mapping, explicit controls, keyboard and accessible labels, pending
  and failure states, one-flight behavior, stale-state suppression, recovery and
  absence of local candidate progression.
- **Other mandatory gates**: applicable nonempty migration and clean-reset paths,
  generated-type consistency, full authoritative-state and client suites, lint,
  typecheck, build, supported web/native exports, security scanning and artifact
  consistency remain required at zero additional browser identities.
- **R02 projection**: with `F = 6` and no separately selected historical case,
  the normal checkpoint is `1 + 16 + 6 = 23` identities, repeatability is
  `1 + 2 x (16 + 6) = 45`, and fresh checkout remains `1 + 16 = 17` identities.
  Any justified targeted historical cost `T` is added once under the normative
  formulas and recorded before execution.

### Observable Impact Boundaries

- the Feature 006 candidate surface gains an active voter-only right/left
  decision interaction after a recognizable candidate is available;
- accepted voter decisions become durable authoritative room-related state;
- reload, reconnect and same-identity room restoration now recover both the
  unchanged candidate and the active voter's decision;
- concurrent clients add independent decisions without creating separate
  candidates or blocking each other;
- non-voting creators remain observers and gain no decision authority; and
- exactly-two-voter yes/yes sets gain an agreement meaning while progression and
  match presentation remain absent.

## Resolved Product Decisions

- **Decision vocabulary**: right is `yes`/wants to watch; left is `no`/does not
  want to watch. Explicit controls use the same meanings.
- **Decision lifecycle**: first accepted value wins and is immutable for the
  current candidate. Same-value retries recover it; conflicting retries cannot
  replace it.
- **Decision ownership**: exactly one decision belongs to each fixed voter and
  current canonical candidate. Non-voting creators contribute none.
- **Visibility**: voters recover their own values; Feature 007 does not disclose
  another voter's individually attributed value. The exact-two agreement fact
  may be room-visible without becoming final match UX.
- **Completion**: the decision set is complete at N accepted voter decisions for
  the room's fixed N-voter group, regardless of current connectivity.
- **Two-voter agreement**: yes/yes is agreement; every incomplete or complete
  combination containing no is not agreement.
- **No progression**: no decision or agreement changes the current candidate in
  Feature 007.
- **Platform experience**: swiping is primary on mobile; explicit accessible
  yes/no controls keep mobile and web equivalently usable.

## Unresolved Decisions

- **UNRESOLVED - Agreement policy for more than two voters**: Intentionally
  deferred by the approved feature boundary. It does not block Feature 007
  decision capture, persistence, completion or planning. It MUST be resolved
  before or during Feature 008 specification and blocks approval of any
  larger-group progression or match behavior that depends on it.
