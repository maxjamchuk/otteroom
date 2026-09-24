# Phase 0 Research: Selection Rules and Candidate Ordering

**Feature**: 009 — Selection Rules and Candidate Ordering  
**Date**: 2026-09-20  
**Status**: Historical design research. T096/T097 and T100 G5 passed for their
tested source at 45 charged identities. A later mixed-clause correction has
deterministic and bounded live source evidence, and the owner's latest-product-source
manual browser recheck PASSED. Feature 009 is release-complete and ready to commit.
The owner waived/discontinued T098 fresh-checkout
certification, not passed, and did not spend its planned 17 additional
identities. Feature 010 Discovery and Feature 011 Match remain unstarted.

## Repository Findings

- The client currently creates rooms through the authenticated PostgreSQL
  `create_room` RPC. That boundary cannot safely possess operator-only startup
  configuration.
- Room creation and creator membership already form one idempotent transaction keyed
  by creator plus creation-request UUID. A rule snapshot must join that transaction.
- Feature 005 stores private common years plus anonymous AND-of-OR genre clauses.
  Feature 006 uses those clauses for Discover overfetch, exact Edge eligibility and
  locked commit validation.
- Feature 006 currently hard-codes `en-US`, `primary_release_date.asc`, no vote/rating
  fields or cutoffs, and returns the first eligible result from the first nonempty
  date shard. That last behavior cannot implement any Feature 009 global ordering.
- Feature 008 already supplies the required sequencing architecture: room-locked
  prepare, external search without a database lock, expected-sequence commit,
  server-derived occurrence exclusions, one durable winner, and distinct
  `search_incomplete` versus `completed_empty` meanings.
- Feature 008's threshold helper is fixed to `2/3`, while the client also validates
  that fixed formula. Both must evolve without exposing the fraction.
- Only `public.rooms` is published through Realtime. Rule snapshots, predicates,
  occurrence history and decisions can remain private without a new channel.

## Primary External Sources

