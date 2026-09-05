# Implementation Plan: Create and Join a Two-Person Room

**Branch**: `main` (feature directory label: `001-room-session`)
**Date**: 2026-09-05
**Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-room-session/spec.md`

## Summary

Implement one universal strict-TypeScript Expo application in the repository
root. A participant obtains a persistent Supabase Anonymous Auth session, creates
a two-seat room through an idempotent PostgreSQL RPC, and shares a canonical
ten-character code or absolute `/room/<CODE>` link. A second anonymous
participant joins through the same race-safe PostgreSQL RPC whether arriving by
link or manual input. Supabase Realtime Postgres Changes invalidates the accepted
members' room view and each client refetches the authoritative RLS-protected row,
so both converge on Ready without manual refresh.

PostgreSQL owns capacity, idempotency, membership, and the Waiting-to-Ready
transition. The complete application model is one `public.rooms` table with fixed
host and guest seats and a generated state column. The client has no direct table
mutation rights and never receives a service-role or secret key.

This slice begins at create/join and ends at Waiting, Ready, or a clear
non-mutating failure. It includes no movie data or behavior, preferences, voting,
matching, profiles, permanent accounts, leaving/replacement, expiration,
notifications, analytics, administration, localization, production deployment,
or behavior after Ready.

## Technical Context

**Language/Version**: Node.js `24.20.0` LTS; strict TypeScript at the version
selected by the audited Expo SDK 57 scaffold, with later Expo-native packages
selected by Expo tooling

**Primary Dependencies**: Expo SDK 57 (`expo` `~57.0.20`), React Native
`0.86.3`, React/React DOM `19.2.3`, Expo Router `~57.0.19`,
`@supabase/supabase-js` `2.115.0`, browser Web Storage, native-only Expo SQLite
session persistence, and Expo Crypto at the SDK-selected version; Supabase CLI
`2.116.0` and stable `@playwright/test` `1.63.0` as exact project development
dependencies

**Storage**: Supabase-CLI-managed local PostgreSQL 17; exactly one application
table, `public.rooms`; Supabase-managed `auth.users` for anonymous participant
identity

**Testing**: Supabase CLI pgTAP database tests; `jest-expo` with React Native
Testing Library and Expo Router testing helpers; Playwright against real local
Expo web, Anonymous Auth, migrations, RPCs, RLS, and Realtime; a separate real-Auth
credential-safety gate precedes ordinary Auth acceptance and artifact retention

**Target Platform**: One Expo codebase for Android, iOS, and web; Linux is the
documented development host and web is the primary acceptance target; no mobile
emulator is required for this slice

**Project Type**: Universal Expo application at repository root plus local
Supabase configuration and migrations; not a monorepo and no custom backend
service

**Performance Goals**: No product latency threshold is introduced. Under normal
connectivity, every successful final-seat join must converge both accepted
clients to Ready without manual refresh; every final-seat race must preserve a
maximum of two participants. Test timeouts are harness safeguards only.

**Constraints**: Two participants maximum; local-session identity only; exact
ten-character uppercase hexadecimal codes; database-atomic creation/join;
idempotent retries; RLS-isolated reads; no direct client mutations; only two
client-safe Expo environment variables; Realtime events are invalidations, not
authoritative state

**Scale/Scope**: Two routes, two PostgreSQL RPCs, one application table, two
accepted participants per room, twelve browser acceptance scenarios, and local
development/test operation only; production load and deployment design are
outside this slice

**Package Management**: npm with committed `package-lock.json`; framework
packages selected through `create-expo-app` and `expo install`, then frozen by the
lockfile

**Public Configuration**: `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only; both validated before client
construction

## Scope Boundary

### Included observable flow

1. A host with no persisted session signs in anonymously and creates a room.
2. The host sees Waiting, `1 of 2`, a canonical code, and an absolute invitation
   link.
3. A distinct anonymous guest reaches the same `/room/[code]` route by link or
   manual entry and invokes the same `join_room` RPC.
4. The guest immediately sees Ready from the committed RPC result and the host
   reaches Ready after Realtime invalidation plus authoritative refetch.
5. A third distinct participant receives Room Full and no room details.
6. A persisted host or guest can reload/reconnect and receive its existing
   membership without another seat.

### Excluded work

