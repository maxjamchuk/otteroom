---
description: "Executable task breakdown for Candidate Progression"
---

# Tasks: Candidate Progression

**Input**: Reviewed design documents in `/specs/008-candidate-progression/` and
the governing `.specify/memory/constitution.md`.

**Prerequisites**: [spec.md](spec.md), [plan.md](plan.md),
[research.md](research.md), [data-model.md](data-model.md),
[requirements-traceability.md](requirements-traceability.md),
[quickstart.md](quickstart.md),
[progression decision RPC contract](contracts/progression-decision-rpcs.md),
[candidate source sequencing contract](contracts/candidate-source-sequencing.md),
[room progression/Realtime contract](contracts/room-progression-realtime.md), and
[client progression flow contract](contracts/client-progression-flow.md).

**Tests**: Required by the specification, constitution, and approved plan. Add
behavioral and contract evidence before the implementation it governs and
observe the relevant failure. PostgreSQL/integration tests are the primary
authority for threshold arithmetic, transaction boundaries, concurrency,
idempotency, stale-state safety, ACLs, and privacy; browser tests demonstrate
only the bounded real-stack journeys assigned to them.

**Organization**: Phase 2 establishes the one-migration PostgreSQL cutover,
protected progression contracts, safe room projection, and the sole generated-
types write. Phases 3–7 map exactly to the five user stories. All four P1 stories
are ordered by authority dependency: resolve one complete set, install one
successor, harden the split transaction under concurrency/retry, then recover
that authority across client lifecycles. The P2 story adds truthful source-
failure and exhaustion behavior. Phase 8 supplies bounded browser, security,
repeatability, fresh-checkout, traceability, and scope evidence.

| Label | User story | Independent demonstration |
| --- | --- | --- |
| US1 | Resolve a Complete Group Decision (P1) | For fixed groups from 2 through 10, PostgreSQL waits for `N/N`, applies the exact integer threshold, and produces one agreed or rejected occurrence independent of arrival order. |
| US2 | Advance Everyone to One Next Candidate (P1) | One rejected occurrence obtains exactly one distinct Feature 006-eligible successor at sequence `k+1`, shared by voters and a non-voting creator with a fresh `0/N` decision set. |
| US3 | Progress Exactly Once Under Concurrency and Retry (P1) | Concurrent final decisions, duplicate/lost responses, competing source proposals, stale actions, and late results converge without a second outcome or successor. |
| US4 | Recover the Shared Progression State (P1) | Reload, reconnect, missed invalidations, and same-identity re-entry reconstruct the same safe room outcome and current candidate for every authorized member. |
| US5 | Stop Safely When Browsing Cannot Continue (P2) | Incomplete source work remains retryable, completed empty search becomes stable exhaustion, and agreement remains a neutral terminal with no Match UX. |

## Format: `[ID] [P?] [Story?] Description`

Every task starts with an unchecked checkbox and a unique sequential ID. `[P]`
is used only where the listed files and unfinished dependencies are disjoint.
User-story tasks carry exactly one `[USn]` label. Paths are repository-relative
and literal; `app/room/[code].tsx` is a filename, not a wildcard. Mark a task
complete only after its stated evidence has been produced and recorded.

## Binding Implementation Boundaries

- PostgreSQL resolves a complete occurrence decision set atomically under the
  existing room lock. Rejection durably establishes `advancing`; it never calls
  TMDB inside that transaction.
- The existing Feature 006 `room-candidate` Edge Function performs TMDB work
  outside the transaction. Only a room-locked commit with the rejected expected
  sequence may install exact ordinal `k+1` or commit exhaustion.
- TMDB movie identity, candidate occurrence UUID, public candidate sequence,
  and decision generation/epoch are distinct. Decisions bind to an occurrence,
  not to a raw movie ID or a client-local generation.
- The fixed Feature 003 voters and `required_voter_count` define completion and
  threshold. Connectivity, devices, and a non-voting creator contribute zero.
- Feature 007 remains the sole immutable decision model and submission path.
  No client tally, second voting API, editable answer, decision copy, or direct
  protected-table mutation is permitted.
- `public.rooms` remains the only Realtime relation. Events are invalidation
  hints; member-scoped canonical refetch plus sequence-aware merging is truth.
- Use one new migration, `supabase/migrations/20260918000000_candidate_progression.sql`,
  and edit no historical migration. Run `npm run db:types` exactly once only
  after the migration/RPC schema is stable and green; every later type gate is
  `npm run db:types:check` only.
- Deterministic arithmetic, locking, race, replay, rollback, stale-state, ACL,
  cross-room, and privacy evidence belongs primarily in pgTAP/dblink, Deno, and
  focused client tests, not Playwright timing.
- Charged browser execution is forbidden until the migration, DB, Edge, client,
  lint, typecheck, static/security, generated-type check, and export gates are
  green at the exact source state.
- Browser budgets are fixed: owner acceptance `F=6`; normal checkpoint and
  repeatability run one `23`; the one additional repeatability execution after
  normal `22`; cumulative normal-plus-repeatability `45`; and fresh checkout
  `17`. Obtain a new rolling R02 admission immediately before each charged block;
  failed, partial, manual, and replacement attempts count.
- Stop at the neutral agreed/exhausted progression boundary. Do not add Feature
  009, Match UX, early resolution, configurable thresholds, decision editing,
  dynamic membership, alternate sources, local ranking, or changed filters.

## Phase 1: Setup — Protected Baseline and Evidence Ledger

**Goal**: Establish a reproducible Feature 007 baseline and evidence record
without changing product behavior, schema, generated types, or browser quota.

- [X] T001 Capture branch/HEAD/status, declared and actual Node/npm/Supabase/Deno versions, hashes of every historical migration through `supabase/migrations/20260916000000_swipe_decisions.sql` and `src/types/database.generated.ts`, the current browser case/identity inventory, current full-checkpoint baseline `1+106=107`, projected post-Feature-008 full checkpoint `1+112=113`, the planned normal/additional-repeat/fresh budgets `23/22/17` (`45` cumulative through repeatability), and the G1–G5 evidence ledger in `specs/008-candidate-progression/quickstart.md`; record that Feature 008, Feature 009, the new migration, generated-type write, dependency changes, and charged browser execution have not started.

**Checkpoint**: Baseline provenance, historical hashes, scope, and quota plans
are recorded; runtime authority remains unchanged.

---

## Phase 2: Foundational — Occurrence Ledger, Atomic Authority, and Safe Projection

**Goal**: Complete and prove the single Feature 007→008 database cutover, all
frozen SQL signatures, protected occurrence/decision authority, source CAS,
safe room projection, and the one legitimate generated-types write before any
user-story client slice consumes the contract.

