# Data Model: Candidate Progression

**Feature**: 008 — Candidate Progression  
**Date**: 2026-09-18  
**Status**: Design complete; no schema change has been implemented.

## Identity Model

The design keeps four identities distinct:

| Identity | Meaning | Authority |
| --- | --- | --- |
| `tmdb_movie_id` | A movie in TMDB. The same ID may legitimately occur in different rooms. | Feature 006 source/metadata contract |
| Candidate occurrence UUID | One movie considered at one logical position in one room. Decisions bind here. | New protected occurrence row |
| `candidate_sequence` | Public-safe, monotonically increasing ordinal of installed occurrences in one room. | `public.rooms` plus occurrence uniqueness |
| Current candidate | The one collecting or agreed occurrence referenced by the room's sequence and private TMDB ID. | Constrained `public.rooms` projection |

The current Feature 008 session prohibits a repeated TMDB ID in one room.
Occurrence identity is still retained so a later approved change permitting a
revisit could not accidentally reuse an older decision set.

## New Enum: `public.candidate_occurrence_status`

Closed values:

- `collecting`: this occurrence is the current writable decision target;
- `rejected`: its full decision set did not meet the threshold; and
- `agreed`: its full decision set met the threshold and is the Feature 009
  handoff.

Allowed transitions:

```text
collecting -> rejected
collecting -> agreed
```

Both resolved states are terminal. There is no transition back to collecting
and no direct rejected-to-agreed rewrite.

## New Enum: `public.candidate_progression_status`

Closed values:

- `inactive`: no Feature 008 occurrence is active; applies before the first
  assignment and to Feature 006's original first-candidate empty terminal;
- `collecting`: the room has one current collecting occurrence;
- `advancing`: the last occurrence is rejected and the same progression step is
  seeking or retrying a successor;
- `agreed`: the current occurrence is agreed and progression is terminal; and
- `exhausted`: the last rejected occurrence's bounded source step completed
  empty and progression is terminal.

This status describes progression. Existing
`public.candidate_acquisition_status` continues to describe candidate-source
availability.

## New Entity: `public.room_candidate_occurrences`

Purpose: immutable room-local candidate order and outcome history.

| Field | Type | Null | Rule |
| --- | --- | --- | --- |
| `id` | UUID | No | Primary key, generated with `extensions.gen_random_uuid()` |
| `room_id` | UUID | No | FK to `public.rooms(id)`, cascade with room lifecycle |
| `sequence` | integer | No | `>= 1`; logical occurrence ordinal |
| `tmdb_movie_id` | bigint | No | Positive; Feature 006 identity |
| `status` | `candidate_occurrence_status` | No | Starts collecting; resolves once |
| `created_at` | timestamptz | No | Transaction timestamp of authoritative install |
| `resolved_at` | timestamptz | Yes | Null only for collecting; set for rejected/agreed |

Keys and indexes:

- primary key `(id)`;
- unique `(room_id, id)` for same-room protected references;
- unique `(room_id, sequence)` for one occurrence at each ordinal;
- unique `(room_id, sequence, tmdb_movie_id)` for the room's current-candidate
  composite reference;
- unique `(room_id, tmdb_movie_id)` for Feature 008 session-local no-repeat;
- partial unique on `room_id` where `status in ('collecting', 'agreed')`, so a
  room can have only one active/current-or-handoff occurrence; and
- lookup index supporting ordered history/exclusion retrieval by room/sequence
  if not already covered by the unique index.

Validation:

- positive sequence and TMDB ID;
- `status = 'collecting'` exactly when `resolved_at is null`;
- `status in ('rejected', 'agreed')` exactly when `resolved_at is not null`.

Access:

- owner `postgres`;
- RLS enabled;
- all privileges revoked from `public`, `anon` and `authenticated`;
- no permissive client policy;
- not added to `supabase_realtime`;
- ordinary clients never select occurrence UUIDs, history or TMDB IDs directly.

## Evolved Entity: `public.rooms`

New fields:

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `candidate_progression_status` | `candidate_progression_status` | `inactive` | Authoritative room-level progression meaning |
| `candidate_sequence` | integer | `0` | Last/current installed occurrence ordinal |

Existing fields retain these roles:

- `required_voter_count`: fixed `N` and threshold denominator;
- `voter_count`: assembled fixed voter count;
- `candidate_acquisition_status`: source state (`pending | assigned | no_candidates`);
- `tmdb_movie_id`: private identity of a collecting/agreed current occurrence;
- `decision_completed_count`: safe count for the current collecting/agreed
  occurrence only; and
