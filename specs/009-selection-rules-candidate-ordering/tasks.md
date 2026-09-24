---
description: "Executable task breakdown for Selection Rules and Candidate Ordering"
---

# Tasks: Selection Rules and Candidate Ordering

**Input**: Owner-approved, analysis-remediated design documents in
`/specs/009-selection-rules-candidate-ordering/` and the governing
`.specify/memory/constitution.md`.

**Prerequisites**: [spec.md](spec.md), [plan.md](plan.md),
[research.md](research.md), [data-model.md](data-model.md),
[requirements-traceability.md](requirements-traceability.md),
[quickstart.md](quickstart.md),
[selection configuration/creation contract](contracts/selection-configuration-and-room-creation.md),
[room rules/agreement contract](contracts/room-rule-resolution-and-agreement.md), and
[ordered TMDB source contract](contracts/tmdb-ordered-candidate-source.md).

**Tests**: Required by the specification, constitution, and corrected plan. Add
behavioral and contract evidence before the implementation it governs and observe
the relevant failure. YAML/startup and source traversal belong in Deno/process
tests; migration, exact arithmetic, locks, CAS, ACLs, and privacy belong in
pgTAP/dblink and the protected migration runner; browser tests demonstrate only the
planned representative real-stack journeys.

**Organization**: Phase 2 establishes shared failing fixtures without changing
runtime behavior. Phases 3–8 map exactly to the six user stories. The authority
dependency is YAML initialization → immutable room snapshots → consistent
eligibility → ordered source → exact agreement → recovery/privacy/failure hardening.
Phase 9 freezes the final SQL surface, performs the one permitted generated-types
write, and runs deterministic, browser, repeatability, current-worktree release
validation, and final traceability gates. The planned independent T098
fresh-checkout certification was later discontinued by owner decision.

| Label | User story | Independent demonstration |
| --- | --- | --- |
| US1 | Start Only with a Valid Rule Configuration (P1) | The canonical server-only YAML and both deployment-shaped handlers accept every valid rule shape, reject malformed/unknown/invalid input before serving, remain frozen while running, and change only after rebuild/redeploy/restart. |
| US2 | Retain Each Room's Effective Rules (P1) | Clean and nonempty upgrades yield exactly one immutable snapshot per room; A/B creation, retry, reload, and explicit legacy rooms keep their own rules with no client-forgeable path. |
| US3 | Apply Consistent Candidate Eligibility (P1) | Resolution, Edge eligibility, and locked commit agree on inclusive cutoffs, years, adult rules, Any/OR/AND genres, and every fixed voter. |
| US4 | Receive Candidates in the Configured Order (P1) | Each of four orderings selects the globally correct eligible unseen winner across pages/date shards with deterministic ties and Feature 008 prepare/search/commit CAS. |
| US5 | Resolve Agreement with the Room's Exact Fraction (P1) | PostgreSQL uses exact integer ceiling arithmetic for N=3..10, forces N=2 to two yes votes, waits for N/N, and preserves one final outcome under races and retry. |
| US6 | Preserve Authority, Privacy and Failure Meanings (P2) | Authorized clients recover one retained-rule outcome while unauthorized/cross-room access stays closed and incomplete source work never becomes true exhaustion. |

## Format: `[ID] [P?] [Story?] Description`

Every task starts with an unchecked checkbox and a unique sequential ID. `[P]` is
used only where listed files and unfinished dependencies are disjoint. User-story
tasks carry exactly one `[USn]` label. Paths are repository-relative and literal.
Mark a task complete only after its stated evidence has been produced and recorded.

## Binding Implementation Boundaries

- `config/selection-rules.yaml` is the sole human-edited selection configuration.
  It is server-only, versioned, bundled byte-for-byte into both Edge artifacts, and
  parsed once during module initialization. No environment override, request-time
  read, watcher, hot reload, admin/config UI, runtime configuration service, or
  participant setting is allowed.
- The initial historical generation was `vote_count_desc` with vote count `500`.
  The current `config/selection-rules.yaml` uses `popularity_desc`, minimum vote
  count `100`, no rating cutoff, `en-US`, genre mode `or`, and exact agreement
  `2/3`. No rating cutoff is encoded by field omission, never explicit YAML
  `null`. These remain editable operational values rather than product constants.
- PostgreSQL atomically owns room, creator membership, and one immutable protected
  snapshot. Existing rooms receive the exact `legacy_005_006_008` tuple; absence or
  inconsistency never means legacy and is never repaired from startup YAML.
- One migration, `supabase/migrations/20260920000000_selection_rules_candidate_ordering.sql`,
  contains the complete schema/RPC cutover. No historical migration is edited.
- Feature 008 prepare → search outside locks → expected-sequence candidate/empty
  commit remains authoritative. Complete server-derived occurrence history is the
  exclusion set; no cursor, deck, page offset, or process-rule fingerprint persists.
- TMDB numeric evidence is conditional on the retained rules: require `vote_count`
  for its cutoff/order, `vote_average` for its cutoff/order, and `popularity` for its
  order. Required missing/malformed evidence makes the attempt `search_incomplete`;
  irrelevant missing/malformed metrics do not invalidate an otherwise valid result.
- Agreement uses normalized integer `p/q` and PostgreSQL `bigint` ceiling arithmetic,
  with N=2 forced to 2 and resolution only at N/N. Clients consume the returned
  integer threshold and never calculate or display the fraction.
- Run `npm run db:types` exactly once only after the complete migration, public RPC
  surface, and all schema-affecting database tests are stable and green. Every later
  generated-type command is `npm run db:types:check` only.
- Exhaustive YAML, migration, arithmetic, genre, cutoff, ordering, pagination,
  shard, race, and failure evidence stays below Playwright wherever possible.
- Charged browser work is forbidden until the exact-source deterministic gate is
  green. M01/M02 use exactly six identities; every charged block requires fresh R02
  admission and counts failed, partial, manual, and replacement attempts.
- Stop at Feature 009. Do not add Feature 010 Discovery or Feature 011 Match,
  early resolution,
  alternate sources, recommendation/catalog state, dynamic membership, or rule UI.

## Phase 1: Setup — Baseline and Evidence Ledger

**Goal**: Record reproducible provenance, protected user-owned work, configuration
authority, migration/type hashes, and browser budget before runtime changes.

- [X] T001 Capture branch/HEAD/status, declared and actual Node/npm/Supabase/Deno versions, hashes of every historical migration through `supabase/migrations/20260918000000_candidate_progression.sql` and `src/types/database.generated.ts`, the current browser inventory, approved initial canonical YAML values and restart-only mutability, planned migration/type sequence, and R02 formulas `23`, `22`, `45`, `17`, and `62` in `specs/009-selection-rules-candidate-ordering/quickstart.md`; record that Feature 009 runtime code, `config/selection-rules.yaml`, the new migration, generated-type write, charged tests, and Feature 010 have not started.

**Checkpoint**: Baseline provenance and limits are recorded; no product behavior,
database schema, generated type, or browser quota has changed.

---

## Phase 2: Foundational — Shared Failing Contracts and Upgrade Fixtures

**Goal**: Establish disjoint failing evidence and protected nonempty fixtures needed
by multiple stories before the one coherent cutover is implemented.

**Critical**: These tasks add tests/fixtures only. They must not create the migration,
canonical YAML, runtime parser, handler, or generated-type change.

