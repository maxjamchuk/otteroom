# Quickstart and Validation: Common Filter Resolution

**Status**: Planned validation; no command in this guide was run by planning and
no implementation PASS is claimed.
**Date**: 2026-09-12.

During implementation, record exact source SHA/worktree scope, environment,
commands, results/counts, R01 metadata, R02 windows, scanner result and cleanup
before calling any checkpoint green.

## Prerequisites

Use repository root `/home/maks/work/otteroom`, branch `main`, the committed
lockfile and declared Node 24.20.x/npm 11.19.0 toolchain. Docker and the existing
project-local Supabase 2.116.0 / managed Playwright 1.63.0 runtimes are required.

Acceptance needs no hosted Supabase, TMDB/API key, movie request, permanent
account, service-role credential in a browser or physical phone. Use the existing
safe local-environment, browser-runner, reporter, scanner and cleanup wrappers.

The future implementation must exist before these commands are executed:

- one additive Feature 005 migration;
- a nonempty Feature004→005 migration runner and before/after SQL fixtures;
- resolver/database/client/route tests and exact generated public types;
- I01-I03, evolved permanent smoke assertions and targeted H03 selection.

## Nonempty migration evidence

With an owned idle local stack:

```sh
npm run db:reset
node scripts/check-common-filter-resolution-migration.mjs
```

The runner must:

1. verify local project identity, an idle stack and no competing browser/fixture
   state before resetting to exact migration `20260911000000`;
2. create bounded SQL/Auth fixtures without GoTrue signup: Waiting, partial,
   compatible frozen N/N and incompatible frozen N/N rooms across both creator
   modes, including NULL and preserved non-lowest fixture candidate FKs;
3. snapshot exact room/member/filter values and xmin plus candidate/timestamps;
4. apply the actual pending Feature 005 migration, not copied SQL;
5. prove every prior value/xmin is unchanged apart from the new pending default,
   no private result exists and no candidate authority is restored;
6. prove exact enum/columns/tables/keys/checks, owner/RLS/ACL/function shapes and
   rooms-only Realtime publication;
7. use ordinary authenticated claims to prove an already-frozen compatible and
   incompatible room resolve lazily through the real RPC, while Waiting/partial
   remain pending and private payload remains inaccessible;
8. prove create/join/re-entry returns stored status and existing Feature 004 own
   filter detail remains owner-only;
9. clean only owned fixtures and restore latest clean schema on success, failure
   or interruption; and
10. verify `src/types/database.generated.ts` bytes did not change during migration
    testing.

Keep the existing Feature003→latest and Feature003→004 validators runnable by
updating only their latest-schema expectations where exact inventories changed.
Historical migrations remain byte-unchanged.

## Database contract evidence

After a clean latest reset:

```sh
npm run db:reset
npm run db:test
```

Record actual assertion totals. Required authority follows
[data-model.md](data-model.md) and
[the RPC contract](contracts/common-filter-resolution-rpc.md):

| Area | Required proof |
| --- | --- |
| Schema | Exact enum/status default/check; private parent/clause types, keys, FKs and checks; no movie/catalog/result JSON field |
| Complete input | Below assembly/X<N is pending/no-write; N/N count equals fixed voters and exactly one filter each; NVC excluded |
| Years | Max lower/min upper; inclusive one-year overlap compatible; disjoint range incompatible |
| Genres | Any contributes no clause; all-Any gives zero clauses; one canonical OR array per constrained voter; clauses ANDed; disjoint sets remain compatible |
| Terminal shape | Compatible has one exact parent and contiguous clauses; incompatible/pending have none; no reversal or duplicate |
| Idempotency | Same/other authorized retries return same terminal outcome and perform zero additional writes/xmin changes |
| Failure | A fault after internal work rolls back status/parent/clauses; frozen source remains exact; retry succeeds |
| Privacy | Exact function owner/search path/ACL; private/source tables denied; foreign/missing masked; status-only rooms projection |
| Realtime | Only rooms published; first terminal updates room once; pending/retry/failure/no-op emits no committed result write |
| Candidate | Candidate RPC remains denied and candidate FK/catalog are unchanged/hidden; resolver calls no candidate function |
| Cleanup | No test trigger/helper, dblink backend, synthetic user, room, filter or result remains |

### Deterministic concurrency procedure

