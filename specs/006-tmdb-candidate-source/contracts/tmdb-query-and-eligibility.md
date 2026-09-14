# Contract: TMDB Query and Exact Eligibility

## Authentication and endpoints

All calls originate from the Edge Function over HTTPS with the server-only TMDB
API Read Access Token in `Authorization: Bearer ...`.

| Purpose | v3 endpoint |
| --- | --- |
| Candidate superset | `GET /3/discover/movie` |
| Committed metadata | `GET /3/movie/{tmdb_movie_id}` |
| Poster base/sizes | `GET /3/configuration` |
| Mapping validation only | `GET /3/genre/movie/list` |

No client receives the token or makes catalog API calls.

## Discover request

Required fixed parameters:

```text
language=en-US
include_adult=false
include_video=false
sort_by=primary_release_date.asc
primary_release_date.gte=<inclusive from>-01-01
primary_release_date.lte=<inclusive to>-12-31
page=<integer 1..500>
```

Do not specify `region`. When at least one clause exists, choose one
smallest-cardinality clause and send only its mapped IDs joined by `|` as
`with_genres`. For zero clauses omit `with_genres`. Never mix `,` and `|`, send
the union of all clauses, or DNF-expand them.

No popularity, rating, vote count, provider, certification, runtime or
recommendation filter is permitted.

## Exact validator

The Edge validator and database assignment operation apply the same predicate:

```text
movie.id > 0
AND movie.adult = false
AND from <= year(movie.release_date) <= to
AND every original clause intersects movie.genre_ids
```

The empty clause list is true. Duplicate equal clauses remain represented.
Relevant response fields must parse before the page can support assignment or
empty. IDs are deduplicated only for repeated evaluation, not to alter clauses.

## Page decomposition

1. Request page 1 for the current date shard.
2. If `total_pages <= 500`, validate page 1 and every page through
   `total_pages`.
3. If `total_pages > 500`, do not treat the parent shard as searched; bisect the
   whole-date interval without overlap/gap and recurse.
4. If a single-day shard remains above 500, stop as `search_incomplete`.
5. Stop successfully on the first exact match.

Traverse shards oldest-first, pages ascending and results in returned order.
This is an internal technique only and creates no product ordering/ranking
promise.

Terminal zero is permitted only after one attempt completes every final shard and
every reported page with no observed exact match within both 100 Discover HTTP
attempts and the 20-second external-work deadline. Any early budget stop,
inconsistent page metadata, malformed payload, transport failure, non-success
HTTP response or otherwise incomplete page/shard traversal is `search_incomplete`,
not zero.

TMDB documents no snapshot-consistency guarantee for pagination. Consequently,
`no_candidates` means only that this bounded attempt completed every operation
required by the algorithm without error and observed no eligible movie; it does
not mean TMDB globally contained no eligible movie at one snapshot. Fixed
traversal order, deduplication and observable metadata checks do not strengthen
the result into such a global proof.

## Selection and metadata

The first match in internal traversal may be proposed; order has no product
meaning. After DB commit, call Details with `language=en-US` for the committed
ID. A Details response cannot rotate the ID. A later eligibility-field change
does not reopen filters in Feature 006.

For non-null poster path, use current Configuration `secure_base_url` and a
reported supported bounded poster size. Null is explicit no-poster. Edge-isolate
configuration caching is allowed; persistent configuration/movie caching is not.

## Retry rules

Bounded internal retries may handle 429/5xx/transport failure with capped
exponential backoff and jitter. Honor `Retry-After` if present; correctness must
not depend on it. Every attempt counts against the request/deadline budget.
Exhaustion returns a fixed safe retryable class and leaves DB pending.
