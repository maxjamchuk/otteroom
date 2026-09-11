# Research: Common Filter Resolution

**Feature**: 005 Common Filter Resolution
**Date**: 2026-09-12
**Status**: Phase 0 complete; no unresolved planning clarification remains.

Research used the binding Feature 005 specification, constitution, product
vision, MVP roadmap and testing strategy; the complete Feature 004 specification,
plan and contracts; and the current migration, RPC, room projection, Realtime,
client state, R01 and acceptance implementations. Feature 004's documented
PostgreSQL 17/Supabase security and locking findings remain applicable. These
decisions plan future work and are not runtime evidence.

## Decision 1 — Public status and private resolved payload have separate surfaces

**Decision**: Add one safe `rooms.filter_resolution_status` enum column for
`pending | compatible | incompatible`. Store a compatible payload only in
postgres-owned private relations. Do not put resolved years or genres on the
Realtime-published room row and do not expose a client result table/view.

**Rationale**: Status is approved shared state and must converge through the
existing room projection. The actual constraint is server-only Feature 006
input. Separating them prevents Postgres Changes or an expanded rooms SELECT
from disclosing the payload, while one transaction keeps status and payload
coherent. Pending needs no payload; incompatible deliberately has no usable one.

**Alternatives considered**:

- All fields on `rooms`: rejected because the table is the Realtime publication
  and client projection, increasing accidental detail-disclosure risk.
- One participant-readable resolution table: rejected because RLS membership
  alone would reveal details the specification withholds.
- Client-only status derived from N/N: rejected because it is not a durable,
  authoritative compatible/incompatible result.

## Decision 2 — Normalize the AND-of-OR genre predicate

**Decision**: A private parent holds the compatible year interval. A private
child row holds each constrained voter's nonempty canonical genre array as one
OR clause. Clause rows are ANDed. Any voters add no row. Clause ordinals are
deterministic; no voter/member/filter ID is stored in the payload.

**Rationale**: Variable-length clauses cannot safely be collapsed to a union or
intersection. PostgreSQL multidimensional arrays require compatible dimensions,
and JSON would add a custom grammar and weaker relational validation. One child
row per clause preserves exact boolean meaning, supports duplicate equal voter
clauses, and gives Feature 006 a direct server-side predicate without a roster.

**Alternatives considered**:

- Literal intersection: rejected by the approved semantics; disjoint genre
  selections may be satisfied by one multi-genre movie.
- Union of all selected values: rejected because it changes group AND to OR.
- JSON array-of-arrays: workable but rejected because normalized typed arrays,
  keys and checks are simpler and safer.
- Store voter IDs with clauses: rejected because the predicate needs no identity
  and the handoff explicitly avoids it.

## Decision 3 — Year compatibility is pure interval algebra

**Decision**: Compute `common_from = max(release_year_from)` and
`common_to = min(release_year_to)` over every fixed voter filter. Compatible is
exactly `common_from <= common_to`; incompatible is exactly the opposite.

**Rationale**: The source ranges are validated, inclusive and frozen. This rule
is deterministic, bounded and independent of a movie catalog. A one-year overlap
is compatible. Genre clauses are always expressible and therefore do not create
a Feature 005 incompatible result.

**Alternatives considered**:

- Query TMDB for an actual matching movie: rejected as Feature 006 scope and an
  unstable external-data interpretation of logical compatibility.
- Treat disjoint genres as empty: rejected because it assumes single-genre movies.
- Broaden or drop a range when overlap is empty: rejected because it ignores a voter.

## Decision 4 — Use a dedicated get-or-resolve RPC after frozen N/N

**Decision**: Add `resolve_common_filters(uuid)`. Clients automatically invoke
it only after an authoritative N/N+pending observation, and repeat the same
operation on recovery. Do not add resolution to `submit_my_participant_filter`,
a database trigger, scheduled job or Edge Function.

**Rationale**: A separate operation preserves Feature 004's completed final-save
and freeze transaction. If resolution fails, its whole transaction rolls back
while the already-frozen inputs remain intact and pending; retry is meaningful.
It also handles complete rooms predating the migration. Automatic client
invocation satisfies continuation without another voter submission, while the
server—not the caller—reads inputs and computes authority.

