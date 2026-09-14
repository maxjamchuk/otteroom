# Implementation Plan: TMDB Candidate Source

**Branch**: `main` (existing; no branch creation/switch) | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature 006 specification from `/specs/006-tmdb-candidate-source/spec.md`

## Summary

Continue an authoritative Feature 005 `compatible` room into one stable TMDB movie assignment. A caller-authenticated Supabase Edge Function is the only external-service boundary: it obtains the private compatible constraint through hardened server-only PostgreSQL functions, queries TMDB API v3 with a server-held application Bearer token, preserves the full AND-of-OR predicate by conservative Discover overfetch plus exact server validation, atomically compare-and-sets one `tmdb_movie_id` or a completed-empty `no_candidates` terminal, and returns only approved candidate presentation.

PostgreSQL remains authoritative for the room assignment and terminal state; TMDB remains authoritative for title, release year and poster data. Only the TMDB ID is persisted as movie identity. The legacy fixture FK and catalog remain untouched historical/test infrastructure and have no Feature 006 authority.

## Technical Context

**Language/Version**: TypeScript 6.0.3; Node.js 24.20.x for repository tooling; Deno 2 for Supabase Edge Functions; PostgreSQL 17

**Primary Dependencies**: Expo 57, React 19.2.3, React Native 0.86.3, `@supabase/supabase-js` 2.115.0, Supabase CLI 2.116.0; platform `fetch` for TMDB HTTP; no TMDB wrapper SDK

**Storage**: Existing Supabase PostgreSQL database; one additive public candidate status/identity contract and one small private TMDB genre-ID reference mapping; no synchronized movie catalog and no persisted descriptive metadata

**Testing**: Jest 29.7 client/shared-pure tests; Deno Edge unit/contract tests; controlled HTTP integration for TMDB failure/pagination cases; pgTAP plus dblink for PostgreSQL authority/concurrency; Playwright 1.63 bounded real-stack browser acceptance; one credentialed live-TMDB contract smoke with no browser identities

**Target Platform**: Expo web for primary automated E2E; shared Android/iOS/web client; Supabase local/hosted Edge Runtime and PostgreSQL

**Project Type**: Mobile/web Expo application with Supabase Data API, Auth, Realtime, PostgreSQL and one focused Edge Function

**Performance Goals**: Preserve SC-010: under normal connectivity and responsive TMDB, at least 95% of compatible acquisition trials render title/year/poster or fallback within 10 seconds. Normal success should require one Discover page, one Details read and, when needed, configuration/image work.

**Constraints**: Exact private Feature 005 inclusive-year plus AND-of-OR eligibility; explicit `include_adult=false` and `language=en-US`; one stable room identity; no client TMDB secret or constraint; no database lock across TMDB HTTP; TMDB page maximum 500; 100 Discover HTTP attempts and a 20-second external-work deadline per acquisition invocation; any unfinished search remains nonterminal and retryable

**Scale/Scope**: One candidate per fixed room; 19 approved movie genres; release years 1900 through the submission-time current UTC year; no configured voter maximum is assumed; one Edge endpoint, three hardened server-only database operations, one existing rooms Realtime channel, exactly three display fields

## Constitution Check — Before Phase 0

**PASS at planning entry; no exception or amendment required.**

| Principle | Pre-design assessment |
| --- | --- |
| I. Working behavior is primary evidence | Plan names fresh setup, build/type, DB, Edge, live-boundary and real-stack evidence without claiming it has run. |
| II. Small verifiable vertical slices | Scope ends at one first candidate/empty/failure state; no progression or recommendations. |
| III. Artifact consistency | Feature 006 spec is authoritative; Feature 005 private handoff and Feature 002 evolved authority are explicit dependencies. |
| IV. Explicit authoritative transitions | PostgreSQL terminal compare-and-set owns assignment/empty; Edge owns external orchestration; client input is never eligibility authority. |
| V. Security and least privilege | TMDB token and server credential remain Edge secrets; ordinary clients send only room UUID and receive no private constraint. |
| VI. Reproducible schema evolution | One additive migration, preserved history, clean reset, nonempty upgrade evidence and one controlled R01 generation are required. |
| VII. Executable acceptance evidence | Browser, Edge, DB and client responsibilities are separated according to `docs/testing-strategy.md`. |
| VIII. Explicit scope and simplicity | One Edge Function plus short DB operations is the minimum existing-platform boundary for outbound secret-bearing HTTP. |

