---
description: "Executable task breakdown for the Ready-bounded two-person room feature"
---

# Tasks: Create and Join a Two-Person Room

**Feature**: `001-room-session` · **Branch**: `main` · **Created**: 2026-09-05

**Input**: Design documents in `specs/001-room-session/`.

**Manual review verdict**: READY FOR ANALYZE. C1 (credential-safe real-Auth failure diagnostics) is resolved at planning level; R01 (generated-type verification) and R02 (local Anonymous Auth budget) remain resolved. Remaining findings: BLOCKING 0, MAJOR 0, MINOR 0; C1/R01/R02 classification is NONE. No Spec Kit workflow or implementation task was executed in this manual correction.

**Prerequisites**: `.specify/memory/constitution.md`, `specs/001-room-session/spec.md`, `specs/001-room-session/checklists/requirements.md`, `specs/001-room-session/plan.md`, `specs/001-room-session/research.md`, `specs/001-room-session/data-model.md`, `specs/001-room-session/contracts/rpc.md`, `specs/001-room-session/contracts/realtime.md`, `specs/001-room-session/contracts/client-routes.md`, and `specs/001-room-session/quickstart.md` have been read completely. The manual upstream correction has approved credential-safe diagnostics and executable pre-Auth acceptance evidence, preserving the deterministic write/check contract and explicit local Auth budget; this breakdown derives from those synchronized decisions without changing the product or boundary contracts.

**Tests**: Mandatory. Write the specified behavioral tests before or adjacent to the implementation they validate, observe their relevant failure, and make them pass before the phase checkpoint. Unit doubles may isolate client behavior; database, Auth integration, RLS, RPC, Realtime, and browser acceptance require the real local stack. File presence, source-text assertions, and static snapshots are not primary acceptance evidence.

**Organization**: Phase 1 is Setup; phases 2–5 are shared Foundational work; phases 6–9 deliver labeled user-story increments; phase 10 is cross-cutting validation and documentation. This follows the user's ten-phase structure instead of the template's illustrative phase numbering. All tasks are future work and initially unchecked. No application, test, migration, dependency installation, or validation service was created or run by task generation.

## Format and Path Conventions

- Each task uses `- [ ] Tnnn [P?] [USn?] Action with exact paths`.
- Paths are relative to `/home/maks/work/otteroom`. The Expo application lives at the repository root, not in an additional app/package directory.
- `[P]` permits only the bounded, same-phase parallel groups listed below, after their prerequisites pass. Other tasks execute in listed order. No phase may overtake its predecessor's green checkpoint.
- `[US1]` — Host Creates a Room (P1); `[US2]` — Guest Joins the Room (P1); `[US3]` — Room Capacity Is Enforced (P1); `[US4]` — Existing Participant Reconnects (P2).
- Focused test files extend the approved `__tests__/` directories. Product browser cases remain in `e2e/room-session.spec.ts`; only C1 security probes use `e2e/diagnostics/credential-safety.spec.ts` and focused `e2e/support/` helpers; all pgTAP cases remain in `supabase/tests/database/room_session.test.sql`.
- Scope is one application table, `public.rooms`; two SQL mutation functions; two routes; one Supabase client. Stop at Ready. No additional product feature, application table, Edge Function, custom backend, primary polling mechanism, deployment, or CI/CD is authorized.
- Preserve the expected dirty worktree and `.agents/`, `.specify/`, `specs/`, and `.git/`. Do not restore legacy files or inspect old history. No task requires a branch change, commit, push, issue creation, or execution of another Spec Kit workflow.

### Ordering reconciliation

The request's phase-3 inventory mentions generated types and publication membership, but the approved `plan.md` explicitly generates complete types after both RPCs exist and adds publication only in its Realtime phase. Preserve that dependency: phase 3 validates the schema/ACL/RLS subset; T046–T049 close its generated-type dependency in phase 4; T092–T094 close its publication dependency in phase 8. Do not create incomplete RPC signatures or move the third migration ahead of the second merely to satisfy an inventory heading. The complete schema/type/publication evidence is required before final acceptance.

The shared join/capacity increment in the approved plan remains before Realtime: T089 and T090 provide third-user and isolation smoke evidence in phase 7; phase 9 completes adversarial US3 acceptance. Phase 7 demonstrates both guest entry paths, but cannot claim full US2 acceptance scenario 5 before Realtime. Full US2 has its own checkpoint T106; US4 has T107. All four stories must pass before final validation.

### Evidence and checkpoint policy

Every checkpoint below is a blocking task, not a prediction of success. For each, append an implementation evidence entry under that task in this file identifying environment/tool versions, exact commands or observable procedure, exit codes/results, scenario IDs, and sanitized diagnostic locations. Record failed checks and leave the checkpoint and dependent work incomplete; never replace a failed required check with a waiver. An actually inapplicable check requires a concrete rationale under the constitution. Do not fill evidence entries during task generation.

For backend-dependent phase checks, install the EXIT/INT/TERM cleanup traps from `specs/001-room-session/quickstart.md` before startup, start the project-local stack with `npm run supabase:start`, run `npm run env:local`, and stop it on success or failure. Reset before a phase's database/browser checks, never during another test's active sessions. Playwright owns Expo startup/readiness/shutdown. From T049 onward every normal database-dependent gate uses `npm run db:types:check` after full migration replay without a preceding overwrite. Initial/intentional updates use `npm run db:types` then check, with migration/artifact review outside normal verification. The check is independent of Git tracked/staged state. The local Auth policy is N = 47 per standard full run, anonymous_users = 150/hour/IP, and at least three full runs (141) per available hourly budget; count targeted/partial/diagnostic runs too. HTTP 429 fails validation with safe budget diagnostics, never automatic signup retries. Stop/start applies config changes but is not quota recovery; `db:reset` and fixture cleanup do not reset hourly Auth allowance.

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

The complete security gate is T061 before ordinary Auth checkpoint T063. Its
pre-Auth synthetic-only selection `npm run test:e2e:security -- --grep @diagnostics-static`
is explicitly not a substitute. Every ordinary Auth acceptance checkpoint below
runs unfiltered security once before its acceptance selection and records its
extra one-signup allowance; repeatability runs it once before both full suites.

## Phase 1: Setup — Repository and Expo Green Baseline

**Goal**: A reproducible universal Expo SDK 57 app with two inert routes works in a browser before backend or room behavior exists.

**Minimum validation**: Fresh dependency installation, behavioral baseline client test, lint, strict typecheck, Playwright-managed browser readiness/navigation, and production web export.