No movie catalogue or provider, genres, filters, queues, swiping, voting,
matches, watched/hidden/history state, QR codes, permanent accounts, profiles,
leave/replacement, expiration/cleanup, analytics, notifications, administration,
localization, CI/CD, production deployment, or post-Ready route/behavior is
designed or implemented.

## Constitution Check — Before Design

**Gate result**: PASS. The reviewed feature specification has testable scope and
no blocking ambiguity; the selected approach requires no constitutional
exception.

| Principle | Pre-design evidence |
|---|---|
| I. Working Behavior Is the Primary Evidence | The plan requires fresh-clone install, clean migration replay, lint, typecheck, database/client/E2E tests, web export, local startup, and an observable two-browser flow. Planning artifacts are not presented as implementation evidence. |
| II. Small Verifiable Vertical Slices | The work is one create/join/reconnect vertical slice that stops at Ready and does not depend on movie functionality. Implementation phases each end in a verifiable increment. |
| III. Specification and Implementation Consistency | Constitution, reviewed spec, checklist, data model, contracts, validation matrix, and later tasks have explicit authority boundaries. No normative input conflict was found. |
| IV. Explicit and Authoritative State Transitions | PostgreSQL is the state owner. Create is idempotent and atomic; join locks one room row; generated state prevents drift; failure, retry, concurrency, stale event, and recovery semantics are defined. |
| V. Security, Secrets, and Least Privilege | Anonymous Auth is distinguished from signed-out `anon`; RLS/grants deny by default; RPC execution is narrow. C1 now forbids sensitive capture, guards screenshots, sanitizes diagnostics before persistence, and requires real-Auth artifact-safety evidence before ordinary Auth E2E. Planning-level PASS, not a runtime pass. |
| VI. Reproducible Development and Schema Evolution | The pinned project CLI, committed lockfile/config/migrations/types, local env derivation, and `supabase db reset` provide a Linux fresh-clone path without Dashboard state or manual SQL. |
| VII. Tests Are Executable Acceptance Evidence | pgTAP proves database boundaries, behavior tests prove client mappings/UI, and real-stack Playwright proves two-user Auth/RPC/RLS/Realtime/concurrency flows. |
| VIII. Explicit Scope and Simplicity | One root Expo app, one table, two routes, two mutation RPCs, React state/hooks, and a small typed service layer are sufficient. Speculative frameworks and infrastructure are excluded. |

## Architecture and Design Decisions

### Client

- One root Expo Router app with exactly `/` and `/room/[code]`.
- Strict TypeScript, generated Supabase database types, exact `id, code, state`
  reads, and pure narrowing/mapping of RPC responses.
- Focused modules for environment validation, Supabase construction, one-time
  anonymous-session bootstrap, code normalization, RPC calls, room-state mapping,
  and subscription lifecycle.
- React component state and focused hooks only; no global store, query framework,
  UI/CSS/form framework, generic repository, event bus, or plugin abstraction.
- Home creates with an Expo Crypto `randomUUID()` idempotency key or
  canonicalizes manual input. Both link and code flows meet at `/room/<CODE>`
  and call `join_room`.
- Web invitation URLs use `window.location.origin`; native uses Expo Linking for
  the same route under the configured scheme. Deployment-domain association
  stays outside database logic and outside this release.
- The local env wrapper captures machine-readable project-CLI status, maps
  `API_URL` plus `PUBLISHABLE_KEY` or client-safe legacy `ANON_KEY` to the two
  allowlisted Expo variables, and atomically replaces an ignored file without
  logging the full status or any secret/service-role/database/JWT value.

### Anonymous session

- A platform-selected storage module lazily uses browser
  `globalThis.localStorage` on web, with a no-op/read-null non-browser path for
  static export, and a native-only `.native.ts` module that imports
  `expo-sqlite/localStorage/install`. Web never loads the SQLite/WASM adapter,
  and Auth bootstrap runs only in the mounted client.
- Both clients set `persistSession: true`, `autoRefreshToken: true`, and
  `detectSessionInUrl: false`. Bootstrap first asks Auth to restore the persisted
  session; anonymous sign-in runs only when none exists.
