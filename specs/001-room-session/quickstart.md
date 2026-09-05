# Quickstart Plan: Create and Join a Two-Person Room

**Feature**: `001-room-session`
**Host environment**: Linux
**Status**: Planned workflow for the future implementation

The commands below describe the reproducible interface the implementation must
provide. They are not claimed to work in the current planning-only repository.
There are no Dashboard schema steps, manually executed SQL files, copied
production secrets, hosted Supabase dependency, mobile emulator requirements, or
globally installed Supabase CLI requirements.

## Environment Prerequisites

- Git.
- Node.js `24.20.0` LTS with its bundled npm.
- Docker Engine with a running daemon and Docker Compose support.
- A browser supported by Playwright.
- Local ports required by Supabase and Expo, including Expo web port `8081`,
  available.

The project-local stable Supabase CLI `2.116.0` is installed by `npm ci`; its
committed generated configuration uses local PostgreSQL major `17`. Stable
`@playwright/test` `1.63.0` is also locked; its official release was published
2026-09-04 and is not a prerelease. Do not install or invoke a global Supabase or
Playwright CLI.

Prerequisite checks:

```bash
node --version
npm --version
docker version
docker compose version
```

The Node command must report `v24.20.0`. Docker commands must reach the local
daemon.

## Planned Fresh-Clone Setup

After the feature is implemented and committed, a new checkout will use:

```bash
OTTEROOM_REMOTE_URL="$(git remote get-url origin)"
OTTEROOM_FRESH_DIR="$(mktemp -d)"
git clone "$OTTEROOM_REMOTE_URL" "$OTTEROOM_FRESH_DIR/otteroom"
cd "$OTTEROOM_FRESH_DIR/otteroom"
```

Then run the complete trap-managed normal validation sequence below. It uses
`npm run db:types:check` only; the committed artifact must already exist.
Do not regenerate it while verifying a fresh clone.

The planned `env:local` Node wrapper invokes the project-local CLI as
`supabase status --output env`, captures stdout without echoing it, and parses an
allowlist. It requires `API_URL` and chooses `PUBLISHABLE_KEY` when present,
otherwise the legacy client-safe `ANON_KEY`. It writes exactly one assignment
for `EXPO_PUBLIC_SUPABASE_URL` and one for
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the ignored `.env.local` file. Mapping
local `ANON_KEY` to the application's publishable-key variable is deliberate:
both are client-safe local credentials for the public client role.

The wrapper validates an HTTP(S) URL and a nonempty selected client key, writes a
temporary file with restrictive permissions, and atomically replaces
`.env.local`; repeated execution therefore produces the same two-line result.
It fails with an actionable message naming only missing safe fields and never
prints or writes `SECRET_KEY`, `SERVICE_ROLE_KEY`, a database password, a JWT
signing secret, any other status field, or the full payload. `.env.example`
contains exactly the same two names with non-secret placeholders. Real `.env`,
`.env.local`, and other machine-local variants are ignored.

Expected results:

- `npm ci` reproduces the committed dependency graph from `package-lock.json`.
- `supabase:start` starts the PostgreSQL-17 local stack with anonymous sign-ins
  enabled and legacy automatic table exposure disabled.
- `env:local` creates only the two client-safe public values.
- `db:reset` recreates `public.rooms`, constraints, RLS, grants, RPCs, and the
  Realtime publication entry solely from versioned migrations.
- `db:types:check` verifies the existing committed TypeScript schema artifact
  byte-for-byte without modifying it; missing or stale content fails.

## Planned npm Script Interface

The future root `package.json` will expose these commands:

| Script | Underlying command / responsibility |
|---|---|
| `npm run lint` | `expo lint` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:client` | `jest --runInBand` with `jest-expo` |
| `npm run supabase:start` | `node scripts/safe-process.mjs supabase:start`; project-local `supabase start`, no raw startup output persistence |
| `npm run supabase:status` | `node scripts/safe-process.mjs supabase:status`; project-local status, safe allowlisted diagnostics only |
| `npm run supabase:stop` | `node scripts/safe-process.mjs supabase:stop`; project-local stop with preserved exit/cleanup |
| `npm run env:local` | project-local status wrapper; maps `API_URL` plus `PUBLISHABLE_KEY` or fallback `ANON_KEY` to only the two Expo public values |
| `npm run db:reset` | project-local `supabase db reset` |
| `npm run db:types` | `node scripts/database-types.mjs write` |
| `npm run db:types:check` | `node scripts/database-types.mjs check` |
| `npm run db:test` | project-local `supabase test db` |
| `npm run web` | `expo start --web --port 8081` |
| `npm run web:e2e` | `node scripts/safe-process.mjs web:e2e`; project-local `expo start --web --port 8081` with `CI=1`, sanitized/suppressed process output |
| `npm run web:export` | `expo export --platform web` |
| `npm run playwright:install` | project-local locked `playwright install chromium` |
| `npm run test:e2e:security` | `node scripts/run-e2e.mjs security`; project-local Playwright `credential-safety` project and finalized-artifact scanner |
| `npm run test:e2e` | `node scripts/run-e2e.mjs acceptance`; project-local Playwright `acceptance` project and finalized-artifact scanner |

### Deterministic generated database types (R01 resolved)

Canonical artifact: `src/types/database.generated.ts`, committed with the
implementation and reviewed with each intentional migration/RPC schema change.
Its source is the complete local database rebuilt by `npm run db:reset` from
versioned migrations, using project-local Supabase CLI `2.116.0`.

One planned script, `scripts/database-types.mjs`, exposes exactly:

| npm command | Package script | Purpose |
|---|---|---|
| `npm run db:types` | `node scripts/database-types.mjs write` | Initial generation or intentional update |
| `npm run db:types:check` | `node scripts/database-types.mjs check` | Non-mutating consistency validation |

Both modes spawn `supabase gen types --lang typescript --local --schema public`
through the npm execution PATH, resolving the installed project executable, not
a global CLI or downloading an alternative. They require the local stack running
and all current versioned migrations applied; no login, linked/hosted project,
schema mutation, or Git command is involved.

Write mode streams generator stdout into a unique temporary file on the
canonical target's filesystem, checks successful exit and nonempty output,
closes the file, and only then atomically renames it over the canonical artifact.
Any generator/empty-output/write/rename failure returns nonzero and preserves
the prior target; failed initial generation leaves no canonical artifact.

Check mode first requires the canonical file to exist, generates into a unique
temporary file, validates successful exit and nonempty output, then compares
raw bytes with the existing canonical file without rewriting or normalizing it.
Missing canonical file, generator failure, empty output, unreadable target, or
mismatch returns nonzero. A match returns zero without changing the canonical
file or repository contents. Tracked, staged, modified, and untracked targets
obey identical rules; the Git index is never a correctness boundary.

Both modes close handles and remove their temporary file in guaranteed cleanup
on success, failure, and handled interruption; cleanup failure is reported, not
silently accepted. Diagnostics name the failed stage and canonical path, with
a bounded actionable mismatch message (byte lengths and first differing offset,
then guidance to inspect the migration and intentionally update if appropriate).
Do not dump credentials, raw CLI status, or unlimited generator stderr.
Serialize write/check with migrations and other type operations.

Initial generation or an intentional schema update uses `npm run db:types`
followed by `npm run db:types:check`, then reviews the generated change with the
migration. Normal phase gates and fresh-clone verification use only
`npm run db:types:check` after reset; never overwrite immediately before that
validation to conceal drift. A Git diff may aid human change review but is not
acceptance evidence.

Wrapper behavior tests in `__tests__/config/database-types.test.ts` cover both
modes, missing/mismatch/generator-failure/empty-output, atomic replacement,
prior-target preservation, cleanup, actionable diagnostics, and equality without
repository metadata. Synthetic subprocess fixtures may isolate wrapper I/O;
they do not replace the real reset-and-check database checkpoint.

#### Initial generation or intentional schema update

With the local stack running and the approved migrations fully replayed:

```bash
npm run db:reset
npm run db:types
npm run db:types:check
```

Review the changed canonical file together with its migration/RPC schema change
and include it in the implementation baseline. This procedure intentionally
updates types; it is not normal drift validation.

#### Normal verification

With the local stack running:

```bash
npm run db:reset
npm run db:types:check
```

A failure is not auto-repaired. Inspect the migration and artifact first; use
intentional update only when the schema change is approved.

Playwright configuration starts `npm run web:e2e` as its managed web server,
sets `url: 'http://127.0.0.1:8081'` for readiness instead of sleeping, and uses
`reuseExistingServer: false`. It disables trace/HAR/video and storage exports;
only C1-guarded failure screenshots and sanitized diagnostics may be retained.
It terminates its owned web process. Set `retries: 0` and `repeatEach: 1` for
the standard full run; intentional repeated selections are accounted separately.
The local Supabase stack is already running and reset before E2E begins; the
outer validation trap owns its cleanup.

### Credential-safe E2E diagnostics (C1 resolved)

This is a planning-level security contract, not evidence of an actual leak or
a completed runtime check. For pinned Playwright `1.63.0`, both projects use
`trace: 'off'`, `video: 'off'`, and automatic `screenshot: 'off'`.
No HAR recorder, explicit tracing API, raw network/request/response/WebSocket
dump, cookie/session dump, or disk `storageState` export/import is allowed.
The app's approved `persistSession: true` within one isolated browser context
is unchanged: prohibiting diagnostic storage exports does not disable reload
persistence or require another sign-in.

Only guarded failure PNGs and bounded sanitized text/JSON diagnostics may be
retained: application/browser messages, test error/stack, approved process/service
excerpts, static test/scenario and participant/context labels, room code/state,
HTTP status, and closed business outcome. Never retain access/refresh tokens,
JWTs, Authorization values, cookies, Supabase session objects, service-role/secret
keys, or database passwords. No unrestricted HTML/JSON/blob reporter, API step
arguments, browser-console object serialization, unrestricted source/DOM dump, or debug logging
is enabled. Ignore rules and eventual deletion do not authorize initial capture.

Planned support is deliberately test-only; it introduces no application API:

- `e2e/support/sanitize-diagnostics.ts`: one shared pure sanitizer for strings
  or explicitly selected structured diagnostic fields, never raw object dumps.
  Redact secret field names case-insensitively, including access_token,
  refresh_token, authorization, cookie/set-cookie, service_role/service-role,
  secret/secret_key/password variants; also redact bearer values, JWT-like
  three-part shapes, known runtime credentials, and Supabase secret-key shapes.
  Process nested diagnostic fields with bounded depth and fail closed on
  unsupported/cyclic/oversized input; redact before truncation, at most 4 KiB per
  record and 64 KiB text per test. Do not emit partial raw stream chunks.
  Synthetic sentinels are generated at runtime, never usable credentials.
  The helper uses Node-24-compatible erasable TypeScript without path aliases.
- `e2e/support/credential-registry.ts`: per-run/per-context in-memory registry
  of known sensitive values, including refreshed tokens and any credentials
  received for test-only operations. The registry is never serialized, logged,
  attached, persisted, or used as a cross-test session cache. The controller
  receives registration values via a dedicated owner-only Unix-domain socket
  in a mode-0700 temporary directory; only its non-secret endpoint path reaches
  workers. Credential values never enter argv, environment, stdout or files.
  Framed registration messages cross this memory-only IPC, never a registry
  snapshot; await acknowledgement before diagnostic use. Missing/closed IPC
  aborts before diagnostics; close clients and remove the socket in cleanup.
  Retain a context's values until it is closed and its finalized artifacts have
  been scanned, then clear them; clear all references in controller `finally`
  on success/failure/interruption. No test failure prints the detected value.
- `e2e/support/safe-diagnostics.ts`: shared context fixture/collector installs
  observers before navigation, registers Auth values in memory before diagnostic
  use, closes contexts/interceptors in `finally`, and blocks explicit tracing,
  HAR, storage exports, and raw dumps. Network observers used by race/reconnect
  tests may inspect/forward real traffic in memory but never persist it.
  A screenshot is an explicit failure-only call, not automatic runner capture:
  first assert in memory that known credentials and token-like values are absent
  from rendered text, input values and visible attributes. Use boolean-only
  assertions with generic errors, never assertion diffs of secrets/DOM.
  Capture only the checked application viewport with animations disabled;
  if inspection fails, is incomplete, or the page changed during capture,
  discard the in-memory PNG without writing it and fail the safety check.
  No unverified page, third-party frame, canvas, debug overlay, or video is
  captured. Normal tests separately check the no-credential UI rule; it changes
  no product behavior.
- `e2e/support/safe-reporter.ts`: sole reporter writes a bounded allowlisted
  summary; it never serializes raw TestResult/errors/steps/attachments/stdout.
  Worker errors and allowed log excerpts are sanitized before persistence;
  unclassified stdout/stderr and raw error objects are suppressed, not forwarded.
  Keep a safe failure category, sanitized stack location, and exit status.
  Set `PLAYWRIGHT_NO_COPY_PROMPT=1` before worker startup to suppress the pinned
  runner's automatic page snapshot. This internal pinned-version switch is not
  a general redaction API: automatic `error-context.md` can still contain error
  messages/source, so all test/fixture exception boundaries convert raw failures
  to sanitized errors without raw causes or matcher errorContext before the
  runner sees them. Export a safe test-body/hook wrapper from the collector;
  every Auth test uses it rather than relying on fixture teardown to catch an
  already-reported assertion. No soft assertions, raw matcher attachments or
  secret-bearing test/step names are permitted. Recreated safe-error stacks
  point to the checked helper, so automatic source excerpts contain no runtime
  value; the finalized scan includes error-context.md. Credential assertions
  never interpolate their values. The real failure probe checks these outputs.
- `scripts/safe-process.mjs`: npm start/status/stop and managed `web:e2e`
  wrappers use project-local binaries and preserve exit/signal/cleanup behavior.
  Supabase startup/status and web stdout/stderr are captured, never inherited or
  teed into an artifact. Emit fixed component/status diagnostics by default;
  persist only bounded, explicitly approved excerpts through the shared
  sanitizer. Drop unclassified output; raw service logs are not collected.
- `scripts/check-e2e-artifacts.mjs`: CLI accepts an artifact directory; its
  exported scanner also accepts known values directly by in-process reference
  from the registry (no secret argv/env/file/registry serialization). Recursively
  scan finalized text/JSON-like files, decoded JSON string values and token-like
  patterns, and reject trace.zip/other trace files, HAR, storage-state,
  raw cookies/session dumps, and unapproved archives/artifacts by name and type.
  Reject unreadable paths, symlinks/escape, or incomplete scans; bounded streaming
  must not silently skip text after a limit. PNG content bytes are not text-scanned:
  only validated PNG format/metadata and the collector's UI guard authorize them;
  this is not an OCR guarantee. Video is forbidden. Never unpack/write a trace
  for inspection. Nonzero on violation; output only safe relative filename,
  category and redacted finding type, never the matching value/snippet.
- `scripts/run-e2e.mjs`: controller owns the registry/private IPC, runs the
  installed npm-PATH Playwright executable, sanitizes or suppresses subprocess
  output before any persistence, waits for reporter/context/process artifact
  finalization, then invokes the scanner in-process over the entire invocation
  directory. Each invocation has an isolated directory below `test-results/`;
  no later run overwrites unscanned evidence. Preserve a normal test failure and
  additionally fail on scanner/config/capture/cleanup failure. CLI overrides for
  trace, UI/debug mode, reporters or unsafe output paths are rejected before Auth;
  approved grep/workers/repeat-each selections remain available and budgeted.
  No controller/worker owns a persistent browser profile or stored session file.

The scanner and sanitizer are defense in depth. The primary protection is
preventing sensitive network/session capture, not cleaning it after writing.

**Command surface**: `npm run test:e2e:security` maps to
`node scripts/run-e2e.mjs security` (project `credential-safety`, matching only
`e2e/diagnostics/credential-safety.spec.ts`). `npm run test:e2e` maps to
`node scripts/run-e2e.mjs acceptance` (project `acceptance`, matching only
`e2e/room-session.spec.ts`). Both use `playwright.config.ts`, Chromium,
`retries: 0`, `repeatEach: 1`, the same capture policy/collector/reporter,
and `workers: 1` / `fullyParallel: false` for the credential-safety project;
its A/B checks precede C. Later acceptance multi-worker evidence changes only
the acceptance project, never the security project's order or one-signup cap.
Both retain managed web readiness URL and guaranteed cleanup. No automatic project
dependency causes the security probe to run inside the N = 47 acceptance suite.

The pre-Auth selection `npm run test:e2e:security -- --grep @diagnostics-static`
runs only A/B with zero sign-ins and no retained ordinary failure screenshots.
It is labeled synthetic-only, never accepted as the unfiltered real-Auth safety
gate. Negative scanner fixture files use isolated temporary test directories,
not the retained invocation artifact tree; clean them after the negative check.

**Executable safety evidence** in `e2e/diagnostics/credential-safety.spec.ts`:

1. A — inspect resolved runtime/project config and actual context factory
   options; assert trace/video/automatic screenshots off, no HAR or storage
   persistence, no raw dumping, safe reporter, copy-prompt guard, and rejected
   unsafe overrides. Exercise forbidden recorder/storage calls and confirm they
   fail before capture. Runtime negative cases use only synthetic data, no Auth;
   grep/source inspection alone is insufficient.
2. B — execute the real sanitizer/scanner/registry with mixed-case nested secret
   fields, bearer/JWT/access/refresh/Authorization/Cookie/Set-Cookie/service-role
   and secret-key sentinels. Check safe output and bounds, chunk boundaries,
   registry cleanup, scanner nonzero and value-free diagnostics for synthetic
   leaking text/JSON files and forbidden filenames. Never write real credentials
   as a scanner negative fixture or print sentinel comparisons on failure.
3. C — separate controlled-failure probe: create exactly one real temporary
   Anonymous Auth session in one isolated context against local Supabase,
   register its current access/refresh values over the private memory-only
   registration IPC, verify Auth success and no credentials rendered, then
   deliberately fail with the stable `CONTROLLED_AUTH_DIAGNOSTIC_FAILURE`
   error. Use the same ordinary failure collector/reporter; finalize screenshots,
   sanitized logs/error/stack, process excerpts and runner-generated artifacts.
   The controller requires A/B pass, exactly that one expected failing probe,
   the Auth-success/one-signup and cleanup receipts, and a clean recursive scan
   against the complete registry plus patterns/forbidden names. Only then may
   it translate the expected inner Playwright nonzero exit into security-command
   zero. Missing/unexpected failure, Auth 429, extra signup, absent evidence or
   any scanner/capture/cleanup failure stays nonzero; no broad `|| true`,
   `test.fail()` masking of scanner errors, or fabricated Auth success.
   The probe is excluded from normal acceptance discovery.

Implement the policy/helper/controller and synthetic runtime checks before any
retained browser diagnostics; run the complete real-Auth safety gate after the
mounted Auth bootstrap exists but **before the first ordinary @auth checkpoint
and every subsequent Auth acceptance gate**. The safety probe itself is the only
pre-gate authenticated exception and uses the same fail-closed capture policy.
Fresh-clone order is browser install → `npm run test:e2e:security` →
`npm run test:e2e`; no generated-type overwrite is introduced.

**C1 quota accounting, without changing R02**: security A/B use zero sign-ins;
C uses at most 1 per security invocation with no retries. The separate full
acceptance suite remains N = 47, two full runs ≤ 94, three ≤ 141, and local
`anonymous_users = 150` is unchanged. One security + full validation pair is
≤ 48; three pairs are ≤ 144. The two-full-run repeatability procedure runs
security once first, so reserve 95 total (1 + 94), without Supabase restart
between suites. Count failed probes, targeted retries and prior hourly usage;
429 remains test-environment budget failure. Stop/start applies config changes,
never bypasses quota; db reset is not an Auth counter reset.

## Planned Local Web Startup

With setup complete:

```bash
npm run web
```

Expected result: the Expo web application is available at
`http://127.0.0.1:8081/`, the `/` route shows Create Room and manual-code
controls, and no Android emulator or iOS simulator is required.