**Alternatives considered**:

- Resolve inside final filter submission: rejected because it couples Feature
  004 mutation to new payload writes, complicates failure-after-freeze semantics
  and does not cover existing N/N rooms without another path.
- Database trigger: rejected because it has the same transaction coupling and
  hides business outcomes behind an additional mutation authority.
- Background worker/job: rejected because no always-on component is needed for
  a result consumed only when the room is observed.
- Manual resolve button as the normal path: rejected because the specification
  says continuation needs no extra voter submission/action.

## Decision 5 — Reuse the room row lock for idempotent serialization

**Decision**: After membership authorization, the resolver takes `FOR UPDATE`
on the exact room. It returns existing terminal state without writes or derives
once from pending N/N. Primary keys and one transaction protect parent, clauses
and status. No request ID or resolution version is added.

**Rationale**: Feature 003/004 already establish the room row as the per-room
serialization point. Frozen filters eliminate input-version races. Concurrent
first attempts become one writer plus no-write readers; response loss is
recovered from persisted status. The PostgreSQL 17 locking/isolation sources
already recorded in Feature 004 research remain applicable.

**Alternatives considered**:

- Advisory locks: rejected because the existing row is the natural authority.
- Serializable client retries: rejected as broader than one room-scoped state change.
- Request ledger/fingerprint: rejected because inputs cannot change and terminal
  status cannot be recomputed into another committed outcome.

## Decision 6 — Operational failure is not a persisted fourth result

**Decision**: Authoritative room state remains pending until a transaction
commits compatible or incompatible. A thrown/transport failure exposes a local
safe error over authoritative pending and a bounded retry. No `failed` room
status or partial result is persisted.

**Rationale**: Transient failure describes an attempt, not filter compatibility.
Persisting it would require ownership, clearing and cross-client retry semantics
without product value. Transaction rollback guarantees no usable partial data;
another client may resolve successfully and Realtime clears the failed client's
overlay through terminal refetch.

**Alternatives considered**:

- Persist `failed`: rejected as nonterminal shared state that could become stale.
- Convert exceptions to incompatible: rejected because operational failure is
  not a logical empty interval.
- Expose partial calculated years/clauses: rejected by privacy and failure safety.

## Decision 7 — Status recovery extends the exact room projection

**Decision**: Add status to accepted create/join results and to the exact room
refetch. The resolver returns only outcome plus matching status. No separate
status-read RPC is added. Runtime parsers enforce exact keys/cardinality,
terminal-requires-N/N and a monotonic pending→one-terminal state machine. An
unexpected pending response to an N/N-triggered call becomes a retryable error
with no automatic loop. Conflicting terminal values create a fail-closed
generation overlay that suppresses ready/next-action meaning until re-entry.

**Rationale**: Join/re-entry must not initialize a terminal room as pending, and
the existing room projection is already the durable shared-state recovery path.
The resolver response gives the initiating client immediate adoption while the
room UPDATE converges observers. A second read RPC would duplicate authority.

**Alternatives considered**:

- Status only in resolver response: rejected because reload/missed-response
  recovery would need an extra operation before knowing current state.
- Infer status from a private payload row: rejected because clients cannot read it.
- Optimistic compatible status: rejected because only committed server state is usable.

## Decision 8 — Keep the single rooms-only Realtime channel

**Decision**: A first terminal result updates the room status and `updated_at`.
The existing exact-room `public.rooms` UPDATE subscription remains an invalidation
signal and refetches the safe projection. Do not publish either private result
relation or `participant_filters`; add no Presence, Broadcast or polling.

**Rationale**: All shared observable state fits in one safe room column. The
existing system-ok refetch already recovers missed events and channel gaps.
Resolution has no user-visible intermediate details or edit stream.

**Alternatives considered**:

- Publish clauses/result rows: rejected because payload is private.
- Dedicated resolution channel: rejected as duplicate lifecycle/state machinery.
- Presence: rejected because connectivity is unrelated to fixed membership or result.

