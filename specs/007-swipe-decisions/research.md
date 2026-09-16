# Phase 0 Research: Swipe Decisions

**Feature**: 007 — Swipe Decisions

**Date**: 2026-09-16

**Status**: Complete; every implementation-context question needed by Feature
007 has a decision. The intentionally deferred agreement policy for rooms with
more than two voters remains outside this feature and is not an implementation
unknown here.

## Repository Findings

- Feature 006 stores the one canonical candidate identity on `public.rooms` as
  a positive `tmdb_movie_id` when `candidate_acquisition_status = 'assigned'`.
  Its client candidate model already carries that ID without displaying it as
  movie metadata.
- Fixed voter identity is represented by `public.room_members`; a creator may
  be an authorized non-voting observer. Existing room RPCs derive the caller
  from Supabase Auth rather than trusting a caller-supplied member or user ID.
- The client has feature-local modules under `src`, a single room route and one
  rooms-table Realtime subscription. The subscription is an invalidation signal
  followed by an authoritative refetch, not the source of room truth.
- Gesture Handler 2.32, Reanimated 4.5 and Worklets are already installed. The
  application root does not yet install `GestureHandlerRootView`.
- The implemented real-stack suites before Feature 007 contain 42 cases and
  100 browser identities across suites E/G/H/I/J. The testing strategy's older
  36/82 inventory was corrected during planning.

## R1. Authoritative Persistence Boundary

**Decision**: PostgreSQL owns decisions through two authenticated
`SECURITY DEFINER` RPCs. The detail table has RLS enabled, no permissive policy,
no client table privileges and is not queried directly by the application.

**Rationale**: One transaction must bind authenticated identity, fixed voter
authorization, current candidate identity, uniqueness and the completion
summary. Database authority gives deterministic concurrency behavior and
matches the project's established room/filter patterns. It also prevents any
client from enumerating another voter's answer.

**Alternatives considered**:

- Direct table inserts were rejected because they distribute authorization and
  count maintenance between RLS, triggers and client assumptions.
- An Edge Function was rejected because the operation uses no external secret
  or provider and would still require a database transaction for correctness.
- Local-only state was rejected because it cannot survive reload/reconnect or
  converge across real clients.

## R2. Detail and Aggregate Shape

**Decision**: Add `public.candidate_decisions`, keyed by
`(room_member_id, tmdb_movie_id)`, and add only
`rooms.decision_completed_count`. Store the closed enum `yes | no` and an
immutable acceptance timestamp in each detail row. Do not persist a yes-count,
agreement flag or copied room/user identity.

**Rationale**: The pair is the exact domain identity in the specification.
Membership provides the room and voter relationship; TMDB identity prevents a
future candidate from colliding with an earlier decision. A room-level total is
safe to broadcast and lets the existing rooms channel signal progress without
exposing individual values.

**Alternatives considered**:

- A single JSON decision map on `rooms` was rejected because it complicates
  ownership, privacy, constraints and concurrent updates.
- A full public decision projection was rejected because even voter identifiers
  paired with values disclose individual choices.
- Persisted agreement was rejected because it is derived for exactly two
  voters and undefined by product policy for larger rooms.

## R3. First-Write-Wins and Idempotency

**Decision**: The first valid insert for a voter/candidate pair is immutable.
A same-value repeat returns `unchanged`; an opposite-value repeat returns
`conflict` with the stored answer. Both perform zero writes. The primary key and
room-row transaction serialize races. No request-ID ledger is introduced.

**Rationale**: The durable pair plus the authoritative stored answer is enough
to recover duplicate submissions, concurrent opposite submissions and a
committed response whose network reply was lost. A separate idempotency record
would add lifecycle and retention state without improving the observable
contract.

**Alternatives considered**:

- Last-write-wins and mutable updates were rejected because the first accepted
  value is final in Feature 007.
- Treating an opposite repeat as a generic success was rejected because it can
  falsely confirm the requested value.
- A client-generated request UUID was rejected as unnecessary state.

## R4. Candidate Binding and Stale-Action Guard

**Decision**: Both RPCs accept an expected positive TMDB ID, but the database
derives the actual candidate from the locked room row. A mismatch returns
`candidate_changed` and never writes. A candidate must be in the complete,
compatible Feature 006 `assigned` state.

**Rationale**: The expected ID binds a UI action to the candidate the user
actually saw, while retaining the room row as the sole assignment authority.
It also protects against stale callbacks and prepares the boundary for later
candidate progression without implementing progression now.

**Alternatives considered**:

- Trusting the client ID was rejected because clients cannot define canonical
  room state.
- Omitting an expected ID was rejected because a delayed gesture could
  otherwise be applied after a future candidate transition.

## R5. Privacy-Safe Result Projection

**Decision**: Successful authorized results expose only the caller's decision,
`decision_completed_count`, `required_voter_count`, derived completeness and a
nullable exact-two agreement. Missing or foreign rooms return `not_found` with
all protected fields null. Other voters' identities and values never appear.

For a room with exactly two required voters, `two_voter_agreement` is `true`
only when both rows exist and both are `yes`; it is `false` while incomplete or
when either answer is `no`. For a larger room it is always `null`.

**Rationale**: This is sufficient for current UI recovery and exact-two
verification. `null` is an explicit non-policy for larger rooms rather than an
accidental threshold.

**Alternatives considered**:

- Returning all answers was rejected for privacy and lack of UI need.
- Returning a boolean for larger rooms was rejected because it would silently
  establish the deferred policy.

## R6. Synchronization Strategy

**Decision**: Reuse the one existing `public.rooms` Postgres Changes channel.
The first accepted decision increments the room count and updates `updated_at`
in the same transaction. A room event invalidates local projections; clients
refetch the room and recover their own decision through the private RPC.
Duplicate/conflict paths produce no room update or event.

