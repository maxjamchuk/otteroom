# Feature Specification: Candidate Progression

**Feature Branch**: `main` (existing branch; no feature branch created)

**Feature Number**: 008

**Feature Slug**: `candidate-progression`

**Created**: 2026-09-18

**Status**: Approved for implementation

**Owner Approval**: APPROVED — 2026-09-18

**Input**: User description: "Resolve each current candidate only after every
fixed voter has decided; stop authoritatively when the fixed two-thirds agreement
rule is met, otherwise advance exactly once to another eligible TMDB candidate,
with convergence, retry safety, recovery and no Match UX."

## Scope

### Goals

- Turn Feature 007's complete decision set for the current candidate into one
  authoritative room outcome: agreed and stopped, or not agreed and progressing
  to the next candidate.
- Define one deterministic agreement policy for every supported fixed voting
  group, including the larger groups intentionally deferred by Feature 007.
- Wait for the complete required decision set before resolving a candidate;
  neither inevitable agreement nor impossible agreement resolves early.
- Ensure one rejected candidate causes exactly one logical progression step,
  even when final decisions, retries, lost responses and stale clients overlap.
- Reuse Feature 006's exact TMDB candidate-source, eligibility, metadata and
  failure contracts while preventing a previously resolved candidate from being
  presented again in the same selection session.
- Make every authorized room member converge on the same outcome and, when
  applicable, the same next candidate across live observation, reload,
  reconnect, missed updates and same-identity re-entry.
- Preserve an authoritative agreement handoff for Feature 009 without adding a
  match screen, celebration, confirmation flow or any other Match behavior.

### Terminology and State Meanings

- **Fixed assembled voting group**: The unchanging Feature 003 set of voters for
  the selection session. Its size is the room's configured required voter count.
  A voting creator is included; a non-voting creator and connected devices are
  not. Temporary disconnection does not change the set or its size.
- **Voting participant count (`N`)**: The number of voters in that fixed group.
  `N` is a whole number of at least 2 and is the denominator for decision
  completion and agreement. Feature 008 never substitutes the number currently
  connected or the number of authorized observers.
- **Current candidate occurrence**: The one room-authoritative TMDB movie being
  considered at a particular logical step in the room's candidate sequence. It
  is the only active decision target at that step. The first occurrence is the
  candidate supplied by Feature 006.
- **Complete required decision set**: Exactly one accepted Feature 007 decision
  from every one of the `N` fixed voters for the same current candidate. No
  decision from a non-voter, another candidate or another room contributes.
- **Yes count (`Y`)**: The number of accepted `yes` decisions in that complete
  current-candidate decision set. It is an authoritative input to resolution,
  not a client-calculated value or a requirement to expose a public tally.
- **Agreement threshold (`T`)**: For `N = 2`, `T = 2`. For `N >= 3`,
  `T = (2 * N + 2) div 3`, where `div` is integer division that discards any
  remainder. This is exactly `ceil(N * 2 / 3)` without floating-point
  calculation. A complete set agrees exactly when `Y >= T`.
- **Collecting decisions**: The current candidate has fewer than `N` accepted
  decisions. The room remains on that candidate regardless of whether the
  agreement threshold has already been reached or can no longer be reached.
- **Agreed and stopped**: The complete set has `Y >= T`. The agreed candidate
  remains the authoritative handoff candidate and candidate progression is
  terminal for this selection session.
- **Advancing**: The complete set has `Y < T`; the resolved candidate is no
  longer an active decision target and the room is authoritatively seeking one
  eligible, not-previously-resolved next candidate through Feature 006's source
  contract. A transient source failure may keep the room in a recoverable
  advancing state without creating another candidate.
- **No further candidate**: A stable non-agreement terminal reached only after
  one bounded, error-free candidate-source attempt completes all work required
  by the approved Feature 006 search contract and observes no eligible candidate
  that has not already been resolved in this selection session. It is distinct
  from agreement, filter incompatibility and a transient/incomplete source
  failure, and it makes no global snapshot claim about TMDB's live catalog.
- **Logical progression step**: The single transition caused by one rejected
  candidate. It either establishes exactly one next current candidate or ends
  in the authoritative no-further-candidate outcome. It cannot assign and skip
  multiple room candidates. TMDB result ordering is not a product-visible deck,
  so "skipped candidate" in this feature means an extra room-authoritative
  candidate occurrence, not an unpromised external result position.
- **Authorized room member**: A voter in the fixed group or the room's
  non-voting creator under the inherited room authorization and identity rules.
- **Stale client**: An otherwise authorized client acting from an older
  candidate, decision-progress or room-outcome view after authority has moved on.

### Deterministic Agreement Policy

The following values are normative examples of the integer rule:

| Voting participants (`N`) | Required Yes decisions (`T`) |
| ---: | ---: |
| 2 | 2 |
| 3 | 2 |
| 4 | 3 |
| 5 | 4 |
| 6 | 4 |
| 7 | 5 |
| 8 | 6 |
| 9 | 6 |
| 10 | 7 |

The policy is fixed product behavior. It is not configurable by room, creator,
voter, client or difficulty/mode selection. Arrival order and the identity of
the final voter do not affect `T` or the outcome.

Agreement is evaluated only for a complete required decision set. For example,
three accepted `yes` decisions in a four-voter room already meet `T = 3`, but
the room remains collecting until the fourth voter decides. Conversely, two
accepted `no` decisions in that room make agreement impossible, but the room
still remains collecting until all four decisions exist. These deliberate
Feature 008 timing rules do not change Feature 007's immutable first-decision
contract.

