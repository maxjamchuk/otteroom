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

## Phase 1 G1 Validation Record — 2026-09-09

Implementation scope: T001–T006 only. Started on `main` with an empty
`git status --short` at `c4cfece5a9463d194a3b3f06cdd662d498f44a7d`
(`docs: define first movie candidate feature`). The existing installed Node
v24.20.0/npm 11.19.0 runtime was used; no dependencies or configuration changed.
The results in this section are implementation evidence for G1 only; later
database, application, packaging and browser checks above remain future work.

T001 discovery confirmed the planned root `assets/candidates/` directory and
filenames had no collisions. The existing Expo/Metro PNG support and
`@/assets/*` TypeScript alias need no configuration change. The new
`__tests__/candidates/assets.test.ts` uses existing Jest and Node built-ins;
its expectations are test-only, with no runtime catalog or poster registry.

| Command / inspection | Actual result |
| --- | --- |
| `npm run test:client -- --runTestsByPath __tests__/candidates/assets.test.ts` before asset creation | Expected exit 1: six checks failed with ENOENT for the absent directory/files |
| Same focused command after asset creation | Exit 0: one suite, 6/6 tests passed |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm run test:client` | Exit 0: 17/17 suites, 282/282 tests passed, including the 276 existing tests |
| `file assets/candidates/*.png` and binary metadata/size inspection | Exactly four non-interlaced, 8-bit RGB PNGs, each 240×360 and below 65,536 bytes |
| Open each original PNG for visual inspection | All four decode and show distinct, usable artwork; no preview copies created |

The automated asset checks validate exact directory membership and regular
files, PNG signatures, chunk ordering/CRCs, IHDR dimensions/profile, complete
IDAT inflation and reconstructed pixel rows, nonempty visible color content,
the size cap, and distinct file and decoded-pixel contents. Only IHDR/IDAT/IEND
chunks are present; no ancillary metadata or external resource references are
embedded. Validation is deterministic and uses no network or renderer dependency.

| Approved file | Dimensions | Bytes | PNG validation |
| --- | --- | ---: | --- |
| `assets/candidates/cardboard-comet.png` | 240×360 | 5,011 | PASS |
| `assets/candidates/pebble-bay-lanterns.png` | 240×360 | 6,521 | PASS |
| `assets/candidates/cloud-tram-four.png` | 240×360 | 5,616 | PASS |
| `assets/candidates/clockwork-orchard.png` | 240×360 | 7,711 | PASS |

All artwork was drawn locally with one-off Python standard-library code:
geometric shapes, gradients and hand-defined pixel lettering, rendered at 3×
resolution and reduced with integer box averaging, then encoded as RGB PNG
with zlib compression. No third-party artwork, fonts, downloads, random input,
Pillow, image service or new package was used. Each complete render/encoding
ran twice in memory and produced byte-identical output before writing its
single source file. No permanent generator was added: the approved deliverable
is the four fixed PNG files plus the repeatable Jest validation.

Visual distinctions are a faceted paper comet on navy, gold lanterns over teal
water, a red suspended tram among pale clouds, and a gold gear tree on plum.
The four approved filename stems provide exact poster-key coverage without
introducing the later client registry.

G1 applicability under Constitution I: fresh installation/clone validation is
not applicable to this asset-only checkpoint, which explicitly reuses installed
dependencies; no dependency or setup contract changed, and T063 owns the full
fresh-checkout run. Application build/export and local application startup are
not applicable to proving these currently unreferenced source images: G1
requires static/client checks, while T047/G6 proves bundle inclusion after UI
imports exist. No packaging or visible application behavior is claimed here.
The reproduced G1 scenario is four valid, distinct local fixtures. Database,
Supabase and browser acceptance are not applicable without schema or application
changes and were not run; this checkpoint consumed zero Auth signups.

G1 is green. Changes are limited to the four PNGs, the asset test, task checkboxes
and this validation record. Feature 001, application code, SQL/migrations/RPC,
generated database types, dependencies and lockfile remain unchanged. No movie
provider or runtime network dependency was introduced. T007–T064 remain
unchecked; implementation stops at this checkpoint without a commit or push.

## Phase 2 G2 Validation Record — 2026-09-09

**Result: G2 PASS; scope T007–T012 only.** Started with a clean `main` at
`49f09ec6a8710dfb14ed8dbd93f89b350daade9e`
(`feat: add candidate poster fixtures`). Used existing Node v24.20.0,
npm 11.19.0, project Supabase CLI 2.116.0 and local PostgreSQL 17.6.
No dependency, toolchain, Auth-quota or application configuration changed.

The only new migration is
`supabase/migrations/20260909000000_movie_candidates_schema.sql`.
It atomically creates the exact five-column catalog and eight named constraints,
revokes all PUBLIC/anon/authenticated table access, enables RLS without policies,
seeds the four approved rows and appends the nullable room FK/check. The existing
three migrations, generated room state, room grants/policy, four room indexes,
room RPCs and rooms-only Realtime publication are unchanged.

| Command / evidence | Actual result |
| --- | --- |
| `npm run supabase:start` → `npm run env:local` | Exit 0 each; isolated project stack started, only ignored public environment configured; values withheld |
| Initial `npm run db:reset` → `npm run db:test`, before new files | Exit 0 each; existing database baseline: 1 file, 287/287 tests |
| `npm run db:test -- supabase/tests/database/room_candidate.test.sql`, before migration | Expected exit 1: seven schema assertions failed; catalog query then reported the absent relation; no schema was supplied by tests |
| `npm run db:reset -- --version 20260905000002` | Exit 0; reproduced Feature 001 schema before the new migration |
| Owner-only upgrade trial below, including `node_modules/.bin/supabase migration up --local` | Exit 0; only the new schema migration applied; both pre-existing room snapshots preserved and fixture cleanup passed |
| Final `npm run db:reset` → `npm run db:test` | Exit 0 each; 2 files, 475/475 tests, no failed or skipped assertion |
| Owner-only schema/seed/ACL/publication/function inspection after tests | Exact approved schema and four rows; no remaining test rooms or Auth users; only create_room/join_room in public |
| `npm run supabase:stop` | Exit 0; all containers for this project stopped; unrelated project containers left running |
| `git diff --check` and untracked SQL whitespace checks | PASS; no whitespace diagnostics |
| Reproduction shell/Python syntax checks | PASS; no additional database or browser run |

Database assertion counts changed from **287 to 475**: the existing
`room_session.test.sql` now has **288** (the original 287 plus the denied
assignment-column SELECT check); `room_candidate.test.sql` adds **187**.
Legacy changes are additive exact-shape expectations for two tables, nine room
columns, the third FK/check and the denied projection, plus corrected nine-field
snapshot labels. All original membership, create/join result shapes, real-session
races, authorization, failure/rollback and publication assertions remain.

New pgTAP evidence covers actual invalid/duplicate/NULL inserts and inclusive
valid year/order boundaries; fixed catalog content and indexes; Waiting/NULL,
Ready/NULL and Ready/assigned success; rejected Waiting assignment and guest
removal; rejected missing-reference assignment and referenced-row deletion/update.
It checks explicit PUBLIC/client ACLs and effective table/column privileges.
Actual anon, host, guest and unrelated authenticated calls cannot browse/mutate
the catalog, read the assignment column, assign/replace/clear it, or insert an
assigned room. Whole-row snapshots prove denial preserves catalog and membership.
Member-only id/code/state reads still work without exposing foreign rooms.

The upgrade trial used two committed owner-only synthetic Auth rows and one
Waiting plus one Ready room with distinct fixed timestamps, before the migration.
After migration, each of the eight previous fields and its xmin were identical;
the ninth field alone was added as NULL. No row was backfilled or rewritten.
Both upgrade fixtures were cleaned in a finally block. The complete pgTAP suite
rolls back its local fixtures; the existing race suite retains its bounded
cleanup. Final inspection found zero rooms and zero Auth users. Total GoTrue
signup attempts: **0**.

### Reproduce the Disposable Upgrade and G2

Use the pinned installed runtime and the existing local Docker prerequisites.
This combines the executed commands and in-memory snapshot trial with the
quickstart's failure-preserving service cleanup. It intentionally resets only
the configured local project; it does not replace the normal full reset path.

```sh
set -eu
cleanup_g2_services() {
  g2_validation_exit=$?
  trap - EXIT INT TERM
  set +e
  npm run supabase:stop
  g2_stop_exit=$?
  if [ "$g2_validation_exit" -ne 0 ]; then
    exit "$g2_validation_exit"
  fi
  exit "$g2_stop_exit"
}
trap cleanup_g2_services EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
npm run supabase:start
npm run env:local
npm run db:reset -- --version 20260905000002
python3 - <<'PY'
import json
import subprocess

psql = ['docker', 'exec', '-i', 'supabase_db_otteroom-room-session',
        'psql', '-X', '-U', 'postgres', '-d', 'postgres',
        '-v', 'ON_ERROR_STOP=1', '-qAt']

def sql(statement):
    result = subprocess.run(psql, input=statement, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('G2 owner SQL failed (details withheld)')
    return result.stdout.strip()

def snapshot():
    return json.loads(sql("""
      select coalesce(jsonb_agg(jsonb_build_object('row',to_jsonb(r),'xmin',r.xmin::text)
        order by r.code),'[]'::jsonb)
      from public.rooms r where code in ('C2A0000001','C2A0000002');
    """))

owned = False
try:
    assert sql("select current_user='postgres'") == 't'
    assert sql("select to_regclass('public.movie_candidates') is null") == 't'
    assert sql("select count(*) from public.rooms") == '0'
    assert sql("select count(*) from auth.users") == '0'
    sql("""
      begin;
      insert into auth.users(id) values
        ('02200000-0000-4000-a000-000000000001'),
        ('02200000-0000-4000-a000-000000000002');
      insert into public.rooms
        (id,code,creation_request_id,host_user_id,guest_user_id,created_at,updated_at)
      values
        ('02300000-0000-4000-a000-000000000001','C2A0000001',
         '02400000-0000-4000-a000-000000000001','02200000-0000-4000-a000-000000000001',
         null,'2020-01-01 UTC','2020-01-02 UTC'),
        ('02300000-0000-4000-a000-000000000002','C2A0000002',
         '02400000-0000-4000-a000-000000000002','02200000-0000-4000-a000-000000000001',
         '02200000-0000-4000-a000-000000000002','2020-02-01 UTC','2020-02-02 UTC');
      commit;
    """)
    owned = True
    before = snapshot()
    assert [entry['row']['state'] for entry in before] == ['waiting', 'ready']
    assert all(len(entry['row']) == 8 for entry in before)
    subprocess.run(['node_modules/.bin/supabase', 'migration', 'up', '--local'], check=True)
    after = snapshot()
    assert len(after) == len(before) == 2
    for old, new in zip(before, after):
        assert set(new['row']) == set(old['row']) | {'movie_candidate_id'}
        assert new['row']['movie_candidate_id'] is None
        assert {k: v for k, v in new['row'].items() if k != 'movie_candidate_id'} == old['row']
        assert new['xmin'] == old['xmin']
    assert sql("select count(*) from public.movie_candidates") == '4'
    assert sql("select count(*) from public.rooms") == '2'
    assert sql("select count(*) from auth.users") == '2'
    print('G2 upgrade PASS: Waiting/Ready preserved; eight prior fields and xmin unchanged; only NULL added; four fixtures; zero GoTrue signups')
finally:
    if owned:
        sql("""
          begin;
          delete from public.rooms where id in
            ('02300000-0000-4000-a000-000000000001','02300000-0000-4000-a000-000000000002');
          delete from auth.users where id in
            ('02200000-0000-4000-a000-000000000001','02200000-0000-4000-a000-000000000002');
          commit;
        """)
        assert sql("select count(*) from public.rooms") == '0'
        assert sql("select count(*) from auth.users") == '0'
        print('G2 upgrade fixture cleanup PASS')
PY
npm run db:reset
npm run db:test
```

### G2 Applicability and Scope Protection

Under Constitution I, the reproduced system scenario is the real database
upgrade/reset, fixture constraints and client-role isolation. Local backend
startup and full database regression were executed. Fresh dependency installation,
application build/startup, lint, TypeScript/client tests and browser acceptance
are not applicable to this schema-only gate: T012 requires reset/pgTAP, no
application/dependency files changed, and existing RPC signatures/projections
remain identical. They were not rerun or claimed as new G2 evidence. Full
fresh-checkout verification belongs to T063.

Both database type commands are deliberately deferred until the finalized RPC
contract in Phase 4, as required by R01 and the approved Phase 2/3 gates.
No canonical type consistency or candidate application behavior is claimed at G2.
The type artifact remains unchanged; no candidate RPC/function, service, hook,
registry, UI, channel, E2E case or external movie dependency was introduced.
Feature 001 specification artifacts and Phase 1 PNGs are unchanged.
Only T007–T012 are newly completed; T013–T064 remain unchecked. Work stops at G2
without a commit or push.


## Phase 3 G3 Validation Record — 2026-09-09

**Result: G3 PASS; scope T013–T018 only.** Started with an empty
`git status --short` on `main` at
`28168750ee71d607ad07b194eff74cb352243aa7`
(`feat: add movie candidate schema`). Required documents were read completely;
the requirements checklist passed 16/16 without edits. Used installed Node
v24.20.0/npm 11.19.0, Supabase CLI 2.116.0 and local PostgreSQL 17.6.
No installation, branch change, dependency or configuration-contract change.

Created only
`supabase/migrations/20260909000001_room_candidate_rpc.sql`.
Extended `supabase/tests/database/room_candidate.test.sql`; the committed
Phase 2 migration and `room_session.test.sql` were not edited.

| Command / inspection | Actual result |
| --- | --- |
| `npm run supabase:start` → `npm run env:local` | Exit 0 each; existing safe wrapper and ignored public environment; no values printed |
| Initial `npm run db:reset` → `npm run db:test`, before changes | Exit 0 each; 2 files, baseline 475/475 assertions |
| `npm run db:test -- supabase/tests/database/room_candidate.test.sql`, tests written before RPC | Expected exit 1: missing function; 19 failed of 73 emitted assertions before the first ordinary result comparison stopped the file; remote fixtures/connections cleaned |
| Focused candidate run after RPC and harness corrections | Exit 0; 294/294 assertions, before the six additional broken-reference assertions |
| Final `npm run db:reset` → `npm run db:test` | Exit 0 each; all five migrations replayed; 2 files, 588/588 assertions, no failed or skipped assertion |
| Owner-only post-suite function/ACL/schema/cleanup inspection | Exact contract below; four catalog rows, zero rooms/Auth fixtures, zero application/test triggers or test helper functions; dblink extension rolled back |
| `npm run supabase:stop` | Exit 0; no containers for this project remain; unrelated project containers left running |
| `git diff --check` and direct SQL whitespace checks | PASS; new migration included in explicit whitespace inspection |

The final total is **288 unchanged Feature 001 assertions + 300 candidate
assertions = 588**. The candidate file retains all **187 Phase 2 assertions**
and adds **113 Phase 3 assertions**. During development, the harness needed
parentheses around JSON row extraction before field subtraction and a correction
to its extra UPDATE counter oracle: reused backends can retain unflushed local
statistics across transactions. It now measures the counter delta within each
open transaction before COMMIT. An owner-only rollback trial confirmed that
behavior; [PostgreSQL's statistics documentation](https://www.postgresql.org/docs/17/monitoring-stats.html)
describes these unflushed local counts. These were test corrections; the approved
lock/row-version contract and production RPC were not weakened or redesigned.

### RPC, Security and Atomic Behavior

The deployed signature is exactly:

`public.ensure_room_candidate(p_room_id uuid) RETURNS TABLE (outcome text, candidate_id text, title text, release_year smallint, poster_key text)`

The function is PL/pgSQL, SECURITY DEFINER, owned by `postgres`, with only
`search_path=""` in proconfig. Its exact ACL contains EXECUTE for `postgres`
and non-grantable EXECUTE for `authenticated`; PUBLIC and anon have none.
An actual anon call fails with SQLSTATE 42501 even with a subject claim.
An authenticated role without auth.uid() separately raises 42501 before
handling the room input. There is no caller-provided identity argument.

| Observed case | Exact result / preservation |
| --- | --- |
| Own Waiting | One `not_ready` row; all four candidate fields NULL; complete room, membership, timestamps, xmin and ctid unchanged |
| NULL/nonexistent/unrelated Waiting/unrelated Ready/unrelated assigned room | Identical one-row `not_found`, four NULL fields; no row update or private metadata disclosure |
| Own first Ready/NULL, including retry after the injected rollback | One complete `available`: fixture-cardboard-comet / The Cardboard Comet / 2020 / cardboard-comet, matching the actual minimum-sort catalog row |
| First assignment | Only movie_candidate_id and transaction updated_at change; all other fields, membership and Ready state preserved |
| Host and guest repeats | Same complete result; whole rows, timestamps, xmin and ctid preserved |
| Existing non-lowest assignment | fixture-clockwork-orchard / The Clockwork Orchard / 2023 / clockwork-orchard returned unchanged; no reselection/update |
| Empty catalog | Own Waiting still returns not_ready; own Ready raises P0001, no business row; Ready/NULL and membership preserved; all four fixtures restored by subtransaction rollback |
| Actual AFTER UPDATE exception | P0001, no partial assignment; a nontransactional test sequence observes exactly one attempted assignment before rollback; complete Ready/NULL row and physical version preserved |
| Impossible missing referenced candidate | Rollback-only privileged removal of the FK/referenced row provokes P0001; no fallback candidate; assignments/rows preserved and catalog/validated FK restored |

All real RPC business calls use authenticated participant roles/subject claims.
Privileged connections only arrange faults/fixtures and inspect postconditions.
The function has one fixed UPDATE statement, schema-qualified references, no
dynamic SQL, advisory locking, test hooks, helper RPC or hard-coded fixture ID.
Both table RLS policies/grants remain intact: clients cannot browse/mutate the
catalog or directly read/change room assignment. The room projection remains
id/code/state and the publication remains public.rooms only.

### Deterministic Session Evidence

The candidate test reuses Feature 001's local dblink controller, authenticated
caller setup, bounded observation and terminal-result draining conventions.
The supabase_admin controller installs the rollback-scoped extension/helpers
and immediately revokes all dblink entry EXECUTE from PUBLIC/anon/authenticated.
A separate postgres owner connection commits exactly two UUID-only Auth rows
and one Ready/NULL room. No GoTrue signup is involved.

For both first acquisition and overlapping repeat access:

1. Independent host/guest backend PIDs are verified against their individual
   auth.uid(), authenticated role and explicit READ COMMITTED transaction.
2. The owner coordinator holds the exact room FOR UPDATE. Both real RPC calls
   are dispatched asynchronously before collection; both are observed busy and
   waiting through its pg_blocking_pids chain, including queued callers.
   Ungranted tuple/transaction-ID locks corroborate the live waits.
3. Only after this barrier is the owner released. Before the winning caller
   commits, the second RPC is again observed busy and directly blocked by that
   winner's tuple/transaction lock.
4. The winner's result is collected/drained and its transaction commits.
   The owner records its committed full room and xmin before the second commit;
   the second result is then collected/drained and committed.
5. Both results are identical five-field available rows. The FK matches both,
   exactly one trial room exists, all four catalog rows are unchanged, and
   host/guest/state/creation fields remain intact.

The per-caller room UPDATE deltas are **winner=1, second=0** on first
acquisition. The initial xmin changes once; the final full row/xmin exactly
equal the winner's committed snapshot. Overlapping repeats give **host=0,
guest=0**, preserving that same whole row/xmin throughout. Sequential tests
also compare ctid to detect same-transaction same-value UPDATEs.

Observation/draining deadlines are eight seconds, remote statement/lock limits
are bounded, and cleanup checks backend exit within five seconds. No sleep,
timing guess, sequential substitute or production synchronization hook proves
overlap. A separate cancellation trial cancels an actual blocked RPC at the
observed barrier (57014), then verifies the same bounded cleanup of both callers,
the owner, locks, committed room and both synthetic identities.

### Reproduce G3 and Scope Protection

Use the installed pinned runtime and existing Docker prerequisites:

```sh
set -eu
cleanup_g3_services() {
  g3_validation_exit=$?
  trap - EXIT INT TERM
  set +e
  npm run supabase:stop
  g3_stop_exit=$?
  if [ "$g3_validation_exit" -ne 0 ]; then
    exit "$g3_validation_exit"
  fi
  exit "$g3_stop_exit"
}
trap cleanup_g3_services EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
npm run supabase:start
npm run env:local
npm run db:reset
npm run db:test
```

Under Constitution I, G3 reproduces the actual database/security/concurrency
slice through local backend startup, clean replay and full pgTAP regression.
Lint, TypeScript/client tests, application startup/export, browser acceptance,
fresh install and fresh checkout are not applicable to this database-only gate:
T018 requires reset/database tests, and no client, build, dependency or setup
contract changed. They were not run or claimed as G3 evidence; later gates own
them. Both generated-type commands remain deliberately deferred to Phase 4/R01;
no type consistency claim is made before T019.

GoTrue signup attempts: **0**, including fault/cancellation/diagnostic trials;
C1/browser E2E were not run and no browser diagnostics/capture settings changed.
No candidate client service, registry, state, hook, UI, extra Realtime channel,
polling or external movie dependency was created. Generated database types,
package.json/package-lock.json, Phase 1 PNGs, the Phase 2 migration and all
Feature 001 implementation/specification artifacts remain byte-identical to
the starting HEAD.

Only T013–T018 are newly checked: T001–T018 complete, T019–T064 unchecked.
Implementation stops at G3 without a commit or push.

## Phase 4 G4 Validation Record — 2026-09-09

**Result: G4 PASS; scope T019–T020 only.** Started with an empty
`git status --short` on `main` at
`f2aa8308626ef6f9825bcde40ad8a01f893d6d6f`
(`feat: add room candidate assignment rpc`). Read all required inputs and the
current migrations/type infrastructure. Used installed Node v24.20.0,
npm 11.19.0 and project Supabase CLI 2.116.0. No dependencies were installed.

The starting canonical `src/types/database.generated.ts` SHA-256 was
`46f41c3ca2a88d65a2604f449b17aa10c36b535c8ee0a67047683fb37f80fb4b`.
Both resets replayed exactly the five committed migrations through
`20260909000001_room_candidate_rpc.sql`; no manual schema SQL was applied.

| Command / inspection, in execution order | Actual result |
| --- | --- |
| `npm run supabase:start` → `npm run env:local` | Exit 0 each; safe wrapper and ignored public environment, values withheld |
| First `npm run db:reset` | Exit 0; clean committed schema/RPC baseline |
| `npm run db:types` | Exit 0, `written`; exactly one intentional canonical generation |
| Immediate `npm run db:types:check` | Exit 0, `consistent`; canonical bytes, metadata and scoped Git diff unchanged |
| Generated diff and read-only PostgreSQL metadata inspection | Only the approved catalog, nullable room FK and candidate RPC additions; exact schema/signature confirmed |
| Second `npm run db:reset` → `npm run db:types:check` | Exit 0 each, `consistent`; no intervening write generation; T020 stability evidence below |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Exit 0 |
| `npm run test:client` | Exit 0: 17/17 suites, 282/282 tests; includes all 8 existing database-types tests |
| `npm run supabase:stop` | Exit 0; no project containers remain running |
| `git diff --check` | PASS |

### Generated Surface Review

- `movie_candidates.Row` and `.Insert` have exactly five required, non-null
  fields: id/title/poster_key are string, release_year/sort_order are number.
  `.Update` makes those same fields optional without adding null. This matches
  the five NOT NULL columns without defaults; Relationships is empty.
- `rooms.Row.movie_candidate_id` is `string | null`; Insert and Update expose
  `movie_candidate_id?: string | null`. The generated relationship names
  `rooms_movie_candidate_id_fkey`, references movie_candidates.id and has
  `isOneToOne: false`, consistent with multiple rooms sharing one fixture.
- `ensure_room_candidate.Args` is `{ p_room_id: string }`. Returns is an array
  of exactly candidate_id/outcome/poster_key/title as string and release_year
  as number. The pinned generator emits no `| null` or closed outcome union for
  this RETURNS TABLE result. This is the limitation explicitly anticipated by
  the RPC contract and plan; runtime logical-nullability validation belongs to
  Phase 5. The generated output was not manually corrected.
- Existing create_room/join_room signatures, prior room fields, generic helpers
  and other public sections remain unchanged. No unexpected public surface was
  added. The live metadata inspection found only the two approved public tables
  and three application RPCs, four catalog rows, zero rooms and zero Auth users.

### R01 Check-Only Stability

T020 captured the canonical artifact after T019, then compared it after the
second clean reset/check and again after lint/typecheck/client tests:

| Measurement | Before T020 reset | After reset/check and regressions |
| --- | --- | --- |
| SHA-256 | `f6b77ecf056b1ccb68f2c43a48fccde2a305a5fe8ee20d0124120050d0415a69` | `f6b77ecf056b1ccb68f2c43a48fccde2a305a5fe8ee20d0124120050d0415a69` |
| File bytes | 7,370 | 7,370 |
| mtime_ns | `1788966938747066009` | `1788966938747066009` |
| ctime_ns | `1788966940057157360` | `1788966940057157360` |
| inode | `444960` | `444960` |
| Scoped binary Git diff SHA-256 | `45a3b83265cd331182c40c4ab7854df2cfd83f812c8c1762466f03efaf460da5` | `45a3b83265cd331182c40c4ab7854df2cfd83f812c8c1762466f03efaf460da5` |

The complete Git diff also remained byte-identical during T020 and its
regressions. No `.database.generated.*.tmp` files remained. This record and the
two task-checkbox updates were added after that successful comparison.
The immediate T019 check preserved the same canonical metadata as well.
Total actual canonical write commands: **1**; real check commands: **2**.
Existing database-types unit tests use synthetic output in disposable temporary
directories and do not regenerate the repository artifact.

The normal validation measurement can be reproduced with the pinned runtime
and a started local stack, using the existing failure-preserving shutdown
discipline. The following block performs only reset/check and stops the stack
on success or failure:

```sh
python3 - <<'PY'
from pathlib import Path
import hashlib
import subprocess

p = Path('src/types/database.generated.ts')
def snapshot():
    data, stat = p.read_bytes(), p.stat()
    diff = subprocess.check_output(['git', 'diff', '--binary'])
    return (hashlib.sha256(data).hexdigest(), len(data), stat.st_mtime_ns,
            stat.st_ctime_ns, stat.st_ino, diff)

try:
    before = snapshot()
    subprocess.run(['npm', 'run', 'db:reset'], check=True)
    subprocess.run(['npm', 'run', 'db:types:check'], check=True)
    assert snapshot() == before
    assert not list(p.parent.glob('.database.generated.*.tmp'))
    print('G4 check-only PASS: canonical content, metadata and Git diff unchanged')
finally:
    subprocess.run(['npm', 'run', 'supabase:stop'], check=True)
PY
```

### G4 Applicability and Scope Protection

Under Constitution I, this slice reproduces intentional generation from the
committed local schema and subsequent non-mutating validation, then checks
existing TypeScript/client compatibility. Fresh install/clone, application
startup/build/export, browser acceptance and another pgTAP run are not
applicable to G4: T020 requires reset/type checks plus lint/typecheck/client
tests; no migration, RPC, runtime application, dependency or setup contract
changed. Full fresh-checkout evidence remains T063. No candidate display or
browser acceptance result is claimed. GoTrue signup attempts: **0**.

Changes are limited to the canonical generated types, T019/T020 checkboxes and
this record. All 115 other tracked files remain byte-identical to the starting
HEAD, including Phase 1 PNGs, Phase 2/3 migrations, database tests, Feature 001
implementation/specification artifacts, dependencies and R01 scripts. No new
versionable file, candidate client/registry/state/hook/UI, browser case,
Realtime channel or external movie dependency was introduced.
T001–T020 are checked; T021–T064 remain unchecked. Work stops at G4 without
a commit or push.
