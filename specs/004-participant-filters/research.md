# Research: Participant Filters

**Feature**: 004 Participant Filters
**Date**: 2026-09-11
**Status**: Phase 0 complete; no unresolved planning clarification remains.

Research used the binding specification, constitution, product vision and MVP
roadmap; the complete Feature 003 plan/contracts/tasks; the current migration,
RPC, client, Realtime, R01 and acceptance implementations; and the official
PostgreSQL 17 and Supabase documentation linked below. The decisions describe
future implementation and are not runtime evidence.

## Decision 1 — Dedicated private filter relation

**Decision**: Add one `public.participant_filters` row per voting
`room_members.id`. The membership ID is the filter row's primary key and foreign
key. Row existence is the voter's one completion contribution; the row contains
only canonical genres and the two year bounds. Do not attach nullable filter
fields or a completion boolean to `room_members`.

**Rationale**: Membership is already the stable owner and remains immutable after
assembly. A dedicated relation makes absence versus accepted completion explicit,
enforces at most one current set with one key, keeps filter details independently
private, and gives Feature 005 a clean server-side join without changing
membership meaning. No timestamps, deletion state, version column or future
resolution entity is needed by Feature 004.

**Alternatives considered**:

- Nullable columns plus `filter_complete` on `room_members`: rejected because it
  mixes immutable admission with mutable private input and creates two ways to
  express completeness.
- A room JSON document keyed by participant: rejected because ownership, RLS,
  uniqueness and concurrent updates become harder to enforce.
- A relation with both `room_id` and `room_member_id`: rejected because the room
  would be duplicated unless another composite constraint were added. Feature 005
  can join through the existing room-leading member index.

## Decision 2 — Stable genre values are a database enum and application literals

**Decision**: Define `public.participant_genre` with these wire/storage slugs in
the specification's order: `action`, `adventure`, `animation`, `comedy`, `crime`,
`documentary`, `drama`, `family`, `fantasy`, `history`, `horror`, `music`,
`mystery`, `romance`, `science_fiction`, `tv_movie`, `thriller`, `war`, `western`.
Persist `participant_genre[]`, canonicalized into enum order. The client exports
the same readonly 19-value list and a label map. Empty array is Any genre.

**Rationale**: The approved vocabulary is fixed, so an enum rejects unknown
stored values, generates a useful TypeScript literal union, and remains a small
application vocabulary rather than a movie catalog. Slugs are stable across
display-copy changes and do not pretend that TMDB IDs or metadata have already
been integrated. The submission RPC rejects duplicate inputs and stores a
deterministic order, so order-only retries are no-ops.

**Alternatives considered**:

- Display labels in `text[]`: rejected as a weaker storage/wire identity and
  sensitive to presentation changes.
- A genre lookup/catalog table: rejected as unnecessary infrastructure and too
  close to a premature canonical movie-data model.
- TMDB numeric genre IDs: rejected because Feature 004 performs no TMDB
  integration. Feature 005/006 can add an explicit mapping later.

## Decision 3 — Inclusive year pair with server-current validation

**Decision**: Store `release_year_from` and `release_year_to` as non-null
`smallint`. Static checks enforce `1900 <= from <= to <= 9999`; the sole write RPC
also enforces `to <=` PostgreSQL's current UTC calendar year for the transaction.
The recovery/submission contracts return that authoritative maximum so the
client defaults to exactly `1900..allowed_release_year_max`, including around a
New Year/time-zone boundary. Both endpoints are required.

**Rationale**: Two scalar columns are typed, queryable and sufficient for future
intersection. `smallint` comfortably covers the product domain. A migration-time
literal such as 2026 would become stale, while a changing-current-year CHECK is
an awkward long-lived constraint assumption; the hardened RPC is the only
production write boundary and can evaluate the current year per request.

**Alternatives considered**:

- PostgreSQL range type: rejected because two simple inclusive values are easier
  for generated client types and no range algebra belongs to this feature.
- Nullable/unbounded endpoints: rejected by the specification.
- A fixed maximum copied into the migration: rejected because it would be wrong
  in the next calendar year.

## Decision 4 — Stored room summary; equality is the lock

**Decision**: Add `rooms.filter_completed_count integer NOT NULL DEFAULT 0`.
The invariant is the count of distinct filter rows owned by voting members in
that room. `0 <= count <= required_voter_count`, and a nonzero count is valid
only after membership is Ready. All-voters-complete and frozen are both exactly
`filter_completed_count = required_voter_count`. Do not add another boolean,
timestamp or phase enum.

**Rationale**: The existing `rooms` projection is the only room-wide readable and
Realtime-published surface. Storing the summary makes X/N cheap and privacy-safe.
Using equality as the completion/lock authority avoids contradictory `complete`
and `locked` fields. The count never decreases because there is no filter delete,
unsubmit or dynamic-member path.