### Authoritative Progression Contract

The observable lifecycle is:

```text
current candidate collecting decisions
  -> complete set and Y >= T -> agreed and stopped
  -> complete set and Y < T  -> advancing
                                  -> one next candidate collecting decisions
                                  -> recoverable source failure, then retry
                                  -> no further candidate, stopped
```

Only authoritative room state may choose an outcome or a next candidate. A
client may submit its own Feature 007 decision and observe/recover progression,
but it may not calculate and publish the room outcome, select a local next
movie, directly mutate protected decision/progression state, or make another
client follow its local sequence.

One completed candidate produces one outcome once. Agreement permanently
prevents another candidate occurrence in this selection session. Non-agreement
permits one next occurrence only after the source has established a distinct
eligible identity. A previous candidate's decision records remain immutable and
bound to that candidate; they are never rewritten, deleted or counted as
decisions for the next candidate. The next occurrence begins at zero of `N`
decisions.

### Interaction with Feature 006 Candidate Source

Feature 008 owns sequencing, not discovery. Every next candidate must come from
the same Feature 006 TMDB source and must continue to satisfy the unchanged
server-private compatible constraint, inclusive years, exact AND-of-OR genre
predicate, `en-US` metadata policy, adult-title exclusion and minimum
title/year/poster-or-fallback presentation contract.

Feature 008 adds only the sequencing requirement that a candidate whose decision
set was already resolved in this room selection session is ineligible to become
current again. Any eligible not-previously-resolved movie remains acceptable;
this specification adds no ranking, recommendation or product-visible ordering
promise. A source proposal is not participant-visible authority until the room
accepts it as the one next occurrence.

Feature 006's failure meanings continue to apply:

- an incomplete or failed search is recoverable and cannot manufacture, broaden
  or replace a candidate;
- a completed search with no eligible unpresented movie may establish the stable
  no-further-candidate outcome;
- once a next identity becomes authoritative, metadata or poster failure
  recovers that same identity and cannot rotate it; and
- a room already in Feature 006's first-candidate `no_candidates` terminal has
  no Feature 008 decision target or progression action.

### Interaction with Feature 007 Decisions

Feature 007 remains the sole authoritative decision model and submission path.
Feature 008 consumes its immutable accepted values and complete-set meaning; it
does not introduce another voting API, table write path, client channel,
editable decision or retraction behavior.

The current-candidate identity is part of every decision's authority. An old
client retrying a decision after progression must reconcile to canonical room
state and cannot add a decision to the new candidate, reopen the resolved
candidate, advance twice or skip the new occurrence. Individual decisions
remain private under Feature 007; Feature 008 may reveal only safe room-level
progression meanings needed for all members to understand the shared state.

### Deliberate Evolution from Features 006 and 007

Feature 006 proved one stable TMDB candidate but explicitly assigned no second
candidate. Feature 008 preserves its source, eligibility, metadata authority,
privacy and recovery guarantees while allowing a rejected occurrence to be
followed by one distinct eligible occurrence.

Feature 007 proved immutable independent decisions and exact-two agreement while
deliberately leaving every candidate unchanged. Feature 008 preserves its
decision ownership, privacy, idempotency and first-value-wins rules, resolves the
deferred larger-group policy, and makes a complete set the only trigger for
progression or agreement-stopping behavior.

### Release Boundary and Non-Goals

This release begins when an authoritative current candidate is collecting
Feature 007 decisions. It ends with one of these observable states:

- the same candidate remains active while fewer than all fixed voters have
  decided;
- the complete set agrees, progression is stopped and the authoritative
  agreement handoff is recoverable;
- the complete set does not agree and exactly one distinct next candidate is
  current with a fresh decision set;
- next-candidate acquisition is safely retryable after an incomplete failure; or
- a completed source attempt establishes that no further candidate was observed.

This feature explicitly excludes:

- early resolution after agreement becomes inevitable or impossible;
- configurable thresholds, per-room agreement settings, and Easy/Medium/Hard or
  equivalent modes;
- Match screens, celebration, shared-choice cards, confirmation prompts,
  post-match actions or any other Feature 009 experience;
- progression past an agreed candidate;
- new decision values, changing/retracting an accepted decision, another
  decision submission transport or disclosure of individual voter answers;
- client-selected candidates, a second catalog source, synthetic fixture
  fallback, weakened filters, recommendation or ranking behavior;
- dynamic voting membership, voter removal/replacement, late voters, required
  voter-count changes or creator voting-mode changes;
- filter editing, re-resolution, provider availability, TV-specific behavior,
  permanent accounts or cross-device identity transfer; and
- any particular schema, queue, transaction, endpoint, function, event channel,
  lock, client framework or candidate-fetch architecture.

## User Scenarios & Testing *(mandatory)*

Scenario numbers are unique across stories. Unless a scenario says otherwise,
the room has completed Features 003-007, uses independent browser sessions for
different people, has the fixed assembled voting group, frozen compatible
filters and one recognizable authoritative TMDB candidate. Re-entry uses the
same local identity. Core acceptance is browser-first: participants act through
the functional web product while authoritative-state tests provide exhaustive
formula, concurrency and invariant evidence below that journey.

### User Story 1 - Resolve a Complete Group Decision (Priority: P1)

As a room member, I want the current movie resolved by one clear group rule only
after everyone has decided so that the group outcome is predictable and fair.

**Why this priority**: The completion gate and threshold decide whether the room
stops or continues; every other progression behavior depends on them.

