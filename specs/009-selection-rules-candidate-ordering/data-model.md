# Data Model: Selection Rules and Candidate Ordering

**Feature**: 009 — Selection Rules and Candidate Ordering  
**Date**: 2026-09-20

## Authority Summary

| State | Authority | Visibility |
| --- | --- | --- |
| Running server configuration | Frozen Deno module value | Server process only |
| Room rule snapshot | `private.room_selection_rules` | PostgreSQL server operations only |
| Participant filters | Existing `public.participant_filters` | Own-filter RPC only |
| Compiled common predicate | Existing private resolution tables | Resolver/source RPCs only |
| Candidate and occurrence sequence | Existing `public.rooms` + protected occurrences | Existing safe projection plus protected internals |
| Decisions and agreement outcome | Existing protected decisions/occurrences + room projection | Own decision and safe aggregates only |

## ServerSelectionConfiguration (non-persisted)

Normalized immutable object created once at server module initialization from the
bundled bytes of canonical `config/selection-rules.yaml`.

| Field | Type | Validation/default |
| --- | --- | --- |
| `ordering` | `vote_count_desc | average_rating_desc | popularity_desc | title_asc` | Omitted -> `vote_count_desc` |
| `minimumVoteCount` | non-negative safe integer | Required; initial canonical value `500`, not a product constant |
| `minimumAverageRating` | number or null | Initially omitted -> null; otherwise finite, `0 <= value <= 10`; explicit YAML null invalid |
| `metadataLanguage` | canonical TMDB primary-translation tag | Required; initial canonical value `en-US`, not a product constant |
| `genreMode` | `or | and` | Omitted -> `or` |
| `agreementNumerator` | positive integer | Parsed from exact `p/q`; normalized by GCD |
| `agreementDenominator` | positive integer | Omitted fraction -> exact `2/3`; `p <= q`; normalized pair fits signed int32 |
| `ruleSetKind` | `configured_009_v1` | Constant, never supplied by operator |

The raw YAML text and parsed document are never logged, persisted or returned.
Editing the repository file does not mutate this object; a successful build/deploy
and process restart constructs a new object from the newly bundled canonical bytes.
There is no environment override, request-time read, watcher or runtime service.

## `private.room_selection_rules`

Exactly one immutable row per `public.rooms` row.

| Column | Planned PostgreSQL type | Rules |
| --- | --- | --- |
| `room_id` | `uuid` | PK; FK to `public.rooms(id)` with delete cascade |
| `rule_set_kind` | constrained `text` or private enum | `legacy_005_006_008` or `configured_009_v1` |
| `candidate_ordering` | constrained `text` | `legacy_source_order` only for legacy; otherwise one of four configured values |
| `minimum_vote_count` | `bigint null` | Null only for legacy; configured is `>= 0` and JS-safe at creation |
| `minimum_average_rating` | `numeric null` | Null means no cutoff; configured non-null is in inclusive `0..10`; legacy null |
| `metadata_language` | `text` | Legacy exactly `en-US`; configured canonical supported tag |
| `genre_mode` | constrained `text` | `or` or `and`; legacy exactly `or` |
| `agreement_numerator` | `integer` | Positive; legacy `2`; configured normalized |
| `agreement_denominator` | `integer` | Positive; legacy `3`; numerator <= denominator; configured normalized |
| `created_at` | `timestamptz` | Transaction timestamp; application never updates it |

### Row checks

`legacy_005_006_008` requires one exact tuple:

```text
candidate_ordering = legacy_source_order
minimum_vote_count IS NULL
minimum_average_rating IS NULL
metadata_language = en-US
genre_mode = or
agreement_numerator = 2
agreement_denominator = 3
```

`configured_009_v1` requires:

```text
candidate_ordering IN the four approved configured values
minimum_vote_count IS NOT NULL AND minimum_vote_count >= 0
minimum_average_rating IS NULL OR 0 <= value <= 10
metadata_language is canonical and accepted by the service-side supported-tag contract
genre_mode IN (or, and)
0 < numerator <= denominator
gcd(numerator, denominator) = 1
```

The database repeats closed enum/range/normalization checks. The Edge parser owns the
official language allow-list; the service-only creation function also validates the
canonical language shape and receives only a parser-normalized value. Contract-vector
tests exercise both boundaries with the same accepted/rejected fixtures.

### Immutability and privacy

- postgres owns the table; RLS is enabled;
- PUBLIC, `anon`, `authenticated` and ordinary direct `service_role` table access are
  revoked unless an exact server function requires it through ownership;
- no client policy, update/delete function, column grant or Realtime publication;
- only migration backfill and the service-only creation function insert rows; and
- every consumer requires exactly one coherent row. Missing data fails closed.

## Existing Genre Resolution Entities

No column change is required for:

- `private.room_filter_resolutions`; or
- `private.room_filter_resolution_genre_clauses`.

The clause semantics are generalized while retaining one canonical predicate:

| Room mode | Frozen voter genres | Compiled clauses |
| --- | --- | --- |
| `or` | empty | none |
| `or` | `[a,b]` | one clause `[a,b]` |
| `and` | empty | none |
| `and` | `[a,b]` | two clauses `[a]`, `[b]` |

Clauses from all fixed voters are concatenated in deterministic order. Candidate
genre IDs satisfy the predicate iff every clause overlaps the candidate set. This is
equivalent to the required within-voter mode and AND across voters.

The handoff validator recomputes expected years and clauses from:

```text
room fixed voter membership
  + each voter's frozen participant_filters row
  + room_selection_rules.genre_mode
```