## Browser Two-Participant Verification

This is the manual observable check after implementation:

1. Open `http://127.0.0.1:8081/` in one fresh browser context.
2. Select Create Room. Confirm a path matching `/room/[0-9A-F]{10}`, Waiting,
   `1 of 2`, and an absolute invitation URL.
3. Open that exact invitation URL in a second isolated browser context. Confirm
   the second context joins as guest and displays Ready with `2 of 2`.
4. Without refreshing the first context, confirm it also changes to Ready with
   `2 of 2`.
5. Open the link in a third isolated browser context and confirm Room Full with
   no room details.
6. Reload the host and guest contexts and confirm both recover the same Ready
   room without another seat.
7. In a separate reset scenario, copy the canonical code into the home route of
   a fresh guest context and confirm it reaches the same join behavior as the
   direct link.

Each isolated context owns different browser storage and therefore a distinct
anonymous Auth identity. A reload in the same context preserves its identity.

## Complete Planned Automated Validation

From a fresh clone, after verifying prerequisites:

```bash
set -eu

cleanup_otteroom_services() {
  npm run supabase:stop || true
}

trap cleanup_otteroom_services EXIT
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

`npm run playwright:install` installs the browser binary with the project-local
version already locked by `npm ci`; it cannot choose a new application
dependency. The trap is installed before service startup, so Supabase is stopped
after a failed reset, build, browser install, or E2E command as well as after an
interrupt. On success the explicit stop runs and the trap is removed. Playwright
itself terminates the managed Expo web server on pass or failure.

Expected evidence:

- lint and strict typecheck pass;
- client behavior tests pass without static snapshots serving as primary proof;
- clean migration replay and generated database types agree;
- pgTAP proves schema, constraints, generated state, RLS/grants, both RPCs,
  disclosure, non-mutating failures, and real two-session duplicate-create and
  final-seat races under actual `anon`/`authenticated` roles and JWT claims;
- production web export completes into Expo's generated output directory;
- unfiltered `test:e2e:security` passes runtime config/sentinel tests and its
  real-Auth controlled-failure/artifact-scan gate before full acceptance;
- Playwright proves all twelve real local-stack scenarios using isolated browser
  contexts and no Supabase mocks; and
- local Supabase services stop successfully.

Playwright timeout values are harness safety limits only, not product performance
requirements.

The clean `db:reset` immediately before validation supplies the suite baseline.
Each browser scenario then creates its own new room and isolated Auth contexts,
uses no fixed room code or shared participant, and can run independently of test
order. Database residue from one scenario cannot select another scenario's
random room; the explicit unrelated-room case still proves RLS with a known ID.
Only C1-approved failure artifacts are retained below the controller's isolated
`test-results/` invocation directory after capture guards and the recursive scan.
Never enable `--trace`, UI/debug recording, HAR or storage exports to diagnose a
failure. Ordinary checks use security then acceptance; raw credentials must never
be stored, even temporarily or in ignored outputs. No runtime gate ran here.

## Playwright Acceptance Matrix

The future E2E suite must cover:

1. host creates and sees Waiting;
2. guest opens the generated absolute invitation link;
3. guest joins and both contexts reach Ready without host refresh;
4. guest joins through manual room-code entry;
5. third participant is rejected from a full room;
6. two distinct guests race for the final seat and exactly one succeeds;
7. host reload preserves host membership;
8. guest reload preserves guest membership;
9. repeated join creates no duplicate seat;
10. malformed code changes no room;
11. nonexistent code changes no room; and
12. an unrelated participant cannot read another room's state.

### Local Anonymous Auth budget (R02 resolved)

The standard full run is one Chromium suite invocation with `repeatEach: 1`
and `retries: 0`, including E01–E12 and all already-required regression variants
plus the Auth smoke. The conservative upper bound is **N = 47** new anonymous
sign-ins (also at most 47 dispatched signup requests in a passing run).
The following allocation is binding on test design, not a measured result:

| Browser scenario | Fresh-sign-in allocation (separate trials unless stated) | Maximum |
|---|---|---:|
| E01 — host creation | success host 1 + pre-acceptance failure host 1 + committed-response-loss/retry host 1 | 3 |
| E02 — generated invitation link | host 1 + guest 1; convergence and repeated entry extend this trial | 2 |
| E03 — two-client Ready | normal host/guest 2 + missed-initial-event host/guest 2 | 4 |
| E04 — manual code | normal host/guest 2 + pre-acceptance join-failure/retry host/guest 2 | 4 |
| E05 — third participant | host 1 + accepted guest 1 + rejected third 1; strengthen the smoke in place | 3 |
| E06 — final-seat race | host 1 + two distinct competing guests 2; one trial in a standard run | 3 |
| E07 — host continuity | Waiting reload host 1 + Ready reload host/guest 2 + missed-change host reconnect host/guest 2 | 5 |
| E08 — guest continuity | guest reload host/guest 2 + guest reconnect host/guest 2 | 4 |
| E09 — repeated join | host 1 + guest 1; repeated and overlapping joins reuse both identities | 2 |
| E10 — malformed invitation | manual context 1 + direct-route context 1, conservatively assuming both bootstrap | 2 |
| E11 — nonexistent code | one bootstrapped caller; no extra owner or existence-probe identity | 1 |
| E12 — isolation/manipulation | known-ID read with two room owners 2 + UPDATE isolation with target host/guest and unrelated owner 3 + stale navigation with two hosts and one joining participant 3 + direct-write attacks with host/guest/outsider 3 | 11 |
| E01–E12 subtotal | All required normal and regression trials above | 44 |
| Auth infrastructure smoke | original context 1 + fresh context 1 + explicitly cleared original storage 1; reload adds zero | 3 |
| Standard full suite | E01–E12 plus Auth smoke; no uncounted setup identities | 47 |

Reload, reconnect, token refresh, create/join retry, and repeated join add **zero**
identities when storage is retained. Merely creating a browser context adds zero
until it actually signs in. No hidden fixture/bootstrap users are allowed.
Fresh trials never share identities across scenarios. If variants are combined,
actual usage may be lower; adding trials requires recalculating this table and
all four artifacts before claiming the existing budget. No test retries or
extra suite repetition are hidden in a standard run.

Commit only the following local-development Auth choices in the future
`supabase/config.toml`, retaining all other Auth rate limits unchanged:

```toml
[auth]
enable_anonymous_sign_ins = true

