# 001 MVP — Realtime Contract

Clients subscribe only to:
- rooms (by room_id)
- matches (by room_id)

## Authoritative state source
The server writes:
- rooms.status
- rooms.current_idx
- rooms.current_movie_id
- matches (terminal selection)

The client must treat these as authoritative and update UI accordingly.

## Subscription: rooms
Filter: `rooms.id = <room_id>`

Fields of interest:
- status: lobby | voting | matched | closed
- current_idx: integer
- current_movie_id: integer|null
- language, region (for display/debug)

Client behavior:
- if status == lobby: show waiting/preference UI
- if status == voting and current_movie_id present: show voting UI
- if status == matched: transition to match UI (may also rely on matches subscription)
- on reconnect: re-fetch room row to avoid stale state

## Subscription: matches
Filter: `matches.room_id = <room_id>`

Client behavior:
- if a row appears, show Match screen immediately
- treat match as terminal for MVP (one match per room)

## Resilience rules
- If matches row exists but room is not matched yet (race), client should still show match.
- If room is matched but matches row not received yet, client should fetch match via SELECT.