**Independent Test**: In browser rooms with two, three and four fixed voters,
submit threshold-boundary decision combinations in different orders. Verify no
outcome appears before `N/N`, then verify the exact agreed or non-agreed outcome
after the final required decision.

**Acceptance Scenarios**:

1. **Given** exactly two fixed voters and one accepted `yes` each for the current
   candidate, **When** the second decision completes the set, **Then** the room
   resolves as agreed, retains that candidate and stops progression.
2. **Given** exactly two fixed voters and a complete set containing a `no`,
   **When** the set becomes complete, **Then** the room resolves as not agreed
   and begins one authoritative next-candidate progression step.
3. **Given** a three-voter room with exactly two `yes` decisions and one `no`,
   **When** the third accepted decision completes the set, **Then** threshold 2
   is met and the room resolves as agreed and stopped.
4. **Given** a four-voter room with exactly two `yes` decisions, **When** all
   four decisions are complete, **Then** threshold 3 is not met and the room
   resolves as not agreed.
5. **Given** any fixed group from 2 through 10 voters and a complete set, **When**
   the yes count is one below the normative threshold, **Then** the candidate is
   not agreed; **When** the yes count equals the threshold, **Then** it is agreed.
6. **Given** a four-voter room with three accepted `yes` decisions and one voter
   undecided, **When** clients observe the room, **Then** it remains collecting,
   does not announce agreement and does not seek another candidate.
7. **Given** a four-voter room with two accepted `no` decisions and two voters
   undecided, **When** agreement is already impossible, **Then** the room still
   remains collecting and does not resolve or advance until both decide.
8. **Given** the same complete decisions arrive in different orders or the final
   voter identity differs, **When** resolution occurs, **Then** the threshold and
   outcome are identical.

---

### User Story 2 - Advance Everyone to One Next Candidate (Priority: P1)

As a participant in a room that did not agree, I want everyone to receive the
same next eligible movie so that we continue one shared selection process.

**Why this priority**: Authoritative shared advancement is the primary product
value of Candidate Progression.

**Independent Test**: Complete a non-agreeing decision set in multiple browser
sessions, observe one distinct eligible next TMDB candidate on every client,
verify its decision progress starts at zero, then decide on it without any prior
candidate decision being reused.

**Acceptance Scenarios**:

9. **Given** a complete current-candidate set with `Y < T`, **When** progression
   succeeds, **Then** exactly one different eligible TMDB movie becomes the
   authoritative current candidate for the room.
10. **Given** voters and a non-voting creator observing a successful progression,
    **When** their browser states converge, **Then** all identify the same next
    candidate and progression outcome; the creator contributes no decision.
11. **Given** one or more earlier candidates have complete decision sets, **When**
    another progression succeeds, **Then** none of those resolved TMDB identities
    is presented again in that selection session.
12. **Given** a distinct next candidate becomes authoritative, **When** voters
    observe its decision state, **Then** it begins at zero of `N`, accepts only
    new Feature 007 decisions for that identity and preserves every earlier
    decision unchanged.
13. **Given** the frozen compatible filters that produced the first candidate,
    **When** a next candidate is established, **Then** it satisfies the same
    exact Feature 006 eligibility and content rules with no fixture or broadened
    fallback.
14. **Given** a next candidate identity commits but metadata or poster delivery
    fails, **When** participants retry or recover, **Then** the same identity is
    retained under Feature 006's presentation rules and no additional
    progression step occurs.

---

### User Story 3 - Progress Exactly Once Under Concurrency and Retry (Priority: P1)

As a room participant, I want retries, overlapping final decisions and stale
clients to reconcile safely so that the room never double-advances or skips a
logical candidate step.

**Why this priority**: A shared sequence is trustworthy only if the same real
world action cannot create multiple authoritative successors.

**Independent Test**: In independent browser sessions, overlap the last two
voters' decisions, duplicate the final action, lose its response, retry from a
stale tab and overlap next-candidate attempts. Verify one complete outcome, one
successor at most and canonical recovery on every client.

**Acceptance Scenarios**:

15. **Given** two undecided voters are the last required members, **When** they
    submit concurrently and their decisions complete the set, **Then** both
    immutable decisions are retained and exactly one candidate outcome is
    produced from the complete set.
16. **Given** the final voter's accepted request is duplicated or replayed,
    **When** all copies complete in any order, **Then** the decision contributes
    once and a non-agreeing outcome causes at most one logical advancement.
17. **Given** a non-agreeing final decision and progression commit but the
    response is lost, **When** that voter retries or reloads, **Then** the client
    recovers the committed next candidate and cannot produce another successor.
18. **Given** overlapping next-candidate source attempts propose different
    eligible movies, **When** authority is established, **Then** one proposal
    becomes the current candidate, every participant recovers that winner and
    no losing proposal is shown as an authoritative candidate.
19. **Given** a stale client still displays the resolved candidate, **When** it
    retries a decision or attempts to continue from that old state, **Then** it
    changes no decision or progression state and reconciles to the authoritative
    agreed stop, next candidate or no-further-candidate outcome.
20. **Given** an agreed room and any delayed, duplicate or stale prior action,
    **When** that action arrives after agreement, **Then** the agreed candidate
    remains authoritative and no next candidate is sought, assigned or shown.

---

### User Story 4 - Recover the Shared Progression State (Priority: P1)

As an authorized room member, I want reload and reconnect to restore the room's
actual candidate outcome so that missing a live update never forks the room.

**Why this priority**: Candidate authority must survive ordinary browser
lifecycles, not depend on every client being continuously connected.

