# Contract: Authenticated Edge Candidate Operation

**Function**: `room-candidate`

**Method**: `POST`

**Identity**: Existing Supabase Auth user JWT

**Input authority**: PostgreSQL, never request content

## Request

Exact JSON object:

```json
{ "room_id": "uuid" }
```

Reject extra/missing keys, invalid JSON/UUID and bodies containing constraint,
filter, actor or candidate fields. The verified JWT subject supplies
`actor_user_id`; the body cannot override it.

## Processing order

1. Require/verify a current Supabase user JWT.
2. Strictly parse the one-field body.
3. Call server-only preflight with verified actor and room.
4. Return safe not-found/not-ready/no-candidates terminals immediately.
5. For assigned, skip Discover and read Details for that exact ID.
6. For acquire, perform the exact bounded TMDB algorithm.
7. Commit a candidate or completed-empty result with the server-only CAS function.
8. Adopt the CAS winner. If assigned, read Details/configuration for the winner.
9. Return only the safe response below.

The Edge server client may invoke only the three approved RPC signatures. Direct
admin `.from(...)`, arbitrary SQL/table access and client-visible server keys are
forbidden and statically checked.

## Business responses

Every successful transport response has exactly `outcome` plus its allowed data:

| Outcome | Data | Meaning |
| --- | --- | --- |
| `not_found` | none | Missing or foreign room; indistinguishable |
| `not_ready` | none | Feature 005 handoff is not usable; no TMDB call |
| `available` | `candidate` | Assigned ID with current title/year/poster meaning |
| `no_candidates` | none | Stable completed-empty terminal; no Retry and no global-catalog claim |
| `metadata_unavailable` | none | ID is committed but Details/config cannot currently produce minimum presentation |

`available.candidate` is exactly:

```text
tmdb_movie_id: positive integer
title: trimmed nonempty string
release_year: integer
poster_url: validated https URL | null
```

`poster_url=null` means confirmed no poster. No response includes common years,
genre clauses, voter filters/identities, TMDB token, server credential, upstream
payload/status detail, internal table ID or legacy fixture data.

## Operational errors

Precommit timeout, 429, any 4xx/5xx, malformed response, pagination inconsistency,
single-day overflow, request-budget/deadline exhaustion, any incomplete page or
shard traversal and internal failure return a fixed safe retryable acquisition
failure through a non-success transport response. Raw errors are never forwarded.

If commit may have succeeded but delivery failed, the client still shows safe
Retry. The next request preflights terminal state and cannot Discover a
replacement. Metadata failure returns the business outcome above so Retry
targets Details for the same DB-owned ID.

## Concurrency and stale responses

Edge results are proposals until DB CAS. A losing candidate or empty result is
discarded and replaced by the stored winner in the response. No response may
show a candidate that lost CAS. Function-instance single-flight may reduce work
but is never authority; cross-instance correctness comes only from PostgreSQL.

## Logging

Allowed: fixed operation stage, fixed failure class, duration and safe counts.
Forbidden: Authorization/api-key values, headers/bodies, constraint values,
movie/room/user IDs, URLs containing credentials and raw TMDB/DB responses.
