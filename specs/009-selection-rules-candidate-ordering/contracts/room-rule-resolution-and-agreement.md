# Contract: Room Rules, Genre Resolution and Agreement

**Feature**: 009 — Selection Rules and Candidate Ordering  
**Status**: Planned evolution of Features 005 and 008 internals

## Protected Snapshot Contract

Every room has exactly one `private.room_selection_rules` row. Consumers first
authorize through their established boundary, lock the room when mutation is
possible, then read and validate the snapshot in that authoritative context.

| Kind | Ordering | Vote cutoff | Rating cutoff | Language | Genre mode | Fraction |
| --- | --- | --- | --- | --- | --- | --- |
| `legacy_005_006_008` | `legacy_source_order` | none | none | `en-US` | `or` | `2/3` |
| `configured_009_v1` | one configured mode | required non-negative | optional | retained supported tag | `or` or `and` | normalized exact `p/q` |

Missing, duplicate or inconsistent snapshot data is an integrity failure. Consumers
must not use current process configuration, partial defaults or a weaker predicate.

## Common Filter Resolution

The public authenticated operation remains:

```text
public.resolve_common_filters(p_room_id uuid)
  -> outcome, filter_resolution_status
```

Its authorization, room locking, idempotency and status-only response remain as in
Feature 005. Under the room lock it additionally validates the snapshot and compiles
genres as follows.

### Canonical compilation

For every fixed voting member with one frozen filter row:

```text
genres = []:
  emit nothing

mode = or, genres = [g1..gk]:
  emit one canonical clause [g1..gk]

mode = and, genres = [g1..gk]:
  emit canonical singleton clauses [g1] .. [gk]
```

Concatenate all voters' emitted clauses in a deterministic order and assign contiguous
ordinals. Across-voter semantics is always AND. A candidate set `C` satisfies the
compiled predicate exactly when:

```text
for every stored clause K: intersection(C, K) is nonempty
```

The existing inclusive common year calculation is unchanged. Incompatibility remains
only an empty year intersection; a valid AND genre predicate with no TMDB result is a
candidate-source empty/exhausted outcome, never filter incompatibility.

### Handoff integrity

`private.valid_tmdb_candidate_handoff(room_id)` must validate:

- assembled fixed membership and exactly `N` voter filter rows;
- no non-voter filter;
- frozen canonical participant filter values;
- one coherent room snapshot;
- exact common inclusive years; and
- exact deterministic clauses recomputed using the retained genre mode.

The resolver never returns filters, clauses, mode or voter identity to clients.

## Exact Agreement Helper

Conceptual private function:

```text
private.candidate_agreement_threshold(
  p_room_id uuid,
  p_required_voter_count integer
) returns integer
```

Validation:

- room and snapshot exist and agree with the locked caller context;
- `N >= 2`;
- normalized integers satisfy `0 < p <= q`; and
- legacy/configured row invariants hold.

Result:

```text
if N = 2: 2
otherwise: ((N::bigint * p::bigint) + q::bigint - 1) / q::bigint
```

No floating-point or decimal fraction conversion is permitted.

## Decision RPC Integration

The public signatures and nine-field privacy-safe result shape of
`get_room_candidate_decision` and `submit_room_candidate_decision` remain unchanged
unless SQL replacement mechanics require a drop/recreate of the same signatures.

Both read the threshold from the room snapshot under the existing authorized room
lock. Submission preserves Feature 008's order:

1. unlocked masked membership precheck;
2. lock authorized room and reauthorize;
3. validate snapshot, fixed membership, current occurrence, detail rows and counts;
4. return duplicate/conflict/non-voter without mutation where applicable;
5. insert a first accepted decision;
6. if count `< N`, remain collecting regardless of yes/no inevitability;
7. only at count `= N`, count yes and compare with exact threshold; and
8. atomically agree or reject/advance using the existing transitions.

Exactly two voters always receive threshold `2`. The returned threshold is a safe
integer aggregate. The fraction and yes tally remain private.

## Client Threshold Contract

The client treats the server-returned `agreement_threshold` as authoritative and
validates only cross-field integrity:

- integer in `1..required_voter_count`;
- exactly `2` when required voter count is `2`;
- null only in the existing protected all-null outcomes; and
- consistent across equal room/candidate generations.

It must not recompute `2/3`, receive `p/q`, resolve early or render a configurable
threshold/mode. Existing agreed/advancing/exhausted UI and Match absence remain.

## Failure, Retry and Privacy

- Resolution/decision operation with a corrupt snapshot rolls back and returns a safe
  failure; it does not rewrite filters, rules, decisions or occurrence state.
- Duplicate/lost-response recovery reuses the stored snapshot and existing outcome.
- Snapshot rows, individual filters, clauses and individual decisions remain outside
  Realtime and direct client SELECT.
- Non-voting creators can observe existing safe aggregates but contribute neither
  filters nor decisions.
- Configuration restart does not reinterpret accepted filters or prior decisions.

