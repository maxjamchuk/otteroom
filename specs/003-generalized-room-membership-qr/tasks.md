---
description: "Executable task breakdown for Generalized Room Membership & QR Join"
---

# Tasks: Generalized Room Membership & QR Join

**Input**: Reviewed documents in `/specs/003-generalized-room-membership-qr/`,
`.specify/memory/constitution.md`, `docs/product-vision.md` and `docs/mvp-roadmap.md`.

**Prerequisites**: [spec.md](spec.md), [checklist](checklists/requirements.md),
[plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md),
[quickstart.md](quickstart.md), [room RPCs](contracts/room-rpcs.md),
[projection/Realtime](contracts/room-projection-realtime.md),
[QR invitation](contracts/qr-invitation.md) and
[candidate compatibility](contracts/candidate-compatibility.md).

**Tests**: Required by the specification, constitution and approved plan. Write
new behavioral tests before their implementation, observe the relevant failure,
then prove the completed behavior. Baseline-fixture adaptations retain existing
invariant classes; a compilation failure alone is not acceptance evidence.

**Organization**: Preserve the plan's four green phases. Story sections inside
the atomic cutover and acceptance phases provide the Spec Kit story grouping;
they are not independently committable partial DB/client contracts. Shared
foundations and checkpoints have no story label. All three stories are P1.

| Label | User story | Independent demonstration |
| --- | --- | --- |
| US1 | Creator Configures the Voting Group and Creates a Room | G01/G02: four configurations, immutable choice, one-room recovery and independently decoded invitations without assembling a group |
| US2 | Voters Join Until the Configured Group Is Assembled | G03/G04: link/code assembly in both three-voter modes; G05 adds real QR-derived normal admission |
| US3 | Membership Survives Retries, Reconnects and Concurrent Joins | SQL lock/fault evidence, G05–G09, generalized recovery and retained F01–F08 |

## Format: `[ID] [P?] [Story?] Description`

Every task starts with an unchecked checkbox and a unique sequential ID. `[P]`
means only the explicitly listed group may run concurrently after its common
prerequisites; shared-file edits and mutable-stack validation remain serial.
Paths are repository-relative and literal; `app/room/[code].tsx` is a filename,
not a wildcard. Commands below are future implementation instructions, not
commands executed by task generation. Mark tasks only after their actual evidence.

## Binding implementation boundaries

- Work on existing `main`; create/switch no source branch or tag. Keep completed
  Feature 001/002 specification artifacts, product documents, five historical
  migrations and four original PNGs unchanged. Evolve current implementation
  and tests only at paths approved by plan.md; do not preserve obsolete runtime
  host/guest semantics as another authority.
- `room_members` is membership authority; `rooms.voter_count` is its atomic
  voter summary. Every creator has one member; its fixed `is_voter` contributes
  one or zero. Required count defaults to 2 in the product, is an integer >=2,
  and has no arbitrary product maximum. PostgreSQL integer range is a technical
  validation boundary. Creation requires an explicit voting choice.
- For every create/join success, rejection, retry, race and lost-acknowledgement
  recovery, compare the persisted voter_count with actual is_voter=true member
  rows, not only the RPC result. Use bounded owner-held test snapshots without
  exposing a roster to normal callers or diagnostics. Candidate calls preserve
  both sides; hold candidate traffic while measuring admission-only UPDATEs.
- Ready is count == target, Waiting is count < target; connectivity changes
  neither. Existing valid membership precedes full. Only a new non-creator can
  enter as a voter. Missing creator membership and persisted false/false room
  RPC projection are exceptions without repair, promotion or a new outcome.
- One new migration implements the whole DB cutover. One intentional generated
  type update follows its final DB evidence; client consumers cut over in the
  same Phase 2. Do not run the application against an incomplete migration or
  treat intermediate SQL/client checks as a green release.
- Keep one rooms-only Realtime invalidation/refetch channel, no polling, roster,
  Presence or separate candidate channel. Preserve candidate assignment and
  local posters; candidate/poster failures cannot change membership or rotate
  the movie. No filter, TMDB, vote/swipe, progression, match, dynamic membership,
  spectator, scanner, TV or other future feature work.
- Every browser invocation uses the existing safe runner/reporter/scanner with
  real local Auth/Supabase/RPC/PostgreSQL/Realtime/Expo web and Playwright Docker.
  No mock successful server responses, trace, HAR, video, storage-state export,
  raw Auth/request/Realtime dumps or QR/poster/SVG/canvas diagnostic captures.
  The existing controlled C1 static-surface probe remains unchanged. SQL
  privileged setup is test-only; tested callers use authenticated roles and
  actual subjects.

### Exact final RPC boundary

`public.create_room(p_creation_request_id uuid, p_required_voter_count integer,
p_creator_is_voter boolean)` and `public.join_room(p_room_code text)` both return:

```sql
RETURNS TABLE (
  outcome text,
  room_id uuid,
  room_code text,
  room_state text,
  is_creator boolean,
  is_voter boolean,
  voter_count integer,
  required_voter_count integer
)
```

Create outcomes: `created`, `already_created`. Join outcomes: `joined`,
`already_member`, `invalid_code`, `not_found`, `full`. Accepted rows have all
eight fields non-null; rejected join rows have only outcome non-null. Exactly
one business row; exceptions have none. No identity argument/default/roster.
Candidate RPC retains its existing UUID argument, five-field result and
`available`/`not_ready`/`not_found` outcomes. Harden exact signatures as specified
in [room-rpcs.md](contracts/room-rpcs.md) and
[candidate-compatibility.md](contracts/candidate-compatibility.md).

## Phase 1: Setup — Standalone QR Foundation

**Goal**: Verify the local QR component and dependencies while the existing
application remains green. No route integration or membership cutover yet.

### Shared setup, tests and implementation

- [x] T001 Capture starting `main` HEAD/status, protected input/PNG/migration/type hashes and Node/npm versions against `package.json` and the approved plan; record the scope and planned G1 applicability in `specs/003-generalized-room-membership-qr/quickstart.md` without claiming a pass or changing upstream decisions.
- [x] T002 Update only QR dependencies in `package.json` and `package-lock.json` using sequential `npx expo install react-native-svg`, `npm install --save-exact react-native-qrcode-svg@6.3.24`, `npm install --save-dev --save-exact jsqr@1.4.0`, then `npm ci`; verify Expo-selected SVG 15.15.4 and unchanged framework versions, with no scanner/transformer or additional state/form dependency.
- [x] T003 Add standalone tests in `__tests__/rooms/invitation-qr.test.tsx` for the required value prop, real local encoder geometry, accessible wrapper, black/white M-level 240-pixel rendering and quietZone 48, changed-value isolation and contained encoding/render failure; assert any explicit retry preserves value and invokes no room/candidate service.
- [x] T004 Implement `src/rooms/invitation-qr.tsx` with the approved one-value interface, mobile-fitting accessible wrapper and value-keyed local error boundary; preserve generic failure rendering without updating a parent during render-time onError, external QR requests, persisted QR assets or new room operations.
- [x] T005 Verify `src/rooms/invitation-qr.tsx` through `__tests__/rooms/invitation-qr.test.tsx` using `npm run test:client -- --runTestsByPath __tests__/rooms/invitation-qr.test.tsx`; require the real encoder path and error/recovery assertions to pass, while `app/room/[code].tsx` remains unintegrated. Record component evidence in `specs/003-generalized-room-membership-qr/quickstart.md`.
- [x] T006 Execute and record G1 in `specs/003-generalized-room-membership-qr/quickstart.md`: run the normal command path below with the migration runner omitted because it does not exist yet; require npm ci, lint/typecheck/full client, current web/native exports, all four posters, existing reset/check-only types/full DB, managed Playwright, C1 and all existing 32 E2E trials, scanner0 and cleanup. Reserve 66 Auth attempts/identities (47+18+1); verify protected baselines and mark Phase 1 only after the complete gate passes.

**G1 checkpoint — T006**: Standalone QR behavior and the unchanged application
are verified. Application exports here prove baseline bundle compatibility,
not integration of an unimported QR component. Phase 2 may now begin.

## Phase 2: Foundational and Story Cutover — Atomic Generalized Membership

**Goal**: Deliver coherent DB/RPC/types/client/configuration/occupancy behavior,
with both generalized three-voter browser flows and all existing safety classes.
This entire phase is the approved coupled release unit. Do not apply the pending
migration while T012–T018 are incomplete; its editing tasks remain sequential.

### Shared database contract tests

