# Implementation Plan: Selection Rules and Candidate Ordering

**Branch**: `main` (feature directory label `009-selection-rules-candidate-ordering`) | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Baseline**: `e55a53bbc6494691f9a9e636cfead61a29255982` (`feat: implement candidate progression`)

**Status**: RELEASE-COMPLETE; READY TO COMMIT. The owner's latest-product-source
manual mixed-clause live-TMDB browser recheck PASSED after the source correction.
T096/T097 passed at 45 charged identities and T100 G5 passed for their earlier
tested source; those receipts do not certify the later correction. T098 fresh-checkout
certification was waived/discontinued by the owner, not passed; its planned 17
additional identities were not spent. Feature 010 Discovery and Feature 011
Match remain unstarted.

**Input**: Feature specification from `/specs/009-selection-rules-candidate-ordering/spec.md`

## Summary

Add one startup-read, startup-validated server configuration for candidate ordering,
global cutoffs, metadata language, within-voter genre semantics and the larger-group
agreement fraction. A small authenticated room-creation Edge boundary owns the
immutable in-process configuration and passes its normalized values to a
service-role-only PostgreSQL creation function. That function atomically creates the
room, creator membership and one protected room-rule snapshot. Direct authenticated
room creation is retired so clients can neither choose nor forge the rules.

Every pre-Feature-009 room receives an explicit `legacy_005_006_008` snapshot in the
single additive migration. Legacy is not represented by missing data or by a new
configured ordering: it retains OR-within/AND-across genres, `en-US`, no vote/rating
cutoff, the existing Feature 006 date traversal and exact `2/3`. Every configured
room receives a complete `configured_009_v1` snapshot. Missing or inconsistent
snapshots fail closed.

Feature 005 resolution compiles both genre modes into its existing anonymous
AND-of-OR form: OR stores one multi-genre clause per constrained voter; AND stores
one singleton clause per selected genre; Any stores none. The existing Feature 006
Edge source receives the room-retained rules and Feature 008 exclusions from
preflight, queries TMDB Discover using the corresponding sort/filter/language
parameters, performs exact local eligibility and deterministic cross-page/shard
selection, and commits only through the existing expected-sequence compare-and-set.
PostgreSQL revalidates year, adult, genre and conditionally required cutoff evidence
under the same locked snapshot. No page cursor or process configuration enters room
state.

Agreement remains part of the Feature 008 final-decision transaction. The private
threshold helper reads the room snapshot and returns `2` for exactly two voters;
for `N >= 3` it computes `(N*p + q - 1) / q` from normalized integer numerator and
denominator. It is invoked only after the complete `N/N` decision set. Match remains
Feature 011.

## Technical Context

**Language/Version**: Strict TypeScript ~6.0.3; Node.js 24.20.x/npm 11.19.0;
Deno 2.5.2 for Supabase Edge; PostgreSQL 17

**Primary Dependencies**: Expo 57.0.20, React 19.2.3, React Native 0.86.3,
Expo Router 57.0.19, `@supabase/supabase-js` 2.115.0, Supabase CLI 2.116.0,
Playwright 1.63.0, Jest 29.7, and a pinned `yaml` 2.9.0 parser for the server-only
configuration; platform `fetch` and `Intl.Collator`; no second movie API

**Storage**: Existing Supabase PostgreSQL plus one grant-free one-to-one private
room-rule snapshot table. No movie catalog, ordering queue, cursor, configuration
service or descriptive metadata cache is added.

**Testing**: Jest/React Native Testing Library; Deno config/source/Edge tests;
pgTAP and dblink for migration, authority, arithmetic and concurrency; protected
nonempty migration runner; Playwright real-stack owner acceptance; existing
credential scanner, generated-type, lint, typecheck and web/native export gates

**Target Platform**: Shared Expo Android/iOS/web client; automated browser evidence
on Chromium web; Supabase PostgreSQL/Auth/Data API/Postgres Changes/Edge; TMDB API v3

**Project Type**: Mobile-first Expo application with functional web access and a
Supabase backend

**Performance Goals**: Preserve Feature 008's five-second client convergence target
after authoritative transitions. Keep Feature 006's default 100-request/20-second
bounded attempt. A configured ordered search that cannot prove its winner or empty
result within that bound returns retryable source failure; it does not choose a lower
candidate or claim exhaustion.

