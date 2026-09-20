# Phase 0 Research: Candidate Progression

**Feature**: 008 — Candidate Progression

**Date**: 2026-09-18

**Status**: Complete and owner-approved. Repository inspection and analysis
remediation produced no `NEEDS CLARIFICATION` item or unresolved blocker.

## Repository Findings

- `public.rooms` is the shared authority and the only relation in the
  `supabase_realtime` publication. Ordinary clients receive ID-only room UPDATE
  invalidations, then refetch an exact member-scoped safe projection.
- Feature 003 materializes fixed membership in `public.room_members` and stores
  `required_voter_count`/`voter_count` on the room. A non-voting creator is an
  authorized observer; later joins are refused after the required voter count is
  reached. Feature 008 needs no membership model.
- Feature 006 stores one private `tmdb_movie_id` and a public
  `candidate_acquisition_status` on the room. Its single authenticated Edge
  Function performs JWT verification, calls service-role-only preflight/commit
  RPCs, searches TMDB with a frozen private constraint, and adopts the database
  compare-and-set winner. Its source distinguishes `search_incomplete` from
  `completed_empty` and loads metadata separately after identity commit.
- Feature 006's search already has deterministic internal traversal, per-attempt
  duplicate suppression, exact eligibility, a default 100-request budget and a
  20-second deadline. It currently stops at the first eligible movie and knows
  nothing about room history.
- Feature 007 stores immutable decisions in a grant-free, RLS-enabled table and
  uses authenticated `get_room_candidate_decision` and
  `submit_room_candidate_decision` RPCs. Submission locks the room row before
  validating/inserting, so all decision writes for one room serialize while
  different rooms remain independent.
- Feature 007 keys a decision by `(room_member_id, tmdb_movie_id)`, keeps a
  privacy-safe `rooms.decision_completed_count`, and currently derives only
  exact-two agreement. Neither the decision table nor private candidate identity
  is published to clients.
- The Feature 007 client globally merges the decision count with `Math.max` and
  keys decision state by room ID plus TMDB ID. Both choices are safe for one
  immutable candidate but cannot express a new occurrence resetting to `0/N`.
- Candidate client state is room-generation scoped and treats
  `pending -> assigned | no_candidates` as irreversible. It must become
  authoritative candidate-sequence scoped rather than invent a second channel.
- Existing migrations revoke table defaults, rebuild exact column grants, use
  `SECURITY DEFINER SET search_path = ''`, preserve historical migration hashes,
  test nonempty cutovers, and allow one deliberate generated-type write only
  after SQL stabilizes.
- The normative browser policy fixes C1 at one identity and permanent smoke at
  16. Feature 008's specified L01/L02 owner budget is exactly six. Separate
  cases may not share identity, but identities may be reused for multiple rooms
  and subflows inside one case.

## R1. Candidate Occurrence Identity

**Decision**: Add a protected `room_candidate_occurrences` ledger and bind each
decision to an occurrence UUID. Retain a safe per-room candidate sequence for
client ordering and enforce unique `(room_id, sequence)` plus unique
`(room_id, tmdb_movie_id)`.

**Rationale**: TMDB movie identity answers “which movie,” while an occurrence
answers “which logical decision epoch.” Feature 007 has no durable epoch other
than the movie ID, so it cannot independently prove a fresh decision set if the
same movie ever recurs. The ledger also supplies immutable resolved history,
the exact Feature 009 agreed handoff and an authoritative no-repeat set.

**Alternatives considered**:

- Reusing only `rooms.tmdb_movie_id` was rejected because clearing/replacing it
  loses the resolved sequence and cannot key historical decisions safely.
- Keeping only `(member, tmdb_movie_id)` was rejected even with today's
  no-repeat rule because occurrence identity is a stated domain distinction and
  would make a future approved revisit inherit decisions unless remigrated.
- Pre-generating a candidate queue was rejected because Feature 006 makes no
  stable catalog-order promise and the feature needs only one successor at a
  time.

## R2. Room Progression Projection

**Decision**: Add room progression status
`inactive | collecting | advancing | agreed | exhausted` and integer
`candidate_sequence`. Keep existing acquisition status, private TMDB ID and
safe decision count, but constrain their legal combinations.

**Rationale**: Acquisition status alone cannot distinguish initial empty from
post-rejection exhaustion, assigned-and-collecting from assigned-and-agreed, or
pending-first-candidate from retryable advancement. A separate progression
status expresses product meaning while preserving Feature 006's acquisition
contract. Sequence is the monotonic stale-state/CAS key; it is not movie data
and is safe to project.

**Alternatives considered**:

- Expanding `candidate_acquisition_status` with progression outcomes was
  rejected because it would conflate source availability with decision outcome
  and make the Feature 006 initial terminal ambiguous.
- A boolean `agreed` plus nullable flags was rejected because it admits invalid
  combinations and has no explicit advancing/exhausted transition.