**Critical**: This is one traffic-stopped DB/types/client-contract cutover. Do
not ship the migrated database against the Feature 007 client, and do not make a
second generated-types write later.

### Failing database and migration evidence

- [X] T002 [P] Create failing schema/catalog tests in `supabase/tests/database/candidate_progression.test.sql` for both closed enums, `room_candidate_occurrences`, positive sequence/TMDB checks, resolved timestamp equivalence, unique room/sequence and room/TMDB keys, one collecting-or-agreed row per room, same-room composite references, occurrence-bound `candidate_decisions`, legal room progression/acquisition/identity/count combinations, RLS/ACL ownership, and rooms-only Realtime publication.
- [X] T003 Create the final failing database behavior matrix in `supabase/tests/database/candidate_progression.test.sql`, `supabase/tests/database/swipe_decisions.test.sql`, and `supabase/tests/database/tmdb_candidate_source.test.sql`: exact RPC signatures/cardinality/nullability/owner/search-path/EXECUTE and safe shapes; `N=2..10` threshold boundaries, incomplete inevitable/impossible sets, order independence and migration-time complete-set resolution; atomic final decisions, duplicate/conflict/replay/rollback and deterministic dblink final-voter races; exact-`k+1` successor/no-repeat/fresh-decision invariants, proposal/proposal and proposal/empty races, replay/stale/late/no-write branches, initial empty, metadata identity stability and exhaustion; plus integrity corruption, ACL/RLS, foreign/cross-room masking, fixed-role privacy, immutable membership/filter/history proofs, and lock-queue proof that decision/source prepare/commit operations perform an unlocked authorization precheck, never queue a foreign caller on the room row, then lock only an authorized room and revalidate authorization/handoff under the lock. Partition the SQL into named focused sections so later story tasks rerun evidence without adding schema-affecting database tests after type generation.
- [X] T004 [P] Create owned nonempty exact-Feature-007 fixtures in `supabase/tests/migration/candidate_progression.before.sql` for pending, original `no_candidates`, assigned zero/incomplete, exact-two complete agreed/rejected, larger-group threshold/below-threshold, voting/non-voting creator, preserved filters/private resolution, and immutable decisions/timestamps without GoTrue signups; snapshot only bounded logical values and hashes.
- [X] T005 [P] Create post-cutover assertions in `supabase/tests/migration/candidate_progression.after.sql` for occurrence-1 materialization, same-room decision remapping, value/timestamp preservation, threshold-correct agreed/advancing classification, current identity/count handling, initial-empty distinction, exact constraints/RPCs/grants/RLS/publication, unchanged membership/filter facts, and owned-fixture cleanup.

### Single migration and protected authority

- [X] T006 Implement the enums, occurrence ledger, room progression/sequence fields, cross-field constraints, same-room keys, occurrence-bound decision-key backfill, integrity prechecks, existing-room mappings, and exact indexes in the one new `supabase/migrations/20260918000000_candidate_progression.sql`; lock the affected tables for the cutover, preserve all accepted decisions, edit no historical migration, and create no queue, request ledger, match row, or alternate source state.
- [X] T007 Complete the private bigint-safe threshold helper and frozen-signature `get_room_candidate_decision`/`submit_room_candidate_decision` replacements in `supabase/migrations/20260918000000_candidate_progression.sql`: derive `auth.uid()`, authorize through an unlocked actor/room lookup so a foreign caller never joins the room lock queue, lock only the authorized room row, revalidate authorization under the lock, validate sequence plus TMDB identity and occurrence/detail/count integrity, preserve first-write-wins duplicate/conflict semantics, resolve only at exact `N/N`, and atomically commit either agreed/retained identity or rejected/durable advancing with no external call.
- [X] T008 Complete the frozen-signature service-role-only `prepare_room_tmdb_candidate`, `commit_room_tmdb_candidate`, and `commit_room_tmdb_no_candidates` replacements in `supabase/migrations/20260918000000_candidate_progression.sql`: for all three functions use the exact protocol unlocked actor/room authorization precheck → no foreign-room lock queue → lock only the authorized room row → revalidate authorization and applicable frozen handoff under the lock; derive server-private ordered exclusions, compare expected sequence, install only exact `k+1` or exhaustion, adopt a same-step winner/terminal without writing, reject repeats/stale phases, and preserve initial `inactive/no_candidates`.
- [X] T009 Finalize `supabase/migrations/20260918000000_candidate_progression.sql` with occurrence-aware first-candidate commit, complete-set migration classification, exact create/join/member-refetch safe fields, exact revokes/grants/function ownership, grant-free protected tables, no new Realtime relation, fail-closed invariant errors, and post-commit PostgREST reload; ensure no client-visible yes tally, occurrence ID/history, TMDB ID, private filter, peer answer, or roster is exposed.

### Nonempty cutover, clean replay, and one generated-type write

- [X] T010 Implement the bounded owned-stack runner in `scripts/check-candidate-progression-migration.mjs`: reject extra arguments, hash every historical migration and the canonical generated types, reset exactly through Feature 007, run `supabase/tests/migration/candidate_progression.before.sql`, apply the real pending migration, run `supabase/tests/migration/candidate_progression.after.sql`, suppress protected fixture data, forbid TMDB/GoTrue/type generation, and guarantee clean latest-reset cleanup on success, failure, or interruption.
- [X] T011 [P] Evolve latest-schema assertions in `scripts/check-room-membership-migration.mjs`, `scripts/check-participant-filters-migration.mjs`, `scripts/check-common-filter-resolution-migration.mjs`, `scripts/check-tmdb-candidate-migration.mjs`, `scripts/check-swipe-decisions-migration.mjs`, `supabase/tests/migration/room_membership.after.sql`, `supabase/tests/migration/participant_filters.after.sql`, `supabase/tests/migration/common_filter_resolution.after.sql`, `supabase/tests/migration/tmdb_candidate_source.after.sql`, and `supabase/tests/migration/swipe_decisions.after.sql` for the new occurrence/progression schema, exact projections/RPC/ACL inventories, zero invented progression in older fixtures, and byte-identical historical migrations.
- [X] T012 Run all six nonempty migration runners, a clean `npm run db:reset`, and the final full `npm run db:test` matrix from T002–T005; record commands, assertion totals, expected RED-to-GREEN history, threshold/timing, decision/source concurrency, replay/stale/exhaustion, privacy/integrity, nonempty cutover classifications, historical/type hashes, zero GoTrue use, and cleanup in `specs/008-candidate-progression/quickstart.md`, and do not proceed to type generation while any migration, RPC signature, Edge-facing database contract, or authoritative database test remains unstable.
- [X] T013 Perform the sole intentional `npm run db:types` write only after T012 is green, update exact generated-schema/RPC assertions in `__tests__/config/database-types.test.ts`, immediately run `npm run db:types:check`, review the enums/occurrence/decision/room/RPC changes in `src/types/database.generated.ts`, and record hash/inode/size/timestamps plus the one-write receipt in `specs/008-candidate-progression/quickstart.md`.
- [X] T014 From an independent clean latest reset, run only `npm run db:types:check`, require byte-identical hash and unchanged inode/size/timestamps for `src/types/database.generated.ts`, and record the check-only receipt in `specs/008-candidate-progression/quickstart.md`; every task after T013 is permanently check-only even if SQL function bodies are hardened without changing the frozen schema/signatures.