Use pgTAP+dblink, not sleeps or browser timing as the lock oracle:

1. Owner setup commits a coherent frozen room; each caller uses authenticated
   role, exact `auth.uid()`, READ COMMITTED and a distinct backend/PID.
2. Owner holds the room `FOR UPDATE`, dispatches real resolver calls, and requires
   outstanding queries plus `pg_blocking_pids`/ungranted-lock evidence.
3. Release the owner, retain the first caller transaction long enough to prove
   the second blocks on it, then collect outcomes and per-session table deltas.
4. Compare room/result/clause/filter snapshots and xmin after each commit.
5. Bound cancel/drain/rollback and cleanup on every path.

Required trials:

- concurrent first compatible resolution: one writer, both compatible;
- concurrent first incompatible resolution: one room update, no payload;
- repeated same-client and different-member terminal calls: no writes;
- committed response discarded, then refetch/RPC recovery: same result;
- injected post-insert exception: full rollback to pending, retry succeeds;
- unchanged participant-filter values/count/xmin across every trial;
- unrelated-room resolution completes while the first room remains locked;
- foreign caller returns masked no-access without joining the lock queue.

## R01 — exactly one generated-types write

Only after the final migration/RPC contract and database tests are green:

```sh
npm run db:reset
npm run db:test
npm run db:types
npm run db:types:check
```

This `npm run db:types` is the only intentional generated-types write. Review the
new public enum/room field and exact create/join/resolver signatures. Private
relations should not enter public generated client types.

Then independently prove check-only stability:

```sh
sha256sum src/types/database.generated.ts
stat -c '%i %s %Y %Z' src/types/database.generated.ts
npm run db:reset
npm run db:types:check
sha256sum src/types/database.generated.ts
stat -c '%i %s %Y %Z' src/types/database.generated.ts
```

Require identical bytes/hash/inode/size/mtime/ctime. Every later normal,
repeatability and fresh-checkout gate runs `db:types:check` only.

## Client and integration evidence

Run focused tests, then all client/static/export gates:

```sh
npm run test:client -- __tests__/resolution __tests__/rooms __tests__/routes/room.test.tsx
npm run lint
npm run typecheck
npm run test:client
npm run web:export
npx expo export --platform ios --platform android --output-dir dist/native-validation
```

Required client evidence:

- exact two-field resolver result and seven-field room projection parsing;
- ten-field create/join parsing and terminal-requires-N/N validation;
- monotonic pending→one-terminal merge and contradictory-terminal rejection;
- automatic N/N invocation, effect-replay/same-room one-flight and explicit Retry;
- an N/N-triggered `pending` result becomes one retryable error, with no automatic
  reinvocation loop; only explicit Retry or a new route generation starts again;
- transient failure distinct from incompatible; terminal refetch clears local error;
- conflicting terminals set a fail-closed integrity overlay, suppress ready/next
  action and recover only through a fresh canonical room-entry generation;
- route A→B→A stale-generation rejection and missed Realtime event recovery;
- non-voting creator status-only behavior and voter own-detail preservation;
- Feature 004's N/N form retains own read-only detail/recovery but drops its old
  next-feature heading; the resolution panel solely owns terminal next-action text;
- compatible next-step text, incompatible new-room action and frozen UI;
- no exact common years/genres/clauses/roster/internal IDs in service/model/UI;
- zero candidate/TMDB import, call, assignment, metadata or interaction in every state.

Native export proves module compatibility, not physical-device interaction.

## Browser acceptance and impact review

Use only the safe wrappers. Future runner allowlists add `@resolution`, I01-I03
and the exact new test/support locations without changing context, reporter,
scanner or cleanup semantics.

### Feature 005 owner profile (`F=9`)

| Case | Cap | Required journey |
| --- | ---: | --- |
| I01 | 3 | Voting creator + two voters; partial→N/N→compatible with Any, disjoint genre clauses and overlapping years; convergence/reload/reconnect/re-entry; candidate zero |
| I02 | 4 | Non-voting creator + three voters; disjoint years→incompatible; no creator input, status-only privacy, missed-update recovery, new-room action; handoff/candidate zero |
| I03 | 2 | Voting creator + voter reused across bounded rooms; pre-commit failure/retry and committed-response loss/recovery; frozen inputs stable; failure is not incompatible |

Exact planned commands:

```sh
npm run test:e2e:security
npm run test:e2e -- --grep @resolution
npm run test:e2e:smoke
npm run test:e2e -- --grep H03
```

The permanent smoke remains exactly G03/G04/G05/G08/H01 at 16 identities, with
only evolved terminal assertions. H03 is targeted once at 3 identities because
automatic resolution is coupled to first frozen N/N observation. H02 is not
selected: own-filter recovery/edit/lock behavior is unchanged. No non-smoke E/G
case is selected. Full historical acceptance is not this feature's default gate.

### R02 ledger

| Gate | Formula | Reserved identities |
| --- | --- | ---: |
| Normal checkpoint | C1 `1` + smoke `16` + owner `9` + H03 `3` | **29** |
| Repeatability | C1 `1` + 2 × (smoke `16` + owner `9`) + H03 `3` | **54** |
| Fresh checkout | C1 `1` + smoke `16` | **17** |
| Repeatability + fresh | `54 + 17` | **71** |

Record case maxima, actual signup attempts, successful identities, timestamps,
scanner and cleanup. workers=1, retries=0 and repeatEach=1. Every failed/partial/
manual attempt consumes allowance. Do not probe, raise, reset/restart to evade,
retry HTTP 429 or export/share Auth storage.

## Scenario coverage map

| Feature 005 scenarios | Principal evidence |
| --- | --- |
| 1–4 | Existing Feature 004 + resolver early no-write DB tests; I01 partial→N/N |
| 5–9 | DB exact-voter/year/genre/canonical/retry proof; I01 representative three-voter flow |
| 10–12 | DB compatible/incompatible/CNF proof; I01/I02 observable terminals |
| 13–16 | Client terminal authority/stale guards; I01/I02 convergence/status-only UI |
| 17–19 | Join/refetch/Realtime/client recovery; I01/I02 reload/reconnect/re-entry/missed event |
| 20–21 | DB rollback/idempotency plus I03 failure/lost-response recovery |
| 22–24 | Feature 004 owner privacy + new ACL/RLS/client proof; I02 and permanent G08 |
| 25 | Every DB/client/I/smoke path asserts candidate and movie traffic/UI zero |

## Normal green command path

After implementation and the one separate R01 write, a cleanup-owning shell runs:

```sh
npm ci
npm run supabase:start
npm run env:local
node scripts/check-room-membership-migration.mjs
node scripts/check-participant-filters-migration.mjs
node scripts/check-common-filter-resolution-migration.mjs
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
npm run test:e2e -- --grep @resolution
npm run test:e2e:smoke
npm run test:e2e -- --grep H03
git diff --check
npm run supabase:stop
```

Use the repository's failure-safe cleanup wrapper/trap pattern so service stop
does not hide an earlier failure. A failed required command blocks completion.

## Repeatability

The first owner+smoke run is the normal checkpoint; do not add an uncounted
preliminary run. Run C1 once, owner+smoke twice from unchanged source/stack with
fresh case contexts, and targeted H03 once. A clean DB reset/check-only type
comparison may occur between executions but does not replenish Auth quota.
Require the same results, scanner zero, exact total 54 and owned cleanup.

## Fresh checkout

At the exact committed implementation SHA, create an independent disposable
checkout under `/tmp` without copying `.env`, node_modules, Auth storage, caches
or service volumes. Using the declared toolchain, prove install/local setup,
all nonempty migrations, clean latest reset, full DB/client/static/build/exports,
check-only generated types, C1 and the 16-identity permanent smoke. Feature-owner
and H03 are not automatically repeated. Reserve 17 in a separate admitted
window, record scanner zero, stop owned services and remove only the disposable
checkout after evidence is retained.

## Scope and evidence record

Before completion, inspect the implementation diff and network/test receipts for
zero TMDB/candidate acquisition/display, ranking, swipe, progression, match,
filter reopening/new round, dynamic membership, provider, TV or permanent-account
behavior. Record all omitted checks with concrete not-applicable reasons; planning
itself omits executable checks because no implementation was authorized.

## Implementation evidence ledger

This ledger records implementation evidence as it is produced. A recorded
baseline is provenance only; it does not claim an implementation checkpoint.

### T001 protected baseline — 2026-09-12

- Repository: `/home/maks/work/otteroom`; branch `main`; HEAD
  `452ba6ca8872cde221847da70d78a3ba57e175bd`; upstream `origin/main`;
  `git status --porcelain=v1` was empty.