## Decision 9 — Deny all direct resolved-payload access

**Decision**: Put result relations in the existing `private` schema, enable RLS,
grant no table privileges/policies to PUBLIC/anon/authenticated, and omit them
from Realtime. Harden the public resolver exactly like prior RPCs. Keep
`participant_filters` and its owner-only detail RPC unchanged.

**Rationale**: Even authorized participants may see only status and next action.
Private schema placement also keeps the payload out of generated public client
types. A future Feature 006 postgres-owned operation can consume it internally
without granting participants or a service credential broader access.

**Alternatives considered**:

- Room-member RLS SELECT: rejected because membership is not permission to view
  exact resolved details.
- Service-role calls from the client: rejected by least privilege and secret safety.
- Return clauses from resolver then hide in UI: rejected because transport is disclosure.

## Decision 10 — Existing frozen rooms resolve lazily through the same path

**Decision**: Migration gives every existing room pending status and creates no
payload. Existing N/N rooms are resolved automatically when first observed by an
authorized client after cutover. Waiting/partial rooms remain pending until their
normal Feature 004 completion.

**Rationale**: This preserves all existing values and avoids two implementations
of the algorithm. No candidate consumer needs an unobserved room's result.
Recovery uses the same lock, validation, privacy and retry semantics as new rooms.

**Alternatives considered**:

- Migration-time backfill: rejected because it duplicates resolver orchestration
  and creates terminal product state without exercising the normal authority path.
- Treat old complete rooms as incompatible/unusable: rejected because valid frozen
  inputs remain sufficient.
- Invent default filters: rejected because source rows are already authoritative.

## Decision 11 — Feature 006 consumes only the anonymous persisted predicate

**Decision**: Define a server-only handoff consisting of compatible status,
inclusive years and ordered genre clauses. Future candidate sourcing evaluates
every clause against movie genres. It must not read individual voter filters or
receive identity metadata.

**Rationale**: This is stable because Feature 004 inputs are frozen and it
preserves the exact approved boolean meaning. It remains a constraint, not a
catalog, query strategy, ranked result or movie assignment.

**Alternatives considered**:

- Let Feature 006 recompute from participant filters: rejected because that
  bypasses the one authoritative persisted resolution.
- Materialize eligible movie IDs: rejected because no catalog exists in this feature.
- Translate clauses into a TMDB request now: rejected as premature Feature 006 design.

## Decision 12 — Testing follows changed-boundary ownership

**Decision**: Add I01/I02/I03 with exactly 3/4/2 identities (`F=9`), retain the
16-identity permanent smoke and C1, and select historical H03 once (`T=3`). Do
not select H02 or non-smoke E/G cases. PostgreSQL owns algebra, ACL, exact writes,
lock order and frozen-source proof; client tests own parser/state/one-flight/stale
behavior; browser tests own representative real-stack cooperation.

**Rationale**: The automatic resolver is coupled to the frozen N/N observation,
so H03's concurrent final-completion/lost-confirmation browser boundary is
actually affected. Feature 004's own recovery/edit/lock API is unchanged, so H02
is not. G03/G04/G05/G08/H01 already cover the evolved core in smoke.

**Alternatives considered**:

- Run all 36 historical cases: rejected by the normative Feature 005+ policy.
- Select no historical case: rejected because H03's post-freeze boundary changes.
- Put lock ordering in Playwright: rejected because browser timing is not a
  deterministic database lock oracle.

## Decision 13 — One additive migration and one R01 write

**Decision**: Add one Feature 005 migration, preserve all prior rows, give old
rooms pending status and update exact create/join/projection contracts atomically.
After the final DB contract/tests are green, generate public database types once;
all later checks are comparison-only.

**Rationale**: This retains reproducible history and keeps schema, runtime and
generated types coherent without using generation as exploration. Private
result tables intentionally stay outside public generated client types.

**Alternatives considered**:

- Edit Feature 004 migration: prohibited and destroys upgrade evidence.
- Generate types after each schema experiment: rejected by R01.
- Skip nonempty migration proof: rejected because frozen pre-Feature-005 rooms
  are an explicit compatibility boundary.
