# Contract: Feature 006 Candidate Source with Progression Sequencing

**Feature**: 008 — Candidate Progression
**Status**: Approved contract for the planned evolution of the existing
`room-candidate` boundary; no new candidate endpoint or source is implemented.

## Public Edge Request

The request remains exactly:

```text
POST /functions/v1/room-candidate
Authorization: Bearer <current anonymous user JWT>
Content-Type: application/json

{ "room_id": "<uuid>" }
```

No client-supplied candidate sequence, exclusion list, filter, TMDB ID, actor ID
or proposal is accepted. The Edge Function verifies the JWT as Feature 006 does
and passes the verified actor UUID only to service-role RPCs.

## Server-Only Preflight RPC

Evolve:

```text
public.prepare_room_tmdb_candidate(
  p_room_id uuid,
  p_actor_user_id uuid
)
```

Execution remains revoked from `public`, `anon` and `authenticated` and granted
only to `service_role`.

Prepare and both commit RPCs use one authorization/locking protocol:

1. validate argument shape and perform an unlocked actor/room membership lookup;
2. return masked `not_found` for a missing/unauthorized actor before attempting a
   room-row lock, so a foreign caller never joins that room's lock queue;
3. lock only the positively authorized `public.rooms` row `FOR UPDATE`; and
4. under that lock, revalidate authorization plus the applicable assembled,
   frozen-filter, progression, occurrence and candidate-handoff facts before
   returning private preflight data or applying a commit.

Authorization loss between the two checks returns the same masked protected
outcome with no write. No alternative lock-before-authorization path is allowed.

Exact result fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `outcome` | text | Branch below |
| `candidate_sequence` | integer nullable | Current/last authoritative ordinal |
| `candidate_progression_status` | `candidate_progression_status` nullable | Canonical room progression phase |
| `tmdb_movie_id` | bigint nullable | Current assigned identity for metadata only |
| `release_year_from` | smallint nullable | Frozen private constraint |
| `release_year_to` | smallint nullable | Frozen private constraint |
| `genre_clauses_tmdb_ids` | JSONB nullable | Existing exact AND-of-OR TMDB clauses |
| `excluded_tmdb_movie_ids` | JSONB nullable | Positive IDs from all room occurrences, ordered by sequence |

Outcomes:

| Outcome | State | Non-null fields |
| --- | --- | --- |
| `not_found` | Missing room or unauthorized actor | none |
| `not_ready` | Room/filter/progression state cannot acquire or present | none |
| `assigned` | Current occurrence is collecting or agreed | sequence, progression status, TMDB ID |
| `acquire` | Initial pending at sequence 0 or advancing at sequence `k` | sequence, progression status, frozen constraint, exclusions |
| `no_candidates` | Original Feature 006 empty terminal | sequence = 0, progression `inactive` |
| `exhausted` | Feature 008 no-further-candidate terminal | last sequence >=1, progression `exhausted` |

For `acquire`, preflight verifies inherited authorization, assembled fixed
membership, frozen completed filters, compatible private resolution and the
existing `valid_tmdb_candidate_handoff`. For an advancing room it also verifies
that the occurrence at `candidate_sequence` is rejected. Exclusions are
server-derived; an empty list is valid.

Preflight is read-only after the short locked validation snapshot. Its sequence
is an optimistic token; the lock is released before Edge/TMDB work, and only a
later commit that repeats the same protocol may establish authority.

## Search Contract Evolution

The existing `searchTmdbCandidate` receives one additional dependency/input:
a readonly set/list of excluded positive TMDB IDs produced by preflight.

Behavior remains:

- exact frozen inclusive year range;
- exact AND-of-OR genre semantics;
- `en-US` provider contract;
- adult content excluded;
- deterministic date-shard/page/result traversal;
- response and pagination integrity checks;
- local duplicate suppression;
- existing bounded retries/backoff, default 100 requests and 20-second deadline;
- first eligible non-excluded result is a `match`;
- incomplete, malformed, rate-limited, budget/deadline and provider failures are
  `search_incomplete`; and
- `completed_empty` requires complete error-free traversal after filtering both
  local duplicates and the room exclusions.

An excluded movie is skipped as a source result. It is never exposed as a new
room occurrence. The search algorithm does not promise a participant-visible
deck position or ranking.

## Server-Only Candidate Commit RPC

Evolve:

```text
public.commit_room_tmdb_candidate(
  p_room_id uuid,
  p_actor_user_id uuid,
  p_expected_candidate_sequence integer,
  p_tmdb_movie_id bigint,
  p_release_year smallint,
  p_tmdb_genre_ids integer[],
  p_adult boolean
)
```

The function retains every Feature 006 evidence validation. It performs the
unlocked authorization precheck, locks only that authorized room row, revalidates
the actor and frozen handoff under the lock, and then applies one of:

| Locked state | Result |
| --- | --- |
| `inactive/pending`, room sequence 0, expected 0 | Insert occurrence 1 collecting; install candidate; return `assigned` sequence 1 |
| `advancing`, room sequence `k`, expected `k` | Require proposal not in occurrence history; insert exact occurrence `k+1`; install it collecting at count 0; return `assigned` |
| Same expected step already has assigned successor `k+1` | Return that winner as `assigned`; zero writes |
| Same expected step already became exhausted/initial-empty | Return `exhausted` or `no_candidates`; zero writes |
| Room is agreed without being the exact ordinal `expected+1` winner, or has moved beyond that winner | Return `refresh_required`; zero writes |
| Missing/unauthorized/invalid room phase | `not_found` or `not_ready`; zero writes |

