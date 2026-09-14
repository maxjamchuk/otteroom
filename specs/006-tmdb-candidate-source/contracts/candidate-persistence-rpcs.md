# Contract: Candidate Persistence Operations

Three postgres-owned `SECURITY DEFINER SET search_path=''` functions in the
public Data API schema are executable only by the Edge server role. Revoke exact
signatures from PUBLIC, anon and authenticated. Every function uses
schema-qualified SQL and reauthorizes `p_actor_user_id` as a room member before
revealing or changing state.

## `prepare_room_tmdb_candidate`

Conceptual signature:

```sql
prepare_room_tmdb_candidate(p_room_id uuid, p_actor_user_id uuid)
```

Closed result: `not_found | not_ready | acquire | assigned | no_candidates`.
Missing/foreign share `not_found`. `not_ready` returns no private data.

`acquire` is returned only when membership is Ready, frozen N/N, Feature 005
status is compatible, candidate status is pending, and the private parent/clauses
pass the Feature 005 handoff integrity checks. It includes private year bounds
and mapped clause arrays only to the trusted Edge caller.

`assigned` returns stored `tmdb_movie_id`. `no_candidates` returns no ID.
Preflight writes nothing and holds no lock during any subsequent HTTP.

## `commit_room_tmdb_candidate`

Conceptual signature:

```sql
commit_room_tmdb_candidate(
  p_room_id uuid,
  p_actor_user_id uuid,
  p_tmdb_movie_id bigint,
  p_release_year smallint,
  p_tmdb_genre_ids integer[],
  p_adult boolean
)
```

Transaction order:

1. Lock only the authorized room row.
2. If already terminal, verify its shape and return that winner with zero write;
   do not validate or expose the losing proposal.
3. Revalidate Ready/frozen N/N/compatible/private-payload coherence.
4. Validate positive ID, canonical genre IDs, `adult=false`, inclusive year and
   intersection with every original clause through the private mapping.
5. Update exactly status=`assigned`, `tmdb_movie_id` and `updated_at`.
6. Return assigned winner.

Any exception rolls back. Direct replacement and same-value repeat UPDATE are
forbidden.

## `commit_room_tmdb_no_candidates`

Conceptual signature:

```sql
commit_room_tmdb_no_candidates(p_room_id uuid, p_actor_user_id uuid)
```

Lock/authorize/terminal-check order matches assignment. From pending it
revalidates the complete compatible handoff, writes exactly
status=`no_candidates`, leaves TMDB ID null and updates `updated_at`. The trusted
Edge caller is responsible for having completed every operation required by one
contracted bounded, error-free search attempt and observed no exact match. This
does not assert global TMDB catalog nonexistence. A terminal winner is returned
unchanged.

## Concurrency guarantees

At READ COMMITTED, concurrent commits serialize on the room. First terminal
writes once; waiters re-read it and perform zero writes. Assignment and empty are
incomparable terminals; neither may reverse the other. An external response that
arrives after either terminal cannot modify it.

Required DB evidence includes exact grants/owner/search path, input shape,
not-found masking, noncompatible no-data/no-write, private handoff validation,
adult/year/genre rejection, all-Any/duplicate/disjoint clause algebra, terminal
CAS races, rollback, write counts, `xmin`/timestamp stability, fixture
non-authority and unchanged Feature 004/005 rows.
