# Quickstart and Validation: Participant Filters

**Status**: Planned validation, not executed evidence.
**Date**: 2026-09-11.

No command in this guide was run by planning and no PASS is claimed. During
implementation, record exact source SHA/worktree scope, environment, commands,
results/counts, R01 metadata, R02 windows, scanner result and cleanup before a
checkpoint is considered green.

## Prerequisites

Use repository root `/home/maks/work/otteroom`, branch `main`, the committed
lockfile and declared Node 24.20.x/npm 11.19.0 toolchain. The planning shell's
Node 22/npm 10 does not satisfy the repository engine contract. Docker and the
existing project-local Supabase 2.116.0 / managed Playwright 1.63.0 runtimes are
required.

Automated acceptance needs no hosted Supabase, TMDB/API key, movie network
request, physical phone, participant account, roster or service-role credential
in a browser. Continue to derive ignored local public Supabase configuration via
the existing safe script.

Future implementation must exist before these validation commands are run:

- one new additive Feature 004 migration;
- `scripts/check-participant-filters-migration.mjs` and its before/after SQL;
- evolved latest-schema expectations in the existing membership migration check;
- generated public types from the one R01 write;
- filter client/tests and adapted acceptance inventory.

## Nonempty migration evidence

With an owned local stack running and no application/browser traffic, the new
runner starts from the exact Feature 003 migration version, creates bounded
owner-only fixtures and applies the actual Feature 004 migration.

```sh
npm run db:reset
node scripts/check-participant-filters-migration.mjs
```

The future runner must:

1. verify local project identity and refuse competing traffic/non-owned fixture
   state before any version-limited reset;
2. reset to `20260910000000`, then build at least: a Waiting voting-creator
   room, a Ready voting-creator room, a Ready non-voting-creator room, and a
   Ready room with a valid non-lowest fixture FK;
3. snapshot exact logical room/member/configuration/count/state/timestamp/
   candidate values in bounded memory; create no GoTrue signup;
4. apply the actual pending migration, never copied SQL;
5. prove every room/member/QR-recovery input and candidate FK is unchanged,
   every room has `filter_completed_count=0`, no filter rows exist, and no
   synthetic completion was invented;
6. use real authenticated roles/claims to prove create/join recovery includes
   count 0, filter recovery is `not_ready`/`not_voter`/`not_submitted` as
   appropriate, candidate EXECUTE is denied and the preassigned movie is hidden;
7. prove only rooms remains in `supabase_realtime` and exact grants/RPC shapes
   match the contracts;
8. remove only owned fixtures and restore latest clean schema on success,
   failure or interruption.

Also evolve `scripts/check-room-membership-migration.mjs`/latest assertions so a
pre-003→latest validation still proves the Feature 003 membership invariants
while expecting Feature 004 count 0 and candidate suppression. Historical
migrations themselves remain byte-unchanged.

## Database contract evidence

Run the full database suite after a latest reset:

```sh
npm run db:reset
npm run db:test
```

Record actual assertion totals; do not freeze Feature 003's historical totals.

| Area | Required proof |
| --- | --- |
| Schema | Exact enum/table/room column types, defaults, keys/FKs/checks; no filter completion flag/timestamp or room_id duplication |
| Vocabulary | Exactly 19 enum slugs; empty accepted as Any; canonical order; duplicate/NULL/unknown rejected |
| Years | Both endpoints; inclusive 1900/current UTC year accepted; below/above/missing/reversed rejected; invalid replacement preserves prior row |
| Ownership | Voting creator and admitted voter own only their membership filter; client target substitution is impossible; NVC has no row |
| Progress | Count equals voting-owner filter rows, excludes NVC/connectivity, starts 0, increments on first save only and never exceeds N |
| Lock | First N/N transaction freezes every row; equal retry no-op; different post-N/N edit no-op |
| Failure/recovery | Row+summary rollback together; lost acknowledgement and same-identity recovery reveal accepted row without another contribution |
| Privacy | Exact function ACL/owner/search_path; filter/member/catalog direct access denied; own RPC detail only; foreign/missing indistinguishable |
| Realtime | Rooms-only publication; first saves update rooms; private replacement/no-op does not emit room update |
| Candidate | Authenticated EXECUTE absent; no direct/normal/recovery assignment; hidden preassigned FK preserved; catalog/room private fields denied |
| Cleanup | No production test trigger/fault helper, synthetic Auth/room/filter row or dblink caller remains |

### Deterministic concurrency procedure

Reuse the existing dblink harness, not sleeps or browser dispatch as the lock
oracle:

1. Owner setup commits coherent room/member/filter fixtures. Each caller is an
   independent backend with authenticated role, exact `auth.uid()`, READ
   COMMITTED and distinct PID.
2. Owner locks the target room `FOR UPDATE`. Dispatch the real filter RPCs
   asynchronously. Require outstanding queries, `pg_blocking_pids` chains and
   ungranted tuple/transaction locks before releasing the owner.
3. For two-caller ordering, keep the first completed caller transaction open and
   prove the other blocks directly on it; collect per-session INSERT/UPDATE
   deltas before commits and drain terminal results.
4. Verify exact row ownership/values, room count, whole-row snapshots and xmin
   after each ordered commit.
5. Cancel/drain/rollback on every failure and remove only owned fixtures/helpers.

Required trials and expected outcomes:

| Trial | Expected result |
| --- | --- |
| Two distinct voters from 0/N | Two owner-correct inserts; two count updates; progress 0→1→2 |
| Final two from 1/3 | Both succeed once; exactly one commit reaches 3/3; count never exceeds 3 |
| Forced edit then final | Final blocks; edited values commit; final insert freezes those values |
| Forced final then edit | Edit blocks; after final commit it returns `locked`; old values/xmin survive |
| Same voter/same canonical payload | One insert/count; loser/retry `unchanged`; 0 later writes |
| Same voter/different overlapping payload | Serialized update if still X<N, otherwise `locked`; never two rows/counts |
| Lost final acknowledgement | Committed N/N snapshot survives; recover/equal retry returns same values and performs 0 writes |
| Test fault between private row/room summary | Entire RPC rolls back; later valid retry succeeds once |
| Completed-room attacks | Own different edits, NVC and foreign calls produce 0 filter/room mutations |

## R01 — exactly one generation point

Only after the complete migration/RPC schema and database evidence above are
green:

```sh
npm run db:reset
npm run db:test
npm run db:types
npm run db:types:check
```

Review the sole canonical change in `src/types/database.generated.ts`: enum,
participant table, room aggregate and exact functions/results. Do not manually
patch nullability or change `scripts/database-types.mjs`.

Then independently prove check-only stability:

```sh
sha256sum src/types/database.generated.ts
stat -c '%i %s %Y %Z' src/types/database.generated.ts
npm run db:reset
npm run db:types:check
sha256sum src/types/database.generated.ts
stat -c '%i %s %Y %Z' src/types/database.generated.ts
```

Require identical bytes/hash/inode/size/mtime/ctime. Every command block after
this uses `db:types:check` only; no preceding generation may conceal drift.

## Client and integration evidence

Run focused filter/room tests first, then the complete client suite:

```sh
npm run test:client -- __tests__/filters __tests__/rooms __tests__/routes/room.test.tsx
npm run lint
npm run typecheck
npm run test:client
npm run web:export
npx expo export --platform ios --platform android --output-dir dist/native-validation
```

Expected behavioral coverage:

- exact genre enum/order/labels and empty Any semantics;
- inclusive default/boundary years and every corrective validation path;
- separate authoritative accepted values versus editable local draft;
- Waiting and NVC paths make zero detail/submit/candidate calls;
- voter recovery: loading, absent/default, saved/editable, error/retry, locked;
- one-flight duplicate save, canonical no-op, valid replacement, failed/
  invalid replacement preservation, locked adoption and stale generation guards;
- exact nine-field create/join and six-field room projection;
- monotonic membership/filter counts and irreversible N/N;
- existing system-ok/missed-event/coalescing/reconnect/remove-channel behavior;
- mobile-first scroll/accessibility and functional keyboard/web controls;
- normal room route imports/calls/renders no candidate implementation.

Inspect web/native bundles for the filter route and existing QR assets. Native
export is module compatibility evidence, not a physical-device interaction test.
No movie poster/candidate presence is required in the Feature 004 route.

## Browser cases and R02 ledger

Use only `npm run test:e2e:security` and `npm run test:e2e`; do not invoke raw
Playwright around the safe reporter/scanner. workers=1, retries=0, repeatEach=1.

### Retained/evolved suites

| Suite | Cases | Identities | Evolution |
| --- | ---: | ---: | --- |
| E room/Auth | 24 | 47 | Preserve create/join/capacity/identity/Realtime/isolation; every Ready helper stops at filter surface and zero candidate |
| G membership/QR | 9 | 26 | Preserve all membership/QR identities; G03/G04 become progress flows, G08 adds filter privacy, G07 retains late join |
| F candidate | 0 current | 0 | Remove F01–F08 from normal discovery; retain completed artifacts and meaningful SQL/client invariant classes |