Insert and room update are one transaction. The proposal is not rendered or
returned before this commit succeeds. Unique room/sequence and room/TMDB indexes
are final backstops against a second successor or repeat.

The exact commit result includes `outcome`, canonical `candidate_sequence`,
canonical `candidate_progression_status` and nullable `tmdb_movie_id`. Protected
`not_found`/`not_ready` results return the latter fields null.

## Server-Only Empty Commit RPC

Evolve:

```text
public.commit_room_tmdb_no_candidates(
  p_room_id uuid,
  p_actor_user_id uuid,
  p_expected_candidate_sequence integer
)
```

This RPC may be called only for `completed_empty`, never for
`search_incomplete`.

It uses the same unlocked authorization precheck, authorized-room lock and
under-lock authorization/handoff revalidation protocol as candidate commit.

| Locked state | Result |
| --- | --- |
| `inactive/pending`, sequence 0, expected 0 | Set acquisition `no_candidates`, keep progression `inactive`; return `no_candidates` |
| `advancing`, sequence `k`, expected `k` | Set progression `exhausted`, acquisition `no_candidates`; return `exhausted` at `k` |
| Same expected step already has assigned successor `k+1` | Return that winner as `assigned`; zero writes |
| Same expected step already exhausted/initial-empty | Return existing terminal; zero writes |
| Agreed without being the exact ordinal `expected+1` winner, or newer unrelated step | Return `refresh_required`; zero writes |
| Missing/unauthorized/invalid room phase | `not_found` or `not_ready`; zero writes |

An exhaustion commit creates no occurrence and does not increment sequence.

## Public Edge Responses

Successful HTTP 200 bodies are strict discriminated unions:

```text
available:
  { outcome, candidate_sequence, candidate_progression_status,
    candidate: { tmdb_movie_id, title, release_year, poster_url } }

metadata_unavailable:
  { outcome, candidate_sequence, candidate_progression_status }

not_found | not_ready | no_candidates | refresh_required:
  { outcome }

exhausted:
  { outcome, candidate_sequence, candidate_progression_status: exhausted }
```

`available` is returned only for a database-confirmed assigned identity. If a
competing proposal won, metadata is loaded for the winner, never the losing
proposal.

An Edge response is authoritative only for its database-confirmed candidate
metadata. It is not a complete room projection, carries no decision count, and
MUST NOT cause a client to install progression state or assume `0/N`. Every
successful candidate/terminal response triggers member-scoped canonical room
refetch; metadata is rendered only if that projection still permits the same
sequence as collecting/agreed.

`metadata_unavailable` means the identity/sequence is already authoritative;
retry performs preflight and reloads metadata for that same identity. It does
not resume Discover.

`refresh_required` tells the client to run canonical room refetch. It does not
implicitly continue a newer progression step from an old request.

Feature 006's fixed safe HTTP errors remain:

- 204 for OPTIONS;
- 400 invalid request;
- 401 authentication required;
- 405 wrong method; and
- 503 `candidate_acquisition_unavailable` for incomplete search, RPC failure or
  internal provider/orchestration failure.

No 503 path commits exhaustion or a speculative candidate.

## Concurrency Matrix

| Overlap | Winner | Loser behavior | Durable result |
| --- | --- | --- | --- |
| Proposal A vs proposal B for expected `k` | First room locker inserts `k+1` | Returns installed winner or refresh if room already moved again | One occurrence at `k+1` |
| Proposal vs completed empty for expected `k` | First room locker | Other returns assigned winner or exhausted terminal | Exactly one branch |
| Same proposal retry after lost response | Existing assignment | Return same winner | No extra occurrence |
| Empty retry after lost response | Existing terminal | Return same terminal | No extra state change |
| Late result after agreement | Agreement | Return the exact same-step agreed winner only when it is ordinal `expected+1`; otherwise `refresh_required` | Agreed candidate unchanged; no new identity |
| Late result after newer sequence | Newer state | `refresh_required` | No hidden/skipped occurrence |

## Realtime Interaction

Candidate commit/exhaustion updates `public.rooms.updated_at` in the same
transaction. The existing room publication emits the invalidation; participants
refetch safe progression status/sequence. Occurrence history is never published.

The initiating client may cache strictly parsed metadata immediately, but it may
not mutate authoritative room status/count from the Edge response. It refetches
the canonical room projection and applies the complete monotonic merge lattice
before rendering. If the successor has already received decisions, its refetched
count is retained; if it is already advancing/exhausted/agreed or a later
sequence is current, the delayed metadata is used only where that canonical
generation still permits it or otherwise discarded. Realtime loss is harmless
because reload/re-entry uses the same refetch and the next preflight recovers the
installed identity or terminal.

## Source Failure UI Boundary

- Room remains durably `advancing`.
- No current decision target exists.
- The failed caller shows an actionable generic Retry; raw provider details are
  neither rendered nor persisted.
- Other/reloaded clients infer the same recoverable advancing meaning and may
  safely issue the same Edge request.
- A later success installs one successor; a later complete-empty result installs
  exhaustion; neither increments more than once.

## No Alternate Source or Match Behavior

The Edge Function never falls back to fixture candidates, broadens the frozen
constraint, changes locale/adult rules, calls a second provider, creates a match
record, or navigates the client. Agreement bypasses Discover entirely.
