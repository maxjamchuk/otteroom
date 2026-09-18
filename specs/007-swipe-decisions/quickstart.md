# Quickstart: Validate Swipe Decisions

**Feature**: 007 — Swipe Decisions

**Status**: Complete; the planning-time validation procedure and final Feature
007 implementation evidence are recorded below.

## Implementation Evidence Ledger

### Protected baseline — 2026-09-16 (T001)

- Branch/HEAD: `main` at `88cba4f8dd38f1718af7d5a6e59e79d599fac0af`.
- Worktree: clean (`git status --porcelain=v1` returned no entries).
- Declared toolchain: Node `24.20.x`, npm `11.19.0`, Supabase CLI `2.116.0`,
  Deno `2.5.2`.
- Host toolchain: Node `v24.12.0`, npm `11.6.2`, installed Supabase package
  `2.116.0`, Deno `2.5.2` (V8 `14.0.365.5-rusty`, TypeScript `5.9.2`).
- Browser baseline: the implemented E/G/H/I/J inventory is 42 cases and 100
  identities, as recorded by `docs/testing-strategy.md`; Feature 007 begins
  with planned K01/K02 additions only.
- No dependency, historical migration, Feature 006 sorting, or generated type
  changed before this receipt. The canonical generated type baseline is
  SHA-256 `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`
  (inode `11569023`, size `13789`, mtime/ctime `1789549577`).

Historical migration SHA-256 receipt:

```text
d6222184274428c6dd5d629e4d3416a582e0a74f355c8c6fe1d389630ecad439  20260905000000_rooms_schema.sql
fda4126812feffb7bac5d737d6faae1930db35bbc26a1cb9402fcbad24b5b45c  20260905000001_room_rpcs.sql
71816083a6e1630ab663fa4fd41354b936efa714571809fffca4528f2312f7a9  20260905000002_rooms_realtime.sql
04487a75fadafe40a255f9ab3998b64c1109c9de6f4e4324ba441f8856531c38  20260909000000_movie_candidates_schema.sql
1b78eeb52ce9bb194b9530f48b49428b8f5bb7c523ab22d5406e9814d0e8dc52  20260909000001_room_candidate_rpc.sql
9813e830957f82febe184e54a5148faff159f046912b325b0a77d835ae33a71f  20260910000000_generalized_room_membership.sql
432c6d41ca37d0ea2b3ad00324854c3ec17338f3b6c21a4c4cfe3946c1c54ff0  20260911000000_participant_filters.sql
10986dc43cad50668e520f16b2c3dbbd44e4cebb1384afb0cb2cfd5798898f1d  20260912000000_common_filter_resolution.sql
52ab29707d8d6bdf04d888d4578fab92c92c805c3151ede710dc3992c5ac2640  20260914000000_tmdb_candidate_source.sql
```

Planned green-checkpoint ledger:

| Gate | Evidence boundary | Status |
| --- | --- | --- |
| G1 | Database authority, nonempty migration, generated types, room projection | PASS |
| G2 | Coherent US1–US3 submission, immutable winner, and lifecycle recovery | PASS |
| G3 | Accessible input, completion, and exact-two product boundary | PASS |
| G4 | Reserved; no separate checkpoint is defined by the approved task plan | N/A |
| G5 | Cross-story browser, security, repeatability, fresh-checkout release evidence | PASS |

### G1 foundation receipt — 2026-09-16 (T003–T018)

- Nonempty migration chain: `check-room-membership-migration.mjs`,
  `check-participant-filters-migration.mjs`,
  `check-common-filter-resolution-migration.mjs`,
  `check-tmdb-candidate-migration.mjs`, and
  `check-swipe-decisions-migration.mjs` all returned `result=PASS` through the
  pinned Supabase CLI 2.116.0. The Feature 007 runner preserved 8 rooms, 18
  memberships, 5 resolution parents, 4 fixture candidates, row `xmin` values,
  all historical migration hashes, and the pre-generation type hash; it used
  zero GoTrue signups and restored a clean latest reset.
- Clean replay: `npm run db:reset` applied all ten migrations through
  `20260916000000_swipe_decisions.sql` successfully.
- Database authority: full recursive pgTAP passed with `Files=6, Tests=929`.
  The new focused suite contributed 44 catalog, ACL, RLS, projection,
  authorization, idempotency, privacy, exact-two, larger-room, and no-candidate-
  mutation assertions.
- Sole generated-type write: `npm run db:types` changed the canonical artifact
  from SHA-256 `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`
  to `6aecffdf46565a5b393affce0f627f9712e2082b66a3fada23c33d1cc9271a7c`
  (inode `11577515`, size `15953`, mtime `1789560267`, ctime `1789560268`).
  Review confirmed the enum, grant-free table, room/create/join watermark, and
  exact get/submit RPC signatures.
- Independent check-only receipt: after a separate latest reset,
  `npm run db:types:check` returned `consistent`; SHA, inode, size, mtime, and
  ctime remained exactly unchanged.
- Room/config cutover: 266 focused assertions passed; full room projection is
  twelve fields for create/join and nine fields for refetch, rejected joins
  remain all-null, decision progress merges monotonically, and the existing
  one-channel invalidation lifecycle is unchanged. Lint, typecheck, and
  `git diff --check` passed.
- Corrected exact field counts: create/join `12`, direct room refetch `9`.

G1 verdict: **PASS**. PostgreSQL authority and the public room projection are
coherent, private, migration-proven, and typed. G2–G5 remain pending.

### US1 independent-decision receipt — 2026-09-16 (T019–T029)

- Red evidence: contract/service, state/hook, and surface suites separately
  failed on their missing modules before implementation. The official Gesture
  Handler utilities and Reanimated mock use the package-provided Worklets Jest
  resolver; no application timer, promise, accessibility property, or service
  call is globally replaced.
- Strict boundary: 41 contract/service assertions prove exact six-field rows,
  closed outcomes, protected all-null results, count/completion invariants,
  exact-two versus larger-room policy, private-field rejection, exact RPC
  arguments, bootstrap ordering, positive target identity, and safe errors.
- State and input: generation-keyed transitions keep pending intent
  non-authoritative. All four recognizable poster presentations recover before
  input; acquisition, metadata, empty, and integrity states withhold it. Fixed
  voters, voting creators, and aggregate-only observers are separately tested.
- Equivalent first choice: functional Pan releases at the 360px threshold map
  right to `yes` and left to `no` exactly once, while a sub-threshold release is
  a no-op. Persistent labeled controls use the same guarded submit path. Route
  tests preserve title/year and the canonical candidate, prove voting-creator
  parity, exclude observer controls, and observe no repeated acquisition,
  navigation, progression, or match effect. Focused decision/route evidence
  passed 6 suites / 94 assertions.
- Regression gates: full client passed 45 suites / 751 assertions; full pgTAP
  passed 6 files / 929 assertions. Lint, typecheck, `git diff --check`, web
  static export (five routes), iOS export, Android export, and check-only types
  all passed.
- The generated type artifact remained byte-identical at SHA-256
  `6aecffdf46565a5b393affce0f627f9712e2082b66a3fada23c33d1cc9271a7c`
  (inode `11577515`, size `15953`, mtime `1789560267`, ctime `1789560268`).

US1 verdict: **PASS**. Independent first yes/no submission works on the
unchanged candidate. Immutable race/response-loss and lifecycle guarantees
remain pending in US2/US3, so G2 is not yet claimed.

### US2 immutable-winner receipt — 2026-09-16 (T030–T036)

- Four real READ COMMITTED dblink trials used owner-held room locks,
  `pg_blocking_pids`, ungranted-lock observations, and bounded deadlines. The
  captured backend triples were same-yes `2293/2294/2295`, same-no
  `2296/2297/2298`, opposite `2299/2300/2301`, and distinct-voter
  `2302/2303/2304` (owner/caller A/caller B). Both callers reached the lock
  boundary before release; the second then waited only on the first transaction.
- Same-yes and same-no produced one `accepted`, one `unchanged`, one private row,
  one room increment, and exact per-session table-write deltas. Opposite values
  produced one `accepted`, one `conflict`, and the same stored winner in both
  replies. The preexisting sequential proof retained accepted timestamp and
  detail/room `xmin` across unchanged/conflict no-write paths.
- The distinct-voter trial attributed one row to each fixed member and observed
  count results `1` and `2`, two private inserts and two room updates. A held
  target room did not delay an unrelated-room acceptance. A post-insert/count
  transaction rollback preserved zero/zero; a discarded committed response was
  recovered by private read and opposite retry; bounded cancellation added no
  write. All random fixtures and dblink backends were removed.
- Candidate identity remained `7701`/`7801` in the bounded in-database snapshots;
  no acquisition, progression, request ledger, mutation, or match operation was
  introduced. Client tests prove synchronous one-flight guarding, contradictory
  response rejection, authoritative conflict adoption, uncertain precommit or
  malformed failure, explicit lost-acknowledgement reconciliation, disabled
  controls, actionable Retry, and stable candidate content.
- Focused decision/route evidence passed 6 suites / 105 assertions. Full pgTAP
  passed 6 files / 940 assertions and full client passed 45 suites / 762
  assertions. Lint, typecheck, web/iOS/Android exports, `git diff --check`, and
  `db:types:check` passed; generated types remained check-only.

US2 verdict: **PASS**. Sequential, overlapping, failed, cancelled, and
response-lost requests converge on one immutable stored winner. Lifecycle
recovery remains pending in US3, so G2 is still not claimed.

### US3 lifecycle-recovery / G2 receipt — 2026-09-16 (T037–T043)

- Private recovery now covers own yes/no, undecided voters, aggregate-only
  observers, discarded acknowledgements, foreign/missing equality, not-ready
  and stale-ID zero-write results, and deliberate detail/count corruption that
  fails closed. Exact six-field JSON proves no peer identity, value, or
  timestamp is returned.
- Real READ COMMITTED ordering trials captured owner/reader/writer PIDs
  `2695/2696/2697` in the final full gate. Read-first returned a coherent
  pre-submit projection and held the writer; submit-first held the reader until
  it returned one coherent post-submit projection. A foreign reader returned
  masked `not_found` while the target row remained locked and never entered its
  wait queue. Final state remained two rows/count two on candidate `7901`.
- The one existing ID-only `rooms` channel recovers missed updates on
  `postgres_changes` system-ok, coalesces bursts to one follow-up, merges the
  decision count monotonically, preserves last-good state, and tears down before
  rebinding. There is no decision-table subscription, polling, Presence, or
  Broadcast path.
- The hook retains a safe last-known projection while privately rereading after
  count advancement or explicit synchronization, coalesces same-generation
  recovery, permits a new generation while an old submit retires, and ignores
  stale success/error work and post-unmount results. Route synchronization Retry
  refreshes room plus private authority without reacquiring or changing the
  displayed candidate; observer, reload/re-entry, and recognizable-state gates
  remain intact.
- Focused lifecycle evidence passed 5 suites / 129 assertions. Full pgTAP passed
  6 files / 949 assertions and full client passed 45 suites / 768 assertions.
  Lint, typecheck, web/iOS/Android exports, `git diff --check`, and check-only
  generated types all passed.

G2 verdict: **PASS**. First submission, immutable convergence, and lifecycle
recovery form one coherent P1 cutover with no foreign disclosure or candidate
divergence.

### US4 mobile/web equivalence receipt — 2026-09-16 (T044–T048)

- Gesture tests cover exact one-pointer, `[-12,12]` activation, `[-24,24]`
  vertical failure, widths selecting 72/90/120-point clamped thresholds, and
  inclusive 1.25 dominance edges. Right remains `yes`, left remains `no`;
  below-threshold, just-nondominant, vertical, cancelled, failed, multi-touch,
  and disabled paths submit nothing. Repeated delivery is stopped by the tested
  synchronous hook one-flight guard.
- Translation/rotation feedback remains on the Reanimated path; accepted,
  cancelled, and failed completion reset through `withSpring(0)` with
  `ReduceMotion.System`. The deterministic official package mocks verify the
  system-reduced-motion option without using pixel timing.
- Persistent No/Yes Pressables have exact meaningful labels, button semantics,
  focusability, at least 44-point targets, stable reading order, disabled/busy
  state, and the shared activation path used by touch and standard web
  Enter/Space handling. Confirmed, recovered-conflict, and actionable-failure
  meaning is carried by polite live text rather than direction, position,
  animation, or color.
- The complete component/route matrix passed 2 suites / 52 assertions; full
  client passed 45 suites / 783 assertions. Lint, typecheck, `git diff --check`,
  web/iOS/Android exports, and check-only generated types passed. Browser-level
  focus-ring screenshots are intentionally omitted because capture-off is the
  governing diagnostic policy; semantic focusability and web export are the
  deterministic gate here, with real keyboard acceptance reserved for K01.

US4 verdict: **PASS**. Touch gestures, visible controls, keyboard semantics,
assistive text, and reduced-motion presentation express the same two values.

### US5 exact-two agreement / G3 receipt — 2026-09-16 (T049–T053)

- Red-first database and client cases covered incomplete exact-two rooms, the
  complete yes/yes, yes/no, no/yes, and no/no truth table, larger-room partial
  and complete projections, neutral presentation, and the unchanged candidate.
- The focused pgTAP decision suite passed 75 assertions. Exact-two agreement is
  false at zero or one decision, true only for two yes rows, and false for every
  complete pair containing no. A three-voter room reports `3/3` completion with
  null agreement. The catalog proves no stored agreement column; all trials
  retained candidate/status authority and used the existing RPC boundary.
