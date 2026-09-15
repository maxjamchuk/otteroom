# Quickstart: Validate TMDB Candidate Source

This guide describes the future implementation evidence required for Feature 006.
It is not an implementation script and no command below was run during planning.
Record exact commands, versions, outcomes, timestamps and omissions when the
feature is implemented.

## Prerequisites

- Node.js 24.20.x and npm 11.19.0
- Docker and Supabase CLI 2.116.0
- Deno 2
- Playwright Chromium installed through the repository wrapper
- separately provisioned `TMDB_API_READ_ACCESS_TOKEN` for the Edge Function
- local public Supabase values only in the client environment

Never prefix the TMDB token or a Supabase server key with `EXPO_PUBLIC_`. Keep
Edge secrets in ignored local function environment and hosted Supabase secrets;
never print them or copy them into receipts/artifacts.

## 1. Static planning/contract review

Verify consistency among:

- [spec.md](spec.md)
- [plan.md](plan.md)
- [research.md](research.md)
- [data-model.md](data-model.md)
- all files under [contracts/](contracts/)
- Feature 005 private handoff and Feature 002 evolved boundaries

Confirm no task/implementation assertion changes the spec's exact eligibility,
empty-result, display, locale/adult, privacy or first-candidate-only scope.

## 2. Fresh dependency and local-stack setup

At implementation time, use the repository's declared setup:

```sh
npm ci
npm run playwright:install
npm run supabase:start
npm run env:local
```

Provision the ignored Edge secret file separately and start/serve the Edge
runtime through the reviewed repository wrapper. Record only secret names and
presence, never values.

Expected: Auth, Data API, PostgreSQL, Realtime and the `room-candidate` Edge
endpoint are healthy; ordinary client configuration contains only public keys.

## 3. Migration and PostgreSQL authority

Before generated types are written:

```sh
node scripts/check-tmdb-candidate-migration.mjs
npm run db:reset
npm run db:test
```

Required evidence:

- one nonempty additive migration; historical migrations unchanged;
- clean latest reset and upgrade from preserved Waiting/partial/compatible/
  incompatible rooms with null and non-null fixture FKs;
- every existing row/value/`xmin` required by the migration fixture preserved;
- all rooms default Feature 006 pending; no TMDB ID or empty result invented;
- legacy fixtures/FK/RPC preserved internally but denied as normal authority;
- exact status/ID/check/ACL/owner/search-path/function signatures;
- Feature 005 noncompatible/malformed handoff returns no private payload/write;
- all-Any, one clause, duplicate equal clauses, disjoint clauses and inclusive
  boundary algebra;
- adult, year and missing-clause candidate commit rejection;
- deterministic dblink race across candidate/candidate and candidate/empty:
  exactly one terminal write, losers return winner, repeats preserve `xmin` and
  `updated_at`;
- rollback and committed-response-loss recovery;
- ordinary roles cannot execute server functions or directly read/write new ID,
  private handoff or mapping.

Database tests are the lock/write oracle; browser overlap is not.

## 4. R01 — exactly one generated-type write

Only after the final database contract:

```sh
npm run db:types
npm run db:types:check
```

This is the one intentional generation. Review the enum/room/create/join/server
function shapes and absence of private movie metadata. Every later validation is:

```sh
npm run db:types:check
```

No second write is permitted unless the approved DB contract itself changes and
the upstream artifacts are re-reviewed.

## 5. Edge pure and controlled-HTTP evidence

Run the future reviewed Edge test command, followed by a local function contract
probe. It must use injected/fake fetch for completed-empty cases and no real secret:

```sh
npm run test:edge
```

Required exact cases:

- query contains explicit en-US/adult false/primary inclusive dates and no
  region/popularity/provider filters;
- driver OR-clause is a conservative superset and the validator preserves every
  clause, duplicates, all-Any, one constrained voter and disjoint sets;
- mixed comma/pipe and DNF expansion are absent;
- zero/one/multiple pages; duplicate IDs; date bisection; page 500; >500 parent;
  single-day >500; inconsistent totals; 100-request and 20-second early stop;
- only a fully completed, error-free scripted traversal yields completed-empty,
  while making no global-catalog/snapshot claim;
- timeout, 429, 5xx, 4xx auth/config, malformed JSON/schema and bounded backoff;
- Discover success -> candidate CAS -> Details; assigned preflight -> Details
  only; no-candidates -> no TMDB call;
- concurrent losing result adopts DB winner;
- Details/config failure after commit and poster-null distinction;
- exact safe response/error/logging shapes and no secret/constraint exposure.

## 6. Live official-TMDB contract smoke (zero Auth identities)

With the separately provisioned token, run one read-only safe probe:

```sh
npm run test:tmdb:contract
```

It must verify without pinning a movie or logging payloads/secrets:

- Bearer authentication works against v3;
- Genre List contains the 19 configured ID mappings;
- a bounded Discover request returns a parseable standard movie-list shape;
- Details for a returned ID parses under en-US;
- Configuration supplies HTTPS image base and supported poster sizes;
- explicit adult false and date/language parameters were sent.

A 429 or upstream failure fails this gate; do not retry indefinitely or weaken
the contract. This probe supplies live provider evidence but does not replace
deterministic controlled tests.

## 7. Client, security and build evidence

```sh
npm run lint
npm run typecheck
npm run test:client
npm run db:types:check
npm run web:export
```

Run applicable native exports through the existing safe commands once defined.
Client evidence owns exact response/projection parsing, one-flight/effect replay,
monotonic pending->terminal state, conflict overlay, stale generations, same-ID
metadata refresh, acquisition/metadata/poster retry, null-poster fallback,
non-voter parity, new-room navigation and exact three-field card.

Security evidence must prove:

- browser code/bundle/environment contains no TMDB/server secret;
- client sends only room UUID and cannot send a constraint/candidate;
- browser API requests target the Supabase Edge endpoint, not TMDB API;
- only poster CDN traffic may be TMDB-origin client traffic;
- safe errors/logs/artifacts contain no tokens, raw payloads, constraints,
  individual filters, identities or foreign assignments;
- About/Credits uses the approved logo and exact required notice.

## 8. Bounded real-stack browser acceptance

Run only through the safe feature wrapper to preserve workers=1, retries=0,
repeatEach=1, capture-off diagnostics, scanner and owned cleanup:

```sh
npm run test:e2e:security
npm run test:e2e:feature006
npm run test:e2e:smoke
```

The real local application stack uses a deterministic HTTP substitute only for
the TMDB network boundary.

| Case | Cap | Expected observable result |
| --- | ---: | --- |
| J01 | 3 | Voting creator + two voters: compatible exact candidate, simultaneous calls converge, title/year/poster, reload/reconnect/re-entry same ID, attribution reachable, no fixture. |
| J02 | 4 | Non-voting creator + three voters: same candidate/no creator input/privacy/missed update; second room completes every scripted search operation with no eligible movie observed, then recovers stable no-candidates, no Retry and new-room action. |
| J03 | 2 | Precommit external failure then Retry, committed-response loss, Details/config/poster failures, null-poster fallback, same-ID recovery and no fixture fallback. |
| **F** | **9** | Owner cap |

Permanent smoke remains G03/G04/G05/G08/H01 = 16 identities, with only current
compatible-terminal assertions evolved. No targeted fixture-era F02/F04/F07/F08
case runs separately (`T=0`). The first owner+smoke pass is the normal checkpoint.

## 9. R02 admission and receipts

Before every browser block, reserve and record the normative budget:

| Gate | Budget |
| --- | ---: |
| Normal | `1 + 16 + 9 + 0 = 26` |
| Repeatability | `1 + 2 × (16 + 9) + 0 = 51` |
| Fresh checkout | `1 + 16 = 17` |
| Repeatability + fresh checkout | `68` |

Record profile/cases, maxima, actual attempts, successful identities, timestamps,
scanner result and cleanup result. Count partial/failed/manual attempts. HTTP 429
fails; never probe/restart/reset Auth to evade the allowance.

## 10. Repeatability and exact-SHA fresh checkout

From unchanged source, run C1 once and owner+smoke twice with fresh identities.
Then, at the exact implementation SHA in an independent disposable checkout,
prove dependency install, secret-free setup instructions, nonempty migration,
clean reset/full DB tests, check-only generated types, Edge/live contract checks,
lint/type/full client/build/web/native exports, C1 and permanent smoke.

Do not copy environment files, modules, Auth state, volumes or caches. Supply
secrets separately and remove only owned resources afterward.

## Expected final evidence

- one authoritative TMDB ID or stable completed-empty result per compatible room;
- zero candidate query/display for Feature 005 pending/incompatible;
- exact full private predicate and adult/year enforcement;
- zero divergent successful candidate under concurrency/retry/response loss;
- same candidate across voter/non-voting creator and lifecycle recovery;
- TMDB-authored title/year/poster or explicit fallback;
- operational failure distinct from terminal empty;
- zero fixture fallback, secret/constraint leak, advanced details, swipes,
  progression, queue, agreement or match behavior.

