---
description: "Executable task breakdown for Participant Filters"
---

# Tasks: Participant Filters

**Input**: Reviewed documents in `/specs/004-participant-filters/`,
`.specify/memory/constitution.md`, `docs/product-vision.md`,
`docs/mvp-roadmap.md` and the completed Feature 003 plan/contracts/tasks.

**Prerequisites**: [spec.md](spec.md),
[checklist](checklists/requirements.md), [plan.md](plan.md),
[research.md](research.md), [data-model.md](data-model.md),
[quickstart.md](quickstart.md),
[participant-filter RPCs](contracts/participant-filter-rpcs.md),
[room projection/Realtime](contracts/room-filter-projection-realtime.md),
[candidate suppression](contracts/candidate-suppression.md) and
[client filter flow](contracts/client-filter-flow.md).

**Tests**: Required by the specification, constitution and approved plan. Add
behavioral/contract evidence before the implementation it governs and observe
the relevant failure. A type error, static text, mock invocation or file-presence
check alone is not acceptance evidence.

**Organization**: Phase 2 establishes the shared PostgreSQL authority. Phases
3–5 are grouped by the three user stories but together form the approved atomic
typed/client cutover; none is a separately deployable contract. Phase 6 evolves
the real-stack acceptance inventory and supplies repeatability/fresh-checkout
evidence. No task implements Feature 005 or later behavior.

| Label | User story | Independent demonstration |
| --- | --- | --- |
| US1 | Each Assembled Voter Configures Their Own Filters (P1) | H01 plus adapted Waiting/assembly flows prove voter-owned valid/default/editable input, non-voter rejection and no candidate |
| US2 | Personal Filters Survive Recovery and Concurrent Activity (P1) | H02 plus PostgreSQL lock/write evidence prove same-identity recovery, idempotency, failure/lost-response safety and isolation |
| US3 | The Room Tracks Completion and Stops at the Next-Feature Boundary (P2) | G03/G04 and H03 prove monotonic 0/N→N/N progress, deterministic freeze, aggregate-only observation and the Feature 005 handoff |

## Format: `[ID] [P?] [Story?] Description`

Every task starts with an unchecked checkbox and a unique sequential ID. `[P]`
is used only for the explicitly documented disjoint-file authoring groups; DB
stack mutations, generated types, shared configuration and browser execution
remain serial. Paths are repository-relative and literal; `app/room/[code].tsx`
is a filename, not a wildcard. Mark a task complete only after its stated
evidence has been produced and recorded.

## Binding implementation boundaries

- Keep `public.participant_filters` as the sole private accepted-value authority:
  `room_member_id` is its PK/FK and row existence is exactly one voting member's
  completion contribution. Store no draft, completion flag, duplicated room/Auth
  ID, resolution state or movie data.
- Keep `rooms.filter_completed_count` transactionally equal to accepted voter
  rows. Equality with `required_voter_count` is both all-voters-complete and the
  irreversible lock. Connectivity, a roster and non-voting creators never alter
  numerator or denominator.
- Use the fixed 19-value enum/application vocabulary and canonical enum ordering;
  `[]` means Any. Store required inclusive `smallint` bounds. Relational CHECKs
  are static (`1900..9999`, ordered); only the authenticated write RPC validates
  the current UTC year. Do not add a time-dependent CHECK.
- Every save/edit takes the authorized room row lock. Ownership comes from
  `auth.uid()` and existing `room_members`, never a client target. The final
  first insert atomically reaches N/N and freezes all rows. There is no delete,
  decrement, unlock or dynamic-membership operation.
- Direct filter table access is denied and no filter detail is published.
  `get_my_participant_filter` returns only caller-owned detail; all authorized
  room members receive only X/N through the exact rooms projection.
- Retain exactly one `public.rooms` UPDATE invalidation/refetch channel. Do not
  add `participant_filters` to Realtime, Presence, Broadcast, polling or another
  channel. One route-level monotonic watermark merges validated join, refetch,
  recovery and submit snapshots; N/N cannot regress.
- Revoke authenticated EXECUTE on `ensure_room_candidate(uuid)` and remove its
  normal route consumer/retry/card. Preserve fixtures, poster assets, FK and
  already-assigned values internally, but do not expose or assign them through
  Ready, recovery, filter submission or N/N. Do not gate the fixture RPC on N/N
  or invent a replacement candidate flow.
- Keep Feature 003 membership, QR/link/code joining, fixed group, invitation,
  identity recovery and isolation semantics. Use one additive migration and edit
  no historical migration. Existing rooms migrate to 0/N with zero synthetic
  filter rows and unchanged room/member/invitation/timestamp/candidate values.
- Use only public client credentials in browser flows. Keep C1 capture policy
  unchanged: no screenshots, trace, HAR, video, storage-state export, DOM/raw
  Auth/RPC/Realtime/filter dumps or private IDs in diagnostics.

## Exact final RPC and projection boundary

`public.get_my_participant_filter(p_room_id uuid)` returns exactly one row with
`outcome, genres, release_year_from, release_year_to, filter_completed_count,
required_voter_count, allowed_release_year_max`; its outcomes are `not_found`,
`not_ready`, `not_voter`, `not_submitted`, `saved`, `locked` with the exact
nullability matrix in the contract.

`public.submit_my_participant_filter(p_room_id uuid, p_genres
participant_genre[], p_release_year_from smallint, p_release_year_to smallint)`
returns the same seven fields and the closed outcomes `not_found`, `not_ready`,
`not_voter`, `invalid_genres`, `invalid_year_range`, `saved`, `unchanged`,
`locked`. Equal canonical retries are no-write `unchanged`, including after N/N;
different function-level post-N/N attempts are no-write `locked` and return the
current own values. Transport-uncastable enum/smallint input remains a safe,
target-independent rejection.

`create_room` and `join_room` add `filter_completed_count` as the ninth result
field; rejected joins keep only `outcome` non-null. `refetchRoom` selects exactly
`id, code, state, voter_count, required_voter_count, filter_completed_count`.

