# Data Model: TMDB Candidate Source

## Authority Summary

- `public.rooms` owns one Feature 006 acquisition terminal and one external TMDB
  movie identity.
- Feature 005 private relations remain the only eligibility source.
- `private.tmdb_movie_genres` translates the approved Feature 004 vocabulary to
  stable TMDB genre IDs; it is reference data, not a movie catalog.
- TMDB owns title, release date/year, poster path and image configuration.
- Client/Edge attempt errors and descriptive metadata are not persisted.

## 1. `public.candidate_acquisition_status`

Closed enum:

| Value | Meaning |
| --- | --- |
| `pending` | No Feature 006 terminal exists. Acquisition is permitted only when Feature 005 is coherently compatible. |
| `assigned` | Exactly one positive `tmdb_movie_id` is authoritative. |
| `no_candidates` | One bounded, error-free search attempt completed every required request/page/shard and observed zero movies passing the exact predicate. No ID exists and no acquisition Retry is allowed; this is not a global TMDB-catalog claim. |

There is no durable `failed` or `acquiring` value. Operational failures remain
retryable overlays while the room stays pending.

## 2. Evolved `public.rooms`

Additive fields:

| Field | Type | Default | Ordinary client SELECT | Meaning |
| --- | --- | --- | --- | --- |
| `candidate_acquisition_status` | `public.candidate_acquisition_status NOT NULL` | `pending` | Granted to authorized members | Safe room-level Feature 006 state |
| `tmdb_movie_id` | `bigint NULL` | NULL | Denied | Stable assigned TMDB movie identity |

Required constraints:

```text
tmdb_movie_id IS NULL OR tmdb_movie_id > 0

candidate_acquisition_status = assigned
  IFF tmdb_movie_id IS NOT NULL

candidate_acquisition_status IN (assigned, no_candidates)
  -> state = ready
  -> voter_count = required_voter_count
  -> filter_completed_count = required_voter_count
  -> filter_resolution_status = compatible
```

Only hardened server operations may mutate either new field. A first terminal
write also updates `updated_at` once. Repeated/losing terminal operations return
the stored terminal with zero writes and unchanged `xmin`/`updated_at`.

`movie_candidate_id` remains the legacy text FK to Feature 002 fixtures. It has
no relationship to `tmdb_movie_id` or the new status and is never read as Feature
006 authority.

### State transitions

```text
pending --(validated eligible TMDB result, terminal CAS wins)--> assigned
pending --(completed-empty attempt, terminal CAS wins)---------> no_candidates

pending --(transport/429/5xx/malformed/incomplete)-------------> pending
assigned ------------------------------------------------------> assigned
no_candidates -------------------------------------------------> no_candidates
```

`assigned -> no_candidates`, `no_candidates -> assigned`, candidate-ID replacement
and terminal -> pending are forbidden through the application boundary.

## 3. `private.tmdb_movie_genres`

Small stable translation relation:

| Field | Type | Rules |
| --- | --- | --- |
| `participant_genre` | `public.participant_genre` | Primary key; every one of the 19 enum values appears exactly once |
| `tmdb_genre_id` | `integer` | Positive and unique |

Canonical rows:

| Feature genre | TMDB ID | Feature genre | TMDB ID |
| --- | ---: | --- | ---: |
| action | 28 | adventure | 12 |
| animation | 16 | comedy | 35 |
| crime | 80 | documentary | 99 |
| drama | 18 | family | 10751 |
| fantasy | 14 | history | 36 |
| horror | 27 | music | 10402 |
| mystery | 9648 | romance | 10749 |
| science_fiction | 878 | tv_movie | 10770 |
| thriller | 53 | war | 10752 |
| western | 37 |  |  |

The table is postgres-owned, RLS-enabled, grant-free for anon/authenticated and
absent from Realtime. A credentialed live-TMDB genre-list contract check detects
upstream mapping drift. Changing mapping requires a reviewed migration; runtime
acquisition does not synchronize it.

## 4. Existing Feature 005 Private Input

No schema change:

```text
private.room_filter_resolutions
  room_id PK/FK
  release_year_from
  release_year_to

private.room_filter_resolution_genre_clauses
  (room_id, clause_ordinal) PK
  genres participant_genre[]
```