**Independent Test**: Progress one room and agree in another while selected
browser sessions are disconnected. Reload, reconnect and re-enter voters and a
non-voting creator, including a client that missed the transition, and compare
the recovered outcome and candidate on every client.

**Acceptance Scenarios**:

21. **Given** one browser misses the transition to a next candidate, **When** it
    reconnects or authoritative synchronization runs, **Then** it converges on
    the same next candidate without manual room recreation or replaying votes.
22. **Given** progression completed before a participant reloads, **When** the
    same identity restores the room, **Then** the participant recovers the next
    candidate and its fresh decision state rather than the previous card.
23. **Given** agreement completed while a participant was disconnected, **When**
    they return, **Then** they recover the same agreed/stopped candidate and do
    not see an active next-candidate decision surface.
24. **Given** a non-voting creator reloads after resolution, **When** room state
    is restored, **Then** they observe the same safe room-level outcome and
    candidate as the voters while remaining unable to decide.
25. **Given** a person authorized only for another room guesses identifiers or
    manipulates stale local state, **When** they attempt to observe or affect
    progression, **Then** they learn no protected outcome or decision data and
    change no candidate state.

---

### User Story 5 - Stop Safely When Browsing Cannot Continue (Priority: P2)

As a room member, I want a clear distinction between temporary source trouble,
catalog exhaustion and agreement so that the group can recover or stop without
receiving a false match or an ineligible movie.

**Why this priority**: Progression must have a truthful terminal when no next
candidate can be produced and must not turn failure into agreement or Match UX.

**Independent Test**: After a non-agreeing complete set, exercise one incomplete
source attempt, one later successful retry and one bounded completed attempt
containing no eligible unpresented movie. Reload each outcome and verify the
appropriate retry/stopped behavior, then verify an agreed room makes no next
candidate request and shows no Match experience.

**Acceptance Scenarios**:

26. **Given** a non-agreeing complete decision set and a transient or incomplete
    source attempt, **When** the failure is presented, **Then** the room retains
    the resolved prior decisions, creates no speculative next candidate, shows a
    safe retryable progression state and does not label the result as agreement
    or exhaustion.
27. **Given** that retryable state, **When** a later source attempt succeeds,
    **Then** exactly one eligible unpresented candidate becomes current and the
    earlier failure causes no additional sequence step.
28. **Given** one bounded, error-free Feature 006-style search completes all
    required work and observes no eligible unpresented movie, **When** its result
    becomes authoritative, **Then** all authorized members see the stable no-
    further-candidate outcome, no active voting surface or acquisition Retry,
    and an action to begin a new room/selection session.
29. **Given** a room in the authoritative no-further-candidate outcome, **When**
    clients reload, reconnect, re-enter or replay older actions, **Then** they
    recover the same terminal with no new candidate and no changed decisions.
30. **Given** a candidate resolves as agreed, **When** participants observe or
    recover the room, **Then** progression is visibly stopped with the agreed
    candidate preserved, but no match screen, celebration, confirmation flow or
    post-match action is shown.

### Edge Cases

- A voter disconnects before deciding: their fixed membership and required
  decision remain; the room waits indefinitely rather than shrinking `N` or
  resolving early.
- The threshold is already met before the last decision, or cannot be met even
  if every remaining vote is yes: both conditions still remain collecting until
  the complete set exists.
- Stored decision detail, decision completion, fixed membership or required
  voter count disagree: progression fails closed, exposes no individual answer
  and makes no outcome or candidate change until canonical integrity is restored.
- A complete Feature 007 decision set predates Feature 008 activation: canonical
  recovery resolves it once without requiring a voter to resubmit, and normal
  idempotency/concurrency rules still apply.
- The final two voters decide concurrently while several stale clients also
  retry accepted decisions: all accepted values contribute once and only one
  resolution is authoritative.
- A late successful source response arrives after another attempt established
  the next candidate, no-further-candidate terminal or agreement: the late result
  cannot replace or contradict authority.
- A delayed winning candidate response arrives after the successor has already
  received decisions or has itself resolved: the response may recover metadata
  for a still-current occurrence, but it cannot install an assumed `0/N`, regress
  the room phase or replace the canonical room projection.
- A client misses one or more live phases, including the intermediate advancing
  phase between collecting and exhaustion: canonical recovery accepts the valid
  transitive forward state, while observations proven to precede current
  authority are ignored and genuinely incomparable branches fail closed.
- The source encounters previously resolved TMDB identities before finding a
  new eligible one: those identities are skipped as source results, never
  re-presented as room candidate occurrences.
- Search work stops because of timeout, rate limit, malformed data, request
  budget or incomplete traversal after filtering prior identities: this is a
  recoverable source failure, never no-further-candidate.
- The next candidate becomes authoritative but temporarily lacks usable
  metadata: the identity remains stable and Feature 007 withholds active voting
  until the candidate is recognizable, without sourcing another movie.
- Two different rooms legitimately receive the same TMDB movie: session-local
  no-repeat behavior does not impose cross-room uniqueness.
- The room entered Feature 008 from Feature 006's original `no_candidates`
  outcome: it remains there with no decision or progression surface.
- A non-voting creator opens multiple clients: they observe the same room-level
  state but add no decision, threshold contribution or progression authority.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Feature 008 MUST use the fixed assembled voting group and its
  configured required voter count from Feature 003 as the sole membership basis
  for decision completion and agreement.
- **FR-002**: Connection state, device count and the presence of a non-voting
  creator MUST NOT change the required decision set, `N` or the threshold.