**Constraints**: One configuration document loaded once per server process/isolate;
restart-only changes; immutable per-room rules; explicit legacy behavior; exact
rational agreement; all-voter filters; full-set decision timing; TMDB only; no
database lock during provider I/O; no repeated room movie; no public rule projection;
no hot reload, configuration UI, Match, early resolution or fallback weakening

**Scale/Scope**: One rule snapshot per room, 19 existing genres, one new room-create
Edge operation, the existing room-candidate Edge operation, one additive migration,
evolved resolution/decision/source RPC internals, unchanged rooms-only Realtime, and
two browser owner cases using six identities

## Constitution Check — Before Phase 0

**PASS. No exception, amendment or unresolved product decision is required.**

| Principle | Assessment |
| --- | --- |
| I. Working behavior is primary evidence | The plan defines clean migration/reset, DB, Edge, client, build/export, browser, repeatability and fresh-checkout evidence without claiming implementation evidence exists. |
| II. Small verifiable vertical slices | Configuration/creation, snapshot-aware resolution/agreement, ordered source work and client acceptance are separate green checkpoints; none begins Feature 010 Discovery or Feature 011 Match. |
| III. Specification and implementation consistency | The explicit evolutions of Features 005/006/008 are reflected in the data model, contracts and traceability artifact; no requirement remains `NEEDS CLARIFICATION`. |
| IV. Explicit authoritative transitions | PostgreSQL atomically owns room+snapshot creation and final decisions; the established prepare/search/expected-sequence-commit split owns external source work. Retry, stale, concurrency and corruption behavior are explicit. |
| V. Security, secrets and least privilege | Startup configuration and room snapshots remain server-only; direct authenticated creation is retired; private predicates, decisions, history and TMDB credentials remain protected. |
| VI. Reproducible development and schema evolution | One versioned additive migration explicitly backfills legacy rooms and has clean plus nonempty upgrade validation; generated types have one controlled write point. |
| VII. Tests are executable acceptance evidence | Arithmetic/locks/ACLs live in PostgreSQL tests, provider traversal in Deno tests, state parsing in client tests, and only representative cooperation in Playwright. |
| VIII. Explicit scope and simplicity | One private table and one focused creation boundary are the minimum additions needed to make startup configuration trusted and room-stable. No speculative service, cache, UI or future Match behavior is introduced. |

Phase 0 repository and primary-source research is recorded in [research.md](research.md).

## Project Structure

### Documentation (this feature)

```text
specs/009-selection-rules-candidate-ordering/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── requirements-traceability.md
├── tasks.md
└── contracts/
    ├── selection-configuration-and-room-creation.md
    ├── room-rule-resolution-and-agreement.md
    └── tmdb-ordered-candidate-source.md
```

`tasks.md` contains the dependency-ordered implementation and evidence graph derived
from these owner-approved, analysis-remediated artifacts.

### Planned implementation paths

```text
package.json

config/
└── selection-rules.yaml

src/
├── rooms/{contracts,service}.ts
├── decisions/contracts.ts
└── types/database.generated.ts

supabase/
├── config.toml
├── functions/
│   ├── _shared/
│   │   ├── selection-rules.ts
│   │   ├── selection-rules-config.ts
│   │   ├── tmdb-primary-translations.ts
│   │   ├── candidate-contracts.ts
│   │   ├── tmdb-eligibility.ts
│   │   └── tmdb-client.ts
│   ├── _tests/
│   │   ├── selection-rules.test.ts
│   │   ├── room-create.test.ts
│   │   ├── room-candidate.test.ts
│   │   ├── tmdb-search.test.ts
│   │   └── tmdb-eligibility.test.ts
│   ├── room-create/index.ts
│   └── room-candidate/index.ts
├── migrations/20260920000000_selection_rules_candidate_ordering.sql
└── tests/
    ├── database/{selection_rules,common_filter_resolution,tmdb_candidate_source,candidate_progression}.test.sql
    └── migration/{selection_rules.before,selection_rules.after}.sql

__tests__/
├── rooms/{contracts,service}.test.ts
├── decisions/contracts.test.ts
└── config/feature009-e2e-profile.test.ts

e2e/
├── selection-rules-candidate-ordering.spec.ts
└── support/{room-harness,candidate-harness,decision-harness,progression-harness,tmdb-stub}.ts

scripts/
├── check-selection-rules-config.mjs
├── check-selection-rules-migration.mjs
└── run-e2e.mjs
```