As with `rooms.voter_count`, the cross-table equality cannot be expressed by a
normal CHECK. It remains transactionally consistent because clients have no
table writes and the one hardened RPC mutates the filter row and summary in the
same transaction. Migration verification, pgTAP snapshots and fault tests prove
the invariant.

**Alternatives considered**:

- Derive count on each client or through connectivity: rejected by the product
  rules and because neither a roster nor Presence is authoritative.
- Derive count dynamically through a public view: rejected because it would
  broaden the detail relation's public query surface and complicate the retained
  rooms-only Realtime channel.
- Store count plus `filters_locked`/`completed_at`: rejected as redundant for a
  fixed group and a monotonic count.

## Decision 5 — One room-row lock serializes every accepted mutation

**Decision**: `submit_my_participant_filter` identifies the caller from
`auth.uid()`, finds their member row, and locks only the authorized room with
`FOR UPDATE OF rooms`. Under that lock it checks assembly, voter role, current
count, existing own filter, validation and then insert/update/no-op/locked result.
First insert increments the room count once in the same transaction. Replacements
do not change the count. Equality reached by the final insert freezes all rows.

**Rationale**: PostgreSQL documents that `FOR UPDATE` prevents another locker or
writer from proceeding on the same row until transaction end; under the current
READ COMMITTED design, the waiter then evaluates current committed state. This
reuses Feature 003's proven per-room serialization point and needs no advisory
lock, trigger or request ledger. See [PostgreSQL explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html)
and [transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html).

Deterministic race results follow:

- distinct initial voters serialize and each inserts/counts once;
- the last successful insertion alone changes count to N and freezes the room;
- edit-before-final commits the replacement before the final lock transition;
- final-before-edit makes the later different edit return `locked` with no write;
- duplicate same-voter submissions insert/count once; equal canonical retries
  are no-ops;
- a lost acknowledgement is recovered from the filter row, and an equal retry
  returns `unchanged`, including after lock.

**Alternatives considered**:

- Lock only the filter row: rejected because a missing row cannot serialize the
  first insert with the global final transition.
- Serializable transactions/client retries: rejected as broader and unnecessary
  for one room-scoped invariant.
- Count trigger plus independently callable upsert: rejected because it creates
  another mutation authority and makes exact business outcomes harder to define.

## Decision 6 — Two RPCs and one extended room projection

**Decision**: Add `get_my_participant_filter(uuid)` for recovery and
`submit_my_participant_filter(uuid, participant_genre[], smallint, smallint)` for
save/update. Neither accepts a user/member target. Extend create/join accepted
results and the direct rooms refetch with `filter_completed_count` so re-entry
never initializes an already-progressed room as 0/N. Exact outcomes, nullability,
retry behavior and client validation are in
[participant-filter-rpcs.md](contracts/participant-filter-rpcs.md).

**Rationale**: Recovery is read-only and should not create a default row.
Submission owns all mutation. Returning canonical own values plus a transaction-
consistent X/N snapshot lets the caller distinguish accepted state from a local
draft and recover from a lost response without an idempotency UUID. Room refetch
remains the room-wide aggregate authority.

**Alternatives considered**:

- Direct RLS table SELECT/upsert: rejected because it would expose membership IDs
  and split validation/count/lock authority across multiple client operations.
- A single read/write RPC: rejected because recovery must never mutate.
- A submission request-ID ledger: rejected because unique membership ownership,
  canonical no-op comparison and the room lock already make retries idempotent.

## Decision 7 — Filter details have no direct client data surface

**Decision**: `participant_filters` is postgres-owned, RLS-enabled, has no
PUBLIC/anon/authenticated policies or table/column privileges, and is not added
to Realtime. SECURITY DEFINER RPCs use an empty search path, schema-qualified SQL,
`auth.uid()` and explicit role/membership checks. Only the owner receives their
details. Any room member may read X/N through the existing rooms RLS projection.

