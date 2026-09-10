# Feature Specification: Generalized Room Membership & QR Join

**Feature Branch**: `main` (existing branch; no feature branch created)

**Feature Number**: 003

**Feature Slug**: `generalized-room-membership-qr`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Let the creator configure the required voter count
and whether they vote; invite people through QR, link or code; assemble exactly
that voting group; preserve its membership through retries, concurrent joins and
reconnects. Stop new functionality at membership Ready."

## Scope

### Goals

- Support Otteroom's collaborative movie-selection purpose. Otteroom is not a game.
- Replace the fixed host/guest pair with a configured required voting group,
  defaulting to two voters and demonstrably supporting three voters.
- Let the creator explicitly choose voting or non-voting participation before
  creation, with correct initial occupancy and continuing access in either mode.
- Make QR invitation display and joining work alongside the existing invitation
  link and manual code, including in the functional web version.
- Make every authorized room client observe the same voter occupancy and
  membership Waiting/Ready state; fix the group once it is assembled.
- Preserve membership uniqueness, capacity safety, isolation and recovery,
  together with the existing temporary shared fixture candidate guarantees.

### Terminology

- **Room creator**: The person/client that creates a room. Creation establishes
  their authorization to observe that room whether or not they vote.
- **Voting participant / voter**: A person, recognized through the existing local
  participant identity, occupying one required voter slot for the future filter
  and movie-decision process. Every normal new join in this feature is a voter.
- **Local participant identity**: The existing continuity boundary from Feature
  001. Re-entry within the same local session represents the same person;
  another independent session is not assumed to be the same person. Permanent
  accounts and cross-device identity recovery are not introduced here.
- **Required voter count**: The number of voters the creator configures for this
  selection session. It defaults to 2, is a whole number of at least 2, and
  supports more than 2. Three is required acceptance evidence, not a maximum.
  No arbitrary product maximum is selected in this specification.
- **Voter slot**: One place in the required voting group. A voting creator takes
  exactly one; a non-voting creator takes zero. Slots measure admitted voting
  membership, not connected devices or total people including a non-voting creator.
- **Assembled voting group**: The admitted voters whose count equals the required
  voter count. Once assembled, their voting membership is fixed for this MVP
  selection session; additional new voters are not admitted.
- **Waiting**: Membership state while admitted voter count is less than the
  required voter count, including zero voters with a non-voting creator.
- **Ready**: Membership state when the configured voting group is assembled.
  Temporary disconnect does not undo assembly. Ready does not mean that filters
  are complete, common eligibility exists, or final-product browsing may begin.
- **Authorized room client**: A client using the room creator's identity or an
  admitted voter's identity. A non-voting creator is authorized without occupying
  a voter slot; knowing an internal room identifier is not authorization.
- **Host/display client and device**: Hosting/displaying a room and providing a
  device are distinct from voting. Neither connection nor display activity
  creates voting membership. New non-voting join roles are outside this feature.

### Creation and assembly examples

The creator explicitly chooses whether to vote; no creator-participation default
is defined. Both that choice and the required voter count are fixed after room
creation for the first MVP session.

| Required voters | Creator votes | Initial joined voters | Additional voters required | Initial membership state |
| --- | --- | --- | --- | --- |
| 2 | Yes | 1 | 1 | Waiting |
| 3 | Yes | 1 | 2 | Waiting |
| 2 | No | 0 | 2 | Waiting |
| 3 | No | 0 | 3 | Waiting |

For required count N, occupancy below N means Waiting; occupancy equal to N
means assembled and Ready; occupancy above N is never valid. Membership remains
reserved through temporary absence. This can leave an incomplete group Waiting
when an admitted voter abandons the session; removal or replacement is future scope.

### Non-Goals

This feature explicitly excludes:

- participant filters, genre selection, year filters and common filter resolution;
- TMDB integration, production movie sourcing and movie catalog synchronization;
- swipes, movie decisions, like/dislike controls, candidate progression,
  agreement policy, the agreement threshold for more than two voters and matches;