**Structure Decision**: Retain the existing Expo feature modules, one rooms-only
Realtime channel, versioned PostgreSQL migration boundary and Feature 006/008
candidate Edge orchestration. Add one focused `room-create` Edge entrypoint because
the current direct client RPC cannot safely possess startup-only operator rules.
Both server entrypoints import one shared configuration parser. No standalone
backend, worker, queue, configuration service or second source is introduced.

## Configuration Architecture

### External format and startup lifecycle

Use the repository-versioned, server-only
[`config/selection-rules.yaml`](../../config/selection-rules.yaml) file as the
canonical human-editable source. Its mapping shape is:

```yaml
minimum_vote_count: 500
metadata_language: en-US
ordering: vote_count_desc
genre_mode: or
larger_group_agreement: 2/3
```

This is the approved initial canonical generation. The approved
`minimum_average_rating: null` meaning is encoded by omitting that optional field;
explicit YAML `null` remains invalid. These are operational values, not immutable
product constants: operators may edit the YAML and successfully restart/redeploy to
affect only rooms created under the new generation. `ordering`, `genre_mode` and
`larger_group_agreement` may be omitted and become exactly `vote_count_desc`, `or`
and `2/3`; `minimum_average_rating` may be omitted and becomes no cutoff.

The shared Deno loader and parser:

- reads the bundled copy of the canonical YAML once during module initialization;
- rejects a missing/empty file, malformed or multi-document YAML, duplicate keys,
  aliases/anchors/custom tags, a non-mapping root and unknown keys;
- requires a non-negative safe whole-number `minimum_vote_count`;
- accepts `minimum_average_rating` only as a finite number in TMDB's inclusive
  `0..10` vote-average domain;
- accepts only the four approved ordering literals and `or | and`;
- accepts the fraction only as exact ASCII `p/q`, parses with `BigInt`, requires
  `0 < p <= q`, reduces it by GCD and requires the normalized pair to fit signed
  32-bit positive integers;
- canonicalizes and validates `metadata_language` against a checked-in,
  source-attributed snapshot of TMDB's official primary-translation IETF tags;
- returns a deeply frozen normalized object; and
- reports only fixed safe diagnostics, never the raw YAML or parsed configuration.

The checked-in language set avoids a network dependency during startup while
rejecting syntactically plausible but unsupported tags. Updating that set is a
deliberate code/deploy change, not hot reload. The canonical YAML must deliberately
supply the approved initial minimum vote count and metadata language; repository or
deployment tooling must not invent replacements.

`supabase/config.toml` and the server build/deploy checks include the exact canonical
file as a static asset for both Edge functions without creating a second checked-in
editable copy. Packaging fails if the asset is absent, differs from the repository
file or becomes client-addressable. Environment files remain credentials-only and
cannot override any selection rule. A deterministic zero-identity packaging harness
proves local serve and deploy artifacts read the same bytes.

Both `room-create` and `room-candidate` construct their production dependencies
from the module-level normalized configuration. Missing, malformed or invalid YAML
throws before either handler is served. The file is never read again during that
process/isolate; editing it has no effect until the changed file is bundled and the
server is successfully restarted/redeployed.
The candidate handler validates startup configuration for fail-fast server
operation but never applies it to an existing room: candidate and agreement work
always consume the persisted room snapshot.

### Trusted room creation boundary

The client sends only its existing creation request UUID, required voter count and
creator-votes choice to authenticated `room-create`. The Edge function verifies the
JWT exactly as `room-candidate` does and calls a service-role-only creation RPC with
the verified actor UUID plus the complete normalized snapshot. The database inserts
room, creator membership and snapshot in one transaction.

The old authenticated direct-create signature is dropped/revoked in the same
migration. Join remains the existing authenticated PostgreSQL RPC. A duplicate
`(creator_user_id, creation_request_id)` call returns the already-created room and
does not compare, replace or repair its snapshot. Therefore a lost response retried
after restart under configuration B still returns the room created under A.

## Immutable Room-Rule Snapshot and Legacy Migration

Create `private.room_selection_rules`, keyed one-to-one by `room_id`, with a closed
`rule_set_kind` of `legacy_005_006_008 | configured_009_v1` and typed fields for
ordering, vote cutoff, optional rating cutoff, language, genre mode and normalized
agreement numerator/denominator. It is postgres-owned, RLS-enabled, grant-free,
outside Realtime and has no application update/delete operation.

The explicit kind is essential:

- `legacy_005_006_008` stores the completed historical semantics: legacy Feature
  006 date traversal/no new ranking promise, no vote-count or rating cutoff,
  `en-US`, OR-within/AND-across genres and exact `2/3`;
- `configured_009_v1` requires every configured field and permits only approved
  values; and
- no row, duplicate/impossible row or inconsistent values mean corruption and fail
  closed. Absence never means legacy and current startup configuration is never a
  repair source.

The migration takes an application-traffic cutover lock on room creation, creates
the private relation, inserts exactly one legacy row for every existing room, then
replaces the create boundary before commit. It does not update existing room,
member, filter, resolution, occurrence or decision rows. Nonempty migration evidence
compares values, timestamps and `xmin` where applicable across waiting, filter,
candidate and progression lifecycle states.

## Genre Resolution and Eligibility

Keep `private.room_filter_resolution_genre_clauses` as the one canonical anonymous
predicate shared by resolution, Edge search and commit validation:

- Any genre: emit no clause;
- configured/legacy OR: emit one canonical nonempty genre array per constrained
  voter; and
- configured AND: emit one singleton clause for every selected genre.

The predicate remains `every clause intersects candidate genres`, so across-voter
composition is AND in every mode. The resolver reads and validates the rule snapshot
under the existing room lock, derives deterministic clause ordinals, and never
stores voter identity in the resolved predicate. `private.valid_tmdb_candidate_handoff`
is evolved to recompute the expected clauses from frozen voter filters plus the
retained mode, so stale or differently interpreted materialization fails closed.

TMDB query narrowing is a no-false-negative optimization only. Normalize duplicate
genres/clauses and remove redundant supersets first. One remaining OR clause is
represented exactly with pipe; multiple singleton clauses are represented exactly
with comma in either retained genre mode. For mixed clauses, enumerate at most 12
minimal satisfying genre sets and query each as a separate comma-AND conjunction.
If that bound is exceeded, retain the conservative singleton conjunction or one
shortest canonical OR clause. Edge and locked PostgreSQL continue to validate the
full predicate. Never mix comma and pipe because provider grouping precedence is
not assumed.

## TMDB Ordering, Cutoffs and Pagination

The existing `room-candidate` request body and public outcome union remain unchanged.
Private preflight adds the room's rule kind, ordering, cutoffs, language and canonical
clauses alongside Feature 008's expected sequence and ordered exclusion history.

| Room policy | TMDB Discover mapping | Authoritative local comparison |
| --- | --- | --- |
| Legacy | Existing `primary_release_date.asc`, `en-US`, no new cutoffs | Existing oldest-date-shard/page/result traversal |
| Vote count descending | `sort_by=vote_count.desc` | Larger `vote_count`, then smaller TMDB ID |
| Average rating descending | `sort_by=vote_average.desc` | Larger `vote_average`, then smaller TMDB ID |
| Popularity descending | `sort_by=popularity.desc` | Larger finite `popularity`, then smaller TMDB ID |
| Title ascending | `sort_by=title.asc` with retained language | Fixed `Intl.Collator` options for retained language, normalized returned title, then smaller TMDB ID |

Every configured query also sends retained `language`, `vote_count.gte`, optional
`vote_average.gte`, exact inclusive release dates, `include_adult=false` and
`include_video=false`. Result parsing derives required metrics from the retained
cutoffs and comparator:

| Metric | Required when | Irrelevant when |
| --- | --- | --- |
| `vote_count` | Minimum vote count or `vote_count_desc` consumes it | Neither applies (legacy source behavior) |
| `vote_average` | Minimum average rating or `average_rating_desc` consumes it | No rating cutoff and another comparator applies |
| `popularity` | `popularity_desc` consumes it | Any other comparator applies |

Missing/malformed required evidence makes the entire page/attempt incomplete and can
never prove exhaustion. Missing/malformed irrelevant evidence is ignored and does not
invalidate an otherwise complete candidate or search. Equality at either cutoff is
eligible. Under the configured schema the required minimum vote cutoff means
`vote_count` is required for every configured room, while the conditional rule remains
explicit for legacy behavior and for each comparator/cutoff test vector.