- [X] T002 [P] Create shared accepted/rejected configuration vectors in `supabase/functions/_tests/fixtures/selection-rules.ts` covering every field, approved omission, malformed YAML class, duplicate/unknown key, range/type/enum/language error, exact fraction reduction, and safe diagnostic code without assigning a deployed numeric cutoff or language default.
- [X] T003 [P] Create failing schema/catalog/ACL/publication tests in `supabase/tests/database/selection_rules.test.sql` for the one-to-one private snapshot relation, exact legacy/configured row checks, immutability, service-only creation, no direct authenticated create escape, and rooms-only Realtime.
- [X] T004 [P] Create owned pre-Feature-009 fixtures in `supabase/tests/migration/selection_rules.before.sql` spanning waiting, assembled, partial/frozen filters, pending/compatible/incompatible resolution, initial no-candidates, collecting, advancing with history, agreed, and exhausted rooms; snapshot bounded values, timestamps, and applicable `xmin` without GoTrue signups.
- [X] T005 [P] Create post-upgrade assertions in `supabase/tests/migration/selection_rules.after.sql` for exactly one exact legacy tuple per old room, unchanged preexisting state, new configured room atomicity, direct-create retirement, grants/RLS/publication, all consumer integrity behavior, and owned-fixture cleanup.
- [X] T006 Create the failing protected-runner contract in `scripts/check-selection-rules-migration.mjs`: reject arguments, hash all historical migrations and canonical generated types, reset exactly through Feature 008, load T004, apply only the pending Feature 009 migration, run T005, prohibit TMDB/GoTrue/type generation, suppress fixture data, and restore a clean latest reset on success, failure, or interruption.
- [X] T007 [P] Create failing static/server-only boundary tests in `__tests__/config/feature009-boundaries.test.ts` for no client import/projection of YAML or rules, no Match/config/admin UI, no selection-rule environment key, and no unsafe configuration text in diagnostics/artifacts.

**Checkpoint**: Cross-story contracts are RED for the intended missing Feature 009
behavior and fixtures are ready; no implementation has started.

---

## Phase 3: User Story 1 — Start Only with a Valid Rule Configuration (Priority: P1) 🎯 MVP

**Goal**: Make the repository YAML the only server configuration, strictly validate
it at module initialization, bundle it into both Edge artifacts, and freeze one
normalized generation until successful restart/redeploy.

**Independent Test**: Run pure parser, module-construction, and deployment-shaped
packaging tests over all valid/invalid vectors; invalid input serves no handler,
editing source bytes does not mutate a running module, and only reconstruction from
a changed bundle yields the next generation.

### Failing tests

- [X] T008 [P] [US1] Create failing strict YAML/parser tests in `supabase/functions/_tests/selection-rules.test.ts` using T002 for missing/empty/malformed/multi-document YAML, duplicate keys, aliases/anchors/custom tags, non-mapping roots, unknown keys, explicit nulls, exact enums/ranges/fractions/languages, approved omissions, normalization, deep freezing, and safe fixed errors.
- [X] T009 [P] [US1] Create failing module-start tests in `supabase/functions/_tests/selection-rules-startup.test.ts` proving parse-before-handler construction, identical initialization for `room-create` and `room-candidate`, no last-known-good/environment/request override, no request-time reread, and restart-only generation changes.
- [X] T010 [P] [US1] Create failing packaging tests and local/deployment artifact probes in `scripts/check-selection-rules-config.mjs` for one canonical file, exact bundled bytes in both functions, missing/divergent asset failure, credentials-only env files, and absence from Expo/client artifacts.

### Implementation

- [X] T011 [US1] Add the pinned server YAML parser dependency and deterministic zero-identity config commands/permissions to `package.json` and `package-lock.json`, ensuring the dependency is imported only below `supabase/functions/` and never by client code.
- [X] T012 [US1] Add canonical server-only `config/selection-rules.yaml` with the approved initial operational values: `minimum_vote_count: 500`, `metadata_language: en-US`, `ordering: vote_count_desc`, `genre_mode: or`, and `larger_group_agreement: 2/3`; omit `minimum_average_rating` to represent no cutoff because explicit YAML `null` is invalid. Record that later YAML edits plus successful restart/redeploy affect only newly created room snapshots.
- [X] T013 [P] [US1] Add the source-attributed canonical TMDB primary-translation allow-list and its provenance/update guard in `supabase/functions/_shared/tmdb-primary-translations.ts` and `supabase/functions/_tests/tmdb-primary-translations.test.ts`.
- [X] T014 [US1] Implement strict YAML document parsing, closed-key/value validation, exact BigInt `p/q` reduction, canonical language validation, safe diagnostics, and deep-frozen normalized output in `supabase/functions/_shared/selection-rules.ts`.
- [X] T015 [US1] Implement one-time bundled-file loading in `supabase/functions/_shared/selection-rules-config.ts` and configure exact static-asset inclusion for `room-create` and `room-candidate` in `supabase/config.toml`; reject missing/divergent assets and expose no reload API.
- [X] T016 [US1] Wire startup initialization into `supabase/functions/room-candidate/index.ts` and the planned `supabase/functions/room-create/index.ts` module boundary so invalid YAML prevents handler construction while candidate requests still obtain room rules only from private preflight.
- [X] T017 [US1] Run and record the focused YAML vectors, module-start suite, `node scripts/check-selection-rules-config.mjs`, static server-only boundary tests, lint/typecheck, and `git diff --check` in `specs/009-selection-rules-candidate-ordering/quickstart.md`, including deliberate owner values by approval reference but never raw configuration in logs.

**Checkpoint US1**: Canonical YAML lifecycle and strict startup failure are green
without any browser identity; no room snapshot behavior is claimed yet.

---

## Phase 4: User Story 2 — Retain Each Room's Effective Rules (Priority: P1)

**Goal**: Backfill every old room with explicit legacy behavior and atomically create
every new room with the frozen startup generation through a trusted Edge boundary.

**Independent Test**: Run clean and protected nonempty upgrades plus A/B module and
idempotency tests; old rooms have the legacy tuple, rooms created under A retain A,
new rooms after B receive B, and retries/client input cannot replace either.

### Failing tests

- [X] T018 [P] [US2] Complete failing database behavior tests in `supabase/tests/database/selection_rules.test.sql` for row constraints, exact legacy/configured tuples, room/member/snapshot atomicity, immutable/no-repair semantics, service-only idempotent A/B creation races, missing/corrupt fail-closed reads, and deny-by-default table/function access.
- [X] T019 [P] [US2] Create failing `room-create` request/auth/response/startup/idempotency/error tests in `supabase/functions/_tests/room-create.test.ts`, including exact three-field body, verified JWT actor, no rule input, A-response loss/B retry, fixed safe errors, and zero raw config leakage.
- [X] T020 [P] [US2] Create failing strict create-transport and recovery tests in `__tests__/rooms/contracts.test.ts` and `__tests__/rooms/service.test.ts` for the object response, unchanged safe room fields, duplicate recovery, invalid shape failure, and no direct database create fallback.
- [X] T021 [P] [US2] Add failing A/B/legacy consumer tests in `supabase/tests/database/common_filter_resolution.test.sql`, `supabase/tests/database/tmdb_candidate_source.test.sql`, and `supabase/tests/database/candidate_progression.test.sql` proving every operation reads its retained row and missing/incoherent rules never use current startup configuration.

### Single migration and trusted creation

