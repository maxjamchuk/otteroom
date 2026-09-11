---
description: "Executable task breakdown for Common Filter Resolution"
---

# Tasks: Common Filter Resolution

**Input**: Reviewed documents in `/specs/005-common-filter-resolution/`,
`.specify/memory/constitution.md`, `docs/product-vision.md`,
`docs/mvp-roadmap.md`, `docs/testing-strategy.md` and the completed Feature 004
specification, plan and contracts.

**Prerequisites**: [spec.md](spec.md),
[checklist](checklists/requirements.md), [plan.md](plan.md),
[research.md](research.md), [data-model.md](data-model.md),
[quickstart.md](quickstart.md),
[resolution RPC](contracts/common-filter-resolution-rpc.md),
[room projection/Realtime](contracts/room-resolution-projection-realtime.md),
[client flow](contracts/client-resolution-flow.md) and
[Feature 006 handoff](contracts/feature-006-filter-handoff.md).

**Tests**: Required by the specification, constitution and approved plan. Write
behavioral/contract evidence before the implementation it governs and observe
the relevant failure. PostgreSQL is the primary oracle for algebra, authority,
ACL/RLS, writes, locking, rollback and `xmin`; client tests own parsing,
one-flight and stale-generation behavior; browser cases prove representative
real Auth/RPC/PostgreSQL/Realtime/UI cooperation.

**Organization**: Phase 2 establishes the shared PostgreSQL authority and R01
cutover. Phases 3–5 implement the three prioritized stories and together form
one coherent schema/types/client release. Phase 6 owns the approved impact
matrix, browser acceptance, repeatability and fresh-checkout evidence. No task
implements Feature 006 or fetches/displays a movie.

| Label | User story | Independent demonstration |
| --- | --- | --- |
| US1 | Resolve Every Frozen Voter Constraint (P1) | PostgreSQL algebra plus I01 prove no early result and one compatible result containing every frozen voter clause exactly once |
| US2 | Converge on Compatible or Incompatible (P1) | Client/Realtime evidence plus I01/I02 prove one shared terminal status, explicit incompatible handling and status-only UI |
| US3 | Recover a Stable Private Resolution (P2) | DB rollback/idempotency, client generation guards and I03 prove reload/retry/lost-response recovery without detail disclosure or filter mutation |

## Format: `[ID] [P?] [Story?] Description`

Every task uses an unchecked checkbox and a unique sequential ID. `[P]` appears
only in the disjoint-file authoring groups listed below. Database stack changes,
generated-type writes, shared route/configuration edits and browser executions
remain serial. Paths are repository-relative and literal; `app/room/[code].tsx`
is a filename, not a wildcard. A task is complete only when its stated evidence
is recorded and green.

## Binding Implementation Boundaries

- `rooms.filter_resolution_status` is the sole participant-visible authority and
  has exactly `pending | compatible | incompatible`. There is no persisted
  failure value and no terminal reversal.
- A compatible result alone owns one private inclusive year parent and ordered
  anonymous genre clauses. Each nonempty voter selection is one OR clause; all
  clauses are ANDed; Any contributes no clause. Duplicate equal clauses remain.
- Canonical ordering is independent of source row order: enum order within each
  clause, clause-value order across clauses and private membership UUID only as
  an unpersisted tie-breaker. Never collapse clauses to a union/intersection.
- Only `max(all release_year_from) <= min(all release_year_to)` is compatible.
  Disjoint genres and catalog emptiness are not Feature 005 incompatibility.
- `resolve_common_filters(uuid)` is the only resolver. It authorizes first,
  locks one room, validates frozen N/N, writes once atomically and returns only
  outcome plus status. It never changes `participant_filters`.
- Keep the one exact-room `public.rooms` UPDATE invalidation/refetch channel.
  Publish no filters/private result, and add no Presence, Broadcast, polling,
  job, trigger, Edge Function or second channel.
- Clients receive only status/next action. Exact years, clauses, clause count,
  roster and source ownership stay private. Compatible is only a server-side
  prerequisite for future Feature 006, not candidate acquisition.
- Use one additive migration after `20260911000000_participant_filters.sql`.
  Existing rooms and Feature 004 rows remain exact; preexisting frozen N/N rooms
  start pending and resolve lazily through the same RPC.
- Keep Feature 004 filter RPC signatures, owner privacy, first-N/N freeze and
  candidate suppression unchanged. Do not add filter reopening or a new round.
- Browser work uses public-client credentials and the safe wrappers only. C1
  remains one identity; no screenshots, trace, HAR, video, storage-state export,
  raw Auth/RPC/Realtime/private data or internal IDs may enter artifacts.

## Exact Final Contracts

`public.resolve_common_filters(p_room_id uuid)` returns exactly one row with
`outcome` and `filter_resolution_status`. The closed business matrix is
`not_found/NULL`, `pending/pending`, `compatible/compatible` and
`incompatible/incompatible`; exceptions return no business row.

Accepted `create_room`/`join_room` results contain ten fields, adding stored
`filter_resolution_status`; rejected join results retain only non-null `outcome`
and nine NULL projection fields. `refetchRoom` selects exactly seven fields:
`id, code, state, voter_count, required_voter_count, filter_completed_count,
filter_resolution_status`.

The server-only Feature 006 handoff is available only for compatible rooms and
contains `[release_year_from, release_year_to]` plus ordered AND-of-OR genre
clauses. It contains no identity or movie data. Pending, incompatible,
unauthorized and integrity-invalid states yield no handoff.