- [x] T007 Start the local DB work block with `npm run supabase:start`, `npm run env:local` and an existing-schema `npm run db:reset`, with no application/browser traffic and guaranteed owned-stack cleanup on failure. Evolve exact schema and coherent fixture assertions in `supabase/tests/database/room_session.test.sql` for the ten final rooms columns, five member columns, every named key/FK/check/default in data-model.md, generated count-derived state, unique room/user, creator membership and voter-count equality; retain logical-room/code/idempotency constraints and reject negative/over-target count, Waiting assignment and direct configuration changes. Record expected pre-cutover failures; keep the same DB work block available through T027, without applying the migration until T018 finalizes it.

### US1 — Atomic creator configuration and recovery tests

- [x] T008 [US1] Extend `supabase/tests/database/room_session.test.sql` with all four creation configurations, explicit/null/type/minimum validation, exact eight-field created/already_created results, exactly one room/creator row and initial 1/0 count. For each ordinary successful create, measure transaction-local deltas of one room INSERT, one member INSERT and zero room UPDATEs, proving no second initialization UPDATE; compare the count with voter member rows. Test same request with different valid settings returns the original choice/target and invalid retry input still fails, before/after assembly without extra writes.

### US2 — Normal admission tests

- [x] T009 [US2] Extend `supabase/tests/database/room_session.test.sql` for trim/uppercase code normalization, invalid_code/not_found/full all-null projections, new non-creator voter admission through intermediate Waiting to exact Ready, and valid creator/voter already_member before full; assert stored flags, count/member equality and unchanged timestamps/xmin on every no-write recovery/rejection.

### US3 — Integrity failure tests

- [x] T010 [US3] Implement the complete creator/member fault matrix from `contracts/room-rpcs.md` in `supabase/tests/database/room_session.test.sql`: owner savepoint removes creator membership for both voting choices in Waiting/Ready, real authenticated creator join throws with no business row/insert/promotion/count/state/timestamp/xmin change; separately corrupt a non-creator to is_voter=false and require exceptional room RPC projection with no repair. Roll back each fault, verify exact original member ID/flag/count invariant and normal one-slot/zero-slot re-entry, restoring role/claims/fixtures on every exit; zero GoTrue signups.

### Shared security and schema implementation

- [x] T011 Add independent function ACL/owner/search_path and table/RLS tests in `supabase/tests/database/room_session.test.sql`: authenticated-only exact public signatures, missing-subject rejection, private helper own/foreign/missing/NULL behavior, all three valid caller combinations, five-column rooms reads only, denied roster/catalog/all mutations, no residual column grants, no exposed private schema and rooms-only publication; never use owner/service role as the tested normal caller.
- [x] T012 Create the pending single-transaction migration `supabase/migrations/20260910000000_generalized_room_membership.sql`: lock rooms ACCESS EXCLUSIVE before backfill, explicitly remove old create/join and dependent policy, rename host ownership/FK/request key, add exact required/count fields and RLS-enabled denied `room_members`, backfill legacy required2/count1-or2 and voter rows, preserve room identity/code/request/timestamps/movie FK, and replace state using PostgreSQL 17 `ALTER COLUMN state SET EXPRESSION AS (...)` with exact count/readiness constraints. Follow data-model.md ordering; leave no redundant creator voting flag or count trigger.
- [x] T013 Add `private.is_room_member(p_room_id uuid) RETURNS boolean` and final RLS/grants in `supabase/migrations/20260910000000_generalized_room_membership.sql`: SQL STABLE SECURITY DEFINER, postgres owner, empty search_path, qualified fixed membership lookup through auth.uid(), false for no subject/missing/foreign; private schema unexposed with authenticated USAGE/EXECUTE only, no CREATE. Grant authenticated rooms SELECT only on id/code/state/voter_count/required_voter_count using the helper; deny all member/catalog access and direct writes, removing residual column ACLs.

### US1 — Creation implementation

- [x] T014 [US1] Implement the exact three-argument `public.create_room` in `supabase/migrations/20260910000000_generalized_room_membership.sql`: auth.uid() only, 42501/22004/22023 validation, original creator/request recovery including exceptional missing creator member, atomic room-plus-explicit-flag member insertion with initial count1/0 supplied in the room INSERT and no initialization UPDATE, five-byte canonical code and five-attempt named-constraint collision handling; return original committed configuration on valid conflicting retries and roll back partial creation. Apply postgres ownership, SECURITY DEFINER, empty search_path, qualified SQL and exact authenticated-only EXECUTE revocations/grant.

### US2 — Admission implementation

- [x] T015 [US2] Implement exact `public.join_room(text)` in `supabase/migrations/20260910000000_generalized_room_membership.sql`: first authenticate with auth.uid(), then trim/uppercase and validate the code, lock the matching room FOR UPDATE, read current membership, reject persisted false/false exceptionally, return valid already_member before full, then fail exceptionally if an absent member is the creator. Only absent non-creators reach capacity logic; insert one voter and increment count/updated_at once atomically when capacity remains, otherwise return full with strict NULLs. Preserve immutable choice/configuration, exact closed outcomes and hardened authenticated-only function boundary.

### US3 — Candidate compatibility and completed migration

- [x] T016 [US3] Evolve `supabase/tests/database/room_candidate.test.sql` to coherent generalized fixtures and member/count authorization, including non-voting creator and three-voter rooms; retain all schema/seed/ACL, missing-versus-foreign, Waiting no-update, deterministic first assignment, existing non-lowest FK, empty/broken integrity, rollback, repeated/concurrent no-reassignment, per-session UPDATE/xmin and cleanup evidence.
- [x] T017 [US3] Replace only `ensure_room_candidate(uuid)` membership/readiness dependencies in `supabase/migrations/20260910000000_generalized_room_membership.sql`: same room row lock, authorize via caller member including non-voting creator, same not_found shape, Waiting not_ready, Ready existing-FK return or lowest-sort single assignment; preserve signature/result, exception behavior, hardening and all membership/configuration values. Do not change catalog/seed/assets or introduce a second movie operation.

### Shared migration finalization

- [x] T018 Finalize `supabase/migrations/20260910000000_generalized_room_membership.sql` by explicitly removing old guest checks/FK/index and guest_user_id RESTRICT after all dependent functions/policies are replaced; verify no final host/guest authority/overload or test hooks, preserved catalog/publication and exact creator/count invariants. Ensure the migration executes `ANALYZE public.rooms` after all generated-expression/schema changes, before its transaction COMMIT; reload PostgREST's schema cache for final signatures. Only now apply the complete migration through `npm run db:reset` in T007's running local DB block, so real RPCs are available before T019–T022; do not generate types or start the obsolete application. This empty reset does not replace T023–T026's nonempty legacy-upgrade proof.

### US1 and US3 — Real database races and rollback

- [x] T019 [US1] Adapt the existing create unique-index wait/code-collision harness in `supabase/tests/database/room_session.test.sql` to the renamed creator/request key and both creator modes; run independent authenticated overlapping real create calls, including different valid settings for one request, and prove one committed room/member with one winning original configuration, count/member equality, zero initialization UPDATEs by either caller and exact cleanup.
- [x] T020 [US3] Extend `supabase/tests/database/room_session.test.sql` using the existing `pg_temp.candidate_race()` dblink technique for duplicate-identity admission with at least two free slots and a two-identity final-slot race: verify role/auth.uid()/READ COMMITTED and independent PIDs, owner FOR UPDATE barrier, outstanding RPCs plus pg_blocking_pids/pg_locks waits, then direct loser-on-winner blocking before commit. Require member INSERT and room UPDATE deltas 1/0, joined/already_member or joined/full respectively, exact count and unchanged first-commit xmin after the loser; no arbitrary sleeps/sequential substitute.
- [x] T021 [US3] Extend the same serialized harness in `supabase/tests/database/room_session.test.sql` for two distinct callers with multiple free slots (INSERT/UPDATE deltas 1/1), three concurrent voters in a non-voting creator's 0/3 room (one admission each, 3/3 Ready), and admitted-member recovery during final admission; assert count/member equality after each commit, creator zero, no recovery write and no shared cross-room application lock. Preserve bounded lock observation, drain terminal dblink results, cancel/rollback callers and remove only owned fixtures/helpers on every exit.
- [x] T022 [US3] Add rollback-scoped member-insert and count-update fault tests in `supabase/tests/database/room_session.test.sql`; real authenticated create/join failures must leave no partial room/member/summary, preserve prior configuration/membership and permit idempotent recovery. Restore each fault and catalog/fixture state deterministically; no production trigger or fault API remains.

### Shared nonempty migration evidence and R01 prerequisite