## Phase 1: Setup — Protected Baseline and Evidence Ledger

**Goal**: Establish an auditable implementation baseline without changing the
runtime, dependencies, upstream decisions or generated types.

- [x] T001 Capture the starting branch/HEAD/status, Node/npm/CLI versions and hashes of all six historical migrations, Feature 001–003 specs/plans/tasks, four candidate PNGs, `src/types/database.generated.ts`, `scripts/database-types.mjs` and `__tests__/config/c1-capture.test.ts`; record the planned G1–G4 evidence ledger and unchanged-scope guard in `specs/004-participant-filters/quickstart.md` without claiming a pass.

**Checkpoint**: Baseline provenance and protected artifacts are recorded; no
schema, client or acceptance behavior has changed.

---

## Phase 2: Foundational — PostgreSQL Authority and Additive Migration

**Goal**: Define and prove the private filter relation, aggregate, exact RPCs,
locking, privacy, candidate authority cutover and nonempty migration before the
single generated-type write. This is an internal DB gate, not a releasable
DB-only state.

### Contract tests before implementation

- [x] T002 [P] Add pre-migration schema/ACL tests in `supabase/tests/database/room_session.test.sql` for the exact 19-value `public.participant_genre` order, four-column `participant_filters` PK/FK/checks, empty Any semantics, duplicate/NULL/multidimensional rejection, static `1900 <= from <= to <= 9999` constraints, no time-dependent current-year CHECK, room aggregate defaults/checks, row-existence completion and rooms-only publication; include postgres ownership, RLS and exact deny-by-default table/helper privileges.
- [x] T003 Extend `supabase/tests/database/room_session.test.sql` with failing exact-signature/cardinality/nullability/outcome tests for both filter RPCs and evolved create/join results: authentication-before-business-validation, own-only recovery, Waiting/non-voter/foreign masking, canonical genre ordering, UTC current-year boundaries, invalid replacement preservation, first-save count/timestamp update, replacement/no-op no room update, equal retry and post-N/N locked behavior.
- [x] T004 Extend `supabase/tests/database/room_session.test.sql` with deterministic pgTAP+dblink trials for two distinct first submissions, final two submissions from 1/3, forced edit-before-final, forced final-before-edit, same-voter equal/different overlaps, committed response loss/equal retry, rollback between row/summary work and every castable post-completion attempt; require independent authenticated READ COMMITTED PIDs, owner room-lock barriers, `pg_blocking_pids`/ungranted-lock proof, exact xmin/snapshots and per-session filter/room write deltas with bounded drains/cleanup.
- [x] T005 [P] Replace current candidate-availability expectations with failing suppression/integrity tests in `supabase/tests/database/room_candidate.test.sql`: PUBLIC/anon/authenticated EXECUTE denial, zero assignment for Waiting/Ready 0/N/partial/N/N, unchanged NULL candidate through create/join/recovery/submission, preserved non-lowest preassigned FK hidden from authorized members, denied catalog/hidden-column access and retained fixture/FK integrity; keep no Ready→available oracle.

### Single additive migration and RPC implementation

- [x] T006 Create `supabase/migrations/20260911000000_participant_filters.sql` as one transaction that adds `rooms.filter_completed_count`, its exact static checks, the ordered `public.participant_genre` enum, postgres-owned/RLS-enabled `public.participant_filters`, and `private.valid_participant_genres(public.participant_genre[])` as postgres-owned `IMMUTABLE STRICT SECURITY INVOKER` SQL with empty search path and qualified references; revoke exact helper/table privileges, add no direct policy/publication, replace rooms column grants with the six-field projection, revoke authenticated candidate EXECUTE, and drop/recreate create/join only to add the ninth result field while preserving Feature 003 logic/outcomes/lock order.
- [x] T007 Implement and harden `public.get_my_participant_filter(uuid)` in `supabase/migrations/20260911000000_participant_filters.sql` with one coherent caller-member/room/own-row snapshot, server UTC maximum, exact six outcomes/nullability, safe missing/foreign masking, no default-row write and integrity exceptions for impossible summary/member/filter states; use auth.uid(), postgres ownership, SECURITY DEFINER, empty search path, qualified SQL and exact authenticated-only EXECUTE.
- [x] T008 Implement and harden `public.submit_my_participant_filter(uuid, participant_genre[], smallint, smallint)` in `supabase/migrations/20260911000000_participant_filters.sql`: authorize and lock the exact room before role/state/validation decisions, validate dynamic UTC year inside the function, canonicalize unique genres, insert/increment/timestamp once, replace own row without room update, return equal retries unchanged, freeze atomically at first N/N and return locked for every other function-level post-N/N attempt; never accept an owner target, repair an invariant, call a candidate function or perform resolution.
- [x] T009 Finalize `supabase/migrations/20260911000000_participant_filters.sql` with explicit verification that every preexisting room starts count0 with no filter row and unchanged room/member/invitation/timestamp/candidate data, that count equals voting-owner rows at protected boundaries, and that only rooms remains in `supabase_realtime`; reload the PostgREST schema cache and leave no trigger, test fault, redundant lock flag/phase/timestamp or public filter detail path.

### Nonempty upgrade and database green gate