## Phase 1: Setup — Protected Baseline and Evidence Ledger

**Goal**: Establish an auditable baseline without changing runtime behavior,
dependencies, historical migrations, generated types or security controls.

- [X] T001 Capture branch, HEAD, exact status, declared/host Node/npm/Supabase versions and hashes for all historical migrations, `src/types/database.generated.ts`, `scripts/database-types.mjs`, `__tests__/config/c1-capture.test.ts`, Feature 004 contracts/tests and candidate assets; add a future implementation evidence ledger for G1–G4, R01/R02 and protected-scope checks to `specs/005-common-filter-resolution/quickstart.md` without claiming a pass.

**Checkpoint**: Baseline provenance and protected artifacts are recorded. This
is not implementation evidence and has no delivery commit boundary.

---

## Phase 2: Foundational — PostgreSQL Authority and Additive Migration

**Goal**: Define and prove status/payload authority, deterministic algebra, one
hardened RPC, privacy, idempotency, concurrency and nonempty migration before
the sole generated-types write. This DB-only state is not independently shipped.

### Contract tests before implementation

- [X] T002 [P] Add failing schema/ACL/publication tests in `supabase/tests/database/common_filter_resolution.test.sql` for the exact status enum/default/check, private parent/clause columns and types, PK/FK/checks, postgres ownership, RLS with no client policies/grants, rooms-only Realtime, no persisted failure/movie/catalog/identity fields and exact seven-column rooms grant.
- [X] T003 Extend `supabase/tests/database/common_filter_resolution.test.sql` with failing exact-signature/owner/search-path/EXECUTE/cardinality/nullability/outcome tests for `resolve_common_filters(uuid)` plus early pending/no-write, missing/foreign masking before lock, authorized non-voting invocation with zero contribution, exact voter/filter integrity rejection, max/min inclusive years, one-year overlap and disjoint-year incompatibility.
- [X] T004 Extend `supabase/tests/database/common_filter_resolution.test.sql` with failing canonical-payload and Feature 006 handoff-shape tests: Any contributes no row, all-Any yields zero clauses, one enum-ordered OR array per constrained voter, clause-value ordering independent of member/filter row order, duplicate equal clauses retained with contiguous ordinals, disjoint genres remain compatible, no TMDB/catalog call, and only compatible has one private structurally valid payload.
- [X] T005 [P] Add failing preservation/suppression tests to `supabase/tests/database/participant_filter_concurrency.test.sql` and `supabase/tests/database/room_candidate.test.sql` proving resolution cannot reopen/edit/delete Feature 004 rows, change filter/count/value/xmin state, call/restore candidate authority, assign a fixture or expose existing candidate metadata for pending/compatible/incompatible rooms.
- [X] T006 Add deterministic pgTAP+dblink trials to `supabase/tests/database/common_filter_resolution.test.sql` for concurrent first compatible and incompatible calls, repeated same-/other-member calls, committed-response loss, injected post-work rollback/retry, unrelated-room independence and foreign-call no-lock behavior; use authenticated READ COMMITTED PIDs, owner-held room locks, `pg_blocking_pids`/ungranted-lock barriers, bounded drains, exact snapshots/xmin and per-session room/parent/clause/filter write deltas, with no shipped fault object.

### Single additive migration and resolver

- [X] T007 Create `supabase/migrations/20260912000000_common_filter_resolution.sql` as one additive transaction that defines `public.filter_resolution_status`, adds non-null pending `rooms.filter_resolution_status` and the terminal-requires-Ready-N/N check, creates postgres-owned/RLS-enabled `private.room_filter_resolutions` and `private.room_filter_resolution_genre_clauses` with exact keys/checks and deny-by-default ACLs, and adds neither private relation to Realtime.
- [X] T008 Evolve `create_room` and `join_room` inside `supabase/migrations/20260912000000_common_filter_resolution.sql` only for the tenth status field, preserving every Feature 003/004 outcome, authorization, lock order and write rule; replace rooms grants with the exact seven safe columns, keep rejected join rows strict-null and preserve all Feature 004 RPC signatures/grants.
- [X] T009 Implement and harden `public.resolve_common_filters(uuid)` in `supabase/migrations/20260912000000_common_filter_resolution.sql`: require `auth.uid()`, authorize membership before room lock/business validation, lock exactly one room, return early pending/terminal no-writes, validate the complete fixed voter/filter set at N/N, compute exact max/min years, persist compatible parent plus canonical anonymous clauses or incompatible status atomically, update room status/timestamp once and return only the two approved fields.
- [X] T010 Finalize `supabase/migrations/20260912000000_common_filter_resolution.sql` with terminal payload-shape validation, exact-signature revokes and authenticated-only resolver EXECUTE, postgres ownership/empty search path/qualified SQL, no direct private-table policy or privilege, no filter/candidate mutation, no trigger/job/helper exposure, rooms-only publication, PostgREST reload and migration-time verification that every existing room is pending with zero private result and otherwise unchanged.

### Nonempty migration and internal green gate