**Rationale**: Supabase recommends pinning `search_path` for SECURITY DEFINER
functions and explicitly restricting function execution; its Postgres Changes
delivery also respects RLS. The design keeps details outside the shared channel
and gives non-voting creators exactly the approved aggregate. See
[Supabase database functions](https://supabase.com/docs/guides/database/functions),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and
[Realtime authorization](https://supabase.com/docs/guides/realtime/authorization).

**Alternatives considered**:

- Owner SELECT policy on the table: technically possible, but rejected because
  the RPC can omit internal member IDs and enforce a smaller exact result.
- Room-member SELECT policy: rejected because it would reveal other voters'
  details.
- A public aggregate over filter rows: rejected because `rooms` already supplies
  the approved summary.

## Decision 8 — Reuse the one rooms Postgres Changes channel

**Decision**: Every first accepted filter insert updates
`rooms.filter_completed_count` and `updated_at` in the same transaction. The
existing exact-room `public.rooms` UPDATE subscription treats the event only as
invalidation and refetches the six-field projection. A replacement/no-op does
not update the room because X/N did not change. The submitting client adopts its
RPC result; recovery fetches its own filter separately.

**Rationale**: This yields 0/N→N/N convergence and missed-event recovery without
publishing filter details. Supabase Postgres Changes requires publication and
applies RLS; `rooms` already satisfies both, so no Presence/Broadcast/filter-table
publication is justified. See [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

**Alternatives considered**:

- Publish `participant_filters`: rejected for privacy and because detail events
  are not an approved shared observable.
- Presence: rejected because connectivity is not membership or completion.
- Polling or Broadcast: rejected because the existing invalidation/refetch
  lifecycle covers the required state.

## Decision 9 — Revoke the historical fixture RPC from participants

**Decision**: The Feature 004 migration revokes authenticated EXECUTE on
`public.ensure_room_candidate(uuid)`; PUBLIC and anon remain revoked. The normal
room route removes `useRoomCandidate`/`CandidateCard`. The historical function,
fixture table, four assets, FK and already-assigned FK values may remain for
owner-only historical/isolated evidence, but no participant can call the RPC,
select the hidden FK/catalog, assign a fixture or recover its metadata.

**Rationale**: Today the route calls the hook unconditionally, the hook treats
membership Ready as candidate-ready, and the RPC locks then assigns/returns the
fixture for any room member. Hiding the card alone would leave that authoritative
path live. Revocation plus client removal blocks automatic, direct, retry,
reload/reconnect and re-entry paths without deleting historical data. It also
avoids implying that all filter completion is sufficient for candidates: Feature
005 resolution and Feature 006 acquisition are still absent.

**Alternatives considered**:

- Keep EXECUTE and return permanent `not_ready`: safe, but preserves a public
  endpoint with misleading candidate-era semantics.
- Gate on filter completion: rejected because N/N is only the Feature 005 handoff.
- Drop all fixture schema/data/assets: rejected as unnecessary destruction of
  completed-slice evidence.

## Decision 10 — Acceptance evolves by invariant class

**Decision**: Retain/evolve all 24 E membership/Auth trials (47 identities) and
all nine G generalized-membership trials (26). Retire F01–F08 from normal browser
acceptance because their core oracle is the obsolete Ready→fixture flow. Preserve
candidate integrity, FK preservation, ACL/isolation, hidden metadata and no-write
suppression in SQL/client contract tests. Add three grouped H cases with three
identities each, and adapt G03/G04/G07/G08 plus relevant E cases for filter-first
behavior.

**Rationale**: This retains membership, invitation, identity, concurrency,
Realtime and recovery evidence while replacing only behavior deliberately
superseded by Feature 004. It covers multiple requirements per real workflow
rather than one browser case per scenario.

Final browser inventory: `24 E + 9 G + 3 H = 36 cases`; identities:
`47 + 26 + 9 = 82`. C1 stays one identity, so C1 + full acceptance is 83 under
`anonymous_users=150`. C1 once plus two complete runs is 165 and therefore uses
separate recovered quota windows. Fresh checkout with C1 is 83; repeatability
plus fresh checkout totals 248 across recovered windows.

**Alternatives considered**:

- Retain all eight F browser cases unchanged: rejected because passing them
  would violate Feature 004.
- Add one case per 31 acceptance scenario: rejected as redundant and wasteful.
- Remove all candidate evidence: rejected because schema integrity, privacy and
  historical-data preservation remain meaningful.

## Decision 11 — Additive migration and R01 remain disciplined

**Decision**: Create one new Feature 004 migration; edit no historical migration.
All existing rooms receive count 0 and no filter rows, preserving room/member/
invitation/timestamp/candidate data. Evolve the old migration validator's latest-
schema expectations and add a focused nonempty Feature003→004 migration check.
After final schema/RPC/pgTAP evidence, run `npm run db:types` once, immediately
run check, then use check-only after an independent reset and in every later gate.

**Rationale**: This preserves reproducible schema evolution and the established
atomic R01 wrapper. Existing Ready rooms correctly recover into 0/N filter
collection; an old assigned candidate stays internally referentially intact but
is participant-inaccessible and does not satisfy the Feature 005 handoff.

**Alternatives considered**:

- Edit Feature 003 migration: prohibited and destroys upgrade history.
- Backfill default filters for old voters: rejected because it would falsely
  complete filters without user input.
- Clear old candidate FKs: rejected because invisibility/revoked authority is
  sufficient and preservation is the safer additive migration.