- [X] T022 [US2] Create `private.room_selection_rules`, exact kind/field/check/index invariants, RLS/ownership/revokes, immutable access model, and one-to-one room relationship in `supabase/migrations/20260920000000_selection_rules_candidate_ordering.sql` without editing historical migrations or publishing the table.
- [X] T023 [US2] Add traffic-cutover locking, integrity prechecks, and one exact `legacy_005_006_008` insert for every existing room to `supabase/migrations/20260920000000_selection_rules_candidate_ordering.sql`, preserving every existing room/member/filter/resolution/occurrence/decision value and timestamp.
- [X] T024 [US2] Add the postgres-owned service-role-only idempotent create-with-actor-and-normalized-snapshot function and retire the old authenticated direct create signature in `supabase/migrations/20260920000000_selection_rules_candidate_ordering.sql`; preserve bounded room-code allocation and safe result fields, return an existing winner with zero writes, and never repair/compare its snapshot.
- [X] T025 [US2] Add private coherent-snapshot validation helpers and fail-closed integration points for resolver, source prepare/commit, and decision operations in `supabase/migrations/20260920000000_selection_rules_candidate_ordering.sql`, while leaving story-specific genre/order/arithmetic logic to US3–US5.
- [X] T026 [US2] Implement authenticated `room-create` in `supabase/functions/room-create/index.ts` using the frozen module configuration, verified JWT subject, service-role RPC, exact request/response contract, and fixed privacy-safe errors.
- [X] T027 [US2] Replace direct create transport and strict parsing in `src/rooms/contracts.ts` and `src/rooms/service.ts` without exposing rule fields or changing join/refetch/Realtime behavior.
- [X] T028 [US2] Finish the protected nonempty runner in `scripts/check-selection-rules-migration.mjs` and latest-schema compatibility assertions in `scripts/check-room-membership-migration.mjs`, `scripts/check-participant-filters-migration.mjs`, `scripts/check-common-filter-resolution-migration.mjs`, `scripts/check-tmdb-candidate-migration.mjs`, `scripts/check-swipe-decisions-migration.mjs`, and `scripts/check-candidate-progression-migration.mjs`; require byte-identical historical migrations and generated types.
- [X] T029 [US2] Run and record the Feature 009 protected nonempty runner, all six earlier nonempty runners, clean reset, focused selection-rule DB tests, room-create Edge tests, and create client tests in `specs/009-selection-rules-candidate-ordering/quickstart.md`; keep `src/types/database.generated.ts` byte-identical and do not run type generation.

**Checkpoint US2**: Every room has one protected immutable classification and the
trusted create path snapshots one frozen generation atomically. The migration is not
yet schema-final; generated types remain untouched.

---

## Phase 5: User Story 3 — Apply Consistent Candidate Eligibility (Priority: P1)

**Goal**: Compile Any/OR/AND voter filters into one canonical anonymous predicate and
apply the same inclusive cutoff/year/content meaning in resolution, Edge search, and
locked commit validation.

**Independent Test**: Controlled DB and Deno matrices agree on Any, OR, AND,
multi-voter clauses, year boundaries, vote/rating equality and just-below values,
and reject any handoff/materialization disagreement.

### Failing tests

- [X] T030 [P] [US3] Add failing resolver/handoff tests in `supabase/tests/database/common_filter_resolution.test.sql` for Any neutrality, OR multi-value clauses, AND singleton clauses, deterministic ordinals, AND across fixed voters, non-voter exclusion, unchanged inclusive year intersection, and exact recomputation from frozen filters plus retained mode.
- [X] T031 [P] [US3] Add failing cutoff/genre parity tests in `supabase/tests/database/tmdb_candidate_source.test.sql` for vote/rating equality and just-below values, conditionally required cutoff evidence, absent rating cutoff accepting omitted vote-average evidence, year/adult rules, every canonical clause, malformed required evidence, stale materialization, and locked commit rollback.
- [X] T032 [P] [US3] Add failing strict provider/eligibility tests in `supabase/functions/_tests/tmdb-eligibility.test.ts` for the conditional metric requirement union (`vote_count` cutoff/order, `vote_average` cutoff/order, `popularity` order), paired missing and malformed required-versus-irrelevant vectors for every ordering/cutoff mode including legacy, Any/OR/AND/every-voter predicates, cutoff boundaries, deterministic comma/pipe narrowing, and database-parity vectors; require required defects to return `search_incomplete` and irrelevant defects not to invalidate an otherwise valid candidate/search.

### Implementation

- [X] T033 [US3] Evolve resolver clause compilation and `private.valid_tmdb_candidate_handoff` recomputation in `supabase/migrations/20260920000000_selection_rules_candidate_ordering.sql` to use the locked room snapshot, emit canonical OR/AND/Any clauses, retain AND across voters, and fail closed on any mismatch.
- [X] T034 [US3] Implement retained-rule-derived conditional metric parsing, exact local eligibility, canonical clause evaluation, and no-false-negative genre pushdown in `supabase/functions/_shared/tmdb-eligibility.ts` and `supabase/functions/_shared/candidate-contracts.ts`; fail the attempt for required metric defects and ignore irrelevant metric defects.
- [X] T035 [US3] Extend locked candidate commit validation in `supabase/migrations/20260920000000_selection_rules_candidate_ordering.sql` with transient vote-count/rating evidence required only by the retained cutoffs, plus years, adult flag, canonical clauses, and complete no-repeat history without persisting metrics or requiring comparator-only evidence.
- [X] T036 [US3] Add shared cross-layer accepted/rejected parity fixtures in `supabase/functions/_tests/fixtures/candidate-eligibility.ts` and consume them from `supabase/functions/_tests/tmdb-eligibility.test.ts` and `supabase/tests/database/tmdb_candidate_source.test.sql` so OR/AND and cutoff semantics cannot drift.
- [X] T037 [US3] Run and record focused resolver, handoff, commit, and Deno eligibility suites plus the Feature 005/006 regression sets and check-only historical/type hashes in `specs/009-selection-rules-candidate-ordering/quickstart.md`.

**Checkpoint US3**: Resolution, retrieval validation, and final commit share one
room-retained eligibility meaning; ordering and exact agreement remain subsequent
slices.

---

## Phase 6: User Story 4 — Receive Candidates in the Configured Order (Priority: P1)

**Goal**: Select the globally correct eligible unseen candidate for all four modes
across provider pages and deterministic date shards while preserving Feature 008 CAS,
no-repeat history, stable identity, and source-failure semantics.

**Independent Test**: Deterministic provider fixtures prove all four primary orders,
tie handling, cutoff/exclusion skipping, page/shard global winners, retry, assigned
metadata recovery, and no commit from any incomplete traversal.

### Failing tests

- [X] T038 [P] [US4] Add failing query/result tests in `supabase/functions/_tests/tmdb-search.test.ts` for exact Discover parameters for four configured modes and legacy, retained language, inclusive dates, mandatory vote and optional rating cutoffs, adult/video flags, and the full deterministic metric matrix: vote-count order/cutoff, average-rating order/cutoff, popularity order, title order with and without rating cutoff, and legacy; for every mode pair missing and malformed required metrics (`search_incomplete`, never exhaustion) against the same defects in irrelevant metrics (otherwise valid candidate/search remains complete), plus malformed required non-metric/page rejection.
- [X] T039 [US4] After T038, add failing comparator/traversal tests in `supabase/functions/_tests/tmdb-search.test.ts` for four total comparators, NFC/collator title behavior, TMDB-ID secondary determinism, ascending page/result traversal, ID deduplication, numeric equal-primary completion, full title traversal, >500-page bisection, cross-shard global winners, single-day overflow, request/deadline budgets, and required-child failure propagation.
- [X] T040 [P] [US4] Add failing orchestration tests in `supabase/functions/_tests/room-candidate.test.ts` for private rule preflight, ordered exclusions, top ineligible/excluded skipping, prepare/search/expected-sequence commit, proposal/proposal and proposal/empty races, response loss, assigned Details language, metadata identity stability, and `search_incomplete` versus `completed_empty`.
- [X] T041 [P] [US4] Complete failing source prepare/commit tests in `supabase/tests/database/tmdb_candidate_source.test.sql` and `supabase/tests/database/candidate_progression.test.sql` for exact private fields/nullability, exclusions ordered by sequence, cutoff evidence, same-step winner adoption, stale/no-write branches, initial empty/exhausted CAS, agreed stop, and no cursor/order state.