- [X] T011 Create bounded owner-only Feature 004 fixtures in `supabase/tests/migration/common_filter_resolution.before.sql` for Waiting, partial, compatible-frozen N/N and incompatible-frozen N/N rooms across voting/non-voting creator modes and NULL/preassigned candidate FKs; snapshot exact room/member/filter/candidate/timestamp values and xmin with zero GoTrue signups.
- [X] T012 Create post-upgrade assertions in `supabase/tests/migration/common_filter_resolution.after.sql` that the actual migration preserves every T011 value/xmin except the pending default, creates no payload at install, exposes exact schema/ACL/RPC/projection/publication shapes, keeps Feature 004 own-detail privacy/candidate suppression, lazily resolves preserved compatible and incompatible N/N rooms through ordinary authenticated calls, and leaves Waiting/partial rooms pending before owned-fixture cleanup.
- [X] T013 Implement `scripts/check-common-filter-resolution-migration.mjs` as an owned-stack, version-limited runner that validates local identity/idle state, resets exactly through `20260911000000`, runs T011, applies the actual pending migration, runs T012 and guarantees latest clean reset/cleanup on success/failure/interruption without copying SQL, generating types, printing private data or creating GoTrue users.
- [X] T014 Evolve latest-schema inventories in `scripts/check-room-membership-migration.mjs`, `scripts/check-participant-filters-migration.mjs`, `supabase/tests/migration/room_membership.after.sql` and `supabase/tests/migration/participant_filters.after.sql` to expect pending status, private result relations, exact new RPC/grants and lazy Feature 005 behavior where applicable while preserving every earlier nonempty assertion and leaving all historical migrations byte-unchanged.
- [X] T015 Run the internal DB gate from `specs/005-common-filter-resolution/quickstart.md`: safely start/configure the local stack, execute all three nonempty migration runners, clean-reset latest and run full `npm run db:test`; record commands, actual assertion totals, deterministic lock/rollback/xmin/write evidence, zero GoTrue identities and cleanup, and block R01 on any failure.
- [X] T016 Perform R01 exactly once after T015 by running `npm run db:types`, immediately run `npm run db:types:check`, review the public enum/room/create/join/resolver changes and absence of private relations, and record hash/inode/size/mtime/ctime in `specs/005-common-filter-resolution/quickstart.md`; then independently reset and run check-only with identical metadata, never edit `scripts/database-types.mjs` or manually patch `src/types/database.generated.ts`.

**G1 internal checkpoint — T016**: Database authority, nonempty upgrade,
deterministic concurrency, privacy, candidate suppression and the sole R01 write
are green. Do not deliver or commit this incompatible DB-only cutover separately.

---

## Phase 3: User Story 1 — Resolve Every Frozen Voter Constraint (Priority: P1) 🎯 MVP Core

**Goal**: Automatically initiate the server-owned resolution only from exact
frozen N/N and adopt the compatible result without exposing or calculating the
constraint client-side.

**Independent Test**: Use two-/three-voter fixtures below assembly, at partial
X/N and frozen N/N; prove zero early calls/results, exact trigger at N/N, one
compatible status, stable retry and no candidate request/display.

### Tests before client implementation

- [X] T017 [P] [US1] Create `__tests__/resolution/contracts.test.ts` and `__tests__/resolution/service.test.ts` for exact two-field resolver parsing, closed outcome/status nullability, one-row cardinality, extra/missing/private-field rejection, room-UUID-only authenticated invocation and safe transport/integrity errors with no years/genres/clauses/count/ID/candidate data.
- [X] T018 [P] [US1] Extend `__tests__/rooms/contracts.test.ts` and `__tests__/rooms/service.test.ts` for exact ten-field create/join parsing, strict rejected-join nullability, seven-field refetch, valid status/count/state combinations, stored terminal recovery and exact-column reads with no select-star/private/candidate/member fields.
- [X] T019 [US1] Add failing trigger/state tests in `__tests__/resolution/state.test.ts` and `__tests__/resolution/use-common-filter-resolution.test.ts` for inactivity below Ready or X<N, one automatic shared flight at exact N/N+pending, React effect replay, no local constraint derivation, compatible adoption, equal retry/no-op, unexpected pending as one retryable error with no automatic loop and zero call after terminal.

### Client implementation and compatible route integration

- [X] T020 [US1] Implement exact runtime contracts and the authenticated UUID-only RPC boundary in `src/resolution/contracts.ts` and `src/resolution/service.ts`, strictly narrowing every result and mapping failures to safe messages without raw SQLSTATE, payloads, UUIDs or hidden result details.
- [X] T021 [US1] Evolve generated-type consumers in `src/rooms/contracts.ts`, `src/rooms/service.ts` and `src/rooms/state.ts` to the exact ten-/seven-field projections and status/count invariants while retaining immutable room/code/role/target and monotonic membership/filter progress semantics.
- [X] T022 [US1] Implement the N/N trigger, one-flight attempt state and compatible adoption in `src/resolution/state.ts` and `src/resolution/use-common-filter-resolution.ts`; scope every promise/result to room/request generation, never calculate/supply filters, treat pending/error as non-usable and prevent duplicate calls after terminal.
- [X] T023 [US1] Add route/form tests in `__tests__/routes/room.test.tsx` and `__tests__/filters/participant-filter-form.test.tsx` for below-assembly/partial inactivity, frozen N/N resolving, voter own accepted read-only detail/recovery, non-voter no-detail behavior, compatible status-only next-step copy and removal of Feature 004's stale “Feature 005 is next” heading; require zero candidate/TMDB imports, calls, metadata or controls.
- [X] T024 [US1] Create the resolving/compatible surface in `src/resolution/common-filter-resolution-panel.tsx`, evolve frozen-N/N composition in `src/filters/participant-filter-form.tsx`, and integrate `src/resolution/use-common-filter-resolution.ts` from `app/room/[code].tsx` while preserving canonical QR/link/code entry, invitations, one rooms subscription and own-filter recovery; show no exact constraint or movie.
- [X] T025 [US1] Run focused resolution/room/filter/route tests plus lint and typecheck for T017–T024 and record actual commands/results in `specs/005-common-filter-resolution/quickstart.md`; demonstrate US1 fixture states, trigger cardinality, canonical server authority and candidate-call zero before US2 work.

