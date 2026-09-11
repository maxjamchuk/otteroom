# Contract: Feature 005 → Feature 006 Filter Handoff

**Visibility**: Server-only PostgreSQL application boundary.
**Producer**: Feature 005 resolver.
**Consumer**: A future Feature 006 hardened candidate-source operation.

This contract defines the prerequisite data and meaning. It does not implement
a Feature 006 function, TMDB request, candidate query, movie assignment or UI.

## Eligibility gate

Feature 006 may consume a room constraint only when all are true in one coherent
server snapshot/transaction:

1. the room's authoritative `filter_resolution_status` is `compatible`;
2. membership is Ready and Feature 004 X=N remains frozen;
3. exactly one valid private resolution parent exists for that room; and
4. its clause rows have exact canonical values and contiguous ordinals.

For Feature 006, “exact canonical” means structural validation of the persisted
payload itself: valid inclusive parent years, one-dimensional nonempty arrays
whose enum values are unique and enum-ordered, and contiguous clause ordinals.
Feature 006 trusts the
resolver-established correspondence to the frozen sources and must not reread
individual filters to re-prove it.

Pending, incompatible, missing, unauthorized or integrity-invalid rooms yield no
handoff. Incompatible is not an empty/unfiltered request. Operational failure is
pending, not permission to source candidates.

## Logical payload

```text
ResolvedCommonConstraint {
  releaseYear: [inclusiveFrom, inclusiveTo]
  genreClauses: [
    [genreA OR genreB ...],
    [genreC OR genreD ...],
    ...
  ]
}
```

The persisted source is:

- `private.room_filter_resolutions.release_year_from/release_year_to`;
- `private.room_filter_resolution_genre_clauses.genres`, ordered by
  `clause_ordinal`.

Each clause is nonempty. The list may be empty, meaning no genre restriction.
It may contain duplicate equal clauses because equal preferences from different
voters are represented separately. It contains no room member, Auth user or
participant-filter identifier in the logical payload.

## Candidate predicate

For a future movie with release year `Y` and genre set `G`, the constraint means:

```text
inclusiveFrom <= Y <= inclusiveTo
AND for every clause C: intersection(G, C) is nonempty
```

The universal condition over zero clauses is true. A future candidate must pass
every clause. Implementations must not replace this with:

- literal intersection of all voter genre selections;
- one union matched once;
- an all-genres requirement within a clause;
- omission/deduplication that silently removes a voter's clause; or
- a fallback that broadens years or genres.

## Authority and privacy

Feature 006 must consume the persisted compatible result, not recompute from
`participant_filters` or accept a client-supplied constraint. Its future public
operation must remain hardened and return only Feature 006-approved candidate
data, never this private payload or its source identities.

No authenticated participant receives direct private-schema grants. A future
server consumer may use a postgres-owned definer boundary only for its approved
operation; this contract does not authorize a service-role secret in the client.

## Stability and errors

The payload is immutable for the room because Feature 004 filters are frozen and
Feature 005 terminal status has no reversal/reset. Feature 006 may rely on stable
years and clause rows across retries, reloads and concurrent sourcing attempts.

If status/payload invariants disagree, the future consumer must fail closed. It
must not repair the result, query individual filters as fallback, treat it as
incompatible, or source a candidate. Catalog search returning zero movies is a
Feature 006 acquisition outcome and does not mutate the Feature 005 compatible
result.

## Explicit exclusions

This handoff chooses no TMDB endpoint, authentication, mapping table, query
encoding, post-filter algorithm, pagination, caching, rate-limit strategy,
ranking, candidate persistence, metadata display or empty-catalog UX. Those
require Feature 006 specification/planning.