It compares that result to the materialized private resolution. A non-voting creator
never contributes; duplicate equal predicates may remain separate because their
boolean meaning is unchanged and they preserve one contribution per voter.

## CandidateConstraint (private Edge value)

| Field | Meaning |
| --- | --- |
| `ruleSetKind` | Legacy/configured behavior discriminator |
| `releaseYearFrom/To` | Existing inclusive common interval |
| `clauses` | Canonical anonymous AND-of-OR TMDB genre IDs |
| `ordering` | Legacy or one configured comparator |
| `minimumVoteCount` | Null only for legacy |
| `minimumAverageRating` | Optional configured cutoff |
| `metadataLanguage` | Room-retained Details/Discover language |
| `agreement` | Not included; source does not consume it |
| `excludedTmdbMovieIds` | Existing complete occurrence history ordered by sequence |

The public request supplies none of these fields. Preflight derives all of them from
protected database state.

## TmdbMovieEvidence (transient)

Provider result normalized for one attempt; it is not persisted as catalog data.
Metric fields are conditionally required from the retained cutoff/comparator, not
unconditionally required merely because TMDB returned the result.

| Field | Validation/use |
| --- | --- |
| `id` | Positive safe integer; candidate identity |
| `adult` | Boolean and must be false |
| `genreIds` | Canonical unique known TMDB movie genre IDs |
| `title` | Nonblank configured-language title; title comparator/presentation |
| `releaseDate` | Valid date; year inside retained range |
| `posterPath` | Existing safe null/path validation |
| `voteCount` | Non-negative safe integer when minimum vote count or vote-count ordering applies; otherwise omitted/ignored |
| `voteAverage` | Finite number in `0..10` when minimum rating or average-rating ordering applies; otherwise omitted/ignored |
| `popularity` | Finite non-negative number when popularity ordering applies; otherwise omitted/ignored |

For each metric, missing/malformed required evidence makes the page/attempt incomplete;
missing/malformed irrelevant evidence does not invalidate the candidate or search.
Commit receives only identity plus transient eligibility evidence needed for database
revalidation: vote count when its cutoff applies and vote average when its cutoff
applies. Comparator-only evidence stays in Edge. Title/popularity are not stored;
global order is proven by Edge traversal tests and cannot be inferred from one row.

## AgreementPolicy (derived from snapshot)

Inputs:

- fixed `public.rooms.required_voter_count = N`;
- snapshot numerator `p`; and
- snapshot denominator `q`.

Derived threshold:

```text
N = 2  -> 2
N >= 3 -> ((N::bigint * p::bigint) + q::bigint - 1) / q::bigint
```

The decision transaction still requires accepted occurrence decisions = `N` before
counting yes rows and comparing them to the threshold. The safe RPC result contains
the derived integer only.

## Relationships

```text
public.rooms 1 ─── 1 private.room_selection_rules
      │
      ├── * public.room_members 1 ─── 0..1 public.participant_filters
      │                                  │
      │                                  └── resolver + genre_mode
      │                                       -> private common years/clauses
      │
      └── * public.room_candidate_occurrences
             └── * public.candidate_decisions
```

No participant/member identity is added to the resolved predicate or source handoff.

## State Transitions

### Configuration and creation

```text
process absent
  -> load + parse valid bundled canonical YAML -> running(frozen configuration)
  -> missing/malformed/invalid YAML -> startup failure (serves no handler)

running(configuration A)
  -> create new request -> room + creator member + configured A snapshot
  -> duplicate request -> return existing room/snapshot unchanged
  -> repository edit without rebuild/redeploy/restart -> still A
  -> successful rebuild/redeploy/restart(configuration B) -> new rooms use B; old rooms keep A
```

### Migration

```text
pre-009 room without snapshot
  -> one migration transaction
  -> same room/application state + explicit legacy snapshot
```

No normal post-migration state permits a missing snapshot.

### Candidate selection

Feature 008 states and transitions remain authoritative:

```text
inactive/pending or advancing/pending
  -> prepare(snapshot + predicate + exclusions + expected sequence)
  -> bounded search outside transaction
       match -> locked expected-sequence candidate commit
       completed_empty -> locked expected-sequence empty commit
       search_incomplete -> no write; same state is retryable
```

Committed assignment is never rotated by config changes, ordering recalculation,
metadata failure or stale results.

### Agreement

```text
collecting with count < N -> remain collecting
collecting + final accepted decision -> count = N
  -> exact threshold from same room snapshot
  -> yes >= threshold -> agreed (terminal; candidate retained)
  -> yes < threshold -> rejected occurrence + advancing room
```

No transition occurs early, even if the outcome is already inevitable or impossible.

## Migration Preservation Matrix

The nonempty runner seeds and verifies at least:

| Existing state | Added rule state | Existing data mutation allowed |
| --- | --- | --- |
| Waiting / assembled | Explicit legacy | None |
| Partial/frozen filters | Explicit legacy | None |
| Pending/compatible/incompatible resolution | Explicit legacy | None |
| Initial no-candidates | Explicit legacy | None |
| Collecting with partial decisions | Explicit legacy | None |
| Advancing with occurrence history | Explicit legacy | None |
| Agreed with complete decisions | Explicit legacy | None |
| Exhausted | Explicit legacy | None |

The runner proves values/timestamps and applicable `xmin` unchanged, snapshot count
equals room count, every legacy tuple is exact, grants/publication stay closed, and
the replaced creation path cannot create a ruleless room.
