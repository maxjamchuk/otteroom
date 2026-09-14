# Research: TMDB Candidate Source

**Feature**: 006 `tmdb-candidate-source`

**Research date**: 2026-09-14

**Authority**: Feature specification and current official TMDB documentation

All TMDB claims below use official TMDB sources retrieved on the research date.
Query decomposition, state-machine and repository architecture choices are
design inferences grounded in those sources, not claims made by TMDB.

## Official TMDB Sources

| Topic | Official source |
| --- | --- |
| Application authentication | [Application Authentication](https://developer.themoviedb.org/docs/authentication-application) |
| v3 API | [v3 Getting Started](https://developer.themoviedb.org/reference/getting-started) |
| Discover Movie and filters | [Discover Movie](https://developer.themoviedb.org/reference/discover-movie) |
| Search/list object then Details | [Search & Query For Details](https://developer.themoviedb.org/docs/search-and-query-for-details) |
| Movie Details | [Movie Details](https://developer.themoviedb.org/reference/movie-details) |
| Official movie genres | [Movie Genre List](https://developer.themoviedb.org/reference/genre-movie-list) |
| Pagination/error codes | [Errors](https://developer.themoviedb.org/docs/errors) |
| Rate-limit guidance | [Rate Limiting](https://developer.themoviedb.org/docs/rate-limiting) |
| Language behavior | [Languages](https://developer.themoviedb.org/docs/languages) |
| Image construction | [Image Basics](https://developer.themoviedb.org/docs/image-basics) |
| Poster language fallback | [Image Languages](https://developer.themoviedb.org/docs/image-languages) |
| Image base/sizes | [Configuration Details](https://developer.themoviedb.org/reference/configuration-details) |
| Attribution and branding | [TMDB FAQ](https://developer.themoviedb.org/docs/faq) and [approved Logos & Attribution](https://www.themoviedb.org/about/logos-attribution?language=en-US) |

## Decision 1: v3 Read Endpoints with Application Bearer Authentication

**Decision**: Use TMDB API v3 `GET` endpoints with a server-held API Read Access
Token sent as `Authorization: Bearer <token>`. Use application authentication;
do not implement TMDB user authentication or sessions.

**Rationale**: TMDB documents Bearer as the default v3 application method and
states that the API Read Access Token works across v3 and v4 with equivalent
access. The required Discover, Details, Configuration and Genre List operations
are documented v3 endpoints. A v4 user flow adds no value to read-only Feature
006.

**Alternatives considered**:

- v3 `api_key` query parameter: supported, but more likely to appear in URLs and
  logs than an Authorization header.
- v4 user authentication: rejected; no user-specific TMDB write is required.
- a TMDB wrapper SDK: rejected; platform `fetch` plus strict local parsing keeps
  the boundary small and documentation-aligned.

## Decision 2: Explicit Discover Parameters

**Decision**: Query `GET /3/discover/movie` with explicit:

```text
language=en-US
include_adult=false
include_video=false
sort_by=primary_release_date.asc
primary_release_date.gte=<from>-01-01
primary_release_date.lte=<to>-12-31
page=<1..500>
with_genres=<one OR-only driver clause, when any clause exists>
```

Do not send `region`, `release_date.*`, popularity thresholds, vote thresholds,
provider filters or product-visible ranking controls.

**Rationale**: Discover documents the language/adult/page/date parameters and
warns that `region` changes release-date behavior. Full calendar dates represent
the Feature 005 inclusive years without regional reinterpretation. Explicit
adult/language values make approved semantics independent of API defaults.
`primary_release_date.asc` gives a stable implementation traversal field without
promising recommendation quality or ordering to users.

**Alternatives considered**:

- `primary_release_year`: only one year and cannot express the whole interval.
- `release_date.*` plus region/release types: introduces release semantics not in
  the spec.
- popularity/vote count filters: would silently add eligibility and ranking.

## Decision 3: One Discover Query Cannot Be Trusted for Arbitrary AND-of-OR

**Decision**: Do not encode the complete expression in one mixed-delimiter
`with_genres` string.

**Rationale**: Official Discover documentation says comma-separated values are
AND and pipe-separated values are OR. It documents one string but no
parentheses, grouping grammar or precedence when commas and pipes are mixed.
Therefore a value such as `28|878,18|53` is not a documented exact encoding of
`(Action OR Sci-Fi) AND (Drama OR Thriller)`.

**Alternatives considered**:

- Mixed comma/pipe syntax: rejected because exact grouping is undocumented.
- Literal intersection or union: rejected because either changes Feature 005
  semantics.
- DNF expansion into all genre combinations: exact in principle when each query
  uses documented AND, but unbounded in voter count and combinatorial even with
  19 genres.
- One query per clause with client-side set intersection: exact only after full
  pagination of every clause and makes more calls than the chosen superset.

## Decision 4: Conservative Driver-Clause Overfetch plus Exact Validation

**Decision**: Pick one nonempty clause of minimum cardinality (stable private
tie-break), encode only that clause with pipes, and authoritatively post-filter
every result against all original clauses. Omit `with_genres` for all-Any.

**Rationale**: Any movie satisfying every clause necessarily intersects the
chosen clause, so the Discover response is a conservative superset with no false
negative from genre filtering. The exact validator applies:

```text
from <= releaseYear <= to
AND adult == false
AND for every original clause C: intersection(movieGenreIds, C) is nonempty
```

Duplicate/equal clauses remain in validation. One constrained voter becomes one
OR query. Disjoint voter sets work because a multi-genre movie may pass the
driver and every other clause. Query size is bounded by 19 genre IDs rather than
voter count.

**Alternatives considered**: See Decision 3. This is the smallest exact strategy
that needs no undocumented expression grammar.

## Decision 5: Adaptive Date Partitioning and a Completed-Empty Definition

**Decision**: Treat TMDB pages 1 through 500 as the only documented callable page
space. Start with the whole inclusive date range. When page 1 reports more than
500 pages, bisect the whole-date interval into contiguous nonoverlapping halves
and recurse. Traverse every page of each final shard that reports 500 or fewer;
deduplicate TMDB IDs and validate every result.

**Rationale**: The TMDB Errors guide says pages start at 1 and max at 500, while
official Discover examples can report `total_pages` far above 500. Reading only
the first 500 pages of such a query cannot qualify as a completed attempt. Date
decomposition uses an authoritative existing filter and introduces no popularity/
recommendation criterion.

**Authoritative completed-empty result** means all of the following for one
acquisition attempt:

1. every final date shard reports `total_pages <= 500`;
2. every reported page in every shard returns successfully;
3. page counters/totals and every relevant result parse consistently;
4. every unique observed movie is checked by the full private predicate;
5. no eligible movie is observed; and
6. completion occurs within 100 Discover HTTP attempts and the 20-second
   external-work deadline.

A single-day shard still above 500, catalog/page drift detected through
inconsistent pagination metadata, request/deadline exhaustion, or any failed or
malformed page is `search_incomplete`: PostgreSQL stays pending and the user gets
Retry. It is never terminal empty. These budgets are technical safety limits,
not an admissible ranked subset.

**TMDB limitation and exact guarantee**: The official documentation does not
promise a transactional catalog snapshot or stable pagination during catalog
mutation. Therefore even a successfully completed multi-page traversal cannot
prove that the live TMDB catalog globally contained no eligible movie at one
instant: an item can move across already-read and unread pages without a visible
counter change. One bounded attempt uses a fixed shard/page order, validates
observable page metadata and deduplicates observed IDs, but `no_candidates`
guarantees only that every operation required by that attempt completed without
error and no observed movie passed the exact predicate. A second pass, repeated
totals, deduplication or non-unique sorting would not create snapshot consistency
and is not used to strengthen that claim.

**Alternatives considered**:

- Stop at page 500 and commit empty: rejected because the required attempt is
  incomplete.
- Always split by year/day: exact but does unnecessary calls when the root query
  is already below the cap.
- Persist a multi-request crawler/checkpoint: rejected as a queue/catalog-like
  subsystem beyond the first-candidate slice.
- Unlimited traversal: incompatible with Edge/runtime/rate safety.

## Decision 6: Any Eligible Result, Internal Stable Traversal Only

**Decision**: Traverse date shards oldest-first, pages ascending and results in
TMDB's returned `primary_release_date.asc` order; stop at the first fully eligible
result. Do not promise the order, determinism, randomness or ranking to users.

**Rationale**: The spec accepts any eligible movie and excludes recommendation.
A stable implementation order makes tests and retries easier; committed room
identity, not the precommit choice order, is the product guarantee.

## Decision 7: Discover for Eligibility, Details for Committed Presentation

**Decision**: Discover list objects provide assignment-time ID, adult flag,
genre IDs, release date and a usable title. After the assignment CAS commits,
read `GET /3/movie/{tmdb_movie_id}?language=en-US` for current title, release date
and poster path. Persist no descriptive metadata.

**Rationale**: TMDB documents standard movie list objects with the required
eligibility fields and recommends using returned ID for Details. Calling Details
after commit gives the spec's real post-assignment metadata-failure boundary:
identity remains authoritative even if presentation cannot load. Later reads may
reflect mutable TMDB metadata without making Otteroom a catalog.

**Alternatives considered**:

- Persist title/year/poster path in a local movie table: rejected as canonical
  catalog/snapshot drift.
- Persist room-scoped descriptive snapshot: unnecessary for the approved
  recoverable metadata-error behavior.
- Use only the initial Discover row forever: cannot recover metadata after a lost
  response/re-entry and would freeze mutable data.

## Decision 8: Configuration-Derived Poster URLs

**Decision**: For non-null `poster_path`, obtain `secure_base_url` and supported
poster sizes from `GET /3/configuration`, choose a bounded supported size, and
construct `secure_base_url + size + poster_path`. Configuration may be cached
only in Edge-isolate memory and refreshed after configuration/image failure.

**Rationale**: TMDB officially requires base URL, file size and file path and
directs clients to Configuration for the first two. `poster_path=null` is a valid
no-poster fallback. A later CDN failure is independent presentation degradation.
Image-language behavior may fall back from requested English to original/highest
rated imagery; this does not change the `en-US` title/details contract.

**Alternatives considered**:

- Hard-code `image.tmdb.org/t/p/w500`: official examples show it, but official
  integration guidance says to obtain current base/sizes from Configuration.
- Proxy poster bytes through Edge: adds bandwidth/caching complexity and is not
  required because image CDN URLs contain no credential.

## Decision 9: Failure and Rate-Limit Handling

**Decision**: Classify timeout/transport, 429, 5xx/502/503/504, 4xx
auth/parameter failures, malformed JSON/schema and incomplete pagination as
retryable operational failures before assignment. Use bounded retry/backoff with
jitter; honor `Retry-After` when present but do not depend on it. Every attempt
counts toward the fixed request/deadline budgets.

**Rationale**: TMDB documents 429 and multiple transient 5xx/timeout statuses.
Its rate guide says the legacy 40-per-10-second limit is disabled, describes
protective limits only as roughly 40 requests/second and says they may change.
Therefore no fixed throughput is contractual, and 429 must be respected. TMDB
also states no SLA.

Relevant current official error entries are:

| TMDB status code | HTTP | Documented meaning | Feature 006 classification |
| ---: | ---: | --- | --- |
| 5 | 422 | Invalid parameters | Operational/configuration failure; retryable safe UI |
| 7 | 401 | Invalid API key | Operational/configuration failure; secret never disclosed |
| 9 / 46 | 503 | Service offline / maintenance | Transient upstream failure |
| 11 / 15 / 44 | 500 | Internal/failed/invalid-ID server failure | Upstream or metadata failure by stage |
| 22 | 400 | Invalid page; pages start at 1 and max at 500 | Parser/query failure; never empty |
| 23 | 400 | Invalid date; required format YYYY-MM-DD | Query/configuration failure |
| 24 | 504 | Backend timeout; try again | Transient upstream failure |
| 25 | 429 | Request count over allowed limit | Rate-limited; bounded backoff/Retry |
| 35 | 401 | Invalid token | Operational authentication failure |
| 43 | 502 | Could not connect to backend | Transient upstream failure |

The official rate page says the former 40 requests per 10 seconds limit was
disabled in 2019. It describes current protective upper limits only as somewhere
around 40 requests per second, explicitly warns that the value may change, and
requires respecting 429. The reviewed official pages do not promise a
`Retry-After` header, so it is advisory when present rather than a correctness
dependency.

**Alternatives considered**:

- Hard-code 40 rps: rejected; official guidance says the upper limit can change.
- Persist upstream errors: rejected by privacy and safe-client requirements.
- Convert upstream failure to no-candidates: rejected as false authority.

## Decision 10: Supabase Edge Function Trust Boundary

**Decision**: Add one authenticated `room-candidate` Supabase Edge Function.
Ordinary clients invoke it using the existing Supabase Auth session and send only
`room_id`. The function verifies JWT/user subject, uses a server-held TMDB token,
and invokes three exact server-role-only PostgreSQL functions. Those functions
independently reauthorize the propagated actor and are the only admin-client calls
allowed by application code.

**Rationale**: The repository has Expo plus Supabase Auth/Data API/PostgreSQL and
no standalone backend. The ordinary Data API cannot expose the private handoff;
the client cannot hold a TMDB token; outbound HTTP cannot be atomic with
PostgreSQL. Edge Functions are the existing-platform boundary designed for
authenticated external orchestration and secret environment variables.

**Alternatives considered**:

- Client TMDB calls: rejected; leaks credentials/constraint and lets clients
  substitute eligibility.
- PostgreSQL synchronous HTTP: rejected; risks long transactions and adds an
  unconfigured external extension.
- `pg_net`/cron background worker: avoids a client-held secret but adds an async
  job/response processor and polling/retry subsystem not present in the repo.
- New standalone server: unnecessary.
- Dedicated database login from Edge: narrower credential in theory but adds
  password/pooler provisioning and a second database connection path. The chosen
  server key remains Edge-only and its code/ACL contract permits only the three
  reauthorizing functions; static/security tests reject direct admin table use.

## Decision 11: Terminal Compare-and-Set, No Lease

**Decision**: Persist only `pending | assigned | no_candidates`. Do not persist
`acquiring`, a lease, request ledger or request token. Run preflight, release the
transaction, call TMDB, then terminal-CAS under a room lock.

**Rationale**: Feature 005 compatible input is immutable and Feature 006 permits
only one irreversible terminal. Concurrent callers can do redundant bounded
external reads, but the first valid terminal commit wins and every loser returns
the winner. A request beginning after a terminal performs no Discover. The
absence of a lease removes expiry/takeover and crashed-owner recovery states.

**Alternatives considered**:

- Persisted acquiring lease/version: reduces duplicate external calls but can
  strand rooms after an Edge crash and needs expiry, takeover and clock behavior.
- Hold the room lock across TMDB: rejected for latency, availability and database
  contention.

## Decision 12: Identity-Only Persistence and Existing Realtime

**Decision**: Add room-level candidate status and `tmdb_movie_id`; grant ordinary
room projection access only to status. Keep exactly one `public.rooms` UPDATE
subscription with ID-only invalidation/refetch. Edge returns the candidate ID and
metadata after authorization.

**Rationale**: A terminal room update is sufficient to wake every member. A
missed event is already recovered on system-ok/re-entry. TMDB ID is application
state; descriptive fields are not. A second channel, polling, Presence or
Broadcast adds no authority.

## Decision 13: Mandatory Attribution in Feature 006

**Decision**: Add a reachable About/Credits-type screen now using an approved,
unmodified TMDB logo, a link to TMDB and the exact prominent notice:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

Keep the TMDB logo less prominent than Otteroom and do not imply endorsement.

**Rationale**: The official FAQ requires the logo and notice and says attribution
must be within an About/Credits-type section. This cannot be deferred while using
TMDB data/images. The FAQ permits non-commercial API use with attribution and
directs commercial users to licensing/sales.

**Alternatives considered**:

- Room-card footnote only: does not satisfy the specified About/Credits placement.
- Defer to a later branding feature: would ship noncompliant API use.

## Decision 14: Additive Feature 002 Evolution and Testing Selection

**Decision**: Preserve the fixture table/FK/rows and revoked legacy RPC, but add
a separate TMDB identity/status path. Existing rooms default pending; only
Feature 005 compatible rooms lazily acquire. Select `F=9`, `T=0`; absorb surviving
F02/F04/F07/F08 behavior into J01-J03, G08 and lower-layer tests.

**Rationale**: This preserves historical migrations/test infrastructure without
allowing old fixture state to appear as a production candidate. The obsolete
Feature 002 cases encode the old direct-Ready/fixture/poster path; rerunning them
would assert behavior Feature 006 deliberately replaces.

## Unresolved Research Items

None. Live TMDB pagination has no documented snapshot guarantee. The resolved
product boundary intentionally defines `no_candidates` as a completed, bounded,
error-free attempt with no eligible movie observed, not proof of global catalog
nonexistence at a snapshot.
