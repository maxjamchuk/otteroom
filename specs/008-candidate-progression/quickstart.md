# Quickstart: Validate Candidate Progression

**Feature**: 008 — Candidate Progression
**Status**: Complete — G5 PASS; T001–T069 complete. Feature 009 is unstarted.

This guide defines the validation procedure and records the completed Feature
008 implementation evidence. `tasks.md` contains the approved completed work.

## 1. Prerequisites

Use the repository-declared toolchain:

- Node.js 24.20.x;
- npm 11.19.0;
- Supabase CLI 2.116.0;
- Deno 2.5.2; and
- a supported Playwright Chromium runtime installed through the repository
  wrapper.

Start from the implementation commit being validated with a clean, reviewed
worktree. Do not place Supabase service keys, TMDB tokens, JWTs, browser storage
or credentials in source, logs, screenshots or evidence artifacts.

Baseline setup remains:

```sh
npm install
npm run env:local
npm run playwright:install
npm run supabase:start
```

`env:local` must use the local Supabase status contract and must not copy a
service-role key into Expo public configuration. Browser acceptance uses the
existing controlled TMDB stub. A live TMDB token is separately provisioned only
for the existing optional/live contract check.

Before any identity-charged browser block, follow the rolling R02 admission
procedure in `docs/testing-strategy.md`.

## 2. Protected Feature 007 to 008 Migration

The planned runner is:

```sh
node scripts/check-candidate-progression-migration.mjs
```

It must:

1. acquire its own bounded lock and reject extra arguments;
2. hash every historical migration through
   `20260916000000_swipe_decisions.sql` and the canonical generated types;
3. reset the local database to exact Feature 007 with no seed;
4. create owned, nonempty fixtures without GoTrue signups, including:
   - pending first-candidate room;
   - original Feature 006 `no_candidates` room;
   - assigned room with zero decisions;
   - assigned incomplete rooms;
   - complete exact-two agreed and rejected rooms;
   - complete larger-room threshold and below-threshold rooms;
   - voting and non-voting creators; and
   - preserved filters/private compatible resolutions;
5. apply the actual Feature 008 migration chain;
6. verify occurrence 1 materialization, same-room decision remapping, immutable
   values/timestamps, threshold-correct complete-set resolution, rejected-room
   advancing handoff, initial-empty distinction, exact grants/RLS/publication
   and only documented room-row changes;
7. prove every historical migration hash and pre-generation type hash is
   unchanged;
8. clean owned fixtures/backends on success, failure or interruption; and
9. finish with a clean latest reset containing the new functions/schema and no
   fixture/Auth rows.

Any integrity mismatch must fail the cutover. The runner must not repair a
count, delete a decision or call TMDB.

Then prove clean replay:

```sh
npm run db:reset
npm run db:test
```

## 3. Database Authority Evidence

The full pgTAP suite must cover the existing room/filter/source/decision
contracts plus the new progression suite.

### Threshold and timing

- For each `N = 2..10`, prove exactly `T-1` yes is rejected and `T` yes is
  agreed using thresholds `2,2,3,4,4,5,6,6,7`.
- Prove the arithmetic uses integer operations and accepts no configurable
  threshold input.
- At `N=4`, prove three early yes decisions remain collecting.
- At `N=4`, prove two early no decisions remain collecting.
- Prove arrival order and final-voter identity do not change the result.

### Resolution transaction

- Prove one final accepted decision atomically inserts the row and produces the
  correct occurrence/room outcome.
- Prove rollback after any injected failure leaves decision, occurrence and
  room unchanged.
- Prove same-value duplicate and opposite conflict retain Feature 007's exact
  one-row/no-write semantics.
- Use deterministic dblink locks/`pg_blocking_pids` to overlap the last distinct
  voters. Prove both decisions survive and only one outcome transition occurs.
- Prove agreed state retains the candidate/count and rejects every later
  decision/source commit.
- Prove rejected state retains historical `N` rows, clears the active room
  identity and exposes current count 0 while advancing.

### Progression CAS

- Race two different candidate proposals against one rejected sequence; assert
  one occurrence at `k+1`, one room candidate and loser adoption/no write.
- Race proposal versus completed-empty commit; assert exactly assigned or
  exhausted, never both.
- Replay both commits after response loss; assert stable winner/terminal and
  unchanged row counts/xmin on no-write branches.
- Send old/lower expected sequences after one or more transitions; assert no
  write and canonical stale result.
- Prove a commit can increment only to `expected+1` and the no-repeat unique key
  rejects a prior room TMDB ID.
- Prove two rooms may independently use the same TMDB ID.

### Integrity, privacy and ACL

- Prove cross-room member/occurrence decision linkage is rejected.
- Corrupt detail/summary/member/occurrence facts inside rolled-back fixtures and
  prove every protected operation fails closed.
- Verify exact function owner/search path/execute grants.
- Verify direct ordinary-client room writes, occurrence reads/writes, decision
  reads/writes and service-only candidate RPC calls are denied.
- Verify unauthorized/foreign decision RPCs return masked all-null `not_found`
  and do not enter the target room lock queue.
- Verify source prepare and both commit RPCs all authorize through an unlocked
  actor/room lookup, do not place a foreign caller in the target room lock queue,
  then lock only an authorized room and revalidate authorization plus handoff
  facts under that lock.
- Verify only `public.rooms` is published to Realtime.

## 4. Edge and Candidate-Source Evidence

Run:

```sh
npm run test:edge
```

Required Deno proof:

- the public request remains exact `{room_id}` and authentication behavior is
  unchanged;
- preflight exact parsing includes sequence and server-private exclusions;
- excluded eligible movies are skipped until a distinct eligible result;
- duplicate provider results plus exclusions cannot re-present a room movie;
- all Feature 006 eligibility, locale, adult, metadata, pagination, shard,
  retry/deadline/request-budget and malformed-response cases remain green;
- only complete error-free traversal returns `completed_empty`;
- incomplete search returns 503 and invokes no commit;
- concurrent/late commit results return the database winner/terminal or
  `refresh_required`, never the losing proposal;
- delayed winning responses update only generation-matched metadata and force a
  canonical room refetch; they never install room progression/count or assume
  fresh `0/N`;
- assigned metadata failure returns `metadata_unavailable` with the committed
  sequence and retry loads the same identity; and
- agreement causes no Discover/commit call.

The live provider contract, when a separately provisioned token and upstream
availability are part of release validation, remains:

```sh
npm run test:tmdb:contract
```

It is not the concurrency/no-repeat oracle and consumes no browser identity.

## 5. Generated Types: Single Write Point

Do not generate types while SQL/RPC signatures are still changing. After the
migration, database tests and Edge-facing RPC contracts are final and green:

```sh
npm run db:reset
npm run db:test
npm run db:types
npm run db:types:check
```

This is the one intentional write to
`src/types/database.generated.ts`. Review the new enums, occurrence/decision
columns, room projection and exact RPC signatures.

Every later gate is check-only:

```sh
sha256sum src/types/database.generated.ts
stat -c '%i %s %Y %Z' src/types/database.generated.ts
npm run db:reset
npm run db:types:check
sha256sum src/types/database.generated.ts
stat -c '%i %s %Y %Z' src/types/database.generated.ts
```

Require byte-identical hash and unchanged canonical file metadata across the
check. Migration/test scripts must never write the generated artifact.

## 6. Client and Build Gates

Run focused suites, then full gates:

```sh
npm run test:client -- __tests__/rooms __tests__/candidates __tests__/decisions __tests__/progression __tests__/routes/room.test.tsx
npm run lint
npm run typecheck
npm run test:client
npm run test:edge
npm run db:test
npm run db:types:check
npm run web:export
npx expo export --platform ios --platform android --output-dir dist/native-validation
git diff --check
```

Required client proof:

- exact room, decision and Edge response parsers reject missing/extra/contradictory
  fields;
- the complete room-projection lattice adopts every reachable forward node,
  including higher-sequence collecting/agreed/advancing/exhausted, multi-sequence
  jumps and same-sequence collecting→exhausted when advancing was missed;
- an incoming projection that can reach current authority is ignored as proven
  stale, while unreachable/incomparable branches fail closed; count is monotonic
  only within one collecting occurrence and successor count is replaced exactly;
- candidate and decision state use room/sequence/identity generations and
  discard late success, failure, pending and image callbacks;
- a delayed candidate winner after the successor has decisions retains the
  canonical nonzero count, and a winner arriving after that successor has
  advanced again cannot restore its card, phase, controls or assumed `0/N`;
- no resolution/source request occurs before full completion, including
  inevitable/impossible cases;
- final decision result immediately converges local room state without relying
  on Realtime, while refetch remains canonical;
- response loss, `candidate_changed`, `refresh_required`, subscription failure,
  reload and re-entry recover safely;
- agreed retains the card, removes controls and shows neutral stopped text;
- advancing failure offers Retry; exhaustion offers no acquisition Retry and
  does offer new-room/session navigation;
- non-voting creator sees safe outcome and no controls; and
- route/component tests find zero Match navigation, celebration, confirmation,
  mode controls, decision edits or early outcome UI.

## 7. Safe Browser Acceptance

Implementation adds the override-free command:

```sh
npm run test:e2e:feature008
```

The profile selects exactly two executable cases:

| Case | Identity cap | Real-stack evidence |
| --- | ---: | --- |
| L01 (includes L03 subflows) | 2 | Incomplete exact-two wait; yes/yes agreed stop; reload/reconnect and no Match; bounded later rooms for concurrent yes/no rejection, duplicate/lost/replayed final response, stale tab, one distinct successor at `0/2`, transient source failure, same-step retry success and stable completed-empty exhaustion. |
| L02 | 4 | Non-voting creator plus three voters; no creator vote; two early yes remains collecting; `2 yes + 1 no` agreed; bounded non-agreeing room progresses once; concurrent final decisions; all four converge within 5 seconds; fresh `0/3`; stale recovery and ordinary-JWT cross-room denial. The same four case-owned identities are reused in bounded all-four-voters rooms to prove `N=4`, `T=3`, continued collecting after three early yes or two early no decisions, agreement at three yes, and non-agreement/progression at two yes. |
| Owner total `F` | **6** | Exactly 2 + 4; L03 does not create a third case/context. |

Run the normal browser block only after a valid R02 admission calculation:

```sh
npm run test:e2e:security
npm run test:e2e:feature008
npm run test:e2e:smoke
```

Permanent smoke remains exactly G03/G04/G05/G08/H01 at 16 identities. G04 must
assert the resolved three-voter policy instead of Feature 007's now-obsolete
null outcome; G08 must retain ordinary-JWT progression/occurrence denial.

Each owner case records:

- exact source SHA/profile/case;
- configured and actual signup/identity counts;
- cleanup and Auth success;
- zero scanner findings;
- authoritative old/new candidate equality/difference only through bounded safe
  harness evidence, never displayed internal IDs;
- all already-open clients' convergence within 5 seconds; and
- zero Feature 009 UI or route behavior.

Workers remain 1, retries 0 and repeatEach 1. Capture-off, safe reporter,
credential registry, controlled provider and owned cleanup remain mandatory.

## 8. Identity Budgets and Repeatability

| Gate | Formula | Identities |
| --- | --- | ---: |
| Normal checkpoint and repeatability run one | C1 `1` + smoke `16` + owner `6` + targeted `0` | **23** |
| Additional repeatability run after normal | smoke `16` + owner `6` | **22** |
| Cumulative normal plus repeatability | `23 + 22 = 1 + 2 × (16 + 6)` | **45** |
| Fresh checkout | C1 `1` + smoke `16` | **17** |
| Cumulative repeatability plus fresh | `45 + 17` | **62** |
| Current pre-Feature-008 full checkpoint | C1 `1` + current full acceptance `106` | **107** |
| Projected post-Feature-008 full checkpoint | C1 `1` + projected full acceptance `112` | **113** |

No extra historical browser case is selected. L01/L02 absorb the changed K/J
boundaries, G04/G08 are already in smoke, and lower-layer tests own deterministic
locks, arithmetic, migration and ACL matrices.

Every failed, partial, targeted and manual identity attempt counts in the
rolling window. HTTP 429 fails the gate. Do not probe capacity, retry Auth,
raise the limit, export sessions, restart services or reset the database to
evade quota.

The normal 23-identity checkpoint is repeatability run one: it runs C1 once and
the first unchanged-source Feature 008 owner-plus-smoke execution. Repeatability
completion charges only the second fresh-context owner-plus-smoke execution
(`6 + 16 = 22`) at the unchanged source/stack; C1 is not rerun.
Fresh checkout independently proves install, local env, clean migration/reset,
check-only types, static/client/DB/Edge/build/export gates, C1 and permanent
smoke at the exact implementation SHA.

## 9. Release Evidence Checklist

A Feature 008 implementation is not complete until evidence records:

- historical migration hashes and nonempty Feature 007→008 cutover PASS;
- clean latest reset and full pgTAP PASS;
- one reviewed generated-type write followed by check-only consistency;
- full Edge/client/lint/typecheck/web/native/export PASS;
- threshold boundaries `N=2..10` and no-early cases PASS;
- deterministic final-decision and source-commit concurrency PASS;
- L01/L02 exactly six owner identities PASS;
- permanent smoke exactly 16 identities PASS;
- security C1 exactly one identity reaches its expected controlled failure;
- scanner findings zero and cleanup complete;
- repeatability/fresh-checkout budgets admitted and PASS; and
- no Match UX, alternate source, dynamic membership, threshold mode, decision
  edit or early resolution observed.

The deterministic items are now evidenced below. Charged L01/L02, permanent
smoke, repeatability, and fresh-checkout execution remain pending by design.

## 10. Implementation Evidence Ledger

### T001 — Protected baseline (2026-09-19, Asia/Almaty)

- Branch/HEAD: `main` at
  `bd3233f3916f1280bf9d4bf1e7e2fef51752c182`.
- Pre-implementation worktree: owner-approved planning edits in
  `docs/testing-strategy.md` and the untracked
  `specs/008-candidate-progression/` artifact directory only. No runtime,
  migration, generated-type, dependency, or browser-artifact change existed.
- Declared toolchain: Node `24.20.x`, npm `11.19.0`, Supabase CLI `2.116.0`,
  Deno `2.5.2`.
- Actual implementation host: Node `v24.12.0`, npm `11.6.2`, Supabase CLI
  `2.116.0` (queried with telemetry disabled because the managed home is
  read-only), Deno `2.5.2` / V8 `14.0.365.5-rusty` / TypeScript `5.9.2`.
  The declared Node/npm versions are not installed on this host; commands and
  results below record the actual toolchain rather than claiming otherwise.
- Browser inventory at baseline: 44 executable cases / 106 identities; C1 adds
  one identity, so the current full checkpoint is `1 + 106 = 107`. Feature 008
  plans exactly L01=2 and L02=4, producing 46 cases / 112 identities and the
  projected full checkpoint `1 + 112 = 113`.
- Planned charged blocks remain: normal/run-one `23`, one additional
  repeatability execution `22`, cumulative normal-plus-repeatability `45`, and
  fresh checkout `17`.
- Canonical generated types baseline: SHA-256
  `6aecffdf46565a5b393affce0f627f9712e2082b66a3fada23c33d1cc9271a7c`,
  inode `11577515`, size `15953`, mtime `1789560267`, ctime `1789560268`.

Historical migration SHA-256 ledger through Feature 007:

| Migration | SHA-256 |
| --- | --- |
| `20260905000000_rooms_schema.sql` | `d6222184274428c6dd5d629e4d3416a582e0a74f355c8c6fe1d389630ecad439` |
| `20260905000001_room_rpcs.sql` | `fda4126812feffb7bac5d737d6faae1930db35bbc26a1cb9402fcbad24b5b45c` |
| `20260905000002_rooms_realtime.sql` | `71816083a6e1630ab663fa4fd41354b936efa714571809fffca4528f2312f7a9` |
| `20260909000000_movie_candidates_schema.sql` | `04487a75fadafe40a255f9ab3998b64c1109c9de6f4e4324ba441f8856531c38` |
| `20260909000001_room_candidate_rpc.sql` | `1b78eeb52ce9bb194b9530f48b49428b8f5bb7c523ab22d5406e9814d0e8dc52` |
| `20260910000000_generalized_room_membership.sql` | `9813e830957f82febe184e54a5148faff159f046912b325b0a77d835ae33a71f` |
| `20260911000000_participant_filters.sql` | `432c6d41ca37d0ea2b3ad00324854c3ec17338f3b6c21a4c4cfe3946c1c54ff0` |
| `20260912000000_common_filter_resolution.sql` | `10986dc43cad50668e520f16b2c3dbbd44e4cebb1384afb0cb2cfd5798898f1d` |
| `20260914000000_tmdb_candidate_source.sql` | `52ab29707d8d6bdf04d888d4578fab92c92c805c3151ede710dc3992c5ac2640` |
| `20260916000000_swipe_decisions.sql` | `42a9b0d8e33b308e712a12204875d35ca3112adfd2372a117af5e78b69b4264f` |

Gate ledger initialized:

| Gate | Scope | Status |
| --- | --- | --- |
| G1 | migration/RPC/types/safe room projection | PASS — T002–T017 |
| US1 | complete-set resolution | PASS — T018–T025 |
| US2 | one distinct successor/fresh decisions | PASS — T026–T034 |
| G2 / US3 | concurrency, replay, stale-result exactly-once behavior | PASS — T035–T043 |
| G3 / US4 | canonical recovery and convergence | PASS — T044–T050 |
| G4 / US5 | retryable failure and stable terminals | PASS — T051–T057 |
| G5 | charged acceptance, repeatability, fresh checkout, final audit | PASS — T058–T069 |

At this baseline Feature 008 runtime work, Feature 009, the new migration, the
single generated-types write, dependency changes, and every charged browser/R02
execution had not started.

### T002–T017 — G1 database cutover, migration fixtures and generated types

- Added the single migration
  `supabase/migrations/20260918000000_candidate_progression.sql`, the occurrence
  ledger, closed occurrence/progression enums, room sequence/progression
  constraints, same-room occurrence-bound decisions, bigint-safe threshold
  helper, exact nine-field decision RPCs, exact source prepare/commit CAS, and
  safe fourteen-field create/join plus eleven-field member refetch projections.
- `supabase/tests/database/candidate_progression.test.sql` and evolved room,
  source and decision suites cover exact `N=2..10` thresholds, incomplete sets,
  transaction rollback, deterministic dblink races, replay, stale/late commits,
  proposal/empty exclusivity, integrity, ACL/RLS, masking and lock-queue
  prechecks. The final suite is 7 files / 909 assertions.
- The six nonempty migration runners all returned `result=PASS`, restored the
  latest schema and reported `owned-fixtures=0`. Their fixture inventories used
  zero GoTrue signups. The Feature 008 runner preserved 8 legacy rooms and 11
  decisions, materialized 6 occurrences, classified collecting/agreed/advancing
  rooms, and preserved the original initial-empty state.
- Every historical migration hash in the T001 table remains byte-identical;
  `git diff --name-only -- supabase/migrations` reports no tracked historical
  migration edit. The only new migration is the Feature 008 file.
- The sole `npm run db:types` write occurred at T013. The resulting canonical
  artifact is SHA-256
  `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`,
  inode `11577791`, size `20142`, mtime `1789775458`, ctime `1789775459`.
  Independent latest-reset verification and every later gate used only
  `npm run db:types:check`; the hash and metadata remain unchanged and the final
  result is `consistent`.

### T018–T057 — US1–US5 implementation and independent evidence

- US1: PostgreSQL resolves only an exact complete fixed-voter decision set,
  applies thresholds `2,2,3,4,4,5,6,6,7`, retains an agreed candidate, or
  atomically retires rejection into `advancing`. Client results contain the
  caller value and safe threshold/count/outcome only; no yes tally or peer
  answers are exposed.
- US2: the existing `room-candidate` Edge Function performs source work outside
  the room transaction, consumes only server-derived ordered exclusions, and
  commits exactly one distinct database-confirmed successor at `k+1` with a
  fresh occurrence and `0/N`. A competing winner is adopted; Edge data never
  writes client room/count authority.
- US3: final-voter and source commit races, response loss, duplicate/conflict,
  stale expected sequences, late metadata/poster/decision results, and
  proposal-versus-empty converge to one outcome/step without a request ledger.
  Generation-aware client reducers suppress retired callbacks and canonical
  room refetch preserves a successor's real count.
- US4: the room state implements the complete progression reachability lattice,
  adopts forward and multi-sequence observations, ignores only proven stale
  reverse-reachable nodes, fails closed on malformed/incomparable nodes, and
  replaces rather than maximizes counts across occurrences. Reload, reconnect,
  missed invalidation and re-entry recover from the one rooms-only Realtime
  channel and member-scoped canonical read.
- US5: provider/transport/deadline/incomplete traversal writes nothing and keeps
  `advancing` retryable; only completed empty evidence commits stable
  `exhausted`. Agreement is a neutral stopped terminal, exhaustion has no source
  Retry, and neither path introduces Match UI or Feature 009 behavior.
- Final deterministic application results: Edge `42 passed / 0 failed / 1`
  optional live-provider test ignored; client/config/static/security `48 test
  suites / 815 tests passed`; lint zero warnings/errors; TypeScript compile PASS.

### T058–T064 — Non-charged acceptance authoring and safety

- Added `e2e/support/progression-harness.ts` with bounded final-decision holds,
  committed candidate-response discard, five-second convergence checks,
  in-memory-only candidate equality/difference assertions and exact 2/4 identity
  receipts. Candidate, decision, room and provider harnesses now understand
  sequences, occurrence-bound RPCs, safe progression projections and a stable
  exclusion-aware second candidate.
- Added exactly two discoverable cases in
  `e2e/candidate-progression.spec.ts`: L01 cap 2 (including L03 source-failure
  and exhaustion subflows) and L02 cap 4 (including non-voting creator,
  three-voter and reused-identity four-voter threshold subflows).
- The override-free `npm run test:e2e:feature008` profile selects only L01/L02,
  enforces two exact receipts and total `F=6`, retains workers 1 / retries 0 /
  repeatEach 1 and capture off, and projects the full inventory as 46 cases / 112
  identities. Static profile, discovery, accounting and diagnostics tests pass.
- Permanent smoke remains G03/G04/G05/G08/H01 at 16 identities. G04 now checks
  authoritative three-voter agreement; G08 denies direct occurrence,
  progression, decision and source authority. Historical K assertions were
  evolved for occurrence-aware RPCs and post-`N/N` progression without adding
  K01/K02 to the Feature 008 gate.
- The finalized scanner rejects occurrence IDs/history, private exclusions,
  internal TMDB/room/member identifiers, raw progression/decision/RPC payloads,
  credentials and capture artifacts. Static negative scanner coverage passed.
  A retained capture-off run directory (`test-results/run-bbajCj`) scanned 3
  files with zero findings. A repository-wide scan of old retained browser
  history was not used as the gate because invocation-scoped screenshot hashes
  require their original credential registry; it predictably reports old
  unregistered C1 PNGs and one historical bundle. No historical artifacts were
  deleted or rewritten.

### T065 — Final deterministic non-browser gate (2026-09-19)

Commands and results at the final source state:

```text
node scripts/check-room-membership-migration.mjs                 PASS
node scripts/check-participant-filters-migration.mjs             PASS
node scripts/check-common-filter-resolution-migration.mjs        PASS
node scripts/check-tmdb-candidate-migration.mjs                  PASS
node scripts/check-swipe-decisions-migration.mjs                 PASS
node scripts/check-candidate-progression-migration.mjs           PASS
XDG_CONFIG_HOME=/tmp/otteroom-supabase-config npm run db:reset   PASS
XDG_CONFIG_HOME=/tmp/otteroom-supabase-config npm run db:test    PASS (7 files, 909 tests)
npm run test:edge                                                PASS (42 passed, 1 ignored)
npm run test:client -- --runInBand                               PASS (48 suites, 815 tests)
npm run lint                                                     PASS (zero warnings/errors)
npm run typecheck                                                PASS
XDG_CONFIG_HOME=/tmp/otteroom-supabase-config npm run db:types:check  consistent
npm run web:export                                               PASS (5 static routes)
npx expo export --platform ios --platform android --output-dir dist/native-validation  PASS
node scripts/check-e2e-artifacts.mjs test-results/run-bbajCj     PASS (3 files, zero findings)
git diff --check                                                 PASS
```

The first direct `npm run db:reset` and two direct generated-type check attempts
could not write Supabase CLI telemetry under the managed read-only home. They
changed no schema source or generated artifact. Re-running with the established
writable temporary CLI config and telemetry disabled passed. No charged browser
command, Playwright discovery/execution, Anonymous Auth signup, R02 admission,
or Feature 009 work occurred.

T001–T065 are complete. Stop here. The exact next task is T066: obtain a fresh
R02 admission reserving 23 identities immediately before the normal charged
block, then and only then run C1 once, Feature 008 L01/L02, and permanent smoke.

### T066 — normal charged checkpoint stopped on owner-acceptance failure (2026-09-19)

- The charged block used the declared toolchain from an owned temporary path:
  Node `24.20.0`, npm `11.19.0`, Supabase CLI `2.116.0`, repository Deno
  `2.5.2`, and Playwright Chromium through the safe Docker runtime. The base
  repository HEAD was `bd3233f3916f1280bf9d4bf1e7e2fef51752c182`; the
  Feature 008 working-tree source was unchanged from the T065 deterministic
  gate before browser execution.
- The fresh authoritative R02 calculation immediately before C1 was made at
  `2026-09-19T13:17:23+05:00`, with cutoff `12:17:23+05:00`. It found no
  finalized identity-bearing receipt and no unfinished browser run in the
  rolling hour: usage `0 / 150`, capacity `150`. The complete exact block
  `C1 1 + owner 6 + smoke 16 = 23` was admitted with 127 identities of
  headroom; no signup probe or quota-changing action was used.
- C1 ran exactly once as `test-results/run-Y1hO4Z` and passed the controller
  contract. Static A/B passed; controlled C failed as designed after exactly
  `1 signup / 1 successful identity`; Auth accounting, verified capture,
  artifact completeness and owned cleanup passed; finalized scanner findings
  were `[]`; and the owned Playwright runtime was removed.
- `npm run test:e2e:feature008` then ran exactly once as
  `test-results/run-cGphSV` and failed. L01 consumed exactly `2 signups / 2
  successful identities` and failed on its first incomplete-decision
  collecting convergence assertion at
  `e2e/support/progression-harness.ts:43:36`; only the first decision RPC was
  dispatched, so the required all-open-client five-second convergence was not
  established. L02 consumed exactly `4 signups / 4 successful identities` and
  failed during its pre-admission ordinary-JWT foreign-decision probe at
  `e2e/candidate-progression.spec.ts:58:26`; the safe evaluator stopped before
  a foreign `get_room_candidate_decision` request reached the gateway, which
  localizes this blocker to browser-side session-token retrieval/preflight and
  leaves the required cross-room denial unproven. Both receipts report
  `cleanup=true`, `authSuccess=true`, `budgetFailure=false`, one worker, one
  repetition, capture `none`, and exact L01/L02 identity accounting. The
  controller finalized five safe artifacts with scanner findings `[]` and
  removed its owned Playwright runtime.
- Per the fail-stop contract, permanent smoke was not started, neither owner
  case was retried, and no replacement/targeted charged run was dispatched.
  The already-dispatched fixed owner profile nevertheless continued from the
  failed L01 case into L02 before returning control; the current wrapper did
  not enforce case-level fail-fast. That is an additional checkpoint blocker,
  and execution stopped as soon as the wrapper returned its failed result.
  Actual T066 consumption is therefore exactly `1 + 2 + 4 = 7` signup attempts
  and 7 successful identities; smoke consumption is zero. No HTTP 429 occurred.
- A post-stop R02 calculation at `2026-09-19T13:20:02+05:00`, cutoff
  `12:20:02+05:00`, counted `run-Y1hO4Z = 1` and `run-cGphSV = 6`: rolling
  usage `7 / 150`, capacity `143`, with no unfinished run. The controlled
  provider environment was absent, no Playwright/runtime/provider process or
  container remained, and the safe evidence was preserved in those run
  directories.
- T066 remains incomplete. T067–T069 and Feature 009 were not started. The
  exact next task remains T066 after diagnosing and correcting the two owner-
  acceptance blockers; any future charged execution requires a new admission
  calculation and must not retry this failed block ad hoc.

### T066 — fail-fast recovery attempt stopped on newly exposed L01 failure (2026-09-19)

- The first L01 failure was a harness/assertion defect, not evidence of a
  product or Realtime convergence failure. Both the progression status and the
  decision surface legitimately rendered the same collecting sentence, while
  `assertProgressionConverged` used an unscoped text locator. Playwright strict
  matching therefore failed on the duplicate elements after the accepted
  decision RPC. The helper now targets the unique
  `candidate-progression-status` test ID and requires exact completed/required
  counts within the unchanged five-second bound.
- L02 was a browser/session/auth harness defect before gateway entry. Its
  browser evaluator obtained the local session path but referenced the
  Node-side `controlledCandidate` import inside `page.evaluate`; that closure
  is not serialized into the browser. The resulting reference failure occurred
  while constructing the request body, before `fetch` could dispatch the
  ordinary-JWT RPC. The evaluator now receives the expected TMDB movie value
  explicitly in its serialized argument.
- The owner wrapper's continuation was a test-runner/fail-fast defect. The
  Feature 008 invocation had workers 1, retries 0 and repeatEach 1 but no
  maximum-failure setting, so Playwright scheduled L02 after L01 failed. The
  safe runner now adds `--max-failures 1` only for the override-free Feature 008
  profile. Static regression coverage proves the exact argument vector and
  proves smoke is unchanged.
- The smallest source changes were limited to
  `e2e/support/progression-harness.ts`,
  `e2e/candidate-progression.spec.ts`, `scripts/run-e2e.mjs`, and
  `__tests__/config/feature008-e2e-profile.test.ts`. No acceptance criterion,
  identity cap, convergence bound, sleep, retry or quota probe changed.