- An in-flight bootstrap promise prevents multiple client sign-in attempts.
- Every protected route action awaits bootstrap. Auth and Realtime share one
  Supabase client so refresh updates channel authorization; reconnect still
  requires `SUBSCRIBED` plus authoritative refetch.
- Same browser storage means same participant; a separate context or cleared
  storage means a distinct participant. Native reload uses its persisted SQLite
  adapter. Disconnection never frees a seat.

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

### Database and RPCs

- One `public.rooms` table has internal UUID, unique canonical code, per-host
  creation request ID, fixed host/guest UUID seats, stored generated state, and
  timezone-aware timestamps.
- `(host_user_id, creation_request_id)` makes creation retry-safe; named unique
  constraints, `GET STACKED DIAGNOSTICS ... CONSTRAINT_NAME`, cryptographic code
  generation, and bounded regeneration distinguish a duplicate request from a
  code collision, including simultaneous calls.
- `create_room(p_creation_request_id uuid)` obtains identity from `auth.uid()`,
  inserts atomically, and returns `created` or `already_created`.
- `join_room(p_room_code text)` validates and normalizes, selects the unique room
  `FOR UPDATE`, returns an existing membership first, fills an empty guest seat,
  or returns `full`. Two concurrent distinct guests serialize at the row lock.
- Business outcomes are typed rows. Infrastructure errors remain exceptions and
  map to one recoverable UI state without database details.

Detailed definitions: [data-model.md](./data-model.md) and
[contracts/rpc.md](./contracts/rpc.md).

### RLS and grants

- Revoke migration-owner default table privileges for `anon`/`authenticated`,
  revoke all room-table privileges from `PUBLIC`, signed-out `anon`, and
  `authenticated`, then grant `authenticated` SELECT only on `id`, `code`, and
  `state`.
- One authenticated SELECT policy permits rows where `auth.uid()` is the host or
  guest. No client-role mutation policy or mutation grant exists.
- Revoke default public function execution; revoke both exact RPC signatures
  from `PUBLIC`, `anon`, and `authenticated`; grant only to `authenticated`.
- Each narrowly privileged `SECURITY DEFINER` function rechecks `auth.uid()`,
  pins `search_path` to empty, and schema-qualifies references.
- The local migration role `postgres` owns the functions and is not a client
  role. Because the definer body can bypass caller RLS, it implements the full
  input, identity, capacity, mutation, and disclosure checks and uses no dynamic
  SQL. RLS is independently authoritative only for subsequent table reads.
- The client uses the publishable key only. Anonymous Auth users act through the
  `authenticated` database role; a signed-out client receives no access.

### Realtime convergence

- A migration adds `public.rooms` to the `supabase_realtime` publication.
- An accepted member subscribes to UPDATE events filtered by exact internal room
  ID with `select: ['id']` and a wait-for-Postgres-binding channel option, and
  removes that channel when the route or room changes.
- Each event and the first and every later successful `SUBSCRIBED` transition
  schedule an exact-column authoritative refetch under RLS.
- Event payloads never replace state directly. Refetch sequencing, coalescing,
  a room/subscription generation token, and the irreversible Waiting-to-Ready
  rule prevent stale or duplicate events from rolling UI back or crossing rooms.

Detailed lifecycle: [contracts/realtime.md](./contracts/realtime.md).

## Project Structure

### Documentation created by this planning workflow

```text
specs/001-room-session/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── spec.md
├── checklists/
│   └── requirements.md
└── contracts/
    ├── rpc.md
    ├── realtime.md
    └── client-routes.md
```

`tasks.md` now records the synchronized executable breakdown. This manual C1
correction does not rerun planning or task generation.

### Planned source layout at repository root