- **FR-003**: A candidate's decision set MUST be complete exactly when every one
  of the `N` fixed voters has one accepted Feature 007 decision for that same
  current candidate.
- **FR-004**: Feature 008 MUST NOT resolve a candidate, announce agreement,
  declare non-agreement or start next-candidate sourcing before the required
  decision set is complete.
- **FR-005**: Feature 008 MUST continue collecting all required decisions when
  agreement is already inevitable and when agreement is already impossible.
- **FR-006**: For exactly two voters, the agreement threshold MUST be exactly
  two accepted `yes` decisions.
- **FR-007**: For `N >= 3`, the agreement threshold MUST be calculated as
  `(2 * N + 2) div 3`, using integer division, and MUST NOT depend on
  floating-point rounding.
- **FR-008**: For a complete set, agreement MUST be true exactly when the
  authoritative yes count is at least the threshold and false otherwise.
- **FR-009**: The threshold MUST be fixed product behavior and MUST NOT be
  configurable per room, participant, creator, client or mode.
- **FR-010**: Only accepted current-candidate decisions from fixed voters may
  contribute to completion or the yes count; stale, foreign, non-voter and
  unaccepted input MUST contribute zero.
- **FR-011**: Decision arrival order, the identity of the last voter and client-
  calculated tallies MUST NOT change the authoritative outcome.
- **FR-012**: The transition from a complete decision set to its candidate
  outcome MUST be one authoritative logical transition, with exactly one outcome
  for that candidate under concurrent completion, duplicate evaluation and retry.
- **FR-013**: When a complete set meets the threshold, progression MUST enter an
  authoritative agreed/stopped state that preserves the agreed TMDB identity,
  the candidate-bound decision set and enough room-level outcome meaning for
  Feature 009 to consume later.
- **FR-014**: After agreement, no action, retry, reload, reconnect, stale client
  or delayed source result may seek, assign, expose or activate another candidate
  in the selection session.
- **FR-015**: Feature 008 MUST present at most a neutral, understandable
  agreement-stopped status and MUST NOT present Match UX, celebration,
  confirmation, shared-choice screens or post-match actions.
- **FR-016**: When a complete set does not meet the threshold, the resolved
  candidate MUST cease accepting decisions and the room MUST begin one
  authoritative logical progression step.
- **FR-017**: A successful progression step MUST establish exactly one next
  current candidate identity for the whole room; clients MUST NOT independently
  calculate, choose or commit their own next candidate.
- **FR-018**: Every next candidate MUST be supplied by the Feature 006 TMDB
  candidate-source contract and satisfy the unchanged compatible filter,
  eligibility, locale, adult-content and metadata rules.
- **FR-019**: A candidate identity whose decision set was already resolved in
  the current selection session MUST NOT become current again in that session.
- **FR-020**: Beyond the no-repeat rule, any eligible next candidate is
  acceptable; Feature 008 MUST NOT create a ranking, recommendation or
  participant-visible catalog-order promise.
- **FR-021**: One rejected candidate MUST produce at most one later
  room-authoritative candidate occurrence; duplicate or competing attempts MUST
  NOT double-advance or create a hidden skipped occurrence.
- **FR-022**: When a next candidate becomes current, all fixed voters MUST begin
  with zero accepted decisions for that occurrence, and decisions from prior
  candidates MUST NOT be counted, copied or attributed to it.
- **FR-023**: Progression MUST preserve every previously accepted Feature 007
  decision as immutable and bound to its original voter and candidate; it MUST
  NOT edit, retract, delete or reassign a decision.
- **FR-024**: A transient, incomplete or malformed next-candidate search MUST
  create no speculative candidate or terminal outcome, MUST preserve prior
  resolved state and MUST offer safe progression retry/recovery.
- **FR-025**: Retry after a source failure or uncertain response MUST recover an
  already committed next candidate or safely continue the same logical step; it
  MUST NOT create an additional progression step.
- **FR-026**: A no-further-candidate outcome MUST become authoritative when, and
  only when, one bounded, error-free Feature 006-style attempt completes all
  work required by its approved search contract and observes no eligible
  unpresented movie.
- **FR-027**: No-further-candidate MUST be a stable recoverable room outcome,
  remain distinct from agreement and transient failure, expose no acquisition
  Retry, provide a new-room/selection-session action and never use a fixture or
  broaden the frozen constraint.
- **FR-028**: Feature 006's original first-candidate `no_candidates` outcome MUST
  remain stable and MUST NOT be treated as a rejected candidate or progression
  trigger.
- **FR-029**: Once a next identity is authoritative, metadata, poster or response
  failure MUST preserve that identity and use Feature 006 recovery behavior;
  such failure MUST NOT advance again.
- **FR-030**: Concurrent final decisions from distinct voters MUST each preserve
  their Feature 007 ownership and may complete the set, but together MUST produce
  only the one correct candidate outcome.
- **FR-031**: Duplicate, replayed or lost-response recovery of the final decision
  MUST be logically idempotent and MUST NOT contribute twice, resolve twice,
  double-advance or skip a candidate.
- **FR-032**: An authorized stale client acting on a resolved candidate MUST be
  unable to change that candidate's decisions or outcome and MUST reconcile to
  the authoritative current room state.
- **FR-033**: Late or losing source results and stale success, failure or pending
  states MUST NOT replace, hide or contradict an agreed stop, authoritative next
  candidate or no-further-candidate terminal. A candidate-source result MAY
  update generation-matched metadata, but MUST NOT install authoritative room
  progression or decision-count state from an assumed fresh `0/N`; that state
  MUST come from the canonical room projection or an equivalent lock-consistent
  projection.
