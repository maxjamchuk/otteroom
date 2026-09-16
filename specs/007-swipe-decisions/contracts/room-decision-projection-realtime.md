# Contract: Room Decision Projection and Realtime

**Feature**: 007 — Swipe Decisions

## Room Projection Change

Add `decision_completed_count` to every authoritative room projection returned
by:

- `public.create_room`;
- `public.join_room`; and
- the authenticated `public.rooms` refetch used by the room subscription.

The field is an integer in `[0, required_voter_count]`. The TypeScript parser
must require the field and reject missing, extra or impossible projection data.
Application state exposes it as `decisionCompletedCount`.

Existing fields and meanings remain unchanged. In particular:

- fixed `required_voter_count`, `voter_count`, creator and voter roles remain
  owned by Features 001/003;
- filter completion and resolution remain owned by Features 004/005; and
- candidate status and identity remain owned by Feature 006.

## Read Privilege

Authenticated clients receive column-level `SELECT` access to
`rooms.decision_completed_count` only as part of their existing authorized
rooms-table path. No grant is added for decision-detail rows, and the room row
does not expose yes/no counts or individual decisions.

## Event Source

The only Feature 007 Realtime invalidation is the existing room-row `UPDATE`
created by the first accepted decision:

```text
candidate_decisions INSERT
  + rooms.decision_completed_count += 1
  + rooms.updated_at = database time
  = one transaction
```

`unchanged`, `conflict` and rejected submissions perform zero room writes and
therefore intentionally produce no Feature 007 room event.

The decision table is not added to `supabase_realtime`, and the client does not
open a decisions channel. Existing channel count and teardown guarantees stay
unchanged: at most one room-scoped subscription per active room lifecycle.

## Merge and Recovery Rules

A Realtime payload is an invalidation hint, never direct decision authority.
For an active room:

1. validate that the event targets the active room using the existing id-only
   subscription boundary;
2. coalesce duplicate/bursty invalidations through the established refetch
   lifecycle;
3. fetch and validate the full safe room projection;
4. reject stale or regressive room state according to existing room integrity
   guards;
5. if the active assigned candidate remains recognizable, recover the current
   caller's private decision through `get_room_candidate_decision`; and
6. commit results only when the room/candidate generation still matches.

Missed, duplicate, delayed and reordered events converge because reconnect and
focus/re-entry paths refetch authority. An event never changes the candidate in
Feature 007; if a future feature does, the expected-ID guard forces a fresh
generation.

## Observable Rules

- All participants continue to render the one Feature 006 candidate identity.
- A client may display aggregate progress such as `1 of 2 decided`; it must not
  infer which other voter decided or which value they selected.
- A voter sees only their own recovered decision.
- An authorized non-voting creator may observe aggregate completion but has no
  private decision and no submit control.
- Reconnect/reload correctness must not depend on receiving the original room
  update.

## Compatibility

The Feature 007 migration replaces the create/join return signatures and room
column grant atomically. Client contracts, generated types and migration tests
must be updated together. Feature 006 acquisition behavior, TMDB identity and
Discover sorting receive no semantic change.
