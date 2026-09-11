# Contract: Client Common-Resolution Flow

## Route and feature ownership

`app/room/[code].tsx` keeps Feature 003 canonical entry/recovery and the existing
Feature 004 filter surface. Add a focused Feature 005 boundary:

```text
src/resolution/contracts.ts
src/resolution/service.ts
src/resolution/state.ts
src/resolution/use-common-filter-resolution.ts
src/resolution/common-filter-resolution-panel.tsx
```

No new state, form, navigation or networking library is required. The route
imports no candidate hook/card and no resolution code references TMDB.

## Canonical client model

```text
roomId + route/request generation
authoritative X/N + pending|compatible|incompatible
attempt: inactive | resolving | error | integrity-error
message: safe transient text | null
```

Status changes only from an exact accepted create/join/refetch/resolver result.
The model contains no years, genre clauses, individual filter payload, candidate
or locally calculated compatibility. `error` is an attempt overlay while the
authoritative status remains pending; it is never converted to incompatible.

## Automatic trigger and one-flight

The hook is inactive below N/N or after terminal status. At exact N/N+pending it
automatically begins one resolver call without another voter action. React effect
replay, duplicate renders and overlapping triggers share the same promise for a
room/request generation. Retry starts one new attempt only after failure.

Every route/code change increments generation and retires callbacks before the
old async cleanup. A stale pending/terminal/error result from room A cannot appear
in room B or a later room-A generation. The service sends only the room UUID,
awaits the existing anonymous Auth bootstrap and strictly parses the two-field
RPC result.

## Rendering

1. Waiting or Ready X<N: retain Feature 004 input/progress behavior. Resolution
   is inactive and no resolution control is shown.
2. N/N+pending resolving: every role sees an accessible resolving status. Filter
   controls remain frozen. A voter may retain their own accepted read-only detail.
3. N/N+pending error: show an understandable temporary failure and one Retry
   control. Do not label filters incompatible and do not re-enable editing.
4. Compatible: show status and that movie candidate sourcing is the future next
   step. Show no common years/genres/clauses and no movie/candidate control.
5. Incompatible: show terminal incompatibility and an action/link to the existing
   new-room creation flow. Do not mutate this room, reset filters or offer editing.
6. Integrity error over any status: hide compatible/incompatible next-step meaning,
   suppress candidate readiness, show a safe verification failure and require a
   full canonical room reload/re-entry to establish a new route generation.

The next-action wording may be localized, but its meaning and accessible status
must match the authoritative state. No UI contains member/Auth/filter-row IDs,
a roster, clause count, another voter's details or raw error.

## State transitions and stale results

```text
inactive --(N/N pending)--> resolving
resolving --(pending)-----> error over authoritative pending
resolving --(compatible)--> terminal compatible
resolving --(incompatible)-> terminal incompatible
resolving --(exception)---> error over authoritative pending
error --(Retry)-----------> resolving
error --(room terminal)---> matching terminal
any --(terminal conflict)-> integrity-error (generation terminal/fail closed)
```

Because the normal hook calls only from authoritative local N/N, a server
`pending` response ends that attempt as a retryable error. It does not reinvoke
automatically. Only explicit Retry or a fresh route generation starts another
call; a terminal room update may still clear the error. This prevents an
identical pending refetch from causing an effect loop.

Terminal states do not call again. A delayed pending result cannot regress a
terminal room watermark. A different terminal result sets `integrity-error`,
preserves no candidate-ready/next-action presentation and cannot be cleared by
another response in the same generation. Full reload/re-entry obtains a fresh
join projection and generation. A room synchronization failure preserves last
accepted status and has its existing separate Retry; resolution Retry never
clears or replaces the room/filter recovery state.

## Recovery

- Reload/link/QR/code same-identity entry receives stored status through join.
- If stored status is pending N/N, the hook runs the same resolver; if terminal,
  it renders without a write.
- Reconnect/system-ok refetch recovers a missed terminal room UPDATE.
- Lost resolver response is recovered by room refetch or repeated RPC, which is
  a server no-op after commit.
- A local failed request may coexist briefly with another client's success; the
  authoritative terminal update clears the local error.
- Disconnecting any voter changes neither fixed input nor eligibility.

## Privacy and candidate suppression

A non-voting creator uses the same status hook but never initiates a Feature 004
detail request or receives detail. A voter continues to receive only their own accepted filter
through the separate existing RPC. The resolution transport and state store only
status. Client tests inspect no hidden payload as a feature behavior.

At N/N, evolve `ParticipantFilterForm` rather than removing it: it renders shared
progress plus the voter's own accepted read-only summary or own-detail recovery
control, but removes “Feature 005 is next.” `CommonFilterResolutionPanel` renders
the only resolving/error/terminal copy beside that summary. A non-voting creator
gets progress plus the same resolution panel and no detail request.

All states assert zero candidate RPC, TMDB request, fixture assignment, movie
metadata/card, swipe, progression or match UI. Compatible is only a textual
handoff meaning until Feature 006 deliberately consumes the private constraint.

## Evidence

Unit/integration tests cover exact result parsing/nullability, service argument,
one-flight/effect replay, Retry, pending response, both terminals, error distinction,
terminal dominance, conflicting terminals, stale room generations, room-sync
interaction, non-voter behavior, own-detail preservation, inaccessible details,
new-room navigation and zero candidate/TMDB imports/calls/rendering. Browser
I01-I03 prove the representative real-stack flow; static text alone is not enough.