- Final non-charged validation passed: focused Feature 008/config diagnostics
  `2 suites / 41 tests`; full client `48 suites / 816 tests`; lint with zero
  errors; typecheck; all six protected migration runners; check-only database
  types; and `git diff --check`. The canonical generated type artifact remained
  SHA-256
  `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  with inode/size/mtime/ctime
  `11577791 / 20142 / 1789775458 / 1789775459`.
- Because browser harness and safe-runner source changed, the earlier partial
  seven-identity attempt cannot count as repeatability run one. The narrowest
  contract-valid replay was the complete T066 block, not failed cases alone or
  the unexecuted suffix: T066 defines run one as C1 once plus one unchanged-
  source owner-and-smoke execution. The profile-scoped fail-fast branch is
  statically proven inert for smoke and is not a cross-cutting full-acceptance
  change. The required replay therefore remained exactly
  `C1 1 + owner 6 + smoke 16 = 23`.
- The authoritative admission immediately before execution at
  `2026-09-19T13:47:47+05:00`, cutoff `12:47:47+05:00`, counted the preserved
  receipts `run-Y1hO4Z = 1` and `run-cGphSV = 6`, no unfinished run, rolling
  usage `7 / 150` and capacity `143`. The complete 23-identity block was
  admitted with 120 identities of post-reservation headroom. No browser command
  ran before this admission and no signup probe was used.
- C1 ran exactly once as `test-results/run-mmF7PG` and passed after exactly one
  signup/identity. Its controlled failure, Auth accounting, verified capture,
  artifact completeness, owned cleanup and finalized scanner findings `[]`
  all satisfied the controller contract; its owned runtime was removed.
- The fixed owner wrapper then ran exactly once as
  `test-results/run-oHTvqU`. L01 passed the repaired first collecting
  convergence assertion but later failed at
  `e2e/support/decision-harness.ts:250:96`, where the shared keyboard helper
  requires a transient `You chose Yes/No` acknowledgement after every accepted
  submission even when the final vote can transition directly to terminal
  progression. The receipt records exactly `2 signups / 2 identities`,
  `cleanup=true`, `authSuccess=true`, `budgetFailure=false`, capture off and
  finalized scanner findings `[]`. This newly exposed harness assertion remains
  unresolved.
- The Feature 008 max-failure setting stopped the owner profile after L01. L02
  consumed zero recovery identities, permanent smoke was not started, and no
  case, suite or charged block was retried. Recovery consumption is exactly
  `1 + 2 = 3`; cumulative T066 consumption is exactly
  `7 + 3 = 10` signup attempts and 10 successful identities.
- The post-stop R02 calculation at `2026-09-19T13:49:36+05:00`, cutoff
  `12:49:36+05:00`, counted the four finalized receipts as
  `1 + 6 + 1 + 2 = 10 / 150`, leaving capacity 140 and no unfinished run. No
  HTTP 429, scanner finding, owned-case cleanup failure or charged Auth
  accounting failure occurred. The owned browser runtime was removed,
  `supabase/functions/.env` remained absent, and no browser/E2E process or
  container remained.
- T066 remains incomplete. T067–T069 and Feature 009 remain unstarted. The
  exact next task is still T066: diagnose and correct the newly exposed
  terminal-decision harness assertion, rerun all applicable non-charged gates,
  derive the next contract-valid replay, and obtain a new R02 admission before
  any further charged execution.

### T066 — terminal-decision recovery stopped on exhaustion commit defect (2026-09-19)

- The shared keyboard helper had treated the transient own-decision
  acknowledgement as the only proof of a successful action. That is valid for
  an accepted non-final decision that remains collecting, but a final accepted
  decision may atomically move the authoritative result to agreed or
  rejected/advancing and retire that acknowledgement. The helper now couples
  the locator-scoped Enter press to the exact submit RPC response, requires one
  request with the exact decision body, strictly parses an `accepted` result
  with the requested immutable own value, and then requires either the normal
  acknowledgement or an exact legal progression view within five seconds. It
  adds no sleep, retry, timeout increase or alternate decision path.
- Deterministic coverage in the Feature 007/008 profile tests proves that a
  collecting result still requires `You chose Yes/No`; agreed may supersede it
  with the exact neutral terminal; and rejected/advancing may supersede it only
  with advancing, exhaustion or the exact fresh `0/N` successor view. It also
  rejects unchanged results, a mismatched own value, an unchanged pre-submit
  progression view and non-locator keyboard delivery. Final focused validation
  passed `3 suites / 50 tests`; the full client/config run passed
  `48 suites / 817 tests`. Lint, typecheck, all six protected migration checks,
  check-only database types and `git diff --check` passed. The canonical types
  remained SHA-256
  `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  with metadata `11577791 / 20142 / 1789775458 / 1789775459`.
- The protected migration precondition initially found the prior browser
  fixtures (`3` local Auth users and `2` rooms). A clean suite-level latest
  reset established the required empty database before the validators; per the
  testing contract, it was not treated as Auth-quota recovery and every prior
  identity remained counted. Each migration runner then finished with zero
  GoTrue signups, `latest-reset=true`, `owned-fixtures=0`, and `result=PASS`.
- Because decision-harness source changed, the earlier partial attempts could
  not count as repeatability run one. T066 still requires one complete
  unchanged-source execution of C1 plus owner plus smoke, so the narrowest
  contract-valid replay remained exactly `1 + 6 + 16 = 23`, not L01 alone or
  the prior unexecuted suffix.
- The fresh authoritative admission at
  `2026-09-19T14:26:37+05:00`, cutoff `13:26:37+05:00`, counted
  `run-mmF7PG = 1` and `run-oHTvqU = 2`; the first seven-identity attempt had
  aged out. Rolling usage was `3 / 150`, capacity `147`, with no unfinished
  run. The complete 23-identity block was admitted with 124 identities of
  post-reservation headroom, without a signup probe.
- C1 ran once as `test-results/run-gJSPkC` and passed after exactly one
  signup/identity, with its expected controlled failure, successful Auth
  accounting, complete verified artifacts, owned cleanup, scanner findings
  `[]` and runtime removal.
- The owner profile ran once as `test-results/run-thsu91`. L01 passed the
  repaired ordinary and terminal keyboard paths and progressed through its
  agreement, rejection/successor and transient-failure/retry subflows. Its
  final completed-empty subflow failed at the exact five-second exhaustion
  convergence assertion in `e2e/support/progression-harness.ts:46:62`.
- The new blocker is a product/application database defect, not a convergence
  or harness false negative. Both empty-search Edge requests reached
  `public.commit_room_tmdb_no_candidates` and PostgreSQL rejected line 31 of
  that function with `column reference "candidate_sequence" is ambiguous`.
  In `20260918000000_candidate_progression.sql:442`, the unqualified
  `candidate_sequence` in the `UPDATE` expression conflicts with the function's
  output parameter of the same name. Both Edge calls consequently returned
  HTTP 503, the canonical room correctly remained `advancing`, and the
  exhaustion assertion correctly refused to pass.
- Fail-fast stopped the owner profile after L01. L02 and permanent smoke were
  not dispatched and no charged retry occurred. The attempt consumed exactly
  `C1 1 + L01 2 = 3` identities; cumulative T066 consumption is now exactly
  `10 + 3 = 13` signup attempts and successful identities.
- The post-stop R02 calculation at `2026-09-19T14:29:48+05:00`, cutoff
  `13:29:48+05:00`, counted `run-mmF7PG = 1`, `run-oHTvqU = 2`,
  `run-gJSPkC = 1` and `run-thsu91 = 2`: usage `6 / 150`, capacity `144`, and
  no unfinished run. No HTTP 429, scanner finding, owned-context/runtime
  cleanup failure or Auth accounting failure occurred. The provider environment
  was removed and no browser/E2E process or Playwright container remained.
- T066 remains incomplete. T067–T069 and Feature 009 remain unstarted. The
  exact next task remains T066: correct the exhaustion-commit column ambiguity,
  add deterministic database coverage for the real completed-empty branch,
  rerun the required non-charged gates, derive the contract-valid replay and
  obtain a new R02 admission before any charged execution.

### T066 — exhaustion-commit recovery stopped on terminal-copy harness defect (2026-09-19)

- The completed-empty database failure was an exact PL/pgSQL name collision.
  `commit_room_tmdb_no_candidates` returns an output parameter named
  `candidate_sequence`, while its terminal `UPDATE` also referenced the rooms
  column as unqualified `candidate_sequence`. PostgreSQL therefore could not
  resolve the expression on the real branch. The Feature 008 migration now
  aliases `public.rooms` as `room` and explicitly uses
  `room.candidate_sequence`, `room.id` and `returning room.*`; no gate, state,
  authorization, CAS, sequence or winner-adoption behavior changed. No
  historical migration was modified and generated types were not regenerated.
- A new direct database regression first reproduced the production ambiguity,
  then passed 22 assertions after the fix. It executes a rejected
  `advancing(1)` room through `commit_room_tmdb_no_candidates`, proves exact
  sequence-1 exhaustion with one preserved rejected occurrence, same-step
  idempotent zero-write replay by stable row `ctid`, and zero-write
  `refresh_required` for stale and wrong sequences. The Edge incomplete-search
  regression now starts from `advancing(1)` and proves HTTP 503 after preflight
  with no empty-commit RPC.