### Implementation

- [X] T042 [US4] Evolve service-only source prepare and candidate commit functions in `supabase/migrations/20260920000000_selection_rules_candidate_ordering.sql` to return the retained rule constraint, preserve unlocked authorization precheck then authorized room lock/revalidation, accept transient cutoff evidence, and retain exact expected-sequence/no-repeat CAS shapes.
- [X] T043 [US4] Implement exact configured/legacy Discover URL construction and retained-rule-derived result/page parsing in `supabase/functions/_shared/tmdb-client.ts`, including retained language for Discover and Details, no fallback for missing/malformed required metrics, and no failure for irrelevant metric defects.
- [X] T044 [US4] Implement four total comparators and deterministic candidate evidence normalization in `supabase/functions/_shared/tmdb-eligibility.ts`, keeping the TMDB-ID secondary rule internal and making no product promise among equal-primary ties.
- [X] T045 [US4] Implement bounded ordered page/date-shard traversal in `supabase/functions/_shared/tmdb-client.ts`: compare every required shard winner, enumerate title pages completely, stop numeric modes only after the full best-primary run, propagate incomplete children, and return only `match`, `completed_empty`, or `search_incomplete`.
- [X] T046 [US4] Integrate snapshot-only ordered traversal, complete Feature 008 exclusions, candidate/empty CAS, same-step winner adoption, and retained-language assigned/new Details in `supabase/functions/room-candidate/index.ts`; perform no database lock during TMDB I/O and never consult startup YAML after preflight.
- [X] T047 [US4] Extend the deterministic TMDB stub and harness controls in `e2e/support/tmdb-stub.ts` and `e2e/support/candidate-harness.ts` for configured metrics/languages, pages, shards, ties, failures, complete empty traversal, and ordered occurrence history without exposing protected IDs in artifacts.
- [X] T048 [US4] Run and record the four-order, cutoff, tie, page, shard, exclusion, CAS, source-failure/exhaustion, assigned-metadata, and legacy Feature 006/008 regression suites plus the live zero-identity TMDB contract in `specs/009-selection-rules-candidate-ordering/quickstart.md`; do not use the live provider as the deterministic oracle.

**Checkpoint US4**: Each source step proves a globally ordered eligible unseen winner
or a complete empty result; incomplete work performs no terminal commit.

---

## Phase 7: User Story 5 — Resolve Agreement with the Room's Exact Fraction (Priority: P1)

**Goal**: Derive one threshold from the retained exact rational row under the room
lock and preserve Feature 008 N/N-only, immutable-decision, one-outcome sequencing.

**Independent Test**: Parameterized PostgreSQL/dblink tests cover N=2..10, multiple
fractions including reduced equivalents, threshold-minus-one/threshold, incomplete
inevitable/impossible sets, arrival order, duplicate/lost responses, and final-voter
races; client tests accept only coherent server thresholds.

### Failing tests

- [X] T049 [P] [US5] Add failing exact-arithmetic/full-set tests in `supabase/tests/database/candidate_progression.test.sql` and `supabase/tests/database/swipe_decisions.test.sql` for N=2 forced threshold 2, N=3..10 `ceil(N*p/q)` using bigint, default `2/3` vector `2,3,4,4,7`, equivalent fractions, component/range corruption, threshold-minus-one/threshold, fixed voters only, and no early inevitable/impossible result.
- [X] T050 [US5] After T049, add failing dblink tests in `supabase/tests/database/candidate_progression.test.sql` for last-voter races, arrival-order independence, duplicate/conflict/replay/response loss, A/B fraction retention, stale post-agreement actions, and exactly one agreed or advancing outcome under the same locked snapshot.
- [X] T051 [P] [US5] Add failing client threshold tests in `__tests__/decisions/contracts.test.ts`, `__tests__/decisions/service.test.ts`, and `__tests__/decisions/state.test.ts` for arbitrary valid server integers, N=2 exactly 2, nullability, generation consistency, fail-closed invalid shapes, and zero client `2/3` recomputation/fraction display.

### Implementation

- [X] T052 [US5] Replace the fixed threshold helper with snapshot-derived exact bigint ceiling arithmetic and integrate it into both decision RPCs under the existing authorized room lock in `supabase/migrations/20260920000000_selection_rules_candidate_ordering.sql`; validate normalized row invariants, keep N=2 fixed, wait for N/N, and expose only the derived integer.
- [X] T053 [US5] Update strict server-threshold parsing and generation consistency in `src/decisions/contracts.ts` and `src/decisions/state.ts` without adding fraction calculations, threshold UI, early resolution, decision editing, or post-agreement progression.
- [X] T054 [US5] Run and record parameterized arithmetic, full-set, dblink race/retry, A/B retention, decision privacy, and focused client threshold suites plus Feature 007/008 regressions in `specs/009-selection-rules-candidate-ordering/quickstart.md`.

**Checkpoint US5**: Every room resolves one complete decision set using exact retained
integer arithmetic; all SQL behavior/signatures are now ready for final hardening.

---

## Phase 8: User Story 6 — Preserve Authority, Privacy and Failure Meanings (Priority: P2)

**Goal**: Close authorization/privacy gaps, preserve canonical recovery and stable
candidate identity, and prove incomplete source work can never masquerade as true
exhaustion under any retained rule set.

**Independent Test**: DB/Edge/client tests distinguish every safe outcome, deny all
unauthorized/cross-room rule and state access, preserve assigned/agreed identity under
failure/stale work, and recover one outcome through reload/reconnect/re-entry.

### Failing tests

- [X] T055 [P] [US6] Add failing role/catalog/lock-queue/privacy tests in `supabase/tests/database/selection_rules.test.sql`, `supabase/tests/database/common_filter_resolution.test.sql`, `supabase/tests/database/tmdb_candidate_source.test.sql`, and `supabase/tests/database/candidate_progression.test.sql` for anon/authenticated/service roles, foreign/cross-room masking, non-voter limits, unlocked authorization prechecks, no protected table/column/Realtime disclosure, and corruption rollback with no startup-rule repair.
- [X] T056 [P] [US6] Add failing exhaustive failure-taxonomy tests in `supabase/functions/_tests/room-candidate.test.ts` for request/provider/parse/required-metric/page/order/shard/budget/deadline failure, irrelevant malformed metrics remaining non-failures, required-metric failure never becoming authoritative exhaustion, partial match plus child failure, true completed empty, response loss/retry, assigned metadata failure, agreed stale work, and zero fallback weakening.
- [X] T057 [P] [US6] Add failing recovery/privacy/scope tests in `__tests__/rooms/state.test.ts`, `__tests__/rooms/use-room-subscription.test.ts`, `__tests__/candidates/state.test.ts`, `__tests__/candidates/use-room-candidate.test.ts`, `__tests__/routes/room.test.tsx`, and `__tests__/config/feature009-boundaries.test.ts` for reload/reconnect/re-entry, sequence-aware stale suppression, one rooms-only channel/refetch truth, understandable safe failures, and no rules/private values/early resolution/Match UI.

### Implementation and hardening