- [x] T010 Create owner-only Feature 003 fixtures in `supabase/tests/migration/participant_filters.before.sql` for Waiting voting-creator, Ready voting-creator, Ready non-voting-creator and Ready/preassigned-non-lowest-candidate rooms; snapshot exact logical room/member/configuration/QR-recovery/timestamp/candidate state in bounded memory with zero GoTrue signups.
- [x] T011 Create post-upgrade assertions in `supabase/tests/migration/participant_filters.after.sql` that the actual migration preserves every T010 value, adds 0/N and zero synthetic filters, returns count0 through real authenticated create/join recovery, returns exact `not_ready`/`not_voter`/`not_submitted` own-filter outcomes, denies candidate EXECUTE/metadata, exposes exact grants/RPC shapes and keeps rooms as the only publication; remove only owned fixtures.
- [x] T012 Implement the owned-stack, version-limited runner in `scripts/check-participant-filters-migration.mjs`: verify local project/no competing traffic, reset exactly to `20260910000000`, run T010, apply the actual pending migration, run T011 and guarantee a final latest clean reset/cleanup on success, failure or interruption; never copy migration SQL, generate types, create GoTrue users or print private snapshots.
- [x] T013 Evolve latest-schema expectations in `scripts/check-room-membership-migration.mjs` and `supabase/tests/migration/room_membership.after.sql` so the pre-003→latest path preserves all Feature 003 membership/QR/recovery/statistics evidence while expecting count0, no filter rows, exact new RPC/grant shapes and authoritative candidate suppression; do not edit historical migrations or weaken the original nonempty assertions.
- [x] T014 Run and record the internal DB gate in `specs/004-participant-filters/quickstart.md`: safely start/configure the local stack, execute both nonempty migration runners, perform a clean latest `npm run db:reset` and full `npm run db:test`, and require all schema/RPC/privacy/candidate/fault/dblink trials, invariant snapshots and cleanup to pass with actual assertion totals and zero GoTrue identities before R01.
- [x] T015 Perform R01's sole intentional write by running `npm run db:types` exactly once after T014, immediately run `npm run db:types:check`, and review/record in `specs/004-participant-filters/quickstart.md` the canonical enum/table/room/create/join/get/submit changes and hash/inode/size/mtime/ctime for `src/types/database.generated.ts`; do not edit `scripts/database-types.mjs` or manually patch generated nullability.
- [x] T016 From an independent latest reset, run only `npm run db:types:check`, require identical bytes/hash/inode/size/mtime/ctime for `src/types/database.generated.ts`, record the check-only receipt in `specs/004-participant-filters/quickstart.md` and stop/clean the owned stack; every later and fresh-checkout type gate is check-only.

**G1 internal checkpoint — T016**: The complete database authority, nonempty
upgrade, candidate suppression and one R01 generation point are proven. The
runtime is not releasable until Phases 3–5 complete the typed/client cutover.

---

## Phase 3: User Story 1 — Each Assembled Voter Configures Their Own Filters (Priority: P1) 🎯 MVP Core

**Goal**: Give each assembled voter an owned, validated, editable-before-lock
filter form while Waiting and non-voting creators cannot submit and no candidate
consumer exists.

**Independent Test**: In voting-creator, non-voting-creator and three-voter room
fixtures, verify no form before assembly, exact Any/full-range defaults, all
valid/invalid boundaries, distinct own values, valid pre-lock replacement,
non-voter rejection and zero candidate UI/RPC.

### Tests before client implementation

- [x] T017 [P] [US1] Create `__tests__/filters/genres.test.ts` and `__tests__/filters/contracts.test.ts` for the exact readonly 19 slugs/labels/order, empty Any, duplicate/unknown rejection, inclusive 1900/server-maximum defaults and exact seven-field RPC outcome/nullability/cardinality/count parsing; include safe transport-error mapping and reject extra/missing/malformed/private-ID fields.
- [x] T018 [P] [US1] Update `__tests__/rooms/contracts.test.ts` and `__tests__/rooms/service.test.ts` for exact nine-field create/join results, strict rejected-join nullability, six-field room refetch, 0<=filter count<=target, positive count only when Ready, N/N derivation and current-count recovery; require no select-star, hidden candidate/member columns or client identity/owner argument.

### Client implementation and route integration

- [x] T019 [US1] Implement the stable vocabulary, runtime RPC result narrowing and authenticated service boundary in `src/filters/genres.ts`, `src/filters/contracts.ts` and `src/filters/service.ts`; send only the four approved submit arguments, adopt canonical server values/year maximum and map transport/infrastructure failures to safe corrective/generic messages without raw SQL, UUIDs or payloads.
- [x] T020 [US1] Evolve the generated-type consumers in `src/rooms/contracts.ts`, `src/rooms/service.ts` and `src/rooms/state.ts` to the exact nine-/six-field boundaries and logical count invariants; retain immutable Feature 003 identity/role/target semantics, derive completion only from equality and prevent lower same-room filter progress from replacing a higher snapshot.
- [x] T021 [US1] Create `__tests__/filters/service.test.ts`, `__tests__/filters/state.test.ts`, `__tests__/filters/use-participant-filter.test.ts` and `__tests__/filters/participant-filter-form.test.tsx` for Waiting/no-call, Ready recovery-before-default, Any/full-range draft, all genre/year/local/server validation, authoritative accepted-versus-unsaved draft separation, one-flight save, canonical adoption, saved/waiting copy, valid/invalid replacement and non-voting creator no recovery/submit/detail request.
- [x] T022 [US1] Implement `src/filters/state.ts`, `src/filters/use-participant-filter.ts` and `src/filters/participant-filter-form.tsx` with generation-scoped own recovery, separate accepted/draft/submission state, synchronous duplicate-save guard, accessible 19 toggles/Any meaning, required year inputs, clear validation/retry and mobile-first scroll/keyboard behavior; never optimistically increment progress, auto-submit defaults or expose another member.
- [x] T023 [US1] Extend `__tests__/routes/room.test.tsx` before route cutover for membership assembling, assembled voting creator/normal voter forms, distinct values, saved/editable waiting, non-voting creator progress-only, validation errors and invitations; assert zero candidate hook/service/RPC/card/poster/retry at Waiting, Ready 0/N, partial and N/N, and no resolution/TMDB/swipe/progression/match controls.
- [x] T024 [US1] Replace the Ready→candidate consumer in `app/room/[code].tsx` with the filter-first surface using `src/filters/use-participant-filter.ts` and `src/filters/participant-filter-form.tsx`; remove candidate imports/hook/retry/card entirely, preserve canonical join/re-entry/invitation/single-room-subscription behavior, mount no filter request before Ready or for non-voting creator, and stop after saved/progress/handoff states.
- [x] T025 [US1] Run focused filter/room/route tests, lint and typecheck for T017–T024 and record actual results in `specs/004-participant-filters/quickstart.md`; verify US1's independent fixture demonstrations, exact candidate-call zero and no unapproved dependency or Feature 005+ code before continuing.