- **FR-034**: Every authorized voter and non-voting creator MUST observe the same
  room-level progression outcome and, when one exists, the same authoritative
  current candidate.
- **FR-035**: Reload, reconnect, same-identity QR/link/code re-entry and recovery
  from missed updates MUST restore the authoritative candidate outcome and
  applicable current candidate without replaying prior decisions.
- **FR-036**: Canonical room recovery MUST be sufficient for convergence and
  MUST NOT depend on continuous connectivity or receipt of every live update.
  Its monotonic merge MUST accept every valid transitive forward observation,
  including higher-sequence advancing/exhausted states and same-sequence
  collecting-to-exhausted recovery when an intermediate state was missed; it
  MUST ignore observations provably older than current authority and, among
  strictly valid observations, fail closed only for genuinely conflicting or
  incomparable states.
- **FR-037**: A complete Feature 007 decision set that already exists when
  Feature 008 becomes active MUST resolve according to this policy without
  requiring a new or changed voter decision and with the same exactly-once rules.
- **FR-038**: A voting creator MUST contribute exactly one decision like any
  other fixed voter; a non-voting creator MUST contribute none but may observe
  the safe shared progression state.
- **FR-039**: Feature 008 MUST reuse Feature 007's authoritative decision model
  and write path and MUST NOT introduce a second decision transport, decision
  channel, editable answer or direct client mutation of protected decision state.
- **FR-040**: Direct client mutation of protected progression, candidate-source
  authority or another participant's decisions MUST be denied; clients may only
  request approved actions and recover their authoritative results.
- **FR-041**: Feature 008 MUST preserve Feature 007's individual-decision privacy.
  Shared outcome/progress visibility MUST NOT expose another voter's attributed
  answer, internal identity or a roster solely for progression.
- **FR-042**: Unauthorized and cross-room callers MUST NOT read protected
  decision/progression state, infer another room's candidate outcome or cause any
  candidate or decision change.
- **FR-043**: If fixed membership, required count, current candidate, accepted
  decision detail or completion summaries disagree, the system MUST fail closed
  with no resolution or progression rather than repair by dropping a voter,
  inventing a vote or trusting client state.
- **FR-044**: Feature 008 MUST NOT change the fixed voting group, required voter
  count, creator voting choice, frozen filters or compatible common resolution.
- **FR-045**: The threshold definition and candidate-bound outcome MUST remain
  independent of decision arrival order and final-voter identity so a future
  approved feature may change resolution timing without redefining accepted
  decisions or the threshold; Feature 008 itself MUST still perform no early
  resolution.

### Non-Functional Requirements

- **NFR-001 - Atomic authority**: The system boundary that owns shared room state
  MUST enforce complete-set resolution, agreement stopping and one-step
  progression as atomic logical invariants under concurrent decisions, retries
  and source proposals; caller convention alone is insufficient.
- **NFR-002 - Convergence**: Under the controlled healthy local full-stack
  profile, every already-open authorized browser MUST display the same resolved
  room outcome and current-candidate meaning within 5 seconds of the
  authoritative transition, without manual refresh.
- **NFR-003 - Recoverability**: Agreed/stopped, next-candidate, advancing failure
  and no-further-candidate meanings MUST survive reload, temporary disconnection,
  missed updates, same-identity re-entry, response loss and retry.
- **NFR-004 - Determinism**: The same fixed `N` and complete candidate-bound
  decision multiset MUST always produce the same threshold and outcome,
  independent of client, order, connectivity and floating-point behavior.
- **NFR-005 - Source and sequence correctness**: Every successful successor MUST
  satisfy Feature 006 eligibility, differ from all previously resolved candidates
  in the session and occupy exactly one logical next position.
- **NFR-006 - Failure safety**: Partial processing, upstream failure, malformed
  data, duplicate requests and stale results MUST never fabricate agreement,
  erase decisions, broaden eligibility, rotate an authoritative next candidate,
  double-advance or turn incomplete search into exhaustion.
- **NFR-007 - Security and privacy**: Access MUST remain denied by default
  outside approved room roles. Progression MUST expose no credentials, private
  common constraint, individual filter, attributed other-voter decision or
  foreign-room outcome.
- **NFR-008 - Usability and accessibility**: Collecting, advancing, retryable
  failure, agreed/stopped and no-further-candidate states MUST be understandable
  without relying only on color, animation, gesture or internal identifiers.
- **NFR-009 - Bounded scope**: The release MUST add only the fixed agreement
  policy and authoritative candidate sequencing/recovery. It MUST add zero Match
  experiences, dynamic-membership behavior, threshold modes, decision-editing
  behavior or alternate candidate sources.
- **NFR-010 - Future timing compatibility**: This release MUST not claim that
  full-set timing is inherent to the threshold formula. A later approved feature
  may add early resolution while preserving the same threshold and historical
  accepted decisions; no such behavior is present or required now.

### Key Entities

- **Candidate occurrence**: One logical position in a room's selection session,
  identified by its authoritative TMDB movie and relationship to the immediately
  preceding resolved occurrence. The exact persistence representation is left
  to planning.
- **Candidate decision set**: The immutable Feature 007 decisions belonging to
  the fixed voters and one candidate occurrence; it becomes resolution-eligible
  only at exactly `N/N`.
- **Agreement policy**: The fixed integer rule that maps voting participant
  count to the minimum yes count and classifies a complete decision set.
- **Candidate outcome**: The authoritative room-level result for one complete
  decision set: agreed/stopped or not agreed. It is produced once and does not
  disclose individual answers.