- streaming-provider filters;
- voter removal/replacement, changing required voter count or creator voting
  mode after creation, creator promotion to voter, and dynamic mid-session voting
  membership;
- waiting lists, spectator fallback, additional non-voting joiners and new
  spectator/display roles beyond future compatibility context;
- an in-app QR camera/scanner and production deep-link polish; QR invitation
  generation/display and opening its target are explicitly in scope;
- a TV application, TV-specific UI, future host/display controls, and automatic
  platform-based selection of creator voting mode;
- permanent accounts, cross-device identity recovery, room expiration/cleanup,
  notifications, analytics and administration; and
- new candidate sources, fixture catalog changes, metadata or poster redesign,
  and changes to candidate retry semantics.

No database design, membership API, QR library/encoding, rendering technology,
camera library, deep-link framework or state-distribution mechanism is selected.

### Release Boundary and relationship to completed features

New functionality begins with explicit room configuration and ends with a
correct Waiting room, an assembled membership-Ready room, or a clear recoverable
failure. The assembled voting group remains fixed. Normal future filters and
candidate browsing require assembly; filters and common resolution themselves
belong to Features 004/005, not to this slice.

[Feature 001](../001-room-session/spec.md) remains a valid completed constrained
slice: it used exactly two host/guest seats and Ready meant both seats were
occupied. Feature 003 deliberately evolves those fixed seats and that completion
rule. It preserves authoritative membership, idempotent create/join behavior,
invitation correctness, isolation, concurrency safety and reconnect continuity.
Feature 001's specification is not retrospectively rewritten.

[Feature 002](../002-first-movie-candidate/spec.md) remains a valid completed
candidate-authority slice. Its four synthetic fixtures and immediate
Ready-to-candidate behavior remain temporary development/acceptance scaffolding,
not the final movie workflow or a production catalog. Feature 003 preserves that
working behavior for generalized authorized membership: after membership Ready,
all admitted voters and the creator, including a non-voting creator, observe the
same authoritative fixture candidate. While Waiting, none is available.
Membership changes must not cause candidate divergence, replacement on retry,
or loss of existing poster/recovery behavior. This is compatibility work, not
new movie functionality. Features 004+ deliberately introduce filters before
browsing; Feature 006 later changes the candidate source.

The model remains compatible with a future TV creator/host/display that takes
zero voter slots, casts zero votes, shows QR and waits for people joining from
phones. Feature 003 adds no TV behavior or display-join role.

## User Scenarios & Testing *(mandatory)*

Acceptance scenario numbers are unique across the three stories. Unless a
scenario introduces failure, normal connectivity and valid independent local
participant sessions are available. Re-entry always uses the existing identity.
Voter occupancy and states must be understandable without showing internal
user/Auth UUIDs; a non-voting creator is never counted as a voter.

### User Story 1 - Creator Configures the Voting Group and Creates a Room (Priority: P1)

As a room creator, I choose how many people will vote and whether I am one of
them so the room knows which voting group it must assemble.

**Why this priority**: Every join depends on a room with an explicit voter target,
correct creator participation and usable invitation information.

**Independent Test**: Without joining another person, create rooms for all four
count/creator combinations. Check initial Waiting/occupancy, creator access,
fixed configuration and the three invitation representations; scan the visible
web QR to check its destination independently of completing a join.

**Acceptance Scenarios**:

1. **Given** a creator preparing a new room, **When** they view the required voter
   count before changing it, **Then** it is 2 and the creator can explicitly
   choose whether to vote before submitting creation.
2. **Given** a creator preparing a room, **When** they submit a required voter
   count below 2 or a value that does not represent a whole number of voters,
   **Then** creation is rejected with an understandable validation result and no
   usable room or invitation is presented; correcting the input allows creation.
3. **Given** required voters 2 and creator participation Yes, **When** creation
   succeeds, **Then** the creator automatically occupies one slot, sees 1 of 2
   voters and Waiting, and the room waits for one additional voter.
