# Data Model: Common Filter Resolution

**Authority**: PostgreSQL 17 after the Feature 005 additive migration.
**Evolved relation**: `public.rooms` gains one safe status column.
**New public enum**: `public.filter_resolution_status`.
**New private relations**: one compatible resolution parent and its anonymous
genre clauses.

This model persists a filter constraint, not a movie query or candidate. It
contains no TMDB data, movie ID, ranking, swipe, progression or match state.

## `public.filter_resolution_status`

| Stored value | Authoritative meaning | Candidate-source handoff |
| --- | --- | --- |
| `pending` | No terminal result has committed | Blocked |
| `compatible` | One private stable common constraint has committed | Ready for future Feature 006 |
| `incompatible` | The common inclusive year interval is empty | Terminal and blocked |

There is no persisted `failed` enum value. A failed attempt leaves status
pending and is represented as a recoverable client error. There is no transition
from either terminal value and no compatible/incompatible precedence ordering.

## Evolved `public.rooms`

All Feature 004 columns, constraints and meanings remain. Add only:

| Column | SQL type / nullability | Default | Purpose |
| --- | --- | --- | --- |
| `filter_resolution_status` | `public.filter_resolution_status NOT NULL` | `pending` | Shared authoritative resolution status |

New check:

| Constraint | Invariant |
| --- | --- |
| `rooms_filter_resolution_requires_complete_check` | Status is pending, or membership is Ready and `filter_completed_count = required_voter_count` |

The status is monotonic:

```text
pending -> compatible
pending -> incompatible
```

No production path performs any other transition. The resolver is the sole
writer; participant roles retain no room UPDATE privilege. A first terminal
transition updates `rooms.updated_at` in the same transaction, producing the
existing rooms-channel invalidation. A pending/no-op/repeated terminal call does
not update the room.

The authenticated room SELECT projection becomes exactly:

```text
id, code, state, voter_count, required_voter_count,
filter_completed_count, filter_resolution_status
```

Resolved years and clauses are not columns of this published relation.

## `private.room_filter_resolutions`

This relation exists only for a compatible room.

| Column | SQL type / nullability | Default | Meaning |
| --- | --- | --- | --- |
| `room_id` | `uuid NOT NULL` | none | Primary key and FK to the resolved room |
| `release_year_from` | `smallint NOT NULL` | none | Greatest frozen voter lower bound, inclusive |
| `release_year_to` | `smallint NOT NULL` | none | Least frozen voter upper bound, inclusive |

Constraints:

| Constraint | Guarantee |
| --- | --- |
| Primary key (`room_id`) | At most one compatible payload per room |
| FK `room_id -> public.rooms(id)` with delete cascade | Payload cannot outlive its room |
| Year check | `1900 <= release_year_from <= release_year_to <= 9999` |

No status, timestamp, movie/catalog value, voter count or source identity is
duplicated here. The room status remains terminal authority. Incompatible and
pending rooms have no parent row.

## `private.room_filter_resolution_genre_clauses`

Each row is one nonempty OR clause. All rows for a room are combined with AND.

| Column | SQL type / nullability | Default | Meaning |
| --- | --- | --- | --- |
| `room_id` | `uuid NOT NULL` | none | FK to the compatible parent |
| `clause_ordinal` | `integer NOT NULL` | none | One-based deterministic ordering within the room |
| `genres` | `public.participant_genre[] NOT NULL` | none | Canonical nonempty acceptable alternatives for one constrained voter |

Constraints:

| Constraint | Guarantee |
| --- | --- |
| Primary key (`room_id`, `clause_ordinal`) | No duplicate position; room-leading ordered lookup |
| FK `room_id -> private.room_filter_resolutions(room_id)` with delete cascade | No clause without compatible parent |
| Ordinal check | `clause_ordinal >= 1` |
| Genre check | Existing private validator passes and cardinality is greater than zero |

The resolver assigns contiguous ordinals `1..K`, sorting by the canonical enum
arrays and using the source member UUID only as a private tie-breaker for equal
arrays. It does not store that UUID. Two voters with identical selections still
produce two equal clause rows at different ordinals; every constrained voter is
represented once. An Any voter produces no clause. If all voters chose Any, the
compatible parent has zero clause rows and the genre predicate is true.

## Boolean semantics

For ordered clause arrays `C1..CK` and a future movie genre set `G`:

```text
genreEligible(G) = true                         when K = 0
genreEligible(G) = AND(i=1..K, G intersects Ci) otherwise
```

The years are:

```text
commonFrom = max(all fixed voter release_year_from)
commonTo   = min(all fixed voter release_year_to)
compatible iff commonFrom <= commonTo
```

Genre clauses never independently make the result incompatible. No union,
literal intersection, genre frequency, ranking or catalog lookup is stored.

## Relationships and visibility

