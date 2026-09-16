# Data Model: Swipe Decisions

**Feature**: 007 — Swipe Decisions

**Date**: 2026-09-16

## Model Boundary

Feature 007 adds one immutable voter-owned fact for Feature 006's current TMDB
identity and one privacy-safe completion watermark on the room. It does not add
a candidate queue, history, next-candidate state, match row or group agreement
policy.

## Entity Relationship

```text
auth.users
    1
    |
    *  room_members  * -------- 1  rooms
             |
             | 1
             |              current room candidate identity
             *  candidate_decisions  --------> rooms.tmdb_movie_id
                 (member, TMDB ID)              (logical consistency enforced
                                                 by authoritative RPCs)
```

`candidate_decisions` deliberately has no redundant `room_id` or `user_id`.
The membership row owns those relationships. The TMDB ID is copied into the key
so future candidates can have distinct immutable facts; it is not a foreign key
because TMDB identities are external and the canonical current value is stored
on the room.

## New Enum: `public.candidate_decision_value`

| Value | Meaning |
| --- | --- |
| `yes` | The voter wants to watch the canonical candidate; right swipe. |
| `no` | The voter does not want to watch it; left swipe. |

The enum is postgres-owned. There is no undecided enum value: absence of a row
means undecided.

## New Table: `public.candidate_decisions`

| Column | Type | Null | Rule |
| --- | --- | --- | --- |
| `room_member_id` | `uuid` | no | FK to `public.room_members(id)` with `ON DELETE CASCADE`. |
| `tmdb_movie_id` | `bigint` | no | Positive external TMDB identity. |
| `decision` | `public.candidate_decision_value` | no | Immutable `yes` or `no`. |
| `accepted_at` | `timestamptz` | no | Database acceptance time, default `transaction_timestamp()`. |

Primary key: `(room_member_id, tmdb_movie_id)`.

Security and mutability rules:

- owner is `postgres`;
- RLS is enabled;
- no client-readable or client-writable policy exists;
- table privileges are revoked from `PUBLIC`, `anon` and `authenticated`;
- the table is not added to `supabase_realtime`;
- only the authoritative submission function inserts;
- no application update/delete function exists; and
- accepted rows are immutable for Feature 007.

Deleting a membership cascades its decisions for referential safety, although
dynamic membership deletion remains outside the MVP workflow.

## Changed Table: `public.rooms`

Add:

| Column | Type | Default | Meaning |
| --- | --- | --- | --- |
| `decision_completed_count` | `integer not null` | `0` | Number of fixed voters with a decision for the room's current canonical TMDB ID. |

Constraints:

```text
0 <= decision_completed_count <= required_voter_count

decision_completed_count > 0 implies:
  state = 'ready'
  voter_count = required_voter_count
  filter_completed_count = required_voter_count
  filter_resolution_status = 'compatible'
  candidate_acquisition_status = 'assigned'
  tmdb_movie_id IS NOT NULL
```

The migration extends the authenticated column-level room read grant and the
create/join RPC projections with `decision_completed_count`. Existing room
invariants continue to own fixed membership and candidate assignment.

## Cross-Entity Invariants

The authoritative RPCs enforce invariants that cannot be expressed as simple
row checks:

1. Every decision membership belongs to the target room.
2. The member is a fixed voter, not merely an authorized creator/observer.
3. The decision TMDB ID equals the room's assigned `tmdb_movie_id` at
   acceptance and recovery time.
4. `rooms.decision_completed_count` equals the exact number of decision rows
   for the room's fixed voting members and current TMDB ID.
5. One insert and one count increment commit or roll back together.
6. A same-value repeat changes neither row nor count.
7. An opposite-value repeat changes neither row nor count.
8. A rejected stale, unauthorized or unready request changes nothing.

The submission operation locks the target room row before checking and changing
detail/count state. This gives one consistent ordering with a future candidate
transition while allowing unrelated rooms to proceed independently.

## Derived Projection

The private decision RPC projection is:

| Field | Type | Derivation |
| --- | --- | --- |
| `my_decision` | decision enum, nullable | The authenticated caller's row for the current candidate; null when none or caller is not a voter. |
| `decision_completed_count` | integer, nullable | Room aggregate for an authorized visible room. |
| `required_voter_count` | integer, nullable | Fixed room voting-group size. |
| `decision_set_complete` | boolean, nullable | `completed_count = required_voter_count`; null for masked rejection outcomes. |
| `two_voter_agreement` | boolean, nullable | For exactly two voters: both rows exist and both are yes; always null for any other group size or masked rejection. |

No projection returns another voter's membership ID, user ID, decision or
acceptance time. `decision_completed_count` is not a yes-count.

## State Transitions

### Per-voter decision

```text
no row
  | valid first yes                 | valid first no
  v                                 v
accepted yes                      accepted no
  | same yes -> unchanged           | same no -> unchanged
  | opposite -> conflict            | opposite -> conflict
  +---------------- immutable ---------------------------+
```

Transport uncertainty does not add a database state. The client moves to a
recoverable local state, then reads/retries the same immutable pair.

### Room completion

```text
0/N --first unique decision--> 1/N --...--> N/N
 ^                                |
 | duplicate/conflict/reject      | each unique voter increments once
 +-------- no transition ---------+
```

Feature 007 has no transition from N/N to another candidate or match.

### Exact-two agreement

| Stored decisions | Complete | `two_voter_agreement` |
| --- | --- | --- |
| none | no | `false` |
| one `yes` or `no` | no | `false` |
| `yes`, `yes` | yes | `true` |
| `yes`, `no` | yes | `false` |
| `no`, `no` | yes | `false` |

For `required_voter_count > 2`, the value is `null` in every state. Feature 008
must define that policy before using larger-room completion for progression.

## Client Domain Model

The generated schema types supply the enum and RPC rows. Feature-local validated
models use camel-case application fields:

```ts
type CandidateDecision = 'yes' | 'no';

type DecisionProjection = {
  myDecision: CandidateDecision | null;
  completedCount: number;
  requiredVoterCount: number;
  decisionSetComplete: boolean;
  twoVoterAgreement: boolean | null;
};
```

The client state is keyed by `{ roomId, tmdbMovieId }` and distinguishes:

- `recovering`: private authority has not yet been loaded;
- `undecided`: recovered with no stored value and controls may be enabled;
- `submitting`: one yes/no attempt is in flight;
- `decided`: an authoritative stored value is known;
- `recoverable-error`: no authoritative success is claimed; retry/reconcile is
  available; and
- `unavailable`: caller/candidate state cannot vote.

Room projections also carry `decisionCompletedCount` so a rooms-table update can
invalidate/refetch safely without exposing decisions.

## Migration and Backfill

The migration is additive relative to Feature 006:

1. Create the decision enum and table/security boundary.
2. Add `decision_completed_count` with default zero and constraints.
3. Existing rooms backfill to zero because no Feature 007 decisions can exist
   before the relation is introduced.
4. Replace dependent create/join RPC signatures/projections and room column
   grants in the same migration.
5. Create/revoke/grant only the two decision RPCs required by authenticated
   clients.
6. Leave Feature 006 candidate status, TMDB ID, acquisition function and
   Discover sorting unchanged.

Upgrade tests must begin from a nonempty Feature 006 state containing waiting,
ready/assigned, no-candidate and creator-role variations, then verify zero
backfill and preexisting behavior. Clean-reset tests prove replay from the first
migration. Generated TypeScript types are regenerated after the SQL contract is
stable.
