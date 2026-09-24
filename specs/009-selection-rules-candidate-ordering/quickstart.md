# Quickstart Validation: Selection Rules and Candidate Ordering

**Feature**: 009 — Selection Rules and Candidate Ordering
**Current status (2026-09-25): RELEASE-COMPLETE; READY TO COMMIT.** The owner's
latest-product-source manual live-TMDB mixed-clause browser recheck PASSED; no
Feature 009 release blocker remains. T096/T097 passed for their earlier tested
source at `23 + 22 = 45` charged identities, and T100 G5 passed for that
source. Those receipts do not certify the later mixed-clause correction. The
owner waived and discontinued T098
fresh-checkout certification; it did not pass, its planned additional 17
identities were not spent, and all attempt receipts remain historical. Feature
010 Discovery and Feature 011 Match remain unstarted.

**Runnable evidence ledger:** T070–T074 are preserved for their tested source;
T075–T077 record the numeric traversal recovery; T078–T094 remain historical
receipts for their respective source identities. The latest charged
browser receipts are T096/T097 for their tested source. The appended T099/T100
record the owner disposition, then-current worktree validation, and G5 audit.
The latest owner addendum at the end of this file records the passed latest-source
browser recheck and separate operational YAML observation.

## Implementation Evidence Ledger

### T001 baseline — 2026-09-21

Captured at `2026-09-21T14:53:04+05:00` on branch `main`, HEAD
`e55a53bbc6494691f9a9e636cfead61a29255982`.

Environment declared by the repository: Node `24.20.x`, npm `11.19.0`, Supabase
CLI `2.116.0`, Deno `2.5.2`, TypeScript `6.0.3`, PostgreSQL `17`.
Environment observed: Node `v24.12.0`, npm `11.6.2`, Deno `2.5.2`; no PATH or
`node_modules/.bin` Supabase executable was available. The `npx supabase --version`
probe reached the pinned CLI but could not write its home telemetry file because
that path is read-only, so no CLI version is claimed as observed. The YAML parser
dependency is present at `2.9.0` in the installed dependency tree.

Baseline command results:

```text
git rev-parse HEAD                  PASS e55a53bbc6494691f9a9e636cfead61a29255982
git status --short --branch         PASS main; pre-existing docs edits and untracked Feature 009 artifacts
git diff --check                    PASS
config/selection-rules.yaml        ABSENT
Feature 009 migration               ABSENT
generated types write               NOT STARTED
Feature 009 runtime                 NOT STARTED
charged browser/R02 work           NOT STARTED; zero identities consumed by this feature
Feature 010 / Match                 NOT STARTED
```

Historical migration SHA-256 and generated-type provenance:

```text
d6222184274428c6dd5d629e4d3416a582e0a74f355c8c6fe1d389630ecad439  supabase/migrations/20260905000000_rooms_schema.sql
fda4126812feffb7bac5d737d6faae1930db35bbc26a1cb9402fcbad24b5b45c  supabase/migrations/20260905000001_room_rpcs.sql
71816083a6e1630ab663fa4fd41354b936efa714571809fffca4528f2312f7a9  supabase/migrations/20260905000002_rooms_realtime.sql
04487a75fadafe40a255f9ab3998b64c1109c9de6f4e4324ba441f8856531c38  supabase/migrations/20260909000000_movie_candidates_schema.sql
1b78eeb52ce9bb194b9530f48b49428b8f5bb7c523ab22d5406e9814d0e8dc52  supabase/migrations/20260909000001_room_candidate_rpc.sql
9813e830957f82febe184e54a5148faff159f046912b325b0a77d835ae33a71f  supabase/migrations/20260910000000_generalized_room_membership.sql
432c6d41ca37d0ea2b3ad00324854c3ec17338f3b6c21a4c4cfe3946c1c54ff0  supabase/migrations/20260911000000_participant_filters.sql
10986dc43cad50668e520f16b2c3dbbd44e4cebb1384afb0cb2cfd5798898f1d  supabase/migrations/20260912000000_common_filter_resolution.sql
52ab29707d8d6bdf04d888d4578fab92c92c805c3151ede710dc3992c5ac2640  supabase/migrations/20260914000000_tmdb_candidate_source.sql
42a9b0d8e33b308e712a12204875d35ca3112adfd2372a117af5e78b69b4264f  supabase/migrations/20260916000000_swipe_decisions.sql
3ff30b48941ac8a5211a55137df3f7d436ad5e431854bc9bf31b6d8d727b1517  supabase/migrations/20260918000000_candidate_progression.sql
1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067  src/types/database.generated.ts
```

The approved initial operational generation is `vote_count_desc`, minimum vote
count `500`, omitted minimum average rating, `en-US`, genre mode `or`, and exact
`2/3`; edits activate only after successful rebuild/redeploy/restart and only for
new rooms. Existing snapshots remain immutable. The planned SQL sequence is the
single additive Feature 009 migration after `20260918000000_candidate_progression.sql`,
followed by the sole generated-types write at T063 and check-only validation from
T064 onward. The R02 formulas are `23`, `22`, cumulative `45`, fresh checkout `17`,
and cumulative repeatability plus fresh checkout `62`. Baseline browser inventory is
Feature 008's `46 cases / 112 identities` plus C1's separate one-identity probe;
Feature 009's approved projection is `48 cases / 118 identities`, or `119` with C1.

### T002–T069 implementation and deterministic gate — 2026-09-21

Feature 009 implementation, deterministic tests, protected migration evidence, and
the pre-browser validation block completed at the current working-tree source state.
The task ledger marks T002–T069 complete; T070 is the exact next task. No browser
acceptance command, R02 admission, or anonymous identity was started.

Configuration and startup evidence:

```text
node scripts/check-selection-rules-config.mjs  PASS
  canonical-bytes=118 assets=2 byte-identical=true client-inclusion=false env-overrides=false
npm run test:edge                            PASS 58 passed, 0 failed, 1 intentionally ignored live contract
npx jest --runInBand __tests__/config/feature008-e2e-profile.test.ts __tests__/config/feature009-e2e-profile.test.ts PASS 2 suites, 15 tests
```

The live TMDB contract remains an intentionally ignored/credentialed check in the
Edge suite; it was not used as the deterministic ordering or exhaustion oracle.
The canonical YAML is server-only, loaded once at startup, and has no client or
environment override path.

Database and migration evidence:

```text
npm run db:reset && npm run db:test       PASS 932 tests across 8 database files
seven protected nonempty runners          PASS (membership, participant filters,
                                             common resolution, TMDB source,
                                             swipe decisions, progression, 009)
selection-rules runner                    PASS legacy-rooms=10 members=21 filters=15
                                             occurrences=4 decisions=2; historical
                                             migrations/types byte-identical; TMDB/GoTrue/type-generation not called
npm run db:types:check                    PASS after clean reset; check-only thereafter
```

T063 was the sole generated-types write. The receipt was:

```text
before  sha256=1c396e72678c1b469cf8fcd364228d17805ff7b11911762b90937c6966d33067
        inode=11577791 size=20142 mtime=2026-09-19 04:50:58.996136183 +0500
write   SUPABASE_TELEMETRY_DISABLED=1 npm run db:types  PASS
after   sha256=69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
        inode=11577831 size=20779 mtime=2026-09-21 16:52:27.499977389 +0500
```

T064 independently reset the latest schema and ran only `npm run db:types:check`;
the generated file remained byte-identical with unchanged inode, size, and mtime.
No generated-types write was run after T063.

Client, static, and artifact evidence:

```text
npm run test:client                       PASS 50 suites, 833 tests
npm run typecheck                         PASS
npm run lint                              PASS
npm run web:export                        PASS (5 static routes exported)
node scripts/check-e2e-artifacts.mjs ...  PASS; 3 files, 0 findings
git diff --check                          PASS
native iOS/Android export                 NOT APPLICABLE; no native export scripts exist
```

The full database matrix includes concurrency, CAS/no-repeat, recovery, ACL/RLS,
privacy, source-failure versus authoritative-exhaustion, exact agreement arithmetic,
legacy behavior, and configured ordering/filtering evidence. Edge/client changes keep
Feature 006 as the sole source, retain Feature 008 progression semantics, and use
immutable per-room snapshots with an explicit legacy tuple. T065–T068 added the
profile, deterministic harnesses, and permanent transport updates without launching
Playwright.

The charged browser commands (`npm run test:e2e:security`,
`npm run test:e2e:feature009`, and `npm run test:e2e:smoke`) were deliberately not
started under the user-directed stop boundary. T070 is the first remaining charged
gate: obtain fresh R02 admission and reserve exactly `23` identities for
`C1 1 + smoke 16 + Feature 009 6 + targeted T=0 = 23`. T071–T074 remain pending.

### T070 — fresh R02 admission before charged execution — 2026-09-21

At `2026-09-21T17:27:46+05:00`, the authoritative rolling-window cutoff was
`2026-09-21T16:27:46+05:00`. The last finalized identity-bearing receipt was the
T068 fresh-checkout smoke receipt ending at `2026-09-20T15:17:15+05:00`, outside
the window; no identity-bearing receipt was counted in the current window. No
unfinished browser/provider run, active controlled-provider environment, or
unfinished-run marker was present. The pre-existing shared Supabase containers
were infrastructure only and were not an active charged run.

The complete T070 block was admitted and reserved exactly as required:

```text
R02 capacity                  150
current rolling usage           0
T070 reservation               23
projected usage                23
projected headroom            127
formula: C1 1 + smoke 16 + M01/M02 6 + targeted T=0 = 23
```

This admission used no signup probe, retry, reset, restart, quota manipulation,
or live-provider credential. Prior Feature 008 cumulative charged accounting
remains `124` attempts/identities historically, but contributes `0` to this
fresh rolling window. T070 had consumed `0` identities before dispatch.

The admitted block then executed in the contract order with fail-fast stop:

```text
source HEAD                         e55a53bbc6494691f9a9e636cfead61a29255982
C1 command                          npm run test:e2e:security
C1 receipt                           test-results/run-7BgJrN/summary.json
C1 result                            PASS; controlled C failure as designed;
                                    Auth 1/1; cleanup true; artifacts complete;
                                    scanner findings []
Feature command                     npm run test:e2e:feature009
Feature result                      BLOCKED before Playwright test execution:
                                    PLAYWRIGHT_RUNTIME_FAILED (exit 1)
Feature bounded run artifact        test-results/run-SmfuQq/
Feature summary/scanner             not produced; no signup or identity occurred
Smoke command                       NOT DISPATCHED (fail-fast)
Targeted historical T               0 identities; not dispatched
```

The Feature 009 runtime failure is preserved as a partial/failed attempt; it was
not retried, reset, restarted, or replaced. The managed runtime/provider cleanup
left no Playwright container, no controlled-provider environment, and no active
browser/provider process; the pre-existing shared Supabase containers remained
outside T070 ownership. No HTTP `429` was reported. At the bounded post-stop
calculation `2026-09-21T17:30:43+05:00`, the rolling cutoff was
`2026-09-21T16:30:43+05:00`: C1's one identity was counted, the Feature 009
attempt contributed zero identities, and the state was `1 / 150` used with
`149` capacity and no active unfinished execution. T070 remains incomplete;
M01/M02 and permanent smoke have no result because fail-fast stopped before
their dispatch.

### T070 runtime-preparation recovery — non-charged localization and replay admission — 2026-09-21

The retained owner directory `test-results/run-SmfuQq/` was empty, confirming
that the failure occurred before Playwright launch and before any owner signup.
The generic `PLAYWRIGHT_RUNTIME_FAILED` came from `executeInvocation`'s
provider/runtime catch path; it did not identify the underlying provider boot
error. A non-charged reproduction of the exact Feature 009 provider path
captured the following causal chain:

1. The controlled Supabase Edge worker graph rejected the bare `yaml` import:
   `Relative import path "yaml" not prefixed with / or ./ or ../`.
2. After that import was made Deno-compatible, the worker reached startup but
   failed to read `/var/tmp/config/selection-rules.yaml`. The existing
   `../../../config/selection-rules.yaml` URL resolved outside the function
   bundle, so readiness returned HTTP 503. This is the second packaging defect
   exposed by fixing the first; it was not a browser/runtime-image failure.

Classification: Feature 009 Edge runtime packaging/configuration defect. There
was no Docker image/discovery, executable, permission, port, Playwright version,
Auth quota, or live-TMDB failure. The pinned runtime independently prepared and
started successfully.

The smallest fix was applied without changing product behavior:

- `selection-rules.ts` uses Node's installed `yaml@2.9.0` only for Node test
  imports and Deno's pinned `npm:yaml@2.9.0` import in Edge;
- the canonical YAML remains `config/selection-rules.yaml`, with a symlink-only
  bundle entry at `supabase/functions/_shared/selection-rules.yaml`;
- both Edge functions declare that in-bound path in `static_files`, and the
  loader resolves `./selection-rules.yaml` relative to its module; and
- boundary/config checks assert the import split, symlink target, byte identity,
  in-bound static asset declarations, server-only placement and no env override.

Non-charged recovery evidence after the fix:

```text
Feature 009 Edge readiness preflight       room-candidate=204; room-create=204;
                                           no Playwright launch; no Auth identity
npm run playwright:install                 PASS; mcr.microsoft.com/playwright:v1.63.0-noble
Docker runtime lifecycle preflight         PASS; started -> ready -> removed; result 0
npm run test:edge                           PASS 58 passed, 0 failed, 1 ignored live contract
npm run test:client                         PASS 50 suites, 835 tests
credential/artifact focused tests           PASS 48 tests
node scripts/check-selection-rules-config.mjs PASS
npm run db:types:check                      PASS; generated artifact unchanged
seven migration/hash validators             PASS; all latest-reset=true, owned-fixtures=0
npm run lint                                PASS
npm run typecheck                            PASS
npm run web:export                           PASS; 5 static routes
git diff --check                            PASS
```

The direct scanner also returned `ok=true`, `fileCount=0`, `findings=[]` for
the empty retained owner directory. The retained C1 PNG is only approvable with
the in-process credential registry used by its runner; the scanner's dedicated
credential/PNG tests passed and no credential was printed.

The original C1 evidence remains valid and is not replayed: C1's security mode
does not start the controlled provider, and the defect was confined to the
Feature 009 provider's Edge packaging/readiness path. Replaying C1 would add an
unnecessary identity and would not test the corrected path. The required replay
is therefore only the unexecuted owner-plus-smoke suffix: `6 + 16 + T=0 = 22`.

At `2026-09-21T18:35:28+05:00`, the fresh authoritative R02 calculation used
the finalized local receipt ledger and active-resource checks. The previous C1
receipt at `17:29:18+05:00` was outside the new one-hour cutoff at
`17:35:28+05:00`; no identity-bearing receipt was in the current window, and
no owned Playwright container, controlled-provider environment or active run was
present. The complete replay suffix was reserved before dispatch:

```text
R02 capacity                  150
current rolling usage           0
T070 replay reservation        22
projected usage                22
projected headroom            128
formula: Feature 009 owner 6 + smoke 16 + targeted T=0 = 22
signup probe                   none
```

Only `npm run test:e2e:feature009` followed by `npm run test:e2e:smoke` is
authorized by this reservation. No C1, signup probe, quota retry, reset,
restart or replacement attempt is authorized. T070 remains incomplete until
this single charged replay produces the required M01/M02 and smoke receipts.

### T070 recovery result — owner suffix failed at artifact scan — 2026-09-21

The reserved replay was dispatched exactly once with
`npm run test:e2e:feature009`. It reached the corrected runtime and launched
Playwright (`started -> ready`), then failed fast in M01. The permanent smoke
was not dispatched, and no retry or replacement attempt was made.

```text
owner run                         test-results/run-rmqsZr/
M01                               failed; signups=2; identities=2; authSuccess=true
M01 cleanup                       true
M01 budget/HTTP 429               false / none
M01 failure location              e2e/support/room-harness.ts:573:75
controller artifact count         4
scanner finding                   error-context.md / feature007-private-content
inner Playwright exit             1
M02                               not reached
permanent smoke                   NOT DISPATCHED (fail-fast)
targeted historical T             0 identities; not dispatched
```

The bounded artifact evidence is preserved in the owner directory. The finding
was caused by the scanner matching the literal public harness contract key
`room_id` in the generated source-context excerpt inside `error-context.md`
(the retained file hash is
`41ce059834b65f831318ad24f15e74aa9cf57ecdc3f56a89e466be49cfc537a3`). No
credential was printed. This is a shared E2E diagnostic/artifact-scanner
boundary defect exposed by the charged owner run; it is not a Playwright runtime
failure, Auth 429, or evidence of a product Match/scope behavior failure.

At `2026-09-21T18:38:15+05:00`, the bounded post-stop R02 calculation used
cutoff `2026-09-21T17:38:15+05:00`. The earlier C1 receipt was outside that
window; the failed M01 owner suffix contributed two identities:

```text
R02 capacity                  150
current rolling usage           2
T070 replay consumed            2 (M01 partial; owner budget was 6)
remaining capacity            148
cumulative T070 consumption    3 (initial C1=1, recovery M01=2)
M02 / smoke / targeted T       0 / 0 / 0 identities
HTTP 429                       none
active run/provider/runtime    none
owned Playwright containers    none
controlled provider env        absent
```

T070 remains incomplete. Stop at this bounded failure; do not start T071–T074
or Feature 010. The exact next task remains T070: resolve the artifact
diagnostic/scanner boundary failure, then obtain a new fresh R02 admission for a
new contract-valid replay before any further charged execution.

### T070 diagnostic/scanner boundary recovery — non-charged — 2026-09-21

The retained failed owner artifact was inspected before changing the scanner:

```text
file                                      test-results/run-rmqsZr/.../error-context.md
sha256                                    41ce059834b65f831318ad24f15e74aa9cf57ecdc3f56a89e466be49cfc537a3
size                                      16752 bytes
observed private room/member/user value   none
UUID/room-code literal                    none
JWT/token/cookie/auth-header value        none
private decision value                    none
public names present                      room_id, room_code, decision_completed_count, candidate_sequence
original finding                          feature007-private-content
```

The source excerpt around `e2e/support/room-harness.ts:573:75` contained public
projection/schema references such as `rows[0].room_id`; it contained no returned
room row and no identifier value. The exact mechanism was the original raw-text
regular expression treating the bare public key `room_id` as private content.
Classification: scanner false positive at the diagnostic/artifact boundary, not a
private-content leak, reporter serialization leak, product privacy failure, or
harness assertion defect. The bounded `safe-reporter` projection and
`safe-diagnostics` output did not serialize the raw Playwright error/result.

The scanner fix is structural/context-aware rather than a global `room_id`
exemption. Public room projection keys are recognized as schema vocabulary; parsed
non-empty `room_id`, `room_member_id`, `member_id`, and `user_id` values remain
private findings, UUID literals remain forbidden, quoted identifier assignments
remain forbidden, and private decision key/value forms remain forbidden. Existing
Feature 006/008 private names, credentials, tokens, cookies, authorization
headers, and forbidden artifact classes remain strict.

Deterministic no-identity coverage and final non-charged gates:

```text
focused privacy/profile command             PASS 5 suites, 69 tests
diagnostic/scanner suite                    PASS 40 tests
npm run test:client                          PASS 50 suites, 836 tests
npm run test:edge                            PASS 58 passed, 0 failed, 1 ignored live contract
npm run typecheck                            PASS
npm run lint                                 PASS
npm run web:export                           PASS; 5 static routes
node scripts/check-selection-rules-config.mjs PASS
retained run-rmqsZr artifact scan            PASS; 4 files, 0 findings
seven protected migration/hash validators    PASS; latest-reset=true, owned-fixtures=0
npm run db:types:check                       PASS; generated artifact unchanged
git diff --check                             PASS
```

The focused scanner regression proves that a standalone safe `room_id` contract
key and the exact failed M01 source-context shape are clean, while actual room,
member and user identifier values, JSON/key-value private decisions, tokens,
cookies and authorization headers are still detected without echoing their values
in findings. Safe reporter output is scanner-clean. The database reset used to
restore stale local validator fixtures was local validation only; it was not a
quota probe, Auth reset, or charged browser action. The generated-types receipt
remains the T063 sole write (`sha256=69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03`, inode `11577831`, size `20779`).

Replay derivation after the correction: C1 remains valid and is not rerun; the
prior M01 partial owner evidence is invalidated by the scanner finding; smoke was
never dispatched and has no evidence. The required recovery is therefore one
complete owner-plus-smoke block, `Feature 009 owner 6 + smoke 16 + targeted T=0 =
22` identities. Before that block, cumulative T070 consumption is `3` (C1 `1` +
failed M01 `2`), and a fully consumed recovery would make it `25`. A fresh
authoritative R02 admission is still required immediately before dispatch.

T070 remains incomplete pending that one admitted owner-plus-smoke recovery. Do
not start T071–T074 or Feature 010.

### T070 recovery replay result — owner failed again — 2026-09-21

The fresh admission was consumed only by the owner wrapper. The owner reached the
corrected provider/runtime (`started -> ready`), started Playwright, and failed
fast in M01 after its two admitted identities. Because this was an unexpected
failure, M02 was not reached, permanent smoke was not dispatched, and no retry or
replacement run was made.

```text
fresh admission                         2026-09-21T19:31:22+05:00
R02 capacity                            150
window usage at admission                2 (run-rmqsZr; signups=2; identities=2)
reservation                              22 (owner 6 + smoke 16 + T=0)
projected usage/headroom                 24 / 126
C1                                       not rerun; prior 1 identity remains valid
owner receipt                            test-results/run-kKIAMZ/summary.json
M01                                      failed; signups=2; identities=2
M01 Auth/cleanup                         success / true
M01 budget failure/HTTP 429              false / none
M01 safe failure location                e2e/support/room-harness.ts:573:75
M02                                      not reached
permanent smoke                          NOT DISPATCHED (fail-fast)
targeted historical T                   0 identities; not dispatched
owner artifact directory                test-results/run-kKIAMZ/
artifact scanner                         PASS; 4 files, 0 findings
runtime/provider cleanup                 PASS; Playwright removed, env absent, no active run
new charged consumption                  2 identities
cumulative T070 consumption              5 (C1=1 + prior M01=2 + replay M01=2)
```

The retained replay `error-context.md` is 16,752 bytes with SHA-256
`41ce059834b65f831318ad24f15e74aa9cf57ecdc3f56a89e466be49cfc537a3`. It is the
same bounded source-only context shape: no UUID/room-code literal, JWT/token,
cookie, authorization value, or private decision value; its scanner-clean
finding is not a renewed privacy finding. The charged failure is the same
`page.waitForResponse`/closed-context failure exposed at the safe harness boundary
around `room-harness.ts:573`, after the scanner correction. It is preserved as
bounded evidence and was not investigated with another charged attempt.

At the post-stop check, both two-identity M01 receipts remained inside the rolling
hour, for final R02 usage `4 / 150` and `146` receipt-based headroom; C1 was outside
the window, with no HTTP 429, active provider, or owned Playwright container. T070
remains incomplete. Stop here with the exact next task still T070; do not start
T071, T072, T073, T074, or Feature 010.

## Prerequisites

- Use the repository-declared Node/npm versions and pinned local dependencies.
- Docker and the pinned Supabase CLI must be available.
- Provision TMDB and Supabase server credentials only in the ignored
  `supabase/functions/.env.local`; never commit or print them.
- Follow `docs/testing-strategy.md` before any identity-bearing browser command.
- Keep alternate test-vector values clearly labeled and isolated from the canonical
  server configuration.

Approved initial canonical configuration:

```yaml
# config/selection-rules.yaml
minimum_vote_count: 500
metadata_language: en-US
ordering: vote_count_desc
genre_mode: or
larger_group_agreement: 2/3
```

The approved no-rating-cutoff value is encoded by omitting
`minimum_average_rating`; explicit YAML `null` is invalid. These are initial
operational values, not product constants. A later YAML edit takes effect only after
successful rebuild/redeploy/restart and only for newly created rooms; existing room
snapshots remain unchanged.

## 1. Install and Static Baseline

```sh
npm ci
npm run typecheck
npm run lint
npm run test:client
```

Expected: all commands pass under the declared toolchain; no Feature 010/Match or
configuration UI is present.

## 2. Configuration Validation

Run the planned Deno/shared configuration suite through the Edge test command:

```sh
npm run test:edge
```

The suite must cover:

- canonical `config/selection-rules.yaml` loading and exact server-artifact bundling;
- each ordering and both genre modes;
- omitted ordering -> vote count descending;
- omitted genre mode -> OR;
- omitted fraction -> exact `2/3`;
- omitted rating -> no rating cutoff;
- required minimum vote count and language absent;
- negative/fractional/non-finite/out-of-domain numbers;
- malformed/zero/negative/greater-than-one fractions and exact equivalent reduction;
- malformed YAML, duplicate keys, multiple documents, aliases/anchors/custom tags,
  non-mapping roots, malformed/unsupported language and unknown keys;
- fixed safe diagnostics with no raw config;
- module startup failure before handler construction; and
- repository edit without rebuild/redeploy/restart leaving the frozen value unchanged;
- changed canonical YAML taking effect only after successful artifact rebuild and
  module reconstruction; and
- no environment override, request-time reread, watcher, hot reload, client bundle
  inclusion, admin/config UI or runtime configuration service.

Expected: every valid case yields its exact normalized immutable object; every invalid
case fails explicitly with no fallback/default beyond approved omissions.

Run the zero-identity packaging/startup harness before database work:

```sh
node scripts/check-selection-rules-config.mjs
```

Expected: local and deployment-shaped Edge artifacts contain bytes derived from the
one canonical YAML, both handlers fail construction for invalid YAML, and no rule
file or value is emitted into the Expo client bundle.

## 3. Database and Migration Evidence

Start the local stack and run the protected nonempty upgrade before clean-reset tests:

```sh
npm run supabase:start
node scripts/check-selection-rules-migration.mjs
npm run db:reset
npm run db:test
npm run db:types:check
```

The migration runner must seed pre-009 rooms across waiting, filter, resolution,
collecting, advancing, agreed and exhausted states. It must prove:

- exactly one explicit legacy snapshot per old room;
- legacy OR, `en-US`, no new cutoff/order and exact `2/3`;
- existing room/member/filter/resolution/occurrence/decision values and applicable
  timestamps/`xmin` unchanged;
- no authenticated direct-create escape path;
- new room/member/configured snapshot atomicity;
- same-request retry after A -> B returns A without writes;
- deny-by-default ACL/RLS and no rule Realtime publication; and
- missing/corrupt rules fail closed in resolution, source and decision operations.

Database tests must additionally cover:

- OR/AND/Any canonical clauses and every-voter behavior;
- vote/rating equality and just-below commit evidence;
- `N=2` always threshold 2;
- exact fractions for `N=3..10`, including default expected vector for `2/3`;
- threshold-minus-one/threshold and incomplete inevitable/impossible sets;
- final-decision dblink races, duplicate/replay/response-loss behavior;
- unchanged expected-sequence/no-repeat candidate and empty commit races; and
- source failure never invoking an empty commit.

After implementation reaches its single generated-type write point:

```sh
npm run db:types
npm run db:types:check
```

Run the write once, review it, then use only check mode in later gates.

## 4. Edge/TMDB Contract Evidence

```sh
npm run test:edge
npm run test:tmdb:contract
```

The deterministic provider suite must prove:

- exact URL mapping for four orderings, language, mandatory vote cutoff, optional
  rating cutoff and genre comma/pipe pushdown;
- the full conditional metric matrix: `vote_count` required by its cutoff/order,
  `vote_average` required by its cutoff/order, and `popularity` required by its order;
- for every ordering/cutoff mode, missing and malformed required metrics yield
  `search_incomplete`, while the same defects in irrelevant metrics leave an otherwise
  valid candidate/search complete;
- OR/AND/Any predicates match database commit validation;
- top ineligible/excluded candidates are skipped without weakening;
- primary ties use the documented deterministic secondary order across page bounds;
- >500-page date shards compare global winners rather than first nonempty shard;
- title ordering uses localized titles and completes required local comparison;
- one child failure after another child match remains incomplete;
- malformed/inconsistent pages, missing required metrics, budget and deadline remain
  `search_incomplete` and are never authoritative exhaustion;
- only complete empty traversal produces `completed_empty`;
- retries/competing proposals adopt one database winner;
- assigned Details uses retained language and metadata failure preserves identity;
- legacy search reproduces Feature 006 behavior; and
- no cursor or startup config is used after private preflight.

The live TMDB contract remains credentialed, zero-browser-identity evidence. It must
not be used as the deterministic sort, cutoff or exhaustion oracle.

## 5. Client and Build Evidence

```sh
npm run test:client
npm run typecheck
npm run lint
npm run web:export
```

Also run the repository's applicable native export/build command recorded by the
implementation tasks.

Focused client evidence must prove:

- room creation invokes authenticated Edge with only the three existing inputs;
- strict create response/error parsing and duplicate-response recovery;
- join and room refetch projections remain unchanged;
- arbitrary valid server thresholds are accepted, invalid shapes fail closed, and
  `N=2` must return 2;
- sequence-aware candidate/decision state and stale-generation behavior regressions
  remain green; and
- no rule editor, rule display, early-resolution or Match UI appears.

## 6. Real-Stack Browser Acceptance

Before running, calculate rolling R02 usage and reserve the exact block. Keep workers
1, retries 0, repeat 1 and capture off.

Planned owner profile:

```sh
npm run test:e2e:feature009
```

| Case | Identities | Observable evidence |
| --- | ---: | --- |
| M01 | 2 | Edge-backed create; fixed 2/2; configured ordering/cutoff; one distinct successor; reload retention; source failure versus exhaustion; no Match/config UI |
| M02 | 4 | Non-voting creator + 3 voters; custom exact fraction; no early result; AND/every-voter decoy; localized order; convergence/privacy; same identities reused for N=4 boundary |
| Owner total | **6** | Exact 2 + 4 receipt |

Then run mandatory security and permanent smoke:

```sh
npm run test:e2e:security
npm run test:e2e:smoke
```

Normal checkpoint projection:

```text
C1 1 + permanent smoke 16 + owner 6 + targeted 0 = 23 identities
```

Every run must record source SHA, selection, configured cap, attempts, successful
identities, timestamps, scanner result and cleanup result. Failed/partial/manual
attempts count.

## 7. Repeatability and Fresh Checkout

With unchanged source and stack, treat the normal checkpoint as repeatability run
one. Admit and execute one additional owner-plus-smoke block:

```text
16 + 6 = 22 identities
cumulative repeatability = 45
```

At the exact implementation SHA, use an independent disposable checkout to run:

- dependency install and local environment setup;
- protected nonempty migration and clean reset;
- full database, Edge and client suites;
- check-only generated types;
- lint, typecheck and web/native exports;
- C1 and permanent smoke (`17` identities); and
- artifact/credential scanning and owned cleanup.

Cumulative repeatability plus fresh checkout is projected at `62` identities, subject
to actual rolling-window admission.

### T070 scanner-boundary recovery — final zero-identity gate and replay admission — 2026-09-21

The retained `run-rmqsZr` `error-context.md` was inspected byte-for-byte before
accepting the boundary correction. It contains only source/contract vocabulary
(`room_id`, `room_code`, `candidate_sequence` and
`decision_completed_count`) plus the bounded Playwright error. It contains no
UUID, room code, member/user identifier, token, cookie, authorization value or
private decision. The original `feature007-private-content` finding therefore
came from the old raw-text `room_id` expression. The corrected scanner treats
the approved room projection names as schema vocabulary only in their structural
key position, while retaining value-aware detection for room/member/user IDs,
UUID literals, key/value assignments, decisions, credentials, cookies, auth
headers and Feature 006/008 private fields. The bounded reporter and diagnostics
projection do not serialize the raw Playwright error/result.

Final no-identity validation after the correction:

```text
focused scanner/privacy/profile suites            PASS; 5 suites, 69 tests
full client suite                                  PASS; 50 suites, 836 tests
Edge suite                                         PASS; 58 passed, 0 failed, 1 ignored live contract
database suite                                     PASS; 8 files, 932 tests
selection config packaging                         PASS; 2 assets byte-identical
seven protected migration/hash validators          PASS; no GoTrue/TMDB/type writes, clean reset
check-only generated types                         PASS; canonical artifact unchanged
lint                                               PASS
typecheck                                          PASS
web export                                         PASS; 5 static routes
iOS/Android export                                 PASS
retained failed M01 artifact scans                 PASS; 4 files, 0 findings each
git diff --check                                   PASS
```

The first unqualified direct validator invocation was rejected by the
project-local executable lookup because this shell did not include
`node_modules/.bin` in `PATH`; the same validator and all six historical
validators passed with the explicit project-local path. Supabase CLI telemetry
was disabled for local reset/type checks because the managed home path is
read-only. No source, migration or generated-type write was made by either
validation workaround.

The workspace also retains `run-kKIAMZ`, a later two-identity M01 receipt not
included in the earlier three-identity narrative. It is not deleted or
discounted: the authoritative rolling ledger includes it. At
`2026-09-21T20:06:39+05:00`, with cutoff `2026-09-21T19:06:39+05:00`, the
fresh R02 admission found no active Playwright/provider/E2E process or owned
runtime container and reserved the complete unexecuted owner-plus-smoke suffix:

```text
R02 capacity                  150
current rolling usage           2 (run-kKIAMZ; identities=2)
T070 replay reservation        22 (owner 6 + smoke 16 + targeted T=0)
projected usage                24
projected headroom            126
C1                             not rerun
signup/quota probe             none
```

Only the single `npm run test:e2e:feature009` then single
`npm run test:e2e:smoke` sequence is admitted. No C1, retry, replacement,
reset, restart or other identity-bearing action is authorized.

### T070 admitted recovery result — owner stopped at M01 — 2026-09-21

The admitted owner wrapper ran exactly once as `test-results/run-gHUU6S`.
It reached the corrected provider/runtime (`started -> ready`), started
Playwright, then failed fast in M01 after its two admitted identities. The
permanent smoke was not dispatched, and no retry or replacement was made.

```text
owner receipt                         run-gHUU6S
M01                                   failed; signups=2; identities=2
M01 Auth/cleanup                      success / true
M01 budget failure/HTTP 429           false / none
M01 safe failure location             e2e/support/room-harness.ts:573:75
M02                                   NOT REACHED
permanent smoke                       NOT DISPATCHED (fail-fast)
targeted historical T                 0 identities; not dispatched
artifact scanner                      PASS; 4 files, 0 findings
provider/Playwright cleanup           PASS; runtime removed, no active run
```

The retained `error-context.md` is 16,752 bytes with SHA-256
`41ce059834b65f831318ad24f15e74aa9cf57ecdc3f56a89e466be49cfc537a3` and is
the same source-only shape already classified above: no UUID/room-code value,
member/user identifier, token, cookie, authorization value or private decision.
This charged failure does not reopen the privacy finding; it is an unresolved
room-harness/page-lifecycle failure around the existing `waitForResponse`
boundary. Because the admitted owner block failed, the reserved smoke suffix
was forfeited and no additional charged execution is authorized in this task.

At the bounded post-stop check at `2026-09-21T20:07:55+05:00`, the rolling
cutoff was `2026-09-21T19:07:55+05:00`; the current window contained
`run-kKIAMZ=2` and `run-gHUU6S=2`, for `4 / 150` usage and `146` receipt-based
headroom. No active Playwright/provider/E2E process or owned runtime remained.
The workspace receipt ledger now shows seven cumulative T070 identities:
the prior C1 `1`, the original scanner-failed M01 `2`, the retained later M01
receipt `run-kKIAMZ` `2`, and this admitted M01 `2`. The earlier three-identity
narrative remains historical context, but the retained receipt is counted and
was not deleted or discounted.

T070 remains incomplete. Stop at this bounded charged failure; do not start
T071, T072, T073, T074 or Feature 010. The exact next task remains T070:
localize and correct the room-harness page-lifecycle boundary with deterministic
no-identity evidence, then obtain a new fresh R02 admission before any further
charged execution.

### T070 recovery after room-create response-negotiation fix — fresh R02 admission — 2026-09-21

The repeated M01 blocker was deterministically localized to the trusted
`create_room_with_selection_rules` transport: the `RETURNS TABLE` RPC returned a
one-row JSON array under default PostgREST negotiation, while the Edge boundary
requires the strict object contract. `supabase/functions/room-create/index.ts`
now sends `Accept: application/vnd.pgrst.object+json`; the strict object parser
is unchanged. The zero-identity regression covers this exact negotiation and
array-rejection contract. The current source is HEAD
`e55a53bbc6494691f9a9e636cfead61a29255982` with the room-create source hash
`0d18aada151a291847f84b32f6f86b97acfbb62cb0ff5e4f03b60fc6ed789b0c`.

C1 remains valid and is not rerun because the fix does not change C1's
controlled-failure, security, or Auth boundary. The current authoritative
recovery block is therefore the unexecuted owner-plus-smoke suffix:
`Feature 009 owner 6 + permanent smoke 16 + targeted T=0 = 22` identities.
The owner must run once as M01/M02 with exact caps `2 + 4`; permanent smoke is
dispatched once only if the owner passes.

At `2026-09-21T21:36:19+05:00`, the fresh authoritative R02 admission used
cutoff `2026-09-21T15:36:19.820Z` and reserved the complete block before any
charged dispatch:

```text
R02 capacity                  150
current rolling usage           0 (no identity-bearing receipts in window)
T070 recovery reservation      22 (owner 6 + smoke 16 + targeted T=0)
projected usage                22
projected headroom            128
C1                             not rerun; prior receipt remains valid
signup/quota probe             none
owned runtime containers       0
shared Supabase containers     9 (infrastructure only)
controlled provider env        absent
active run marker              absent
```

Only the single `npm run test:e2e:feature009` followed, if and only if it
passes, by the single `npm run test:e2e:smoke` is admitted. No signup probe,
retry, reset, restart, replacement, or quota manipulation is authorized.

### T070 charged recovery result — owner stopped at M01 — 2026-09-21

The admitted owner wrapper ran exactly once as `test-results/run-PKpGTE/`. It
reached the corrected Edge/runtime path and launched Playwright, then failed fast
in M01 after the two admitted identities. The bounded receipt identifies the
unexpected failure at the candidate-availability wait
`e2e/support/candidate-harness.ts:467:12`; no further charged diagnosis or
attempt was made.

```text
owner command                         npm run test:e2e:feature009 (once)
owner receipt                         test-results/run-PKpGTE/summary.json
M01                                   failed; signups=2; identities=2
M01 Auth/cleanup                      success / true
M01 budget failure/HTTP 429           false / none
M01 safe failure location             e2e/support/candidate-harness.ts:467:12
M02                                   NOT REACHED (fail-fast)
permanent smoke                       NOT DISPATCHED (fail-fast)
targeted historical T                 0 identities; not dispatched
artifact scanner                      PASS; 4 files, 0 findings
runtime/provider cleanup              PASS; runtime removed, no active run
controlled provider env               absent
```

At the bounded post-stop check at `2026-09-21T21:38:22+05:00`, the rolling
cutoff was `2026-09-21T20:38:22+05:00`; this recovery contributed two current
window identities, for `2 / 150` usage and `148` receipt-based capacity. No
active Playwright/provider process or owned runtime container remained; the nine
shared Supabase containers remained infrastructure only. No HTTP `429` was
reported. The retained T070 history is preserved: prior C1 `1`, original
scanner-failed M01 `2`, retained M01 `run-kKIAMZ` `2`, admitted M01
`run-gHUU6S` `2`, and this M01 `run-PKpGTE` `2`, for cumulative historical T070
consumption **9 identities**.

T070 remains incomplete. Stop here; do not start T071, T072, T073, T074 or
Feature 010. The exact next task remains T070, pending a separately authorized
future recovery after this charged failure.

### T070 observability-only candidate-presentation localization — 2026-09-21

No R02 admission, identity-bearing browser command, M01/M02 retry, smoke run,
database reset, generated-type write, production behavior change, T071+ work or
Feature 010 work occurred in this pass.

The presentation pipeline was traced as:

```text
public.rooms safe projection
  -> accepted room state + rooms-only Realtime/refetch generation lattice
  -> useRoomCandidate eligibility/authority/sequence observation
  -> generation + sequence + request-attempt scoped room-candidate Edge request
  -> canonical refetch before metadata merge
  -> candidate state (acquisition / metadata / poster / terminal / integrity)
  -> room route branch (CandidateCard or CandidateDecisionSurface)
  -> CandidateCard title/year/poster surfaces
```

The exact M01 heading wait now catches only that presentation failure, records one
closed `candidate-presentation` diagnostic through the existing safe annotation and
reporter path, then throws the existing bounded safe error. It does not change the
wait duration, request behavior, state transition, card rendering or heading text.
The exact safe fields are:

```text
kind, presentationState, routeView, candidateAttempt,
canonicalReadable, acquisitionStatus, progressionStatus,
candidateSequence, decisionCount, canonicalCandidateIdentityPresent,
titleMetadataPresent, releaseYearMetadataPresent, posterMetadataPresent,
metadataRequestState, metadataRequestAttemptCount, metadataRecoveryActive,
metadataHttpStatusClass, metadataResultClass, requestSequenceMatches,
candidateCardExists, expectedHeadingExists, expectedHeadingVisible,
expectedHeadingHidden, loadingSurfacePresent, errorSurfacePresent,
exhaustedSurfacePresent, agreedSurfacePresent, clientProjectionStale
```

Every string uses a closed enum, every number is bounded, and every shape is exact.
The canonical candidate identity is reduced to a boolean. Request status is reduced
to `none | 2xx | 4xx | 5xx | network | other`; result is reduced to a closed public
outcome class. No room/member/user ID, room code, candidate ID, token, cookie, auth
header, private decision, URL, response body, DOM dump or raw Playwright error can
enter the receipt.

The zero-identity matrix distinguishes assigned/loading metadata, assigned/metadata
request failure, assigned/stale client projection, metadata available with no card,
visible and hidden expected headings, metadata recovery, exhausted and agreed. It
round-trips every shape through the safe parser/reporter, writes the bounded shapes
to a temporary artifact, requires scanner zero, and proves injected secret/private
keys and enum values are rejected.

Non-charged validation:

```text
focused presentation diagnostic                     PASS; 1 test
focused harness/profile/boundary/candidate/room/
  route/progression/scanner regressions              PASS; 22 suites, 473 tests
full client/config/privacy suite                     PASS; 50 suites, 837 tests
lint                                                 PASS
typecheck                                            PASS
check-only database types                            PASS; canonical artifact consistent
git diff --check                                     PASS
Edge suite                                           not applicable; no Edge implementation or contract changed
```

The first plain check-only types invocation failed before comparison because the
managed home prevented the local Supabase generator from starting; it preserved the
canonical file. The established local CLI environment
`XDG_CONFIG_HOME=/tmp/otteroom-supabase-config`, telemetry disabled and do-not-track
then passed check-only comparison. No database type was regenerated or overwritten.

The repository is ready for one separately admitted T070 replay whose sole purpose
is to identify the exact candidate-presentation state. T070 remains unchecked and
incomplete until the required charged owner/smoke evidence succeeds.

### T070 charged diagnostic replay — M01 only — 2026-09-21

This was a diagnostic replay only, not a T070 owner-acceptance checkpoint. A fresh
authoritative R02 admission at `2026-09-21T17:45:49Z` found no identity-bearing
receipt in the rolling hour, no unfinished run, no active owned Playwright/provider
runtime, and reserved exactly two identities for M01:

```text
R02 capacity                  150
current rolling usage           0
M01 reservation                 2
projected usage                2
projected headroom           148
M02 / C1 / smoke                not scheduled
```

The single admitted command was run exactly once:

```text
npm run test:e2e -- --grep M01
```

M01 failed after consuming exactly two identities. M02, permanent smoke, C1,
retries, resets, restarts and source changes were not performed. The normal receipt
and bounded artifact evidence were preserved. Auth succeeded, cleanup completed,
HTTP 429/budget failure was absent, and the artifact scanner returned `ok=true`,
`fileCount=4`, `findings=[]`.

The candidate-heading timeout emitted this exact bounded presentation diagnostic:

```text
kind=candidate-presentation
presentationState=metadata-request-failure
routeView=room
candidateAttempt=metadata-error
canonicalReadable=true
acquisitionStatus=assigned
progressionStatus=collecting
candidateSequence=1
decisionCount=0
canonicalCandidateIdentityPresent=true
titleMetadataPresent=false
releaseYearMetadataPresent=false
posterMetadataPresent=false
metadataRequestState=failed
metadataRequestAttemptCount=1
metadataRecoveryActive=false
metadataHttpStatusClass=5xx
metadataResultClass=candidate_acquisition_unavailable
requestSequenceMatches=null
candidateCardExists=true
expectedHeadingExists=false
expectedHeadingVisible=false
expectedHeadingHidden=false
loadingSurfacePresent=false
errorSurfacePresent=true
exhaustedSurfacePresent=false
agreedSurfacePresent=false
clientProjectionStale=false
```

At the post-run R02 check at `2026-09-21T17:48:01.341Z`, the cutoff was
`2026-09-21T16:48:01.341Z`; the final state was `2 / 150` used with `148`
headroom and no unfinished run. The controlled provider environment was absent,
the owned runtime was removed, and only the pre-existing shared Supabase
infrastructure remained. T070 remains incomplete and no T071–T074 or Feature 010
work was started.

Evidence locations: `test-results/run-2mCLkX/summary.json`,
`test-results/run-2mCLkX/safe-process.txt`, and the preserved
`test-results/run-2mCLkX/` artifact directory.

### T070 final recovery admission — 2026-09-21

The latest presentation failure was deterministically corrected before this
admission: assigned-candidate recovery now returns the retained metadata
language plus sequence and identity, with all discovery/search fields,
including `rule_set_kind`, null. No discovery request, search-rule behavior,
CAS behavior or public contract changed. The zero-identity proof is recorded
in the owner-provided recovery context: assigned candidate `6006` returns
HTTP 200 and calls only `/3/movie/6006?language=de-DE` and `/3/configuration`.

At `2026-09-21T23:17:19+05:00`, a fresh authoritative rolling-window R02
admission was completed immediately before charged dispatch. The current
window cutoff was `2026-09-21T22:17:19+05:00`; the latest diagnostic M01
receipt (`run-2mCLkX`, 2 identities) was the only identity-bearing receipt in
the window. No unfinished run marker, active Playwright/provider process,
owned runtime container or controlled-provider environment was present.

The complete recovery block was admitted and reserved before any charged
command:

```text
R02 capacity                  150
current rolling usage           2 (run-2mCLkX; M01 diagnostic)
T070 recovery reservation      22 (owner 6 + smoke 16 + targeted T=0)
projected usage               24
projected headroom           126
formula                        owner 6 + smoke 16 + targeted T=0 = 22
C1                             not rerun; prior controlled-failure receipt remains valid
unfinished run markers          0
owned Playwright containers     0
active browser/provider procs   0
controlled provider env       absent
signup/quota probe              none
admitted                       true
```

Only one `npm run test:e2e:feature009` dispatch followed, if and only if it
passed, by one `npm run test:e2e:smoke` dispatch was authorized. No C1,
signup probe, quota retry, reset, restart, replacement attempt or other quota
manipulation was authorized.

### T070 final recovery result — owner stopped at M01 — 2026-09-21

The admitted owner wrapper ran exactly once as `test-results/run-kgYf3b/` and
failed fast in M01 after its two admitted identities. M02 was not reached and
permanent smoke was not dispatched. The failure was preserved without a retry,
replacement, reset, restart or additional charged diagnosis.

```text
owner command                         npm run test:e2e:feature009 (once)
owner receipt                         test-results/run-kgYf3b/summary.json
M01                                   failed; signups=2; identities=2
M01 Auth/cleanup                      success / true
M01 budget failure/HTTP 429           false / none
M01 bounded failure                   candidate-terminal-guard
M01 diagnostic                        expected exhausted; observed pending/advancing at sequence 2
M01 diagnostic location               e2e/support/safe-diagnostics.ts:18:1
artifact scanner                      PASS; 4 files, 0 findings
error-context                         SHA-256 5980eda1b12caa79de196bb18337d1a8f8d5fe3bb8ed3f9d58a458bdd835f6f7
M02                                   NOT REACHED (fail-fast)
permanent smoke                       NOT DISPATCHED (fail-fast)
targeted historical T                 0 identities; not dispatched
provider/Playwright cleanup           PASS; runtime removed, no active run
controlled provider env               absent
```

At the bounded post-stop check at `2026-09-21T23:18:46+05:00`, the rolling
cutoff was `2026-09-21T22:18:46+05:00`. The current window contained the
latest diagnostic M01 receipt `run-2mCLkX=2` and this owner receipt
`run-kgYf3b=2`, for `4 / 150` usage and `146` receipt-based headroom. The
cumulative historical T070 consumption is now **13 identities**: prior C1 `1`,
the earlier scanner-failed M01 `2`, retained M01 `run-kKIAMZ` `2`, admitted M01
`run-gHUU6S` `2`, M01 `run-PKpGTE` `2`, diagnostic M01 `run-2mCLkX` `2`, and
this M01 `run-kgYf3b` `2`. No active owned browser/provider process or runtime
container remained; shared Supabase containers remained infrastructure only.

T070 remains incomplete. Stop at this bounded charged failure; do not start
T071, T072, T073, T074 or Feature 010. The exact next task remains T070,
pending a separately authorized recovery after the `candidate-terminal-guard`
failure is resolved with deterministic zero-identity evidence.

### T070 sequence-two terminal-guard recovery — non-charged — 2026-09-21

The retained `run-kgYf3b` receipt and M01 source reconstruct the failed path
without reopening the already-fixed assigned-metadata defect. Candidate occurrence
sequence 1 was controlled candidate `6006`; its complete `yes/no` decision set
rejected it and advanced to sequence 1. The next ordered search excluded `6006`
and committed controlled successor `6007` as occurrence sequence 2. Sequence 2
then received the complete `yes/no` decision set and was rejected, atomically
leaving the canonical room at acquisition `pending`, progression `advancing`,
sequence `2`, decision count `0`, no current candidate identity, and a rejected
sequence-2 occurrence.

The automatic source request under the configured provider `timeout` scenario
returned `search_incomplete`/HTTP 503 and correctly wrote nothing. M01 then changed
the controlled provider to `empty` and clicked the explicit retry. That retry
issues the normal authenticated room-candidate request; preflight returns
`acquire` at expected sequence 2 with complete occurrence exclusions and retained
configured vote-count order/cutoff, years, language, and genre predicate. The
candidate terminal guard read PostgreSQL synchronously immediately after the click,
before waiting for that source operation or its empty CAS. It therefore rejected
the legal in-flight `pending / advancing / 2` state. It had no event, response,
refetch, Realtime, or polling condition that could advance its observation.

The zero-identity real-path check added at
`scripts/check-feature009-terminal-path.mjs` seeded that exact canonical sequence-2
rejection, used the real controlled provider, `searchTmdbCandidate`, room-candidate
handler, service-role REST RPC boundary, and local PostgreSQL functions, and cleaned
its owned fixture. Its safe receipt was:

```text
FEATURE009_TERMINAL_PATH sequence=2 preflight=acquire discover=1 source=completed_empty empty_cas=attempted empty_cas_result=exhausted canonical=no_candidates/exhausted provider_completed=1 provider_failed=0 identities=0 result=PASS
```

The provider made one valid Discover request and zero Details, Configuration, or
poster requests; it completed one of one requests with zero active, failed, or
invalid requests. Traversal returned true `completed_empty`, not
`search_incomplete`; empty CAS was called with expected sequence 2, returned
`exhausted`, and committed acquisition `no_candidates`, progression `exhausted`,
sequence `2`, decision count `0`, and null current candidate. This classifies the
charged observation as a legal transient state and the defect as a stale/early
harness terminal assertion, not a product/source, Edge/database commit,
client/Realtime, or controlled-provider fixture defect.

The narrow fix adds `waitForCandidateTerminal` to the terminal harness. It polls
the canonical PostgreSQL snapshot until the authoritative terminal tuple exists,
bounded by the already-required five-second convergence limit, and only then checks
the public UI that converges through the existing rooms-only Realtime/refetch path.
It adds no sleep, retry, provider behavior, or timeout increase. Initial-empty uses
the same corrected terminal guard. On non-convergence the existing bounded safe
diagnostic is emitted from the last canonical observation.

Deterministic regression and validation:

```text
npx jest --runInBand __tests__/config/feature009-e2e-profile.test.ts __tests__/config/feature008-e2e-profile.test.ts
  PASS; 2 suites, 16 tests
npx deno test ... supabase/functions/_tests/room-candidate.test.ts
  PASS; 18 tests; exact sequence-2 completed-empty/empty-CAS regression included
npx deno run ... scripts/check-feature009-terminal-path.mjs
  PASS; real controlled provider + source/Edge/database path; identities=0
npm run test:edge
  PASS; 62 passed, 0 failed, 1 intentionally ignored live contract
npm run db:reset
  PASS; clean latest Feature 009 schema
npm run db:test
  PASS; 8 files, 933 tests
npm run test:client
  PASS; 50 suites, 838 tests
npm run db:types:check
  PASS; canonical generated types consistent; no type generation
npm run lint
  PASS
npm run typecheck
  PASS
node scripts/check-selection-rules-config.mjs
  PASS; canonical bytes and both server assets identical; no client/env override
node scripts/check-e2e-artifacts.mjs test-results/run-kgYf3b
  PASS; 4 files, 0 findings
git diff --check
  PASS
```

The first targeted database invocation was made before the clean reset and correctly
detected one retained local browser room through a global occurrence-count assertion;
its transaction rolled back. The documented clean reset followed by the complete
933-test database matrix passed. The first check-only type invocation likewise hit
the sandbox's read-only default Supabase telemetry path; rerunning with the existing
temporary XDG config location passed without writing the generated artifact.

No charged browser command, admission, signup, identity, retry, T071–T074 task, or
Feature 010 work occurred in this recovery. T070 remains incomplete; the repository
is ready for a separately admitted T070 replay after this zero-identity fix.

### T070 recovery admission — 2026-09-21

At `2026-09-21T23:43:38+05:00`, a fresh authoritative rolling-window check used
the retained receipt ledger and active-resource checks. The one-hour cutoff was
`2026-09-21T22:43:38+05:00`. The only identity-bearing receipts in that window
were the prior diagnostic M01 `run-2mCLkX` (2) and the prior owner M01
`run-kgYf3b` (2), for current receipt usage `4`. There were no unfinished-run
markers, active Playwright/browser/provider processes, owned runtime containers,
controlled-provider environment, signup/quota probe, or pending replacement.

The current implementation/testing source was HEAD
`e55a53bbc6494691f9a9e636cfead61a29255982` plus the already-recorded working-tree
Feature 009 fix. The profile remains workers `1`, retries `0`, repeat `1`, capture
off, and fail-fast. C1's prior controlled-failure receipt remains valid and was
not rerun.

The complete recovery block was admitted and reserved before any charged command:

```text
R02 capacity                  150
current rolling usage           4 (run-2mCLkX=2 + run-kgYf3b=2)
T070 recovery reservation      22 (M01 2 + M02 4 + smoke 16 + targeted T=0)
projected usage                26
projected headroom            124
formula                        owner 6 + smoke 16 + targeted T=0 = 22
C1                             not rerun; prior receipt valid
unfinished run markers          0
owned Playwright containers     0
active browser/provider procs   0
controlled provider env       absent
signup/quota probe              none
admitted                       true
```

Only one `npm run test:e2e:feature009` dispatch and, conditional on its complete
pass, one `npm run test:e2e:smoke` dispatch are authorized. No C1, signup probe,
quota retry, reset, restart, replacement attempt, or other quota manipulation is
authorized. The next step is the admitted T070 owner wrapper.

### T070 recovery result — owner stopped at M02 — 2026-09-21

The freshly admitted owner wrapper ran exactly once as `test-results/run-58wwA0/`.
M01 passed, then M02 failed after its four admitted identities. Fail-fast stopped
the block; permanent smoke was not dispatched, and no retry, replacement, reset,
restart, C1 rerun, or additional charged diagnosis was performed.

```text
owner command                         npm run test:e2e:feature009 (once)
owner receipt                         test-results/run-58wwA0/summary.json
M01                                   passed; signups=2; identities=2
M01 Auth/cleanup                      success / true
M02                                   failed; signups=4; identities=4
M02 Auth/cleanup                      success / true
M02 bounded failure                   candidate-presentation
M02 diagnostic                        assigned/collecting sequence 1; metadata available;
                                      candidate card and title metadata present;
                                      expected controlled heading absent; stale projection false
M02 diagnostic location               e2e/support/safe-diagnostics.ts:18:1
artifact scanner                      PASS; 4 files, 0 findings
budget failure/HTTP 429               false / none
permanent smoke                       NOT DISPATCHED (fail-fast)
targeted historical T                 0 identities; not dispatched
provider/runtime cleanup              PASS; runtime removed; controlled env absent
```

The M02 artifact is bounded to the safe presentation mismatch above. It proves
that the authoritative row was assigned and collecting at sequence 1 and that one
metadata request completed successfully, but it does not provide a provider
request ledger because M02 stopped before its final provider assertion. No further
charged diagnosis is authorized by T070.

Recovery consumption and final rolling-window accounting at the bounded post-stop
check at `2026-09-21T23:47:41+05:00` (cutoff
`2026-09-21T22:47:41+05:00`) were:

```text
T070 recovery identities             6 (M01 2 + M02 4)
cumulative historical T070          19 (previous 13 + recovery 6)
current rolling usage                8 (run-kgYf3b=2 + run-58wwA0=6; run-2mCLkX aged out)
R02 capacity                       150
R02 headroom                       142
C1                                  not rerun; prior receipt valid
smoke                               not dispatched
HTTP 429                            none
unfinished run markers              0
owned Playwright/provider runtime   0
controlled provider env             absent
Auth                                M01/M02 success
cleanup                             M01/M02 true
```

T070 remains incomplete because the required M01+M02+smoke block did not pass.
The exact next task is T070; do not start T071, T072, T073, T074, or Feature 010.

### T070 M02 deterministic presentation diagnosis and non-charged fix — 2026-09-22

No R02 admission, browser command, identity, M01/M02 replay, smoke, C1, retry,
replacement attempt, or Feature 010 work occurred in this diagnosis. The cumulative
historical T070 consumption remains 19 identities.

The failed M02 presentation assertion was stale. `prepareRoom` always called the
candidate harness's no-argument `available()` assertion, whose fixed expected
fixture was TMDB `6006`, class `constellation`, title `Controlled Constellation`,
release year `2005`. That expectation is correct for M01 but not for M02.

M01 and M02 intentionally retain different contracts:

| Contract | M01 | M02 |
| --- | --- | --- |
| room source | normal Edge creation under canonical YAML | bounded test-only retained snapshot creation |
| ordering | `vote_count_desc` | `title_asc` |
| vote/rating cutoff | `500` / absent | `500` / absent |
| metadata language | `en-US` | `de-DE` |
| genre mode | `or` | `and` |
| agreement | exact `2/3`, with N=2 forced to 2 | exact `2/3`; N=3 threshold 2 and N=4 threshold 3, both resolved only at N/N |
| voters | voting creator plus one voter | non-voting creator plus three voters, then the same identities in an all-four-voter room |
| controlled first winner | `6006` / `Controlled Constellation` because 900 votes beats 700 | `6007` / `Controlled Aurora` because Aurora sorts before Constellation under retained `de-DE` title order |

M02's three voters each select Action and Drama. Retained `and` compiles those
choices to singleton clauses, so the Action-only controlled decoy is ineligible;
both real controlled candidates remain eligible. The configured `title_asc`
comparator therefore selects `6007` (`aurora`) rather than M01's `6006`
(`constellation`). This is not source order leakage: the provider returns
Constellation before Aurora, and the production comparator reverses them for M02.

The charged bounded diagnostic and the deterministic reproduction establish one
consistent identity chain:

```text
retained M02 snapshot       configured_009_v1 / title_asc / 500 / no rating /
                            de-DE / and / 2/3
authoritative occurrence    fixture class aurora; TMDB 6007; sequence 1
public room projection      assigned / collecting / sequence 1 / decision count 0
metadata request            Details 6007 with language=de-DE; Configuration follows
Edge response               available / collecting / sequence 1 /
                            6007 / Controlled Aurora / 2006 /
                            controlled-successor poster
client candidate state      same 6007 identity and sequence; no merge/integrity error
CandidateCard               present; accessible heading Controlled Aurora; year 2006;
                            accessible poster label Poster for Controlled Aurora
stale harness assertion     accessible heading Controlled Constellation
```

The controlled provider intentionally returns the same bounded English fixture title
from its validated `de-DE` Details request. Metadata language is therefore honored
but does not translate or change this fixture title. The card's header role is also
correct: the exact M02 client-route regression locates `Controlled Aurora` by its
accessible header role and title test ID. There is no retained-snapshot, provider,
ordering/filter, metadata-language, generation/sequence, client merge, or
accessibility defect.

The zero-identity reproduction uses the actual production `searchTmdbCandidate`,
`loadTmdbPresentation`, room-candidate handler, strict Edge response, client state
hook and room-route/CandidateCard path against one shared controlled fixture. It
proves the `title.asc`, `de-DE`, `vote_count.gte=500`, and `with_genres=18,28`
request; the `6007` candidate commit at expected sequence 0; the resulting assigned
sequence 1 response; and the exact rendered Aurora heading/year/poster. No arbitrary
DOM or provider payload is emitted.

The smallest fix makes the bounded presentation assertion accept an exact expected
controlled fixture while preserving all existing exact title/year/poster checks.
`prepareRoom` defaults to Constellation for M01; both M02 rooms explicitly pass
Aurora, and M02 immediately checks PostgreSQL's committed candidate ID against
`6007`. Presentation failure diagnostics now evaluate the same explicit expected
fixture. The provider and harness share `e2e/support/tmdb-controlled-fixture.ts`, so
identity/title classifications cannot silently diverge. No YAML value, product
ordering/filter rule, metadata language, sleep, retry, timeout, or assertion strength
changed.

Deterministic regression and non-charged validation:

```text
npx jest --runInBand __tests__/config/feature009-e2e-profile.test.ts
  __tests__/routes/room.test.tsx __tests__/candidates/state.test.ts
  __tests__/candidates/candidate-card.test.tsx
  PASS; 4 suites, 62 tests
npx deno test ... room-candidate.test.ts tmdb-search.test.ts tmdb-eligibility.test.ts
  PASS; 49 tests; exact M02 retained-rule/source/commit/metadata/Edge case included
npm run test:edge
  PASS; 63 passed, 0 failed, 1 intentionally ignored live contract
npm run test:client
  PASS after updating the exact diagnostic-call contract; 50 suites, 839 tests
npm run db:reset
  PASS; clean latest Feature 009 schema
npm run db:test
  PASS after clean reset; 8 files, 933 tests
npm run lint
  PASS
npm run typecheck
  PASS
npm run db:types:check
  PASS; canonical generated types consistent; no generation
node scripts/check-selection-rules-config.mjs
  PASS; canonical bytes and both server assets identical; no client/env override
node scripts/check-e2e-artifacts.mjs test-results/run-58wwA0
  PASS; 4 files, 0 findings
git diff --check
  PASS
```

The first plain database invocation was blocked before test execution by the managed
home telemetry path. A second invocation using a new temporary XDG directory was
also ignored by this pinned CLI. The established fixed local CLI environment with
telemetry disabled reached PostgreSQL, where four global-count checks correctly
detected retained local rows. The documented clean local reset followed, and the
complete 933-test matrix passed. These preliminary environment/cleanliness failures
changed no source, migration, generated type, or product result.

### T070 recovery completion — 2026-09-22

The deterministic M02 fixture correction was followed by one fresh authoritative
R02 admission and one complete recovery block. The replay derivation was confirmed
from the current profile and task contract:

```text
M01                         2 identities
M02                         4 identities
permanent smoke            16 identities
targeted historical T       0 identities
recovery total             22 identities
```

At `2026-09-21T19:20:18.233Z` (`2026-09-22T00:20:18.233+05:00`), the fresh
rolling-window cutoff was `2026-09-21T18:20:18.233Z`. Admission was obtained before
charged dispatch:

```text
R02 capacity                  150
current rolling usage           6 (run-58wwA0; identities=6)
T070 recovery reservation      22 (M01 2 + M02 4 + smoke 16 + targeted T=0)
projected usage                28
projected headroom            122
unfinished run markers          0
active owned browser/provider   0
controlled provider env        absent
signup/quota probe             none
retry/reset/restart replenish  none
admitted                       true
```

C1 was not rerun: its prior controlled-failure receipt remains valid and C1 is
outside this recovery suffix. The admitted charged execution was fail-fast and
dispatched exactly once per allowed suite:

```text
owner command                  npm run test:e2e:feature009
owner receipt                  test-results/run-qbNw79/summary.json
M01                            PASS; 2 signups / 2 identities
M02                            PASS; 4 signups / 4 identities
owner Auth/cleanup             success / true
owner HTTP 429/budget          none / false
owner artifact scanner         PASS; 3 files, 0 findings

smoke command                  npm run test:e2e:smoke
smoke receipt                  test-results/run-y6oHna/summary.json
smoke cases                    G03=3, G04=4, G05=2, G08=4, H01=3
smoke total                    PASS; 16 signups / 16 identities
smoke Auth/cleanup              success / true
smoke HTTP 429/budget           none / false
smoke artifact scanner          PASS; 3 files, 0 findings
```

The owner and smoke managed runtimes both reached `started -> ready`, then were
removed cleanly. No Playwright/provider process or controlled-provider `.env`
remained afterward; the nine shared Supabase containers were infrastructure only.
No scope or UI violation was reported, and no failed, partial, manual, replacement,
retry, or quota-manipulation attempt occurred in this recovery. The prior failed
and diagnostic attempts remain fully counted in the historical ledger.

The bounded post-stop R02 calculation at `2026-09-21T19:23:26.472Z`
(`2026-09-22T00:23:26.472+05:00`) used cutoff `2026-09-21T18:23:26.472Z`:

```text
current rolling usage          28 (run-58wwA0=6 + owner=6 + smoke=16)
R02 capacity                  150
R02 headroom                  122
T070 recovery consumption      22
cumulative historical T070    41 (previous 19 + recovery 22)
HTTP 429                       none
Auth                            owner and smoke successful
cleanup                         owner and smoke true
scanner                         owner and smoke zero findings
provider/runtime                removed; no active owned process/env
```

T070 is complete. T071 is the exact next task; stop here and do not start T071,
T072, T073, T074, or Feature 010.

### T071 repeatability attempt — bounded failure at check-only types — 2026-09-22

Before charged dispatch, the T070 owner-plus-smoke source was reconstructed under
the current testing-contract manifest scope: `app/`, `src/`, `supabase/`, `e2e/`,
`__tests__/`, `scripts/`, `config/`, and the root package/profile/build files;
evidence ledgers, `docs/`, `specs/`, `test-results/`, dependencies, and generated
exports were excluded. The 194-file content manifest was stable on an independent
recalculation:

```text
HEAD                                      e55a53bbc6494691f9a9e636cfead61a29255982
content manifest SHA-256                  a2c199a27625575ffc0b2adc15aef365fdf6bf879cf2a639c6b5b668de34921e
manifest path-list SHA-256               050ce02104e69b0c25a15c5baf795115fca785a1127bf8261d8373c8e60b9932
manifest files                            194
T070 smoke receipt boundary               2026-09-22T00:22:41.629991513+05:00
implementation/harness source after run  none
generated types SHA-256                  69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
room-create SHA-256                      0d18aada151a291847f84b32f6f86b97acfbb62cb0ff5e4f03b60fc6ed789b0c
```

Node `v24.12.0`, npm `11.6.2`, Supabase CLI `2.116.0`, bundled Deno `2.5.2`,
the retained local stack, and the fixed browser profile (`workers=1`,
`retries=0`, `repeatEach=1`, capture off) matched T070. No source file in the
manifest had a modification time after the successful T070 smoke receipt.

Fresh authoritative R02 admission was obtained at
`2026-09-22T00:35:17.629+05:00`, cutoff `2026-09-21T23:35:17.629+05:00`,
before any T071 identity-bearing command:

```text
R02 capacity                         150
current rolling usage                 28 (run-58wwA0=6, run-qbNw79=6, run-y6oHna=16)
T071 reservation                      22 (M01 2 + M02 4 + smoke 16)
projected usage                       50
projected headroom                    100
unfinished run markers                0
active owned browser/provider         0
signup/quota probe                    none
retry/reset/restart replenishment     none
admitted                              true
```

The admitted browser block ran exactly once per allowed suite with fail-fast
behavior:

```text
owner command                         npm run test:e2e:feature009
owner receipt                         test-results/run-pLQV5f/summary.json
M01                                   PASS; 2 signups / 2 identities
M02                                   PASS; 4 signups / 4 identities
owner Auth/cleanup                    success / true
owner scanner                         PASS; findings []
owner HTTP 429/budget                 none / false

smoke command                         npm run test:e2e:smoke
smoke receipt                         test-results/run-zmMaTn/summary.json
smoke cases                           G03=3, G04=4, G05=2, G08=4, H01=3
smoke total                           PASS; 16 signups / 16 identities
smoke Auth/cleanup                    success / true
smoke scanner                         PASS; findings []
smoke HTTP 429/budget                 none / false
```

The required post-block `npm run db:types:check` was then run once and failed
before generation with `DATABASE_TYPES_GENERATOR: Local generation failed`; the
existing generated artifact was preserved at the hash above. No retry, reset,
restart, quota manipulation, or source change followed. The owned Playwright
runtime/provider was removed and no active owned runtime remained. The final
receipt ledger was `50 / 150` (`run-58wwA0=6 + run-qbNw79=6 + run-y6oHna=16 +
run-pLQV5f=6 + run-zmMaTn=16`), leaving `100` identities of headroom.

The browser identities consumed by this attempt were exactly `22`. The normative
repeatability arithmetic remains `23 + 22 = 45` (T070 successful checkpoint plus
this T071 browser block), but repeatability is not certified and T071 remains
incomplete because the required check-only types gate failed. Historical T070
charged accounting remains separate at `41`; actual historical-plus-T071 charged
consumption is `41 + 22 = 63`.

The exact next task remains T071. Do not retry within this repeatability attempt
and do not start T072, T073, T074, or Feature 010.

### T071 completion — check-only type-gate recovery — 2026-09-22

The charged T071 browser evidence above remains the governing repeatability block:

```text
owner receipt       test-results/run-pLQV5f/summary.json  PASS; M01=2, M02=4; 6 identities
smoke receipt       test-results/run-zmMaTn/summary.json  PASS; G03/G04/G05/G08/H01; 16 identities
scanner/cleanup     owner zero findings / true; smoke zero findings / true
Auth/HTTP 429       successful / none
charged block       22 identities; no browser command was rerun during recovery
normative arithmetic 23 + 22 = 45
```

The exact failed path was reproduced without browser execution. The project-local
CLI is `node_modules/.bin/supabase` (`2.116.0`); its direct command
`gen types --lang typescript --local --schema public` exited before database
introspection because it attempted to write the managed-home telemetry temporary
file and received:

```text
FileSystem.writeFile (/home/otter/.supabase/telemetry.json.tmp.<uuid>)
EROFS: read-only file system, open '/home/otter/.supabase/telemetry.json.tmp.<uuid>'
```

The wrapper drained that stderr and therefore exposed only
`DATABASE_TYPES_GENERATOR: Local generation failed`. The local database itself was
available: PostgreSQL `17.6`, the DB container was healthy, REST/Auth health checks
returned `200`, and `20260920000000_selection_rules_candidate_ordering` was the
latest applied migration. A control run with
`SUPABASE_TELEMETRY_DISABLED=1 npm run db:types:check` passed, proving this was a
check-wrapper/managed-home environment defect, not a local lifecycle, schema, or
generated-types mismatch.

The smallest correction was confined to check-only tooling. `scripts/database-types.mjs`
now launches the pinned project-local CLI with `SUPABASE_TELEMETRY_DISABLED=1`,
`DO_NOT_TRACK=1`, and the established writable temporary
`XDG_CONFIG_HOME=/tmp/otteroom-supabase-config`; a generator-environment regression
assertion was added to `__tests__/config/database-types.test.ts`. No schema,
product/runtime behavior, browser harness, profile, or second generated-types write
point changed.

Final non-charged validation:

```text
npm run db:types:check                                      PASS; consistent
config generator/boundary/profile/local-config suites       PASS; 4 suites, 36 tests
npm run lint                                                PASS
npm run typecheck                                           PASS
node scripts/check-selection-rules-config.mjs               PASS
git diff --check                                            PASS
```

The canonical generated artifact was never replaced by the failed or successful
check-only command:

```text
sha256  69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
inode   11577831
size    20779 bytes
mtime   2026-09-21 16:52:27.499977389 +0500
ctime   2026-09-21 16:52:27.728977248 +0500
```

The existing 22-identity browser evidence remains valid. The post-run correction is
isolated to the database-types check environment and its regression test; no
implementation, Edge/client behavior, E2E harness, browser profile, schema,
canonical YAML, or generated artifact exercised by M01/M02/smoke changed. The
pre-dispatch 194-file manifest (`a2c199a27625575ffc0b2adc15aef365fdf6bf879cf2a639c6b5b668de34921e`,
194 files) and the receipt scanner/cleanup results remain historical evidence for
the charged block. The repeatability contract allows this check-only validation
between browser blocks, so no charged replay is required.

T071 is complete. Historical T070 accounting remains separate (`41` identities);
T071 contributes `22`, while normative repeatability remains `23 + 22 = 45`.
The exact next task is T072. Do not start T073, T074, or Feature 010 in this task.

### T072 fresh-checkout attempt — blocked at first protected migration precondition — 2026-09-22

T072 was attempted at `2026-09-22T01:11:19+05:00` (`2026-09-21T20:11:19Z`).
The workspace source was not modified by checkout construction or validation. The
exact implementation candidate was constructed in an independent disposable clone
from the recorded base `HEAD` and committed only inside that disposable clone:

```text
base implementation SHA                 e55a53bbc6494691f9a9e636cfead61a29255982
disposable candidate SHA                348ffa4f01b72a8fb7bf4c787e52920b13c1b2bd
current implementation patch SHA        4f93269ea02e9470f204315c1682a909c7bdb56cf2da7e70e442033a8c23c8ab
T071-scope source files                 194
T071-scope path-list SHA-256            6012739d55e67c413f658adf271e9d8797fc4e9b228c2008fba8f0487f52b147
T071-scope content-manifest SHA-256     b1e9a74cedef4a89e9d93abe45d1b92bc8bd7a5e79982371cf5e9cb56bef9aed
manifest convention                    sorted `sha256<TAB>path` lines
checkout                               /tmp/otteroom-t072-source.1Z77gb/checkout
```

The clone applied only the implementation/harness patch and the intended
`app/`, `src/`, `supabase/`, `e2e/`, `__tests__/`, `scripts/`, `config/`, and root
package/profile/build files. The 11 untracked Feature 009 specification/evidence
files were explicitly excluded. Before installation the candidate had no
`.env.local`, `node_modules`, `dist`, `test-results`, or Feature 009 `specs/`
directory; after `npm ci`, the only ignored checkout state was its newly installed
`node_modules/`. The disposable candidate commit was clean. No workspace Auth
storage, database volume, browser cache, environment file, or test artifact was
copied.

Non-charged fresh-checkout preflight completed before the blocker:

```text
Node / npm                            v24.12.0 / 11.6.2
declared .nvmrc / package manager     24.20.0 / npm@11.19.0
Supabase / Deno / Playwright          2.116.0 / 2.5.2 / 1.63.0
npm ci                                PASS; 1116 packages added, 1117 audited
managed-home correction               fixed telemetry-disabled XDG config used;
                                      unqualified CLI probe reproduced EROFS only
credentials-only local setup          PASS; `supabase:start` attached to the
                                      pre-existing shared stack; fresh `.env.local`
                                      mode 600 with only the two public fields
Playwright setup                      PASS; pinned Docker image prepared; no
                                      owned browser container started
canonical YAML                        PASS; SHA-256 3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970;
                                      bundle is a symlink to ../../../config/selection-rules.yaml
                                      and canonical/bundle bytes match
migrations present                    PASS; 12 migration files
historical migrations                 PASS; byte-identical to base; only the
                                      new 20260920000000 migration differs/adds
generated database types               PASS; canonical hash
                                      69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
                                      and no type-generation command was run
```

The first protected validator was dispatched exactly once:

```text
command                               node scripts/check-room-membership-migration.mjs
result                                FAIL at stage=preconditions, before reset,
                                      fixtures, migration, SQL assertions or writes
database precondition                  rooms=18; auth.users=44; room_rules=18;
                                      active_nonidle=0
container/port/lock                   healthy running Supabase DB; port 8081 unused;
                                      no owned Playwright container; validator lock absent
seven-validator progress              0/7 completed
```

The pre-existing local stack was not clean, so the validator correctly failed
closed. No reset, retry, migration runner, Edge/client/static/security suite,
generated-types check, lint/typecheck/export, artifact scan, R02 admission, browser
command, Auth signup, C1, or smoke execution followed. The candidate checkout and
its fresh dependencies remain preserved at the path above as failure evidence;
there is no owned browser/provider runtime to clean. The shared Supabase stack was
not stopped because it predated T072 and is not an owned disposable resource.

T072 remains incomplete. No T072 identity was consumed, no HTTP 429 occurred, and
scanner/Auth/cleanup results are not applicable because no browser block ran. No
fresh R02 admission was obtained; the prior T071 ledger remains the last recorded
state (`50 / 150`) and was not reused as a new admission. The exact next task is
T072; do not start T073, T074, or Feature 010.

### T072 fresh-checkout isolation recovery — non-charged — 2026-09-22

The first T072 precondition failure was localized without resetting, stopping, or
mutating the pre-existing local stack. The checkout's `supabase/config.toml` had
the fixed `project_id = "otteroom-room-session"`, API port `55321`, and database
port `55322`; `npm run supabase:start` therefore resolved the existing Docker
Compose project rather than creating a checkout-owned project. The generated
checkout `.env.local` pointed at the same public API origin, `http://127.0.0.1:55321`.

Every protected validator independently hard-coded
`supabase_db_otteroom-room-session` and executed `psql` through `docker exec`.
The running container labels identified project `otteroom-room-session`, workdir
`/home/otter/Projects/otteroom`, and volume `supabase_db_otteroom-room-session`.
The shared database identity was PostgreSQL system identifier
`7688067955905179685`, container ID
`72d1eec9b2a93acefce3b5d5c767ef9c9eb5ea5354dd280914b89f1ab38bf9d1`, and the
precondition counts were `rooms=18`, `auth.users=44`, and
`private.room_selection_rules=18`. The latest migration was already
`20260920000000`. This proves the rows belonged to the pre-existing shared
development stack, not another retained validation project or candidate-owned
container. No credential or key was printed.

The first validator exited at `stage=preconditions` before reset, fixture,
migration, SQL assertion, generated-type, Auth, browser, or R02 work. Shared
counts remained `18/44/18` throughout. The fresh checkout contained no copied
modules, Auth/browser state, database volume, or test artifacts; `npm ci` created
its own `node_modules` only, and the credentials-only `.env.local` had only the
two public client fields with mode `600`.

The smallest test/tooling correction added opt-in isolated local Supabase routing:

- `scripts/t072-isolated-supabase.mjs` creates a source/config-only runtime under
  `/tmp/otteroom-t072-supabase-*`, assigns a unique project ID and free port
  range, validates canonical YAML byte identity, and stops/deletes only its own
  project with `--no-backup`.
- `scripts/local-supabase.mjs`, `scripts/supabase-cli.mjs`, the local status/type
  wrappers, seven migration validators, the terminal-path check, and the Edge
  provider launcher route the opt-in project/workdir dynamically; normal
  `otteroom-room-session` defaults remain unchanged.
- The managed Supabase process wrapper now supplies the repository-safe
  telemetry-disabled writable XDG directory and no longer kills the detached
  project-local CLI shim while the real Supabase process is still starting.
  The status wrapper receives the same environment. The selection-rules validator
  also received the missing project-local `PATH` setup; its first failed cleanup
  was therefore a tooling precondition failure, not a database failure.
- Configuration assertions cover isolated project/workdir, dynamic container
  routing, owned cleanup, and absence of the old hard-coded validator container.
  No product behavior, schema, migration, Edge contract, client behavior, YAML
  value, generated type, browser profile, or production configuration changed.

The corrected disposable runtime was:

```text
project                         otteroom-t072-scsxwm-6d2a
workdir                         /tmp/otteroom-t072-supabase-ScsxWM
API / database ports            56000 / 56001
database container              supabase_db_otteroom-t072-scsxwm-6d2a
network / volume                supabase_network_otteroom-t072-scsxwm-6d2a /
                                supabase_db_otteroom-t072-scsxwm-6d2a
PostgreSQL system identifier    7688095284970569765
```

Before any protected migration reset, direct identity proof showed the isolated
database had `rooms=0`, `auth.users=0`,
`private.room_selection_rules=0`, all 12 migrations applied through
`20260920000000`, and no owned fixtures. The complete corrected protected matrix
then passed: room membership, participant filters, common filter resolution, TMDB
candidate source, swipe decisions, candidate progression, and selection rules.
Each validator ended with `latest-reset=true owned-fixtures=0`; the selection
receipt also proved historical migrations and generated types byte-identical,
with no TMDB/GoTrue/type-generation call.

Remaining non-charged T072 gates at the corrected source state:

```text
npm run db:reset                         PASS; latest 20260920000000; clean 0/0/0
npm run db:test                          PASS; 8 files, 933 tests
npm run test:edge                        PASS; 63 passed, 0 failed, 1 ignored live contract
npm run test:client                      PASS; 50 suites, 841 tests
Deno terminal-path check                 PASS; identities=0; controlled source/Edge/DB path
selection YAML packaging                 PASS; 118 canonical bytes; 2 assets byte-identical
empty artifact scan                      PASS; fileCount=0; findings=[]
npm run db:types:check                   PASS; check-only; canonical hash unchanged
generated types                          SHA-256 69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
npm run lint                             PASS
npm run typecheck                        PASS
npm run web:export                       PASS; 5 static routes
npm run playwright:install               PASS; mcr.microsoft.com/playwright:v1.63.0-noble prepared
git diff --check                         PASS
iOS/Android export                       NOT APPLICABLE; no native export scripts exist
```

The direct Node invocation of the terminal-path script was not authoritative
because Node 24's strip-only TypeScript loader rejects a parameter property; the
established Deno runner passed with zero identities. The first full Jest
invocation inherited the opt-in runtime variables and failed only wrapper tests
that assert default CLI arguments; rerunning the database-independent client
suite without those variables passed all 50 suites and 841 tests. Neither
attempt touched the database or consumed an identity.

Final isolated cleanup removed the owned containers, network, named volume, and
runtime directory. No owned Playwright container or provider environment
remained. The shared container stayed healthy with the original container ID,
workdir, volume, and PostgreSQL system identity; a final read-only query still
returned `rooms=18`, `auth.users=44`, and
`private.room_selection_rules=18`. No R02 admission was obtained, no identity
was consumed, and C1, permanent smoke, and all charged browser commands were
not run.

T072 remains incomplete only at its explicit charged boundary and is ready for a
separately admitted fresh `17`-identity block (`C1 1 + permanent smoke 16`),
with cumulative normative arithmetic `45 + 17 = 62`. Do not start T073, T074, or
Feature 010.

### T072 charged fresh-checkout block — failed, no retry — 2026-09-22

The corrected non-charged source was reconstituted in a new clean disposable
checkout before admission. The current workspace, the preserved corrected
source tree, and the final checkout matched across the exact implementation
scope: 197 files under `app/`, `src/`, `supabase/`, `e2e/`, `__tests__/`,
`scripts/`, `config/`, plus the root package/profile/build files. The manifest is
the SHA-256 of sorted `sha256<TAB>path` lines with a trailing newline, where each
file hash covers its source bytes:

```text
implementation commit             5eef89dda363805321a1d48babde855d721aa3d3
implementation tree               05c68d9b0c447f07db5ce57136611d8895075068
source files                      197
manifest path-list SHA-256        8b71e93e4f16374b66572e1cf047f54706714cc47a49bdd1482033911e765e71
content manifest SHA-256          ce8651f7224b1918456244c80cfb8b729ebe9ef227b707cb27463faa2fe53feb
generated types SHA-256            69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
canonical YAML SHA-256             3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
```

The fresh checkout had no copied `.env.local`, `node_modules`, build output, or
test results before setup. `npm ci` passed (`1116` packages added, `1117`
audited), Playwright setup passed with the pinned
`mcr.microsoft.com/playwright:v1.63.0-noble` image, and the charged commands ran
only after the isolated runtime was clean. No source changed between the
successful non-charged validation and charged dispatch.

The isolated T072 runtime was project `otteroom-t072-dwtkw2-a0f4`, API/database
ports `56000/56001`, container
`b2441671c8feda2d8afbb51b67f5a41fa548f74fb2c8de1827ffe0ed92ec476f`, and
PostgreSQL system identifier `7688101791465533477`. Its clean precondition was
`rooms=0`, `auth.users=0`, `private.room_selection_rules=0`, with latest migration
`20260920000000`. The shared development stack was never used by the charged
checkout.

Fresh authoritative R02 admission was obtained at
`2026-09-21T21:22:49.900Z` (`2026-09-22T02:22:49.900+05:00`), cutoff
`2026-09-21T20:22:49.900Z`, immediately before C1:

```text
R02 capacity                         150
current rolling usage                  0
T072 reservation                      17 (C1 1 + permanent smoke 16)
projected usage                      17
projected headroom                   133
unfinished run markers                0
active owned browser/provider         0
signup/quota probe                    none
retry/reset/restart replenishment     none
admitted                              true
```

C1 ran exactly once as `npm run test:e2e:security` (`run-4DeYfO`). It satisfied
the controlled-failure contract: controller `PASS`, inner exit `1` by design,
Auth `1/1`, cleanup `true`, one signup/identity, complete artifacts, scanner
findings `[]`, and no HTTP `429` or budget failure.

Permanent smoke then ran exactly once as `npm run test:e2e:smoke`
(`run-OpiSVe`) and failed closed. The bounded receipt was:

```text
G03  E2E_FAILURE  3 identities  Auth=true cleanup=true
G04  E2E_FAILURE  4 identities  Auth=true cleanup=true
G05  E2E_FAILURE  2 identities  Auth=true cleanup=true
G08  E2E_FAILURE  3 identities  Auth=true cleanup=true
H01  E2E_FAILURE  3 identities  Auth=true cleanup=true
scanner findings                  []
HTTP 429 / budget failure         none / false
```

The smoke attempt consumed `15` identities because G08 stopped before its
fourth identity; the C1-plus-smoke charged attempt therefore consumed exactly
`1 + 15 = 16` identities. Its controller exited `1`, no retry or replacement
was made, and the evidence includes a bounded H01
`E2E_SAFE_FAILURE` at `e2e/support/room-harness.ts:241:19`. The isolated database
contained only T072-owned rows immediately before teardown (`rooms=5`,
`auth.users=16`, `private.room_selection_rules=5`).

Post-stop R02 accounting at `2026-09-21T21:26:33Z`
(`2026-09-22T02:26:33+05:00`) was `16 / 150`, leaving `134` identities of
capacity. Repeatability remains certified at `45`; fresh-checkout acceptance is
not certified, and normative `45 + 17 = 62` is not claimed because the smoke
receipt did not pass its required `16`-identity contract.

The owned isolated containers, network, named volume, runtime directory, final
checkout, prior T072 checkout, fresh modules, `.env.local`, provider env, test
artifacts, and browser runtime were removed. No T072-owned process or resource
remained. The shared development stack was read before and after charged work
and cleanup and remained byte-for-byte operationally identified as:

```text
container     72d1eec9b2a93acefce3b5d5c767ef9c9eb5ea5354dd280914b89f1ab38bf9d1
project       otteroom-room-session
workdir       /home/otter/Projects/otteroom
volume        supabase_db_otteroom-room-session
system ID     7688067955905179685
counts        rooms=18, auth.users=44, private.room_selection_rules=18
latest        20260920000000
```

T072 remains incomplete. The exact next task is T072; do not start T073, T074,
or Feature 010.

### T072 smoke isolation diagnosis and non-charged correction — 2026-09-22

No new R02 admission was obtained and no browser, C1, smoke, signup, or other
identity-bearing command was run. The retained `run-OpiSVe` receipt classifies
all five selected cases as failed, in execution order G03, G04, G05, G08, H01.
G03/G04/G05 had executed before G08, and H01 executed afterward; none of the
five cases passed. G08 is the accounting-breaking early stop: its owner and two
room voters had signed up, but its outsider's fourth identity is created only
after the first authoritative room snapshot. The stale snapshot helper failed
before that call. The exact smoke accounting is therefore
`G03 3 + G04 4 + G05 2 + G08 3 + H01 3 = 15`, one below the planned 16.

The retained location `e2e/support/room-harness.ts:241:19` was the original
catch-body expression `throw new Error('E2E_SAFE_FAILURE')`; it was not the
cause. `committedRoomSnapshot` had parsed the successful query output `[]`, so
the exact failed predicate was the one-row guard
`!Array.isArray(snapshots) || snapshots.length !== 1 ||
!/^[0-9]+$/.test(snapshots[0].xmin)`, specifically
`snapshots.length !== 1`. The safely expected state was one matching room with
a valid numeric `xmin`, one bounded member set, and its bounded filters. The
safely observed wrong-database state was an empty snapshot array.

The relevant caller paths were:

```text
run-e2e smoke -> Playwright G03 -> committedRoomSnapshot (waiting-disconnect)
run-e2e smoke -> Playwright G04 -> committedRoomSnapshot (pre-admission snapshot)
run-e2e smoke -> Playwright G05 -> committedRoomSnapshot (post-overlap snapshot)
run-e2e smoke -> Playwright G08 -> assertReady -> committedRoomSnapshot
run-e2e smoke -> Playwright H01 -> assertReady -> committedRoomSnapshot
```

The implementation manifest, generated types, canonical YAML, migrations,
fixtures, Edge assets, room-create transport, browser/runtime profile, E2E
environment, and Auth/session setup were unchanged between the governing green
T070/T071 smoke and the failed fresh-checkout smoke. Auth succeeded, cleanup
succeeded, the scanner was empty, and no 429 occurred. The distinguishing state
was only the local Supabase target: T070/T071 used project/container
`otteroom-room-session` / `supabase_db_otteroom-room-session`, while T072 used
the owned dynamic project/container and ports. The CLI, migration, type, Edge,
and setup paths already consumed `OTTEROOM_SUPABASE_PROJECT_ID` and
`OTTEROOM_SUPABASE_WORKDIR`, but the browser harness still used the literal
shared container in four direct PostgreSQL calls. This is a stale shared-harness
assumption and fresh-checkout/isolation tooling defect, not a product, schema,
fixture, transport, Auth, timing, or lifecycle regression.

The failure was reproduced non-chargedly in a newly owned isolated Supabase
runtime. A direct SQL-only synthetic waiting room and member were inserted with
referential triggers disabled for the fixture transaction, leaving
`auth.users=0`; no anonymous identity or signup was created. The isolated query
returned one valid `waiting`, `1/2` room with one member and zero filters, the
same room lookup against the shared container returned `[]`, and the unmodified
`committedRoomSnapshot` deterministically raised `E2E_SAFE_FAILURE`. After the
correction, the exact same helper and fixture returned the valid bounded
snapshot.

The smallest correction imports and uses the established
`localSupabaseContainer()` resolver in `room-harness.ts` and
`decision-harness.ts` for all four remaining direct database calls: bounded room
snapshot, retained-rule fixture creation, assigned-candidate fixture creation,
and bulk decision-room fixture creation. No assertion, convergence bound,
timeout, retry, sleep, product contract, schema, migration, generated type,
fixture meaning, or fail-fast behavior changed. Static regression coverage in
`local-supabase-config.test.ts` now rejects the old literal in both harnesses
and requires their dynamic resolver wiring; the Feature 008 unit harness mocks
only the existing `.mjs` process-boundary resolver for Jest's CommonJS transform.

Non-charged validation passed:

```text
exact isolated helper reproduction       FAIL before / PASS after correction
focused shared-harness profiles          5 suites, 82 tests PASS
full client/config/privacy regressions    50 suites, 841 tests PASS
selection-rule packaging                 PASS; 118 bytes; 2 identical assets
empty artifact privacy scanner           PASS; 0 files; findings=[]
npm run db:types:check                    PASS; check-only
npm run lint                              PASS
npm run typecheck                         PASS
git diff --check                          PASS
Edge / DB / protected migrations          not implicated; no runtime/schema change
```

The owned diagnostic runtime was stopped and removed. The shared development
stack retained container ID
`72d1eec9b2a93acefce3b5d5c767ef9c9eb5ea5354dd280914b89f1ab38bf9d1`,
PostgreSQL system identifier `7688067955905179685`, and counts `18/44/18`
before and after. At the end of this non-charged diagnosis, T072 remained
incomplete and was ready only for a separately admitted recovery replay of C1
plus permanent smoke. Repeatability remained certified at 45; fresh-checkout 17
and cumulative 62 remained uncertified. The passed recovery is recorded below;
the historical section does not authorize any additional attempt.

### T072 charged fresh-checkout recovery — PASS — 2026-09-22

The corrected recovery completed at the exact current source state in an
independent disposable checkout. The normative T072 block passed; the earlier
failed/partial T072 charged attempt remains historical evidence above and is not
merged into the normative 17-identity acceptance receipt.

Fresh-checkout source and manifest identity:

~~~text
disposable snapshot commit             f7331a8a527eec695cd9a2d48570e68927acee81
disposable snapshot tree               96a151ada78d570205f698f452a348defe68cd3f
validated source scope                 197 paths
path-list SHA-256                      0e8679a54ee300a1a92fd039eb1b227900928bd6d10bec63676d2ae0bde0b462
content-manifest SHA-256               369b420d909d7de519e7cc96d06f9ac7658426f54d8b0cc3ba8e55c1b335cee7
canonical YAML SHA-256                 3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
generated types SHA-256                69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
checkout status                        clean; no Feature 009 evidence/spec copy
corrected harness                      room/decision sources byte-identical;
                                      four localSupabaseContainer call sites;
                                      old shared-container literal absent
credentials/modules/state              no copied env, Auth state, DB volume,
                                      browser state, node_modules or test results
~~~

The zero-identity fresh-checkout gates were green:

~~~text
npm ci                                  PASS; 1116 packages added, 1117 audited
Playwright setup                        PASS; pinned v1.63.0 Noble image
seven protected nonempty runners        PASS; all latest-reset and owned-fixtures=0
npm run db:reset                        PASS; latest 20260920000000; clean 0/0/0
npm run db:test                         PASS; 8 files, 933 tests
npm run test:edge                       PASS; 63 passed, 0 failed, 1 ignored
live TMDB contract                      PASS
npm run test:client                     PASS; 50 suites, 841 tests
Deno terminal-path check                PASS; identities=0
selection YAML packaging                PASS; 118 bytes; 2 assets byte-identical
npm run db:types:check                  PASS; inode/size/mtime unchanged
npm run lint                             PASS
npm run typecheck                        PASS
npm run web:export                      PASS; 5 static routes
iOS/Android export                      NOT APPLICABLE; no native export scripts/directories
artifact/privacy scan                   PASS; smoke 3 files, 0 findings; empty scan clean
git diff --check                        PASS
~~~

One initial Jest invocation inherited the opt-in isolated-runtime variables and
failed only the wrapper tests that assert default CLI arguments. It was
non-charged, produced no identity or database mutation, and was superseded by the
authoritative variable-free 50-suite pass above.

Owned isolated runtime proof before charged dispatch:

~~~text
project                                otteroom-t072-9pewgi-518f
workdir                                /tmp/otteroom-t072-supabase-9PEwgI
API/database ports                     56000/56001
PostgreSQL system identifier           7688271590142804005
clean precondition                     rooms=0, auth.users=0, room_rules=0
latest migration                       20260920000000
shared runtime                         not used by browser/API/harness writes
~~~

Fresh authoritative R02 admission:

~~~text
admission UTC                         2026-09-22T08:27:57+00:00
rolling cutoff UTC                    2026-09-22T07:27:57+00:00
capacity                              150
current rolling usage                 0
T072 reservation                       17
projected usage                       17
projected headroom                    133
unfinished markers                    0
active owned browser/provider         0
signup/quota probe                    none
retry/reset/restart replenishment     none
admitted                              true
~~~

Charged execution, fail-fast and exactly once:

~~~text
C1 command/receipt                    npm run test:e2e:security / run-Vc6w4y
C1 result                             PASS; controlled failure; inner exit=1 by design
C1 Auth/cleanup/artifacts              1/1; true; complete
C1 scanner/HTTP 429/budget             findings=[]; none; false

permanent smoke command/receipt        npm run test:e2e:smoke / run-MBQ6QD
G03/G04/G05/G08/H01                   PASS; 3 + 4 + 2 + 4 + 3 = 16 identities
smoke Auth/cleanup                     successful; true for all five cases
smoke scanner/HTTP 429/budget          3 files, findings=[]; none; false
charged T072 consumption              1 + 16 = 17 identities
~~~

Normative accounting is repeatability 45, fresh checkout 17, and
repeatability plus fresh checkout 62. Historical T072 charged accounting remains
separate: the prior failed/partial fresh-checkout block consumed 16 identities
(C1=1 plus G03/G04/G05/G08/H01=3+4+2+3+3); the passed recovery adds 17, for
33 historical T072 charged identities. No prior no-identity attempt is counted as
charged consumption.

Final R02 and cleanup state:

~~~text
final rolling usage                    17 / 150
final headroom                         133
owned isolated DB before teardown      6 rooms, 17 auth.users, 6 rules
owned browser/provider/runtime         removed; no active process/container/env
checkout/modules/dist/test results    removed
T072 temporary manifests/cache/config   removed
shared container                       72d1eec9b2a9
shared project/workdir/volume           otteroom-room-session /
                                      /home/otter/Projects/otteroom /
                                      supabase_db_otteroom-room-session
shared PostgreSQL system identifier     7688067955905179685
shared counts/latest migration          18/44/18 / 20260920000000
~~~

T072 is complete. The exact next task is T073; do not start T074 or Feature 010.

### T073 normative testing-strategy reconciliation — 2026-09-22

T070, T071, and T072 are complete. Their finalized receipts are the only
normative charged certification evidence: T070 successful run one, T071 the
unchanged-source repeatability run two, and T072 the isolated fresh-checkout
block. No browser, R02 admission, Auth probe, smoke rerun, database reset, or
other identity-bearing execution was performed for T073.

The final Feature 009 profile and inventory were reconciled against the current
repository rather than copied from the earlier projection:

```text
M01                                      2 identities
M02                                      4 identities
owner acceptance                         2 + 4 = 6 identities
Feature 008 boundary                     46 cases / 112 identities
Feature 009 additive cases                2 cases / 6 identities
final full acceptance inventory           48 cases / 118 identities
final full inventory plus C1              119 identities
```

The normative identity formulas are:

```text
normal checkpoint / T070 run one          C1 1 + smoke 16 + owner 6 + T 0 = 23
additional unchanged-source / T071        smoke 16 + owner 6 = 22
cumulative repeatability                  23 + 22 = 45
fresh checkout / T072                     C1 1 + smoke 16 = 17
repeatability plus fresh checkout         45 + 17 = 62
```

The repository evidence for the inventory is the existing profile configuration
assertion of `42 + 2 + 2 = 46` cases and `100 + 2 + 4 + 2 + 4 = 112` identities,
the current `feature009Cases` map, and the Feature 009 profile test's exact M01 /
M02 discovery and receipts. No inventory discrepancy was found.

Normative T070/T071/T072 receipts contain fresh admission immediately before each
charged block, safe-wrapper selection, workers 1/retries 0/repeat 1 and capture
off, exact Auth success, zero scanner findings, owned cleanup, no HTTP 429, and
no unfinished owned run. The owner-plus-smoke blocks use targeted `T = 0` and
fail-fast dispatch. T071's generated-types issue was recovered check-only without
a browser rerun; T072 proved fresh-checkout isolation and check-only generated
types with the canonical artifact unchanged.

Historical failed, partial, diagnostic, manual, and replacement attempts remain
in the earlier ledger and are not rewritten or folded into the normative formulas.
The retained ledger accounts for 41 historical T070 identities and 33 historical
T072 identities (16 failed/partial plus the normative 17-identity recovery).
T071's charged 22-identity browser block is the normative run-two evidence; its
type-check recovery was non-charged. No unfinished charged run remains. T074 is
still unstarted.

T073 documentation/static validation:

```text
node scripts/check-selection-rules-config.mjs       PASS; canonical bytes=118; assets=2; byte-identical=true
Feature 007/008/009 profile and boundary tests   PASS; non-browser Jest checks
documentation formula/inventory review             PASS; no discrepancy
git diff --check                                   PASS
charged browser/R02/Auth execution                 NOT RUN
```

## 8. Final Acceptance Checklist

Feature 009 implementation evidence is complete only when it records:

- valid/invalid startup matrix and restart-only behavior;
- old A/new B room retention plus explicit legacy rooms;
- cutoff, genre and all four order matrices;
- exact agreement/no-early matrices;
- source failure versus complete exhaustion;
- sequence/no-repeat/concurrency/recovery regression;
- security/privacy and absence of Match/config UI;
- clean and nonempty migration results;
- generated type, lint, typecheck, full tests and exports;
- M01/M02 exact six-identity pass;
- permanent smoke/C1, repeatability and exact-SHA fresh-checkout passes; and
- normative `docs/testing-strategy.md` reconciliation for M01 `2`, M02 `4`, owner
  `6`, `23/22/45/17/62`, full `48 cases / 118 identities`, and plus-C1 `119`; and
- commands, environment and outcomes sufficient for another session to reproduce.

### T074 final G5 traceability, integrity, evidence and scope audit — PASS — 2026-09-22

T074 performed the final read-only/static audit against the constitution, this
feature's `spec.md`, `plan.md`, `research.md`, `data-model.md`,
`requirements-traceability.md`, all three contracts, `tasks.md`, the reconciled
`docs/testing-strategy.md`, the implementation source, migration/type artifacts,
and the complete evidence ledger. No charged browser test, R02 admission,
anonymous Auth action, acceptance suite, database reset, provider call, or
runtime mutation was performed by T074.

#### G5 traceability reconciliation

| Scope | Result | Implementation and executable proof |
| --- | ---: | --- |
| Functional requirements FR-001–FR-040 | **40/40** | US1–US6 implementation paths, strict configuration/startup tests, migration/DB tests, Edge eligibility/order/failure tests, client boundary tests, and normative browser evidence |
| Non-functional requirements NFR-001–NFR-009 | **9/9** | Determinism, atomicity, recovery, eligibility, failure safety, privacy, migration compatibility, bounded scope, and TMDB continuity evidence from DB/Edge/client/static gates |
| Success criteria SC-001–SC-011 | **11/11** | Invalid-startup, A/B retention, legacy, parity, order, threshold, no-early, failure/empty, concurrency/recovery, ACL/privacy, and scope evidence |
| Acceptance scenarios 1–43 | **43/43** | Scenario ranges 1–7, 8–13, 14–23, 24–31, 32–38, and 39–43 are mapped in the traceability matrix and exercised by the recorded lower-layer and admitted owner evidence |
| User stories US1–US6 | **6/6** | Every story has implementation, focused executable proof, and the required acceptance boundary |
| Task graph T001–T074 | **74/74** | All task boxes are checked; T074 is the sole final scope/verdict gate and is now complete |

The grouped mapping is complete with no unmapped requirement, scenario, story,
or task: US1 covers FR-001–FR-007 and scenarios 1–7; US2 covers FR-008–FR-012
and scenarios 8–13; US3 covers FR-013–FR-018 and scenarios 14–23; US4 covers
FR-019–FR-024 and scenarios 24–31; US5 covers FR-025–FR-030 and scenarios
32–38; and US6 covers FR-031–FR-040 and scenarios 39–43. The nine NFRs and
eleven SCs are cross-cutting over those same authoritative implementation and
evidence boundaries. No unresolved product decision or completion blocker remains.

#### Configuration and room-snapshot audit

- The canonical server-only YAML is `config/selection-rules.yaml`, SHA-256
  `3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970`, with
  exactly: `ordering=vote_count_desc`, `minimum_vote_count=500`, omitted
  `minimum_average_rating`, `metadata_language=en-US`, `genre_mode=or`, and
  exact `agreement=2/3`.
- The strict parser rejects malformed, duplicate, unsafe, unknown, null,
  unsupported, and out-of-range YAML; normalizes exact fractions with integer
  arithmetic; deep-freezes the result; and fails before handler construction.
  Both `room-create` and `room-candidate` initialize from the bundled asset once.
- The Edge bundle is the approved symlink to the canonical file; both function
  assets are byte-identical. There is no environment, request, last-known-good,
  watcher, hot-reload, configuration service, or participant-facing rule UI.
  Activation is successful build/redeploy/restart only, and operational values
  remain YAML-configurable rather than hard-coded product constants.
- `private.room_selection_rules` is one private, immutable, protected row per
  room. Trusted service-role creation atomically creates the room, creator
  membership, and configured snapshot; duplicate A/B retry returns the existing
  winner without rewriting it. The retired authenticated direct-create signature
  cannot create a ruleless room.
- The migration backfills every pre-Feature-009 room with the explicit immutable
  `legacy_005_006_008` tuple: `legacy_source_order`, no vote/rating cutoffs,
  `en-US`, `or`, exact `2/3`. Existing rooms retain that tuple; later YAML
  generations affect only newly created rooms. Snapshot rows have no public
  projection, client grant, or Realtime publication.

#### Candidate source, eligibility and ordering audit

- Feature 006's TMDB client remains the sole candidate source; no alternate movie
  source, catalog, queue, cursor, or metric-history store was introduced.
- All four configured orderings are implemented: vote-count descending,
  average-rating descending, popularity descending, and title ascending. The
  comparator preserves deterministic TMDB-ID secondary handling, while product
  behavior makes no promise among equal-primary ties. Page traversal, date-shard
  bisection, duplicate suppression, numeric full-best-run completion, title full
  traversal, budgets, and child-failure propagation are covered by the recorded
  Edge search evidence.
- Retained language, inclusive years, adult/video rules, configured cutoffs,
  OR/AND within-voter semantics, AND across all fixed voters, Any-genre
  neutrality, and no-repeat occurrence history are applied consistently at
  resolution, retrieval, and locked commit. Required TMDB metrics are conditional
  on active cutoffs/comparators; missing or malformed required metrics yield
  `search_incomplete`, while irrelevant malformed metrics do not invalidate a
  valid search.
- No filter/cutoff weakening, ordering fallback, partial-result commit, or
  incomplete-traversal exhaustion exists. Transient source failure is distinct
  from authoritative exhaustion; only complete empty traversal invokes the empty
  CAS. Feature 008 prepare/search/expected-sequence commit, stale/retry,
  response-loss, concurrency, no-repeat, and recovery semantics remain intact.

#### Agreement, privacy and failure audit

- Exactly two voters require exactly `2/2` Yes. For `N >= 3`, the retained
  normalized numerator/denominator use integer ceiling arithmetic
  `((N * p) + q - 1) / q`; no floating-point agreement logic is present.
  The snapshot retains `p` and `q`, and the complete accepted `N/N` decision set
  is still required before resolution. No early resolution was introduced.
- Corrupt/missing required snapshots fail closed without startup-rule repair;
  stale work, retry, race, and metadata recovery preserve authoritative state.
  Safe client outcomes and logs contain no YAML, rule values, predicates,
  provider payloads, credentials, or protected identifiers. Individual filters,
  decisions, private predicates, fixed membership, and rooms-only publication
  remain protected.

#### Migration, generated-types and dependency integrity

- There is exactly one Feature 009 migration:
  `supabase/migrations/20260920000000_selection_rules_candidate_ordering.sql`
  (SHA-256 `457894026e6fe483e98248a1f8f4a04942a129092b62c08e7e183a1e096f0f7b`).
  All eleven historical migrations remain byte-identical to their certified
  hashes; the clean/nonempty backfill matrix preserves legacy values, timestamps,
  and applicable row identity.
- T063 was the sole legitimate generated-types write. T064, T071 recovery, and
  T072 fresh-checkout checks were check-only. The final
  `src/types/database.generated.ts` SHA-256 is
  `69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03`.
- The only new package dependency is pinned `yaml@2.9.0`; `package.json`, the
  root lock entry, and `node_modules/yaml` lock metadata agree. No unrelated
  dependency change is present, and the package-lock remains consistent.

#### Normative charged-evidence reconciliation

| Evidence block | Normative result |
| --- | ---: |
| Normal checkpoint / T070 | `C1 1 + smoke 16 + owner 6 + T 0 = 23` |
| Additional repeatability / T071 | `smoke 16 + owner 6 = 22` |
| Cumulative repeatability | `23 + 22 = 45` |
| Fresh checkout / T072 | `C1 1 + smoke 16 = 17` |
| Repeatability plus fresh checkout | `45 + 17 = 62` |
| Full inventory | `48 cases / 118 identities` |
| Full inventory plus C1 | `119 identities` |

T070, T071, T072, and T073 are complete. The governing T070/T071/T072 receipts
have fresh admission immediately before each charged block, exact safe-wrapper
profiles, workers 1, retries 0, repeat 1, capture off, scanner zero, Auth
success, owned cleanup, and no HTTP 429/budget failure. Historical failed,
partial, diagnostic, manual, and replacement attempts remain separately recorded
(historical T070 `41` identities and historical T072 `33` identities) and are
not folded into the normative `23/22/45/17/62` certification. No unfinished
charged run remains.

#### Scope-exclusion audit

Feature 009 did not introduce Match UX/navigation/celebration, Feature 010
behavior, early resolution, user-facing rule configuration, hot reload,
decision editing, dynamic membership expansion, an alternate candidate source,
or automatic rule weakening. The client remains neutral at the agreed/exhausted
boundary; Feature 010 remains unstarted.

#### Final implementation identity and checks

The governing implementation identity is the T072-certified source state:

```text
base workspace HEAD                  e55a53bbc6494691f9a9e636cfead61a29255982
certified disposable source commit  f7331a8a527eec695cd9a2d48570e68927acee81
certified disposable source tree    96a151ada78d570205f698f452a348defe68cd3f
validated implementation scope      197 paths
path-list SHA-256                    0e8679a54ee300a1a92fd039eb1b227900928bd6d10bec63676d2ae0bde0b462
content-manifest SHA-256             369b420d909d7de519e7cc96d06f9ac7658426f54d8b0cc3ba8e55c1b335cee7
canonical YAML SHA-256               3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
generated types SHA-256              69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
```

T074 changed only the evidence/task/roadmap artifacts; no implementation,
migration, generated-type, dependency, test, or runtime source changed during
this audit. The following read-only/static checks passed:

```text
bash .specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks  PASS
node scripts/check-selection-rules-config.mjs                                                        PASS
T074 inline traceability/integrity probe                                                            PASS
git diff --check                                                                                     PASS
owned T072/browser/provider runtime inventory                                                         CLEAN
```

Final G5 verdict: **PASS**. Feature 009 is fully complete, T001–T074 are
complete, and the repository is at the Feature 009 release boundary. No commit,
tag, push, charged run, or Feature 010 work was performed.

### T075–T077 post-G5 numeric traversal regression recovery — 2026-09-22

The preceding T074 verdict is preserved as historical evidence for its exact source
state. Manual local validation subsequently reopened Feature 009: a compatible broad
configured room returned retryable source failure with this safe Edge record:

```text
stage=discover failure=request_budget duration_ms=15260 count=0
```

No charged browser test, R02 admission, Auth signup, schema change, generated-types
write, approved-YAML change, Feature 010 work, or rule weakening occurred in this
recovery pass.

#### Exact old traversal and defect reproduction

The two voter year ranges intersect to `1955-01-01..2020-12-31`, or 24,107
inclusive dates. OR-mode clauses are `[18,53]` and `[18,27,53]`; the deterministic
safe provider pushdown is the smaller clause `with_genres=18|53`, while both clauses
remain authoritative in local and locked validation. The configured query also sends
`sort_by=vote_count.desc`, `vote_count.gte=500`, `language=en-US`, adult/video false,
and the full release-date bounds.

The old source did the following, serially:

1. Request page 1 for the complete date range.
2. If `total_pages > 500`, split inclusive dates at the midpoint. The first split of
   this exact range is `1955-01-01..1988-01-01` and
   `1988-01-02..2020-12-31`; recurse left then right until every leaf reports at most
   500 pages. A single-day overflow is incomplete.
3. For every final shard, request every reported page, parse every row, require exact
   raw-result accounting, and only then return the shard winner.
4. Visit every required child shard, compare all child winners, and propagate any
   child failure. A winner from an earlier page/shard could not be returned first.

For `L` final shards with `P_i` pages, the old overflow request count is
`(L - 1) + sum(P_i)` (one page-one probe for every internal split plus all leaf
pages). With no overflow it is simply every page `P`, up to 500. The exact date range
can theoretically reach 24,107 single-day leaves and 24,106 internal probes; the
shared attempt stops much earlier at the unchanged default 100 requests or 20 seconds.
The budget is enforced immediately before each `fetch` in `tmdbJson`; retries count.
All page and child calls are awaited serially. The Edge log's `count=0` is the
logger's unchanged default because the failure call supplies no count; it means
neither zero requests nor zero provider candidates.

A controlled no-shard 120-page equivalent isolated the defect more narrowly. One
result per page was already in correct descending vote-count order and the page-one
movie was the global winner. Under the old function:

```text
maxRequests=100  -> search_incomplete/request_budget; requests=100; simulated=15260ms
maxRequests=120  -> match; same global winner=1001; requests=120; simulated=18312ms
```

Thus the reported duration follows directly from 100 serial requests averaging
152.6 simulated milliseconds. Sharding was not required to reproduce the regression.

#### Official provider capability and corrected proof

The current official TMDB Discover Movie reference and OpenAPI contract document
`primary_release_date.gte/lte`, `vote_count.gte`, `vote_average.gte`, `language`,
comma-as-AND/pipe-as-OR `with_genres`, and the four used sorts
`vote_count.desc`, `vote_average.desc`, `popularity.desc`, and `title.asc`. TMDB also
documents the 500-page maximum. These are provider narrowing/order hints only; exact
local eligibility remains authoritative.

Configured numeric modes now use one broad full-range provider-sorted traversal:

1. Read pages/results in provider order and validate required evidence, primary
   monotonicity, every local room rule and complete no-repeat exclusions.
2. The first locally eligible movie establishes the highest eligible primary value,
   because every preceding provider row was locally rejected and later provider rows
   cannot have a higher primary value.
3. Continue through the entire equal-primary run, including a page boundary, and
   select the smaller TMDB ID exactly as the existing deterministic comparator does.
   Return only after a lower primary value closes that run or the range completes.
4. A malformed required metric, ordering regression, provider failure, inconsistent
   pagination, budget/deadline failure, or uncompleted tie proof remains
   `search_incomplete` with no commit.

`title_asc` remains exhaustive because TMDB does not specify collation equivalence
with the retained local `Intl.Collator` plus code-point comparator. Numeric overflow
with no provable broad-prefix result, exhaustive title traversal, and authoritative
empty proof retain deterministic nonoverlapping date shards. Every required child is
still visited and compared; only a fully complete empty traversal returns
`completed_empty`. The 100-request/20-second bounds were not increased.

Normal configured numeric complexity is now the inspected prefix through the first
eligible primary run (`k` serial page requests, commonly one), rather than every
lower-ranked page and every date shard. Exhaustion/overflow complexity remains the
old exhaustive proof complexity where correctness requires it.

#### Deterministic and live evidence

The new controlled matrix proves:

- the 120-page/1955–2020 regression returns the same global winner in 2 requests and
  305 simulated milliseconds under the unchanged 100-request budget;
- first-page local ineligibility and complete occurrence exclusions continue to the
  next page;
- equal-primary candidates crossing a page boundary select the smaller ID;
- required-metric, provider, ordering, pagination, budget and deadline defects remain
  incomplete;
- complete empty traversal visits every required page, while a >500-page empty range
  uses and completes both deterministic child shards;
- an early numeric winner in a >500-page broad result avoids sharding;
- vote-count, average-rating and popularity modes use the numeric prefix proof, while
  title mode retains exhaustive local comparison; and
- existing room-candidate failure/empty, no-repeat and expected-sequence CAS suites
  remain unchanged and green.

A safely available ignored credential permitted one supplemental non-Auth live
diagnostic for the exact manual constraint. It returned `match` in one Discover
request and 879 ms. The first request was exactly:

```text
1955-01-01..2020-12-31 / vote_count.desc / vote_count.gte=500 /
with_genres=18|53 / language=en-US / page=1
```

The existing official live TMDB contract also passed. Live data is supplemental and
is not the deterministic ordering or exhaustion oracle.

#### Exact source and non-charged validation

Runtime changes are limited to:

- `supabase/functions/_shared/tmdb-client.ts`: provider-sorted configured numeric
  prefix proof, primary-order validation, complete cross-page tie handling, and
  adaptive shard fallback; legacy and title exhaustive paths remain;
- `supabase/functions/_shared/candidate-contracts.ts`: add the safe
  `ordering_inconsistent` incomplete reason; no public/RPC shape changes; and
- `supabase/functions/_tests/tmdb-search.test.ts`: add the controlled regression,
  continuation, tie, defect, exhaustion/overflow and four-mode cases.

Traversal-only planning/recovery artifacts were updated. The migration, database
RPCs, generated database types, approved YAML, client product behavior and Feature
008 commit sequence were not changed.

```text
focused ordered-source suite                 PASS; 28 tests
full Edge suite                              PASS; 69 passed, 0 failed, 1 ignored live test
official live TMDB contract                  PASS
exact manual-filter live diagnostic          PASS; match, 1 request, 879ms
full client/config/privacy suite             PASS; 50 suites, 841 tests
selection-rule YAML/package check            PASS; 118 bytes, 2 identical assets
lint                                         PASS
typecheck                                    PASS
web export                                   PASS; 5 static routes
artifact/privacy scanner                     PASS; 0 findings
seven protected migration runners            PASS; latest reset, 0 owned fixtures,
                                              no GoTrue/TMDB/type-generation calls
clean isolated database reset                PASS; latest migration 20260920000000
full database suite                          PASS; 8 files, 933 tests
check-only database types                    PASS; canonical artifact consistent
historical migrations                        PASS; byte-identical
git diff --check                             PASS
charged browser/R02 acceptance               NOT RUN by instruction
```

The generated artifact remained SHA-256
`69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03`, inode
`11577831`, size `20779`; the Feature 009 migration remained SHA-256
`457894026e6fe483e98248a1f8f4a04942a129092b62c08e7e183a1e096f0f7b`.
The isolated validation project was removed, and the shared development database was
not reset or mutated.

#### Recovery certification impact and stop boundary

The source change invalidates the exact-source release claim of every T070–T074 gate:

- T070 normal C1/owner/smoke acceptance must be rerun;
- T071 unchanged-source owner/smoke repeatability must be rerun after the new T070;
- T072 independent fresh-checkout C1/smoke certification must be rerun;
- T073 must reconcile the new normative receipts/source identity; and
- T074 must repeat the final G5 traceability/integrity/scope audit.

All old receipts remain historical evidence and their identity accounting is
unchanged. Feature 009 remains **REOPENED** pending T078. The exact next recovery
step is to obtain fresh R02 admission for the current-source T070 normal block; do not
run it without that admission, and do not start Feature 010.

### T078 current-source normal checkpoint attempt — failed at C1 — 2026-09-22

This is the one fresh-admission attempt for the current-source normal checkpoint.
It was stopped at the governing C1 failure point; the owner suite and permanent
smoke were not dispatched. Historical T070–T074 receipts remain unchanged and are
not rewritten as evidence for this source.

#### Certified source identity before dispatch

```text
base workspace HEAD                  e55a53bbc6494691f9a9e636cfead61a29255982
source manifest scope                app, src, e2e, scripts, supabase, config,
                                     package.json, package-lock.json, playwright.config.ts
source files                         144
source path-list SHA-256             3f6512790b06794de3a5eeb0f66cc4d7dfaf3e7f7c0c467727b83a411e3f65a6
source content-manifest SHA-256      5bf1d44504ad22df5ce1330ff2f88a48b65de5f9f2aee4c9357ff675234c3060
ordered source tmdb-client.ts        3986b8247096b441792eb2de17ffb0ed7eaaf19e67952a143654cce06e445ebc
E2E owner spec                       46725a1416931abd9f66d29e4b9ad283c85896ee0ceca27eb0b0ef85be5cae9b
E2E controller                       d1cfc503fc053cd004dda7e86e6a9e1586e5f8efef9950ce93e291de4391e4df
canonical YAML                      3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
bundled YAML                        3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
```

The pre-dispatch packaging check passed: `canonical-bytes=118`, `assets=2`,
`byte-identical=true`, `client-inclusion=false`, and `env-overrides=false`.

#### Fresh authoritative R02 admission

```text
admission UTC                       2026-09-22T13:36:14+00:00
rolling cutoff UTC                  2026-09-22T12:36:14+00:00
capacity                            150
current rolling usage               0
reservation                         23
projected usage                     23
projected headroom                  127
unfinished markers                  0
active owned browser/provider       0
signup/quota probe                  none
retry/reset/restart replenishment   none
admitted                            true
formula                             C1 1 + M01/M02 6 + smoke 16 + T 0 = 23
```

The local receipt ledger had no identity-bearing receipt in the admission window.
No signup probe or quota request was made.

#### Fail-fast charged result

```text
C1 command                          npm run test:e2e:security
C1 run                              test-results/run-MSZTp3/
C1 controller                       failed; inner exit=1
C1 A/B                              passed
C1 C                                failed; category=E2E_FAILURE;
                                     error=E2E_SAFE_FAILURE
C1 Auth/cleanup                     authSuccess=false; cleanup=false
C1 attempts/successful identities   signups=1; identities=0
C1 artifacts                        artifactsComplete=false
C1 scanner                          findings=[]
C1 budget/HTTP 429                  false / none
Feature 009 owner M01/M02          NOT DISPATCHED
permanent smoke                     NOT DISPATCHED
targeted historical T               0 identities; not dispatched
```

The one dispatched C1 signup attempt consumes one rolling allowance under the R02
failure rule, although the bounded receipt reports zero successful identities. The
post-stop calculation at `2026-09-22T13:39:15+00:00` used cutoff
`2026-09-22T12:39:15+00:00`: usage `1 / 150`, headroom `149`, no active owned
browser/provider/runtime, no controlled-provider environment, and the managed
Playwright runtime removed. The bounded artifacts are retained; the diagnostic
`error-context.md` SHA-256 is
`e73015fdad67ec690e381483d5fd294d2da3cec6867139292bcfdc42c11d63aa`.

T078 remains incomplete. No retry, replacement, reset, restart-based quota
recovery, M01/M02 dispatch, smoke dispatch, or next repeatability/fresh-checkout/
final-audit recovery task was started. A future attempt must first resolve the
C1 controlled-failure artifact/cleanup failure and obtain a new fresh R02 admission.

### T078 C1 diagnosis and non-charged fix — 2026-09-22

This appendix diagnoses the retained `run-MSZTp3` failure and records only
non-charged changes. T001–T074 evidence above is historical and untouched. No
new R02 admission, browser C1 replay, M01/M02 execution, smoke execution,
repeatability/fresh-checkout/final-audit work, or Feature 010 work occurred.

#### Exact primary failure

The primary failure was an Auth/runtime environment defect: the configured local
Supabase API/GoTrue target was unavailable at `127.0.0.1:55321`. The browser and
web runtime were healthy enough for the synthetic A/B checks and application
bootstrap. C then reached `allowAnonymousSignups(1)`, navigated into the real
application bootstrap, and the Auth client attempted
`signInAnonymously()` (`POST /auth/v1/signup`) after `getSession()`.

The safe request observer counted one browser-side signup request, but the Auth
route proxy's upstream `route.fetch()` obtained no HTTP response. The retained
receipt therefore has no Auth status, no `safe-auth-success`, no HTTP 429, and
zero identities. A bounded post-run probe of the configured API and Docker
inventory showed connection refusal on `127.0.0.1:55321` and no running local
Supabase containers. The configured URL and Auth settings themselves were
consistent (`api.port=55321`, anonymous sign-ins enabled, local limit `150`).
There is no evidence that GoTrue handled the request or created a user/session;
no access/refresh token or user ID reached the harness. The retained sanitized
artifact intentionally does not preserve the raw transport exception.

C failed before the `Create Room` authenticated-UI gate and therefore never
reached credential-safety controlled failure, Auth accounting confirmation, or
capture. The `E2E_SAFE_FAILURE` at `safe-diagnostics.ts:18:1` is the fail-closed
sanitization wrapper, not the causal operation.

The reported cleanup failure was secondary. The Auth route handler marked the
diagnostics state failed; the subsequent `flush()` rejected, causing
`SafeDiagnostics.close()` to reject before the fixture could append its cleanup
receipt. Its `finally` path still attempted `unrouteAll()` and `context.close()`;
the retained safe-process receipt confirms managed web/browser finalization. Thus
the primary cause was not cleanup/accounting, and the cleanup receipt was
incomplete because the failure path was not truthfully reported.

#### Comparison with the last governing green C1

The latest governing green pre-regression C1 was the isolated T072 receipt
`run-4DeYfO`: Auth `1/1`, one user/session identity, controlled failure reached,
cleanup true, complete artifacts, scanner clean, and no 429. Its target was a
healthy isolated Supabase project on its admitted API port. The failing T078
run used the shared configured target on port `55321`, which was not listening.

The C1 test, anonymous-session implementation, Auth configuration, credential
accounting contract, and controlled-failure semantics did not change across the
post-G5 TMDB traversal work. The Feature 009 source changes are outside the C1
Auth boundary; the acceptance-only controlled provider is not used by security
C1. The relevant difference was runtime/target availability, not TMDB
traversal, product behavior, Auth rate limiting, or a new C1 identity rule.

#### Deterministic reproduction and fix

Without creating an anonymous identity, the new regression test makes the Auth
route's `fetch()` throw a synthetic connection error. It verifies: one signup
attempt is observed, no identity is recorded, no Auth success is asserted, the
failure is classified as bounded `transport`, and context teardown is recorded
as complete even though fail-closed flushing rejects. A second deterministic
test verifies that a dead/unhealthy configured Auth target stops security
execution before Playwright launch; A/B static diagnostics remain target-free.

The smallest fix was limited to the test/controller boundary:

- preflight `/auth/v1/health` before non-static security launch, with bounded
  `AUTH_TARGET_CONFIG_INVALID`, `AUTH_TARGET_UNAVAILABLE`, and
  `AUTH_TARGET_UNHEALTHY` diagnostics and no retry or sleep;
- classify Auth route outcomes as bounded transport/protocol/success/HTTP-class
  results without retaining response data; and
- record completed context teardown independently of a prior fail-closed flush
  rejection.

No credential-safety check was weakened, no Auth accounting was bypassed, no
cleanup error was ignored, and no product, database, migration, or generated
type behavior was changed.

#### Non-charged validation

```text
focused diagnostics/Auth/cleanup/scanner suite       PASS; 43 tests
Feature 007–009 profile/config checks                PASS; 24 tests
full client/config/privacy suite                     PASS; 50 suites, 843 tests
lint                                                 PASS
typecheck                                            PASS
git diff --check                                     PASS
check-only database types                            BLOCKED; local Supabase absent;
                                                     existing artifact preserved;
                                                     no types regenerated
charged R02/browser/M01/M02/smoke work              NOT RUN
```

T078 remains incomplete. The repository code is ready for one separately
admitted current-source normal checkpoint retry after the exact configured local
Supabase/GoTrue target is brought up and its health is verified non-charged.
The exact next recovery step is: verify that target and obtain a fresh R02
admission, then rerun the T078 current-source C1/owner/smoke block once under
that admission. Do not start later repeatability/fresh-checkout/final-audit
recovery work or Feature 010 here.

### T078 current-source normal checkpoint recovery — PASS — 2026-09-22

This is the bounded T078 recovery checkpoint requested after the retained
`run-MSZTp3` Auth-target failure. Historical T001–T074 receipts and their
accounting remain unchanged. The later repeatability, independent fresh-checkout,
reconciliation, and final-audit recovery is intentionally not included here.

#### Non-charged local runtime restoration and gates

The existing configured shared project was restored with the established startup
path only:

```text
npm run supabase:start                    PASS; existing otteroom-room-session stack restored
npm run env:local                          PASS; values withheld; target http://127.0.0.1:55321
startup/reset behavior                     no db reset, truncate, delete, or retained-state cleanup
GET /auth/v1/health                       PASS; HTTP 200; zero-identity preflight; no signup request
read-only counts before/after preflight   auth.users=4/4, rooms=2/2, rules=2/2; unchanged
REST /rest/v1/                            PASS; HTTP 200
Storage /storage/v1/status                PASS; HTTP 200
latest applied migration                  20260920000000; 12 migrations
Docker Supabase services                  healthy; configured Kong/API port 55321
npm run playwright:install                PASS; pinned v1.63.0 Noble runtime available
```

The preflight used only the bounded `GET /auth/v1/health` transport and proved
the configured target was the intended local project. It did not call signup or
consume an identity. The charged owner and smoke wrappers subsequently verified
Edge/provider readiness and removed their owned runtime/provider resources.

```text
focused config/runtime/privacy Jest suites  PASS; 5 suites, 92 tests
npm run test:edge                           PASS; 69 passed, 0 failed, 1 ignored live test
npm run test:client                         PASS; 50 suites, 843 tests
npm run lint                                PASS
npm run typecheck                            PASS
npm run web:export                           PASS; 5 static routes
static security browser gate               PASS; A/B only, 0 signups, 0 identities, scanner 0
selection-rule packaging                    PASS; 118 bytes, 2 assets byte-identical
npm run db:types:check                      PASS; check-only
git diff --check                            PASS
```

The generated-types artifact was unchanged across the check:

```text
SHA-256       69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
inode         11577831
size          20779 bytes
mtime         2026-09-21T11:52:27.499Z
before/after  SHA, inode, size, and mtime identical; no db:types write
```

The authoritative controller scanner reported `findings=[]` for C1, M01/M02,
and smoke; owner/smoke/static artifact scans independently reported zero findings.
The C1 PNG is approved only through the run's in-process credential registry, so a
standalone scanner without that registry is not an acceptance scan for that artifact.

#### Current-source identity and replay derivation

The current source was unchanged between the final non-charged gate, admission,
and all three charged commands. Local environment files are excluded from the
manifest.

```text
base workspace HEAD                  e55a53bbc6494691f9a9e636cfead61a29255982
source manifest scope                app, src, e2e, scripts, supabase, config,
                                     package.json, package-lock.json, playwright.config.ts
source files                         144
source path-list SHA-256             3f6512790b06794de3a5eeb0f66cc4d7dfaf3e7f7c0c467727b83a411e3f65a6
source content-manifest SHA-256      b9ad3cc14c8da65064a579c4e43b6782343417f8e5bbc22cbbba95e24f55d62d
ordered source tmdb-client.ts        3986b8247096b441792eb2de17ffb0ed7eaaf19e67952a143654cce06e445ebc
E2E owner spec                       46725a1416931abd9f66d29e4b9ad283c85896ee0ceca27eb0b0ef85be5cae9b
E2E controller                       f5bc06c59ee5585984f0425b1d2611355a47d2f5d14725765e71c436d9365a8a
canonical YAML                      3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
bundled YAML                        3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
generated types                     69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
```

The current-source profile and contract derive the complete normal checkpoint as
`C1 1 + M01 2 + M02 4 + permanent smoke 16 + targeted T 0 = 23` identities.
No targeted historical browser work was scheduled.

#### Fresh admission and charged result

The fresh authoritative admission was obtained immediately before C1:

```text
admission UTC                       2026-09-22T14:56:39.276Z
rolling cutoff UTC                  2026-09-22T13:56:39.276Z
R02 capacity                        150
current rolling usage               0
T078 reservation                    23
projected usage                     23
projected headroom                  127
unfinished markers                  0
active owned browser/provider       0
controlled provider env             absent
signup/quota probe                  none
retry/reset/restart replenishment   none
configured Auth health              HTTP 200
admitted                            true
```

Only the complete admitted block ran, in order, with fail-fast behavior:

```text
C1 command                          npm run test:e2e:security
C1 receipt                          test-results/run-eEDveG/summary.json
C1 result                           PASS; controlled C failure as designed
C1 Auth/cleanup                     success / true
C1 attempts/identities              1 / 1
C1 artifacts                        complete; controller scanner findings=[]
C1 HTTP 429/budget                  none / false

owner command                       npm run test:e2e:feature009
owner receipts                      test-results/run-8iUxkR/summary.json
M01                                 PASS; 2 signups / 2 identities
M02                                 PASS; 4 signups / 4 identities
owner Auth/cleanup                  successful / true
owner HTTP 429/budget               none / false
owner controller scanner             findings=[]; 3 files

smoke command                       npm run test:e2e:smoke
smoke receipt                       test-results/run-sIBdck/summary.json
G03/G04/G05/G08/H01                 PASS; 3/4/2/4/3 identities
smoke total                         PASS; 16 signups / 16 identities
smoke Auth/cleanup                  successful / true
smoke HTTP 429/budget               none / false
smoke controller scanner             findings=[]; 3 files
```

All managed Playwright runtimes reached `started -> ready -> finished -> removed`.
The controlled provider was stopped and its temporary environment removed after
each acceptance run. No owned browser/provider process or Playwright container
remained. The final read-only runtime check retained the configured target and
reported `auth.users=27, rooms=11, rules=11`, latest migration
`20260920000000`; no reset or cleanup was performed.

The final R02 state at `2026-09-22T15:01:47.055Z` was:

```text
rolling cutoff UTC                  2026-09-22T14:01:47.055Z
current rolling usage               23 (C1=1 + owner=6 + smoke=16)
R02 capacity                        150
headroom                            127
unfinished markers                  0
active owned browser/provider       0
controlled provider env             absent
HTTP 429/budget failure             none / false
Auth target health                  HTTP 200
T078 charged consumption            23 signup attempts / 23 identities
```

T078 is complete at this recovery boundary. Feature 009 remains REOPENED as
directed; Feature 010 remains unstarted. The exact next recovery task is the
current-source repeatability run two (T071-equivalent): obtain a new fresh R02
admission for `M01 2 + M02 4 + smoke 16 = 22` identities, run owner then smoke
once, and stop before the later independent fresh-checkout and final reconciliation
work. That task was not started here.

### T079 current-source repeatability run two (T071-equivalent) — PASS — 2026-09-22

This is the single post-T078 recovery task requested at the current-source recovery
boundary. The historical T001–T074 receipts and the successful T078 current-source
normal-checkpoint receipt remain preserved above and were not rerun or rewritten.
No C1, fresh checkout, reconciliation, final audit, Feature 010, signup probe, quota
retry, quota-oriented reset/restart, or partial charged block was started.

#### Unchanged-source proof before admission

The exact implementation/harness/config source validated by T078 was reconstructed
under the recorded manifest convention: scoped `git ls-files` paths for `app/`,
`src/`, `e2e/`, `scripts/`, `supabase/`, and `config/`, plus the two Supabase
metadata files and the root package/profile files; local environment files,
dependencies, evidence ledgers, and generated exports were excluded. The source
snapshot matched T078 exactly:

```text
base workspace HEAD                  e55a53bbc6494691f9a9e636cfead61a29255982
source files                         144
source path-list SHA-256             3f6512790b06794de3a5eeb0f66cc4d7dfaf3e7f7c0c467727b83a411e3f65a6
source content-manifest SHA-256      b9ad3cc14c8da65064a579c4e43b6782343417f8e5bbc22cbbba95e24f55d62d
ordered source tmdb-client.ts        3986b8247096b441792eb2de17ffb0ed7eaaf19e67952a143654cce06e445ebc
E2E owner spec                       46725a1416931abd9f66d29e4b9ad283c85896ee0ceca27eb0b0ef85be5cae9b
E2E controller                       f5bc06c59ee5585984f0425b1d2611355a47d2f5d14725765e71c436d9365a8a
canonical YAML                      3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
bundled YAML                        3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
generated types                     69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
migrations manifest                 e10765248d9d677d0e5ba9f87cd9a5c6599ed38893908e2c566cebeb3fe1e5fd (12 files)
E2E/profile manifest                9d799eb80ef96084562794882e775103e145d9d952e358a12a02d0d860eb5ab9 (26 files)
runtime/profile manifest            4dd3e6c8a8b92577ba5524b3a14df8ebd5cfa35517b4fa544266d41f7025b813 (6 files)
max relevant source mtime           2026-09-22T14:09:28.244Z
T078 completion boundary            2026-09-22T15:01:47.055Z
```

The ordered TMDB traversal, YAML, all migrations, generated types, E2E owner
harness/profile, and runtime/profile configuration therefore remained unchanged
after the successful T078 checkpoint and throughout this run. The canonical and
bundled YAML bytes were equal. The post-run manifest and all listed artifact hashes
remained identical.

#### Fresh authoritative R02 admission

The complete repeatability block was admitted immediately before charged dispatch:

```text
admission UTC                       2026-09-22T15:34:54.874Z
rolling cutoff UTC                  2026-09-22T14:34:54.874Z
R02 capacity                        150
current rolling usage               23 (T078 C1=1 + owner=6 + smoke=16)
T079 reservation                    22 (M01 2 + M02 4 + smoke 16)
projected usage                     45
projected headroom                  105
unfinished run markers              0
active owned browser/provider       0
controlled provider env             absent
configured Auth health              HTTP 200
configured REST root                HTTP 200
configured Storage status           HTTP 200
signup/quota probe                  none
retry/reset/restart replenishment   none
admitted                            true
```

#### Charged execution and required check-only gate

The admitted block ran once per command in fail-fast order: owner first, then smoke
only after owner passed. C1 was not rerun.

```text
owner command                       npm run test:e2e:feature009
owner receipt                       test-results/run-efKt5o/summary.json
M01                                 PASS; 2 signups / 2 identities
M02                                 PASS; 4 signups / 4 identities
owner Auth/cleanup                  successful / true
owner controller scanner             3 files; findings=[]
owner HTTP 429/budget               none / false

smoke command                       npm run test:e2e:smoke
smoke receipt                       test-results/run-lcqwMP/summary.json
G03/G04/G05/G08/H01                 PASS; 3/4/2/4/3 identities
smoke total                         PASS; 16 signups / 16 identities
smoke Auth/cleanup                  successful / true
smoke controller scanner             3 files; findings=[]
smoke HTTP 429/budget               none / false

post-run gate                       npm run db:types:check
post-run gate result                PASS; src/types/database.generated.ts consistent
generated-types write               none
```

Both managed Playwright runtimes reached `started -> ready -> finished -> removed`;
the controlled provider stopped and its temporary environment was removed after
each command. No owned browser/provider process, container, environment, or active
run marker remained. The final read-only runtime check retained the configured
target and reported `auth.users=49, rooms=20, rules=20`, latest migration
`20260920000000`. No database reset or cleanup was performed.

The generated-types artifact remained byte-identical through the charged block and
the required check-only gate:

```text
SHA-256       69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
inode         11577831
size          20779 bytes
mtime         2026-09-21T11:52:27.500Z
```

#### T079 accounting and recovery boundary

Exact T079 identity consumption was `6 + 16 = 22`. The current-source normative
repeatability certification is:

```text
T078 current-source normal checkpoint       23 identities
T079 current-source repeatability run two   22 identities
current-source normative repeatability      23 + 22 = 45 identities
```

Historical T001–T074 accounting, including all failed, partial, diagnostic, manual,
replacement, and earlier normative receipts, remains separate and unchanged. The
preserved recovery ledger records historical T070 consumption of 41 identities,
the historical T071 block of 22, and historical T072 charged consumption of 33;
those figures are not merged into the current-source certification. The new T079
receipts are likewise not treated as historical failure/retry evidence.

Final R02 state at `2026-09-22T15:39:33.810Z`:

```text
rolling cutoff UTC                  2026-09-22T14:39:33.810Z
current rolling usage               45 (T078=23 + T079=22)
R02 capacity                        150
headroom                            105
unfinished run markers              0
active owned browser/provider       0
controlled provider env             absent
HTTP 429/budget failure             none / false
Auth target health                  HTTP 200
REST/Storage health                 HTTP 200 / HTTP 200
T079 charged consumption            22 signup attempts / 22 identities
```

T079 is complete at this recovery boundary. Feature 009 remains REOPENED as
directed; Feature 010 remains unstarted. The exact next recovery task is the
current-source fresh-checkout recovery (T072-equivalent), which is separate and
was not started here. Reconciliation and final-audit recovery remain later tasks.

### T080 current-source fresh-checkout recovery (T072-equivalent) — PASS — 2026-09-22

This is the exact next recovery task after T079. Historical T001–T074 evidence,
the T078 current-source normal checkpoint, and the T079 current-source
repeatability receipt remain preserved and unchanged. No Feature 009 owner M01/M02,
reconciliation, final audit, Feature 010, signup probe, quota retry, partial
admission, or charged retry was run in T080.

#### Exact source candidate and clean-checkout proof

The current implementation was reconstructed from the workspace HEAD plus its
current source/harness diff and allowed untracked implementation files in an
independent disposable Git checkout. Feature 009 evidence/spec files were not
copied. The candidate was committed inside that disposable repository and was
clean before install:

```text
base workspace HEAD                  e55a53bbc6494691f9a9e636cfead61a29255982
disposable candidate commit          b25871b85e01ef6260f286d6f064036910f0a9ce
disposable candidate tree            5f561aa323499846af9a4ed6ec5b6e1451cfe9ef
checkout                             /tmp/otteroom-feature009-fresh.ml5che/checkout
checkout status before install      clean
Feature 009 evidence/spec copy       absent
pre-install .env/runtime state      absent; no node_modules, build, export,
                                     browser, database, Auth or test-receipt state
```

The established current-source manifest convention covers the scoped application,
test/runtime and configuration source plus the two Supabase metadata paths. Fresh
checkout setup recreated equivalent checkout-owned metadata for those paths; no
workspace cache, environment, database volume, Auth state or browser state was
copied. The checkout content matched the current workspace exactly:

```text
manifest files                       144
path-list SHA-256                    3f6512790b06794de3a5eeb0f66cc4d7dfaf3e7f7c0c467727b83a411e3f65a6
content-manifest SHA-256             b9ad3cc14c8da65064a579c4e43b6782343417f8e5bbc22cbbba95e24f55d62d
ordered tmdb-client.ts               3986b8247096b441792eb2de17ffb0ed7eaaf19e67952a143654cce06e445ebc
E2E owner spec                        46725a1416931abd9f66d29e4b9ad283c85896ee0ceca27eb0b0ef85be5cae9b
E2E controller                        f5bc06c59ee5585984f0425b1d2611355a47d2f5d14725765e71c436d9365a8a
canonical/bundled YAML                3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
generated database types              69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
checkout source status after setup   clean (ignored owned runtime state only)
```

The known managed-home Supabase telemetry probe was rejected by the read-only home
directory; all authoritative CLI work used the repository-safe writable XDG path
with telemetry disabled. Node/npm were observed as `v24.12.0 / 11.6.2` against the
declared `24.20.0 / npm@11.19.0`; Deno was `2.5.2`, Supabase CLI `2.116.0`, and
Playwright `1.63.0`.

#### Owned isolated runtime and precondition

The checkout used the corrected dynamic isolation tooling. No command in the
charged block resolved the shared development container:

```text
owned project                         otteroom-t072-kqm4qp-19aa
owned workdir                         /tmp/otteroom-t072-supabase-KqM4qp
dynamic API/database base             56000 / 56001
owned database container              supabase_db_otteroom-t072-kqm4qp-19aa
owned network/volume                  supabase_network_otteroom-t072-kqm4qp-19aa /
                                      supabase_db_otteroom-t072-kqm4qp-19aa
pre-migration rooms/auth/rules        0 / 0 / 0
fresh migration baseline              12 applied; latest 20260920000000
owned fixture rows                    0
shared container collision            none
```

All direct E2E database access resolved through `localSupabaseContainer()`; no
hard-coded `otteroom-room-session` container remained in the charged path. The
fresh checkout created only a mode-600 credentials-only `.env.local` containing
the two public Supabase fields. The owned runtime was stopped and removed with the
project-specific cleanup path; its containers, network, volume and runtime
directory were absent afterward.

#### Fresh non-charged validation

The complete non-charged block was green before admission:

```text
npm ci                                PASS; 1116 packages added, 1117 audited
Playwright setup                      PASS; v1.63.0 Noble image prepared
selection YAML packaging              PASS; 118 bytes, 2 assets byte-identical,
                                      client-inclusion=false, env-overrides=false
seven protected migration runners     PASS; latest reset/owned fixtures=0;
                                      historical migrations and types unchanged;
                                      no TMDB/GoTrue/type-generation calls
clean reset                           PASS; 0 rooms / 0 Auth users / 0 rules;
                                      all 12 migrations through 20260920000000
database suite                        PASS; 8 files, 933 tests
Edge suite                            PASS; 69 passed, 0 failed, 1 ignored live test
live TMDB v3 contract                 PASS
ordered traversal/terminal path       PASS; post-G5 broad-range matrix green;
                                      sequence-2 completed-empty path identities=0
client/config/static/privacy suite    PASS; 50 suites, 843 tests
artifact scan before browser          PASS; fileCount=0, findings=[]
db:types:check                        PASS before/after charged block; no write;
                                      hash 69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
                                      inode/size/mtime unchanged through checks
lint                                  PASS
typecheck                             PASS
web export                            PASS; 5 static routes
iOS/Android exports                  NOT APPLICABLE; no native export scripts/directories
git diff --check                      PASS
```

The generated database type artifact remained byte-identical at `20,779` bytes;
no `db:types` write was run. The terminal-path check used Deno and exercised the
controlled provider, real source/Edge handler, service-role RPC boundary and local
PostgreSQL without identities. The live TMDB credential was used only in process
memory and was not copied into the checkout or receipts.

#### Fresh R02 admission and charged block

After the complete green non-charged block, a fresh authoritative admission was
obtained immediately before dispatch:

```text
admission UTC                       2026-09-22T16:18:46.267Z
rolling cutoff UTC                  2026-09-22T15:18:46.000Z
R02 capacity                        150
current current-source usage        45 (T078=23 + T079=22)
fresh reservation                   17 (C1=1 + permanent smoke=16)
projected usage                     62
projected headroom                  88
unfinished markers                  0
active owned browser/provider       0
controlled provider env             absent
Auth/REST health                    HTTP 200 / HTTP 200
signup/quota probe                  none
admitted                            true
```

Only the complete admitted block ran, fail-fast and exactly once:

```text
C1 command/receipt                  npm run test:e2e:security / run-38j4MO
C1 result                           PASS; controlled failure by contract
C1 Auth/cleanup                     true / true
C1 signups/identities               1 / 1
C1 artifacts/scanner                complete / findings=[]
C1 HTTP 429/budget                  none / false

permanent smoke command/receipt     npm run test:e2e:smoke / run-fzO9q7
G03/G04/G05/G08/H01                 PASS; 3 + 4 + 2 + 4 + 3 = 16 identities
smoke Auth/cleanup                   true for all five cases
smoke scanner/HTTP 429/budget        3 files, findings=[] / none / false
```

Safe summary receipts were preserved at
`test-results/recovery-t080-fresh-checkout/`; no raw credential, browser state or
unapproved C1 capture was copied. No charged command was retried or replaced.

#### Accounting, final state and cleanup

The fresh block consumed exactly `1 + 16 = 17` identities. Combined current-source
certification is:

```text
T078 current-source normal checkpoint        23
T079 current-source repeatability run two    22
current-source repeatability                 23 + 22 = 45
T080 fresh checkout                          17
current-source combined                      45 + 17 = 62
```

Final R02 state was `62 / 150`, headroom `88`, with no HTTP 429 or budget failure.
The fresh owned database contained `auth.users=17`, `rooms=6`, and
`room_selection_rules=6` immediately before owned teardown. Browser/provider
runtimes, temporary provider environment, checkout, dependencies, exports,
receipts not explicitly preserved above, owned runtime, cache and config were
removed; owned containers, network and volume were `0/0/0` after cleanup.

The shared development stack was read before and after the task and remained
unchanged: container ID
`87870a2260acafbcc4fb7046e792d9fa518b551aba1d73e88a2179109211499b`, project
`otteroom-room-session`, workdir `/home/otter/Projects/otteroom`, volume
`supabase_db_otteroom-room-session`, and counts/latest
`49/20/20/20260920000000`.

T080 is complete. Feature 009 remains **REOPENED** as directed. The exact next
recovery task is the current-source reconciliation recovery (T073-equivalent);
final audit recovery remains after that. Feature 010 remains unstarted. No
reconciliation or final G5 recovery was started.

### T081 current-source reconciliation recovery (T073-equivalent) — PASS — 2026-09-22

This is the exact next recovery task after T080. Historical T001–T074 receipts and
all failed, partial, diagnostic, manual, and replacement recovery attempts remain
preserved and separate from the current-source normative certification. T078,
T079, and T080 are the governing current-source normal, unchanged-source
repeatability, and independent fresh-checkout evidence. No browser test, R02
admission, Auth signup/probe, database reset, provider call, charged retry, or
Feature 010 work was performed for T081.

#### Current-source normative formulas and inventory

The reconciled current-source formulas are:

```text
normal checkpoint / T078              C1 1 + smoke 16 + owner 6 + T 0 = 23
additional repeatability / T079       smoke 16 + owner 6 = 22
cumulative repeatability              23 + 22 = 45
fresh checkout / T080                 C1 1 + smoke 16 = 17
repeatability plus fresh checkout     45 + 17 = 62
```

The acceptance inventory was checked from the repository configuration and tests,
not copied from historical prose:

```text
M01                                  2 identities
M02                                  4 identities
owner acceptance                    2 + 4 = 6 identities
permanent smoke                     G03/G04/G05/G08/H01 = 5 cases / 16 identities
C1 security probe                   separate controlled probe = 1 identity
Feature 008 full boundary           46 cases / 112 identities
Feature 009 additive profile        2 cases / 6 identities
current full acceptance             48 cases / 118 identities
current full acceptance plus C1     119 identities
```

The full runner's fixed Feature 008 map remains 46 cases and 112 identities; the
current `feature009Cases` map contains exactly M01=2 and M02=4, and the profile
test discovers exactly those two additive cases with exact receipt validation.
The post-G5 traversal correction changed candidate traversal only and did not
change acceptance discovery, case caps, smoke composition, or C1. Therefore the
existing normative inventory remains truthful.

#### Reconciled implementation identity and manifests

T078, T079, and T080 identify the same current implementation. T078/T079 used
workspace HEAD `e55a53bbc6494691f9a9e636cfead61a29255982` with the 144-file
current-source manifest; T080 reconstructed that source in an independent
checkout, committed candidate `b25871b85e01ef6260f286d6f064036910f0a9ce` with
tree `5f561aa323499846af9a4ed6ec5b6e1451cfe9ef`, and proved the checkout matched
the workspace source.

```text
source files                         144
path-list SHA-256                    3f6512790b06794de3a5eeb0f66cc4d7dfaf3e7f7c0c467727b83a411e3f65a6
content-manifest SHA-256             b9ad3cc14c8da65064a579c4e43b6782343417f8e5bbc22cbbba95e24f55d62d
ordered tmdb-client.ts               3986b8247096b441792eb2de17ffb0ed7eaaf19e67952a143654cce06e445ebc
E2E owner spec                        46725a1416931abd9f66d29e4b9ad283c85896ee0ceca27eb0b0ef85be5cae9b
E2E controller                       f5bc06c59ee5585984f0425b1d2611355a47d2f5d14725765e71c436d9365a8a
canonical/bundled YAML               3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
generated database types             69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
T079 migration manifest              e10765248d9d677d0e5ba9f87cd9a5c6599ed38893908e2c566cebeb3fe1e5fd (12 files)
T079 E2E/profile manifest            9d799eb80ef96084562794882e775103e145d9d952e358a12a02d0d860eb5ab9 (26 files)
T079 runtime/profile manifest        4dd3e6c8a8b92577ba5524b3a14df8ebd5cfa35517b4fa544266d41f7025b813 (6 files)
```

The current workspace recomputation produced the recorded 144-file path/content
hashes and key-file hashes. The canonical YAML and bundled asset are byte-identical;
the generated type hash is unchanged; and the T079 migration, E2E/profile, and
runtime/profile sub-manifests remained equal to T078 before and after the charged
run. These checks reconcile the normal, repeatability, and fresh-checkout source
identities without treating evidence files or runtime state as implementation.

#### Governing evidence separation and consistency

- T078/T079/T080 are the only current-source normative charged certification:
  respectively `23`, `22`, and `17`, combined as `62`. Each receipt records the
  required admission, safe profile, Auth success, scanner zero, owned cleanup, and
  no HTTP 429/budget failure.
- Historical T001–T074 receipts remain immutable historical evidence. Their failed,
  partial, diagnostic, manual, replacement, and earlier normative accounting is
  not merged into `23/22/45/17/62`.
- No unfinished charged run or active owned browser/provider runtime remains;
  T080's owned checkout/runtime/config resources were removed. The governing
  receipts report green scanner/Auth/cleanup state and no HTTP 429.
- T063 remains the sole generated-types write. T064 and the T071 recovery used
  check-only validation; T078, T079, and T080's generated-types gates were also
  check-only. The canonical generated artifact remained byte-identical.
  All historical migrations remain protected, and the single Feature 009 migration
  remains the only new migration.
- T075–T077 explicitly preserve the post-G5 numeric traversal regression,
  correction, and non-charged recovery gate; T078–T080 certify that current source
  through fresh checkout. Feature 010/Match behavior remains out of scope and
  unstarted.

T081 static reconciliation validation:

```text
npx jest --runInBand __tests__/config/feature008-e2e-profile.test.ts \
  __tests__/config/feature009-e2e-profile.test.ts \
  __tests__/config/feature009-boundaries.test.ts       PASS; 3 suites, 22 tests
node scripts/check-selection-rules-config.mjs           PASS; 118 bytes, 2 assets byte-identical
npm run db:types:check                                 PASS; consistent; no write
node scripts/check-e2e-artifacts.mjs test-results/\
  recovery-t080-fresh-checkout                         PASS; 2 files, 0 findings
git diff --check                                       PASS
browser tests / R02 admission                         NOT RUN
```

T081 is complete. Feature 009 remains **REOPENED** pending the final current-source
G5 audit. Feature 010 remains unstarted. The exact next recovery task is T082,
the final current-source G5 audit (T074-equivalent); it was not started here.

### T082 final current-source G5 audit — PASS — 2026-09-22

T082 is the exact final current-source audit requested after T081. It was a
read-only/static audit and did not run a browser test, R02 admission, anonymous
Auth action, acceptance workflow, provider call, database reset, migration runner,
generated-types write, charged retry, or Feature 010 work. Historical T001–T074
receipts and all failed, partial, diagnostic, manual, and replacement recovery
attempts remain preserved and separate from the current-source certification.

#### Certified current-source identity

The current source was independently recomputed under the T078–T080 manifest
convention: tracked plus allowed untracked files in `app/`, `src/`, `e2e/`,
`scripts/`, `supabase/`, and `config/`, plus the two Supabase metadata paths;
local environment state, dependencies, evidence ledgers and generated exports were
excluded. The result matches all three governing recovery receipts:

```text
workspace HEAD                         e55a53bbc6494691f9a9e636cfead61a29255982
manifest files                         144
path-list SHA-256                      3f6512790b06794de3a5eeb0f66cc4d7dfaf3e7f7c0c467727b83a411e3f65a6
content-manifest SHA-256               b9ad3cc14c8da65064a579c4e43b6782343417f8e5bbc22cbbba95e24f55d62d
ordered tmdb-client.ts                 3986b8247096b441792eb2de17ffb0ed7eaaf19e67952a143654cce06e445ebc
canonical/bundled YAML SHA-256         3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
generated database types SHA-256       69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
T080 candidate commit                   b25871b85e01ef6260f286d6f064036910f0a9ce
T080 candidate tree                    5f561aa323499846af9a4ed6ec5b6e1451cfe9ef
Feature 009 migration SHA-256          457894026e6fe483e98248a1f8f4a04942a129092b62c08e7e183a1e096f0f7b
```

T080 proved the candidate commit/tree matched this source in an independent clean
checkout.

#### G5 traceability and regression audit

The current implementation and evidence reconcile all requirements without
invalidating a prior contract:

```text
functional requirements                    40 / 40
non-functional requirements                 9 / 9
success criteria                           11 / 11
acceptance scenarios                       43 / 43
user stories                                6 / 6
```

The post-G5 regression is resolved in the current traversal. Configured numeric
orders use the provider-sorted broad range and locally validate every inspected
row. The first eligible row establishes a provably highest eligible primary value;
later lower-ranked pages are not exhaustively visited once a lower primary closes
the complete equal-primary run. The run continues across page boundaries and the
smaller TMDB ID is used as the deterministic secondary tie-breaker. Ineligible,
excluded and already-used candidates are skipped without weakening the local
predicate. Required metric defects, ordering defects, pagination defects, provider
failure, deadline and request-budget failure remain `search_incomplete`; only a
complete error-free traversal can return `completed_empty`. A required incomplete
child shard propagates incompleteness. Numeric overflow above 500 pages falls back
to deterministic non-overlapping date sharding when proof requires it, while
`title_asc` remains exhaustive. The defaults remain the original 100 requests and
20 seconds; no budget increase was used.

The T075 controlled 120-page regression and its supplemental live exact-filter
evidence are reconciled with this source: the old exhaustive traversal exhausted
the 100-request budget even though the page-one global winner was already
provable, while the corrected traversal returns the winner with proof before that
budget. No charged rerun was required or performed. Feature 006 remains the sole
candidate source, and Feature 008 prepare/search/expected-sequence CAS, complete
occurrence history, no-repeat, stale/retry/concurrency and source-failure-versus-
authoritative-exhaustion behavior remain intact. Ordering and provider pushdown
never replace authoritative local eligibility checks; all four configured orders
and OR/AND voter-filter semantics remain supported.

#### Configuration, snapshot and authority audit

- `config/selection-rules.yaml` remains the sole canonical server-only YAML:
  `vote_count_desc`, `minimum_vote_count=500`, omitted minimum average rating,
  `en-US`, genre `or`, exact `2/3`.
- Strict startup parsing, safe diagnostics, bundle identity, restart-only
  activation and no environment/request override remain intact. There is no hot
  reload, configuration UI or runtime configuration service.
- New rooms receive one immutable configured snapshot atomically with room and
  creator membership; pre-009 rooms retain the explicit
  `legacy_005_006_008` tuple. Direct authenticated room creation remains retired.
- Feature 006 remains the sole candidate source. Snapshot-only consumers, local
  eligibility, Feature 008 sequencing/CAS, no-repeat and metadata-language
  behavior remain authoritative. Source failure and true exhaustion remain
  distinct.
- Agreement remains full-set only: N=2 requires 2/2; N>=3 uses exact integer
  ceiling arithmetic `((N*p)+q-1)/q`, with no floating point and no early
  resolution.

#### Migration, types and dependency integrity

There are exactly 11 historical migrations through Feature 008 and exactly one
Feature 009 migration. A static byte comparison against `HEAD` found every
historical migration unchanged. The generated database types retain the certified
hash above; T063 remains the sole legitimate generated-types write and every later
check was check-only. T082 introduced no schema/type write. The package and lock
file agree on the sole approved dependency addition, pinned `yaml@2.9.0`; lockfile
version and installed identity are consistent. The current Feature 009 migration
is present but remains uncommitted, as required by the no-commit boundary.

#### Current-source charged evidence reconciliation

T078, T079 and T080 are the governing current-source charged evidence and refer to
the same implementation identity:

```text
normal checkpoint                         23 identities
additional unchanged-source repeatability 22 identities
current-source repeatability              23 + 22 = 45 identities
fresh checkout                            17 identities
repeatability plus fresh checkout         45 + 17 = 62 identities
M01 / M02 owner acceptance                 2 / 4 identities; 6 total
permanent smoke                            5 cases / 16 identities
full acceptance                           48 cases / 118 identities
full acceptance plus C1                   119 identities
```

Historical T001–T074 evidence and all failed/diagnostic recovery accounting remain
separate and were not rewritten or folded into `23/22/45/17/62`. The governing
receipts report fresh admission, scanner/Auth/cleanup green state, no HTTP 429 or
budget failure, and no unfinished charged run. T082 itself used no identities.

#### Static checks and cleanup

```text
7 config/traceability Jest suites             PASS; 96 tests
source/manifest/hash reconciliation           PASS; 144 files; hashes match
historical migration protection               PASS; 11 files byte-identical
node scripts/check-selection-rules-config.mjs PASS; 118 bytes; 2 identical assets
npm run db:types:check                        PASS; no write
YAML/package/lock identity                    PASS; yaml@2.9.0
npm run lint                                  PASS
npm run typecheck                             PASS
artifact/privacy scan                         PASS; 2 files; 0 findings
git diff --check                              PASS
charged browser/R02/Auth/acceptance work     NOT RUN
```

The inactive disposable checkout found under `/tmp/otteroom-feature009-fresh.*`
was an owned recovery artifact and was removed. No owned browser, provider,
disposable checkout, runtime, cache or credential environment remains. The shared
development stack was not owned by T082 and was not mutated. No commit, tag or push
was performed.

#### Final G5 verdict and scope boundary

T082 **PASSES**. Feature 009 is now **COMPLETE** and T075–T082 are complete. No
Feature 010/Match behavior, early resolution, configuration UI, hot reload,
decision editing, dynamic membership expansion, alternate candidate source,
automatic rule weakening or randomization was introduced. Feature 010 remains
PLANNED and unstarted; the exact next repository state is the completed Feature
009 release boundary with Feature 010 still blocked until a separately authorized
future task begins it.

### T083–T086 post-G5 numeric-order recovery 2 — 2026-09-23

The T075–T082 receipts above are preserved unchanged as evidence for their
respective source identities. A new live manual scenario reopened Feature 009 again;
this append is the governing recovery record for the current source. No charged
browser test, R02 admission, Auth signup, Feature 010 work, YAML/cutoff/genre
semantic change, migration change, or generated-types write occurred.

#### Bounded live reproduction and exact eligible set

The available local TMDB read credential was used only in a direct non-Auth bounded
Discover read. The credential and unrestricted provider payload were not emitted.
The application-equivalent query was:

```text
language=en-US
include_adult=false
include_video=false
primary_release_date.gte=1900-01-01
primary_release_date.lte=2026-12-31
vote_count.gte=500
sort_by=vote_count.desc
with_genres=80              # smallest provider driver; local clauses remain 80 AND 35 AND 878
```

The query reported `total_pages=66`, `total_results=1303`; all 66 pages and 1303
raw rows were inspected once for the bounded evidence. Applying the authoritative
local predicate `adult=false`, year `1900..2026`, `vote_count>=500`, and genre
overlap with every clause `[80]`, `[35]`, `[878]` produced exactly four matches:

| Provider page/index | TMDB ID | Title | vote_count |
| --- | ---: | --- | ---: |
| 1 / 18 | 20352 | Despicable Me | 16398 |
| 10 / 16 | 438148 | Minions: The Rise of Gru | 4184 |
| 36 / 12 | 84329 | Robot & Frank | 1199 |
| 61 / 9 | 581997 | Batman vs Teenage Mutant Ninja Turtles | 571 |

Therefore the actual current `vote_count.desc` order is Despicable Me, Minions:
The Rise of Gru, Robot & Frank, Batman vs Teenage Mutant Ninja Turtles.

#### Root cause

With exclusions `[20352, 438148]`, the current implementation requested pages 1–10
and returned:

```text
failure=ordering_inconsistent
page=10 index=10 previous_primary=4279 current_primary=4280
```

The exact old predicate was the per-row check in `numericShard`:

```text
if (lastPrimary !== null && primary > lastPrimary)
  return search_incomplete(ordering_inconsistent)
```

TMDB returned a non-monotonic primary sequence even under `sort_by=vote_count.desc`;
the two values above were in the same provider page, so this was not a local
secondary TMDB-ID tie, duplicate suppression, parse failure, exclusion comparison,
or a page-number/total inconsistency. The regression row was locally ineligible,
but the old implementation aborted before inspecting the remaining eligible rows.
The full bounded read observed nine such primary increases; representative safe
evidence included page 16 `2807 -> 2808`, page 20 `2274 -> 2275`, page 49
`784 -> 786`, and page 63 `538 -> 539`. The live source is therefore not an immutable strictly
monotonic snapshot suitable for an immediate fatal check.

#### Controlled regression and source correction

The controlled provider now includes four eligible candidates, with the first two
excluded, a non-eligible primary regression before candidates three and four,
reverse/random equal-primary IDs across a page boundary, an excluded member inside
a tie, duplicate provider records, and a bounded incomplete case. Before the source
change, the four-candidate test failed at the third step with
`ordering_inconsistent`; after the change it selects candidates 3 and 4 and then
returns `completed_empty`. The matrix covers `vote_count_desc`,
`average_rating_desc`, and `popularity_desc`.

The exact source fix is confined to `supabase/functions/_shared/tmdb-client.ts` and
its ordered-source test/contract evidence:

- detect a primary increase but mark the provider prefix proof invalid instead of
  aborting;
- continue the same serial provider traversal without retrying or increasing the
  100-request/20-second budgets;
- compare every eligible, unseen row with the local total comparator, including the
  smaller-TMDB-ID tie-break;
- return the local winner or completed empty only after the bounded traversal and raw
  pagination accounting complete; and
- preserve concrete `request_budget`, `deadline`, provider, parse, required-metric,
  pagination, and shard failures as incomplete.

When the primary sequence is monotonic, the existing prefix proof remains fast. When
it regresses, correctness is proven by complete traversal; if that traversal cannot
finish, the concrete failure remains incomplete rather than being converted to
exhaustion. Genre semantics, cutoff 500, local eligibility, exclusions, CAS,
no-repeat history, and all other Feature 008 behavior are unchanged.

#### Supplemental live five-step verification

Using the same bounded direct TMDB read and successive server-style exclusions, the
current source produced:

```text
excluded_count=0  requests=1   match id=20352  title=Despicable Me                         vote_count=16398
excluded_count=1  requests=66  match id=438148 title=Minions: The Rise of Gru             vote_count=4184
excluded_count=2  requests=66  match id=84329  title=Robot & Frank                        vote_count=1199
excluded_count=3  requests=66  match id=581997 title=Batman vs Teenage Mutant Ninja Turtles vote_count=571
excluded_count=4  requests=66  completed_empty
```

Regression-affected attempts traversed the complete 66-page bounded result and
returned no `ordering_inconsistent`; no provider call was retried by the recovery
runner. This was supplemental non-Auth verification only, not browser or R02
acceptance.

#### Non-charged validation receipt

```text
focused ordered-source suite                  PASS; 32 tests
full Edge suite                               PASS; 73 passed, 0 failed, 1 ignored live test
full client Jest suite                        PASS; 50 suites, 843 tests
clean full database matrix                    PASS; 8 files, 933 tests
seven protected migration guards              PASS; historical/type/TMDB/GoTrue protections green
check-only database types                     PASS; generated artifact unchanged
selection-rule YAML/package check             PASS; 118 bytes, 2 identical assets
artifact/privacy scanner                      PASS; 4 files, 0 findings
npm run lint                                  PASS
npm run typecheck                             PASS
git diff --check                              PASS after recovery implementation and ledger append
charged browser/R02/Auth acceptance           NOT RUN by instruction
Feature 010                                    NOT STARTED
```

The first database invocation was intentionally not treated as evidence because a
stale local fixture state caused four count mismatches. A normal local `db:reset`
was then run, followed by the green matrix above. No schema changed. The check-only
type command remained the only type command; no `db:types` write was run.

#### Recovery impact and stop boundary

The historical T070–T074 receipts remain historical and unchanged. The prior
T075–T076 traversal correction is superseded by this current-source correction, and
the exact current-source gates invalidated by this source change are:

- T077-equivalent current-source non-charged recovery gate;
- T078-equivalent normal current-source C1/owner/smoke acceptance;
- T079-equivalent unchanged-source repeatability run two;
- T080-equivalent independent fresh-checkout certification;
- T081-equivalent current-source testing-strategy/recovery reconciliation; and
- T082-equivalent final current-source G5 audit.

Their old receipts remain valid historical records for the old source identities but
do not certify this new `tmdb-client.ts`. Feature 009 remains **REOPENED**. The exact
next recovery task is the new T087 current-source deterministic T077-equivalent gate;
only after it is green may a separately admitted R02 T078-equivalent charged block
be considered. Feature 010 remains unstarted.

### T087 current-source deterministic certification — PASS — 2026-09-23

T087 reran the current-source deterministic T077-equivalent gate after the T083–T086
numeric-primary correction. Historical T001–T086 receipts remain preserved for their
tested source identities, including the earlier T078/T079/T080 charged certification,
T081/T082 reconciliation/audit, and the T086 supplemental live five-step evidence.
This gate did not obtain R02 admission, run C1, run M01/M02, run permanent smoke,
run charged browser acceptance, regenerate types, change schema/RPC/YAML behavior,
or start Feature 010. Feature 009 remains **REOPENED**.

#### Exact current source identity and manifest

The certified source was the dirty workspace source at HEAD plus the allowed current
implementation/test/configuration files. The manifest is reproducible as the sorted
output of `git ls-files -co --exclude-standard --` over the following explicit scope:
`app`, `src`, `e2e`, `scripts`, `supabase`, `config`, `app.json`, `package.json`,
`package-lock.json`, `playwright.config.ts`, and `tsconfig.json`. Evidence ledgers,
specifications, `docs/`, dependencies, environment files, generated exports, and
runtime/test-result directories are excluded.

```text
workspace HEAD                         e55a53bbc6494691f9a9e636cfead61a29255982
manifest files                         144
path-list SHA-256                      b7e2ca13cf82fb08ca726f6f6dd5667bb7a4f17d7f27eb6b433b55cc9428b3d8
content-manifest SHA-256               5852542b5ec96b45195e2f10118b513115bc8ddd1ad25a1e2dc11d4eb701144d
ordered tmdb-client.ts SHA-256         58e857cff03e76b24d5e6bf187e5e0477e109c173268cadefdfae48a45a9812c
canonical/bundled YAML SHA-256         3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
Feature 009 migration SHA-256          457894026e6fe483e98248a1f8f4a04942a129092b62c08e7e183a1e096f0f7b
generated database types SHA-256       69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
```

The path-list digest is SHA-256 of the sorted relative paths joined by LF with a
final LF. The content-manifest digest is SHA-256 of sorted `<file SHA-256> two
spaces <relative path>` lines with a final LF. The canonical and bundled YAML are
118 bytes and byte-identical. The current source hash differs from the prior
T078–T082 identity solely because the post-G5 traversal recovery source is now
included; the prior manifests and receipts are not rewritten.

#### Deterministic traversal and regression results

```text
focused ordered-source + room-candidate suites   PASS; 32 + 19 = 51 tests
full Edge suite                                   PASS; 73 passed, 0 failed, 1 ignored
                                                     (credentialed live-contract test)
```

The controlled four-candidate equivalent passed exactly as bounded by the source
tests: with provider IDs 101/102/103/104 (`First`/`Second`/`Third`/`Fourth`), the
first candidate was reachable; excluding the first reached the second; excluding
the first two reached the third; excluding the first three reached the fourth; and
excluding all four returned `completed_empty`. The pages also contained locally
ineligible rows before candidates three and four, so the regression path proved
continuation rather than fatal ordering abort. The same matrix proves duplicate
provider rows are evaluated once, exclusions are server-derived and never repeated,
equal-primary runs cross page boundaries, provider ID order does not override the
smaller-ID deterministic tie break, and a provider primary regression continues
through complete traversal.

The ordered-source matrix additionally passed:

- numeric prefix proof and complete traversal fallback after a primary regression;
- `vote_count_desc`, `average_rating_desc`, and `popularity_desc` winner selection;
- locally ineligible leaders, exclusions, duplicate rows, equal-primary runs and
  page-boundary ties;
- concrete required-metric, provider, pagination, ordering, request-budget and
  deadline failures as `search_incomplete`;
- `completed_empty` only after a complete error-free traversal;
- >500-page deterministic sharding, including fast-path numeric winners and the
  exhaustive empty proof; and
- exhaustive `title_asc` behavior unchanged.

Feature 008 compatibility remained green in the Edge and PostgreSQL evidence:
prepare/search/expected-sequence CAS, ordered no-repeat occurrence history, stale
and retry/concurrency winner adoption, assigned metadata recovery, and exhaustion
versus source-incomplete semantics were all exercised by the full room-candidate and
database suites. No RPC/public shape or schema changed.

#### Full deterministic validation receipt

```text
clean isolated Supabase runtime/reset              PASS; owned runtime removed
clean latest reset + database suite                PASS; 8 files, 933 tests
protected migration validators                     PASS; all seven; latest-reset=true;
                                                     owned-fixtures=0
  room membership                                 PASS; historical/type unchanged
  participant filters                             PASS; historical/type unchanged
  common filter resolution                        PASS; historical/type unchanged
  TMDB candidate source                           PASS; historical/type unchanged
  swipe decisions                                 PASS; historical/type unchanged
  candidate progression                           PASS; historical/type unchanged
  selection rules                                 PASS; 10 rooms/21 members/15 filters;
                                                     historical/type byte-identical;
                                                     TMDB/GoTrue/type-generation not called
final clean latest reset + db:types:check          PASS; generated artifact consistent
full client Jest suite                             PASS; 50 suites, 843 tests
config/profile/privacy Jest suites                 PASS; 8 suites, 112 tests
selection-rule YAML/config packaging               PASS; 118 bytes, 2 assets identical
static security profile                            PASS; synthetic A/B, 0 signups,
                                                     0 identities, 3 artifacts, findings=[]
artifact/privacy scanner                           PASS; 3 files, 0 findings
npm run lint                                       PASS
npm run typecheck                                  PASS
npm run web:export                                 PASS; 5 static routes
historical migration protection                    PASS; 11 files byte-identical to HEAD
npm run db:types:check                             PASS; check-only, no write
git diff --check                                   PASS
owned browser/provider/isolated runtime state     ABSENT after cleanup
charged browser/R02/Auth acceptance               NOT RUN by instruction
```

The static security result above is the package-script invocation
`npm run test:e2e:security -- --grep @diagnostics-static`. An earlier direct
`node scripts/run-e2e.mjs` attempt was rejected before Playwright because it did
not provide the project-local executable path; it consumed no identity and did not
produce an evidence result. The authorized package-script rerun passed.

The official live TMDB contract remained the intentionally ignored credentialed
Edge test. T086's safely bounded non-Auth live five-step check is the preserved
supplemental live evidence; T087's deterministic oracle is the controlled-provider
matrix above. No live credential was used by this T087 gate.

#### Integrity, scope and recovery boundary

The generated database-types artifact remained at inode `11577831`, size `20779`,
and SHA-256 `69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03`;
only `npm run db:types:check` ran. All 11 historical migrations compare byte-for-byte
with HEAD. The Feature 009 migration is the sole additive migration and remains
unchanged. T087 changed only this quickstart receipt and the T087 checkbox in
`tasks.md`; ignored runtime/export/test-result outputs are not source evidence.

T087 **PASSES** and is marked complete. The exact next recovery task is the
T078-equivalent normal current-source acceptance block, beginning with a fresh R02
admission before any C1/owner/smoke dispatch; it was not started here. Its dependent
repeatability, independent fresh-checkout, reconciliation, and final-audit gates
remain later and unstarted. Feature 009 remains **REOPENED** and Feature 010 remains
unstarted.

### T088 current-source normal acceptance recovery — PASS — 2026-09-23

This is the exact T078-equivalent normal current-source acceptance checkpoint after
the green T087 deterministic certification. Historical T001–T087 receipts remain
preserved and unchanged. No repeatability, independent fresh checkout,
reconciliation, final G5 audit, Feature 010 work, signup probe, quota retry,
quota-oriented reset/restart, or partial charged block was started.

#### Certified source, harness and configuration identity

The charged source and its harness/configuration matched the T087-certified source
before admission, throughout C1/owner/smoke, and after cleanup:

```text
workspace HEAD                         e55a53bbc6494691f9a9e636cfead61a29255982
manifest scope                         app, src, e2e, scripts, supabase, config,
                                       app.json, package.json, package-lock.json,
                                       playwright.config.ts, tsconfig.json
manifest files                         144
path-list SHA-256                      b7e2ca13cf82fb08ca726f6f6dd5667bb7a4f17d7f27eb6b433b55cc9428b3d8
content-manifest SHA-256               5852542b5ec96b45195e2f10118b513115bc8ddd1ad25a1e2dc11d4eb701144d
ordered tmdb-client.ts SHA-256         58e857cff03e76b24d5e6bf187e5e0477e109c173268cadefdfae48a45a9812c
canonical/bundled YAML SHA-256         3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
generated database types SHA-256       69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
owner profile                          M01=2, M02=4, total=6
permanent smoke                        G03/G04/G05/G08/H01=16
runner controls                        workers=1, retries=0, repeatEach=1,
                                       capture/video/trace/screenshots=off
```

The content-manifest hash is the T087 convention: hashes are emitted in sorted
relative-path order as `<file SHA-256> two spaces <relative path>` lines with a
final LF. The source identity remained unchanged through the non-charged gates,
admission, all three charged commands, and final verification. The generated-types
artifact remained check-only; no type write or schema change occurred.

#### Zero-identity runtime restoration and admission

The configured local target was restored and proved before admission:

```text
npm run supabase:start                    PASS; configured shared local stack
npm run env:local                          PASS; credentials withheld; .env.local mode 600
npm run playwright:install                 PASS; pinned v1.63.0 Noble runtime available
GET /auth/v1/health                        PASS; HTTP 200; no signup request
GET /rest/v1/                             PASS; HTTP 200
GET /storage/v1/status                    PASS; HTTP 200
preflight auth.users / rooms / rules       0 / 0 / 0; unchanged by preflight
applied migrations                         12; latest 20260920000000
unfinished run markers                    0 after stale-empty-marker quarantine
active owned browser/provider resources    0
controlled provider environment            absent
```

The first read-only admission attempt failed closed on five empty stale
`test-results/run-*` directories without `safe-process.txt`. They contained no
files, no process was active, and no historical receipt was deleted or altered.
The five exact empty directories were moved to the recoverable quarantine
`/tmp/otteroom-stale-run-markers.UIxE3o`; no identity-bearing command ran during
that correction. The resulting authoritative admission immediately before C1 was:

```text
admission UTC                          2026-09-22T20:42:44.374Z
rolling cutoff UTC                     2026-09-22T19:42:44.375Z
R02 capacity                           150
current rolling usage                  0
T088 reservation                        23
projected usage                         23
projected headroom                      127
unfinished run markers                  0
active owned browser/provider           0
controlled provider environment         absent
signup/quota probe                      none
retry/reset/restart replenishment       none
admitted                                true
```

#### Non-charged gates

All required zero-identity gates were green before the admission:

```text
npm run db:types:check                   PASS; generated artifact consistent, no write
npm run test:edge                        PASS; 73 passed, 0 failed, 1 ignored live test
npm run test:client                      PASS; 50 suites, 843 tests
npm run test:e2e:security -- --grep      PASS; static A/B only, 0 signups/identities,
@diagnostics-static                      scanner findings=[]
node scripts/check-selection-rules-config.mjs
                                          PASS; canonical 118 bytes, 2 assets identical,
                                          client-inclusion=false, env-overrides=false
npm run lint                              PASS
npm run typecheck                         PASS
npm run web:export                        PASS; 5 static routes
git diff --check                          PASS
```

#### Charged execution and receipts

The admitted block ran exactly once in the required fail-fast order. Smoke was not
dispatched until C1 and owner acceptance passed; no command was retried or replaced.

```text
C1 command                              npm run test:e2e:security
C1 receipt                              test-results/run-FYO2TA/summary.json
C1 result                               PASS; controlled failure by contract
C1 Auth/cleanup                         success / true
C1 signups/identities                   1 / 1
C1 artifacts/scanner                    complete / findings=[]
C1 HTTP 429/budget                      none / false

owner command                           npm run test:e2e:feature009
owner receipt                           test-results/run-shz0gk/summary.json
M01                                     PASS; 2 signups / 2 identities
M02                                     PASS; 4 signups / 4 identities
owner total                             PASS; 6 signups / 6 identities
owner Auth/cleanup                      successful / true
owner controller scanner                3 files; findings=[]
owner HTTP 429/budget                   none / false

smoke command                           npm run test:e2e:smoke
smoke receipt                           test-results/run-1V5XlU/summary.json
G03/G04/G05/G08/H01                     PASS; 3/4/2/4/3 identities
smoke total                             PASS; 16 signups / 16 identities
smoke Auth/cleanup                      successful / true
smoke controller scanner                3 files; findings=[]
smoke HTTP 429/budget                   none / false

T088 charged consumption                1 + 2 + 4 + 16 = 23 identities
```

The three managed Playwright runtimes reached `started -> ready -> finished ->
removed`; each controlled provider was stopped and its temporary environment was
removed. No owned browser/provider process, runtime, or unfinished run remained.
The final read-only runtime state was `auth.users=23`, `rooms=9`,
`room_selection_rules=9`, with all 12 migrations applied and latest migration
`20260920000000`. The rooms/rules rows are retained test state; no reset or
quota-oriented cleanup was performed.

#### Final R02, integrity and recovery boundary

```text
final R02 UTC                          2026-09-22T20:47:04.379Z
rolling usage                          23 / 150
headroom                               127
unfinished run markers                 0
active owned browser/provider          0
controlled provider environment        absent
Auth/REST/Storage after run            HTTP 200 / HTTP 200 / HTTP 200
HTTP 429 or budget failure             none / false
source manifest                        144 files; T087 path/content hashes match
tmdb-client.ts                         T087 hash matches
generated types                        T087 hash matches; check-only
git diff --check                       PASS
```

T088 **PASSES** and is the only newly completed recovery task in this receipt.
Feature 009 remains **REOPENED** as directed and Feature 010 remains unstarted.
The exact next recovery task is **T089**, the unchanged-source T079-equivalent
repeatability block (`M01 2 + M02 4 + permanent smoke 16 = 22`); it was not
started. Independent fresh-checkout, reconciliation, and final G5 recovery remain
later and unstarted. Historical receipts remain unchanged.

### T089 current-source repeatability recovery — INCOMPLETE — 2026-09-23

T089 was admitted once under the unchanged T088 source identity, but the owner
acceptance could not reach Playwright readiness. The failure is preserved as a
separate diagnostic attempt. T089 remains incomplete; permanent smoke was not
dispatched, and no later recovery or Feature 010 work started.

#### Unchanged-source proof before admission

The required source manifest was reconstructed before admission and matched T088:

```text
workspace HEAD                         e55a53bbc6494691f9a9e636cfead61a29255982
manifest files                         144
path-list SHA-256                      b7e2ca13cf82fb08ca726f6f6dd5667bb7a4f17d7f27eb6b433b55cc9428b3d8
content-manifest SHA-256               5852542b5ec96b45195e2f10118b513115bc8ddd1ad25a1e2dc11d4eb701144d
ordered tmdb-client.ts SHA-256         58e857cff03e76b24d5e6bf187e5e0477e109c173268cadefdfae48a45a9812c
canonical/bundled YAML SHA-256         3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
Feature 009 migration SHA-256          457894026e6fe483e98248a1f8f4a04942a129092b62c08e7e183a1e096f0f7b
generated database types SHA-256       69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
E2E owner spec SHA-256                 46725a1416931abd9f66d29e4b9ad283c85896ee0ceca27eb0b0ef85be5cae9b
E2E controller SHA-256                 f5bc06c59ee5585984f0425b1d2611355a47d2f5d14725765e71c436d9365a8a
Feature 009 profile SHA-256             bb032a2336b19790bdec2fd6e5d5d956748c5dcf6329e4771747692c5eff5c90
Feature 009 boundary tests SHA-256     6153c0d6b2512e04e155a6a270488764951ab37be0d51f6dccbde0a5bbd99365
historical migrations                  11; byte-identical to HEAD
```

The full manifest covers the implementation, harnesses, YAML, migrations,
generated types, profile/configuration, and relevant tests. The post-failure
manifest and `git diff --check` remained identical/green, with no source write.

#### Fresh authoritative R02 admission

The configured local stack was restored and proved without an identity-bearing
request. Admission was immediately before owner dispatch:

```text
admission UTC                          2026-09-22T21:02:26.363Z
rolling cutoff UTC                     2026-09-22T20:02:26.023434Z
R02 capacity                           150
current rolling usage                  23 (T088=23; recent auth.users=23)
T089 reservation                        22 (M01 2 + M02 4 + smoke 16)
projected usage                         45
projected headroom                      105
auth.users / rooms / rules              23 / 9 / 9
unfinished run markers                  0
active owned browser/provider           0 / absent
Auth/REST/Storage health                HTTP 200 / HTTP 200 / HTTP 200
signup/quota probe                      none
retry/reset/restart replenishment       none
admitted                                true
```

#### Owner dispatch and failure

```text
owner command                           npm run test:e2e:feature009
owner dispatch                          exactly once
Playwright runtime                      v1.63.0-noble; started then removed
owner result                            INCOMPLETE before readiness
failure                                 DOCKER_NOT_READY
M01/M02 receipts                        none; no case reached execution
permanent smoke                         NOT RUN
T089 identity consumption               0; Auth signup was not reached
```

The owned runtime was cleaned up by its manager. The preserved run marker is
`test-results/run-FPhvPa/`; it contains no `summary.json` or `safe-process.txt`
because the runtime failed before Playwright launched. No owner scanner ran,
and no owner/Auth result or HTTP 429 was produced. The controlled provider
environment is absent and no owned Playwright container remains.

#### Final state and recovery boundary

```text
final read-only check UTC                2026-09-22T21:05:42.539619Z
rolling usage                            23 / 150
headroom                                 127
Auth/REST/Storage after failure          HTTP 200 / HTTP 200 / HTTP 200
auth.users / rooms / rules               23 / 9 / 9
HTTP 429 or budget failure               none observed / false
source manifest                          144 files; T088 hashes match
generated types                          T088 hash match; no write
scanner                                  not reached; no artifacts/findings
cleanup                                  runtime/container cleaned; failure marker retained
```

This failed dispatch is not included in normative `23 + 22 = 45` repeatability
accounting. T089 remains **INCOMPLETE**, Feature 009 remains **REOPENED**, and
Feature 010 remains unstarted. The exact next recovery task remains **T089**;
fresh-checkout, reconciliation, final G5, and Feature 010 work were not started.

### T089 Docker readiness diagnosis and non-charged runtime correction — 2026-09-23

This bounded recovery continued without R02 admission, Auth signup, Playwright
acceptance, M01/M02, permanent smoke, reset/restart, or Feature 010 work. T089
remains **INCOMPLETE** and its zero-identity failure is not charged.

#### Retained failure reconstruction

The retained marker `test-results/run-FPhvPa/` is an empty directory: it has no
`summary.json` or `safe-process.txt`, which is consistent with failure before the
Playwright child launched. The Docker journal retained the underlying lifecycle
that the marker did not:

```text
image                                  mcr.microsoft.com/playwright:v1.63.0-noble
image digest                           sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27
owned container name                   otteroom-playwright-086d3f95-361f-4c66-9c4c-42c78569dd71
container task ID                      91658c26c27e5c2182ebd15a449dad2840424d0b88025418ad1d74cb190d919e
Docker network                         default bridge; host port published for container 3000/tcp
container task started                 2026-09-23 02:02:34.044 +05
bridge attachment                      2026-09-23 02:02:34.094 +05
task deleted                           2026-09-23 02:04:34.264 +05
readiness bound                        120000 ms
```

The task was present and running for the full bounded wait. It was not observed
as absent, exited, unhealthy, or a stale reused container; the task deletion
coincides with the manager's cleanup after the 120-second readiness deadline.
The container had no Docker healthcheck. The exact predicate was a successful
real WebSocket upgrade from `ws://127.0.0.1:<dynamically-inspected-host-port>/`:
each probe had at most 1000 ms, probes were spaced by 250 ms, and any successful
`open` was required before Playwright launch. The historical marker does not retain
the raw TCP error or dynamic host-port number, so the evidence establishes “no
successful WS upgrade,” not whether each failed attempt was refused or reached a
non-WS listener.

The controlled Edge runtime task (`233f3935aa623d65409f44ebd56c5c668c615c4144064579801165fe07c4c7ad`)
started before the browser task and was stopped during the same final cleanup. It
was not the Playwright readiness endpoint. The shared Supabase stack was healthy
independently: Auth, REST, and Storage were HTTP 200; all nine configured
Supabase containers remained owned shared infrastructure. No prior-run cleanup
removed an object that T089 expected to reuse: the manager creates a fresh UUID
name and ownership label each time, and T088's owned browser containers had
already been removed. T089 reused only the already-present image.

#### Proven cause and deterministic reproduction

The official image contains Node/npm but no Playwright npm package. The previous
container command was therefore:

```text
npx --yes playwright@1.63.0 run-server --port 3000 --host 0.0.0.0
```

That command performs a fresh npm-registry package resolution inside every new
container. With the network disabled, the exact command remained running without
opening port 3000 until the bounded client-side timeout; this reproduced the
T089 state without Auth or browser acceptance. The journal's running-task/full-
timeout interval and the image/package inspection establish the same failure
class for T089: the container was alive while its registry-dependent startup
could not expose the WebSocket server. `--log-driver=none` discarded the only
in-container npm diagnostic, which is why the wrapper's `DOCKER_NOT_READY` was
less specific than the underlying cause.

T088 and T089 both created independent containers and used the same pinned image.
T088 explicitly ran `playwright:install` and then had three successful fresh
container starts; T089 reused the image but still required a new in-container
`npx` download. The difference was startup package availability/registry
dependency, not container reuse, a stale project/network, a port collision, or
the shared Supabase stack.

#### Smallest fix

`scripts/playwright-runtime.mjs` now validates the project-local `playwright` and
`playwright-core` packages are both exactly `1.63.0`, copies only those packages
into the stopped owned container, and starts `/usr/bin/node` directly on the
copied CLI with `NODE_PATH=/home/pwuser`. The official image's pinned
`/ms-playwright` browser installation, dynamic host-port mapping, bounded
WebSocket readiness, ownership label, and cleanup rules remain unchanged. No
volume, blind retry, sleep, healthcheck weakening, product behavior, migration,
generated type, or browser harness behavior changed.

The runtime regression test now requires the package copies to occur before
`start`, rejects the former `npx` command, verifies the direct pinned CLI and
ownership cleanup, and checks the new missing-package diagnostic.

#### Non-charged validation

```text
npm run playwright:install                  PASS; pinned image present
real runtime preflight                     PASS; started -> ready -> callback -> removed
                                             no Auth/signup/browser acceptance
focused runtime/config/privacy Jest         PASS; 6 suites, 100 tests
npm run test:client                         PASS; 50 suites, 843 tests
npm run test:edge                           PASS; 73 passed, 0 failed, 1 ignored
npm run lint                                PASS
npm run typecheck                           PASS
npm run db:types:check                      PASS; generated types unchanged
selection-rules config check                PASS; byte-identical assets, no client/env override
retained-marker artifact scanner            PASS; 0 files, 0 findings
git diff --check                            PASS
```

The final read-only state had no owned Playwright container, controlled-provider
environment, provider process, or browser process; Auth/REST/Storage remained
HTTP 200/200/200. The post-fix 144-file path hash is unchanged, but the content
hash is now `478a4ae21bcac343054c0cb5af6af2fc18ebfccd0bce33654647d4e6c5f4fcd7`
(T088: `5852542b5ec96b45195e2f10118b513115bc8ddd1ad25a1e2dc11d4eb701144d`).
The changed file is runtime orchestration only:
`scripts/playwright-runtime.mjs` now hashes to
`9a93ace924ad6026783a3861346abada0f1a2d4e9ff185c4c7f1853481fa29cd`.

#### Repeatability impact and boundary

The Feature 009 product, Edge, client, E2E case, profile, migration, YAML and
generated-type source used by browser behavior remains unchanged; the correction
is runtime orchestration/preflight only. However, the authoritative T088 manifest
scope explicitly includes `scripts/`, so the literal T088-to-T089 unchanged-source
relationship is no longer true after this fix. T088 remains valid historical
evidence for the prior source and for the unchanged browser behavior, but it cannot
serve as the unchanged-source repeatability run one for the corrected runtime.

Under the repeatability contract's “normal checkpoint is run one” rule, the exact
next charged block must therefore be a new normal run one with a fresh R02
admission for `C1 1 + M01/M02 6 + permanent smoke 16 = 23` identities. Only if
that block passes may the additional T089 repeatability block run with a separate
fresh admission for `M01/M02 6 + permanent smoke 16 = 22`; neither block was run
here. T089 remains **INCOMPLETE**, Feature 009 remains **REOPENED**, and Feature
010 remains unstarted.

### T090 corrected current-source normal run-one recovery — PASS — 2026-09-23

T090 is the new normal/run-one checkpoint required after the T089 Docker
readiness defect and its non-charged runtime correction. T088 remains preserved
historical evidence for its pre-correction source identity; it is not rewritten
as corrected-runtime evidence. T089 remains preserved as the incomplete,
zero-identity readiness attempt and is not converted into a successful
repeatability run. T090 is the only newly completed task in this receipt.
Feature 009 remains **REOPENED** and Feature 010 remains unstarted.

#### Corrected current source identity and certified scope

The charged source was the post-fix dirty workspace source at the repository
HEAD plus the already-recorded Feature 009 implementation and configuration
files. The authoritative manifest uses the established sorted
`git ls-files -co --exclude-standard --` scope: `app`, `src`, `e2e`, `scripts`,
`supabase`, `config`, `app.json`, `package.json`, `package-lock.json`,
`playwright.config.ts`, and `tsconfig.json`. Evidence ledgers, specifications,
`docs/`, dependencies, environment files, generated exports, and runtime/test
result directories remain excluded.

```text
workspace HEAD                         e55a53bbc6494691f9a9e636cfead61a29255982
manifest files                         144
path-list SHA-256                      b7e2ca13cf82fb08ca726f6f6dd5667bb7a4f17d7f27eb6b433b55cc9428b3d8
content-manifest SHA-256               478a4ae21bcac343054c0cb5af6af2fc18ebfccd0bce33654647d4e6c5f4fcd7
ordered tmdb-client.ts SHA-256         58e857cff03e76b24d5e6bf187e5e0477e109c173268cadefdfae48a45a9812c
runtime implementation SHA-256         9a93ace924ad6026783a3861346abada0f1a2d4e9ff185c4c7f1853481fa29cd
canonical/bundled YAML SHA-256         3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
Feature 009 migration SHA-256          457894026e6fe483e98248a1f8f4a04942a129092b62c08e7e183a1e096f0f7b
generated database types SHA-256       69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
E2E owner spec SHA-256                 46725a1416931abd9f66d29e4b9ad283c85896ee0ceca27eb0b0ef85be5cae9b
E2E controller SHA-256                 f5bc06c59ee5585984f0425b1d2611355a47d2f5d14725765e71c436d9365a8a
Feature 009 profile SHA-256             bb032a2336b19790bdec2fd6e5d5d956748c5dcf6329e4771747692c5eff5c90
runtime/config tests SHA-256            e8e89e7299863820c7caee680402dd00ff02286e73a9e9a8b7624dcc733bf11d
runner controls                         workers=1, retries=0, repeatEach=1,
                                       capture/video/trace/screenshots=off
owner profile                           M01=2, M02=4, total=6
permanent smoke                         G03/G04/G05/G08/H01=16
```

The manifest remained unchanged from the prerequisite checks through admission,
C1, owner acceptance, smoke, and final verification. The corrected runtime
implementation validates repository-local `playwright` and `playwright-core`
1.63.0 packages, copies them into the owned container, invokes the copied CLI
directly with Node and `NODE_PATH=/home/pwuser`, and retains bounded real
WebSocket readiness and ownership-scoped cleanup. No npm-registry/npx startup
dependency was used. The implementation, E2E owner harness, profile/controller,
canonical and bundled YAML, Feature 009 migration, generated types, tests, and
runtime configuration are all represented in the manifest; T087's deterministic
implementation/database/privacy evidence remains preserved for the unchanged
product source.

#### Zero-identity prerequisite gates and runtime preflight

```text
npm run db:types:check                  PASS; consistent; no write
generated types before/after            inode=11577831, size=20779,
                                       SHA-256=69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
runtime/config/profile Jest             PASS; 3 suites, 27 tests
selection-rules config check            PASS; canonical 118 bytes, 2 assets byte-identical,
                                       client-inclusion=false, env-overrides=false
npm run typecheck                       PASS
npm run lint                            PASS
real Docker runtime preflight           PASS; started -> ready -> callback -> removed
                                       no Auth/signup/browser acceptance
post-preflight owned container          absent
```

The preflight used the pinned `mcr.microsoft.com/playwright:v1.63.0-noble`
runtime and completed its callback after a real WebSocket readiness upgrade.
The owned container was removed and no named Playwright container remained.

#### Fresh authoritative R02 admission

The admission was completed before any identity-bearing T090 command:

```text
admission local UTC+05                2026-09-23T12:19:00+05:00
admission UTC                         2026-09-23T07:19:00+00:00
rolling cutoff UTC                    2026-09-23T06:19:00+00:00
R02 capacity                          150
current rolling usage                 0
T090 reservation                      23 (C1 1 + M01 2 + M02 4 + smoke 16)
projected usage                       23
projected headroom                    127
auth.users / rooms / private.rules    23 / 9 / 9
applied migrations / latest            12 / 20260920000000
unfinished active run markers         0
preserved empty diagnostic marker      run-FPhvPa (T089 historical; no active run)
active owned browser/provider          0 / absent
Auth/REST/Storage health               HTTP 200 / HTTP 200 / HTTP 200
signup/quota probe                     none
retry/reset/restart replenishment     none
admitted                               true
```

The preserved empty `run-FPhvPa` directory is the recorded T089 failure marker;
it has no summary or process receipt and was treated as historical diagnostic
evidence, not an active unfinished execution. It was neither deleted nor
rewritten. No signup or quota-testing request was made during admission.

#### Charged execution and receipts

The admitted 23-identity block ran exactly once in fail-fast order. No retry,
replacement, reset, restart, quota probe, or partial second block was started.

```text
C1 command                            npm run test:e2e:security
C1 receipt                            test-results/run-2cRtRo/summary.json
C1 result                             PASS by controlled-failure contract;
                                      A/B passed with 0/0 identities; C failed with
                                      1 signup / 1 identity; Auth success=true;
                                      cleanup=true; probe artifacts complete
C1 controller scanner                 6 files; findings=[]
C1 HTTP 429/budget                    none / false
C1 Playwright runtime                 started -> ready -> removed

owner command                         npm run test:e2e:feature009
owner receipt                         test-results/run-kl35xh/summary.json
M01                                   PASS; 2 signups / 2 identities
M02                                   PASS; 4 signups / 4 identities
owner total                           PASS; 6 signups / 6 identities
owner Auth/cleanup                    successful / true
owner controller scanner              3 files; findings=[]
owner HTTP 429/budget                 none / false
owner Playwright runtime              started -> ready -> finished -> removed

smoke command                         npm run test:e2e:smoke
smoke receipt                         test-results/run-Tula0z/summary.json
G03/G04/G05/G08/H01                   PASS; 3/4/2/4/3 identities
smoke total                           PASS; 16 signups / 16 identities
smoke Auth/cleanup                    successful / true
smoke controller scanner              3 files; findings=[]
smoke HTTP 429/budget                 none / false
smoke Playwright runtime              started -> ready -> finished -> removed

T090 charged consumption              1 + 2 + 4 + 16 = 23 identities
```

The C1 controller's scanner ran with its in-process credential registry and
reported zero findings, including the registry-approved diagnostic artifacts.
All three controller results were `passed` with `findings=[]`; the C1 inner
Playwright exit code was the expected controlled-failure `1`, while the safe
controller exited successfully.

#### Final state and recovery boundary

```text
final R02 UTC                         2026-09-23T07:23:32+00:00
rolling cutoff UTC                    2026-09-23T06:23:32+00:00
rolling usage                         23 / 150
headroom                              127
auth.users / rooms / private.rules    46 / 18 / 18
Auth/REST/Storage after run            HTTP 200 / HTTP 200 / HTTP 200
active owned Playwright containers    0
controlled provider environment       absent
active browser/provider processes     0
HTTP 429 or budget failure             none / false
source manifest                        144 files; T090 hashes unchanged
generated database types               inode/size/SHA-256 unchanged; check-only
Feature 009                            REOPENED
Feature 010                            unstarted
```

T090 **PASSES** and is marked complete. T088 and all earlier receipts remain
historical evidence for their tested source identities. T089 remains
**INCOMPLETE** as the preserved failed readiness attempt; it is not rewritten as
the corrected-runtime run. No fresh-checkout, reconciliation, final G5, or
Feature 010 work was started.

The exact next recovery task is the new unchanged-source repeatability run two,
recorded in the ledger as **T091**, at the unchanged T090 corrected source, with
a separate fresh authoritative R02 admission for `M01/M02 6 + permanent smoke
16 = 22` identities. The failed T089 attempt remains preserved and is not reused;
T091 was not started in this run.

### T091 corrected current-source unchanged-source repeatability run two — PASS — 2026-09-23

T091 is the required repeatability run two after T090's corrected current-source
normal/run-one recovery. It used the unchanged T090 source and stack, did not rerun
C1, and ran the six-identity Feature 009 owner block followed by the permanent
16-identity smoke block exactly once each. Feature 009 remains **REOPENED** and
Feature 010 remains unstarted.

#### Unchanged-source proof and zero-identity preflight

The authoritative source scope was reconstructed before admission and after the
charged block using the established sorted
`git ls-files -co --exclude-standard --` scope over `app`, `src`, `e2e`, `scripts`,
`supabase`, `config`, `app.json`, `package.json`, `package-lock.json`,
`playwright.config.ts`, and `tsconfig.json`:

```text
workspace HEAD                         e55a53bbc6494691f9a9e636cfead61a29255982
manifest files                         144
path-list SHA-256                      b7e2ca13cf82fb08ca726f6f6dd5667bb7a4f17d7f27eb6b433b55cc9428b3d8
content-manifest SHA-256               478a4ae21bcac343054c0cb5af6af2fc18ebfccd0bce33654647d4e6c5f4fcd7
Playwright runtime implementation SHA  9a93ace924ad6026783a3861346abada0f1a2d4e9ff185c4c7f1853481fa29cd
ordered tmdb-client.ts SHA-256         58e857cff03e76b24d5e6bf187e5e0477e109c173268cadefdfae48a45a9812c
canonical/bundled YAML SHA-256          3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
Feature 009 migration SHA-256          457894026e6fe483e98248a1f8f4a04942a129092b62c08e7e183a1e096f0f7b
generated database types SHA-256       69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
E2E owner spec SHA-256                 46725a1416931abd9f66d29e4b9ad283c85896ee0ceca27eb0b0ef85be5cae9b
E2E controller SHA-256                 f5bc06c59ee5585984f0425b1d2611355a47d2f5d14725765e71c436d9365a8a
Feature 009 profile SHA-256             bb032a2336b19790bdec2fd6e5d5d956748c5dcf6329e4771747692c5eff5c90
```

The complete manifest content hash proves that the implementation, E2E harness,
runtime tooling, YAML, migration, generated types, profile/configuration, and
relevant tests were unchanged from T090. `npm run db:types:check` passed before
admission and after the charged block. The generated artifact remained
`inode=11577831`, `size=20779`, and byte hash
`69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03`; no type
write occurred. The selection-rules packaging check passed with 118-byte
canonical YAML, two byte-identical assets, no client inclusion, and no
environment override. `git diff --check` passed.

The bounded non-charged real Docker preflight used the pinned
`mcr.microsoft.com/playwright:v1.63.0-noble` image and reached:

```text
started -> ready -> callback -> removed
owned Playwright containers after preflight    0
controlled provider environment                absent
```

The callback only returned success; it did not start Auth, signup, provider, or
browser acceptance work.

#### Fresh authoritative R02 admission

Admission completed before either identity-bearing command:

```text
admission local UTC+05                2026-09-23T12:37:43.681+05:00
admission UTC                         2026-09-23T07:37:43.681Z
rolling cutoff UTC                    2026-09-23T06:37:43.681Z
R02 capacity                          150
current rolling usage                 23
T091 reservation                      22 (M01 2 + M02 4 + permanent smoke 16)
projected usage                       45
projected headroom                    105
auth.users / rooms / private.rules    46 / 18 / 18
applied migrations / latest            12 / 20260920000000
unfinished active run markers         0
preserved empty diagnostic marker      run-FPhvPa (T089 historical; no active run)
active owned browser/provider          0 / absent
Auth/REST/Storage health               HTTP 200 / HTTP 200 / HTTP 200
signup/quota probe                     none
retry/reset/restart replenishment     none
admitted                               true
```

The admission reserved the complete 22-identity block. No signup probe,
quota-testing request, reset, restart, retry, or replenishment action was used.

#### Charged execution and receipts

The admitted block ran in fail-fast order. Smoke was dispatched only after the
owner passed; neither command was retried or replaced.

```text
owner command                         npm run test:e2e:feature009
owner receipt                         test-results/run-qiWFCS/summary.json
M01                                   PASS; 2 signups / 2 identities
M02                                   PASS; 4 signups / 4 identities
owner total                           PASS; 6 signups / 6 identities
owner Auth/cleanup                    successful / true
owner controller scanner              3 files; findings=[]; probe complete
owner HTTP 429/budget                 none / false
owner Playwright runtime              started -> ready -> finished -> removed

smoke command                         npm run test:e2e:smoke
smoke receipt                         test-results/run-fptHys/summary.json
G03/G04/G05/G08/H01                   PASS; 3/4/2/4/3 identities
smoke total                           PASS; 16 signups / 16 identities
smoke Auth/cleanup                    successful / true
smoke controller scanner              3 files; findings=[]; probe complete
smoke HTTP 429/budget                 none / false
smoke Playwright runtime              started -> ready -> finished -> removed

T091 charged consumption              6 + 16 = 22 identities
```

The T090 receipts `run-2cRtRo`, `run-kl35xh`, and `run-Tula0z`, the T089 empty
diagnostic marker, and all earlier historical receipts were preserved unchanged
and kept separate from the T091 receipts.

#### Final state and corrected-source repeatability accounting

```text
final R02 UTC                         2026-09-23T07:41:46.190Z
rolling cutoff UTC                    2026-09-23T06:41:46.190Z
rolling usage                         45 / 150
headroom                              105
auth.users / rooms / private.rules    68 / 27 / 27
Auth/REST/Storage after run            HTTP 200 / HTTP 200 / HTTP 200
active owned Playwright containers    0
controlled provider environment       absent
HTTP 429 or budget failure             none / false
source manifest                        144 files; T090 hashes unchanged
generated database types               inode/size/SHA-256 unchanged; check-only
Feature 009                            REOPENED
Feature 010                            unstarted
```

T091 **PASSES** and is marked complete. The corrected-source normative
repeatability accounting is exactly:

```text
T090 normal/run one + T091 repeatability run two = 23 + 22 = 45 identities
```

The historical T089 readiness failure remains incomplete and zero-identity; it is
not reused or folded into the normative 45. No fresh-checkout, reconciliation,
final G5, or Feature 010 work was started.

The exact next task is **T092**, the independent corrected-current-source
fresh-checkout recovery with its own deterministic gate and fresh 17-identity
`C1 1 + permanent smoke 16` admission. T092 is not started here.


### T092 corrected-source independent fresh-checkout recovery — PASS — 2026-09-23

T092 certified the exact corrected T090/T091 source in a new disposable checkout
and an independently owned dynamic Supabase runtime. T090 and T091 receipts,
all historical failed/diagnostic attempts, and the shared development stack were
preserved unchanged. Feature 009 remains REOPENED and Feature 010 remains
unstarted. No reconciliation or final G5 work was started.

#### Fresh-checkout source identity and isolation

The candidate was cloned from repository HEAD into a disposable checkout and
overlaid only with the current corrected source/test snapshot. The authoritative
T090/T091 source scope was reconstructed before dependency installation and again
before admission:

~~~text
candidate snapshot commit             0d8efaaf74f200a0fc7b770569a636ef52aa7679
candidate snapshot tree               d5fc596a834afbd7b4a2bdfecc13ce3632f352aa
validated source scope                144 files
path-list SHA-256                     b7e2ca13cf82fb08ca726f6f6dd5667bb7a4f17d7f27eb6b433b55cc9428b3d8
content-manifest SHA-256              478a4ae21bcac343054c0cb5af6af2fc18ebfccd0bce33654647d4e6c5f4fcd7
Playwright runtime SHA-256            9a93ace924ad6026783a3861346abada0f1a2d4e9ff185c4c7f1853481fa29cd
generated database types SHA-256      69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
candidate checkout before setup       clean; tracked status=0
initial ignored/runtime state         no .env.local, node_modules, build/export output,
                                      test results, browser cache or provider state
workspace source/status                unchanged; no source write
~~~

The checkout received its own 1,116-package npm ci. The declared toolchain is
Node 24.20.x and npm@11.19.0; the available pinned environment was Node
v24.12.0, npm 11.6.2, Supabase CLI 2.116.0, Deno 2.5.2, and Playwright 1.63.0,
matching the governing T090/T091 environment. The one unqualified CLI version
probe reproduced the known managed-home telemetry EROFS; the repository-safe
telemetry-disabled XDG invocation passed and was authoritative. The temporary
checkout, modules, export, environment and receipts were removed after evidence
was copied.

#### Owned isolated Supabase runtime and baseline

The runtime was prepared with scripts/t072-isolated-supabase.mjs, using only
its generated project, dynamic ports, container, network, volume and workdir:

~~~text
project                                otteroom-t072-lash48-b795
workdir                                /tmp/otteroom-t072-supabase-lASh48
API/database ports                     56000 / 56001
owned database container               supabase_db_otteroom-t072-lash48-b795
PostgreSQL system identifier           7688638411620470821
pre-migration rooms/users/rules        0 / 0 / 0
applied migrations/latest              12 / 20260920000000
owned fixtures                         0
shared development stack               not used for fresh-checkout writes
~~~

The fresh runtime credentials-only .env.local was mode 600 and contained only
the two public client fields; no provider environment was copied. The dynamic
direct-DB target resolved through the owned project rather than the shared
otteroom-room-session container. The bounded Playwright preparation used the
pinned mcr.microsoft.com/playwright:v1.63.0-noble image.

#### Non-charged fresh-checkout validation

All gates completed before R02 admission:

~~~text
protected migration validators              PASS; all 7; historical/type hashes unchanged;
                                           latest-reset=true; owned-fixtures=0
clean npm run db:reset                      PASS; 0 rooms / 0 users / 0 rules
npm run db:test                              PASS; 8 files, 933 tests
npm run test:edge                            PASS; 73 passed, 0 failed, 1 ignored live test
numeric/tie/exclusion/exhaustion regressions PASS; included in Edge suite
Feature 009 terminal-path regression        PASS; identities=0; completed-empty -> exhausted
npm run test:client                          PASS; 50 suites, 843 tests
static credential-safety E2E                PASS; 0 identities; 2 scenarios; findings=[]
selection-rules YAML packaging              PASS; 118 bytes; 2 byte-identical assets
npm run db:types:check                      PASS; check-only; no write
generated types                             inode/size/mtime/SHA-256 unchanged
npm run lint                                PASS
npm run typecheck                           PASS
npm run web:export                          PASS; 5 static routes
iOS/Android export                          NOT APPLICABLE; no native export scripts/directories
artifact/privacy scanner                   PASS; 3 static files, 0 findings
git diff --check                            PASS
Playwright preflight                        PASS; started -> ready -> callback -> removed
owned browser/provider after preflight      0 / absent
~~~

The live official TMDB contract remained the one expected ignored Edge test
because this environment had no provider read token; no provider call or
identity-bearing operation was used. The first Node invocation of the terminal
path hit the known Node 24 strip-only TypeScript limitation; the established
Deno invocation passed and is the authoritative zero-identity result. These
diagnostic invocations were not charged and remain separate from the passing
gate.

#### Fresh authoritative R02 admission

Admission occurred only after the complete zero-identity gate:

~~~text
admission UTC                          2026-09-23T08:18:49.110Z
rolling cutoff UTC                     2026-09-23T07:18:49.110Z
R02 capacity                           150
current isolated usage                 0
T092 reservation                       17 (C1 1 + permanent smoke 16)
projected usage                        17
projected headroom                     133
pre-admission rooms/rules              0 / 0
unfinished run markers                 0
active owned browser/provider          0 / absent
Auth/REST/Storage health               HTTP 200 / HTTP 200 / HTTP 200
signup/quota probe                     none
retry/reset/restart replenishment      none
admitted                               true
~~~

#### Charged fresh-checkout certification

C1 and smoke ran once, in fail-fast order, from the disposable checkout. No
retry, replacement, quota probe or shared-stack reset/restart occurred:

~~~text
C1 command/receipt                     npm run test:e2e:security / run-h0m2lv
C1 result                              PASS; controlled failure; inner exit=1 by design
C1 Auth/cleanup/artifacts              1/1; true; complete
C1 scanner/HTTP 429/budget             findings=[]; none; false

permanent smoke command/receipt         npm run test:e2e:smoke / run-Be6G6p
G03/G04/G05/G08/H01                    PASS; 3 + 4 + 2 + 4 + 3 = 16 identities
smoke Auth/cleanup                     successful; true for all five cases
smoke scanner/HTTP 429/budget          findings=[]; none; false
T092 charged consumption               1 + 16 = 17 identities
~~~

The C1 controller receipt contains A/B PASS and the expected controlled C
diagnostic with one signup/identity, verified capture, complete artifacts and
cleanup. The smoke controller receipt contains five passing cases, exact
identity caps, safe UI state and owned cleanup. The preserved receipts are
test-results/run-h0m2lv/ and test-results/run-Be6G6p/; the static zero-identity
receipt is test-results/run-Crgewz/.

#### Final R02, cleanup and shared-stack preservation

~~~text
owned runtime before teardown             6 rooms / 17 auth.users / 6 rules
final isolated R02 usage                  17 / 150
final isolated R02 headroom               133
Auth/REST/Storage after charged block     HTTP 200 / HTTP 200 / HTTP 200
HTTP 429 or budget failure                none / false
owned containers/volumes/networks         0 / 0 / 0 after cleanup
owned runtime directory                   removed
owned checkout/modules/cache/config       removed
owned browser/provider/process state      absent

shared container before/after             f0ec2dfe0a2920bc531d94b0ade97d96bbbf10aeb040a405c2b7dce1edf95830
shared project/workdir/volume             otteroom-room-session /
                                          /home/otter/Projects/otteroom /
                                          supabase_db_otteroom-room-session
shared PostgreSQL system identifier       7688445854678323237
shared counts before/after                27 rooms / 68 auth.users / 27 rules
shared latest migration                   20260920000000
shared health after cleanup               Auth/REST/Storage HTTP 200 / HTTP 200 / HTTP 200
shared mutation                           none; no shared reset/restart/write
~~~

Corrected-source accounting is now:

~~~text
repeatability (T090 + T091)              23 + 22 = 45 identities
fresh checkout (T092)                    1 + 16 = 17 identities
combined corrected-source certification  45 + 17 = 62 identities
~~~

T092 PASSES and is marked complete. T090/T091 and all historical receipts remain
preserved and separate. Feature 009 remains REOPENED; Feature 010 remains
unstarted. The exact next recovery scope is current-source reconciliation (T093,
the T073-equivalent reconciliation task); it was not started here. No final G5 or
Feature 010 work was started.


### T093 corrected-current-source reconciliation — PASS — 2026-09-23

T093 reconciled the governing corrected source certified by T090, T091, and T092.
Only read-only/static/check-only/documentation validation was performed. No charged
browser test, R02 admission, Auth signup, provider call, database reset, migration
runner, generated-types write, final G5 audit, or Feature 010 work was started.
Feature 009 remains **REOPENED**.

#### Governing source identity

The current workspace source and the independent T092 candidate agree under the
recovery contracts:

~~~text
workspace HEAD                         e55a53bbc6494691f9a9e636cfead61a29255982
validated source scope                 144 files
path-list SHA-256                      b7e2ca13cf82fb08ca726f6f6dd5667bb7a4f17d7f27eb6b433b55cc9428b3d8
content-manifest SHA-256               478a4ae21bcac343054c0cb5af6af2fc18ebfccd0bce33654647d4e6c5f4fcd7
Playwright runtime SHA-256             9a93ace924ad6026783a3861346abada0f1a2d4e9ff185c4c7f1853481fa29cd
generated database types SHA-256       69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
T092 candidate commit/tree             0d8efaaf74f200a0fc7b770569a636ef52aa7679 /
                                      d5fc596a834afbd7b4a2bdfecc13ce3632f352aa
canonical/bundled YAML SHA-256         3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
ordered tmdb-client.ts SHA-256         58e857cff03e76b24d5e6bf187e5e0477e109c173268cadefdfae48a45a9812c
Feature 009 migration SHA-256          457894026e6fe483e98248a1f8f4a04942a129092b62c08e7e183a1e096f0f7b
~~~

The T090 and T091 receipts record the same workspace HEAD, 144-file path/content
manifest, Playwright runtime hash, YAML/migration/ordered-source hashes and
check-only generated-types hash. T092 independently rebuilt the source in the
candidate checkout and recorded the same 144-file manifest and runtime hash under
candidate commit/tree `0d8efaaf…` / `d5fc596a…`; its clean-checkout and owned
runtime evidence therefore certifies the same corrected source rather than a new
implementation. The candidate checkout, modules, runtime, cache, provider and
credentials were removed, while the shared development stack was not reset,
restarted, or written by T092.

#### Normative current-source evidence and acceptance inventory

The current-source normative evidence is kept separate from T001–T089 historical,
failed, diagnostic, manual, replacement, and superseded receipts:

~~~text
normal current-source checkpoint        23 identities
unchanged-source repeatability run two 22 identities
repeatability                           23 + 22 = 45 identities
independent fresh checkout              17 identities
repeatability + fresh checkout          45 + 17 = 62 identities
~~~

The repository-derived acceptance inventory is unchanged by the numeric traversal
and Playwright runtime corrections:

~~~text
M01                                    2 identities
M02                                    4 identities
owner acceptance                       6 identities
permanent smoke                        5 cases / 16 identities
full acceptance                        48 cases / 118 identities
full acceptance plus C1                119 identities
~~~

M01/M02 are the two additive Feature 009 cases discovered by the fixed profile;
the Feature 008 boundary remains 46 cases / 112 identities. Historical T001–T089
evidence, including the earlier T078–T082 source and the incomplete T089 readiness
attempt, is not folded into the governing `23/22/45/17/62` formulas. T090, T091,
and T092 each have complete Auth/cleanup evidence, zero scanner findings, no HTTP
429 or budget failure, and no unfinished charged run; T092 additionally records
owned-runtime cleanup and unchanged shared-stack state.

#### Recovery-fix reconciliation and non-charged validation

The governing source contains both final recovery fixes. Numeric TMDB traversal
uses the provider-sorted prefix proof only while primary values are monotonic,
completes equal-primary runs across page boundaries, uses smaller TMDB ID ties,
and falls back to bounded complete traversal plus the local comparator after a
provider primary-order regression. The four-film manual regression reaches all
four candidates and then `completed_empty`; request/time budgets are unchanged.
The ordered-source contract, controlled-provider regression matrix, Edge tests and
T092 zero-identity gate all preserve incomplete-versus-empty, exclusion, cutoff,
eligibility and Feature 008 CAS semantics.

The Playwright runtime has no runtime `npx` or npm-registry dependency. Repository-
pinned Playwright packages are copied into the owned container, and the runtime
preflight reaches `started -> ready -> callback -> removed`. No owned browser,
provider, disposable checkout or recovery runtime remains.

The reconciliation checks were:

~~~text
source/manifest consistency                  PASS; 144 files and governing hashes match
profile/inventory/config Jest suite          PASS; 13 suites, 154 tests
YAML packaging                               PASS; 118 bytes; 2 byte-identical assets
npm run db:types:check                       PASS; check-only; no write
historical migration/type hash verification  PASS; 11 migrations protected; types unchanged after T063
artifact/privacy scan                         PASS; sanitized receipt/static artifacts; 0 findings
documentation consistency                    PASS; status, formulas, inventory and scope agree
git diff --check                             PASS
browser tests / R02 admission                 NOT RUN
~~~

The governing scanner/Auth/cleanup receipts remain clean, HTTP 429 is absent, and
the shared development infrastructure remains outside the T092-owned runtime. The
only next recovery task is **T094**, the final corrected-current-source G5 audit;
it is not started here. Feature 010 remains unstarted.

### T094 final corrected-current-source G5 audit — PASS — 2026-09-23

T094 was executed at `2026-09-23T14:05:29+05:00` as the exact final recovery
task. It used only read-only/static/check-only validation and zero-identity
deterministic tests. It did not run charged browser acceptance, R02 admission,
anonymous Auth, a live provider read, repeatability, fresh-checkout execution,
database reset, migration runners, generated-types write, or Feature 010 work.
Historical T001–T089 evidence, including the incomplete T089 Docker readiness
attempt and all superseded certifications, remains preserved and separate.

#### Governing corrected-current-source identity

The final audit reconstructed the established sorted source scope: tracked plus
allowed untracked files under `app/`, `src/`, `e2e/`, `scripts/`, `supabase/`, and
`config/`, plus `app.json`, `package.json`, `package-lock.json`,
`playwright.config.ts`, and `tsconfig.json`. Evidence ledgers, specifications,
`docs/`, dependencies, environment files, generated exports and runtime/test
result directories remain outside the source manifest.

```text
workspace HEAD                         e55a53bbc6494691f9a9e636cfead61a29255982
validated source scope                 144 files
path-list SHA-256                      b7e2ca13cf82fb08ca726f6f6dd5667bb7a4f17d7f27eb6b433b55cc9428b3d8
content-manifest SHA-256               478a4ae21bcac343054c0cb5af6af2fc18ebfccd0bce33654647d4e6c5f4fcd7
ordered tmdb-client.ts SHA-256         58e857cff03e76b24d5e6bf187e5e0477e109c173268cadefdfae48a45a9812c
Playwright runtime SHA-256             9a93ace924ad6026783a3861346abada0f1a2d4e9ff185c4c7f1853481fa29cd
canonical/bundled YAML SHA-256         3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
Feature 009 migration SHA-256          457894026e6fe483e98248a1f8f4a04942a129092b62c08e7e183a1e096f0f7b
generated database types SHA-256       69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
T092 candidate commit/tree             0d8efaaf74f200a0fc7b770569a636ef52aa7679 /
                                      d5fc596a834afbd7b4a2bdfecc13ce3632f352aa
E2E owner spec SHA-256                 46725a1416931abd9f66d29e4b9ad283c85896ee0ceca27eb0b0ef85be5cae9b
E2E controller SHA-256                 f5bc06c59ee5585984f0425b1d2611355a47d2f5d14725765e71c436d9365a8a
Feature 009 profile SHA-256             bb032a2336b19790bdec2fd6e5d5d956748c5dcf6329e4771747692c5eff5c90
runtime/config tests SHA-256            e8e89e7299863820c7caee680402dd00ff02286e73a9e9a8b7624dcc733bf11d
```

The recomputed manifest and component hashes match T090, T091, T092 and T093.
The T092 independent candidate commit/tree and 144-file manifest therefore
remain an independent certification of this same corrected source, not a
superseded pre-fix source.

#### G5 traceability and numeric traversal audit

The current implementation, contracts, design artifacts and executable evidence
reconcile the complete Feature 009 inventory:

```text
functional requirements                    40 / 40
non-functional requirements                 9 / 9
success criteria                           11 / 11
acceptance scenarios                        43 / 43
user stories                                6 / 6
```

The three configured numeric orderings remain `vote_count_desc`,
`average_rating_desc` and `popularity_desc`. Their provider-sorted broad query
uses a prefix proof only while observed primary values are monotonic; the first
eligible primary run is completed across page boundaries, and the local
comparator uses the smaller TMDB ID as the deterministic secondary tie-break.
When a provider primary increase is observed, the prefix proof is invalidated,
but traversal continues through the bounded pages and the authoritative local
comparator selects the result only after complete raw-pagination accounting.
The regression does not emit `ordering_inconsistent`; a budget, deadline,
provider, parse, required-metric, pagination or child-shard failure remains the
specific `search_incomplete` result.

Exclusions and no-repeat history remain server-authoritative. Duplicate provider
rows are safe, locally ineligible rows are skipped without weakening any clause
or cutoff, required metrics are conditional on active cutoffs/orderings, and
irrelevant malformed metrics do not invalidate an otherwise complete search.
Only a sufficient error-free proof returns `completed_empty`. Numeric overflow
retains deterministic non-overlapping date sharding, all required child winners
are compared, a single-day overflow is incomplete, and `title_asc` remains
exhaustive. The 100-request and 20-second budgets are unchanged.

The governing deterministic four-candidate regression and supplemental live
scenario remain reconciled as follows:

```text
predicate             Crime AND Comedy AND Science Fiction; vote_count >= 500
1                     Despicable Me                         id=20352   16398
2                     Minions: The Rise of Gru              id=438148   4184
3                     Robot & Frank                         id=84329    1199
4                     Batman vs Teenage Mutant Ninja Turtles id=581997  571
5                     completed_empty
```

After excluding candidates 1 and 2, candidates 3 and 4 remain reachable. After
excluding all four, the fifth search reaches `completed_empty`, not
`ordering_inconsistent`. T086/T093 retain the bounded supplemental live proof;
T094 did not repeat that provider read. The current zero-identity Edge suite
also passed all 32 ordered-source tests, including all numeric modes, regression
continuation, ties, exclusions, duplicates, ineligible rows, overflow/sharding,
failure taxonomy and completed-empty cases.

#### Playwright Docker runtime audit

The corrected runtime remains repository-owned and registry-independent at test
startup: it validates the repository-pinned `playwright` and `playwright-core`
packages at `1.63.0`, copies both packages into the owned container, invokes
`/usr/bin/node /home/pwuser/playwright/cli.js` directly, and sets
`NODE_PATH=/home/pwuser`. No runtime `npx`, npm install, or npm-registry startup
dependency is present. Missing local package state maps to the bounded
`DOCKER_PACKAGE_MISSING` diagnostic. Readiness remains a bounded real WebSocket
upgrade, not a sleep or log-text guess; the governing corrected-source preflight
is `started -> ready -> callback -> removed`.

Focused runtime/profile/privacy checks passed, and the T090/T092 corrected-source
preflights remain the governing non-charged runtime evidence. No owned Playwright
container, provider process, disposable checkout, browser process or active run
remains. The ambient transform cache and empty XDG temp directory are not active
owned runtime resources.

#### Configuration, snapshots, eligibility and agreement

- `config/selection-rules.yaml` remains the sole canonical server-only YAML:
  `ordering: vote_count_desc`, `minimum_vote_count: 500`, omitted
  `minimum_average_rating`, `metadata_language: en-US`, `genre_mode: or`, and
  exact `larger_group_agreement: 2/3`.
- Strict startup validation, restart/redeploy-only activation, no hot reload, no
  configuration UI/service, and no environment/request override remain enforced.
- Room/member/rule creation is atomic. Each new room retains one immutable
  snapshot; existing rooms retain their creation-time rules; explicit legacy
  rooms retain `legacy_005_006_008`; direct authenticated room creation remains
  retired.
- Feature 006 remains the sole candidate source. Provider pushdown only narrows
  the search; authoritative local validation requires every fixed voter's clause,
  OR within a voter's selected genres and AND across voters, inclusive cutoffs,
  retained language and only the metrics consumed by active rules. No weakening,
  fallback or alternate source exists.
- Agreement remains full-set only: N=2 requires 2/2 Yes; N>=3 uses exact integer
  ceiling arithmetic with no floating-point threshold logic. Feature 008
  prepare/search/expected-sequence CAS, no-repeat, stale/retry/concurrency and
  source-failure versus authoritative-exhaustion distinctions remain intact.

#### Migration, generated types and dependency integrity

There are exactly 11 historical migrations through Feature 008 and exactly one
Feature 009 migration. Static byte protection found every historical migration
unchanged. The generated-types artifact matches SHA-256
`69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03`;
T063 remains the sole legitimate generated-types write and every subsequent
operation, including T094, was check-only. No traversal/runtime recovery change
introduced schema or type writes.

Dependency and lockfile inspection found only the approved `yaml@2.9.0` runtime
addition; existing `@playwright/test`, `playwright` and `playwright-core` remain
pinned at `1.63.0`, and lockfile version 3 is consistent. The canonical YAML and
bundled Edge asset are 118 bytes and byte-identical.

#### Normative charged evidence and historical separation

T090, T091 and T092 are the governing corrected-current-source charged evidence;
T093 reconciled them and T094 audited the result without identity consumption:

```text
normal current-source checkpoint        23 identities
unchanged-source run two               22 identities
normative repeatability                23 + 22 = 45
independent fresh checkout             17 identities
combined certification                 45 + 17 = 62
M01 / M02 owner acceptance             2 / 4 identities; owner total 6
permanent smoke                        5 cases / 16 identities
full acceptance                        48 cases / 118 identities
full acceptance plus C1                119 identities
T094 identity consumption              0
```

Historical T001–T089 attempts, failures, diagnostics, manual validation and
superseded certifications were not rewritten or folded into `23/22/45/17/62`.
The governing T090/T091/T092 receipts retain fresh admission, clean scanner,
successful Auth, owned cleanup, no HTTP 429 or budget failure, no unfinished
charged run, and shared-stack preservation. T094 performed no charged rerun.

#### T094 checks, cleanup and scope boundary

```text
npm run test:edge                         PASS; 73 passed, 0 failed, 1 ignored live contract
focused config/runtime/privacy/type Jest  PASS; 7 suites, 101 tests
node scripts/check-selection-rules-config.mjs PASS; 118 bytes; 2 identical assets
npm run db:types:check                    PASS; generated artifact consistent; no write
npm run typecheck                          PASS
npm run lint                               PASS
artifact/privacy scan                     PASS; 3 files, 0 findings
git diff --check                           PASS
source/manifest/hash/static protection    PASS; governing hashes and 11 historical migrations match
charged browser/R02/Auth/repeatability/   NOT RUN by instruction
fresh-checkout execution                  
Feature 010 / Match                      NOT STARTED
```

Feature 009 still contains no Feature 010/Match behavior, early resolution,
user-facing configuration, hot reload, decision editing, dynamic membership
expansion, alternate candidate source, automatic filter/cutoff weakening or
random candidate fallback. T094 changed only the evidence/status artifacts:
this quickstart, the Feature 009 task/spec/plan/research/traceability artifacts,
`docs/testing-strategy.md` and `docs/mvp-roadmap.md`. No implementation file was
changed by T094; no commit, tag or push was created.

#### Final G5 verdict and exact next repository state

T094 **PASSES**. Feature 009 is now **COMPLETE**, T094 is complete, and the
entire corrected-source recovery chain T090–T094 is complete. The preserved T089
attempt remains unchecked/incomplete historical evidence rather than a governing
release gate. Feature 010 remains PLANNED and unstarted. The exact next repository
state is the completed Feature 009 release boundary at the corrected source
identity above, with no Feature 010 work authorized or started.

### T095 post-T094 three-singleton genre-pushdown recovery — PASS — 2026-09-23

The preceding T094 verdict remains a historical receipt for its tested source.
The owner's later manual three-voter Crime (80), Comedy (35), Science Fiction
(878), 1900–2026, vote-count-descending, minimum 500 scenario **reopens Feature
009**. The first film was assigned, but four near-simultaneous `room-candidate`
invocations at the next step each logged a Discover deadline near 20,050 ms.
Feature 010 remains unstarted. This task ran no charged browser case or R02
admission and did not change the 20,000 ms source deadline.

#### Exact query and failure mechanism

The old `buildDiscoverUrl` chose the first shortest voter clause in OR mode,
therefore all progression steps sent `with_genres=80`. The full Discover query
used `language=en-US`, `include_adult=false`, `include_video=false`,
`sort_by=vote_count.desc`, `primary_release_date.gte=1900-01-01`,
`primary_release_date.lte=2026-12-31`, `vote_count.gte=500`, and `page=1,2,...`;
it omitted `vote_average.gte`. Each step restarted at page 1. The four prior
movie IDs were excluded only by the Edge source from private preflight history;
no provider-side exclusion parameter was sent. Local year, adult, cutoff and
every-voter genre checks, plus locked commit validation, remained authoritative.

A bounded old-predicate live read saw 1,303 Crime results across 66 pages.
Despicable Me appeared on page 1. Minions appeared on page 10, whose vote-count
sequence included 4,279 followed by 4,282. That provider primary regression
requires the numeric source to finish the broad traversal before it can certify
Minions as the winner; the 20-second deadline prevents completion. The original
Edge logs establish four independent Edge invocations and their deadlines, but
do not log per-invocation TMDB request counts. No exact historical per-invocation
page count is claimed from those logs.

The compiler now canonicalizes genres/clauses, removes duplicate and redundant
superset clauses, and returns `exact`, `partial`, or `none`. One OR clause uses
pipe; all singleton clauses use comma regardless of room genre mode; singleton
requirements in a mixed CNF are pushed as a partial comma conjunction; other
mixed CNFs use one shortest canonical OR clause as partial narrowing. All
nonrepresented clauses remain local, and no undocumented mixed comma/pipe
precedence is assumed. The new manual predicate is `35,80,878`, exactly
equivalent to the owner's `80,35,878` conjunction. Provider ordering, cutoff,
date range, local exclusions and all authoritative eligibility checks are
unchanged.

#### Deterministic and live proof

The controlled weak-provider fixture has 1,303 results/66 pages and a page-10
numeric regression. It proves film 1 on page 1 in one request; with film 1
excluded it evaluates film 2 on page 10 but reaches the unchanged 20,000 ms
deadline after 20 simulated page requests, never committing an incomplete
result. The exact-pushdown fixture returns four results in one page; each of
the four exclusion steps and all-four `completed_empty` finishes in one request.
The Edge handler regression separately proves four candidate commits followed
by one empty CAS/exhausted result. Exhaustive four-genre-universe tests verify
no false negatives and exact-case equivalence across Any, duplicate, identical,
subset/superset, singleton, OR, mixed and reordered clauses.

One bounded live TMDB Discover request per step returned exactly four provider
results and the following sequence; the credential and raw responses were never
printed:

```text
step  result                                 requests  duration_ms
1     Despicable Me                          1         807
2     Minions: The Rise of Gru               1         298
3     Robot & Frank                          1         206
4     Batman vs Teenage Mutant Ninja Turtles 1         205
5     completed_empty                        1          99
```

No step returned `request_budget`, `deadline` or `ordering_inconsistent`.
Live evidence is supplemental; the controlled tests are the regression oracle.

#### Duplicate attempts and non-charged gate

`useRoomCandidate` keeps one flight per mounted client hook/generation. Each
participating client can invoke `room-candidate`; the four observed Edge
requests could be four active clients, although the logs do not identify
callers. Each `prepare_room_tmdb_candidate` briefly locks the room and returns
`acquire` while pending. No server-side acquisition lease or in-flight owner
exists. Each caller then traverses TMDB independently. Commit's room lock and
expected-sequence CAS adopt one winner and prevent duplicate occurrences/empty
commits, but do not deduplicate provider work. This matches the current Feature
008 winner-adoption contract. No distributed lock or caller change was made;
the genre fix succeeds for each independent caller.

```text
focused genre/source/Edge regressions      PASS
npm run test:edge                          PASS; 77 passed, 0 failed, 2 ignored live tests
bounded live five-step test                PASS; 5 requests total
npm run test:client                        PASS; 50 suites, 843 tests
isolated clean npm run db:test             PASS; 8 files, 933 tests
Feature 009 terminal-path probe            PASS; completed_empty -> exhausted, 0 identities
node scripts/check-selection-rules-config.mjs PASS; 118 bytes, 2 identical assets
npm run db:types:check                     PASS; check-only, hash unchanged
artifact/privacy scanner                  PASS; 3 files, 0 findings
npm run lint / npm run typecheck           PASS / PASS
git diff --check                          PASS
charged browser/R02/Auth acceptance       NOT RUN
Feature 010 / Match                       NOT STARTED
```

The first shared-stack `db:test` attempt failed three existing-row count
assertions; the shared database was not reset. A freshly prepared disposable
Supabase project passed all 933 tests and was cleaned up. The initial
`db:types:check` could not connect before the local stack was started; the
check-only rerun passed. No schema/RPC or historical migration was changed,
and no database types were regenerated. The generated types retain SHA-256
`69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03`.

The source change invalidates the *current-source certification claim* of
T090 normal run one, T091 repeatability, T092 independent fresh checkout, T093
reconciliation, and T094 G5 audit, as well as any earlier deterministic-source
gate used to admit them. Their receipts and charged consumption stay intact.
T095 completes the new non-charged recovery gate. The exact next task is **T096**:
fresh R02-admitted normal current-source run one (C1, M01/M02, permanent smoke),
then T097 unchanged-source repeatability, T098 independent fresh checkout,
T099 reconciliation and T100 final G5 audit. Feature 009 remains **REOPENED**.

### T096 T095-source normal current-source checkpoint — PASS — 2026-09-23

T096 completed exactly one fresh R02-admitted normal checkpoint: C1, M01/M02,
then permanent smoke, each dispatched once and in fail-fast order. T090–T094
remain preserved as historical evidence for their earlier tested source. T095's
recovery receipt is unchanged. Feature 009 remains **REOPENED** and Feature 010
remains unstarted.

#### Exact source identity and continuity

Before admission, the T095-corrected source identity was reconstructed using the
established sorted git ls-files -co --exclude-standard manifest scope:
app, src, e2e, scripts, supabase, config, app.json, package.json,
package-lock.json, playwright.config.ts, and tsconfig.json. Evidence
ledgers, specifications, docs/, dependencies, environment files, generated
exports, and runtime/test-result directories are excluded.

~~~text
workspace HEAD                         e55a53bbc6494691f9a9e636cfead61a29255982
manifest files                         145
path-list SHA-256                      a2816ee6da5b753addf4204ff402be2df93a37bec6139e9c0c36d6c18d6fa6e2
content-manifest SHA-256               908ffe93d64eef2b52ab1c0c48b075ea3752a9c73af9859afe9ec5beb7df0ac0
genre compiler tmdb-eligibility.ts      2753b3f8ed3dcf2c3339685995dbf1489967d2b242bb16e96430c315eb1fc37a
ordered tmdb-client.ts                  58e857cff03e76b24d5e6bf187e5e0477e109c173268cadefdfae48a45a9812c
Playwright runtime                     9a93ace924ad6026783a3861346abada0f1a2d4e9ff185c4c7f1853481fa29cd
canonical/bundled YAML                 3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
Feature 009 migration                  457894026e6fe483e98248a1f8f4a04942a129092b62c08e7e183a1e096f0f7b
generated database types               69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
E2E owner spec                         46725a1416931abd9f66d29e4b9ad283c85896ee0ceca27eb0b0ef85be5cae9b
E2E controller                         f5bc06c59ee5585984f0425b1d2611355a47d2f5d14725765e71c436d9365a8a
Feature 009 profile test               bb032a2336b19790bdec2fd6e5d5d956748c5dcf6329e4771747692c5eff5c90
~~~

The genre compiler is in tmdb-eligibility.ts; its normalized clauses,
exact/partial/absent representation, singleton conjunction and local authoritative
predicate match the T095 recovery. The ordered source, runtime, YAML, migration,
generated types, owner harness/profile and runner match the inspected T095 source.
The production, schema, generated-type, E2E harness/profile and runtime/config
source did not change after the T095 deterministic gate. The current pre-admission
manifest and post-run manifest are byte-identical. Focused current-source
genre/search and profile/config tests passed below; the full T095 deterministic
certification was not repeated.

#### Zero-identity preflight

~~~text
npm run db:types:check                  PASS; check-only
generated types before/after            inode 11577831; 20,779 bytes;
                                       SHA-256 unchanged at 69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
selection YAML packaging                PASS; 118 bytes; 2 assets byte-identical;
                                       client-inclusion=false; env-overrides=false
focused profile/runtime/config Jest     PASS; 4 suites, 81 tests
focused genre/search Deno suites        PASS; 2 files, 43 tests
Playwright runtime readiness            PASS; started -> ready -> callback -> removed
                                       pinned v1.63.0 Noble image; owned container absent
Auth / REST / Storage health            HTTP 200 / HTTP 200 / HTTP 200
preflight database counts               auth.users 4; rooms 1; selection rules 1;
                                       unchanged across the health checks
applied migrations/latest               12 / 20260920000000
signup requests during preflight        0
git diff --check                        PASS
~~~

The focused genre/search run covered tmdb-eligibility.test.ts and
tmdb-search.test.ts; no full Edge/client/database deterministic block was
repeated. No schema/migration/type write, Supabase reset/restart, provider request,
Auth signup, quota probe or charged browser command occurred before admission.

#### Fresh authoritative R02 admission

Admission was recorded immediately before the charged block:

~~~text
admission UTC                          2026-09-23T10:47:48.286Z
rolling cutoff UTC                     2026-09-23T09:47:48.286Z
capacity                               150
current rolling usage                  0
T096 complete reservation              23 (C1 1 + M01 2 + M02 4 + smoke 16; T=0)
projected usage/headroom               23 / 127
pre-admission auth.users/rooms/rules    4 / 1 / 1
applied migrations/latest               12 / 20260920000000
unfinished/recent charged runs          0
active browser/provider processes       0
active owned Playwright containers      0
Auth/REST/Storage health                 HTTP 200 / HTTP 200 / HTTP 200
signup/quota probe                       none
quota retry/reset/restart                none
admitted                                true
~~~

The rolling-window review found no receipt or active attempt inside the one-hour
window. Historical run markers were left in place. The full 23-identity
reservation was available before dispatch; no partial block or retry was used.

#### Charged checkpoint and receipts

The admitted suites passed in order and each ran once:

~~~text
C1 command/receipt                      npm run test:e2e:security / run-jz2z2C
C1 safe-controller                      PASS; A/B passed with 0/0 identities;
                                       C controlled diagnostic failure with 1/1;
                                       inner exit 1 by contract
C1 Auth/cleanup/artifacts                success / complete / complete
C1 scanner/HTTP 429/budget               6 files, findings=[] / none / false
C1 Playwright runtime                    started -> ready -> removed

owner command/receipt                   npm run test:e2e:feature009 / run-thVP6h
M01                                     PASS; 2 signups / 2 identities
M02                                     PASS; 4 signups / 4 identities
owner Auth/cleanup                       success / complete for both cases
owner scanner/HTTP 429/budget            3 files, findings=[] / none / false
owner controlled provider                assertions passed; owned provider removed
owner Playwright runtime                 started -> ready -> finished -> removed

smoke command/receipt                   npm run test:e2e:smoke / run-PPhGmI
G03/G04/G05/G08/H01                     PASS; 3 + 4 + 2 + 4 + 3 = 16 identities
smoke Auth/cleanup                       success / complete for all five cases
smoke scanner/HTTP 429/budget            3 files, findings=[] / none / false
smoke controlled provider               owned environment removed after completion
smoke Playwright runtime                 started -> ready -> finished -> removed

T096 charged consumption                1 + 2 + 4 + 16 = 23 identities
~~~

C1's inner diagnostic failure is the expected controlled C1 outcome; the safe
controller passed and preserved the complete probe artifacts. M01/M02 asserted
the controlled TMDB provider snapshots. All identity-bearing summaries report
Auth success, cleanup complete, no rate-limited Auth result and no budget failure.
No HTTP 429 occurred. The local controlled-provider environment was removed, and
the provider/runtime/process post-check found no active owned resources.

#### Final R02, Auth and cleanup state

~~~text
final UTC                               2026-09-23T10:55:16.259Z
rolling cutoff UTC                      2026-09-23T09:55:16.259Z
rolling R02 usage/capacity              23 / 150
remaining headroom                      127
auth.users/rooms/selection rules        27 / 10 / 10
applied migrations/latest               12 / 20260920000000
final Auth/REST/Storage health           HTTP 200 / HTTP 200 / HTTP 200
final source manifest                   145 files; pre-admission hashes unchanged
generated types                         check-only; inode/size/SHA-256 unchanged
active owned Playwright containers       0
active browser/provider processes        0
controlled provider environment         absent
HTTP 429 / budget failure                none / false
~~~

The local Auth user count moved from 4 to 27, matching the 23 recorded signups.
The exact receipts were test-results/run-jz2z2C/summary.json,
test-results/run-thVP6h/summary.json, and
test-results/run-PPhGmI/summary.json. No charged command was retried or
replaced. T096 is **COMPLETE**. The exact next task is **T097**, unchanged-source
repeatability run two; it is not started here. T098, T099, T100, final G5 and
Feature 010 remain unstarted.

### T097 T096-source current-source repeatability run two — PASS — 2026-09-23

T097 completed the separately admitted 22-identity repeatability block at the
unchanged T096 source and shared stack. Owner acceptance ran once; after it
passed, permanent smoke ran once. No C1, retry, quota probe, reset, restart,
source edit, reconciliation, fresh checkout, final G5 audit, or Feature 010 work
occurred. T096 and all older receipts remain unchanged. Feature 009 remains
**REOPENED** and Feature 010 remains unstarted.

#### Unchanged-source proof

The established sorted `git ls-files -co --exclude-standard` scope was
reconstructed before admission and after both charged commands. It covers
`app/`, `src/`, `e2e/`, `scripts/`, `supabase/`, and `config/`, plus the root
app/package/Playwright/TypeScript files; evidence ledgers, `docs/`, specs,
dependencies, environment files, and runtime/test results are excluded.

```text
workspace HEAD                         e55a53bbc6494691f9a9e636cfead61a29255982
manifest files                         145
path-list SHA-256                      a2816ee6da5b753addf4204ff402be2df93a37bec6139e9c0c36d6c18d6fa6e2
content-manifest SHA-256               908ffe93d64eef2b52ab1c0c48b075ea3752a9c73af9859afe9ec5beb7df0ac0
genre compiler tmdb-eligibility.ts      2753b3f8ed3dcf2c3339685995dbf1489967d2b242bb16e96430c315eb1fc37a
ordered tmdb-client.ts                 58e857cff03e76b24d5e6bf187e5e0477e109c173268cadefdfae48a45a9812c
Playwright runtime                     9a93ace924ad6026783a3861346abada0f1a2d4e9ff185c4c7f1853481fa29cd
canonical/bundled YAML                 3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970
Feature 009 migration                  457894026e6fe483e98248a1f8f4a04942a129092b62c08e7e183a1e096f0f7b
generated database types               69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
E2E owner spec                         46725a1416931abd9f66d29e4b9ad283c85896ee0ceca27eb0b0ef85be5cae9b
E2E controller                         f5bc06c59ee5585984f0425b1d2611355a47d2f5d14725765e71c436d9365a8a
Feature 009 profile test               bb032a2336b19790bdec2fd6e5d5d956748c5dcf6329e4771747692c5eff5c90
```

Every listed digest matches T096. The full content manifest also covers the
implementation, selection-rule code, ordered provider source, E2E harnesses,
YAML, all migrations, generated types, and the in-scope tests. The separately
hashed Feature 009 profile test also matches. Pre-admission and post-run manifest
digests are identical; no relevant source changed after T096.

#### Non-charged preflight

```text
npm run db:types:check                  PASS; check-only
generated types before/after            inode 11577831; 20,779 bytes;
                                       SHA-256 unchanged at 69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
selection YAML packaging                PASS; 118 bytes; 2 byte-identical assets;
                                       client-inclusion=false; env-overrides=false
Playwright runtime readiness            PASS; started -> ready -> callback -> removed
                                       pinned v1.63.0 Noble image; owned container absent
Auth / REST / Storage health            HTTP 200 / HTTP 200 / HTTP 200
git diff --check                        PASS
```

Pre-admission read-only stack counts were `auth.users=27`, `rooms=10`, and
selection rules `=10`; 12 migrations were applied through
`20260920000000`. No signup, Auth probe, provider request, reset, restart,
generated-type write, or charged browser command occurred during preflight.

#### Fresh authoritative R02 admission

The full block was admitted immediately before dispatch:

```text
admission UTC                          2026-09-23T11:10:47.114Z
rolling cutoff UTC                     2026-09-23T10:10:47.114Z
R02 capacity                           150
current rolling usage                  23 (T096 C1 + owner + smoke receipts)
T097 complete reservation              22 (M01 2 + M02 4 + smoke 16)
projected usage / headroom              45 / 105
pre-admission auth.users/rooms/rules    27 / 10 / 10
applied migrations/latest               12 / 20260920000000
recent charged receipts                 run-jz2z2C, run-thVP6h, run-PPhGmI (T096 only)
unfinished/recent non-T096 attempts     0
active browser/provider processes       0
active owned Playwright containers      0
Auth/REST/Storage health                 HTTP 200 / HTTP 200 / HTTP 200
signup/quota probe                       none
quota retry/reset/restart                none
admitted                                true
```

The recent receipts reconcile to exactly 23 anonymous identities; no other
attempt or active run was present. The entire 22-identity block was admitted
before either charged command.

#### Charged repeatability block and receipts

Owner acceptance passed and was dispatched exactly once:

```text
owner command/receipt                   npm run test:e2e:feature009 / run-g8N3DE
M01                                     PASS; 2 signups / 2 identities
M02                                     PASS; 4 signups / 4 identities
owner total                             PASS; 6 identities
owner Auth/cleanup                      success / complete for both cases
owner scanner                           3 artifacts; findings=[]; probe complete
owner HTTP 429/budget                   none / false
owner Playwright runtime                started -> ready -> finished -> removed
```

After the owner passed, permanent smoke passed and was dispatched exactly once:

```text
smoke command/receipt                   npm run test:e2e:smoke / run-Wcs3Qp
G03/G04/G05/G08/H01                     PASS; 3 + 4 + 2 + 4 + 3 = 16 identities
smoke Auth/cleanup                      success / complete for all five cases
smoke scanner                           3 artifacts; findings=[]; probe complete
smoke HTTP 429/budget                   none / false
smoke Playwright runtime                started -> ready -> finished -> removed
T097 charged consumption               6 + 16 = 22 identities
```

The controlled provider assertions passed and the owned provider/runtime
resources were removed. Both receipts report exact signup and identity counts,
Auth success, complete cleanup, and no budget failure. No HTTP 429 occurred.

#### Final R02, Auth, cleanup, and runtime state

```text
final UTC                               2026-09-23T11:14:11.048Z
rolling cutoff UTC                      2026-09-23T10:14:11.049Z
rolling R02 usage/capacity              45 / 150
remaining headroom                      105
auth.users/rooms/selection rules        49 / 19 / 19
applied migrations/latest               12 / 20260920000000
final Auth/REST/Storage health           HTTP 200 / HTTP 200 / HTTP 200
active owned Playwright containers       0
active browser/provider processes        0
controlled provider environment         absent
HTTP 429 / budget failure                none / false
source manifest                         145 files; pre-admission hashes unchanged
generated types                         check-only; inode/size/SHA-256 unchanged
```

T097 consumption is exactly 22 identities. Current-source repeatability is
certified at `23 + 22 = 45` identities. Historical failed, diagnostic, and
superseded attempts remain separate and are not included. T097 is **COMPLETE**.
The exact next task is **T098**, the independent fresh-checkout recovery; it is
not started here. T099 reconciliation, T100 final G5, and Feature 010 remain
unstarted.

### T098 current-source fresh-checkout attempt — STOPPED at YAML packaging — 2026-09-23

T098 remains **INCOMPLETE**. The independent checkout reached the canonical
selection-rules packaging check and failed before any protected migration
validator, reset/replay, deterministic suite, Playwright runtime preflight, R02
admission, C1, or permanent smoke. Per the fail-fast contract, no retry or
alternate checkout was attempted. T099, T100, final G5, and Feature 010 remain
unstarted.

#### Source snapshot and clean-checkout proof

The source input was the T096/T097 current workspace at HEAD
`e55a53bbc6494691f9a9e636cfead61a29255982`. Its 145-file manifest matched both
certified hashes:

```text
path-list SHA-256          a2816ee6da5b753addf4204ff402be2df93a37bec6139e9c0c36d6c18d6fa6e2
content-manifest SHA-256   908ffe93d64eef2b52ab1c0c48b075ea3752a9c73af9859afe9ec5beb7df0ac0
```

The disposable clone was based on that HEAD and overlaid with the 145 current
source paths. Its attempted synthetic snapshot was commit
`528d2c2d23b36769d312763f58fb8c3b4ca40622`, tree
`3d5cdc09e1069bcb7d4dbe8fa389317eb43071de`. It had no copied `.env`, Auth
session, database volume, browser cache, test receipts, dependencies, or build
and export artifacts. The Git worktree was clean before install. `npm ci` then
created only its own `node_modules`; `npm run env:local` later created a
mode-0600, 132-byte `.env.local` with only the owned runtime URL and public
publishable key. Both were removed with the checkout.

The manifest's file-byte hash matched, but its symlink topology did not. The
current workspace bundle link is the relative
`../../../config/selection-rules.yaml`. The snapshot overlay normalized that
link into `/home/otter/Projects/otteroom/config/selection-rules.yaml`, so the
synthetic tree did not represent an independent exact-source checkout. The
authoritative packaging check was dispatched once and failed:

```text
command     node scripts/check-selection-rules-config.mjs
result      exit 1; SELECTION_RULES_CONFIG_CHECK_FAILED
expected    relative bundle link within the fresh checkout
actual      absolute link back to the original workspace
```

The byte manifest alone is not accepted as equivalent-source proof for this
attempt. T098 stopped here without patching the checkout or retrying.

#### Toolchain and owned runtime preflight

The disposable checkout used Node `24.20.0`, npm `11.19.0`, Deno `2.5.2`,
Supabase CLI `2.116.0`, Playwright `1.63.0`, and Docker Engine `29.8.0`.
`npm ci` passed with 1,116 packages added and 1,117 audited; npm reported 13
moderate advisories. npm deferred two dependency lifecycle scripts under its
install-script policy; only the lockfile-pinned `deno@2.5.2` and
`unrs-resolver@1.12.2` scripts were approved and rebuilt. The package manifest
was restored to the source snapshot immediately afterward.

The established dynamic isolation tool created a unique T098-owned Supabase
runtime:

```text
project                 otteroom-t072-tmjzkv-5494
runtime workdir         /tmp/otteroom-t072-supabase-TMJzkv
API / database ports    56000 / 56001
database container      e1af732776bce5f8d9f70ab183511c432e8ae1646cdc2ba4e7d498144d5cc997
network / volume        supabase_network_otteroom-t072-tmjzkv-5494 /
                        supabase_db_otteroom-t072-tmjzkv-5494
PostgreSQL system ID    7688695560144441381
```

Before any protected validator or reset, the isolated database had
`auth.users=0`, `rooms=0`, and `private.room_selection_rules=0`, with no owned
fixtures. Supabase startup had initialized all 12 migrations through
`20260920000000`. No validator, `db:reset`, or fixture-writing terminal-path
check ran. Direct count queries used the uniquely named owned container; no
shared-stack target was used for writes.

#### Stop, cleanup, and accounting

The failing gate stopped all remaining deterministic validation. Therefore the
artifact/privacy scanner, `db:types:check`, lint, typecheck, web/native exports,
`git diff --check`, and the Playwright `started -> ready -> callback -> removed`
preflight were **NOT RUN**. No generated-type command ran or wrote the
canonical artifact. No Auth signup, provider request, controlled provider,
browser, C1, smoke, or identity-producing command ran. The scanner has no T098
receipt; Auth users remained zero; no HTTP 429 occurred. The Playwright runtime
and provider stub were never started.

The owned Supabase cleanup completed. Its container, network, volume, and runtime
directory were absent afterward; owned Playwright containers were zero. The
T098 checkout, dependencies, temporary toolchain, npm cache, and XDG config were
also removed. The shared development stack matched its pre-attempt identity:
database container `27f6dccf27aaffbbf11e331114b63cc19954a6862336178e582a6841971a1502`,
PostgreSQL system ID `7688668731406098469`, network
`a86c4c2e68748e8cdf286cdf10c811666f9e71a730f03b7c49fa6abe563a87fd`, volume
`supabase_db_otteroom-room-session`, and counts `auth.users=49`, `rooms=19`,
selection rules `=19`; all 12 migrations remained applied through
`20260920000000`.

No fresh R02 admission or reservation was obtained; T098 consumed zero
identities. T097's last recorded post-block state remains `45/150` at
`2026-09-23T11:14:11.048Z`; no T098 usage was added. Current-source
repeatability remains certified at `23 + 22 = 45`. Fresh-checkout consumption is
`0/17` and is not certified; combined `62` is not certified. Historical failed
and diagnostic receipts remain separate and unchanged.

The exact next recovery task remains **T098**: construct the fresh checkout
while preserving the current relative bundle symlink, then perform a new
T098 attempt only after that independent source snapshot passes its packaging
gate. Feature 009 remains **REOPENED**; Feature 010 remains unstarted.

### T098 symlink-fix recovery — STOPPED before R02 — 2026-09-23

T098 remains **INCOMPLETE**. The independent Git checkout now preserves the
canonical symlink and passes the packaging gate, but later non-charged gates
failed. No fresh R02 admission, C1, or permanent smoke was reached. T096/T097
receipts and older history remain unchanged. T099/T100 and Feature 010 remain
unstarted.

#### Symlink conversion root cause and tooling fix

The former source manifest hashed path names and file bytes. Reading a symlink
for its file-byte digest follows its target, so those matching hashes did not
cover Git mode `120000` or the literal `readlink` target. The T098 procedure
cloned HEAD, overlaid the current 145-file filesystem snapshot, wrote a
synthetic commit/tree, bundled it, then cloned and checked out the bundle. The
conversion happened while materializing the overlay: the relative target was
resolved against the original checkout and written as an absolute link. The
bundle and detached checkout preserve whatever target was already in that
tree.

The repository's isolated-source copier reproduced the same defect signature:
`scripts/t072-isolated-supabase.mjs` used `fs.cp` with `dereference: false` but
left `verbatimSymlinks` at its default. Its diagnostic runtime copy changed
`../../../config/selection-rules.yaml` into an absolute path back to the
checkout. The fix sets `verbatimSymlinks: true`. Fresh candidate construction
now stages each path through Git plumbing from `lstat` mode and raw symlink
target bytes in `specs/009-selection-rules-candidate-ordering/tools/reconstruct-t098-checkout.mjs`,
then creates the bundle and detached checkout from that tree; it does not
resolve and recreate filesystem links.

`__tests__/config/t098-fresh-checkout-symlink.test.ts` passed (1 suite, 1 test).
It checks Git index/tree mode `120000`, the exact relative target, runs the
actual isolated copier and checks the copied link, renames its fixture source
out of the way, and runs `node scripts/check-selection-rules-config.mjs` from
the relocated checkout successfully.

#### Authoritative detached candidate and packaging proof

The authoritative candidate was rebuilt after both tooling changes. The
original source's path-list digest remained the T096/T097 digest. The content
digest changed only for the in-scope isolated-copy tooling fix; canonical YAML
bytes and product behavior did not change.

The preceding diagnostic-only candidate was commit
`d5042f8b4456fc55e07fbf59d5c8d570a2ee6c12`, tree
`c922643aa47b85570b26cf3193e5940eb6bbee54`. Its initial detached packaging
check passed, but the separately owned runtime copy exposed the
`fs.cp` normalization above. No protected validator, database reset/test, or
charged action ran on that diagnostic candidate. Its runtime and checkout were
removed before constructing the authoritative candidate below.

```text
base HEAD                                e55a53bbc6494691f9a9e636cfead61a29255982
candidate commit                        a4006ccb4e68aa1d8cd0bfc40cde57988c3656a1
candidate tree                          0ad4326195ebf05d93e34656a8694ceb6114cced
source manifest files                   145
path-list SHA-256                       a2816ee6da5b753addf4204ff402be2df93a37bec6139e9c0c36d6c18d6fa6e2
content-manifest SHA-256                7631dc01ac4c771c23cc47cac62b8c1554471e08f6bb095ba7a4920dad298aee
mode/link-manifest SHA-256              5a7fad6aff2400fae2c701290e05139c61db8dceecda0a0f522854a099dcb055
bundle                                 /tmp/otteroom-t098-rebuilt-20260923/reconstruction/candidate.bundle
detached checkout                       /tmp/otteroom-t098-rebuilt-20260923/reconstruction/checkout
Git index mode                          120000
Git tree mode/blob                      120000 / ea80d4238e5d4ce1722c3088eecd950c4ef2d94d
literal link target                     ../../../config/selection-rules.yaml
resolved target                         candidate/config/selection-rules.yaml
checkout symlinks scanned               65; original-workspace targets=0; broken=0
node scripts/check-selection-rules-config.mjs PASS; 118 bytes; 2 byte-identical assets
```

The relocated regression made the source fixture unavailable while packaging
still passed. The checkout had no remote reference or path resolving to
`/home/otter/Projects/otteroom`. The owned Supabase copy also retained the same
relative target and byte-identical YAML.

#### Non-charged gate results

```text
protected migration validators          PASS; all 7; historical/type hashes unchanged;
                                        latest-reset=true; owned-fixtures=0
clean npm run db:reset                  PASS; all 12 migrations through 20260920000000
npm run db:test                         PASS; 8 files, 933 tests
npm run test:edge                       PASS; 77 passed, 0 failed, 2 ignored live tests
  genre compiler/traversal regressions  PASS within Edge suite, including three-singleton path
Feature 009 terminal-path probe         FAILED before test body; Deno rejected the named
                                        `supabase` run permission; no inserts or identities;
                                        not retried
npm run test:client                     FAIL; 8 suites failed, 40 passed; 29 tests failed,
                                        745 passed (774 total)
  source-scope finding                  the 145-file overlay excludes changed `__tests__/`
                                        files, so this checkout used base-commit tests
node scripts/check-selection-rules-config.mjs PASS; package validation from checkout
security static E2E                    FAIL before a result summary; container removed;
                                        run directory empty; identities=0
Playwright runtime preflight            PASS; started -> ready -> callback -> removed
npm run db:types:check                  PASS; check-only; generated file SHA-256 remains
                                        69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03
npm run lint                            PASS
npm run typecheck                       FAIL; 3 stale database-types test assertions
npm run web:export                      PASS; 5 static routes
native export                           NOT APPLICABLE; no ios/android directories or export scripts
E2E artifact/privacy scanner            PASS; 0 files, 0 findings for the empty static-run directory
git diff --check                        PASS; candidate worktree clean
```

The artifact scanner is scoped to E2E result directories. Its separate
exploratory invocation on `dist/` rejected the Expo HTML/JavaScript/image
bundle format and is not an E2E artifact result. The expected scan of the
static-run artifact directory passed with no findings.

#### Identity, runtime, and shared-stack state

```text
T098-owned project                      otteroom-t072-zagawe-b763
owned PostgreSQL system identifier      7688711355963822117
owned Auth/REST/Storage health           HTTP 200 / HTTP 200 / HTTP 200
owned final users/rooms/rules            0 / 0 / 0
owned latest migration                  20260920000000
owned containers/network/volume         0 / 0 / 0 after cleanup
owned browser/provider processes        none; Playwright containers=0
controlled-provider environment         absent
fresh R02 admission                     NOT REACHED
T098 C1/smoke identities                 0 / 0
T098 total identity consumption         0
repeatability (T096/T097)               45 identities, preserved
fresh-checkout certification             NOT established; expected block=17
combined 62 certification                NOT established

shared database container               27f6dccf27aaffbbf11e331114b63cc19954a6862336178e582a6841971a1502
shared PostgreSQL system identifier      7688668731406098469
shared users/rooms/rules                 49 / 19 / 19 before and after
shared latest migration                  20260920000000 before and after
shared reset/restart/write                none
```

The temporary Node/npm/Deno toolchain, npm cache, XDG config, `.env.local`,
dependencies, and export output were removed. The candidate bundle and detached
checkout remain under `/tmp/otteroom-t098-rebuilt-20260923/` as reconstruction
evidence. T098 is still **INCOMPLETE** and is the exact next task; the current
source-scope mismatch and failed non-charged gates remain unresolved. Do not
start T099/T100 or Feature 010.

### T098 complete-worktree reconstruction recovery — STOPPED at protected validator — 2026-09-23

T098 remains **INCOMPLETE**. The earlier 145-path candidate is retained as failed
evidence. A new candidate was built after correcting the source inventory and the
terminal-path command, installed from its lockfile, and provisioned with a new
owned Supabase project. YAML packaging and the first protected validator passed.
The next protected validator failed at its preconditions stage, so the gate sequence
stopped there. No terminal-path probe, later migration validator, full reset/test
suite, static-security E2E, R02 admission, C1, or smoke ran on the new candidate.
T099/T100 and Feature 010 remain unstarted.

#### Audit of the prior 145-file inventory

The 145 files were the established scoped source manifest, not a complete snapshot
of the current Git worktree. It enumerated `app/`, `src/`, `e2e/`, `scripts/`,
`supabase/`, and `config/`, plus `app.json`, `package.json`, `package-lock.json`,
`playwright.config.ts`, and `tsconfig.json`. It was used by T096/T097 as a source
identity for their current-source browser runs and reused by the former T098 overlay.

At the T098 recovery snapshot, `git ls-files -co --exclude-standard` found 344
versionable files. Comparing those bytes/modes with HEAD found 100 current
versionable deltas: the 145-path scope contained 72 changed files and omitted 28
changed files. The remaining 73 paths in that scoped manifest were unchanged.
The omissions were:

```text
13 client tests:
  __tests__/config/database-types.test.ts
  __tests__/config/e2e-diagnostics.test.ts
  __tests__/config/feature008-e2e-profile.test.ts
  __tests__/config/feature009-boundaries.test.ts
  __tests__/config/feature009-e2e-profile.test.ts
  __tests__/config/local-supabase-config.test.ts
  __tests__/config/playwright-runtime.test.ts
  __tests__/config/t098-fresh-checkout-symlink.test.ts
  __tests__/config/tmdb-candidate-source.test.ts
  __tests__/rooms/contracts.test.ts
  __tests__/rooms/service.test.ts
  __tests__/rooms/state.test.ts
  __tests__/routes/room.test.tsx

14 documentation/evidence files:
  docs/mvp-roadmap.md
  docs/product-vision.md
  docs/testing-strategy.md
  specs/009-selection-rules-candidate-ordering/checklists/requirements.md
  specs/009-selection-rules-candidate-ordering/contracts/room-rule-resolution-and-agreement.md
  specs/009-selection-rules-candidate-ordering/contracts/selection-configuration-and-room-creation.md
  specs/009-selection-rules-candidate-ordering/contracts/tmdb-ordered-candidate-source.md
  specs/009-selection-rules-candidate-ordering/data-model.md
  specs/009-selection-rules-candidate-ordering/plan.md
  specs/009-selection-rules-candidate-ordering/quickstart.md
  specs/009-selection-rules-candidate-ordering/requirements-traceability.md
  specs/009-selection-rules-candidate-ordering/research.md
  specs/009-selection-rules-candidate-ordering/spec.md
  specs/009-selection-rules-candidate-ordering/tasks.md

1 reconstruction tool:
  specs/009-selection-rules-candidate-ordering/tools/reconstruct-t098-checkout.mjs
```

The stale client-test failure is explained by the first category: the old checkout
used HEAD copies of changed `__tests__/` files, including the database-types
assertions. The docs/evidence category does not affect runtime behavior. The
reconstruction tool itself is part of the corrected versionable snapshot.

The source classes are kept separate in the complete snapshot: product/runtime and
server configuration; deterministic client, Edge, database, migration, E2E,
profile, and tooling tests; design/evidence documents; the versioned generated
database type; and ignored runtime outputs. `src/types/database.generated.ts` is a
versioned input and remains check-only at SHA-256
`69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03`. The source
snapshot excludes ignored `node_modules/`, `test-results/`, caches, `.env.local`,
Supabase `.temp`, and build/export output. The installed dependency tree and the
temporary local env file were created only after snapshot checkout; `.env.local`
was removed after the stop.

#### T096/T097 source-identity reconciliation

T096 and T097 each charged against the unchanged T095-corrected workspace. Their
145-file digest was an incomplete *general worktree inventory*, but their C1,
M01/M02, and smoke browser runs executed directly from the workspace, where the
current E2E specs, Playwright config, controller, runtime, and harness were present.
The changed `__tests__/` files were deterministic client tests; they were not the
charged browser test payload. The Feature 009 profile test was additionally
identified in the T096/T097 receipt. The later symlink-copy correction belongs to
T098 reconstruction/runtime-copy tooling and did not change the product or charged
browser path. Therefore T096's 23 and T097's 22 identities remain governing
evidence for their executed current-source browser blocks; their receipts are not
invalidated by the fresh-checkout overlay defect. Repeatability remains 45.

#### Corrected Git-worktree reconstruction and identity

The builder now starts from HEAD and uses Git's complete tracked plus
non-ignored-untracked path inventory, reads each present entry with `lstat`, stores
regular-file bytes and executable modes, stores raw symlink-target bytes with mode
`120000`, applies tracked deletions, and compares every path/mode/blob in the
candidate tree with the intended worktree snapshot. This replaced the hand-curated
145-path inclusion list. It rejects non-ignored untracked runtime/cache/env output
instead of folding it into the source. The regression now changes a tracked client
test and harness, adds a new test and tool, deletes a tracked file, preserves an
executable mode and symlink, compares the full file set, hides the source fixture,
then runs local tests and YAML packaging from the relocated checkout.

The regression and terminal-permission contract tests passed: 2 suites, 7 tests.
The new detached checkout was clean before install and passed the builder's exact
full-tree comparison. Its identity is:

```text
base HEAD                              e55a53bbc6494691f9a9e636cfead61a29255982
candidate commit                       c28c41465aaf4500036e172ccb772d456e9a31eb
candidate tree                         0d8f459d9c07a0bc4814a3f4b795a79a7d1f69c0
complete file count / changed paths    344 / 100
path-list SHA-256                      9e6990e08a00156b611e055ce2e467f6dc4bfb7ca6378636fb8c2c40b70e7edf
content-manifest SHA-256               07fb2c7031e9b0942becbb64e1a40fd5e0b790913e3eccda7b991164c2fc9e48
mode/content/path manifest SHA-256     627f1cf7cc9d91c7ce2d8b3c6c83b4bb86b5a83541d16c3cc941a5a8110e0c83
mode/link manifest SHA-256             ff9597c40cfd69f25f78142c6646e040b59e0ad4346a96606339228823aade21
candidate bundle                       /tmp/otteroom-t098-final-20260923/reconstruction/candidate.bundle
detached checkout                     /tmp/otteroom-t098-final-20260923/reconstruction/checkout
```

The canonical asset is Git/tree/index mode `120000`, blob
`ea80d4238e5d4ce1722c3088eecd950c4ef2d94d`, with literal target
`../../../config/selection-rules.yaml`; it resolves inside the detached checkout
to `config/selection-rules.yaml`. All versionable checkout symlinks and Git remote
metadata were checked for original-workspace references. The owned Supabase copy
preserved the same literal target and resolved to its own
`config/selection-rules.yaml`.

The exact declared toolchain was used: Node `24.20.0`, npm `11.19.0`, Deno `2.5.2`,
Supabase CLI `2.116.0`, and Playwright `1.63.0`. `npm ci` installed 1,116 packages
and audited 1,117 (13 moderate advisories). npm's install-script policy deferred
only `deno@2.5.2` and `unrs-resolver@1.12.2`; those exact lockfile-pinned scripts
were approved and run, then the package manifest was restored. The tracked checkout
was clean after install setup.

#### Deno terminal-path permission diagnosis

Deno `2.5.2` supports scoped subprocess permissions. The failed command granted
`--allow-run=supabase`, but the probe invokes the project-local absolute executable
`node_modules/.bin/supabase`; Deno could not resolve the bare `supabase` name on
the command PATH and rejected the process before the probe body. The reproduced
diagnostic was `Failed to resolve 'supabase' for allow-run: cannot find binary
path`. This was a test-wrapper invocation defect, not stale Deno syntax. The
package now defines `check:feature009:terminal-path` with the local executable path
and `docker`, only the required read paths, loopback/provider-listener network
addresses, and a scoped environment-variable list. The probe no longer spreads
`process.env`. The package/config assertion prevents the old bare-name invocation
and broad permissions from returning. The actual terminal-path probe was not
reached on this stopped candidate.

#### Static-security pre-result failure diagnosis

The retained prior run directory `test-results/run-YXyrRh/` is empty: no reporter
summary, safe-process receipt, or test artifact exists. Its owned browser container
was removed. The retained evidence locates the failure before the test reporter
produced a result. SHA-256s for `playwright.config.ts`, `scripts/run-e2e.mjs`,
`scripts/playwright-runtime.mjs`, `e2e/diagnostics/credential-safety.spec.ts`,
`e2e/support/safe-reporter.ts`, and `e2e/support/safe-diagnostics.ts` match between
that failed candidate, the source workspace, and the corrected candidate. The
static project/profile and selected test file were present and current; the 28
omissions were client tests and docs/evidence, not this static E2E path. Thus the
failure was not caused by a missing test or stale profile/config in the overlay.
The retained empty directory does not preserve the initiating launcher error, so
it cannot distinguish a transient runtime-preparation failure from another
pre-result launcher failure. The corrected static-security path was not rerun
because the protected validator failure stopped the gate sequence.

#### Isolated runtime, gate stop, and cleanup

The final candidate provisioned a new owned project `otteroom-t072-bbpvhw-2103`
from a copy of the detached checkout (port base `56000`). Before validation it had
`users=0`, `rooms=0`, `room_selection_rules=0`, and the expected 12 migrations
through `20260920000000`; Auth, REST, and Storage returned HTTP 200. Its PostgreSQL
system identifier was `7688724580829147173`, and its database container ID was
`f12ca796fe365aaeb8e0f3dba0402dfae04349af27864ed0a22dea0a7bd2a07e`.

```text
YAML packaging check                    PASS; 118 canonical bytes, 2 assets byte-identical
protected room-membership validator     PASS; fixtures and compatibility assertions
protected participant-filter validator  FAIL; stage=preconditions; before any reset
remaining non-charged gates             NOT RUN after fail-fast stop
terminal-path probe                     NOT RUN
static-security E2E / runtime preflight NOT RUN on this candidate
R02 admission / C1 / smoke              NOT REACHED; 0 / 0 / 0 identities
```

The second validator's receipt did not identify its failing predicate. Its
post-stop read-only checks showed the isolated config and project label matched,
the database remained empty at the latest migration, port `8081` was free, no
owned Playwright container or migration lock remained, and the local Supabase
binary resolved inside the checkout. The validator did not start a reset. Because
the non-charged gate failed, T098 stops here without trying another candidate or
running additional gates.

The failed candidate's `.env.local` and isolated runtime were removed; the bundle
and checkout remain as evidence. No owned container, network, or volume remains.
The shared development database was read only before and after: the same container
`27f6dccf27aaffbbf11e331114b63cc19954a6862336178e582a6841971a1502`, system
identifier `7688668731406098469`, users/rooms/rules `49/19/19`, and latest
migration `20260920000000`. No shared reset, restart, or write occurred.

T096/T097 remain complete at 45 identities. Fresh-checkout certification is not
established; its reserved expectation remains 17, and combined certification
remains unestablished at 62. T098 is still **INCOMPLETE**. The next task remains
T098: resolve the protected-validator precondition failure, rebuild a new
independent candidate from the corrected snapshot, then continue the non-charged
gates. Do not obtain R02 admission, run C1/smoke, start T099/T100, or start
Feature 010.

This recovery ledger was appended after the stopped candidate run. It changed only
the evidence document; no implementation, test, harness, tooling, or configuration
input changed after candidate commit `c28c41465aaf4500036e172ccb772d456e9a31eb`.

### T098 participant-filter precondition diagnosis — failure not reproduced — 2026-09-23

T098 remains **INCOMPLETE**. The retained `stage=preconditions` receipt could not
identify its predicate, so the participant-filter validator now emits a fixed
precondition identifier and, where useful, bounded booleans/counts. Its formatter
rejects arbitrary keys and string values. It never prints process output, paths,
environment values, credentials, tokens, connection strings, or row identifiers.
The deterministic regression checks every registered classification is unique,
is wired into the validator, and rejects unsafe observations.

#### Precondition inventory

The following checks run before `resetStarted` becomes true. “Dependencies” lists
the relevant categories from the T098 audit; categories omitted from a row are not
read by that predicate.

| Check ID | Expected state | State source and dependencies | Fresh reproduction |
|---|---|---|---|
| `arguments` | No extra CLI arguments (`process.argv.length === 2`). | Node process invocation; external caller. | Passed. |
| `runtime-resolution` | Valid dynamic project ID; isolated workdir under `/tmp/otteroom-t072-supabase-*`, not the default project, with a Supabase config file. | `OTTEROOM_SUPABASE_PROJECT_ID`, `OTTEROOM_SUPABASE_WORKDIR`, `localSupabaseRuntime`; environment, runtime path/ownership namespace, filesystem. The validator does not inspect `runtime.json` or its `sourceRoot` marker. | Passed for the new owned workdir. |
| `config-read` | Dynamic Supabase config is readable. | `localSupabaseConfig()` and filesystem; environment, external file. | Passed. |
| `config-project-match` | Config project ID equals the dynamic project ID. | Parsed config text compared with runtime environment; environment, project/container identity. | Passed. |
| `config-schemas-match` | Exposed schema line exactly equals `public, graphql_public`. | Config text; external file. | Passed. |
| `lock-create` | Exclusive per-project migration lock can be created. | `os.tmpdir()` and project-keyed lock file; environment (`TMPDIR`), external filesystem/concurrent process. | Passed. |
| `container-inspect` | Docker inspection of the dynamically named DB container succeeds. | Docker CLI context/environment and `localSupabaseContainer()`; Docker/project/container identity, external Docker engine. | Passed. |
| `container-running` | Inspected DB container reports running. | Docker inspect state; Docker/project/container identity. | Passed. |
| `container-project-match` | Container’s Supabase project label equals the dynamic project ID. | Docker inspect label; Docker/project/container identity. | Passed. |
| `port-8081-probe` | Loopback probe completes as either connected or refused, rather than timing out or failing unexpectedly. | Host TCP socket; port, external listener. | Passed. |
| `port-8081-free` | Loopback port `8081` is refused/unbound. This is the fixed app web-server port, not the isolated Supabase API port. | Host TCP socket; port, external listener. | Passed. |
| `browser-containers-query` | Docker can query containers carrying `com.otteroom.playwright.owner`. | Docker CLI; Docker/project/container identity, external Docker engine. | Passed. |
| `browser-containers-empty` | No owned Playwright containers are present. | Count of query output lines; Docker/project/container identity. No container IDs are emitted. | Passed; count was zero in the post-validator read. |
| `database-baseline-query` | Direct `psql` baseline query succeeds. | `docker exec` into the dynamic DB container as local `postgres`; database, Auth, Docker/project/container identity, external Docker/Postgres process. | Passed. |
| `database-baseline-parse` | Query output has exactly four nonnegative safe-integer counts. | Bounded JSON returned by the preceding SQL query; database/external command output. | Passed. |
| `database-rooms-empty` | `public.rooms` count is zero. | Direct Postgres row count; database rows. | Passed; zero before the sequence and after both validators. |
| `database-auth-users-empty` | `auth.users` count is zero. | Direct Postgres row count; database rows, Auth state. | Passed; zero before the sequence and after both validators. |
| `database-no-active-clients` | No other client backend has a state other than `idle`. | `pg_stat_activity`; database sessions, external clients. | Passed; zero in the post-validator read. |
| `database-no-anon-auth-clients` | No other client backend is logged in as `anon` or `authenticated`, including idle sessions. | `pg_stat_activity.usename`; database sessions, Auth roles, external clients. | Passed; zero in the post-validator read. |
| `project-local-cli` | `localExecutable('supabase')` resolves through `PATH` to this checkout’s `node_modules/.bin/supabase`. | `PATH`, executable access and realpath; environment, Supabase CLI path, filesystem. No CLI version is checked here. | Passed. |
| `generated-types-readable` | `src/types/database.generated.ts` can be read and hashed for a later unchanged check. | Versioned generated type file; generated types, external filesystem. The validator does not compare this pre-reset digest with a Git/source hash or fixed expected hash. | Passed. |

There is no migration-version query among these preconditions. The validator asks
the local CLI to reset through `20260910000000` only after they all pass. The
participant fixture files are read later at `stage=feature003-fixtures`, also after
reset begins; fixture presence is not a precondition. Historical migration/source
hashes are not checked by this participant-filter validator. Docker commands use
the inherited Docker context, while dynamic project ID, workdir, config, container
name, and project label bind the target. The precondition does not compare a
PostgreSQL system identifier or validate the provisioner’s `runtime.json` marker.

#### Fresh isolated reproduction and validator comparison

The diagnostic-only sequence reused the recorded detached checkout at commit
`c28c41465aaf4500036e172ccb772d456e9a31eb`; only a temporary instrumented validator
and its formatter were overlaid, then removed. It provisioned a new runtime at
port base `56000`, project `otteroom-t072-tqcyze-1025`, and workdir
`/tmp/otteroom-t072-supabase-TQCYzE`. Initial direct Postgres inspection showed
`rooms=0`, `auth.users=0`, `room_selection_rules=0`, 12 migrations through
`20260920000000`. The test sequence ran the room-membership validator followed by
the participant-filter validator, matching the failed gate order. Both passed;
the participant validator reported its migration compatibility assertions and
`latest-reset=true owned-fixtures=0`. Its former precondition failure was not
reproduced, so this run establishes no failing predicate and no underlying fix.

Both validators resolve project, workdir, config, and DB container dynamically;
compare the same project ID and exposed-schema setting; acquire project-specific
temporary locks; inspect the running container and project label; check port 8081
and owned browser containers; query `rooms`, `auth.users`, and client sessions; and
resolve the project-local Supabase CLI. Both use direct Docker/Postgres access and
the same environment preparation pattern. Differences are the participant
validator’s additional `DO_NOT_TRACK=1`, its distinct lock filename, feature
baseline reset versions (`20260910000000` participant filters versus
`20260909000001` room membership), and their feature-specific fixtures and
compatibility assertions. The room fixture captures three legacy rooms; the
participant fixture captures four rooms and eight members. No precondition code
difference explains the earlier isolated failure. In particular, the participant
baseline SQL has the same empty-room/user and no-active-or-public-role-session
predicates as the passing room validator.

The diagnostic runtime ended at zero rooms/users/rules, latest migration
`20260920000000`, and zero non-idle or `anon`/`authenticated` client sessions. The
owned workdir, container, network, and volume were removed (zero matching Docker
resources remain). The shared development container remained
`27f6dccf27aaffbbf11e331114b63cc19954a6862336178e582a6841971a1502`, with system
identifier `7688668731406098469`, `rooms/auth.users/rules=19/49/19`, and latest
migration `20260920000000` before and after. It was read only.

The diagnostic host had Node `24.12.0`; the candidate record lists Node `24.20.0`.
The new runtime reproduced the T098 isolation and validator order, but this
toolchain difference is retained as a limit on exact environment equivalence. No
anonymous Auth signup, browser test, terminal-path probe, other protected
validator, full T098 gate, R02 admission, C1, or smoke was run. No migration or
product behavior changed. Focused diagnostics/config tests passed (2 suites, 20
tests), lint passed, typecheck passed, and `git diff --check` passed. Database type
checking was not needed because neither its environment nor path changed.

T098 remains **INCOMPLETE** because its original precondition failure is still
unexplained. The next step is to obtain evidence for the exact precondition failure
under the recorded toolchain before changing a predicate or rebuilding the
governing T098 candidate. T096/T097 remain complete at 45 identities. Do not obtain
R02 admission, run C1/smoke, start T099/T100, or start Feature 010.

### T098 exact-toolchain precondition reproduction — 2026-09-23

T098 remains **INCOMPLETE**. The retained checkout stayed at commit
`c28c41465aaf4500036e172ccb772d456e9a31eb` with the original installed
project dependencies and matching lockfile. The diagnostic validator and formatter
were temporarily overlaid, then removed; the checkout is clean again. The toolchain
was selected explicitly before validation: Node
`/tmp/otteroom-t098-complete-20260923/toolchain/node-v24.20.0-linux-x64/bin/node`
(`v24.20.0`), its bundled `npm` (`11.19.0`), and this checkout's
`node_modules/.bin/deno` (`2.5.2`) and `node_modules/.bin/supabase` (`2.116.0`).
The installed dependency tree passed `npm ls --depth=0`; the retained lockfile's
SHA-256 was `28df3f201f74023610ffc65f3893bd9b226810921aeb456a99d4e5308587f6f1`.
No install, candidate rebuild, or database-types write occurred.

A source comparison caught one instrumentation mismatch before the governing
reproduction: the new diagnostic session count used `state is distinct from 'idle'`
where the failed candidate's precondition used `state<>'idle'`. The diagnostic SQL
was restored to the original predicate and a deterministic assertion was added.
The preliminary runtime, on which both validators had passed with the stricter
diagnostic query, was cleaned up. The governing reproduction then used a new
T072-owned runtime at port base `56000`: project
`otteroom-t072-lhtido-5c3f`, workdir
`/tmp/otteroom-t072-supabase-LhTIdO`, database container
`305fd4c250c328919f7787c88f748b968e3bcdcbab8fd04821355527f0e4c47c`,
and PostgreSQL system identifier `7688742089379205157`. Its container label
matched the project. Before validators, it had zero rooms, zero `auth.users`, zero
`private.room_selection_rules`, and 12 migrations through `20260920000000`.
The shared development stack was a distinct project and container.

The original protected order was run with no intervening reset: room-membership
validator **PASS**, then participant-filter validator **PASS**. Both reported
`latest-reset=true owned-fixtures=0`; the owned database ended with zero
rooms/users/rules, 12 migrations through `20260920000000`, and zero active or
`anon`/`authenticated` client sessions. The original failed receipt supplies only
`stage=preconditions`, without a check ID or a snapshot at the failing instant.
Its post-stop observations and the current validator lifecycle establish no
specific temporary file, ownership marker, lock, generated config, port, Docker
resource, cleanup, or inherited-environment difference that caused the failure.
The previous room validator's `PASS` required its cleanup to succeed. Each
validator ran in a separate Node process, so its `process.env.PATH` assignment
could not persist into the next call. The source checkout's ignored Supabase
`cli-latest` cache is outside the precondition inputs. A transient state remains
possible, but the original failure is **genuinely unexplained** by retained evidence.

The bounded diagnostic/config tests passed: 2 suites, 20 tests, including all 21
registered precondition IDs, unsafe-field rejection, and the original session
predicate assertion. Lint, typecheck, Node syntax checks, and `git diff --check`
passed. The validator receipts contained no credential, secret, or row-ID pattern;
no raw process output was forwarded. Both owned diagnostic runtimes were stopped
and removed: zero matching containers, networks, volumes, or workdirs remain.
The shared database retained container
`27f6dccf27aaffbbf11e331114b63cc19954a6862336178e582a6841971a1502`,
system identifier `7688668731406098469`, rooms/users/rules `19/49/19`, and 12
migrations through `20260920000000` before and after.

The exact-toolchain reproduction found no deterministic participant-filter blocker.
It is safe to rebuild a new T098 candidate for the non-charged gates in a later
run, retaining the bounded diagnostics and stopping if a precondition fails again.
No governing candidate was rebuilt here. T096/T097 remain valid at 23/22 identities
(45 total); R02 admission, charged browser tests, C1, smoke, T099/T100, and
Feature 010 remain untouched.

### T098 governing fresh-checkout recovery — STOPPED at terminal-path gate — 2026-09-23

T098 remains **INCOMPLETE**. A new governing candidate was reconstructed from the
complete current Git-visible/versionable worktree with the corrected
complete-worktree reconstruction tooling. Its base was
`e55a53bbc6494691f9a9e636cfead61a29255982`, candidate commit
`eefdd400f2f6a3632db3c3dc26c07f640428713f`, and tree
`cad9cf9f0102feb35c6834c6601480c77175d6de`. The snapshot contains 346 files and
102 changed paths. Manifest SHA-256 values: path list
`3d062d35db435479ac60ec3735b5c708008b5c2e0e09570e8fe465ebf7883398`, content
`74951178a15bc21b8f3ec325c4311437ea25680be93d15682cb22816ff0fea35`,
mode/content/path `4b620e60f82a38e5f386bbd2d5a82bee3dc3ee4b2ed4607d4b697bfe1a72ad24`,
and mode/link `e3a643f8606c2b46fbf2466fd775bf5e77e56bef1057672bb2e329e60f518987`.
The bundle, index, reconstruction receipt, and checkout are retained under
`/tmp/otteroom-t098-governing-20260923/reconstruction/`. Reconstruction verified
that changed versionable paths use the intended current worktree state, including
tracked deletions and untracked nonignored files, and that versionable symlinks do
not resolve back into the original workspace. In particular,
`supabase/functions/_shared/selection-rules.yaml` is mode `120000` with literal
target `../../../config/selection-rules.yaml`, resolving inside the candidate to
`config/selection-rules.yaml`.

The explicitly selected toolchain was Node
`/tmp/otteroom-t098-complete-20260923/toolchain/node-v24.20.0-linux-x64/bin/node`
(`24.20.0`) with its bundled npm (`11.19.0`), candidate-local
`node_modules/.bin/deno` (`2.5.2`), candidate-local
`node_modules/.bin/supabase` (`2.116.0`), and candidate-local Playwright
(`1.63.0`). Dependencies were installed from the candidate lockfile with
`npm ci --ignore-scripts`, followed only by the established rebuild of the two
lockfile-pinned native packages; `npm ls --depth=0` passed. No manifest or lockfile
was modified by installation.

A new owned isolated runtime was provisioned at port base `56000`: project
`otteroom-t072-an46ny-146c`, workdir
`/tmp/otteroom-t072-supabase-AN46Ny`, DB container
`5a6f5dfb66e32ce64723728c093ef02825ed60b6c0e58f3170eec3fcce685d9d`, and Postgres
system identifier `7688749211785269285`. Its project/container ownership label
matched. Before protected validators, `rooms=0`, `auth.users=0`,
`room_selection_rules=0`, and 12 migrations were applied through
`20260920000000`. The shared development stack was separately identified and
never targeted.

The authoritative non-charged sequence began at the start:

1. YAML/config packaging — **PASS**.
2. Room-membership migration validator — **PASS**.
3. Participant-filter migration validator — **PASS**; all bounded preconditions
   passed, with no predicate failure.
4. Common-filter-resolution migration validator — **PASS**.
5. TMDB-candidate migration validator — **PASS**.
6. Swipe-decisions migration validator — **PASS**.
7. Candidate-progression migration validator — **PASS**.
8. Selection-rules migration validator — **PASS**.
9. Clean reset/replay — **PASS**.
10. Database suite — **PASS**, 8 files and 933 tests.
11. Full Edge suite — **PASS**, 77 passed, 0 failed, 2 live tests ignored. This
    included the genre compiler/traversal regressions and the four-film
    completed-empty regression.
12. Terminal-path probe — **FAIL** before its test body.

The bounded participant-filter diagnostic tests had separately passed on the
retained Node 24.20.0 checkout (2 suites, 20 tests), covering all 21 precondition
IDs and unsafe-field rejection. The full client/config/privacy suite in this new
candidate was not reached, so those checks were not repeated as part of this
governing run.

The terminal-path receipt records Deno `NotCapable: Requires env access to
"TMPDIR"`. The scoped command permits `PATH,HOME,DOCKER_HOST,DOCKER_CONTEXT,
OTTEROOM_SUPABASE_PROJECT_ID,OTTEROOM_SUPABASE_WORKDIR`, but not `TMPDIR`.
`scripts/local-supabase.mjs:9` calls `node:os.tmpdir()`, which reads `TMPDIR`.
No terminal-path assertions ran. Per fail-fast, the client/config/privacy suite,
static-security E2E/preflight, Playwright lifecycle preflight, lint, typecheck,
web/native exports, artifact/privacy scan, `npm run db:types:check`, and the final
candidate `git diff --check` gate were **NOT RUN**. Generated types were not
written; the candidate's pre-run and final `src/types/database.generated.ts`
SHA-256 was `69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03`.

No R02 admission was requested, no admission state was queried, and no C1 or
permanent smoke ran. This attempt consumed zero charged identities. T096/T097
remain valid at 23 normal-checkpoint identities and 22 unchanged-source
repeatability identities (45 total); T098 fresh-checkout consumption remains
unearned, so the 62-identity combined certification is not established.

The owned runtime and its workdir were removed. No owned containers, networks,
volumes, or browser containers remain. The shared development stack remained
container `27f6dccf27aaffbbf11e331114b63cc19954a6862336178e582a6841971a1502`,
Postgres system identifier `7688668731406098469`, with
`rooms/auth.users/room_selection_rules=19/49/19` and 12 migrations through
`20260920000000` before and after; it was not reset or written. Candidate
environment files and dependency/runtime caches were removed while the candidate
bundle and receipts were retained under `/tmp/otteroom-t098-governing-20260923/`.

The exact next blocker is the terminal-path Deno permission scope: grant the
probe only the required `TMPDIR` environment access and keep its deterministic
permission/config test aligned. This recovery stopped before changing that code
or continuing the gate sequence. Any later T098 attempt must use another newly
reconstructed governing candidate and start the complete non-charged gate from
the beginning. No R02 admission or charged test is authorized by this stopped
run. T096/T097 remain valid; Feature 009 remains **REOPENED**, T099/T100 were not
started, and Feature 010 remains unstarted.

### T098 TMPDIR diagnosis and fresh-checkout stop — 2026-09-23

T098 remains **INCOMPLETE** and is **not ready** for a separate repository-local
R02 admission or the 17-identity charged block. This was a non-charged TMPDIR
diagnosis/fix run only. No R02 admission was performed or queried; no C1, smoke,
browser/Auth signup, T099/T100, or Feature 010 work was started.

#### Original TMPDIR failure and cause

The retained T098 receipt's failing command was
`npm run check:feature009:terminal-path`. At that time the package script invoked
Deno directly with
`--allow-env=PATH,HOME,DOCKER_HOST,DOCKER_CONTEXT,OTTEROOM_SUPABASE_PROJECT_ID,OTTEROOM_SUPABASE_WORKDIR`.
During module initialization, `scripts/local-supabase.mjs:9` called
`node:os.tmpdir()`. Deno stopped with
`NotCapable: Requires env access to "TMPDIR", run again with the --allow-env flag`.
The terminal probe body and its database work had not started.

This was an environment-permission error, not a failed filesystem operation.
Deno did not read or expose a `TMPDIR` value, so the original failing process has
no observable path, owner, group, mode, or failed artifact to report. The host
environment used for the independent reproduction had `TMPDIR` unset; the
inherited value therefore came from the ambient host environment and was absent,
not supplied by the reconstructed checkout, toolchain, Supabase runtime, Deno,
Node/npm, Playwright, migration validator, or project script. With `TMPDIR`
unset, the Node OS shim's conventional fallback is `/tmp`. Inspection found
`/tmp` existed as uid/gid `65534:65534`, mode `1777`; it was not the target of a
failed create. No file, directory, socket, cache, config, extraction, or other
filesystem write was attempted, so there was no filesystem errno such as
`EACCES`.

The old failure reproduced from independent checkout
`/tmp/otteroom-t098-tmpdiag-20260923` with Node `24.20.0`, npm `11.19.0`, Deno
`2.5.2`, and `env -u TMPDIR npm run check:feature009:terminal-path`. It returned
the same Deno `NotCapable` error before the probe body and without browser or
Auth work.

Repository comparison found that the established Supabase process paths already
disable telemetry and put `XDG_CONFIG_HOME` under `os.tmpdir()` in
`scripts/safe-process.mjs`, `scripts/supabase-cli.mjs`,
`scripts/database-types.mjs`, and `scripts/configure-local-env.mjs`. The T072
runtime creates and removes its isolated workdir under `os.tmpdir()` in
`scripts/t072-isolated-supabase.mjs`. Playwright preparation has its own managed
runtime in `scripts/playwright-runtime.mjs`. The T098 terminal path bypassed
those Node process wrappers and launched Deno with a narrowed environment
permission list that omitted `TMPDIR`; it also had no T098-owned temp-directory
lifecycle.

#### TMPDIR fix and regression coverage

The proven cause was fixed with `scripts/t098-owned-tmpdir.mjs` and the Node
launcher `scripts/run-feature009-terminal-path.mjs`. The helper validates the
T098-owned root and candidate temp directory by resolved path, uid, mode, and
separation from the checkout and isolated infrastructure; it checks write access
with an exclusive create/remove probe. An invalid inherited `TMPDIR` is replaced
with an owned mode-`0700` directory. The launcher grants Deno `TMPDIR` read
access and write access only to that directory. The probe passes this `TMPDIR`
to its Supabase CLI child, sets telemetry disabled, and places Supabase XDG
config below the same directory. When an already-owned T098 temp directory is
the parent of the isolated T072 workdir, the helper preserves that aligned path
so the T072 runtime prefix remains valid. The outer T098 owner removes its full
root with the rest of the disposable runtime.

`__tests__/config/t098-owned-tmpdir.test.ts` passed its two focused tests. They
use an inherited mode-`0500` temp directory, reproduce the old Deno
`NotCapable` failure with the old restricted environment permission, verify the
wrapped Deno process receives an owned mode-`0700` writable directory outside
the source checkout and fixture infrastructure, verify the replacement path and
write, and verify removal of the helper-created temp directory/root. They also
verify reuse of an already-owned path aligned with a T072 runtime and the
terminal wrapper's scoped TMPDIR, write, config, and telemetry settings.

#### Fresh-checkout gate result

The third independent candidate was reconstructed at commit
`c5928430565fa2f4a2f777cd70ccfce8333fa37a`, tree
`d8007caa2d1b790daf666f5dfd485f7ca55371a8`. It used Node `24.20.0`, npm
`11.19.0`, Deno `2.5.2`, Supabase CLI `2.116.0`, and Playwright `1.63.0`.
The complete non-charged sequence for this candidate began again from
reconstruction:

1. Reconstruction, path/mode/symlink identity — **PASS**. The YAML symlink was
   mode `120000`, target `../../../config/selection-rules.yaml`, resolving inside
   the candidate checkout.
2. YAML packaging — **PASS**.
3. Seven protected migration validators — **PASS** (membership, participant
   filters, common filter resolution, TMDB candidate source, swipe, progression,
   selection rules).
4. Reset/database suite — **PASS**; 12 migrations through
   `20260920000000`, 8 files and 933 tests.
5. Edge suite — **PASS**; its complete summary was 77 passed, 0 failed, 2 live
   tests ignored. This included the genre traversal/pushdown and four-film
   completed-empty regressions. The output-capture shell wrapper then reported a
   zsh read-only-variable error after the suite's successful summary; the suite
   itself printed its `ok` result.
6. Terminal-path probe — **FAIL** before Supabase status or SQL execution.

The new failure is distinct from the repaired TMPDIR error. The current command
`npm run check:feature009:terminal-path` invokes
`node scripts/run-feature009-terminal-path.mjs`, which runs the probe under
Deno. In `scripts/check-feature009-terminal-path.mjs:33`, Deno's Node
compatibility layer failed while preparing `spawnSync` for the Supabase CLI,
before the CLI ran: `NotCapable: Requires env access to "NODE_V8_COVERAGE", run
again with the --allow-env flag`. No Supabase status, SQL, or probe assertions
ran. The command generated UUIDs in process memory before this first spawn, but
created no Auth identities or database fixtures. The isolated database started
with zero rooms/users/rules. This gate failure requires stopping the sequence;
no subsequent T098 gates are claimed.

The first two fresh candidates after the TMPDIR change also stopped at this same
terminal-path gate before database work: candidate `7f23d08...` exposed a
mismatch between the helper's private temp child and the existing T072 workdir;
candidate `0671fc7...` lacked read permission for the exact isolated runtime
`supabase/config.toml`. Both causes were corrected narrowly before the third
candidate; neither attempt performed Auth/browser work.

For the third candidate, the disposable root was
`/tmp/otteroom-t098-tmpfix3-20260923`, owned by the T098 process with mode
`0700`; its `TMPDIR` was
`/tmp/otteroom-t098-tmpfix3-20260923/tmp`, also owned with mode `0700`. The
isolated T072 project was `otteroom-t072-pbt4sf-9987`, workdir
`/tmp/otteroom-t098-tmpfix3-20260923/tmp/otteroom-t072-supabase-Pbt4sF`, port
base `56000`. Cleanup removed the T072 workdir and its owned containers,
networks, and volumes; the disposable T098 root and diagnostic checkout/caches
were then removed. A read-only final check found the shared Supabase container
still running with the same system identifier `7688668731406098469`,
rooms/users/rules `19/49/19`, and 12 migrations. It was not reset or written.

Remaining non-charged gates in the third candidate were **NOT RUN** after the
terminal-path failure: client/config/privacy, static-security path, Playwright
preflight, lint, typecheck, web/native exports, artifact scanner,
`db:types:check`, and final `git diff --check`. Generated types remained
check-only and were not written. There were zero charged identities. T098
therefore remains incomplete and is not ready for R02 admission. Any next
attempt must address the new Deno `NODE_V8_COVERAGE` environment-permission
failure, reconstruct a new independent checkout/runtime, and rerun the complete
non-charged gate from its beginning. Do not admit R02, run C1/smoke, start
T099/T100, or start Feature 010 from this stopped run.

### T098 CONFIG_MALFORMED diagnosis and bounded repair — 2026-09-23

The retained independent candidate `e8f813c51fcfb8b70336240706fdfaac54888a2e`
reached `scripts/check-feature009-terminal-path.mjs`, whose dynamic import of
`room-candidate/index.ts` initializes selection rules at module startup. The
loader resolved its bundled asset symlink inside that candidate to canonical
`config/selection-rules.yaml`. The Deno process read 118 bytes, SHA-256
`3c0a810c7c5855986b269cee8d6759a027bc32b631b978e766b49b85ad220970`,
equal to the canonical file. Its cwd was the candidate root, and the loader's
module URL was the candidate's `_shared/selection-rules-config.ts`. File read
succeeded. The failure occurred at `parseAllDocuments`, before schema or
semantic validation. `yaml@2.9.0` reads its `LOG_TOKENS` and `LOG_STREAM` debug
switches even when unset. Deno's scoped environment permission denied those
reads; the parser catch collapsed `NotCapable` into `CONFIG_MALFORMED`.

A no-DB/no-Auth import/load probe under the retained candidate's scoped Deno
environment reproduced denial of `LOG_TOKENS`, then denial of `LOG_STREAM` when
only the former was permitted. Permitting both yielded one YAML document with
zero parse errors and a successful normalized rule generation. The same bytes
passed with the Edge test suite's broad `--allow-env` permission. The owned
`HOME`, `TMPDIR`, and `DENO_DIR` values, symlink resolution, and YAML bytes did
not differ across these probes. The earlier packaging check established bytes
and topology but did not exercise parser execution; the selection-rules startup
unit tests injected text and used broad environment permission.

The terminal launcher now permits only these two additional environment names
and sets both values empty in its bounded Deno child environment; neither name
is forwarded to the Supabase CLI child. The loader now maps missing paths and
read denial to closed errors, and parser diagnostics separate syntax from
registered internal failures. Closed failure kinds cover the validated shape,
enum, range, language, fraction, and structure cases. Regression tests check
all kinds, a host-path redaction case, and both new permission requirements.
The minimal loader, parser/startup tests, YAML packaging, terminal environment
and owned-temp tests, Edge suite, lint, typecheck, syntax checks, and
`git diff --check` passed in the source workspace before reconstruction.
No R02 admission or charged work was performed in this diagnosis.

### T098 new complete-worktree candidate — STOPPED at client gate — 2026-09-24

After the config permission repair and focused checks, the complete current
Git-visible worktree was reconstructed into a new independent detached
candidate: commit `6c48e976d7d87d7ebf3840ad7ef3bc7582b85a7c`, tree
`98f61ec0a39d0f87c0cbdae903b38992ac433cb6`, 351 paths. Manifest SHA-256:
path list `01c44d92796bd30ec6ab77bf772ae82c8fecb83b348819800c1922fff133977b`,
content `ad5464c822215c68d25a6b319874945d8efff06e9e0762e1250e21c8efd44f9c`,
mode/content/path `14f52fe56226868267677472058ff3a2c65e9cac7f0080c29`, and mode/link
`fc2d2277b66f519568f8b9493f09b449dae9419fab3b0efcd15477eba880b681`.
The YAML asset remained Git mode `120000`, target
`../../../config/selection-rules.yaml`, resolving inside the candidate. The
bundle, index, clean checkout, and receipts are retained at
`/tmp/otteroom-t098-configfix-20260923/`. The selected toolchain remained Node
24.20.0, npm 11.19.0, Deno 2.5.2, Supabase CLI 2.116.0, and Playwright 1.63.0.

The ordered non-charged gate passed YAML packaging, all seven protected
migration validators, clean reset, the database suite (8 files, 933 tests),
the Edge suite (78 passed, 2 ignored), the genre/traversal subset (63 passed),
and the terminal-path probe (`identities=0`, `result=PASS`). The next gate,
`npm run test:client`, failed: 4 of 54 suites and 14 of 851 tests failed; 50
suites and 837 tests passed. Failures were in `e2e-diagnostics`,
`database-types`, `configure-local-env`, and `feature009-e2e-profile`. The last
contains an obsolete assertion expecting the old direct Deno terminal script;
the other failures report status 1 from test subprocesses and remain
undiagnosed. Per the fail-fast gate, static security, Playwright preflight,
exports, scanners, `db:types:check`, and final lint/typecheck/diff gates were
not run on this candidate. The generated types file was not written; its
SHA-256 stayed `69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03`.

The owned project `otteroom-t072-paet7o-630a` ended with 0 rooms, 0 users, 0
rule snapshots, and 12 migrations through `20260920000000`. Cleanup removed
its runtime, containers, network, volume, dependencies, and caches. The shared
development database remained system identifier `7688668731406098469`, counts
19/49/19, and 12 migrations before and after. No R02 admission, C1, smoke,
or charged identity run occurred. T098 remains incomplete and is not ready for
the separate 17-identity repository-local admission. T096/T097 remain valid at
45 identities; T099/T100 and Feature 010 remain unstarted.

### T098 new complete-worktree candidate — STOPPED at source/config gate — 2026-09-24

T098 remains **INCOMPLETE** and is not ready for the separate 17-identity R02
admission. Feature 009 remains **REOPENED**. Feature 010 remains unstarted.

A new independent candidate was reconstructed from the then-current complete
Git-visible worktree. The candidate reconstruction and exact-source comparison
passed before dependency installation: commit `1704f345b6e78de6f878adfaaf1a9412039219f1`,
tree `240379cf7bee7025f10b732ed09021c84cd73d6a`, 352 paths and 109 changed
paths. Manifest SHA-256 values were path-list
`0118f059585c91593ca47b3abaf60e2ddb72134d3caf1a06a2bc853d009b61fc`, content
`c6de80ac4b29f30a80dd8680dc4cff514a2c6e3ee824d0c8fd301a769503d12f`,
mode/content/path `936c0c0ef576c43951b5320ddc3921b80bff9429c9fc72e9ef342299db7a0b78`,
and mode/link `7ef0ad40aecb388097d47dd0e5406701c57b667f1dca74ae70ca72ee943566e6`.
The reconstructor verified every candidate path's bytes and mode against the
intended worktree, including changed and untracked paths. No changed path fell
back to HEAD. Before install, ignored runtime/cache state, environment files,
test results, dependency/build/export state, browser/Auth/session state, and
source-workspace path dependencies were absent. Candidate and receipts are
preserved under `/tmp/otteroom-t098-recovery-20260924/`.

The canonical selection-rules asset is index/tree mode `120000`, target
`../../../config/selection-rules.yaml`, resolving inside the candidate to
`config/selection-rules.yaml`. YAML packaging passed: 118 canonical bytes, two
byte-identical assets, no client inclusion, and no environment overrides.
The exact toolchain packages were Node `24.20.0`, npm `11.19.0`, Deno `2.5.2`,
Supabase CLI `2.116.0`, and Playwright `1.63.0`. Fresh-checkout `npm ci` added
1,116 packages. Only lockfile-pinned `deno@2.5.2` and
`unrs-resolver@1.12.2` scripts were approved and rebuilt; the package manifest
was restored. The generated database types SHA-256 at stop was
`69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03`; neither
the check-only command nor any generated-types write command ran.

Gate A stopped after YAML packaging. The direct canonical-YAML parse probe used
`deno eval --allow-read=...`; Deno 2.5.2 rejected `--allow-read` as an unexpected
argument, so that invocation produced no parse result. The strict
selection-rules parser/startup suite then ran and failed: 2 passed, 6 failed.
Valid parse/startup cases raised `CONFIG_INTERNAL` at `selection-rules.ts:133`,
and malformed-input assertions received `CONFIG_INTERNAL` instead of their
expected bounded diagnostic. The full bounded output is in
`/tmp/otteroom-t098-recovery-20260924/evidence/gate-a-config.log`; the stop
receipt and install logs are alongside it.
The command wrapper had `pipefail` without `set -e`, so the parser suite ran after
the failed eval invocation; execution stopped as soon as the suite completed.

No protected migration validator, isolated Supabase runtime, reset/replay,
database or Edge suite, terminal-path probe, client/config/privacy suite,
static-security E2E, Playwright preflight, export, scanner, lint, typecheck,
`db:types:check`, or later gate ran. No Auth identity, charged browser identity,
C1, smoke, or R02 admission occurred. No shared-stack mutation was attempted.

The shared development stack matched its read-only baseline before and after:
container `27f6dccf27aaffbbf11e331114b63cc19954a6862336178e582a6841971a1502`,
PostgreSQL system identifier `7688668731406098469`, users/rooms/rules `49/19/19`,
and 12 migrations through `20260920000000`. No owned Playwright container
remained. Cleanup removed candidate dependencies and this run's owned HOME,
TMPDIR, DENO_DIR, XDG, and npm cache; the candidate, bundle, and bounded evidence
remain preserved.

T096 and T097 remain valid at 23 and 22 identities (45 total). The exact next
task is to diagnose the fresh-checkout Deno parser/startup `CONFIG_INTERNAL`
failure, then build a new independent candidate and restart the complete T098
non-charged gate from Gate A. Do not obtain R02 admission, run C1 or smoke, start
T099/T100, or start Feature 010.

### T099–T100 owner reconciliation and final current-worktree G5 audit — PASS — 2026-09-24

The owner stopped the T098 fresh-checkout recovery effort. This is an explicit
waiver of that certification path, not a pass. All T098 attempt and diagnostic
receipts above remain unchanged and historical. No new candidate checkout was
constructed; all release validation below ran from the current source worktree.
No R02 admission, C1, M01/M02, permanent smoke, live TMDB request, or anonymous
identity was run in this audit.

#### Owner evidence disposition

```text
T096 normal charged checkpoint              PASS; 23 identities
T097 unchanged-source repeatability          PASS; 22 identities
current repeatability evidence               PASS; 23 + 22 = 45 identities
T098 fresh-checkout certification            DISCONTINUED BY OWNER; NOT PASSED
planned additional T098 identities           17; not spent
T098 R02 admission / C1 / permanent smoke     none
T098 attempts and receipts                    preserved as historical diagnostics
T099 evidence reconciliation                  PASS; docs/task state reconciled
T100 current-worktree G5 audit                PASS; no charged identities
Feature 009 status                            READY FOR OWNER FINAL LIVE-TMDB CHECK
Feature 010                                   unstarted
```

The reason for closing T098 is that further fresh-checkout attempts were
exercising reconstruction, permission, and diagnostic infrastructure more than
Feature 009 product behavior. The owner waived that certification effort so work
could return to the product requirements. T096/T097 remain the governing charged
repeatability evidence. Older T080/T092 fresh-checkout receipts remain historical
for their tested sources and do not certify the T096/T097 source. No `45 + 17 =
62` current-source certification is claimed.

#### Current-worktree non-charged release validation

The default shared Supabase project correctly refused the first protected
membership migration attempt at its clean-database precondition. That attempt
stopped before reset or fixture writes. The protected runners were then run in
order against an owned isolated Supabase project configured from this worktree;
the shared development database was not reset or written. The isolated runtime
was removed after all database checks.

```text
selection-rules config/package check                  PASS; 118 canonical bytes,
                                                         two byte-identical server assets
protected nonempty migration runners                  PASS; all seven; latest reset,
                                                         fixtures cleaned, no signup
  room membership                                   PASS; migration/type bytes preserved
  participant filters                               PASS; migration/type bytes preserved
  common filter resolution                          PASS; migration/type bytes preserved
  TMDB candidate source                             PASS; migration/type bytes preserved
  swipe decisions                                   PASS; migration/type bytes preserved
  candidate progression                            PASS; migration/type bytes preserved
  selection rules                                   PASS; 10 rooms/21 members/15 filters;
                                                       historical migrations/types unchanged
clean isolated reset + database suite                 PASS; 8 files, 933 tests
Edge suite                                           PASS; 78 passed, 0 failed,
                                                         2 intentionally ignored live tests
client/config/privacy Jest suite                      PASS; 52 suites, 848 tests
zero-identity static security browser profile         PASS; 2 scenarios, 0 signups,
                                                         0 identities, 3 artifacts, 0 findings
lint                                                  PASS
typecheck                                             PASS
web export/build                                      PASS; 5 static routes
db:types:check                                        PASS; check-only
git diff --check                                      PASS
generated database types                              unchanged; SHA-256
                                                         69f63e689f5bb9b45ffdc095a12ba5697c4c01335de117bc1e502bb71fdacc03;
                                                         inode 11577831, size 20779 bytes
Feature 009 charged acceptance, smoke, or C1          NOT RUN by instruction
live TMDB contract/manual scenario                    NOT RUN; owner action remains
```

`npm run db:types:check` was the only generated-types operation. No generated
types were written or regenerated. The static security profile was invoked as
`npm run test:e2e:security -- --grep @diagnostics-static`; it ran only synthetic
A/B diagnostics and did not contact Auth or create identities. The Deno Edge
suite's two live tests were intentionally ignored.

#### G5 product and regression audit

The audit maps the current implementation and executable evidence back to the
unchanged product inventory: 40 functional requirements, nine non-functional
requirements, 11 success criteria, 43 acceptance scenarios, and six user stories.
The current source and normal validation support these product conclusions:

- Startup parses one canonical server-only configuration generation. Room
  creation snapshots the normalized rules atomically; the rule snapshot has no
  participant mutation path. Existing rooms have an explicit legacy snapshot.
- The configured ordering map is closed and includes vote count descending,
  average rating descending, popularity descending, and title ascending.
  `vote_count.gte` is applied and checked locally; retained metadata language
  flows through Discover and Details from the immutable room snapshot.
- Genre predicates remain OR within each voter and AND across voters. The
  compiler removes duplicate IDs and redundant superset clauses before safe
  pushdown; unrepresented clauses remain in authoritative Edge and PostgreSQL
  validation.
- Larger groups use exact rational ceiling arithmetic. N=2 remains 2/2. The
  database resolves only after the complete fixed voter decision set, preserving
  no-early-resolution behavior.
- Numeric traversal uses a provider-sorted prefix proof only while primary
  values are monotonic, completes primary ties across pages, and falls back to
  bounded exhaustive local comparison after a provider primary regression.
  Request and deadline budgets remain 100 requests and 20 seconds. Incomplete
  work retains `request_budget`/`deadline`; a completed empty result requires a
  complete proof. The corrected four-film regression reaches exhaustion without
  a false `ordering_inconsistent` result.
- No-repeat exclusions, expected-sequence CAS, progression history, and terminal
  empty commits remain database-authoritative. Legacy rooms keep legacy ordering,
  cutoff, language, genre, and agreement behavior after restart.
- T096/T097 charged browser evidence remains valid at 45 identities; the final
  live TMDB sequence remains the one owner-driven release check below.

No unresolved Feature 009 product defect was found by this audit. The owner
manual live-TMDB check remains outstanding by design. Feature 010 has not started.

#### Owner manual live-TMDB release scenario

Create a three-voter room under the current canonical server rules
(`minimum_vote_count=500`, `ordering=vote_count_desc`). Set voter 1 to Crime,
voter 2 to Comedy, and voter 3 to Science Fiction; set each voter's release-year
range to 1900–2026. For each displayed candidate, have all three voters submit
decisions with two `no` and one `yes`, so the 2/3 rule does not agree and
progression waits for the complete decision set.

Expected live sequence based on the last verified TMDB state:

1. Despicable Me
2. Minions: The Rise of Gru
3. Robot & Frank
4. Batman vs Teenage Mutant Ninja Turtles
5. Exhausted / completed_empty

The release invariant is valid eligible descending progression followed by
authoritative exhaustion, with no `request_budget`, `deadline`, or incorrect
`ordering_inconsistent`. TMDB is live, so exact vote counts are not immutable.
After this owner-run manual check passes, Feature 009 is ready for the intended
commit `feat: add selection rules and candidate ordering`. Do not start Feature
010 before then.

This T099/T100 addendum supersedes earlier contemporaneous T098 entries that
described T098 as the exact next task. Those receipt bodies remain preserved to
show what was known at the time; none is a current instruction or a T098 pass.

### Owner mixed-clause product regression — 2026-09-24

Feature 009 reopened when voter clauses `(Comedy OR Science Fiction)`,
`(Comedy OR Crime)`, and `(Crime OR Science Fiction)` reached a source deadline
after four rejected candidates. The predicate is true for a film with at least
two of Comedy (35), Crime (80), and Science Fiction (878). The previous compiler
normalized the clauses to `[[35,80],[35,878],[80,878]]`, classified its one
query as partial, and sent `with_genres=35|80`. The exact remaining local clauses
were `[35,878]` and `[80,878]`.

Bounded live Discover diagnostics for the retained 1900–2026 range,
`vote_count.gte=500`, and `vote_count.desc` found 3,795 results / 190 pages
for `35|80`; only four of its first 20 rows were locally eligible. The exact
pair branches reported `35,80`: 322 results / 17 pages; `35,878`: 202 / 11;
and `80,878`: 31 / 2. A single old-source replay after excluding the four
highest eligible IDs observed a primary vote-count regression on page 2 and
reached the 100-request budget at page 100 in 16.7 seconds. The owner's four
concurrent attempts reached the 20-second deadline; their precise per-attempt
request counts were not present in the supplied logs. Both limits reflect the
same broad partial query plus loss of numeric prefix proof. The earlier
three-singleton query `35,80,878` has four results on one page and therefore
proved its fourth successor and then completed empty cheaply.

The source now computes up to 12 minimal satisfying genre sets, queries each
as a comma-AND branch, and merges only completed branch winners with the local
total comparator and TMDB-ID tie-break. Every branch shares the existing
request/deadline budget; any incomplete branch prevents a candidate or empty
commit. An intermediate or final branch count above 12 keeps the previous safe
single-query fallback and authoritative local clause checks. The owner clauses
decompose to `35,80` OR `35,878` OR `80,878`. A bounded live source replay with
the same four exclusions returned the fifth eligible movie in three Discover
requests and 1.3 seconds. No room or browser identity was created.

Deterministic validation: full Edge 85 passed / 2 intentionally ignored;
client candidates, decisions, progression, room and route tests 475 passed;
fresh disposable local database 933 passed across eight files; lint,
typecheck, `db:types:check`, and `git diff --check` passed. The default local
database had pre-existing rows and five global-count fixture assertions failed
there; the disposable clean run passed and was stopped and removed. This is
source readiness for the owner to rerun the same manual mixed-clause scenario,
not owner browser acceptance. T098 remains discontinued; Feature 010 remains
unstarted; no commit was made.

### Documentation release-boundary reconciliation — 2026-09-25

The mixed-clause source correction above followed the T096/T097 charged browser
runs and the T100 G5 audit. Those passes remain valid for their original source
and do not certify the later correction. The correction's deterministic,
clean-database and bounded live source replay evidence is recorded above. The
owner's latest-source mixed-clause browser recheck remains pending (T102); no
additional browser run, R02 admission or fresh-checkout certification is claimed.
T098 remains owner-waived/discontinued, not passed, with zero of its planned 17
additional identities spent. No 62-identity fresh-checkout certification exists
for the T096/T097 source.

The unchanged current `config/selection-rules.yaml` contains
`minimum_vote_count: 100`, `metadata_language: en-US`,
`ordering: popularity_desc`, `genre_mode: or`, and
`larger_group_agreement: 2/3`; `minimum_average_rating` is omitted. These are
editable operational settings applied to newly created rooms after startup, not
fixed product requirements. The earlier owner scenario above was written for
the historical `500`/`vote_count_desc` generation and its expected title order
must not be used as the current acceptance oracle. For the current recheck,
create a new room under the active YAML and use the recorded mixed voter genre
clauses. Verify candidate eligibility, configured popularity ordering, complete
decision-set progression and correct incomplete-versus-exhausted behavior; record
the actual live sequence because TMDB data can change. Feature 010 Discovery is
future, unspecified work; Feature 011 Match remains unstarted.

### Owner latest-source manual release recheck — PASSED — 2026-09-25

The owner reports that the manual live-TMDB browser regression passed on the
latest Feature 009 product source after the mixed-clause exact-provider-decomposition
fix. The scenario used three voters, years 1900–2026, and these voter clauses:

- Comedy OR Science Fiction;
- Comedy OR Crime;
- Crime OR Science Fiction.

The previously failing flow progressed beyond the first four rejected
candidates. All clients converged on the next candidate. The previous `deadline`
failure did not recur; no `request_budget` or incorrect
`ordering_inconsistent` was observed. This is the owner manual validation of the
mixed-clause fix, completing T102 and superseding the prior pending-recheck
instruction above. No application code changed after this
successful recheck. T096/T097 remain historical 45-identity evidence for their
earlier source; this owner receipt does not reclassify those runs or T100 G5 as
later-source certification. T098 remains owner-waived/discontinued, not passed;
no 62-identity fresh-checkout certification is claimed.

The owner subsequently also exercised the current operational YAML values
`minimum_vote_count: 100` and `ordering: popularity_desc` and observed valid,
more varied candidates. This is operational/configuration evidence, not an
additional Feature 009 product requirement. The later changes were operational
YAML experimentation and documentation only. Feature 009 is release-complete
and ready to commit, with no release blocker remaining. Feature 010 Discovery
remains deferred/unstarted; Feature 011 Match remains planned/unstarted.