**US1 checkpoint — T025**: The complete-group compatible path is functional
against the server contract. It is not releasable until US2 adds both terminal
meanings/convergence and US3 completes recovery/failure handling.

---

## Phase 4: User Story 2 — Converge on Compatible or Incompatible (Priority: P1)

**Goal**: Make every authorized member converge on one authoritative terminal
status, with compatible future-readiness and explicit frozen incompatible/new-room
behavior, while keeping all resolved detail private.

**Independent Test**: Feed compatible/incompatible snapshots in both creator
modes through resolver response and room invalidation/refetch; prove monotonic
status, conflict fail-closed behavior, identical status-only UI and no movie.

### Tests before terminal/convergence implementation

- [X] T026 [US2] Extend `__tests__/rooms/state.test.ts` and `__tests__/resolution/state.test.ts` with failing pending→compatible/incompatible merges, delayed-pending suppression, equal-terminal no-op, terminal-requires-N/N rejection, incompatible terminal immutability and compatible-vs-incompatible conflict entering a generation-scoped integrity error that suppresses all ready/next-action meaning.
- [X] T027 [US2] Extend `__tests__/rooms/use-room-subscription.test.ts` with failing exact seven-field invalidation/refetch tests for terminal resolution, direct pending→terminal missed-event recovery, initial system-ok refetch, burst coalescing, terminal no regression, stale room/lifecycle/request rejection, separate sync Retry and unchanged one-channel cleanup/reconnect behavior.
- [X] T028 [US2] Extend `__tests__/routes/room.test.tsx` and create `__tests__/resolution/common-filter-resolution-panel.test.tsx` for resolving, transient failure, compatible, incompatible and integrity-error views across voters/non-voting creators; verify compatible exposes only future sourcing meaning, incompatible exposes existing new-room navigation without edit/reset, and no view leaks years/genres/clauses/count/roster/IDs or candidate content.

### Terminal/convergence implementation

- [X] T029 [US2] Implement the monotonic status watermark and fail-closed terminal-conflict overlay in `src/rooms/state.ts` and `src/resolution/state.ts`, accepting only exact authoritative create/join/refetch/resolver snapshots and requiring a fresh canonical room-entry generation to clear integrity error.
- [X] T030 [US2] Evolve `src/rooms/use-room-subscription.ts` to refetch the exact seven-field room projection on the existing id-only `public.rooms` UPDATE/system-ok lifecycle, preserving one active plus one pending read, stale guards, last accepted state on error, explicit Retry and prior-channel removal; add no second subscription, Presence, Broadcast or polling.
- [X] T031 [US2] Complete terminal rendering/navigation in `src/resolution/common-filter-resolution-panel.tsx` and `app/room/[code].tsx`: compatible shows status and future Feature 006 next-step meaning only; incompatible is frozen/terminal and routes to existing new-room creation; integrity error hides both meanings; every state suppresses candidate/movie UI and network paths.
- [X] T032 [US2] Run focused state/subscription/panel/route tests plus lint and typecheck for T026–T031, and record in `specs/005-common-filter-resolution/quickstart.md` the compatible/incompatible convergence, privacy, one-channel and no-candidate evidence.

**US2 checkpoint — T032**: Both terminal outcomes and cross-client convergence
are independently demonstrable. Recovery, failed attempts and lost responses
remain the final client slice.

---

## Phase 5: User Story 3 — Recover a Stable Private Resolution (Priority: P2)

**Goal**: Recover the stored status after reload/reconnect/re-entry, retry safe
failures and lost responses, preserve frozen filters and expose no private
source/resolution details.

**Independent Test**: Exercise same-identity entry, missed updates, a pre-commit
failure, a discarded committed response, route A→B→A and cross-room attempts;
prove stable status, unchanged filters and status-only visibility.

### Tests before recovery implementation

- [X] T033 [US3] Extend `__tests__/resolution/service.test.ts` and `__tests__/resolution/use-common-filter-resolution.test.ts` with failing pre-forward/transport failure, explicit Retry, committed-response-loss/refetch recovery, peer-success clearing local error, pending-without-loop, same-generation one-flight, new-generation retry and route A→B→A stale success/error rejection; assert failure remains pending and never renders incompatible.
- [X] T034 [US3] Extend `__tests__/routes/room.test.tsx`, `__tests__/filters/participant-filter-form.test.tsx` and `__tests__/rooms/use-room-subscription.test.ts` for reload/link/QR/code terminal recovery, socket rebind/system-ok missed-update recovery, voter own locked-detail retry beside status, non-voting creator zero detail request, room-sync/resolution retry separation and fresh-entry recovery from integrity error with no roster/private/candidate output.

### Recovery integration and atomic client gate

