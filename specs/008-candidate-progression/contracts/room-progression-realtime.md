# Contract: Room Progression Projection and Realtime Recovery

**Feature**: 008 — Candidate Progression
**Status**: Approved contract for the planned evolution of the existing
rooms-only synchronization path; not implemented.

## Safe Room Projection

Create/join RPCs and the direct member-scoped room refetch append exactly:

- `candidate_progression_status`; and
- `candidate_sequence`.

The full safe progression-related projection is:

```text
id
code
state
voter_count
required_voter_count
filter_completed_count
filter_resolution_status
candidate_acquisition_status
candidate_progression_status
candidate_sequence
decision_completed_count
```

The create/join results also retain their existing outcome and caller role
fields. Rejected create/join shapes remain all-null except outcome.

Ordinary clients do not receive:

- `tmdb_movie_id` through `public.rooms`;
- occurrence UUID/history/status rows;
- individual decision rows, yes count or timestamps;
- private filter resolution/genre clauses; or
- creator/member internal IDs or a roster for progression.

The existing `rooms_select_member` RLS policy remains the authorization boundary
for direct room select. Exact column grants are rebuilt in the migration so no
new private column is inherited accidentally.

## Realtime Channel

`public.rooms` remains the only relation in `supabase_realtime`.

The existing room-scoped Postgres Changes subscription remains an invalidation
signal. It does not trust event payload fields as canonical state. On an UPDATE
for the accepted room ID, the client coalesces/refetches the exact safe
projection through its current Auth session.

No channel is added for:

- `candidate_decisions`;
- `room_candidate_occurrences`;
- candidate-source proposals; or
- progression broadcasts.

## Canonical Monotonic Merge Lattice

Membership and filter fields retain their existing integrity rules. Candidate,
progression, acquisition and decision-count fields are validated and merged as
one indivisible projection; fields are never mixed from separate observations.

Normalize a valid projection to one node:

```text
P0     = inactive(0,pending,count 0)
E0     = inactive(0,no_candidates,count 0)
C(k,c) = collecting(k,assigned,count c), k >= 1 and 0 <= c < N
A(k)   = agreed(k,assigned,count N), k >= 1
V(k)   = advancing(k,pending,count 0), k >= 1
X(k)   = exhausted(k,no_candidates,count 0), k >= 1
```

`collecting`/`agreed` also require the legal current-candidate shape; the other
nodes require no current candidate. Malformed or illegal cross-field shapes are
rejected by strict parsing before ordering.

The direct forward edges are:

```text
P0     -> E0
P0     -> C(1,0)
C(k,c) -> C(k,c')              where c' >= c and c' < N
C(k,c) -> A(k) | V(k)
V(k)   -> X(k) | C(k+1,0)
```

`E0`, `A(k)` and `X(k)` are terminal and have no outgoing edge. The normative
order is the reflexive transitive closure of these edges, so it includes, among
other valid recoveries:

- `C(k,c) -> X(k)` when the client missed `V(k)`;
- `C(k,c)` or `V(k)` to any legal `C/A/V/X` node at a higher sequence after one
  or more missed occurrences; and
- `P0` to any later valid node through first-candidate assignment.

For each strictly parsed incoming canonical projection:

1. if local and incoming are the same node, keep the equivalent authority;
2. if local can reach incoming, adopt the complete incoming projection and its
   exact count;
3. if incoming can reach local, ignore incoming as provably older/stale; and
4. if neither can reach the other, set a progression integrity error and
   withhold candidate/decision/source actions.

This rule accepts higher-sequence `collecting`, `agreed`, `advancing` and
`exhausted` states, including multi-sequence jumps. It also distinguishes stale
from conflict: a delayed lower-sequence collecting/advancing predecessor is
ignored, but a lower-sequence agreed/exhausted terminal cannot precede a newer
sequence and is genuinely incomparable. Likewise same-sequence `agreed` versus
`advancing/exhausted` fails closed, while `collecting` received after any of its
valid descendants is simply ignored as stale.

`Math.max` is used only conceptually by the `C(k,c) -> C(k,c')` edge within one
occurrence. A successor projection replaces the previous occurrence count
exactly; no count is inferred from sequence or candidate metadata.

## Immediate Trusted Observations

Only a strictly parsed authenticated decision RPC result containing its complete
lock-consistent room fields may update the local room projection before Realtime
arrives:

- a final decision result can observe `agreed(k)` or `advancing(k)`;

That observation must pass the same lattice. Subsequent room refetch remains the
shared recovery path.

A candidate Edge response is not a room projection: it has no authoritative
decision count and may be delayed after its database commit. It may cache only
database-confirmed metadata keyed to its room/sequence and MUST trigger canonical
room refetch before progression/count authority is changed or a successor is
rendered. The metadata is usable only when the refetched projection still has
that sequence in `collecting` or `agreed`; it never creates an assumed `0/N`.
An `exhausted`, `no_candidates`, `refresh_required` or metadata-unavailable Edge
result likewise triggers/refines recovery without installing room authority.

No source search proposal may be observed before its database commit.

## Out-of-Order Examples

| Current local state | Incoming result | Required behavior |
| --- | --- | --- |
| `collecting(4), 2/N` | `collecting(4), 1/N` | Ignore stale count |
| `advancing(4), 0` | delayed `collecting(4), 3/N` | Ignore older phase |
| `collecting(4), 3/N` | refetch `exhausted(4), 0` | Adopt exhaustion; advancing was missed |
| `collecting(5), 0/N` | delayed `advancing(4)` | Ignore lower sequence |
| `collecting(7), 0/N` | refetch `advancing(9), 0` | Adopt sequence 9 advancing; missed history is not fabricated |
| `advancing(7), 0` | refetch `exhausted(9), 0` | Adopt sequence 9 exhaustion through transitive recovery |
| `agreed(5), N/N` | source result for expected 4 | Ignore/refresh; agreement remains terminal |
| `exhausted(5), 0` | old metadata success | Ignore; no candidate becomes active |
| `collecting(6), 1/N` | delayed canonical `agreed(5), N/N` | Fail closed; the terminal could not precede sequence 6 |
| `collecting(6), 2/N` | delayed Edge winner for sequence 6 | Keep `2/N`; cache metadata only and refetch |
| `advancing(6), 0` | delayed Edge winner for sequence 6 | Do not restore candidate or `0/N`; refetch and discard retired metadata |

## Reconnect and Reload

On subscription setup, retry, app foreground, reload or same-identity room
re-entry:

1. recover the inherited room membership/session;
2. fetch the safe room projection;
3. establish the progression generation from sequence/status;
4. if collecting/agreed, call the existing candidate Edge endpoint to recover
   metadata for the installed identity;
5. if collecting and voter/observer, call the current-decision read RPC for own
   value/safe aggregate;
6. if advancing, invoke the existing candidate Edge endpoint for the same step;
7. if exhausted or initial no-candidates, issue no acquisition automatically;
   and
8. bind one rooms subscription for future invalidation.

Missing the transition event therefore changes latency, not authority.

## Privacy-Safe Agreement Observation

All members may see room progression `agreed` and the same candidate
presentation recovered through the Edge Function. They do not see which voters
said yes/no or the yes tally. Voters may recover only their own decision.

A non-voting creator sees the same `agreed`, `advancing`, successor or
`exhausted` meaning and never receives decision controls or a decision row.

## Stale Action Response

When a decision RPC returns `candidate_changed` or the Edge Function returns
`refresh_required`, the client:

- does not retry against a locally substituted movie;
- does not publish a local outcome;
- invalidates the old candidate/decision generation;
- performs canonical room refetch; and
- follows the resulting state through the normal recovery flow.

This is the single stale-client reconciliation path.

## Failure Handling

- Realtime channel failure shows the existing recoverable synchronization error
  and Retry; canonical room state remains unchanged.
- A candidate-source 503 while room is advancing creates a local actionable
  source error layered over the durable advancing projection.
- Malformed room/RPC/Edge data enters a fail-closed integrity state with no
  voting/source action.
- Raw subscription/provider/RPC diagnostics are not rendered or persisted.

## Terminal Meanings

- `agreed`: preserve/recover the current candidate; no source acquisition and
  no active decision controls.
- `exhausted`: no current candidate; no acquisition Retry; start-new-room action
  may use the existing navigation boundary.
- initial `inactive/no_candidates`: preserve Feature 006's original terminal;
  do not label it as a rejected candidate or progression exhaustion.

No terminal state emits Feature 009 navigation or presentation.