```text
.
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   └── room/
│       └── [code].tsx
├── src/
│   ├── auth/
│   │   └── anonymous-session.ts
│   ├── config/
│   │   └── env.ts
│   ├── lib/
│   │   ├── auth-storage.native.ts
│   │   ├── auth-storage.web.ts
│   │   └── supabase.ts
│   ├── rooms/
│   │   ├── code.ts
│   │   ├── contracts.ts
│   │   ├── service.ts
│   │   ├── state.ts
│   │   └── use-room-subscription.ts
│   └── types/
│       └── database.generated.ts
├── __tests__/
│   ├── config/
│   │   ├── e2e-diagnostics.test.ts
│   │   ├── database-types.test.ts
│   │   └── local-supabase-config.test.ts
│   ├── rooms/
│   │   ├── code.test.ts
│   │   └── state.test.ts
│   └── routes/
│       ├── home.test.tsx
│       └── room.test.tsx
├── e2e/
│   ├── room-session.spec.ts
│   ├── diagnostics/
│   │   └── credential-safety.spec.ts
│   └── support/
│       ├── sanitize-diagnostics.ts
│       ├── credential-registry.ts
│       ├── safe-diagnostics.ts
│       └── safe-reporter.ts
├── scripts/
│   ├── check-e2e-artifacts.mjs
│   ├── run-e2e.mjs
│   ├── safe-process.mjs
│   ├── configure-local-env.mjs
│   └── database-types.mjs
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260905000000_rooms_schema.sql
│   │   ├── 20260905000001_room_rpcs.sql
│   │   └── 20260905000002_rooms_realtime.sql
│   └── tests/
│       └── database/
│           └── room_session.test.sql
├── .agents/
├── .specify/
├── specs/
├── .env.example
├── .gitignore
├── .nvmrc
├── app.json
├── eslint.config.js
├── expo-env.d.ts
├── jest.config.js
├── package.json
├── package-lock.json
├── playwright.config.ts
└── tsconfig.json
```

**Structure decision**: Use the official default Expo Router scaffold at the
repository root and add only feature-oriented modules. During future
implementation, allocate a directory with `OTTEROOM_SCAFFOLD_DIR="$(mktemp -d)"`
and run `npx create-expo-app@4.0.0 "$OTTEROOM_SCAFFOLD_DIR/app" --template
default@sdk-57 --no-install --no-agents-md`; inspect it, then copy only the
required Expo manifest, configuration, route starter files, and assets into the
root. Never recursively copy over `.agents/`, `.specify/`, `specs/`, `.git/`, or
existing project files.
Remove scaffold sample routes/assets not used by this slice before the single
root `npm install` that creates the lockfile. Expo-native additions use
`npx expo install`; they are not selected from unrelated latest tags. The future
implementation must review the generated manifest and diff before proceeding.

## Implementation Phases

These are ordered future implementation phases, not work performed by this
planning invocation.

### Phase 0 — Reproducible Expo scaffold and green browser baseline

- Verify Node `24.20.0`; create the audited Expo SDK 57 scaffold in a temporary
  directory and copy only reviewed, allowlisted application files.
- Enable strict TypeScript; resolve Expo-native dependencies with Expo tooling;
  add exact Supabase CLI, Supabase JS, and Playwright versions; commit the npm
  lockfile and ignored two-variable environment contract.
- Green checkpoint: fresh `npm ci`, lint, typecheck, a Playwright-managed web
  server reaching `http://127.0.0.1:8081`, and web export all succeed before any
  room behavior exists.
- Before that checkpoint, implement C1 capture config, sanitizer, registry,
  scanner, safe reporter/process wrapper, context collector and controller.
  `__tests__/config/e2e-diagnostics.test.ts` covers synthetic boundaries;
  `npm run test:e2e:security -- --grep @diagnostics-static` executes runtime A/B
  without Auth. This selection is not the complete credential-safety gate and
  cannot authorize ordinary Auth acceptance. Baseline capture has no screenshots
  or retained logs until the complete safety gate; fixed safe status is sufficient.

### Phase 1 — Local Supabase initialization and clean reset

- Initialize the future local Supabase directory with the project CLI. Retain
  its PostgreSQL `17` setting; explicitly enable anonymous sign-ins, set the
  local-only `auth.rate_limit.anonymous_users = 150`, and disable legacy automatic
  table exposure. Verify both Auth settings in configuration tests; do not change
  other Auth rate limits.
- Add npm wrappers for start/status/stop, safe local env generation, clean reset,
  database tests, and the documented later `db:types`/`db:types:check` interface.
  Implement the type wrapper only in Phase 3 after both RPCs exist. Do not add
  application schema yet.
- Green checkpoint: a new local stack starts, `env:local` writes only the two
  client-safe values, `supabase db reset` succeeds from committed configuration,
  and the stack stops cleanly. Configuration checks prove anonymous sign-ins are
  enabled and the limit is 150; document stop/start after config changes and the
  distinction between database reset and hourly Auth allowance.