### Safe room projection cutover

- [X] T015 Add failing exact-field and invariant tests in `__tests__/rooms/contracts.test.ts`, `__tests__/rooms/service.test.ts`, `__tests__/rooms/state.test.ts`, and `__tests__/rooms/use-room-subscription.test.ts` for `candidate_progression_status`, `candidate_sequence`, legal sequence-zero/positive room shapes, protected rejected-result nulls, exact member-only refetch columns, one rooms-only invalidation channel, and zero occurrence/decision/private-TMDB projection.
- [X] T016 Evolve `src/rooms/contracts.ts`, `src/rooms/service.ts`, `src/rooms/state.ts`, and `src/rooms/use-room-subscription.ts` to strictly parse/store the safe progression fields and retain canonical refetch as the only truth source while preserving membership/filter/candidate integrity overlays, coalescing, last-good state, and one-channel teardown; defer cross-sequence transition behavior to US4 and expose no protected data.
- [X] T017 Run the migration runner, all prior migration runners, clean reset/full database suite, room/config client tests, lint, typecheck, `git diff --check`, and check-only generated types; record the G1 foundation receipt in `specs/008-candidate-progression/quickstart.md` before starting US1.

**G1 checkpoint — T017**: The one migration, atomic decision authority, durable
advancing barrier, source CAS signatures, privacy boundary, room projection, and
generated types are coherent. No client progression journey is claimed yet.

---

## Phase 3: User Story 1 — Resolve a Complete Group Decision (Priority: P1) 🎯 MVP

**Goal**: Resolve one current occurrence only after every fixed voter has an
accepted decision, using the exact integer threshold and one atomic outcome.

**Independent Test**: Exercise every `N=2..10` threshold boundary plus four-
voter inevitable/impossible incomplete sets and arrival-order permutations in
PostgreSQL; in focused client tests verify collecting remains neutral until
`N/N`, then the same candidate becomes agreed/stopped or retires to advancing.

### Focused evidence and failing client tests for User Story 1

- [X] T018 [P] [US1] Run the named threshold/timing sections already finalized in `supabase/tests/database/candidate_progression.test.sql` for `N=2..10`, exact vector `2,2,3,4,4,5,6,6,7`, both `T-1` and `T`, integer-only arithmetic, four-voter three-yes and two-no incomplete cases, connection/device/non-voting-creator exclusion, accepted-current-fixed-voter filtering, decision-order/final-voter permutations, and zero outcome/source transition before exact `N/N`; preserve the focused receipt for this story without changing frozen schema/signatures or regenerating types.
- [X] T019 [P] [US1] Add failing strict nine-field decision-result and transport tests in `__tests__/decisions/contracts.test.ts` and `__tests__/decisions/service.test.ts` for expected room/sequence/TMDB parameters, every outcome/nullability relationship, safe threshold without yes tally, rejected occurrence count `N` versus room advancing count `0`, observer/own-value privacy, candidate-changed masking, no actor/member argument, and no second decision endpoint.
- [X] T020 [P] [US1] Add failing collecting/agreed/rejected behavior tests in `__tests__/decisions/state.test.ts`, `__tests__/decisions/use-candidate-decision.test.ts`, `__tests__/progression/candidate-progression-status.test.tsx`, and `__tests__/routes/room.test.tsx` for no local tally or early outcome, immediate trusted final-result merge, retained agreed card, retired rejected controls, neutral accessible stopped/advancing meaning, and zero Match navigation/celebration/confirmation.

### Complete-set resolution implementation

- [X] T021 [US1] Harden the frozen-schema final-decision transaction in `supabase/migrations/20260918000000_candidate_progression.sql` until T018 proves exact fixed-membership completion, bigint-safe threshold evaluation only at `N/N`, one-way occurrence resolution, agreed identity/count retention, rejected advancing barrier/count reset, rollback integrity, and no client/order/final-voter influence.
- [X] T022 [US1] Evolve strict progression-aware decision types and authenticated RPC transports in `src/decisions/contracts.ts` and `src/decisions/service.ts` to send room/sequence/TMDB plus value, parse the exact protected result union, preserve only the caller's decision and safe aggregates, and map transport/database failures without raw payloads or private identifiers.
- [X] T023 [US1] Evolve `src/decisions/state.ts` and `src/decisions/use-candidate-decision.ts` to key authority by `{roomId,candidateSequence,tmdbMovieId}`, remain collecting until a validated server outcome, merge same-sequence agreed/advancing observations immediately, retire input after resolution, and never calculate threshold/outcome or retarget a decision locally.
- [X] T024 [US1] Create `src/progression/candidate-progression-status.tsx` and integrate it with `app/room/[code].tsx` to show understandable collecting, neutral agreed/stopped, and advancing meanings; preserve the agreed candidate, remove resolved controls, keep voters/non-voting creator role-correct, and add no Match route, celebration, confirmation, mode, edit, membership, or source-choice control.
- [X] T025 [US1] Run the exhaustive threshold/no-early pgTAP set, focused decision/progression/route suites, full database/client tests, lint, typecheck, web and iOS/Android exports, `git diff --check`, and `npm run db:types:check`; record the US1 independent result and zero early/source/Match behavior in `specs/008-candidate-progression/quickstart.md`.

**US1 checkpoint — T025**: One complete occurrence deterministically resolves
once; agreement stops and rejection exposes the durable advancing boundary.

---

## Phase 4: User Story 2 — Advance Everyone to One Next Candidate (Priority: P1)

**Goal**: Reuse Feature 006 outside the decision transaction to install exactly
one distinct eligible successor at `k+1`, with fresh occurrence-bound decisions
and one shared candidate for voters and a non-voting creator.

**Independent Test**: From a rejected occurrence, run the controlled Feature
006 search with server-derived history, commit one eligible non-repeated movie,
and verify every client adopts sequence `k+1` at `0/N` while all earlier
occurrences and decisions remain unchanged.