Existing session allocations remain exactly as Feature 003; reload/reconnect/
re-entry/retry adds zero. Adapt helpers so `assertReady` means assembled/filter
phase and never silently waits for a fixture.

### New grouped cases

| Case | Identities | One case covers |
| --- | ---: | --- |
| H01 — input/ownership/edit | 3 | Voting creator + two voters; defaults, 19 values, Any, boundary years, invalid categories/endpoints, distinct values, spoofed owner attempt, invalid replacement preservation and valid pre-lock replacement |
| H02 — recovery/failure/privacy | 3 | Non-voting creator + two voters across deliberate rooms; progress-only creator, reload/socket/link/QR/code recovery, disconnected incomplete/completed voters, duplicate overlap, pre-commit failure/retry and committed-response-loss recovery |
| H03 — concurrent completion/freeze | 3 | Same three voters reused across deliberate rooms for distinct concurrency, final-two race, repeated same voter, forced edit-first and final-first order, lost final ack, active-save response after observed N/N, equal retry=`unchanged`, and every other castable post-N/N attempt=`locked` with no write |

Adapt G03 (3 identities) to prove voting-creator three-voter 0/3→1/3→2/3→3/3,
own saved/waiting states, Realtime convergence, N/N handoff and zero automatic
candidate calls. Retitle G04 to `@membership G04 non-voting creator observes voter filter
progress` and prove its 0/3 observer, private-detail absence, disconnected voter
semantics and final convergence. In G07 remove `candidateHarness`, `held()` and
release/availability assertions; prove the membership-only final-slot update and
zero outgoing candidate calls. Adapt G08 to prove ordinary JWT foreign filter
read/write/room-target attacks cannot reveal or mutate private state. Prove
direct candidate EXECUTE denial only in pgTAP/migration evidence; every browser
normal-flow assertion expects zero total candidate RPC requests.

The new file is `e2e/participant-filters.spec.ts` with these exact titles:

```text
@filters H01 validates private owned filters and editable saved state
@filters H02 recovers filters through failures and lost acknowledgements
@filters H03 serializes final completion and freezes every filter
```

Use reporter scenario `filters`, browser cases H01/H02/H03, a fixed
`filterAnonymousBudget={H01:3,H02:3,H03:3}`, and reviewed safe locations for the
test plus `e2e/support/filter-harness.ts`. H01/H02 call `test.setTimeout(90000)`;
H03 calls `test.setTimeout(120000)`. Acceptance `testMatch` becomes exactly
`room-session.spec.ts`, `generalized-room-membership-qr.spec.ts` and
`participant-filters.spec.ts`; the candidate file is absent. Global timeout
remains 600000 with workers1/retries0/repeatEach1.

### Exact budget

| Block | Arithmetic | Identities/attempts reserved |
| --- | --- | ---: |
| Complete acceptance | E47 + G26 + H9 | 82 |
| C1 + complete | 1 + 82 | 83 |
| H-only + C1, if separately run | 9 + 1 | 10 additional |
| Repeatability | C1 once + complete twice | 165 across recovered windows |
| Fresh checkout | C1 + complete | 83 in separate admitted window |
| Repeatability + fresh | 165 + 83 | 248 across recovered windows |

`anonymous_users=150` remains unchanged. A single full+C1 leaves 67 headroom.
Two full runs+C1 exceed one window by 15, so run #2 only after another complete
allowance window has recovered while the same stack remains running and no test
process waits. Count earlier failed/partial/targeted/manual attempts. Unknown
allowance means wait conservatively outside the harness; no quota probe, 429
retry, rate change, reset/restart evasion or identity/session cache between cases.

## Scenario coverage map

The browser cases intentionally cover several product scenarios each; SQL and
client tests supply boundary proof where a browser is not the authoritative
oracle.

| Spec scenarios | Principal evidence |
| --- | --- |
| 1–5 | E Waiting/assembly + adapted G03/G04 + H01 role/form flows |
| 6–10 | H01 vocabulary/year/default/validation/ownership + server contract tests |
| 11–14 | H02 reload/reconnect/re-entry/disconnected member + adapted E/G recovery |
| 15–19 | H02 duplicate/lost/failure/edit + SQL owner/write invariants |
| 20–21 | Adapted G08 cross-room/private attacks; G04/H02 non-voter rejection; RLS/ACL pgTAP |
| 22–24 | Adapted G03/G04 room-wide 0/N..N/N Realtime progress, no roster/details |
| 25–26 | H03 final/concurrent transitions plus deterministic SQL locks |
| 27–29 | G04 NVC final view + H02/H03 recovery + explicit Feature005 handoff |
| 30 | Every E/G/H phase asserts zero candidate; direct RPC/FK suppression pgTAP |
| 31 | Existing G07 late join plus unchanged filter/count snapshots |