**Rationale**: Supabase Postgres Changes follows table authorization and is
best treated here as a synchronization hint, while RPC/refetch remains the
truth source. This preserves one room-scoped lifecycle and tolerates missed,
duplicate and reordered events. See [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization).

**Alternatives considered**:

- Publishing the decision table was rejected because it enlarges the privacy
  surface and requires a second subscription lifecycle.
- Broadcasting full decision payloads was rejected because they are neither
  authoritative nor privacy-safe.

## R7. Client Recovery State Machine

**Decision**: Add a feature-local state machine keyed by room ID plus TMDB ID.
It recovers before enabling input, permits one in-flight submission, does not
optimistically claim acceptance and adopts only validated RPC results for the
active generation. Network uncertainty becomes recoverable; a retry or read
reconciles the stored value.

Voting controls exist only for fixed voters with a recognizable assigned
candidate. They remain usable for `loading-poster`, `available`, `poster-error`
and `no-poster`, because those presentations share an already known identity.
They are withheld for metadata acquisition/loading/error, no-candidates and
integrity-error states. Authorized non-voters see the candidate without voting
controls.

**Rationale**: Candidate identity, not poster success, is the decision target.
Generation keys stop earlier room/candidate callbacks from corrupting restored
state. Waiting for authority avoids false confirmation after transport failure.

**Alternatives considered**:

- Optimistically locking in the swipe value was rejected because the database
  may recover a different race winner.
- Disabling all input until poster success was rejected because imagery is not
  candidate authority.

## R8. Swipe Mechanics

**Decision**: Wrap the app root in `GestureHandlerRootView`. Use a single-pointer
`Gesture.Pan` with horizontal activation (`activeOffsetX: [-12, 12]`) and
vertical failure (`failOffsetY: [-24, 24]`). Accept only when horizontal travel
reaches `clamp(width * 0.25, 72, 120)` and
`abs(translationX) >= 1.25 * abs(translationY)`. Positive travel maps to yes;
negative travel maps to no. Under-threshold, vertical and cancelled gestures
spring to center and submit nothing. Only a completed accepted gesture schedules
one JavaScript submission.

**Rationale**: Thresholds are deterministic across practical phone widths,
reject ambiguous diagonal movement and can be unit-tested independently.
Gesture updates and card motion remain on the UI thread. Gesture Handler's Pan
API supplies activation/failure offsets and worklet callbacks; Reanimated's
spring supports a system reduced-motion mode on Android, iOS and web. See the
[Pan gesture documentation](https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/use-pan-gesture/)
and [Reanimated `withSpring`](https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring/).

**Alternatives considered**:

- Adding another swipe package was rejected because the installed stack covers
  the interaction.
- Velocity-only acceptance was rejected because short flicks are harder to
  discover and validate consistently.

## R9. Equivalent Web and Accessible Input

**Decision**: Always render explicit No and Yes buttons in addition to the
gesture. Each is at least 44 by 44 logical pixels, has an accessible name,
role/state and keyboard activation. Confirmation and actionable failure text is
announced through a live region, does not rely only on color or motion, and
honors system reduced-motion preferences. Web acceptance uses a desktop
keyboard path and a separate 390×844 touch-capable context.

**Rationale**: A swipe alone is undiscoverable to keyboard and assistive
technology users. React Native exposes cross-platform accessible labels, roles,
states and Android live-region semantics; the web rendering retains equivalent
button behavior. See [React Native Accessibility](https://reactnative.dev/docs/accessibility).

**Alternatives considered**:

- Gesture-only controls were rejected as inaccessible and not web-equivalent.
- Hover-only web affordances were rejected because they fail touch web and
  keyboard use.

## R10. Migration and Generated Types

**Decision**: Deliver one additive migration,
`20260916000000_swipe_decisions.sql`, which defines the enum, relation,
constraints, room column, rewritten create/join contracts and decision RPCs.
Prove both a nonempty pre-Feature-007 upgrade and clean replay. Regenerate
database types exactly once after the SQL contract stabilizes; all later gates
use check-only type validation.

**Rationale**: Current RPC return types and room column grants are migration
owned, so the migration must update them coherently. One controlled generated
artifact write prevents test commands from masking drift.

**Alternatives considered**:

- Multiple migrations during the same feature were rejected because there is
  no deployed Feature 007 compatibility boundary to preserve.
- Hand-editing generated types was rejected because schema generation is the
  authority.

## R11. Executable Evidence

**Decision**: Database tests own uniqueness, ACL/privacy, stale-candidate,
atomic-count and concurrent-transaction truth. Client tests own contract
validation, generation guards, recovery and gesture/button accessibility.
Playwright cases K01 and K02 own representative real-client cooperation; a
targeted historical J03 case proves the candidate remains decidable across
poster presentation states.

K01 covers a two-voter room with the creator voting, desktop keyboard plus
mobile touch, all exact-two outcomes, repeat/conflict/response-loss and reload
recovery. K02 covers a four-seat room with a non-voting creator and three
voters, creator exclusion, independent concurrent answers, full completion and
the absence of a larger-group agreement result. The post-feature full suite is
44 cases / 106 identities; full plus the separate C1 security identity is 107.

**Rationale**: Deterministic lower layers carry exhaustive races and branches;
bounded browser cases demonstrate genuine client/backend integration without
an unbounded combinatorial matrix. The owner-normal acceptance budget is 25
browser identities; repeatability is 47, fresh-checkout is 17, and the combined
repeat/fresh profile is 64.

**Alternatives considered**:

- Browser-only concurrency proof was rejected because scheduling cannot prove
  transaction invariants deterministically.
- Mock-only client evidence was rejected because it cannot demonstrate two real
  identities converging on the same backend state.