- filter/common-resolution fields: frozen source constraint eligibility.

Cross-field state constraint:

| Progression | Required related state |
| --- | --- |
| `inactive` | `candidate_sequence = 0`, no private TMDB ID, decision count 0, acquisition `pending` or `no_candidates` |
| `collecting` | sequence >=1, assembled/compatible/frozen, acquisition `assigned`, positive private TMDB ID, decision count `0..N-1` |
| `agreed` | sequence >=1, assembled/compatible/frozen, acquisition `assigned`, positive private TMDB ID, decision count exactly `N` |
| `advancing` | sequence >=1, assembled/compatible/frozen, acquisition `pending`, no private TMDB ID, decision count 0 |
| `exhausted` | sequence >=1, assembled/compatible/frozen, acquisition `no_candidates`, no private TMDB ID, decision count 0 |

When the room's TMDB ID is non-null, composite FK
`(id, candidate_sequence, tmdb_movie_id)` references the matching occurrence
triple. The nullable TMDB component intentionally makes that FK inapplicable to
inactive/advancing/exhausted states. RPCs also verify occurrence status against
room status because a check constraint cannot read another table.

Safe authenticated room column grant adds only:

- `candidate_progression_status`; and
- `candidate_sequence`.

The existing member-only room RLS policy remains. The private TMDB ID, creator
ID, occurrence linkage and internal timestamps remain unavailable through the
room table.

## Evolved Entity: `public.candidate_decisions`

Purpose remains Feature 007's immutable first accepted yes/no value, but the
decision target becomes a candidate occurrence rather than a raw movie ID.

| Field | Type | Null | Rule |
| --- | --- | --- | --- |
| `room_id` | UUID | No | Same-room join component; not client-readable |
| `room_member_id` | UUID | No | Fixed voter membership |
| `candidate_occurrence_id` | UUID | No | Exact logical decision epoch |
| `decision` | `candidate_decision_value` | No | `yes` or `no`, immutable |
| `accepted_at` | timestamptz | No | Original first-acceptance timestamp |

Keys and relationships:

- primary key `(room_member_id, candidate_occurrence_id)`;
- composite FK `(room_id, room_member_id)` to a unique
  `room_members(room_id, id)` key;
- composite FK `(room_id, candidate_occurrence_id)` to unique
  `room_candidate_occurrences(room_id, id)`; and
- no copied `tmdb_movie_id`; join through the occurrence when server authority
  needs movie identity.

The schema guarantees that a decision's member and occurrence belong to the
same room. RPC logic additionally requires the member to be a fixed voter and
checks every detail row/count before transition. The table stays RLS-enabled,
grant-free, policy-free for clients, immutable through the approved API, and
outside Realtime.

## Existing Entity: `public.room_members`

No product field changes. Add only the unique composite key `(room_id, id)`
needed by the decision same-room foreign key. The existing globally unique
primary key and membership/private access boundaries remain.

Membership is never changed by progression. `is_voter` and
`required_voter_count` remain the complete-set authority regardless of
connectivity.

## Derived Threshold and Outcome

Private deterministic threshold function:

```text
threshold(N) = 2                              when N = 2
threshold(N) = ((2 * N::bigint) + 2) div 3   when N >= 3
```

The helper rejects `N < 2`. The bigint cast occurs before multiplication. The
result fits the existing integer participant domain.

Outcome is derived only at exact completion:

```text
detail count = N
Y = count(decision = yes) for fixed voters and this occurrence
Y >= threshold(N) -> agreed
Y <  threshold(N) -> rejected
```

Yes count is not stored on the room or exposed to clients. Occurrence status is
the durable classification; the immutable rows retain auditability without a
second outcome calculation path.

## Authoritative State Transitions

### First candidate

```text
inactive / pending / sequence 0
  -- valid Feature 006 candidate commit -->
collecting / assigned / sequence 1 / count 0

inactive / pending / sequence 0
  -- completed-empty commit -->
inactive / no_candidates / sequence 0 / count 0
```

Initial empty creates no occurrence and is not Feature 008 exhaustion.

### Non-final decision

```text
collecting(k, count c where c < N-1)
  -- first decision for member+occurrence -->
collecting(k, count c+1)
```

