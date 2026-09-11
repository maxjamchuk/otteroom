# Contract: Room Resolution Projection and Realtime

## Evolved create/join results

Accepted `create_room(...)` and `join_room(text)` rows add exactly one field
after `filter_completed_count`:

```text
filter_resolution_status: pending | compatible | incompatible
```

Accepted rows have all ten result fields non-null. New creation returns pending.
Existing-member re-entry returns the stored status, including terminal. Rejected
join outcomes retain only `outcome`; all nine projection fields are NULL. All
existing membership outcomes, ownership flags, counts, capacity/lock order,
duplicate/lost-response behavior and privacy remain unchanged.

Logical validation additionally requires:

- status is one of the exact enum values;
- Waiting or X<N implies pending;
- compatible/incompatible implies membership Ready and X=N;
- candidate readiness is derived only from compatible.

Create/join expose no common years, genres, clauses or participant details.

## Authoritative room read

After accepted create/join and on every invalidation, `refetchRoom(roomId)`
selects exactly:

```text
id, code, state, voter_count, required_voter_count,
filter_completed_count, filter_resolution_status
```

Existing member RLS authorizes only the caller's room. There is no `select('*')`,
private payload, source filter, member/user ID, roster, candidate FK or timestamp.
All Feature 004 ID/code/count/state validation remains binding plus the status
rules above.

## Monotonic merge

The route owns one room watermark across exact join, refetch, filter-RPC count
results and resolver status results:

- voter count and X/N retain their existing monotonic merge;
- pending may advance to compatible or incompatible only when N/N is accepted;
- delayed pending cannot replace a terminal status;
- the same terminal status is a no-op;
- compatible and incompatible are incomparable; observing both for one room sets
  a generation-scoped integrity-error overlay, suppresses candidate-ready/next-step
  meaning and requires full canonical reload/re-entry, never last-response-wins;
- a terminal response with X<N, changed target/code/identity or an invalid enum
  is rejected;
- route/lifecycle/request generation guards discard retired-room results.

The database is the authority. These guards only prevent stale rendering and
candidate-readiness mistakes.

## One unchanged invalidation channel

Retain exactly one channel per accepted route:

```text
channel: room:<accepted room UUID>
event: UPDATE
schema: public
table: rooms
filter: id=eq.<accepted room UUID>
selected payload: id only
```

Only `public.rooms` remains in `supabase_realtime`. Do not publish or subscribe
to `participant_filters`, either private resolution relation or `room_members`;
do not add Presence, Broadcast, polling or a second resolution channel.

The first terminal resolver transaction updates room status and `updated_at`.
That UPDATE is only invalidation; clients refetch the seven safe fields. A
repeated/early/failed resolution performs no committed room update and emits no
resolution event. No event contains years or clauses.

The inherited lifecycle remains binding:

- install change/system listeners before subscribing;
- treat SUBSCRIBED as transport-only and system postgres_changes/status=ok as
  binding readiness;
- refetch on every system-ok to recover a commit missed before binding;
- coalesce bursts to at most one active plus one pending read;
- guard room/lifecycle/request generations and discard stale results;
- preserve last accepted state on channel/read error with explicit retry;
- remove the prior channel before replacement and never duplicate a failed one;
- reconnect with the same Auth client/membership, creating no identity.

A client may refetch directly from pending to terminal and need not observe the
initiating RPC. A terminal resolver response may update its local watermark
before Realtime; the later refetch must agree and is a no-op.

## Resolution trigger interaction

Every authorized route derives the invocation condition only from exact room
authority:

```text
state == ready
AND filter_completed_count == required_voter_count
AND filter_resolution_status == pending
```

The resolution hook shares one active call for its room generation. A sync error
does not change authoritative status. Explicit Retry or a new route generation
can invoke again; an identical pending refetch alone cannot create a new attempt.
The server revalidates everything. If another member commits first, the room
event/refetch or call result advances this client to the same terminal state and
clears its transient error.

If an N/N-triggered resolver call returns `pending`, that one attempt ends in a
retryable error with no automatic reinvocation. This response is unexpected but
safe: no result is usable and explicit Retry/re-entry is bounded. A conflicting
terminal response instead enters the fail-closed integrity overlay and cannot be
cleared within the same route generation.

## Visible status meanings

| Authority | Visible meaning / action |
| --- | --- |
| Waiting or X<N + pending | Existing Feature 004 membership/filter progress |
| N/N + pending, call active | Resolving common filters; no usable result |
| N/N + pending, call failed | Temporary resolution failure; Retry/recover |
| N/N + compatible | Filters compatible; future candidate sourcing is next |
| N/N + incompatible | Filters incompatible; create a new room/session |

All states show zero candidate/movie content and reveal no resolved detail.

## Evidence

Client tests own exact projection shape, status/count validation, terminal
monotonicity, conflicting-terminal rejection, missed-event/system-ok recovery,
coalescing, stale generations and cleanup. PostgreSQL owns status/payload
consistency and RLS. I01/I02 prove cross-client convergence; I03 proves visible
failure/lost-response recovery.
