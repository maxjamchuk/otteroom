---
description: "Executable task breakdown for Swipe Decisions"
---

# Tasks: Swipe Decisions

**Input**: Reviewed design documents in `/specs/007-swipe-decisions/` and the
governing `.specify/memory/constitution.md`.

**Prerequisites**: [spec.md](spec.md), [plan.md](plan.md),
[research.md](research.md), [data-model.md](data-model.md),
[quickstart.md](quickstart.md), [decision RPC contract](contracts/decision-rpcs.md),
[room projection/Realtime contract](contracts/room-decision-projection-realtime.md),
[client flow contract](contracts/client-decision-flow.md), and
[swipe interaction contract](contracts/swipe-interaction.md).

**Tests**: Required by the specification, constitution, and approved plan. Add
behavioral and contract evidence before the implementation it governs and
observe the relevant failure. File presence, static text, or a mocked call alone
is not acceptance evidence.

**Organization**: Phase 2 establishes the shared PostgreSQL and room-projection
cutover. Phases 3–7 map exactly to the five user stories. The first three stories
are all P1 and are ordered by their authority dependency: accept a first value,
then make repeats/races immutable, then recover that authority through room
lifecycle changes. Phase 8 supplies cross-story browser, security,
repeatability, and fresh-checkout evidence.

| Label | User story | Independent demonstration |
| --- | --- | --- |
| US1 | Decide on the Shared Candidate (P1) | Two fixed voters see one TMDB identity and independently commit opposite answers without waiting or changing the candidate. |
| US2 | Submit Once Without Duplicate or Conflicting State (P1) | Repeated, conflicting, concurrent, failed, and response-lost submissions converge on one immutable stored value. |
| US3 | Recover Decisions and Preserve Room Convergence (P1) | Reload, reconnect, missed-update, and room/candidate-generation trials restore each caller's own value and the unchanged candidate. |
| US4 | Use Mobile-First and Equivalent Web Controls (P2) | Deterministic touch swipes and visible keyboard-operable controls produce the same authoritative yes/no values accessibly. |
| US5 | Establish Two-Voter Agreement Without Progression (P2) | Yes/yes is the only exact-two agreement, larger rooms receive no policy result, and neither completion nor agreement advances the candidate. |

## Format: `[ID] [P?] [Story?] Description`

Every task starts with an unchecked checkbox and a unique sequential ID. `[P]`
is used only where the listed files and unfinished dependencies are disjoint.
User-story tasks carry exactly one `[USn]` label. Paths are repository-relative
and literal; `app/room/[code].tsx` is a filename, not a wildcard. Mark a task
complete only after its stated evidence has been produced and recorded.

## Binding Implementation Boundaries

- PostgreSQL is the authority. `public.candidate_decisions` is grant-free,
  RLS-enabled, absent from Realtime, and keyed by
  `(room_member_id, tmdb_movie_id)`. The first accepted enum value is immutable.
- `rooms.decision_completed_count` is the only public decision aggregate. It is
  transactionally equal to current-candidate voter rows and is never a yes-count.
- `get_room_candidate_decision` and `submit_room_candidate_decision` derive the
  caller from `auth.uid()`, validate fixed voter role and the room's assigned
  TMDB ID, mask foreign rooms, and expose no other voter's answer.
- The expected TMDB ID is compare-only stale protection. No Feature 007 code may
  acquire, assign, advance, replace, or locally select a candidate.
- Exactly two voters receive a derived boolean agreement; groups larger than
  two receive `null`. Do not add a larger-group threshold, progression, or final
  match UX.
- Retain one rooms-table invalidation/refetch subscription. Do not publish the
  decision table or add a decision channel, polling, Presence, or Broadcast.
- Use installed Gesture Handler/Reanimated/Worklets only. Right means `yes`,
  left means `no`; visible labeled controls remain available to touch, keyboard,
  and assistive-technology users.
- Use one additive migration and edit no historical migration. Generate database
  types once after the final SQL contract; every later type gate is check-only.
- Browser evidence must preserve capture-off safe diagnostics, owned cleanup,
  fixed identity caps, controlled external TMDB traffic, and zero credential or
  private-decision artifacts.

## Phase 1: Setup — Protected Baseline and Test Harness

**Goal**: Record an auditable starting point and prepare deterministic gesture
component testing without changing product behavior or dependencies.

- [X] T001 Capture branch/HEAD/status, declared and actual Node/npm/Supabase/Deno versions, hashes of all historical migrations and `src/types/database.generated.ts`, the 42-case/100-identity browser baseline, and the planned G1–G5 evidence ledger in `specs/007-swipe-decisions/quickstart.md`; record that no dependency, historical migration, Feature 006 sorting, or generated type has changed yet.
- [X] T002 [P] Configure deterministic Gesture Handler/Reanimated component tests in `jest.config.js` and `__tests__/decisions/test-setup.ts`, using official package mocks and explicit callback/shared-value controls without globally masking application timers, promises, accessibility props, or service calls.

**Checkpoint**: Baseline provenance and a behavior-capable decision test harness
exist; runtime authority is unchanged.

---

## Phase 2: Foundational — Database Authority and Room Projection

**Goal**: Define, migrate, and prove the private immutable decision relation,
privacy-safe room count, hardened RPC boundary, generated types, and evolved
room projection before client story work begins.

