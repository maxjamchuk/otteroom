# Contract: Room Candidate Display

**Feature**: `002-first-movie-candidate`
**Screen**: Existing `app/room/[code].tsx`, accepted-room content
**Source**: [candidate-rpc.md](candidate-rpc.md); never direct catalog/assignment reads

## Inputs and Ownership

Consume the existing accepted room's immutable id and authoritative waiting/ready
state. The existing canonical-code keyed RoomEntry remains the navigation
generation boundary. Use the shared Auth/client instance and existing room
subscription; create neither another Auth session nor another channel.

Each room-local candidate model holds its source room ID/generation, request
attempt, optional immutable candidate metadata, poster attempt, and presentation
status. This is React state/ref data, not a persistent client selection or global
cache. The database FK remains authoritative.

## RPC Boundary

`src/candidates/contracts.ts` validates unknown transport data:

- exactly one array row and exactly outcome/candidate_id/title/release_year/
  poster_key, with no extra or missing fields;
- closed outcomes available/not_ready/not_found;
- available requires non-null slug-shaped ID/key, trimmed nonempty title, and
  integer release year within the catalog range;
- not_ready/not_found require all four candidate fields to be null;
- malformed shape, unknown outcome, null combination, or wrong value type throws
  a safe contract error without including input data.

Use generated database types for call arguments/field agreement, then narrow
logical nullability at runtime. Poster-key registry resolution is a separate
presentation/configuration check.

`service.ts` awaits the existing bootstrap and calls only
`getSupabase().rpc('ensure_room_candidate', { p_room_id: roomId })`.
Unexpected Auth/transport/database/parser errors become a fixed safe
CandidateServiceError. No raw backend message or response is logged/rendered.

If not_ready or not_found is returned while the current accepted room is Ready,
show the generic recoverable candidate-loading error. Do not demote room state,
change membership, infer another room, or display candidate fields. Waiting
normally makes no request at all; its direct not_ready contract is tested separately.

## Presentation States

| State | Visible behavior | Allowed transition |
| --- | --- | --- |
| Waiting / inactive | Existing Waiting experience only; no candidate card/poster or acquisition request | Authoritative Ready starts acquisition |
| Ready / loading without metadata | Existing Ready information and generic candidate-loading indication | Valid available metadata begins poster load; failure becomes recoverable error |
| Ready / loading with metadata | Retain selected title/year and reserved poster area with explicit loading status; do not mark the card successful | Current Image onLoad completes the card; onError becomes display failure |
| Ready / available | Visible poster image, title, release year; existing room information retained | Reconnect preserves this state; no progression control |
| Ready / acquisition error without metadata | Generic recoverable error and Retry candidate; no successful or speculative movie | Explicit retry calls the same RPC for the same room |
| Ready / poster/configuration error with metadata | Same title/year retained with explicit generic recoverable error; incomplete card is not successful | Retry resolves/remounts the same poster/candidate |
| Retired room generation | No old card, message, or image callback may affect the new room | Only the new room lifecycle can publish |

Copy:
- Loading: “Loading movie…”
- Recoverable acquisition/display failure: “Unable to load this movie. Please try again.”
- Retry control: “Retry candidate”.

The error class may be distinguished internally for safe recovery; the UI does
not expose SQL, provider, registry, transport, or credential details.

The card shows only poster/title/year, with accessible poster text derived from
the display title. Internal candidate IDs never appear as movie UI or route
parameters. Test IDs identify elements, not movie identities. Keep existing
Ready/title/code/count and synchronization information; place the minimal card
below it, with bounded image size/aspect ratio and usable short-screen layout.
No like/dislike, next, skip, details, voting, filters, or additional metadata.

## Hook and Single-Flight Rules

`use-room-candidate.ts` owns this lifecycle; `state.ts` contains pure
result/presentation/invariant mappings.

1. No accepted room or Waiting means no candidate request and no Image mount.
2. The first current Ready room starts one acquisition. Key the in-flight promise
   by room ID and explicit acquisition attempt; retain it across effect replay.
   Each effect setup subscribes a current-generation completion to that promise.
3. Drive acquisition from stable room ID/state and attempt, not from the changing
   identity of a room-refetch object. An assignment's own room UPDATE, duplicate
   Ready refetch, or channel status change does not start another request.
4. Cleanup invalidates callbacks synchronously. Check room ID, generation, and
   applicable attempt before accepting RPC success/failure or Image callbacks.
   During render, never return metadata owned by an earlier room ID.
5. The first valid available result fixes the metadata anchor even before the
   poster loads. Any optional later revalidation must equal all candidate fields;
   disagreement becomes a recoverable contract failure and never replaces it.
6. Acquisition retry is explicit and single-flight. Without metadata it increments
   request attempt and calls the same RPC. It cannot pick a fixture in the client.
7. With metadata and a poster failure, retry leaves it unchanged, resolves the
   same registry key, and increments only the Image attempt key. It does not call
   an assignment RPC or clear the established metadata.
8. Use stable onLoad/onError callbacks for each room/Image attempt. Ignore events
   from replaced Images. onLoadEnd cannot transition to available.