**US1 checkpoint — T025**: Voter-owned entry, validation and pre-lock editing
work against the exact backend contract; the complete release still waits for
US2 recovery semantics and US3 aggregate/Realtime handoff.

---

## Phase 4: User Story 2 — Personal Filters Survive Recovery and Concurrent Activity (Priority: P1)

**Goal**: Recover caller-owned accepted values and make retries, failures,
overlaps and route changes preserve one owner/row/contribution.

**Independent Test**: Submit distinct filters, exercise reload, reconnect,
link/QR/code re-entry, duplicate/overlapping calls, pre-commit failure and a real
committed-response loss; recover exact own values/count without cross-room or
cross-voter disclosure and corroborate the deterministic SQL trials from G1.

### Recovery and retry behavior

- [x] T026 [US2] Extend `__tests__/filters/service.test.ts`, `__tests__/filters/state.test.ts` and `__tests__/filters/use-participant-filter.test.ts` before implementation for saved/locked own recovery, equal retry=`unchanged`, different pre-lock replacement, pre-commit failure preservation, lost-ack read/equal-retry recovery, overlapping same-voter single contribution, disconnected member semantics, stale effect/request generation and A→B→A isolation with no optimistic count.
- [x] T027 [US2] Complete recovery/idempotency/error behavior in `src/filters/service.ts`, `src/filters/state.ts` and `src/filters/use-participant-filter.ts`: preserve accepted values and explicit draft on failures, keep retry versus recover actions separate, share one active save, adopt only exact current-generation own details, retain the same Auth identity and never create a member/filter locally or leak raw response data.
- [x] T028 [US2] Extend `__tests__/routes/room.test.tsx` for reload, Realtime reconnect, link/QR/code same-identity re-entry, incomplete/completed disconnected voters, recovery error/retry, committed-response loss, duplicate action, invalid replacement and cross-room navigation; require stable Feature 003 membership/invitations, own-only detail, unchanged accepted values/count on failures and zero candidate calls throughout.
- [x] T029 [US2] Integrate separate own-detail recovery/save/retry controls and generation cleanup in `app/room/[code].tsx`; preserve room synchronization state independently, recover only after accepted Ready membership, never call details for a non-voting creator, and ensure retired room/save responses cannot display another room's draft, accepted values, progress or error for one frame.
- [x] T030 [US2] Run focused recovery/service/state/route tests plus the deterministic database concurrency/fault subset and record exact outcomes/write/xmin receipts in `specs/004-participant-filters/quickstart.md`; require US2's independent lost-response, overlap, isolation and same-identity recovery evidence to pass without new Auth identities in reload/retry paths.

**US2 checkpoint — T030**: Own values and completion survive the approved
identity/recovery/failure paths; no operation can exchange owners or add a second
row/contribution.

---

## Phase 5: User Story 3 — Aggregate Progress, Freeze and Feature 005 Handoff (Priority: P2)

**Goal**: Converge every authorized room member on privacy-safe X/N and the
irreversible N/N handoff using the one existing rooms channel.

**Independent Test**: In two- and three-voter rooms, observe 0/N through N/N
from voters and a non-voting creator, miss/coalesce/reorder updates, race final
submissions and both edit/final lock orders, then reload at N/N and verify frozen
own details, aggregate-only observers and no automatic continuation/candidate.

### Aggregate and Realtime behavior

- [x] T031 [US3] Extend `__tests__/rooms/state.test.ts` and `__tests__/rooms/use-room-subscription.test.ts` before implementation for the six-field projection, first-save rooms invalidation, no event for private edit/no-op, 0/3→1/3→2/3→3/3 convergence, one route-level monotonic aggregate across join/refetch/recovery/submit, N/N dominance over stale X<N, missed system-ok recovery, burst coalescing, reconnect, generation guards, sync-error preservation/retry and exactly one rooms UPDATE/id channel with no filter/member/catalog/Presence/Broadcast subscription.
- [x] T032 [US3] Evolve `src/rooms/state.ts` and `src/rooms/use-room-subscription.ts` to carry `filterCompletedCount`, preserve membership and aggregate monotonicity, expose synchronization degradation to the filter flow and retain the complete Feature 003 listener-before-subscribe/system-ok/refetch/coalescing/remove-before-replace lifecycle; accept Realtime only as invalidation and add no shared detail payload.
- [x] T033 [US3] Extend `__tests__/filters/use-participant-filter.test.ts`, `__tests__/filters/participant-filter-form.test.tsx` and `__tests__/routes/room.test.tsx` before final integration for shared X/N, saved/waiting, non-voting observer, immediate N/N handoff during own recovery loading/error, disabled edits on synchronization degradation, active-save response after observed N/N in both serialized orders, equal final retry unchanged, different final attempt locked and read-only own values; assert no roster/details/movie or automatic Feature 005 action.
- [x] T034 [US3] Complete aggregate coordination in `src/filters/state.ts`, `src/filters/use-participant-filter.ts`, `src/filters/participant-filter-form.tsx` and `app/room/[code].tsx`: merge exact join/refetch/recovery/submit snapshots into one non-regressing watermark, disable new saves on N/N or sync degradation, keep an active save alive, adopt saved-or-locked detail without reopening, render aggregate handoff immediately and keep any own-detail recovery error separate/read-only.
- [x] T035 [US3] Execute the G2 atomic client-cutover gate and record it in `specs/004-participant-filters/quickstart.md`: independent reset plus R01 check-only, full lint/typecheck/client/DB suites, web export and iOS/Android exports to `dist/native-validation`; require exact US1–US3 states, one rooms channel, filter privacy, candidate-call/UI zero, preserved QR assets/invitations and no resolution/TMDB/candidate/swipe/progression/match implementation.

**G2 checkpoint — T035**: The DB/types/client contract is coherent and all three
stories pass local integration evidence. Browser acceptance is the next gate;
no partial phase is a release.

---