## Implementation evidence ledger

### T001 — protected baseline (2026-09-14 Asia/Qyzylorda)

- Branch: `main`.
- Baseline HEAD: `0fcd79e8af4717f781c2bf173de8753e731b8a04`.
- Initial `git status --porcelain=v1`: empty.
- Declared toolchain: Node `24.20.x`, npm `11.19.0`, Supabase CLI `2.116.0`,
  Deno `2`.
- Host at entry: Node `v22.23.2`, npm `10.9.8`, Supabase CLI `2.116.0`;
  `deno` was absent. This records provenance only and is not a passed gate.
- Historical migrations SHA-256, in chronological order:
  `d6222184274428c6dd5d629e4d3416a582e0a74f355c8c6fe1d389630ecad439`,
  `fda4126812feffb7bac5d737d6faae1930db35bbc26a1cb9402fcbad24b5b45c`,
  `71816083a6e1630ab663fa4fd41354b936efa714571809fffca4528f2312f7a9`,
  `04487a75fadafe40a255f9ab3998b64c1109c9de6f4e4324ba441f8856531c38`,
  `1b78eeb52ce9bb194b9530f48b49428b8f5bb7c523ab22d5406e9814d0e8dc52`,
  `9813e830957f82febe184e54a5148faff159f046912b325b0a77d835ae33a71f`,
  `432c6d41ca37d0ea2b3ad00324854c3ec17338f3b6c21a4c4cfe3946c1c54ff0`,
  `10986dc43cad50668e520f16b2c3dbbd44e4cebb1384afb0cb2cfd5798898f1d`.
- Generated DB types SHA-256: `7d9c800c61d2c7604abd24b1e3c723754904a33f616e41ef0e3c4793a3ed82d1`;
  inode `676005`, size `12159`, mtime `2026-09-12 04:16:22.791787823 +0500`,
  ctime `2026-09-12 04:16:23.311829741 +0500`.
- Feature 002 candidate source hashes: contracts
  `951af72829fa9c96fd645d88cc17e0494eb45b3e46bd1de217e4c7412a6f8133`,
  service `b9c9c11589bc285a0094544d98a1a7d28d408985a977d021498e0c74acb1f10d`,
  state `4846f8e30038d283c8b2b2df6470be0842e77782fe1fc39edc38a053da2697e4`,
  hook `8813f7e4f11547f96dce0a5ade0716f6f2fab990fa68fcdb3723ec3a03be07`,
  card `a41c6c5579147ff7ae5e9a88e1cea0a4ca097f499a73cc696bc5c3e434518632`,
  poster map `c043a9164668da794dd014d66e0cb7731b40ec22e19debe08e73c60d8a344a3f`.
- Historical candidate asset hashes: Cardboard Comet
  `5a243057dc4b4cc4e3e80f1f962d17231cf8c28abb324fc4e5e129917884a89e`,
  Clockwork Orchard
  `0d24c74d6f93c305809f2d8e7d9f585a828faec87689ca1c48948ff3fcb2dd13`,
  Cloud Tram Four
  `b5f35244b2baa18340d702772995b5029f4841eae6ac89d3ed6eec67f25931d3`,
  Pebble Bay Lanterns
  `3b8b642fa0dca328c6a0cae9e340d0f243357b65cb471f65931e751f5653e4d7`.
- Feature 005 handoff contract SHA-256:
  `54b2e41b95ac625bd57c928e83ce479b05eb5f7c2d2bb5109880c7d82da306c0`;
  implementation migration SHA-256:
  `10986dc43cad50668e520f16b2c3dbbd44e4cebb1384afb0cb2cfd5798898f1d`.
- E2E safety hashes: diagnostics
  `73222de545f2122ff70f6601e1b0ddb929fc6ad16f1bd32ccf9d02ac70a2ef7f`,
  reporter `58d83c2bfa35bb9c568183cbfebd1277da071d685b0d543f4f614c2c318a28cc`,
  credential registry
  `e91633b75d591a850e2add43cc4db1714d61e0267c44c649e9947e4c0c44a95f`,
  runner `dc10392de0b89458bad89a8571cca62ab6ee8a402febf92626a143cc2c999b56`,
  Playwright config
  `6f92995c48ce08c2646bda629cf760539cad22ad0d36de46a1d05b1d4e4186b3`.
- Package scripts/package manifest SHA-256:
  `92a83d3caa487f01ca9bf0c449abd184be38afc289fc8fd84307274bb2d40670`.
- No executable validation was claimed by T001.

### T002–T003 — setup contract

- Failing evidence: `npm run test:client -- --runTestsByPath
  __tests__/config/tmdb-candidate-source.test.ts` failed 3/4 assertions because
  the three scripts, Deno declaration, authenticated function configuration and
  server-only secret documentation were absent.
- Green evidence: the same command passed 4/4 assertions after adding the
  zero-secret commands, pinned Deno `2.5.2`, enabled Edge runtime with
  `verify_jwt=true`, and documented ignored server-only names.
- Runtime evidence: local packaged `deno --version` reported `2.5.2`.
- Ignore review: the existing root Git and ESLint ignores already cover the
  detected Node/Expo outputs, logs, local environments and test artifacts; no
  Docker, Prettier, Terraform, Helm or published-package ignore is applicable.

### T004–T018 — PostgreSQL authority and R01

- Failing evidence: the initial full DB run failed on the missing Feature 006
  enum/columns/functions; the nonempty Feature 006 upgrade runner reached its
  compatibility phase and failed because the migration was absent. No type
  generation had occurred.
- Nonempty migrations (zero Auth identities): room-membership, participant-
  filters, common-filter-resolution and TMDB-candidate runners all passed and
  performed a latest clean reset with owned fixtures zero. The Feature 006 path
  preserved 6 rooms, 9 members, 2 private parents, 3 clauses and all 4 fixture
  rows including `xmin`; every room became candidate-pending, TMDB IDs and
  invented terminals were zero, and the private mapping contained 19 rows.
- Clean latest reset: passed through
  `XDG_CONFIG_HOME=/tmp/otteroom-supabase-config
  SUPABASE_TELEMETRY_DISABLED=1 npm run db:reset`.
- Full database command: `XDG_CONFIG_HOME=/tmp/otteroom-supabase-config
  SUPABASE_TELEMETRY_DISABLED=1 npm run db:test`; result PASS, 5 files and 857
  assertions. Evidence includes exact enum/check/ACL/owner/search-path shapes,
  private compatible-only handoff, inclusive bounds, all-Any, one/multiple/
  duplicate clauses, adult and missing-clause rejection, rollback, terminal
  `xmin`/timestamp preservation, fixture non-authority, and deterministic
  candidate/candidate plus candidate/empty dblink races with one write and
  drained sessions.
- R01 write count: exactly 1. `npm run db:types` wrote the canonical file once;
  the immediately following `npm run db:types:check` passed.
- R01 output SHA-256:
  `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`;
  inode `642847`, size `13789`, mtime
  `2026-09-14 18:51:26.271838801 +0500`, ctime
  `2026-09-14 18:51:26.941892557 +0500`.
- Generated review found the public status enum, evolved room/create/join
  shapes and the three server RPC signatures; it contains no private mapping
  relation and no title/year/poster catalog fields. All subsequent validation
  is check-only.

### T019–T031 — exact acquisition success slice

- Failing Edge evidence: the first `npm run test:edge` reached Deno type-checking
  and failed on the absent shared eligibility/search contracts and absent
  exported operation handler. After removing an unavailable test-only JSR
  dependency, this was confirmed as 11 missing-module/member errors rather than
  an environment failure.
- Failing client evidence: the focused room/candidate/panel command failed on
  the absent eleven/eight-field candidate-status projection, legacy fixture RPC
  result/parser and the stale future-feature copy (39 failures across the
  intentionally changed suites).
- Focused DB evidence: the Feature 006 authority and historical fixture suites
  passed 2 files / 102 assertions, including exact eligibility and both CAS
  races.
- Edge evidence: `npm run test:edge` passed 14 tests. It proves the exact 19-ID
  mapping, stable smallest-clause OR driver/all-Any omission, prohibited query
  filters absent, strict page/movie parsing, deduped evaluation, adult=false,
  inclusive years, complete AND-of-OR validation, ascending pages, adaptive
  nonoverlapping oldest-first shards, incomplete overflow/inconsistency,
  JWT/body/preflight gates, assignment-before-Details and winner-only response.
- Responsive-provider trial: 100 controlled complete minimum presentations ran
  in 67 ms; 100/100 were under 10 seconds (required threshold at least 95%).
- Client evidence: 11 focused suites passed 283 tests for strict room/Edge
  parsing, exact room UUID invocation, compatible-pending one-flight, role
  parity, immutable identity, same-ID metadata, stale generations, exact card,
  HTTPS poster/null fallback and removal of fixture/future-handoff normal flow.
- `npm run lint` and `npm run typecheck` passed. A parallel check-only generated
  type invocation collided with the focused DB process and failed closed without
  writing; the immediately repeated standalone check-only command passed
  `src/types/database.generated.ts: consistent`. R01 remains exactly one write.

