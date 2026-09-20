# Contract: Progression-Aware Decision RPCs

**Feature**: 008 — Candidate Progression
**Status**: Approved contract for the planned replacement of the Feature 007
signatures; not implemented.

## Boundary

Feature 008 does not add another voting transport. It replaces the signatures
of Feature 007's two authenticated PostgreSQL RPCs so the same immutable
decision write path can target a candidate occurrence and return its resolved
outcome.

Both functions are `SECURITY DEFINER`, owned by `postgres`, use
`SET search_path = ''`, derive the caller only from `auth.uid()`, revoke default
execute, and grant execute only to `authenticated`.

## Shared Target

Every call supplies:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `p_room_id` | UUID | Room the caller believes is active |
| `p_expected_candidate_sequence` | integer | Occurrence ordinal displayed by the client |
| `p_expected_tmdb_movie_id` | bigint | TMDB identity displayed by the client; compare-only, never trusted as authority |

The server derives the actual occurrence from the room and validates all three
target fields. Null, non-positive or malformed target values raise the existing
safe invalid-argument error. A valid but old/different target returns
`candidate_changed` and no protected projection.

Sequence is required even though Feature 008 prohibits room-local TMDB repeats.
It binds a delayed action to the exact occurrence and keeps the contract safe if
that no-repeat policy changes later.

## Shared Result Shape

Both RPCs return exactly one row with these fields in this order/shape:

| Field | Type | Meaning |
| --- | --- | --- |
| `outcome` | text | Operation result listed below |
| `my_decision` | `candidate_decision_value` nullable | Only the caller's stored yes/no value |
| `candidate_sequence` | integer nullable | Target occurrence ordinal |
| `decision_completed_count` | integer nullable | Accepted fixed-voter decisions for the target occurrence |
| `required_voter_count` | integer nullable | Fixed `N` |
| `decision_set_complete` | boolean nullable | True only for an agreed/rejected occurrence result |
| `agreement_threshold` | integer nullable | Fixed integer threshold for `N`; never a yes tally |
| `candidate_outcome` | `candidate_occurrence_status` nullable | `collecting`, `agreed` or `rejected` |
| `candidate_progression_status` | `candidate_progression_status` nullable | Canonical room status after the operation |

For `collecting`, completion is false and the count is `< N`. For `agreed`,
completion is true, count is `N`, and room progression is `agreed`. A final
rejected submission returns completion true/count `N` for the occurrence while
room progression is `advancing`; the safe room projection itself has already
reset its current count to 0.

The result never includes yes count, another member's identity/value/timestamp,
occurrence UUID, private filter resolution or a roster.

For `not_found`, `not_ready` and `candidate_changed`, every field after
`outcome` is null. This preserves the all-null foreign/protected shape.

## `get_room_candidate_decision`

Planned signature:

```text
public.get_room_candidate_decision(
  p_room_id uuid,
  p_expected_candidate_sequence integer,
  p_expected_tmdb_movie_id bigint
)
```

Successful outcomes:

| Outcome | Condition | `my_decision` |
| --- | --- | --- |
| `observer` | Authorized non-voting creator; current target is collecting/agreed | null |
| `not_decided` | Fixed voter has no row for current collecting occurrence | null |
| `decided` | Fixed voter has a row for current collecting/agreed occurrence | stored value |

Protected outcomes:

| Outcome | Condition |
| --- | --- |
| `not_found` | Missing room or caller is not an inherited authorized member |
| `not_ready` | Room has no recognizable collecting/agreed current occurrence |
| `candidate_changed` | Expected sequence or TMDB ID does not match current authority |

The function performs an unlocked actor/room membership authorization check
before taking a shared room lock, preserving Feature 007's rule that a foreign
caller does not join the protected room's lock queue. Under the shared lock it
revalidates authorization plus room/occurrence/count/membership integrity, then
reads only the caller's row.

An agreed occurrence remains readable so reload/re-entry can recover own value
and neutral stopped state. A rejected occurrence is historical, not current; an
old read returns `candidate_changed` and canonical room refetch supplies the new
state.