## Phase 6: Polish and Cross-Cutting — E/G Evolution, H Acceptance and Reproducibility

**Goal**: Replace obsolete browser evidence with the exact 36-case/82-identity
filter-first inventory, then prove the same reviewed implementation repeatable
and reproducible.

### Real-stack harnesses and cases

- [ ] T036 Generalize `e2e/support/room-harness.ts` to exact nine-field create/join and six-field room projections, bounded owner-only filter-count/member/candidate snapshots and outgoing candidate-RPC zero counters; preserve existing Auth/Realtime/system-ready/QR/link/code barriers, same-case session reuse and cleanup without exposing private filter/member/Auth data.
- [ ] T037 Add boundary/cleanup tests in `__tests__/config/e2e-diagnostics.test.ts`, then implement `e2e/support/filter-harness.ts` for exact own recovery/submit calls, safe outcome/count/value assertions, request overlap/abort/lost-response barriers, bounded owner-only before/after write snapshots and candidate-traffic zero observation; no service-role credential enters a browser and no raw payload/ID/genre set is retained in diagnostics.
- [ ] T038 [P] Adapt all 24 E cases in `e2e/room-session.spec.ts` to the ninth result/six-field projection and filter-first lifecycle while preserving the exact 47-identity Auth/create/join/capacity/Realtime/isolation/recovery invariants; Waiting exposes no form/candidate, Ready stops on the appropriate filter state, and no case waits for or calls a fixture candidate.
- [ ] T039 [P] Adapt all nine G cases in `e2e/generalized-room-membership-qr.spec.ts` with the unchanged 26 identities: G03 proves voting-creator 0/3→N/N filter progress; retitle G04 exactly `@membership G04 non-voting creator observes voter filter progress` and prove aggregate-only observation; remove G07 candidate harness/held waits while retaining final-slot/late-join invariants; evolve G08 to ordinary-JWT cross-room filter privacy/mutation denial; retain all other membership/QR/recovery guarantees and require zero candidate RPCs.
- [ ] T040 [P] Create `e2e/participant-filters.spec.ts` with exactly three grouped three-identity cases and approved titles/timeouts: H01 (90000 ms) covers defaults, all 19 genres/year boundaries, ownership, invalid preservation and valid pre-lock edit; H02 (90000 ms) covers non-voting progress-only, reload/reconnect/link/QR/code recovery, disconnect, failure, overlap and committed-response loss; H03 (120000 ms) covers distinct/final concurrency, both forced edit-vs-final orders, same-voter repeats, active-save-after-N/N, equal final retry and every other castable locked/no-write attempt. Every deliberate room stops at Feature 005 handoff with candidate RPC/UI zero.

### Discovery, C1/R02 and green gates

- [ ] T041 First update assertions in `__tests__/config/e2e-diagnostics.test.ts` and `__tests__/config/playwright-runtime.test.ts`, observe their failure, then atomically evolve `playwright.config.ts`, `scripts/run-e2e.mjs`, `e2e/support/safe-reporter.ts`, `e2e/support/sanitize-diagnostics.ts`, only the budget label in `e2e/support/safe-diagnostics.ts`, and only the explanatory budget comment in `supabase/config.toml`: acceptance testMatch is exactly room-session, generalized-membership and participant-filters; F01–F08/candidate suite are absent; register exact G04/H titles, reporter scenario `filters`, H01–H03 cases, reviewed room/filter helper locations, 36 cases/82 identities, global600000/workers1/retries0/repeatEach1 and H budgets `{H01:3,H02:3,H03:3}`. Keep `anonymous_users=150` and `__tests__/config/c1-capture.test.ts` byte-unchanged; unknown cases/locations fail closed.
- [ ] T042 Execute and record G3's complete normal green path in `specs/004-participant-filters/quickstart.md`: both nonempty migration runners, clean reset, R01 check-only, lint/typecheck/full client/DB, web/native exports, managed `npm run test:e2e:security` and unfiltered `npm run test:e2e`, scanner0 and owned cleanup. Admit C1+full as exactly 1+82=83 identities, require 36 discovered cases, all 31 scenarios/35 FR/6 NFR/14 SC, both creator modes/three voters, zero candidate traffic/UI and no F discovery; count failed/partial/targeted/manual attempts.
- [ ] T043 Run the exact-source repeatability block from `specs/004-participant-filters/quickstart.md` with one cleanup-owning stack: G3 checks and C1 once plus complete acceptance run #1, then wait outside every harness for a recovered allowance window while keeping the stack alive and run all 36 cases again with fresh contexts and no second C1. Record identical behavior/scanner0/check-only type metadata and exactly 1+82+82=165 identities across windows; do not run an uncounted preliminary full suite, raise limits, restart/reset to evade quota, retry 429 or export sessions across cases.
- [ ] T044 Execute the full fresh-checkout path from `specs/004-participant-filters/quickstart.md` in a disposable `/tmp/otteroom-004-fresh.*` clone at the exact committed implementation SHA while leaving source `main` untouched: declared toolchain/npm ci, owned local stack/env, both nonempty migrations, clean reset, R01 check-only, full static/client/DB/web/native, C1 and 36-case acceptance/scanner0. Reserve 83 identities in a separate recovered window (repeatability+fresh total248), copy no env/node_modules/Auth/runtime data, patch no failure and remove only owned services/directory after recording evidence.
- [ ] T045 Complete the final evidence, traceability and scope review in `specs/004-participant-filters/tasks.md` and `specs/004-participant-filters/quickstart.md`: reconcile actual receipts against every matrix below, verify protected historical migrations/specs/fixtures/PNGs and C1 unchanged, exactly one generated-type write, later check-only stability, no filter-detail publication/direct grant, authoritative candidate suppression and no Feature 005+ scope. Run `git diff --check`, whitespace/checklist-format validation and exact git status; leave a checkbox unchecked unless its required reproducible evidence passed.

**G4 checkpoint — T045**: G3, repeatability and independently admitted fresh
checkout pass on the same reviewed implementation. Feature 004 ends at durable,
frozen N/N and does not resolve filters or present a movie.