- Final non-charged validation passed: focused database `1 file / 22 tests`;
  focused room-candidate Edge `16/16`; full pgTAP `7 files / 910 tests`; full
  Edge `42 passed / 1 optional live test ignored`; full client/config
  `48 suites / 817 tests`; lint; typecheck; all six protected migration
  validators with latest cleanup and historical-hash/type immutability; and
  `git diff --check`. Check-only database types reported `consistent`; canonical
  SHA-256 and metadata remained
  `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  and `11577791 / 20142 / 1789775458 / 1789775459`.
- Because implementation source changed, no earlier partial attempt can be the
  one complete unchanged-source normal/repeatability run one. The bounded
  empty-commit repair does not trigger full 112-identity historical acceptance;
  its database/Edge boundaries are deterministic and Feature 008 owner plus
  permanent smoke remain the applicable browser boundary. The narrowest valid
  replay was therefore the complete T066 block, exactly
  `C1 1 + owner 6 + smoke 16 = 23`.
- The fresh authoritative admission at
  `2026-09-19T14:44:36+05:00`, cutoff `13:44:36+05:00`, counted
  `run-mmF7PG = 1`, `run-oHTvqU = 2`, `run-gJSPkC = 1` and
  `run-thsu91 = 2`: usage `6 / 150`, capacity `144`, no unfinished run. The
  complete 23-identity block was admitted with 121 identities of
  post-reservation headroom and no signup probe.
- C1 ran once as `test-results/run-yfZNm8` and passed after exactly one
  identity: expected controlled failure, Auth accounting and context cleanup
  confirmed, controller scanner findings `[]`, complete approved artifacts and
  runtime removal.
- The owner profile ran once as `test-results/run-yLTfKu`. L01 used exactly two
  identities and passed the complete decision/source flow through the bounded
  authoritative convergence to `exhausted`. It then failed in
  `e2e/support/candidate-harness.ts:268` because the shared `noCandidates()`
  helper requires Feature 006's initial-empty copy, `No eligible movie was
  observed during the completed search.`, even for a Feature 008 exhaustion
  whose contractual copy is `No further eligible movies were found for this
  selection.` The application and preceding progression assertion both used
  the latter legal text. This is a harness/assertion defect, not a product,
  database or convergence failure.
- Fail-fast stopped after L01. L02 and permanent smoke were not dispatched and
  no retry occurred. This recovery consumed exactly `C1 1 + L01 2 = 3`
  identities; cumulative T066 consumption is now `13 + 3 = 16` signup attempts
  and successful identities.
- The post-stop R02 calculation at `2026-09-19T14:47:15+05:00`, cutoff
  `13:47:15+05:00`, counted the four admission receipts plus
  `run-yfZNm8 = 1` and `run-yLTfKu = 2`: usage `9 / 150`, capacity `141`, and
  no unfinished run. No HTTP 429 or Auth-accounting failure occurred. The owner
  controller reported scanner findings `[]`, L01 Auth/context cleanup true and
  budget failure false; the provider environment, browser/E2E processes and
  Playwright runtime were removed. C1's authoritative live controller scan was
  also `[]`; as designed, a later standalone scan cannot re-authorize its PNG
  after the ephemeral credential registry has been destroyed.
- T066 remains incomplete. T067–T069 and Feature 009 remain unstarted. The exact
  next task is still T066: make the shared candidate harness distinguish
  initial-empty from exhausted copy without weakening either state, add
  deterministic coverage, rerun the applicable non-charged gates, derive the
  complete replay again and obtain a new R02 admission before any further
  charged execution.

### T066 — state-specific terminal-copy recovery stopped on opaque harness guard (2026-09-19)

- The shared candidate harness now has two distinct assertions. Existing
  `noCandidates()` first reads the authoritative stored room and accepts only
  `inactive + no_candidates + sequence 0 + count 0`, then requires Feature
  006's initial-empty copy and no progression terminal. New `exhausted()` first
  reads the authoritative stored room and accepts only
  `exhausted + no_candidates + positive sequence + count 0`, then requires the
  exact Feature 008 exhausted copy from both candidate and progression status,
  the new-room action and no Retry. L01 calls only `exhausted()`; J02 retains
  `noCandidates()`. Application behavior, copy and the five-second progression
  bound are unchanged.
- Deterministic coverage imports the pure terminal classifier and proves the
  two exact state/copy pairs, plus rejection of crossed progression,
  acquisition, sequence and count shapes. Static profile checks require J02 to
  retain `noCandidates()` and L01 to use `exhausted()`. The focused candidate,
  progression and Feature 006/008 profile matrix passed `7 suites / 92 tests`;
  full client/config passed `48 suites / 818 tests`; lint and typecheck passed.
  Check-only database types remained consistent, all six protected
  migration/hash validators passed with zero GoTrue signups, and
  `git diff --check` passed. No generated-type write occurred.
- The first protected validator correctly rejected the charged run's retained
  `3` Auth users and `4` rooms at its clean-database precondition. One explicit
  latest-schema reset was performed solely as required migration-suite setup;
  it did not recover quota and all prior identities remained counted. The six
  validators then each restored a clean latest schema and passed.
- Because candidate-harness and L01 source changed, no earlier partial attempt
  can prove one unchanged-source T066 run one. The state-specific helper change
  is bounded to the existing Feature 006/008 candidate contract and has static
  deterministic coverage, so it does not trigger the full historical browser
  gate. The narrowest valid replay remained the complete T066 block:
  `C1 1 + owner 6 + smoke 16 = 23`.
- Fresh admission at `2026-09-19T15:02:54+05:00`, cutoff
  `14:02:54+05:00`, counted `run-gJSPkC = 1`, `run-thsu91 = 2`,
  `run-yfZNm8 = 1` and `run-yLTfKu = 2`: usage `6 / 150`, capacity
  `144`, no unfinished run. The complete block was admitted with 121 identities
  of post-reservation headroom and no signup probe.
- C1 ran once as `test-results/run-o60Ekq` and passed after exactly one identity
  with its expected controlled failure, Auth/context cleanup, complete approved
  artifacts, controller scanner findings `[]` and runtime removal.
- The owner profile ran once as `test-results/run-LB0wxF`. L01 consumed exactly
  two identities and left an authoritative completed-empty room at
  `no_candidates / exhausted / sequence 1 / count 0`. Its safe error occurred
  about 1.5 seconds after that terminal commit. The error location is only
  `e2e/support/safe-diagnostics.ts:18:1`, proving an explicit sanitized
  `safeError`, not a locator assertion (which would retain its reviewed harness
  line). The canonical terminal satisfies the new classifier, but the shared
  candidate harness collapses its remaining explicit terminal/health guards
  into the same location-free error and emitted no bounded harness diagnostic.
  The exact failing predicate is therefore not recoverable from the preserved
  receipt. This newly exposed blocker is a test-harness evidence/observability
  defect; the evidence does not establish a new product or progression failure.
- Fail-fast stopped L01 immediately. L02 and permanent smoke were not
  dispatched and no retry occurred. This recovery consumed
  `C1 1 + L01 2 = 3` identities; cumulative T066 consumption is now
  `16 + 3 = 19` signup attempts and successful identities.
- Post-stop R02 at `2026-09-19T15:07:29+05:00`, cutoff
  `14:07:29+05:00`, counted `run-gJSPkC = 1`, `run-thsu91 = 2`,
  `run-yfZNm8 = 1`, `run-yLTfKu = 2`, `run-o60Ekq = 1` and
  `run-LB0wxF = 2`: usage `9 / 150`, capacity `141`, no unfinished run.
  There was no HTTP 429 or Auth-accounting failure. Both controllers reported
  scanner findings `[]`; L01 reported Auth/context cleanup true and budget
  failure false. The provider environment, E2E/browser processes and
  Playwright runtime were removed. The local database was left untouched after
  the failure with its three charged Auth rows and four room evidence rows.
- T066 remains incomplete. T067–T069 and Feature 009 remain unstarted. The exact
  next task is still T066: add bounded, privacy-safe branch diagnostics for the
  candidate terminal/health guards so this opaque failure can be localized
  deterministically, rerun the applicable non-charged checks, derive the
  complete replay again and obtain a fresh R02 admission before any further
  charged execution.

### T066 — opaque-guard observability and non-charged recovery (2026-09-19)

- Candidate terminal failures now emit an exact reviewed guard identifier for
  binding, authoritative snapshot readability, acquisition status,
  progression status, sequence, decision count or terminal-kind mismatch. The
  bounded receipt includes only the expected terminal class, sanitized closed
  acquisition/progression enums, sequence/count values and boolean invariant
  results. Candidate transport health similarly distinguishes request origin,
  method, exact body shape, bound room, JWT-subject match, response-body
  readability, size, JSON, exact response contract, disposal/binding and the
  pre-existing direct-provider/fixture/invalid counters. It retains only one
  fixed response outcome enum, HTTP status and bounded aggregate counts; it
  never retains a token, header, room/member identifier, decision value or
  response body.
- Exact-shape parsing and deterministic tests exercise every terminal and
  health guard independently, reject injected `authorization`, cookie/token,
  room and private-decision fields, round-trip reviewed diagnostics through the
  safe reporter, and pass the real finalized-artifact scanner with findings
  `[]`. The preserved failed receipt `test-results/run-LB0wxF` also rescanned as
  `4 files / findings []`.
- Non-charged inspection found and deterministically reproduced one genuine
  ambiguity in the committed candidate-response-loss subflow: its helper used
  `route.fetch()`, read and disposed the returned response, then aborted the
  browser request, while the global listener could attempt a duplicate read of
  that intentionally consumed response. The preserved receipt could not prove
  this was the prior opaque predicate; the regression removed that ambiguity
  without Auth or browser execution. The subsequent replay below exposed the
  actual shared validator mismatch precisely.
- L01 now uses the candidate harness's owned one-response loss helper. That
  helper marks only its exact request as intentionally consumed before
  `route.fetch()`, still strictly validates the bounded `available` response
  itself, and still aborts the browser response to preserve the response-loss
  scenario. The global observer skips only that duplicate read; every ordinary
  request and response remains subject to the same health checks. No product,
  database, terminal contract, timeout, convergence bound, retry or sleep
  changed.
- Non-charged validation passed: focused candidate/progression and Feature
  006/007/008 shared-harness/config coverage `14 suites / 172 tests`; full
  client/config `48 suites / 820 tests`; all six protected nonempty migration
  and historical-hash validators with zero GoTrue signups, latest cleanup and
  unchanged generated types; check-only database types `consistent`; lint;
  typecheck; and `git diff --check`. Before validator setup, the preserved
  evidence database still contained exactly `3` Auth users and `4` rooms. The
  explicit latest-schema reset was solely the documented validator
  precondition and did not alter R02 accounting. The first reset invocation was
  rejected before schema work by the managed read-only telemetry path; the
  established telemetry-disabled invocation then completed normally.
- Candidate-harness, owner-case and deterministic-test source changed, so no
  earlier partial attempt establishes an unchanged-source T066 run one. The
  bounded harness repair affects only L01's existing response-loss proof and
  does not select a historical case. The contract-valid replay therefore
  remains the complete block exactly once: `C1 1 + owner 6 + smoke 16 = 23`.
  T066 remains incomplete pending a fresh authoritative R02 admission and that
  replay; T067–T069 and Feature 009 remain unstarted.

### T066 — observability replay stopped on exact successor-response guard (2026-09-19)

- Fresh authoritative admission at `2026-09-19T15:30:25+05:00`, cutoff
  `14:30:25+05:00`, counted `run-yfZNm8 = 1`, `run-yLTfKu = 2`,
  `run-o60Ekq = 1` and `run-LB0wxF = 2`: rolling usage `6 / 150`,
  capacity `144`, no unfinished run. The exact complete block
  `C1 1 + owner 6 + smoke 16 = 23` was admitted with 121 identities of
  post-reservation headroom. No signup probe ran.
- C1 ran exactly once as `test-results/run-k3iLFS` and passed after one
  signup/identity. Static A/B and controlled C behaved as specified; Auth
  accounting, verified capture, artifact completeness, cleanup, controller
  scanner findings `[]` and runtime removal passed.
- The owner profile ran exactly once as `test-results/run-KBogzY`. L01 consumed
  exactly two signups/identities and failed at the bounded committed-response
  predicate in `e2e/candidate-progression.spec.ts:105:61`; fail-fast prevented
  L02 and permanent smoke from being dispatched, and no retry occurred. The
  authoritative room had already installed the distinct successor as
  `assigned / collecting / sequence 2 / count 0`, so product progression was
  correct.
- The exact harness defect was the shared strict `available` response
  validator's poster allowlist. It recognized the controlled successor's ID,
  title and release year but accepted only `/controlled.png`; the stub's valid
  successor presentation uses `/controlled-successor.png`. The owned loss
  helper therefore reported `committed=false`, and in the prior run the same
  validator would have set the opaque aggregate health flag on ordinary
  successor responses. This is a test-harness contract defect, not a product,
  database, candidate-sequence or terminal failure.
- The validator now requires the exact poster path for each controlled movie:
  the original candidate may use only `controlled.png` and the successor only
  `controlled-successor.png` (with the existing HTTPS/TMDB/size constraint),
  while null remains legal. The response-loss helper also emits an immediate
  bounded `response-body`, `response-size`, `response-json` or
  `response-contract` diagnostic before its caller observes a failed committed
  predicate. The deterministic response-loss regression now uses the actual
  successor identity and poster and passes while still simulating the disposed
  duplicate observer body.
- Post-fix non-charged validation passed: the directly affected diagnostics and
  Feature 006/008 profile suite `3 suites / 50 tests`; full client/config
  `48 suites / 820 tests`; lint; typecheck; check-only database types
  `consistent`; and `git diff --check`. The earlier same-turn full validation
  had already passed all six protected migration/hash validators with zero
  GoTrue signups; the final poster-only harness correction does not enter their
  database/migration/type boundary. The failed owner artifacts rescanned as
  `4 files / findings []`.
- This attempt consumed exactly `C1 1 + L01 2 = 3` identities. Cumulative T066
  consumption is now `19 + 3 = 22` signup attempts and 22 successful
  identities. Post-stop R02 at `2026-09-19T15:34:36+05:00`, cutoff
  `14:34:36+05:00`, counted the four prior receipts plus `run-k3iLFS = 1` and
  `run-KBogzY = 2`: usage `9 / 150`, capacity `141`, no HTTP 429 or Auth
  accounting/cleanup failure. The owner scanner reported `[]`;
  `supabase/functions/.env` was absent; no owned browser, provider, E2E process
  or Playwright/Edge runtime container remained. The preserved failed database
  has `3` Auth users and `2` rooms.
- Because the required block failed and the replay contract forbids retries,
  no further charged execution occurred. T066 remains incomplete. The exact
  next task remains T066; because harness source changed again, any future
  authorized recovery must re-establish its non-charged readiness, obtain a new
  R02 admission and replay the complete `23`-identity block. T067–T069 and
  Feature 009 remain unstarted.

### T066 — bounded response-body guard stopped the complete replay (2026-09-19)

- Repository inspection established that the working tree had advanced beyond
  the earlier 19-identity recap: the preserved `run-k3iLFS` / `run-KBogzY`
  replay and its successor-poster correction were already present in source and
  in this ledger, so the authoritative pre-attempt cumulative T066 consumption
  was 22 identities. No receipt or counted attempt was discarded.
- The candidate terminal and transport-health guards emit distinct reviewed
  identifiers with exact-shape parsing. Terminal diagnostics retain only the
  expected terminal class, sanitized acquisition/progression enums,
  sequence/count and boolean invariants. Health diagnostics retain only the
  guard, HTTP status, one closed outcome enum, bounded aggregate counters and
  booleans. Deterministic tests exercise all seven terminal guards and all
  fourteen health guards, reject added authorization/cookie/token/room/private-
  decision fields, round-trip through the safe reporter and scan with zero
  findings.
- Non-charged inspection had localized the prior replay blocker to the shared
  strict `available` response validator: the controlled successor's identity,
  title and year were recognized, but the validator accepted only the original
  candidate's poster path. The smallest harness-only correction maps the
  original candidate to `controlled.png` and the successor to
  `controlled-successor.png`; the response-loss regression uses the actual
  successor response and preserves the intentional abort/disposed duplicate-
  observer behavior. Product, database, progression, privacy, timeout, retry
  and convergence contracts were unchanged.
- Final non-charged validation passed at that source state: focused shared
  candidate/progression/harness and Feature 006/007/008 profile/runtime coverage
  `14 suites / 172 tests`; full client/config `48 suites / 820 tests`; finalized
  artifact scans for the opaque and exact-poster failed owner receipts with
  findings `[]`; lint; typecheck; all six protected nonempty migration/hash
  validators with zero GoTrue signups, latest cleanup and unchanged historical
  and generated artifacts; check-only database types `consistent`; and
  `git diff --check`. The generated artifact remained SHA-256
  `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  with inode/size/mtime/ctime
  `11577791 / 20142 / 1789775458 / 1789775459`.
- Because harness and deterministic-test source changed, no partial earlier run
  could establish unchanged-source run one. The contract-valid replay remained
  exactly `C1 1 + owner 6 + smoke 16 = 23`. The fresh authoritative admission
  at `2026-09-19T19:53:22+05:00`, cutoff `18:53:22+05:00`, found zero
  identity-bearing receipts and zero unfinished runs in the rolling hour:
  usage `0 / 150`, capacity `150`. The complete block was admitted with 127
  identities of post-reservation headroom; no signup probe ran.
- C1 ran exactly once as `test-results/run-Iwpjgq` under Node `24.20.0` and npm
  `11.19.0` and passed after exactly one signup/identity. Static A/B and the
  controlled C failure behaved as specified; Auth accounting, verified capture,
  artifact completeness, owned cleanup, live controller scanner findings `[]`
  and runtime removal passed. As designed, a later standalone scan cannot
  re-authorize the PNG after the ephemeral registry is destroyed.
- The owner profile ran exactly once as `test-results/run-sd6KgJ`. L01 consumed
  exactly two signups/identities and then failed through the new bounded
  diagnostic: `kind=candidate-health-guard`, `guard=response-body`, HTTP `200`,
  response outcome `unreadable`, with only participant/request/response/error/
  invalid counters and safe booleans retained. The receipt contains no token,
  header, room/member identifier, decision value or response body, and its
  finalized standalone scan reports `4 files / findings []`. The preserved
  bounded database state includes stable `no_candidates / exhausted / sequence
  1 / count 0`, alongside the earlier bounded agreement/successor rooms.
- Feature 008 fail-fast stopped after L01. L02 and permanent smoke were not
  dispatched, no retry occurred, and there was no HTTP 429, Auth-accounting
  failure, cleanup failure or scanner finding. This recovery consumed exactly
  `C1 1 + L01 2 = 3` identities, bringing cumulative T066 consumption to
  `22 + 3 = 25` signup attempts and successful identities.
- Post-stop R02 at `2026-09-19T19:55:29+05:00`, cutoff
  `18:55:29+05:00`, counted `run-Iwpjgq = 1` and `run-sd6KgJ = 2`: rolling
  usage `3 / 150`, capacity `147`, and no unfinished run. The provider
  environment was absent and no owned browser, E2E, provider, Playwright or
  Edge-runtime process/container remained.
- T066 remains incomplete. T067–T069 and Feature 009 remain unstarted. The exact
  next task is still T066: localize the newly identified unreadable HTTP-200
  response-body lifecycle non-chargedly, make only a deterministically proven
  correction, rerun the applicable non-charged gates, and obtain a new R02
  admission before any later contract-valid charged execution.

### T066 — HTTP-200 body lifecycle localized and corrected (2026-09-19)

- The preserved `run-sd6KgJ` receipt was traced through the complete candidate
  response lifecycle. `createCandidateHarness` captured the response from each
  participant page's `response` event and started an asynchronous
  `response.body()` read. L01 then progressed by navigating both participant
  pages while those reads were still pending. Playwright waits for the request
  to finish before fetching the retained body, and its transport reports a
  protocol error when that response was navigated away from first. The receipt's
  two HTTP-200 `unreadable` outcomes therefore correspond to the two participant
  navigations; the pages and contexts were alive, and no route, duplicate
  listener, product parser, empty body or malformed JSON caused the loss.
- A no-identity local Chromium regression reproduced the exact mechanism with a
  synthetic HTTP-200 JSON response: after browser fetch completion, navigation
  before `response.body()` made the read fail with Playwright's navigation-away
  protocol error while the page and context remained open. A separately delayed
  HTTP-200 JSON response proved the corrected ordering: draining the pending read
  obtained 23 bytes, decoded JSON and completed contract validation before
  navigation. No Auth request, anonymous signup, room or private decision was
  involved.
- The smallest correction is harness-only. Candidate-response reads now retain
  a bounded lifecycle state, classify navigation, target-close, disposal,
  network, empty, malformed, oversized and contract failures separately, and
  expose only closed enums, booleans and a bounded length. A new
  `drainResponses()` barrier awaits all pending body/JSON/contract validation;
  L01/L02 call it immediately before every navigation or reload and before final
  health evaluation. An unreadable response still fails closed. There are no
  sleeps, retries, enlarged convergence limits or application behavior changes.