- [X] T035 [US3] Complete bounded retry, terminal-refetch dominance, peer-success clearing, stale-generation disposal and cleanup in `src/resolution/use-common-filter-resolution.ts`, compose it with `src/rooms/use-room-subscription.ts` and `app/room/[code].tsx`, and preserve Feature 004 accepted detail/draft/freeze state without reopening or mutating any filter.
- [X] T036 [US3] Perform a privacy/scope inspection across `src/resolution/`, `src/rooms/`, `src/filters/` and `app/room/[code].tsx`; remove any exact constraint, identity, roster, candidate/TMDB, ranking/swipe/progression/match path and add focused negative assertions in `__tests__/resolution/` and `__tests__/routes/room.test.tsx` for every removed/forbidden surface.
- [X] T037 [US3] Run the complete atomic typed/client gate from `specs/005-common-filter-resolution/quickstart.md`: independent latest reset, check-only `npm run db:types:check` with identical metadata, full database and client suites, lint, typecheck, web export and iOS/Android export; record actual results/cleanup and keep every later type validation check-only.

**G2 atomic cutover checkpoint — T037**: Schema, generated types, RPC contracts,
client state, Realtime, privacy and route behavior are coherent and green. This
is the first safe logical implementation commit boundary; do not publish it
without the real-stack gate.

---

## Phase 6: Real-Stack Acceptance, Impact Review and Reproducibility

**Goal**: Add only approved Feature 005/browser impact evidence, validate the
29-identity normal gate, then reproduce it within the 54/17/71 budgets.

### Browser authoring and safe discovery

- [ ] T038 Create `e2e/support/resolution-harness.ts` with bounded public-client RPC/route/socket failure controls, exact status-only assertions, safe request counters, deterministic owned contexts/barriers/cleanup and no private-table/service-role/raw-payload/DOM dump; extend `e2e/support/room-harness.ts` and `e2e/support/filter-harness.ts` only for reusable status/new-room/candidate-zero observations without changing shared Auth/context semantics.
- [ ] T039 [P] Create `e2e/common-filter-resolution.spec.ts` with exactly `@resolution` I01/I02/I03 and caps 3/4/2: I01 voting creator plus two voters partial→compatible with Any, disjoint genre clauses and overlapping years plus convergence/reload/reconnect/re-entry; I02 non-voting creator plus three voters disjoint years→terminal incompatible with aggregate-only privacy, missed-update recovery and new-room action; I03 two identities reused across bounded rooms for pre-commit failure/Retry and committed-response-loss recovery; every case asserts frozen filters and candidate/TMDB traffic/UI zero.
- [ ] T040 [P] Evolve only the Feature 005-affected permanent smoke assertions G03/G04/G05/G08 in `e2e/generalized-room-membership-qr.spec.ts`: preserve exact 3/4/2/4 identities, membership/QR/isolation intent and Feature 004 values, add stored-status parsing and appropriate pending/terminal recovery, and do not broaden into hidden payload checks or non-smoke G cases.
- [ ] T041 [P] Evolve H01 and the targeted H03 boundary in `e2e/participant-filters.spec.ts`: retain H01's 3-identity owned-filter/frozen-handoff smoke meaning, adapt its terminal continuation to Feature 005, and update H03's 3-identity first-N/N/final-save race and lost-confirmation assertions to coexist with automatic resolution while retaining every Feature 004 freeze/no-write invariant; leave H02 and its recovery/edit behavior unselected and unchanged.
- [ ] T042 Register only `common-filter-resolution.spec.ts` and `@resolution`/I01–I03 in `playwright.config.ts`, `scripts/run-e2e.mjs`, `e2e/support/safe-reporter.ts` and `e2e/support/safe-diagnostics.ts`; preserve workers1/retries0/repeatEach1, capture/scanner/cleanup semantics and full discovery, keep permanent smoke exactly G03/G04/G05/G08/H01=16, and allow targeted H03 once without adding H02 or non-smoke E/G.
- [ ] T043 Extend `__tests__/config/e2e-diagnostics.test.ts` and `__tests__/config/playwright-runtime.test.ts` with zero-identity static proof of exact I titles/locations/caps totaling F=9, smoke five cases/16, H03 targeted cost3, safe labels/allowlists, rejection of future/arbitrary selectors and normal/repeatability/fresh formulas 29/54/17/71; run these config tests and block browsers on any mismatch.

### Green execution and evidence receipts