**Critical**: This phase is one internal DB/types/client-contract cutover. Do
not ship the migrated database against the old room client.

### Failing database and migration evidence

- [X] T003 [P] Create failing catalog, constraint, ownership, RLS, privilege, and publication tests in `supabase/tests/database/swipe_decisions.test.sql` and evolve exact room inventories in `supabase/tests/database/room_session.test.sql` for `candidate_decision_value`, `candidate_decisions`, positive TMDB IDs, composite PK/member cascade FK, immutable acceptance timestamp, `decision_completed_count` default/bounds/read grant, no direct client access, and rooms-only Realtime.
- [X] T004 Extend `supabase/tests/database/swipe_decisions.test.sql` with failing exact-signature/cardinality/nullability/outcome tests for both decision RPCs and evolved create/join projections: authentication and argument validation, fixed-voter/voting-creator acceptance, non-voting creator observation/rejection, missing/foreign masking, assigned-current-candidate binding, not-ready/stale rejection, first yes/no insert, count/detail coherence, safe fields only, and zero candidate mutation.
- [X] T005 [P] Create controlled nonempty Feature 006 fixtures in `supabase/tests/migration/swipe_decisions.before.sql` for waiting, partial, incompatible, assigned, no-candidates, two-/three-voter, voting-creator, and non-voting-creator rooms; snapshot bounded logical room/member/filter/resolution/candidate/timestamp state with synthetic SQL Auth rows and zero GoTrue signups.
- [X] T006 [P] Create post-upgrade assertions in `supabase/tests/migration/swipe_decisions.after.sql` for exact preexisting-value preservation, count-zero backfill, zero invented decision/agreement/candidate state, exact catalog/ACL/RPC/projection shapes, authenticated create/join/re-entry count recovery, unchanged Feature 006 authority, and owned-fixture cleanup.

### Additive migration and RPC authority

- [X] T007 Implement the enum, `rooms.decision_completed_count`, its room-state constraints, postgres-owned/RLS-enabled grant-free `candidate_decisions` table, exact room column grants, and count-appended create/join return contracts in `supabase/migrations/20260916000000_swipe_decisions.sql`; preserve every existing create/join outcome, lock, membership rule, candidate field, and rejected-row null shape.
- [X] T008 Implement and harden `public.get_room_candidate_decision(uuid,bigint)` in `supabase/migrations/20260916000000_swipe_decisions.sql` with Auth-derived membership, fixed-role/current-candidate validation, masked authorization before locking, authorized-room `FOR SHARE` plus locked-state revalidation, one coherent caller-detail/count/completion/agreement projection, foreign `not_found` without lock-queue admission, `decided|not_decided|observer|not_ready|candidate_changed|not_found`, safe nullability, exact-two derivation, larger-group null, postgres ownership, empty search path, qualified references, and authenticated-only execute.
- [X] T009 Implement and harden `public.submit_room_candidate_decision(uuid,bigint,candidate_decision_value)` in `supabase/migrations/20260916000000_swipe_decisions.sql`: lock the target room, authorize the caller, compare the assigned ID, return `accepted|unchanged|conflict|not_voter|not_ready|candidate_changed|not_found`, atomically insert/increment/timestamp once, return the stored winner on repeats, and roll back detail/count together without calling TMDB or changing candidate state.
- [X] T010 Finalize `supabase/migrations/20260916000000_swipe_decisions.sql` with exact revokes/grants, no client policy/update/delete path, no decision publication or trigger, invariant-failure behavior, preexisting count-zero verification, PostgREST schema reload, and no persisted agreement, yes-count, request ledger, room/user duplication, candidate generation, progression, or match state.

### Nonempty upgrade, clean replay, and one generated-type write

- [X] T011 Implement the bounded owned-stack runner in `scripts/check-swipe-decisions-migration.mjs`: verify the local project and idle stack, reset exactly through `20260914000000`, execute `swipe_decisions.before.sql`, apply the real pending migration, execute `swipe_decisions.after.sql`, preserve historical/type hashes, suppress private snapshots, and guarantee latest-reset cleanup on success, failure, or interruption.
- [X] T012 Evolve latest-schema expectations in `scripts/check-room-membership-migration.mjs`, `scripts/check-participant-filters-migration.mjs`, `scripts/check-common-filter-resolution-migration.mjs`, `scripts/check-tmdb-candidate-migration.mjs`, `supabase/tests/migration/room_membership.after.sql`, `supabase/tests/migration/participant_filters.after.sql`, `supabase/tests/migration/common_filter_resolution.after.sql`, and `supabase/tests/migration/tmdb_candidate_source.after.sql` for count-zero, no decision rows, exact new projection/RPC/ACL inventories, and preserved historical evidence without editing any historical migration or weakening prior assertions.
- [X] T013 Run the complete nonempty migration chain, clean `npm run db:reset`, and full `npm run db:test`; record commands, actual assertion totals, zero-GoTrue use, preservation hashes, concurrency cleanup, and failures-then-passes in `specs/007-swipe-decisions/quickstart.md` before any generated-type write.
- [X] T014 Perform the sole intentional `npm run db:types` write after T013, update exact generated-signature assertions in `__tests__/config/database-types.test.ts`, immediately run `npm run db:types:check`, and record the reviewed enum/table/room/create/join/get/submit changes plus hash/inode/size/timestamps for `src/types/database.generated.ts` in `specs/007-swipe-decisions/quickstart.md`.
- [X] T015 From an independent latest reset, run only `npm run db:types:check`, require identical bytes/hash/inode/size/timestamps for `src/types/database.generated.ts`, and record the check-only receipt in `specs/007-swipe-decisions/quickstart.md`; every later and fresh-checkout type gate remains check-only.