- Focused contract/state/surface/route evidence passed 102 assertions. Progress
  is rendered as an aggregate only; exact-two agreement copy is factual and
  neutral, larger-room policy is absent, and state adopts rather than infers the
  authoritative projection. No celebration, next-candidate, match, navigation,
  peer answer, or peer identity is introduced.
- Full pgTAP passed 6 files / 960 assertions; full client passed 45 suites / 794
  assertions. The controlled Feature 006 Edge regression passed 40 tests with
  one live-upstream test intentionally ignored. Lint, typecheck, web/iOS/Android
  exports, `git diff --check`, and check-only generated types all passed.
- The generated type artifact remained byte-identical at SHA-256
  `6aecffdf46565a5b393affce0f627f9712e2082b66a3fada23c33d1cc9271a7c`
  (inode `11577515`, size `15953`, mtime `1789560267`, ctime `1789560268`).

G3 verdict: **PASS**. Completion and exact-two agreement are observable facts
on the current candidate only; Feature 007 adds no progression or match policy.

### Final non-browser receipt — 2026-09-16 (T054–T061)

- Added the bounded real-stack decision harness, K01/K02 acceptance cases,
  override-free Feature 007 profile, direct J03 cap, sanitized K receipts, and
  post-feature 44-case / 106-identity inventory. Red-first profile tests failed
  on the absent mode, case mapping, performance fields, spec, and scanner rules;
  the finalized configuration/diagnostic group passed 55 assertions.
- The capture-off static security profile passed A/B with zero signups, three
  finalized safe artifacts, scanner findings `[]`, and owned Playwright runtime
  cleanup. The pinned `mcr.microsoft.com/playwright:v1.63.0-noble` image was
  prepared through `npm run playwright:install` before this zero-identity run.
- All five nonempty runners passed in order: room membership (3 rooms),
  participant filters (4), common resolution (4), TMDB candidates (6), and
  swipe decisions (8). They used zero GoTrue signups, preserved their bounded
  fixtures/historical hashes/types, and each restored latest schema with zero
  owned fixtures.
- `npm run db:reset` cleanly replayed all ten migrations. Full pgTAP passed 6
  files / 960 assertions; final dblink PIDs were same-yes `424/425/426`, same-no
  `427/428/429`, opposite `430/431/432`, distinct-voter `433/434/435`, and
  read-vs-submit `440/441/442`.
- Focused decisions/rooms/route passed 12 suites / 379 assertions; full client
  passed 46 suites / 800 assertions. Edge passed 40 with the optional live TMDB
  contract intentionally ignored. Lint, typecheck, web export (five routes),
  iOS/Android export, and `git diff --check` passed.
- `db:types:check` was check-only and consistent. The canonical generated type
  remains SHA-256 `6aecffdf46565a5b393affce0f627f9712e2082b66a3fada23c33d1cc9271a7c`
  (inode `11577515`, size `15953`, mtime `1789560267`, ctime `1789560268`); no
  second generation occurred. The live upstream TMDB contract was not run
  because no live-token/upstream validation was required for decision authority.

T061 verdict: **PASS**. The exact working source is ready for the identity-
charged normal browser block; no charged browser identity has yet been used.

Run commands from the repository root after the implementation supplies the
planned migration, client modules, tests, harness and package profile. A command
listed here is not evidence until its exact result is recorded from the
implementation commit.

## 1. Prerequisites

- repository-declared Node.js 24.20.x and npm 11.19.0;
- Docker Engine and Supabase CLI 2.116.0 through the project lockfile;
- Deno 2 for the preserved Feature 006 Edge tests;
- Playwright Chromium through the repository's safe Docker wrapper; and
- a separately provisioned `TMDB_API_READ_ACCESS_TOKEN` only for the optional
  live provider contract and local Edge runtime that needs it.

Never expose the TMDB token or a Supabase server key through `EXPO_PUBLIC_*`,
test output, traces or receipts. Feature 007 adds no secret and no dependency.

Confirm the implementation remains consistent with [the plan](plan.md),
[data model](data-model.md), [research decisions](research.md) and all
[contracts](contracts/). In particular, candidate progression, larger-group
agreement policy and match UX must still be absent.

## 2. Clean Setup

```sh
npm ci
npm run playwright:install
npm run supabase:start
npm run env:local
npm run supabase:status
```

Expected: the local Auth, Data API, PostgreSQL and Realtime services are healthy;
only public local client values are configured. Start the existing local
`room-candidate` Edge runtime according to Feature 006 when running browser
acceptance. The E2E harness controls the external TMDB HTTP boundary; it must not
replace PostgreSQL/Auth/Realtime or the application decision RPCs.

## 3. Nonempty Migration Evidence

With an owned idle local stack, run every retained upgrade validator plus the
new Feature 006→007 validator:

```sh
npm run db:reset
node scripts/check-room-membership-migration.mjs
node scripts/check-participant-filters-migration.mjs
node scripts/check-common-filter-resolution-migration.mjs
node scripts/check-tmdb-candidate-migration.mjs
node scripts/check-swipe-decisions-migration.mjs
```

`check-swipe-decisions-migration.mjs` must start from exact migration
`20260914000000`, create nonempty controlled Feature 006 fixtures without GoTrue
signups, apply the real pending migration and verify:

- waiting, partial, compatible/assigned, no-candidates and both creator-role
  forms preserve all preexisting values required by their contracts;
- every existing room receives `decision_completed_count = 0`;
- no decision row, yes/no value, agreement or new candidate is invented;
- the enum/table/keys/checks/owner/RLS/ACL/RPC signatures are exact;
- authenticated create/join/re-entry projections contain the zero count;
- historical migration files and the canonical generated type file remain
  byte-unchanged during the migration check; and
- owned fixtures are removed and a latest clean reset is restored on success,
  failure or interruption.

The runner must refuse competing application/browser traffic and must not
generate types. Migration tests use synthetic SQL Auth rows and consume zero
R02 signup identities.

## 4. Database Authority and Concurrency

```sh
npm run db:reset
npm run db:test
```

Record actual pgTAP assertion totals. Required evidence includes:

| Area | Required proof |
| --- | --- |
| Schema | Exact enum, relation, PK/FK/check/default, room field/check, grants, RLS, owners and absence from Realtime publication. |
| Authorization | Auth-derived caller; voter success; voting-creator parity; non-voting creator rejection; foreign/missing equality; no direct detail access or function execution by `anon`. |
| Candidate binding | Assigned compatible candidate only; expected-ID compare; pending/no-candidates/mismatched ID produce zero writes; Feature 006 fields never change. |
| Idempotency | First yes/no accepted; same repeats unchanged; opposite repeat conflict; exactly one row/count; timestamp/xmin unchanged on no-write outcomes. |
| Atomicity | Injected faults before/after detail insert or count update roll back both; retry succeeds; count/detail coherence is checked. |
| Recovery | Commit with discarded response, then private read/retry returns the same winner without another row/count; a read concurrent with submit returns one coherent old or new projection without a false integrity error. |
| Privacy | Own value plus safe aggregate only; no peer answer/identity/timestamp; larger-room agreement always null. |
| Exact two | Incomplete false; yes/yes true; yes/no and no/no false; completion count reaches 2 exactly. |

Concurrency tests use pgTAP+dblink with distinct authenticated sessions and
bounded lock barriers, not sleeps:

1. Hold the target room row, dispatch real same-voter submissions and prove
   both are blocked before release.
2. For same/same and yes/no races, collect both results and prove one immutable
   row, one count increment and the documented recovery outcome.
3. For different voters in the same room, hold the room row until both real
   requests reach the authoritative transaction boundary, then prove both
   eventually commit separately attributed rows and the count advances twice.
   After boundary arrival, completion requires no further user action, client
   connectivity or acknowledgement from either voter; only bounded database
   transaction serialization may delay it.
4. Run authorized recovery before and during an uncommitted submission and
   require one coherent pre-submit or post-submit projection with no mixed
   detail/count state or false integrity error. Prove a foreign recovery returns
   masked `not_found` without joining the target room's lock queue.
5. Hold one room while a submission in an unrelated room completes.
6. Snapshot row/count/timestamps/xmin to prove duplicates, conflicts, rejects
   and private reads make no writes.
7. Bound cancellation, drain, rollback and fixture cleanup on every path.

## 5. Generated Types: One Intentional Write

Only after the final migration/RPC contract and database tests are green:

```sh
npm run db:reset
npm run db:test
npm run db:types
npm run db:types:check
```

This is the one intentional generated-types write. Review
`src/types/database.generated.ts` for the new enum, room field and exact RPC
signatures. The grant-free decision table may appear in generated schema types,
but application code must access decisions only through RPCs.

Every later validation, repeatability run and fresh checkout uses check-only:

```sh
sha256sum src/types/database.generated.ts
stat -c '%i %s %Y %Z' src/types/database.generated.ts
npm run db:reset
npm run db:types:check
sha256sum src/types/database.generated.ts
stat -c '%i %s %Y %Z' src/types/database.generated.ts
```

Require equal hashes and unchanged canonical inode/size/timestamps across the
check. Do not precede a normal check with another write or hand-edit the file.

## 6. Client, Edge Regression and Export Gates

Run focused Feature 007 tests first, then the full gates:

```sh
npm run test:client -- __tests__/decisions __tests__/rooms __tests__/routes/room.test.tsx
npm run test:edge
npm run lint
npm run typecheck
npm run test:client
npm run db:types:check
npm run web:export
npx expo export --platform ios --platform android --output-dir dist/native-validation
git diff --check
```

Required client proof:

- exact parsing for all get/submit outcomes and malformed/extra payloads;
- room projection count validation and rooms-only invalidation/refetch;
- voter/non-voter gating across every Feature 006 presentation state;
- right=yes, left=no, deterministic thresholds, diagonal/vertical/cancel reset;
- always-visible labeled buttons, keyboard use, focus/disabled/live status and
  reduced-motion behavior;
- one-flight submission and no optimistic success;
- accepted, unchanged, conflict, lost-response and explicit retry/recovery;
- reload/reconnect/re-entry private recovery for both values;
- stale room/candidate generation suppression; and
- zero acquisition, next-candidate, larger-group policy or match side effect.

`test:edge` is a regression gate: Feature 007 should not change Feature 006
acquisition/Discover behavior. Run `npm run test:tmdb:contract` once when a live
token and upstream availability are part of release validation; it consumes no
Auth identity and is not needed to prove decision authority.

## 7. Safe Browser Acceptance

The implementation adds `npm run test:e2e:feature007` as a fixed safe profile
for exactly K01/K02, with one worker, zero retries, one repeat, capture-off
diagnostics, finalized artifact scanning and owned cleanup.

```sh
npm run test:e2e:security
npm run test:e2e:feature007
npm run test:e2e:smoke
npm run test:e2e -- --grep J03
```

| Case | Cap | Real-stack evidence |
| --- | ---: | --- |
| K01 | 2 | Voting creator plus voter share one candidate; mobile touch swipes and desktop keyboard buttons map yes/no; all exact-two outcomes across bounded rooms; independent order, duplicate/conflict, committed-response loss, reload/reconnect/re-entry and unchanged candidate. |
| K02 | 4 | Non-voting creator plus three voters; creator has no control; voters decide concurrently without waiting; N/N completion is visible but agreement remains absent; private answers do not leak and the candidate stays unchanged. |
| Owner total `F` | **6** | Exact K01/K02 maximum. |

K01 also owns the controlled healthy local responsiveness profile. With local
services already healthy and warmed, assigned recognizable candidates already
displayed, one worker, serial execution and no injected fault, reuse the same
two identities across 10 preassembled assigned rooms. Measure exactly 20 first-
decision attempts from eligible control activation or qualifying gesture
completion until the validated authoritative decision result is rendered.
Require at least 19 samples at or below 2,000 milliseconds. Record sample count,
passing count and maximum duration. Any actionable recoverable failure is
recorded separately, does not count as a passing sample and invalidates the
controlled performance run. Assembly, acquisition, navigation and metadata
loading are outside the measurement interval; no percentile is a release gate.

Permanent smoke remains exactly G03/G04/G05/G08/H01 at 16 identities. Targeted
J03 runs once at two identities because its assigned candidate cycles through
poster loading, poster error and no-poster fallback, which directly controls
whether Feature 007 input remains available. No other historical case is added
to the normal gate.

Every browser case must compare canonical candidate identity through bounded
in-memory harness evidence, never by displaying/internal-ID scraping. It must
attach signup accounting before navigation, prohibit credential-bearing
artifacts, prove cleanup and preserve the safe diagnostic allowlist.

## 8. R02 Admission and Receipts

Reserve the complete identity budget before starting a browser block. Count
failed, partial and manual signups; reset/restart/cleanup does not restore quota.
Do not probe Auth capacity, retry an HTTP 429, raise the local limit, export
storage state or reuse identities across independently specified cases.

| Gate | Formula | Reserved identities |
| --- | --- | ---: |
| Normal | C1 `1` + smoke `16` + owner `6` + targeted J03 `2` | **25** |
| Repeatability | C1 `1` + 2 × (smoke `16` + owner `6`) + J03 `2` | **47** |
| Fresh checkout | C1 `1` + smoke `16` | **17** |
| Repeatability + fresh | `47 + 17` | **64** |

Receipts record command/profile, discovered case labels, per-case maxima, actual
attempts, successful identities, timestamps, scanner result and cleanup result.
All normal profiles retain `workers=1`, `retries=0`, `repeatEach=1`.