### Phase 2 — Rooms schema, grants, RLS, and structural pgTAP

- Add the `pgcrypto` extension and one `public.rooms` table migration with named
  constraints, generated state, timestamp rules, host/guest indexes, exact
  column grants, RLS policy, and no direct client mutation surface.
- Add pgTAP shape/constraint/generated-state/ACL/RLS tests; publication evidence
  is added only with the Realtime migration in Phase 7.
- Fixture setup may use the local test owner, but allow/deny assertions switch
  to real `anon` and claimed `authenticated` sessions.
- Green checkpoint: clean reset and the structural pgTAP suite pass, including
  separate evidence for missing grants and RLS-denied unrelated rows.

### Phase 3 — Atomic RPC functions and database behavior tests

- Add the two thin, owned, contained `SECURITY DEFINER` RPCs with exact ACLs,
  constraint-name conflict handling, deterministic row locking, typed results,
  and non-disclosing failures.
- Add pgTAP coverage for every outcome, create/join idempotency, preservation,
  disclosure, and genuine duplicate-create/final-seat races dispatched through
  independent asynchronous test sessions.
- Implement `scripts/database-types.mjs` write/check and both npm scripts, with
  executable wrapper failure/preservation/cleanup tests. Only after both RPCs and
  their pgTAP tests exist, initially produce `src/types/database.generated.ts`
  with `npm run db:types` then `npm run db:types:check`; review and include it in
  the implementation baseline with the migrations.
- Green checkpoint: reset, full pgTAP, wrapper tests and only
  `npm run db:types:check` pass, with no preceding overwrite in the checkpoint;
  concurrent create yields one room and concurrent join one guest.

### Phase 4 — Anonymous Auth bootstrap

- Implement validated env loading, platform-specific web/native persistence,
  one typed Supabase client, restore-before-sign-in bootstrap, shared in-flight
  promise, and refresh-safe session behavior.
- Add behavior tests for restored/missing/failed sessions, simultaneous callers,
  platform adapter selection, protected actions waiting for bootstrap, no
  automatic signup loop, and sanitized HTTP 429 budget-failure diagnostics.
  Observe actual signup counts: same-context reload/reconnect adds zero; the
  Auth infrastructure smoke consumes at most 3 identities.
- Green checkpoint: lint, typecheck, and client tests pass; reload preserves one
  identity and no signed-out room operation can start.
- Before the ordinary Auth smoke, add C1's real controlled-failure probe and run
  `npm run test:e2e:security` unfiltered after reset/type check and browser install.
  Require runtime A/B, actual one-session failed probe, finalized artifact scan,
  safe nonzero negative controls and cleanup. This intermediate blocking security
  checkpoint precedes the phase's first ordinary `@auth` E2E checkpoint.

### Phase 5 — Host creation vertical increment

- Implement one logical create request UUID with retry reuse, `create_room`,
  canonical navigation, Waiting, `1 of 2`, and safe absolute web/native links.
- Add behavior and real-stack smoke evidence for create, exceptional retry, and
  reload recovery without a second room or partial invitation.
- Green checkpoint: a fresh context creates exactly one Waiting room and the
  same participant/request always recovers that room.

### Phase 6 — Shared join, capacity, and isolation vertical increment

- Route manual code and direct invitation input through the same normalized
  `/room/<CODE>` path and `join_room` call.
- Implement joined/already-member/malformed/not-found/full/recoverable mappings,
  duplicate navigation guards, third-user rejection, and member-only reads.
- Green checkpoint: database plus real-stack browser smoke evidence proves two
  seats maximum, repeat host/guest entry, no mutation on rejection, and zero-row
  unrelated reads.

### Phase 7 — Realtime convergence and reconnect

- Create the versioned `public.rooms` publication migration.
- Replay the publication migration and run `npm run db:types:check` without
  regeneration before subscription work; publication membership alone should
  not change row/function types. An intentional type-relevant schema change
  follows the separate write/check/review procedure, never an automatic repair
  inside a failed validation gate.
- Implement the exact-room Postgres Changes lifecycle with
  wait-for-binding `SUBSCRIBED`, immediate/event/reconnect refetch, coalescing,
  generation/request guards, recoverable errors, and deterministic cleanup.