### T032–T039 — terminal convergence and recovery

- Edge concurrency/recovery evidence passed: different eligible proposals
  converged on one CAS winner; a completed-empty loser adopted assignment;
  terminal preflight skipped Discover; and a simulated lost assignment response
  recovered the stored ID through preflight plus Details with exactly one prior
  search.
- Client/Realtime evidence passed for immutable identity, same-ID mutable
  metadata, different-ID conflict, shared React replay flight, explicit request
  generations, retired A→B→A callbacks, voter/non-voter parity, terminal
  invalidation, delayed-pending suppression, incomparable-terminal conflict and
  exactly one `room:<UUID>` ID-only rooms UPDATE channel.
- Focused PostgreSQL race authority remained green (52 assertions), including
  one-write candidate/candidate and candidate/empty races and stable loser
  `xmin`/timestamp behavior.

### T040–T047 — completed-empty and operational degradation

- The controlled failure matrix passed 26 Edge tests total. It covered abort/
  timeout, 429 with and without advisory `Retry-After`, bounded 100/200 ms jitter
  backoff, 400/401/422, 500/502/503/504, transport failure, malformed JSON and
  relevant schema, pagination inconsistency, request/deadline exhaustion, exact
  page 500 traversal under an enlarged test budget, recursive date shards,
  single-day overflow, complete multi-shard zero, and assignment/empty CAS loss.
- Every HTTP retry counted against the configured budget. All interruptions
  returned `search_incomplete` and invoked no terminal commit. Only a fully
  parsed completed traversal invoked the empty CAS; its test result states only
  that no eligible movie was observed in that scripted attempt and contains no
  global-catalog or snapshot claim.
- Assigned Details failure returned only `metadata_unavailable`; two retries
  performed two Details reads and zero Discover calls. Client evidence retained
  same-ID title/year through poster failure and kept acquisition, metadata,
  poster, confirmed-no-poster and terminal-empty actions distinct.
- Safe diagnostics failing evidence first observed the missing Feature 006
  classifier. The green check accepts only seven fixed categories plus bounded
  attempts/pages/shards and rejects extra identity, token or payload fields.
- Combined T039/T047 gate: DB 52 assertions PASS; Edge 26 PASS; 9 focused client
  suites 202 PASS; lint/typecheck PASS; standalone check-only generated types
  consistent. No schema-type write occurred.

### T048–T056 — privacy, presentation and attribution

- Failing evidence preceded implementation: the new strict Edge tests rejected
  missing JWT/body/foreign-room/log controls and later caught invalid Details
  dates/poster paths escaping the injected boundary; the attribution/route tests
  initially failed because the approved asset and reachable surface were absent.
- `npm run test:edge` passed 33/33. The suite covers expired authentication,
  exact one-key UUID bodies, caller-injected actor/constraint/candidate rejection,
  field-free foreign-room masking, the exact three-RPC allowlist, no direct admin
  table route, fixed safe errors/logs, strict Details data, and an explicit body-
  read deadline test added during the complete-diff review.
- `npx supabase test db supabase/tests/database/tmdb_candidate_source.test.sql`
  passed 52/52 ACL, RLS, private mapping, eligibility, terminal and CAS assertions.
- The six focused candidate transport/presentation/compliance suites passed
  48/48. The full client suite passed 39 suites / 667 tests after updating the
  historical fixture-poster error expectation, the five-file database inventory,
  and the local TOML test parser for hyphenated function sections.
- The official blue-square TMDB SVG source is recorded from the official TMDB
  attribution page and verified by published source SHA-1
  `d6f7f0323283bf92471217d16e517181ff203cbf`. Its unaltered 330x238 raster has
  SHA-256 `fc0d5374d74569bb0862f9e3e0ae35c72b24e3306ff9415276bd5bc1dbc0a705`;
  provenance records rasterization only and no color/aspect/orientation/artwork
  change. The reachable About route uses the exact required notice and link.
- `npm run web:export` passed with five static routes including `/about`.
  `npx expo export --platform ios --platform android --output-dir
  dist/native-validation` passed with both native bundles and the same logo
  asset. No platform omission was required.
- The finalized `dist` text scan examined 10 text artifacts and found zero TMDB
  token names, Supabase service-role names/credential patterns, or server-secret
  values. `.env.local` contained exactly the two approved public Supabase names.
  Strict client parser/UI tests separately prove the transport identity anchor is
  never rendered and private constraints/fixture metadata are not retained.
- `npm run lint` passed. `npm run typecheck` passed after removing one ignored,
  stale pre-feature `.expo/types/router.d.ts` cache entry; a clean checkout does
  not contain that derived cache. The standalone
  `XDG_CONFIG_HOME=/tmp/otteroom-supabase-config
  SUPABASE_TELEMETRY_DISABLED=1 npm run db:types:check` passed consistent. One
  earlier check-only invocation without the writable CLI config override failed
  closed and preserved the artifact; it was not a type write. R01 remains one.

### T057–T065 — acceptance infrastructure and live-contract implementation

- Added one process-owned loopback TMDB substitute with fixed candidate, empty,
  timeout, 429, 5xx, malformed, request-limit, Details, Configuration and
  no-poster scenarios. Its control snapshot retains only fixed scenario/count
  fields; the focused protocol test passed without retaining authorization or
  query values.
- Authored J01/J02/J03 at the exact 3/4/2 identity caps. They use the real local
  Auth/UI/Edge/PostgreSQL/Realtime path and substitute only TMDB HTTP. The cases
  cover exact compatible decoys, concurrent winner convergence, non-voting role
  parity, bounded completed-empty, precommit failures, committed-response loss,
  assigned metadata/configuration/poster degradation, null poster, lifecycle
  recovery, attribution, and absence of fixture normal flow. They have not been
  executed yet, so R02 usage remains zero.
- Failing-first profile evidence initially rejected the absent `feature006`
  selector and candidate reporter label. The green profile suite passed 5/5 and
  now requires exactly J01=3/J02=4/J03=2, F=9, passed/Auth-confirmed/cleaned
  receipts, no quota failure, workers=1, retries=0, repeatEach=1, capture off,
  clean finalized scanning, and rejection of CLI/provider/identity/environment
  injection.
- Full discovery remains additive at 42 cases/100 identities; the Feature 006
  normal selection remains only J01–J03. Fixture-era F02/F04/F07/F08 are not
  separately selected. The permanent 16-identity smoke retains G03/G05/H01
  incompatible/no-candidate behavior, evolves compatible G04 to the controlled
  role-equal candidate, and strengthens G08 ordinary-JWT denial for private TMDB
  identity and all three service-only candidate RPCs.
- Static safety now rejects TMDB/server secret names, private constraints, raw
  upstream/request/response data and internal candidate identities in finalized
  artifacts. The safe reporter exposes only fixed `candidate` plus J01/J02/J03
  labels and reviewed source locations.
- Added a separate token-required live runner and ignored-by-default Edge test.
  It is zero-Auth, read-only, uses only official `api.themoviedb.org` v3 Bearer
  requests, dynamically selects (without logging/pinning) a Discover result for
  en-US Details, and checks the 19 genre IDs plus HTTPS Configuration/poster
  sizes. The deterministic suite never treats this smoke as authority.

### T066 — final non-browser gate receipt

- Source at gate: implementation commit
  `bcd3e4ad12cf43e5a5d7392c2cae0a65d19f986e`; acceptance infrastructure and
  this evidence remain uncommitted. Gate timestamp:
  `2026-09-14T20:33:44+05:00`. Host tools: Node `v22.23.2`, npm `10.9.8`,
  Supabase CLI `2.116.0`, Deno `2.5.2`.
- All four nonempty migration runners passed in chronological order, each with
  zero GoTrue signups, preserved historical fixtures/state, unchanged generated
  types, and an owned latest-reset cleanup: room membership, participant
  filters, common-filter resolution, then TMDB candidate cutover.
- The first plain `npm run db:reset` failed before reset because the managed
  filesystem makes the default Supabase telemetry directory read-only. The
  approved writable, telemetry-disabled invocation then passed and applied all
  nine migrations. The full DB suite passed 5 files / 857 assertions in about
  3 seconds.
- `npm run test:edge` passed 33 tests with the live-only contract test ignored,
  as designed. `npm run test:client -- --silent` passed 40 suites / 658 tests in
  69.1 seconds. `npm run lint` and `npm run typecheck` passed.
- The first direct (non-npm) static-security runner invocation failed before
  Playwright because the project-local executable was intentionally absent from
  `PATH`; it created only an empty owned artifact directory and consumed zero
  identities. The approved npm wrapper then passed A/B with two scenarios,
  three finalized artifacts, zero findings, complete cleanup and zero signups/
  identities.
- Web export passed with five static routes including `/about`. The applicable
  iOS and Android exports passed with their bundles and the official TMDB logo.
  The final bundle scan covered eight text artifacts with zero TMDB token-name,
  service-role-name, or Bearer-value matches; `.env.local` contained exactly the
  two approved public Supabase names.