- **Progression state**: The shared meaning that the room is collecting,
  advancing, retryable after source failure, on one next candidate, agreed and
  stopped, or stopped because no further candidate was observed.
- **Resolved-candidate history**: The session-scoped identities already
  considered through complete decision sets. It prevents re-presentation without
  defining a canonical movie catalog or participant-visible ranked deck.
- **Feature 009 agreement handoff**: The durable association among the agreed
  outcome, its TMDB candidate identity and the authoritative room context needed
  by the future Match feature. It is not itself a match presentation or
  confirmation flow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every participant count from 2 through 10, 100% of threshold
  boundary tests classify `T - 1` yes decisions as non-agreement and `T` yes
  decisions as agreement using the normative values 2, 2, 3, 4, 4, 5, 6, 6 and 7.
- **SC-002**: In every incomplete-set test, including already-inevitable and
  already-impossible agreement, zero candidate outcomes, next-candidate
  acquisitions or progression terminals occur before `N/N` decisions.
- **SC-003**: Across all concurrent-final-decision, duplicate, replay,
  lost-response and overlapping-source tests, each complete candidate produces
  exactly one logical outcome; each non-agreeing candidate produces at most one
  authoritative successor and the sequence advances by exactly one occurrence.
- **SC-004**: Under the controlled healthy local profile, 100% of already-open
  authorized browsers in tested two-, three- and four-voter rooms converge on
  the same outcome and candidate meaning within 5 seconds, with zero manual
  refreshes and zero conflicting authoritative candidates observed.
- **SC-005**: In 100% of reload, reconnect, missed-update, same-identity re-entry
  and committed-response-loss cases, each authorized member recovers the one
  authoritative outcome and applicable candidate without replaying a decision
  or creating another progression step.
- **SC-006**: In every tested agreement case, the agreed candidate identity is
  preserved and zero later candidate acquisitions, assignments, active decision
  targets or progressions occur for that selection session.
- **SC-007**: In every successful non-agreement progression case, the next
  candidate satisfies the exact Feature 006 constraint, differs from every
  previously resolved candidate in the session, begins at 0 of `N` decisions and
  receives zero copied or reattributed prior decisions.
- **SC-008**: In 100% of stale-client and delayed-result cases, old actions cause
  zero decision changes, candidate replacements, duplicate advancements or
  hidden skipped occurrences and the client reconciles to canonical state.
- **SC-009**: In every transient-source and completed-empty acceptance case,
  participants distinguish retryable progression failure from stable no-further-
  candidate, and incomplete work produces zero exhaustion terminals.
- **SC-010**: Across all unauthorized, cross-room and direct-mutation checks,
  there are zero protected-state disclosures or changes and zero disclosures of
  another voter's attributed decision.
- **SC-011**: Browser-first Feature 008 owner acceptance uses no more than 6
  independent identities while covering exact-two agreement, larger-group
  agreement, larger-group non-agreement progression, non-voting creator
  observation, concurrency/retry/stale behavior, reload/reconnect, source
  failure and no-further-candidate.
- **SC-012**: Across the complete Feature 008 acceptance suite, zero Match
  screens, celebrations, confirmation flows, post-match actions, configurable
  threshold controls, early resolutions, decision edits, dynamic-membership
  changes or alternate candidate sources appear.

## Assumptions

- Features 003-007 are complete and remain authoritative for fixed membership,
  local-identity recovery, frozen filters, compatible resolution, TMDB sourcing,
  shared candidate identity and immutable voter decisions.
- The fixed voting group is not repaired within Feature 008. An absent voter
  remains required even while disconnected; removal or replacement needs a
  separately approved dynamic-membership feature.
- Existing Feature 007 decision rows can remain as immutable history when the
  current candidate changes. The specification requires their meaning and
  preservation, not a particular storage design.
- The current compatible filter result remains unchanged for every occurrence in
  the room's selection session.
- Any eligible, not-previously-resolved movie is an acceptable next candidate.
  No user-visible deterministic ordering exists to preserve, so skip prevention
  concerns extra authoritative room occurrences rather than positions in TMDB's
  mutable result pages.
- Normal connectivity and responsive services exist except in scenarios that
  explicitly exercise disconnection, response loss, source failure or metadata
  failure.
- Existing local participant identity remains the recovery boundary; permanent
  accounts and cross-device identity transfer remain outside scope.
- A neutral shared indication that agreement stopped progression is necessary to
  make the Feature 008 handoff observable and is not Feature 009 Match UX.

## Dependencies and Preserved Guarantees

- The [constitution](../../.specify/memory/constitution.md),
  [product vision](../../docs/product-vision.md),
  [MVP roadmap](../../docs/mvp-roadmap.md) and
  [testing strategy](../../docs/testing-strategy.md) govern this specification.
- [Feature 003](../003-generalized-room-membership-qr/spec.md) supplies the fixed
  assembled voting group, creator/voter distinction, room authorization and
  same-identity recovery. Feature 008 invents no membership policy.
- [Feature 004](../004-participant-filters/spec.md) and
  [Feature 005](../005-common-filter-resolution/spec.md) supply frozen voter
  inputs and the stable compatible private constraint. Progression does not
  reopen or weaken them.
- [Feature 006](../006-tmdb-candidate-source/spec.md) supplies the only candidate
  source, exact eligibility, TMDB metadata authority, empty/failure distinctions
  and shared candidate recovery. Feature 008 extends it only with authoritative
  sequencing and session-local exclusion of resolved identities.