- [ ] T001 Before any generator runs, verify `node --version` is `v24.20.0` and record its bundled `npm --version` in `specs/001-room-session/tasks.md`; then allocate `OTTEROOM_SCAFFOLD_DIR="$(mktemp -d)"` and run `npx create-expo-app@4.0.0 "$OTTEROOM_SCAFFOLD_DIR/app" --template default@sdk-57 --no-install --no-agents-md`. Inspect the output and enumerate an exact source-to-target allowlist for root `package.json`, `app.json`, `tsconfig.json`, `eslint.config.js`, `expo-env.d.ts` when generated, `app/_layout.tsx`, `app/index.tsx`, and individually required scaffold assets; copy only those files, reject symlink/protected-directory targets and stop on an unexpected existing-file collision, preserving `.agents/`, `.specify/`, `specs/`, and `.git/` without a recursive root copy.
- [ ] T002 Create the inert root route baseline in `app/_layout.tsx`, `app/index.tsx`, and `app/room/[code].tsx` before the first root dependency installation; keep only `/` and `/room/[code]`, record any exact sample-file/asset removal targets in `specs/001-room-session/tasks.md`, and remove unused sample references from `app.json`. Do not treat scaffold `src/app/` routes as the final layout or copy a sample route tree wholesale, and implement no Auth, room mutation, or post-Ready behavior.
- [ ] T003 Pin Node `24.20.0` in `.nvmrc` and `engines.node = 24.20.x` in `package.json`, record the npm version already verified before T001, retain the approved SDK-compatible Expo/React/React Native/Router/TypeScript selection, remove unused sample dependencies from `package.json` after T002's route reduction, and run the first root `npm install` to create `package-lock.json` as the dependency lock contract without making a Git commit.
- [ ] T004 Add `@supabase/supabase-js@2.115.0`, exact development dependencies `supabase@2.116.0` and `@playwright/test@1.63.0`, and only approved SDK-compatible Expo Crypto, Expo SQLite, Expo Linking, `jest-expo`, React Native Testing Library, and test typing dependencies via npm/`npx expo install` as appropriate in `package.json` and `package-lock.json`; keep manifest/lockfile updates serialized and introduce no additional framework.
- [ ] T005 Configure `tsconfig.json`, `expo-env.d.ts`, `eslint.config.js`, and `app.json` for strict TypeScript, the official Expo base configuration, Expo Router, Android/iOS/web, and the native invitation-link scheme; use platform module resolution that supports `src/lib/auth-storage.web.ts` and `src/lib/auth-storage.native.ts` without requiring a web SQLite fallback.
- [ ] T006 Create root `.gitignore` for `node_modules/`, Expo/export caches, machine-local environment variants, Supabase temporary state, and Playwright outputs while retaining `.env.example`, `package-lock.json`, `supabase/config.toml`, migrations, tests, generated database types, and specification artifacts as versionable inputs.
- [ ] T007 Configure `jest.config.js` with `jest-expo`, test discovery restricted to `<rootDir>/__tests__/` and matching `.test.ts`/`.test.tsx`, explicitly excluding `e2e/` from Jest; arrange isolated web/native storage-adapter checks without changing shared configuration during parallel test-authoring tasks. Create a behavioral baseline routing/navigation test in `__tests__/routes/home.test.tsx` for the two inert routes; preserve this harness when later replacing baseline assertions rather than collecting Playwright `.spec.ts` as Jest tests.
- [ ] T008 Create `playwright.config.ts` for Chromium, `testDir: './e2e'`, managed `npm run web:e2e`, readiness URL `http://127.0.0.1:8081`, `reuseExistingServer: false`, and `trace: 'off'`, `video: 'off'`, automatic `screenshot: 'off'`, no HAR/storage-state persistence or raw dumping; create the initial `@baseline` browser navigation check in `e2e/room-session.spec.ts` without a Supabase dependency. Set a consistent `baseURL` matching readiness, use test-scoped browser-context fixtures with `finally` teardown from the first browser case, and use the C1 fixture/collector from T016 once implemented. Define separate `acceptance` and `credential-safety` projects with exact testMatch for `e2e/room-session.spec.ts` and `e2e/diagnostics/credential-safety.spec.ts`, no automatic project dependencies, and the sole `e2e/support/safe-reporter.ts` reporter. Keep credential-safety `workers: 1`, `fullyParallel: false`, ordered A/B before C, and retries/repeatEach unchanged. No production endpoint is added; API/WS scenario observers remain in memory, never artifacts.
- [ ] T009 Add the exact approved frontend scripts to `package.json`: `lint` → `expo lint`, `typecheck` → `tsc --noEmit`, `test:client` → `jest --runInBand`, `web` → `expo start --web --port 8081`, `web:e2e` → `node scripts/safe-process.mjs web:e2e` (project-local Expo, `CI=1`, same port), `web:export` → `expo export --platform web`, `playwright:install` → `playwright install chromium`, `test:e2e` → `node scripts/run-e2e.mjs acceptance`, and `test:e2e:security` → `node scripts/run-e2e.mjs security`. Implement their C1 dependencies T010–T018 before executing the baseline.
- [ ] T010 Add synthetic behavior tests in `__tests__/config/e2e-diagnostics.test.ts` for `e2e/support/sanitize-diagnostics.ts`, `credential-registry.ts`, `safe-diagnostics.ts`, `safe-reporter.ts`, `scripts/check-e2e-artifacts.mjs`, `scripts/safe-process.mjs` and `scripts/run-e2e.mjs`: mixed-case secret fields, bearer/JWT/access/refresh/Authorization/Cookie/Set-Cookie/service-role/secret-key sentinels, bounded output/chunk boundaries, registry lifetime, scanner missing/unreadable/forbidden/synthetic-leak failures, value-free errors, controller exit propagation and cleanup. Generate sentinels only at runtime, use isolated fixture directories, boolean assertions without credential diffs, and no real session as a negative fixture; observe failure before implementing each boundary.
- [ ] T011 Implement the sole string/structured diagnostic sanitizer in `e2e/support/sanitize-diagnostics.ts` under the C1 contract: case-insensitive secret-field and bearer/JWT/known-value redaction, approved-field projection before serialization, redact-before-truncate, maximum 4 KiB per record and 64 KiB text per test, bounded nesting, fail-closed unsupported/cyclic/oversized inputs, and no raw object/partial-stream dump. Keep erasable Node-24-compatible TypeScript without aliases so both Node controllers and Playwright use the same helper; satisfy the corresponding T010 cases.
- [ ] T012 Implement `e2e/support/credential-registry.ts` with controller-owned per-context in-memory values, refresh registration, acknowledged framed worker registration over an owner-only Unix-domain socket in a 0700 temporary directory, and no serialized registry or credential argv/env/stdout/file. Retain values until the context and finalized-artifact scan close, then clear; clear all references and IPC endpoints on failure/interruption too. Test transport failure, registration-before-diagnostics, separate concurrent contexts and cleanup in `__tests__/config/e2e-diagnostics.test.ts`; use the registry only for diagnostic safety, never cross-test Auth reuse.
- [ ] T013 Implement `scripts/check-e2e-artifacts.mjs` as a directory-taking CLI and in-process scanner accepting a known-value registry reference: recursively scan all text/JSON-like outputs and decoded strings for known values/token shapes; reject trace.zip/trace/HAR/storage-state/raw cookie/session dumps and unapproved archives/files. Reject unreadable/symlink/escaping/incomplete scans, never unpack trace, and do not silently stop scanning large text. Skip validated guarded PNG pixel bytes while checking format/metadata; reject video and unverified image artifacts. Return nonzero with only sanitized filename/category/redacted finding type, never value/snippet; pass T010's synthetic leak and forbidden-file controls.
- [ ] T014 Implement `e2e/support/safe-reporter.ts` as the only configured reporter: bounded allowlisted scenario/context/status/outcome summaries, sanitized error/stack locations, no raw result/steps/arguments/attachments/console object serialization, and suppressed unclassified stdout/stderr. In `playwright.config.ts` set `PLAYWRIGHT_NO_COPY_PROMPT=1` before workers; do not mistake this pinned snapshot suppression for full error-context redaction. Require safe exception conversion before runner handling and scan automatic error-context outputs; test reporter callbacks using runtime synthetic values in `__tests__/config/e2e-diagnostics.test.ts` before any retained Auth diagnostics.
- [ ] T015 Implement `scripts/safe-process.mjs` for the fixed `web:e2e`, `supabase:start`, `supabase:status`, and `supabase:stop` operations. Spawn the npm-PATH project binaries with the approved arguments; set CI=1 for managed Expo. Capture/suppress unrestricted stdout/stderr instead of inheriting or teeing them; emit fixed safe status and only bounded explicitly approved excerpts through T011. Preserve nonzero exit, readiness reachability, signals and owned-child shutdown. Satisfy `__tests__/config/e2e-diagnostics.test.ts` with synthetic secret-bearing/split output and failed-child cleanup, without starting Supabase during this task's unit evidence.
- [ ] T016 Implement the shared safe context fixture/collector in `e2e/support/safe-diagnostics.ts` and adopt it in `e2e/room-session.spec.ts`: no explicit tracing/HAR/storage export/raw dump, observers and credential registration before diagnostic use, sanitized test/fixture exceptions with raw causes/matcher errorContext removed, bounded approved logs, and finally-closed contexts/interceptors. Guard failure-only PNG capture with in-memory credential/token checks of rendered text/input values/visible attributes and a stable checked viewport; suppress capture and fail on uncertain/changed UI. All tests also assert no credential UI without printing DOM/values. No ordinary retained screenshots/logs before T061; the later controlled probe alone exercises the pre-gate collector. Cover suppression, safe errors, UI guards and cleanup in `__tests__/config/e2e-diagnostics.test.ts`.
- [ ] T017 Implement `scripts/run-e2e.mjs` with `acceptance`/`security` modes and the npm scripts from T009: own registry/private IPC and isolated `test-results/` invocation directory; run the project-local Playwright CLI with exact project, suppress/sanitize subprocess output, await complete reporter/context/process finalization, scan the entire invocation with T013 and live known values, then clear registry/IPC in finally. Preserve normal nonzero tests and fail on scanner/config/capture/cleanup errors. Security succeeds only for passed A/B plus exactly the controlled failed C probe and its required safe receipts; never mask arbitrary nonzero or test.fail errors. Reject unsafe trace/UI/debug/reporter/path overrides before Auth, retain approved grep/workers/repeat-each forwarding, and test behavior including absent/unexpected probe/failure and late artifact writes in `__tests__/config/e2e-diagnostics.test.ts`. Permit the explicitly labeled pre-Auth @diagnostics-static selection with zero Auth, but do not present it as the complete gate.
- [ ] T018 Create A/B `@diagnostics-static` cases in `e2e/diagnostics/credential-safety.spec.ts`: inspect resolved runtime config plus actual context factory options for trace/video/automatic screenshots off, no HAR/disk storage/raw dumping, sole safe reporter, copy-prompt guard, and rejected unsafe recorder/CLI overrides. Execute actual sanitizer/registry/scanner against runtime-generated sentinel fixtures, including nonzero/redacted negatives, chunk bounds, finalized output and lifecycle; do not rely on grep alone. Require zero anonymous signup attempts and no Supabase dependency. Run `npm run test:client -- --runTestsByPath __tests__/config/e2e-diagnostics.test.ts`, then `npm run playwright:install` and `npm run test:e2e:security -- --grep @diagnostics-static`; full real-Auth C evidence follows only in phase 5.
- [ ] T019 Verify the root scaffold diff and dependency graph in `package.json`, `package-lock.json`, `app.json`, `app/`, and `.gitignore` against the approved layout, confirm only two routes and no overwritten Spec Kit files, and record `node --version`, `npm --version`, and `npm ls --depth=0` in `specs/001-room-session/tasks.md` without claiming a green baseline yet.
- [ ] T020 Checkpoint — run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:client`, `npm run playwright:install`, `npm run test:e2e -- --grep @baseline`, and `npm run web:export`; also run `npm run test:e2e:security -- --grep @diagnostics-static` without Auth; confirm policy/synthetic checks and the managed browser reaching both baseline routes and terminates its web server, record actual results in `specs/001-room-session/tasks.md`, and block backend work on any failure (setup evidence supporting SC-001 and the later story checks, not completed feature acceptance).

## Phase 2: Foundational — Local Supabase Reproducibility

**Goal**: The pinned project CLI starts, resets, safely configures, and stops the PostgreSQL-17 local stack without application schema or Dashboard SQL.

**Minimum validation**: CLI version, Docker prerequisites, empty-schema reset, idempotent allowlisted env generation including legacy fallback, clean shutdown.

- [ ] T021 Verify the installed project `supabase@2.116.0` dependency in `package.json` and `package-lock.json` from T004, invoke that local binary to initialize `supabase/config.toml`, retain CLI-managed PostgreSQL `major_version = 17`, set `[auth] enable_anonymous_sign_ins = true`, `[auth.rate_limit] anonymous_users = 150`, and `api.auto_expose_new_tables = false`; retain every other Auth rate limit. This committed local-only quota follows N = 47 and max(120, round-up-to-10(3 × N)) = 150, not production policy; add no application schema or seed dependency.
- [ ] T022 Add `__tests__/config/local-supabase-config.test.ts` to validate the actual local configuration's `auth.enable_anonymous_sign_ins = true` and numeric `auth.rate_limit.anonymous_users = 150`, including section-aware parsing and rejection of missing, disabled, duplicate, or wrong settings; exercise safe altered-config fixtures without mutating the canonical `supabase/config.toml`. Use the existing Jest runner and Node utilities, not a new config subsystem/dependency; pair static config evidence with T029's real startup and later Auth/E2E sign-in evidence.
- [ ] T023 Add `supabase:start`, `supabase:status`, `supabase:stop`, `db:reset`, and `db:test` wrappers for the corresponding project-local `supabase start`, `status`, `stop`, `db reset`, and `test db` commands in `package.json`; route start/status/stop through `node scripts/safe-process.mjs supabase:start`, `supabase:status`, and `supabase:stop` respectively, without unrestricted startup/status persistence. Database reset/test commands remain unchanged; never depend on a global CLI.
- [ ] T024 Create `.env.example` with only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` using non-secret example values, and verify `.gitignore` ignores `.env`, `.env.local`, and other machine-local variants without ignoring `.env.example`.
- [ ] T025 Write env-wrapper behavior tests in `__tests__/config/configure-local-env.test.ts` covering preferred `PUBLISHABLE_KEY`, fallback `ANON_KEY`, invalid/missing URL/key, repeated execution, atomic replacement, failed CLI exit, and exclusion of all other CLI fields from files/errors/stdout; use synthetic non-secret CLI fixtures and isolated temporary output directories.
- [ ] T026 Implement `scripts/configure-local-env.mjs` to capture project-local `supabase status --output env` without echoing it, parse only `API_URL` and the approved public-key alternatives, validate HTTP(S) plus a nonempty client key, reject accidental secret/service-role values, and atomically replace ignored `.env.local` via a restrictive-permission temporary file containing exactly the two approved assignments; failures must name only safe fields, preserve the prior file, and not log full status, database credentials, or JWT secrets.
- [ ] T027 Add `env:local` → `node scripts/configure-local-env.mjs` to `package.json` and run its synthetic wrapper and local-config tests through `npm run test:client -- --runTestsByPath __tests__/config/configure-local-env.test.ts __tests__/config/local-supabase-config.test.ts`; defer the `db:types` and `db:types:check` wrapper until T046 and T047, after both RPCs exist.
- [ ] T028 Align the prerequisites/local-start portion of `specs/001-room-session/quickstart.md` with `supabase/config.toml`, Node and bundled npm, Docker/Compose, actual local API/Studio URLs, available ports, safe diagnostics, and cleanup traps; document this phase's schema-free reset versus later complete migration replay. Record N = 47, anonymous_users = 150, stop/start after config changes, and that database reset/fixture cleanup does not reset hourly Auth allowance.
- [ ] T029 Checkpoint — run `node --version`, `npm --version`, `docker version`, `docker compose version`, `./node_modules/.bin/supabase --version`, `npm run supabase:start`, `npm run env:local` twice, `npm run db:reset`, and `npm run supabase:stop` with cleanup traps; verify the two allowlisted values and identical second env output without printing credentials, run the env-wrapper and local-config tests, and record results in `specs/001-room-session/tasks.md`. Require enabled Anonymous Auth and local anonymous_users = 150, successful config loading/startup, and documented stop/start-after-change semantics; do not claim database reset or basic startup replenishes Auth allowance. Block migrations on failure.

## Phase 3: Foundational — Rooms Schema, Privileges, RLS, and Base pgTAP

**Goal**: PostgreSQL owns exactly two fixed seats and member-only reads in the single application table.

**Minimum validation**: Clean migration replay and real pgTAP structure, constraints, generated state, ACL, RLS, and forbidden-mutation evidence. Complete generated types and publication follow T046–T049 and T092–T094 as explained above.