### Room projection cutover

- [X] T016 [P] Add failing exact-field/count/invariant tests in `__tests__/rooms/contracts.test.ts`, `__tests__/rooms/service.test.ts`, `__tests__/rooms/state.test.ts`, and `__tests__/rooms/use-room-subscription.test.ts` for twelve-field create/join results, nine-field room refetch, rejected joins with all protected fields null, monotonic `decisionCompletedCount` within one candidate, invalid positive counts before assigned-compatible Ready, rooms-only invalidation, coalesced refetch, and unchanged one-channel teardown.
- [X] T017 Evolve `src/rooms/contracts.ts`, `src/rooms/service.ts`, `src/rooms/state.ts`, and `src/rooms/use-room-subscription.ts` to parse, store, validate, and monotonically merge `decision_completed_count` while preserving fixed membership, filter/resolution/candidate integrity overlays, ID-only room events, one-channel cleanup, and no decision-detail or hidden TMDB-ID room select.
- [X] T018 Run the migration runner, clean reset/full database suite, room/config client tests, lint, typecheck, and check-only generated types; record the G1 foundation receipt and any corrected exact field counts in `specs/007-swipe-decisions/quickstart.md` before starting US1.

**G1 checkpoint — T018**: Database authority and room projection are coherent,
private, migration-proven, and typed. The runtime is not releasable until the
story phases integrate the decision client.

---

## Phase 3: User Story 1 — Decide on the Shared Candidate (Priority: P1) 🎯 MVP

**Goal**: Let each fixed voter independently submit one right/yes or left/no
decision for the recognizable shared candidate, including voting-creator parity
and non-voting-creator exclusion.

**Independent Test**: Open one assigned two-voter room in independent clients,
verify the same TMDB identity, submit right/yes in one and left/no in the other
while either peer is idle/disconnected, and verify both answers commit while the
candidate and Feature 006 request counts remain unchanged.

### Failing tests for User Story 1

- [X] T019 [P] [US1] Create failing exact result-contract tests in `__tests__/decisions/contracts.test.ts` for all get/submit keys, known outcomes, outcome-specific nullability, integer/count/completion invariants, exact-two boolean versus larger-group null, extra/missing/malformed rows, and rejection of any peer identity/value/timestamp field.
- [X] T020 [P] [US1] Create failing authenticated transport tests in `__tests__/decisions/service.test.ts` for room UUID plus expected positive TMDB ID, typed yes/no submit, no caller/member argument, exact Supabase RPC names, bootstrap ordering, strict result narrowing, and fixed safe mapping of transport/database errors without raw payloads or identifiers.
- [X] T021 [P] [US1] Create failing state/hook tests in `__tests__/decisions/state.test.ts` and `__tests__/decisions/use-candidate-decision.test.ts` for recovery-before-input, voter versus observer eligibility, assigned recognizable candidate gating, available/loading-poster/poster-error/no-poster eligibility, metadata/acquisition/empty/integrity suppression, one-flight first yes/no submission, no optimistic acceptance, and independent completion while the peer is absent.
- [X] T022 [P] [US1] Create failing component/route tests in `__tests__/decisions/candidate-decision-surface.test.tsx` and `__tests__/routes/room.test.tsx` proving a qualifying positive Pan release submits `yes` once, a qualifying negative release submits `no` once, a clearly below-threshold release submits nothing, visible No/Yes alternatives use the same callback, voting creators have parity, non-voting creators have no controls, candidate title/year/ID evidence remains unchanged, and acquisition/navigation/progression/match effects stay zero.

### Implementation for User Story 1

- [X] T023 [US1] Implement strict decision vocabulary, RPC row parsing, safe domain result types, and outcome-specific invariants in `src/decisions/contracts.ts`; accept only the six approved response fields and never retain peer decisions, participant IDs, raw failures, or caller-supplied authority.
- [X] T024 [US1] Implement authenticated get/submit transports in `src/decisions/service.ts` using only `get_room_candidate_decision` and `submit_room_candidate_decision`, bootstrap the existing anonymous session, pass only room/expected-candidate/value, validate every successful payload, and expose fixed safe service errors.
- [X] T025 [US1] Implement generation-keyed local states and transitions in `src/decisions/state.ts` for unavailable, recovering, undecided, submitting, decided, and recoverable-error; keep pending intent separate from authority, enforce one flight, and adopt only validated active-generation results.
- [X] T026 [US1] Implement `src/decisions/use-candidate-decision.ts` with recovery-before-controls, exact voter/candidate-presentation gating, one-flight yes/no submission, active room/TMDB generation guards, observer handling, and zero imports/calls for candidate acquisition, navigation, progression, or match behavior.
- [X] T027 [US1] Implement `src/decisions/candidate-decision-surface.tsx` by composing the existing `CandidateCard`, adding a functional `Gesture.Pan` path with the approved distance/dominance acceptance predicate and right=`yes`/left=`no` mapping, routing qualifying gestures and always-visible labeled No/Yes buttons through one submit callback, making a below-threshold release a no-op, rendering authoritative/pending/failure text, and keeping persistence out of the component; exhaustive boundary, animation, accessibility, and reduced-motion hardening remains in US4.
- [X] T028 [US1] Wrap the router root in a full-flex `GestureHandlerRootView` in `app/_layout.tsx`, then integrate `useCandidateDecision` and `CandidateDecisionSurface` into `app/room/[code].tsx` only for recognizable assigned candidates; preserve invitation/filter/resolution/candidate behavior and hide all decision authority from non-voting creators.
- [X] T029 [US1] Run the focused decision contracts/service/state/hook/surface/route tests including the functional qualifying right/left Pan and below-threshold no-op, full database suite, lint, typecheck, web export, native exports, and `db:types:check`; record the US1 independent two-client-equivalent gesture/button result and zero TMDB/progression side effects in `specs/007-swipe-decisions/quickstart.md`.

