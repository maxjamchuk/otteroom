# Quickstart: Validate the First Shared Movie Candidate

**Feature**: `002-first-movie-candidate`
**Status**: Future implementation validation guide. None of the commands or
runtime assertions below has been executed as part of planning.

Run from the repository root using the existing package scripts. Implementation
must first supply the migrations, assets, client/UI, tests, and narrowly scoped
harness adaptations in [plan.md](plan.md). These commands are not evidence that
the currently unimplemented feature works.

## Preconditions and Budget

Use the committed Node 24.20.x/npm 11.19.0 setup, lockfile, Docker/Supabase
prerequisites, and existing Playwright Docker runtime from
[Feature 001 quickstart](../001-room-session/quickstart.md). No new dependencies,
movie credentials, Dashboard steps, or remote poster services are needed.

Before each browser block reserve its maximum signup attempts against the
existing local `anonymous_users=150` hourly allowance:

| Block | Maximum new signup attempts/identities |
| --- | ---: |
| F01 only | 2 |
| Feature 002 F01–F08 only | 18 |
| C1 + F01 | 3 |
| Phase 6: C1 + existing 24 cases + F01 | 50 (acceptance N=49) |
| C1 + Feature 002 | 19 |
| Complete acceptance | 65 |
| C1 + complete acceptance / fresh checkout | 66 |
| C1 once + two complete runs | 131 |