- [ ] T044 Run the non-browser normal gate in `specs/005-common-filter-resolution/quickstart.md`: all three nonempty migrations, clean latest reset, check-only generated types, full lint/typecheck/client/database suites, web/native exports and artifact/static scope checks; record exact SHA/worktree, commands/results/counts/type metadata and cleanup with zero browser identities.
- [ ] T045 Execute the first and only normal browser checkpoint through safe wrappers: `npm run test:e2e:security` (C1=1), `npm run test:e2e -- --grep @resolution` (F=9), `npm run test:e2e:smoke` (16) and `npm run test:e2e -- --grep H03` (T=3); require scanner zero, exact cases/attempts/identities, workers1/retries0/repeatEach1, owned cleanup and a total reservation/receipt of 29 in `specs/005-common-filter-resolution/quickstart.md`, counting every failed/partial/manual attempt.
- [ ] T046 Treat T045's owner+smoke execution as repeatability run 1, wait outside all harnesses for an admitted unchanged-source window, then rerun owner F=9 plus smoke16 once with fresh case contexts and no second C1/H03; record matching outcomes, scanner zero, check-only type metadata, cleanup and aggregate `1 + 2 × (16 + 9) + 3 = 54` without quota probing, 429 retry, limit changes, service reset or shared Auth storage.
- [ ] T047 After the reviewed G3 implementation is committed by the owner, run the independent exact-SHA fresh-checkout path in a disposable `/tmp/otteroom-005-fresh.*` checkout: declared toolchain/npm ci, local env/stack, all nonempty migrations, clean reset, check-only types, full static/client/DB/build/web/native gates, C1 and permanent smoke only; copy no env/node_modules/Auth/cache/volume data, require scanner zero and cleanup, record 17 identities and combined repeatability+fresh total71, then remove only owned resources.
- [ ] T048 Complete final evidence, traceability and scope review in `specs/005-common-filter-resolution/tasks.md` and `specs/005-common-filter-resolution/quickstart.md`: reconcile actual receipts against every matrix below, verify all historical migrations/Feature 004 contracts/filter rows/candidate assets/C1 unchanged, exactly one R01 write and later check-only runs, exact R02 accounting, no private disclosure/second channel/TMDB/candidate/filter-reopen/Feature 006 implementation, run `git diff --check` and checklist-format/status validation, and leave any task unchecked whose reproducible evidence did not pass.

**G3 checkpoint — T045**: The normal Feature 005 release gate is green at 29
identities. This is the reviewed release-candidate commit boundary.

**G4 checkpoint — T048**: Repeatability and independent fresh checkout are green
at 54 and 17 identities respectively, total 71. Feature 005 ends at a private
compatible constraint or explicit terminal incompatible status.

## Dependencies and Execution Order

### Phase dependencies

```text
Phase 1 T001
  → Phase 2 T002–T016 / G1 (DB authority + sole R01 write)
  → Phase 3 T017–T025 / US1
  → Phase 4 T026–T032 / US2
  → Phase 5 T033–T037 / US3 + G2 atomic client cutover
  → Phase 6 T038–T048 / G3–G4 acceptance and reproducibility
```

Default execution is sequential by ID except the explicit disjoint authoring
groups below. Migration/RPC edits, generated types, room/resolution production
modules, route composition, shared acceptance metadata and every mutable-stack
or browser command are serial.

| Dependency | Required result |
| --- | --- |
| T001 → T002–T006 → T007–T010 | Protected baseline and failing schema/RPC/algebra/race/preservation evidence before one migration |
| T007–T010 → T011–T014 → T015 → T016 | Final DB contract before nonempty upgrades and full DB gate; DB green before sole type generation/check-only proof |
| T016 → T017–T019 → T020–T024 → T025 | Generated public contract before exact parsers/service/state/route compatible flow |
| T025 → T026–T028 → T029–T031 → T032 | Terminal/conflict/Realtime tests before compatible/incompatible implementation |
| T032 → T033–T034 → T035–T036 → T037 | Failure/recovery/stale/privacy tests before final atomic client gate |
| T037 → T038 → T039–T041 → T042–T043 | Stable client boundary before harness, cases, safe discovery and static budget proof |
| T043 → T044 → T045 → T046 → T047 → T048 | Non-browser gate before charged browser run, then repeatability, exact-SHA fresh checkout and final reconciliation |

### Story dependencies and independent checkpoints

- **US1 (P1)** starts after G1 and provides the N/N trigger/compatible flow used
  by the later story surfaces. Its independent local proof is T025; I01 at T045
  supplies the real-stack proof.
- **US2 (P1)** depends on US1's trigger but independently owns the two terminal
  meanings, convergence and one-channel invalidation. T032 plus I01/I02 proves it.
- **US3 (P2)** depends on both terminal meanings and owns retry/recovery/privacy
  under interruption. T037, the Phase 2 DB evidence and I03 prove it.
- Phases 3–5 are evidence-ordered pieces of one cutover. The first coherent code
  commit boundary is G2; the reviewed release-candidate boundary is G3. Do not
  deploy a DB/types/client intermediate or push before all requested gates.

## Parallel Opportunities

Exactly seven tasks carry `[P]`, in three safe authoring groups:

| Group | Prerequisite | Parallel tasks | Disjoint ownership |
| --- | --- | --- | --- |
| A — DB contract authoring | T001 | T002 and T005 | New resolution SQL suite versus existing filter/candidate preservation suites |
| B — client contract authoring | T016 | T017 and T018 | New resolution tests versus existing room tests |
| C — browser case authoring | T038 | T039, T040 and T041 | New resolution spec, generalized membership spec and participant-filter spec |

Browser execution is never parallel even when source authoring is. T003/T004/T006
remain serial in one SQL file; T042 owns all shared runner/config/reporter edits.

## Testing-Strategy Impact Matrix

| Observable boundary | Primary authority/tasks | Browser evidence | Historical cost |
| --- | --- | --- | ---: |
| Frozen N/N → automatic resolution | T003/T006/T019/T022/T033 | I01/I02; evolved G03/G04/H01 | H03 once / 3 |
| Exact years and anonymous AND-of-OR clauses | T003/T004/T009 | I01/I02 show terminal integration only | None / 0 |
| Concurrent first calls, rollback, no-write retry, lost response | T006/T009/T033/T035 | I03 visible recovery | H03 already selected |
| Private payload/source and cross-room denial | T002–T005/T009/T012/T036 | I02 status-only; G08 ordinary JWT | None / 0 |
| Status projection, terminal merge, Realtime/stale guards | T018/T021/T026–T030/T034 | I01/I02; G03/G04/H01 | None / 0 |
| Feature 004 own-filter recovery/edit/freeze | Existing suites plus T005/T034 | H01 smoke and targeted H03 only | H02 not selected / 0 |
| QR/link/code/Auth/capacity lifecycle | Existing authority plus T018/T021 | G03/G04/G05 smoke | No non-smoke E/G / 0 |
| Candidate suppression through all new states | T005/T023/T028/T031/T036 | I01–I03 and all smoke paths | None / 0 |
| Safe harness/reporter/scanner | T038/T042/T043 | C1 plus charged profiles | No full historical trigger |