**US1 checkpoint — T029**: A voter can commit either value independently on
the unchanged candidate; duplicate/race and lifecycle guarantees are not yet
claimed until US2/US3.

---

## Phase 4: User Story 2 — Submit Once Without Duplicate or Conflicting State (Priority: P1)

**Goal**: Make the first accepted value immutable under sequential repeats,
same-identity tabs/devices, opposite-value races, precommit failure, committed
response loss, and explicit reconciliation.

**Independent Test**: For one voter/candidate pair, run same/same and yes/no
overlaps with real authenticated database sessions, discard one committed
response, retry both values, and verify one row/count/winner plus truthful client
confirmation and no candidate write.

### Failing tests for User Story 2

- [X] T030 [P] [US2] Extend `supabase/tests/database/swipe_decisions.test.sql` with deterministic pgTAP+dblink trials for sequential and concurrent same-voter yes/yes, no/no, and yes/no submissions plus two different voters submitting in the same room; use distinct authenticated READ COMMITTED sessions, owner-held room locks, `pg_blocking_pids`/ungranted-lock barriers, and exact per-session outcomes/deltas. For the different-voter trial, prove both requests reach the authoritative transaction boundary before release, then both commit separately attributed rows and advance the count twice; after boundary arrival, completion requires no further user action, client connectivity or acknowledgement from either voter, and only bounded database transaction serialization may delay it. Also prove unrelated-room progress, committed-response discard, injected post-insert/count rollback, bounded cancellation, and cleanup in `supabase/tests/database/swipe_decisions.test.sql`.
- [X] T031 [P] [US2] Extend `__tests__/decisions/service.test.ts`, `__tests__/decisions/state.test.ts`, and `__tests__/decisions/use-candidate-decision.test.ts` with failing same-value recovery, opposite-value conflict/winner adoption, button/gesture collision, double callback, no queued second request, precommit failure, lost-success response, malformed reply, explicit reconcile/retry, and no optimistic or contradictory accepted state.
- [X] T032 [P] [US2] Extend `__tests__/decisions/candidate-decision-surface.test.tsx` and `__tests__/routes/room.test.tsx` with failing text/live-status tests for accepted yes, accepted no, recovered earlier winner, uncertain failure with Retry, disabled controls during submission/after decision, and the same unchanged candidate throughout every outcome.

### Immutable retry and conflict implementation

- [X] T033 [US2] Harden the locking, unique-winner, same-value no-write, opposite-value no-write, rollback, coherence, and response-loss behavior in `supabase/migrations/20260916000000_swipe_decisions.sql` until T030 proves exactly one row/count and no cross-room lock dependency; do not add a request ledger, mutable update, repair path, or candidate write.
- [X] T034 [US2] Complete duplicate/conflict/uncertain-response handling in `src/decisions/service.ts`, `src/decisions/state.ts`, and `src/decisions/use-candidate-decision.ts`: return the stored winner, preserve one-flight synchronous guards, reconcile after uncertainty, ignore repeated UI completions, and never label local intent authoritative before validation.
- [X] T035 [US2] Complete immutable-result, conflict-recovery, disabled/busy, and actionable Retry presentation in `src/decisions/candidate-decision-surface.tsx` and `app/room/[code].tsx` without offering edit/retract or causing a new candidate/match action.
- [X] T036 [US2] Run the dblink concurrency/fault matrix, focused duplicate/conflict client tests, full database/client suites, lint, typecheck, exports, and `db:types:check`; record exact caller PIDs, bounded blocking observations, same-voter winner/write/xmin evidence, different-voter two-row/count-`+2` attribution, unchanged candidate snapshot, request counts, cleanup, and US2 response-loss recovery in `specs/007-swipe-decisions/quickstart.md` without recording private identities or decision payloads.

**US2 checkpoint — T036**: Every voter/candidate pair converges on one immutable
winner under replay, overlap, failure, and lost acknowledgement.

---

## Phase 5: User Story 3 — Recover Decisions and Preserve Room Convergence (Priority: P1)

**Goal**: Restore each caller's own durable decision through reload, reconnect,
missed invalidation, re-entry, and stale async work while every participant
retains the same canonical candidate.

**Independent Test**: Let two clients decide, lose one room event/confirmation,
reload one and disconnect/reconnect the other, then re-enter with the same local
identities and verify each own value, count, role, and original TMDB identity
recover without peer disclosure or resubmission.

### Failing tests for User Story 3