- [ ] T030 Create `supabase/tests/database/room_session.test.sql` with transaction-scoped pgTAP setup/teardown and owner-created Auth fixtures, then add behavior/catalog assertions for exactly one application table, all column types/nullability/defaults, generated state, named constraints, FKs, and required indexes from `specs/001-room-session/data-model.md`; run the relevant tests to observe failure before schema implementation.
- [ ] T031 Create the complete atomic schema/security migration in `supabase/migrations/20260905000000_rooms_schema.sql`: enable `pgcrypto` in `extensions`; define `public.rooms` with UUID default `extensions.gen_random_uuid()`, non-null code/creation request/host, nullable guest, generated non-null stored state using `CASE WHEN guest_user_id IS NULL THEN 'waiting'::text ELSE 'ready'::text END`, and `timestamptz` defaults `pg_catalog.transaction_timestamp()`. Include exact constraints `rooms_pkey`, `rooms_code_key`, `rooms_host_creation_request_key`, `rooms_code_format_check`, `rooms_distinct_participants_check`, `rooms_host_user_id_fkey`, `rooms_guest_user_id_fkey`, `^[0-9A-F]{10}$`, FK `ON DELETE RESTRICT ON UPDATE NO ACTION`, and partial B-tree `rooms_guest_user_id_idx`, reusing the host-leading unique index. In the same migration revoke owner-default client table grants and all actual `PUBLIC`/`anon`/`authenticated` privileges, enable RLS, grant `authenticated` SELECT only on `id, code, state`, and add only the host-or-guest `auth.uid()` SELECT policy; ship no insecure intermediate table, timestamp trigger, duplicate index, writable stage, or second application table.
- [ ] T032 Extend `supabase/tests/database/room_session.test.sql` to execute valid/invalid codes, duplicate codes and host/request keys, missing Auth references, same-person seats, generated-state transitions, direct state assignment rejection, timestamp defaults, FK deletion restrictions, and unchanged rows after rejected mutations; test client attempts to clear/replace seats, regress Ready to Waiting, or delete rooms rather than claiming the migration owner is forbidden from fixture setup.
- [ ] T033 Extend `supabase/tests/database/room_session.test.sql` with actual `anon` and claimed `authenticated` sessions proving signed-out denial, host/guest exact-column reads, unrelated zero-row RLS denial, denied private-column/wildcard reads, denied INSERT/UPDATE/DELETE, and the distinction between absent SQL grants and an RLS-filtered readable projection; fixture ownership must not leak into calls under test.
- [ ] T034 Checkpoint — after local startup/env setup, run `npm run db:reset` and `npm run db:test`, verify schema/default/constraint/index and separate ACL/RLS results, and record commands and acceptance-scenario 9–12 invariant evidence in `specs/001-room-session/tasks.md`; block RPC work on any failure and explicitly carry generated-type validation to T049 and publication validation to T094 without claiming those pending checks passed.

## Phase 4: Foundational — Atomic RPC Functions and Database Tests

**Goal**: Both contained database functions satisfy every RPC outcome, atomicity, idempotency, concurrency, and disclosure contract before client integration.

**Minimum validation**: Full pgTAP under actual caller roles/claims, independent concurrent PostgreSQL sessions, fault rollback, generated types, and no type drift.

- [ ] T035 Add exact RPC-signature/result-contract tests in `supabase/tests/database/room_session.test.sql` for `create_room(uuid)` and `join_room(text)`, their one-row return cardinality and ordered `TABLE(outcome text, room_id uuid, room_code text, room_state text, participant_role text, participant_count smallint)` definition; assert logical per-outcome nullability without inventing unsupported NOT NULL output parameters or a new application type/table.
- [ ] T036 Add create behavior tests in `supabase/tests/database/room_session.test.sql` for `created`, canonical cryptographic code shape, host/Waiting/one seat, sequential same-request `already_created`, a new intentional request, same request scoped to different hosts, recovery after the room becomes Ready, null request rejection, and complete-row/no-result-on-error semantics.
- [ ] T037 Implement `public.create_room(p_creation_request_id uuid)` in `supabase/migrations/20260905000001_room_rpcs.sql`: check `auth.uid()` then non-null input, lookup caller/request, generate uppercase hex from `extensions.gen_random_bytes(5)`, insert atomically, and handle unique violations using stacked `CONSTRAINT_NAME`; recover the committed host/request winner, recheck idempotency on a code-key collision before regeneration, rethrow an absent winner or unknown constraint, and stop after five true collision attempts with no partial row. Define the exact `RETURNS TABLE` shape from T035 with a complete body, owner `postgres`, PL/pgSQL `SECURITY DEFINER SET search_path = ''`, qualified objects, no dynamic SQL, owner-default PUBLIC EXECUTE revocation, and exact-signature revocation from all three public/client roles followed by the authenticated-only grant; create no throwaway function stub.
- [ ] T038 Add join behavior tests in `supabase/tests/database/room_session.test.sql` for trim/uppercase, null/malformed `invalid_code`, canonical unknown `not_found`, host repeat in Waiting/Ready, guest `joined` and repeated `already_member`, third-user `full`, exact role/state/count/nullability, and unchanged membership/timestamps after every rejected or idempotent outcome.
- [ ] T039 Implement `public.join_room(p_room_code text)` in `supabase/migrations/20260905000001_room_rpcs.sql` with a null-identity guard, authoritative normalization/validation, unique-code `SELECT ... FOR UPDATE`, existing-member check before capacity, one null-guest claim plus `updated_at = pg_catalog.transaction_timestamp()`, and outcome-only rejection; never accept caller identity/state/room UUID or clear/replace an occupied seat. Add the complete exact `RETURNS TABLE` definition from T035 with owner `postgres`, empty-search-path SECURITY DEFINER containment, qualified objects, no dynamic SQL, and exact-signature revocations/authenticated-only EXECUTE in this same coherent function change, before any caller-role success test can pass.
- [ ] T040 Add executable RPC security/disclosure assertions in `supabase/tests/database/room_session.test.sql`: inspect owner/config/ACLs, deny real `anon` execution, reject `authenticated` without a user claim inside both bodies, permit valid claimed users, verify accepted-only room projections, all-null non-outcome fields for `invalid_code`/`not_found`/`full`, and retained table-mutation denial; corroborate schema qualification/no dynamic SQL by a focused function-body review, not as the sole behavioral proof. Review the full authorization/disclosure body of each function independently of RLS, including owner-default execution revocation, and require both runtime ACL tests and this focused review to pass.
- [ ] T041 Build the test-only asynchronous two-session harness in `supabase/tests/database/room_session.test.sql` using rollback-contained, immediately execution-restricted `dblink`; commit random namespaced Auth fixtures and, for join races only, the Waiting room through a separate owner setup connection, never through the enclosing uncommitted fixture transaction. Duplicate-create trials start without a room for the tested host/request. For each remote session execute `SET ROLE authenticated` and use `set_config` with its fixture `sub`/role JSON in `request.jwt.claims` and `is_local = false`; test signed-out calls separately with `SET ROLE anon` and empty claims. Keep application calls non-owner, use Read Committed and bounded `statement_timeout`/`lock_timeout`, identify session PIDs for `pg_blocking_pids` observations, and run remote races before fault-only table DDL. Drain results, commit/rollback and close every connection before owner cleanup deletes only that trial's rooms then Auth fixtures; a clean reset is the interruption-recovery boundary.
- [ ] T042 Add the controlled duplicate-create trial in `supabase/tests/database/room_session.test.sql`: session A begins a transaction and dispatches create asynchronously, retaining its uncommitted insert; after A's query is ready but before collecting its result, dispatch B with the same host/request and verify B is blocked by A through `pg_blocking_pids`. Only after both dispatches collect A's `created` result, commit A, then collect B's `already_created`; assert identical ID/code and exactly one complete committed row via the owner observer, with no privileged application call or lingering fixture.
- [ ] T043 Add real final-seat, same-guest duplicate, and host-versus-guest trials in `supabase/tests/database/room_session.test.sql`: use a committed Waiting fixture, hold its row lock in an owner coordination connection, dispatch both claimed-session joins before collecting either result, observe both waiting on the controlled lock chain with bounded polling, release the lock, and collect/commit both outcomes. Assert distinct guests produce exactly `joined`/`full`, same guest produces `joined`/`already_member`, host repeat consumes no seat, and the committed row holds the expected winner/two distinct seats/Ready; no arbitrary sleep or two sequential calls counts as concurrency.
- [ ] T044 Add rollback-contained fault-injection cases in `supabase/tests/database/room_session.test.sql` for a forced code collision followed by regeneration, simultaneous code/idempotency conflict routing, five-collision exhaustion, an unrecognized temporary unique constraint, and a join failure after attempted seat assignment; assert rethrow/no result and byte-for-byte preservation of the pre-operation row, remove no shipped authorization checks, and keep every fault helper/constraint out of application migrations and remote concurrency transactions. Implement fault fixtures only inside this SQL test's rolled-back transaction using exact targeted temporary constraints/triggers, after remote sessions and their fixtures have closed; force actual constraint violations or post-update exceptions rather than merely matching migration text.
- [ ] T045 Add wrapper behavior tests in `__tests__/config/database-types.test.ts` for the planned `scripts/database-types.mjs` write/check interface: missing canonical target fails check, matching bytes pass without writes, mismatch fails, generator nonzero/empty output fails both modes without damaging the target, successful write atomically replaces only after generation, and every path cleans temporary files. Use isolated temporary fixture directories and synthetic subprocess stdout/exit fixtures; verify no Git calls, no dependence on `.git`/index, exact project-local CLI arguments, safe bounded diagnostics, and handled interruption cleanup. Do not substitute these unit fixtures for T049's real database generation/comparison.
- [ ] T046 Implement shared generator execution and `write` in `scripts/database-types.mjs` using npm execution PATH's installed project-local `supabase gen types --lang typescript --local --schema public`; require a running fully migrated local database, capture output to a unique same-filesystem temporary file, require successful exit and nonempty bytes, close handles, then atomically rename over `src/types/database.generated.ts`. Preserve the prior canonical file on any failure and clean temporary output on all completion/error/handled-signal paths; report safe bounded failure diagnostics. Add `db:types` → `node scripts/database-types.mjs write` in `package.json`; no Git, global CLI, login, hosted lookup, or schema mutation.
- [ ] T047 Implement `check` in the same `scripts/database-types.mjs` and `db:types:check` → `node scripts/database-types.mjs check` in `package.json`: require existing `src/types/database.generated.ts`, generate current bytes into a temporary file via the shared local generator, reject nonzero/empty output, compare byte-for-byte without canonical overwrite, and return nonzero on missing/unreadable/mismatched content. Emit a bounded actionable message with canonical path, lengths and first differing byte, always clean temporary output, and satisfy T045 for tracked/staged/modified/untracked semantics without reading Git metadata or staging anything; a matching check leaves repository contents unchanged.
- [ ] T048 After the completed RPC migration is reset and its database tests pass, initially run `npm run db:types` then `npm run db:types:check` to create and verify `src/types/database.generated.ts`; inspect both function argument/result definitions against `specs/001-room-session/contracts/rpc.md`. Review the artifact with its migration/RPC change for the future committed implementation baseline. This is intentional artifact production, not the normal checkpoint sequence; later drift validation must not overwrite the target first.
- [ ] T049 Checkpoint — run `npm run db:reset`, `npm run db:test`, `npm run test:client -- --runTestsByPath __tests__/config/database-types.test.ts`, and `npm run db:types:check` without preceding write; record all outcome, real-overlap, committed-winner, type-consistency and scenarios 1–4/6–14 database results in `specs/001-room-session/tasks.md`, with service cleanup. Require the canonical artifact produced by T048; missing/mismatch/empty/generator failure fails this gate regardless of tracked/staged/untracked state. Do not regenerate or stage to force green; no client integration through a failed prerequisite.

## Phase 5: Foundational — Supabase Client and Anonymous Auth Bootstrap

**Goal**: One typed, refresh-compatible client preserves local identity and gates protected operations; no room UI is introduced here.

**Minimum validation**: Environment/storage/restore/single-flight/error tests, static web export without browser bootstrap, and real-browser identity persistence without room acceptance work.