- The deterministic regression fails under the former navigate-before-read
  ordering and proves both the prior navigation-invalidated HTTP-200 body and
  the delayed success path under the new drain. Exact-shape diagnostic tests
  reject extra sensitive fields and the safe reporter/scanner round-trip remains
  clean. Focused candidate/progression/harness and Feature 006/007/008 coverage
  passed `14 suites / 173 tests`; full client/config passed `48 suites / 821
  tests`; lint, typecheck and `git diff --check` passed. All six protected
  migration/hash runners passed with zero GoTrue signups and a final clean reset;
  check-only database types reported `consistent`. The generated artifact was
  not regenerated and remained SHA-256
  `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  with inode/size/mtime/ctime
  `11577791 / 20142 / 1789775458 / 1789775459`. The failed receipt rescanned as
  `4 files / findings []`.
- This specifically localized, reproduced and covered lifecycle race satisfies
  the deterministic prerequisite for a single contract-valid T066 replay. T066
  remains incomplete pending a fresh authoritative R02 admission and that exact
  execution; cumulative consumption remains 25 identities at this point.

### T066 — lifecycle recovery replay stopped at L01 (2026-09-19)

- The fresh authoritative admission at `2026-09-19T20:20:41+05:00`, cutoff
  `19:20:41+05:00`, counted `run-Iwpjgq = 1` and `run-sd6KgJ = 2`, with no
  unfinished run: rolling usage `3 / 150`, capacity `147`. The exact
  `1 + 6 + 16 = 23` block was reserved, projecting `26 / 150` and 124
  identities of post-reservation headroom. No quota probe ran. The admitted
  source was HEAD `bd3233f3916f1280bf9d4bf1e7e2fef51752c182` with tracked
  patch SHA-256
  `a3c1d9659d61e6999e7e832df99d3eb61ad7500e5b2d51c823253b697e35010f`;
  Node `24.20.0` and npm `11.19.0` were selected. The provider environment was
  absent and no browser/E2E run was active.
- C1 ran exactly once as `test-results/run-DTEy3J` and passed after exactly one
  signup/identity. Static A/B and the controlled C failure behaved as specified;
  verified capture, Auth accounting, cleanup, runtime removal and the live
  controller scan passed with findings `[]`.
- The owner profile ran exactly once as `test-results/run-yshiqk`. L01 consumed
  exactly two signups/identities and failed through the extended bounded
  diagnostic: `guard=response-body`, HTTP `200`, outcome `unreadable`, read
  stage `body-requested`, failure `navigation`, exception category `protocol`,
  no body bytes or decoded JSON, request finished and not failed, and page and
  context both alive. Aggregate counts were `participants=2`, `requests=6`,
  `responses=3`, `errors=0`, `invalid=1`; validation was no longer active when
  reported. No body, URL, token, header, room/member identifier or decision was
  retained. Its finalized standalone scan passed `4 files / findings []`.
- The new receipt confirms the exact defect class but shows that the correction
  did not cover every transition: the progression/reload barriers are effective
  only after a prior assembly, while the first assembly can navigate a
  participant from its already loaded application page to the invitation after
  candidate capture has begun. That initial navigation remains capable of
  invalidating `response.body()` before the read completes. This is a harness
  response-lifecycle ordering defect, not an empty body, malformed JSON, network
  failure, page/context closure or application acceptance of unreadable data.
- Fail-fast stopped the block immediately. L02 and permanent smoke were not
  dispatched and no retry occurred. This attempt consumed exactly
  `C1 1 + L01 2 = 3` identities, bringing cumulative T066 consumption to
  `25 + 3 = 28` signup attempts and successful identities.
- Post-stop R02 at `2026-09-19T20:21:53+05:00`, cutoff
  `19:21:53+05:00`, counted the two admission receipts plus
  `run-DTEy3J = 1` and `run-yshiqk = 2`: usage `6 / 150`, capacity `144`, with
  no unfinished run. The provider environment was absent and no owned browser,
  E2E, provider, Playwright or Edge-runtime process/container remained.
- T066 remains incomplete. T067–T069 and Feature 009 remain unstarted. Per the
  no-retry contract, execution stops here. The exact next task is T066: reproduce
  the initial-assembly navigation edge non-chargedly, place the response drain
  before that proven transition without weakening validation, rerun the
  deterministic gates, then obtain a new R02 admission before any later complete
  replay.

### T066 — initial-assembly invitation barrier proven (2026-09-19)

- The first-assembly branch was reproduced independently of the charged receipt
  with the actual candidate harness and the same invitation-transition helper
  now used by L01/L02. The exact former order was: the candidate HTTP-200
  response event captured the response and registered its validation promise;
  `response.body()` reached `body-requested`; first assembly entered participant
  admission; the participant navigated to the invitation; only afterward did
  the retained body reject as navigation-invalidated and the later drain report
  the fail-closed diagnostic. The response had status 200, no bytes or JSON were
  obtained, and the synthetic page/context remained alive.
- The focused regression first failed before the shared admission transition
  existed. Its explicit no-barrier branch still proves the known navigation-
  invalidates-body outcome fails safely. Its fixed branch holds a valid strict
  `available` HTTP-200 JSON body, invokes the exact production invitation
  transition, and proves `goto(invitation)` cannot run while validation is
  pending. After release, the body is obtained, decoded and contract-checked,
  the accepted-response count increments, and only then does invitation
  navigation run. Exact-shape diagnostics continue to reject authorization,
  cookie/token, room and private-decision fields, round-trip through the safe
  reporter, and scan without findings.
- The smallest fix is one harness-only barrier in
  `navigateInvitationAfterCandidateResponses`: await `drainResponses()`
  immediately before the invitation `page.goto`. The Feature 008 `admit()` path
  uses that transition for every first/later participant admission. Existing
  barriers before later room creation, progression/reload transitions and final
  health evaluation remain unchanged. No sleep, retry, timeout, broad
  navigation delay, application behavior or response validation changed, and
  unreadable responses still fail before navigation.
- Non-charged validation passed: focused candidate/progression and Feature
  006/007/008 shared-harness/profile/runtime coverage `14 suites / 173 tests`;
  full client/config `48 suites / 821 tests`; the finalized failed receipt
  `run-yshiqk` scanner `4 files / findings []`; lint; typecheck; and
  `git diff --check`. All six protected nonempty migration/historical-hash
  validators passed with zero GoTrue signups and final latest-schema cleanup.
  Their initial precondition correctly rejected the preserved failed-run
  database (`1` room / `3` Auth users); the documented explicit latest reset
  restored the empty owned-stack prerequisite before the successful validator
  sequence and did not affect R02 accounting. Check-only database types were
  `consistent`; no type generation ran. The generated artifact remained
  SHA-256 `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  with inode/size/mtime/ctime
  `11577791 / 20142 / 1789775458 / 1789775459`.
- Because the shared Feature 008 browser harness changed, none of the prior
  partial charged attempts can establish unchanged-source run one. T066 still
  requires its complete fixed block exactly once: C1 `1` plus owner L01/L02 `6`
  plus permanent smoke `16`, for `1 + 6 + 16 = 23`. Cumulative historical T066
  consumption remains exactly 28 identities before that replay. T067–T069 and
  Feature 009 remain unstarted.

### T066 — initial-assembly recovery replay stopped in permanent smoke (2026-09-19)

- Fresh authoritative R02 admission at `2026-09-19T23:14:09+05:00`, cutoff
  `22:14:09+05:00`, found zero identity-bearing receipts and no unfinished run
  in the rolling hour: usage `0 / 150`, capacity `150`. The complete fixed block
  `C1 1 + owner 6 + smoke 16 = 23` was reserved with 127 identities of projected
  post-reservation headroom. No signup probe ran. Admitted source was HEAD
  `bd3233f3916f1280bf9d4bf1e7e2fef51752c182` with tracked patch SHA-256
  `fac6eabf21138a7dce867434befcb11e57b5bd22426018af11220d501f6e35c6`,
  Node `24.20.0` and npm `11.19.0`; the provider environment and owned browser
  containers were absent.
- C1 ran exactly once as `test-results/run-730HYp` and passed its controller
  contract after exactly one signup/identity. Static A/B passed, controlled C
  failed as designed, probe artifacts were complete, Auth/cleanup succeeded,
  scanner findings were `[]`, and the runtime was removed.
- The owner profile ran exactly once as `test-results/run-rpcNqx` and passed.
  L01 consumed exactly two identities and L02 exactly four; both exact receipts
  passed with cleanup/Auth success, zero budget failure and scanner findings
  `[]`. This proves the initial-assembly barrier in the charged owner journeys,
  including L02's reused-identity four-voter subflow.
- Permanent smoke ran exactly once as `test-results/run-0KgvR1` and failed.
  G03 (`3`), G05 (`2`), G08 (`4`) and H01 (`3`) passed; G04 consumed its exact
  four identities but returned bounded category `E2E_FAILURE` at
  `e2e/generalized-room-membership-qr.spec.ts:486:86`. The safe receipt contains
  no harness diagnostic or raw response: the location is the existing combined
  assertion over the completed G04 room snapshot and zero controlled-provider
  calls, so the receipt does not identify which conjunct failed. All five cases
  reported cleanup/Auth success and no budget failure. The controller and a
  standalone finalized scan both reported `4 files / findings []`; the browser
  runtime was removed and the provider environment was removed.
- Per fail-fast/no-retry policy no charged command was repeated and no T067 work
  started. This recovery consumed the complete admitted `1 + 6 + 16 = 23`
  identities. Cumulative T066 consumption is now exactly `28 + 23 = 51`
  signup attempts and successful identities.
- Post-stop R02 at `2026-09-19T23:17:22+05:00`, cutoff
  `22:17:22+05:00`, counted exactly `run-730HYp = 1`, `run-rpcNqx = 6` and
  `run-0KgvR1 = 16`: rolling usage `23 / 150`, capacity `127`, and no unfinished
  run. There was no HTTP 429, Auth-accounting failure, cleanup failure or scanner
  finding; no owned browser container or provider environment remained.
- T066 remains incomplete. T067–T069 and Feature 009 remain unstarted. The exact
  next task remains T066: diagnose the bounded G04 aggregate assertion failure
  non-chargedly, apply only a proven correction if required, rerun applicable
  deterministic gates, derive the contract-valid replay, and obtain a fresh R02
  admission before any further charged execution.

### T066 — G04 controlled-provider expectation corrected (2026-09-20)

- The exact G04 root cause is a stale historical smoke expectation. Before
  Feature 008, G04 installed `installAssignedCandidatePresentation`, fulfilled
  candidate presentation inside the browser harness and therefore correctly
  expected every controlled-provider call count to remain zero. T063 removed
  that synthetic presentation route so G04 would exercise the real controlled
  Edge/provider path, but retained the old zero-call conjunct at the end of the
  combined aggregate assertion. The charged case reached that final assertion
  after its membership, filter, candidate, decision and agreed-observer checks;
  the real provider traffic made the obsolete conjunct false. This is neither
  an application, database/RPC projection nor synchronization regression.
- The approved Feature 006/008 contract requires an assigned occurrence to load
  authoritative metadata through Details and, for the controlled non-null
  poster, Configuration. Initial Discover is permitted but is not mandatory in
  G04 because its bounded preassembly fallback may establish occurrence 1
  before metadata recovery. The real controlled provider, not a fulfilled
  presentation fixture, is also mandatory for current smoke. Product behavior
  was therefore correct and the historical assertion was wrong.
- A no-identity regression drives the actual `room-candidate` handler against
  the real controlled provider stub and frozen compatible constraint. It proves
  the acquisition branch returns strict `available` and records exactly
  `discover=1 / details=1 / configuration=1 / poster=0`, provider
  `requests=3 / completed=3 / active=0`, and `invalid=0`; the former all-zero
  predicate is deterministically false. The same regression inspects the G04
  source slice and failed RED while the stale predicate remained.
- The smallest correction changes only G04's final assertions. Its completed
  room projection now additionally requires `assigned / agreed / sequence 1`,
  one positive safe TMDB identity, three completed filters/decisions and three
  stored filters. Its provider projection requires zero invalid calls, bounded
  optional Discover, at least one Details call, one Configuration per Details,
  zero provider-side poster calls, exact request/call accounting and no active
  request. Membership, non-voting creator privacy, recovery, room isolation,
  neutral no-Match behavior and identity budget remain unchanged. The combined
  assertion was split so a future safe receipt localizes room versus provider
  failure without exposing identifiers, decisions, headers, tokens or bodies.