### R02 normal-block receipt — 2026-09-16 (T062)

- The required successful block retained the admitted formula
  `C1 1 + Feature 007 6 + smoke 16 + J03 2 = 25`. C1 completed at
  `18:24:29 +05` with its expected controlled failure, one successful anonymous
  identity, complete owned cleanup and zero scanner findings.
- On the final source state, `npm run test:e2e:feature007` completed at
  `20:38:53 +05`: discovered exactly K01/K02, charged `2 + 4 = 6`, passed both,
  cleaned both contexts and produced zero scanner findings. K01 recorded exactly
  20 samples, 20 at or below 2,000 ms, maximum 108 ms and zero recoverable
  failures. Candidate identity remained unchanged; decision traffic caused no
  provider call or progression/match state.
- `npm run test:e2e:smoke` completed at `20:40:12 +05`: exactly
  G03/G04/G05/G08/H01, `3 + 4 + 2 + 4 + 3 = 16` identities, all five passed,
  every context cleaned and scanner findings remained zero. G04 converged to
  `3 of 3` decisions for its non-voting observer with null larger-group policy,
  unchanged candidate and zero controlled-provider calls.
- The final-source `npm run test:e2e -- --grep J03` receipt at `20:37:36 +05`
  discovered only J03, charged exactly two identities and passed with cleanup
  complete and zero findings. It retained the two reused identities, bounded
  acquisition failures, response-abort/assigned recovery, metadata variants,
  poster retry and null-poster controls; the provider invalid counter was zero.
- Debugging remained charged. There are 43 identity-bearing safe summaries
  totaling 155 identities plus one interrupted two-identity K01 diagnostic,
  for 157 cumulative attempts. The 132 identities above the required 25 are
  explicitly retained as failed/focused rerun cost; no reset, restart or cleanup
  was treated as quota recovery. The interrupted run emitted no final scanner
  receipt, and its owned temporary function environment file and isolated
  browser container were removed manually. Every finalized summary reports
  `budgetFailure=false`; no HTTP 429 occurred. The controller remains fail-stop
  on HTTP 429 and no retry/reset path was used to evade quota.
- At `20:40:25 +05`, rolling usage was 134 and only 16 identities remained.
  T063 is therefore not admitted yet; the calculated first recovery point with
  at least 107 identities available is approximately `21:20:35 +05`.

T062 verdict: **PASS** for the exact final-source normal block. Retry traffic is
recorded separately and remains charged for rolling-window admission.

### T063 full-checkpoint admission hold — 2026-09-16

- A fresh R02 calculation at `20:50:12 +05` used the conservative finalized
  safe-summary timestamps for every attempt in the preceding hour. The rolling
  window contained 36 summaries totaling 130 identities; the interrupted
  two-identity diagnostic had already aged out. Capacity was therefore only
  `150 - 130 = 20`, below the required `106 + C1 1 = 107`, so T063 was not
  admitted and no browser command or signup probe was started.
- The conservative recovery schedule first reaches the admission ceiling after
  the two-identity summary completed at `20:20:35 +05` ages out: no earlier
  than `21:20:36 +05`, rolling safe usage is 42 and capacity is 108. A new
  calculation remains mandatory at that time because any intervening traffic
  must also be counted.
- This hold produced no HTTP 429, artifact, or identity attempt. No Playwright
  container or active browser harness remained, and
  `supabase/functions/.env` was absent. T064 was not started.

### T063 full-checkpoint receipt — 2026-09-16

- A new R02 calculation at `21:32:35 +05` found five finalized summaries and
  28 identities in the preceding hour. Capacity was `150 - 28 = 122`, so the
  complete `C1 1 + full acceptance 106 = 107` block was admitted without
  relying on the earlier recovery estimate.
- `npm run test:e2e:security` completed at `21:33:11 +05` with its expected
  controlled inner failure and controller pass. It used exactly one successful
  identity, finalized six safe artifacts with scanner findings `[]`, completed
  owned cleanup, and removed its Playwright container.
- `npm run test:e2e` completed at `21:40:08 +05` and discovered exactly 44
  cases with 106 signups/identities, one worker, zero retries and one
  repetition. The result was **FAIL**: 33 cases passed and 11 failed. The failed
  labels were I01, I03, H02, H03, E11, E05, E06, E12-mutation, E09, J01 and
  J02. K01, K02 and J03 passed; K01 retained exactly 20 performance samples,
  20 at or below 2,000 ms, maximum 113 ms and zero recoverable failures.
- Every case reported owned cleanup true, capture `none`, zero capture attempts
  and `budgetFailure=false`. The controller finalized 14 safe artifacts with
  scanner findings `[]`, reported only ordinary `E2E_FAILURE` categories, and
  removed its Playwright container. No HTTP 429 occurred and no retry or signup
  probe was attempted.
- T063 consumed exactly 107 identities. At `21:40:31 +05`, rolling usage was
  107 and remaining capacity was 43. That is below T064's standalone
  47-identity reservation (and its optional combined 64-identity reservation),
  so T064 was not started. Conservatively, expiry of C1 at `22:33:12 +05`
  leaves only 44 available; the earliest T064 standalone or combined admission
  point is after the full summary expires, no earlier than `22:40:10 +05`,
  subject to another fresh calculation and any intervening traffic.
- No browser process or container remained and `supabase/functions/.env` was
  absent. T063 remains incomplete, and no implementation SHA was created.

T063 verdict: **FAIL**. The admitted full checkpoint finalized safely but did
not preserve the complete E/G/H/I/J acceptance inventory; it was not retried.

### T063 full-checkpoint reattempt receipt — 2026-09-17

- A fresh R02 calculation at `02:34:59 +05` found zero identities in the
  preceding hour and the full capacity of 150 available. The complete
  `C1 1 + full acceptance 106 = 107` block was therefore admitted independently
  of every prior estimate and receipt.
- `npm run test:e2e:security` completed at `02:35:26 +05` with its expected
  controlled inner failure and controller pass. It used exactly one successful
  identity, finalized six safe artifacts with scanner findings `[]`, completed
  owned cleanup, and removed its Playwright container.
- `npm run test:e2e` completed at `02:42:21 +05` and again discovered exactly
  44 cases with 106 signups/identities, one worker, zero retries and one
  repetition. The result was **FAIL**: 33 cases passed and the same 11 cases
  failed—I01, I03, H02, H03, E11, E05, E06, E12-mutation, E09, J01 and J02.
  K01, K02 and J03 passed; K01 retained exactly 20 performance samples, 20 at
  or below 2,000 ms, maximum 92 ms and zero recoverable failures.
- Every case reported owned cleanup true, capture `none`, zero capture attempts
  and `budgetFailure=false`. The controller finalized 14 safe artifacts with
  scanner findings `[]`, reported only ordinary `E2E_FAILURE` categories, and
  removed its Playwright container. No HTTP 429 occurred and no retry or signup
  probe was attempted.
- This reattempt consumed exactly 107 identities. At `02:42:39 +05`, rolling
  usage was 107 and remaining capacity was 43. Expiry of C1 after
  `03:35:27 +05` leaves only 44 available, still below T064's standalone 47;
  the earliest conservative quota-only admission point for either the 47- or
  64-identity T064 reservation is after the full summary expires, no earlier
  than `03:42:22 +05`, subject to a fresh calculation and intervening traffic.
- No browser process or container remained and `supabase/functions/.env` was
  absent. T063 remains incomplete, T064 was not started, and no implementation
  SHA was created.

T063 reattempt verdict: **FAIL**. The same 11 historical acceptance cases
failed on the unchanged implementation, while the Feature 007 K cases and J03
remained green; no additional charged attempt was made.

### T063 failure-diagnosis and targeted-remediation receipt — 2026-09-17

- Preserved safe artifacts from both full failures identified two harness
  groups rather than a Feature 007 authority/product regression. E11, E05,
  E06, E12-mutation and E09 rejected the additive twelve-field join projection
  at the exact old nine-field key inventory. I01, I03, H02 and H03 retained the
  pre-Feature-006 assumption that compatible resolution could emit no candidate
  acquisition request; reused pages then compared cumulative traffic from an
  older room. J01 depended on three provider sockets being simultaneously held
  instead of explicitly proving three browser-to-Edge dispatches, and its
  timeout path did not release the provider hold before J02.
- The minimal remediation keeps every historical room/filter/resolution oracle:
  rejected and repeated joins now validate all twelve exact fields and compare
  the three evolved aggregate/status fields with the stored room projection;
  candidate traffic is scoped by room; H/I later-feature requests are contained
  and drained without changing PostgreSQL candidate state; and J01/J02 use an
  explicit three-client Edge-request barrier. J01 still requires three
  authenticated concurrent Edge dispatches, one canonical winner, bounded
  controlled-provider traffic, shared presentation and lifecycle recovery, but
  no longer assumes the local Edge runtime must open three provider sockets at
  once. The provider hold is released on every failure path.
- Non-browser validation passed: the focused E2E configuration/diagnostic group
  passed 3 suites / 53 assertions; lint, typecheck and `git diff --check`
  passed; the full client suite passed 46 suites / 802 assertions. Database
  authority and product source were unchanged, so no database reset/test or
  generated-type write was performed.
- A fresh R02 calculation at `03:02:57 +05` found 107 rolling identities and
  43 available. The exact eleven-case diagnostic reservation was 30 identities:
  `I01 3 + I03 2 + H02 3 + H03 3 + E11 1 + E05 3 + E06 3 +
  E12-mutation 3 + E09 2 + J01 3 + J02 4 = 30`. The safe run finalized at
  `03:05:42 +05` with scanner findings `[]`, capture off, owned cleanup and no
  HTTP 429. E11/E05/E06/E12-mutation/E09/I01/H03 passed; I03/H02/J01/J02
  failed at their remaining harness assumptions.
- A second fresh calculation at `03:09:16 +05` found rolling usage 137 and
  capacity 13, safely admitting only the exact remaining 12-identity set. That
  run finalized at `03:11:01 +05`, again with scanner findings `[]`, capture
  off, owned cleanup and no HTTP 429. I03 passed; H02, J01 and J02 exposed the
  final out-of-scope request-occurrence/provider-scheduling cleanup assumptions
  described above. Their corrections are implemented and non-browser-green,
  but have not received charged confirmation.
- At `03:14:09 +05`, rolling usage was exactly 149 and capacity was 1, so the
  next exact targeted validation (`H02 3 + J01 3 + J02 4 = 10`) and the
  107-identity full T063 block were both refused. C1 expiry after
  `03:35:27 +05` raises capacity only to 2. The earliest conservative admission
  for the ten-identity target is after the 106-identity full receipt expires,
  no earlier than `03:42:22 +05`, subject to a fresh calculation. If that
  target then passes, a full T063 rerun is conservatively admissible only after
  the 30-identity diagnostic expires, no earlier than `04:05:43 +05`, again
  subject to a fresh calculation and intervening traffic.
- Both targeted runs preserved exact signup/identity accounting, one worker,
  zero retries, scanner zero and owned cleanup. No Playwright container or
  browser harness remains, and `supabase/functions/.env` is absent. T063 stays
  unchecked; T064–T066 were not started and no implementation SHA was created.

T063 remediation verdict: **HOLD**. Eight of the original eleven failures are
targeted-green. H02/J01/J02 have concrete final harness fixes but cannot be
charged again in the current rolling window; the implementation is not yet
ready for the next full T063 rerun.

### T063 final three-case targeted-validation hold — 2026-09-17

- A fresh R02 calculation at `03:27:21 +05` used the current one-hour cutoff
  `02:27:21 +05` and counted every finalized receipt still in the rolling
  window: C1 `run-UJG7ce` = 1 identity, the failed full checkpoint
  `run-XCPC26` = 106, the eleven-case diagnostic `run-TSiOuo` = 30, and the
  four-case diagnostic `run-gH6Yqd` = 12. Rolling usage was therefore exactly
  `149 / 150`, leaving capacity for only 1 identity.
- The exact requested target remains `H02 3 + J01 3 + J02 4 = 10` identities.
  Because available capacity was less than 10, admission was refused before
  any charged browser command or signup probe. No identity was consumed, no
  HTTP 429 occurred, and no retry was attempted.
- C1 expiry after `03:35:27 +05` raises available capacity only to 2. The
  earliest conservative quota-only admission point for the exact ten-identity
  target remains after the 106-identity receipt expires, no earlier than
  `03:42:22 +05`, subject to a new calculation and any intervening traffic.
  The target was not run, so scanner/capture/cleanup results remain unchanged
  from the prior finalized receipts.
- T063 remains unchecked and not ready for a full rerun until H02, J01 and J02
  receive green targeted evidence. T064 was not started and no T065
  implementation SHA was created.

T063 three-case validation verdict: **HOLD — R02 capacity 1, required 10**.

### T063 final three-case targeted-validation second hold — 2026-09-17

- A new R02 calculation at `03:31:52 +05`, with cutoff `02:31:52 +05`,
  independently counted the four finalized receipts still inside the rolling
  hour: `run-UJG7ce` = 1, `run-XCPC26` = 106, `run-TSiOuo` = 30 and
  `run-gH6Yqd` = 12 identities. Usage remained exactly `149 / 150`, leaving
  capacity 1 against the exact `H02 3 + J01 3 + J02 4 = 10` requirement.