### Focused database evidence and failing Edge/client tests for User Story 2

- [X] T026 [P] [US2] Run the named successor/history sections already finalized in `supabase/tests/database/candidate_progression.test.sql` for service-only preflight exclusions, exact expected-sequence `k+1` commit, unique room/sequence and room/TMDB history, same-room evidence validation, two-room TMDB reuse, fresh count zero, zero copied decisions, immutable prior rows/timestamps, initial occurrence-1 compatibility, original Feature 006 `no_candidates`, and committed-identity metadata recovery without another occurrence; preserve the focused receipt without changing frozen schema/signatures or regenerating types.
- [X] T027 [P] [US2] Extend `supabase/functions/_tests/tmdb-search.test.ts` and `supabase/functions/_tests/room-candidate.test.ts` with failing exact Feature 006 regression plus exclusion/sequencing tests: server-only ordered deduplicated exclusions, local/provider duplicate skipping, first eligible non-excluded result, unchanged year/AND-of-OR/locale/adult/metadata/pagination/shard/budget/deadline behavior, exact `{room_id}` request, expected-sequence preflight/commit calls, winner metadata loading, and no client-supplied sequence/filter/history/proposal.
- [X] T028 [P] [US2] Extend `__tests__/candidates/contracts.test.ts`, `__tests__/candidates/service.test.ts`, `__tests__/candidates/state.test.ts`, and `__tests__/candidates/use-room-candidate.test.ts` with failing strict progression response, candidate generation, successor, and metadata tests for committed winner only, generation-matched metadata caching, mandatory canonical room refetch, zero Edge-driven room/status/count mutation, no assumed `0/N`, canonical fresh-count observation, same-ID metadata Retry, and no local candidate choice or alternate endpoint.
- [X] T029 [P] [US2] Extend `__tests__/decisions/state.test.ts`, `__tests__/decisions/use-candidate-decision.test.ts`, `__tests__/progression/candidate-progression-status.test.tsx`, and `__tests__/routes/room.test.tsx` with failing occurrence-bound retirement/freshness tests proving prior own decisions never populate a successor, all fixed voters start undecided, the non-voting creator has no controls, and the committed candidate is the only rendered authority.

### Source sequencing and successor implementation

- [X] T030 [US2] Evolve `supabase/functions/_shared/candidate-contracts.ts` and `supabase/functions/_shared/tmdb-client.ts` to strictly parse progression preflight/commit fields, accept only server-produced excluded positive TMDB IDs, skip exclusions within the unchanged bounded Feature 006 traversal, and return only match/completed-empty/search-incomplete meanings without ranking, fallback, broadened filters, or a second source.
- [X] T031 [US2] Evolve `supabase/functions/room-candidate/index.ts` to keep TMDB retrieval outside PostgreSQL, pass the preflight expected sequence to the frozen candidate/empty commit RPCs, render/load metadata only for the database-confirmed winner, adopt a competing winner, recover an already assigned identity without Discover, and return strict safe sequence-aware responses.
- [X] T032 [US2] Evolve `src/candidates/contracts.ts`, `src/candidates/service.ts`, `src/candidates/state.ts`, and `src/candidates/use-room-candidate.ts` to use room/sequence/request-attempt generations, accept only database-confirmed metadata outcomes, trigger canonical room refetch after candidate/terminal results, never install room progression/count or synthesize `0/N` from Edge data, retain same-sequence identity through metadata/poster recovery only while canonical collecting/agreed authority permits it, and suppress every retired-generation callback.
- [X] T033 [US2] Integrate rejected-to-advancing acquisition, successor rendering, new decision-generation recovery, fresh `0/N`, and voter/non-voting-creator shared observation in `app/room/[code].tsx`; invoke only the existing candidate endpoint and Feature 007 decision path, and never expose a proposal before its database commit.
- [X] T034 [US2] Run successor/no-repeat/fresh-decision pgTAP, full original Feature 006 database and Deno suites, focused candidate/decision/progression/route suites, lint, typecheck, web/native exports, and check-only generated types; record the US2 distinct eligible `k+1`, historical-row preservation, same-winner observation, and unchanged source contract in `specs/008-candidate-progression/quickstart.md`.

**US2 checkpoint — T034**: Rejection can produce one authoritative Feature 006
successor outside the decision transaction, and that occurrence starts fresh.

---

## Phase 5: User Story 3 — Progress Exactly Once Under Concurrency and Retry (Priority: P1)

**Goal**: Make final-decision and successor commits logically exactly-once under
overlap, replay, lost responses, stale targets, and late results.

**Independent Test**: Use deterministic independent database sessions to race
the last voters, different proposals, and proposal versus empty; discard and
replay responses, then assert one outcome, at most one exact `k+1` successor or
one terminal, unchanged no-write branches, and canonical stale-client recovery.

### Deterministic database evidence and failing Edge/client tests for User Story 3

- [X] T035 [US3] Run the named READ COMMITTED pgTAP+dblink final-voter trials already finalized in `supabase/tests/database/candidate_progression.test.sql` using owner-held room locks and `pg_blocking_pids`/ungranted-lock barriers: overlap the last distinct voters, duplicate/replay the final value, inject rollback after insert/resolution steps, discard the committed response, prove both owned decisions survive, exactly one transaction resolves, unrelated rooms progress, no second transition occurs, and sessions/cancellation clean up boundedly; retain exact focused evidence without regenerating types.
- [X] T036 [US3] Run the named deterministic candidate/candidate and candidate/completed-empty races already finalized in `supabase/tests/database/candidate_progression.test.sql` for the same rejected sequence, replay after lost responses, stale lower/older expected sequences, late commits after agreed/exhausted/newer states, exact row/sequence/write/xmin/timestamp deltas, winner/terminal adoption, and proof that no database lock spans Edge HTTP work; retain exact focused evidence without regenerating types.
- [X] T037 [P] [US3] Extend `supabase/functions/_tests/room-candidate.test.ts`, `__tests__/rooms/state.test.ts`, `__tests__/candidates/state.test.ts`, and `__tests__/decisions/state.test.ts` with failing delayed-result matrices for losing proposal success, stale completed-empty, old metadata/poster success/failure, old decision success/failure/pending, same-step winner adoption, `candidate_changed`, `refresh_required`, agreed/exhausted terminal retention, a delayed winning Edge response after its successor already has decisions, the same response after that successor has advanced/exhausted or a later sequence is current, and no Edge-driven `0/N` or last-callback-wins behavior.
- [X] T038 [P] [US3] Extend `__tests__/decisions/use-candidate-decision.test.ts`, `__tests__/candidates/use-room-candidate.test.ts`, and `__tests__/routes/room.test.tsx` with failing duplicate gesture/button, lost final response, stale-tab action, old-candidate Retry, concurrent final dispatch, and late-result tests that require one canonical refetch path, preserve a successor's canonical nonzero count, retire a successor that has progressed again, and perform zero automatic resubmission or room/count installation from candidate results.