- Declared toolchain: Node `24.20.x`, npm `11.19.0`, Supabase CLI `2.116.0`.
  Host discovery reported Node `v22.23.2` and npm `10.9.8`; executable gates
  must therefore use the repository's declared-toolchain wrapper/environment.
  The installed Supabase package reports `2.116.0` (direct CLI version output
  could not write its user telemetry file in the restricted planning shell).
- G1, US1, US2, G2, G3, repeatability and fresh-checkout results: not run yet.
- R01 generated-type writes: `0`. R02 identities/attempts: `0/0`.

Historical migration SHA-256 values:

```text
d6222184274428c6dd5d629e4d3416a582e0a74f355c8c6fe1d389630ecad439  supabase/migrations/20260905000000_rooms_schema.sql
fda4126812feffb7bac5d737d6faae1930db35bbc26a1cb9402fcbad24b5b45c  supabase/migrations/20260905000001_room_rpcs.sql
71816083a6e1630ab663fa4fd41354b936efa714571809fffca4528f2312f7a9  supabase/migrations/20260905000002_rooms_realtime.sql
04487a75fadafe40a255f9ab3998b64c1109c9de6f4e4324ba441f8856531c38  supabase/migrations/20260909000000_movie_candidates_schema.sql
1b78eeb52ce9bb194b9530f48b49428b8f5bb7c523ab22d5406e9814d0e8dc52  supabase/migrations/20260909000001_room_candidate_rpc.sql
9813e830957f82febe184e54a5148faff159f046912b325b0a77d835ae33a71f  supabase/migrations/20260910000000_generalized_room_membership.sql
432c6d41ca37d0ea2b3ad00324854c3ec17338f3b6c21a4c4cfe3946c1c54ff0  supabase/migrations/20260911000000_participant_filters.sql
```

Protected core and Feature 004 contract SHA-256 values:

```text
27743e7f37bd999e9c58c50f47f868783b48852cc7c2b9f81fa78b38f997c6e2  src/types/database.generated.ts
9c3fa890e0993d30252a5aeb60ab40733011713e5e1d2f8447e9afcbd7f5b6a9  scripts/database-types.mjs
8052008d5876fab15a3be808e876f138218a0e9a2bd7a79178dd0c1f5a4fd6a5  __tests__/config/c1-capture.test.ts
85bb9f5e50ab95fc5bd963bacc6b5c091d82870023b54de8fb308e833a9d2b62  specs/004-participant-filters/contracts/candidate-suppression.md
51c682fad291b49ec4118354be2001fea9ab46aef1b74f94ab9562f7043cc70c  specs/004-participant-filters/contracts/client-filter-flow.md
2eb663e56e5bb8c8409ce2a668efc175a65eee1dda4fb3acdf0fffcc3c276ed3  specs/004-participant-filters/contracts/participant-filter-rpcs.md
cb85c80e703f902c0d5881721c7e497d310e921deca63ae62c09ca3190feacd9  specs/004-participant-filters/contracts/room-filter-projection-realtime.md
```

Feature 004 executable-test SHA-256 values:

```text
0e06a489cc96198bf82a90e311c26446b7eb20b7a4991ab03dbf68248ee71a8f  __tests__/config/e2e-diagnostics.test.ts
3c06d898f81d3713ffe009714f6ed3283f6c1572c2a3219935f2a2f872c9b29f  __tests__/config/playwright-runtime.test.ts
d41cb19c04f937468785d46b732aac19d7bdd4f11dc454d448b95eae58ccb41c  __tests__/filters/contracts.test.ts
838e0473325a972b29179aae53af0721ec1f8af1cd990d8e2729adf87d3fe7e7  __tests__/filters/genres.test.ts
ac5958768c2879c7f04b87224dba2e87f75d59bca0a8e2a67962933e73ed3303  __tests__/filters/participant-filter-form.test.tsx
aa5d95fed495971bf30d7f491e682ce464ae21880d639a5ee47421db4ed799a2  __tests__/filters/service.test.ts
e59232d47075c57ad731fb78e539afe496afabb4fd40349c43b552fbee8e7fa6  __tests__/filters/state.test.ts
55e91187df9dc67e7d7d0bdb483dbb1e17d6a683ab7872a2a6bb2bf212781916  __tests__/filters/use-participant-filter.test.ts
6db85cdb67e519de3f34e03572e2db927f537a32518ca4acd22fe93838977256  __tests__/rooms/code.test.ts
3d852ac4b347951ba40c05b4d786090df86ea88737350eed90457e45e2387a87  __tests__/rooms/contracts.test.ts
e75e8561faf43405de797e50b85aabb196aa830d86e615347be5397a15313c9e  __tests__/rooms/invitation-qr.test.tsx
42fa2d2ed501eebd37e371c7af417d3bfed057695d1246fbf795282fda3627b3  __tests__/rooms/service.test.ts
693b96528a37b872cab365480b77c4dba570674b438895dc1df89cd94954676a  __tests__/rooms/state.test.ts
c0767ec22f2b1cae3fce7bef856e14101108e3f30b8f244c6ed6211b19766c7d  __tests__/rooms/use-room-subscription.test.ts
c4fde379c2e6bf101b589ddeee3afba3a2ec719caf31c652829382917cf72bf3  __tests__/routes/room.test.tsx
c8825bea2f97fe84a856cc4ca3aeacb4c15326a009f9410f3ea98a4d58b64d69  e2e/participant-filters.spec.ts
b4108c7ca23bd6a44aaae2434a2f43b2be5364fa32266adf67956ebcec0d8280  e2e/support/filter-harness.ts
7def1d9103982d56b60873e13ffd11812a0e0686554a857be900622b0a5b10e0  supabase/tests/database/participant_filter_concurrency.test.sql
e55a33e92ea93be8ff1057895b7c7752d93bfbc03fac2523f0ed75fdf76569a5  supabase/tests/database/room_candidate.test.sql
617289358437a77aaaa12ab4e377edee0f2581cbdbf267899fbdfbb1308fb1f8  supabase/tests/database/room_session.test.sql
dca1bb97853219c5f5190b3443af7883425b543a20af3d3baee87b4422c75494  supabase/tests/migration/participant_filters.after.sql
4aaab27db78065fff16ae60d4d6794b874a46239a5c69c744edb59788095499a  supabase/tests/migration/participant_filters.before.sql
```

Candidate module/asset SHA-256 values:

```text
5a243057dc4b4cc4e3e80f1f962d17231cf8c28abb324fc4e5e129917884a89e  assets/candidates/cardboard-comet.png
0d24c74d6f93c305809f2d8e7d9f585a828faec87689ca1c48948ff3fcb2dd13  assets/candidates/clockwork-orchard.png
b5f35244b2baa18340d702772995b5029f4841eae6ac89d3ed6eec67f25931d3  assets/candidates/cloud-tram-four.png
3b8b642fa0dca328c6a0cae9e340d0f243357b65cb471f65931e751f5653e4d7  assets/candidates/pebble-bay-lanterns.png
a41c6c5579147ff7ae5e9a88e1cea0a4ca097f499a73cc696bc5c3e434518632  src/candidates/candidate-card.tsx
951af72829fa9c96fd645d88cc17e0494eb45b3e46bd1de217e4c7412a6f8133  src/candidates/contracts.ts
c043a9164668da794dd014d66e0cb7731b40ec22e19debe08e73c60d8a344a3f  src/candidates/posters.ts
b9c9c11589bc285a0094544d98a1a7d28d408985a977d021498e0c74acb1f10d  src/candidates/service.ts
4846f8e30038d283c8b2b2df6470be0842e77782fe1fc39edc38a053da2697e4  src/candidates/state.ts
8813f7e4f11547f96dce0a5ade0716f6f2fab990fa68fcdb3723ec3a03be07  src/candidates/use-room-candidate.ts
```

### T002–T006 failing-first database contract receipt — 2026-09-12

- Environment: declared Node `v24.20.0`, npm `11.19.0`, Supabase CLI
  `2.116.0`; local Feature 004 schema after `npm run db:reset`.
- Command:
  `supabase test db supabase/tests/database/common_filter_resolution.test.sql`.
- Result: expected FAIL before implementation. The first schema assertion
  reported the missing `public.filter_resolution_status`; the runner then
  exited nonzero before any migration existed. This establishes the red state
  for the new schema/RPC/algebra/concurrency contracts. The accompanying
  Feature 004 freeze/xmin and candidate-suppression assertions were also added
  before the Feature 005 migration.