Phase 0 had no unresolved product clarification. Research was required for live TMDB behavior and the server trust boundary; decisions are recorded in [research.md](research.md).

## Project Structure

### Documentation (this feature)

```text
specs/006-tmdb-candidate-source/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── tmdb-query-and-eligibility.md
    ├── edge-candidate-operation.md
    ├── candidate-persistence-rpcs.md
    ├── room-candidate-projection-realtime.md
    ├── client-candidate-flow.md
    └── tmdb-attribution.md
```

No `tasks.md` is created by this workflow.

### Future implementation paths

```text
supabase/
├── config.toml
├── functions/
│   ├── _shared/{candidate-contracts,tmdb-client,tmdb-eligibility}.ts
│   └── room-candidate/index.ts
├── migrations/20260914000000_tmdb_candidate_source.sql
└── tests/
    ├── database/{common_filter_resolution,room_candidate,tmdb_candidate_source}.test.sql
    └── migration/{tmdb_candidate_source.before,tmdb_candidate_source.after}.sql

src/
├── candidates/{contracts,service,state,use-room-candidate,candidate-card}.ts[x]
├── compliance/tmdb-attribution.tsx
├── rooms/{contracts,service,state,use-room-subscription}.ts
└── types/database.generated.ts

app/{about.tsx,room/[code].tsx}
assets/compliance/                    # approved, unmodified TMDB logo asset
__tests__/{candidates,compliance,rooms,routes}/
e2e/{tmdb-candidate-source,generalized-room-membership-qr,participant-filters}.spec.ts
e2e/support/{candidate-harness,tmdb-stub,safe-diagnostics,safe-reporter}.ts
scripts/{check-tmdb-candidate-migration,run-e2e}.mjs
```

**Structure Decision**: Retain the established Expo feature folders, PostgreSQL migrations/tests and rooms-only Realtime lifecycle. Add one Supabase Edge Function because the existing client/Data API boundary cannot safely hold the TMDB token or perform secret-bearing external orchestration. No standalone backend, catalog service, queue or second shared-state channel is introduced.

## Architecture and Authority Flow

```text
authorized Expo client (room UUID only)
  -> authenticated Supabase Edge Function
  -> server-only preflight RPC
       authorizes actor + validates Feature 005 compatible private handoff
  -> TMDB Discover v3 (no database lock held)
  -> exact server validator over every original clause/year/adult field
  -> server-only terminal compare-and-set RPC
       assigned(tmdb_movie_id) OR completed-empty no_candidates
  -> TMDB Movie Details v3 + image configuration for committed ID
  -> safe candidate response

rooms UPDATE (id-only Realtime invalidation)
  -> authorized refetch of safe room projection
  -> assigned clients call the same Edge operation
  -> preflight returns stored ID; no replacement Discover query
```

The Edge Function validates the caller's Supabase Auth JWT, accepts exactly a room UUID and derives the actor UUID from the verified subject. Its server-only Supabase secret is used only to invoke exact-signature functions granted to the server role; application code is forbidden from direct admin table access. Each database function independently reauthorizes the actor against `room_members`. This narrows the operational surface despite the platform server credential's broad underlying capability. A future credential with function-level database scope may replace it without changing the contract.

## Exact TMDB Query and Eligibility Algorithm

1. Preflight returns the immutable private inclusive year interval and every ordered nonempty Feature 005 clause only for coherent `compatible` state.
2. Map all 19 Feature 004 genre enum values to official TMDB movie genre IDs through the private reference mapping. Keep duplicate/equal clauses in the authoritative validator.
3. If clauses exist, choose one smallest-cardinality clause with a stable implementation tie-break and encode only it as an OR-only `with_genres` value (`id|id|...`). Every exact match must intersect this driver clause, so results are a conservative superset. If all voters chose Any, omit `with_genres`.
4. Call `GET /3/discover/movie` with explicit `language=en-US`,
   `include_adult=false`, `include_video=false`, no `region`, inclusive
   `primary_release_date.gte=YYYY-01-01` and
   `primary_release_date.lte=YYYY-12-31`, and
   `sort_by=primary_release_date.asc`. Traverse date shards oldest-first, pages
   ascending and each page in returned order. Add no popularity/vote/ranking
   filters and expose no ordering guarantee.