### Exact R01/C1/R02 accounting

- **R01**: T016 is the only `npm run db:types` write. T016 immediately checks
  and independently resets/checks metadata; T037/T044/T046/T047 are check-only.
- **C1**: `__tests__/config/c1-capture.test.ts` stays byte-unchanged. T045/T046
  run C1 once total for repeatability; T047 runs a separate fresh-checkout C1.
- **Feature owner**: I01=3, I02=4, I03=2, so `F=9`.
- **Permanent smoke**: G03=3, G04=4, G05=2, G08=4, H01=3, so `16`.
- **Targeted historical**: H03 once=`T=3`; H02 and non-smoke E/G are excluded.

| Gate | Arithmetic | Identities |
| --- | --- | ---: |
| Normal checkpoint | `C1 1 + smoke 16 + F 9 + H03 3` | **29** |
| Repeatability | `C1 1 + 2 × (smoke 16 + F 9) + H03 3` | **54** |
| Fresh checkout | `C1 1 + smoke 16` | **17** |
| Repeatability + fresh | `54 + 17` | **71** |

Every actual failed/partial/targeted/manual attempt is additive. Keep
`anonymous_users=150`, workers1/retries0/repeatEach1, no storage export and no
quota probing/reset/restart/limit change/429 retry.

## Requirements Traceability

### Functional requirements — 27/27

| Requirement | Implementation task(s) | Executable evidence |
| --- | --- | --- |
| FR-001 | T009/T022/T024 | T003/T006/T019/T023, I01/H03 |
| FR-002 | T009/T022 | T003/T019/T023, I01 |
| FR-003 | T009 | T003/T004/T006, I01 |
| FR-004 | T009/T024 | T003/T004/T028, I02/G04 |
| FR-005 | T009/T021/T024 | T003/T004/T018/T023, I01/I02 |
| FR-006 | T009 | T003/T004, I01/I02 |
| FR-007 | T009 | T004, I01 |
| FR-008 | T009 | T004/T006, I01 |
| FR-009 | T009 | T003/T004, I01/I02 |
| FR-010 | T007/T009/T010 | T002–T004/T012, I01 |
| FR-011 | T007/T009/T010/T031 | T002–T004/T028, I02 |
| FR-012 | T009/T031 | T005/T026/T028, I02 |
| FR-013 | T020/T022/T031/T035 | T017/T019/T028/T033, I01–I03 |
| FR-014 | T020/T021/T024/T031/T036 | T017/T018/T023/T028/T034, I01/I02 |
| FR-015 | T009/T029/T030 | T006/T026/T027, I01/I02 |
| FR-016 | T008/T021/T030/T035 | T012/T018/T027/T033/T034, I01/I02 |
| FR-017 | T009/T022/T029/T035 | T006/T019/T026/T033, I03/H03 |
| FR-018 | T009/T022/T035 | T006/T019/T033, I03 |
| FR-019 | T009/T029/T030/T035 | T006/T026/T027/T033, I01–I03 |
| FR-020 | Preserve Feature 004 plus T024/T034/T036 | T002/T004/T005/T023/T028/T034, I01/I02/G08 |
| FR-021 | T009/T010/T020/T021 | T002/T003/T012/T017/T018, G08 |
| FR-022 | T020/T024/T031/T035 | T017/T023/T028/T033/T034, I01–I03 |
| FR-023 | T009/T035 | T005/T006/T012/T033/T034, I03/H03 |
| FR-024 | Bounded T007–T036 | T005/T017/T023/T028/T036, I01–I03/smoke |
| FR-025 | T007/T009/T010 | T002–T004/T012, I01/I02 |
| FR-026 | Preserve T008/T021/T024/T035 | T012/T018/T023/T034, G03/G04/G05/I01/I02 |
| FR-027 | T008/T010/T021/T030 | T002/T012/T018/T027, I01/I02 |

### Non-functional requirements — 6/6

| Requirement | Implementation task(s) | Executable evidence/checkpoint |
| --- | --- | --- |
| NFR-001 | T009/T022/T029/T030 | T004/T006/T019/T026/T027, I01/I02, T045–T047 |
| NFR-002 | T007–T010/T021/T030/T035 | T006/T012/T018/T027/T033/T034, I01–I03, T047 |
| NFR-003 | T007–T010/T020/T024/T036 | T002–T005/T012/T017/T023/T028/T034, I02/G08/C1 |
| NFR-004 | T009/T022/T029/T035 | T005/T006/T019/T026/T033, I03/H03 |
| NFR-005 | T024/T031/T035 | T023/T028/T033/T034, I01–I03 |
| NFR-006 | Preserve T008/T021/T024/T030/T035 | T005/T012/T018/T027/T034/T043, smoke/H03/C1 |

### Success criteria — 12/12