Preflight validates the completed handoff contract in one server snapshot:
compatible status, Ready, frozen N/N, exactly one parent, valid inclusive years,
canonical nonempty arrays and contiguous ordinals. It does not reread participant
filters. Duplicate equal clauses remain separate.

## 5. Server-Only Operation Models

### Preflight result

```text
not_found
not_ready
acquire {
  release_year_from,
  release_year_to,
  genre_clauses_tmdb_ids[][]
}
assigned { tmdb_movie_id }
no_candidates
```

Only the Edge server receives `acquire`. Ordinary clients never receive this
shape.

### Assignment commit input

```text
room_id
actor_user_id                 # verified Edge JWT subject
tmdb_movie_id
observed_release_year
observed_tmdb_genre_ids[]
observed_adult
```

The database validates positive/canonical values, explicit adult false, inclusive
year and intersection with every private clause before first assignment. These
values are transient evidence and are not stored.

### Empty commit input

```text
room_id
actor_user_id
```

The database cannot independently observe whether every operation required by
the bounded HTTP attempt completed; the trusted Edge operation calls this only
after its tested completed-empty result. PostgreSQL still reauthorizes,
revalidates the compatible handoff and performs terminal CAS. The stored state
does not claim a snapshot-consistent proof of global TMDB catalog nonexistence.

## 6. TMDB Transport Models (Not Stored)

### Discover movie projection

```text
id: positive integer
adult: boolean
genre_ids: unique/canonicalized positive integer array
title: trimmed nonempty string
release_date: YYYY-MM-DD
poster_path: string | null
```

The strict page parser also validates `page`, `total_pages`, `total_results` and
`results`. Extra upstream fields are ignored. A malformed relevant field makes
the page unusable; it cannot contribute to authoritative empty.

### Details presentation

```text
tmdb_movie_id
title: trimmed nonempty string
release_year: parsed from release_date
poster_path: string | null
```

### Candidate response model

```text
CandidatePresentation {
  tmdbMovieId,
  title,
  releaseYear,
  poster: { kind: url, url } | { kind: none }
}
```

This model is route-generation scoped client state, not a persisted movie record.
The ID keys identity but is never rendered as descriptive content.

## 7. Client State

```text
authoritativeRoomStatus: pending | assigned | no_candidates
attempt:
  inactive | acquiring | acquisition_error |
  loading_metadata | metadata_error | loading_poster | poster_error | available
candidateAnchor:
  null | { tmdbMovieId, title?, releaseYear?, poster? }
room/request/image generations
```

Rules:

- Feature 005 non-compatible -> inactive regardless of candidate pending default.
- compatible + pending -> one automatic Edge request per generation/attempt.
- assigned -> only same-ID metadata recovery; never Discover/replacement.
- no_candidates -> terminal message/new-room action, no Retry.
- acquisition error -> authoritative status stays pending; explicit Retry.
- metadata/poster errors retain any known same-ID fields.
- stale room/request/image callbacks cannot alter the current generation.
- descriptive metadata may change after a later TMDB read if ID is unchanged.

## 8. Realtime Projection

Direct authorized room refetch becomes exactly:

```text
id, code, state, voter_count, required_voter_count,
filter_completed_count, filter_resolution_status,
candidate_acquisition_status
```

It contains neither `tmdb_movie_id` nor private constraint/filters. The existing
`public.rooms` ID-only UPDATE event remains invalidation; canonical Edge recovery
returns assigned identity and metadata.

## 9. Existing-Room Mapping

| Pre-migration room | Post-migration Feature 006 state |
| --- | --- |
| Waiting or filters incomplete | candidate pending; acquisition gated off |
| Feature 005 pending/incompatible | candidate pending; acquisition gated off |
| Feature 005 compatible, no fixture FK | candidate pending; lazy normal acquisition |
| Feature 005 compatible, legacy fixture FK non-null | candidate pending; legacy FK ignored; lazy normal acquisition |
| Any room with fixture FK | fixture value preserved internally and never copied/displayed as TMDB |

No row is backfilled to assigned or no-candidates during migration.

## 10. Feature 007 Handoff

Feature 007 may consume only:

```text
candidate_acquisition_status = assigned
AND tmdb_movie_id IS NOT NULL
```

It receives exactly one authoritative current identity. Feature 006 creates no
decision, swipe, progression, next candidate, queue, agreement or match row.