- Admission was refused before any charged browser command or signup probe.
  This attempt consumed zero identities, made no retry, and encountered no
  HTTP 429. There is consequently no new scanner, capture or cleanup receipt.
- Expiry of the one-identity C1 receipt after `03:35:27 +05` remains
  insufficient. The earliest conservative quota-only point for another fresh
  ten-identity admission calculation is after `03:42:22 +05`, when the
  106-identity receipt expires, subject to any intervening traffic.
- H02, J01 and J02 remain unexecuted after their final corrections. T063 stays
  unchecked and is not ready for a full rerun; T064 was not started and no
  T065 implementation SHA was created.

T063 three-case validation second verdict: **HOLD — R02 capacity 1, required
10**.

### T063 final three-case targeted-validation receipt — 2026-09-17

- A fresh read-only R02 calculation at `03:44:16 +05`, with cutoff
  `02:44:16 +05`, enumerated the finalized receipts rather than reusing the
  prior recovery estimate. Only `run-TSiOuo` = 30 identities and
  `run-gH6Yqd` = 12 identities remained in the rolling hour: usage was
  `42 / 150`, capacity was 108, and the exact
  `H02 3 + J01 3 + J02 4 = 10` reservation was admitted. There was no
  intervening charged traffic before the bounded command started.
- The safe wrapper gained an exact `H02|J01|J02` receipt profile so the run
  could neither select I03 nor pass with a partial or incorrectly budgeted
  result. Its signup-free profile checks passed 2 suites / 37 assertions and
  `git diff --check` passed before browser execution. A Bash-only `mapfile`
  used in a redundant inline recount was unavailable under zsh and printed an
  invalid zero-usage diagnostic; it did not create an Auth attempt, and the
  valid fresh 42-identity calculation above remained the admission basis. No
  retry or second charged command followed.
- The single bounded run `run-0Rh2NV` finalized at `03:47:20 +05`. It
  discovered only H02, J01 and J02 and consumed exactly 10 identities:
  H02 `3 attempts / 3 successful identities`, J01 `3 / 3`, and J02 `4 / 4`.
  All three failed their remaining E2E harness assertions, at safe locations
  `room-harness.ts:75:94`, `candidate-harness.ts:41:82`, and
  `candidate-harness.ts:143:12`, respectively. Each individual receipt reports
  `cleanup=true`, `authSuccess=true`, `budgetFailure=false`, capture `none`,
  one worker and one repetition. The finalized scanner found `[]`; no HTTP 429
  occurred; the isolated Playwright runtime was removed; and
  `supabase/functions/.env` is absent.
- The post-run R02 recount at `03:47:36 +05`, cutoff `02:47:36 +05`, contained
  the 30-, 12-, and new 10-identity receipts: current usage was `52 / 150` and
  capacity was 98. Because the three targeted cases did not pass, their
  targeted validation is not complete and no 107-identity full T063 rerun was
  considered or executed. T063 remains unchecked, T064 was not started, and no
  T065 implementation SHA was created.

T063 three-case validation verdict: **FAIL — exact 10 identities consumed;
H02, J01 and J02 all failed; no retry**.

### T063 final-target artifact diagnosis and signup-free remediation — 2026-09-17

- No charged browser command, signup probe or retry was run. The saved
  `run-0Rh2NV` artifacts identify H02's exact failed assertion as the forced
  pending-candidate snapshot in `room-harness.ts`, J01's as the 15-second
  controlled-provider hold poll, and J02's as the 30-second controlled-candidate
  heading wait. Cleanup/scanner/capture/Auth facts remain those of the finalized
  receipt above.
- H02's prior correction created a per-room map but never waited for its request
  sets: `wait(room)` immediately inspected PostgreSQL, so it could return before
  a compatible room emitted candidate traffic or race a later successful Edge
  request. The assertion therefore still used pending database state as a proxy
  for per-room request occurrence. The containment helper now validates the
  exact room on every participating page, supplies a fixed safe `not_ready`
  Edge-domain response, and waits until every page's request is fulfilled and
  no handler remains active before checking the unchanged historical boundary.
- J01 did prove that all three real browser-to-Edge POSTs reached its barrier,
  but after releasing them it still blocked on a provider-side held-socket
  observation. That retained the scheduling assumption the earlier fix meant
  to remove. The barrier now binds all requests to the exact room, forwards the
  three real requests with bounded zero-retry fetches, fulfills the browser
  responses, disposes the fetched responses, and exposes an exact drain. J01
  uses no provider hold; its terminal provider counters still require bounded
  real Discover/Details/Configuration traffic and one canonical candidate.
- J01's timeout path also left its unawaited compatible-resolution promise and
  forwarded Edge work outside the old barrier's `close()`: close only released
  and unregistered routes, while `candidateHarness.close()` cleared rather than
  awaited response-validation work. Because the controlled provider is shared
  by the serial acceptance worker, J02 could reset that provider while J01 work
  was still settling. J02 then repeated the same release-without-drain ordering
  before its candidate wait. Both cases now await the filter/resolution promise,
  the exact Edge response drain, response disposal and pending safe validation
  work on success and failure paths before teardown or provider reconfiguration.
- The remediation changes only E2E harness/spec/config tests:
  `e2e/support/room-harness.ts`, `e2e/support/candidate-harness.ts`,
  `e2e/tmdb-candidate-source.spec.ts`,
  `__tests__/config/e2e-diagnostics.test.ts`, and
  `__tests__/config/feature007-e2e-profile.test.ts`. No product, database,
  Feature 006 authority, candidate progression, larger-group policy or generated
  type changed.
- Signup-free validation passed: focused harness/config validation passed 3
  suites / 54 assertions; the full client suite passed 46 suites / 803
  assertions; `npm run lint`, `npm run typecheck`, and `git diff --check` passed.
- The untracked `supabase/tests/migration/swipe_decisions.before.sql` and
  `swipe_decisions.after.sql` are intentional Feature 007 T005/T006 artifacts,
  are consumed by `scripts/check-swipe-decisions-migration.mjs` for T011, and
  supplied the already-recorded nonempty-upgrade evidence. They are not
  disposable runtime leftovers and were neither deleted nor committed here.
- The next smallest browser confirmation remains exactly
  `H02 3 + J01 3 + J02 4 = 10` identities. The three cases are signup-free-ready
  for one targeted run, but remain browser-unconfirmed; T063 stays unchecked,
  T064-T066 remain unstarted, and no T065 implementation SHA exists.

T063 final-target diagnosis verdict: **READY FOR ONE FRESHLY ADMITTED
10-IDENTITY TARGETED RUN; NOT EXECUTED**.

### T063 post-remediation three-case targeted-validation receipt — 2026-09-17

- A fresh R02 calculation at `12:52:29 +05`, with rolling cutoff
  `11:52:29 +05`, found no finalized identity receipt in the preceding hour.
  Usage was `0 / 150`, capacity was 150, and the exact
  `H02 3 + J01 3 + J02 4 = 10` reservation was admitted. No charged traffic
  intervened before the bounded command.
- The single exact-profile run `run-FIyMDw` finalized at `12:54:26 +05` and
  consumed exactly ten identities: H02 `3 attempts / 3 identities`, J01 `3 / 3`,
  and J02 `4 / 4`. No retry or signup probe followed.
- H02 failed at `e2e/support/room-harness.ts:76:25`: the exact-room drain's
  15-second poll did not observe a candidate request from every one of the three
  pages, so it stopped before the historical pending database assertion. J01
  failed at `e2e/support/candidate-harness.ts:163:12`: after its exact-room
  three-request Edge barrier and response drain completed, the controlled
  candidate heading did not become visible within 30 seconds. J02 failed at the
  same heading assertion and timeout after J01's awaited finally/teardown and
  its own exact-room Edge drain.
- Every individual receipt reports `cleanup=true`, `authSuccess=true`,
  `budgetFailure=false`, capture `none`, one worker and one repetition. The
  scanner found `[]`; no HTTP 429 occurred; the managed web/browser runtime was
  finalized and its Playwright container removed; and
  `supabase/functions/.env` is absent. All six safe artifacts remain in
  `test-results/run-FIyMDw`.
- The post-run recount at `12:54:39 +05`, cutoff `11:54:39 +05`, contains only
  this ten-identity receipt: rolling usage is `10 / 150` and capacity is 140.
  Because all three targeted cases failed, no new 107-identity admission
  calculation or full T063 command was run. T063 remains unchecked; T064-T066
  remain unstarted; no T065 implementation SHA exists. The intentional
  `swipe_decisions.before.sql` and `swipe_decisions.after.sql` migration fixtures
  remain untouched.

T063 post-remediation target verdict: **FAIL — exact 10 identities consumed;
H02, J01 and J02 failed; no retry and no full T063 run**.

### T063 post-remediation artifact diagnosis — 2026-09-17

- No charged browser command, signup probe or retry was run. Diagnosis used the
  six preserved `run-FIyMDw` artifacts, the current harness and product paths,
  the Feature 006 specification/contracts and its green receipts, and the
  unchanged Edge/RPC/client tests. The safe artifact policy deliberately did
  not retain room IDs, JWT subjects, response bodies, provider logs or database
  rows, so the failed run cannot truthfully supply per-request status/body or a
  post-drain PostgreSQL snapshot that was never captured.
- H02 reached compatible resolution and the isolation route observed fewer than
  three page-originated candidate requests. It then timed out before its
  PostgreSQL pending-state assertion because `drain()` equated the number of
  requesting pages with the number of participating pages. Feature 004 does not
  require candidate traffic from every page, and Feature 006 requires automatic
  compatible handoff plus concurrency evidence in its owner cases, not one
  request from every H02 participant. The exact-room route already prevents
  every intercepted request from reaching Edge or mutating PostgreSQL. The
  correct historical boundary is therefore: observe at least one real exact-room
  handoff, fulfill every request that actually arrives with the fixed safe
  `not_ready` result, drain the active exact-room handlers, then inspect the
  unchanged room while the containment routes remain installed. Classification:
  **harness synchronization defect**.
- J01 and J02 both passed the three-arrival counter and the harness-owned drain,
  then timed out on the first controlled-candidate heading. That drain did not
  represent completion of the original browser requests: the interception
  layer replaced each one with a Playwright-owned `route.fetch()`, synthesized a
  second response with `route.fulfill({response})`, and disposed the fetched
  response. The preserved artifacts contain no status/body record, so they do
  not establish whether any replacement fetch returned `200 available`, `503`,
  or another allowed result, and cleanup removed the room before a database
  snapshot. What they do establish is that this replacement layer was shared by
  both new failures and was absent from the historically green J01/J02 path;
  Feature 007 did not change candidate authority, the current Feature 006
  provider evidence still satisfies the exact year/genre/adult commit contract,
  and lower-layer CAS/client evidence remains green. Classification for each:
  **harness behavior that alters the system under test**.
- The Feature 006 product invariant is concurrent acquisition by two or more
  authorized members converging on one database winner. Neither the normative
  spec nor client/Edge contract requires all three J01 pages to issue a request,
  exactly three Edge requests, or three simultaneous provider sockets. The
  smallest repair now releases after two exact-room browser requests have
  arrived, continues those original requests with `route.continue()`, and drains
  their native `response` plus `requestfinished` lifecycle. Every forwarded
  response must be status 200 with the exact controlled `available` shape; no
  request is reissued, synthetically fulfilled or disposed by the barrier.
  Additional naturally occurring page requests are also tracked without being
  manufactured.
- H02 containment now counts exact-room requests rather than requesting pages
  and requires only a nonzero handoff with zero active handlers before the
  pending-room snapshot. The regression test proves one request from a two-page
  set is sufficient. The J regression test proves two requests from a three-page
  set release and drain through `continue()`, with two exact `200 available`
  results and no third manufactured request. Product, database, Feature 006
  authority, progression and larger-group policy remain unchanged.
- Changed files for this diagnosis are `e2e/support/room-harness.ts`,
  `e2e/support/candidate-harness.ts`,
  `__tests__/config/e2e-diagnostics.test.ts`, and this receipt. The next smallest
  browser validation set remains exactly `H02 3 + J01 3 + J02 4 = 10`
  identities, subject to a fresh R02 admission calculation. It was not run here.
- Signup-free validation passed: focused harness/profile tests passed 2 suites /
  38 tests; the complete client suite passed 46 suites / 803 tests; lint,
  typecheck and `git diff --check` passed. The existing StrictMode
  `findNodeHandle` deprecation warning appeared in the room-route suite without
  affecting its pass. No implementation or database source changed.

### T063 native-request targeted-validation receipt — 2026-09-17

- A fresh R02 calculation at `13:17:03 +05`, with cutoff `12:17:03 +05`,
  counted only `run-FIyMDw` at 10 identities. Rolling usage was `10 / 150`,
  capacity was 140, and the exact `H02 3 + J01 3 + J02 4 = 10` reservation was
  admitted. No charged traffic intervened before the bounded command.
- The single exact-profile run `run-IhvAke` finalized at `13:18:55 +05` and
  consumed exactly ten identities: H02 `3 attempts / 3 identities`, J01 `3 / 3`,
  and J02 `4 / 4`. All three failed; no retry or signup probe followed.
- H02 failed at `e2e/support/room-harness.ts:76:25`: the exact-room containment
  poll did not establish its required nonzero handoff with zero active handlers
  within 15 seconds, so PostgreSQL inspection was not reached. J01 and J02 both
  failed at `e2e/support/candidate-harness.ts:85:64`: at least two native
  exact-room requests had reached and been released through `route.continue()`,
  but the native response/request-finished drain did not establish its complete
  all-`200 available` condition. Neither case reached the controlled-candidate
  presentation assertion. Safe artifacts do not identify which drain
  subcondition remained incomplete or retain response bodies/identities.