- [X] T037 [P] [US3] Extend `supabase/tests/database/swipe_decisions.test.sql` with failing private-read/recovery evidence for own yes/no, undecided voter, authorized observer, response-loss recovery, foreign/missing equivalence, non-member/no-candidate/stale-ID zero writes, detail/count corruption fail-closed behavior, and proof that no response exposes another voter's row, identity, value, or timestamp; add dblink read-vs-submit trials in both orderings that require one coherent pre-submit or post-submit projection without mixed detail/count state or false integrity error, and prove a foreign read returns masked `not_found` without joining the locked target room's wait queue.
- [X] T038 [P] [US3] Extend `__tests__/rooms/state.test.ts` and `__tests__/rooms/use-room-subscription.test.ts` with failing tests for monotonic decision count, one rooms-only channel, first-accept invalidation, duplicate/conflict no event assumption, coalesced bursts, system-ok/refetch recovery after a missed event, last-good state, cleanup-before-rebind, and no decisions subscription/polling/Presence/Broadcast.
- [X] T039 [P] [US3] Extend `__tests__/decisions/state.test.ts`, `__tests__/decisions/use-candidate-decision.test.ts`, and `__tests__/routes/room.test.tsx` with failing reload/reconnect/re-entry recovery, count-advance private reread, explicit synchronization retry, room A→B→A and candidate-generation retirement, stale success/error/pending suppression, unmount safety, non-voter observer recovery, and same-candidate preservation.

### Lifecycle recovery and convergence implementation

- [X] T040 [US3] Complete initial/count-advance/reconnect/explicit private recovery and active `{roomId,tmdbMovieId}` generation retirement in `src/decisions/state.ts` and `src/decisions/use-candidate-decision.ts`; coalesce recovery flights, adopt only authoritative own values, retain safe last-known results, and ignore every stale callback.
- [X] T041 [US3] Complete decision-count invalidation/refetch integration in `src/rooms/state.ts` and `src/rooms/use-room-subscription.ts`, keeping Realtime as an ID-only hint, one active room channel, monotonic current-candidate count, canonical refetch after system-ok, and deterministic teardown before rebinding.
- [X] T042 [US3] Integrate room synchronization errors, Retry, reload/link/code/QR re-entry, observer aggregate recovery, and active-candidate generation handoff in `app/room/[code].tsx` while preserving the displayed Feature 006 model and withholding input for unassigned/unrecognizable/integrity states.
- [X] T043 [US3] Run focused private-read, room-subscription, hook-generation, and route lifecycle tests plus full DB/client, lint, typecheck, exports, and check-only types; record the US3 reload/reconnect/missed-update evidence and zero foreign disclosure/candidate divergence in `specs/007-swipe-decisions/quickstart.md`.

**US3 checkpoint / G2 coherent P1 cutover — T043**: First decision,
immutability, and lifecycle recovery form one deployable authoritative P1 slice.

---

## Phase 6: User Story 4 — Use Mobile-First and Equivalent Web Controls (Priority: P2)

**Goal**: Make a deterministic horizontal swipe the primary mobile interaction
while preserving accessible, labeled, keyboard-operable No/Yes controls and
equivalent authoritative outcomes on web.

**Independent Test**: At 390×844 touch size, exercise accepted right/left and
cancelled/vertical/diagonal gestures; at desktop size, use focus plus Enter/Space
on both buttons and verify identical RPC values and status meaning with reduced
motion enabled and color/motion cues removed.

### Failing tests for User Story 4

- [X] T044 [P] [US4] Extend `__tests__/decisions/candidate-decision-surface.test.tsx` beyond US1's basic mapping with failing exhaustive boundary tests for `maxPointers=1`, activation `[-12,12]`, failure `[-24,24]`, dynamic-width `clamp(width*0.25,72,120)`, exact 1.25 horizontal-dominance edges, vertical/diagonal/cancel/multi-touch zero submits, duplicate end delivery, disabled-state no-op, center reset, UI-thread feedback, and system reduced motion without changing right=`yes`/left=`no` authority.
- [X] T045 [P] [US4] Extend `__tests__/routes/room.test.tsx` with failing accessibility/web tests for persistent 44×44 No/Yes controls, exact meaningful labels, button roles, focus order, Enter/Space activation, disabled/busy state, live textual accepted/conflict/failure announcements, and comprehension without direction, position, animation, or color.

### Mobile gesture and equivalent-control implementation

- [X] T046 [US4] Harden the existing functional `Gesture.Pan` path in `src/decisions/candidate-decision-surface.tsx` with measured dynamic-width boundaries, exact dominance edges, multi-touch/cancel/vertical rejection, UI-thread translation/rotation feedback, cancelled/failed spring reset, one scheduled JS submit at accepted end, disabled gesture states, and `withSpring` system reduced-motion handling; do not change US1's already-proven right=`yes`/left=`no` mapping.
- [X] T047 [US4] Complete persistent Pressable semantics, 44-point targets, visible web focus, keyboard activation, disabled/busy state, reading order, accessible labels, live-region status, and non-color/non-motion copy/styles in `src/decisions/candidate-decision-surface.tsx` and `app/room/[code].tsx` without changing `src/candidates/candidate-card.tsx` metadata authority.
- [X] T048 [US4] Run the complete gesture matrix, accessibility/keyboard component/route tests, lint, typecheck, full client suite, web export, iOS/Android exports, and `db:types:check`; record the US4 mobile/web equivalence, reduced-motion result, and any justified platform omission in `specs/007-swipe-decisions/quickstart.md`.