### Exactly-once hardening

- [X] T039 [US3] Review and, only if T035–T036 expose a schema-neutral behavior defect, harden the frozen-signature decision and candidate commit bodies in `supabase/migrations/20260918000000_candidate_progression.sql` until the already-final database matrix proves room-lock serialization, occurrence outcome idempotency, `(room_id,rejected_sequence)` step identity, exact `k+1`, same-step loser adoption, stable response-loss recovery, rollback, stale denial, and zero write on every replay/terminal branch without any request-ID ledger; any required schema/signature change invalidates T012–T014 and must be resolved before continuing, never by a second generated-type write.
- [X] T040 [US3] Harden `supabase/functions/room-candidate/index.ts` and `supabase/functions/_shared/candidate-contracts.ts` so late/competing commits surface only the installed winner, terminal, or `refresh_required`; never return/render the losing proposal, continue a newer step from an old request, or convert an orchestration failure into authority.
- [X] T041 [US3] Complete response-loss, same-value/conflict, `candidate_changed`, and stale-generation recovery in `src/decisions/service.ts`, `src/decisions/state.ts`, and `src/decisions/use-candidate-decision.ts`; preserve the immutable caller result, retire old controls synchronously, refetch canonical room state, and never replay an old decision onto a new occurrence.
- [X] T042 [US3] Complete ordered trusted-observation merging and late callback retirement in `src/rooms/state.ts`, `src/candidates/state.ts`, `src/candidates/use-room-candidate.ts`, and `app/room/[code].tsx` so decision results may merge only their complete lock-consistent projection, candidate results update metadata only after canonical refetch, and agreed, one successor with its current count, advancing, or exhaustion cannot be hidden/replaced by stale success, failure, pending state or an assumed fresh `0/N`.
- [X] T043 [US3] Run the complete dblink final-decision/source-race/rollback/replay matrix, Edge loser/late-result suite, focused stale-generation hooks/routes, full DB/Edge/client tests, lint, typecheck, exports, `git diff --check`, and check-only types; record bounded lock evidence, exact write/sequence deltas, cleanup, and US3 one-outcome/one-step verdict in `specs/008-candidate-progression/quickstart.md` without protected identities or payloads.

**US3 checkpoint / G2 authority boundary — T043**: Database resolution and the
external-source CAS form one exactly-once logical progression protocol.

---

## Phase 6: User Story 4 — Recover the Shared Progression State (Priority: P1)

**Goal**: Make canonical room refetch and sequence-aware generations converge
every authorized voter and non-voting creator after missed updates, reload,
reconnect, re-entry, and stale local state.

**Independent Test**: Drop room invalidations while one room agrees and another
advances; reload/reconnect/re-enter each role and verify the canonical safe room
projection reconstructs the same terminal or current successor without replay,
peer disclosure, or dependence on an event history.

### Focused database evidence and failing client tests for User Story 4

- [X] T044 [P] [US4] Extend `__tests__/rooms/contracts.test.ts`, `__tests__/rooms/state.test.ts`, and `__tests__/rooms/use-room-subscription.test.ts` with failing exhaustive merge-lattice tests over the reflexive transitive closure of `P0→E0|C(1,0)`, `C(k,c)→C(k,c')|A(k)|V(k)`, and `V(k)→X(k)|C(k+1,0)`: adopt valid higher-sequence collecting/agreed/advancing/exhausted and multi-sequence forward jumps; adopt same-sequence collecting→exhausted when advancing was missed; replace count exactly across occurrences; ignore only incoming nodes proven to precede local authority; fail closed for invalid/incomparable branches including lower terminal versus newer sequence; plus coalesced invalidations, system-ok/refetch recovery, and deterministic one-channel teardown/rebind.
- [X] T045 [P] [US4] Extend `__tests__/candidates/use-room-candidate.test.ts`, `__tests__/decisions/use-candidate-decision.test.ts`, and `__tests__/routes/room.test.tsx` with failing reload/reconnect/missed-update/link-code-QR re-entry, room A→B→A, subscription failure/Retry, agreed metadata recovery, successor own-decision recovery, advancing resume, exhausted stability, and non-voting-creator observation tests with no prior decision replay.
- [X] T046 [P] [US4] Run the named authorized recovery/privacy sections already finalized in `supabase/tests/database/candidate_progression.test.sql` and `supabase/tests/database/swipe_decisions.test.sql` for voter own value, undecided voter, non-voting creator, agreed occurrence recovery, rejected/old target `candidate_changed`, masked missing/foreign/cross-room callers, foreign requests excluded from the target lock queue, direct protected-table denial, all-null protected shapes, and corruption fail-closed rollback; preserve the focused receipt without changing frozen schema/signatures or regenerating types.

### Canonical recovery implementation

- [X] T047 [US4] Implement the complete monotonic room-projection lattice and its reachability classifier in `src/rooms/contracts.ts` and `src/rooms/state.ts`: adopt reachable forward nodes, ignore reverse-reachable stale nodes, fail closed only for malformed or incomparable nodes, and replace counts exactly across occurrences; then integrate canonical refetch, coalescing, reconnect/system-ok recovery, last-good state, and cleanup-before-rebind in `src/rooms/service.ts` and `src/rooms/use-room-subscription.ts`; never use global `Math.max` across occurrences or trust event/Edge payloads as room authority.
- [X] T048 [US4] Complete route-driven generation reconstruction and recovery in `src/candidates/use-room-candidate.ts`, `src/decisions/use-candidate-decision.ts`, and `app/room/[code].tsx`: load metadata for collecting/agreed, recover only the caller's current decision, resume one advancing step, preserve terminals, suppress old generations, and rely on the existing local Auth identity only.
- [X] T049 [US4] Complete accessible convergence, synchronization-failure, role, and integrity presentation in `src/progression/candidate-progression-status.tsx` and `app/room/[code].tsx`; keep state understandable without color/motion/internal IDs, expose explicit safe Retry only where allowed, and withhold candidate/decision/source actions on contradictory contracts.
- [X] T050 [US4] Run focused room merge/subscription, candidate/decision lifecycle, route/component accessibility, and database privacy/cross-room suites plus full DB/Edge/client, lint, typecheck, exports, static/security checks, and check-only types; record the US4 reload/reconnect/re-entry/missed-event convergence and zero disclosure/replay result in `specs/008-candidate-progression/quickstart.md`.