4. **Given** required voters 3 and creator participation Yes, **When** creation
   succeeds, **Then** the creator automatically occupies one slot, sees 1 of 3
   voters and Waiting, and the room waits for two additional voters.
5. **Given** required voters 2 and creator participation No, **When** creation
   succeeds, **Then** the creator occupies zero slots, sees 0 of 2 voters and
   Waiting, retains room access, and the room waits for two voters.
6. **Given** required voters 3 and creator participation No, **When** creation
   succeeds, **Then** the creator occupies zero slots, sees 0 of 3 voters and
   Waiting, retains room access, and the room waits for three voters.
7. **Given** a successfully created room in either creator mode, **When** the
   creator views its invitations, including in the functional web version,
   **Then** a human-enterable code, shareable link and visible scannable QR are
   available for that same room without displaying internal user/Auth UUIDs.
8. **Given** the creator's displayed QR and textual invitation link, **When**
   another compatible device scans the QR using an external camera/QR mechanism,
   **Then** it opens the same invitation target and room join flow as the link,
   without requiring an in-app scanner or a separate identity system.
9. **Given** a creator has not chosen whether to vote, **When** they attempt
   creation, **Then** they are asked to make that choice and no voting mode is
   silently assigned; either explicit choice permits otherwise valid creation.
10. **Given** a created room, **When** its creator attempts to change the required
    voter count or their voting mode, **Then** the established configuration and
    voter occupancy remain unchanged, both before and after group assembly.
11. **Given** valid creation choices in either creator mode, **When** the creator
    repeats the same creation action, including overlapping submissions and
    retries after a pre-acceptance failure or a lost success confirmation,
    **Then** a failure before acceptance presents no partial room/invitation as
    usable, and successful recovery yields exactly one room with the chosen
    configuration. If creation was already accepted but confirmation was lost,
    retry recovers that same room and invitation rather than creating another.
    The creator retains exactly one voter slot when voting and zero otherwise.

---

### User Story 2 - Voters Join Until the Configured Group Is Assembled (Priority: P1)

As a voter, I join a room through its invitation so the configured voting group
can become Ready.

**Why this priority**: Successful joining and visible assembly provide the core
shared outcome, including groups beyond two voters.

**Independent Test**: Start with valid Waiting rooms and join through each
invitation mechanism. Demonstrate a three-voter room progressing through 2 of 3
Waiting to 3 of 3 Ready, then repeat with a non-voting creator observing three
other voters. Verify automatic convergence on all existing authorized clients.

**Acceptance Scenarios**:

12. **Given** a Waiting room with a free voter slot, **When** a new person uses
    its valid invitation link and joins, **Then** they occupy exactly one voter
    slot in that room and observe its updated count and membership state.
13. **Given** a Waiting room with a free voter slot, **When** a new person enters
    its valid manual room code and joins, **Then** they occupy exactly one slot
    with the same membership rules as the link flow.
14. **Given** a Waiting room whose creator displays its QR in the web version,
    **When** a new person scans it from a compatible device, opens the invitation
    and joins, **Then** they occupy exactly one voter slot in the represented
    room, under the same identity and membership rules as link/code joining.
15. **Given** a room requiring 3 voters with a voting creator at 1 of 3,
    **When** a second person joins, **Then** both voters observe 2 of 3 and the
    room remains Waiting; two connected voting clients do not make it Ready.
16. **Given** that three-voter room at 2 of 3 Waiting, **When** the third voter
    joins, **Then** the final admitted voter observes 3 of 3 and Ready, with all
    three belonging to the same assembled group.
17. **Given** a creator and previously joined voters observing a Waiting room,
    **When** the final required voter joins, **Then** all authorized clients
    automatically converge on the same required count, occupied slots, admitted
    voting group and Ready state without manual refresh or room recreation.
18. **Given** a room requiring 3 voters with a non-voting creator at 0 of 3,
    **When** three other people join, **Then** occupancy progresses through
    1 of 3 Waiting, 2 of 3 Waiting and 3 of 3 Ready; the creator can observe and
    share the invitation throughout, remains non-voting, and all four clients
    observe the same assembled group of three voters.