**US4 checkpoint — T048**: Touch, keyboard, explicit controls, assistive output,
and reduced-motion presentation all express the same two authoritative values.

---

## Phase 7: User Story 5 — Establish Two-Voter Agreement Without Progression (Priority: P2)

**Goal**: Derive the exact-two yes/yes fact and N/N completion without defining
a larger-group policy, advancing the candidate, or showing final match UX.

**Independent Test**: Across bounded two-voter rooms, verify incomplete,
yes/yes, yes/no, no/yes, and no/no truth; in a three-voter room verify N/N with
`twoVoterAgreement=null`; every room retains its candidate and has zero
progression/match calls or presentation.

### Failing tests for User Story 5

- [X] T049 [P] [US5] Extend `supabase/tests/database/swipe_decisions.test.sql` with failing exact-two truth-table tests for zero/one/two decisions, yes/yes true, every complete combination containing no false, fixed non-voter exclusion, N/N equality, and three-plus-voter agreement always null before/during/after completion; assert agreement is derived, not stored, and causes zero candidate/status/function writes.
- [X] T050 [P] [US5] Extend `__tests__/decisions/contracts.test.ts`, `__tests__/decisions/state.test.ts`, `__tests__/decisions/candidate-decision-surface.test.tsx`, and `__tests__/routes/room.test.tsx` with failing progress/exact-two copy tests, larger-group null suppression, neutral agreement wording, no celebration, no next/match/navigation control, and no local agreement inference from incomplete or peer-attributed data.

### Agreement projection and bounded presentation

- [X] T051 [US5] Finalize derived completion and exact-two agreement queries in both RPCs inside `supabase/migrations/20260916000000_swipe_decisions.sql`, returning non-null false for incomplete exact-two rooms, true only for two yes rows, null for every larger group, and no persisted policy/progression state.
- [X] T052 [US5] Implement aggregate progress, caller-owned result, neutral exact-two agreement, and larger-room policy-absent presentation in `src/decisions/contracts.ts`, `src/decisions/state.ts`, `src/decisions/use-candidate-decision.ts`, `src/decisions/candidate-decision-surface.tsx`, and `app/room/[code].tsx`; do not reveal peer answers or introduce match/next-candidate behavior.
- [X] T053 [US5] Run the database truth table, decision contract/state/surface/route tests, Feature 006 controlled-provider regression, full DB/client, lint, typecheck, exports, and check-only types; record US5 exact-two/larger-room results and zero progression/match/TMDB side effects in `specs/007-swipe-decisions/quickstart.md`.

**US5 checkpoint / G3 product boundary — T053**: Completion and exact-two
agreement are observable facts only. Feature 007 stops on the same candidate.

---

## Phase 8: Cross-Story Acceptance, Security, and Release Evidence

**Goal**: Prove the complete slice with two real clients, bounded K01/K02
acceptance, impacted historical coverage, safe diagnostics, full regression,
repeatability, and an exact-SHA fresh checkout.

### Real-stack harness and failing acceptance

- [X] T054 Create `e2e/support/decision-harness.ts` with bounded decision RPC holds/releases, precommit failure, committed-response discard, rooms-update/socket controls, candidate-ID comparison kept only in safe in-memory assertions, mobile touch and desktop keyboard contexts, per-voter own-result checks, zero TMDB/progression counters, signup receipts, and deterministic cleanup without raw decision/identity payload artifacts; add a monotonic controlled-performance collector that retains only sample count, count at or below 2,000 ms, maximum duration, and separately counted recoverable failures, with no identifiers, individual samples, or normative percentile.
- [X] T055 [P] Author failing `@feature007 K01` (cap 2) in `e2e/swipe-decisions.spec.ts`: reuse a voting creator and voter across bounded rooms to prove one candidate, independent idle/disconnected acceptance, right/left mobile mapping, desktop keyboard controls, cancel no-op, duplicate/conflict/overlap, precommit failure, committed-response loss, reload/reconnect/re-entry, privacy, every exact-two outcome, and zero candidate/progression/match traffic; within the healthy warmed no-fault subtrial, reuse those identities across exactly 10 preassembled assigned rooms, collect exactly 20 serial first-decision timings from eligible activation/qualifying gesture end until the validated authoritative result is rendered, require at least 19 at or below 2,000 ms, and invalidate the performance run if any actionable recoverable failure or other non-authoritative outcome occurs.
- [X] T056 Author failing `@feature007 K02` (cap 4) in `e2e/swipe-decisions.spec.ts`: one non-voting creator plus three voters prove no creator control/server authority, independent concurrent decisions, rooms-only count convergence, missed-update recovery, N/N completion, own-value privacy, null larger-group agreement, unchanged candidate, and zero progression/match behavior.
- [X] T057 [P] Create failing fixed-profile and budget tests in `__tests__/config/feature007-e2e-profile.test.ts` and extend `__tests__/config/e2e-diagnostics.test.ts` for exact K01=2/K02=4, F=6, two receipts, workers=1, retries=0, repeatEach=1, direct J03 cap2, post-feature full 44 cases/106 identities, K01 performance receipt with sample count20/passing count at least19/zero recoverable failures/maximum duration, no normative percentile, capture-off artifacts, scanner/cleanup success, and rejection of CLI identity/provider/credential overrides.