- [ ] T050 [P] Add environment-validation tests in `__tests__/config/env.test.ts` for the two explicit Expo public variables, invalid/missing URL/key, actionable non-sensitive errors, and no client construction before valid configuration. Include non-browser module evaluation/export behavior so these checks are not deferred to final polish.
- [ ] T051 [P] Add platform-storage tests in `__tests__/lib/auth-storage.test.ts` for lazy browser storage access, read-null/no-op non-browser export behavior, native SQLite installation/persistence, storage failures, and web/native resolver selection with no SQLite/WASM import in the web path. Cover unavailable browser storage and assert the agreed synchronous getItem/setItem/removeItem interface for both adapters.
- [ ] T052 Implement `src/config/env.ts` with explicit Expo-supported references to `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, HTTP(S)/nonempty validation, and safe failure propagation before Supabase construction; read no privileged environment variable.
- [ ] T053 [P] Implement `src/lib/auth-storage.web.ts` with lazy `globalThis.localStorage` access inside methods and a read-null/no-op path when no browser exists, while preserving actual browser storage failures as recoverable errors.
- [ ] T054 [P] Implement `src/lib/auth-storage.native.ts` importing `expo-sqlite/localStorage/install` only on native and exposing its installed persistent storage under the same adapter contract as web, without AsyncStorage, SecureStore, or a web/WASM adapter.
- [ ] T055 Create the single typed client in `src/lib/supabase.ts` using `src/types/database.generated.ts`, validated environment and platform storage, `persistSession: true`, `autoRefreshToken: true`, and `detectSessionInUrl: false`; ensure Auth and later Realtime use this same instance and static export does not start Auth.
- [ ] T056 Add bootstrap behavior tests in `__tests__/auth/anonymous-session.test.ts` for restore-before-sign-in, existing session/no sign-in, absent session/one sign-in, failed restore without replacement identity, failed sign-in/retry, concurrent callers sharing one promise, failed-flight release, cleared storage as a new participant, and refresh/recovery errors without discarding recoverable identity. Include explicit regression assertions for module evaluation without Auth startup and retry after a failed shared flight before this phase's checkpoint. Add HTTP 429 classification and bounded-retry unit cases: one sign-in per explicit bootstrap/retry action, none on failed session recovery or persisted reload/reconnect, no automatic anonymous-sign-in retry loop, and a generic recoverable UI error without raw Auth details.
- [ ] T057 Implement `src/auth/anonymous-session.ts` with `getSession()` before `signInAnonymously()`, a shared in-flight promise, explicit failure propagation and retry semantics, and no replacement identity while persisted-session recovery is failing; preserve token-refresh compatibility with the single client from T055. Allow at most one anonymous sign-in per explicit bootstrap/retry action after rechecking storage; never automatically loop or replace an existing identity after 429/recovery failure. Preserve a safe status classification for test-environment diagnostics while the route retains its contract's generic recoverable UI.
- [ ] T058 Integrate mounted-client bootstrap/loading/recoverable retry in `app/_layout.tsx` and add protected-action gating tests in `__tests__/auth/anonymous-session.test.ts`; prove concurrent consumers cannot invoke a protected callback before bootstrap resolves and cannot proceed signed-out after failure, without adding sign-out or permanent-account UI. Test the mounted `app/_layout.tsx` behavior through Expo Router helpers in `__tests__/routes/home.test.tsx`, including bootstrap loading/error/retry and no protected action on failure; a mocked callback invocation alone is not mounted-route evidence.
- [ ] T059 Add test-scoped signup accounting and cleanup to `e2e/room-session.spec.ts` and document its exact E01–E12/Auth allocation table in `specs/001-room-session/quickstart.md`: N = 47, local limit 150, no shared or hidden fixture identities. Install observers before navigation to count actual anonymous signup attempts and successful identities, enforce per-trial caps, and record only C1-sanitized counts/statuses and use T016's registry/collector; close every context and observer in `finally`. In `playwright.config.ts` set standard `repeatEach: 1` and `retries: 0`; HTTP 429 fails the run as test-environment budget failure with scenario/count/N/limit and recovery guidance, never Auth mock success, automatic retry, reset/restart evasion, or credential logging.
- [ ] T060 Add C's actual failed authenticated probe to `e2e/diagnostics/credential-safety.spec.ts` after mounted bootstrap T058: one isolated context performs exactly one real local Anonymous Auth signup, registers access/refresh/session-sensitive values in memory through T012 before diagnostics, confirms Auth success and credential-free rendered UI, then throws only `CONTROLLED_AUTH_DIAGNOSTIC_FAILURE`. Exercise T016's ordinary failure collector, T014's safe reporter and runner-created error-context output; no raw error cause, trace/HAR/video/storage export or session fixture is written. The controller must wait for finalized artifacts, recursively scan all of them with the live registry, verify all expected allowed artifact categories/cleanup receipts, and distinguish exactly this controlled failure from Auth 429, unexpected failures or scanner errors. Zero retries; count this separate one-signup probe outside unchanged acceptance N = 47; no room creation or product test endpoint is needed.
- [ ] T061 Credential-artifact safety checkpoint — after local startup/env, clean `npm run db:reset`, `npm run db:types:check`, `npm run lint`, `npm run typecheck`, `npm run test:client -- --runTestsByPath __tests__/config/e2e-diagnostics.test.ts`, `npm run web:export`, and locked `npm run playwright:install`, run unfiltered `npm run test:e2e:security`. Require runtime A/B pass, exactly one real anonymous controlled failed probe, guarded PNG and sanitized error/log/process evidence, a completed clean recursive scan including runner outputs, synthetic nonzero/redacted scanner controls, no forbidden artifacts, and context/IPC/web/Supabase cleanup. Record outer zero and expected inner nonzero separately with safe scenario/count/category diagnostics in `specs/001-room-session/tasks.md`. Any missing evidence/unexpected failure/429 fails this gate; block T062/T063 and all ordinary Auth artifact retention until it is green.
- [ ] T062 Add the real-stack `@auth` infrastructure case in `e2e/room-session.spec.ts`: original context sign-in 1, fresh context sign-in 1, and explicitly cleared original storage sign-in 1, for at most 3 total. Reload the retained context and assert zero new sign-ins and the same own user ID; contrast the new/cleared identities, without creating rooms or a production identity endpoint. Require T061 first, then use T059's observers and T016's safe fixture before navigation and guaranteed context teardown; do not log session tokens or silently retry Auth failures.
- [ ] T063 Checkpoint — after reset/env setup, run `npm run lint`, `npm run typecheck`, `npm run test:client`, `npm run web:export`, and `npm run test:e2e -- --grep @auth`; record restore/single-flight/platform/gating results and same-context versus new-context identity evidence in `specs/001-room-session/tasks.md`, block room actions on failure, and identify this as the continuity prerequisite for scenarios 13–14 rather than completed reconnect acceptance. Require the @auth cap of 3, no extra sign-in on reload/bootstrap races, and actionable Auth 429 failure classification. Normal validation also requires `npm run db:types:check` after the phase reset, without preceding `db:types`. Before this ordinary Auth acceptance selection, run unfiltered `npm run test:e2e:security` after reset/check and account for its separate one-signup cost.

## Phase 6: User Story 1 — Host Creates a Room (P1, MVP)

**Goal**: A new local participant creates one complete Waiting room and receives its code/link; failures and retries never present a partial or accidental second room.

**Independent test**: A fresh context creates without registration, sees canonical `/room/<CODE>`, Waiting, `1 of 2`, and an absolute same-room invitation link. A rejected create exposes no usable invitation; retrying an ambiguously completed request recovers the same room.

- [ ] T064 [P] [US1] Add typed create/shared accepted-result boundary tests in `__tests__/rooms/contracts.test.ts` and `__tests__/rooms/service.test.ts`: one-row cardinality, closed outcome/nullability/role/state/count validation, `created`/`already_created`, same UUID forwarded on retry, bootstrap-before-RPC, and exceptional responses mapped to a generic recoverable error.
- [ ] T065 [P] [US1] Replace obsolete inert-route assertions in `__tests__/routes/home.test.tsx` with behavioral create tests for session loading, one UUID per intentional action, double-submit prevention, retry UUID reuse, canonical `router.replace` carrying only code, disabled in-flight controls, and failed creation without usable room/invitation details, retaining applicable navigation coverage.
- [ ] T066 [P] [US1] Add normalization tests in `__tests__/rooms/code.test.ts` and implement pure trim/uppercase/`^[0-9A-F]{10}$` validation in `src/rooms/code.ts` so creation results and later manual/direct-link entry share one canonical-code contract; never generate invitation codes in the client.
- [ ] T067 [US1] Implement generated-type-backed closed RPC narrowing in `src/rooms/contracts.ts` and satisfy `__tests__/rooms/contracts.test.ts`: enforce one-row cardinality, exact create/join closed outcomes and per-branch nullability/role/state/count rules, rejecting unknown or inconsistent payloads as contract errors without adding navigation, storage, or UI side effects.
- [ ] T068 [US1] Implement pure accepted/create-error mapping in `src/rooms/state.ts` with behavioral tests in `__tests__/rooms/state.test.ts`: consume the narrowed results from T067, preserve internal ID/role only in the local model, render Waiting/one seat or Ready/two seats, and map exceptional failure without usable invitation data; perform no network, navigation, subscription, or post-Ready side effect.
- [ ] T069 [US1] Implement `createRoom(requestId)` and the shared `joinRoom(code)` transport in `src/rooms/service.ts` using only typed `create_room`/`join_room` RPCs after bootstrap and T067 narrowing; the host uses the same join transport to recover after create navigation, while guest-facing failure UI follows in phase 7; add no direct table write or separate host-recovery RPC.
- [ ] T070 [US1] Implement the home create action in `app/index.tsx` with Expo Crypto `randomUUID()`, per-logical-request lifecycle, in-flight guards, `created`/`already_created` navigation using only canonical `router.replace('/room/<CODE>')`, generic recoverable failure, and retry reuse without exposing a partial result.
- [ ] T071 [US1] Add host-room component behavior tests in `__tests__/routes/room.test.tsx` for code-based `already_member` recovery after create, bootstrap/loading, Waiting/code/seat display, same-host Ready recovery, missing/malformed input safety, and no rendered Auth/internal UUID or raw backend exception.
- [ ] T072 [US1] Implement accepted host entry and room presentation in `app/room/[code].tsx`: validate the canonical code, await bootstrap, use the shared join transport, render authoritative Waiting or Ready from accepted results, offer generic recovery on exceptional failure, and never trust hidden route state or navigate beyond Ready; guest-specific error presentation and full route-generation handling follow in phase 7.
- [ ] T073 [US1] Add absolute invitation-link construction to `src/rooms/code.ts`, wire it into `app/room/[code].tsx`, and extend `__tests__/rooms/code.test.ts` for actual browser-origin URLs and native Expo Linking scheme URLs pointing to the same canonical route; show the shareable link in Waiting without a deployment-domain, QR, or sharing-service dependency.
- [ ] T074 [US1] Add E01 `@us1` real-stack create/Waiting acceptance in `e2e/room-session.spec.ts`, retiring obsolete inert `@baseline` assertions: a fresh unregistered context obtains one host seat, canonical code, actual-origin invitation link and canonical route with no hidden IDs; use ordinary member-authorized reads as the state oracle and a test-scoped context with cleanup.
- [ ] T075 [US1] Add the `@us1` pre-acceptance create-failure case in `e2e/room-session.spec.ts`: bootstrap a fresh context, abort only its outbound create request before server dispatch, assert a clear recoverable failure and no usable invitation, and confirm zero newly owned rooms through its ordinary authorized projection; use a one-shot interceptor removed in `finally`, not a fabricated Supabase error body.
- [ ] T076 [US1] Add `@us1` retry-safety browser evidence in `e2e/room-session.spec.ts` by allowing a real create to commit and discarding its response once, then retrying with the same logical request; assert one owned room and the same code, and reload the accepted host to recover it without a second room; do not fabricate a Supabase success/failure body or use privileged credentials as the client. Install a one-shot request route before create, use `route.fetch()` to execute the real server request and capture the committed result privately, then abort delivery of that response; observe the next real RPC request to verify UUID reuse and compare its returned room. Always remove the interception in `finally`.
- [ ] T077 [US1] Checkpoint — from a clean reset run `npm run db:test`, `npm run lint`, `npm run typecheck`, `npm run test:client`, `npm run web:export`, and `npm run test:e2e -- --grep @us1`; independently demonstrate scenarios 1–2 and E01 plus exceptional/ambiguous retry evidence, record actual results in `specs/001-room-session/tasks.md`, and block guest-flow work on any failure. This is the first independently demonstrable MVP, not completion of the feature. Normal validation also requires `npm run db:types:check` after the phase reset, without preceding `db:types`. Before this ordinary Auth acceptance selection, run unfiltered `npm run test:e2e:security` after reset/check and account for its separate one-signup cost.

## Phase 7: User Story 2 — Guest Join by Link and Manual Code (P1)

**Goal**: Both invitation methods converge on one guarded room route/RPC, with authoritative guest Ready and distinguishable non-mutating errors. Capacity/isolation smoke remains here to preserve the approved pre-Realtime ordering.

**Independent increment test**: Against a new Waiting room for each flow, a fresh guest joins by link or normalized manual code and gets the same guest/Ready/two-seat result. Invalid, unknown, full, and pre-acceptance failures disclose no room details and preserve existing membership. Full two-client US2 convergence is gated separately at T106.

- [ ] T078 [P] [US2] Extend `__tests__/rooms/contracts.test.ts` and `__tests__/rooms/service.test.ts` for `joined`, host/guest `already_member`, `invalid_code`, `not_found`, `full`, malformed/empty/multiple-row responses, exact allowed nullability, and shared bootstrap/transport behavior for link and manual entry.
- [ ] T079 [P] [US2] Extend `__tests__/routes/home.test.tsx` with manual-code behavior covering trim/uppercase, immediate malformed feedback with no navigation/RPC, one canonical navigation for valid input, loading/duplicate-submit protection, and bootstrap gating alongside the existing create flow.
- [ ] T080 [P] [US2] Extend `__tests__/routes/room.test.tsx` for missing/array/malformed route segments, canonical replacement, one join per code generation during effect replay, route changes while a join is pending, ignored old-room results, every business outcome, generic failure/retry, and the absence of private IDs/details in rejection UI.
- [ ] T081 [US2] Extend `src/rooms/code.ts` and `__tests__/rooms/code.test.ts` with safe single-segment route parsing, rejecting missing/repeated values and returning a canonical path for valid noncanonical input without creating a second logical join.
- [ ] T082 [US2] Complete the pure join result-to-UI mapping in `src/rooms/state.ts` and `__tests__/rooms/state.test.ts`: accepted guest/host states, malformed invitation, invalid-room, room-full, and recoverable infrastructure/contract failure must be distinguishable; rejection states carry no room projection, and no mapper performs network/navigation/subscription work.
- [ ] T083 [US2] Implement manual input, immediate normalization feedback, guarded canonical room navigation, and progress/error controls in `app/index.tsx`, using the shared helper and leaving membership mutation to the room route's existing `joinRoom` path.
- [ ] T084 [US2] Complete `app/room/[code].tsx` for direct/manual guest entry, canonical path replacement, once-per-code in-flight and route-generation guards, loading, all mapped result states, retry/back-home controls, and code-change invalidation before cleanup; an accepted `joined` result renders Ready immediately, but does not yet claim host convergence.
- [ ] T085 [US2] Add E02 `@us2-join` to `e2e/room-session.spec.ts`: a fresh guest opens the exact absolute link generated by a fresh host and reaches the same canonical room with Ready/two seats, without registration or fabricated backend responses. Before the phase-7 checkpoint, call the real shared join again under each admitted host/guest identity and assert `already_member`, retained role, the same room and no extra seat; this closes the approved pre-Realtime repeat-entry smoke requirement.
- [ ] T086 [US2] Add E04 `@us2-join` to `e2e/room-session.spec.ts`: a separate fresh guest enters surrounding whitespace/lowercase code through home, reaches the same canonical route/RPC semantics, and sees guest Ready/two seats; use a new room rather than depending on E02 state.
- [ ] T087 [US2] Add E10 and E11 `@us2-join` negative invitation cases in `e2e/room-session.spec.ts`: malformed manual/direct-route input and a fresh random well-formed nonexistent code yield distinct messages and no room changes; require the real RPC's `not_found` result for E11 and fail the trial on any unexpected accepted result instead of depending on a fixed magic code, privileged existence query, or fabricated response.
- [ ] T088 [US2] Add `@us2-join` pre-acceptance join-failure/retry evidence in `e2e/room-session.spec.ts`: abort a real request before it reaches the server after identity is ready, assert generic recoverable failure with no private details and the host's authoritative Waiting state unchanged, restore connectivity, and retry the same code successfully; compare actual member-visible state and retain database-level exact-row preservation evidence from T038/T044.
- [ ] T089 [US3] Add E05 `@capacity-smoke` in `e2e/room-session.spec.ts` before Realtime work: fill a fresh room, reject a third isolated context with Room Full and no room details, and verify the admitted identities retain the same authoritative membership through their own real join/read projections; do not require host live convergence before the Realtime phase.
- [ ] T090 [US3] Add E12 `@capacity-smoke` in `e2e/room-session.spec.ts` before Realtime work: create unrelated rooms with independent ordinary identities, capture the target ID only from its accepted owner's real result, and prove the unrelated identity's exact-column known-ID Data API read yields no row and changes neither room; no privileged browser oracle or hidden production test endpoint is allowed.
- [ ] T091 [US2] Checkpoint — from a clean reset run `npm run db:test`, `npm run lint`, `npm run typecheck`, `npm run test:client`, and `npm run test:e2e -- --grep '@us2-join|@capacity-smoke'`; record scenarios 3–4/6–9/11 guest-flow and invariant evidence in `specs/001-room-session/tasks.md`, demonstrate identical link/manual results, and block Realtime on failure. Explicitly leave scenario 5/full US2 and full US3 acceptance for T106/T113. Normal validation also requires `npm run db:types:check` after the phase reset, without preceding `db:types`. Before this ordinary Auth acceptance selection, run unfiltered `npm run test:e2e:security` after reset/check and account for its separate one-signup cost.

## Phase 8: User Stories 2 and 4 — Realtime Convergence and Reconnect

**Goal**: Both accepted clients converge without refresh, and the same persisted participant recovers current membership after reload or connection loss.

**Independent tests**: US2 uses separate fresh link/manual trials and observes both pages become Ready without host refresh, including a guest commit before subscription readiness. US4 starts from accepted host/guest sessions, repeats joins and reloads/reconnects them, and verifies unchanged identity/seats plus current authoritative Waiting or Ready.

- [ ] T092 [US2] Create `supabase/migrations/20260905000002_rooms_realtime.sql` to add only `public.rooms` to `supabase_realtime` after catalog inspection, without Dashboard configuration, a second application table, or broad publication of unrelated objects. This is the concrete schema publication deliverable for the shared US2/US4 convergence boundary, not a new product subsystem.
- [ ] T093 [US2] Extend `supabase/tests/database/room_session.test.sql` with actual publication-catalog assertions for the `public.rooms` entry and retained exact-column grants/RLS after replay, tying publication evidence back to the phase-3 schema inventory.
- [ ] T094 [US2] Validate `supabase/migrations/20260905000002_rooms_realtime.sql` with `npm run db:reset`, `npm run db:test`, and `npm run db:types:check` against existing `src/types/database.generated.ts`, without preceding regeneration; record publication/grants/RLS/type results in `specs/001-room-session/tasks.md`. Publication-only changes should not alter row/function types; an unexpected mismatch fails this gate and must be investigated. A separately approved type-relevant schema update uses write/check/review outside normal validation. Failed prerequisites prevent client subscription work.
- [ ] T095 [P] [US2] Add authoritative refetch and monotonic-state tests in `__tests__/rooms/service.test.ts` and `__tests__/rooms/state.test.ts` for exact `id, code, state` projection by accepted ID, zero/invalid rows, count derivation, retained accepted role, rejection of cross-room responses, and no same-room Ready-to-Waiting regression.
- [ ] T096 [P] [US4] Add lifecycle behavior tests in `__tests__/rooms/use-room-subscription.test.ts` for first/repeated `SUBSCRIBED` refetch, a completely missed initial event, UPDATE invalidation only, duplicate coalescing, newer-request/room-generation guards, reconnect after missed changes, cleanup, unexpected CLOSED/CHANNEL_ERROR/TIMED_OUT, refetch denial, retry, and shared-client token refresh; use unit doubles only for these isolated scheduling cases.
- [ ] T097 [US2] Add the member-authorized room refetch to `src/rooms/service.ts` using the shared client, exact `id, code, state` projection and immutable accepted room ID with at-most-one-row validation; return recoverable errors on absent/invalid data, never query private participant columns or install event payload state.
- [ ] T098 [US2] Extend `src/rooms/state.ts` with authoritative-refetch application that derives counts from state, retains RPC role, requires matching room identity, and refuses a same-room Ready-to-Waiting rollback while preserving the last known room during transient recovery errors.
- [ ] T099 [US4] Implement `src/rooms/use-room-subscription.ts` using the shared Auth client only after an accepted RPC room ID: channel `room:<id>`, `config.postgres_changes_options.wait = true`, UPDATE filter `id=eq.<id>` on `public.rooms`, and `select: ['id']`; first and every repeated `SUBSCRIBED` plus each matching UPDATE must schedule authoritative refetch, with no channel for rejection outcomes and no primary polling.
- [ ] T100 [US4] Complete `src/rooms/use-room-subscription.ts` with single-active/one-pending refetch coalescing, monotonically increasing lifecycle/request guards, matching room checks, invalidate-before-`removeChannel` cleanup, ignored self-induced CLOSED, recoverable current-generation errors, and retry that removes the failed channel, recovers Auth without replacement identity, creates a new generation, and refetches after binding readiness.
- [ ] T101 [US2] Wire the subscription hook, authoritative state application, preserved-state connection error/retry display, and deterministic unmount/code-change cleanup into `app/room/[code].tsx`; extend `__tests__/routes/room.test.tsx` to prove old joins/refetches cannot contaminate a newly selected room and no Ready transition initiates later behavior.
- [ ] T102 [US2] Add E03 `@us2-realtime` in `e2e/room-session.spec.ts` and extend E02/E04 with both-client convergence assertions: guest reaches Ready from committed join, host reaches Ready/two seats without refresh; include a real-stack variant delaying the host's real Realtime binding until after guest commit, then releasing it to prove first-SUBSCRIBED refetch recovers the missed event without fabricated payloads. In the missed-event variant, register `browserContext.routeWebSocket` before navigation, connect to the real server with `connectToServer()`, hold only the actual outbound room-binding frame until the guest's real join response confirms commit, then forward that unchanged frame and all real server frames; do not synthesize SUBSCRIBED or a change payload. This tests binding timing, not merely late UI observation.
- [ ] T103 [US4] Add E07/E08 `@us4` host/guest reload cases in `e2e/room-session.spec.ts`, retaining each context's storage and comparing its own identity before/after reload; assert host recovery in Waiting and Ready, guest recovery in Ready, identical room code, recovered role through the real RPC result, and no additional seat. Assert zero additional anonymous signup requests for the retained contexts throughout reload/reconnect/repeated operations using T059; new identities are limited to the documented fresh-fixture allocation.
- [ ] T104 [US4] Add E09 `@us4` repeated-join evidence in `e2e/room-session.spec.ts`: repeat each admitted role's real join, dispatch overlapping duplicate guest requests before awaiting either result, and assert `already_member` for an existing seat, the same identity/code/role and no duplicate membership. Keep this idempotency case separate from the network-reconnect case. Assert zero additional anonymous signup requests for the retained contexts throughout reload/reconnect/repeated operations using T059; new identities are limited to the documented fresh-fixture allocation.
- [ ] T105 [US4] Add real `@us4` disconnect/reconnect variants in `e2e/room-session.spec.ts`: retain the accepted context/storage, explicitly interrupt both sides of its real WebSocket and temporarily gate replacement connections, let a guest commit while the host is disconnected, then restore unchanged real transport and observe automatic subscription/refetch recovery to Ready without host reload. Also exercise a guest's Ready recovery; assert actual socket loss/rebinding and identity preservation rather than assuming `setOffline` alone closed an established socket, and close interceptors/connections in `finally`. Assert zero additional anonymous signup requests for the retained contexts throughout reload/reconnect/repeated operations using T059; new identities are limited to the documented fresh-fixture allocation.
- [ ] T106 [US2] Checkpoint — from a clean reset run `npm run db:test`, `npm run lint`, `npm run typecheck`, `npm run test:client`, `npm run web:export`, and `npm run test:e2e -- --grep '@us2-join|@us2-realtime'`; prove scenarios 3–8 and E02/E03/E04/E10/E11 including both independent invitation flows, missed-initial-event recovery, all distinguishable failures, and no post-Ready behavior, record results in `specs/001-room-session/tasks.md`, and leave US2 incomplete on any failure. Normal validation also requires `npm run db:types:check` after the phase reset, without preceding `db:types`. Before this ordinary Auth acceptance selection, run unfiltered `npm run test:e2e:security` after reset/check and account for its separate one-signup cost.
- [ ] T107 [US4] Checkpoint — run `npm run test:client -- --runTestsByPath __tests__/auth/anonymous-session.test.ts __tests__/rooms/use-room-subscription.test.ts __tests__/routes/room.test.tsx` and, after reset/env setup, `npm run db:test` plus `npm run test:e2e -- --grep @us4`; independently prove scenarios 13–14 and E07/E08/E09 with real reload/offline recovery, record results in `specs/001-room-session/tasks.md`, and block phase 9 until both T106 and T107 pass. Normal validation also requires `npm run db:types:check` after the phase reset, without preceding `db:types`. Before this ordinary Auth acceptance selection, run unfiltered `npm run test:e2e:security` after reset/check and account for its separate one-signup cost.

## Phase 9: User Story 3 — Capacity, Concurrency, and Isolation (P1)

**Goal**: Complete browser-level adversarial acceptance over already-proven database invariants; no new capacity rule or backend is invented here.

**Independent test**: Use fresh full/Waiting rooms and distinct browser contexts. A third participant is denied; two genuinely overlapping final-seat requests accept exactly one; unrelated reads and direct mutation attempts disclose/change nothing.

- [ ] T108 [US3] Strengthen E05 in `e2e/room-session.spec.ts` with `@us3` full-room acceptance: use three distinct isolated contexts, assert the third receives only the full outcome/UI with no room projection, and verify host/accepted guest remain the same Ready members after rejection and repeated rejected attempts.
- [ ] T109 [US3] Add E06 `@us3` in `e2e/room-session.spec.ts` using a new Waiting room and two separately bootstrapped isolated guests; dispatch both real final-seat join actions before awaiting either outcome, coordinate an observable request-start barrier without fabricated responses, and assert one `joined`, one `full`, host/winner Ready, loser denied, and no overwritten winner or duplicate seat via real member re-entry and the paired database race evidence. Register request routes for each guest before navigation, hold both outbound join requests until both have arrived, then release both unchanged to the real server before awaiting responses; assert the barrier was reached by two distinct authenticated contexts. Browser dispatch overlap complements, but does not replace, the controlled SQL-lock trial.
- [ ] T110 [US3] Strengthen E12 in `e2e/room-session.spec.ts` with `@us3` read/subscription isolation: create two unrelated rooms, use only the unrelated context's own authenticated publishable-key client to query the exact known unrelated ID and attempt the corresponding Realtime filter, and assert zero Data API rows with no room UI disclosure. Use a fresh Waiting target for a genuine guest-seat UPDATE, confirm it at an authorized observer, and assert no unrelated payload within a bounded observation window; distinguish explicit subscription denial from an allowed empty stream, and never treat lack of subscription readiness as proof of RLS.
- [ ] T111 [US3] Add the E12 `@us3` stale cross-room navigation variant in `e2e/room-session.spec.ts`: use two legitimate invitations, hold one actual old-room response, navigate to the other canonical code, then release the unchanged old response and assert only the newly authorized room remains displayed; observe old-channel teardown and retain independent known-ID RLS denial from T110, without injecting production state or fabricating API payloads.
- [ ] T112 [US3] Extend E12 adversarial coverage in `e2e/room-session.spec.ts` with direct Data API INSERT/UPDATE/DELETE, participant spoofing, occupied-seat replacement/clearing, and writable-state attempts from ordinary participant credentials; assert permission rejection and unchanged authorized membership/Ready, using real client calls only as negative tests and never adding these mutations to application code.
- [ ] T113 [US3] Checkpoint — from a clean reset run `npm run lint`, `npm run typecheck`, `npm run test:client`, `npm run db:test`, and `npm run test:e2e -- --grep @us3 --repeat-each=3`; independently prove scenarios 9–12 and E05/E06/E12, require every final-seat trial to have exactly one winner and every isolation/manipulation trial to disclose/change nothing, record actual results in `specs/001-room-session/tasks.md`, and block final validation on any failure. Record each trial separately; three repetitions exercise the harness and introduce no product performance threshold. Normal validation also requires `npm run db:types:check` after the phase reset, without preceding `db:types`. Before this ordinary Auth acceptance selection, run unfiltered `npm run test:e2e:security` after reset/check and account for its separate one-signup cost.

## Phase 10: Polish — Complete Validation and Documentation

**Goal**: All story evidence reproduces from clean, tracked implementation inputs on Linux, with reliable diagnostics and cleanup on pass/failure.

**Minimum validation**: The complete quickstart sequence, all twelve required browser scenarios, all phase/story checkpoints, generated-type consistency, failure cleanup, and a clean final scope/security review. Android Emulator and iOS Simulator are not acceptance prerequisites.

- [ ] T114 Audit `e2e/room-session.spec.ts` and `playwright.config.ts` against E01–E12: every trial owns its allowed fresh identities/rooms and `finally` teardown, no reset occurs inside per-test/worker hooks, and readiness uses observable assertions. Budget each E01–E12 independent selection (at most 44 collectively), then explicitly enable single-file parallel execution for the acceptance project only with `fullyParallel: true` and run `npm run test:e2e -- --workers=2` from a suite-level reset baseline (at most N = 47); multiple workers alone do not parallelize a single default-serial spec. Keep retries = 0 and repeatEach = 1 for this full run, record counts against the remaining hourly 150 allowance, and schedule extra runs after allowance recovery when needed. Retain only approved test files and report actual fixture-order independence. Run unfiltered `npm run test:e2e:security` first; retain the credential-safety project's serial order and one-signup cap.
- [ ] T115 Revalidate C1 failure diagnostics and cleanup in `e2e/diagnostics/credential-safety.spec.ts`, `scripts/run-e2e.mjs`, `playwright.config.ts`, and the traps in `specs/001-room-session/quickstart.md` after T061: run unfiltered `npm run test:e2e:security`, recording the controlled inner nonzero and successful outer gate separately, with guarded PNG/sanitized error/log evidence and a finalized clean artifact scan. Then use a separate trap-owned validation invocation with a controlled nonzero after the probe to prove failure-path Supabase/Expo/context shutdown; unexpected controller/scan failures must never be converted to success. Restore that external failure condition, not the intentionally failing probe design. Run `__tests__/config/e2e-diagnostics.test.ts` and `__tests__/auth/anonymous-session.test.ts` for unexpected-exit and actionable 429 handling without exhausting live quota or fabricating Auth success. Account for each one-signup probe and all partial attempts under 150; no trace/HAR/video/session dump or raw service output may be retained.
- [ ] T116 Align `specs/001-room-session/quickstart.md` with the implemented root layout, exact Node/bundled npm/CLI versions, local URLs/ports, safe env generation, tracked lockfile/migrations/types, fresh-checkout prerequisites, two-browser procedure, known diagnostics, and cleanup ownership; retain local-only Linux/browser acceptance and no Dashboard SQL/global CLI/hosted dependency/emulator requirement. Preserve the write/check distinction, N = 47 allocation table, anonymous_users = 150, bounded retries/429 diagnostics, restart-after-config-change procedure and separate two-full-run checkpoint. Document C1's trace/HAR/video/storage-export prohibition, helper/scanner/controller paths, unfiltered `test:e2e:security` before authenticated acceptance, guarded PNG/sanitized logs, and separate one-signup security accounting; update no product behavior.
- [ ] T117 Check the exact script surface in `package.json` against `specs/001-room-session/quickstart.md`, including `supabase:status`, `web`, `web:e2e`, `env:local`, `db:types`, `db:types:check`, `playwright:install`, and `test:e2e:security`; verify C1's controller, scanner and safe-process boundaries via `__tests__/config/e2e-diagnostics.test.ts`, plus the two existing wrappers `scripts/configure-local-env.mjs` and `scripts/database-types.mjs` fail safely through their behavior tests. Require initial/intentional write followed by check, but check only in normal and fresh-clone sequences; no Git-based gate or automatic drift repair.
- [ ] T118 Checkpoint — follow the separate two-run procedure in `specs/001-room-session/quickstart.md` against `e2e/room-session.spec.ts` with at least 95 hourly signup allowance remaining (security 1 plus two full suites 94): start one local Supabase stack under cleanup traps, configure env, reset/check, run unfiltered `npm run test:e2e:security` once, then run the complete suite, close its contexts, then reset/check and run the complete suite again with fresh contexts. Never stop/start Supabase between runs. Record both full exits and observed sign-in counts (each at most N = 47, combined at most 94, or 95 including security, within local limit 150), no Auth 429, no hidden sign-ins on reload/reconnect, and final cleanup in `specs/001-room-session/tasks.md`; any failure leaves this repeatability gate incomplete. This separate evidence does not double the ordinary daily suite.
- [ ] T119 Perform a final bounded scope/security review of `app/`, `src/`, `supabase/config.toml`, `supabase/migrations/`, `.env.example`, `.gitignore`, `package.json`, and `e2e/room-session.spec.ts`: confirm exactly two routes, one application table, two contained RPCs, no app-side table mutation, no privileged client key or private-ID UI, no speculative dependency, and no post-Ready behavior; corroborate each security claim with the existing pgTAP/browser evidence and record results in `specs/001-room-session/tasks.md`.
- [ ] T120 Prepare a genuinely fresh checkout containing the implemented, versioned `package-lock.json`, `supabase/config.toml`, `supabase/migrations/`, `src/types/database.generated.ts`, and `specs/001-room-session/quickstart.md`; verify `node --version`, `npm --version`, `docker version`, `docker compose version`, and free local ports, record the actual checkout/environment in `specs/001-room-session/tasks.md`, and do not create commits/pushes as part of this task or claim the current untracked planning worktree is a fresh clone of implemented code.
- [ ] T121 Checkpoint — in the fresh checkout, execute the exact normal command/trap sequence below from `specs/001-room-session/quickstart.md`, including `npm run db:types:check` without a preceding write and unfiltered `npm run test:e2e:security` before one full E01–E12/regression/Auth suite with at most N = 47 sign-ins. Verify T077/T106/T107/T113 and T118 remain evidenced, with every SC-001–SC-008 mapping covered, then record actual command exits, scenario/count/429/cleanup results and shutdown in `specs/001-room-session/tasks.md`; any required failure or unavailable tracked implementation baseline leaves final acceptance incomplete, with no emulator requirement or advance success claim.

## Exact Final Validation Sequence

This is the exact normal/fresh-clone sequence from `quickstart.md`, planned but not executed here. It verifies the existing canonical artifact using check only, then runs one complete suite including regressions/Auth with at most N = 47 sign-ins, preceded by the separate one-signup security gate (48 combined). The separate T118 checkpoint supplies two-run evidence in one continuously started local stack; it is not inserted into the daily sequence.

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

## Dependencies and Execution Order

### Phase graph and green boundaries

```text
P1 Expo baseline [T020]
  -> P2 local Supabase [T029]
  -> P3 schema / grants / RLS [T034]
  -> P4 RPCs / real races / generated types [T049]
  -> P5 mounted Auth -> C1 safety [T061] -> ordinary Auth [T063]
  -> P6 US1 create [T077: independent MVP]
  -> P7 US2 entry + US3 smoke [T091: entry increment only]
  -> P8 publication + Realtime [T094 -> T106: full US2 -> T107: US4]
  -> P9 adversarial browser acceptance [T113: full US3]
  -> P10 repeatability [T118] -> fresh-clone acceptance [T121: complete feature]
