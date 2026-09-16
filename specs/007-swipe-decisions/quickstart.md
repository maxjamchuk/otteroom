# Quickstart: Validate Swipe Decisions

**Feature**: 007 — Swipe Decisions

**Status**: Future implementation and validation guide. No command or runtime
assertion in this document was executed during specification planning.

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