- Check-only generated types passed `src/types/database.generated.ts:
  consistent`; SHA-256 remains
  `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`.
  R01 remains exactly one intentional write at T018.
- Resume timestamp: `2026-09-14T20:46:00+05:00`. The first exact
  `npm run test:tmdb:contract` invocation failed closed with the fixed
  missing-secret diagnostic because npm did not export the newly provisioned
  ignored local environment into the Node subprocess; it contacted no provider
  and consumed zero identities. Loading that approved ignored environment into
  the subprocess without printing or persisting values, then invoking the same
  npm script, passed in 2.4 seconds with only
  `{"component":"tmdb-contract","status":"passed"}`. It verified current
  official Genre List, bounded Discover/adult/date/language behavior, dynamic
  en-US Details, and HTTPS Configuration/poster sizes with zero Auth identities,
  no pinned/logged movie identity and no provider-contract drift.
- T066 completed at `2026-09-14T20:46:03+05:00`. No non-browser evidence was
  rerun except affected typechecks/focused client checks during the later
  acceptance defect fixes; every generated-type validation remained check-only.

### T067 — normal real-stack acceptance receipt

- Admission formula: `1 + 16 + 9 + 0 = 26`; workers `1`, retries `0`,
  repeatEach `1`, capture off. Execution window:
  `2026-09-14T20:49:33+05:00` through `2026-09-14T21:34:05+05:00`.
- C1 passed through the safe security wrapper: A/B passed, the controlled C
  probe failed as designed after one successful anonymous signup, finalized
  artifacts were complete, scanner findings were empty and owned cleanup
  succeeded. C1 attempts/successful identities: `1/1`.
- The final owner receipt passed J01/J02/J03 at exact `3/4/2` identities and
  `9/9` total attempts/successful identities. The final permanent-smoke receipt
  passed G03/G04/G05/G08/H01 at exact `3/4/2/4/3` identities and `16/16`
  total attempts/successful identities. Both used the controlled TMDB HTTP
  substitute, real local Auth/UI/Edge/PostgreSQL/Realtime, scanner zero and
  complete owned runtime/provider cleanup. No fixture-era F02/F04/F07/F08 or
  targeted historical case ran (`T=0`).
- Failing-evidence defect work was counted in full: three failed 9-identity
  owner-profile attempts (`27`); six focused J03 attempts, five failed and the
  sixth green (`12`); one failed 16-identity smoke; and ten focused G04 attempts,
  nine failed and the tenth green (`40`). All `95` of those diagnostic identities
  authenticated successfully, no attempt received HTTP 429, every run used a
  safe wrapper, every finalized scan had zero findings except one deliberately
  failed-closed/redacted failure-context scan, and every owned cleanup completed.
- The browser failures found only acceptance integration defects within approved
  scope: React Native Web poster role selection, the 20-second failure wait,
  cumulative second-room traffic accounting, response-loss callback settlement,
  per-client metadata Retry, and a controlled-stub decoy that was accidentally
  eligible for duplicate Drama clauses. The final substitute uses an Action-only
  missing-clause decoy and an 1888 out-of-range decoy, preserving duplicate-clause
  semantics and making ID 6006 the first eligible movie in J/G flows. Focused
  candidate client tests passed 3 suites / 30 tests; all affected typechecks
  passed.
- Actual T067 R02 accounting, including every failed/partial attempt:
  `121` signup attempts and `121` successful identities. The planned successful
  checkpoint remained exactly `26`; there were no uncounted manual browser runs,
  no quota probes, no retries configured by Playwright, no Auth 429 retries, no
  service reset/restart to replenish allowance and no identity reuse across
  independent cases.
- Release-candidate review preserved exact eligibility/completed-empty/CAS and
  credential boundaries, found no Feature 007 leakage, and left generated types
  unchanged. Local commits were created as
  `bcd3e4ad12cf43e5a5d7392c2cae0a65d19f986e` (`feat: add tmdb candidate source`)
  and `bbc7e6295d07fa80033205169d932f1b30638da1`
  (`test: complete tmdb candidate source acceptance`). The first normal push
  attempt failed locally before remote contact because the host SSH system
  include was unreadable; an empty SSH config bypassed only that host defect and
  the normal push then advanced `origin/main` from the Feature 006 baseline to
  exact source SHA `bbc7e6295d07fa80033205169d932f1b30638da1`.

### T068 — R02 admission stop before repeatability

- At the safe post-T067 checkpoint, `121` identities remained inside the local
  rolling allowance and only `29` of `150` were available. T068 requires an
  up-front reservation of `51`, so no repeatability command or identity was
  dispatched and no quota probe was made.
- Last counted browser receipt completed at `2026-09-14T21:34:05+05:00`.
  Conservative resume point: after a full signup-free hour,
  `2026-09-14T22:35:00+05:00`, from unchanged pushed SHA
  `bbc7e6295d07fa80033205169d932f1b30638da1`. Resume with T068 C1 once, then
  owner+smoke twice; do not rerun T067 or any non-browser gate.

### T068 — repeatability attempt stopped on committed-source race

- Execution resumed after the conservative wait at exact unchanged source
  `bbc7e6295d07fa80033205169d932f1b30638da1`. The first plain check-only
  generated-type validation failed before generation because the managed host's
  default Supabase CLI configuration directory is read-only; the already
  documented writable, telemetry-disabled invocation then passed with
  `src/types/database.generated.ts: consistent`. Canonical SHA-256 remains
  `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`;
  R01 remains exactly one write.
- C1 passed at `2026-09-15T04:02:04+05:00` with A/B green, the controlled C
  failure accepted, exact attempts/identities `1/1`, scanner zero and owned
  cleanup complete. Repeatability pass 1 owner then passed J01/J02/J03 at exact
  `3/4/2`, total attempts/identities `9/9`, scanner zero and cleanup complete at
  `2026-09-15T04:03:31+05:00`.
- Repeatability pass 1 permanent smoke completed all five cases and all `16/16`
  fresh identities at `2026-09-15T04:04:39+05:00`, with G03/G05/G08/H01 green,
  scanner zero and owned cleanup complete, but G04 failed at
  `e2e/support/filter-harness.ts:91`. No HTTP 429 occurred. This partial T068
  attempt therefore consumed `1 + 9 + 16 = 26` attempts and successful
  identities; cumulative Feature 006 R02 actual is `121 + 26 = 147`.
- The finalized safe failure proves a committed-source timing contradiction:
  after G04's third voter commits the final filter, the room is compatible and
  normal Feature 006 acquisition may already render the candidate, while
  `assertFilterProgress(..., 3)` still requires the candidate-card count to be
  zero. The earlier green run depended on acquisition rendering later. Retrying
  a known race would not establish repeatability. Correcting the assertion is
  within approved product semantics but changes the committed source, which
  conflicts with T068's unchanged-source requirement and T069's explicit exact
  SHA. No retry, quota probe, Auth reset/restart, or further identity dispatch
  was performed; T068 and T069 remain open pending resolution of that source-SHA
  contradiction.

### T068 — test-only G04 assertion correction

- The authorized correction changed only `e2e/support/filter-harness.ts`:
  `assertFilterProgress()` always checks the exact `X of N filters collected`
  progress; candidate Edge traffic and candidate-card absence remain required
  while `X < N`, and the helper makes no candidate timing assertion at `X == N`.
  Call-site review confirmed every `1/N` and `2/N` pre-completion guard remains,
  while later scenario-specific assertions continue to own compatible or
  incompatible terminal behavior.
- Zero-identity validation passed: ESLint on the helper, `npm run typecheck`,
  and the three directly relevant static/config suites with 50/50 tests. No
  browser/Auth command ran during fix validation; `git diff --check` passed and
  review confirmed no production file changed.
- The fix is commit
  `6f449a6342b74b14e279c0925a96f0f584aae4ba`
  (`test: fix post-filter candidate assertion`), created at
  `2026-09-15T04:12:32+05:00`. The first push attempt stopped locally before
  remote contact on the known unreadable system SSH include; bypassing only
  that host configuration advanced `origin/main` from
  `bbc7e6295d07fa80033205169d932f1b30638da1` to
  `6f449a6342b74b14e279c0925a96f0f584aae4ba`. This new SHA supersedes the prior
  acceptance SHA for final reproducibility; T067 remains historical evidence,
  and T068/T069 must establish exact-source evidence on the new SHA.
- The failed partial T068 receipt remains `1 + 9 + 16 = 26` attempts and
  successful identities, with G04 failed, scanner zero, cleanup complete and no
  HTTP 429. Cumulative Feature 006 R02 actual remains `147/147`; none of those
  identities count toward a successful repeatability pass.
- Admission at `2026-09-15T04:13:06+05:00` used receipts only: the earlier 121
  identities completed by `2026-09-14T21:34:05+05:00` are outside the rolling
  hour, while the known current-hour receipt is 26. Reserving all 51 identities
  for a from-scratch repeatability profile gives `26 + 51 = 77`, within the
  unchanged allowance of 150. No quota probe, Auth retry, reset/restart or
  partial block is needed.