Configured numeric ordering starts with one Discover query per exact genre branch
over the full retained date interval using the matching provider sort. It traverses
provider pages in order,
applies authoritative local eligibility and exclusions to every inspected result,
and returns after the first eligible primary-value run is provably complete. The run
may cross a page boundary; every equal-primary result is compared by the existing
smaller-TMDB-ID deterministic secondary rule, and a lower primary value closes the
run while the inspected primary values remain monotonic. If a provider primary
regression occurs, abandon the prefix proof, finish the same bounded traversal and
select that branch's local total-order winner. Compare all completed branch winners
with the local total comparator, deduplicate repeated IDs, and preserve any required
branch's incomplete reason. Only completed empty branches prove global exhaustion.

Deterministic date bisection remains the correctness fallback when the provider's
500-page ceiling prevents a numeric search from finding/proving a result, and it
remains necessary for authoritative empty proof. Required child winners are compared
with the same total comparator and any child failure makes the attempt incomplete.
Title mode still enumerates every required page/shard before applying the declared
locale comparator because TMDB documents `title.asc` but not collation equivalence
with the local comparator. All requests remain serial, in-memory, and bounded by the
unchanged request/deadline budget; inability to prove a winner or empty remains a
retryable failure.

Within a provider page sequence, process page ascending and result index ascending,
deduplicate by TMDB ID, and validate reported page/total consistency. The secondary
TMDB-ID comparison makes implementation ties deterministic, while the product
contract still promises no particular order between equal-primary movies.

Each logical acquisition starts from the top under the room snapshot and skips the
complete server-derived occurrence history. No shared cursor, page offset, deck or
startup-rule fingerprint is persisted. Thus rule changes for another room or after a
restart cannot move this room's position, already resolved IDs cannot repeat, and a
committed winner remains stable through retry/metadata failure. Live TMDB data may
change the order of unseen movies between attempts; that is source evolution, not a
room-rule change.

The candidate commit adds transient `vote_count` plus conditionally required
`vote_average` evidence. Under the existing authorized room lock it re-reads the
snapshot, requires and validates vote count only when a vote-count cutoff applies,
and requires and validates vote average only when a rating cutoff applies; comparator-
only evidence remains an Edge traversal concern. It also validates the canonical
clause predicate, year/adult evidence and no-repeat history, then uses the unchanged
expected-sequence CAS. Ordering itself is a complete-search property and is tested in
the Edge algorithm rather than falsely inferred from one proposed row in PostgreSQL.
Details lookup receives the retained language for both a new winner and an already-
assigned identity.

## Exact Agreement and Feature 008 Sequencing

Store the reduced numerator and denominator as positive integers. The private helper
reads them from `private.room_selection_rules` under the same locked room context:

```text
N = 2     -> 2
N >= 3    -> ((N::bigint * p::bigint) + q::bigint - 1) / q::bigint
```

The normalized components and PostgreSQL `bigint` arithmetic avoid floating point
and overflow for the accepted signed-32-bit component domain. The legacy snapshot
supplies `2/3`. Both decision RPCs return only the derived integer threshold; they do
not expose `p`, `q` or the rule row. Submission still resolves only after the accepted
decision count is exactly `N`, inside Feature 008's existing final-decision
transaction. Exactly two voters always require two yes decisions regardless of the
stored fraction.

The client stops recomputing fixed `2/3` and instead validates the server-returned
integer threshold as `1..N`, with the additional invariant `threshold = 2` when
`N = 2`. It does not calculate, display or edit the fraction. Feature 008's
occurrence binding, one-way outcome, agreed stop, durable advancing barrier,
expected-sequence successor commit, server exclusions, Realtime refetch and
generation lattice otherwise remain unchanged.

## Schema, RPC, Edge and Client Impact

| Layer | Planned change |
| --- | --- |
| Schema | Add only `private.room_selection_rules` and its checks/indexes. Backfill explicit legacy rows. No public room column, new Realtime table, cursor, metric history or metadata copy. |
| Room creation RPC | Retire authenticated direct create; add service-role-only idempotent create-with-actor-and-normalized-snapshot operation. Preserve the safe create result fields. |
| Filter resolution | Read snapshot, compile mode-correct canonical clauses, and strengthen handoff integrity validation. Public result remains status-only. |
| Decision RPCs | Replace fixed threshold helper with room-snapshot exact arithmetic; preserve signatures and nine-field privacy-safe result shape where possible. |
| Candidate preflight | Add private rule fields and keep sequence, frozen years/clauses and server-derived exclusions. Missing/corrupt snapshot fails closed. |
| Candidate commit | Add vote-count/rating evidence and revalidate it against the locked snapshot; retain candidate/empty CAS outcomes and lock order. |
| Edge | Add shared strict config module and `room-create`; evolve TMDB query/result/traversal and same-language Details; keep `room-candidate` public body/outcomes. |
| Client | Change only create transport/strict parsing and arbitrary-threshold validation. Keep room projection, Realtime, filter/candidate/progression UI and participant input unchanged. |
| Generated types | Perform one controlled `npm run db:types` after the complete public function surface is final, then check-only thereafter. |