**US4 checkpoint / G3 coherent P1 cutover — T050**: Every authorized room
member can recover one canonical outcome and candidate without continuous
connectivity or receipt of every event.

---

## Phase 7: User Story 5 — Stop Safely When Browsing Cannot Continue (Priority: P2)

**Goal**: Distinguish retryable incomplete source work from stable completed-
empty exhaustion and from agreed/stopped, with safe recovery and no false Match.

**Independent Test**: From one rejected step, produce a search-incomplete result
with zero writes, retry the same step successfully, and separately commit a
fully completed empty traversal; reload each state and verify Retry appears only
for advancing failure, exhaustion is stable with a new-room action, and agreed
causes zero source work.

### Focused database evidence and failing Edge/client tests for User Story 5

- [X] T051 [P] [US5] Run the named terminal sections already finalized in `supabase/tests/database/candidate_progression.test.sql` for advancing no-write source failure, expected-sequence completed-empty exhaustion without a new occurrence/increment, proposal-versus-empty exclusivity, repeat/late/stale commits, exhausted/agreed immutability, original sequence-0 `inactive/no_candidates`, pre-existing complete-set migration handoff, and exact room/occurrence/decision preservation; preserve the focused receipt without changing frozen schema/signatures or regenerating types.
- [X] T052 [P] [US5] Extend `supabase/functions/_tests/tmdb-search.test.ts` and `supabase/functions/_tests/room-candidate.test.ts` with failing failure-taxonomy tests proving timeout/rate-limit/malformed/budget/deadline/incomplete traversal returns 503 with no commit, only full error-free exclusion-aware traversal commits `completed_empty`, retry addresses the same step, assigned metadata failure reloads the same identity, and agreed/exhausted/initial-empty states perform no Discover or speculative fallback.
- [X] T053 [P] [US5] Extend `__tests__/candidates/state.test.ts`, `__tests__/candidates/use-room-candidate.test.ts`, `__tests__/progression/candidate-progression-status.test.tsx`, and `__tests__/routes/room.test.tsx` with failing accessible-state tests for advancing pending/generic Retry, same-step retry success, stable exhaustion without acquisition Retry, existing start-new-room/session action, agreed card retention, initial empty distinction, reload recovery, and explicit absence of Match/mode/early/edit/membership/alternate-source behavior.

### Failure and terminal implementation

- [X] T054 [US5] Complete the incomplete-versus-completed-empty orchestration in `supabase/functions/_shared/tmdb-client.ts` and `supabase/functions/room-candidate/index.ts`: write nothing for every incomplete/provider/orchestration failure, commit exhaustion only with complete evidence and the expected sequence, recover winner/terminal on retry, bypass Discover for agreed/exhausted/assigned identities, and preserve Feature 006 metadata recovery.
- [X] T055 [US5] Complete advancing failure, retry, winner/terminal adoption, initial-empty distinction, assigned-identity metadata recovery, and exhausted no-request behavior in `src/candidates/contracts.ts`, `src/candidates/state.ts`, and `src/candidates/use-room-candidate.ts`; do not persist or render raw provider diagnostics.
- [X] T056 [US5] Complete neutral accessible advancing/agreed/exhausted presentation and route actions in `src/progression/candidate-progression-status.tsx` and `app/room/[code].tsx`: Retry only transient advancing failure, no acquisition Retry for exhaustion, preserve the existing new-room/session action, retain agreed candidate meaning, and add zero Feature 009 presentation or navigation.
- [X] T057 [US5] Run terminal/exhaustion pgTAP, full Feature 006 and progression Deno suites, focused candidate/progression/route tests, full DB/Edge/client, lint, typecheck, web/native exports, `git diff --check`, static/security scans, and check-only types; record the US5 retryable-versus-stable terminal result, zero false exhaustion/source work/Match behavior, and G4 deterministic product gate in `specs/008-candidate-progression/quickstart.md`.

**US5 checkpoint / G4 product boundary — T057**: Advancing failure is safely
retryable, completed empty is durably exhausted, and agreement remains stopped.

---

## Phase 8: Cross-Story Acceptance, Security, and Release Evidence

**Goal**: Prove the completed slice through bounded real-stack L01/L02 evidence,
preserved smoke/security intent, exact R02 admissions, repeatability, fresh
checkout, and a complete traceability/scope audit.

### Real-stack harness and failing acceptance

- [X] T058 Create `e2e/support/progression-harness.ts` and evolve `e2e/support/candidate-harness.ts`, `e2e/support/decision-harness.ts`, `e2e/support/room-harness.ts`, and `e2e/support/tmdb-stub.ts` with bounded final-decision/source holds, committed-response discard, rooms-update/socket controls, exclusion-aware deterministic provider outcomes, in-memory-only candidate equality/difference assertions, convergence timing capped at 5 seconds, exact identity receipts, owned cleanup, and zero raw decision/room/member/TMDB/private-filter artifacts.
- [X] T059 Author failing `@feature008 L01` with embedded L03 subflows and cap 2 in `e2e/candidate-progression.spec.ts`: reuse the same two voters only within this case across bounded rooms to prove incomplete wait, yes/yes agreement, stopped reload/reconnect, no source call or Match UX, concurrent yes/no rejection, duplicate/lost/replayed final response, stale tab reconciliation, one distinct successor at `0/2`, transient source failure, same-step retry success, completed-empty exhaustion, terminal recovery, and no fixture fallback.
- [X] T060 Author failing `@feature008 L02` with cap 4 in `e2e/candidate-progression.spec.ts`: one non-voting creator plus three voters prove creator exclusion, two early yes still collecting, `2 yes + 1 no` agreement, a bounded second-room non-agreement with concurrent final dispatch, one shared distinct successor at `0/3`, all four clients converging within 5 seconds, stale/reload recovery, safe room-level privacy, and an ordinary-JWT cross-room denial; then reuse those same four case-owned identities in bounded all-four-voters rooms to prove `N=4`, `T=3`, collecting after three early yes or two early no decisions, agreement at three yes, and non-agreement/progression at two yes without another identity or case.
- [X] T061 [P] Create failing fixed-profile, discovery, budget, and diagnostics tests in `__tests__/config/feature008-e2e-profile.test.ts` and `__tests__/config/e2e-diagnostics.test.ts` for exact L01=2/L02=4/F=6, L03 and the four-voter subflow remaining inside their owner cases, two case receipts, workers=1/retries=0/repeatEach=1, normal/run-one `1+16+6=23`, additional repeatability run `16+6=22`, cumulative repeatability `23+22=45`, fresh `1+16=17`, current full baseline `1+106=107`, projected post-Feature-008 full `1+112=113`, no targeted historical identities, capture-off artifacts, scanner/cleanup success, and rejection of identity/provider/credential/profile overrides.