## Dependencies and Execution Order

### Phase dependencies

```text
Phase 1 T001
  → Phase 2 T002–T016 / G1 (internal DB authority + sole R01 write)
  → Phase 3 T017–T025 / US1
  → Phase 4 T026–T030 / US2
  → Phase 5 T031–T035 / US3 + G2 atomic client cutover
  → Phase 6 T036–T045 / G3–G4 acceptance and reproducibility
```

Default execution is sequential by ID except the explicit authoring groups
below. The migration, SQL suite, generated types, room/filter production modules,
route, shared acceptance metadata and mutable-stack commands are never edited or
executed concurrently. No E/G/H browser cases run in parallel against the shared
stack even when their source authoring is marked `[P]`.

| Dependency | Reason / required result |
| --- | --- |
| T001 → T002–T005 → T006–T009 | Protected baseline, failing schema/RPC/race/suppression evidence, then one complete migration |
| T006–T009 → T010–T013 → T014 → T015 → T016 | Final schema before nonempty upgrade/latest-path proof; all DB evidence before the sole type generation and independent check-only reset |
| T016 → T017/T018 → T019/T020 → T021–T024 → T025 | Generated contract before client parsers/services/state/form and the authoritative route candidate cutover |
| T025 → T026 → T027 → T028 → T029 → T030 | Recovery/overlap tests precede implementation and route integration |
| T030 → T031 → T032 → T033 → T034 → T035 | Realtime/aggregate tests and implementation precede final handoff integration and complete client gate |
| T035 → T036/T037 → T038–T040 → T041 → T042 | Final client contract before harnesses/cases; all cases before exact discovery metadata and full browser gate |
| T042 → T043 → T044 → T045 | Complete acceptance before same-source repeatability, fresh checkout and final receipt review |

### Story dependencies and independent checkpoints

- **US1 (P1)** starts after the shared DB/types foundation and provides the form,
  ownership and validated saves used by US2/US3. Its independent proof is T025
  plus H01/G03/G04 at T042.
- **US2 (P1)** depends on US1's accepted-value surface but is independently
  demonstrated by T030, G1 lock/fault evidence and H02 at T042.
- **US3 (P2)** depends on accepted rows from US1 and recovery safety from US2;
  it independently demonstrates the bounded aggregate/freeze result through
  T035, G03/G04 and H03. It never depends on Feature 005 implementation.
- Phases 3–5 are evidence-ordered parts of one release cutover. Do not deploy or
  commit a mismatched DB/generated/client intermediate contract.

## Parallel Opportunities

Only seven tasks carry `[P]`, in three safe authoring groups:

| Group | Prerequisite | Parallel tasks | Disjoint ownership |
| --- | --- | --- | --- |
| A — DB contract authoring | T001 | T002 and T005 | `room_session.test.sql` versus `room_candidate.test.sql`; T003/T004 then continue serially in room_session |
| B — typed client contract authoring | T016 | T017 and T018 | new `__tests__/filters/*` files versus existing `__tests__/rooms/*` files |
| C — browser case authoring | T036 and T037 | T038, T039 and T040 | three distinct E/G/H spec files; execution waits for T041 and remains serial/workers1 |

There are no parallel migration edits, R01 operations, route edits, shared
configuration changes, database runs, browser runs, repeatability runs or fresh
checkout runs.

## Candidate-Suppression Evolution Map

| Historical Feature 002 class | Feature 004 treatment | Current executable evidence |
| --- | --- | --- |
| Fixture table/seed/FK and preassigned value integrity | Preserve internally, never clear/rotate | T005, T009, T011, T013, T014 |
| Catalog/hidden room-column privacy and no direct writes | Preserve and strengthen | T002, T005, T009, T037, T039/G08, T042 |
| Missing/foreign room isolation | Preserve through room/filter RLS and safe outcomes | T003, T005, T023, T028, T037, T038/E12, T039/G08 |
| Ready automatically assigns/returns a fixture | Retire as current behavior | T005/T006 EXECUTE denial, T023/T024 route removal, T038–T042 zero calls |
| Candidate card/poster recovery/retry | Retire from normal flow; assets/code may remain isolated | T023/T024/T028/T033, F file excluded by T041 |
| F01–F08 browser races/availability | Preserve completed artifacts only, remove from discovery/budget | T041 config tests and exact three-file testMatch |
| Ready/partial/N/N normal flow | Filters → X/N → frozen Feature 005 handoff only | T024, T032, T034, G03/G04/H01–H03 |

## R01, C1 and R02 Accounting

### R01

- T015 is the only intentional `npm run db:types` write.
- T015 immediately runs check; T016 independently resets and runs check-only with
  byte and inode/size/mtime/ctime comparison.
- T035, T042, T043 and T044 use `npm run db:types:check` only. The generator
  wrapper remains unchanged and no manual generated-type edit is allowed.

### C1

`__tests__/config/c1-capture.test.ts` stays byte-unchanged. T041 changes only
reviewed scenario/location/budget metadata elsewhere; T042–T044 use the managed
security runner and require scanner0. Static checks create zero identities; the
controlled C1 browser probe creates exactly one.

### Exact per-case identity inventory

Reload/reconnect/retry/re-entry reuses the same case identity and adds zero.
Authoring/static/unit/DB/export work creates zero browser identities. Failed,
partial, targeted and manual executions are charged in addition to the planned
successful reservation.