---

### User Story 3 - Membership Survives Retries, Reconnects and Concurrent Joins (Priority: P1)

As an authorized room member, I retain my established participation while the
room never admits more voters than configured.

**Why this priority**: A configured group is useful only if repeat actions,
temporary absence and competing joins cannot alter its meaning or privacy.

**Independent Test**: Start with accepted creator/voter identities and Waiting
or Ready rooms. Repeat and overlap joins, reconnect existing identities, race
new joiners for remaining slots, reject late joiners and attempt unrelated-room
access. Verify stable membership and configuration. Check retained fixture
compatibility on generalized Ready rooms without introducing movie interactions.

**Acceptance Scenarios**:

19. **Given** either a new voter identity with at least two free voter slots or
    an already-admitted voter, **When** that same identity retries or repeats
    joining, including overlapping duplicates through QR-derived invitation,
    link or code, **Then** all successful attempts refer to one membership.
    For the new identity, these attempts increase occupancy by exactly one and
    leave the other free slot available; for the admitted voter, they recover
    the existing slot without increasing occupancy. The new-voter case does not
    depend on a full room preventing a duplicate admission.
20. **Given** a voting creator, **When** they reopen the room or its invitation
    and repeat entry, **Then** their original slot is recovered without a
    separate join requirement or an additional slot.
21. **Given** a non-voting creator, **When** they reload, reconnect or reopen
    their own room through its QR-derived invitation, link or code, **Then** they
    recover creator observation/invitation access, remain non-voting and consume
    zero slots, whether the group is Waiting or assembled.
22. **Given** an admitted voter in a Waiting or Ready room, **When** they reload
    in the same session, **Then** their identity and single occupied slot persist
    and they recover the current authoritative count and state.
23. **Given** an admitted voter in a Waiting room, **When** they temporarily
    disconnect and later reconnect, **Then** their slot remains reserved through
    the absence and is recovered without another join; if others assembled the
    group meanwhile, they recover Ready with the same membership.
24. **Given** an assembled group, **When** a voter temporarily disconnects and
    reconnects, **Then** occupied slots never decrease, the group stays assembled
    and Ready, and that voter recovers their original membership.
25. **Given** exactly one free voter slot and two distinct valid new joiners,
    **When** both compete for that slot concurrently without infrastructure
    failure, **Then** exactly one is admitted and the other receives a clear
    full/assembled-room rejection; occupancy reaches the required count and
    never exceeds it, and the group becomes Ready. Either joiner may win.
26. **Given** a room requiring 3 voters with a non-voting creator and zero voters,
    **When** three distinct valid voters join concurrently without infrastructure
    failure, **Then** all three are admitted once, occupancy never exceeds 3,
    the group becomes Ready and the creator still occupies zero slots.
27. **Given** an assembled group, **When** a new voter attempts entry through
    each of QR-derived invitation, link and code, **Then** every attempt is
    rejected as a new voter, with no spectator fallback, membership change or
    change to the configured count or Ready state.
28. **Given** an admitted voter in an assembled room, **When** the same identity
    re-enters through each invitation mechanism, **Then** entry succeeds as
    recovery of existing membership despite there being no free new slots.
29. **Given** unrelated rooms and a person authorized only for one of them,
    **When** that person guesses the other's internal identifiers or substitutes
    unrelated local room information to inspect or change it, **Then** no private
    membership, configuration or candidate assignment is disclosed or changed.
30. **Given** malformed invitation information or a well-formed invitation to
    a nonexistent room, **When** a person attempts to join, **Then** the affected
    person receives the corresponding understandable malformed/invalid-room
    result and no room membership or configuration changes.
31. **Given** a Waiting room, **When** a new person's join fails before admission
    and is retried after the failure clears, **Then** the failure leaves the
    existing group unchanged and provides recoverable feedback; retry admits
    that person once if a slot remains, or reports that others filled the room.
