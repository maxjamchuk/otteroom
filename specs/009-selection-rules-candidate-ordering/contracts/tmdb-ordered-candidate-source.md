# Contract: Ordered TMDB Candidate Source

**Feature**: 009 — Selection Rules and Candidate Ordering  
**Status**: Planned evolution of Feature 006 source and Feature 008 sequencing

## Preserved Public Boundary

`room-candidate` remains an authenticated exact-body POST:

```json
{ "room_id": "uuid" }
```

It accepts no actor, rule, filter, exclusion, order, cutoff, language, candidate or
sequence field. Public success/error shapes remain those in Feature 008, including
`available`, `metadata_unavailable`, `not_found`, `not_ready`, `no_candidates`,
`exhausted` and `refresh_required` plus safe 503 source failure.

## Private Prepare Result

The service-role-only `prepare_room_tmdb_candidate` keeps its authorization-before-
lock protocol and returns exact nullability by outcome.

For `acquire`, add to the existing sequence/progression/years/clauses/exclusions:

| Field | Type | Meaning |
| --- | --- | --- |
| `rule_set_kind` | text | Legacy versus configured source behavior |
| `candidate_ordering` | text | Legacy or one configured ordering |
| `minimum_vote_count` | bigint nullable | Null only for legacy |
| `minimum_average_rating` | numeric nullable | Configured optional cutoff |
| `metadata_language` | text | Retained Discover/Details language |
| `genre_mode` | text | Integrity discriminator; clauses remain canonical authority |

For `assigned`, return retained `metadata_language` so Details recovery never uses
current startup configuration. Other private rule/search fields are null. Protected
outcomes retain all-null behavior where applicable.

Prepare validates one coherent snapshot plus the existing assembled/frozen/
compatible/progression/occurrence invariants. Missing or corrupt rules return a safe
closed outcome or fixed internal failure; never a synthesized current rule set.

## Discover Query Mapping

Configured queries include:

```text
language=<retained tag>
include_adult=false
include_video=false
primary_release_date.gte=<common lower>-01-01
primary_release_date.lte=<common upper>-12-31
vote_count.gte=<retained required cutoff>
vote_average.gte=<retained optional cutoff>   # omit only when absent
sort_by=<mapping below>
page=<positive page>
```

| Ordering | `sort_by` |
| --- | --- |
| vote count descending | `vote_count.desc` |
| average rating descending | `vote_average.desc` |
| popularity descending | `popularity.desc` |
| title ascending | `title.asc` |

Genre pushdown:

- Normalize each OR clause by deduplicating/sorting IDs, remove duplicate clauses,
  then remove each superset clause made redundant by a strict subset clause.
- No clauses (all voters Any): omit `with_genres` (no useful representation).
- One remaining clause: pipe-join its IDs, an exact OR representation (`A|B`).
- Multiple remaining singleton clauses: comma-join their distinct IDs, an exact
  conjunction (`A,B,C`) regardless of retained within-voter genre mode. The live
  Crime/Comedy/Science Fiction case is `35,80,878`, equivalent to `80,35,878`.
- For multiple mixed clauses, derive minimal genre sets that intersect every
  normalized clause. Query each set as a separate comma-AND conjunction and
  union the results. The owner case `(35|878)&(35|80)&(80|878)` uses `35,80`,
  `35,878`, and `80,878`. No mixed comma/pipe expression is generated because
  TMDB's grouping precedence is not assumed.
- Limit exact decomposition to 12 branches. If the intermediate or final set
  count exceeds the bound, use the prior safe single-query predicate: all
  singleton requirements joined by comma, or one shortest canonical OR clause.
  Continue checking every clause locally.

Pushdown must be a superset of the canonical predicate. Exact validation always
checks every clause.

Legacy queries retain the Feature 006 mapping exactly: `en-US`,
`primary_release_date.asc` and no vote/rating filter. Their genre predicate receives
the same safe clause normalization; local validation remains authoritative.

## Strict Provider Evidence

Every result must contain valid ID/adult/date/genres/title/poster. Numeric metrics are
strict only when an active retained rule consumes them:

| Metric | Required condition | Required validation |
| --- | --- | --- |
| `vote_count` | Minimum vote count is active or ordering is `vote_count_desc` | Non-negative safe integer |
| `vote_average` | Minimum average rating is active or ordering is `average_rating_desc` | Finite number in inclusive `0..10` |
| `popularity` | Ordering is `popularity_desc` | Finite non-negative number |

The condition is a union: one active cutoff or comparator is sufficient to require the
metric. For configured rooms the required minimum vote count therefore always requires
`vote_count`; legacy behavior requires none of these three metrics. A missing or
malformed required metric makes the whole page/attempt `search_incomplete`, is never
coerced to zero or merely skipped, and cannot prove exhaustion. A missing or malformed
irrelevant metric is ignored and does not make an otherwise valid candidate or search
incomplete.

The deterministic requirement matrix is:

| Retained policy | Required numeric metrics |
| --- | --- |
| Legacy source behavior | none |
| `vote_count_desc`, no rating cutoff | `vote_count` |
| `vote_count_desc`, rating cutoff | `vote_count`, `vote_average` |
| `average_rating_desc`, with or without rating cutoff | `vote_count`, `vote_average` |
| `popularity_desc`, no rating cutoff | `vote_count`, `popularity` |
| `popularity_desc`, rating cutoff | `vote_count`, `vote_average`, `popularity` |
| `title_asc`, no rating cutoff | `vote_count` |
| `title_asc`, rating cutoff | `vote_count`, `vote_average` |