## Migration and Recovery Strategy

One additive migration follows `20260918000000_candidate_progression.sql`; no
historical migration is edited. In one transaction it:

1. locks the room-creation cutover boundary;
2. creates and hardens the private snapshot relation;
3. inserts one explicit legacy snapshot for every existing room;
4. replaces direct room creation with the service-only atomic snapshot operation;
5. evolves resolver/handoff, threshold helper, decision and source RPCs;
6. preserves exact grants, column projections and the rooms-only publication;
7. verifies one valid snapshot per room plus unchanged historical state; and
8. notifies PostgREST of the signature change and commits.

Reload/reconnect/re-entry requires no new rule read on the client. Every server
operation re-reads the protected snapshot. Restart under configuration B affects only
new creation calls; a room under A, an explicit legacy room, an already-agreed room
and an advancing retry all continue from their stored rules and current sequence.

## Failure, Security and Privacy Model

- Invalid startup configuration prevents handlers from being constructed; no stale
  defaults or last-known-good configuration is served.
- Missing/corrupt snapshots, compiled clauses or impossible agreement components
  raise a fixed integrity failure or safe `not_ready`; current process configuration
  is never substituted.
- `search_incomplete` (request, parse, required-metric, ordering, pagination, shard,
  budget or deadline failure) performs no empty commit and retains pending/advancing;
  an irrelevant missing/malformed metric is ignored rather than classified as a
  metric failure.
- Only an error-free completed traversal with no eligible unseen movie calls the
  existing empty CAS and establishes initial empty/exhausted.
- The source never lowers cutoffs, changes language/order/mode, drops a voter,
  switches AND to OR, restores fixtures or uses a second provider.
- Participant requests contain no rule fields. Rule rows, resolved constraints,
  occurrence history, individual filters/decisions and TMDB credentials remain
  grant-free/private and outside Realtime.
- Safe errors contain no raw configuration, provider payload, predicate, token,
  internal rule ID or foreign-room state.

## Validation and Impact Plan

### Evidence ownership

| Guarantee | Primary evidence | Browser responsibility |
| --- | --- | --- |
| Configuration parsing/defaults/startup failure/no reload | Deno pure/module-start tests and process harness | None |
| Atomic snapshot creation, legacy backfill, immutability, corruption failure | Migration runner + pgTAP | One normal configured creation path |
| Exact fraction and full-set timing | Parameterized pgTAP/dblink | Representative 2-, 3- and 4-voter visible outcomes |
| OR/AND/Any and every-voter predicate | pgTAP + Deno eligibility/commit tests | One controlled AND room with an ineligible decoy |
| Four sorts, cutoff boundaries, language, pagination/shard/ties | Deno source tests + DB evidence validation | Representative configured-language ordered candidates |
| Source failure versus exhaustion | Deno orchestration + PostgreSQL terminal tests | One retry/terminal user journey |
| Sequence/no-repeat/concurrency/response loss | Existing Feature 008 DB/Edge suites, extended for rules | Shared successor/recovery observation only |
| ACL/RLS/privacy | PostgreSQL role tests | Permanent G08 plus one owner ordinary-JWT probe |
| Client create transport/threshold/stale state/no Match | Jest/component/route tests | Normal owner journeys |
| Migration/types/build/reproducibility | Protected runners, reset, check-only types, lint, tests, exports, and current-worktree evidence; T098 fresh checkout waived by owner | None |

### Current-feature browser acceptance (`F = 6`)

- **M01 — 2 identities**: two voters reuse their independent identities across
  bounded configured rooms. Prove Edge-backed room creation, fixed 2/2 agreement,
  one configured ordering/cutoff boundary, rejection to one distinct successor,
  reload/re-entry retention, transient source failure versus completed exhaustion,
  and no Match/configuration UI. Configuration/restart mechanics themselves remain
  deterministic process/DB evidence rather than browser-driven server mutation.