32. **Given** a join was accepted but its success did not reach the joining
    person, **When** the same identity retries or re-enters, **Then** it recovers
    the already-admitted membership once, even if the group is now assembled.
33. **Given** an authorized creator or voter, **When** they manipulate local
    room information to add another voter directly, duplicate their slot or
    alter another member's participation, **Then** the attempt cannot change
    authoritative membership, configuration or assembly state.
34. **Given** a generalized room reaching Ready with 3 voters in either creator
    mode, **When** its authorized clients obtain the existing fixture candidate,
    including overlapping first access, **Then** they automatically receive one
    identical authoritative candidate with matching title, year and visible
    poster, including the non-voting creator where present, with no conflicting
    assignment or new movie interaction.
35. **Given** a generalized Ready room with an established fixture candidate,
    **When** any authorized voter or creator reloads, reconnects or retries a
    failed candidate/poster load, **Then** successful recovery shows the same
    candidate and movie information; failures preserve membership, Ready and
    the assignment, and do not cause rotation or divergent candidates.
36. **Given** a generalized room still Waiting, including 0 of 3, 1 of 3 or
    2 of 3 voters, **When** its authorized clients view it or attempt candidate
    access, **Then** no room candidate is assigned or shown and no later movie
    interaction begins merely because multiple clients are connected.

### Edge Cases

- A voting creator retries the same creation action before its prior result
  arrives: this remains one creation, not several rooms or duplicated membership.
- A non-voting creator follows their own invitation before the group is full:
  existing creator recognition takes precedence over new-voter entry; their
  fixed choice cannot be bypassed through another invitation mechanism.
- A room becomes assembled while another person is opening its invitation:
  availability at actual admission controls the result; a stale display grants
  no extra slot.
- An admitted voter repeats entry while a new person claims the final slot:
  recovery consumes nothing and does not compete for that slot.
- Multiple first join attempts by the same identity overlap while several slots
  remain: only one voter is admitted for that identity.
- A voter loses connectivity while Waiting and the remaining voters assemble
  the group: reconnect restores the same membership in the now-Ready group.
- A non-voting creator is disconnected when the last voter joins: recovery
  restores creator access and Ready without converting the creator into a voter.
- A valid invitation is supplied alongside unrelated local room information:
  only the room identified by the valid invitation is eligible for joining;
  unrelated membership/configuration remains private and unchanged.
- A damaged/unreadable QR does not establish membership. The creator still has
  the normal link and code alternatives; a QR-derived malformed or invalid
  target receives the same result as the corresponding textual invitation.
- Candidate loading fails after generalized assembly: the established Feature
  002 failure/retry boundary remains intact and cannot undo membership Ready.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a creator configure the required voter count
  before creating a room without a permanent account; its initial default MUST be 2.
- **FR-002**: Required voter count MUST represent a whole number of at least 2;
  invalid values MUST prevent successful creation with understandable feedback.
  The feature MUST support more than two voters and successfully assemble a
  three-voter room. This specification sets no arbitrary product maximum.
- **FR-003**: Before creation, the creator MUST explicitly choose a visible
  voting or non-voting option. Either choice MUST be supported on mobile/web;
  missing choice MUST NOT silently become a default participation mode.
- **FR-004**: Required voter count and creator voting mode MUST remain fixed
  after creation for the session, both before and after assembly.
- **FR-005**: A voting creator MUST automatically occupy exactly one voter slot
  on successful creation without separately joining their own room.
- **FR-006**: A non-voting creator MUST occupy zero voter slots. Connection,
  re-entry through any invitation mechanism and recovery MUST NOT promote them
  into voting membership.
- **FR-007**: The creator in either mode MUST remain authorized to observe the
  room's configuration, occupancy and assembly and to see/share its invitations,
  including after reload/reconnect.
- **FR-008**: Successful creation MUST produce Waiting with exactly the initial
  occupancy and remaining voter counts in the four creation examples above.