### T068 — successful repeatability receipt on corrected source

- Exact unchanged source and stack:
  `6f449a6342b74b14e279c0925a96f0f584aae4ba`; workers `1`, retries `0`,
  repeatEach `1`, capture off. The check-only generated-type validation passed
  consistent before browser execution; the canonical generated file remained
  unchanged and R01 remained exactly one write.
- C1 passed at `2026-09-15T04:14:32+05:00`: A/B green, controlled C failure
  accepted, exact attempts/identities `1/1`, scanner zero and owned runtime
  cleanup complete.
- Repeatability pass 1 owner passed J01/J02/J03 at exact `3/4/2`, total `9/9`,
  at `2026-09-15T04:15:57+05:00`; permanent smoke passed
  G03/G04/G05/G08/H01 at exact `3/4/2/4/3`, total `16/16`, at
  `2026-09-15T04:16:57+05:00`. Both finalized scans were empty and all owned
  runtime/provider cleanup completed.
- Repeatability pass 2 owner passed J01/J02/J03 at exact `3/4/2`, total `9/9`,
  at `2026-09-15T04:18:23+05:00`; permanent smoke passed
  G03/G04/G05/G08/H01 at exact `3/4/2/4/3`, total `16/16`, at
  `2026-09-15T04:19:26+05:00`. Both finalized scans were empty and all owned
  runtime/provider cleanup completed. G04 therefore passed twice on the
  corrected exact source.
- The complete from-scratch receipt is exactly
  `1 + 2*(9 + 16) = 51` attempts and 51 successful fresh identities, with no
  HTTP 429, no targeted historical cases, no fixture-era case, no configured or
  manual retry, and no identity reuse across independent cases. Including the
  historical T067 actual and the failed partial T068 receipt, cumulative Feature
  006 R02 actual is now `121 + 26 + 51 = 198` attempts and 198 successful
  identities.

### T069 — exact-SHA disposable fresh-checkout receipt

- The independent detached worktree was created at exact committed and pushed
  release-candidate SHA
  `6f449a6342b74b14e279c0925a96f0f584aae4ba`. It received no copied env file,
  Auth state, module tree, cache, volume or browser state. Host tools remained
  Node `v22.23.2`, npm `10.9.8`, Supabase CLI `2.116.0` and Deno `2.5.2`.
- The first `npm ci` stopped on the managed host's read-only global npm cache.
  A second `npm ci` used a new empty owned `/tmp` cache and completed a fresh
  1,116-package install; the engine warning for the already-recorded host Node
  version did not prevent install or any subsequent gate. The repository
  Playwright runtime preparation passed. `supabase:start` found/started the
  approved local stack through its safe wrapper, and `env:local` independently
  generated an ignored file whose names were exactly the two approved public
  Supabase variables.
- The initial room-membership migration runner stopped at its read-only
  precondition because T068 had left rooms/Auth rows in the shared local stack;
  it had not started a migration reset. The required T069 clean latest reset
  removed that prior test state. This reset was an admitted fresh-DB evidence
  step, not a quota probe or attempt to replenish allowance. Thereafter all four
  nonempty migration runners passed sequentially with zero GoTrue signups,
  `types-unchanged=true`, preserved legacy fixtures/state and successful owned
  latest-reset cleanup. A separate final latest reset applied all nine
  migrations successfully.
- Full PostgreSQL evidence passed 5 files / 857 assertions. Edge evidence passed
  33 tests with the separate live-only test ignored in the deterministic suite.
  Full client/static/security evidence passed 40 suites / 658 tests. ESLint and
  TypeScript typecheck passed. Check-only generated types passed consistent with
  canonical SHA-256
  `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`;
  no generated-type write occurred and R01 remained exactly one.
- The separately supplied ignored token environment was inherited only by the
  live smoke process; no value was read, printed, copied or persisted. The live
  provider smoke returned only
  `{"component":"tmdb-contract","status":"passed"}`, confirming no current
  official-provider contract drift with zero Otteroom identities.
- Web export passed with five static routes including `/about`; applicable iOS
  and Android exports passed and included the official TMDB attribution asset.
  Post-export text scans reported zero token-name, service-role-name or Bearer
  credential findings for web, iOS and Android outputs.
- Fresh C1 passed at `2026-09-15T04:32:35+05:00`: A/B green, controlled C
  failure accepted, exact attempts/identities `1/1`, findings empty and owned
  runtime cleanup complete. Fresh permanent smoke passed at
  `2026-09-15T04:33:35+05:00`: G03/G04/G05/G08/H01 exact
  `3/4/2/4/3`, total `16/16`, findings empty, no HTTP 429 and complete owned
  runtime/provider cleanup. No owner or targeted historical case ran.
- T069 consumed exactly `1 + 16 = 17` attempts and 17 successful fresh
  identities. Successful T068 plus T069 is exactly the planned `51 + 17 = 68`.
  Including T067 diagnostics and the failed partial repeatability attempt, final
  Feature 006 R02 actual is `121 + 26 + 51 + 17 = 215` attempts and 215
  successful identities versus `26 + 51 + 17 = 94` planned across the normal,
  repeatability and fresh gates.
- The detached worktree, its new npm cache and its Supabase CLI config directory
  were removed after validation; existence checks passed. No shared service or
  unowned resource was removed.

### Independent-final-review invalidation and remediation

- The independent final review invalidated the final-source claim at
  `6f449a6342b74b14e279c0925a96f0f584aae4ba`. Its T068/T069 receipts remain
  immutable historical evidence, but they are not exact-SHA reproducibility
  evidence for the remediated release candidate. T067 likewise remains the
  historical normal acceptance receipt on its recorded source.
- Failing-first client evidence on the old source passed 27 and failed 7 tests
  across the three affected suites. It proved that authoritative terminal,
  different-ID and explicit room/resolution integrity conflicts retained a
  displayed candidate/poster, and that `CandidateCard` rendered stale-shaped
  candidate input during `integrity-error`.
- Failing-first Edge evidence passed 13 and failed 5 targeted search tests. It
  proved that positive totals with empty/fewer/greater raw rows and the
  historical 500-page contradiction could become `completed_empty`, while a
  directly contradictory eligible page could become a match. The first direct
  `deno` invocation failed before tests because Deno was absent from host PATH;
  the pinned project Deno then produced the behavioral RED result.
- The client remediation centralizes every integrity transition, clears the
  candidate anchor, makes poster source unavailable, ignores stale poster
  completion, exposes no Retry, and defensively suppresses all candidate
  presentation from an integrity-error model. Same-ID metadata refresh and
  poster-error retention remain unchanged.
- The Edge remediation counts raw rows for each fully traversed final shard,
  independently of movie-ID deduplication, preserves stable page totals, rejects
  direct page/result contradictions, and permits terminal empty only when the
  full raw count equals `total_results`. An exact eligible result may still end
  early after its own page is structurally valid.
- The same focused commands then passed client 3 suites / 34 tests and Edge
  search 18/18. The complete remediation diff changed only candidate client
  state/hook/card plus tests and TMDB search plus tests; no schema, migration,
  generated type, authority, product scope, fixture boundary or Feature 007
  behavior changed.
- Commit `594a54e985b433f3d1c91f25be3f2f62acb5a0a3`
  (`fix: harden candidate integrity and TMDB pagination`) contains exactly the
  eight remediation production/test files. The first push failed locally before
  remote contact on the known unreadable system SSH include; the previously
  reviewed empty-host-config workaround then advanced `origin/main` normally,
  without force, amend or history rewrite. This commit is the new final Feature
  006 release-candidate SHA.

### T066 — remediated final-SHA non-browser receipt

- At exact pushed SHA `594a54e985b433f3d1c91f25be3f2f62acb5a0a3`, the
  deterministic Edge suite passed 38/38 with the separate live-only test ignored;
  the full client/static/security suite passed 40 suites / 662 tests; ESLint and
  TypeScript typecheck passed.
- The approved static-only security selector passed A/B with zero identities,
  three finalized artifacts, zero findings and owned runtime cleanup. Before
  that selector, an accidental ordinary security-wrapper invocation ran C1 and
  consumed one successful Auth identity; its expected controlled failure,
  scanner and cleanup all passed. This unplanned `1/1` is retained in cumulative
  R02 rather than hidden or reclassified as zero-identity evidence.
- Check-only generated types passed consistent with canonical SHA-256
  `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`.
  No type write occurred; R01 remains exactly one.
- Web export passed with five static routes. iOS and Android exports passed and
  included the approved TMDB asset. Name/pattern plus exact-token scans of the
  generated outputs found zero TMDB/server credential values or privileged
  names. The separately supplied live TMDB contract smoke returned only
  `{"component":"tmdb-contract","status":"passed"}` with zero Otteroom
  identities.
- No PostgreSQL production/schema/migration file changed, so the remediation
  T066 profile did not ceremonially repeat the unaffected DB suite; the exact-SHA
  fresh T069 gate below independently reran all four migrations and all 857 DB
  assertions.

