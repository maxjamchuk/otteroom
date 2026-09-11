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
