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