[auth.rate_limit]
anonymous_users = 150
```

The fixed value is `max(120, 10 * ceil((3 * 47) / 10)) = 150` sign-ins/hour/IP.
Three full sequential runs consume at most **141**, leaving 9 for other counted
signups. This is a local-only development/test setting, not a production
recommendation; no hosted configuration, CAPTCHA, or abuse-control work is added.

Configuration takes effect on local stack startup. After changing it, execute
`npm run supabase:stop`, then `npm run supabase:start`; validate the committed
values and successful startup before browser tests. Neither `npm run db:reset`
nor test-data cleanup is treated as clearing the hourly Auth counter. Tests
never depend on restart to bypass the limit.

Bootstrap has one in-flight sign-in, no automatic anonymous-sign-in loop, and
at most one sign-in call per explicit bootstrap/retry action after checking
storage again. Tests never retry failed Auth automatically or clear storage to
recover an existing participant. Before navigation, test-local observers count
actual anonymous signup attempts and successful identities, enforce each row's
cap, and assert zero new sign-ins on same-context reload/reconnect. Close every
context/observer in fixture `finally`, including failure paths.

An Auth HTTP 429 aborts the affected run as **test-environment budget failure**;
report the scenario, safe request count, N = 47, configured limit 150, and advice
to check configuration/restart-after-change and remaining hourly allowance.
Never log tokens or raw Auth bodies, fabricate successful Auth, silently retry,
or restart/reset to evade exhaustion. Diagnose additional bootstrap requests as
a test/application defect, not a reason to raise unrelated rate limits. If the
remaining allowance is insufficient, stop and rerun after the hourly allowance
recovers; do not implement an in-suite sleep/retry loop.

Keep a sanitized per-run accounting record, including partial/failed attempts
and other local manual signups in the same hour/IP. Independent selections,
`--repeat-each=3`, multi-worker evidence and diagnostic reruns consume additional
allowance; they are not silently included in one N = 47 run. Admit a three-run
block only with at least 141 allowance remaining, or a two-run block with 94.
After unknown prior usage or exhaustion, wait for allowance recovery outside
the test harness. Unlimited repeated runs are not promised.

Daily/fresh-clone validation runs one full suite (at most 47). A separate
implementation-time repeatability checkpoint starts one local stack, performs
suite-level reset/check, runs the full suite twice sequentially with fresh
contexts and separately recorded counts (at most 47 + 47 = 94), and stops only
after both runs or failure. A suite-level database reset/check between the runs
is allowed after all first-run contexts close; no Supabase stop/start occurs
between them. Database reconstruction and Auth quota semantics remain separate.

Official local configuration evidence: [Supabase config reference](https://supabase.com/docs/guides/local-development/cli/config#auth.rate_limit.anonymous_users) and [pinned v2.116.0 template](https://github.com/supabase/cli/blob/v2.116.0/apps/cli-go/pkg/config/templates/config.toml#L159-L188).

#### Apply a local Auth configuration change

After reviewing the committed configuration, and with no active test contexts:

```bash
npm run supabase:stop
npm run supabase:start
```

Resume the trap-managed validation procedure only after successful startup.
Restart applies configuration; it is not an approved way to replenish allowance.

#### Separate two-run repeatability evidence

After dependency/browser installation, confirm at least 95 signup allowance
remains: one for the security gate and 94 for the two full suites. Record all
three command counts. Use one stack lifecycle; the reset between
runs is database reconstruction only. This is separate from daily validation:

```bash
set -eu

cleanup_otteroom_services() {
  npm run supabase:stop || true
}

trap cleanup_otteroom_services EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

npm run supabase:start
npm run env:local
npm run db:reset
npm run db:types:check
npm run test:e2e:security
npm run test:e2e
npm run db:reset
npm run db:types:check
npm run test:e2e
npm run supabase:stop
trap - EXIT INT TERM
```

No restart occurs between these full-suite invocations. Record each exit code,
N = 47 cap, actual signup attempts, identity continuity, absence of Auth 429,
and context/server cleanup. A failure fails the checkpoint; do not rerun until
the cause and remaining hourly allowance are understood.

## Shutdown

```bash
npm run supabase:stop
```

Stopping containers affects connectivity only. It does not implement seat
release, room leave, replacement, expiration, or cleanup behavior.