### Safe runner, historical impact, and diagnostics

- [X] T058 Implement the override-free `feature007` profile, `@feature007|K01|K02|J03` bounded selection rules, exact receipt/budget verification, sanitized scenario/case allowlists, additive test discovery, and post-Feature-007 44-case/106-identity inventory in `scripts/run-e2e.mjs`, `playwright.config.ts`, `e2e/support/safe-reporter.ts`, `package.json`, and `docs/testing-strategy.md`; retain one worker, zero retries, one repeat, controlled TMDB process ownership, credential registry, scanner, and cleanup semantics.
- [X] T059 Evolve only impacted assertions in `e2e/generalized-room-membership-qr.spec.ts` (G03/G04/G05/G08), `e2e/participant-filters.spec.ts` (H01), and `e2e/tmdb-candidate-source.spec.ts` (J03): preserve the 16-identity smoke and two-identity J03 purposes while adding decision suppression/observer privacy/recognizable-poster-state controls; in G04 reuse its existing non-voting creator and three voters so all voters decide on the unchanged candidate, the room converges to `3 of 3`, the creator has no control and sees aggregate-only progress, each voter retains only their own value, and no larger-group agreement/progression/match UI appears, with zero added identities; do not select J01/J02 or alter Feature 006 Discover sorting.
- [X] T060 Extend the finalized-artifact boundary in `e2e/diagnostics/credential-safety.spec.ts`, `scripts/check-e2e-artifacts.mjs`, `e2e/support/safe-diagnostics.ts`, and `e2e/support/safe-reporter.ts` to reject raw decision values paired with identities, member/room/internal TMDB IDs, RPC payloads, Supabase/TMDB credentials, storage state, screenshots/traces/video/HAR, and unsafe Feature 007 errors while preserving exactly one C1 identity and owned cleanup.

### Final deterministic and charged gates

- [X] T061 Run and record the final non-browser gate in `specs/007-swipe-decisions/quickstart.md`: all five nonempty migration runners, clean reset/full pgTAP including different-voter and read-vs-submit races, check-only types, Edge regression, focused and full client suites, config/security/static scans, lint, typecheck, web export, iOS/Android exports, `git diff --check`, exact commands/versions/results, and any justified omission without a second generated-type write.
- [X] T062 Admit the 25-identity R02 normal block, then run C1 once, `test:e2e:feature007`, permanent smoke, and targeted J03 through safe wrappers only; record formula `1 + 6 + 16 + 2 = 25`, discovered cases, attempts/successes/timestamps, scanner/cleanup, unchanged candidate/provider counters, HTTP-429 failure behavior, and the K01 controlled-responsiveness timing sample count, passing sample count, maximum duration, separate failure count, and gate pass/fail result in `specs/007-swipe-decisions/quickstart.md`.
- [X] T063 Recalculate rolling usage and admit at least 107 available identities before running the explicit post-feature full acceptance checkpoint through `npm run test:e2e` plus separate C1; if T062 or other traffic leaves insufficient capacity, wait outside the harness for documented recovery. Require exactly 44 cases/106 identities plus C1=107, preserve all E/G/H/I/J intent and new K01/K02, and record admission, safe receipt and cleanup in `specs/007-swipe-decisions/quickstart.md`.
- [X] T064 After T063, establish a new rolling-window admission receipt before repeatability: reserve 64 identities if T064 and T065 will share one recovered window, otherwise reserve 47 and require T065 to admit separately; wait outside the harness when capacity is insufficient. From unchanged source and stack run C1 once followed by Feature 007 owner plus permanent smoke twice with fresh case identities and J03 once; enforce `1 + 2*(6 + 16) + 2 = 47`, workers1/retries0/repeatEach1, scanner zero, deterministic cleanup, and check-only types, then record the receipt in `specs/007-swipe-decisions/quickstart.md`.
- [X] T065 At the exact implementation SHA in an independent disposable checkout, confirm before browser execution that its 17 identities were reserved by T064 inside the combined 64-identity block or perform a separate 17-identity rolling-window admission; checkout isolation does not imply Auth-quota isolation. Prove clean install, Playwright setup, secret-free local configuration, all nonempty migrations, clean reset/full DB/Edge/client/config tests, check-only canonical types, lint/typecheck/build/web/native exports, C1 plus permanent smoke at 17 identities, scanner/cleanup zero, no copied modules/env/Auth/DB/browser state, and combined repeatability+fresh budget `47 + 17 = 64`; record evidence in `specs/007-swipe-decisions/quickstart.md` and remove only owned resources.
- [X] T066 Perform a final artifact/scope audit across `specs/007-swipe-decisions/spec.md`, `plan.md`, `data-model.md`, `contracts/`, `tasks.md`, `docs/testing-strategy.md`, the implementation diff, and all recorded evidence; verify no unresolved Feature 007 implementation question, historical migration edit, second type generation, larger-group policy, candidate progression, final match UX, dynamic membership, secret, unsafe artifact, or unrecorded required failure remains, and record the G5 release verdict in `specs/007-swipe-decisions/quickstart.md`.

**Final checkpoint / release boundary — T066**: The exact source state has
deterministic, real-stack, full-regression, repeatability, and fresh-checkout
evidence. The release ends on the unchanged current candidate.

