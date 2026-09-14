# Contract: Room Candidate Projection and Realtime

## Evolved projections

Accepted `create_room(...)` and `join_room(text)` rows append:

```text
candidate_acquisition_status: pending | assigned | no_candidates
```

Rejected join outcomes keep all projection fields null except outcome. New rooms
return pending; same-member re-entry returns stored status. No result includes
`tmdb_movie_id`, movie metadata or private filter/resolution data.

Authorized direct room refetch selects exactly:

```text
id, code, state, voter_count, required_voter_count,
filter_completed_count, filter_resolution_status,
candidate_acquisition_status
```

Column grants continue to deny `movie_candidate_id` and `tmdb_movie_id`.

## Logical validation and monotonic merge

- Feature 005 pending/incompatible implies Feature 006 pending.
- Feature 006 assigned/no-candidates requires Ready, N/N and compatible.
- pending may advance to assigned or no-candidates.
- delayed pending cannot regress a terminal.
- equal terminals are no-ops.
- observing both terminals for one room generation is an integrity error, not
  last-response-wins.
- room/code/identity/request generation mismatch discards the result.

The database is authority; client guards prevent stale presentation.

## One unchanged channel

Retain exactly:

```text
channel room:<accepted room UUID>
event UPDATE
schema public
table rooms
filter id=eq.<accepted room UUID>
selected payload id only
```

A first terminal CAS updates `updated_at`, generating invalidation. Clients
refetch the safe projection and call the same Edge endpoint when assigned; Edge
returns the stored ID without Discover. System-ok refetch recovers missed events.

Keep existing subscription binding, coalescing, lifecycle/request generations,
last-good-state error behavior and cleanup. Do not publish private relations or
add polling, Presence, Broadcast or another candidate channel.

## Trigger interaction

Automatic candidate acquisition is enabled only by:

```text
state == ready
AND filter_completed_count == required_voter_count
AND filter_resolution_status == compatible
AND candidate_acquisition_status == pending
```

Noncompatible rooms never invoke Edge. A terminal room invokes only when current
metadata must be recovered; preflight ensures assigned reads Details only and
no-candidates makes no TMDB call.