5. Validate the complete response page before selection. For every deduplicated movie, require positive ID, `adult=false`, parseable release date whose year is inside both bounds, and `genre_ids` intersecting every original clause. Title/poster do not decide genre eligibility; a usable title/year is required before committing the selected result.
6. If a date shard reports at most 500 pages, visit every reported page unless an eligible movie is found. If it reports more than 500, do not count the broad shard as completed; bisect its whole-date interval into nonoverlapping contiguous shards and recurse. A single day still over 500 cannot complete the attempt.
7. Stop at the first fully eligible movie under this internal traversal and attempt the terminal assignment. Selection order is not a product promise.
8. Commit `no_candidates` only if one attempt completed every final shard at or below 500 pages, fetched and parsed every reported page successfully, checked every observed unique result, and observed zero matches before the 100-Discover-attempt/20-second budgets. Page inconsistency, a single-day overflow, budget exhaustion, any incomplete page/shard traversal or any upstream failure is `search_incomplete`, leaves PostgreSQL pending and is retryable.
9. This completed-empty result is evidence about that successful bounded attempt,
   not a global-catalog proof: TMDB documents no snapshot consistency across the
   requests in a multi-page traversal, so undetectable catalog/page movement can
   occur without invalidating the attempt's operational completion.

This is exact without relying on undocumented mixed comma/pipe precedence and without DNF expansion. The maximum query genre list is bounded by the 19-value vocabulary, independent of voter count.

## Acquisition State, Atomicity and Recovery

Persisted room state is deliberately only `pending | assigned | no_candidates`. An active request, retryable acquisition error and metadata error are generation-scoped client/Edge attempt states; raw operational failures are not durable room data.

- Preflight takes only a short database transaction. `pending` plus coherent compatible handoff returns a private search context; terminal state returns the stored outcome immediately. No TMDB call starts for pending/incompatible Feature 005 or terminal Feature 006 state.
- TMDB HTTP runs with no database lock or transaction held.
- Assignment commit locks the room, reauthorizes, revalidates the compatible handoff and exact year/genre/adult evidence, then compare-and-sets `assigned + tmdb_movie_id` only from pending.
- Empty commit uses the same terminal compare-and-set but is callable only after
  the Edge has completed every required operation of one bounded, error-free
  attempt and observed no exact match.
- Concurrent callers may perform redundant bounded reads, but only the first terminal commit writes. Every loser receives and returns the winner. A late candidate, empty or error response cannot replace a committed terminal.
- No lease, request ledger or ownership token is required: Feature 005 input is immutable, Feature 006 has one irreversible terminal, and every commit rechecks the same room row. This also avoids a stranded acquiring lease after an Edge crash.
- A transport failure before commit leaves pending. Assignment/no-candidate response loss is recovered by the same Edge call, whose preflight returns the terminal without Discover. Metadata recovery reads Details for only the stored ID.

## Candidate and Metadata Lifecycle

- Persist `rooms.tmdb_movie_id` only as authoritative external identity; keep it ungranted in ordinary room SELECT. Do not persist title, release date/year, poster path/URL or a movie row.
- The trusted assignment RPC receives TMDB release-year, genre-ID and adult evidence transiently and verifies it against the private constraint; it does not store those descriptive values.
- After assignment, the Edge Function calls `GET /3/movie/{id}?language=en-US` for title, release date and poster path. It never returns to Discover for an assigned room. Mutable metadata may therefore change on later reads without changing candidate identity.
- Resolve a non-null poster path with current `/3/configuration` `secure_base_url` plus a supported bounded poster size. Configuration may be cached only in Edge-isolate memory; it is noncanonical and never persisted.
- A Details/configuration failure after commit returns a safe recoverable metadata/poster state for the same ID. A CDN image failure is client-only presentation degradation; title/year remain and image retry does not call Discover. A successful null `poster_path` produces the explicit fallback.

## Migration and Feature Evolution

Create one additive migration after `20260912000000_common_filter_resolution.sql`; modify no historical migration.