- [x] T023 Create `supabase/tests/migration/room_membership.before.sql` with bounded owner-only synthetic Auth fixtures and three exact pre-003 rooms: Waiting, Ready/unassigned and Ready with a valid non-lowest candidate. Record logical IDs/codes/request IDs/host/guest/timestamps/candidate in memory for the runner; zero GoTrue signups and no default pgTAP reset side effect.
- [x] T024 Create `supabase/tests/migration/room_membership.after.sql` to assert all three logical rooms/states/timestamps/assignments survive the actual cutover, target2/count1-or2 and exact creator/voter rows, no retired columns/overloads, real authenticated recovery and candidate no-update behavior. Check owner-visible `pg_catalog.pg_statistic` has rooms.state statistics after ANALYZE on these nonempty fixtures; do not compare pre/post rewrite xmin or depend on autovacuum/fixed estimates. Remove only owned fixtures.
- [x] T025 Implement `scripts/check-room-membership-migration.mjs` using project-local CLI and bounded owner-only Docker/psql: verify project/no competing traffic, reset `--local --version 20260909000001 --no-seed`, run before.sql, apply actual `supabase migration up --local`, run after.sql, and guarantee latest clean reset/cleanup on success/failure/interruption. Propagate failures, suppress private raw output, retain safe boolean/count receipts and never generate types inside this runner.
- [x] T026 Run `node scripts/check-room-membership-migration.mjs`, `npm run db:reset` and full `npm run db:test` against T007's safely started/configured local stack; record results in `specs/003-generalized-room-membership-qr/quickstart.md`. Require T007–T025 behavior, nonempty statistics evidence, exact ACLs/outcomes, real locks/write deltas, both DB suites and fixture/dblink cleanup to pass before type generation. Record actual assertion counts rather than freezing historical 588; SQL fixtures consume zero GoTrue identities. Keep the stack available for T027, with failure cleanup still active. This is an internal DB gate, not a releasable Phase 2 checkpoint.
- [x] T027 Intentionally update `src/types/database.generated.ts` exactly once with `npm run db:types`, immediately run `npm run db:types:check`, and review final rooms/member Row/Insert/Update/FK and RPC Args/Returns. Use existing `scripts/database-types.mjs` unchanged, no manual nullability patch; record canonical hash/metadata in `specs/003-generalized-room-membership-qr/quickstart.md` for the later independent check-only reset. Finish T007's DB work block with `npm run supabase:stop` and verified owned-stack cleanup, also on failure; no intermediate DB/types-only release is permitted.

### Shared typed client contract tests and implementation

- [x] T028 [P] Update `__tests__/rooms/contracts.test.ts` for exact eight-key singleton results, allowed outcomes/NULL matrix, UUID/canonical code, integer target2..2147483647/count bounds and state equality; reject extra/missing/malformed fields, false/false, voter/count0 and invalid outcome/flag combinations, while accepting all three legitimate members and original-config recovery.
- [x] T029 [P] Update `__tests__/rooms/service.test.ts` for all typed create arguments, retained Auth bootstrap/canonical join, exactly five refetch fields and one matching room row, strict malformed/foreign/count rejection and generic safe infrastructure/integrity errors; no direct roster/catalog read or client identity argument.
- [x] T030 Replace fixed Host/Guest result modeling and runtime narrowing in `src/rooms/contracts.ts` with the exact approved independent creator/voter flags and counts; keep generated types separate from logical validation and make T028's closed result/nullability/integrity tests pass.
- [x] T031 Evolve `src/rooms/service.ts` to pass the three generated create arguments and fetch only `id, code, state, voter_count, required_voter_count` for an accepted immutable room ID; validate projection identity/count/state, retain one join transport/Auth bootstrap and generic errors, making T029 pass without new membership/identity services.

### Story client tests — isolated file ownership group

- [x] T032 [P] [US1] Update `__tests__/routes/home.test.tsx` for initial count text2, initially unselected explicit voting options, all four configurations, below-min/fraction/non-number/overflow/absent-choice rejection, frozen request/config during overlapping actions and failure/retry, new UUID only for deliberate creation, no partial invitation and no internal UUID display.
- [x] T033 [P] [US2] Update `__tests__/routes/room.test.tsx` for actual 0/3→1/3→2/3→3/3 occupancy, creator-mode explanation, invitations for either creator mode including Ready, valid existing-member-before-full recovery, generic full/invalid/missing/error displays and automatic authoritative Ready consumption; preserve route-generation/cleanup and candidate/poster regressions without QR integration yet.
- [x] T034 [P] [US3] Update `__tests__/rooms/state.test.ts` and `__tests__/rooms/use-room-subscription.test.ts` for immutable flags/target, monotonic intermediate Waiting counts, no Ready regression, mismatched-room/target rejection and all existing system-ok, missed-event, coalescing, stale-generation, reconnect, Auth-refresh and removal-failure behavior; a candidate UPDATE must remain a harmless room invalidation.
- [x] T035 [P] [US3] Adapt accepted-room fixtures in `__tests__/candidates/use-room-candidate.test.ts` and `__tests__/candidates/candidate-card.test.tsx` to independent flags/counts; cover every valid member mode, generalized Waiting RPC0, Ready single-flight acquisition, unchanged same-room candidate on count/refetch/reconnect and same-poster retry with RPC delta0, retaining all existing failure/generation/retry assertions.

### US2 and US3 — Authoritative room application flow

- [x] T036 [US2] Evolve `src/rooms/state.ts` to independent isCreator/isVoter/voterCount/requiredVoterCount with count-derived presentation, generic full copy and accepted room identity; apply same-room refetch monotonically, preserve immutable flags/target and reject inconsistent projection without deriving count from Waiting/Ready alone. Pass relevant T034 cases.
- [x] T037 [US3] Adapt `src/rooms/use-room-subscription.ts` to the new projection/state while preserving one exact-room UPDATE/id invalidation channel and its existing lifecycle: register before subscribe, system-ok refetch on initial/reconnect, coalesced reads, generation/sequence guards, preserved accepted state on error and remove-before-replacement. Pass T034 including harmless candidate updates; add no polling, Presence or member-table subscription.
- [x] T038 [US2] Integrate generalized create/join/refetch state into `app/room/[code].tsx`: render voter counts/Waiting/Ready and creator mode, retain one same-code join single-flight and stale-route guards, show permitted link/code invitations from `src/rooms/code.ts` for creator recovery including Ready, and feed only accepted ID/authoritative state to the existing candidate hook/card. Pass T033; no roster/UUID/settings editor/QR integration or future movie controls.

### US1 — Configuration application flow

- [x] T039 [US1] Implement configuration in `app/index.tsx` with existing RN TextInput/accessible Pressables: product default2, explicit voting/non-voting choice without default, clear whole-number/minimum/technical-range validation and a frozen `{requestId, requiredVoterCount, creatorIsVoter}` through progress/retry. Navigate by accepted canonical code only, retain manual joining and safe errors, and pass T032 without new UI/form dependencies.

### US3 — Candidate integration verification

- [x] T040 [US3] Verify the room-type boundary in `src/candidates/use-room-candidate.ts`, adapting only actual type coupling if needed, against T035 and `__tests__/routes/room.test.tsx`; prove generalized Waiting cannot acquire a movie, all valid Ready members use the existing single acquisition path and candidate/poster failures preserve room state and identity. Preserve service/registry/state/card behavior and PNG bytes; an unnecessary candidate rewrite is not a deliverable.

### Shared real-stack harness and existing acceptance evolution

- [x] T041 Generalize `e2e/support/room-harness.ts` to explicit creation configuration, eight-field accepted outcomes and exact five-column reads, bounded owner-only member/count/room snapshots, and same-case reused-session deliberate creation. Preserve existing WebSocket/system readiness barriers, diagnostic wrapping and cleanup; no identity cache across cases, browser owner credentials or raw private snapshots in output.
- [x] T042 Generalize `e2e/support/candidate-harness.ts` from pair-only tuples to bounded 2–4 participant/action/result arrays for G03/G04 while preserving all F01–F08 barriers, commit-loss/poster interception, visible-image/local-only checks, counters and cleanup. Hold candidate requests when membership-only mutation counts are observed so legitimate candidate UPDATEs are not counted as duplicate admissions.
- [x] T043 [US3] Adapt all 24 existing trials in `e2e/room-session.spec.ts` to explicit target2/voting-creator creation and generalized private-column/member/count/result assertions; preserve every E01–E12/Auth invariant class in quickstart, including missed events, live foreign-subscription isolation and failures. Keep the exact 47-identity per-trial allocation; any targeted execution is separately counted, not additional free evidence.
- [x] T044 [US3] Adapt all eight existing F01–F08 trials in `e2e/first-movie-candidate.spec.ts` to explicit target2/voting-creator rooms and generalized snapshots, preserving their exact authority, recovery, isolation, pre-commit/committed-loss and poster-fault assertions. Keep 18 identities, including F04=4 and all other F cases=2; same-context retry/reload adds zero and no Supabase success is mocked.
- [x] T045 Update `__tests__/config/e2e-diagnostics.test.ts` and `__tests__/config/playwright-runtime.test.ts` for Phase 2's exact existing32+G03/G04 discovery and 72-identity inventory, reviewed labels/locations, 600-second suite/90-second G-case bounds, retries0/workers1 and preserved C1 rejection/scanner behavior; unknown future cases/locations must fail rather than broadening allowlists.