- Non-charged validation passed with the pinned Node `24.20.0` / npm `11.19.0`
  toolchain: focused Feature 006/007/008 profile, generalized discovery/runtime
  and privacy diagnostics `5 suites / 76 tests`; relevant Edge/provider/RPC
  behavior `42 passed / 1 optional live test ignored`; full client/config
  `48 suites / 822 tests`; lint; typecheck; the finalized failed smoke receipt
  scanner `4 files / findings []`; and `git diff --check`. All six protected
  nonempty migration/historical-hash validators passed with zero GoTrue signups
  and final latest-schema cleanup after an explicit validator-precondition reset
  of the preserved charged evidence database (`14` rooms / `23` Auth rows).
  That reset does not change R02 accounting. Check-only database types were
  `consistent`; no regeneration ran. The generated artifact remained SHA-256
  `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  with inode/size/mtime/ctime
  `11577791 / 20142 / 1789775458 / 1789775459`.
- Replay derivation: C1 passed and neither its implementation nor its security,
  reporter, scanner, credential, context or runner boundary changed, so the
  normative once-only C1 evidence remains valid. Smoke-only replacement is
  insufficient because repeatability requires current owner acceptance plus
  permanent smoke from one unchanged source/stack. The G04-only source change
  does not expand impact beyond that pair. The narrow contract-valid T066
  recovery is therefore owner `6` plus smoke `16`, exactly `22` identities;
  C1 is not rerun. A later T067 remains a separate additional `22`-identity
  execution and is not started here.

### T066 — G04 recovery replay stopped on L01 response lifecycle (2026-09-20)

- Fresh authoritative R02 admission at `2026-09-20T00:09:18+05:00`, cutoff
  `2026-09-19T23:09:18+05:00`, counted the finalized prior receipts exactly as
  `run-730HYp = 1`, `run-rpcNqx = 6` and `run-0KgvR1 = 16`: rolling usage
  `23 / 150`, capacity `127`, and no unfinished run. The derived owner-plus-
  smoke recovery `6 + 16 = 22` was reserved, projecting `45 / 150` and 105
  identities of post-reservation headroom. C1 was not rerun. Admitted source
  was HEAD `bd3233f3916f1280bf9d4bf1e7e2fef51752c182` with tracked patch
  SHA-256 `6156c1d0a74d57ef59acc3cff1c118c3700bb90c6e8705335090d5b9aa16f4df`,
  Node `24.20.0` and npm `11.19.0`; no signup probe ran.
- Feature 008 owner acceptance ran exactly once as
  `test-results/run-EJrWnE` and stopped in L01 after exactly two successful
  signup identities. The bounded candidate-health diagnostic is
  `guard=response-body`, HTTP `200`, outcome `unreadable`, read stage
  `body-requested`, failure `navigation`, exception category `protocol`, no body
  bytes or decoded JSON, request finished/not failed, and page/context both
  alive. Aggregate counts were `participants=2`, `requests=6`, `responses=4`,
  `errors=0`, `invalid=1`, `responseValidationActive=0`; binding was present.
  The safe receipt location is the fixed boundary
  `e2e/support/safe-diagnostics.ts:18:1`. A second zero-identity runner receipt
  records max-failure shutdown only.
- Feature 008 fail-fast prevented L02 and permanent smoke from being dispatched.
  No command or case was retried. Auth accounting and owned-case cleanup passed,
  there was no budget failure or HTTP 429, the controller and standalone scan
  both reported `4 files / findings []`, and the browser runtime/provider
  environment were removed. The G04 correction therefore has deterministic
  proof but no new charged smoke receipt yet.
- This recovery consumed exactly two identities. Cumulative T066 consumption is
  now `51 + 2 = 53` signup attempts and successful identities. Post-stop R02 at
  `2026-09-20T00:10:03+05:00`, cutoff `23:10:03+05:00`, counted the prior
  `23` plus `run-EJrWnE = 2`: usage `25 / 150`, capacity `125`, with no
  unfinished run.
- T066 remains incomplete. T067–T069 and Feature 009 remain unstarted. The exact
  next task is T066: localize this newly observed L01 navigation-invalidated
  HTTP-200 response non-chargedly against the current admission/reload flow,
  apply only a deterministically proven lifecycle correction, rerun applicable
  gates, derive the next contract-valid recovery, and obtain a fresh R02
  admission before any further charged execution.

### T066 — retained-session home-navigation barrier proven (2026-09-20)

- The uncovered transition was not the already-fixed invitation admission.
  L01's first room and invitation entry were protected, as were all three
  explicit reload groups, but each later `assemble(previous)` drained before
  calling `createWaitingWithSession`. That helper then awaited Auth accounting
  and read the retained participant before its own `page.goto('/')`. A response
  captured during that setup work was therefore outside the earlier drain.
  The exact reproduced order was: outer drain completed; retained-session Auth
  accounting began; a required prior-room HTTP-200 response was captured;
  `response.body()` entered `body-requested`; the retained participant read
  completed; the helper navigated home; the retained body became unreadable;
  and the later drain failed safely. This matches the charged diagnostic's
  bound state (`bindingPresent=true`, HTTP 200, request finished, page/context
  alive, no bytes/JSON) without relying on that diagnostic alone.
- The navigation audit found no second unguarded L01 candidate-document exit.
  Both initial `startHost` home loads and the first create-room route transition
  happen before the candidate harness is bound and before candidate traffic;
  every invitation `goto` uses the shared response-validation barrier; the
  generated uppercase invitation does not exercise canonical replacement;
  candidate/decision/retry actions do not navigate; all three explicit reload
  groups drain immediately before reload; later-room creation now drains at its
  internal home transition; its subsequent create-room replacement occurs from
  a candidate-free home document; terminal new-room links are not clicked; and
  successful L01 performs a final drain before harness/context cleanup.
- A no-Auth regression in `__tests__/config/e2e-diagnostics.test.ts` invokes the
  actual retained-session helper. Its bypass branch passed first and reproduced
  the exact navigation-invalidated lifecycle. The fixed-path assertion then
  failed against the old helper because navigation occurred while the delayed
  body remained pending. It now proves a delayed strict-valid `available`
  HTTP-200 JSON response reaches body/JSON/contract completion before home
  navigation, while an already-drained/no-pending transition still navigates
  once. The bypass diagnostic contains only the fixed lifecycle categories and
  bounded counts; it contains neither the synthetic room/token values nor any
  response body, and its standalone scanner result is empty.
- The smallest correction added one shared
  `navigateAfterResponseValidation` boundary. Invitation admission delegates to
  it. `createWaitingWithSession` accepts the Feature 008 response drain and
  invokes the boundary after Auth/participant preparation and immediately
  before `goto('/')`. L01 passes its candidate harness at that exact boundary,
  and the obsolete outer `assemble(previous)` drain was removed. No product
  code, response contract, timeout, sleep, retry, or unrelated navigation was
  changed; unreadable bodies still fail closed.
- Non-charged validation passed: focused lifecycle plus Feature 006/007/008
  profile diagnostics; candidate/decision/progression/room coverage
  (`15 suites / 225 tests`); full client/config (`48 suites / 824 tests`);
  lint; typecheck; all six protected nonempty migration/historical-hash runners
  with zero GoTrue signups; check-only database types; the retained failed-run
  scanner (`4 files / findings []`); and `git diff --check`. The validators
  required the standard no-seed reset because the prior charged run's owned
  rows remained; this did not alter rolling R02 accounting. The first check-only
  type invocation failed safely when the CLI telemetry-disable environment was
  absent, preserved the artifact, and passed once that required environment was
  restored. No type generation/write ran. The canonical generated file stayed
  SHA-256 `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  with inode/size/mtime/ctime `11577791 / 20142 / 1789775458 / 1789775459`.
- Replay derivation remains narrow but not smoke-only. The once-only C1 pass is
  valid because no security, Auth, safe reporter, scanner, credential registry,
  context, runner, or C1 source boundary changed. The harness correction
  invalidates owner evidence, while G04 still requires a current-source smoke
  replacement; repeatability run one requires owner plus permanent smoke from
  one unchanged source/stack. The required T066 recovery is therefore owner
  `6` plus smoke `16`, exactly `22` identities. C1 is not rerun, and T067's
  separate additional `22` remains unstarted.

### T066 — retained-session recovery replay stopped later in L01 (2026-09-20)

- Fresh authoritative R02 admission at `2026-09-20T02:39:31+05:00`, cutoff
  `01:39:31+05:00`, found zero finalized identity-bearing receipts and no
  unfinished run in the rolling hour: usage `0 / 150`, capacity `150`. The
  complete derived owner-plus-smoke recovery `6 + 16 = 22` was reserved,
  projecting `22 / 150` and 128 identities of headroom. C1 was not scheduled.
  Admitted source was HEAD
  `bd3233f3916f1280bf9d4bf1e7e2fef51752c182` with tracked patch SHA-256
  `e6929daf6c6ac61beb9d2583dd660be7b04a84b4d55e31168d6764939f21c8dd`,
  Node `24.12.0` and npm `11.6.2`; no signup probe ran.
- The owner-plus-smoke shell block was dispatched once under fail-fast control.
  Feature 008 owner acceptance stopped in L01 as `test-results/run-1zKPFz`
  after exactly two signup attempts and two successful identities. L02 was not
  dispatched, the owner command returned nonzero, and permanent smoke therefore
  was not dispatched. No case, command, Auth call, or quota action was retried.
- The exact bounded failure remained `E2E_FAILURE` at
  `e2e/support/safe-diagnostics.ts:18:1`: candidate health guard
  `response-body`, HTTP `200`, outcome `unreadable`, read stage
  `body-requested`, failure `navigation`, exception category `protocol`, no body
  bytes, no body length and no decoded JSON; the request finished successfully,
  did not fail, page and context remained alive, and binding was present.
  Aggregate values were `participants=2`, `requests=14`, `responses=12`,
  `errors=0`, `invalid=1`, `responseValidationActive=0`, direct provider `0`
  and fixture `0`. This later request/response position is preserved without
  guessing its transition in this recovery turn.
- Auth accounting and L01-owned cleanup passed, there was no budget failure or
  HTTP 429, the runtime was removed, and both the controller and standalone
  artifact scan reported `4 files / findings []`. The generated database type
  artifact remained unchanged. Post-stop R02 at
  `2026-09-20T02:40:14+05:00`, cutoff `01:40:14+05:00`, counted only
  `run-1zKPFz = 2`: usage `2 / 150`, capacity `148`, with no unfinished run.
- This replay consumed exactly two identities. Cumulative T066 consumption is
  now `53 + 2 = 55` signup attempts and successful identities. T066 remains
  incomplete; T067–T069 and Feature 009 remain unstarted. The exact next task is
  T066: non-chargedly trace and deterministically reproduce the later L01
  navigation-invalidated response at the observed `14 requests / 12 validated`
  position, apply only the proven lifecycle correction, rerun the deterministic
  gates, rederive recovery evidence, and obtain a new R02 admission before any
  further charged execution.

### T066 — post-loss request-settlement navigation boundary proven (2026-09-20)

- The response was the required `room-candidate` HTTP-200 request made after
  the intentionally lost/committed final-decision response in L01's rejected
  room. The invalidating transition was the second explicit two-page reload,
  immediately before `successorAvailable()`. The observed aggregate localizes
  it exactly: twelve earlier candidate responses had passed strict validation,
  one thirteenth request was intentionally consumed by `discardNextResponse`,
  and request fourteen had been observed but its response event had not yet
  registered a body-validation promise.
- The exact old ordering was: required request fourteen observed; the explicit
  response-only `drainResponses()` found no pending body promise and returned;
  `Promise.all(page.reload(...))` started; the HTTP-200 response event then
  registered validation and entered `body-requested`; document replacement
  invalidated the retained response; request-finished arrived; and the later
  health check failed with `requests=14`, `responses=12`, `invalid=1`, no bytes
  and no JSON. The earlier shared navigation boundary did execute, but its
  drain had a request-to-response blind spot: it tracked captured response-body
  work, not already-observed required requests that had not settled.
- A no-identity regression in `__tests__/config/e2e-diagnostics.test.ts` uses
  the actual candidate harness and reload helper boundary. It seeds twelve
  strictly validated responses, drives the real intentionally-consumed loss as
  request thirteen, observes request fourteen without a response, and then
  reproduces the former second-reload sequence. Its bounded result exactly
  matches `14 / 12 / 1`, HTTP `200`, `body-requested`, navigation/protocol,
  finished request, live page/context and no body/JSON. A pre-fix assertion
  failed because reload began while request fourteen remained unsettled.
- The audit proved a systemic gap limited to the Feature 008 owner navigation
  lifecycle rather than another isolated `goto`. Invitation admission and
  retained-session home navigation already delegated to the same shared
  boundary, while L01's three reload groups still composed an outer drain with
  direct reloads. Because every boundary depended on the response-only drain,
  any could miss the observed-request/pre-response interval. Initial host
  navigation occurs before binding, product router replacements leave a
  candidate-free document, participant reconstruction does not navigate, and
  terminal links are not clicked, so unrelated E2E navigation was not changed.
- `candidateHarness` now tracks each required candidate request from `request`
  through `requestfinished` or `requestfailed`. Its drain waits event-driven for
  both request settlement and strict response validation, repeats across the
  event handoff, and fails closed with the existing bounded `response-body`
  diagnostic if a required request fails without a validatable response. It
  never treats an unreadable response as success. A shared
  `reloadPagesAfterCandidateResponses` helper delegates to
  `navigateAfterResponseValidation`; all three L01 reload groups use it, and
  their three redundant outer drains were removed. No sleep, retry, timeout,
  product behavior or response contract changed.
- Deterministic coverage proves the exact post-loss transition; delayed valid
  HTTP-200 JSON completes before either page reloads; an already-drained
  transition and a transition with no tracked requests both navigate normally;
  body-read failure and request failure without a response both reject before
  navigation; invitation, retained-session home and reload owner primitives
  all use the safe boundary; owner source has no direct `goto`/`reload`; and
  bounded diagnostics contain no synthetic room/token values and scan with no
  findings.
- Non-charged validation passed: the focused post-loss regression; full
  diagnostics (`1 suite / 39 tests`); Feature 006/007/008 profile suites
  (`3 / 24`); affected candidate/decision/progression/room/route suites
  (`21 / 474`); full client/config (`48 / 825`); lint; typecheck; the retained
  `run-1zKPFz` artifact scan (`4 files / findings []`); all six protected
  nonempty migration/historical-hash validators with zero GoTrue signups; and
  `git diff --check`. The standard no-seed local database reset was needed only
  to restore migration preconditions and did not affect R02. Database types ran
  check-only and remained SHA-256
  `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  with inode/size/mtime/ctime `11577791 / 20142 / 1789775458 / 1789775459`;
  no generation/write ran.
- Replay remains owner plus permanent smoke, exactly `6 + 16 = 22`. The
  once-only C1 pass remains valid because security, Auth, credential registry,
  safe reporter/scanner, context and C1 boundaries did not change. The shared
  candidate/navigation harness change invalidates owner evidence, and smoke
  still needs current-source replacement after the corrected G04 run stopped;
  T066 run one therefore requires a complete owner-and-smoke pass at one
  unchanged source/stack. T067's additional 22-identity run remains unstarted.

### T066 — request-settlement recovery replay stopped in L02 (2026-09-20)

- Fresh authoritative R02 admission at `2026-09-20T03:14:28+05:00`, cutoff
  `02:14:28+05:00`, counted only `run-1zKPFz = 2`, found no unfinished run and
  reported usage `2 / 150`, capacity `148`. The complete derived owner-plus-
  smoke recovery `6 + 16 = 22` was reserved, projecting `24 / 150` and 126
  identities of headroom. C1 was not scheduled. Admitted source was HEAD
  `bd3233f3916f1280bf9d4bf1e7e2fef51752c182` with tracked patch SHA-256
  `51c5fc525381bfa051c94942dc99ae2890aba6eaa365968a6d74183cb07b1dfa`,
  Node `24.12.0` and npm `11.6.2`; no signup probe ran.
- The owner-plus-smoke shell block was dispatched once with shell fail-fast.
  Owner acceptance `run-ankJWJ` passed L01 after exactly two identities, then
  failed in L02 after exactly four identities. The bounded failure is the
  five-second accepted-decision view convergence assertion at
  `e2e/support/decision-harness.ts:305:8`; it carried no harness diagnostic,
  response content or unsafe source detail. Auth accounting and owned cleanup
  passed for both cases, the budget guard did not fail, and there was no HTTP
  429. The owner command returned nonzero, so permanent smoke was not
  dispatched. No case, command, Auth call or quota action was retried.
- The controller and standalone scan both reported `4 files / findings []`,
  and the managed browser runtime was removed. This was not another bounded
  response-body lifecycle failure: L01 passed the corrected request-settlement
  boundary, while L02 stopped at the decision acknowledgement/progression-view
  poll with no candidate health diagnostic. Per fail-fast, no speculative
  correction or further charged execution followed.
- This recovery consumed exactly `2 + 4 = 6` signup attempts and successful
  identities. Cumulative T066 consumption is now `55 + 6 = 61`. Post-stop R02
  at `2026-09-20T03:16:17+05:00`, cutoff `02:16:17+05:00`, counted
  `run-1zKPFz = 2` and `run-ankJWJ = 6`: usage `8 / 150`, capacity `142`, no
  unfinished run. T066 remains incomplete; T067–T069 and Feature 009 remain
  unstarted. The exact next task is T066: diagnose the L02 accepted-decision
  view convergence failure non-chargedly, establish its exact cause with
  deterministic coverage, rerun applicable gates, rederive the recovery block,
  and obtain a new R02 admission before any further charged execution.

### T066 — concurrent non-final decision supersession localized and corrected (2026-09-20)

- The retained `run-ankJWJ` artifact and a privacy-safe gateway chronology
  localize the failure to L02's second three-voter room. One earlier `yes` was
  already accepted, then the two `no` submissions were released concurrently.
  The first serialized concurrent voter received the valid non-final
  acknowledgement for sequence 1 at `2/3 collecting`; the peer completed
  `3/3`, atomically rejected sequence 1, and the source commit installed
  sequence 2 at `0/3 collecting` before the five-second assertion expired.
  The failed view was therefore a voter, not the non-voting creator. Canonical
  server state and all HTTP results were already correct; the observer and
  final voter were not the failed acknowledgement view.
- The product's sequence-aware merge performed the required forward transition
  and retired the old decision generation. The harness still required the
  non-final voter's transient `You chose No` acknowledgement even after that
  acknowledgement had been legally superseded by the peer's newer canonical
  progression. This is a harness/assertion defect, not Realtime delivery,
  client merge/state, stale-callback suppression, database authority, or
  response-body lifecycle failure.
- The no-identity regression in
  `__tests__/config/feature008-e2e-profile.test.ts` drives the actual
  `applyRoomRefetch` lattice through
  `collecting(1,1) -> collecting(1,2) -> advancing(1) -> collecting(2,0)` and
  supplies the exact accepted `2/3 collecting` decision response to the real
  decision-harness predicate. It failed on the former behavior because the old
  acknowledgement was absent while the visible canonical state was already
  `0 of 3 decisions collected.`
- The smallest correction changes only
  `acceptedDecisionViewSatisfied`: an ordinary accepted acknowledgement may be
  satisfied by a changed, legally newer visible agreement, advancing,
  exhaustion, or fresh `0/N` successor state. Same-state aggregate text and
  unrelated collecting text still fail. The five-second limit, one-submission
  check, strict RPC parsing, voter privacy, fixed membership, sequence-aware
  product merge, Feature 007 semantics and Feature 008 behavior are unchanged.
- Non-charged validation passed under Node `24.20.0` / npm `11.19.0`: focused
  Feature 007/008 profile, diagnostics, decision, progression, room/Realtime
  and route coverage (`16 suites / 438 tests`); full client/config
  (`48 / 825`); lint; typecheck; synthetic-only browser privacy A/B with zero
  signups/identities and scanner zero; the retained `run-ankJWJ` scan
  (`4 files / findings []`); all six protected nonempty migration/historical-
  hash validators with zero GoTrue signups; check-only database types
  `consistent`; and `git diff --check`. The validator-precondition no-seed
  reset did not affect R02. Generated types were not regenerated and remained
  SHA-256 `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  with inode/size/mtime/ctime
  `11577791 / 20142 / 1789775458 / 1789775459`.