Success evidence must cover both creator modes, at least one three-voter room,
all 19 genre values, 1900/current-year boundaries, own-only recovery, NVC
aggregate-only visibility, zero post-lock edits and zero movie UI/traffic.

## C1 remains unchanged

Do not change `__tests__/config/c1-capture.test.ts` or weaken its policy. Keep
screenshots, trace, HAR, video, storage-state export, raw Auth/RPC/Realtime logs,
DOM dumps and private filter payload diagnostics prohibited. Add only fixed,
reviewed H scenario/location and N=82 budget metadata to existing allowlists.
Deliberately update `__tests__/config/e2e-diagnostics.test.ts` and
`__tests__/config/playwright-runtime.test.ts` to remove F01–F08 discovery/budget
expectations, change 41/91 to 36/82, assert the exact three-file `testMatch`,
register H/filter-harness locations and replace the G04 candidate-era title.

C1's static controls create zero identities and its controlled browser probe
creates exactly one. Scanner output must have zero findings. A test may assert
safe visible genre/year text, counts and booleans; failures must not print room/
member/Auth IDs or entire request/response arrays.

## Normal green command path

After implementation and the separate R01 write have completed, run a complete
check-only gate from a cleanup-owning shell:

```sh
set -eu
trap 'OTTEROOM_FILTER_EXIT=$?; trap - EXIT; if ! npm run supabase:stop; then exit 1; fi; exit "$OTTEROOM_FILTER_EXIT"' EXIT
npm ci
npm run supabase:start
npm run env:local
npm run db:reset
node scripts/check-room-membership-migration.mjs
node scripts/check-participant-filters-migration.mjs
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

The migration runners must guarantee a final latest reset/cleanup when used in
sequence. Record C1=1 and acceptance=82 actual attempts/identities, 36 discovered
cases, scanner0 and all owned runtime cleanup. A required failure blocks the
checkpoint and its consumed identities remain charged.

## Repeatability

Do not run an extra full gate immediately before this block; run #1 is the normal
final checkpoint.

1. Admit at least 83 attempts. On one cleanup-owned stack run migrations,
   check-only R01, static/client/DB/exports, C1 once and complete acceptance #1.
2. Close browser contexts but keep the same Supabase stack/source. Wait outside
   every harness until another 82 attempts are available.
3. Optionally reset the DB, run `db:types:check`, then complete acceptance #2
   with fresh contexts. Do not rerun C1 unless its extra identity is budgeted.
4. Require identical 36-case behavior, scanner0, same source and total 165.
5. Stop the stack and verify cleanup. Reset/stop does not restore Auth quota.

## Fresh checkout

At an exact committed implementation SHA, use an independently created
disposable clone under `/tmp`; do not copy `.env`, node_modules, Auth storage,
caches or local service data. Use the declared toolchain and normal green command
path with check-only R01. Require both nonempty migration paths, full DB/client/
exports, C1, all 36 browser cases/82 identities and scanner0. Reserve 83 in a
separate recovered window from repeatability.

Do not patch the clone to hide a failure. Stop only its owned services, leave the
source worktree/branch untouched and remove only the allocated disposable
directory after recording source/result/cleanup evidence.

## Supplemental manual check

Manual multi-browser checks are optional and their actual new identities count
against R02. Validate one voting-creator and one non-voting-creator room on a
mobile-width web viewport: Waiting has no form/movie; assembled voters have
their own form; NVC has progress only; distinct saved values remain private;
X/N converges; N/N becomes read-only and stops at Feature 005. Reload one voter
and attempt a late join.

A physical phone check needs LAN-reachable web/API/Realtime URLs and the existing
public client key only. It is supplemental; native export and browser QR entry do
not claim physical native runtime behavior.

## Evidence log

For each future checkpoint append: date, exact SHA/worktree scope, tool versions,
commands actually run, result/test totals, nonempty migration receipts, lock/
write/xmin receipts, generated-type hash/metadata, browser discovery and R02
window accounting, C1/scanner result, export observation and verified cleanup.
Do not turn this planning document into evidence before commands actually run.