- [X] T058 [US6] Finalize grants, owners, empty search paths, function execution, fixed integrity errors, unlocked authorization prechecks, under-lock reauthorization, rooms-only publication, and PostgREST reload in `supabase/migrations/20260920000000_selection_rules_candidate_ordering.sql`; add no public rule column, cursor, metric history, catalog, or second source.
- [X] T059 [US6] Harden `supabase/functions/room-create/index.ts`, `supabase/functions/room-candidate/index.ts`, and `supabase/functions/_shared/candidate-contracts.ts` so all startup/source/internal failures map to fixed safe outcomes, `search_incomplete` writes nothing, only `completed_empty` calls empty CAS, and logs never contain YAML, rules, predicates, provider payloads, credentials, or protected IDs.
- [X] T060 [US6] Preserve canonical refetch, sequence/generation merging, assigned identity, retry affordance, and neutral agreed/exhausted presentation in `src/rooms/state.ts`, `src/rooms/use-room-subscription.ts`, `src/candidates/state.ts`, `src/candidates/use-room-candidate.ts`, and `app/room/[code].tsx` without adding rule display/configuration or Feature 010 behavior.
- [X] T061 [US6] Run and record focused ACL/RLS/catalog/lock-queue, corruption, failure/exhaustion, safe-error, recovery, stale-state, client scope, and full Feature 003–008 regression suites in `specs/009-selection-rules-candidate-ordering/quickstart.md`, with zero browser identities and generated types still unchanged.

**Checkpoint US6**: All six user stories work under the final migration and safe
runtime boundaries. No schema/signature change is permitted after the next phase's
freeze and sole generated-types write.

---

## Phase 9: Polish and Cross-Cutting Acceptance — Types, Builds, Browser, and Reconciliation

**Goal**: Freeze the cutover, write generated types once, prove every later gate is
check-only, run deterministic and admitted browser evidence, and reconcile the
complete feature without beginning Feature 010.

### Freeze the SQL surface and perform the one legitimate type write

- [X] T062 Run all seven protected nonempty migration runners, a clean `npm run db:reset`, and the final full `npm run db:test` matrix; record clean/nonempty preservation, exact legacy/configured counts, all RPC signatures/nullability/grants, deterministic races, and historical/type hashes in `specs/009-selection-rules-candidate-ordering/quickstart.md`, and freeze the migration/public function surface before type generation.
- [X] T063 Perform the sole intentional `npm run db:types` write, update exact schema/RPC assertions in `__tests__/config/database-types.test.ts`, immediately run `npm run db:types:check`, review only expected Feature 009 public changes in `src/types/database.generated.ts`, and record hash/inode/size/timestamps plus the one-write receipt in `specs/009-selection-rules-candidate-ordering/quickstart.md`.
- [X] T064 From an independent clean latest reset run only `npm run db:types:check`, require byte-identical hash and unchanged inode/size/timestamps for `src/types/database.generated.ts`, and record the check-only receipt in `specs/009-selection-rules-candidate-ordering/quickstart.md`; every subsequent task is permanently check-only.

### Browser profile and safe harnesses

- [X] T065 [P] Add exact Feature 009 profile assertions in `__tests__/config/feature009-e2e-profile.test.ts`, `package.json`, `playwright.config.ts`, and `scripts/run-e2e.mjs` for only M01/M02, exact receipts `2+4=6`, workers 1, retries 0, repeat 1, capture off, targeted historical `T=0`, and no hidden/manual identities.
- [X] T066 [P] Implement M01 and M02 in `e2e/selection-rules-candidate-ordering.spec.ts`: M01 reuses two voter identities for Edge create, fixed 2/2, configured order/cutoff, distinct successor, reload, failure versus exhaustion, and no Match/config UI; M02 reuses one non-voting creator plus three voters for exact fraction/no-early behavior, AND/every-voter decoy, localized order, convergence/privacy, then the same four identities for the N=4 boundary.
- [X] T067 [P] Extend `e2e/support/room-harness.ts`, `e2e/support/decision-harness.ts`, `e2e/support/progression-harness.ts`, `e2e/support/candidate-harness.ts`, and `e2e/support/safe-diagnostics.ts` for Edge-backed create, retained-rule fixture control at restart boundaries, exact-threshold observations, source failure/complete-empty control, ordinary-JWT privacy probes, five-second convergence, and no raw YAML/rules/protected IDs in artifacts.
- [X] T068 Update permanent G03/G04/G05/G08/H01 creation transport beneath unchanged UI and assertions in `e2e/generalized-room-membership-qr.spec.ts`, `e2e/participant-filters.spec.ts`, `e2e/common-filter-resolution.spec.ts`, `e2e/diagnostics/credential-safety.spec.ts`, and `e2e/room-session.spec.ts`; preserve exactly 16 smoke identities and add no separate historical Feature 006/008 case.

### Deterministic gate before any charged browser execution

- [X] T069 Run and record the final non-browser gate in `specs/009-selection-rules-candidate-ordering/quickstart.md`: configuration packaging/startup harness, all seven nonempty runners, clean reset/full DB including races and ACL/privacy, full Edge plus live TMDB contract, full client/config/static/security suites, `npm run db:types:check` only, lint, typecheck, web export, applicable iOS/Android exports, `git diff --check`, finalized-artifact/credential scan, exact commands/versions/results, and justified omissions; do not start T070 unless every relevant gate is green at the exact source state.

### Charged browser gates — fresh R02 admission immediately before each block

- [X] T070 Obtain and record a fresh rolling-window R02 admission immediately before the normal charged block, reserving exactly 23 identities, then run only safe wrappers for C1 once, `npm run test:e2e:feature009`, and `npm run test:e2e:smoke`; require exact formula `C1 1 + smoke 16 + F 6 + T 0 = 23`, treat it as repeatability run one, require M01/M02 exact six-identity receipts, scanner zero, Auth success, five-second convergence, no scope/UI violations, owned cleanup, and record every failed/partial/manual/replacement attempt in `specs/009-selection-rules-candidate-ordering/quickstart.md`.
- [X] T071 At unchanged source and stack after T070, obtain and record new R02 admission immediately before repeatability run two, reserve exactly 22 additional identities, and run `npm run test:e2e:feature009` plus `npm run test:e2e:smoke` once with fresh case identities; do not rerun C1, enforce `smoke 16 + F 6 = 22` and cumulative `23 + 22 = 45`, require identical source/profile, scanner/cleanup zero, and run only `npm run db:types:check`. The post-run type-check failure was isolated to the managed-home Supabase CLI telemetry environment; the check wrapper now supplies the repository-safe telemetry-disabled temporary XDG configuration, the canonical artifact remains unchanged, and the existing charged receipts remain valid because browser-relevant implementation/harness/profile source was unchanged.
- [X] T072 At the exact implementation SHA in an independent disposable checkout, complete install, credentials-only local setup, deliberate canonical YAML provisioning, Playwright setup, all seven nonempty migrations, clean reset/full DB/Edge/client/config/static/security tests, check-only types, lint/typecheck/web/native exports, packaging and artifact scans before any browser command; then obtain separate fresh R02 admission, reserve exactly 17 identities, run C1 plus permanent smoke only, require `1 + 16 = 17` and cumulative repeatability-plus-fresh `45 + 17 = 62`, and record no copied modules/env/Auth/DB/browser state plus owned cleanup in `specs/009-selection-rules-candidate-ordering/quickstart.md`.

### Final completion gate