- Publishing occurrence rows was rejected because clients need only one safe
  current projection, not history or internal identifiers.

## R3. Full-Set Resolution Authority

**Decision**: Evolve the existing decision submission transaction. Under the
room row lock, the first accepted final decision inserts once, verifies exactly
`N` occurrence decisions, calculates the threshold with integer arithmetic, and
atomically marks the occurrence and room agreed or rejected/advancing.

**Rationale**: The decision RPC already owns authenticated identity,
first-write-wins semantics, exact candidate binding and room serialization.
Resolving in the same transaction prevents an observable complete-but-unresolved
state for new submissions and ensures concurrent final voters produce one
outcome. No trigger or second decision transport is needed.

**Alternatives considered**:

- Client calculation was rejected because it cannot serialize callers or read
  private authoritative decisions safely.
- A separate mandatory “resolve” RPC after final submission was rejected because
  it creates a crash window and a second user-visible operation. Pre-existing
  complete sets are handled by migration instead.
- A database trigger on decision insert was rejected because the existing RPC
  transaction can express the same invariant explicitly and return the
  canonical outcome without hiding control flow.

## R4. Threshold Arithmetic and Timing

**Decision**: Use one private integer helper: `2` when `N = 2`; otherwise
`((2 * N::bigint) + 2) / 3`, cast back to integer after validating `N >= 2`.
Invoke resolution only when the accepted occurrence decision count becomes
exactly `N`.

**Rationale**: Casting before multiplication prevents 32-bit intermediate
overflow and PostgreSQL integer division provides the required no-float rule.
Keeping the threshold function independent of the “count = N” eligibility test
makes later approved early resolution possible without changing arithmetic or
decision history.

**Alternatives considered**:

- Floating-point `ceil(2*N/3)` was rejected by the specification.
- Comparing yes/no inevitability before `N/N` was rejected as early resolution.
- Persisting a configurable threshold was rejected because policy is fixed.

## R5. External Source Transaction Split

**Decision**: Resolve rejection to a durable `advancing` state in PostgreSQL,
then run TMDB search outside the transaction through the existing Edge Function.
Commit a candidate or exhaustion with a room-locked compare-and-set on expected
rejected sequence `k`.

Every source prepare/commit follows one lock protocol: first authorize the
actor/room relationship without taking the room lock, then lock only the
authorized room row, then revalidate authorization and the applicable frozen
handoff under that lock. A foreign caller never joins the target lock queue.

**Rationale**: External HTTP cannot participate in a PostgreSQL atomic
transaction. Holding the room lock across a 20-second provider attempt would
block unrelated room actions and still would not make the provider call
transactional. The durable barrier means a failure leaves one recoverable step;
the sequence check means every retry addresses that same step.

**Alternatives considered**:

- Calling TMDB while holding a database lock was rejected for latency,
  availability and non-atomicity.
- A client-side fetch/commit loop was rejected because clients must not own
  sequence or private filters.
- A queue/background worker was rejected as infrastructure not required by the
  approved browser-triggered recovery model.

## R6. Exactly-Once Logical Advancement

**Decision**: Name one progression step by `(room_id, rejected_sequence)`.
Candidate/exhaustion commits acquire the room lock, require `advancing` at that
sequence, and either insert exact ordinal `sequence + 1` or mark the same step
exhausted. Unique ordinal and room/TMDB constraints backstop the compare-and-set.

**Rationale**: This state/key pair survives response loss without a request-ID
ledger. A retry sees the already installed successor or terminal. Two different
proposals cannot both satisfy the expected sequence after the first commit, and
no caller can insert an ordinal greater than `expected + 1`.

**Alternatives considered**:

- Client-generated request IDs were rejected because the rejected occurrence
  already is the durable idempotency key.
- “Last candidate ID” comparison alone was rejected because it does not order
  transitions or distinguish a later same-step terminal.
- Optimistic client winner selection was rejected because losing proposals
  could be rendered before authority.

## R7. Feature 006 Source Evolution

**Decision**: Keep the request endpoint/body and search algorithm. Evolve
server-only preflight to return expected sequence and the room's occurrence IDs
as a private exclusion set. Extend `searchTmdbCandidate` to skip exclusions;
retain all existing eligibility, traversal and failure rules.

**Rationale**: Feature 008 owns only sequence. The current source already has
the required filters, locale, adult exclusion, metadata integrity and bounded
empty/failure distinction. Supplying exclusions from PostgreSQL prevents a
client from narrowing/broadening history and lets the same traversal establish
authoritative exhaustion.

**Alternatives considered**:

- A second “next candidate” endpoint/source was rejected as duplicate authority.
- Client-supplied seen IDs were rejected as untrusted and fork-prone.
- Treating the next TMDB page as a durable deck position was rejected because
  Feature 006 promises no externally stable ordering.

## R8. Failure and Exhaustion