### Safe runner, historical impact, and diagnostics

- [X] T062 Implement the override-free `feature008` profile and exact case/identity/receipt enforcement in `scripts/run-e2e.mjs`, `playwright.config.ts`, `e2e/support/safe-reporter.ts`, `package.json`, and `docs/testing-strategy.md`; select only L01/L02 for owner acceptance, retain one worker/zero retries/one repeat, controlled provider ownership, credential registry, additive discovery, permanent smoke at 16, and no unapproved historical browser case.
- [X] T063 Evolve only impacted permanent-smoke assertions in `e2e/generalized-room-membership-qr.spec.ts` for G04's authoritative three-voter resolution and G08's direct progression/occurrence/decision denial while preserving G03/G04/G05/G08/H01 at exactly 16 identities; update obsolete post-`N/N` assertions in `e2e/swipe-decisions.spec.ts` without selecting K01/K02 in the normal Feature 008 gate or rewriting their historical Feature 007 evidence.
- [X] T064 Extend finalized-artifact privacy rules in `e2e/diagnostics/credential-safety.spec.ts`, `scripts/check-e2e-artifacts.mjs`, `e2e/support/safe-diagnostics.ts`, and `e2e/support/safe-reporter.ts` to reject occurrence IDs/history, raw progression/decision/RPC payloads, room/member/internal TMDB IDs, private exclusions/filters, credentials, storage state, screenshots/traces/video/HAR, and unsafe source errors while preserving C1 as exactly one identity and deterministic cleanup.

### Deterministic gate before any browser execution

- [X] T065 Run and record the final non-browser gate in `specs/008-candidate-progression/quickstart.md`: all six nonempty migration runners, clean reset/full pgTAP including deterministic decision/source races and ACL/privacy, full Edge and original Feature 006 regression, focused and full client/config/static/security suites, `npm run db:types:check` only, lint, typecheck, web export, iOS/Android exports, `git diff --check`, finalized-artifact scan, exact commands/versions/results, and any justified omission; do not start T066 unless every relevant DB, Edge, client, lint, typecheck, static/security, generated-type, and export check is green at the exact source state.

### Charged browser gates — fresh R02 admission before each block

- [X] T066 Obtain and record a fresh rolling-window R02 admission immediately before the normal charged block, reserving exactly 23 identities, then run only the safe wrappers for C1 once, `npm run test:e2e:feature008`, and `npm run test:e2e:smoke`; require exact formula `1 + 6 + 16 = 23`, treat this owner-plus-smoke execution as repeatability run one, require L01/L02 receipts including the four-voter L02 subflow, all-open-client convergence within 5 seconds, zero Match/scope violations, scanner zero, Auth success, and owned cleanup, and record every failed/partial/replacement attempt in `specs/008-candidate-progression/quickstart.md`.
- [X] T067 At unchanged source and stack after T066, obtain and record a new rolling-window R02 admission immediately before repeatability run two, reserving exactly 22 additional identities, then run `npm run test:e2e:feature008` and `npm run test:e2e:smoke` exactly once with fresh case identities through safe wrappers only; do not rerun C1; enforce additional formula `6 + 16 = 22` and cumulative formula `23 + 22 = 45`, workers 1/retries 0/repeatEach 1, identical source SHA/profile, scanner zero, deterministic cleanup, and check-only types, and record the complete two-run receipt in `specs/008-candidate-progression/quickstart.md`.
- [X] T068 At the exact implementation SHA in an independent disposable checkout, complete install, secret-free local configuration, Playwright setup, all six nonempty migrations, clean reset/full DB/Edge/client/config/static/security tests, check-only canonical types, lint/typecheck/build/web/native exports, and artifact scans before any browser command; then obtain and record a separate fresh rolling-window R02 admission immediately before the charged fresh-checkout block, reserve exactly 17 identities, run C1 plus permanent smoke only, require `1 + 16 = 17`, scanner/cleanup zero, no copied modules/env/Auth/DB/browser state, and record evidence in `specs/008-candidate-progression/quickstart.md` before removing only owned resources.

### Final traceability and scope audit

- [X] T069 Perform and record the G5 final audit in `specs/008-candidate-progression/quickstart.md` against `specs/008-candidate-progression/spec.md`, `specs/008-candidate-progression/plan.md`, `specs/008-candidate-progression/research.md`, `specs/008-candidate-progression/data-model.md`, `specs/008-candidate-progression/requirements-traceability.md`, every file under `specs/008-candidate-progression/contracts/`, `specs/008-candidate-progression/tasks.md`, `docs/testing-strategy.md`, the implementation diff, and all evidence: reconcile each of FR-001–FR-045, NFR-001–NFR-010, SC-001–SC-012, scenarios 1–30, and US1–US5 to implementation plus executable proof; verify the `107` current baseline, `113` post-Feature-008 full projection and `23+22=45` repeatability schedule; verify zero blocker, unresolved item, historical migration edit, second generated-type write, unadmitted browser block, Feature 009/Match UX, early resolution, configurable threshold, decision edit, dynamic membership, alternate source, privacy leak, unsafe artifact, or unrecorded required failure before declaring Feature 008 complete.

**Final checkpoint / release boundary — T069**: The exact source state has
deterministic authority evidence, bounded browser acceptance, repeatability,
fresh-checkout proof, and complete 45/10/12/30/5 traceability. Feature 009 remains
unstarted.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1** starts immediately and changes only the Feature 008 evidence
  ledger.
- **Phase 2** depends on T001 and blocks every user story. T002–T005 establish
  failing contracts; T006–T011 implement the single cutover; T012 must be green
  before the sole type write T013; T014 proves check-only stability; T015–T017
  complete the safe room projection and G1.
- **US1** depends on G1/T017 and establishes the atomic complete-set outcome.
- **US2** depends on US1/T025 because only a rejected occurrence may enter the
  durable advancing/source protocol.
- **US3** depends on US1 and US2 because it races/replays both transaction
  boundaries and their client generations.
- **US4** depends on US2 and US3 because recovery must understand every legal
  sequence/phase and suppress already-proven stale outcomes.
- **US5** depends on US2/US3 source sequencing and terminals; its test authoring
  may begin after US2, but shared Edge/client files must be coordinated.
- **Phase 8** depends on all five story checkpoints. T065 is the mandatory
  deterministic gate; T066, T067, and T068 are separate charged blocks, each
  with its own immediately preceding R02 admission: 23 for normal/run one, 22
  for the additional repeatability run, and 17 for fresh checkout.
- **T069** depends on every required implementation/evidence task and is the
  only final release/scope verdict. No task depends on Feature 009.