Same-value duplicate and opposite conflict perform no write. No threshold is
evaluated for a transition with new count below `N`.

### Final decision and agreement

```text
collecting(k, count N-1)
  -- final accepted decision, Y >= T -->
occurrence k: agreed/resolved_at
room: agreed / assigned / same TMDB / sequence k / count N
```

This state is terminal for Feature 008. The occurrence, current TMDB identity
and decision set form the Feature 009 handoff.

### Final decision and rejection

```text
collecting(k, count N-1)
  -- final accepted decision, Y < T -->
occurrence k: rejected/resolved_at
room: advancing / pending / TMDB null / sequence k / count 0
```

The reset count means “no active successor decision set yet”; the rejected
occurrence's `N` immutable decision rows remain.

### Successor install

```text
advancing(k)
  -- eligible unpresented candidate commit expecting k -->
new occurrence k+1: collecting
room: collecting / assigned / new TMDB / sequence k+1 / count 0
```

The commit inserts exactly one ordinal. A competing same-step commit returns the
winner and performs no insert.

### Transient source failure

```text
advancing(k) -- search_incomplete --> advancing(k)
```

No durable row changes. Request-local failure state can be retried. Reload sees
advancing and safely restarts the same step.

### Exhaustion

```text
advancing(k)
  -- completed_empty commit expecting k -->
exhausted / no_candidates / TMDB null / sequence k / count 0
```

No new occurrence is created. Exhaustion is stable; older candidate/source
actions cannot leave it.

## Forbidden Transitions

- resolution or source acquisition while a collecting count is below `N`;
- `agreed -> advancing`, `agreed -> collecting`, or any sequence increment after
  agreement;
- `exhausted -> advancing/collecting` in the same selection session;
- direct `collecting(k) -> collecting(k+2)`;
- installing sequence `k+1` from an expected sequence other than `k`;
- reusing any room-local TMDB ID;
- modifying/deleting/reassigning an accepted decision;
- changing fixed membership, filters or compatible resolution; and
- treating initial `inactive/no_candidates` as a rejected occurrence.

## Integrity Checks at Every Protected Operation

Before a decision or source commit, server authority verifies as applicable:

- assembled voter count equals required voter count;
- the actor is an inherited authorized room member and voters are fixed;
- frozen filters and common resolution remain complete/compatible;
- room progression/acquisition/sequence/identity combination is legal;
- current occurrence matches the room and has the expected status/identity;
- every decision for the occurrence belongs to a voter in that same room;
- detail count equals the room's current count when collecting/agreed;
- the current member has at most one row for the occurrence;
- proposed candidate evidence satisfies Feature 006 and has no occurrence in
  that room; and
- expected source sequence still names the one advancing step.

Any disagreement raises an integrity failure or returns a protected stale/not-
ready result as defined by the interface. It never repairs by deleting a voter,
vote, occurrence or filter.

## Migration Mapping from Feature 007

| Existing room | Occurrence backfill | New room state |
| --- | --- | --- |
| `pending`, no TMDB | none | `inactive`, sequence 0 |
| original `no_candidates` | none | `inactive`, sequence 0 |
| `assigned`, decision count < N | occurrence 1 `collecting`; map decisions | `collecting`, sequence 1, same ID/count |
| `assigned`, count N, Y >= T | occurrence 1 `agreed`; map decisions | `agreed`, sequence 1, same ID/count N |
| `assigned`, count N, Y < T | occurrence 1 `rejected`; map decisions | `advancing`, sequence 1, clear current ID, count 0 |

The migration first validates Feature 007 detail/count/candidate consistency.
It preserves decision values and `accepted_at`, room/membership/filter data and
the agreed current identity. Intentional room state changes for complete sets
are recorded by the cutover fixture proof; no successor is sourced during the
migration.

Feature 007 did not store the original candidate-assignment timestamp. A
backfilled occurrence therefore uses the migration transaction timestamp for
`created_at`, and a backfilled complete occurrence uses that same cutover time
for `resolved_at`. These fields are audit metadata, not sequence or product
ordering authority; `candidate_sequence` remains authoritative.

## Feature 009 Readiness

Feature 009 can later recognize an agreed selection through all of:

- room progression status `agreed`;
- room candidate sequence and retained private TMDB ID;
- matching occurrence status `agreed` and `resolved_at`; and
- immutable occurrence-bound decision set.

Feature 008 creates no match row, match route, celebration, confirmation or
post-match action.