### T068 — remediated exact-SHA repeatability receipt

- Admission at `2026-09-15T16:00:06+05:00` used only the configured
  `anonymous_users=150` and recorded receipts, never a quota probe. All
  historical identities were outside the rolling hour; the one unplanned C1
  identity above was the only known current-window use. Reserving the complete
  51-identity block therefore gave `1 + 51 = 52`, within 150.
- Exact unchanged pushed SHA, workers `1`, retries `0`, repeatEach `1`, capture
  off: C1 passed `1/1`; owner pass 1 passed J01/J02/J03 at `3/4/2 = 9/9`;
  smoke pass 1 passed G03/G04/G05/G08/H01 at `3/4/2/4/3 = 16/16`; owner pass 2
  passed `9/9`; smoke pass 2 passed `16/16`. Every finalized scanner had zero
  findings, no Auth request returned 429, and owned runtime/provider cleanup
  completed. The first C1+owner+smoke portion supplies the final-SHA
  normal-equivalent 26-identity evidence; G04 passed in both smoke passes.
- Before the successful second smoke, two pinned-runtime attempts stopped with
  `DOCKER_NOT_READY` before Playwright/Auth and consumed zero identities. Both
  owned containers were removed. The approved `playwright:install` preparation
  passed, after which the unchanged smoke command completed. These zero-identity
  infrastructure attempts are retained and are not counted as Auth attempts.
- T068 is exactly `1 + 2*(9 + 16) = 51` attempts / 51 successful identities.

### T069 — remediated exact-SHA disposable fresh-checkout receipt

- A detached disposable worktree was created at exact SHA
  `594a54e985b433f3d1c91f25be3f2f62acb5a0a3` with no copied environment,
  module tree, cache or Auth state. A new isolated npm cache installed 1,116
  packages. Host tools were Node `v22.23.2`, npm `10.9.8`, Supabase CLI
  `2.116.0` and Deno `2.5.2`; the declared/host Node engine warning did not
  prevent any gate. Pinned Playwright preparation and safe Supabase start passed;
  the independently generated ignored environment contained exactly the two
  approved public Supabase names.
- The admitted fresh reset applied all nine migrations. All four nonempty
  migration runners passed sequentially with zero GoTrue signups, preserved
  fixtures/state, owned latest-reset cleanup and `types-unchanged=true`. A final
  reset again applied all nine migrations.
- The first full DB command passed four files but one existing dblink barrier
  timed out (`race deadline`), producing 856/857. The concrete targeted rerun
  passed the candidate authority file 52/52, and the subsequent complete command
  passed 5 files / 857 assertions. No DB source was changed.
- Fresh Edge passed 38/38 with one live-only ignore; client/static/security
  passed 40 suites / 662 tests; ESLint, typecheck and static-only A/B security
  passed with zero identities/findings. Check-only types matched the canonical
  hash above. Web, iOS and Android exports passed with five web routes and the
  TMDB asset; bundle/token scans found zero findings. The separately injected
  live token was inherited only by the live smoke, which passed with the fixed
  safe receipt and zero Otteroom identities.
- Fresh C1 passed `1/1`; fresh permanent smoke passed
  G03/G04/G05/G08/H01 at `3/4/2/4/3 = 16/16`, with zero scanner findings, no
  HTTP 429 and complete owned runtime/provider cleanup. T069 is exactly
  `1 + 16 = 17` attempts / 17 successful identities.
- The disposable worktree, its npm cache and its Supabase CLI config directory
  were removed after validation; absence checks passed. No shared service or
  unowned resource was removed.

### Final remediation reconciliation

- T001–T069 are restored to 69/69 only after the new exact-SHA gates above.
- R01 remains exactly one generated-types write; every remediation, T066, T068
  and T069 invocation was check-only. Canonical SHA-256 remains
  `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`.
- Historical cumulative R02 through the superseded SHA was
  `121 + 26 + 51 + 17 = 215`. Including the unplanned but fully counted
  remediation C1, new T068 and new T069, actual cumulative R02 is
  `215 + 1 + 51 + 17 = 284` attempts / 284 successful identities.
- Normative planned blocks remain normal 26, repeatability 51 and fresh 17,
  totaling 94. The final-SHA normal-equivalent block is contained in the first
  26 identities of new T068; cumulative failed/superseded/diagnostic attempts do
  not redefine the normative budget.

### Cumulative-pagination final-review blocker and RED -> GREEN

- The next independent final review found one remaining observable inconsistency
  at release-candidate SHA `594a54e985b433f3d1c91f25be3f2f62acb5a0a3`:
  page 1 reported stable `total_pages=2`, `total_results=1` and returned one
  noneligible raw row; page 2 reported the same totals and returned one eligible
  raw row. The cumulative raw count became 2, but the eligible row was returned
  before the final count check.
- Failing-first command used the pinned project Deno against only the new case.
  RED was exactly 0 passed / 1 failed / 18 filtered: expected
  `search_incomplete/pagination_inconsistent`, received `match` for the eligible
  page-2 movie. No Auth identity or live provider was used.
- The smallest production fix adds a cumulative `rawResultCount >
  expectedResults` guard immediately after raw-row accumulation and before movie
  deduplication/eligibility evaluation. The final `rawResultCount !==
  expectedResults` guard remains after full traversal for shortfalls. The
  existing early-match test now explicitly reports a coherent cumulative
  `total_results=2`, proving no unseen-future-page traversal is required.
- The focused regression then passed 1/1, and the complete TMDB search file
  passed 19/19. Existing shortfall, overflow-without-match, raw-before-dedup,
  coherent completed-empty, historical 500-empty contradiction, valid page-500
  and internally coherent early-match cases all remained green. The pre-commit
  full Edge suite passed 39/39 with one live-only ignore; lint and typecheck
  passed. The first check-only type invocation could not reach an unstarted
  local stack and preserved the artifact; after the approved stack start, the
  same check passed consistent with the canonical hash below. No type write
  occurred.
- Commit `9d0a1a106b648868f33b65bf46ef1f563a050371`
  (`fix: reject cumulative TMDB pagination overflow`) contains only
  `supabase/functions/_shared/tmdb-client.ts` and its directly relevant
  `supabase/functions/_tests/tmdb-search.test.ts` evidence. It was committed at
  `2026-09-15T18:06:21+05:00`. The first push stopped locally on the known
  unreadable system SSH include; the reviewed empty-host-config workaround then
  performed a normal non-force push. `HEAD` and `origin/main` both advanced to
  this new final release-candidate SHA.

### T066 — cumulative-pagination exact-SHA non-browser receipt

- At exact pushed SHA `9d0a1a106b648868f33b65bf46ef1f563a050371`,
  `npm run test:edge` passed 39/39 with the separate live-only test ignored;
  `npm run test:client -- --silent` passed 40 suites / 662 tests in 71.892
  seconds; lint and typecheck passed.
- The approved static-only security selector passed A/B with zero identities,
  three finalized artifacts, zero findings and owned runtime cleanup. Check-only
  generated types passed consistent; SHA-256 remained
  `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`.
- Web export passed with five static routes. iOS and Android exports passed with
  the approved TMDB asset. Exact-value/name scans covered 64 generated files and
  found zero TMDB/server credential findings. The separately supplied live TMDB
  contract returned only `{"component":"tmdb-contract","status":"passed"}`
  with zero Otteroom identities.
- No PostgreSQL/schema/migration/generated-type source changed, so this
  applicable T066 gate did not repeat unaffected DB suites. Exact-SHA T069 below
  independently reran every migration runner, clean reset and all 857 DB
  assertions.

### T068 — cumulative-pagination exact-SHA repeatability receipt

- Admission at `2026-09-15T18:10:58+05:00` used only the configured
  `anonymous_users=150` and recorded receipts. The latest prior Auth receipt was
  outside the rolling hour, so the complete normative 51-identity block was
  reserved before starting; there was no quota probe or allowance-changing
  action.
- On unchanged exact SHA, with workers 1, retries 0, repeatEach 1 and capture
  off: C1 passed 1/1; successful owner passes each passed J01/J02/J03 at
  3/4/2 = 9/9; successful smoke passes each passed
  G03/G04/G05/G08/H01 at 3/4/2/4/3 = 16/16. Thus the required normative shape
  is exactly `1 + 2*(9 + 16) = 51`, and the first successful
  C1+owner+smoke sequence supplies normal-equivalent 26/26 evidence. G04 passed
  in both credited smoke passes.
- Two failed browser attempts remain recorded rather than discarded. One full
  owner attempt consumed 9 successful identities while J03 ended in a generic
  safe E2E failure; a later unchanged full owner pass passed all three cases.
  One full smoke attempt consumed 16 successful identities while G04 detected
  one existing Realtime-harness premature-read invariant; a later unchanged
  full smoke passed all five cases. Both failed attempts had `authSuccess=true`,
  `budgetFailure=false`, scanner zero and complete cleanup; neither reported
  HTTP 429. Before each replacement, the complete remaining block was reserved
  from receipts, reaching conservative maxima 60/150 and then 76/150.