**Decision**: `search_incomplete` performs no database write and leaves the room
durably `advancing`; the client overlays a recoverable request failure and may
retry. Only `completed_empty`, committed with the expected sequence, changes
the room to stable `exhausted`. Initial Feature 006 empty remains
`inactive/no_candidates`.

**Rationale**: Retaining advancing state makes retry and reload safe without a
failure-event ledger. Exhaustion needs durable shared meaning; transient
provider diagnostics do not. The existing source result taxonomy already
separates the two.

**Alternatives considered**:

- Persisting every provider failure was rejected as unnecessary operational
  history and potential detail leakage.
- Converting timeout/budget/rate-limit into exhaustion was rejected because
  incomplete traversal cannot prove no candidate.
- Retrying automatically without an actionable UI was rejected because the
  existing Feature 006 pattern exposes bounded user retry after failure.

## R9. Realtime and Stale Ordering

**Decision**: Reuse only `public.rooms` Realtime. Add progression status and
sequence to the safe refetch projection. Merge complete projections by the
transitive closure of the authoritative state graph: adopt reachable forward
states (including higher-sequence advancing/exhausted and same-sequence
collecting-to-exhausted), ignore only observations that can be proven to precede
local authority, and fail closed for incomparable branches. Candidate/decision
async generations include sequence.

**Rationale**: Realtime is already an invalidation hint rather than truth.
Sequence is required because Feature 007's `Math.max` decision count would
incorrectly retain `N/N` across a new occurrence. Exact refetch recovers
missed/out-of-order events and keeps private tables unpublished. Candidate Edge
results are metadata observations only; they cannot synthesize room state or
`0/N`, so a delayed winner preserves any newer canonical count/phase.

**Alternatives considered**:

- Publishing decisions or occurrences was rejected for privacy and a competing
  channel lifecycle.
- Resetting count whenever a candidate response arrives was rejected because
  delayed responses could regress newer state.
- Requiring every event in order was rejected because Realtime delivery is not
  the canonical history transport.

## R10. Migration of Existing Complete Sets

**Decision**: During the traffic-stopped Feature 007→008 migration, create
occurrence 1 for assigned rooms, remap decisions, and immediately classify any
already complete set. Agreed rooms retain the candidate; rejected rooms become
`advancing`; incomplete rooms become `collecting`.

**Rationale**: The migration has all authoritative inputs and can satisfy
FR-037 without asking a voter to resubmit or depending on a later read side
effect. A rejected room cannot install a successor inside migration because
that requires external TMDB I/O; durable advancing is the correct handoff.

**Alternatives considered**:

- Leaving complete sets collecting until a client calls a new resolver was
  rejected because it creates an unnecessary unresolved state after activation.
- Calling the Edge Function from migration was rejected because migrations must
  remain reproducible and external-network independent.
- Deleting old decisions and restarting at zero was rejected by immutability and
  preservation requirements.

## R11. Feature 009 Handoff

**Decision**: An agreed room retains its private current TMDB ID and sequence;
the matching occurrence is `agreed` with `resolved_at`, and its immutable
decision set remains linked. The public room status is `agreed`. Feature 008
renders only neutral stopped state.

**Rationale**: This is enough for Feature 009 to authoritatively locate the
agreed candidate and verify its room-bound outcome later. A separate match row,
route or presentation would implement Feature 009 prematurely.

**Alternatives considered**:

- Creating a match record now was rejected as Feature 009 scope.
- Clearing the current candidate on agreement was rejected because it destroys
  the handoff identity.
- Continuing to source while awaiting Match UX was rejected by the terminal
  agreement contract.

## R12. Browser Acceptance and Identity Budget

**Decision**: Add exactly two executable owner cases: L01 with two identities
and L02 with four. Treat specified L03 as subflows inside L01 so those two
identities are reused within one case, not across cases. Select no extra
historical case beyond permanent smoke.

**Rationale**: L01 can reuse the same pair across bounded rooms to cover
exact-two agreement/non-agreement, overlap, response loss, stale state, source
failure/retry and exhaustion. L02 needs four genuinely independent identities
for a non-voting creator plus three voters, and reuses that same case-owned set
in bounded all-four-voters rooms to prove both sides of the four-voter threshold
and the inevitable/impossible no-early boundaries. Database/Deno/client tests
remain the exhaustive/deterministic oracles.
G04 and G08 already carry the changed smoke/privacy boundaries.

**Alternatives considered**:

- A separate two-identity L03 Playwright case was rejected because it would make
  owner acceptance eight identities and contradict the explicit reuse/budget.
- Browser-testing every `N=2..10` boundary was rejected because pgTAP proves the
  arithmetic more cheaply and deterministically.
- Rerunning all historical E/G/H/I/J/K cases in the normal gate was rejected by
  the normative impact policy.

## Research Conclusion

The design has no unresolved dependency or product question. The former
larger-group policy blocker is fully resolved by the specification. The only
unavoidable multi-system boundary—external TMDB search—is made safe by a
durable database state plus sequence compare-and-set, not by claiming a network
call is part of one SQL transaction.