### US2 — Generalized real-stack assembly, including US3 compatibility evidence

- [x] T046 [US2] Implement complete G03 `@membership` in `e2e/generalized-room-membership-qr.spec.ts`: three identities, voting creator3/yes at1/3, link voter2/3 Waiting, that voter reloads/disconnects real Realtime, manual-code final voter3/3; existing clients converge without refresh and the returning voter recovers Ready. Barrier all three first candidate calls before forwarding, prove one persisted candidate/title/year/visible local poster, then stable creator/voter reload/reconnect/re-entry. Account 3 identities, recovery0; this is a complete QR-independent cutover case.
- [x] T047 [US2] Implement complete G04 in `e2e/generalized-room-membership-qr.spec.ts`: four identities, non-voting creator3/no observes0/3→1/3→2/3→3/3 through link/code admission, remains zero and all four converge. Prove Waiting automatic RPC0/direct not_ready, synchronize four first candidate calls, identical movie/visible poster, member/candidate recovery and recoverable acquisition failure after success; fail the exact bundled poster once before reload and retry the same visible poster with candidate RPC delta0. Account 4 identities, recovery0, including any separately identified logical room using those same sessions.

### Shared cutover discovery and credential-safe metadata

- [x] T048 Update Phase 2 discovery/metadata in `playwright.config.ts`, `scripts/run-e2e.mjs`, `e2e/support/safe-reporter.ts`, `e2e/support/sanitize-diagnostics.ts` and only the budget label in `e2e/support/safe-diagnostics.ts`; register the reviewed G03/G04 names/helper locations, 34 cases/72 identities and bounded timeouts with unchanged capture policy. Update only the historical acceptance-budget comment in `supabase/config.toml`, keeping anonymous_users=150 and every rate-limit setting unchanged; pass T045 against the now-existing G03/G04 cases before any cutover browser execution.

### Shared application validation and G2

- [x] T049 Run lint/typecheck/full client tests and web/native exports against the complete Phase 2 client at `app/index.tsx`, `app/room/[code].tsx` and `src/rooms/use-room-subscription.ts`; inspect all four bundled original PNGs and absence of unintended host/guest authority/new channels. Record results and actual counts in `specs/003-generalized-room-membership-qr/quickstart.md`; integrated QR remains outside this phase and no Auth identities are created by these checks.
- [x] T050 Execute G2's complete normal command path and evidence record in `specs/003-generalized-room-membership-qr/quickstart.md`: repeat the nonempty migration proof, independent clean reset then db:types:check only, unchanged canonical hash/inode/size/mtime/ctime, all static/client/DB/web/native/poster checks, C1 and all 34 discovered real browser trials, scanner0 and cleanup. Reserve 73 attempts/identities (47+18+3+4+1), count prior/targeted attempts, and confirm final DB/RPC/types/client agree with no retired authority or partial cutover before Phase 2 is green.

**G2 checkpoint — T050**: Generalized membership works end to end in both
creator modes with all existing regressions. US1 configuration and US2 link/code
assembly are demonstrable; full US1/US2 QR and US3 grouped acceptance finish at
G3. Internal DB/type gates do not authorize a partial cutover release.

## Phase 3: User Story Completion — QR Integration and Full Acceptance

**Goal**: Complete independently usable QR invitations and all three stories'
accepted behaviors, retaining the now-working generalized baseline.

### US1 — QR integration tests and implementation

- [ ] T051 [US1] Extend `__tests__/routes/room.test.tsx` before integration for one shared `invitationLink(authoritativeRoomCode)` value passed to text and QR in either creator mode, creation/recovery/Ready access, stale-route protection, mobile-scrollable placement and QR error containment preserving link/code/count/member/candidate. If retry is exposed, assert same value and zero room/candidate RPC calls.
- [ ] T052 [US1] Integrate `src/rooms/invitation-qr.tsx` into `app/room/[code].tsx` using the same accepted-code invitation value from unchanged `src/rooms/code.ts` as the text link; retain accessible/selectable alternatives, creator invitations after assembly and component failure isolation. Pass T051 without a new QR token, identity, stored asset, scanner or network fallback.
- [ ] T053 [US1] First add failing QR helper boundary/cleanup tests in `__tests__/config/e2e-diagnostics.test.ts`, then implement `e2e/support/qr-harness.ts` inside existing safe diagnostics: assert wrapper/SVG visibility, viewport/positive bounds and interior-point non-occlusion; allow only bounded selected QR subtree geometry/definitions, reject scripts/foreignObject/raster/events/external URLs/fonts/unrecognized content, cap SVG64KiB and RGBA512×512. Rasterize that actual subtree in memory preserving viewBox/quiet zone, independently decode with jsQR, compare to text/expected target using safe booleans, and revoke/clear all temporary data on every exit; pass the boundary/cleanup tests without screenshots, attachments or payload/pixel dumps.

### Shared final diagnostic and decoder tests

- [ ] T054 Extend `__tests__/config/e2e-diagnostics.test.ts` and `__tests__/config/playwright-runtime.test.ts` for exact final G01–G09/F01–F08/E inventory: 41 cases, 91 identities, fixed safe locations and unchanged SVG/image/canvas diagnostic capture rejection. Retain T053's QR rejection/cleanup tests and `__tests__/config/c1-capture.test.ts` unchanged as mandatory regressions; reject unknown labels/content without broad diagnostic exceptions before T062's metadata implementation.

### US1 — Independent creation/invitation acceptance

- [ ] T055 [US1] Implement G01 in `e2e/generalized-room-membership-qr.spec.ts`: one reused creator validates default2, invalid integer/minimum/absent-choice correction, then creates four deliberate 2/yes,3/yes,2/no,3/no rooms with exact initial Waiting/count/flags and fixed configuration; verify code/text/visible unobscured QR and independently decoded target for each, no candidate or UUID UI. No group assembly is needed; account 1 identity, repeated creation0 additional signups.
- [ ] T056 [US1] Implement G02 in `e2e/generalized-room-membership-qr.spec.ts`: one creator reused across six logical rooms, both voting modes × pre-forward create failure/retry, real committed response loss/retry with different valid supplied settings, and overlapping same-request real calls. Prove one room/member and original target/choice/invitation, no partial usable room and one/zero creator slots; use observed request barriers and route.fetch with maxRetries0/maxRedirects0 plus committed owner snapshot before abort. Account 1 identity and zero recovery identities.

### US3 — QR admission, idempotency, capacity, isolation and failure acceptance

- [ ] T057 [US3] Implement G05 in `e2e/generalized-room-membership-qr.spec.ts`: creator3/yes at1/3 and one fresh voter enter through the actual decoded QR target; hold two real same-subject first joins until both arrive, then forward and prove one member/increment,2/3 Waiting and another free slot. Repeat/overlap QR/link/code as the admitted identity with no extra slot; verify real Auth/RPC/database admission, not an echoed QR value. Account 2 identities, extra pages/calls in the same session0; also supplies US2 normal QR-join evidence.
- [ ] T058 [US3] Implement G06 in `e2e/generalized-room-membership-qr.spec.ts`: creator3/no at0/3 re-enters via own decoded QR/link/code and stays non-voting; barrier three distinct outgoing voter joins before any forwarding, then prove exactly three memberships,3/3 Ready, creator zero and unchanged group on creator QR/link/code/reload/reconnect after assembly. Account 4 identities, all recovery0; PostgreSQL blocking proof remains T021 rather than browser dispatch alone.
- [ ] T059 [US3] Implement G07 in `e2e/generalized-room-membership-qr.spec.ts`: creator3/yes plus prior voter at2/3, two distinct final-slot contenders overlap through observed outgoing barriers, exactly joined/full and one member/count UPDATE to3/3. Reuse loser for QR/link/code full rejection with strict-null projection and zero mutation; recover winner/prior voter/creator through all invitation mechanisms without capacity competition. Account 4 identities and no recovery signup; hold candidate traffic during membership-only counters.
- [ ] T060 [US3] Implement G08 in `e2e/generalized-room-membership-qr.spec.ts`: three identities form Ready room A and a fourth creates unrelated room B as non-voting creator; use ordinary JWT requests for own access, foreign ID/code denial and direct member/configuration/candidate mutation plus roster/catalog browse denial. Compare safe owner-held before/after snapshots and assert no private UUID UI, preserving E12 live subscription isolation; account 4 identities and no browser service-role credential.
- [ ] T061 [US3] Implement G09 in `e2e/generalized-room-membership-qr.spec.ts` using the same creator/joiner/competitor identities across three target2/voting-creator rooms: pre-forward join failure then successful one-slot retry; failure then competitor fills and retry full; route.fetch commits admission, owner snapshot confirms it, response abort gives recoverable failure and retry returns already_member in Ready. Prove unchanged configuration/no partial membership/no duplicate UPDATE with maxRetries0/maxRedirects0; account 3 identities, retry/reload0.