- T068 therefore consumed 76 attempts / 76 successfully created identities:
  normative successful evidence 51 plus failed owner 9 plus failed smoke 16.
  No source, harness or stack change occurred during the block.

### T069 — cumulative-pagination exact-SHA disposable fresh receipt

- A detached disposable checkout at exact SHA
  `9d0a1a106b648868f33b65bf46ef1f563a050371` received no copied env,
  modules, npm cache, Auth state or browser cache. A new isolated cache completed
  `npm ci` with 1,116 packages. Host tools were Node `v22.23.2`, npm `10.9.8`,
  Supabase CLI `2.116.0` and Deno `2.5.2`; the already-recorded Node engine
  warning did not prevent any gate. Pinned Playwright preparation passed;
  Supabase started; fresh ignored `.env.local` contained exactly the two
  approved public Supabase names.
- The first three migration runners stopped at read-only preconditions because
  the retained local volume contained post-T068 state; they used zero GoTrue
  signups. The TMDB runner completed its owned latest reset. After the required
  clean latest reset, all four nonempty migration runners passed sequentially
  with zero GoTrue signups, preserved fixtures/state, `types-unchanged=true` and
  owned cleanup. A final reset applied all nine migrations.
- Full PostgreSQL passed immediately: 5 files / 857 assertions, including the
  dblink concurrency evidence, with no barrier timeout. Fresh Edge passed 39/39
  plus one live-only ignore; client/static passed 40 suites / 662 tests;
  lint/typecheck and static-only A/B security passed with zero identities and
  findings. Check-only types matched the canonical hash. Web/iOS/Android exports
  passed with five web routes and the TMDB asset; a 64-file bundle scan found
  zero credential findings. The separately supplied live contract passed with
  its fixed safe zero-identity receipt.
- Fresh C1 passed at `2026-09-15T18:39:53+05:00` with 1/1 identity, scanner zero
  and cleanup complete. Fresh permanent smoke passed at
  `2026-09-15T18:41:34+05:00` with G03/G04/G05/G08/H01 at 3/4/2/4/3 = 16/16,
  scanner zero, no HTTP 429 and cleanup complete. T069 is exactly 17/17; no owner
  or obsolete fixture-era case ran.
- The owned stack was stopped and the disposable worktree, npm cache and
  Supabase CLI configuration directory were removed. Absence checks and the
  remaining worktree list passed; no shared/unowned resource was removed.

### Cumulative-pagination final reconciliation

- T001–T069 return to 69/69 only after the exact-SHA T066/T068/T069 gates above.
  All older final-SHA receipts remain historical/superseded evidence.
- R01 remains exactly one generated-types write in commit
  `bcd3e4ad12cf43e5a5d7392c2cae0a65d19f986e`; every later invocation was
  check-only, and the canonical SHA-256 remains
  `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`.
- Cumulative R02 actual is now `284 + 76 + 17 = 377` attempts / 377 successful
  identities. Normative Feature 006 budgets remain normal 26, repeatability 51,
  fresh 17, total 94; failed and superseded evidence changes actual cost only.

### Terminal-conflict final-review blocker and RED -> GREEN

- The next independent final review found one remaining client merge defect at
  release-candidate SHA `9d0a1a106b648868f33b65bf46ef1f563a050371`.
  `receiveCandidate()` allowed an accepted `assigned` terminal to be replaced by
  an Edge `no_candidates` result, while its early `no-candidates` guard silently
  ignored the opposite `available`/`metadata_unavailable` terminal. Both paths
  contradicted the symmetric fail-closed projection contract.
- Failing-first reducer command was
  `npm run test:client -- --runTestsByPath __tests__/candidates/state.test.ts --silent`.
  RED was exactly 1 failed suite, 3 failed / 12 passed tests: assigned-to-empty
  produced `no-candidates`, and no-candidates-to-available plus
  no-candidates-to-metadata-unavailable remained `no-candidates`, where every
  case required `integrity-error`. No browser, Auth identity, database or
  provider was used.
- The smallest production fix adds one `candidateResultAuthority()` mapper:
  `available`/`metadata_unavailable -> assigned`, `no_candidates ->
  no_candidates`, and `not_ready`/`not_found -> null`. `receiveCandidate()` now
  compares that implied authority with an already accepted terminal before the
  existing no-candidates short-circuit or any result-specific transition and
  calls the centralized sticky `enterIntegrityError()` on an opposite terminal.
  PostgreSQL authority and all Edge/schema/migration/generated-type behavior are
  unchanged.
- GREEN reducer evidence passed 15/15. The affected reducer/hook/card/room-route
  set passed 4 suites / 67 tests. Added evidence proves displayed candidate
  suppression, both terminal directions, assigned-implying
  `metadata_unavailable`, equal-terminal validity, same-ID mutable metadata and
  metadata recovery, no Retry/new-room action on integrity, sticky subsequent
  result/failure handling, and stale request/poster callback suppression.
  A hook case explicitly preserves the distinct rule that a callback retired by
  a canonical generation change is ignored rather than reclassified as a
  same-generation conflict.
- Pre-commit full lint/typecheck, check-only types and web/iOS/Android exports
  passed. The initial check-only invocation failed closed while the project
  local stack was unavailable and preserved the artifact; after starting the
  owned stack the same check passed consistent. No generated-type write occurred.
- Commit `a5db7a7e40840f52d740bb169e6b03c7edc6bdac`
  (`fix: reject conflicting candidate terminals`) contains exactly
  `src/candidates/state.ts` and four directly relevant candidate/hook/card/route
  test files. The first push stopped locally before remote contact on the known
  unreadable system SSH include; the reviewed empty-host-config workaround then
  performed a normal non-force push. `HEAD` and `origin/main` both advanced to
  this final release-candidate SHA.

### T066 — terminal-conflict exact-SHA non-browser receipt

- At exact pushed SHA `a5db7a7e40840f52d740bb169e6b03c7edc6bdac`,
  `npm run test:edge` passed 39/39 with the separate live-only test ignored;
  `npm run test:client -- --silent` passed 40 suites / 672 tests; lint and
  typecheck passed.
- The approved static-only A/B security selector passed with zero identities,
  three finalized artifacts, zero findings and owned runtime cleanup.
  `db:types:check` passed consistent with SHA-256
  `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`.
- Web export passed with five static routes. iOS and Android exports passed with
  the approved TMDB asset. Exact-value/name scans covered 64 output files with
  zero credential findings. The separately supplied live TMDB contract returned
  only `{"component":"tmdb-contract","status":"passed"}` and used zero
  Otteroom identities.
- The fix changed no PostgreSQL/schema/migration/Edge/generated-type source, so
  T066 did not ceremonially rerun the unaffected DB suite. Exact-SHA T069 below
  independently reran every migration runner, a clean reset and all 857 DB
  assertions.

### T068 — terminal-conflict exact-SHA repeatability receipt

- Admission at `2026-09-15T19:13:41+05:00` used only configured
  `anonymous_users=150` plus recorded receipts: 66 identities were inside the
  rolling hour. The entire 51-identity block was reserved before starting,
  giving conservative maximum 117/150; no quota probe, reset, restart, limit
  change, partial block or automatic retry occurred.
- From unchanged pushed SHA, execution completed from
  `2026-09-15T19:14:27+05:00` through `2026-09-15T19:21:30+05:00`, workers 1,
  retries 0, repeatEach 1 and capture off. C1 passed 1/1; each owner pass passed
  J01/J02/J03 at 3/4/2 = 9/9; each permanent-smoke pass passed
  G03/G04/G05/G08/H01 at 3/4/2/4/3 = 16/16. Every scanner reported zero,
  cleanup completed, G04 passed twice and no HTTP 429 occurred.
- T068 is exactly `1 + 2*(9 + 16) = 51` attempts / 51 successful identities.
  The first C1+owner+smoke sequence supplies final-SHA normal-equivalent 26/26.
  There were no failed, partial or superseded browser attempts in this
  remediation block.

### T069 — terminal-conflict exact-SHA disposable fresh receipt

- At `2026-09-15T19:22:04+05:00`, receipt-only admission recorded 67 identities
  in the rolling hour and reserved all 17 fresh identities, conservative maximum
  84/150. A detached disposable worktree at exact SHA
  `a5db7a7e40840f52d740bb169e6b03c7edc6bdac` received no copied env, modules,
  cache, Auth state or browser state. Its isolated npm cache installed 1,116
  packages. Host tools were Node `v22.23.2`, npm `10.9.8`, Supabase CLI
  `2.116.0` and Deno `2.5.2`; the recorded Node engine warning did not prevent a
  gate. Pinned Playwright preparation and fresh Supabase start passed; generated
  ignored `.env.local` contained exactly the two approved public Supabase names.
- All four nonempty migration runners passed sequentially with zero GoTrue
  signups, preserved fixtures/state, owned latest-reset cleanup and
  `types-unchanged=true`. A final clean reset applied all nine migrations.