| Case | Identities | Case | Identities |
| --- | ---: | --- | ---: |
| E01 rapid create | 1 | E01 pre-acceptance create failure | 1 |
| E01 committed create response loss | 1 | Auth persistence/independence/explicit clear | 3 |
| E02 link and re-entry | 2 | E03 bound UPDATE | 2 |
| E03 missed initial commit | 2 | E04 manual normalization | 2 |
| E04 pre-acceptance join failure | 2 | E05 full rejection | 3 |
| E06 final-slot race | 3 | E07 creator Waiting reload | 1 |
| E07 creator Ready reload | 2 | E07 creator socket loss | 2 |
| E08 voter Ready reload | 2 | E08 voter socket loss | 2 |
| E09 repeat/overlapping join | 2 | E10 malformed manual | 1 |
| E10 malformed direct route | 1 | E11 nonexistent canonical code | 1 |
| E12 private read | 2 | E12 live subscription isolation | 3 |
| E12 stale navigation | 3 | E12 direct mutations | 3 |
| **E subtotal: 24 cases** | **47** |  |  |
| G01 | 1 | G02 | 1 |
| G03 | 3 | G04 | 4 |
| G05 | 2 | G06 | 4 |
| G07 | 4 | G08 | 4 |
| G09 | 3 | **G subtotal: 9 cases** | **26** |
| H01 | 3 | H02 | 3 |
| H03 | 3 | **H subtotal: 3 cases** | **9** |

| Acceptance block | Arithmetic | Identities/attempts reserved |
| --- | --- | ---: |
| Complete acceptance | E47 + G26 + H9 | 82 |
| C1 + complete | 1 + 82 | 83; 67 headroom below 150 |
| H-only + C1, if separately run | 9 + 1 | 10 additional |
| Repeatability | C1 once + complete twice | 165 across recovered windows |
| Fresh checkout | C1 + complete | 83 in a separate recovered window |
| Repeatability + fresh | 165 + 83 | 248 across recovered windows |

Keep `anonymous_users=150`, workers1, retries0 and repeatEach1. Wait outside all
harnesses for recovered allowance; never probe quota with signups, retry 429,
raise the limit, restart/reset to evade accounting or share Auth sessions across
cases.

## Requirements Traceability

The mappings below describe planned executable evidence. Documentation-only
T001/T045 does not substitute for implementation or runtime proof.

### Functional requirements — 35/35

| Requirement | Implementation task(s) | Executable evidence |
| --- | --- | --- |
| FR-001 | T007/T008, T022/T024 | T003, T021/T023, T038–T040 |
| FR-002 | T006, T020/T024 | T005, T018/T023, T038–T042 |
| FR-003 | T006–T008, T019/T022/T024 | T002/T003, T017/T021/T023, H01 |
| FR-004 | T007/T008, T020/T022/T024 | T003/T004, T021/T023, G03/H01 |
| FR-005 | T007/T008, T022/T024 | T003, T021/T023/T028, G04/H02 |
| FR-006 | T019/T022/T024 | T017/T021/T023, H01 |
| FR-007 | T006/T008, T019/T022 | T002/T003/T017/T021, H01 |
| FR-008 | T006/T008, T019/T022/T034 | T002–T004/T017/T021/T033, H01/H03 |
| FR-009 | T006/T008, T019/T022 | T002/T003/T017/T021, H01 |
| FR-010 | T008, T019/T022/T027 | T003/T017/T021/T026/T028, H01/H02 |
| FR-011 | T007/T008, T019/T027 | T003/T004/T017/T026, H01/H02 |
| FR-012 | T007/T008, T019/T027 | T003–T005/T026/T028, G08/H01 |
| FR-013 | T006–T008, T027/T029 | T003/T004/T026/T028, H02 |
| FR-014 | T006–T008, T027/T029 | T003/T004/T026/T028, G04/H02 |
| FR-015 | T022/T027/T034 | T021/T026/T028/T033, H01/H02 |
| FR-016 | T006/T008, T027 | T003/T004/T026, H02/H03 |
| FR-017 | T006/T008, T027 | T003/T004/T026, H03 |
| FR-018 | T008, T027 | T003/T004/T026/T028, H02 |
| FR-019 | T007/T008, T027/T029 | T003/T004/T026/T028, H02/H03 |
| FR-020 | T006/T008/T009, T020/T032/T034 | T002–T004/T018/T031/T033, G03/G04/H03 |
| FR-021 | T020/T022/T024/T032/T034 | T021/T023/T031/T033, G03/G04/H01–H03 |
| FR-022 | T006/T020/T024/T032 | T002/T005/T018/T023/T031, G03/G04 |
| FR-023 | T006/T008/T009, T032/T034 | T002–T004/T031/T033, G03/G04/H03 |
| FR-024 | T008/T009, T032/T034 | T003/T004/T031/T033, H03 |
| FR-025 | T006/T008, T032/T034 | T002/T003/T031/T033, G03/G04/H03 |
| FR-026 | T007, T020/T027/T029/T032 | T003/T018/T026/T028/T031, H02/H03 |
| FR-027 | T006–T009, T020/T024 | T002–T005/T011/T013, E/G/H |
| FR-028 | T006–T009, T024/T029 | T003–T005/T011/T013/T028, G07/G08 |
| FR-029 | T006–T009, T019/T027 | T002–T005/T011/T017/T026/T037, E12/G08/H02 |
| FR-030 | T019/T022/T024/T027/T034 | T017/T021/T023/T026/T028/T033/T037, E/G/H |
| FR-031 | T006/T009/T024 | T005/T011/T013/T023/T028/T033, E/G/H |
| FR-032 | T008/T009, T024/T034 | T003/T004/T023/T033, G03/G04/H03 |
| FR-033 | Bounded T006–T009/T019–T034 | T005/T023/T028/T033/T038–T042 |
| FR-034 | Preserve T020/T024/T029 | T011/T013/T028/T036/T039, H02 |
| FR-035 | T006/T009; preserve candidate modules/assets | T005/T011/T013/T023/T041/T042 |

### Non-functional requirements — 6/6

| Requirement | Implementation task(s) | Executable evidence/checkpoint |
| --- | --- | --- |
| NFR-001 | T006/T008, T020/T032/T034 | T002–T004/T018/T031/T033, G03/G04/H03, T042–T044 |
| NFR-002 | T006/T008, T027/T034 | T002–T004/T026/T033, H02/H03, T042–T044 |
| NFR-003 | T006–T009, T019/T022/T027 | T002–T005/T011/T017/T021/T026/T037, E12/G04/G08/H01/H02, C1 |
| NFR-004 | T006–T008, T027/T029/T032 | T003/T004/T011/T026/T028/T031, E/G/H02/H03, T042–T044 |
| NFR-005 | T022/T024/T027/T032/T034 | T021/T023/T026/T028/T031/T033, H01–H03 |
| NFR-006 | Preserve T006/T020/T024/T029/T032 | T005/T011/T013/T018/T023/T028/T031/T038/T039, T042–T044 |