### Shared final integration and G3

- [ ] T062 Finalize reviewed G01–G09 names/helper locations and 41-case/91-identity metadata in `playwright.config.ts`, `scripts/run-e2e.mjs`, `e2e/support/safe-reporter.ts`, `e2e/support/sanitize-diagnostics.ts` and only the budget label in `e2e/support/safe-diagnostics.ts`; update only the matching explanatory comment in `supabase/config.toml`. Make T054 pass with exact discovery, unchanged anonymous_users150, C1 policy/registry/scanner, workers1/retries0 and no skipped placeholders.
- [ ] T063 Verify integrated QR behavior through `__tests__/rooms/invitation-qr.test.tsx` and `__tests__/routes/room.test.tsx`, then lint/typecheck/full client and `npm run web:export` plus iOS/Android exports to `dist/native-validation`; inspect imported QR/SVG inclusion and all four original bundled PNGs. Record actual results in `specs/003-generalized-room-membership-qr/quickstart.md`, distinguish module-bundle evidence from physical native/camera runtime, and preserve no external movie/QR dependency.
- [ ] T064 Execute G3's complete normal command path in `specs/003-generalized-room-membership-qr/quickstart.md`, including nonempty migration/ANALYZE proof, clean reset/check-only types, full static/client/DB/web/native/poster/QR checks, managed Docker C1 and unfiltered 41-test acceptance, scanner0 and cleanup. Reserve 92 attempts/identities (47+18+26+1); verify all 36 scenarios and every story with the matrices below, no external movie/QR traffic or future product interaction. Record real counts/failures/recovery costs; do not count decoder/unit documentation as successful browser admission.

**G3 checkpoint — T064**: All three stories independently pass their specified
demonstrations, G01–G09 and preserved E/F acceptance. No further product flow is
started. Phase 4 verifies this exact behavior's repeatability and reproducibility.

## Phase 4: Polish and Cross-Cutting Completion — Repeatability and Fresh Checkout

**Goal**: Produce reproducible final evidence without adding functionality.

- [ ] T065 Run the complete repeatability block in `specs/003-generalized-room-membership-qr/quickstart.md` from one cleanup-owning driver and exact source: normal migration/static/client/DB/check-only-type/web/native checks, C1 once and all41 acceptance run #1 (92 identities including C1), then wait outside every test harness until another91 attempts are available, keep the same Supabase stack alive, and run all41 again with fresh contexts and unchanged code. Total183; no uncounted preliminary full run, rate change, restart/reset to evade quota or automatic 429 retry. Record both results, lock/statistics/type receipts, scanner0, measured windows/attempts/identities and final shutdown; run #1 is the normal final acceptance checkpoint.
- [ ] T066 Execute the complete fresh-checkout path from `specs/003-generalized-room-membership-qr/quickstart.md` in a disposable `/tmp/otteroom-003-fresh.*` clone at an exact committed implementation SHA containing Phase 3, leaving source `main` untouched: npm ci, safe Supabase start/env, version-limited migration/statistics proof, clean reset, db:types:check only with unchanged canonical bytes/metadata, lint/typecheck/full client/DB, web/native exports and four posters/integrated QR, managed Playwright/C1/all41 acceptance, scanner0, shutdown and owned-directory cleanup. Reserve92 separately from repeatability (combined275); copy no env/node_modules/runtime data, create no source branch/tag, and never patch the clone to hide failure.
- [ ] T067 Complete the final evidence/traceability and scope review in `specs/003-generalized-room-membership-qr/tasks.md` and `specs/003-generalized-room-membership-qr/quickstart.md`: verify 35 FR/4 NFR/12 SC/36 scenarios/3 stories, G01–G09/F01–F08 and C1/R01/R02 against actual G1–G4 receipts, unchanged protected historical/product/PNG artifacts, no retired runtime authority or second channel, no future scope and no owned runtime leftovers. Run `git diff --check`, whitespace-check new files and show exact status; mark tasks only with successful evidence, leaving zero unchecked tasks only when all preceding work and both G4 blocks actually pass.

**G4 checkpoint — T067**: T065 and T066 passed on the same reviewed implementation,
all tasks have real evidence, and no Feature 004+ work began. Feature 003 is a
completed membership slice; the product's full MVP boundary remains Feature 009.

## Dependencies and Execution Order

### Phase dependencies

```text
Phase 1 T001–T006 / G1
  → Phase 2 T007–T050 / G2 (one atomic DB/types/client cutover)
  → Phase 3 T051–T064 / G3 (complete all three stories)
  → Phase 4 T065–T067 / G4 (repeatability + fresh checkout)
```

Default execution is sequential by ID. The only exceptions are the two marked
test-authoring groups below. Every phase requires the previous green checkpoint.
All ordered edits to one migration, SQL suite, room route, browser suite or C1
file remain serial. Stack commands, package/lock work and generated types never
run in parallel. Do not run E2E cases concurrently against shared mutable stack
state merely because they own different browser contexts.

| Dependency | Reason / required result |
| --- | --- |
| T001 → T002 → T003 → T004 → T005 → T006 | Verified baseline, installed pinned dependencies, failing behavioral tests, standalone implementation and complete G1 |
| T007–T011 → T012–T018 | Expected DB/creator/join/integrity/security behavior precedes the complete migration; no incomplete migration application |
| T012 → T013 → T014 → T015 → T016 → T017 → T018 | Single-file schema/helper/create/join/candidate/cutover ordering; candidate tests precede its body adaptation |
| T007 local stack → T018 complete-migration reset → T019–T022 → T023–T025 → T026 → T027 | Real RPCs exist before race/fault execution; later version-limited reset restores the legacy schema for nonempty upgrade/statistics proof; final DB gate precedes sole types write, then shutdown |
| T027 → T028/T029 → T030 → T031 | Final generated contract before parser/service tests and implementation |
| T031 → T032/T033/T034/T035 → T036 → T037 → T038 → T039 → T040 | Consumer tests, then state/subscription/room route before the home route tests that import that route; finish candidate compatibility verification |
| T040 → T041 → T042 → T043–T045 → T046 → T047 → T048 → T049 → T050 | Coherent client and harnesses, evolved E/F cases and diagnostic tests, complete G03/G04, then metadata/discovery tests pass before full cutover execution |
| T050 → T051 → T052 → T053 → T054 → T055–T061 → T062 → T063 → T064 | QR integration then independent decoder and complete case inventory before final browser gate |
| T064 → T065 → T066 → T067 | Complete acceptance before same-source repeatability, independently admitted fresh clone and final bookkeeping |

### Story dependencies and independent checkpoints

US1 provides configured rooms to US2; US2 provides admitted membership for US3.
US3's integrity/security/recovery foundations are implemented with those first
operations in Phase 2, not deferred until after unsafe admission is shipped.
QR is built independently in Phase 1 and integrated after the cutover. These
shared foundations do not prevent separate story demonstrations at G3:

| Story | Implementation and unit/DB basis | Independent executable demonstration | Complete checkpoint |
| --- | --- | --- | --- |
| US1 | T002–T004, T008, T012–T014, T019, T027–T032, T039, T038, T051–T054 | T055/G01 and T056/G02; no other voter needed for configuration/invitation verification | T064/G3; repeated in T065/T066 |
| US2 | T007, T009, T012–T015, T027–T031, T033, T036–T038, T041/T042, T052/T053 | T046/G03 and T047/G04 at G2; T057/G05 supplies actual QR first admission | T064/G3; repeated in T065/T066 |
| US3 | T010/T011, T015–T022, T028–T031, T034/T035, T036–T038/T040–T044 | T057–T061/G05–G09 plus T043/T044 E/F recovery and T046/T047 generalized candidate continuity | T064/G3; repeated in T065/T066 |