1. Add public `candidate_acquisition_status` enum and non-null default-pending room column, plus nullable positive `tmdb_movie_id` and exact state/Feature 005 consistency checks.
2. Add the 19-row private Feature-genre-to-TMDB-ID reference mapping. It is not a movie catalog, is denied to clients and is absent from Realtime.
3. Add/harden the three server-only preflight/assigned/empty functions. Revoke PUBLIC/anon/authenticated, grant exact signatures only to the Edge server role, and reauthorize the propagated actor inside each function.
4. Recreate create/join projections only to append safe candidate status; preserve every membership/filter/resolution outcome. Extend authenticated room SELECT by status only, not `tmdb_movie_id`.
5. Keep exactly `public.rooms` in Realtime. Preserve legacy `movie_candidates`, four fixture rows, `rooms.movie_candidate_id` FK and old revoked `ensure_room_candidate` for historical tests only.

All existing rooms migrate to Feature 006 pending regardless of a legacy fixture FK. Existing compatible N/N rooms lazily acquire on first authorized observation; pending/incompatible Feature 005 rooms remain suppressed. No migration copies a fixture identity into `tmdb_movie_id`, manufactures a TMDB assignment or calls TMDB. A historical fixture can never satisfy new assigned-state checks or appear in the new projection.

## API and Client Boundaries

| Boundary | Planned contract |
| --- | --- |
| Edge `room-candidate` | Authenticated POST; exact `{room_id}` only; safe closed outcomes; never accepts constraints, actor IDs or candidate IDs. |
| Server preflight | Server-role-only; derives private handoff or terminal from actor+room; no ordinary grant. |
| Assignment commit | Server-role-only terminal CAS; DB rechecks actor, compatible state and supplied exact eligibility evidence. |
| Empty commit | Server-role-only terminal CAS after a completed-empty Edge attempt; terminal winner always dominates. |
| create/join/refetch | Add candidate status only; no private constraint, TMDB secret, TMDB ID or metadata in direct room projection. |
| Candidate client service | Invokes Edge with room UUID after existing Auth bootstrap; exact response parser and fixed safe failures. |
| Candidate state/hook | Automatic one-flight at compatible+pending; monotonic terminal adoption; explicit acquisition/metadata retry; stale generation suppression. |
| Candidate card | Exactly title, release year and poster or explicit fallback; ID never rendered; no advanced details/actions. |
| About/Credits | Reachable approved TMDB logo, exact required notice and TMDB link. |

## Failure and Retry Model

| Boundary | Durable authority | Visible/recovery behavior |
| --- | --- | --- |
| Transport timeout/abort before commit | pending, no ID | Safe retryable acquisition error; explicit Retry starts a new bounded attempt. |
| TMDB 429 | pending, no ID | Honor `Retry-After` when present, otherwise capped exponential backoff with jitter inside the attempt; exhaustion is safe Retry. No fixed 40-rps assumption. |
| TMDB 5xx/502/503/504 | pending, no ID | Bounded internal retry, then safe acquisition Retry. |
| 4xx auth/parameter/config error | pending, no ID | Safe retryable service failure to clients; sanitized server classification for operators, never raw payload/token. |
| Malformed/inconsistent Discover page | pending, no ID | Abort; never infer empty from skipped/unknown data; explicit Retry. |
| Page/date/request/deadline limit before complete traversal | pending, no ID | `search_incomplete` mapped to the safe retryable acquisition surface, not no-candidates. |
| Completed-empty attempt | no_candidates | Stable across all clients/recovery; no acquisition Retry; create-new-room action; no global-catalog claim. |
| Assignment commit response lost | assigned + same ID | Retry/refetch recovers terminal first; no Discover or replacement. |
| Details fails after assignment | assigned + same ID | Recoverable metadata error; retry Details for same ID only. |
| Configuration fails with title/year known | assigned + same ID | Recoverable poster/configuration state; no acquisition. |
| Poster CDN/Image fails | assigned + same ID | Presentation-only image failure; retain title/year and retry same URL/config path. |
| `poster_path=null` from valid Details | assigned + same ID | Completed explicit no-poster fallback; not an error. |

HTTP retries count against both the 100-attempt Discover ceiling and 20-second external-work deadline. All logs/diagnostics use fixed categories and safe counts; request headers, response bodies, tokens, constraints and movie/room identifiers are excluded.

## Attribution and Compliance

Feature 006 adds a reachable About/Credits-type surface now. It uses an approved TMDB logo from the official logo page without changing color/aspect ratio, flipping or rotating it; the logo is less prominent than Otteroom branding and does not imply endorsement. The surface prominently includes the exact notice:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