There is no automatic retry loop, polling, module-level room cache, Redux,
Zustand, or separate candidate Realtime subscription.

## Static Poster Registry

Exactly four entries resolve the keys in [../data-model.md](../data-model.md) to
literal static require sources in `assets/candidates/`. Preserve their native
number/web object source forms; do not manufacture URLs or use dynamic require
strings. React Native Image comes from the existing dependency.

Unknown key means configuration/display failure with the assigned metadata
retained. It cannot substitute a different image, choose a different movie, or
fetch an external fallback. The four original PNGs are versioned alongside the
catalog migration and remain fixed for this feature.

A poster-only retry remounts Image with the same source and a new local key. A
successful retry is proven by actual loading; remounting alone is not evidence.

## Existing Realtime and Continuity

- Guest: committed join_room returns Ready → candidate acquisition immediately.
- Host: existing system-ok/UPDATE invalidation → authorized id/code/state refetch
  reaches Ready → candidate acquisition, with no manual page refresh.
- Assignment UPDATE: existing channel may refetch the same Ready projection;
  no extra candidate request/channel or recursive update is required.
- Reload: existing room/Auth recovery completes first; then the same idempotent
  candidate RPC recovers the persisted assignment.
- Realtime reconnect after display: retain the successful candidate while the
  room's existing synchronization indication/retry operates. Do not clear it.
- Host disconnected in Waiting: on recovery, the existing authoritative room
  convergence supplies Ready; candidate acquisition returns the guest's already
  established assignment.
- A prior candidate-loading failure remains explicitly retryable after recovery.
  Reconnect cannot replace the identity or candidate to avoid a failed operation.

Existing Realtime readiness still requires postgres_changes system-ok and
authoritative refetch; transport SUBSCRIBED is not repurposed as candidate truth.

## Failure Scenarios

| Failure boundary | Required client evidence | Authority after retry |
| --- | --- | --- |
| Neither request reaches server | Both stay Ready; generic error; no successful card | The first successful retry can establish the one candidate |
| Server transaction fails | Generic recoverable error; membership/state unchanged | Failed transaction contributes no assignment |
| Assignment commits but neither response reaches UI | Both show recoverable error; no earlier visible movie is assumed to mean no assignment | Retry returns the already persisted identity/data |
| One participant sees the candidate, other fails | First participant retains card; second retries generically | Second sees the first participant's established candidate |
| Local poster load fails | Same metadata retained, explicit failed display, no successful complete card | Same poster/candidate retries; assignment never changes |
| Late result from prior room or image attempt | No stale display/error or replacement | Current room/attempt alone controls presentation |

## Browser Evidence and C1

React Native Web's visible poster is painted on a wrapper as a background; its
accessibility img can be hidden. Prove all of the following together:

- the poster wrapper is visible, has positive rendered width/height and is in the
  visible layout;
- the background source corresponds to the selected registered local PNG;
- the actual PNG response/load succeeds with positive decoded dimensions;
- current onLoad makes the card available, and title/year match both participants;
- an ID never appears as user-facing movie data.

F08 intercepts the exact resolved bundled PNG in a fresh context before its first
load, fails that request once, then allows the real retry. Require one injected
failure and unchanged candidate ID/title/year/source throughout. Account for
query strings when matching the actual local asset request.

The pinned Expo Metro PNG transformer produces an interceptable file URI in
development and export, including for very small PNGs. F08 asserts an app-origin
HTTP PNG request was actually intercepted; a data/blob source is not a passing
substitute. The read-only transformer evidence is recorded in research.md.

Observe HTTP and WebSocket destinations in memory. Derive the allowed page
origins from the configured local app and public Supabase URLs; normalize HTTP/WS
counterparts. Classify the candidate RPC as local Supabase traffic and every
poster resource as app-origin traffic; fail an external candidate dependency.
Other existing app/Metro/Auth/Realtime traffic retains its established local
origin rules. Do not turn this into a process-wide external-HTTP ban, invent an
external-provider exception, or interfere with the
runner's separate Docker/npm preparation and ephemeral control connection.
Record only safe counts/booleans and fixed labels, never request headers/bodies,
Auth identifiers, tokens, or raw WebSocket frames.

Ordinary no-credential text/attribute assertions must support this image-bearing
UI through a separately named check. Strict diagnostic screenshot eligibility
continues to reject images/backgrounds/SVG. Posters never authorize screenshots,
trace, HAR, video, storage-state exports, or scanner exceptions. Existing C1
controlled static-surface capture and finalized scanning remain mandatory.

## Client and Browser Acceptance Map

Client tests cover parsing, all outcomes, malformed results, all four source
mappings, unknown key, Waiting zero requests, Ready automatic request, effect
replay, stale generations, retained success, response-loss retry, poster failure/
retry, stable callbacks, and no candidate rotation. These isolated client tests
do not replace database/browser evidence.

F01–F08 and every numbered product scenario are mapped with exact signup caps
in [../quickstart.md](../quickstart.md). Native source/rendering tests use the
same registry; primary real-stack acceptance remains the existing web target.