- **FR-009**: Successful creation MUST provide the creator with a human-enterable
  code, shareable invitation link and visible scannable QR for the same room;
  QR MUST be available in the functional web version without removing link/code.
- **FR-010**: Scanning the displayed QR with a compatible external camera/client
  MUST open the same approved invitation target and join flow as the textual
  link. An in-app scanner MUST NOT be necessary to use this invitation.
- **FR-011**: Every normal new person joining through QR, link or code MUST join
  as a voter under the same membership and identity rules. QR MUST NOT create a
  separate identity/authorization model or a non-voting fallback role.
- **FR-012**: A valid new join through any of those mechanisms MUST admit that
  person once when a voter slot is available and no operation failure prevents
  admission; the joining person MUST observe the resulting count and state.
- **FR-013**: The same local participant identity MUST occupy at most one voter
  slot per room, regardless of invitation mechanism or number of client actions.
- **FR-014**: Membership MUST be Waiting exactly while occupied voter slots are
  below the required count and Ready exactly when that count is assembled.
  Non-voting people and connected-device counts MUST NOT affect this condition.
- **FR-015**: Once assembled, the voting group MUST remain fixed for this MVP
  session. No new voting membership may be added afterward.
- **FR-016**: A new voter attempting to join an assembled room through any entry
  mechanism MUST receive a clear full/assembled-room rejection, with no change
  to existing membership, required count or Ready and no spectator fallback.
- **FR-017**: An already-admitted voter MUST be able to re-enter an assembled
  room as the same identity without being rejected merely because it is full.
- **FR-018**: For an admitted or joining voter, join retries, duplicate
  submissions, overlapping same-identity attempts and reopening an invitation
  MUST NOT create duplicate membership. If a join was accepted but its success
  response was lost, retry MUST recover that existing membership, not admit a
  new one. Non-voting creator re-entry follows FR-006 and FR-007.
- **FR-019**: Repeated submissions/retries of the same room-creation action MUST
  preserve one resulting room and its chosen configuration without duplicate
  rooms or creator memberships. A separate deliberate creation is not a retry.
- **FR-020**: Temporary disconnect or reload MUST NOT release an admitted voter's
  slot, reduce occupancy or undo an assembled group's Ready state, including
  when the voter originally joined while Waiting.
- **FR-021**: Reload/reconnect/re-entry with the same local identity MUST restore
  the creator's or voter's existing participation and current room state without
  another slot, manual room recreation or a permanent account.
- **FR-022**: After successful joins, existing authorized clients, including a
  non-voting creator, MUST automatically converge on the same required count,
  admitted voting group, occupied slots and Waiting/Ready state without manual
  refresh. The final admitted voter MUST observe Ready.
- **FR-023**: The room display MUST communicate required and occupied voter slots
  and distinguish Waiting from assembled/Ready. It MUST count voting membership
  rather than raw connected people/devices and MUST make the creator's voting
  or non-voting participation understandable without prescribing exact strings.
- **FR-024**: Room, invitation and failure displays MUST NOT expose internal
  user/Auth UUIDs as participant-facing information.
- **FR-025**: Sequential, repeated and concurrent operations MUST never admit
  more voters than the configured required count, even temporarily.
- **FR-026**: With exactly one available slot and two distinct valid concurrent
  joiners, absent infrastructure failure, exactly one MUST be admitted and the
  other rejected as a new voter. The room MUST reach Ready without exceeding its
  voter target; no particular winner is required.
- **FR-027**: Legitimate concurrent joins MUST be able to fill multiple available
  slots up to the configured count without depending on sequential human joining.
  Each identity MUST be admitted at most once.
- **FR-028**: Unauthorized people MUST NOT observe or alter a room's private
  membership or configuration by guessing internal identifiers or manipulating
  unrelated local state. This MUST hold for both successful and failed operations.
- **FR-029**: Local manipulation MUST NOT let a client bypass admission, add
  another voter directly, duplicate its participation or alter another member.
  Valid invitations permit joining under room rules; they do not grant private
  room observation before authorization as creator or admitted voter.