- [X] T073 Update and reconcile the normative `docs/testing-strategy.md` Feature 009 profile before final acceptance: record M01 as 2 identities, M02 as 4, owner total 6, normal checkpoint 23, additional repeatability 22, cumulative repeatability 45, fresh checkout 17, repeatability plus fresh checkout 62, projected/final full acceptance inventory 48 cases and 118 identities, and full inventory plus C1 as 119; preserve safe-wrapper, admission, capture, cleanup, targeted `T=0`, and failed/partial/manual-attempt accounting, and record the exact documentation reconciliation in `specs/009-selection-rules-candidate-ordering/quickstart.md` without running another charged block.
- [X] T074 After T073, perform and record the final audit in `specs/009-selection-rules-candidate-ordering/quickstart.md` against the constitution, `spec.md`, `plan.md`, `research.md`, `data-model.md`, `requirements-traceability.md`, every contract, `tasks.md`, the reconciled `docs/testing-strategy.md`, the implementation diff, and all evidence: reconcile FR-001–FR-040, NFR-001–NFR-009, SC-001–SC-011, scenarios 1–43, and US1–US6 to implementation plus executable proof; verify canonical server-only YAML and restart-only activation, one immutable snapshot per room and explicit legacy tuple, conditional required-versus-irrelevant TMDB metric semantics, exact rational math, four-mode global order, Feature 008 CAS/history, failure/exhaustion distinction, one generated-types write, exact `23/22/45/17/62` R02 receipts and `48/118 + C1 = 119` inventory, and zero unresolved blocker, historical migration edit, later type write, unadmitted browser block, leaked rule/private data, fallback weakening, hot reload/config UI/service, Feature 010/Match behavior, or unrecorded required failure before declaring Feature 009 complete.

**Final checkpoint / release boundary — T074**: The exact source state has complete
40/9/11/43/6 traceability, deterministic lower-layer authority evidence, admitted
six-identity owner acceptance, repeatability, fresh-checkout proof, and no Feature 010
work.

---

## Post-G5 Regression Recovery — Numeric Candidate Traversal

The T070–T074 receipts above remain immutable historical evidence for the source they
tested. Manual validation on 2026-09-22 reopened Feature 009 after the configured
numeric source exhausted its request budget while traversing lower-ranked pages that
were not needed to prove the first winner.

- [X] T075 Reconstruct and record the old traversal, exact `1955-01-01` through
  `2020-12-31` partition root, serial 100-request/20-second budget, `count: 0` log
  meaning, official TMDB Discover capabilities, and a controlled 120-page
  reproduction yielding `request_budget` at 100 requests/15,260 simulated
  milliseconds while the page-one global winner requires 120 requests under the old
  exhaustive algorithm.
- [X] T076 Add the deterministic regression matrix and implement the smallest source
  correction in `supabase/functions/_shared/tmdb-client.ts` and its source contract:
  use the broad provider-sorted traversal for configured numeric modes, locally
  validate every inspected result, complete primary ties across page boundaries,
  preserve the smaller-ID secondary rule, keep title comparison exhaustive, retain
  adaptive date shards for overflow/empty proof, and preserve incomplete-versus-empty
  semantics, exclusions, cutoffs and Feature 008 CAS.
- [X] T077 Run and record the complete non-charged recovery gate: ordered-source and
  room-candidate Edge suites, controlled failure/exhaustion and all-order matrix,
  client/config/static/security checks, no-repeat/CAS and database regressions when
  applicable, all protected migration guards, check-only database types, lint,
  typecheck, YAML packaging, privacy/artifact scans and `git diff --check`. Do not
  regenerate types or run Playwright.
- [X] T078 Restore the current-source normal checkpoint after a fresh R02 admission:
  restore and prove the configured local Supabase/GoTrue target with a zero-identity
  preflight, run the check-only type and runtime/privacy gates, reserve exactly 23
  identities, and execute C1, M01/M02 owner acceptance, and permanent smoke once in
  fail-fast order. Record the exact current-source manifest, receipts, Auth/scanner/
  cleanup/runtime/provider state, and final R02 state. The next repeatability,
  independent fresh-checkout, reconciliation, and final-audit recovery is separate;
  Feature 010 remains blocked.
- [X] T079 At the unchanged T078 current source and stack, obtain a fresh authoritative
  R02 admission for the complete repeatability run-two block, reserve exactly 22
  identities (`M01 2 + M02 4 + permanent smoke 16`), run owner acceptance once and
  permanent smoke once in fail-fast order without C1, run only the check-only
  generated-types gate afterward, and record the unchanged source manifest, exact
  22-identity consumption, receipts, scanner/Auth/cleanup/HTTP-429/provider/runtime
  state, final R02 state, and normative `23 + 22 = 45` accounting. Do not start the
  current-source fresh-checkout, reconciliation, final-audit, or Feature 010 work.

**Recovery checkpoint**: T070–T074 remain historically complete but do not certify
the changed source. T078 current-source run one and T079 current-source repeatability
run two are complete at this recovery boundary. Feature 009 stays REOPENED as
directed; the exact next recovery task was the current-source fresh-checkout
recovery (T072-equivalent), followed later by reconciliation and final audit. Feature
010 remains unstarted.

- [X] T080 At the exact current-source candidate, certify an independent disposable
  fresh checkout with the dynamic owned Supabase runtime: prove the 144-file source
  manifest and candidate commit/tree, clean-checkout isolation, fresh `0/0/0`
  baseline, all seven protected nonempty migration runners, clean reset/database
  suite, Edge/source-failure/exhaustion/TMDB traversal regressions, client/config/
  static/privacy suite, check-only generated types, lint/typecheck/exports,
  packaging/artifact scans and `git diff --check`; obtain fresh R02 admission only
  after that block is green; run C1 once and permanent G03/G04/G05/G08/H01 smoke
  once for exactly `1 + 16 = 17` identities; preserve safe receipts and scanner,
  Auth, cleanup, HTTP-429, provider/runtime and shared-stack proofs; remove only
  owned checkout/runtime/cache/config resources; leave Feature 009 REOPENED and
  Feature 010/reconciliation/final audit unstarted.

**Recovery checkpoint**: T070–T074 remain historical evidence for their original
source. T078 and T079 certify current-source repeatability at `23 + 22 = 45`, and
T080 certifies the independent current-source fresh checkout at `17`; combined
current-source certification is `62`. Feature 009 remains REOPENED as directed; the
T081 current-source reconciliation is complete, and the exact next recovery task is
T082, the final current-source G5 audit (T074-equivalent). Feature 010 remains
unstarted.

- [X] T081 Reconcile the current-source certification in `docs/testing-strategy.md`
  and this quickstart against the repository-derived M01/M02 profile and full
  acceptance inventory; preserve historical T001–T074 evidence and failed,
  diagnostic, manual, and replacement attempts separately; record the mutually
  consistent T078/T079/T080 source manifests and exact `23/22/45/17/62` formulas;
  verify no unfinished charged run, green scanner/Auth/cleanup evidence, no HTTP
  429, check-only generated types after T063, protected historical migrations,
  explicit T075–T080 traversal regression/recovery coverage, and Feature 010
  exclusion; run only static inventory/config/documentation checks and
  `git diff --check`; do not run browser tests or R02 admission; leave Feature 009
  REOPENED.
- [X] T082 Perform the final current-source G5 audit (T074-equivalent) against the
  constitution, Feature 009 design artifacts, implementation identity, current
  acceptance evidence, reconciliation, and scope boundary; do not start Feature
  010 or alter historical receipts.

## Post-G5 Regression Recovery 2 — Live Numeric Primary Regression