- Each individual receipt reports `cleanup=true`, `authSuccess=true`,
  `budgetFailure=false`, capture `none`, zero capture attempts, one worker and
  one repetition. The finalized scanner found `[]`; no HTTP 429 occurred; the
  managed runtime was finalized and removed; and `supabase/functions/.env` is
  absent. All six safe artifacts remain in `test-results/run-IhvAke`.
- Because the target failed, no full-T063 admission calculation or charged full
  run occurred. A read-only rolling recount at `13:19:19 +05`, cutoff
  `12:19:19 +05`, counted `run-FIyMDw` 10 plus `run-IhvAke` 10: usage was
  `20 / 150` and capacity 130. T063 remains unchecked; T064-T066 remain
  unstarted; no T065 implementation SHA exists.

T063 native-request target verdict: **FAIL — exact 10 identities consumed;
H02, J01 and J02 failed; no retry and no full T063 run**.

### T063 observable targeted-validation receipt — 2026-09-17

- A fresh R02 calculation at `13:47:27 +05`, with cutoff `12:47:27 +05`,
  counted `run-FIyMDw` = 10 identities and `run-IhvAke` = 10 identities.
  Rolling usage was `20 / 150`, capacity was 130, and the exact
  `H02 3 + J01 3 + J02 4 = 10` diagnostic reservation was admitted. No
  charged traffic intervened before the bounded command.
- The single exact-profile run `run-6bwjiA` finalized at `13:49:20 +05` and
  consumed exactly ten identities: H02 `3 attempts / 3 identities`, J01
  `3 / 3`, and J02 `4 / 4`. All three failed; no retry or signup probe
  followed, and the full T063 block was not admitted or run.
- H02 failed at `e2e/support/room-harness.ts:104:72`. Its complete bounded
  containment diagnostic was: handoffs `0`; active handlers `0`; handlers
  started `0`; handlers completed `0`; handler failures `0`; request
  cancellations `0`; work reopened after drain `0`; harness failures `0`;
  classification `no-handoff`.
- J01 failed at `e2e/support/candidate-harness.ts:111:64`. Its missing drain
  conditions were `http-200-available` and `harness-failure`. Provider state
  was observed with requests `0`, completed `0`, active `0`; PostgreSQL
  candidate authority was `absent`, so failure phase was `before-authority`.
  Each opaque request had the following lifecycle:
  - `req-1`: route observed `true`; `route.continue()` succeeded `true`; native
    response observed `true`; HTTP status `503`; controlled available result
    validated `false`; requestfinished `true`; requestfailed `none`; active at
    timeout `false`.
  - `req-2`: route observed `true`; `route.continue()` succeeded `true`; native
    response observed `true`; HTTP status `503`; controlled available result
    validated `false`; requestfinished `true`; requestfailed `none`; active at
    timeout `false`.
  - `req-3`: route observed `true`; `route.continue()` succeeded `true`; native
    response observed `true`; HTTP status `503`; controlled available result
    validated `false`; requestfinished `true`; requestfailed `none`; active at
    timeout `false`.
- J02 failed at the same safe helper location with the same independently
  recorded state: missing `http-200-available` and `harness-failure`; provider
  requests/completed/active `0 / 0 / 0`; authority `absent`; phase
  `before-authority`. Its opaque request lifecycle was:
  - `req-1`: route observed `true`; continue succeeded `true`; native response
    observed `true`; status `503`; controlled available validated `false`;
    requestfinished `true`; requestfailed `none`; active `false`.
  - `req-2`: route observed `true`; continue succeeded `true`; native response
    observed `true`; status `503`; controlled available validated `false`;
    requestfinished `true`; requestfailed `none`; active `false`.
  - `req-3`: route observed `true`; continue succeeded `true`; native response
    observed `true`; status `503`; controlled available validated `false`;
    requestfinished `true`; requestfailed `none`; active `false`.
- Every individual receipt reports `cleanup=true`, `authSuccess=true`,
  `budgetFailure=false`, capture `none`, zero capture attempts, one worker and
  one repetition. The finalized scanner found `[]`; no HTTP 429 occurred; all
  six safe artifacts remain in `test-results/run-6bwjiA`; the managed runtime
  was finalized and removed; and `supabase/functions/.env` is absent.
- The post-run rolling recount at `13:49:43 +05`, cutoff `12:49:43 +05`,
  counted the three 10-identity receipts `run-FIyMDw`, `run-IhvAke`, and
  `run-6bwjiA`: usage is `30 / 150` and capacity is 120. T063 remains
  unchecked; T064-T066 remain unstarted; no T065 implementation SHA exists.

T063 observable target verdict: **FAIL — exact 10 identities consumed; no
retry, synchronization change, or full T063 run**.

### T063 observable-target diagnosis — 2026-09-17

- This diagnosis ran no charged browser command, signup probe, retry or quota
  reset. It used the preserved `run-6bwjiA` receipts, the historical Feature
  004 H02 source/contract, current harness and Edge code, and signup-free
  runtime-network probes.
- H02 is a **harness synchronization defect**. Its Feature 004 contract owns
  non-voter progress, recovery, rollback, duplicate/concurrent submission and
  committed-response-loss behavior; it originally ended with candidate RPC/UI
  zero. Candidate traffic was added later only as a Feature 006 containment
  proxy. Zero candidate traffic is therefore valid. The containment helper now
  treats the authoritative `compatible` resolution with candidate authority
  still `pending` as the inspection boundary, drains every handler that
  actually exists, rechecks that authority, and never requires a request to
  occur. Any later request remains fulfilled locally as non-mutating
  `not_ready` traffic until teardown.
- J01/J02 share one **test environment/configuration defect**. The controlled
  provider listened on host loopback (`127.0.0.1`), while the containerized
  Edge runtime used `host.docker.internal`. On native Linux Docker that gateway
  cannot reach a loopback-only listener: a signup-free container probe
  reproduced `ECONNREFUSED`, while the same probe passed against a gateway
  listener. Consequently every Discover fetch failed before reaching the
  provider, the bounded TMDB client produced
  `search_incomplete(reason=timeout)`, and the candidate endpoint's explicit
  discover branch returned HTTP 503 `candidate_acquisition_unavailable`
  without a commit. That explains provider `0 / 0 / 0` and absent PostgreSQL
  candidate authority for all six requests. The endpoint's only other 503
  producer is its broad operation-error catch; the compatible/pending
  preflight, deterministic unreachable base URL, exact transport-failure unit
  result and zero provider traffic establish the discover-timeout branch here.
- The native-request repair did not remove or supply any provider
  configuration. The listener defect pre-existed it. The prior
  harness-owned `route.fetch()`/synthetic-fulfill path obscured native response
  ownership and retained no safe status evidence; `route.continue()` plus the
  new native lifecycle/provider diagnostics made the real Edge 503 and zero
  provider acquisition directly observable.
- The controlled provider now binds a gateway-reachable address, retains a
  loopback-only control endpoint, and requires the exact invocation-scoped
  random bearer token. Startup creates that token before the stub and supplies
  the same value to the Edge environment. A real signup-free Docker-gateway
  provider probe returned HTTP 200 after the correction.
- Signup-free validation is green: focused harness/config `39 / 39`; Edge
  `40 passed / 0 failed / 1 intentional live-contract skip`; lint; typecheck;
  and `git diff --check`. The application client was not changed, so the full
  client suite was not an affected gate. No product/database/Feature 006
  authority, candidate progression or larger-group agreement behavior changed.
- Another exact `H02 3 + J01 3 + J02 4 = 10` targeted browser run is justified,
  subject to a fresh R02 rolling-window admission calculation immediately
  before execution. It was not run during this diagnosis. T063 remains
  unchecked; T064-T066 remain unstarted; no T065 implementation SHA exists.

### T063 Docker-gateway targeted-validation admission — 2026-09-17

- A fresh read-only R02 calculation at `14:23:48 +05`, with cutoff
  `13:23:48 +05`, enumerated every finalized identity-bearing receipt in the
  preceding hour. Only `run-6bwjiA` remained, with exactly 10 identities;
  `run-FIyMDw` and `run-IhvAke` had aged out. Rolling usage was therefore
  `10 / 150` and available capacity was 140.
- The exact bounded target `H02 3 + J01 3 + J02 4 = 10` was admitted without
  using a previous recovery estimate. No charged browser command, signup probe
  or intervening identity attempt occurred between this calculation and the
  reserved command.
- The single bounded run `run-QnXVKr` finalized at `14:24:50 +05` and consumed
  exactly ten identities: H02 `3 attempts / 3 identities`, J01 `3 / 3`, and
  J02 `4 / 4`. J01 and J02 passed; H02 failed, so there was no retry, new full
  T063 admission calculation, C1 command or 44-case full acceptance run.
- H02 failed on its first room at the first authoritative-boundary check,
  `e2e/support/room-harness.ts:130:96`, before its handler drain. The exact
  failed expectation was the combined authoritative snapshot requirement
  `compatible && candidate pending && tmdb_movie_id null && movie_candidate_id
  null && decision_completed_count 0`. The safe artifact did not retain the
  database row or identify which conjunct was false, and no containment-timeout
  diagnostic was emitted because the failure preceded `drain()`. Candidate
  authority therefore was not proven pending by this run.
- J01 passed its three native exact-room `200 available` response/finished
  drain, one-winner PostgreSQL assertion, shared controlled presentation,
  reload/reconnect lifecycle and provider bounds. Its final provider assertion
  established `invalid=0`, Discover between 1 and 3, Details at least 3 and
  Configuration at least 1, proving Docker-gateway Edge-to-provider traffic and
  excluding the prior reachability 503. J02 likewise passed native acquisition,
  one authoritative controlled candidate, client convergence, teardown before
  its second room, and the completed-empty path with `invalid=0` and Discover
  at least 1 after the provider-state reset. Exact provider aggregate
  requests/completions/active values are not serialized for passing cases;
  after teardown they cannot be recovered safely, so no exact counter value is
  claimed beyond these enforced bounds.
- All three receipts report `cleanup=true`, `authSuccess=true`,
  `budgetFailure=false`, capture `none`, zero capture attempts, one worker and
  one repetition. The controller finalized four safe artifacts with scanner
  findings `[]`, removed the isolated Playwright runtime, and left
  `supabase/functions/.env` absent. No HTTP 429 or retry occurred.
- A post-run read-only recount at `14:26:01 +05`, cutoff `13:26:01 +05`, found
  `run-6bwjiA` = 10 plus `run-QnXVKr` = 10 identities. Rolling usage is
  `20 / 150` and available capacity is 130. T063 remains unchecked; T064,
  T065 and T066 have not started; no T065 implementation SHA exists.

T063 Docker-gateway target verdict: **FAIL — exact 10 identities consumed;
J01/J02 passed, H02 failed; no retry and no full T063 run**.

### H02 authoritative-boundary diagnosis — 2026-09-17