- **FR-030**: Malformed invitation information and validly formed invitations to
  nonexistent rooms MUST produce distinguishable understandable failure results,
  preserving the existing invitation rules and changing no membership/configuration.
- **FR-031**: Creation failing before acceptance MUST present a clear recoverable
  failure and no partially created room or invitation as usable. Retry MUST
  preserve the same-action creation guarantees in FR-019.
- **FR-032**: Join failing before admission MUST preserve existing authoritative
  membership/configuration and offer recoverable feedback. Retry MUST recover
  any membership already admitted, admit once if a slot remains, or clearly
  reject a new admission if other voters assembled the group meanwhile.
- **FR-033**: Existing Feature 002 Waiting behavior MUST apply to generalized
  Waiting rooms: no authoritative fixture candidate is assigned or made available.
- **FR-034**: Existing automatic fixture candidate behavior after membership
  Ready MUST preserve one shared authoritative candidate for every admitted
  voter and the creator in either mode, including three-voter rooms and
  concurrent access. Successful displays MUST agree on candidate identity,
  title, year and visible poster without exposing internal candidate IDs.
- **FR-035**: Generalizing membership MUST preserve Feature 002's candidate
  authority, privacy, stable reload/reconnect, poster and failure/retry behavior.
  Candidate failures MUST NOT change membership or Ready, disclose unrelated
  assignments, or replace an established candidate. No new movie behavior is added.

### Non-Functional Requirements

- **NFR-001 — Consistency**: With normal connectivity, all authorized clients
  MUST converge on the same authoritative required voter count, voting membership
  and Waiting/Ready state after joins and recovery, including a non-voting
  creator. Membership updates MUST not require manual refresh or room recreation.
- **NFR-002 — Capacity correctness**: Membership uniqueness and the configured
  capacity MUST hold across every sequential, concurrent, repeated and recovery
  scenario; neither duplicate identity nor temporary connection state may add slots.
- **NFR-003 — Security/Isolation**: Unauthorized clients MUST neither obtain nor
  change unrelated private membership/configuration. Successful results and
  errors MUST preserve this boundary and avoid exposing internal user/Auth UUIDs.
- **NFR-004 — Cross-platform direction**: Observable configuration, membership
  and invitation semantics MUST be consistent with the shared mobile/web client
  direction. Functional web MUST display a QR usable by another compatible
  device. Mobile remains the primary UX target; desktop presentation does not
  define the final mobile design, and no TV client is required.

### Key Entities

- **Room**: The authoritative session with a creator, fixed required voter count,
  fixed creator participation choice, invitation information and membership state.
- **Creator association**: The creator's continuing authorization to observe
  and share their room, distinct from whether they hold voting membership.
- **Voting membership**: One admitted local identity occupying one voter slot
  in one room, retained through temporary absence and repeated access.
- **Assembled voting group**: The room's complete fixed set of admitted voters
  once their number equals the required count; it remains assembled offline.
- **Invitation information**: The room code, textual link and visible QR that
  offer alternate entry into the same room and membership rules.
- **Existing fixture room candidate**: The temporary shared movie assignment
  supplied by Feature 002. Membership generalization extends its authorized
  audience without changing the candidate source or movie behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four creation examples produce their exact 1/2, 1/3, 0/2 and
  0/3 initial occupancy and Waiting result; the initial required count is 2,
  invalid counts are rejected and creator participation is always explicitly chosen.
- **SC-002**: Three-voter acceptance flows in both creator modes remain Waiting
  below 3 occupied voter slots and reach Ready exactly at 3 of 3.
- **SC-003**: In every tested concurrent/repeated admission scenario, occupancy
  never exceeds the configured count and each identity has at most one slot;
  every successful final-slot race admits exactly one of the two contenders.
- **SC-004**: Every admitted-voter or voting-creator reload, reconnect and
  re-entry preserves one existing voter slot, including after assembly.