- R01 generated-type writes: `0`. R02 identities/attempts: `0/0`.

### T007–T015 database authority and migration gate — 2026-09-12

- Environment: declared Node `v24.20.0`, npm `11.19.0`, project-local
  Supabase CLI `2.116.0`; owned local project `otteroom-room-session`.
- `npm run db:reset`: PASS through the new additive
  `20260912000000_common_filter_resolution.sql` migration.
- `node scripts/check-room-membership-migration.mjs`: PASS; 3 legacy rooms,
  5 synthetic SQL users, zero GoTrue signups, pending status/default and exact
  latest-schema recovery, latest reset and owned cleanup.
- `node scripts/check-participant-filters-migration.mjs`: PASS; 4 rooms,
  8 members, zero filters at that cutover, 8 synthetic SQL users, zero GoTrue
  signups, pending status/default, exact preservation, latest reset and cleanup.
- `node scripts/check-common-filter-resolution-migration.mjs`: PASS; nonempty
  Feature 004 state contained 4 rooms, 10 members, 6 frozen filters and all 4
  fixture rows; every value/xmin was preserved, install created zero payload,
  existing N/N rooms lazily resolved compatible/incompatible through ordinary
  authenticated calls, Waiting/partial stayed pending, candidate suppression and
  private denial held, latest reset/cleanup succeeded, and GoTrue signups were 0.
- `npm run db:test`: PASS, 4 files / 793 assertions. The focused resolver suite
  contributed 74 assertions; deterministic compatible/incompatible first-call
  trials observed independent authenticated READ COMMITTED PIDs, room-lock
  blocking, one room write, exact parent/clause writes, zero filter writes,
  stable filter xmin, foreign no-lock masking and unrelated-room independence.
  The injected post-clause fault rolled back status/parent/clauses to pending and
  a later retry succeeded from unchanged frozen rows.
- R01 generated-type writes: `0`. R02 identities/attempts: `0/0`. All migration
  runners restored a clean latest schema and removed owned fixtures.

### T016 R01 generated-types receipt — 2026-09-12

- Sole write command: `npm run db:types` — PASS; this is R01 write `1/1`.
- Immediate `npm run db:types:check` — PASS. Review confirmed the public
  `filter_resolution_status` enum/constant, room Row/Insert/Update status,
  ten-field create/join results and exact two-field resolver signature. Neither
  private result relation appears in generated public types.
- Canonical SHA-256:
  `7d9c800c61d2c7604abd24b1e3c723754904a33f616e41ef0e3c4793a3ed82d1`.
- Canonical metadata after write: inode `676005`, size `12159`, mtime
  `1789168582`, ctime `1789168583`.
- Independent `npm run db:reset` followed by `npm run db:types:check` — PASS;
  SHA/inode/size/mtime/ctime remained exactly
  `7d9c800c...ed82d1 / 676005 / 12159 / 1789168582 / 1789168583`.
- `scripts/database-types.mjs` remains unedited. Every later type validation is
  check-only. R02 identities/attempts remain `0/0`.

### T017–T019 failing-first client contract receipt — 2026-09-12

- Added exact resolver parser/service tests, evolved room result/refetch tests,
  and added resolution state/hook trigger tests before any `src/resolution/`
  production module existed.
- Focused resolver contract/room command: expected FAIL with both missing
  resolution modules and existing nine-/six-field room consumers rejecting the
  new ten-/seven-field fixtures (4 suites, 36 failing assertions plus the two
  missing-module suite failures).
- Focused state/hook command: expected FAIL because `src/resolution/state.ts`
  and `src/resolution/service.ts` did not yet exist (2 suites). This establishes
  the red state for exact N/N triggering, one-flight, terminal inactivity and
  pending-as-error behavior.
- No browser was started. R01 remains `1/1`; R02 identities/attempts remain
  `0/0`.

### T020–T025 US1 client checkpoint — 2026-09-12

- `npm run test:client -- __tests__/resolution __tests__/rooms __tests__/filters
  __tests__/routes/room.test.tsx`: PASS, 17 suites / 372 tests.
- `npm run typecheck`: PASS. `npm run lint`: final PASS after the first run
  identified and a focused edit removed a render-time ref assignment; the
  affected hook/route rerun then passed 2 suites / 25 tests.
