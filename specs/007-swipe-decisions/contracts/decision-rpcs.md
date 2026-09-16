# Contract: Authoritative Decision RPCs

**Feature**: 007 — Swipe Decisions

**Consumers**: authenticated Expo clients and database tests

## Shared Rules

- Functions are postgres-owned `SECURITY DEFINER` functions with an empty
  `search_path`; every relation/type reference is schema-qualified.
- Execution is revoked from `PUBLIC` and `anon`, then granted only to
  `authenticated`.
- Caller identity is `auth.uid()`. No user ID or room-member ID is accepted.
- `p_room_id` is a UUID and `p_expected_tmdb_movie_id` is a positive bigint.
- Results are exactly one row for domain outcomes. Invalid/null arguments use
  SQLSTATE `22023`; missing authentication uses the repository's established
  authentication error contract.
- Missing rooms, foreign rooms and callers without an authorized relationship
  are indistinguishable as `not_found` and return null protected fields.
- Functions never return another participant's identity, answer or timestamp.

## Shared Safe Projection

Authorized non-masked outcomes use these columns:

| Column | SQL type | Rule |
| --- | --- | --- |
| `outcome` | `text` | Closed value documented by each function. |
| `my_decision` | `public.candidate_decision_value` nullable | Only the caller's authoritative current-candidate value. |
| `decision_completed_count` | `integer` nullable | Non-null only when a visible room projection is returned. |
| `required_voter_count` | `integer` nullable | Fixed group size. |
| `decision_set_complete` | `boolean` nullable | Count equals required size. |
| `two_voter_agreement` | `boolean` nullable | Exact-two rule; null for group sizes other than two. |

Projection invariants:

- `0 <= decision_completed_count <= required_voter_count`;
- `decision_set_complete = (decision_completed_count = required_voter_count)`;
- when `required_voter_count = 2`, `two_voter_agreement` is non-null, true only
  for two accepted yes decisions, and false otherwise; and
- when `required_voter_count <> 2`, `two_voter_agreement` is null.

Rejected `not_found`, `not_ready` and `candidate_changed` responses do not leak
the current candidate ID or completion state; all projection fields are null.
`observer` and `not_voter` are available only to a caller already authorized to
view the target room and may return the room's safe aggregate projection with
`my_decision = null`.

## `public.get_room_candidate_decision`

### Signature

```sql
public.get_room_candidate_decision(
  p_room_id uuid,
  p_expected_tmdb_movie_id bigint
)
returns table (
  outcome text,
  my_decision public.candidate_decision_value,
  decision_completed_count integer,
  required_voter_count integer,
  decision_set_complete boolean,
  two_voter_agreement boolean
)
```

### Outcomes

| Outcome | Meaning | Projection |
| --- | --- | --- |
| `decided` | Caller is a voter and has one current-candidate row. | `my_decision` is `yes` or `no`; safe aggregate fields populated. |
| `not_decided` | Caller is a voter with no current-candidate row. | `my_decision` null; safe aggregate fields populated. |
| `observer` | Caller is the authorized non-voting creator. | `my_decision` null; safe aggregate fields populated. |
| `not_ready` | Room has no complete compatible assigned candidate. | All protected fields null. |
| `candidate_changed` | Expected ID differs from the authoritative assigned ID. | All protected fields null. |
| `not_found` | Room missing or caller has no authorized relationship. | All protected fields null. |

The function is read-only from the application's perspective. It verifies that
the persisted room count equals detail rows for the current candidate before
returning a successful projection. Invariant corruption raises an internal
error rather than manufacturing a result.

The function first establishes that the caller has an authorized room
relationship without joining a foreign caller to the room's lock queue. It then
locks the authorized target room row `FOR SHARE`, revalidates the locked
membership, candidate and room state, and derives caller detail, aggregate
count, completeness and exact-two agreement before releasing the lock. A
concurrent submission may cause a bounded database wait, but cannot produce a
mixed detail/count projection or false integrity exception. A missing or foreign
caller returns `not_found` without waiting on the target room lock.

## `public.submit_room_candidate_decision`

### Signature

```sql
public.submit_room_candidate_decision(
  p_room_id uuid,
  p_expected_tmdb_movie_id bigint,
  p_decision public.candidate_decision_value
)
returns table (
  outcome text,
  my_decision public.candidate_decision_value,
  decision_completed_count integer,
  required_voter_count integer,
  decision_set_complete boolean,
  two_voter_agreement boolean
)
```

### Outcomes

| Outcome | Meaning | Writes |
| --- | --- | --- |
| `accepted` | The first valid decision for this voter/candidate committed. | Insert one detail row; increment count once; update room timestamp. |
| `unchanged` | The same value was already authoritative. | None. |
| `conflict` | The opposite value was already authoritative. | None; return the stored value in `my_decision`. |
| `not_voter` | Authorized caller is the room's non-voting creator. | None; safe aggregate may be populated. |
| `not_ready` | No complete compatible assigned candidate exists. | None; protected fields null. |
| `candidate_changed` | Expected ID is not the assigned ID. | None; protected fields null. |
| `not_found` | Room missing or caller has no authorized relationship. | None; protected fields null. |

`accepted`, `unchanged` and `conflict` always return non-null `my_decision` and
a coherent safe projection. A `conflict` is an actionable authoritative result,
not transport failure and not permission to overwrite the row.

## Transaction Contract

The submit function executes these checks in this order:

1. validate authentication and arguments;
2. lock the target `public.rooms` row with `FOR UPDATE`;
3. locate the caller's fixed membership and mask foreign access;
4. reject an authorized non-voter;
5. require room ready, all voters assembled, all filters complete, compatible
   resolution, assigned candidate and exact expected/current TMDB ID;
6. verify `decision_completed_count` against current decision details;
7. read the caller's existing pair;
8. return `unchanged`/`conflict` with zero writes if it exists; otherwise
9. insert the pair and increment the room count/timestamp atomically; and
10. derive and return the safe projection from post-write state.

Any exception rolls the insert and count update back together. The function
must not call a TMDB Edge Function, change `tmdb_movie_id`, change acquisition
status or create any Feature 008/009 state.

## Concurrency and Retry Contract

- Concurrent identical submissions for one voter/candidate yield one
  `accepted` and authoritative recovery outcomes; exactly one row/count exists.
- Concurrent opposite submissions yield one winning `accepted`; the loser
  returns or later recovers `conflict` with the winner. Scheduling does not
  prescribe which value wins.
- Concurrent submissions by distinct voters each complete. After both requests
  reach the authoritative transaction boundary, completion requires no further
  user action, client connectivity or acknowledgement from either voter; only
  bounded room-row transaction serialization for the atomic count may delay
  completion.
- Submissions in different rooms do not share the room lock.
- Retrying after a lost `accepted` response returns `unchanged` for the same
  value or `conflict` for the opposite value, never a second row/count.

## Client Validation

The TypeScript contract parser requires an array containing exactly one object,
the exact expected keys, a known outcome and outcome-consistent nullability. It
rejects unknown enums, fractional/negative counts, impossible completion facts,
an agreement value for groups larger than two, extra fields and malformed
Supabase success payloads. Transport errors remain distinct from domain
outcomes.