- The once-only C1 pass remains valid because no Auth, credential, reporter,
  scanner, context, security or C1 boundary changed. Current owner evidence is
  invalidated by the decision-harness correction and permanent smoke still
  lacks a complete current-source pass. The narrow contract-valid T066 replay
  is therefore owner L01/L02 `6` plus permanent smoke `16`, exactly `22`
  identities, with shell fail-fast and no retry. T067 remains a distinct later
  `22`-identity task and is not started.
- Fresh authoritative R02 admission at `2026-09-20T03:37:48+05:00`, cutoff
  `02:37:48+05:00`, counted `run-1zKPFz = 2` and `run-ankJWJ = 6`, found no
  unfinished run, and reported usage `8 / 150`, capacity `142`. The complete
  owner-plus-smoke recovery `6 + 16 = 22` was reserved, projecting
  `30 / 150` and 120 identities of headroom. C1 is not scheduled. Admitted
  source is HEAD `bd3233f3916f1280bf9d4bf1e7e2fef51752c182` with implementation
  patch SHA-256 (excluding this evidence ledger)
  `368b6f5cff8c957399280042a308e90a030c016d3c2c95a69fd7b83235571236`,
  Node `24.20.0` and npm `11.19.0`; no signup probe ran.
- The owner-plus-smoke block was dispatched once with shell fail-fast. Owner
  receipt `run-tmpVAo` stopped in L01 after exactly two signup attempts and two
  successful identities. The bounded candidate-health diagnostic reports
  `requests=13 / responses=11 / invalid=1`, HTTP `200`, response-body read at
  `body-requested`, navigation/protocol invalidation, request finished, live
  page/context, and no body bytes or JSON. Auth accounting and cleanup passed,
  the budget guard did not fail, the controller and standalone scan both found
  zero findings across four files, and the managed browser runtime was removed.
  L02 and permanent smoke were not dispatched. No case, command, Auth call or
  quota action was retried.
- This stopped replay consumed exactly two identities, so cumulative T066
  consumption is now `61 + 2 = 63`. Final R02 at
  `2026-09-20T03:38:44+05:00`, cutoff `02:38:44+05:00`, counted
  `run-1zKPFz = 2`, `run-ankJWJ = 6`, and `run-tmpVAo = 2`: usage
  `10 / 150`, capacity `140`, with no unfinished run. T066 remains incomplete;
  T067–T069 and Feature 009 remain unstarted. Per the no-retry contract,
  execution stops. The exact next task remains T066: diagnose this newly
  observed L01 navigation-invalidated HTTP-200 response non-chargedly before
  deriving any further replay or obtaining another R02 admission.

### T066 — request-13 lifecycle closure and replay admission (2026-09-20)

- The retained `run-tmpVAo` aggregate plus the real L01 call order identifies
  request 13 as the normal, required `room-candidate` successor request issued
  after the rejected-room concurrent yes/no step. It was not the separately
  and intentionally consumed response. The invalidating transition was L01's
  second explicit two-page reload immediately before `successorAvailable()`.
  The former shared helper drained the request/validation sets visible before
  calling reload, but did not own the handoff through document replacement, so
  candidate work beginning in that handoff could obtain HTTP 200 and enter
  `body-requested` after the drain had declared the sets empty.
- The full L01 replacement audit is closed. Invitation admission, all three
  reload groups and every retained-session home transition now require the
  shared `DocumentReplacementLifecycle`. That lifecycle enters a draining
  phase, waits both request settlement and strict response validation through
  an event-loop quiescence epoch, then owns the navigating phase through each
  main-frame commit. An outgoing document request that begins only after the
  replacement phase starts is aborted before HTTP forwarding and deliberately
  excluded; a required request already forwarded must settle and validate.
  Initial `startHost` navigation occurs on a blank/home page before any bound
  accepted candidate document; home-to-room application `router.replace`
  starts from that candidate-free home; invitation URLs are asserted canonical
  and the canonicalization branch does not mount `RoomEntry`; terminal links
  are not activated; and final `about:blank` cleanup occurs only after the
  candidate harness has removed its listeners. No reachable L01 document
  replacement remains outside the lifecycle invariant.
- The no-identity regression uses the actual candidate harness and shared
  reload boundary. Its legacy branch seeds eleven validated responses, the
  separate intentionally consumed request 12, and delayed required request 13;
  the old order fails exactly `13 / 11 / 1`, HTTP 200, `body-requested`,
  navigation/protocol, finished request and no bytes/JSON. The corrected branch
  proves delayed HTTP-200 body validation before reload, required settlement
  before a response-validation promise exists, intentionally consumed and
  replacement-retired work cannot deadlock or become a health failure,
  already-drained/no-pending paths proceed, body/request failure blocks
  navigation, all L01 helper paths use the central boundary, and the bounded
  diagnostic contains no synthetic room or credential values.
- Non-charged validation passed under Node `24.12.0` / npm `11.6.2`: focused
  Feature 006/007/008 profiles plus diagnostics and candidate/decision/
  progression/room/route suites (`25 suites / 537 tests`); full client/config/
  privacy/static coverage (`48 / 825`); lint; typecheck; full Edge/provider
  coverage (`42 passed / 1 optional live test ignored`); full pgTAP
  (`7 files / 910 tests`); all six protected nonempty migration and historical-
  hash validators with zero GoTrue signups and owned-fixture cleanup; retained
  `run-tmpVAo` artifact scan (`4 files / findings []`); and `git diff --check`.
  Check-only database types reported `consistent` and remained SHA-256
  `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  with inode/size/mtime/ctime
  `11577791 / 20142 / 1789775458 / 1789775459`; no type generation ran.
- The once-only C1 pass remains valid: the correction changes only the owner
  candidate/document lifecycle and its deterministic tests, not Auth,
  credentials, security, reporter/scanner, context cleanup or C1. Owner
  evidence changed and permanent smoke still lacks a complete current-source
  pass, so the narrow contract-valid recovery remains owner L01/L02 `6` plus
  permanent smoke `16`, exactly `22`, with shell fail-fast and no retry.
- Fresh authoritative R02 admission at `2026-09-20T13:47:30+05:00`, cutoff
  `12:47:30+05:00`, found no identity-bearing receipt and no unfinished run in
  the rolling hour: usage `0 / 150`, capacity `150`. The complete `6 + 16 = 22`
  block is reserved, projecting `22 / 150` and 128 identities of headroom. C1
  is not scheduled. Admitted source is HEAD
  `bd3233f3916f1280bf9d4bf1e7e2fef51752c182` with working-tree source-manifest
  SHA-256 (excluding this evidence ledger, retained artifacts and exports)
  `c4d6383788dec6b6f4b0b2816a57fb1f94e7eb10cf2ae8060cd41dae0576f2db`.
  No signup probe ran.
- The admitted owner-plus-smoke shell block was dispatched exactly once with
  fail-fast and no retry. Owner receipt `run-0kY1ek` passed L01 and L02 with
  exact signup/identity counts `2 + 4 = 6`; both cases report Auth success,
  owned cleanup, capture `none`, no budget failure and no harness diagnostic.
  L01 therefore covers the corrected lifecycle plus its agreement, rejection,
  response-loss, retry and exhaustion journey, while L02 covers the three- and
  four-voter convergence subflows at the five-second bound. Permanent-smoke
  receipt `run-UaYNvY` then passed G03/G04/G05/G08/H01 with exact counts
  `3 + 4 + 2 + 4 + 3 = 16`, Auth success and owned cleanup for every case.
  Both controller scans and both standalone scans report `3 files / findings
  []`; no managed browser container remains.
- This successful recovery consumed exactly `6 + 16 = 22` identities. Cumulative
  T066 consumption is now `63 + 22 = 85` signup attempts and successful
  identities across every failed, partial and replacement attempt. Final R02 at
  `2026-09-20T13:50:18+05:00`, cutoff `12:50:18+05:00`, counts
  `run-0kY1ek = 6` and `run-UaYNvY = 16`: rolling usage `22 / 150`, capacity
  `128`, with no unfinished run. The earlier T066 attempts have aged out of the
  rolling hour but remain charged in the cumulative T066 ledger.
- T066 is complete. T067–T069 and Feature 009 remain unstarted. Stop here; the
  exact next task is T067, the separate unchanged-source repeatability run two,
  which requires its own fresh R02 admission and exactly `6 + 16 = 22`
  additional identities without rerunning C1.

### T067 — unchanged-source repeatability run two (2026-09-20)

- Before charged execution, HEAD remained
  `bd3233f3916f1280bf9d4bf1e7e2fef51752c182`, Node remained `24.12.0`, npm
  remained `11.6.2`, and the local stack/profile remained
  `anonymous_users=150`, workers `1`, retries `0`, repeatEach `1`, with no
  active owned browser runtime or provider environment. Reconstructing the
  T066 admission manifest with only the post-run T066 checkbox reverted
  reproduced the recorded SHA-256
  `c4d6383788dec6b6f4b0b2816a57fb1f94e7eb10cf2ae8060cd41dae0576f2db`
  exactly. The manifest's current difference was solely the required T066 task
  completion marker; the evidence ledger was excluded by definition. Filesystem
  audit likewise found no implementation or harness write after T066 admission,
  only the T066 task/evidence updates and generated Expo logs. The T066 owner
  plus smoke source and stack were therefore unchanged for T067.
- Fresh authoritative R02 admission at `2026-09-20T14:49:42+05:00`, cutoff
  `13:49:42+05:00`, counted only the still-live T066 smoke receipt
  `run-UaYNvY = 16`, found no unfinished run, and reported usage `16 / 150`
  with capacity `134`. The complete additional owner-plus-smoke block
  `6 + 16 = 22` was reserved, projecting `38 / 150` and 112 identities of
  headroom. No signup probe ran and C1 was not scheduled.
- The admitted fail-fast block ran exactly once with no retry. Owner receipt
  `run-N4JyPN` passed L01/L02 with fresh case contexts and exact signup/identity
  counts `2 + 4 = 6`. Permanent-smoke receipt `run-f0Zrnn` then passed
  G03/G04/G05/G08/H01 with exact counts `3 + 4 + 2 + 4 + 3 = 16`. Every case
  ran as worker `0`, repetition `1`, reported Auth success and owned cleanup,
  and had no budget failure, harness diagnostic, or capture. No HTTP 429
  occurred.
- Both controller scans and both standalone scans reported `3 files / findings
  []`. Both managed browser runtimes were removed, the provider environment was
  absent afterward, and there was no unfinished execution. Check-only
  `npm run db:types:check` reported `consistent`; the generated artifact was not
  regenerated and remained SHA-256
  `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  with inode/size/mtime/ctime
  `11577791 / 20142 / 1789775458 / 1789775459`. `git diff --check` passed.
- T067 consumed exactly 22 signup attempts and 22 successful identities. The
  normative repeatability receipt is T066 run one `1 + 6 + 16 = 23` plus T067
  run two `6 + 16 = 22`, exactly `23 + 22 = 45`; C1 ran once only. Separately,
  the complete charged-attempt ledger including T066's failed, partial, and
  replacement attempts is `85 + 22 = 107` signup attempts and successful
  identities through T067.
- Final R02 at `2026-09-20T14:52:37+05:00`, cutoff `13:52:37+05:00`, counted
  `run-N4JyPN = 6` and `run-f0Zrnn = 16`: rolling usage `22 / 150`, capacity
  `128`, with no unfinished run. The T066 receipts aged out during this block
  but remain preserved in the cumulative ledgers above.
- T067 is complete. T068–T069 and Feature 009 remain unstarted. Stop here; the
  exact next task is T068, the separately admitted fresh-checkout validation.

### T068 — exact-snapshot disposable fresh checkout (2026-09-20)

- Workspace `HEAD` remained the Feature 007 base
  `bd3233f3916f1280bf9d4bf1e7e2fef51752c182`; it was not silently treated as
  the Feature 008 implementation. A temporary candidate repository applied the
  complete reviewed Feature 008 tracked diff plus the explicit non-ignored new
  files, then committed exact candidate
  `222e40884e3df2dd15c4109fff720b47388771f8` with tree
  `f1473547ed6fda6ad0d49b95aefcc8fc9a50ef74`. The 305-file workspace and
  candidate content manifests matched at SHA-256
  `dcabe4b7a2dc8d6c749c830c00543f622a3ce021ab5725498454c73917b41a5e`;
  the candidate Git-tree listing SHA-256 was
  `f6c1dfe490bc907c7776d6efeb819a8361a14de708c295604566d630f04315ae`.
- Following the established procedure, a complete verified Git bundle produced
  a second independent detached checkout at that exact commit. Before setup it
  was clean and contained no modules, local environment, Supabase temporary
  state, Auth/DB/browser state, artifacts, Expo state or exports. Declared
  Node `v24.20.0` and npm `11.19.0` ran `npm ci` against an empty owned cache,
  installed 1,116 packages with a valid dependency tree and no lockfile change,
  and exposed project-local Supabase CLI `2.116.0`, Deno `2.5.2` and Playwright
  `1.63.0`. The pinned Playwright Docker image prepared successfully.