- [Feature 007](../007-swipe-decisions/spec.md) supplies the only decision
  records, values, ownership, immutability, privacy, completion and exact-two
  agreement meaning. This specification resolves its intentionally deferred
  larger-group blocker without rewriting that completed historical slice.
- Feature 009 may consume the agreed/stopped handoff and build the Match
  experience. Feature 008 neither implements nor depends on Feature 009 UX.

## Minimum Acceptance and Testing Strategy

`docs/testing-strategy.md` is normative. Planning MUST refine this bounded,
browser-first set and MUST NOT mechanically rerun all historical browser cases.

- **Current-feature real-stack browser owner acceptance (`F <= 6`)**:
  - **L01 - 2 identities maximum**: two voters prove incomplete waiting,
    yes/yes agreement, no progression after agreement, neutral stopped recovery,
    reload/reconnect and absence of Match UX. Reuse the identities in a bounded
    second room to prove a complete set containing `no` progresses once.
  - **L02 - 4 identities maximum**: one non-voting creator plus three voters
    prove threshold 2, creator exclusion, concurrent final decisions, one shared
    next candidate after non-agreement in a bounded second room, zero reused
    decisions, stale-tab reconciliation and all-client convergence. Reuse those
    same four case-owned identities in bounded four-voter rooms, with the creator
    configured as a voter there, to prove `N=4`, `T=3`, no early outcome after
    three early yes or two early no decisions, agreement at three yes, and
    non-agreement/progression at two yes without increasing `F`.
  - **L03 - 2 identities maximum, reused from L01**: after non-agreement, prove
    retryable source failure, lost progression response, later same-step success,
    completed no-further-candidate, terminal recovery and no fixture fallback.
- **Threshold authority**: exhaustive deterministic tests cover every `N` from 2
  through 10 at `T - 1` and `T`, plus incomplete inevitable/impossible cases,
  without relying on browser orchestration as the concurrency or arithmetic oracle.
- **State-transition authority**: deterministic tests cover concurrent last
  voters, same-voter duplicates/conflicts inherited from Feature 007, outcome
  idempotency, competing next proposals, stale expected candidate, rollback,
  agreement stopping, prior-decision preservation, no-repeat history and
  complete-versus-incomplete source exhaustion.
- **Client behavior**: focused tests cover collecting/advancing/agreed/exhausted
  presentation, one canonical candidate generation, stale-result suppression,
  reload/reconnect recovery, old-candidate input rejection, accessibility and
  the absence of local progression or Match navigation.
- **Permanent smoke and impact review**: retain the current cross-feature smoke
  profile. Planning must update only the normal decision-completion endpoint that
  deliberately evolves from Feature 007's unchanged candidate to Feature 008's
  stopped or next-candidate state, and select additional historical browser cases
  only when the recorded impact review identifies a changed boundary not already
  covered by L01-L03.
- **Other mandatory gates**: applicable migration, clean-reset, generated-type,
  full authoritative-state/client, lint, typecheck, build, supported export,
  security and finalized-artifact checks remain required at zero additional
  browser identities.

### Observable Boundaries for Later Impact Review

- Feature 007's `N/N` completion now continues to one authoritative candidate
  outcome, while every incomplete state retains the unchanged candidate.
- The existing shared room lifecycle must now recover either the same agreed
  candidate, one next candidate, a retryable advancing state or stable source
  exhaustion.
- Feature 006's one-candidate source contract is reused for later occurrences
  with session-local exclusion; eligibility, metadata authority and source
  failure meanings remain unchanged.
- Decision privacy remains intact while a safe room-level progression result is
  shared with voters and a non-voting creator.
- The decision surface gains a candidate-generation boundary: prior accepted
  decisions stay historical and the next candidate starts undecided.
- Auth bootstrap, invitations, QR decoding, fixed membership admission, filter
  editing/freeze and common-filter calculation are not changed by this feature.

## Resolved Product Decisions

- **Agreement threshold**: exactly two yes decisions for two voters; for three
  or more voters, `(2 * N + 2) div 3`, the integer-only equivalent of
  `ceil(N * 2 / 3)`.
- **Resolution timing**: evaluate only after all `N` fixed voters have accepted
  one decision for the current candidate. No inevitable/impossible early
  resolution occurs in Feature 008.
- **Agreement behavior**: preserve the agreed candidate and stop all candidate
  progression for the selection session, leaving a durable Feature 009 handoff
  but no Match UX.
- **Non-agreement behavior**: perform one authoritative progression step to one
  distinct eligible candidate from the Feature 006 source and start its decision
  set at zero.
- **Sequence safety**: previously resolved candidates cannot reappear in the same
  selection session; retries, concurrency and stale clients cannot double-
  advance or create skipped authoritative occurrences.
- **No-further-candidate behavior**: only a completed, bounded, error-free source
  attempt can establish stable exhaustion; incomplete work remains retryable.
- **Membership basis**: the fixed Feature 003 group governs completion and
  threshold calculation regardless of current connectivity. No dynamic
  membership policy is introduced.
- **Decision continuity**: Feature 007 remains the sole immutable decision model
  and submission path. Progression changes no accepted decision.
- **Future early-resolution compatibility**: the threshold is defined separately
  from Feature 008's full-set timing, so a future approved feature may change
  timing without changing this agreement arithmetic or historical decisions.

## Unresolved Decisions

None. The former larger-group agreement blocker from Feature 007 is fully
resolved by this specification. No newly discovered product ambiguity blocks
planning; technical representation and transaction design belong to
`/speckit.plan` and must preserve these observable invariants.