The T075–T082 receipts remain immutable evidence for their tested source identities.
This recovery suffix addresses the 2026-09-23 live `ordering_inconsistent` defect;
Feature 009 remains REOPENED throughout and Feature 010 remains unstarted.

- [X] T083 Reproduce the bounded live `1900..2026`, Crime-driver, local
  Crime-and-Comedy-and-Science-Fiction, `vote_count.gte=500`, `vote_count.desc`
  query with safe evidence only; confirm the four current eligible IDs and primary
  values, isolate the exact old predicate, and classify the defect.
- [X] T084 Add controlled-provider coverage for the four-candidate exclusion path,
  regression recovery, completed empty, reverse/random numeric ties across pages,
  excluded tie members, duplicates, bounded incomplete proof, and all three numeric
  orderings; implement the smallest `tmdb-client.ts` fix without changing budgets,
  eligibility, exclusions, CAS, or public behavior.
- [X] T085 Update the ordered-source contract to specify prefix proof while primary
  values are monotonic and bounded exhaustive local comparison after a provider
  primary regression; preserve concrete incomplete failures when proof cannot finish.
- [X] T086 Run the non-charged deterministic/database/privacy/type/config gates,
  perform supplemental non-Auth live five-step verification through completed empty,
  append the recovery receipt and exact invalidated current-source gates, and stop
  before browser/R02 work.
- [X] T087 Rerun the current-source deterministic T077-equivalent certification for
  the new traversal source; only after that gate is green obtain fresh R02 admission
  for the T078-equivalent normal current-source acceptance block, followed by its
  dependent repeatability, fresh-checkout, reconciliation, and final-audit gates.
- [X] T088 Execute the T078-equivalent current-source normal acceptance checkpoint
  after T087: verify the certified source/harness/config identity, restore and prove
  the configured local Supabase/GoTrue target with zero-identity preflight, obtain
  fresh authoritative R02 admission for exactly 23 identities, and run C1, M01/M02,
  and permanent smoke once in fail-fast order. Record the exact source manifest,
  receipts, scanner/Auth/cleanup/runtime/provider state, HTTP-429 result, final R02
  state, and charged consumption; leave Feature 009 REOPENED and do not begin
  repeatability, fresh-checkout, reconciliation, final G5, or Feature 010 work.
- [ ] T089 **SUPERSEDED, NOT PASSED** by the corrected-source T090/T091 path after
  the Playwright runtime failure. Original task: At the unchanged T088 source and
  stack, obtain fresh authoritative R02 admission for the T079-equivalent
  repeatability block, reserve exactly 22
  identities (`M01 2 + M02 4 + permanent smoke 16`), and run owner acceptance then
  permanent smoke once without C1; do not start fresh-checkout, reconciliation,
  final G5, or Feature 010 work.
- [X] T090 Execute the corrected current-source normal run-one recovery after the
  T089 Playwright runtime correction: verify the post-fix source identity, obtain
  fresh authoritative R02 admission for exactly 23 identities (`C1 1 + M01 2 +
  M02 4 + permanent smoke 16`), and run C1, owner acceptance, and permanent smoke
  once in fail-fast order. Record the exact receipts, source manifest, scanner/Auth/
  cleanup/provider/runtime state, HTTP-429 result, final R02 state, and charged
  consumption; leave Feature 009 REOPENED and do not start T091 repeatability,
  fresh-checkout, reconciliation, final G5, or Feature 010 work.
- [X] T091 At the unchanged T090 corrected current source and stack, obtain fresh
  authoritative R02 admission for the new unchanged-source repeatability run two,
  reserve exactly 22 identities (`M01 2 + M02 4 + permanent smoke 16`), and run
  owner acceptance then permanent smoke once without C1; do not start fresh-checkout,
  reconciliation, final G5, or Feature 010 work.

- [X] T092 At the exact corrected current-source candidate after T091, certify the
  independent disposable fresh-checkout recovery with the dynamic owned Supabase
  runtime, complete all deterministic/protected zero-identity gates before fresh
  R02 admission, then run C1 once plus permanent smoke once for exactly 17
  identities; preserve Feature 009 REOPENED and leave reconciliation, final G5,
  and Feature 010 unstarted.

- [X] T093 Reconcile the corrected current-source certification in
  `docs/testing-strategy.md` and `specs/009-selection-rules-candidate-ordering/quickstart.md`:
  prove T090/T091/T092 share the HEAD, 144-file manifest, path/content hashes,
  Playwright runtime hash, generated-types state, and T092 candidate commit/tree;
  retain historical evidence separately; verify the M01/M02 and full acceptance
  inventory, traversal/runtime recovery fixes, clean scanner/Auth/cleanup and
  HTTP-429 state, protected migration/type hashes, canonical YAML, artifact/privacy
  boundaries, Feature 009 REOPENED status, and Feature 010 exclusion. Run only
  non-charged static/config/documentation/hash checks and `git diff --check`; do
  not run acceptance, browser tests, R02 admission, the final G5 audit, or Feature
  010 work.
- [X] T094 Perform the final corrected-current-source G5 audit against the
  constitution, Feature 009 design artifacts, implementation identity, current
  acceptance evidence, reconciliation, and scope boundary; do not start Feature
  010 or alter historical receipts.

## Post-G5 Regression Recovery 3 — Three-Singleton Genre Pushdown

The post-T094 manual `Crime AND Comedy AND Science Fiction` progression deadline
reopens Feature 009. T090–T094 remain preserved for their tested source, but no
longer certify the changed source. Feature 010 remains unstarted.

- [X] T095 Reconstruct the old and new Discover queries, reproduce the weak
  pushdown deadline with a controlled provider, implement deterministic safe
  genre-clause normalization/pushdown, prove all clause shapes and the five-step
  Edge progression, inspect duplicate callers, verify the bounded live query,
  run non-charged validation, and record the recovery impact. Do not run charged
  browser/R02 acceptance or start Feature 010.
- [X] T096 At the exact T095 source, run a fresh R02-admitted T090-equivalent
  normal checkpoint: C1, M01/M02 and permanent smoke once in fail-fast order,
  with current-source manifest, scanner/Auth/cleanup/provider receipts.
- [X] T097 At unchanged T096 source and stack, run a fresh R02-admitted
  T091-equivalent repeatability block: M01/M02 and permanent smoke once.
- [X] T098 Record the owner disposition: the T092-equivalent independent
  fresh-checkout/certification effort is **WAIVED AND DISCONTINUED, NOT PASSED**.
  Preserve all existing T098 attempt receipts as historical diagnostics; do not
  obtain another R02 admission or spend the planned additional 17 identities.
- [X] T099 Reconcile T096/T097 as valid current-source charged evidence totaling
  45 identities, retain T098 attempt/recovery evidence without rewriting it, and
  record the owner waiver and current-worktree normal validation in the testing
  strategy and evidence ledger. Do not claim 62-identity current-source
  fresh-checkout certification. Feature 010 remains unstarted.
- [X] T100 Perform and record the final current-worktree G5 audit against the
  product requirements, current normal test results, T096/T097, historical live
  TMDB evidence, migration/type/config checks, and scope boundaries. Record G5
  PASS and READY FOR OWNER FINAL LIVE-TMDB CHECK for its tested source; do not
  start Feature 010 Discovery or Feature 011 Match.

## Later Mixed-Clause Source Correction

- [X] T101 Record the subsequent mixed-clause query correction and its
  deterministic, clean-database, and bounded live source replay in the
  [quickstart](quickstart.md). This source change followed T096/T097 and T100;
  those browser and audit receipts certify only their earlier tested source.