- Fresh `env:local` generated only ignored mode-600
  `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  entries. No service-role key, TMDB token, function environment or prior env
  file entered the checkout. The safe local-stack start/status wrappers passed.
  A planned clean precondition reset replayed all 11 migrations before the
  nonempty validators; this was database evidence, not a quota probe.
- All six protected nonempty migration validators passed in order with zero
  GoTrue signups, `types-unchanged=true`, latest-reset cleanup and zero retained
  owned fixtures. The Feature 008 validator preserved 8 legacy rooms and 11
  decisions, materialized 6 occurrences and proved collecting/agreed/advancing
  classifications plus the initial-empty distinction. All ten historical
  migration hashes remained equal to the T001 ledger. A separate clean latest
  reset replayed all 11 migrations and full pgTAP passed `7 files / 910 tests`.
- Check-only `npm run db:types:check` reported `consistent`; no type generation
  or write ran. In the disposable checkout the canonical artifact remained
  SHA-256 `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`
  with identical before/after inode/size/mtime/ctime
  `1461973 / 20142 / 1789898658 / 1789898658`. Edge passed `42` with the one
  optional live-provider test ignored; full client/config/static/security
  coverage passed `48 suites / 825 tests`; lint and typecheck passed.
- The project has no separate `build` script, so its production build/platform
  gate is the exports. Web export passed with five static routes, and the joint
  iOS/Android export produced both native bundles. `git diff --check`, checkout
  source cleanliness and the final canonical type hash/metadata check passed
  before browser execution. Scanner/security implementation coverage was part
  of the green full client gate; the fresh checkout contained no earlier
  browser artifact to scan.
- Fresh authoritative R02 admission at `2026-09-20T15:14:47+05:00`, cutoff
  `14:14:47+05:00`, counted only T067 receipts `run-N4JyPN = 6` and
  `run-f0Zrnn = 16`, found no unfinished run or active browser/provider runtime,
  and reported usage `22 / 150`, capacity `128`. The complete separate block
  `C1 1 + smoke 16 = 17` was reserved, projecting `39 / 150` and 111 identities
  of headroom. No signup probe, retry, rate-limit change or owner profile ran.
- The admitted fail-fast block ran exactly once. C1 receipt `run-c1Z3MX`
  passed its outer controller: A/B passed, controlled C failed as designed after
  exactly `1 signup / 1 successful identity`, Auth and owned cleanup passed,
  guarded capture and all six artifacts were complete, `budgetFailure=false`,
  and the live registry-backed finalized scan reported `findings: []`. Permanent
  smoke receipt `run-X03oG1` passed G03/G04/G05/G08/H01 with exact counts
  `3 + 4 + 2 + 4 + 3 = 16`; every case reported Auth success, owned cleanup,
  capture `none`, no budget failure and no harness diagnostic. Its controller
  and standalone scans both reported `3 files / findings []`.
- An extra read-only standalone scan of the finalized C1 directory was not used
  as an authority: after the in-memory credential registry had been destroyed,
  it predictably classified the guarded C1 PNG as `unapproved-png`. The
  registry-backed controller scan above is the required C1 scanner boundary;
  the extra result was preserved, not retried, deleted or relabeled. Receipt and
  artifact searches found no HTTP 429, no forbidden capture file and no active
  Playwright, web, Edge or controlled-provider process.
- T068 consumed exactly `1 + 16 = 17` signup attempts and successful identities.
  Final R02 at `2026-09-20T15:17:15+05:00`, cutoff `14:17:15+05:00`, counted
  T067 `6 + 16` plus T068 `1 + 16`: rolling usage `39 / 150`, capacity `111`,
  with no unfinished run. The two finalized safe receipts were preserved in the
  workspace. The temporary candidate repository, verified bundle, detached
  checkout, npm cache and CLI config were removed; both owned Playwright
  runtimes removed themselves and the provider environment was absent. The
  pre-existing shared Supabase stack was not removed because it was not
  T068-owned.
- T068 is complete. T069 and Feature 009 remain unstarted. Stop here; the exact
  next task is T069, the G5 final traceability and scope audit.

### T069 — G5 final traceability, integrity and scope audit (2026-09-20)

- T069 is the final documentation and integrity audit defined by the task
  contract. It started no browser command, signup, R02 block, database reset,
  generated-type command, service or application runtime. The audit re-read the
  constitution, specification, plan, research, data model, all four contracts,
  tasks, requirements traceability, normative testing strategy, implementation
  diff and the complete T001–T068 evidence ledger.
- The exact validated implementation is the T068 disposable-checkout candidate
  commit `222e40884e3df2dd15c4109fff720b47388771f8`, tree
  `f1473547ed6fda6ad0d49b95aefcc8fc9a50ef74`, 305-file workspace/candidate
  content manifest SHA-256
  `dcabe4b7a2dc8d6c749c830c00543f622a3ce021ab5725498454c73917b41a5e`,
  and Git-tree-listing SHA-256
  `f6c1dfe490bc907c7776d6efeb819a8361a14de708c295604566d630f04315ae`.
  The working repository remains `main` at baseline HEAD
  `bd3233f3916f1280bf9d4bf1e7e2fef51752c182`; no commit was created or
  installed. A second audit identity over the current 302 versionable files,
  excluding only this completion ledger, `tasks.md`, and
  `docs/mvp-roadmap.md`, is SHA-256
  `426941b700bd5ebfe83100a563178065ba635b808b6969fc8feb8332bf8eeca2`.
  Those three T069-only documentation files do not alter the validated
  implementation manifest.
- T001–T068 evidence is present and consistent. The ledger contains the T001
  baseline, grouped G1/US1–US5 receipts for T002–T057, acceptance/safety
  authoring receipts for T058–T064, the exact final deterministic gate for
  T065, every failed/partial/replacement T066 attempt, the governing green T066
  run-one receipts, unchanged-source T067 repeatability receipts and the exact
  T068 fresh-checkout receipt. Every referenced concrete `test-results/run-*`
  directory remains present.

Final requirement reconciliation:

| Coverage | Final implementation and executable evidence | Verdict |
| --- | --- | --- |
| FR-001–FR-011 | Fixed Feature 003 voters, exact `N/N` completion, bigint-safe fixed threshold, current-occurrence filtering and order-independent server calculation; migration/pgTAP plus L01/L02 | 11/11 PASS |
| FR-012–FR-015 | One room-locked occurrence outcome, durable agreed handoff, terminal source denial and neutral no-Match UI; pgTAP/Edge/client plus L01 | 4/4 PASS |
| FR-016–FR-023 | Rejection to durable advancing, exact one Feature 006 successor, room-local no-repeat, fresh occurrence decisions and immutable history; migration/pgTAP/Edge/client plus L01/L02 | 8/8 PASS |
| FR-024–FR-029 | Incomplete source work remains retryable, expected-sequence recovery, completed-empty exhaustion, initial-empty distinction and same-identity metadata recovery; pgTAP/Edge/client plus L01/L03 | 6/6 PASS |
| FR-030–FR-033 | Concurrent final voters, replay/lost response, stale clients and delayed-result retirement; deterministic dblink/Edge/client plus owner acceptance | 4/4 PASS |
| FR-034–FR-038 | Shared projection, reload/reconnect/re-entry, pre-existing complete-set migration and creator-role behavior; migration/DB/client plus L01/L02/G08 | 5/5 PASS |
| FR-039–FR-045 | Sole immutable decision path, protected server authority, privacy/masking, fail-closed integrity, frozen membership/filter facts and no-early timing separation; catalog/ACL/RLS/client/static evidence | 7/7 PASS |

Every individual FR row in `requirements-traceability.md` was reconciled to the
implemented migration, Edge, room/candidate/decision client boundary and its
recorded executable proof; no row is missing a mechanism or governing green
result.

| Non-functional requirement | Final proof | Verdict |
| --- | --- | --- |
| NFR-001 atomic authority | Room locks, one-way occurrence outcome and expected-sequence CAS; deterministic races | PASS |
| NFR-002 convergence | L01/L02 all-open-client checks at the five-second bound in both T066 and T067 | PASS |
| NFR-003 recoverability | Reload/reconnect/missed-event/re-entry/lost-response matrices and browser journeys | PASS |
| NFR-004 determinism | Integer threshold truth table `N=2..10`, order/final-voter and replay evidence | PASS |
| NFR-005 source/sequence correctness | Feature 006 regression, exclusions, exact `k+1`, no-repeat and fresh decisions | PASS |
| NFR-006 failure safety | Rollback, incomplete-search no-write, stale/late suppression and terminal immutability | PASS |
| NFR-007 security/privacy | Grant-free protected tables, exact RLS/ACL/masking, G08/L02 and scanner zero | PASS |
| NFR-008 usability/accessibility | Text/live-region states, explicit allowed actions and no gesture/color-only meaning | PASS |
| NFR-009 bounded scope | Structural/diff audit and absence tests for every excluded behavior | PASS |
| NFR-010 future timing compatibility | Threshold helper remains separate from the exact-`N` eligibility gate; no early behavior | PASS |

| Success criterion | Final measurement | Verdict |
| --- | --- | --- |
| SC-001 | All `N=2..10` `T-1`/`T` boundaries and vector `2,2,3,4,4,5,6,6,7` pass | PASS |
| SC-002 | Inevitable/impossible incomplete sets produce zero early outcome/source/terminal | PASS |
| SC-003 | All deterministic final-decision/source races produce one outcome and at most exact `k+1` | PASS |
| SC-004 | L01/L02 already-open clients converge within five seconds with no conflicting authority | PASS |
| SC-005 | Reload/reconnect/re-entry/response-loss recover one canonical outcome without replay | PASS |
| SC-006 | Agreement retains the candidate and produces zero later acquisition/progression | PASS |
| SC-007 | Every successful successor is eligible, distinct, exact next sequence and fresh `0/N` | PASS |
| SC-008 | Stale/delayed work performs zero mutation/replacement/double advance | PASS |
| SC-009 | Retryable source failure and stable completed-empty exhaustion remain visibly distinct | PASS |
| SC-010 | ACL/RLS/G08/L02 checks disclose or change zero protected foreign/peer state | PASS |
| SC-011 | Fixed owner profile is exactly L01=2 plus L02=4, total `F=6` | PASS |
| SC-012 | Acceptance finds zero Match/mode/early/edit/membership/alternate-source behavior | PASS |

Acceptance reconciliation is complete: scenarios 1–8 map to US1 and the
threshold/no-early database matrix plus L01/L02; 9–14 map to US2 and the
successor/history/eligibility Edge and database matrix plus L01/L02; 15–20 map
to US3 and deterministic final-voter/source races plus replay/stale owner
subflows; 21–25 map to US4 and the complete client merge/recovery/privacy matrix
plus L01/L02/G08; and 26–30 map to US5 and source-taxonomy/terminal evidence
plus L01/L03. Thus all 30/30 numbered scenarios are reconciled, and US1, US2,
US3, US4 and US5 each retain the independent vertical demonstration specified
in `tasks.md` (5/5 PASS).

- The larger-group blocker is fully resolved exactly as approved: `T=2` for
  `N=2`, otherwise `(2*N+2) div 3`, fixed and integer-only. SQL evaluates it
  only when the new authoritative detail count equals `N`; incomplete
  inevitable/impossible sets remain collecting. No threshold input, setting or
  mode exists. Feature 007's accepted decisions remain immutable; duplicate and
  conflicting submissions are no-write recovery, not editing.
- Feature 006 remains the only candidate source: the existing
  `room-candidate` Edge Function and TMDB search receive server-derived
  exclusions and use the unchanged filter/locale/adult/metadata rules. There is
  no second endpoint, fixture fallback, client deck, ranking or broadened
  constraint. PostgreSQL remains progression authority through occurrence
  identity, candidate sequence, room locks and expected-sequence commits.
- Candidate occurrence UUID, room-local sequence and decision epoch remain
  distinct. Unique room/sequence and room/TMDB constraints, occurrence-bound
  decision keys, exact `k+1` commits and the canonical projection lattice
  preserve sequence and stale/retry/concurrency invariants. Incomplete or
  malformed source work writes nothing and remains `advancing`; only a complete
  error-free empty traversal may commit `exhausted`.
- Privacy and protected-state boundaries remain intact: occurrence and decision
  tables are RLS-enabled, grant-free and absent from Realtime; source prepare/
  commit is service-role-only; clients read only the safe member room
  projection and their own decision through the approved RPC. Foreign callers
  are masked before the room lock, all protected result shapes are null, and
  finalized scanner findings are zero.
- The application route inventory remains `/`, `/about` and `/room/[code]`.
  No Feature 009 route, Match screen/card/navigation, celebration,
  confirmation or post-match action exists. No dynamic-member mutation,
  decision retraction/update path, alternate source or early outcome was added.
- Migration integrity PASS: the repository has 11 migrations total and exactly
  one Feature 008 migration,
  `20260918000000_candidate_progression.sql` (SHA-256
  `3ff30b48941ac8a5211a55137df3f7d436ad5e431854bc9bf31b6d8d727b1517`).
  All ten historical hashes exactly equal the T001 ledger. Generated types
  remain SHA-256
  `1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067`,
  inode/size/mtime/ctime
  `11577791 / 20142 / 1789775458 / 1789775459`: exactly one legitimate T013
  write and check-only validation thereafter, including T068. `package-lock.json`
  is unchanged (SHA-256
  `4be0c43d5c48603802255539f24aa212d7e64ff8367b7c1fa34fbcf9b1be2504`);
  no dependency declaration changed, and `package.json` adds only the required
  `test:e2e:feature008` script.
- Acceptance/R02 accounting PASS. The preserved pre-feature checkpoint is
  `1+106=107`; the implemented inventory is 46 cases/112 identities and the
  current full projection is `1+112=113`. Normative repeatability is T066 run
  one `1+6+16=23` plus unchanged-source T067 `6+16=22`, exactly `45`; T068 is
  separately `1+16=17`. The complete charged-attempt ledger retains every
  failed/partial/replacement attempt: T066 is 85, T067 is 22 and T068 is 17,
  for 124 actual signup attempts and 124 successful identities. Every charged
  dispatch has a preceding admission record; no HTTP 429, quota probe, Auth
  retry or unadmitted block occurred. The final post-T068 rolling window is
  `39/150`, capacity 111, with no unfinished run.
- All recorded failures are governed. The ledger diagnoses and remediates the
  initial locator/session/fail-fast defects, terminal-decision acknowledgement,
  the real exhaustion SQL ambiguity, state-specific terminal copy, bounded
  diagnostic/response-contract gaps, response-body/document-replacement
  lifecycle races, the stale G04 provider assertion and concurrent non-final
  acknowledgement supersession. Deterministic regression evidence follows each
  correction; final T066 owner `run-0kY1ek` and smoke `run-UaYNvY`, T067 owner
  `run-N4JyPN` and smoke `run-f0Zrnn`, and T068 C1 `run-c1Z3MX` plus smoke
  `run-X03oG1` are green at their governing boundaries. Every named receipt is
  present, cleanup/Auth accounting succeeds, budget failure is false and the
  required controller scanner result is `[]`.
- Cleanup audit PASS: there is no active Playwright, Chromium, E2E, controlled
  provider, Expo/web or Edge-runtime process, no unfinished run marker, no
  owned temporary fresh-checkout/bundle/cache directory and no
  `supabase/functions/.env`. The shared Supabase containers predated T068 and
  were intentionally left running because they were not T068-owned. No owned
  runtime resource remains.
- T069 changes only this final receipt, the T069 checkbox in `tasks.md`, and the
  Feature 008 completion/larger-group status in `docs/mvp-roadmap.md`. No
  implementation, test, migration, generated type, dependency, lockfile or
  Feature 009 file changed. No commit, tag, branch switch or push was created.

T001–T069 are complete: 69/69 checked and zero unchecked. G5 final verdict:
**PASS — exact implementation identity preserved; 45/10/12/30/5 traceability,
migration/types/dependency integrity, charged evidence, scope exclusions,
privacy and cleanup all reconcile; Feature 008 is complete.**

The exact next repository state is Feature 008 complete on the existing dirty
`main` worktree at baseline HEAD with its validated implementation plus final
completion documentation. Feature 009 remains PLANNED and unstarted; no Feature
009 task, code, route, test, migration or acceptance run has begun.