- Add lifecycle tests plus real-stack evidence for a completely missed initial
  event, duplicate events, room changes, reconnect, and unmount.
- Green checkpoint: guest is Ready from `joined`; the waiting host reaches Ready
  without refresh even when the join precedes subscription readiness.

### Phase 8 — Complete browser acceptance suite

- Run all twelve required scenarios against real local Auth, RPCs, RLS, and
  Realtime with one isolated context per distinct participant and no mocks.
- Reset the database before the suite; make every scenario create its own room
  and identities; retain only C1-approved failure diagnostics after the safety
  gate; let Playwright manage web-server
  readiness/cleanup and a shell trap manage Supabase cleanup.
- Green checkpoint: all twelve Playwright scenarios pass from a clean reset,
  including simultaneous final-seat dispatch and no manual host refresh, at
  most N = 47 sign-ins, and no Auth 429. The dedicated repeatability checkpoint
  runs two full suites sequentially in one continuously started local stack,
  with separate counts at most 47 each and no stop/start between runs. Run security
  once before that pair and reserve 95 total sign-ins including its one probe.

### Phase 9 — Complete fresh-clone validation

- Execute the full sequence in [quickstart.md](./quickstart.md): install, start,
  env generation, reset, `npm run db:types:check` (no write), lint, typecheck,
  client/pgTAP tests, export, locked browser install, `npm run test:e2e:security`,
  `npm run test:e2e`, and shutdown (at most 1 + 47 = 48 sign-ins).
- Record commands, environment, outcomes, and any non-applicable check with its
  rationale; confirm no behavior or infrastructure beyond Ready entered scope.
- Green checkpoint: the documented sequence succeeds in a new checkout with no
  Dashboard state, global CLI, hosted project, emulator, leaked secret, or
  manual cleanup after a failure.

## Dependency Ordering

```text
SDK-57 scaffold + locked root toolchain
    └──> local Supabase config + clean reset
          └──> rooms schema + grants/RLS + structural pgTAP
                └──> atomic RPCs + concurrency pgTAP + generated types
                      └──> typed client + mounted Anonymous Auth bootstrap
                            └──> C1 real-Auth safety gate -> ordinary Auth smoke
                                  └──> host create increment
                                        └──> shared guest join/capacity increment
                                              └──> exact-room Realtime convergence
                                                    └──> twelve-scenario Playwright
                                                          └──> fresh-clone validation
```

Database contracts precede client integration so generated types reflect the
authoritative migrations. Auth is independently green before room actions;
create is independently green before guest join. Join and isolation precede
Realtime because convergence can subscribe only after an accepted RPC discloses
a room ID. Full E2E and then fresh-clone evidence follow all smaller boundaries.

## Validation Strategy

All database-dependent gates from the initial type-artifact phase onward run
`npm run db:types:check` against the fully replayed local database, without a
preceding `db:types` in normal validation. Earlier schema-free/schema-only gates
explicitly defer this check until the complete RPC artifact exists. Initial or
intentional updates use the separate write/check procedure above. Auth/E2E gates
also record their signup allowance and observed count; the three-run budget does
not promise unlimited targeted, repeated, or diagnostic runs in the same hour.
Every Auth acceptance checkpoint first runs unfiltered `npm run test:e2e:security`
after reset/check; reserve its separate one-signup cost. The same-stack two-run
checkpoint runs it once before the pair. The pre-Auth baseline/static checks are
explicitly exempt from real Auth, not from trace-off/no-sensitive-capture policy.

### Database evidence

pgTAP after a clean `supabase db reset` covers:

- the sole application table, column types/nullability/defaults, generated state,
  constraints, indexes, and publication membership;
- uppercase code format and uniqueness, distinct seats, and create-idempotency
  uniqueness;
- no signed-out read, no direct client-role insert/update/delete, member-only
  exact-column read, and unrelated-member denial;
- exact RPC execute grants and unauthenticated defense in depth;
- create success plus sequential/concurrent same-request retry and exact
  constraint-name handling;
- guest join, host/guest repeated join, invalid code, unknown code, full room, and
  state preservation after every rejection;
- real final-seat serialization and duplicate-create behavior using two
  asynchronous `dblink` sessions that both dispatch before either result is
  collected; and
