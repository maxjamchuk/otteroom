# Realtime Contract: Authoritative Room Convergence

**Feature**: `001-room-session`
**Transport**: Supabase Realtime Postgres Changes
**Source of truth**: RLS-protected `public.rooms` refetch

## Publication

A versioned migration adds `public.rooms` to the `supabase_realtime`
publication after creating the table and policies. The migration inspects the
PostgreSQL publication catalog before adding it so clean resets are deterministic.
No Dashboard step and no second application table are required.

## Subscription Identity

After the room route obtains an allowed `join_room` result, it owns one channel
for the accepted room. Successful create navigation carries only the canonical
code, so the host first recovers `already_member` through this same room-route
operation. With `@supabase/supabase-js` `2.115.0`, the planned call shape is:

```ts
const channel = supabase
  .channel(`room:${roomId}`, {
    config: { postgres_changes_options: { wait: true } },
  })
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`,
      select: ['id'],
    },
    () => scheduleAuthoritativeRefetch(generation, roomId),
  )
  .subscribe((status, error) => {
    if (!isCurrent(generation, roomId)) return;
    if (status === 'SUBSCRIBED') {
      scheduleAuthoritativeRefetch(generation, roomId);
    } else if (
      status === 'CHANNEL_ERROR' ||
      status === 'TIMED_OUT' ||
      status === 'CLOSED'
    ) {
      handleRecoverableChannelFailure(status, error);
    }
  });
```

`CLOSED` from the route's own cleanup is ignored because cleanup invalidates the
generation before removing the channel. Any current-generation unexpected
`CLOSED` is recoverable like `CHANNEL_ERROR` or `TIMED_OUT`.

The channel name is client-local namespacing. Selecting only `id` keeps the
invalidation payload minimal and within the authenticated column grant.
Authorization comes from the authenticated Supabase connection, table RLS, and
membership policy—not from the name, filter, or selected payload field.

## Lifecycle

1. Bootstrap or recover the persisted anonymous Auth session; the route awaits
   the shared bootstrap promise before an RPC or subscription.
2. Call `join_room` for the route code, including immediately after successful
   create navigation.
3. Render the authoritative RPC state.
4. Allocate a new monotonically increasing lifecycle generation and subscribe
   only after the result discloses an accepted member's immutable `room_id`.
5. The channel's `postgres_changes_options.wait = true` makes `SUBSCRIBED` wait
   until the server confirms the Postgres Changes binding. On the first
   successful `SUBSCRIBED`, immediately refetch the room. This closes the race
   where a guest joined before the host's binding became active.
6. On every matching UPDATE event, schedule an authoritative refetch.
7. On every later `SUBSCRIBED` after channel reconnect, refetch again, recovering
   all changes missed while disconnected.
8. Before `/room/[code]` unmounts, its accepted room ID changes, or the shared
   client is disposed, invalidate the generation and call
   `void supabase.removeChannel(channel)`.

No channel is opened for `invalid_code`, `not_found`, `full`, or an exceptional
failure because those outcomes disclose no internal room ID.

## Authoritative Refetch

The refetch uses the authenticated Supabase client and exact projection:

```text
public.rooms columns: id, code, state
predicate: id = accepted room_id
cardinality: at most one row
```

RLS must independently allow the caller as host or guest. `participant_count`
is derived as `1` for `waiting` and `2` for `ready`; participant role remains the
role returned by the accepted RPC result. On page reload, `join_room` returns
`already_member` and recovers that role before subscription begins.

Realtime payload fields are never installed directly as room state. The event is
only an invalidation signal.

## Duplicate, Stale, and Missed Events

- Multiple events arriving while a refetch is active are coalesced into one
  pending follow-up refetch for that room/generation.
- Every lifecycle and request receives a monotonically increasing number. A
  completion may update route state only if both its captured generation and
  room ID still match the current route and its request number is the newest
  applicable request. Results from a prior room/subscription are discarded.
- Since the database has no `ready` to `waiting` transition, the mapper also
  refuses to replace a locally observed `ready` with an older `waiting` result
  for the same room.
- The first and every later `SUBSCRIBED` transition always refetch, so an event
  lost before initial readiness or during a disconnect/resubscribe window is
  recovered.
- Duplicate events cause another safe read at most; they cannot duplicate
  membership or mutate the database.

## Failure and Recovery

- A transient refetch or channel failure preserves the last authoritative room
  state and presents a recoverable connection/error indication with retry.
- Retry invalidates the failed generation and removes its channel, confirms that
  the persisted Auth session is recovered, allocates a new generation,
  re-establishes the channel for the same accepted `room_id`, and refetches on
  successful `SUBSCRIBED`.
- If the refetch is denied or returns no row, the client does not infer room
  state from the event payload. It shows the generic recoverable failure and may
  repeat `join_room` using the route code after confirming Auth session recovery.
- Reconnecting never releases a seat; membership is stored in PostgreSQL, not in
  the channel.
- Auth token refresh uses the same Supabase client as the channel, so refreshed
  authorization is propagated by the client. A refresh/channel recovery failure
  follows the same recoverable retry path and never signs in a replacement user
  while a persisted session remains recoverable.
- Polling is not used as the primary synchronization mechanism.

## Authorization and Isolation

- Signed-out clients have no table read grant and cannot receive room rows.
- Authenticated users can select only `id`, `code`, and `state`, and RLS permits
  only a row where `auth.uid()` is the host or guest.
- An unrelated authenticated user cannot obtain an accepted `room_id` from
  `join_room` outcomes `not_found` or `full`, and a manipulated ID filter still
  yields no readable row under RLS.
- No service-role or secret key, Broadcast, Presence, custom WebSocket, Edge
  Function, or direct database connection is used.

## Observable Contract

- The guest sees `ready` directly from the committed `joined` RPC result.
- A waiting host sees `ready` and participant count `2` after the guest-seat
  UPDATE invalidates and refetches the row, without manual refresh.
- A reload or temporary disconnect recovers the current `waiting` or `ready`
  state for the same persisted participant without adding a seat.
- Reaching `ready` triggers no later product behavior.