## Parallel Opportunities and Examples

Only six tasks carry `[P]`:

| Group | Prerequisite complete | Parallel tasks | Disjoint owned files |
| --- | --- | --- | --- |
| A — shared contract tests | T027 | T028, T029 | rooms/contracts.test.ts versus rooms/service.test.ts under __tests__ |
| B — story consumer tests | T031 and group A implementations T030/T031 | T032, T033, T034, T035 | routes/home.test.tsx; routes/room.test.tsx; rooms/state.test.ts + rooms/use-room-subscription.test.ts; candidates hook/card tests, all under __tests__ |

US1 example: T032 home tests can be authored alongside US2 T033 room tests and
US3 T034/T035. US2 example: T033 consumes the final contract but does not edit
US1 home or US3 state/hook tests. US3 example: T034 lifecycle tests and T035
candidate tests can run alongside each other after the common prerequisite.
These markers permit only disjoint test authoring against the fixed contract;
record expected failures, without changing shared production modules or requiring
a future consumer to pass. Merge all test-authoring results before T036;
whole-consumer passing checks follow their state/route dependencies. Runtime checks and all later
same-file edits remain serial. No whole stories, migrations, browser cases or
QR integration tasks are advertised as independently parallel releases.

## Normal Commands, Evidence Ownership and Quota

For T006/T050/T064 use the approved quickstart sequence in a cleanup-owning shell:

```sh
set -eu
trap 'OTTEROOM_CHECK_EXIT=$?; trap - EXIT; if ! npm run supabase:stop; then exit 1; fi; exit "$OTTEROOM_CHECK_EXIT"' EXIT
npm ci
npm run supabase:start
npm run env:local
node scripts/check-room-membership-migration.mjs
npm run db:reset
npm run db:types:check
npm run lint
npm run typecheck
npm run test:client
npm run db:test
npm run web:export
npx expo export --platform ios --platform android --output-dir dist/native-validation
npm run playwright:install
npm run test:e2e:security
npm run test:e2e
git diff --check
```

T006 omits only the nonexistent migration runner; T050 requires T027 first.
T065 follows quickstart's repeatability variant: do not let cleanup stop the
stack between runs; run #1 supplies the final ordinary checkpoint, then another
complete acceptance after the outside-harness allowance wait. T066 executes the
normal chain inside its exact committed clone. Verify wrapper-owned web/browser
and Supabase cleanup, and remove only owned ignored export/disposable outputs.

All SQL fixtures use zero GoTrue signups. Test authoring/discovery/unit/export
checks use zero browser identities. Executing an individual E/F/G task consumes
its allocation below in addition to any later full gate; authoring a case does
not consume identities. Earlier failed/partial/manual attempts are never erased
from accounting. No extra signup probe, retry after429, rate increase or
Supabase restart/reset for quota. Unknown/insufficient allowance means waiting
outside the harness; a full signup-free hour since the last attempt is the
documented conservative admission boundary. Keep anonymous_users=150 unchanged.

### Per-case identity ledger

Each row is one actual browser case, including parameterized legacy trials.
Contexts are isolated browser contexts, not pages; an extra page for duplicate
requests uses its existing context and subject. User counts below are distinct
Auth identities over that case's lifetime. Only the existing explicit-storage-
clear Auth test deliberately creates a replacement identity, already included
in its three-signup cap. No setup/decoder/snapshot helper creates another user.
All counts assume successful bounded execution; charge failed/partial attempts
and separately executed selections in addition to these planned reservations.

| Case | Contexts / distinct users | Fresh sign-ins | Same-case reuse | Extra identities for reload/reconnect/retry |
| --- | --- | ---: | --- | ---: |
| E01 rapid create | 1 / 1 | 1 | Creator across duplicate actions | 0 |
| E01 pre-acceptance create failure | 1 / 1 | 1 | Creator through failure/retry | 0 |
| E01 committed create response loss | 1 / 1 | 1 | Creator through lost response/recovery | 0 |
| Auth persistence/independence/explicit clear | 2 / 3 | 3 | First context has original then deliberately cleared identity; second stays independent | 0; explicit clear adds1 already counted |
| E02 link and re-entry | 2 / 2 | 2 | Creator and voter through re-entry | 0 |
| E03 live bound UPDATE | 2 / 2 | 2 | Creator and joining voter | 0 |
| E03 commit before binding readiness | 2 / 2 | 2 | Same creator/voter through system-ok refetch | 0 |
| E04 manual normalization | 2 / 2 | 2 | Creator and manual-code voter | 0 |
| E04 pre-acceptance join failure | 2 / 2 | 2 | Same joining voter retries | 0 |
| E05 full rejection | 3 / 3 | 3 | Creator/voter plus same rejected outsider | 0 |
| E06 final-slot race | 3 / 3 | 3 | Creator plus two contenders, winner/loser reused | 0 |
| E07 creator Waiting reload | 1 / 1 | 1 | Same creator | 0 |
| E07 creator Ready reload | 2 / 2 | 2 | Same creator/voter | 0 |
| E07 creator socket loss | 2 / 2 | 2 | Same creator/voter | 0 |
| E08 voter Ready reload | 2 / 2 | 2 | Same creator/voter | 0 |
| E08 voter socket loss | 2 / 2 | 2 | Same creator/voter | 0 |
| E09 repeat/overlapping join | 2 / 2 | 2 | Existing voter subject reused for duplicate calls | 0 |
| E10 malformed manual | 1 / 1 | 1 | Same invalid-input client | 0 |
| E10 malformed direct route | 1 / 1 | 1 | Same invalid-route client | 0 |
| E11 nonexistent canonical code | 1 / 1 | 1 | Same caller | 0 |
| E12 private read | 2 / 2 | 2 | Two creators of unrelated rooms | 0 |
| E12 live subscription isolation | 3 / 3 | 3 | Creator, voter and unrelated observer | 0 |
| E12 stale navigation | 3 / 3 | 3 | Two creators plus voter; same navigation identity | 0 |
| E12 direct mutations | 3 / 3 | 3 | Creator, voter and outsider reused for attacks | 0 |
| F01 | 2 / 2 | 2 | Creator/voter through Waiting, assignment and repeated access | 0 |
| F02 | 2 / 2 | 2 | Same pair across reload/reconnect/re-entry | 0 |
| F03 | 2 / 2 | 2 | Disconnected creator and already-admitted voter | 0 |
| F04 | 4 / 4 | 4 | Two unrelated creator/voter pairs reused for probes/recovery | 0 |
| F05 | 2 / 2 | 2 | Same pair through both failures and retry | 0 |
| F06 | 2 / 2 | 2 | Same pair across two deliberate rooms and alternate failures | 0 |
| F07 | 2 / 2 | 2 | Same pair across committed response loss and retry | 0 |
| F08 | 2 / 2 | 2 | Same pair; poster retry changes neither subject nor candidate | 0 |
| G01 | 1 / 1 | 1 | Creator across four configurations/rooms; decode adds no user | 0 |
| G02 | 1 / 1 | 1 | Creator across six rooms; both modes and all creation retries | 0 |
| G03 | 3 / 3 | 3 | Voting creator plus two voters across all recovery checks | 0 |
| G04 | 4 / 4 | 4 | Non-voting creator plus three voters, including any extra logical room | 0 |
| G05 | 2 / 2 | 2 | Creator and one voter; duplicate calls/pages share that voter context | 0 |
| G06 | 4 / 4 | 4 | Non-voting creator plus three concurrent voters; own-invite recovery | 0 |
| G07 | 4 / 4 | 4 | Creator, prior voter and two contenders; loser reused for every full trial | 0 |
| G08 | 4 / 4 | 4 | Three room-A voters plus non-voting room-B creator reused for attacks | 0 |
| G09 | 3 / 3 | 3 | Creator/joiner/competitor across three rooms and every retry | 0 |

Recomputed: 24 legacy room cases /47 sign-ins +8 candidate cases /18 sign-ins
+9 membership cases /26 sign-ins =41 cases /91 sign-ins. The separate C1
probe owns one context/user/sign-in; its static cases create none. Thus C1 adds
exactly1, not another acceptance case or a hidden bootstrap participant.