Count earlier security, targeted, failed, and manual attempts. Reload/reconnect/
retry must add zero signups. Database reset and cleanup do not restore the hourly
allowance. Keep the limit at 150; do not restart services or clear Auth storage
to evade it. The 131 repeatability block plus the 66 fresh-checkout block totals
197, so schedule them with separately sufficient recovered allowance. See the
full [R02 derivation](research.md#r02--binding-identity-budget).

Admit a block only when sanitized signup counts/timestamps establish sufficient
remaining allowance. For unknown prior usage or insufficient allowance, postpone
the block and wait outside the test harness, application, and E2E wrapper. A
full signup-free hour after the last counted attempt is the conservative recovery
boundary; include other local traffic sharing the IP. Do not probe Auth for
quota, sleep inside tests, retry HTTP 429, or use restart/reset as recovery.
An actual 429 fails that run with the existing safe budget diagnostic. In
particular, do not launch the 66-signup fresh-checkout block immediately after
consuming 131 from an unrecovered allowance of 150.

The existing wrapper accepts bounded grep/worker/repeat options, not positional
test files. During implementation tag every new F01–F08 test title `@candidate`
and explicitly include `first-movie-candidate.spec.ts` in acceptance testMatch.
Default acceptance remains one worker, repeatEach 1, retries 0. More workers
partition one run; an additional invocation or repeat consumes another budget.

## Reset and Fixture Verification

After dependency/runtime preparation, start the existing local services and
configure only the existing public Supabase environment:

```sh
npm run supabase:start
npm run env:local
npm run db:reset
```

Reset must apply both versioned migrations and reproduce the exact catalog in
[data-model.md](data-model.md), the nullable room FK/check, and the hardened RPC.
No separate fixture seeding command is permitted.

The implementation's database suite must verify all five catalog fields, the
four exact rows, complete metadata, unique IDs/keys/orders, the FK actions,
Waiting prohibition, valid Ready/NULL, and denied catalog/assignment-column
access. Its lowest-sort expectation is `fixture-cardboard-comet`, without
requiring different rooms to receive different movies.

Client/asset checks must verify four distinct PNG files, 240×360 dimensions,
at most 64 KiB each, exact registry coverage, and four literal static source
references. The SQL migration is the runtime metadata authority; test
expectations and the poster registry do not become another selection catalog.

## R01: Intentional Update Versus Normal Check

Only after the implementation's schema and RPC are final, intentionally update:

```sh
npm run db:reset
npm run db:types
npm run db:types:check
```

Review the generated changes in `src/types/database.generated.ts` and include
that canonical artifact with the implementation's versioned schema. Preserve
`scripts/database-types.mjs` and its write/check semantics.

Every normal validation and fresh checkout after that uses:

```sh
npm run db:reset
npm run db:types:check
```

A drift failure blocks validation. Do not run the write command just before the
normal check to hide a mismatch, and do not hand-edit generated types.

## Database and Client Checks

```sh
npm run lint
npm run typecheck
npm run test:client
npm run db:test
npm run web:export
```

The new database suite runs alongside the preserved room membership/security
suite. Extend its exact schema expectations for the new table, ninth room field,
third rooms FK, and named check. Test actual role-level operations and constraint
violations, not only SQL definitions.

Required RPC evidence includes exact grants/owner/definer/search_path,
unauthenticated rejection, null-subject rejection, own Waiting, null room input,
unrelated Waiting/Ready versus nonexistent equality, first assignment,
no-write repeats, and transaction rollback. Empty-catalog and post-UPDATE fault
trials are rollback-scoped test fixtures, not deployed application APIs.

For concurrency follow the [real-session barrier contract](contracts/candidate-rpc.md#deterministic-real-session-race):
two independent authenticated participant sessions, one real Ready/NULL room,
an owner-held row lock, and observed blocking for both real RPCs before release.
Compare both available results and the committed FK. Snapshot the winner's
committed whole row plus xmin before the second commit and compare the final
snapshot to prove the second caller did not write. Bound waits and clean up
connections/committed synthetic fixtures on every outcome. These synthetic SQL
Auth rows consume no GoTrue signup budget.

Client evidence covers all result shapes/outcomes/nullability, malformed rows,
unknown poster keys, zero Waiting requests, automatic Ready acquisition,
single-flight effect replay, stale room/generation/attempt suppression, immutable
metadata, safe errors, explicit retries, actual image callbacks, and preservation
through channel reconnect. A poster retry remounts the same source without RPC;
an acquisition retry calls the same idempotent RPC.

Web export must include all four statically referenced PNG assets. Check source
coverage and the produced local asset files; do not infer packaging from a
poster_key string or merely a successful export exit code.

That inclusion check belongs to phase 6, when the screen imports the candidate
layer. Phase 5 checks source files/registry and the existing application's build;
an unimported module is not assumed to be in the application bundle.

## C1 and Browser Harness Readiness

Before ordinary acceptance, run the unchanged security wrapper semantics:

```sh
npm run playwright:install
npm run test:e2e:security
```

The controlled C-probe's deliberate inner failure must yield the expected
successful safety-wrapper result and finalized clean artifact scan. Preserve
its image-free capture surface. No trace, HAR, video, storage-state export, or
raw Auth/Realtime/request logs.

Existing screenshot eligibility rejects all images, including CSS backgrounds.
For normal Ready UI assertions, the implementation adds a separately named
bounded text/attribute credential check. Keep the strict screenshot inspection
and scanner intact. Permit only fixed new case/file labels in the safe diagnostic
allowlists. No poster screenshot is required or authorized by this guide.

Reuse existing signup observers, in-memory credential registration, safe
assertions, actual transport fault routing, socket controls, and cleanup.
Adapt the owner room snapshot to the ninth field. Preserve E06's one membership
transition while accounting separately for the assignment UPDATE; baseline full
Ready rows only after candidate acquisition settles. Apply the same rule to
affected E12 trials. All earlier acceptance cases must remain discoverable.

Complete the F01 helper/barrier, explicit testMatch entry, fixed safe labels,
ordinary image-bearing UI inspection, and legacy row/UPDATE adaptations in phase
6 before its gate. At that checkpoint, unfiltered acceptance discovers 25 cases
(the existing 24 plus F01), N=49; C1 + acceptance reserves 50. Phase 7 adds F02–F08
and updates discovery/accounting expectations to 32 cases and N=65. No checkpoint
depends on test infrastructure deferred to the next phase.

## Two-Browser Acceptance and Exact Coverage

After C1 is green and sufficient budget is reserved:

```sh
npm run test:e2e -- --grep '@candidate'
```

After phase 7 this filtered command must discover exactly eight cases. An F01 development
checkpoint uses `npm run test:e2e -- --grep 'F01'`; it does not replace the
complete suite.

| Case | Spec scenarios | Real-stack evidence | Maximum signups |
| --- | --- | --- | ---: |
| F01 | 1, 2, 3, 4, 5, 8, 12 | Waiting absence, own direct not_ready, automatic synchronized host/guest acquisition, matching complete catalog data and loaded poster, sequential/overlapping repeat reads, local traffic | 2 |
| F02 | 9, 10, 11 | Host reload, guest reload, then separate actual socket-loss/reconnect trials for both after successful display; same candidate and membership | 2 |
| F03 | 15 | Original host loses connection in Waiting; guest joins and sees candidate; original host recovers the same candidate after reconnect | 2 |
| F04 | 6 | Two unrelated Ready rooms/four distinct members; foreign and nonexistent RPC results remain identical through initial/concurrent/repeated access, reload, reconnect, and retry | 4 |
| F05 | 7, 13 | Abort both first requests before server forwarding; prove Ready/NULL and generic errors; simultaneous explicit retries establish one assignment | 2 |
| F06 | 14 | Two sequential fresh-room trials using the same two authenticated contexts; reverse which member fails while the other sees the assignment; retry preserves it | 2 |
| F07 | 16 | Commit actual first RPCs but lose both browser responses before either sees metadata; prove persisted FK; concurrent retries return that assignment | 2 |
| F08 | 17 | Fail the exact local PNG request once; show recoverable incomplete display; same poster retry loads visibly with unchanged ID/title/year/FK | 2 |

Every case attaches signup observers before navigation and asserts its cap,
stable membership, zero recovery signups, and no conflicting successful
candidate. Keep candidate IDs and owner snapshots in memory; never render an
internal ID as movie information or dump responses to diagnostics.

F01 installs outgoing request holds before the room becomes Ready. Observe both
automatic requests with zero forwarded, then release both to the actual RPC.
Database overlap is separately proven by the PostgreSQL barrier; two browser
requests alone are not proof of database-session overlap.

F04 must compare exact `not_found` plus four NULL fields using real authenticated
clients in both directions and verify assignments remain unchanged. Both rooms
normally receive the same fixture, so absence of a foreign title on screen is
not sufficient isolation evidence. Repeated failures expose only generic UI.

F05 must abort without `route.fetch` for both participants; otherwise the other
request could assign and invalidate the intended Ready/NULL precondition.
F06 creates its second room through the existing authenticated session, never
the helper that obtains a fresh anonymous identity. Use a new creation request
ID and the returned room ID; a participant may now own two fixture rooms, so do
not reuse an assertion that its complete own-rooms list has length one.

F07 uses actual forwarding with bounded
`route.fetch({ maxRetries: 0, maxRedirects: 0, timeout: 15000 })`.
Validate real successful available responses in memory, abort both deliveries,
and dispose them. Observe the committed room FK before retry. Never fulfill a
synthetic successful response. F05/F07 concurrent retries use the same outgoing
barrier principle as F01.

F02/F03 must close the actual browser/server socket paths and restore a real
subscription with the existing system-ok/refetch readiness barrier. A transport
SUBSCRIBED label, a sleep, or an offline flag alone is insufficient evidence.
Do not clear an already successful candidate while synchronization recovers.

## Poster and Local-Traffic Evidence

React Native Web 0.21.2 paints the visible Image wrapper using a CSS background
and contains a hidden accessibility img. Verify together:

- correct title/year and no internal candidate ID as visible movie information;
- visible wrapper with positive rendered bounds and the expected painted
  background source;
- actual local PNG load, positive decoded natural dimensions, and the card's
  success transition only after onLoad;
- identical poster source and immutable candidate metadata after F08 retry;
- zero RPC calls caused solely by poster retry.

Use a fresh browser context with the one-shot exact asset route installed before
its first load so cache cannot bypass the intended F08 failure. Match the source
resolved from the static registry/local export; do not intercept all images or
invent a successful image response. Failed display must expose the generic retry
state, never count as a complete candidate.

The installed Expo Metro PNG transform was verified read-only during review:
even a 188-byte PNG produces a file URI, with an asset hash for export, rather
than being inlined. Assert that F08 actually intercepts an app-origin HTTP PNG
request. A data/blob URI, zero injected failures, or a remount without successful
load is failed evidence. This verifies mechanism feasibility; the four future
poster files still need their own source/export/browser checks.

Derive page-network allowed origins from the actual application baseURL and
configured local Supabase URL. Current endpoints are application/Metro
`http://127.0.0.1:8081` and Supabase `http://127.0.0.1:55321`, including their
existing WebSockets. Observe page requests from before navigation through the
display/recovery flows; retain only safe counts/booleans for diagnostics.

Classify the ensure RPC as candidate traffic to local Supabase and the resolved
PNG as candidate traffic to the application origin. All candidate dependencies
must remain in those categories. Existing app/Metro/Auth/Realtime requests retain
their current local-infrastructure rules; runner/installation traffic is separate.

The resolved poster must come from the local application bundle. Assert zero
external movie/metadata/image traffic. Preserve the existing runner-owned Docker
browser-control/loopback forwarding, whose control connection is outside page
movie traffic. Registry access during npm/Docker preparation is also distinct
from acceptance movie requests. Do not impose a global network block or a list
of external movie domains that leaves other external providers unchecked.

## Requirement Evidence Map

| Requirements / success criteria | Primary evidence |
| --- | --- |
| FR-001–FR-005, FR-020; SC-001, SC-005 | Schema/exact-fixture checks and F01 automatic Waiting → Ready flow |
| FR-006–FR-010; SC-002 | F01 catalog/result/UI comparison, all-four asset checks, actual poster painting |
| FR-011–FR-012; NFR-002; SC-004 | Real-session barrier/no-second-write assertions; F01 overlap/repeats; F05/F07 concurrent retry |
| FR-013–FR-015; SC-003 | F02 independent reload/reconnect and F03 Waiting-disconnect recovery |
| FR-016; NFR-003; SC-007 | Direct privilege denial, null-safe RPC member checks, F04 full access/recovery matrix |
| FR-017–FR-019; SC-006 | Rollback/no-write database checks, stale/immutable client tests, F05–F08 failure/retry |
| FR-021 | Preserved Feature 001 suite and membership/identity checks throughout F01–F08 |
| NFR-001; SC-008 | Exact supplied catalog, all-four local assets, export inclusion, page-network evidence |

## Full Fresh-Checkout Validation

Use a clean versioned checkout containing the completed implementation and its
canonical types. Reserve 66 signups independently of previous validation.
Run the following in one POSIX-compatible shell so failure still shuts down the
local stack:

```sh
set -eu
cleanup_candidate_services() {
  candidate_validation_exit=$?
  trap - EXIT INT TERM
  set +e
  npm run supabase:stop
  candidate_stop_exit=$?
  if [ "$candidate_validation_exit" -ne 0 ]; then
    exit "$candidate_validation_exit"
  fi
  exit "$candidate_stop_exit"
}
trap cleanup_candidate_services EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
npm ci
npm run supabase:start
npm run env:local
npm run db:reset
npm run db:types:check
npm run lint
npm run typecheck
npm run test:client
npm run db:test
npm run web:export
npm run playwright:install
npm run test:e2e:security
npm run test:e2e
npm run supabase:stop
trap - EXIT INT TERM
```

The unfiltered acceptance run must discover the existing 24 cases plus eight
candidate cases: 32 total, maximum N=65. It must not silently run only Feature
001. Treat a failed required check, skipped candidate case, missing asset, or
unsafe artifact as failed final validation.

## Two-Run Repeatability and Validation Record

Separately reserve 131 signups and prepare dependencies/browser runtime once.
Using the same cleanup trap, continuously started local stack, and environment,
run this sequence without restarting Supabase between the two acceptance runs:

```sh
npm run db:reset
npm run db:types:check
npm run test:e2e:security
npm run test:e2e
npm run db:reset
npm run db:types:check
npm run test:e2e
```

Both runs are unfiltered, independently clean database runs. The second reset
does not replenish Auth allowance. Shut down via the existing wrapper/trap
afterward. Three complete runs require 195 before C1 and cannot be scheduled
under a fresh allowance of 150. If C1 is run before each of two full runs, reserve
132 instead of 131.

Future implementation evidence records checkout/commit, command exit results,
discovered case counts, per-case/signup totals, both repeatability results,
fresh-checkout result, finalized C1 scan results, local poster/export/network
assertions, and successful shutdown. Use existing safe diagnostic outputs;
do not paste credentials or raw RPC/network data. This planning workflow creates
the guide only and supplies no runtime pass claim.
