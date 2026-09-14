# Contract: Client Candidate Flow

## Ownership

The room route retains existing Auth, canonical entry, Feature 004 filter and
Feature 005 resolution lifecycles. Feature 006 evolves the compatible terminal
to one candidate hook/card. The client never evaluates or stores the private
constraint.

## Trigger and one-flight

- Inactive before exact compatible or for incompatible.
- Compatible+candidate pending automatically starts one Edge invocation for the
  room/request generation.
- Effect replay, duplicate rendering and same-attempt triggers share one promise.
- Acquisition Retry starts one new attempt only after failure.
- Assigned recovery may call Edge, but server preflight cannot Discover.
- No-candidates never calls acquisition again.
- Route/code/identity generation retires old Edge/Image callbacks synchronously.

## Presentation states

| State | UI/action |
| --- | --- |
| Feature 005 pending/incompatible | Existing resolution UI; zero candidate call/card |
| Compatible + acquiring | Accessible “finding movie” status |
| Compatible pending + acquisition error | Safe temporary failure and one Retry |
| Assigned + metadata loading | Accessible loading status; identity not rendered |
| Assigned + metadata error | Safe metadata failure and Retry same candidate |
| Assigned + poster loading | Title/year retained; poster loading region |
| Assigned + poster error | Title/year retained; safe poster failure and poster-only Retry |
| Assigned + poster URL loaded | Title, release year, visible poster |
| Assigned + confirmed no poster | Title, release year, explicit no-poster fallback |
| No-candidates | Stable completed-search/no-eligible-observed message and create-new-room action; no acquisition Retry |
| Integrity conflict | Suppress candidate/empty success and require canonical re-entry |

The card has exactly title, release year and poster/fallback. It contains no ID,
overview, rating, runtime, cast, provider, swipe, next or match control.

## Identity versus mutable metadata

The first accepted `tmdb_movie_id` is the generation's identity anchor and must
equal every later available result. A different ID is integrity failure.
Title/year/poster may refresh on a later canonical TMDB read when ID is unchanged;
they are not an immutable local catalog snapshot. During a poster retry, retain
the current same-ID title/year and retry only image/configuration presentation.

## Failure and recovery

- A precommit Edge failure leaves room candidate status pending and exposes
  acquisition Retry.
- A terminal event/refetch clears a stale local acquisition error.
- If response was lost after commit, Retry receives assigned/no-candidates from
  preflight, never a replacement.
- Reload/reconnect/QR-link-code re-entry first recovers canonical room status,
  then candidate metadata for the stored ID.
- A missed Realtime event is recovered by system-ok refetch.
- Stale success/error/poster callbacks from a retired generation are ignored.

## Privacy/network rules

The service sends only room UUID to the Supabase Edge endpoint. Browser API
traffic must never target `api.themoviedb.org`; only a configuration-derived TMDB
image CDN URL may be visible for poster loading. Client state/logs/diagnostics
contain no TMDB/server credential, constraint, individual filters, upstream raw
payload, foreign assignment or fixture metadata.