- [X] T102 Owner reran the mixed-clause live-TMDB browser scenario on the latest
  product source after T101 and reported PASS: the three-voter flow progressed
  beyond four rejected candidates, all clients converged on the next candidate,
  and the prior `deadline` failure, `request_budget`, and incorrect
  `ordering_inconsistent` did not occur. The [quickstart](quickstart.md) records
  the owner receipt. This is manual evidence, not a new charged certification.

**Current checkpoint**: Feature 009 is release-complete and ready to commit
within its frozen scope; the owner's latest-product-source manual live-TMDB
browser recheck passed. No release blocker remains. T096/T097 remain 23 + 22 =
45 charged identities for their earlier tested source. T100 G5 passed for that
source; T101/T102 provide the later source and owner manual evidence. T098 fresh-checkout
certification was intentionally discontinued by owner waiver, not passed; its
additional planned 17 identities were not spent. Feature 010 Discovery and
Feature 011 Match remain unstarted. Seen/watched history and a candidate
traversal cursor remain deferred ideas, with no Feature 010 prerequisite.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1** starts immediately and changes only the Feature 009 evidence ledger.
- **Phase 2** depends on T001. T002–T005 and T007 are disjoint fixture/test files;
  T006 specifies the runner around T004/T005. Phase 2 blocks runtime work.
- **US1** depends on Phase 2 and establishes the only valid startup generation.
- **US2** depends on US1 because trusted creation must snapshot a validated frozen
  generation. T022–T025 serialize edits to the one migration; T029 must stay before
  any generated-types write.
- **US3** depends on US2's snapshot helpers and appends resolution/commit semantics to
  the same migration. Its Deno test authoring can start while late US2 client work
  finishes, but runtime integration waits for T025.
- **US4** depends on US3's canonical eligibility predicate and US2's snapshot/source
  handoff. T043–T046 serialize shared source files; all required child traversal must
  be provable before candidate commit.
- **US5** depends on US2's snapshot and Feature 008 decision authority; its test
  authoring may overlap US4 source work because files are disjoint, but T052 must
  precede migration freeze.
- **US6** depends on US3–US5 behavior and finalizes security, recovery, and failure
  taxonomy without changing public shapes after its checkpoint.
- **Phase 9** depends on all stories. T062 freezes SQL; T063 is the only generated-
  types write; T064 and every later task are check-only. T069 is the mandatory
  zero-identity gate before T070–T072, each of which needs fresh R02 admission.
- **T073** depends on T070–T072 and reconciles the normative testing policy and exact
  profile/inventory before acceptance; it performs no charged rerun. **T074** depends
  on T073 and every required implementation/evidence task and is the sole completion/
  scope verdict. No task depends on Feature 010.

### User Story Completion Order

```text
Setup -> Foundation -> US1 YAML -> US2 snapshots -> US3 eligibility -> US4 ordering
                                            \-> US5 agreement -> US6 authority/failure
                                                                  -> Final gates
```

US5 test/implementation files are largely disjoint from US4 and may overlap after
US2, but the single migration file must be edited serially and frozen only after both
stories are complete. US6 and Phase 9 remain integration gates.

### Migration and Generated-Types Sequence

```text
T004/T005 fixtures
  -> T022 create snapshot schema
  -> T023 legacy backfill
  -> T024 trusted atomic create cutover
  -> T025 fail-closed consumers
  -> T033/T035 eligibility and commit
  -> T042 source prepare/commit
  -> T052 exact agreement
  -> T058 final grants/signatures
  -> T062 all migrations + DB green and schema frozen
  -> T063 one db:types write
  -> T064+ check-only forever
```

### Within Each User Story

1. Author the listed behavioral/contract tests and observe the relevant failure.
2. Implement the authoritative server/database boundary before transport/client work.
3. Run focused tests before the story checkpoint and record actual commands/results.
4. Stop on any failed required check, artifact conflict, missing deliberate canonical
   value, or scope violation; do not hide it with defaults or broader implementation.
5. Before T063 preserve the generated-type hash; after T063 use check-only mode.

## Parallel Opportunities

- **Foundation**: T002–T005 and T007 use disjoint fixture/test files; T006 follows the
  migration fixture contract but can be scaffolded independently.
- **US1**: T008–T010 split parser, startup, and packaging evidence; T013 is disjoint
  allow-list/provenance work while T011/T012 prepare dependency and canonical input.
- **US2**: T018–T021 split DB, Edge, client, and cross-consumer evidence. Runtime
  migration tasks T022–T025 serialize; T026 and T027 can proceed in parallel after
  T024 fixes the service contract.
- **US3**: T030–T032 split DB resolution, DB commit, and Deno eligibility evidence;
  T036 fixture parity is independent after expected vectors are fixed.
- **US4**: T038 then T039 serialize query and comparator/traversal evidence in their
  shared TMDB-search test file; that serial lane, T040, T041, and T047 otherwise use
  disjoint files and can proceed in parallel.
- **US5**: T049 then T050 serialize arithmetic and race evidence in their shared
  candidate-progression test file; T051 uses disjoint client files and can proceed
  in parallel with that serial lane. US5 as a whole can overlap late US4 after US2,
  except edits to the shared migration serialize.
- **US6**: T055–T057 split DB, Edge, and client evidence; T059 and T060 use disjoint
  server and client runtime files after T058 fixes database boundaries.
- **Acceptance**: T065–T067 can be authored in parallel; T068 touches permanent smoke
  separately. Charged blocks T070–T072 never run in parallel or without admission.

## Parallel Execution Examples

### User Story 1

```text
T008: strict YAML parser vectors
T009: module/startup lifecycle harness
T010: local/deployment artifact packaging probe
T013: language allow-list and provenance guard
```

### User Story 2

```text
T018: snapshot/create database authority tests
T019: room-create Edge contract tests
T020: client create transport tests
T021: retained-row consumer tests
```

### User Stories 3 and 5 after US2

```text
T030-T032: eligibility evidence files
T049 -> T050: arithmetic then race evidence in the shared candidate-progression file
T051: client threshold evidence files
```

### User Story 4

```text
T038 -> T039: query then comparator/traversal tests in the shared TMDB-search file
T040: Edge orchestration/CAS tests
T041: database preflight/commit tests
T047: deterministic E2E TMDB support
```

## Implementation Strategy

### First Demonstrable Slice

1. Complete Setup and Foundation.
2. Complete US1 and verify strict YAML/startup/package behavior with zero identities.
3. Stop and review the canonical server-only boundary before database cutover work.

US1 is the first independently demonstrable slice, but not a deployable product
release because no new room snapshot exists until US2 and the database/Edge/client
cutover ships coherently.

### Incremental Green Checkpoints

1. US1: canonical YAML/startup lifecycle.
2. US2: immutable configured/legacy snapshots and trusted atomic create.
3. US3: identical retained eligibility at resolution/search/commit.
4. US4: four ordered source modes with CAS/no-repeat/failure correctness.
5. US5: exact retained agreement with N/N timing.
6. US6: privacy, recovery, and failure hardening.
7. Phase 9: frozen schema, one type write, deterministic gate, admitted browser
   evidence, repeatability, fresh checkout, and complete reconciliation.

## Notes

- `[P]` means disjoint files and no dependency on unfinished output; it never permits
  concurrent edits to the single migration or shared source modules.
- Alternate test-only fixture values do not replace or silently alter the approved
  initial canonical generation.
- Do not run charged tests while executing task generation or before T070.
- Do not mark a task complete from file presence alone; record executable evidence.
- Stop after Feature 009's neutral agreed/exhausted boundary and do not start
  Feature 010 Discovery or Feature 011 Match.