### Success criteria — 14/14

| Criterion | Implementation basis | Executable evidence/checkpoint |
| --- | --- | --- |
| SC-001 | T006–T008/T022/T024 | T003/T021/T023, G03/G04/H01 |
| SC-002 | T006/T008/T020/T032 | T002–T004/T018/T031, G03/G04/H03 |
| SC-003 | T007/T027/T029 | T003/T004/T026/T028, H02 |
| SC-004 | T006/T008/T027 | T003/T004/T026, H02/H03 |
| SC-005 | T006–T009/T019/T027 | T002–T005/T011/T037, E12/G08/H01/H02 |
| SC-006 | T032/T034 | T031/T033, G03/G04/H03 |
| SC-007 | T006–T008/T027/T032 | T003/T004/T026/T028/T031, G04/H02 |
| SC-008 | T006/T008/T019/T022 | T002/T003/T017/T021, H01 |
| SC-009 | T006/T009/T024 | T005/T011/T013/T023/T028/T033/T038–T042 |
| SC-010 | T006–T009/T027/T034 | T003/T004/T011/T026/T033, H02/H03, T042–T044 |
| SC-011 | T007/T008/T022/T024/T032 | T003/T021/T023/T031, G03/G04/H01–H03 |
| SC-012 | Bounded T006–T009/T019–T034 | T005/T023/T028/T033/T038–T042 |
| SC-013 | T008/T027/T034 | T003/T004/T021/T026/T033, H01/H03 |
| SC-014 | T007/T019/T027/T032 | T003/T005/T017/T026/T031/T037, G04/G08/H01/H02 |

### Product acceptance scenarios — all 31

| Scenario / story | Principal implementation | Executable evidence |
| --- | --- | --- |
| 1 / US1 | T022/T024 | T021/T023, H01 |
| 2 / US1 | T007/T008/T022/T024 | T003/T021/T023, H01 |
| 3 / US1 | T007/T008/T024 | T003/T023/T028, G04/H02 |
| 4 / US1 | T007/T008/T024 | T003/T023, adapted E/G |
| 5 / US1 | T006–T008/T022/T024 | T002–T004/T021/T023, G03/H01 |
| 6 / US1 | T006/T008/T019/T022 | T002/T003/T017/T021, H01 |
| 7 / US1 | T006/T008/T019/T022 | T002/T003/T017/T021/T023, H01 |
| 8 / US1 | T007/T008/T027 | T003/T026/T028, H01/H02 |
| 9 / US1 | T007/T008/T019 | T003/T017/T021, H01/G08 |
| 10 / US1 | T006/T009/T024 | T005/T023/T038–T042 |
| 11 / US2 | T007/T027/T029 | T003/T026/T028, H02 |
| 12 / US2 | T006–T008/T027/T032 | T003/T004/T026/T031, H02 |
| 13 / US2 | T007/T027/T029 | T003/T011/T026/T028, H02 |
| 14 / US2 | T006–T008/T027/T032 | T003/T004/T026/T028/T031, G04/H02 |
| 15 / US2 | T006/T008/T027 | T003/T004/T026, H02/H03 |
| 16 / US2 | T006/T008/T027 | T003/T004/T026, H03 |
| 17 / US2 | T007/T008/T027 | T003/T004/T026, H02/H03 |
| 18 / US2 | T008/T027 | T003/T004/T026/T028, H02 |
| 19 / US2 | T008/T022/T027 | T003/T004/T021/T026, H01/H02 |
| 20 / US2 | T006–T009/T019/T027 | T002–T005/T011/T037, E12/G08 |
| 21 / US2 | T007/T008/T024 | T003/T005/T023/T028, G04/H02 |
| 22 / US3 | T006/T020/T032/T034 | T002/T018/T031/T033, G03/G04 |
| 23 / US3 | T007/T022/T032/T034 | T003/T021/T031/T033, G03/G04/H01 |
| 24 / US3 | T006/T008/T032/T034 | T002–T004/T031/T033, G03 |
| 25 / US3 | T008/T034 | T003/T004/T033, H03 |
| 26 / US3 | T008/T032/T034 | T004/T031/T033, H03 |
| 27 / US3 | T007/T032/T034 | T003/T031/T033, G04/H02/H03 |
| 28 / US3 | T007/T027/T032/T034 | T003/T004/T026/T031/T033, H02/H03 |
| 29 / US3 | T008/T024/T034 | T003/T023/T033, G03/G04/H03 |
| 30 / US3 | T006/T009/T024 | T005/T023/T028/T033, every E/G/H case |
| 31 / US3 | Preserve Feature 003 join in T006/T020/T024 | T005/T011/T013, G07 |

## Implementation Strategy

1. Establish the complete database authority and migration evidence, then make
   the one R01 generated-type write. Treat G1 as internal only.
2. Build US1 entry/save, US2 recovery/idempotency and US3 progress/freeze in
   order, but release them only as one coherent DB/types/client cutover at G2.
3. Evolve E/G and add grouped H acceptance. Retire F from normal discovery while
   keeping its meaningful invariant classes in SQL/client evidence.
4. Run G3 once, then reuse that run as repeatability run #1; wait for recovered
   quota before run #2. Validate a separate exact-SHA fresh checkout at G4.
5. Stop at frozen N/N. Any common resolution, resolved room constraints, TMDB,
   candidate browsing, swipe, progression, match, provider, TV, permanent account
   or dynamic-membership work requires a later approved specification.

All checkboxes remain unchecked at task generation. This artifact creates no
implementation, dependency change, service/test run, source branch, commit,
push or issue. Consistency analysis completed with the verdict
`READY FOR BASELINE COMMIT`.