- [TMDB Discover Movie reference](https://developer.themoviedb.org/reference/discover-movie)
  documents `vote_count.desc`, `vote_average.desc`, `popularity.desc`, `title.asc`,
  `vote_count.gte`, `vote_average.gte`, `language`, and comma/pipe genre semantics.
- [TMDB language guidance](https://developer.themoviedb.org/docs/languages) documents
  ISO 639-1 language and ISO 3166-1 country codes, commonly paired as IETF tags.
- [TMDB primary translations](https://developer.themoviedb.org/reference/configuration-primary-translations)
  supplies the official supported translation tags used for the versioned startup
  allow-list.
- [TMDB API errors](https://developer.themoviedb.org/docs/errors) documents the page
  limit relevant to Feature 006's date-shard traversal.

TMDB does not document secondary ordering, title collation equivalence across
separate queries, or snapshot-consistent pagination. The design therefore owns an
explicit deterministic local comparator and treats unprovable traversal as incomplete.

## R1. External Configuration Format

**Decision**: Use repository-versioned `config/selection-rules.yaml` as the one
canonical server-only, human-editable configuration document. Required keys are
`minimum_vote_count` and `metadata_language`. Optional keys are `ordering`,
`minimum_average_rating`, `genre_mode` and `larger_group_agreement`; only the
spec-approved omissions receive defaults. Represent the fraction as exact YAML text
`p/q`. Bundle the exact file into each server/Edge artifact and parse it once during
module initialization.

The approved initial canonical generation supplies `minimum_vote_count: 500`,
`metadata_language: en-US`, `ordering: vote_count_desc`, `genre_mode: or` and
`larger_group_agreement: 2/3`. Its approved null minimum-rating meaning is represented
by omission of `minimum_average_rating`; explicit YAML `null` remains invalid. These
values are editable operational configuration and do not become product constants.

**Rationale**: One version-controlled document makes review and deployment history
explicit, is an atomic configuration generation and distinguishes omitted from
explicitly invalid values. Exact text prevents YAML numeric coercion from changing
rational meaning. One shared loader/parser can serve every Edge entrypoint and
deterministic unit harness. Restart/redeploy is the only activation boundary.

**Alternatives considered**:

- Individual environment variables and one large JSON environment variable were
  rejected because they hide the canonical generation outside repository review and
  make deployment drift easier. Environment files remain credentials-only.
- A second checked-in generated/copy file beside each Edge function was rejected
  because it would create competing human-editable sources. Build/deploy tooling may
  bundle only the exact canonical YAML and must prove byte identity.
- Runtime database configuration was rejected because it creates a mutable
  configuration service and weakens restart-only semantics.

## R2. Startup Validation and Language Support

**Decision**: With a pinned YAML parser, parse once at module/process initialization;
reject missing/empty files, malformed or multi-document YAML, duplicate keys,
aliases/anchors/custom tags, non-mapping roots, unknown keys and invalid explicit
values; normalize the result and deep-freeze it. Validate language against a
checked-in, source-attributed snapshot of TMDB primary-translation IETF tags. Both
server entrypoints import the same loader and initialize before serving.

**Rationale**: Module-level construction gives restart-only behavior and prevents
request-by-request file or artifact drift. A versioned official tag set rejects
unsupported values without making server startup depend on TMDB availability.

**Alternatives considered**:

- Syntax-only BCP-47 validation was rejected because well-formed but unsupported
  tags could silently fall back at TMDB.
- Calling TMDB configuration at every startup was rejected because transient
  provider failure would become an unrelated configuration-startup dependency.
- Silent canonicalization/clamping/fallback was rejected by FR-003.
- Request-time file reads, watchers and hot reload were rejected because a running
  process must retain its initialized generation until restart/redeploy.

## R3. Trusted Room Creation

**Decision**: Add an authenticated `room-create` Edge operation and a
service-role-only create RPC. The client sends only its existing creation inputs;
Edge derives actor identity and supplies the normalized startup snapshot. PostgreSQL
atomically inserts room, creator membership and rules. Retire direct authenticated
execution of the old create RPC.

**Rationale**: Current direct client creation cannot safely distinguish a trusted
server configuration from forged rule fields. The narrow Edge boundary uses the
existing platform and JWT pattern. PostgreSQL remains the transaction authority.

**Alternatives considered**:

- Client-supplied rules were rejected as untrusted.
- A database session setting was rejected because Supabase Data API calls do not
  provide a safe deployment-wide immutable startup value.
- A standalone backend/configuration service was rejected as unnecessary scope.

## R4. Room Snapshot and Legacy Classification

**Decision**: Add one protected one-to-one `private.room_selection_rules` row for
every room. Use explicit `legacy_005_006_008` and `configured_009_v1` kinds. Backfill
every existing room with a complete legacy row and require every new room to receive
a configured row in its creation transaction.

**Rationale**: A child row avoids rewriting `rooms` and keeps rules out of public
column grants and Realtime. Explicit legacy classification preserves the actual old
source behavior, which is not one of the four newly configured ordering promises.
Missing data unambiguously means corruption and can fail closed.

**Alternatives considered**:

- Absence meaning legacy was rejected because a damaged Feature 009 room would
  silently inherit historical semantics.
- Adding all fields to `public.rooms` was rejected because it expands the published
  authority row and its grants for no client need.
- A JSONB snapshot was rejected because typed checks and exact SQL agreement
  arithmetic would become more complex and easier to drift.

## R5. Exact Rational Agreement

**Decision**: Parse `p/q` with `BigInt`, require `0 < p <= q`, reduce by GCD and
persist positive signed-32-bit numerator/denominator integers. For `N >= 3`, compute
`((N::bigint * p::bigint) + q::bigint - 1) / q::bigint`; for `N = 2`, return `2`.
Invoke resolution only after authoritative accepted decision count equals `N`.

**Rationale**: The stored pair is exact and canonical. With PostgreSQL integer and
bigint domains the accepted operands cannot overflow the intermediate. The formula
is exact ceiling division and no percentage or floating conversion exists. Keeping
the full-set gate independent preserves Feature 008's no-early rule.

**Alternatives considered**:

- Decimal percentage/float math was rejected as semantically incorrect.
- Persisting a precomputed threshold was rejected because threshold depends on the
  fixed voter count and the fraction itself is the retained product rule.
- Allowing the fraction to affect two-voter rooms was rejected by FR-025.

## R6. One Genre Predicate Across Components

**Decision**: Continue using the canonical AND-of-OR clause representation. OR mode
emits one multi-genre clause per constrained voter. AND mode emits one singleton
clause per selected genre. Any emits nothing. Recompute the expected materialization
from frozen filters plus snapshot mode in the private handoff validator.

**Rationale**: `every(clause intersects movieGenres)` then has the same meaning in
resolution, Edge eligibility and SQL commit validation. It preserves AND across all
voters without storing voter identity or introducing a second predicate language.

**Post-G5 recovery**: Discover pushdown normalizes duplicate genres and redundant
superset clauses. A single OR clause is pipe-joined; multiple singleton clauses
are comma-joined even in OR mode, because the conjunction is across voters.
Mixed clauses are decomposed into a bounded union of minimal satisfying genre
sets, each sent as a separate comma-AND query. The owner three-clause case
requires `35,80`, `35,878`, and `80,878`. A 12-branch cap retains the prior
safe singleton conjunction or shortest canonical OR clause when decomposition
is too large. TMDB grouping precedence for mixed comma/pipe expressions is not
assumed. Edge and SQL still check every original clause.

**Alternatives considered**:

- Passing raw voter filters to Edge was rejected for privacy and duplicate logic.
- Using OR during query and AND only during commit was rejected because retrieval
  and validation would not share one rule.
- Mutating Feature 004 filter rows was rejected because accepted filters are frozen.

## R7. TMDB Query Mapping and Evidence

**Decision**: Map configured ordering directly to Discover `sort_by` values, always
send `vote_count.gte`, optionally send `vote_average.gte`, use retained `language`,
and retain year/adult/video constraints. Derive required result metrics from the
retained rules: require `vote_count` for a vote-count cutoff or comparator,
`vote_average` for a rating cutoff or comparator, and `popularity` for its comparator.
Ignore missing/malformed metrics that no active cutoff/comparator consumes. Repeat
cutoff and complete clause eligibility locally; pass only cutoff evidence required by
the locked commit for independent validation.

**Rationale**: Provider filters reduce work but do not replace authoritative checks.
Conditional parsing preserves fail-closed behavior for evidence that can affect the
winner or eligibility without turning irrelevant provider fields into false source
failures. The database can prove the submitted row meets eligibility even though it
cannot prove global ordering without copying the catalog.

**Alternatives considered**:

- Trusting Discover filtering alone was rejected because Feature 006 deliberately
  validates provider evidence at both Edge and commit boundaries.
- Persisting scores/title/popularity was rejected because they are mutable TMDB
  metadata and not required application state.
- A second source or local canonical movie catalog was rejected by scope.

## R8. Global Ordering, Ties and Pagination

**Decision**: For configured numeric modes, first query the complete retained date
range with TMDB's matching documented sort and traverse through the first locally
eligible primary-value run while the inspected provider primary remains monotonic.
Continue an equal-primary run across page boundaries and select its smallest TMDB
ID. Apply this proof independently to each exact genre branch and compare completed
branch winners with the local total comparator. If a primary regression is observed,
abandon that branch's prefix proof and finish its bounded traversal, selecting its
local winner or completed-empty only after raw pagination accounting completes; an
unfinished branch retains its concrete incomplete reason. Retain deterministic date bisection when the 500-page
ceiling prevents a result/empty proof, and compare every required child winner.
Title mode continues to use returned localized title normalized to NFC and one fixed
`Intl.Collator` configuration; it enumerates every required page/shard because TMDB
does not document collation equivalence with the local comparator. Page/result
traversal and duplicate suppression remain deterministic.

**Rationale**: The provider's documented numeric primary sort proves that no later
result can outrank a completed first eligible primary run; exhaustive traversal of
lower numeric values added latency without adding correctness. A total comparator
still requires the full tie run. Title collation and authoritative empty proof lack
that early bound and remain exhaustive. In-memory bounded traversal is not a
synchronized catalog, so any needed page/shard failure remains safer than a partial
winner or false exhaustion.

**Alternatives considered**:

- Merely replacing `sort_by` was rejected because date-shard order is release-date
  order, not vote/rating/popularity/title order.
- Persisting page/deck cursors was rejected because configuration/provider changes
  could make them skip or duplicate candidates and Feature 008 already supplies
  server-owned history.
- Claiming TMDB title collation as locally reproducible was rejected because it is
  undocumented.

**Post-G5 correction (2026-09-22)**: Manual validation exposed that the original
configured implementation exhausted every page/shard even after a numeric winner was
already provable. A controlled 120-page source reproduced `request_budget` at exactly
100 serial requests and 15,260 simulated milliseconds, despite the global winner
being on page one. The corrected decision above preserves the comparator/tie contract
while removing exhaustive lower-ranked traversal from the normal numeric success
path.

## R9. No-Repeat and Restart Behavior

**Decision**: Start every acquisition at the ordered search root under the room's
snapshot and exclude all occurrence IDs returned by prepare. Persist no cursor.
Commit only against Feature 008's expected rejected sequence.

**Rationale**: Different rooms may have different policies without shared state.
Restart under new configuration cannot affect old snapshots. Re-search plus complete
history avoids duplicates, while compare-and-set preserves one winner and prevents
skipped ordinals under concurrency or response loss.

**Alternatives considered**:

- Global per-order cursors were rejected because rooms and configurations would
  interfere.
- Client-provided seen IDs were rejected as untrusted and incomplete.
- Replacing an assigned candidate after a source/config change was rejected by the
  stable-authority contract.

## R10. Failure and Exhaustion

**Decision**: Preserve `match | completed_empty | search_incomplete`. A missing or
malformed metric is `search_incomplete` only when an active retained cutoff or
comparator requires it; an irrelevant metric is ignored. A required-metric failure,
ordering inconsistency, provider error, page/shard mismatch, budget or deadline before
the proof completes performs no empty commit. Only a complete error-free traversal
under the retained rules and exclusions may commit empty/exhausted.

**Rationale**: A partial ordered scan cannot prove either the correct winner or
absence. Feature 008's durable advancing state already makes retries safe.

**Alternatives considered**:

- Selecting the best partial result was rejected because an unvisited result may be
  higher ordered.
- Treating request budget as exhaustion was rejected because it is incomplete work.
- Weakening filters/cutoffs or falling back to fixtures was rejected by FR-033.

## R11. Client and Realtime Scope

**Decision**: Change the client only for room-create transport and decision-threshold
validation. Keep room projection fields, rooms-only Realtime, candidate request/body,
filter UI, progression UI and all participant-facing choices unchanged. Do not expose
rules or fractions.

**Rationale**: Rules are server application state and participants need only the
shared outcomes. Existing canonical refetch/generation handling already recovers
candidate/progression state.

**Alternatives considered**:

- Adding rule fields to the safe projection was rejected as unnecessary protected
  data exposure and UI coupling.
- Adding a configuration/status screen was rejected as explicit non-scope.

## R12. Validation and Browser Budget

**Decision**: Place exhaustive configuration, migration, arithmetic, eligibility,
ordering, pagination and concurrency evidence below the browser layer. Add two owner
cases totaling six identities. Keep targeted historical selection at zero because
the permanent smoke covers the changed creation boundary and owner cases cover the
evolved source/progression journeys.

**Rationale**: This follows `docs/testing-strategy.md`: PostgreSQL and Deno are the
authoritative oracles for locks, exact math and provider traversal; Playwright proves
representative end-to-end cooperation. T096's normal checkpoint cost 23 identities
and T097's repeatability cost 22, for 45 valid current-source identities. The
separately planned 17-identity T098 fresh checkout was intentionally discontinued
by owner decision; the former 62-identity combined projection is not current-source
certification.

**Alternatives considered**:

- Browser cases for every order/fraction were rejected as weaker, expensive evidence
  for deterministic server algorithms.
- Full historical browser acceptance was not selected because the changes are
  bounded and permanent smoke plus focused owner flows cover browser integration.

## Research Conclusion

All planning unknowns are resolved. Whole-feature owner approval and approval of every
initial canonical value were received on 2026-09-21, including required vote count
`500`, language `en-US`, `vote_count_desc`, OR, exact `2/3`, and omission of the
rating cutoff; T012 has no missing-value blocker. The remediated artifacts and task
graph are implementation-ready, with no product clarification or constitution
exception required. Later YAML generations may change these operational values only
through successful restart/redeploy, while existing rooms retain snapshots.