- The first full DB run passed 856/857 and reported the known bounded dblink
  `race deadline` at candidate/candidate assertion 50. With this concrete
  finding, the narrow candidate authority file passed 52/52, then the complete
  DB suite passed 5 files / 857 assertions. No DB source changed and no Auth
  identity was used by these runs.
- Fresh Edge passed 39/39 plus one live-only ignore; client/static passed
  40 suites / 672 tests; lint, typecheck, check-only generated types and
  static-only A/B security passed. Web/iOS/Android exports passed with five web
  routes and the TMDB asset; the 64-file bundle scan found zero findings. The
  separately injected live token was inherited only by the live contract, which
  passed with its fixed zero-identity receipt.
- Fresh C1 passed 1/1 and fresh permanent smoke passed
  G03/G04/G05/G08/H01 at 3/4/2/4/3 = 16/16. Scanner findings were zero, no HTTP
  429 occurred and every runtime/provider cleanup completed. T069 is exactly
  17/17; no owner or obsolete fixture case ran.
- The first worktree setup command failed before checkout because an incorrectly
  expanded full SHA was supplied; its empty owned temp root was removed and it
  used zero identities/resources. After the green gate, the owned fresh stack,
  volume, worktree, npm cache and Supabase config directory were removed.
  Absence checks passed; no shared or unowned resource was removed.

### Terminal-conflict final reconciliation

- T001–T069 return to 69/69 only after the exact-SHA T066/T068/T069 gates above.
  Every older final-SHA receipt remains historical/superseded evidence.
- R01 remains exactly one Feature 006 generated-types write in commit
  `bcd3e4ad12cf43e5a5d7392c2cae0a65d19f986e`; every invocation in this
  remediation and its final gates was check-only. Canonical SHA-256 remains
  `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`.
- Historical cumulative R02 before this remediation was 377/377. Adding T068
  51/51 and T069 17/17 produces cumulative actual `377 + 51 + 17 = 445`
  attempts / 445 successful identities. Normative Feature 006 budgets remain
  normal 26, repeatability 51, fresh 17, total 94; historical/superseded cost
  does not redefine the normative budget.

### Independent completion review (2026-09-15 Asia/Qyzylorda)

- The complete Feature 006 implementation was reviewed from specification
  baseline `0fcd79e8af4717f781c2bf173de8753e731b8a04` through exact release-candidate
  SHA `a5db7a7e40840f52d740bb169e6b03c7edc6bdac`, together with the constitution,
  product vision, roadmap, testing strategy, every Feature 006 artifact,
  contract, migration, implementation path, test and evidence receipt.
- The candidate terminal matrix is fail-closed and symmetric: pending may adopt
  assigned or no-candidates; equal terminals and same-ID assigned metadata are
  accepted; opposite terminals or a different assigned ID enter a sticky
  integrity error before any terminal short-circuit. Candidate/title/year/
  poster/fallback/new-room success and Retry are suppressed there, stale request
  and image callbacks cannot restore success, and only canonical re-entry creates
  a fresh generation.
- Pagination keeps stable page totals, counts raw rows before ID deduplication,
  rejects cumulative overflow before eligibility evaluation, rejects a completed
  traversal shortfall, permits coherent exact-count empty completion, and treats
  duplicate IDs as raw rows but one eligibility identity. Completed-empty remains
  attempt-scoped and makes no snapshot or global-catalog claim.
- Exact inclusive-year AND-of-OR/adult=false eligibility, conservative Discover
  overfetch, immutable one-winner PostgreSQL CAS, no lock across TMDB HTTP,
  retryable incomplete/upstream failure, server-only secrets/private constraints,
  TMDB-owned noncanonical metadata, one rooms-only Realtime channel, fixture-free
  normal flow, approved attribution and the Feature 006 release boundary all pass.
- T066, T068 and T069 reconcile exactly to the final-SHA receipts above. R01 is
  one generated-types write with unchanged canonical SHA-256
  `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`.
  Normative R02 remains 94; cumulative historical actual remains 445 attempts /
  445 successful identities. All eight constitution principles pass.
- No executable suite was repeated during this documentation-only completion
  review: the applicable full evidence already ran at the exact implementation
  SHA, and the completion changes affect only this ledger, `tasks.md` and the
  roadmap status.

### Live TMDB-to-database ordering defect and failing-first remediation

- After completion commit `a570821cde06d77ae619ce94f4f7693b40cdd28a`, a
  real local full-stack manual run reached live TMDB with a valid token after
  Feature 005 resolved compatible, but the UI ended in `Unable to find a movie
  right now. Please try again.` and the Edge application log recorded
  `stage=operation`, `failure=internal`. This also exposed an acceptance gap:
  the earlier browser receipt substituted only the TMDB boundary and the live
  contract tested TMDB separately, so neither proved the complete live
  UI/Auth-to-TMDB-to-PostgreSQL-to-browser seam. Those older receipts remain
  historical evidence and do not prove this newly required release path.
- Investigation confirmed that `parseMovie()` deduplicated `genre_ids` while
  retaining provider order. `commit_room_tmdb_candidate` deliberately accepts
  only a sorted, deduplicated canonical array, so an ordinary response such as
  `[16,10751,12,14]` reached the RPC noncanonically and was rejected as
  `Invalid candidate evidence`; the outer fixed Edge boundary then mapped that
  rejection to `operation/internal`. The database invariant and eligibility
  semantics were correct and remain unchanged.
- Failing-first command:
  `npm exec -- deno test --allow-env --allow-net=127.0.0.1 --filter 'unsorted TMDB genres' supabase/functions/_tests/room-candidate.test.ts`.
  RED was 0 passed / 1 failed, with expected `[12,14,16,10751]` and received
  `[16,10751,12,14]`. The regression enters through `parseDiscoverPage`, proves
  exact AND-of-OR eligibility, and inspects the evidence handed to
  `commit_room_tmdb_candidate`.
- The only production change sorts the already deduplicated numeric array at
  the TMDB parsing boundary. GREEN for the same command was 1/1. The affected
  eligibility/search/operation set passed 40/40; the full Edge suite passed
  40/40 with the separate live-only contract ignored; the full client suite
  passed 40 suites / 672 tests; candidate-authority pgTAP passed 52/52; lint,
  typecheck, `db:types:check` and `git diff --check` passed. No migration,
  schema or generated-type source changed.
- Remediation commit `f180d4bcf17a6766fcea8cec958c54221792c752`
  (`fix: canonicalize TMDB genre evidence`) was pushed non-force to `main`.
  The first normal push stopped before remote contact on the already documented
  unreadable system SSH include; the empty-config SSH workaround then advanced
  `origin/main` from `a570821` to the same remediation commit.

### Mandatory real live full-stack receipt on the exact remediation SHA

- At `2026-09-15T20:59+05:00`, exact pushed SHA
  `f180d4bcf17a6766fcea8cec958c54221792c752` ran local Supabase, the real local
  `room-candidate` Edge Function with its ignored server-only token, Expo web,
  and the pinned Playwright browser runtime. No TMDB stub, route interception,
  fixture candidate or fallback source was configured. The temporary local
  acceptance driver and browser container were removed afterward; Expo, Edge
  and the owned Supabase stack were stopped.
- Two independent normal browser contexts created exactly two new anonymous
  users during the receipt. The voting creator created a two-voter room, the
  second voter joined, and both participant rows were normal voters. Each saved
  `Any genre; 2000–2000`; PostgreSQL showed two canonical empty genre arrays and
  Feature 005 resolved `compatible` after both filters completed.
- Live TMDB Discover selected TMDB movie `1768727`. PostgreSQL's post-commit
  row was exactly `ready`, voters `2/2`, filters `2/2`, resolution `compatible`,
  acquisition `assigned`, authoritative `tmdb_movie_id=1768727`, and legacy
  `movie_candidate_id IS NULL`. Live Details/Configuration returned
  **Old Habits Die Hard (2000)** with an HTTPS TMDB poster.
- Both clients rendered the same title, year and poster and every observed
  Edge response carried the same TMDB ID. Both pages were then reloaded; each
  rendered **Old Habits Die Hard (2000)** with the poster again, while the
  database assignment remained unchanged.
- Browser traffic recorded zero direct `themoviedb.org` requests and zero calls
  to the private prepare/commit RPCs. All six browser-to-Edge calls returned
  HTTP 200 with only `outcome=available` and the public candidate presentation
  fields; there were no failed browser requests or client-visible secret/private
  constraint names. Edge runtime logged six real `room-candidate` request-serving
  entries correlated to those six HTTP 200 responses, with no
  `operation/internal` or other application failure log.
- This receipt adds two successful anonymous identity attempts to the prior
  recorded cumulative 445, for 447/447 recorded attempts. The externally
  reported failure's identity cost was not instrumented and is not guessed.
  R01 remains exactly one historical generated-types write in commit
  `bcd3e4ad12cf43e5a5d7392c2cae0a65d19f986e`; this remediation ran check-only
  and the canonical SHA-256 remains
  `adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`.