- Auth fixtures created by the test owner but allow/deny calls executed under
  actual `anon`/`authenticated` roles and per-connection JWT claims, never
  `service_role`.

### Client evidence

`jest-expo` and React Native Testing Library cover:

- restored/missing/failed Anonymous Auth bootstrap, shared in-flight callers,
  web/native storage selection, and protected-action gating;
- trim/uppercase/regex behavior;
- closed RPC result validation and pure result-to-UI mapping;
- session/loading, Waiting, Ready, malformed, not-found, full, and generic
  recoverable failure states;
- retry semantics, including create request ID reuse;
- duplicate-submit protection without claiming it as database correctness; and
- first/repeated `SUBSCRIBED`, UPDATE invalidation, missed/duplicate events,
  generation/request stale-result guards, channel errors, and cleanup.

### Browser acceptance evidence

Playwright uses the real local stack and one isolated browser context per
participant. Its twelve required scenarios cover host create/Waiting, generated
link open, two-client Ready without refresh, manual code join, third-user full,
concurrent guest race, host reload, guest reload, duplicate join, malformed
input, unknown code, and unrelated-room isolation. Supabase is never mocked.
The race dispatches both isolated guests' real join actions before awaiting
either result. The adversarial isolation check uses only the unrelated context's
own publishable-key session to attempt an exact Data API read of a room ID known
to the test; it expects no row and never uses or logs a privileged credential.
One clean reset precedes the suite, and every scenario creates its own room and
fresh identities rather than depending on execution order. Playwright never
records trace/HAR/video/storage exports; the C1 collector retains only guarded
failure PNGs and sanitized diagnostics, the controller scans finalized artifacts,
and Playwright owns web-server shutdown. Security A/B/C are separate from E01–E12.

### Reproducibility and build evidence

The full command sequence is defined in [quickstart.md](./quickstart.md). It
includes `npm ci`, local service startup, safe public-env derivation, clean
migration replay, generated-type drift detection, lint, strict typecheck, client
tests, pgTAP, production web export, credential safety, full Playwright acceptance,
and service shutdown. Web is the
acceptance platform; Android/iOS emulator runs are not required by this slice.
Platform-resolved persistence modules remain covered by typecheck and client
tests. A shell trap stops the local Supabase stack after success or failure.

## Constitution Check — After Design

**Gate result**: PASS. The reviewed design artifacts preserve every pre-design
gate and make the security, state, validation, and reproduction boundaries
executable in the future implementation.

| Principle | Post-design verification |
|---|---|
| I | Quickstart distinguishes planned commands from actual evidence and defines the complete future verification record. |
| II | The phase order produces create, join/capacity, then convergence increments, all within the same Ready-bounded slice. |
| III | Spec requirements map consistently to one data model, three boundary contracts, phase gates, and the acceptance matrix; normative files were not altered. |
| IV | Data model and RPC contract specify validation, identity, locks, atomicity, idempotency, duplicate/concurrent behavior, rollback, stale events, reconnect, and forbidden transitions. |
| V | PASS at planning level: exact grants/RLS/definer containment and safe env remain; C1 prohibits trace/HAR/session exports and unrestricted logs, requires guarded PNGs, safe sanitizer/registry/scanner and runtime config/sentinel/real-Auth failure evidence before Auth acceptance. No implementation/security pass is claimed. |
| VI | Current tool versions, safe scaffold procedure, npm lockfile, project CLI, migration-only schema, clean reset, generated types, and local env flow are fixed. |
| VII | Database, client, export, and real-stack isolated-context E2E checks prove observable behavior rather than artifact presence. |
| VIII | Design remains one Expo app, one application table, two routes, two mutation RPCs, one Realtime mechanism, and no post-Ready or speculative subsystem. |

## Complexity Tracking

No constitution violations or approved complexity exceptions exist. The minimal
single-app, single-table design satisfies the complete feature.

## Planning-Only Declaration

This manual correction resolves C1 while preserving R01/R02 and synchronizes
`tasks.md` only. No Spec Kit workflow, scaffold, dependency installation,
application/configuration implementation, migration/type generation, service
startup, application test, issue, branch/history operation, commit, or push was
performed. Analyze, the complete specification-baseline commit, and then
implementation are separate subsequent stages; readiness here is not runtime
acceptance.