- **M02 — 4 identities**: one non-voting creator plus three voters prove custom
  exact fraction, full-set/no-early timing, AND-within/every-voter filtering with a
  controlled decoy, configured-language ordering, convergence and privacy. Reuse the
  same four case-owned identities in an all-four-voter room for threshold-minus-one
  and threshold boundary coverage; no fifth identity is added.

The Feature 009 profile must run M01/M02 only, workers 1, retries 0, repeat 1,
capture off, exact 2+4 receipts, safe reporter/scanner and owned cleanup.

Permanent G03/G04/G05/G08/H01 remains 16 identities and is evolved only where the
room-create transport changes beneath the same UI. It already covers voting/non-voting
creation, joins, QR, Realtime, filters and cross-room isolation. M01/M02 absorb the
affected Feature 006/008 candidate/progression journeys, so no separate historical
browser case is selected (`T = 0`). Lower layers own exhaustive legacy migration,
ordering, boundaries and concurrency.

| Evidence block | Formula | Current disposition |
| --- | --- | --- |
| T096 normal checkpoint / repeatability run one | `C1 1 + smoke 16 + F 6 + T 0` | **PASS; 23 identities** |
| T097 additional repeatability | `smoke 16 + F 6` | **PASS; 22 identities** |
| Current-source repeatability | `23 + 22` | **PASS; 45 identities** |
| T098 fresh checkout, previously planned | `C1 1 + smoke 16` | **WAIVED by owner; not passed; 0 of 17 additional identities spent** |
| Former repeatability-plus-fresh projection | `45 + 17 = 62` | **Not performed or certified for the current source** |
| Full acceptance inventory | `48 cases / 118 identities`, plus C1 | Inventory projection only; not run as one block |

Every actual charged block remains subject to the rolling R02 admission calculation;
failed/partial/manual attempts count. No identity is needed to prove config parsing,
migration, ordering matrices, arithmetic or database locks.

## Implementation Phases and Green Checkpoints

These phases summarize the future work expanded into executable tasks in
[tasks.md](tasks.md).

1. **Configuration and atomic creation** — shared strict parser, supported-language
   data, private snapshot migration/backfill, service-only creation RPC and
   authenticated `room-create`; prove startup matrix, nonempty migration, ACLs,
   idempotency across A/B and clean reset before continuing.
2. **Snapshot-aware resolution and agreement** — mode-correct canonical clauses,
   strengthened handoff validator, exact fraction helper and decision RPC integration;
   prove OR/AND/Any, every-voter, N=2 override, `N=2..10` fractions, no early
   resolution and deterministic final-vote races.
3. **Ordered candidate source** — extend private preflight, conditionally strict TMDB evidence,
   query mapping, provider-sorted numeric prefix proof, exhaustive title/empty and
   overflow-shard proof, commit cutoff checks and retained language Details; prove
   required-versus-irrelevant malformed metric behavior for every ordering/cutoff
   mode, all four sorts, ties/pages/shards, exclusions, CAS, failure/empty taxonomy
   and legacy source regression.
4. **Client compatibility** — switch create transport, update strict response and
   threshold parsing, regenerate types once and preserve room/progression UI;
   prove focused client suites, full DB/Edge/client regression, lint, typecheck and
   web/native exports.
5. **Bounded acceptance and release audit** — M01/M02, evolved permanent smoke,
   C1, repeatability, current-worktree release validation and G5. T096/T097
   provide 45 current-source charged identities. The separately planned T098
   fresh-checkout block was intentionally discontinued by owner decision, with
   no pass claim and no additional identity spend; the final manual live-TMDB
   check remains owner-driven.

Dependencies are Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5. The migration,
both Edge functions and client create transport ship as one coherent cutover so no
deployed client can create a ruleless room.

## Constitution Check — After Phase 1 Design

**PASS.** The design uses one authoritative immutable rule row, one atomic trusted
creation boundary, the existing source/progression authorities, an explicit legacy
cutover and evidence at the layer capable of proving each invariant. All six user
stories, 43 acceptance scenarios, 40 functional requirements, nine non-functional
requirements and 11 success criteria are mapped in
[requirements-traceability.md](requirements-traceability.md). No Match, hot reload,
configuration UI, early resolution, alternate source, catalog, queue or speculative
infrastructure has entered the design.

## Complexity Tracking

No constitution violation requires justification.

## Planning-Only Declaration

Planning and task generation created design artifacts only. They did not edit
application/database runtime code, run migrations, execute identity-bearing browser
tests, implement Feature 009, or begin Feature 010.