It identifies the service as TMDB/The Movie Database and links to `https://www.themoviedb.org`. This is part of the release, not deferred. Any future commercial use still requires the applicable TMDB licensing review.

## Testing-Strategy Impact Matrix

`docs/testing-strategy.md` is normative. Feature 006 does not rerun the full historical browser inventory.

| Changed observable boundary | Primary authority | Browser evidence | Historical selection / cost |
| --- | --- | --- | ---: |
| Feature 005 compatible -> acquisition -> candidate; pending/incompatible suppression | Edge integration + DB gates + client state | J01/J02 and evolved G03/G04/H01 smoke | None / 0 |
| Exact year/AND-of-OR/adult eligibility and query decomposition | Pure Edge evaluator/paginator + DB commit validation | J01 representative candidate/decoys | None / 0 |
| One terminal under concurrency, response loss, retries and fixture non-authority | PostgreSQL dblink/xmin/write-count + Edge CAS integration | J01/J03 | F02/F07 absorbed / 0 |
| Shared candidate and rooms-only reload/reconnect/missed-update recovery | DB/client Realtime state | J01/J02 | F02 absorbed / 0 |
| Authorization, private constraint and TMDB secret boundary | DB ACL/RLS + Edge auth + C1/scanner | J02 plus permanent G08 | F04 absorbed / 0 |
| TMDB title/year/poster/null-poster and metadata/poster failure | Edge response parser + client component/image state | J01/J03 | F08 absorbed / 0 |
| Completed-empty vs timeout/429/5xx/malformed/early stop | Edge controlled HTTP integration + client state | J02 empty; J03 retryable failure | None / 0 |
| Mandatory attribution surface | Client component/route and asset checks | One assertion folded into J01; no identity added | None / 0 |
| Legacy fixture schema/FK preservation and additive cutover | Migration + DB tests | J01/J03 assert zero fixture presentation | Obsolete F02/F04/F07/F08 not rerun |
| Auth/QR/capacity/filter-save mechanics and harness safety | Existing lower layers + permanent smoke | No non-smoke E/G/H case selected | None / 0 |

### Feature 006 owner acceptance

| Case | Identity cap | Real-stack responsibility |
| --- | ---: | --- |
| J01 | 3 | Voting creator + two voters: compatible multi-clause/bounded-year handoff, real Edge acquisition with controlled TMDB protocol responses/decoys, simultaneous calls, one eligible TMDB ID, title/year/poster, attribution reachability and reload/reconnect/re-entry convergence. |
| J02 | 4 | Non-voting creator + three voters: zero creator contribution, shared candidate, missed-update recovery and private traffic; a second bounded room completes every scripted search operation with zero eligible movies observed and recovers stable no-candidates/new-room action without Retry or fixture fallback. |
| J03 | 2 | Same two identities across bounded rooms: precommit timeout/429/5xx/malformed mapping and Retry, assignment-response loss, post-assignment Details/config/poster failure, no-poster fallback, same-ID recovery and zero fixture fallback. |
| **F total** | **9** | Within the normative recommended envelope. |

The browser uses the real local Auth/UI/Edge/PostgreSQL/Realtime stack and a deterministic local HTTP substitute only at the TMDB network boundary. Separate zero-identity live-TMDB contract smoke verifies current Bearer auth, Discover, Details, genre-list and configuration response compatibility without pinning a movie identity or logging secrets. Controlled substitutes own completed-empty, incomplete, fault and pagination variants; they do not replace the application-stack browser flow.

Permanent C1 remains 1 identity and G03/G04/G05/G08/H01 remain exactly 16. Only superseded compatible terminal assertions evolve to candidate appearance/privacy while retaining assembly, QR, filter, isolation and recovery intent. F02/F04/F07/F08 are not selected (`T=0`): every surviving authority, recovery, denial, response-loss and poster boundary is modernized in J01-J03, G08 and lower-layer tests; running fixture-specific versions would duplicate evidence and assert obsolete product behavior.

### Projected R02 budgets

With `F=9`, `T=0`, smoke `16` and C1 `1`:

| Gate | Formula | Identities |
| --- | --- | ---: |
| Normal checkpoint | `1 + 16 + 9 + 0` | **26** |
| Repeatability | `1 + 2 × (16 + 9) + 0` | **51** |
| Fresh checkout | `1 + 16` | **17** |
| Repeatability + fresh checkout | `51 + 17` | **68** |
| Explicit full historical trigger | `1 + 82` | **83** |

The first owner+smoke execution is the normal checkpoint. Workers remain 1, retries 0 and repeatEach 1; every partial/failed/manual signup attempt is charged. Receipts record configured caps, attempts, successful identities, timestamps, scanner and cleanup results.

## R01 Generated Database Types

A generated public DB contract change cannot be avoided: the room enum/status, `rooms.tmdb_movie_id`, evolved create/join shapes and server-only public RPC signatures are visible to schema generation even when column/function ACLs deny ordinary clients. Finalize the entire migration and signatures first, run exactly one intentional `npm run db:types`, immediately run `npm run db:types:check`, then use check-only validation for every later normal, repeatability and fresh-checkout gate. Review generated bytes to ensure no private schema relation or descriptive movie catalog appears.

## Implementation Phases and Green Checkpoints

These are future implementation slices, not tasks and not completed work.

| Phase | Coherent deliverable | Minimum evidence before next phase |
| --- | --- | --- |
| 1 — DB authority | Additive candidate state/ID, private genre mapping and server-only terminal functions; preserve fixture history | Migration checker, clean reset, pgTAP ACL/state/algebra and deterministic concurrent CAS; no type write yet |
| 2 — Edge boundary | Authenticated room-candidate function, exact Discover evaluator/paginator, TMDB error mapper and metadata/configuration adapter | Pure/Deno tests, controlled HTTP integration, secret/config checks and zero client constraint exposure |
| 3 — Typed client/compliance cutover | One R01 write; evolved projection/state/hook/card and required About/Credits surface | Immediate and independent type check-only, lint, typecheck, full client/DB/Edge suites, web/native exports, live-TMDB contract smoke |
| 4 — Bounded acceptance | J01-J03, evolved permanent smoke and diagnostics/scanner | C1=1, F=9, smoke=16, T=0, exact R02 receipt, scanner zero |
| 5 — Repeatability/fresh checkout | Reproduce unchanged source and exact implementation SHA | 51-identity repeatability plus independent 17-identity fresh-checkout gate |

Dependency is Phase 1 -> 2 -> 3 -> 4 -> 5. Schema, Edge and client form one release cutover; no intermediate phase authorizes fixture fallback or Feature 007.

## Constitution Check — After Phase 1 Design

**PASS at design completion; all eight principles, no exception.**

- I/VII: [quickstart.md](quickstart.md) defines fresh setup and distinct DB, Edge, live-TMDB, client, browser, build/export and security evidence; the plan claims no implementation result.
- II/VIII: one external function, one terminal room assignment and exact minimum display are the smallest vertical slice. Search pagination complexity exists only to preserve approved exact/completed-empty semantics.
- III: the spec, private Feature 005 handoff, Feature 002 evolution, contracts, data model, migration, Realtime and testing impact agree. No unresolved item remains.
- IV: immutable preflight plus terminal room-row compare-and-set defines input, authorization, concurrency, idempotency, stale results, rollback, response loss and recovery without holding a lock across HTTP.
- V: only the Edge boundary has TMDB/server secrets; clients send no constraint; server functions reauthorize and private tables stay deny-by-default. C1 and artifact/network scanning cover leakage.
- VI: one additive migration preserves nonempty rooms/fixtures; R01 has one controlled write followed by check-only runs; fresh checkout provisions secrets separately from versioned instructions.

No post-design gate failed and no constitution amendment is required.

## Complexity Tracking

No constitutional violation or approved exception. The Edge Function is necessary because TMDB authentication and private filter material cannot live in the ordinary client, while PostgreSQL HTTP orchestration would introduce slower transactions or an asynchronous job subsystem. Adaptive date decomposition is necessary only because the documented API can report more pages than it permits clients to request; early stopping cannot become authoritative empty. The approved `no_candidates` semantics deliberately claim only a complete, error-free bounded attempt with no eligible movie observed because TMDB offers no documented snapshot-consistent pagination.

## Planning-Only Declaration

No implementation, migration, generated-type update, dependency installation, service startup, application/database/Edge/browser test, tasks/analyze workflow, branch creation/switch, commit or push is part of this planning run.