- **SC-005**: In every non-voting-creator scenario, creation, connection, re-entry
  and recovery contribute zero voter slots while retaining authorized observation
  and invitation access.
- **SC-006**: QR, link and code each produce a successful voter join under the
  same membership rules. Scanning the displayed web QR on another compatible
  device opens the same invitation target as its textual link.
- **SC-007**: Every attempted new-voter join after assembly through all three
  entry mechanisms is rejected with zero change to the established group.
- **SC-008**: In every normal-connectivity assembly scenario, the final voter,
  earlier voters and creator observe the same required count, membership and
  Ready state without manual refresh or room recreation; temporary disconnect
  never reopens the assembled group.
- **SC-009**: Every isolation/manipulation acceptance scenario yields zero
  unauthorized disclosures or changes to private room membership/configuration;
  participant-facing invitations, counts and errors expose no internal user/Auth UUIDs.
- **SC-010**: Feature 003 acceptance introduces zero filter, swipe, production
  movie-source, progression, match or TV flows; new product behavior ends at
  membership Ready, with only the documented fixture compatibility retained.
- **SC-011**: Across generalized three-voter rooms and both creator modes, all
  successful fixture candidate access/recovery checks agree on one candidate,
  title, year and visible poster, with zero conflicting assignments or rotation
  on failure/retry; Waiting checks expose zero room candidates.
- **SC-012**: Every configuration-change attempt and rejected or pre-acceptance
  failed operation leaves established configuration/membership intact. Recovered
  same-action creation or joining produces one room or membership respectively,
  and already-accepted membership remains recoverable after lost confirmation.

## Assumptions

- Features 001 and 002 are complete and their room and temporary candidate
  foundations work before this deliberate membership evolution.
- The existing anonymous session identity remains available without permanent
  registration. Same-session recovery is supported; fresh independent sessions
  are not assumed to recover another identity.
- Existing invitation links/codes work and are intentionally shared by the
  creator. A compatible external camera/QR client can open a normal invitation
  target; an embedded scanner is unnecessary for this slice.
- Normal network connectivity exists except in scenarios explicitly exercising
  interruption/failure. Membership itself does not depend on continuous presence.
- A count of people means whole voters. Three-voter evidence establishes actual
  support beyond two and does not define a global product maximum.
- The current fixtures remain temporary compatibility scaffolding until later
  features deliberately replace the workflow/source. They do not change TMDB's
  future metadata authority or establish an Otteroom-owned production catalog.

## Dependencies

- The [constitution](../../.specify/memory/constitution.md),
  [product vision](../../docs/product-vision.md) and
  [MVP roadmap](../../docs/mvp-roadmap.md) govern scope and product intent.
- Feature 001 supplies the working creation, invitation, identity, authorized
  room access and recovery foundation. Feature 003 evolves its capacity and
  completion definitions while preserving unrelated guarantees.
- Feature 002 supplies shared-candidate behavior. Its authorized audience must
  follow generalized room membership, including creator observation, without
  new movie behavior or a weakened candidate contract.
- Acceptance needs independent participant sessions, three-voter rooms in both
  creator modes, unrelated rooms, observable overlapping joins, temporary
  disconnects and recoverable failures. QR acceptance requires an actual visible
  QR scanned/opened by a compatible other device/client, not merely text claiming
  a QR exists. These are evidence needs, not prescribed test tools or mechanisms.
- Later plans/contracts must reconcile affected membership and candidate
  authorization boundaries and acceptance evidence before implementation. This
  specification creates no dependency on unimplemented filters, swipes or TV.

## Unresolved Decisions

None at the Feature 003 product-specification level. The creator makes an
explicit participation choice; no default is invented. No global voter maximum
is chosen, and its absence is not a clarification blocker.

Technical design belongs to planning. Dynamic membership, filter policy and TV
implementation remain outside this feature. The agreement rule for more than
two voters remains a later product decision that the roadmap requires to be
resolved before or during Feature 008 specification; it does not block the
membership-and-QR boundary defined here.