### User Story Completion Order

```text
Setup -> Foundation/G1 -> US1 -> US2 -> US3/G2 -> US4/G3 -> US5/G4
                                                        -> Acceptance/G5
```

US5 test authoring can overlap late US4 work after US3, but US4 and US5 both
touch route/candidate state and must serialize or partition those edits. The
authoritative implementation/release order remains the sequence above.

### Within Each User Story

1. Author the listed behavioral/contract tests and observe the relevant failure.
2. Implement authority before transport/state/presentation wiring.
3. Run focused tests before the story's full deterministic gate.
4. Record actual commands and results before claiming the checkpoint.
5. Use only `npm run db:types:check` after T013.
6. Stop on a failed required check, contract inconsistency, scope conflict, or
   insufficient R02 admission; never compensate with browser retries or broader
   implementation.

## Parallel Opportunities

- **Foundation**: T002, T004, and T005 are disjoint failing-test/fixture files;
  after the schema shape is fixed, T010 and T011 use disjoint runners.
- **US1**: T018, T019, and T020 split PostgreSQL authority, strict transport,
  and client presentation tests.
- **US2**: T026–T029 split database, Edge/search, candidate client, and
  occurrence-decision/route evidence.
- **US3**: T037 and T038 can run beside the sequential shared-file database
  race tasks T035–T036; implementation tasks serialize shared state modules.
- **US4**: T044–T046 split room merge, lifecycle client, and database privacy
  evidence.
- **US5**: T051–T053 split database terminal, Edge taxonomy, and client/UI
  evidence.
- **Acceptance**: T061 can be authored while T058 is built; T063 and T064 touch
  disjoint historical-smoke and diagnostics files after the profile contract is
  clear. Charged browser blocks never run in parallel.

## Parallel Execution Examples

### User Story 1

```text
T018: PostgreSQL threshold/no-early/order matrix
T019: Decision RPC parser and transport contracts
T020: Decision state/progression presentation contracts
```

### User Story 2

```text
T026: PostgreSQL successor/history/freshness contracts
T027: Deno exclusion and Feature 006 source contracts
T028: Candidate client generation contracts
T029: Occurrence decision freshness and route contracts
```

### User Story 3

```text
T037: Edge and reducer late-result matrix
T038: Hook/route response-loss and stale-action matrix
```

### User Story 4

```text
T044: Room sequence/phase merge and subscription matrix
T045: Reload/reconnect/re-entry client matrix
T046: Database recovery/privacy/cross-room matrix
```

### User Story 5

```text
T051: PostgreSQL terminal invariants
T052: Deno incomplete-versus-completed-empty taxonomy
T053: Client retry/exhaustion/agreement presentation
```

## Scenario-to-Task Traceability

| Spec scenarios | Primary implementation tasks | Primary evidence tasks |
| --- | --- | --- |
| 1–8 (US1) | T006–T009, T021–T024 | T002–T003, T018–T020, T025, L01/L02 |
| 9–14 (US2) | T008–T009, T030–T033 | T026–T029, T034, L01/L02 |
| 15–20 (US3) | T007–T009, T039–T042 | T035–T038, T043, L01/L02 |
| 21–25 (US4) | T009, T047–T049 | T044–T046, T050, L01/L02/G08 |
| 26–30 (US5) | T008–T009, T054–T056 | T051–T053, T057, L01/L03 |

## Requirements and Outcome Coverage

| Coverage set | Principal task groups |
| --- | --- |
| FR-001–FR-011: fixed membership, complete-set timing, threshold, authoritative inputs/order | T007, T018–T025 |
| FR-012–FR-015: one atomic outcome, agreed handoff/terminal, neutral no-Match UI | T006–T009, T018–T025, T035–T043 |
| FR-016–FR-023: rejection, one eligible successor, no repeat, fresh decisions, immutable history | T008, T026–T034 |
| FR-024–FR-029: retryable source failure, expected-sequence recovery, exhaustion, initial empty, metadata stability | T008, T026–T034, T051–T057 |
| FR-030–FR-033: final-decision/source concurrency, replay, stale clients, late results | T035–T043 |
| FR-034–FR-038: shared observation, reload/re-entry, pre-existing complete sets, creator roles | T004–T012, T044–T050 |
| FR-039–FR-045: one decision path, protected authority/privacy, fail-closed integrity, frozen room facts, future timing separation | T002–T017, T018–T057, T064–T069 |
| NFR-001–NFR-010: atomicity, convergence, recovery, determinism, source/sequence correctness, failure safety, security/privacy, accessibility, scope and future timing | Implementation and evidence mappings are explicit in `requirements-traceability.md`; final reconciliation is T069 |
| SC-001–SC-003 | T018, T025, T035–T043 |
| SC-004–SC-005 | T044–T050, T058–T060, T066–T068 |
| SC-006–SC-010 | T026–T057, T063–T066 |
| SC-011–SC-012 | T059–T069 |
| All 30 scenarios and all five stories | Scenario table above plus the individual-ID reconciliation in T069 |

## Implementation Strategy

### MVP First

1. Complete Setup and the full G1 foundation.
2. Complete US1 through T025.
3. Stop and demonstrate the exact database threshold/no-early matrix plus
   focused client agreed/advancing behavior.
4. Treat this only as an MVP development checkpoint: it is not releasable until
   successor sequencing, exactly-once hardening, recovery, and terminal behavior
   are complete.

### Incremental Delivery

1. **G1**: One migration/RPC/types/safe room projection proven internally.
2. **US1**: Complete-set resolution and fixed threshold.
3. **US2**: Feature 006 successor at exact `k+1` with fresh decisions.
4. **US3/G2**: Exactly-once split transaction under races/retry/stale work.
5. **US4/G3**: Canonical sequence-aware convergence and recovery.
6. **US5/G4**: Retryable failure, stable exhaustion, neutral stopped UI.
7. **G5**: Deterministic gate, separately admitted 23/22/17 charged browser
   blocks (`45` cumulative through repeatability), and complete
   traceability/scope proof.

### Scope Stop

Stop after authoritative candidate agreement/progression/exhaustion and the
durable Feature 009 handoff. Feature 009, Match screens or routes, celebration,
confirmation, post-match actions, early resolution, threshold modes, decision
editing, dynamic membership, filter reopening, alternate candidate sources,
ranking/recommendations, permanent accounts, and cross-device identity transfer
require separately approved specifications.

All checkboxes are intentionally unchecked at task generation. This artifact
creates no implementation, migration, generated-type update, dependency change,
service/test run, browser identity charge, branch, commit, push, issue, Feature
009 work, or consistency-analysis verdict.