---

## Dependencies and Execution Order

### Phase Dependencies

- **Phase 1** starts immediately. T001 and T002 touch disjoint evidence/config
  files and may run in parallel.
- **Phase 2** depends on Phase 1 and blocks every user story. T003–T006 establish
  failing contracts; T007–T012 implement/migrate them; T013 must pass before the
  sole type write in T014; T015–T018 complete the room cutover.
- **US1** depends on G1/T018 and creates the first usable decision vertical
  slice.
- **US2** depends on US1 because its repeated/conflicting operations act on the
  accepted value US1 creates.
- **US3** depends on US1 and US2 because recovery must adopt the immutable winner
  and distinguish uncertain transport from authoritative conflict.
- **US4** depends on US1's surface. Its test authoring may begin after G1, but
  implementation should follow US2/US3 unless shared decision files are
  explicitly coordinated.
- **US5** depends on US1/US2 decision-set authority; it may be developed beside
  US4 after the P1 checkpoint if shared client files are coordinated.
- **Phase 8** depends on all five story checkpoints. Charged browser execution
  begins only after deterministic DB/client/config evidence is green.

### User Story Completion Order

```text
Setup -> Foundation/G1 -> US1 -> US2 -> US3/G2
                              \-> US4 -----\
                               \-> US5 -----+-> Cross-story acceptance/G5
```

US4 and US5 are logically independent after their listed prerequisites, but
both touch the decision surface; parallel implementers must partition or
serialize those file edits. No story depends on Feature 008 or Feature 009.

### Within Each User Story

1. Author the listed behavioral/contract tests and observe the relevant failure.
2. Implement authoritative models/services before hook and presentation wiring.
3. Run focused tests before the story's full deterministic gate.
4. Record actual commands/results before claiming the checkpoint.
5. Stop on any failed required check or cross-artifact conflict.

## Parallel Opportunities

- **Setup**: T001 and T002 are disjoint.
- **Foundation**: T003, T005, and T006 can be authored in parallel; T016 can be
  authored while SQL implementation stabilizes, but cannot pass before T014.
- **US1**: T019–T022 are disjoint failing-test groups.
- **US2**: T030–T032 cover database, client state, and presentation separately.
- **US3**: T037–T039 cover database privacy, room synchronization, and decision
  lifecycle separately.
- **US4**: T044 and T045 split deterministic gesture behavior from route/web
  accessibility.
- **US5**: T049 and T050 split database truth from client presentation.
- **Acceptance**: T055 and T057 are disjoint; K02 authoring follows K01 in the
  shared spec file. No charged browser block runs in parallel.

## Parallel Execution Examples

### User Story 1

```text
T019: Decision RPC contract parser tests
T020: Decision service transport tests
T021: Decision state/hook eligibility tests
T022: Decision surface/route first-choice tests
```

### User Story 2

```text
T030: PostgreSQL duplicate/conflict/fault races
T031: Client one-flight/reconcile tests
T032: Surface authoritative-outcome tests
```

### User Story 3

```text
T037: Private database recovery/security tests
T038: Rooms Realtime/refetch tests
T039: Decision generation/re-entry tests
```

### User Story 4

```text
T044: Deterministic gesture matrix
T045: Keyboard/accessibility route matrix
```

### User Story 5

```text
T049: Exact-two and larger-room database truth tables
T050: Client progress/agreement/no-progression tests
```

## Scenario-to-Task Traceability

| Spec scenarios | Primary implementation tasks | Primary evidence tasks |
| --- | --- | --- |
| 1–6 | T007–T010, T023–T028 | T003–T004, T019–T022, T029, K01/K02 |
| 7–12 | T009, T033–T035 | T030–T032, T036, K01 |
| 13–18 | T008–T009, T040–T042 | T037–T039, T043, K01/K02/G08 |
| 19–22 | T027–T028, T046–T047 | T044–T045, T048, K01/J03 |
| 23–26 | T008–T009, T051–T052 | T049–T050, T053, K01/K02/G04 |

## Implementation Strategy

### MVP First

1. Complete Setup and the full G1 foundation.
2. Complete US1 through T029.
3. Stop and demonstrate two independent voters committing opposite values for
   one unchanged candidate.
4. Treat this as an MVP development checkpoint, not the releasable Feature 007:
   US2 and US3 are required to satisfy the P1 immutability/recovery contract.

### Incremental Delivery

1. **G1**: Migration/RPC/types/room projection proven internally.
2. **US1**: First independent yes/no vertical slice.
3. **US2**: Immutable duplicate/conflict/response-loss safety.
4. **US3/G2**: Durable lifecycle recovery; coherent P1 cutover.
5. **US4**: Complete mobile/web/accessibility equivalence.
6. **US5/G3**: Exact-two fact with explicit progression stop.
7. **G5**: Safe real-stack, regression, repeatability, and fresh-checkout proof.

### Scope Stop

Stop after the authoritative decision set and exact-two fact on the unchanged
candidate. Candidate progression/acquisition, next-candidate policy, larger-
group agreement, final match UX, dynamic membership, permanent accounts,
notifications, analytics, haptics, and TV interaction require later approved
specifications.

All checkboxes are intentionally unchecked at task generation. This artifact
creates no implementation, dependency change, service/test run, branch, commit,
push, issue, or consistency-analysis verdict.