| Criterion | Implementation basis | Executable evidence/checkpoint |
| --- | --- | --- |
| SC-001 | T009/T022 | T003/T019/T023, I01 |
| SC-002 | T009 | T003/T004/T006, I01/I02 |
| SC-003 | T009 | T003/T004, I01/I02 |
| SC-004 | T009 | T004/T006, I01 |
| SC-005 | T029/T030/T031 | T026–T028, I01/I02 |
| SC-006 | T009/T030/T035 | T006/T027/T033/T034, I01–I03 |
| SC-007 | T009/T031 | T003–T005/T026/T028, I02 |
| SC-008 | T007–T010/T020/T036 | T002–T005/T012/T017/T028/T034, I02/G08 |
| SC-009 | Bounded T007–T036 | T005/T023/T028/T036, every I/smoke/H03 case |
| SC-010 | T009/T035 | T005/T006/T033/T034, I03/H03 |
| SC-011 | T038/T039/T042/T043 | I01=3 + I02=4 + I03=2 at T045 |
| SC-012 | Bounded T007–T048 | T004/T005/T023/T028/T036/T048 |

## Acceptance-Scenario Traceability — 25/25

| Scenario | Principal implementation | Executable evidence |
| --- | --- | --- |
| 1 | T009/T022/T024 | T003/T019/T023, I01 |
| 2 | T009/T022/T024 | T003/T019/T023, I01 |
| 3 | T009/T021/T030 | T003/T018/T027, I01 |
| 4 | T009/T022/T024 | T003/T019/T023, I01/H03 |
| 5 | T009 | T003/T004/T006, I01 |
| 6 | T009 | T003/T004, I02 |
| 7 | T009 | T003/T004, I01 |
| 8 | T009 | T004, I01 |
| 9 | T009/T022/T035 | T004/T006/T019/T033, I01/I03 |
| 10 | T007/T009/T031 | T002–T004/T028, I01 |
| 11 | T007/T009/T031 | T002–T004/T028, I02 |
| 12 | T009 | T004/T006, I01 |
| 13 | T029/T030/T035 | T026/T027/T033, I01/I02 |
| 14 | T009/T031 | T005/T026/T028, I02 |
| 15 | T024/T031/T036 | T017/T023/T028, I01 |
| 16 | T009/T029/T031 | T003/T026/T028, I01/I02 |
| 17 | T008/T021/T030/T035 | T006/T012/T018/T027/T033/T034, I01 |
| 18 | T008/T021/T030/T035 | T006/T012/T018/T027/T033/T034, I02 |
| 19 | T030/T035 | T027/T033/T034, I01/I02 |
| 20 | T009/T022/T035 | T006/T019/T033/T034, I03 |
| 21 | T009/T035 | T006/T033, I03 |
| 22 | Preserve Feature 004 plus T024/T034/T036 | T005/T023/T028/T034, I01/H01 |
| 23 | T024/T031/T034/T036 | T023/T028/T034, I02/G04 |
| 24 | T009/T020/T021/T036 | T002/T003/T005/T012/T017/T018, G08 |
| 25 | Bounded T007–T036 | T005/T023/T028/T036, every I case |

## Evolution and Handoff Traceability

| Boundary | Implementation tasks | Evidence |
| --- | --- | --- |
| Feature 004 frozen N/N remains irreversible | T005/T009/T024/T034/T035 | T005/T006/T012/T023/T034, H01/H03 |
| Feature 004 static handoff evolves to automatic resolver invocation | T022/T024 | T019/T023/T033, I01/I02/H03 |
| Existing Feature 004 rooms/data migrate unchanged and N/N resolves lazily | T007–T014 | T011–T015, I01 re-entry path |
| Own-filter privacy and non-voter distinction remain | T009/T024/T034/T036 | T002–T005/T012/T023/T028/T034, I02/G04/G08 |
| Candidate suppression remains through all statuses | T005/T024/T031/T036 | T005/T023/T028/T036, I01–I03/smoke |
| Compatible supplies only private stable Feature 006 prerequisite | T007/T009/T010 | T002–T004/T012, I01 status meaning |
| Pending/incompatible/failure block Feature 006 handoff | T009/T022/T031/T035 | T003/T004/T006/T019/T028/T033, I02/I03 |
| No Feature 006/TMDB/candidate implementation | Scope guard T001/T036/T048 | T004/T005/T017/T023/T028/T043/T044 |

## Implementation Strategy

1. Complete G1 with failing-first PostgreSQL contracts, one additive migration,
   deterministic DB evidence and the single R01 write/check-only proof.
2. Build US1, US2 and US3 in order and stop after each independent checkpoint;
   treat G2 as the first coherent code boundary because DB/types/client must match.
3. Author I01–I03 and only the approved smoke/H03 evolutions, prove discovery
   and budgets statically, then use the first charged execution as normal gate
   and repeatability run 1.
4. Run one admitted repeatability execution and one independent exact-SHA fresh
   checkout. Preserve every receipt and leave failed tasks unchecked.
5. Stop at authoritative compatible/incompatible resolution. TMDB, candidate
   sourcing/display, metadata, ranking, swipes, progression, agreement/match,
   filter reopening/new rounds, dynamic membership, providers, TV and permanent
   accounts require later approved features.

All checkboxes are intentionally unchecked at task generation. This artifact
creates no implementation, dependency change, service/test run, branch, commit,
push or analyze result.