- No charged browser command or signup probe ran during this diagnosis. The old
  `run-QnXVKr` artifact cannot identify which conjunct failed because the row
  was not serialized, but the deterministic Feature 005 contract identifies
  it: H02's first room stores `documentary / 2001–2026` and `crime /
  1990–2000`. Since `max(from) > min(to)`, its terminal resolution is
  necessarily `incompatible`; the harness's unconditional `compatible`
  expectation was stale. Classification: **stale snapshot expectation**.
- Candidate containment is not late and does not miss the browser path. H02
  awaits `isolateCandidateAcquisition()`—including route registration on all
  three pages—before creating its first room. It allowlists that room before
  starting/joining voters and before any filter submission. The final accepted
  filter then commits compatible or incompatible resolution; only a compatible
  client state can dispatch Feature 006 acquisition. Any such exact-room POST
  reaches the already-installed route and receives the fixed local `not_ready`
  response before Edge/provider/commit work can begin.
- The boundary sequence is now explicit: inspect the expected authoritative
  terminal before drain; drain every handler that actually exists (including
  the valid zero-traffic case); then inspect the same authoritative terminal
  again. H02 passes `incompatible` for its first disjoint-year room and
  `compatible` for its later two rooms. H03 and the affected I01/I03 calls pass
  their already-proven `compatible` terminal explicitly.
- Candidate-pending/null authority has two roles. For the first incompatible
  room it is an actual Feature 005/006 product invariant: incompatible cannot
  become candidate-ready. For H02's compatible rooms, Feature 006 is allowed to
  acquire normally, so pending/null is not a product invariant; it is the
  containment invariant that keeps this historical Feature 004 recovery case
  isolated at its owner boundary. Decision count zero is likewise the expected
  pre-Feature-007 containment state, not filter-resolution semantics.
- A new bounded `candidate-boundary` diagnostic records only phase, expected
  and actual resolution enum, compatible/match booleans, candidate status and
  pending boolean, authoritative/related-candidate nullness booleans, decision
  count/zero boolean and an independent missing-condition list. It records no
  room/member/auth/candidate identifiers, filter payloads or decision values.
  Regression coverage proves every conjunct independently, both terminal
  resolution variants, safe receipt/scanner retention, zero-traffic drain,
  contained naturally arriving traffic, route-install/allowlist ordering, and
  the pre-drain → drain → post-drain authority sequence.
- Signup-free validation is green: focused harness/config suites `3 / 3`,
  `45 / 45`; the final diagnostics rerun `34 / 34`; lint; typecheck; and
  `git diff --check`. Edge/product/database code was not changed, so no Edge
  rerun was required. H02 alone is ready for one exact three-identity browser
  confirmation, subject to a fresh R02 calculation immediately before it.

### H02-only targeted-validation admission — 2026-09-17

- A fresh read-only R02 calculation at `15:00:21 +05`, with cutoff
  `14:00:21 +05`, enumerated every finalized identity-bearing receipt in the
  preceding hour. Only `run-QnXVKr` remained, with exactly 10 identities.
  Rolling usage was `10 / 150`, leaving capacity 140 against the exact H02
  reservation of 3 identities.
- H02 alone was admitted without reusing a prior recovery estimate. J01/J02
  were explicitly excluded, and no charged browser command, signup probe or
  intervening identity attempt occurred between this calculation and the
  reserved command.
- The single H02 run `run-gn544w` finalized at `15:01:03 +05` and consumed
  exactly `3 attempts / 3 identities`. It failed and was not retried; J01/J02
  were not selected; no full-T063 admission calculation or command followed.
- The first room passed its explicit incompatible boundary, including the
  pre-drain check, valid zero-or-existing-handler drain and post-drain recheck.
  The failure occurred on the next room's `before-drain` boundary at
  `e2e/support/room-harness.ts:136:17`. Its safe per-field diagnostic was:
  expected resolution `compatible`; actual resolution `pending`; compatible
  `false`; resolution match `false`; candidate status `pending`; candidate
  pending `true`; authoritative candidate null `true`; related candidate
  evidence null `true`; decision count `0`; decisions-zero `true`; missing
  condition exactly `resolution-mismatch`. No unsafe identifier or payload was
  retained.
- The individual receipt reports `cleanup=true`, `authSuccess=true`,
  `budgetFailure=false`, capture `none`, zero capture attempts, one worker and
  one repetition. The controller finalized four safe artifacts with scanner
  findings `[]`, removed the isolated Playwright runtime, and left
  `supabase/functions/.env` absent. No HTTP 429 or signup probe occurred.
- A post-run recount at `15:01:25 +05`, cutoff `14:01:25 +05`, counted
  `run-QnXVKr` = 10 and `run-gn544w` = 3 identities. Rolling usage is
  `13 / 150` and available capacity is 137. H02 remains unconfirmed and T063
  remains unchecked; T064-T066 have not started; no T065 implementation SHA
  exists.

H02-only target verdict: **FAIL — exact 3 identities consumed; next compatible
room remained pending at its pre-drain boundary; no retry or full T063 run**.

### H02-only targeted-validation readmission — 2026-09-17

- A new R02 calculation at `15:03:03 +05`, with cutoff `14:03:03 +05`,
  counted `run-QnXVKr` = 10 and `run-gn544w` = 3 identities. Rolling usage
  was `13 / 150`, leaving capacity 137 against the exact H02 reservation of
  3 identities.
- H02 alone was readmitted from this fresh calculation. J01/J02 remained
  excluded, and no charged browser command, signup probe or intervening
  identity attempt occurred before the bounded command.
- The single admitted `npm run test:e2e -- --grep H02` command produced
  `test-results/run-PDXYWU` and failed. It consumed exactly 3 signup attempts /
  identities. No retry, J01/J02 selection, full-T063 admission calculation or
  full acceptance command followed.
- The first H02 room completed its required authoritative `incompatible`
  boundary. A later room failed its `before-drain` boundary at
  `e2e/support/room-harness.ts:136:17`. Its complete safe per-field diagnostic
  was: expected resolution `compatible`; actual resolution `pending`;
  compatible `false`; resolution match `false`; candidate status `pending`;
  candidate pending `true`; authoritative candidate null `true`; related
  candidate evidence null `true`; decision count `0`; decisions-zero `true`;
  missing condition exactly `resolution-mismatch`. Thus candidate authority
  and the pre-Feature-007 decision state remained contained; the exact failing
  conjunct was the later room's compatible-resolution expectation. No unsafe
  identifier, filter payload, decision value or candidate value was retained.
- The individual receipt reports `cleanup=true`, `authSuccess=true`,
  `budgetFailure=false`, capture `none`, zero capture attempts, one worker and
  one repetition. The controller finalized four safe artifacts with scanner
  findings `[]`, removed the isolated Playwright runtime, and left
  `supabase/functions/.env` absent. No HTTP 429 or signup probe occurred.
- A post-run recount at `15:04:31 +05`, cutoff `14:04:31 +05`, counted
  `run-QnXVKr` = 10, `run-gn544w` = 3 and `run-PDXYWU` = 3 identities.
  Rolling usage is `16 / 150` and available capacity is 134. H02 remains
  unconfirmed and T063 remains unchecked; T064-T066 have not started; no T065
  implementation SHA exists.

H02-only readmission verdict: **FAIL — exact 3 identities consumed; a later
room remained pending at its compatible pre-drain boundary; no retry or full
T063 run**.

### H02 concurrent-resolution diagnosis — 2026-09-17

- `run-PDXYWU` failed in H02's second room, the explicit concurrent filter-
  submission phase. It did not reach the later committed-response-loss room.
  Both opaque voter submissions returned `saved`, and the immediately preceding
  owner-only snapshot assertion proved exactly `2 / 2` authoritative filter
  rows. Neither submission rolled back, lost its response or retried in this
  room. The stored room status was still `pending`; therefore the separate
  `resolve_common_filters` transaction had not committed when candidate
  containment inspected it. The old artifact did not record enough resolver
  lifecycle state to prove whether that transaction had already been invoked.
- Pending is valid after the two Feature 004 filter transactions and before the
  Feature 005 client consumes the room UPDATE, refetches `2 / 2`, and invokes
  the resolver. It is not the required terminal state after that automatic
  resolution path completes. The static filter definition is compatible:
  both year ranges are `1900..2026`; separate nonempty genre clauses remain an
  anonymous AND-of-OR payload and do not make the room incompatible.
- The failure is a **harness synchronization defect**. The new Feature 007
  containment helper asserted terminal PostgreSQL state immediately after the
  filter RPC promises, even though `submit_my_participant_filter` only commits
  the filter row/count. Feature 005 deliberately owns resolution in a later
  client-triggered `resolve_common_filters` transaction. No product or database
  regression is indicated.
- H02 now installs a passive exact-room resolver observer before the final
  filter operation in both the concurrent-submission and committed-response-
  loss rooms. It waits on the real terminal browser view, then verifies the
  authoritative terminal snapshot before candidate-handler draining. It does
  not route, fetch, continue, manufacture or delay any request and adds no
  sleep or widened timeout.
- A new bounded `filter-resolution-boundary` diagnostic contains only the safe
  phase label, expected/authoritative filter counts, expected/actual resolution,
  terminal-authority/view booleans, and aggregate resolver request/response/
  HTTP-success/failure counts. It contains no room/member/Auth identifier,
  filter payload or response body. Regression coverage proves each missing
  filter-count, terminal-authority and terminal-view condition independently
  and fixes both H02 phase orderings.
- Signup-free validation: focused config/filter/room/resolution suites passed
  `7 / 7` suites and `130 / 130` tests; the clean-view Feature 005
  common-resolution pgTAP suite passed `74 / 74` with the transactional cleanup
  rolled back and the pre-existing local fixture count restored. The final
  diagnostic regression rerun passed `1 / 1` suite and `34 / 34` tests; lint,
  typecheck and `git diff --check` also passed. No browser command, signup probe,
  J01/J02 case or T063 run was executed.

### H02 terminal-resolution targeted admission — 2026-09-17

- A fresh read-only R02 calculation at `16:59:55 +05`, with cutoff
  `15:59:55 +05`, found no finalized identity-bearing receipt in the preceding
  rolling hour. `run-gn544w` and `run-PDXYWU` finalized at `15:01:03 +05` and
  `15:03:38 +05` respectively and were both outside the window.
- Rolling usage was therefore `0 / 150`, leaving capacity 150 against the exact
  H02 reservation of 3 identities. H02 alone was admitted. J01/J02 and the full
  T063 block were not selected by this admission, and no signup probe was used.
- The single admitted command produced `run-cIG7LD` and passed H02 with exactly
  `3 attempts / 3 identities`. Its safe receipt reports `cleanup=true`,
  `authSuccess=true`, `budgetFailure=false`, capture `none`, zero capture
  attempts, safe UI, no harness diagnostic and scanner findings `[]`; the owned
  Playwright runtime was removed and `supabase/functions/.env` remained absent.
- All three H02 rooms crossed their asserted authority boundaries: the recovery
  room was terminal `incompatible`, while the concurrent-filter-submission and
  committed-response-loss rooms rendered terminal `compatible` and matched the
  owner-only PostgreSQL snapshot before candidate containment drained. During
  the isolated run, the native gateway log recorded four
  `resolve_common_filters` requests and four HTTP-200 responses. The harness
  issued no resolver request itself. All actually arriving candidate handlers
  drained; pending/null candidate authority and decision count zero held at the
  pre- and post-drain checks. Zero candidate traffic remained an allowed case.
- H02/J01/J02 targeted remediation is now confirmed. H02 was not retried and
  J01/J02 were not rerun.

### T063 full-checkpoint admission after H02 — 2026-09-17

- A new read-only R02 calculation at `17:02:03 +05`, with cutoff
  `16:02:03 +05`, counted only `run-cIG7LD` = 3 identities. Rolling usage was
  `3 / 150`, leaving capacity 147.
- The exact T063 block requires C1 = 1 plus the full 44-case acceptance profile
  = 106 identities, for a combined reservation of 107. Capacity 147 admits the
  complete block with no probe, retry or partial execution.
- `npm run test:e2e:security` finalized as `run-bHwnRI`. Its one real
  authenticated identity reached the required controlled diagnostic failure;
  the controller verified the stable safe capture, owned cleanup and complete
  probe artifacts and returned `status=passed`. Scanner findings were `[]`,
  `budgetFailure=false`, and the Playwright runtime was removed.
- `npm run test:e2e` finalized as `run-lDJSKI` and discovered exactly 44 cases,
  consuming exactly 106 identities. It passed 43 cases and failed only G04.
  G04 reached the compatible candidate view and decision-ready boundary, then
  its keyboard-decision helper failed the visibility assertion for the local
  `You chose Yes/No` confirmation at
  `e2e/support/decision-harness.ts:219:96`. The bounded artifact does not expose
  which participant choice timed out. H02, J01 and J02 all passed within the
  full inventory.
- Every one of the 44 case receipts reports `cleanup=true`, successful Auth
  accounting and `budgetFailure=false`. The full-run scanner findings were
  `[]`, capture remained `none`, no HTTP 429 occurred, and the owned Playwright
  runtime was removed. No retry or signup probe was attempted; the preserved
  full-run artifact is `test-results/run-lDJSKI`.
- The admitted T063 block consumed exactly `1 + 106 = 107` identities. A fresh
  post-run recount at `17:11:17 +05`, with cutoff `16:11:17 +05`, contained
  `run-cIG7LD` = 3, `run-bHwnRI` = 1 and `run-lDJSKI` = 106: rolling usage was
  `110 / 150`, leaving capacity 40. T063 remains unchecked because G04 failed;
  T064 was not started, and no T065 implementation SHA was created.

T063 latest full-checkpoint verdict: **FAIL — 43 / 44 passed; G04 failed; exact
107-identity block consumed; no retry**.

### G04 keyboard-decision diagnosis — 2026-09-17

- The preserved Playwright artifact contains only the safe terminal symptom,
  but the still-retained gateway access log reconstructs G04 without exposing
  Auth, room or participant identifiers. The G04 room issued exactly one
  `submit_room_candidate_decision` request at `17:05:51.814 +05`. It returned
  HTTP 200 with the exact bounded response size for the static step-1
  `accepted`/`yes`, `1 / 3` projection. The helper therefore reached the
  handler and PostgreSQL authority for opaque step 1, and its local
  `You chose Yes` assertion passed.
- The accepted write emitted the normal rooms invalidation. Four canonical
  room refetches completed at `17:05:51.837–17:05:51.840 +05`, followed at
  `17:05:51.858–17:05:51.860 +05` by one aggregate-only observer recovery and
  two exact `not_decided`, `1 / 3` voter recoveries. This is the expected
  client contract: an undecided peer temporarily enters `recovering`, disables
  both controls, rereads private authority, then returns to `undecided`.
- The loop entered opaque step 2 (`no`) while that peer control was temporarily
  disabled. The old helper called `focus()` and immediately sent Enter without
  waiting for enabled authority or proving focus ownership. Enter was consumed
  outside the disabled Pressable; no second submit request reached PostgREST,
  no step-2 decision row committed, and the room remained at `1 / 3`. Private
  recovery completed milliseconds later, but the lost key action was not
  replayed. The local-confirmation assertion then exhausted the exact 10-second
  expect timeout at `17:06:01.955 +05`.
- Classification: **decision-harness synchronization defect**. G04's three-
  voter sequence exposed the count-advance recovery window between serial
  submissions. K01's two-voter keyboard path can race through before the peer
  observes the invalidation, so its green runs did not make the old helper a
  valid authority boundary. The non-voting creator remained observer-only and
  was not involved in submission authority. No Edge function, TMDB provider,
  candidate mutation, progression or larger-group agreement behavior is on
  this decision RPC path.
- The shared keyboard helper now waits for the exact control to be enabled,
  focuses it, proves that it owns focus, and only then emits Enter. The local
  confirmation remains an asynchronous authoritative-result assertion rather
  than a synchronous keypress assumption. A hook regression covers an
  undecided peer's `undecided -> recovering -> undecided` transition after a
  count advance, including rejection of submission while recovering; a harness
  regression fixes the enabled/focus/Enter/confirmation order. Product, RPC,
  database and policy code are unchanged.
- Direct `--grep G04` now selects an exact bounded `g04` receipt profile that
  requires one passing, cleaned, authenticated G04 result with exactly
  `4 signups / 4 identities`; wrong or partial accounting fails the controller.

### G04-only targeted-validation admission — 2026-09-17

- A fresh read-only R02 calculation at `17:30:19 +05`, with cutoff
  `16:30:19 +05`, counted `run-cIG7LD` = 3, `run-bHwnRI` = 1 and
  `run-lDJSKI` = 106 identities. Rolling usage was `110 / 150`, leaving
  capacity 40 against the exact G04 reservation of 4 identities.
- G04 alone was admitted with 36 identities of headroom. No prior recovery
  estimate, signup probe, retry or other charged command was used for this
  admission.
- The single admitted `npm run test:e2e -- --grep G04` command produced
  `test-results/run-BzTibW` and passed. Its exact bounded receipt contains one
  G04 case with `4 signups / 4 identities`, `cleanup=true`, `authSuccess=true`,
  `budgetFailure=false`, capture `none`, zero capture attempts, safe UI, no
  harness diagnostic and scanner findings `[]`. The managed Playwright runtime
  was removed and `supabase/functions/.env` remained absent. No retry, signup
  probe or HTTP 429 occurred.
- All three voters reached the decision-ready boundary. For each static
  `yes / no / yes` step, the helper waited through any count-advance private
  recovery until the intended control was enabled, focused that exact control,
  proved focus ownership, emitted Enter, and observed the corresponding local
  authoritative confirmation. Gateway evidence contains exactly three
  `submit_room_candidate_decision` requests, all HTTP 200. The subsequent
  private recovery assertions proved one authoritative row per voter with the
  expected own value and aggregate `3 / 3`; the committed room snapshot also
  reported decision count 3.
- The creator remained observer-only with no decision controls or own value and
  saw aggregate completion only. No larger-group agreement, candidate
  progression, next-candidate, match or celebration presentation appeared;
  candidate/provider containment and cleanup assertions remained healthy.
  H02, J01, J02 and G04 are now individually remediated and browser-confirmed.
- A new R02 calculation at `17:31:35 +05`, with cutoff `16:31:35 +05`, counted
  `run-cIG7LD` = 3, `run-bHwnRI` = 1, `run-lDJSKI` = 106 and
  `run-BzTibW` = 4 identities. Rolling usage was `114 / 150`, leaving capacity
  36. The exact full-T063 reservation is 107 identities, so it was not
  admitted. No C1 or full-acceptance command, partial run, retry or probe
  followed this hold.

G04-only targeted verdict: **PASS — exact 4 identities consumed; full T063 held
at 36 available against 107 required**.

### T063 full-checkpoint readmission — 2026-09-17

- A fresh read-only R02 calculation at `18:21:49 +05`, with cutoff
  `17:21:49 +05`, counted only `run-BzTibW` = 4 identities. The prior H02,
  C1 and 44-case receipts had aged out of the rolling window. Usage was
  `4 / 150`, leaving capacity 146.
- The exact unchanged T063 checkpoint reserves C1 = 1 plus the full 44-case
  profile = 106 identities, or 107 total. The entire block was admitted with
  39 identities of headroom. No recovery estimate, signup probe, partial
  reservation or retry was used.
- C1 ran exactly once as `test-results/run-Dq4Ucn`. The two static scenarios
  passed and the one real-identity scenario reached the required
  `CONTROLLED_AUTH_DIAGNOSTIC_FAILURE`; its Auth success, owned cleanup, safe
  verified capture and complete diagnostic artifacts made the controller pass
  with inner exit 1. It consumed exactly `1 signup / 1 identity`, reported no
  budget failure and produced scanner findings `[]`.
- Immediately before the full command, a second conservative R02 calculation
  at `18:22:36 +05`, cutoff `17:22:36 +05`, counted G04 = 4 plus C1 = 1:
  usage `5 / 150`, capacity 145. This still exceeded the full 107-identity
  threshold as well as the remaining 106-identity profile cost.
- The unchanged full acceptance command ran exactly once as
  `test-results/run-bbajCj`. It discovered and passed exactly `44 / 44` cases
  with zero failures, including H02, J01, J02 and G04, and consumed exactly
  `106 signups / 106 identities`. Every case reports successful Auth accounting,
  `cleanup=true`, `budgetFailure=false`, capture `none` and zero capture
  attempts. The scanner found `[]`; no HTTP 429 occurred; the managed runtime
  was removed; and `supabase/functions/.env` remained absent. No retry or
  signup probe occurred.
- T063 therefore passed with exact combined consumption `1 + 106 = 107` and is
  complete. A fresh post-run calculation at `18:29:40 +05`, cutoff
  `17:29:40 +05`, counted G04 = 4, current C1 = 1 and current full profile =
  106: rolling usage `111 / 150`, capacity 39.
- T064 was not started. Its standalone checkpoint requires a fresh 47-identity
  reservation; reserving T064 and T065 in one recovered window requires 64.
  G04 ages out just after `18:31:16 +05`, raising capacity only to 43; C1 ages
  out just after `19:22:22 +05`, raising it only to 44. Neither threshold is
  sufficient. With no new identity use, both the 47- and 64-identity thresholds
  first become available only after the 106-identity full receipt ages out just
  after `19:29:15 +05`. Conservatively recalculate after `19:29:30 +05` and
  require the chosen complete reservation before any T064 browser command.

T063 final checkpoint verdict: **PASS — C1 contract passed; 44 / 44 acceptance
cases passed; exact 107 identities consumed; T063 complete; no retry**.

### T064 standalone repeatability receipt — 2026-09-17

- The required check-only generated-types gate initially could not start because
  the sandbox denied the Supabase CLI telemetry write under the read-only home
  directory. No generated output replaced the canonical artifact. Re-running
  the same check with Supabase telemetry disabled returned `consistent`; SHA-256
  remained `6aecffdf46565a5b393affce0f627f9712e2082b66a3fada23c33d1cc9271a7c`
  and inode/size/mtime/ctime remained exactly
  `11577515 / 15953 / 1789560267 / 1789560268`. No database reset, stack
  restart or generated-type write occurred.
- A fresh read-only R02 calculation at `19:33:07 +05`, with cutoff
  `18:33:07 +05`, found no finalized identity-bearing receipt and no
  unfinalized run in the rolling hour. Usage was `0 / 150`, leaving capacity
  150 against T064's standalone reservation of 47 identities. The complete
  standalone block was admitted. No 17-identity T065 capacity was reserved;
  T065 must admit separately if it is later authorized.
- C1 ran exactly once as `test-results/run-WjrpmU`. Its two static scenarios
  passed and the one real-identity scenario reached the required controlled
  diagnostic failure. The controller passed the contract with inner exit 1,
  exact consumption `1 signup / 1 identity`, verified safe capture, complete
  artifacts, `cleanup=true`, `budgetFailure=false` and scanner findings `[]`.
- The first Feature 007 owner pass ran exactly once as
  `test-results/run-w3Ifba`. K01 and K02 both passed with exact consumption
  `2 + 4 = 6 identities`, one worker, zero retries and one repetition. K01
  recorded exactly 20 performance samples, all 20 at or below 2,000 ms,
  maximum 109 ms and zero recoverable failures. Cleanup completed, capture was
  `none`, capture attempts were zero, budget failure was false and scanner
  findings were `[]`.
- The first permanent smoke pass ran exactly once as
  `test-results/run-GgCayt` and consumed its exact 16 identities. G03, G05,
  G08 and H01 passed; G04 failed at the safe keyboard-focus assertion
  `e2e/support/decision-harness.ts:223:24`. Its finalized artifact retained
  only `E2E_SAFE_FAILURE`, with no harness diagnostic or private payload.
  Every case reports `cleanup=true`, successful Auth accounting,
  `budgetFailure=false`, capture `none` and zero capture attempts; scanner
  findings were `[]` and no HTTP 429 occurred.
- The non-parallel repeatability sequence stopped on that first smoke failure.
  No retry, signup probe, second Feature 007 owner pass, second smoke pass or
  J03 command was attempted. Exact T064 consumption was therefore
  `1 + 6 + 16 = 23 identities`, not the reserved maximum of 47.
- A fresh post-run R02 calculation at `19:36:04 +05`, with cutoff
  `18:36:04 +05`, counted `run-WjrpmU` = 1, `run-w3Ifba` = 6 and
  `run-GgCayt` = 16 identities. Rolling usage was `23 / 150`, leaving capacity
  127, with no unfinalized run. Every owned Playwright runtime was removed,
  no E2E/browser process remained, and `supabase/functions/.env` remained
  absent. Intentional migration fixtures were untouched.
- T064 remains incomplete and unchecked because the required two complete
  owner-plus-smoke passes and J03 pass were not produced. T065 and T066 remain
  unstarted, and no T065 implementation SHA exists.

T064 standalone repeatability verdict: **FAIL — C1 and the first owner pass
passed; first smoke passed 4 / 5 cases with G04 failing; exact 23 identities
consumed; no retry**.

### T064 keyboard-focus recovery and completed repeatability — 2026-09-17

- Repository evidence classified the G04 failure as a **harness/assertion
  defect with a synchronization trigger**, not an application defect. The
  helper split one keyboard action into `button.focus()`, a separately retried
  `toBeFocused()` assertion and page-scoped `keyboard.press('Enter')`. The
  installed Playwright API explicitly warns that handlers or rerenders between
  those calls can change focus and prescribes locator-scoped `press()` to keep
  focus acquisition and key delivery together. G04's count-advance private
  recoveries provide that rerender boundary. The failed smoke window still
  contained all three expected HTTP-200 decision submissions, with no decision
  transport failure or HTTP 429, which further rules out an application
  authority failure.
- The minimal fix changed only `keyboardDecision` in
  `e2e/support/decision-harness.ts` to wait for authoritative enabled state and
  then use `button.press('Enter')`. The existing regression in
  `__tests__/config/feature007-e2e-profile.test.ts` now requires that atomic
  enabled/locator-press/authoritative-confirmation order and rejects the old
  split `button.focus()` plus page-scoped keypress form. The visible controls,
  focusability, Enter mapping, one-flight authority and Feature 007 UX contract
  are unchanged; no sleep or retry was added.
- Before browser execution, focused config/diagnostic/runtime validation passed
  `3 suites / 58 tests`; lint and typecheck passed; the full client suite passed
  `46 suites / 808 tests`; and `git diff --check` passed. The check-only
  generated-types command returned `consistent`; its SHA-256 and
  inode/size/mtime/ctime remained exactly
  `6aecffdf46565a5b393affce0f627f9712e2082b66a3fada23c33d1cc9271a7c`
  and `11577515 / 15953 / 1789560267 / 1789560268`. The intentional before/after
  migration-fixture hashes also remained unchanged.
- Because the harness source changed, the earlier partial block could not count
  toward T064's requirement that both repeatability passes run from one
  unchanged source state. The narrowest contract-valid recovery was therefore
  the complete 47-identity block rather than an extra G04-only run or only the
  previously unexecuted suffix.
- A fresh read-only R02 calculation at `21:36:51 +05`, with cutoff
  `20:36:51 +05`, found no finalized identity-bearing receipt and no
  unfinished run in the rolling hour. Usage was `0 / 150`, leaving capacity
  150 against the exact standalone T064 reservation of 47 identities. The
  block was admitted; no capacity was reserved for T065.
- C1 ran exactly once as `test-results/run-Jubbzt` and passed its controlled
  failure contract with `1 signup / 1 identity`, verified safe capture,
  complete artifacts, successful Auth accounting, cleanup, no budget failure
  and scanner findings `[]`.
- The first fixed-source owner/smoke pair finalized as
  `test-results/run-6yU889` and `test-results/run-VrnFpX`. K01/K02 passed with
  exact `2 + 4 = 6` identities; K01 recorded 20/20 samples at or below 2,000 ms,
  maximum 201 ms and zero recoverable failures. G03/G04/G05/G08/H01 all passed
  with exact `3 + 4 + 2 + 4 + 3 = 16` identities. G04 therefore confirmed the
  actual locator-scoped keyboard focus/Enter path in its non-voting-creator,
  three-voter lifecycle.
- The second fixed-source owner/smoke pair finalized as
  `test-results/run-DeSfTy` and `test-results/run-8TeRQr`. K01/K02 again passed
  with six fresh identities; K01 recorded 20/20 passing samples, maximum 106 ms
  and zero recoverable failures. The five permanent smoke cases, including G04,
  again passed with 16 fresh identities.
- Targeted J03 finalized once as `test-results/run-T41eYS` and passed with exact
  `2 signups / 2 identities`. The full fixed-source recovery consumption was
  exactly `1 + 2*(6 + 16) + 2 = 47` identities. Adding the preserved failed
  attempt's 23 identities gives cumulative T064 consumption of 70 identities.
- Every recovery receipt reports one worker, zero retries, one repetition,
  successful charged Auth accounting, `cleanup=true`, `budgetFailure=false`,
  no harness diagnostic, capture `none` except C1's required verified capture,
  and scanner findings `[]`. No HTTP 429, signup probe, reset, restart or extra
  charged target occurred. Every owned Playwright runtime was removed, no
  browser/E2E process remained, and `supabase/functions/.env` remained absent.
- A fresh post-run R02 calculation at `21:42:00 +05`, with cutoff
  `20:42:00 +05`, counted the six recovery receipts as
  `1 + 6 + 16 + 6 + 16 + 2 = 47 / 150`; capacity was 103 and no unfinished run
  existed. The earlier 23-identity attempt had aged out of this rolling window
  but remains part of cumulative T064 consumption.
- T064 is complete. T065 and T066 remain unstarted, T065 must perform its own
  fresh 17-identity admission, and no T065 implementation SHA exists.

T064 final repeatability verdict: **PASS — atomic keyboard focus/Enter fix;
G04 passed twice; exact fixed-source 47-identity block passed; cumulative T064
consumption 70 identities; T064 complete**.

### T065 exact-SHA fresh-checkout receipt — 2026-09-18

- The exact implementation candidate is commit
  `06f88fab32f8954a824c663e36d08c6af51292a7`, whose parent is repository HEAD
  `88cba4f`. The workspace `.git` directory is read-only in this execution
  environment, so the authorized candidate commit could not move source
  `main`; it was constructed from exactly the 66 versionable accumulated
  Feature 007 entries in a temporary Git repository and preserved at
  `test-results/t065-candidate.bundle`. A second independent checkout cloned
  from that bundle, detached at the candidate SHA, and remained clean through
  the complete gate. Source HEAD and its unrelated worktree state were not
  reset, discarded, normalized or overwritten.
- The checkout initially contained no `node_modules`, local environment,
  browser state, test result, build output or function environment. It used an
  isolated verified Node `v24.20.0` / npm `11.19.0` toolchain, installed 1,116
  packages with `npm ci`, and prepared the pinned Playwright `1.63.0` Docker
  image. Fresh stack setup generated only the ignored public URL and
  publishable-key entries in `.env.local`; no Feature 006 secret was required
  because the live-provider test remained intentionally ignored, and
  `supabase/functions/.env{,.local}` were absent.
- All ten migration files were nonempty. A clean latest reset replayed all ten
  and the full database suite passed `6 files / 960 assertions`. The five
  nonempty room-membership, participant-filter, common-resolution,
  TMDB-candidate and swipe-decision validators passed in order with zero GoTrue
  signups, zero retained owned fixtures and a final latest reset. The candidate
  stayed clean; its ten protected migration-fixture files had aggregate
  SHA-256 `2e29bd10ed32f3b0c06031715031f27971ab490dc91f30c0ca345231865e50f2`.
- Check-only database types returned `consistent`; canonical SHA-256 remained
  `6aecffdf46565a5b393affce0f627f9712e2082b66a3fada23c33d1cc9271a7c`
  with identical inode/size/mtime/ctime before and after the command. Edge
  regression passed 40 tests with one live-provider test intentionally ignored;
  lint and typecheck passed; and the full client/config suite passed
  `46 suites / 808 tests`. `npm run web:export` emitted five routes and the
  iOS/Android export emitted both native bundles. The package defines no
  separate `build` script, so the required build/platform gate is the successful
  production web and native exports. `git diff --check` passed.
- A preliminary read-only admission guard at `01:25:45 +05` made no browser
  attempt because it conservatively treated an old directory as unfinished.
  Inspection proved `run-hDghmh` contained only an empty
  `.playwright-artifacts-0` directory: zero files/bytes, last written
  `2026-09-16 19:44:54 +05`, well outside the window. `run-N81Bfl` was likewise
  an older zero-file remnant. Neither contains a receipt, attempt or identity.
  No signup probe, retry, reset or restart was used to test or replenish quota.
- The authoritative fresh R02 calculation immediately before browser execution
  at `01:26:21 +05`, cutoff `00:26:21 +05`, found no finalized identity-bearing
  receipt and no active unfinished run in the rolling hour. Usage was
  `0 / 150`, capacity 150, and the complete separate T065 reservation of 17 was
  admitted. This independently proves the documented combined envelope
  `T064 47 + T065 17 = 64`; T064 had not reserved T065 capacity and had already
  aged out of this window.
- C1 ran exactly once as `test-results/run-gObqi8`: both static scenarios passed,
  the real scenario produced the required controlled inner failure, and the
  outer controller passed with exact `1 signup / 1 identity`, verified guarded
  capture, complete artifacts, successful Auth accounting, `cleanup=true`,
  `budgetFailure=false` and registry-backed scanner findings `[]`.
- Permanent smoke ran exactly once as `test-results/run-M0yhBA`.
  G03/G04/G05/G08/H01 all passed with exact identity accounting
  `3 + 4 + 2 + 4 + 3 = 16`. Every charged row reports `authSuccess=true`,
  `cleanup=true`, `budgetFailure=false`, capture `none`, zero capture attempts
  and no harness diagnostic; the controller's finalized scanner findings were
  `[]`. The two commands therefore consumed exactly `1 + 16 = 17` signups and
  identities with one worker, zero retries and one repetition. Parsed gateway
  HTTP status fields contained zero 429 responses.
- The two finalized safe receipt directories were copied out of the disposable
  checkout to the paths above. The fresh stack was stopped and removed, every
  owned Playwright runtime was removed, no Supabase or Playwright container
  remained, and `supabase/functions/.env` remained absent. The detached
  checkout was still exactly at the candidate SHA with clean status after all
  tests; canonical types and intentional migration fixtures were unchanged.
- A fresh post-run calculation at `01:29:10 +05`, cutoff `00:29:10 +05`, counted
  only `run-gObqi8 = 1` and `run-M0yhBA = 16`: rolling usage was `17 / 150`,
  capacity 133 and there was no unfinished run. The C1 receipt ages out just
  after `02:26:36 +05` and smoke just after `02:27:33 +05` if later work needs
  a new calculation.
- T065 is complete. T066 remains unstarted; no T066 validation or release audit
  was performed.

T065 fresh-checkout verdict: **PASS — exact candidate SHA validated from an
independent clean checkout; all non-browser and 17-identity browser gates passed;
scanner/cleanup zero; T065 complete**.

### T066 final artifact/scope audit and G5 release verdict — 2026-09-18

- T066 is the documentation/completion audit defined by the task contract. It
  requires no new executable or charged browser gate: T061 already owns the
  final deterministic checks, T062 the normal owner/smoke/targeted gate, T063
  the explicit full regression, T064 repeatability, and T065 the exact-SHA
  fresh checkout. T066 therefore made no R02 admission, consumed zero
  identities, started no service, and performed no database reset, generated-
  type write, browser execution, retry or signup probe.
- The implementation source audited for release was reconstructed directly
  from the verified `test-results/t065-candidate.bundle` at exact commit
  `06f88fab32f8954a824c663e36d08c6af51292a7`, parent
  `88cba4f8dd38f1718af7d5a6e59e79d599fac0af`. Its detached checkout was clean,
  `git diff --check` and `git fsck` passed, and the complete candidate history
  remained in the bundle. Before T066 documentation changes, every versionable
  workspace file was byte-identical to that candidate except this quickstart
  and `tasks.md`, which contained only the post-candidate T065 receipt and task
  state; there was no nonignored workspace file absent from the candidate.
- The whole candidate diff is 75 files, 6,558 insertions and 321 deletions. The
  migration diff contains exactly one added file,
  `20260916000000_swipe_decisions.sql`; all nine historical migration SHA-256
  values equal the protected T001 baseline. `package-lock.json` and dependency
  declarations are unchanged; `package.json` adds only the bounded Feature 007
  E2E script. Canonical generated types remain SHA-256
  `6aecffdf46565a5b393affce0f627f9712e2082b66a3fada23c33d1cc9271a7c`.
  The ledger records exactly one intentional T014 type generation and only
  check-only gates afterward, including the clean T065 checkout.
- Cross-artifact review covered the constitution, product vision, roadmap,
  Feature 007 specification, plan, research, data model, all four contracts,
  tasks, normative testing strategy, candidate diff and every quickstart
  receipt. The 35 functional requirements, 10 non-functional requirements, 11
  success criteria, 26 acceptance scenarios and all five user stories retain
  implementation and executable evidence. The one marked `UNRESOLVED` item is
  the deliberately deferred agreement policy for more than two voters; it is
  outside the Feature 007 release boundary and blocks dependent Feature 008
  policy, not this decision-capture slice.
- The release contains no larger-group agreement rule, candidate acquisition or
  progression, next-candidate behavior, final match UX, dynamic membership,
  permanent-account behavior, new dependency or speculative platform. Clients
  call only the two hardened RPCs and retain the one rooms-table invalidation/
  refetch channel; they do not access or subscribe to decision rows. Feature
  006 production acquisition/Discover code and sorting are unchanged.
- No tracked secret or local environment was added. C1 and all finalized
  browser controllers recorded authoritative scanner findings `[]`; the
  preserved T065 candidate bundle contains source history only. The Feature 007
  ledger names 30 run directories: 28 finalized receipts account for exactly
  `513 signups / 513 identities`, including every failed and superseded attempt,
  while `run-N81Bfl` and `run-hDghmh` are documented zero-file/zero-identity
  cleanup remnants. Every charged receipt row has successful Auth accounting,
  all rows have `cleanup=true`, none has `budgetFailure=true`, and the five safe
  harness diagnostics map to failures already recorded in this quickstart.
  Every required failure has a diagnosis/remediation receipt and a later green
  governing gate; no HTTP 429 or unrecorded required failure remains.
- Final release evidence is green at the validated implementation candidate:
  T061 deterministic/database/client/Edge/export checks, T062 exact 25-identity
  normal acceptance, T063 C1 plus 44/44 full acceptance at 107 identities, T064
  complete 47-identity repeatability, and T065 clean-checkout C1 plus smoke at
  17 identities. Candidate identity remains unchanged throughout decision
  capture and agreement; Feature 007 ends without progression or match UX.
- No merge, tag or additional implementation commit is required by T066. The
  read-only workspace `.git` cannot install the already validated commit on
  `main`, so workspace HEAD remains `88cba4f` and the implementation SHA remains
  unambiguously `06f88fab32f8954a824c663e36d08c6af51292a7`, preserved by the
  verified bundle. Completion-only task, receipt and roadmap edits remain in
  the intentional workspace worktree rather than being represented as a
  different implementation candidate.
- T001–T066 are complete: 66/66 checked, zero unchecked. Feature 007 is complete
  at G5. Feature 008 and every other later feature remain unstarted.

G5 / T066 final release verdict: **PASS — exact validated candidate preserved;
deterministic, normal, full-regression, repeatability and fresh-checkout evidence
reconciled; scope and artifacts consistent; Feature 007 complete**.

Perform a new admission calculation before every charged browser block using
all attempts still in the rolling window. Normal plus the separate full
checkpoint can consume 132 identities. Adding repeatability would reach 179 and
therefore cannot occur in the same 150-identity window. After the full
checkpoint, wait outside the harness for sufficient documented rolling-window
recovery before reserving repeatability and fresh checkout. If those latter two
share one recovered window, reserve their combined 64 identities before
starting repeatability. A reset, restart or independent checkout does not
replenish Auth quota.

## 9. Full Regression and Repeatability

Because Feature 007 changes the shared room projection, root route composition,
generated schema and E2E runner, run the complete acceptance inventory once:

```sh
npm run test:e2e
```

After implementation it must discover 44 cases and reserve 106 identities:
the existing E/G/H/I/J 42 cases / 100 identities plus K01/K02 / 6 identities.
Run C1 separately for a combined maximum of 107. This full run is a release
impact gate, not mechanically part of the 25-identity normal owner checkpoint.
Admit all 107 identities before starting it; prior normal/manual/failed attempts
remain charged until they age out of the rolling window.

For repeatability from unchanged source, run C1 once, then owner + smoke twice
with fresh case identities, followed by targeted J03 once. The migration,
database, generated-type check, client/static/export gates run once for that
unchanged source state.

## 10. Exact-SHA Fresh Checkout

At the exact implementation SHA in an independent disposable checkout:

- do not copy `node_modules`, environment files, Auth state, database volumes,
  browser state, caches or prior artifacts;
- provision any required Feature 006 secret separately and record only its
  presence;
- run clean install, Playwright preparation, stack setup, every nonempty
  migration validator, clean reset/full database tests and check-only types;
- run Edge regression, lint, typecheck, full client tests, web/native exports and
  `git diff --check`;
- run C1 and permanent smoke within the 17-identity budget; and
- verify artifact scanning and owned cleanup.

Before its browser portion, confirm that the 17 identities were reserved with
repeatability inside the combined 64-identity block or perform a separate
17-identity admission. Checkout isolation does not imply quota isolation.

## Expected Final Evidence

- exactly one durable yes/no row per fixed voter/current candidate pair;
- duplicate, race, response-loss and reconnect paths recover one winner;
- two real voters decide independently while all clients retain the same TMDB
  candidate;
- exact-two yes/yes derives agreement without progression or match UX;
- larger rooms expose completion but no agreement policy;
- non-voters and foreign callers cannot submit or inspect private answers;
- mobile swipe, web keyboard/buttons and assistive output are equivalent; and
- Feature 006 acquisition and Discover sorting remain unchanged.

Stop the owned local stack when validation is complete:

```sh
npm run supabase:stop
```
