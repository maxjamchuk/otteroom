# Research: Create and Join a Two-Person Room

**Feature**: `001-room-session`
**Access date for every source**: 2026-09-05
**Source policy**: Primary documentation and official project release pages only.

## Audited Version Baseline

Every entry below was checked against the linked primary source on 2026-09-05.
"Stable" means the selected release is neither a prerelease nor a development
channel. The Expo manifest is selected as one compatible scaffold output rather
than assembled from unrelated package `latest` tags.

| Package / tool | Selected version | Channel | Official evidence (accessed 2026-09-05) | Post-implementation pin |
|---|---|---|---|---|
| Node.js | `24.20.0` (Krypton LTS) | Stable LTS | [Node.js release schedule and status](https://nodejs.org/en/about/previous-releases) | Exact `.nvmrc` plus `engines.node = 24.20.x` |
| `create-expo-app` | `4.0.0` | Stable | [Published package](https://www.npmjs.com/package/create-expo-app/v/4.0.0) | Versioned `npx create-expo-app@4.0.0`; generator is not a runtime dependency |
| Expo SDK | `57` | Stable SDK | [SDK 57 release](https://expo.dev/changelog/sdk-57) | SDK-compatible manifest from `default@sdk-57`, then lockfile |
| `expo` | `57.0.20` (manifest range `~57.0.20`) | Stable SDK 57 package line | [SDK-57 default template `57.0.22`](https://www.npmjs.com/package/expo-template-default/v/57.0.22) selects [`expo` `~57.0.20`](https://www.npmjs.com/package/expo/v/57.0.20) | Scaffold range plus exact resolved version in `package-lock.json` |
| `react-native` | `0.86.3` | Stable, Expo-compatible | [SDK-57 default template](https://www.npmjs.com/package/expo-template-default/v/57.0.22) | Scaffold exact dependency plus lockfile |
| `react` / `react-dom` | `19.2.3` | Stable, Expo-compatible | [SDK-57 default template](https://www.npmjs.com/package/expo-template-default/v/57.0.22) | Scaffold exact dependencies plus lockfile |
| `expo-router` | `57.0.19` (manifest range `~57.0.19`) | Stable SDK 57 package line | [Published package](https://www.npmjs.com/package/expo-router/v/57.0.19) and [Router reference](https://docs.expo.dev/versions/latest/sdk/router/) | Scaffold range plus exact resolved version in lockfile |
| Supabase CLI (`supabase`) | `2.116.0` | Stable | [CLI release](https://github.com/supabase/cli/releases/tag/v2.116.0) | Exact dev dependency, npm scripts, and lockfile; no global CLI |
| `@supabase/supabase-js` | `2.115.0` | Stable | [Supabase JavaScript release](https://github.com/supabase/supabase-js/releases/tag/v2.115.0) | Exact application dependency plus lockfile |
| `@playwright/test` | `1.63.0` | Stable; published 2026-09-04, not draft/prerelease | [Official v1.63.0 release](https://github.com/microsoft/playwright/releases/tag/v1.63.0) | Exact dev dependency plus lockfile; native browser or Docker server pinned to this version |
| Local PostgreSQL | `17` | Stable major managed by the pinned CLI stack | [CLI v2.116.0 generated config sets `major_version = 17`](https://github.com/supabase/cli/blob/v2.116.0/apps/cli-go/pkg/config/templates/config.toml#L40-L42) | Commit the CLI-generated `supabase/config.toml` unchanged at major 17; no manual override |

Playwright `1.62.1` was the last confirmed candidate before `1.63.0` was
published. It is not selected because the official `v1.63.0` release is now
public, stable, and the npm `latest` release on the audit date. No `next`, beta,
canary, development branch, or other prerelease is used.

The exact versions supplied by the SDK-57 scaffold for Expo support packages,
TypeScript, Jest, and related transitive dependencies are authoritative. Run
`npx expo install` for Expo-native additions and commit `package-lock.json`;
do not manually combine newer React or React Native tags with SDK 57.

## 1. Expo Project Creation and SDK

### Sources

- **Create a project** — <https://docs.expo.dev/get-started/create-a-project/>
- **create-expo-app** — <https://docs.expo.dev/more/create-expo/>
- **Expo SDK 57** — <https://expo.dev/sdk/57>
- **Expo SDK 57 changelog** — <https://expo.dev/changelog/sdk-57>
- **Expo Router reference** — <https://docs.expo.dev/versions/latest/sdk/router/>
- **Expo Crypto** — <https://docs.expo.dev/versions/latest/sdk/crypto/>

### Decision supported and rationale

Use Expo SDK 57, the current stable SDK on the access date. The audited
`expo-template-default` `57.0.22` manifest uses React Native `0.86.3`, React and
React DOM `19.2.3`, `expo` `~57.0.20`, and Expo Router `~57.0.19`. Generate the
future application from `create-expo-app@4.0.0` with template selector
`default@sdk-57` because that template includes Expo Router and TypeScript. Run
the generator only in a temporary directory, with `--no-install` and
`--no-agents-md`, and copy an explicit allowlist of Expo files into the repository
root. Dependency installation then happens once at the root with npm, after
review of the generated manifest.

If the SDK-tagged template has received a compatible patch by implementation
time, accept its generated manifest and record the exact result in the lockfile;
do not substitute incompatible package versions manually. Run `npx expo install`
for Expo Crypto and other Expo-native additions.

Install Expo Crypto through `expo install` and use its `randomUUID()` API for the
cross-platform creation idempotency key. The UUID identifies one logical client
request; the server independently generates the human room code.

### Alternatives rejected

- A hand-built Expo manifest was rejected because the official scaffold is the
  supported compatibility baseline.
- Scaffolding directly into the repository root was rejected because it risks
  overwriting `.agents/`, `.specify/`, and `specs/`.
- A monorepo or `apps/mobile` layout was rejected because one universal client is
  sufficient for this slice.

## 2. Node.js LTS

### Source

- **Node.js releases** — <https://nodejs.org/en/about/previous-releases>

### Decision supported and rationale

Pin Node.js `24.20.0`, the current v24 Krypton LTS release on the access date, in
the repository's runtime-version file and package engine range. Use the npm
version distributed with that runtime and a committed npm lockfile.

### Alternative rejected

Node.js 26 was rejected because it is Current rather than LTS on the access
date. An unpinned system Node.js was rejected because it would weaken fresh-clone
reproducibility.

## 3. Expo Router, Web, and Invitation Links

### Sources

- **Navigation in Expo Router** — <https://docs.expo.dev/router/basics/navigation/>
- **Introduction to Expo Router** — <https://docs.expo.dev/router/introduction/>
- **Handle native intents with Expo Router** — <https://docs.expo.dev/router/advanced/native-intent/>
- **Deploy web apps** — <https://docs.expo.dev/deploy/web/>
- **Publish websites** — <https://docs.expo.dev/guides/publishing-websites/>

### Decision supported and rationale

Use exactly `/` and `/room/[code]`. Expo Router maps those file routes across
web, Android, and iOS and supports direct links. On web, build invitation links
with `new URL('/room/' + code, window.location.origin)` so the result is an
absolute URL usable by a second browser context. On native, use Expo Linking to
create a URL for the same `/room/<CODE>` path under the configured app scheme;
future associated-domain configuration remains deployment configuration, not
database logic.

Validate web output with `expo export --platform web`. Production hosting and
universal-link domain association are outside this slice.

### Alternatives rejected

Separate web and native routing, a link shortener, QR codes, and database-owned
origin configuration were rejected as unnecessary. Custom native-intent routing
is also unnecessary because the canonical route already maps directly.

## 4. TypeScript and Client Testing

### Sources

- **Using TypeScript** — <https://docs.expo.dev/guides/typescript/>
- **Unit testing with Jest** — <https://docs.expo.dev/develop/unit-testing/>
- **Testing Expo Router** — <https://docs.expo.dev/router/reference/testing/>

### Decision supported and rationale

Extend Expo's base TypeScript configuration and enable `strict: true`. Use
`jest-expo` and React Native Testing Library, installed through Expo tooling at
versions compatible with SDK 57. Use Expo Router's testing helpers where route
behavior needs an in-memory route context. Tests assert behavior and accessible
UI states rather than treating snapshots or component presence as evidence.

### Alternatives rejected

Static snapshots as the main client evidence and direct use of deprecated React
test renderer patterns were rejected. A global state library was rejected
because route-local React state and focused hooks cover the two-route slice.

## 5. Supabase Expo Client and Anonymous Identity

### Sources

- **Use Supabase with Expo React Native** — <https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native>
- **Anonymous sign-ins** — <https://supabase.com/docs/guides/auth/auth-anonymous>
- **API keys** — <https://supabase.com/docs/guides/getting-started/api-keys>
- **Supabase JavaScript v2.115.0 release** — <https://github.com/supabase/supabase-js/releases/tag/v2.115.0>

### Decision supported and rationale

Use `@supabase/supabase-js` `2.115.0` with one platform-selected storage module.
The web implementation resolves browser `globalThis.localStorage` lazily inside
its storage methods; static export has a no-op/read-null non-browser path and
never starts Auth bootstrap. It never loads the SQLite adapter or its web/WASM
path. The native implementation is resolved from a `.native.ts` module, imports
`expo-sqlite/localStorage/install`, and passes the installed `localStorage`,
following the Expo quickstart. Both construct the
client with `persistSession: true`, `autoRefreshToken: true`, and
`detectSessionInUrl: false`, which matches anonymous sign-in rather than an OAuth
redirect flow. Construct the client only after validating
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Bootstrap first calls `getSession()` against the selected persistent storage. If
no session exists, call `signInAnonymously()` once and share the in-flight
bootstrap promise so concurrent route effects cannot create multiple identities.
Every protected route action awaits that promise. The resulting Auth user ID is
the local participant identity. Anonymous Auth users use the database
`authenticated` role; a signed-out client uses the distinct `anon` role.
Clearing storage or using another browser context intentionally creates another
participant. Reloading web or native restores the same participant.

Auth and Realtime use the same Supabase client. The client's refresh lifecycle
updates the Realtime access token; after any reconnect the room lifecycle waits
for `SUBSCRIBED` and refetches authoritatively. Refresh or recovery failure is a
recoverable client error, never a reason to invent a new participant while an
existing session is still recoverable.

### Alternatives rejected

AsyncStorage and SecureStore were not selected because the browser already has
the required Web Storage API and the current Expo native quickstart supplies the
SQLite local-storage adapter. Permanent accounts, cross-device recovery,
sign-out UI, service-role access, and a custom auth service are outside the
feature.

## 6. Local Supabase Workflow and Database Version

### Sources

- **Supabase CLI local development** — <https://supabase.com/docs/guides/local-development/cli/getting-started>
- **CLI configuration** — <https://supabase.com/docs/guides/local-development/cli/config>
- **Local development with schema migrations** — <https://supabase.com/docs/guides/local-development/cli-workflows>
- **Database migrations** — <https://supabase.com/docs/guides/local-development/database-migrations>
- **Supabase CLI v2.116.0 release** — <https://github.com/supabase/cli/releases/tag/v2.116.0>

### Decision supported and rationale

Pin Supabase CLI `2.116.0` as a dev dependency and invoke it only through npm
scripts. Its tagged generated configuration selects PostgreSQL major version
`17`; retain that CLI-managed value in committed `supabase/config.toml` rather
than adding an unsupported manual override. Track the configuration, versioned
SQL migrations, and database tests. Set
`auth.enable_anonymous_sign_ins = true` and
`api.auto_expose_new_tables = false` explicitly so client exposure never depends
on a legacy default.

`supabase db reset` is the sole clean-schema reconstruction path: it must replay
all schema, RLS, grants, functions, and publication configuration from committed
migrations. Generate client database types from the reset local database with
`supabase gen types --lang typescript --local --schema public` through the
write/check interface in decision 9; ordinary validation never rewrites types.

The local environment wrapper captures machine-readable `supabase status`
output without echoing it. It accepts `API_URL` plus `PUBLISHABLE_KEY`, falling
back to legacy client-safe `ANON_KEY`, and writes those only as
`EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. It never maps `SECRET_KEY`,
`SERVICE_ROLE_KEY`, a database password, or a JWT secret.

### Alternatives rejected

A global CLI, Dashboard-created objects, manual SQL, hosted-project dependency,
and a separate server were rejected because they are not reproducible from a
fresh clone. Edge Functions and Storage are not required.

Official checks for this correction (2026-09-05): [CLI configuration reference](https://supabase.com/docs/guides/local-development/cli/config#auth.rate_limit.anonymous_users) defines the hourly per-IP anonymous signup limit and stop/start after configuration changes. The [v2.116.0 config template](https://github.com/supabase/cli/blob/v2.116.0/apps/cli-go/pkg/config/templates/config.toml#L159-L188) confirms `[auth]` / `[auth.rate_limit]`, default disabled anonymous sign-in, and `anonymous_users = 30`. Only that local anonymous limit changes; the other Auth limits are not increased.

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

### Budget alternatives rejected

The default 30/hour cannot cover N = 47. Unlimited quota, identity reuse across
scenarios, silent Auth retries, long in-test sleeps, and treating database reset
or service restart as a counter-reset mechanism are rejected. Production CAPTCHA
and hosted abuse policy remain out of scope.

## 7. Generated State and Cryptographic Room Codes

### Sources

- **PostgreSQL 17 generated columns** — <https://www.postgresql.org/docs/17/ddl-generated-columns.html>
- **PostgreSQL 17 pgcrypto** — <https://www.postgresql.org/docs/17/pgcrypto.html>

### Decision supported and rationale

Represent `state` as a stored generated text column derived solely from whether
`guest_user_id` is null. Generate codes inside `create_room` from five
cryptographically random bytes, hex-encode them, and canonicalize to ten
uppercase characters. A unique constraint is the final collision authority;
the function retries generation when that constraint reports a collision.

### Alternatives rejected

A writable state column was rejected because it could drift from membership.
Sequential codes, truncated room UUIDs, and client-generated invitation codes
were rejected because they weaken unpredictability or move authority to an
untrusted client.

## 8. RLS, Grants, and Privileged Functions

### Sources

- **Row Level Security** — <https://supabase.com/docs/guides/database/postgres/row-level-security>
- **Database functions** — <https://supabase.com/docs/guides/database/functions>
- **PostgreSQL 17 CREATE FUNCTION** — <https://www.postgresql.org/docs/17/sql-createfunction.html>

### Decision supported and rationale

Enable RLS on `public.rooms`; grant authenticated users column-level read access
only to `id`, `code`, and generated `state`; and permit rows only when
`auth.uid()` equals the host or guest. Revoke migration-owner default table
privileges for both client roles, revoke all actual room-table access from
`PUBLIC`, `anon`, and `authenticated`, then add only the narrow authenticated
projection. Direct `INSERT`, `UPDATE`, and `DELETE` remain absent.

Use narrowly scoped `SECURITY DEFINER` functions only for `create_room` and
`join_room`. Each checks `auth.uid()`, uses `SET search_path = ''`, and
schema-qualifies every referenced object. Revoke the PostgreSQL default public
function-execute grant, revoke execution from `PUBLIC` and `anon` for each exact
signature, and grant it only to `authenticated`.

The local migration owner is `postgres`, not a client role. It can bypass RLS,
so the function body—not the table SELECT policy—must implement the complete
caller, input, membership, capacity, disclosure, and mutation checks. Neither
function uses dynamic SQL or accepts a caller-selected participant/room UUID.
Directly exposed definer functions remain appropriate only because they are the
two thin, fixed-signature mutation APIs and their exact ACLs and behavior are
executed under `anon` and `authenticated` test roles.

### Alternatives rejected

RLS without SQL grants was rejected because policies do not replace object
privileges. Client table mutation, service-role keys, a broad privileged helper,
and invoker functions that cannot perform the controlled insert/update were
rejected.

## 9. RPC and Generated Database Types

### Sources

- **Call a Postgres function** — <https://supabase.com/docs/reference/javascript/rpc>
- **JavaScript TypeScript support** — <https://supabase.com/docs/reference/javascript/typescript-support>
- **Generating TypeScript types** — <https://supabase.com/docs/guides/api/rest/generating-types>

### Decision supported and rationale

Expose only `create_room(p_creation_request_id uuid)` and
`join_room(p_room_code text)` for membership mutation. Both return one typed row
with a closed outcome vocabulary and only the identifiers/state allowed for that
outcome. Initialize the Supabase client with generated local schema types and use
exact room projections rather than `select('*')`.

### Alternatives rejected

Separate link/code join functions, REST wrappers, Edge Functions, and handwritten
database row types were rejected because they add duplicate authority or type
drift.

Official type-generation checks (2026-09-05): [Supabase CLI gen types reference](https://supabase.com/docs/reference/cli/supabase-gen-types) documents `--lang`, `--local`, and `--schema`; the [v2.116.0 command definition](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/legacy/commands/gen/types/types.command.ts) confirms those flags and local generation. The explicit public-schema projection preserves the existing schema-selection policy.

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

### Generated-type gate alternatives rejected

- Generate then `git diff`: the write can replace a stale artifact before it is
  checked; an index comparison ignores untracked files and changes meaning after
  staging. It does not compare the pre-existing artifact directly with schema.
- `git add -N`: changes repository state and still makes the index part of the
  validation procedure; it is unnecessary for byte comparison.
- Mandatory staging before validation: changes the baseline and excludes normal
  untracked/modified implementation states.
- Two consecutive overwrites: demonstrates repeatability of new generations,
  not consistency of the artifact that existed before validation.

Temporary generation plus direct byte comparison has the same result with or
without repository metadata. Write is an intentional update command; check is
an independent validation command. The normal/fresh-clone sequence is local
startup, full reset, and check only, followed by the other quickstart gates.

## 10. Realtime Postgres Changes

### Sources

- **Postgres Changes** — <https://supabase.com/docs/guides/realtime/postgres-changes>
- **Subscribing to database changes** — <https://supabase.com/docs/guides/realtime/subscribing-to-database-changes>

### Decision supported and rationale

Add only `public.rooms` to the `supabase_realtime` publication in the migration.
After an allowed RPC result, subscribe to UPDATE events filtered by exact
internal room ID and select only the primary-key `id` in the change payload. In
the selected client version the filter uses `select: ['id']`; the channel sets
`config.postgres_changes_options.wait = true`, so `SUBSCRIBED` means the database
change binding is active. Treat every event as invalidation and perform an
authoritative RLS-protected exact-column refetch immediately after the first and
every later `SUBSCRIBED`, as well as after each UPDATE. Ignore event payload
state, coalesce overlapping refetches, and apply results only while their
room/subscription generation is current, so duplicate, delayed, or missed
events cannot roll back or cross-contaminate route state.

### Alternatives rejected

Broadcast is recommended by Supabase for some higher-scale workloads, but was
rejected here because the approved small slice explicitly selects Postgres
Changes. Presence, polling as the primary mechanism, custom WebSockets, and
trusting event payloads as authoritative state were also rejected.

## 11. Database Tests

### Sources

- **Testing and linting with the Supabase CLI** — <https://supabase.com/docs/guides/local-development/cli/testing-and-linting>
- **Database testing** — <https://supabase.com/docs/guides/database/testing>
- **PostgreSQL 17 dblink asynchronous queries** — <https://www.postgresql.org/docs/17/contrib-dblink-send-query.html>

### Decision supported and rationale

Place pgTAP SQL tests under `supabase/tests/database/` and execute them through
the pinned CLI with `supabase test db`. Tests run after `supabase db reset` and
prove structure, constraints, generated state, grants, RLS allow/deny behavior,
RPC outcomes, idempotency, concurrency, disclosure, and failure preservation
against the real local database.

Fixture setup may run as the local migration/test owner to create Auth rows, but
every allow/deny assertion switches to the real `anon` or `authenticated` role
and installs that connection's JWT claims before invoking the Data API-equivalent
SQL surface. It never invokes behavior as `service_role`. True duplicate-create
and final-seat races use two asynchronous, independent PostgreSQL sessions via
test-only `dblink_send_query`, dispatch both calls before collecting either
result, and assert both outcomes plus the single committed row/guest. The
`dblink` extension and single-session fault-only constraints live inside the enclosing
rolled-back pgTAP transaction, not application migrations; setup immediately
revokes their default execution from `PUBLIC`, `anon`, and `authenticated`
before dispatch. Because independent sessions cannot see the enclosing
transaction's fixtures, an owner-only setup connection commits random,
test-namespaced Auth fixtures before dispatch and explicitly deletes them after
all remote connections close; application calls still execute only after each
remote connection changes to `anon` or `authenticated` with its own claims. A
subsequent clean reset is the interruption recovery boundary. The temporary
extra unique constraint forces an unrecognized unique violation to prove it is
rethrown and leaves the prior row unchanged.

T044 is an explicit exception to rollback-only fault-fixture lifetime: its
simultaneous code-collision/idempotency-winner trial requires a privileged,
temporarily committed test schema/function and BEFORE INSERT trigger visible
to both real caller sessions. As specified in `tasks.md` under **T044 fixture
contract**, select exact session PIDs plus
`current_setting('otteroom.test.create_room_fault_mode', true)`, not user identity.
A's `collision_wait` forces occupied canonical code C and waits on B's
session-level advisory lock; B's `winner` forces unused canonical W for the same
H/R. Observe A's actual lock barrier, commit and independently observe B's
winner, then unlock A and require real `rooms_code_key` recovery to
`already_created`. The rollback-contained diagnostic INSERT verifies the actual
constraint name when both keys conflict; the production RPC is not instrumented.
Run the complete fixture lifecycle before the controller's ordinary room/Auth
fixture access, so its transaction cannot block remote trigger DDL. Revoke
PUBLIC/anon/authenticated access before fixture commit, keep all definitions
in the SQL test, and explicitly clean up owned sessions, locks, objects and
rows on success/failure, preserving the original failure. No fixture ships in
migrations or survives test cleanup/reset; reset is not normal cleanup.

Correction sources checked 2026-09-06: PostgreSQL 17 documents
[session-level advisory-lock lifetime and table-lock conflicts](https://www.postgresql.org/docs/17/explicit-locking.html),
[exception-block rollback](https://www.postgresql.org/docs/17/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING)
and [Read Committed visibility](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED).
The old single-transaction-only mechanism cannot retain an independently
committed winner across A's failed INSERT; sleeps, random collisions and a
production test hook are not acceptable substitutes.

### Alternative rejected

Schema file inspection was rejected as acceptance evidence because it does not
execute permissions or concurrency behavior.

## 12. Playwright Multi-Participant E2E

### Sources

- **BrowserContext API** — <https://playwright.dev/docs/api/class-browsercontext>
- **Test isolation** — <https://playwright.dev/docs/browser-contexts>
- **Best practices** — <https://playwright.dev/docs/best-practices>
- **Playwright v1.63.0 release** — <https://github.com/microsoft/playwright/releases/tag/v1.63.0>

### Decision supported and rationale

Use `@playwright/test` `1.63.0` with distinct non-persistent browser contexts for
host, guest, competing guest, and unrelated participant identities. Each context
has isolated cookies and local storage, so real Anonymous Auth creates distinct
users. Run against local Expo web and the fully migrated local Supabase stack,
with no Supabase mocks. Multi-context tests observe both pages concurrently,
including Realtime convergence and final-seat races.

The official stable release was published on 2026-09-04 and is neither draft nor
prerelease. Playwright's `webServer.url` performs readiness detection without an
arbitrary sleep. Each scenario creates fresh Auth contexts and its own new room,
so it is independent of test order after the suite-level clean database reset.
Trace/HAR/video and session exports are disabled. Decision 13 permits only guarded
failure PNGs and bounded sanitized diagnostics after credential-safety evidence.
Playwright owns its web server; a shell trap stops Supabase even when E2E fails.

### Alternatives rejected

Multiple pages in one context were rejected because they share session storage.
Mocked Supabase and tests that inspect implementation details were rejected
because they cannot prove Auth, RPC, RLS, Realtime, or concurrency behavior.

### Phase 1 Playwright runtime amendment

`scripts/playwright-runtime.mjs` owns automatic runtime selection and preparation.
For pinned Playwright 1.63.0, native Chromium is used on supported x64/arm64
Debian 12/13, Ubuntu 22.04/24.04/26.04, macOS 14+, and Windows 11+/Server 2019+.
Other Linux distributions (including AlmaLinux) use only the official image
`mcr.microsoft.com/playwright:v1.63.0-noble`; no native fallback after Docker
failure, global Playwright, `LD_LIBRARY_PATH`, extracted RPM libraries, or
temporary Node/Chromium installation is accepted as checkpoint evidence.
Node 24.20.0 remains the `.nvmrc`/engines prerequisite; a persistent user version
manager may supply it without machine-specific paths in repository commands.

`npm run playwright:install` maps to
`node scripts/playwright-runtime.mjs install`: install project-local Chromium
on supported systems, otherwise pull the exact image. The Docker daemon must be
accessible before preparation/testing; failures give bounded actionable guidance.
The image supplies browsers/system libraries; its server command separately pins
`npx --yes playwright@1.63.0 run-server --port 3000 --host 0.0.0.0`.

`scripts/run-e2e.mjs` owns each uniquely named/labeled container, loopback-only
ephemeral WS port discovery, bounded WebSocket readiness probes, and
`PW_TEST_CONNECT_WS_ENDPOINT` injection for the host-side test fixture. No manual
endpoint export or externally supplied browser executable is used.
Use `--add-host=hostmachine:host-gateway`; Expo listens on the host LAN interface.
Both host readiness and browser baseURL remain `http://127.0.0.1:8081`.
Docker uses official Playwright `exposeNetwork: '<loopback>'` to forward only
loopback traffic through the runner-owned connection, so host firewall rules for
bridge-to-host traffic do not become an undocumented prerequisite. The host
mapping is still explicit, but gateway HTTP is not required. No application
source hardcodes `hostmachine`, and unchanged local-service URLs need no backend
work or firewall changes in Phase 1.

Container stop/remove runs in finally after success, test/startup failure, SIGINT
or SIGTERM, without touching unrelated containers. Preserve original test exit
codes (and signal codes 130/143); cleanup/scanner failure also fails validation.
The existing exact controlled-C security exception is unchanged.
Docker uses `--log-driver=none`; the safe-process layer drains server/CLI output
without raw persistence and parses only bounded port/state metadata in memory.
No host repository, credential registry, storage files or Docker socket is mounted.
C1 capture-off defaults, safe reporter, sanitizer, registry and scanner stay intact.

`__tests__/config/playwright-runtime.test.ts` proves selection, exact image,
preparation, readiness, unavailable Docker diagnostics, exit preservation,
success/failure/interrupt cleanup, and absence of runtime environment injection.
T020 additionally requires real Docker navigation on AlmaLinux to `/` and
`/room/ABCDEF0123`, direct navigation/reload, static C1 A/B, fresh `npm ci`,
Expo dependency checks, and no remaining owned container/Expo process or port.
This amendment supersedes only the native-only install mapping in completed
T009; T001–T019 remain untouched, and T008's host/browser URL agreement remains.
It does not authorize T021 or change C1/R01/R02, product behavior or versions.

Runtime amendment sources: [official Docker remote-server/networking guidance](https://playwright.dev/docs/docker),
[supported systems](https://playwright.dev/docs/intro#system-requirements), and
[scoped connection network exposure](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-option-expose-network).
Rejected runtime alternatives: manually extracted RPMs or temporary library paths
(unrecorded machine state), native Chromium on unsupported Linux, an unpinned
image/server version, a user-managed WS endpoint, and raw Docker log retention.
This runtime decision applies to pre-Auth Phase 1; later Auth semantics are unchanged.

## 13. Credential-safe Playwright Diagnostics for Real Anonymous Auth

### Official evidence checked for pinned 1.63.0

- [Official stable 1.63.0 release](https://github.com/microsoft/playwright/releases/tag/v1.63.0): released 2026-09-04; the approved version is unchanged.
- [Trace Viewer network documentation](https://playwright.dev/docs/trace-viewer#network): recorded requests expose headers and request/response bodies; trace also carries action/page/console evidence.
- [Tracing API](https://playwright.dev/docs/api/class-tracing): screenshot, source and DOM/ARIA/screen snapshot selection control capture categories, not comprehensive secret redaction.
- [Pinned trace recorder](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/trace/recorder/tracing.ts) constructs its network recorder with attached content. The [pinned HAR recorder](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/har/harTracer.ts) records request/response headers, cookie values, bodies and sent/received WebSocket frames. Omitting HAR content or cookies alone does not remove Authorization headers or every credential-bearing channel.
- [TestOptions](https://playwright.dev/docs/api/class-testoptions#test-options-trace), [screenshots](https://playwright.dev/docs/screenshots), and [videos](https://playwright.dev/docs/videos) provide independent off/capture controls. A standalone PNG is a visual artifact, not a network archive; it is safe here only after the UI guard. Video captures successive visible frames and adds unnecessary checking complexity, so it is disabled.
- [Reporter API](https://playwright.dev/docs/api/class-reporter) allows a custom reporter, including stdout/stderr and result handling; the [1.63.0 release](https://github.com/microsoft/playwright/releases/tag/v1.63.0) also exposes API step parameters to reporters. Reporters therefore need an allowlist, not unrestricted object serialization.
- [Pinned runner artifact recording](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright/src/index.ts) uses `PLAYWRIGHT_NO_COPY_PROMPT` to skip the automatic page snapshot, but [error-context construction](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright/src/errorContext.ts) still includes error messages and source context. Trace off alone does not secure these outputs; the selected contract sanitizes errors before runner handling and verifies finalized files.
- [Supabase session definition](https://supabase.com/docs/guides/auth/sessions#what-is-a-session): a real session includes an access JWT and refresh token. Anonymous identities still possess session credentials; the public project key does not make session payloads public.

### Decision and threat

**Decision: Credential-safe Playwright diagnostics for real Anonymous Auth.**
The documentation and pinned implementation do not provide a supported universal
redaction switch guaranteeing removal of Authorization, cookies, arbitrary
request/response bodies and WebSocket payloads from every trace. This is the
review's conclusion from those official capabilities, not a claim that every
possible trace option always records all of them. Disable trace and HAR entirely;
retain only the minimal guarded PNG/sanitized-diagnostic surface defined below.

A retained failure artifact can expose a live session even if ignored by Git,
later deleted, or never uploaded. Repository exclusion and cleanup address
tracking/lifecycle, not credential-safe creation. Screenshots are acceptable only
when no credentials are rendered and capture is guarded; sanitizer/registry/scan
supply executable defense in depth, never permission to record raw traffic.

### Rejected alternatives

- `on-first-retry` trace: the retry is still authenticated and records credentials.
- `retain-on-failure` trace: failure is precisely when sensitive diagnostics would be persisted.
- HAR with post-processing: raw data has already been written; partial body/cookie suppression is not complete redaction.
- “Just gitignore artifacts”: ignored artifacts remain files that can expose credentials.
- Delete artifacts after the test: deletion does not undo the initial exposure.
- Console-log discipline alone: does not cover runner/network/reporter/process capture.
- Trace with some snapshot categories disabled: narrower recording is not a documented universal credential-removal guarantee.
- Video on failure: multiple unchecked frames add risk without necessary acceptance evidence.

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

## Resolved Design Conclusions

- One application table is technically sufficient: fixed host and guest UUID
  columns encode the two seats and PostgreSQL owns all mutation invariants.
- Creation idempotency is guaranteed by `(host_user_id, creation_request_id)`;
  code collision handling is independent and retry-safe.
- A locked room row serializes final-seat claims, so exactly one distinct guest
  can join.
- Realtime is a notification transport only; the Data API refetch under RLS is
  authoritative.
- The client needs only two public environment values and never needs a secret or
  privileged key.
- No decision required for this slice remains open.