```

Phase 3's full type/publication inventory closes at T049/T094, not by premature migration reordering. Manifest/lockfile changes are serialized. Schema precedes functions; both RPCs and all database behavior/race tests pass before typed client integration. Auth precedes create/join route actions. Host create precedes guest full-flow E2E. Accepted join precedes Realtime subscription and browser capacity trials. The Realtime lifecycle precedes reconnect acceptance. Final fresh-clone evidence waits for every story checkpoint.

### Story dependency graph

```text
Shared setup + database + mounted Auth -> C1 safety [T061] -> ordinary Auth
  -> US1 [T077]
     -> US2 entry implementation [T084]
        -> US3 full-room + isolation smoke [T089, T090]
           -> shared join-increment checkpoint [T091]
              -> US2 convergence [T106]
                 -> US4 reconnect [T107]
                 -> US3 full browser acceptance [T113, scheduled after T107]
All four story gates -> T118 repeatability -> T121
```

US3's database capacity/security invariants are foundational, not deferred until its browser phase. US4 needs an accepted session and the shared lifecycle; its product priority remains P2 even though the requested phase ordering places its checkpoint before final US3 adversarial acceptance. Independent validation means a story can be rerun with its own fixtures once prerequisites exist, not that guest/reconnect can exist without host/backend work.

### Within-phase ordering

Execute tasks sequentially except the explicit parallel groups. Tests may be red while the corresponding coherent implementation result is being developed, but no next phase starts until the entire current gate is green. Shared route/service/state/test files are edited serially across stories. Reset, migrations, fault-injection SQL, generated types, and E2E runs must never race each other. Async database test sessions are part of a concurrency test, not permission to run migration tasks in parallel.

### Safe parallel opportunities and per-story examples

| Prerequisite complete | Tasks permitted together | Disjoint review units |
|---|---|---|
| T049 / phase 5 entry | T050 + T051 | `__tests__/config/env.test.ts` versus `__tests__/lib/auth-storage.test.ts` |
| T052 and T050–T051 | T053 + T054 | `src/lib/auth-storage.web.ts` versus `src/lib/auth-storage.native.ts` |
| T063 / phase 6 entry | T064 + T065 + T066 | `__tests__/rooms/contracts.test.ts` + `service.test.ts`; `__tests__/routes/home.test.tsx`; `src/rooms/code.ts` + `__tests__/rooms/code.test.ts` |
| T077 / phase 7 entry | T078 + T079 + T080 | `__tests__/rooms/contracts.test.ts` + `service.test.ts`; `__tests__/routes/home.test.tsx`; `__tests__/routes/room.test.tsx` |
| T094 | T095 + T096 | `__tests__/rooms/service.test.ts` + `state.test.ts` versus `__tests__/rooms/use-room-subscription.test.ts` |

- US1 example: after T063, T064, T065, and T066 may run together; T067 waits for that group, and service/routes/link changes remain sequential.
- US2 example: after T077, T078, T079, and T080 may run together; T081–T091 remain sequential. Later T095 can pair with US4's T096 only after T094.
- US3 example: there is no safe parallel implementation/E2E task group; T089 and T108–T113 share `e2e/room-session.spec.ts` or the same reset stack and execute sequentially. Browser participants inside T109 act concurrently to test the invariant, not to mark the task `[P]`.
- US4 example: T096 may run with US2's T095; T099/T100 edit the same hook and T103/T104 the same E2E file, so each pair is sequential.

For each listed `[P]` task, the table names its only allowed group and concrete disjoint files. Parallel authoring must not edit shared configuration or package files; any targeted checks run in separate processes with test-local fixtures, not a shared mutable client or service stack. Both storage adapters use the pre-agreed synchronous `getItem(key): string | null`, `setItem(key, value): void`, and `removeItem(key): void` interface, so neither depends on the other's output.

Only these 12 tasks carry `[P]`. No scaffold, manifest/lockfile, migration, generated-type, route-edit, shared-service-edit, or E2E task is marked parallel. This is an execution option for a later authorized implementation, not an instruction to spawn agents during task generation.

## Traceability and Evidence Coverage

This is design-to-task coverage, not a claim that acceptance has run. Each row separates implementation from executable tests and names a final checkpoint after those tasks. Where a row lists earlier layer checkpoints as well, they validate only the already-completed subset; full-row coverage is credited only at its last applicable story/final checkpoint, never from future tasks. All checks remain unexecuted; C1/R01/R02 are resolved at the planning level, not presented as runtime passes. No documentation-only review or mock-only integration claim is counted. A01–A14 are the globally numbered spec scenarios; E01–E12 are the quickstart scenarios. Tests exercise real SQL/Auth/RPC/RLS/Realtime boundaries, with unit doubles only for isolated client scheduling and mapping.

### Functional and non-functional requirements

| Requirement | Acceptance scenario | Implementation task(s) | Test task(s) | Checkpoint |
|---|---|---|---|---|
| FR-001 | A01 | T057, T058, T069, T070 | T056, T062, T065, T074 | T077 |
| FR-002 | A01 | T031, T037, T068, T072 | T032, T036, T071, T074 | T049, T077 |
| FR-003 | A01, A03 | T066, T070, T073 | T066, T071, T074, T085 | T077, T106 |
| FR-004 | A01, A05 | T068, T072, T098, T101 | T071, T095, T102 | T077, T106 |
| FR-005 | A03, A05 | T039, T069, T081, T082, T084 | T038, T078, T080, T085, T102 | T106 |
| FR-006 | A04, A05 | T039, T066, T069, T082, T083, T084 | T038, T079, T086, T102 | T106 |
| FR-007 | A09, A10, A12 | T031, T037, T039 | T032, T033, T038, T043, T108, T109, T112 | T034, T049, T113 |
| FR-008 | A01, A03–A05 | T031, T068, T082, T098 | T032, T038, T071, T095, T102 | T049, T106 |
| FR-009 | A10 | T039 | T043, T109 | T049, T113 |
| FR-010 | A09 | T039, T082, T084 | T038, T089, T108 | T113 |
| FR-011 | A13 | T039, T069, T084 | T038, T043, T085, T104 | T107 |
| FR-012 | A14 | T053, T054, T057, T099, T100, T101 | T056, T096, T103, T105 | T107 |
| FR-013 | A05 | T092, T097, T098, T099, T100, T101 | T093, T095, T096, T102 | T106 |
| FR-014 | A01, A03–A05, A13, A14 | T039, T068, T069, T082, T084, T097, T098, T099, T100, T101 | T074, T085, T086, T102, T103, T104, T105 | T077, T106, T107 |
| FR-015 | A06 | T039, T082, T084 | T038, T087 | T106 |
| FR-016 | A07 | T039, T066, T081, T083, T084 | T032, T038, T066, T079, T080, T087 | T106 |
| FR-017 | A06–A10 | T031, T037, T039 | T032, T038, T044, T087, T088, T108, T109 | T049, T106, T113 |
| FR-018 | A12, A13 | T031, T039 | T032, T033, T040, T043, T112 | T113 |
| FR-019 | A11 | T081, T084, T100, T101 | T080, T096, T111 | T113 |
| FR-020 | A11, A12 | T031, T037, T039 | T033, T040, T090, T110, T112 | T113 |
| FR-021 | A05 | T072, T082, T084, T101 | T071, T080, T102 | T106, T121 |
| FR-022 | A02 | T037, T070, T068 | T036, T044, T065, T075, T076 | T077 |
| NFR-001 | A06–A14 | T031, T037, T039, T084, T099, T100 | T032, T033, T038, T042, T043, T044, T104, T105, T108, T109, T110, T112 | T049, T107, T113 |
| NFR-002 | A05 | T092, T097, T098, T099, T100, T101 | T095, T096, T102 | T106 |
| NFR-003 | A01–A09 | T068, T070, T072, T082, T084, T101 | T065, T071, T080, T085, T086, T087, T088, T102, T108 | T077, T106, T113 |
| NFR-004 | A13, A14 | T053, T054, T057, T058, T099, T100 | T051, T056, T062, T096, T103, T104, T105 | T107 |

### Acceptance scenarios

| Scenario | Story / observable browser evidence | Implementation task(s) | Test task(s) | Checkpoint |
|---|---|---|---|---|
| A01 | US1 / E01 | T037, T070, T072, T073 | T036, T065, T071, T074 | T077 |
| A02 | US1 / failed-create variant | T037, T070, T068 | T036, T044, T065, T075, T076 | T077 |
| A03 | US2 / E02 | T039, T069, T084 | T038, T078, T080, T085, T102 | T106 |
| A04 | US2 / E04 | T039, T066, T083, T084 | T038, T079, T086, T102 | T106 |
| A05 | US2 / E02, E03, E04 | T092, T097, T098, T099, T100, T101 | T093, T095, T096, T102 | T106 |
| A06 | US2 / E11 | T039, T082, T084 | T038, T087 | T106 |
| A07 | US2 / E10 | T039, T066, T081, T083, T084 | T032, T038, T079, T080, T087 | T106 |
| A08 | US2 / failed-join variant | T039, T082, T084 | T038, T044, T080, T088 | T106 |
| A09 | US3 / E05 | T031, T039, T082, T084 | T038, T089, T108 | T113 |
| A10 | US3 / E06 | T031, T039 | T041, T043, T109 | T113 |
| A11 | US3 / E12 | T031, T081, T084, T100, T101 | T033, T040, T080, T096, T090, T110, T111 | T113 |
| A12 | US3 / E12 adversarial variants | T031, T037, T039 | T032, T033, T040, T043, T112 | T113 |
| A13 | US4 / E09 | T039, T069, T084 | T038, T043, T085, T104 | T107 |
| A14 | US4 / E07, E08 and actual network recovery | T053, T054, T057, T099, T100, T101 | T056, T096, T103, T105 | T107 |

### Success criteria

| Criterion | Acceptance evidence | Implementation task(s) | Test task(s) | Checkpoint |
|---|---|---|---|---|
| SC-001 | A01, A03–A05 / E01, E02, E04 | T057, T070, T083, T084, T101 | T074, T085, T086, T102 | T077, T106, T121 |
| SC-002 | A05 / E02, E03, E04 | T092, T097, T098, T099, T100, T101 | T095, T096, T102 | T106, T121 |
| SC-003 | A09, A10, A12 / E05, E06, E12 | T031, T037, T039 | T032, T033, T038, T043, T108, T109, T112 | T034, T049, T113, T121 |
| SC-004 | A10 / E06 | T031, T039 | T041, T043, T109 | T049, T113, T121 |
| SC-005 | A13, A14 / E07–E09 plus network recovery | T039, T057, T084, T099, T100, T101 | T043, T096, T103, T104, T105 | T049, T107, T121 |
| SC-006 | A06–A10 / failed and rejected joins | T031, T039, T082, T084 | T038, T044, T087, T088, T108, T109 | T049, T106, T113, T121 |
| SC-007 | A11, A12 / E12 | T031, T037, T039, T084, T100, T101 | T033, T040, T090, T110, T111, T112 | T034, T049, T113, T121 |
| SC-008 | A01–A09 / all visible outcome categories | T068, T070, T072, T082, T084, T101 | T065, T071, T080, T085, T086, T087, T088, T102, T108 | T077, T106, T113, T121 |

### Twelve required browser scenarios

| Browser ID | Acceptance scenario | Implementation task(s) | Test task(s) | Checkpoint |
|---|---|---|---|---|
| E01 | A01 / host Waiting | T037, T070, T072, T073 | T074 | T077 |
| E02 | A03, A05 / generated link | T039, T069, T084, T101 | T085, T102 | T106 |
| E03 | A05 / two-client Ready | T092, T097, T098, T099, T100, T101 | T102 | T106 |
| E04 | A04, A05 / manual code | T039, T066, T083, T084, T101 | T086, T102 | T106 |
| E05 | A09 / third user rejected | T031, T039, T082, T084 | T089, T108 | T113 |
| E06 | A10 / overlapping final-seat race | T031, T039 | T109 | T113 |
| E07 | A14 / host reload | T053, T057, T069, T084, T101 | T103 | T107 |
| E08 | A14 / guest reload | T053, T057, T069, T084, T101 | T103 | T107 |
| E09 | A13 / repeated join | T039, T069, T084 | T104 | T107 |
| E10 | A07 / malformed invitation | T039, T066, T081, T083, T084 | T087 | T106 |
| E11 | A06 / nonexistent code | T039, T082, T084 | T087 | T106 |
| E12 | A11, A12 / unrelated isolation and manipulation | T031, T037, T039, T084, T100, T101 | T090, T110, T111, T112 | T113 |

The actual network-recovery variants in T105 are additional evidence for A14, not substitutes for E07/E08 reload cases. T102 closes the lost-initial-event race with real transport gating. T075, T076, and T088 cover pre-acceptance and ambiguous-failure behavior. Every scenario owns its own fixtures; final T114/T121 validation covers the full matrix without order dependencies. Every controlled trial must pass; an average cannot hide a failed invariant, and harness timeouts/repeat counts are not product SLAs.

### Operational validation traceability

| Requirement | Acceptance scenario | Implementation task(s) | Test task(s) | Checkpoint |
|---|---|---|---|---|
| R01 — deterministic artifact | All typed database/client boundaries | T046, T047, T048 | T045, T049, T094, T117 | T049, T094, T121 |
| C1 — credential-safe diagnostics / Constitution V | All authenticated E2E, including failure paths | T008, T011–T017 | T010, T018, T060, T115 | T061 before T063; T118, T121 |
| R02 — local budget/config | E01–E12 and Auth smoke | T021, T028, T057, T059, T116 | T022, T056, T062, T103, T104, T105, T114 | T029, T063, T107, T118, T121 |

### Standard-suite identity accounting

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

N = 47; `anonymous_users = 150`; three full runs require 141, and T118
requires 94 for its two full runs plus 1 for the preceding security probe (95 total). Smoke cases strengthened in later phases are
not duplicated in the final suite. The standard configuration uses `retries: 0`
and `repeatEach: 1`; targeted repeated trials remain additional charged work.
The exact lifecycle, per-row bounds and exhaustion policy are synchronized with
`plan.md`, `research.md`, and `quickstart.md`.

### Independent story checkpoints

| Story | Implementation increment | Executable independent check | Checkpoint |
|---|---|---|---|
| US1 (P1) | Create, canonical code/link, Waiting, safe retry | Fresh context creates without registration; rejected create exposes no invitation; dropped-response retry and reload recover the same room | T077 |
| US2 (P1) | Shared link/manual entry plus Realtime | Independent link and manual trials both reach Ready on both pages without refresh; invalid/unknown/failed joins preserve state | T106 |
| US3 (P1) | Capacity/locking/RLS plus adversarial browser cases | Third participant denied; both guest requests genuinely overlap and only one wins; unrelated read/subscription/write/stale-state attacks fail | T113 |
| US4 (P2) | Persisted identity and subscription recovery | Host/guest reload and actual transport reconnect preserve role/current state; duplicate joins do not add a seat | T107 |

## Manual Review Findings

**Current verdict**: READY FOR ANALYZE. Remaining BLOCKING 0, MAJOR 0, MINOR 0.
This separately authorized correction closes analyze's sole CRITICAL finding C1
as a planning defect; no implementation or credential leak occurred. Previously
resolved R01/R02 and historical task-level corrections remain intact.

### C1 — NONE, resolved: credential-safe authenticated failure evidence

T008 and T010–T018 establish capture prevention, safe helpers, registry/IPC,
scanner/controller and synthetic runtime evidence. T060 supplies real Auth,
controlled failure and finalized-artifact scanning; T061 blocks T062/T063 and
all ordinary retention. T115/T118/T121 revalidate cleanup, repeatability and the
fresh-clone security-before-acceptance sequence. Main capture is disabled;
sanitization/scan are defense in depth. One security probe adds 1 outside N = 47,
so one full validation is at most 48 and three validations at most 144 within 150.

### R01 — NONE, resolved: deterministic generated-type verification

`plan.md`, `research.md`, and `quickstart.md` now approve the single
`scripts/database-types.mjs` write/check script, npm `db:types` and
`db:types:check`, atomic write, byte comparison without canonical overwrite,
missing/mismatch/generator/empty-output failures, temporary cleanup, and
Git-independent behavior. T045, T046, T047, T048, T049, T094,
T117, and T121 derive from that contract. Normal/fresh-clone gates check the
existing file; intentional write/check plus migration review is a separate
procedure. No Git-index gate or consecutive-generation workaround remains.

### R02 — NONE, resolved: calculated local Auth test budget

The synchronized allocation is 44 for E01–E12, including existing regression
variants, plus 3 for Auth smoke: N = 47. The local-only `anonymous_users = 150`
covers three full runs (141) in an hour/IP. T021, T022, T028, T029, T056,
T057, T059, T062, T103–T105, T114, T118, and T121 specify config,
bounded bootstrap, actual signup accounting, zero new identities on retained
session operations, HTTP 429 diagnostics, and normal/two-run evidence. Restart
applies config changes, never serves as quota evasion; database reset and cleanup
remain separate. All other Auth rate limits and production scope are unchanged.

### R03–R08 — historical task-review corrections retained

The previous manual review merged inseparable schema/security migration edits,
removed disposable RPC stubs, split independent outcomes, isolated Jest discovery,
moved Auth evidence earlier, specified committed SQL fixtures and real race/WS
barriers, corrected scaffold ordering, and separated traceability test columns.
Those task behaviors and the subsequent R01/R02 correction are preserved.
The prior synchronized baseline had 110 tasks. This C1 correction adds eleven
focused security implementation/evidence tasks without changing product behavior.

## Constitution Review

| Principle | Review outcome |
|---|---|
| I — Working behavior | Actual commands/results remain required; planning readiness is distinct from all still-unexecuted implementation gates. |
| II — Small verifiable slices | Ten ordered phase gates remain; coherent migration/function units and separate independent behaviors replace artificial fragmentation. |
| III — Artifact consistency | C1/R01/R02 decisions, commands, budget, failure semantics, tasks and checkpoints agree across all four planning artifacts; normative inputs and contracts remain unchanged. |
| IV — Authoritative state | Database ownership, locks, idempotency, per-outcome disclosure, and stale-state/Realtime safeguards have concrete tasks and tests. |
| V — Least privilege | PASS at planning level: grants/RLS/definer containment remain; T008/T010–T018 prevent credential capture and T060/T061 prove the real-Auth failure-artifact boundary before ordinary Auth acceptance. No runtime pass is claimed. |
| VI — Reproducibility | Non-mutating Git-independent type comparison, explicit local quota, per-run accounting and same-stack repeatability provide concrete future reproduction gates. |
| VII — Executable evidence | Database and browser integration remain real; unit doubles cannot replace them. Test harness setup precedes its evidence, but no runtime pass is claimed. |
| VIII — Scope | One root Expo app, two routes, one application table, two RPCs, local acceptance only, and no behavior after Ready. |

The planning-level Constitution Check is PASS for all eight principles. This is not implementation acceptance: no task checkbox or runtime gate is complete. No constitutional amendment or product-scope change is proposed.

## Implementation Strategy and Handoff

1. Proceed to the separately invoked `$speckit-analyze`; after a satisfactory analysis, commit the complete new specification baseline as a separate authorized step, then begin `$speckit-implement`. None of those operations is performed by this manual correction.
2. Once ready, complete Setup/database/Auth phase checkpoints in order. Deliver US1 through T077 as the independently demonstrable MVP.
3. Deliver shared guest entry and both capacity/isolation smoke cases through T091; full US2 remains pending Realtime.
4. Deliver Realtime/full US2 through T106 and independently validate US4 at T107, then complete US3 adversarial acceptance at T113.
5. Complete the separate T118 two-full-run checkpoint, then full fresh-clone acceptance through T121 after every story gate is green. Implementation commits needed to supply a versioned fresh-checkout baseline remain separately authorized; tasks do not create commits/pushes or infer acceptance from unchecked rows.

## Task-Document Validation Summary

This is reviewed design structure and traceability, not implementation evidence. No workflow, scaffold, dependency installation, database operation, or application test was executed during review.

| Phase | Task IDs | Count | Story labels |
|---|---|---:|---|
| 1 | T001–T020 | 20 | Shared: 20 |
| 2 | T021–T029 | 9 | Shared: 9 |
| 3 | T030–T034 | 5 | Shared: 5 |
| 4 | T035–T049 | 15 | Shared: 15 |
| 5 | T050–T063 | 14 | Shared: 14 |
| 6 | T064–T077 | 14 | US1: 14 |
| 7 | T078–T091 | 14 | US2: 12; US3: 2 |
| 8 | T092–T107 | 16 | US2: 9; US4: 7 |
| 9 | T108–T113 | 6 | US3: 6 |
| 10 | T114–T121 | 8 | Shared: 8 |
| Total | T001–T121 | 121 | US1: 14; US2: 21; US3: 8; US4: 7; shared: 71 |

- All 121 task IDs are unique and sequential, all checkboxes remain unchecked, and every task has exact target paths and a reviewable result. No unfinished template fields remain.
- The 12 parallel markers belong only to the five disjoint authoring groups documented above; no package/configuration/schema/generated-type/E2E task is marked parallel.
- Design traceability is 22/22 FR, 4/4 NFR, 14/14 acceptance scenarios, 8/8 success criteria, 12/12 browser scenarios, and 4/4 story checkpoints. Separate operational rows cover every C1/R01/R02 deliverable. No test pass is claimed.
- Scope and source-path review found no second application table, later-feature implementation, custom backend, or privileged client path. Required cleanup means test fixtures/processes only, not product room expiration or seat release.
- Readiness is READY FOR ANALYZE; C1/R01/R02 are resolved with no remaining upstream conflict. Analysis, baseline commit, and implementation are subsequent separate stages.

### R01/R02 cross-artifact consistency check

| Concern | Plan | Research | Quickstart | Tasks |
|---|---|---|---|---|
| Canonical generated file | `src/types/database.generated.ts` | Same | Same | Same |
| Write command | `db:types` → `database-types.mjs write` | Same | Same | Same |
| Check command | `db:types:check` → `database-types.mjs check` | Same | Same | Same |
| Failure semantics | missing/mismatch/generator/empty failure; prior target preserved; cleanup | Same | Same | Same |
| Fresh-clone sequence | reset → check only → other gates | Same | Same, full trap sequence | Same, full trap sequence |
| Identity count per run | N = 47 (44 + 3) | Same table | Same table | Same table |
| Local anonymous limit | 150/hour/IP; three runs ≤ 141 | Same | Same | Same |
| Restart lifecycle | stop/start after config change, never quota bypass | Same | Same | Same |
| Repeat-run evidence | two full runs, one started stack, ≤ 94 | Same | Same, separate sequence | T118 |
| Auth 429 handling | environment-budget failure; bounded safe diagnostics; no automatic retry | Same | Same | Same |

Eleven C1 tasks were added to the 110-task baseline: T010–T018 (synthetic tests,
sanitizer, registry, scanner, safe reporter/process/fixture/controller and runtime
A/B), T060 (real-Auth failure probe), and T061 (blocking security checkpoint).
All changes are C1 diagnostics, safety-order and accounting consequences; R01/R02
contracts and product evidence remain unchanged. No task ran or was completed.

### C1 cross-artifact consistency check

| Concern | Plan | Research | Quickstart | Tasks |
|---|---|---|---|---|
| Trace disabled | `trace: 'off'` | Same | Same | T008, T018 |
| HAR disabled | No recorder | Same | Same | T016, T018 |
| Storage export disabled | No disk storageState/session dumps; app persistence unchanged | Same | Same | T016, T018 |
| Allowed artifacts | Guarded failure PNG; bounded sanitized diagnostics; no video | Same | Same | T014–T017, T060 |
| Sanitizer path | `e2e/support/sanitize-diagnostics.ts` | Same | Same | T011 |
| Scanner path | `scripts/check-e2e-artifacts.mjs` | Same | Same | T013 |
| Security command | `npm run test:e2e:security` → `node scripts/run-e2e.mjs security` | Same | Same | T009, T017, T061 |
| Auth controlled failure | One real session; exact inner failure plus finalized scan | Same | Same | T060, T061 |
| Gate order | Mounted Auth → safety → ordinary Auth/room acceptance | Same | Same | T061 → T063 → T077 |
| Fresh clone | browser install → security → acceptance | Same | Same, full sequence | T121 |