## `submit_room_candidate_decision`

Planned signature:

```text
public.submit_room_candidate_decision(
  p_room_id uuid,
  p_expected_candidate_sequence integer,
  p_expected_tmdb_movie_id bigint,
  p_decision candidate_decision_value
)
```

Successful/authorized outcomes:

| Outcome | Condition | Write behavior |
| --- | --- | --- |
| `accepted` | First valid value for voter+occurrence | Insert once; update count or resolve in same transaction |
| `unchanged` | Stored value equals retry value | Zero writes |
| `conflict` | Stored value differs from retry value | Zero writes; return stored own value |
| `not_voter` | Authorized non-voting creator | Zero writes; own value null |

Protected outcomes are the same `not_found`, `not_ready` and
`candidate_changed` all-null shapes as the read RPC.

### Lock and validation order

1. Validate Auth and input shape.
2. Resolve inherited membership through an unlocked actor/room lookup; return
   masked `not_found` before any room-row lock if unauthorized or missing.
3. Lock only the positively authorized `public.rooms` row by
   `p_room_id FOR UPDATE`.
4. Revalidate authorization and voter role under the lock.
5. Validate assembled/frozen/compatible room state.
6. Validate progression, sequence, private current TMDB ID and matching
   occurrence status.
7. Count all occurrence decisions, verify same-room fixed-voter ownership, and
   compare detail count to room summary.
8. Read the caller's existing decision.
9. Return duplicate/conflict/no-voter without writing, or insert first value.
10. For a new total below `N`, update count and remain collecting.
11. For a new total exactly `N`, compute threshold/yes count and resolve the
    occurrence plus room in the same transaction.

Any impossible count, member/room mismatch, current occurrence mismatch or
illegal state raises a fixed integrity error. No branch drops a row or repairs
client-visible state.

### Final agreement transaction

The final insert, occurrence update to `agreed`, room update to `agreed`, count
`N`, unchanged sequence/private TMDB ID and response are one transaction. If any
statement fails, all effects roll back.

### Final rejection transaction

The final insert, occurrence update to `rejected`, room update to `advancing`,
acquisition reset to `pending`, current TMDB clear, current decision count reset
to 0 and response are one transaction. Historical decisions remain intact.

No TMDB call occurs inside this transaction.

## Duplicate, Replay and Lost Response

- Before resolution, a same-value retry returns `unchanged`; an opposite retry
  returns `conflict`.
- If an agreeing final response is lost, the room still points to the same
  agreed occurrence; retry returns the stored value and agreed outcome with zero
  writes.
- If a rejecting final response is lost, the room is already advancing or later.
  The old target returns `candidate_changed`; the client refetches the canonical
  advancing/successor/exhausted state. It cannot add a second decision or start
  a second logical step.
- A stale action after a successor is installed has a lower sequence and returns
  `candidate_changed`.

## Concurrent Final Decisions

Distinct voters may reach the RPC concurrently. The common room `FOR UPDATE`
lock serializes them:

- the first locker validates the then-current detail/count and inserts once;
- the next locker sees the committed count/decision rows at READ COMMITTED;
- exactly one transaction observes the transition to `N` and resolves; and
- every distinct first decision remains attached to its voter/occurrence.

Database dblink tests, not browser timing, are the lock-order oracle.

## Privacy and Grants

- No direct select/insert/update/delete grant is added for decisions or
  occurrences.
- No RLS policy permits ordinary table access.
- The RPC never accepts actor/member identity as an argument.
- Only own decision is returned.
- Threshold and room/occurrence outcome are safe aggregates; yes count is not.
- Foreign/missing rooms are indistinguishable through the all-null `not_found`
  result.

## Client Contract Consequences

Strict parsers must require the exact nine-field shape, legal enum values and
cross-field relationships. Decision generations become
`(roomId, candidateSequence, tmdbMovieId)`. `candidate_changed` triggers room
refetch and retires the old generation; it is never locally retargeted to the
next movie.