| Acceptance block | Task(s) | Attempts / identities reserved |
| --- | --- | ---: |
| Existing room suite: 24 trials | T043; per-trial allocation in quickstart | 47 |
| Existing candidate suite: 8 trials | T044; F04=4, each other F=2 | 18 |
| G01/G02/G03/G04/G05/G06/G07/G08/G09 | T055/T056/T046/T047/T057/T058/T059/T060/T061 | 1+1+3+4+2+4+4+4+3 = 26 |
| G1: C1 + existing32 | T006 | 66 |
| G2: C1 + existing32 + G03/G04 | T050 | 73 |
| G3: C1 + complete41 | T064 | 92 |
| One complete41 without another C1 | within already-gated block | 91 |
| Optional G-only selection plus C1 | only if separately executed through safe wrapper | 27 additional |
| G4 repeatability: C1 once + complete41 twice | T065 | 183 across recovered windows |
| G4 fresh clone: C1 + complete41 | T066 | 92 in separately admitted window |
| G4 aggregate | T065/T066 | 275; not one hourly window |

Reload/reconnect/retry/re-entry in the same context adds zero. Never export a
session cache across cases. Record actual attempts and successful identities
separately with timestamps, including any extra C1 (+1). Manual optional
three-voter checks cost3/4 for voting/non-voting creator (7 if independent groups);
phone checks additionally account their actual identities and use the LAN setup
in quickstart. They do not replace automated decoded-target acceptance or claim
that localhost is reachable from a phone. No new mandatory hardware gate is added.

## Coverage and Traceability

The following maps planned executable evidence, not completed acceptance.
Checkpoint columns reference real validation tasks; documentation-only T001/T067
does not substitute for implementation or test evidence.

### Functional requirements — 35/35

| Requirement | Implementation task(s) | Executable test task(s) | Checkpoint |
| --- | --- | --- | --- |
| FR-001 | T014, T031, T039 | T008, T029, T032, T055 | T050/T064 |
| FR-002 | T012, T014, T030, T039 | T007/T008, T028/T032, T046/T047, T055 | T050/T064 |
| FR-003 | T014, T030, T039 | T008/T028/T032, T055 | T050/T064 |
| FR-004 | T013–T015, T039/T036 | T008/T010/T011, T032/T034, T055/T056/T060 | T050/T064 |
| FR-005 | T012/T014 | T008/T019, T055/T056 | T050/T064 |
| FR-006 | T014/T015, T036–T038 | T009/T010, T033–T035, T047/T058 | T050/T064 |
| FR-007 | T013–T015, T037/T038/T052 | T011/T033/T034/T051, T047/T055/T058 | T050/T064 |
| FR-008 | T012/T014/T039/T036/T038 | T008/T032/T033, T055 | T050/T064 |
| FR-009 | T004/T038/T052 | T003/T051, T055 | T064 |
| FR-010 | T004/T052, existing src/rooms/code.ts | T003/T051/T053–T055/T057 | T064 |
| FR-011 | T015/T031/T038/T052 | T009/T029/T033, T046/T047/T057 | T050/T064 |
| FR-012 | T015/T031/T036–T038 | T009/T033, T046/T047/T057 | T050/T064 |
| FR-013 | T012/T015/T038 | T009/T020/T021, T043/T057/T059 | T050/T064 |
| FR-014 | T012/T015/T036–T038 | T007/T009/T033/T034, T046/T047/T058 | T050/T064 |
| FR-015 | T012/T013/T015 | T009/T011/T020, T046/T059/T060 | T050/T064 |
| FR-016 | T015/T036/T038 | T009/T020/T033, T059 | T050/T064 |
| FR-017 | T015/T031/T038 | T009/T021/T033, T043/T057–T059 | T050/T064 |
| FR-018 | T012/T015/T031/T038 | T009/T020/T022, T043/T057/T061 | T050/T064 |
| FR-019 | T012/T014/T031/T039 | T008/T019/T032, T043/T056 | T050/T064 |
| FR-020 | T012/T013/T037/T038 | T011/T034, T043/T046/T047/T058 | T050/T064 |
| FR-021 | T014/T015/T031/T037/T038 | T009/T033/T034, T043/T046/T047/T058/T059 | T050/T064 |
| FR-022 | T015/T031/T036–T038 | T029/T033/T034, T046/T047/T058 | T050/T064 |
| FR-023 | T039/T036/T038 | T032/T033/T034, T046/T047/T055 | T050/T064 |
| FR-024 | T030/T031/T039/T038/T052 | T028/T029/T032/T033/T051, T055/T060, T045/T054 | T050/T064 |
| FR-025 | T012/T015 | T007/T009/T020/T021, T043/T057–T059 | T050/T064 |
| FR-026 | T015 | T020, T043/T059 | T050/T064 |
| FR-027 | T015 | T020/T021, T057/T058 | T050/T064 |
| FR-028 | T013–T015/T017 | T011/T016, T043/T044/T060 | T050/T064 |
| FR-029 | T012/T013/T015 | T007/T011, T043/T060 | T050/T064 |
| FR-030 | T015/T030/T031/T038 | T009/T028/T029/T033, T043 | T050/T064 |
| FR-031 | T014/T031/T039 | T008/T019/T022/T032, T043/T056 | T050/T064 |
| FR-032 | T015/T031/T038 | T009/T020/T022/T029/T033, T043/T061 | T050/T064 |
| FR-033 | T012/T017/T038/T040 | T016/T035, T044/T046/T047/T055/T057/T058 | T050/T064 |
| FR-034 | T017/T038/T040 | T016/T035, T044/T046/T047 | T050/T064 |
| FR-035 | T013/T017/T037–T038/T040 | T016/T034/T035, T044/T046/T047/T060 | T050/T064 |

### Non-functional requirements — 4/4

| Requirement | Implementation task(s) | Executable evidence | Checkpoint |
| --- | --- | --- | --- |
| NFR-001 | T015/T031/T036–T038 | T009/T029/T033/T034, T043/T046/T047/T058 | T050/T064/T065/T066 |
| NFR-002 | T012/T014/T015 | T008–T010/T019–T022, T043/T056–T059/T061 | T050/T064/T065/T066 |
| NFR-003 | T013–T015/T017/T030/T031/T038, T048/T062 | T010/T011/T016/T028/T029/T045/T054, T043/T044/T060 and C1 | T050/T064/T065/T066 |
| NFR-004 | T002/T004/T039/T038/T052 | T003/T005/T032/T033/T051/T053–T055/T057, web/native exports T006/T049/T050/T063/T064 | T006/T050/T064/T066 |

### Success criteria — 12/12

| Criterion | Implementation basis | Executable test task(s) | Checkpoint |
| --- | --- | --- | --- |
| SC-001 | T012/T014/T030/T039/T036/T038 | T008/T028/T032/T033/T055 | T050/T064 |
| SC-002 | T012/T015/T036–T038 | T007/T009/T033/T034/T046/T047 | T050 |
| SC-003 | T012/T015 | T009/T020/T021/T043/T057–T059 | T050/T064 |
| SC-004 | T014/T015/T031/T037/T038 | T009/T021/T034/T043/T046/T057/T059 | T050/T064 |
| SC-005 | T013–T015/T036–T038/T052 | T008–T011/T033/T034/T047/T055/T058 | T050/T064 |
| SC-006 | T004/T015/T031/T038/T052 | T003/T051/T053–T055/T046/T057 | T064 |
| SC-007 | T015/T036/T038 | T009/T020/T033/T059 | T064 |
| SC-008 | T015/T031/T036–T038 | T034/T043/T046/T047/T058 | T050/T064 |
| SC-009 | T013–T015/T017/T030/T031/T038/T052, C1 metadata T048/T062 | T011/T016/T028/T029/T033/T045/T051/T054/T055/T060, E12/F04 in T043/T044 | T050/T064 |
| SC-010 | Bounded paths T004/T012–T018/T036–T040/T052 | No-future-control/local-traffic assertions in T033/T035/T043/T044/T046/T047/T051/T055/T060 | T064/T065/T066 |
| SC-011 | T012/T017/T037–T038/T040 | T016/T035/T044/T046/T047 | T050/T064 |
| SC-012 | T012–T015/T030/T031/T039/T038 | T008–T011/T019–T022/T028/T029/T032/T043/T055/T056/T060/T061 | T050/T064 |

### Product acceptance scenarios — all 36

Numbers are the unique Given/When/Then numbers in spec.md. G3 completes any
QR-dependent aspect; G2 evidence remains valid for its link/code subset.