- Exact two-field result parsing, Auth-before-UUID-only transport, ten-field
  create/join and seven-field refetch are green. Waiting, partial and terminal
  fixtures make zero resolver calls; exact frozen N/N pending shares one call
  through Strict effect replay; an unexpected pending response stops in an
  explicit-retry state without a loop.
- The database result is the only compatibility authority. The client model
  contains no resolved years/genres/clauses, the route imports no candidate
  hook/card, candidate service calls remain zero, voters retain only their own
  frozen summary/recovery and non-voting creators request no filter detail.
- No browser was started. R01 remains `1/1`; R02 identities/attempts remain
  `0/0`.

### T026–T032 US2 convergence checkpoint — 2026-09-12

- The new terminal-conflict test first failed because an equal later room
  snapshot could clear the local integrity overlay in the same generation. The
  state merge was corrected to make that overlay generation-sticky.
- Focused state/subscription/panel/route command: PASS, 6 suites / 106 tests.
  `npm run lint` and `npm run typecheck`: PASS.
- Both terminal statuses advance only from pending at Ready N/N. Delayed pending
  and equal-terminal reads are no-ops; incomparable terminals fail closed.
  Initial system-ok and invalidation refetch recover missed terminal updates,
  bursts remain one active plus one pending read, retired lifecycles are ignored,
  and the existing exact room channel remains the only subscription.
- Compatible exposes only future sourcing meaning. Incompatible keeps this room
  frozen and links to existing new-room creation. Integrity error exposes
  neither meaning. Focused render assertions found no resolved constraint,
  roster/internal ID, candidate metadata/control or candidate service call.
- No browser was started. R01 remains `1/1`; R02 identities/attempts remain
  `0/0`.

### T033–T037 US3 and G2 atomic cutover — 2026-09-12

- Focused service/hook recovery command: PASS, 2 suites / 23 tests. Route
  recovery/separation command: PASS, 1 suite / 23 tests. Evidence covers
  pre-forward/transport failure, explicit bounded Retry, committed-response
  loss, peer terminal success, same-generation flight sharing, stale A→B→A
  success/error rejection, socket missed-update recovery, separate sync versus
  resolution Retry and fresh-entry integrity recovery.
- Privacy/scope inspection across `src/resolution/`, `src/rooms/`,
  `src/filters/` and `app/room/[code].tsx` found Feature 004 own-detail fields
  only in its existing isolated modules. Resolution transport/state contain no
  years, genres, clauses, roster/identity, candidate RPC, TMDB/fetch or channel;
  the room route imports no candidate module. Static negative assertions were
  added to the resolution contract suite.
- Two initial `npm run db:reset` invocations exited before database access
  because the CLI attempted a telemetry write to the read-only home directory.
  With the established `SUPABASE_TELEMETRY_DISABLED=1` wrapper, the independent
  latest reset passed through all eight migrations. These attempts created no
  GoTrue identities and did not modify schema or generated types.
- Check-only `npm run db:types:check`: PASS. Generated-type metadata before and
  after reset/check stayed exactly
  `7d9c800c...ed82d1 / 676005 / 12159 / 1789168582 / 1789168583`.
- `npm run db:test`: PASS, 4 files / 793 assertions. `npm run lint` and
  `npm run typecheck`: PASS. The first full client run found one stale static
  database-suite inventory; after adding the new resolution suite and all three
  nonempty fixture pairs, the required full rerun passed 35 suites / 686 tests.
- `npm run web:export`: PASS, four static routes. `npx expo export --platform
  ios --platform android --output-dir dist/native-validation`: PASS for both
  native bundles. Export artifacts are ignored build output.
- G2 is green on the working tree. R01 remains exactly `1/1`. No browser was
  started; R02 identities/attempts remain `0/0`.
- Focused G2 self-review covered the complete DB/types/client diff and protected
  hashes. It found one dead boolean term obscuring the exact non-voting-member
  integrity predicate; the predicate was simplified without changing the
  approved rule. The actual nonempty Feature 004→005 runner then passed again
  with 4/10/6/4 fixtures, 9 synthetic SQL users, zero GoTrue signups, stable
  xmin/types and clean latest reset; the focused resolver pgTAP rerun passed
  1 file / 74 assertions. Historical migration, generator and C1 hashes remain
  the T001 values.