For every row, tests must inject both missing and malformed values into each required
metric and into each irrelevant metric, proving the opposite completeness outcomes.

Exact eligibility requires:

```text
adult = false
commonFrom <= releaseYear <= commonTo
voteCount >= minimumVoteCount
minimumAverageRating absent OR voteAverage >= minimumAverageRating
every canonical genre clause overlaps result.genreIds
id not in server-derived exclusions
```

Equality at either cutoff passes. Ordering never changes this predicate.

## Ordered Bounded Traversal

### Total comparison

- `vote_count_desc`: larger vote count, then smaller TMDB ID;
- `average_rating_desc`: larger vote average, then smaller TMDB ID;
- `popularity_desc`: larger popularity, then smaller TMDB ID; and
- `title_asc`: NFC-normalized configured-language title under fixed
  `Intl.Collator(language, { usage: 'sort', sensitivity: 'variant', numeric: false,
  ignorePunctuation: false })`, then normalized code-point comparison, then smaller
  TMDB ID.

The secondary order is implementation determinism only. Product behavior still
allows either candidate tied on the primary field.

### Pages and date shards

- Validate page number, total pages/results and cross-page consistency before using
  results.
- Traverse page number and result index ascending; count raw results before local ID
  deduplication as Feature 006 does.
- Numeric modes query the entire retained date range for every exact branch with
  the configured provider sort. Skip locally ineligible/excluded results and stop
  within each branch after the first
  eligible candidate's complete equal-primary run is known while the inspected
  primary values remain monotonic. Continue that run across a page boundary when
  needed and apply the smaller-TMDB-ID secondary rule across the complete run. If a
  provider primary regression is observed, abandon the prefix proof, continue the
  same bounded traversal, and select the local total-order winner only after that
  branch's traversal completes. Compare all branch winners by the local total
  comparator and deduplicate repeated movie IDs. A complete regression-affected
  traversal may still return `match` or `completed_empty`. If any required branch
  cannot complete, preserve its concrete incomplete reason. Only completed empty
  branches can collectively prove `completed_empty`.
- Title mode reads every required page before local comparison because provider
  collation is not assumed reproducible.
- If the 500-page provider ceiling prevents a numeric result or empty proof, or an
  exhaustive title traversal overflows it, bisect the date interval into deterministic
  nonoverlapping child shards. A single-day overflow is incomplete.
- Compare winners from every child needed for global correctness. Do not return the
  first nonempty date shard.
- A required child `search_incomplete` makes the whole attempt incomplete even when
  another child found a candidate.

Requests are serial. The existing 100-request and 20-second defaults jointly bound
the broad query, tie completion, retries and any required pages/shards. Exceeding
either limit is incomplete. No partial best candidate may be committed.

## Search Result Union

```text
match(movieEvidence)
completed_empty
search_incomplete(reason)
```

`completed_empty` requires every operation necessary under the room's retained
ordering, full predicate and exclusions to finish error-free with no eligible unseen
movie. Provider/request/parse/required-metric/pagination/order/shard/budget/deadline
failures are `search_incomplete` and produce HTTP 503 with no database write.
Irrelevant metric malformation is not a metric failure.

## Candidate Commit Evolution

Conceptually extend the existing service-only commit with:

```text
p_vote_count bigint
p_vote_average numeric
```

The parameters are nullable at the contract boundary and required under lock only when
their corresponding retained eligibility cutoff is active. Comparator-only metric
requirements are enforced by the trusted Edge traversal, not inferred from one commit.

Keep actor, room, expected sequence, candidate identity, year, genre IDs and adult
evidence. Preserve the unlocked authorization precheck, authorized room lock,
under-lock reauthorization, same-step winner adoption and exact `k+1` insertion.

Under the lock the function revalidates:

- one coherent snapshot and handoff;
- conditionally required cutoff evidence shape;
- retained year, adult, every canonical clause and each active cutoff; and
- complete room occurrence history excludes the proposal.

It does not persist metrics and does not claim to re-prove global ordering from one
row. That property belongs to the trusted Edge traversal.

The empty commit signature and sequencing remain unchanged. Edge may call it only for
`completed_empty`.

## Recovery, Concurrency and No-Repeat

- Every attempt starts from the ordered root; no cursor/page/deck is persisted.
- Exclusions come only from all room occurrences ordered by sequence.
- Search occurs outside PostgreSQL locks.
- Candidate/empty commits compare the expected sequence and establish only one
  winner/terminal for that logical step.
- A losing or retried proposal adopts the committed winner or refreshes; it is never
  rendered first.
- An assigned room performs Details only, using its retained language. Metadata
  failure preserves identity and sequence.
- An agreed room remains terminal; stale work cannot advance it.
- Different rooms and server configurations share no ordering position or history.

## Prohibited Fallbacks

No branch may lower cutoffs, drop clauses/voters, change AND to OR, change language or
ordering, omit server exclusions, use fixtures/another source, or convert incomplete
work to exhaustion.