```text
public.rooms (shared safe status)
  ├── public.room_members (fixed membership; unchanged/private)
  │     └── public.participant_filters (frozen source; unchanged/private)
  └── private.room_filter_resolutions (0..1; compatible only)
        └── private.room_filter_resolution_genre_clauses (0..K anonymous clauses)
```

- The resolver joins fixed voting members to exactly one frozen source row each.
- A voting creator participates through the same `is_voter=true` rule.
- A non-voting creator is authorized to observe/invoke but never enters the
  source join or adds a clause/year.
- Clients receive only the room status. Even voters do not receive the parent or
  clauses; their separate Feature 004 RPC may still return only their own filter.
- Both private relations are postgres-owned, RLS-enabled, have no policies or
  PUBLIC/anon/authenticated table privileges and are absent from Realtime.

## Committed invariants

The sole resolver enforces these under the room lock:

1. A terminal status requires `state=ready` and exact frozen N/N.
2. Actual fixed voter count, required count, filter summary and actual voter
   filter row count agree before calculation.
3. No non-voting membership owns a filter row and no fixed voter is omitted.
4. Pending has no private parent or clauses.
5. Compatible has exactly one parent with the exact max/min years and exactly
   one clause for every nonempty source selection, in contiguous canonical order.
6. Incompatible has no parent or clauses and is caused only by max-from > min-to.
7. Terminal calls never mutate source filters or rewrite result/status rows.

Cross-table status/payload shape cannot be expressed fully as a normal CHECK.
It is transactionally consistent because direct writes are denied and the one
hardened resolver owns all three relations. Migration verification, ordinary-role
tests, fault rollback and deterministic concurrency tests prove the invariant.
An impossible committed shape raises an integrity exception; it is never repaired
by dropping a clause, recomputing client-side or changing terminal status.

## Lifecycle and state transitions

| Initial authority | Operation | Writes | Result |
| --- | --- | --- | --- |
| Membership Waiting, pending | Resolve/status observation | None | `pending` |
| Ready, X<N, pending | Resolve/status observation | None | `pending` |
| Ready, frozen N/N, pending, overlapping years | Resolve | Parent + 0..K clauses + room terminal UPDATE | `compatible` |
| Ready, frozen N/N, pending, empty year overlap | Resolve | Room terminal UPDATE only | `incompatible` |
| Compatible | Resolve/reload/re-entry | None | Same `compatible` status; payload unchanged |
| Incompatible | Resolve/reload/re-entry | None | Same `incompatible`; no payload created |
| Frozen N/N, attempt exception before commit | Retry/recovery | Failed transaction writes none | Authoritative status stays pending; later retry may resolve |
| Terminal result, response lost | Refetch or retry | None after original commit | Existing result recovered |

Feature 004 filters remain frozen throughout. There is no result reset, new
round, filter reopen, terminal reversal or candidate mutation.

## Concurrency ordering

Every resolving transaction authorizes then locks the same room before reading
result/source state:

```text
first attempts: A lock -> derive/write/commit -> B lock -> terminal no-op
failed attempt: A lock -> derive -> exception/rollback -> B lock -> derive/commit
lost response:  A lock -> derive/write/commit -> client loses reply -> retry no-op
```

Unrelated rooms do not share this application lock. A foreign caller fails
membership lookup before acquiring it. READ COMMITTED is sufficient because all
source filters are frozen before the resolver is eligible and all result writers
serialize on the room.

## Migration from exact Feature 004 schema

Use one versioned transaction after
`20260911000000_participant_filters.sql`; do not edit historical migrations.

1. Add the enum and pending status/check to rooms.
2. Create the private parent/clause relations and access boundaries.
3. Recreate create/join for the added status result field without changing logic.
4. Create/harden the resolver and extend the exact rooms column grant.
5. Verify old room/member/filter/candidate/timestamp values, source row counts and
   Realtime publication; no private result exists at migration commit.

Every pre-existing room starts pending. A preserved N/N room resolves lazily on
first authorized observation through the same RPC as a new room. No source row,
candidate FK or accepted value is rewritten and no default constraint is invented.

## Final access matrix

| Surface | PUBLIC / anon | Authenticated authorized member |
| --- | --- | --- |
| Seven-field rooms SELECT | none | Own rooms only through existing member RLS |
| Private resolution parent/clauses | none | none |
| Participant filters direct access | none | none |
| `resolve_common_filters(uuid)` | no EXECUTE | EXECUTE; status-only result |
| Feature 004 filter RPCs | unchanged | Own detail/write rules unchanged |
| Create/join | unchanged authentication, evolved safe status field | Authenticated only |
| Candidate RPC/catalog/FK | none | none |
| Realtime publication | n/a | `public.rooms` only; no detail relations |

Future Feature 006 receives no new client grant. Its hardened server operation
may read the private payload only after verifying compatible room status.