| Scenario / story | Implementation task(s) | Executable test task(s) / browser case | Checkpoint |
| --- | --- | --- | --- |
| 1 / US1 | T039 | T032, T055/G01 | T064 |
| 2 / US1 | T014/T030/T039 | T008/T028/T032, T055/G01 | T050/T064 |
| 3 / US1 | T012/T014/T039/T038 | T008/T032/T033, T055/G01 | T064 |
| 4 / US1 | T012/T014/T039/T038 | T008/T032, T046/G03, T055/G01 | T050/T064 |
| 5 / US1 | T012–T014/T039/T038 | T008/T011/T032, T055/G01 | T064 |
| 6 / US1 | T012–T014/T039/T038 | T008/T032, T047/G04, T055/G01, T058/G06 | T050/T064 |
| 7 / US1 | T004/T038/T052 | T003/T051/T053, T055/G01 | T064 |
| 8 / US1 | T004/T038/T052 | T051/T053/T054, T055/G01 and T057/G05 decoded target | T064 |
| 9 / US1 | T014/T039 | T008/T032, T055/G01 | T064 |
| 10 / US1 | T013–T015/T039/T036 | T008/T010/T011/T032/T034, T055/G01 and T060/G08 before/after assembly protection | T050/T064 |
| 11 / US1 | T014/T031/T039 | T008/T019/T022/T032, T056/G02 | T064 |
| 12 / US2 | T015/T031/T038 | T009/T029/T033, T046/G03 and T047/G04 | T050 |
| 13 / US2 | T015/T031/T039/T038 | T009/T033, T046/G03 | T050 |
| 14 / US2 | T004/T015/T031/T038/T052 | T051/T053, T057/G05 real decoded-target admission | T064 |
| 15 / US2 | T012/T015/T036–T038 | T007/T009/T033/T034, T046/G03 | T050 |
| 16 / US2 | T012/T015/T036–T038 | T009/T033, T046/G03 | T050 |
| 17 / US2 | T015/T031/T036–T038 | T029/T034, T046/G03 and T047/G04 | T050 |
| 18 / US2 | T012–T015/T036–T038 | T008/T009/T011/T033/T034, T047/G04 | T050 |
| 19 / US3 | T012/T015/T031/T038/T052 | T009/T020, T057/G05 and T059/G07 | T064 |
| 20 / US3 | T014/T015/T031/T038 | T009/T033, T046/G03 and T059/G07 | T050/T064 |
| 21 / US3 | T013–T015/T037/T038/T052 | T009/T010/T034, T047/G04 and T058/G06 | T050/T064 |
| 22 / US3 | T015/T031/T037/T038 | T009/T034, T046/G03 and T047/G04 | T050 |
| 23 / US3 | T012/T013/T037/T038 | T034/T043, T046/G03 | T050 |
| 24 / US3 | T012/T013/T037/T038 | T034/T043, T046/G03 and T047/G04 | T050 |
| 25 / US3 | T012/T015 | T020, T059/G07 | T064 |
| 26 / US3 | T012/T015 | T021, T058/G06 | T064 |
| 27 / US3 | T015/T036/T038/T052 | T009/T020/T033, T059/G07 | T064 |
| 28 / US3 | T015/T031/T038/T052 | T009/T021/T033, T059/G07 | T064 |
| 29 / US3 | T013–T015/T017/T031 | T011/T016/T029, T060/G08 and T043/E12, T044/F04 | T050/T064 |
| 30 / US3 | T015/T030/T031/T038 | T009/T028/T029/T033, T043/E10 manual/direct and E11 | T050 |
| 31 / US3 | T015/T031/T038 | T009/T022/T029/T033, T061/G09 | T064 |
| 32 / US3 | T015/T031/T038 | T009/T020/T022, T061/G09 | T064 |
| 33 / US3 | T012/T013/T015 | T007/T011, T060/G08 | T064 |
| 34 / US3 | T017/T038/T040 | T016/T035, T046/G03 and T047/G04 | T050 |
| 35 / US3 | T013/T017/T037–T038/T040 | T016/T034/T035/T044 F02/F05/F06/F07/F08, T046/G03 and T047/G04 | T050 |
| 36 / US3 | T012/T017/T038/T040 | T016/T035/T044 F01, T046/G03, T047/G04, T055/G01, T057/G05, T058/G06 | T050/T064 |

### Browser cases and preserved Feature 002 evidence

| Case | Owning task | Principal evidence | Gate |
| --- | --- | --- | --- |
| G01 | T055 | Four independent creation/invitation configurations and visible decoded QR | T064 |
| G02 | T056 | Both-mode creation overlap, pre-forward failure and committed-response loss | T064 |
| G03 | T046 | Three voters, intermediate/final Realtime convergence and shared candidate recovery | T050/T064 |
| G04 | T047 | Non-voting creator plus three voters, same candidate and local poster recovery | T050/T064 |
| G05 | T057 | Real QR first admission and same-identity overlap with spare capacity | T064 |
| G06 | T058 | Three simultaneous admissions and non-voting creator QR/link/code recovery | T064 |
| G07 | T059 | Final-slot contention, all-mechanism full/re-entry ordering | T064 |
| G08 | T060 | Generalized isolation and denied membership/configuration/candidate manipulation | T064 |
| G09 | T061 | Pre-admission failure/retry/full and committed admission with response loss | T064 |
| F01 | T044 | Waiting RPC0, overlapping first acquisition, one assignment and harmless invalidation | T050/T064 |
| F02 | T044 | Both existing members' reload/reconnect/repeated access, stable assignment/xmin | T050/T064 |
| F03 | T044 | Disconnected Waiting creator recovers peer-established Ready candidate | T050/T064 |
| F04 | T044 | Two-room isolation and indistinguishable missing/foreign candidate responses | T050/T064 |
| F05 | T044 | Both pre-forward candidate failures preserve Ready/NULL before retry | T050/T064 |
| F06 | T044 | Reused identities across two rooms and alternating failed participant | T050/T064 |
| F07 | T044 | Real committed assignment before response abort, same candidate on retry | T050/T064 |
| F08 | T044 | Exact local poster failure, retained metadata, visible same-poster retry/RPC0 | T050/T064 |

### Cross-cutting and reviewed corrections

| Constraint | Implementation / executable evidence | Required checkpoint |
| --- | --- | --- |
| Creator membership integrity; immutable choice | T014/T015; T010 removal/corruption exception/no-write/restoration tests, T008/T009 existing-member behavior | T026/T050, retained T064–T066 |
| Impossible false/false projection | T015/T030; T010 real DB exception and T028 parser rejection | T026/T050, retained T064–T066 |
| Generated-state cutover and ANALYZE | T012/T018; nonempty T023–T025 statistics and logical-state checks; empty reset only requires successful ANALYZE | T026/T050, retained T064–T066 |
| Count/member single authority and real locking | T012/T014/T015; T007–T011/T019–T022 and T057–T059 | T026/T050/T064 |
| C1 | Retained safe infrastructure; bounded metadata T048/T062 and QR memory helper T053; T045/T054 plus unchanged c1-capture tests and actual controlled C1/scanner | T006/T050/T064/T065/T066 |
| R01 | T027 sole intentional write+immediate check; T050 independent reset/check-only/hash+metadata; scripts/database-types.mjs unchanged | T027/T050, all later checks T064–T066 |
| R02 | T043/T044/T046/T047/T055–T061 per-case budgets, T048/T062 metadata; measured gate/window accounting and no429 workaround | T006=66, T050=73, T064=92, T065=183, T066=92 |
| One Realtime channel and harmless candidate UPDATE | T013/T017/T037/T038; T011/T034/T035/T043/T046/T047 | T050/T064 |
| Scope, historical artifacts and original posters | T001 baseline, bounded implementation tasks, local-only/control assertions and exports | T006/T050/T064/T065/T066; T067 verifies receipts |

## Implementation Strategy

Start with the standalone QR foundation and finish G1. Deliver the full atomic
cutover as the smallest coherent generalized DB/client increment, with G03/G04
and all existing regressions at G2. Complete US1 invitations and all QR-derived
US2/US3 behaviors at G3, then prove exact-source repeatability/fresh checkout at
G4. Do not suggest a US1-only production cutover with incompatible old joining
or omit US3 security/recovery to shorten the feature.

Each checkpoint records environment/source, actual commands/results and counts,
type hashes/metadata, migration/statistics/lock receipts where applicable, Auth
attempts/identities/windows, scanner result, export/QR/poster observations and
verified cleanup in quickstart's existing evidence-log convention. Preserve
failed-run history and quota costs; a required failure blocks completion.
If approved real-lock or integrity semantics cannot be demonstrated, stop the
affected work and report the conflict rather than weakening the oracle.

All checkboxes remain unchecked at generation. No implementation, dependency
installation, service startup, tests, commit/push or issue creation is performed
by this document-generation step. Subsequent review/consistency analysis is a
separate workflow; it has not been invoked here.
