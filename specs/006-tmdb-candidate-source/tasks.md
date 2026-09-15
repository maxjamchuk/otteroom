---
description: "Executable task breakdown for TMDB Candidate Source"
---

# Tasks: TMDB Candidate Source

**Input**: Reviewed documents in `/specs/006-tmdb-candidate-source/`, the
constitution, product vision, MVP roadmap, testing strategy, Feature 005 private
handoff/privacy contracts, and the deliberately evolved Feature 002 candidate
authority contracts.

**Prerequisites**: [spec.md](spec.md),
[checklist](checklists/requirements.md), [plan.md](plan.md),
[research.md](research.md), [data-model.md](data-model.md),
[quickstart.md](quickstart.md), and every file in [contracts/](contracts/).

**Tests**: Required by the specification, constitution, and approved plan.
Write the behavioral or contract evidence named below before its implementation
and observe the relevant failure. PostgreSQL tests own state, ACL, exact
eligibility revalidation, CAS, writes, locks, rollback, and persistence; Edge
tests own TMDB parsing/search/failure semantics; client tests own parsing,
one-flight, monotonic/stale-generation behavior, and presentation states;
bounded browser cases own representative real Auth/UI/Edge/PostgreSQL/Realtime
cooperation while replacing only the TMDB HTTP boundary with a controlled
substitute.

**Organization**: Phase 2 establishes the shared PostgreSQL authority and the
single R01 type-generation cutover. Phases 3–6 implement the four prioritized
stories. Phase 7 owns cross-story security, bounded browser acceptance, live
provider compatibility, repeatability, and fresh-checkout evidence. No task
implements swipes, decisions, progression, queues, ranking, recommendations,
providers, matching, TV, dynamic membership, accounts, advanced metadata, or a
local synchronized movie catalog.

| Label | User story | Independent demonstration |
| --- | --- | --- |
| US1 | Acquire One Eligible Real Candidate (P1) | Exact Edge/DB evidence and the compatible-path integration prove that only a coherent Feature 005 handoff can assign one fully eligible TMDB ID and render title/year/poster-or-fallback |
| US2 | Share and Recover the Same Candidate (P1) | DB races plus Edge/client/Realtime recovery prove all authorized roles converge on the immutable CAS winner through replay and lifecycle interruption |
| US3 | Understand Empty and External-Failure Outcomes (P2) | Controlled HTTP and client-state evidence distinguish a completed-empty terminal from every retryable incomplete/failure path and preserve an assigned identity through metadata/poster degradation |
| US4 | See Minimal TMDB Metadata Without Private Inputs (P2) | Auth/ACL/network/compliance evidence proves exact three-field TMDB presentation, en-US/adult rules, no private input/secret exposure, and mandatory attribution |

## Format: `[ID] [P?] [Story?] Description`

Every task uses an unchecked checkbox, a unique sequential ID, and an exact
repository-relative file path. `[P]` appears only where work is independent and
touches disjoint files. Setup, shared migration edits, generated-type writes,
route composition, test executions, and evidence checkpoints remain serial. A
task is complete only when its stated evidence is green and recorded; file
presence or a mock invocation alone is never sufficient.

## Binding Implementation Boundaries

- Acquisition starts only from a coherent server-private Feature 005
  `compatible` handoff. The inclusive year interval and every original
  AND-of-OR clause remain exact; all-Any means zero clauses, duplicate clauses
  remain, and the server explicitly rejects adult movies.
- TMDB Discover is only a conservative superset source. Use one smallest
  clause as an OR-only driver, or omit `with_genres` for all-Any, then run the
  complete authoritative server validator. Never use mixed comma/pipe grouping,
  DNF, union-only matching, clause removal, or popularity/ranking filters.
- Persist only `pending -> assigned | no_candidates`. Both terminals are
  immutable. Transient failure, `search_incomplete`, metadata failure, and
  poster failure are attempt/presentation states, not durable room terminals.
- Terminal empty requires one bounded, error-free attempt to complete every
  final date shard at at most 500 pages and every reported page within 100
  Discover attempts and 20 seconds, with no eligible movie observed. It proves
  only that attempt completed; TMDB documents no snapshot-consistent pagination,
  so it does not prove global catalog nonexistence. Single-day overflow,
  pagination inconsistency, timeout, 429, 4xx, 5xx, malformed data, any incomplete
  page/shard traversal, or any limit interruption leaves `pending` and Retry.
- No PostgreSQL lock or transaction spans TMDB HTTP. Concurrent requests may
  duplicate reads, but one room-row terminal CAS wins; every loser adopts the
  winner. An assigned `tmdb_movie_id` never changes in Feature 006.
- TMDB owns title, release year, poster path, and image configuration. Otteroom
  stores only candidate status and the TMDB identity; no movie row or
  descriptive snapshot is added. Details/configuration/poster recovery never
  returns to Discover for an assigned room.
- The authenticated `room-candidate` Edge Function receives exactly
  `{room_id}`. TMDB and server credentials remain Edge-only; clients neither
  receive nor submit the private constraint. The Edge server client invokes
  only the three server-role-only, actor-reauthorizing RPCs.
- Preserve exactly one `public.rooms` UPDATE invalidation/refetch channel.
  Add no candidate channel, polling, Presence, Broadcast, job, lease, request
  ledger, or lock held over HTTP.
- Preserve Feature 002 fixtures, FK, assets, and revoked RPC only as historical
  test infrastructure. Never copy them into `tmdb_movie_id`, read them in the
  normal path, display them, or use them as fallback.
- The client card contains exactly title, release year, and poster or explicit
  no-poster fallback. Feature 007 receives only one committed TMDB ID; Feature
  006 creates no decision or progression state.

## Phase 1: Setup — Protected Baseline and Test Entrypoints

**Goal**: Establish provenance and reproducible, secret-safe commands without
changing runtime behavior, historical migrations, generated types, or fixtures.

- [X] T001 Record branch, HEAD, exact status, declared/host Node/npm/Supabase/Deno versions, and hashes for historical migrations, `src/types/database.generated.ts`, Feature 002 candidate files/assets, Feature 005 handoff files, E2E safety files, and current package scripts in the implementation evidence ledger in `specs/006-tmdb-candidate-source/quickstart.md`; do not claim any executable gate has passed.
- [X] T002 [P] Add and observe failing configuration tests for the Feature 006 script entrypoints, Deno availability, Edge JWT requirement, ignored secret material, public-client environment allowlist, and absence of TMDB/server credentials from Expo configuration in `__tests__/config/tmdb-candidate-source.test.ts`.
- [X] T003 After T002 fails for the expected missing configuration, add reviewed zero-secret entrypoints for `test:edge`, `test:tmdb:contract`, and `test:e2e:feature006` in `package.json`, wire the local authenticated `room-candidate` function in `supabase/config.toml`, and document only required secret names/ignored local-file handling in `.env.example` and `supabase/.gitignore`; never add a token value or an `EXPO_PUBLIC_` privileged variable, then make T002 evidence green.

**Checkpoint / commit boundary**: Baseline and test entrypoints are reviewable,
but no runtime slice is delivered and no commit is made until a later green
checkpoint.

---

## Phase 2: Foundational — PostgreSQL Authority and Additive Cutover

**Goal**: Define and prove the only durable candidate state, private genre
mapping, server-only handoff/terminal operations, additive Feature 002 evolution,
and one-winner concurrency before Edge or client work consumes the contract.

### Failing PostgreSQL and migration evidence

- [X] T004 Add failing schema, constraint, owner, RLS, ACL, column-grant, and rooms-only-publication tests in `supabase/tests/database/tmdb_candidate_source.test.sql` for exact `candidate_acquisition_status`, default `pending`, positive nullable `tmdb_movie_id`, assigned-ID equivalence, terminal Ready/N/N/compatible checks, and absence of descriptive metadata/catalog/acquiring/failed/lease fields.
- [X] T005 Extend `supabase/tests/database/tmdb_candidate_source.test.sql` with failing exact-signature/cardinality/owner/search-path/EXECUTE tests for `prepare_room_tmdb_candidate`, `commit_room_tmdb_candidate`, and `commit_room_tmdb_no_candidates`, including signed-out/ordinary-role denial, actor reauthorization, missing/foreign masking, pending/incompatible/incomplete/integrity-invalid no-data/no-write behavior, and private payload visibility only to the server role.
- [X] T006 Extend `supabase/tests/database/tmdb_candidate_source.test.sql` with failing assignment-evidence tests for inclusive lower/upper years, out-of-range rejection, all-Any, one constrained voter, multi-clause AND-of-OR, duplicate equal clauses, disjoint voter genre sets, canonical mapped IDs, missing-clause rejection, `adult=true` rejection, positive TMDB ID, and zero mutation of Feature 004/005 rows.
- [X] T007 Extend `supabase/tests/database/tmdb_candidate_source.test.sql` with failing terminal-state tests proving only pending-to-assigned/no-candidates writes, immutable terminals, exact first-write `updated_at`/`xmin`, repeat/loser zero-write preservation, rollback, candidate-versus-empty first-winner behavior, stale/later response rejection, and committed-response-loss recovery through preflight.
- [X] T008 Add deterministic READ COMMITTED pgTAP+dblink candidate/candidate and candidate/no-candidates races to `supabase/tests/database/tmdb_candidate_source.test.sql` using owner-held room locks, bounded `pg_blocking_pids` barriers, independent authenticated actors, exact before/first/final snapshots, write counts, `xmin`/timestamp checks, drained sessions, and proof that no database lock is retained by the Edge-side HTTP interval.
- [X] T009 [P] Extend `supabase/tests/database/room_candidate.test.sql` with failing Feature 002 evolution checks that preserve all four fixture rows, legacy FK/assets contract, and revoked `ensure_room_candidate` infrastructure while proving legacy assignments never satisfy Feature 006 assigned state, appear in safe projections, populate `tmdb_movie_id`, or act as pending/incompatible/empty/failure fallback.
- [X] T010 [P] Create nonempty pre-upgrade fixtures and exact snapshots for Waiting, partial-filter, compatible, incompatible, null-fixture, and fixture-assigned rooms across voting/non-voting creator modes in `supabase/tests/migration/tmdb_candidate_source.before.sql`, using owner-only synthetic users and zero GoTrue signups.
- [X] T011 [P] Create post-upgrade assertions in `supabase/tests/migration/tmdb_candidate_source.after.sql` for exact value/`xmin` preservation, all rooms defaulting pending with null TMDB ID, zero invented terminals, no fixture copy/display authority, private 19-row mapping, exact RPC/projection/ACL/publication shapes, and lazy compatible-only acquisition eligibility before owned-fixture cleanup.
- [X] T012 Implement an owned-stack, version-limited nonempty upgrade runner in `scripts/check-tmdb-candidate-migration.mjs` that resets exactly through `20260912000000`, applies `supabase/tests/migration/tmdb_candidate_source.before.sql`, runs the actual Feature 006 migration and `tmdb_candidate_source.after.sql`, then guarantees latest clean reset/cleanup on success, failure, or interruption without GoTrue users, copied SQL, type generation, or private-data logging.

### Additive schema and hardened terminal operations

- [X] T013 Create `supabase/migrations/20260914000000_tmdb_candidate_source.sql` as one additive transaction defining the exact public status/room columns/checks plus the postgres-owned, RLS-enabled, grant-free `private.tmdb_movie_genres` relation with all 19 reviewed Feature-to-TMDB mappings; add no movie metadata table, synchronization process, queue, lease, or Realtime publication.
- [X] T014 Implement the three exact postgres-owned `SECURITY DEFINER SET search_path=''` RPCs in `supabase/migrations/20260914000000_tmdb_candidate_source.sql`: authorize the propagated actor before disclosure, derive and validate the immutable Feature 005 private handoff without rereading voter filters, return terminal/preflight shapes, revalidate transient adult/year/genre evidence, and serialize one terminal CAS with no external call or same-value rewrite.
- [X] T015 Evolve `create_room`, `join_room`, and authorized room-column grants in `supabase/migrations/20260914000000_tmdb_candidate_source.sql` only to append safe candidate status; preserve every prior outcome/nullability/lock/write rule, keep both candidate IDs and all private data denied, keep only `public.rooms` in Realtime, and preserve legacy fixture schema/FK/RPC rows without granting them normal authority.
- [X] T016 Update latest-schema expectations in `scripts/check-room-membership-migration.mjs`, `scripts/check-participant-filters-migration.mjs`, `scripts/check-common-filter-resolution-migration.mjs`, `supabase/tests/migration/room_membership.after.sql`, `supabase/tests/migration/participant_filters.after.sql`, and `supabase/tests/migration/common_filter_resolution.after.sql` for the new pending status, private mapping, exact server RPC grants, evolved projection, and ignored legacy fixture state while leaving every historical migration byte-for-byte unchanged.
- [X] T017 Run the pre-R01 database gate from `specs/006-tmdb-candidate-source/quickstart.md`: validate all nonempty upgrade runners, clean latest reset, and full `npm run db:test`; record commands, assertion totals, ACL/algebra/race/rollback/write/fixture evidence, zero Auth identities, and cleanup, and block R01 if any check fails.
- [X] T018 Perform R01 exactly once after the final database signatures by running `npm run db:types`, immediately running `npm run db:types:check`, reviewing enum/room/create/join/server-function bytes and absence of private/catalog metadata, recording hash/inode/size/mtime/ctime in `specs/006-tmdb-candidate-source/quickstart.md`, and making every later validation check-only with no manual edit to `src/types/database.generated.ts`.

**Foundational checkpoint / commit boundary**: The additive migration, nonempty
upgrade, clean reset, DB suite, CAS/ACL evidence, and sole R01 write are green.
Schema and generated types may be committed as one logical boundary, but this
DB-only state is not released before the Edge/client slices are complete.

---

## Phase 3: User Story 1 — Acquire One Eligible Real Candidate (Priority: P1) 🎯 MVP Core

**Goal**: Continue one coherent Feature 005 compatible handoff through exact,
bounded TMDB discovery and one authoritative assignment, then render the minimum
TMDB-authored presentation without using fixtures.

**Independent Test**: With controlled pages containing eligible movies and
decoys, prove zero query for every closed gate; prove explicit en-US/adult/date
parameters, conservative driver selection, exact server validation, one TMDB ID
commit, and title/year/poster-or-fallback display for a compatible room.

### Failing Edge and client evidence

- [X] T019 [P] [US1] Create failing pure tests in `supabase/functions/_tests/tmdb-eligibility.test.ts` for the private 19-ID mapping, smallest-clause OR driver, all-Any omission, one clause, duplicate clauses, disjoint clauses, exact AND-of-OR intersections, inclusive year bounds, malformed/empty dates, positive IDs, deduped movie evaluation, explicit adult exclusion, and prohibition of mixed delimiters/DNF/union/ranking filters.
- [X] T020 [P] [US1] Create failing controlled-fetch tests in `supabase/functions/_tests/tmdb-search.test.ts` for exact Discover query parameters (`language=en-US`, `include_adult=false`, primary inclusive dates, pages 1..500, no region/provider/popularity fields), one/multiple pages, first exact-match short-circuit, duplicate IDs, >500-page date bisection without overlap/gap, oldest-first/page-ascending traversal, and `search_incomplete` for single-day overflow or inconsistent pagination.
- [X] T021 [P] [US1] Create failing Edge operation tests in `supabase/functions/_tests/room-candidate.test.ts` for current JWT verification, exact one-key UUID body, extra/private/candidate/actor-field rejection, preflight-first closed gates with zero TMDB traffic, compatible acquisition ordering, candidate CAS before Details, winner-only safe response, and no raw private/upstream/fixture fields.
- [X] T022 [P] [US1] Extend `__tests__/rooms/contracts.test.ts` and `__tests__/rooms/service.test.ts` with failing exact eleven-field accepted create/join, strict rejected-row nullability, eight-field refetch, candidate-status logical combinations, exact-column selection, and zero `tmdb_movie_id`/fixture/private fields.
- [X] T023 [P] [US1] Replace fixture-path expectations with failing Feature 006 success-path tests in `__tests__/candidates/contracts.test.ts`, `__tests__/candidates/service.test.ts`, `__tests__/candidates/state.test.ts`, `__tests__/candidates/use-room-candidate.test.ts`, `__tests__/candidates/candidate-card.test.tsx`, and `__tests__/resolution/common-filter-resolution-panel.test.tsx` for exact Edge response parsing, room-UUID-only invocation, compatible+pending one-flight, eligible available adoption, identity anchoring, exact title/year/poster-or-fallback card, removal of stale Feature 005 future-handoff copy, and zero advanced fields/internal-ID rendering.

### Exact search, Edge success path, and compatible client cutover

- [X] T024 [P] [US1] Define strict server transport/business models, safe fixed outcomes, budget clock/counter interfaces, and test-only fetch/RPC dependency injection in `supabase/functions/_shared/candidate-contracts.ts`; exclude constraint data, raw errors, secrets, fixtures, and descriptive persistence shapes.
- [X] T025 [P] [US1] Implement pure clause mapping, stable smallest-driver selection, Discover request construction, strict page/result parsing, canonical deduplication, and exact adult/year/AND-of-OR validation in `supabase/functions/_shared/tmdb-eligibility.ts` so Discover remains only a conservative source.
- [X] T026 [US1] Implement Bearer-authenticated TMDB v3 Discover/Details/Configuration adapters and the adaptive nonoverlapping date-shard traversal in `supabase/functions/_shared/tmdb-client.ts`, enforcing the 500-page provider boundary, 100-Discover-attempt/20-second budgets, parse-before-use behavior, first exact-match return, en-US, adult=false, and configuration-derived HTTPS poster URLs without persistent cache.
- [X] T027 [US1] Implement the authenticated preflight/acquire/assignment-CAS/winner-Details success path in `supabase/functions/room-candidate/index.ts`, using only the three approved server RPC signatures, no direct admin `.from(...)`, no DB transaction across HTTP, and no Discover call for preflight `not_ready`, `not_found`, `assigned`, or `no_candidates`.
- [X] T028 [US1] Evolve `src/rooms/contracts.ts`, `src/rooms/service.ts`, and `src/rooms/state.ts` to parse and monotonically merge the safe candidate status while rejecting impossible Feature 005/006 combinations and keeping both candidate IDs and private handoff data outside direct room state.
- [X] T029 [US1] Replace the normal fixture RPC boundary with strict Edge invocation and the compatible-pending one-flight state in `src/candidates/contracts.ts`, `src/candidates/service.ts`, `src/candidates/state.ts`, and `src/candidates/use-room-candidate.ts`; send only room UUID, accept one identity anchor, permit mutable same-ID metadata, and never call `ensure_room_candidate` or resolve bundled fixture posters.
- [X] T030 [US1] Evolve `src/candidates/candidate-card.tsx`, `src/resolution/common-filter-resolution-panel.tsx`, and `app/room/[code].tsx` so only authoritative compatible flow can show an accessible finding/metadata/candidate surface with exactly title, release year, and poster or explicit no-poster fallback; suppress candidates for Feature 005 pending/incompatible/integrity conflict, remove stale future-handoff copy, and remove obsolete fixture/direct-Ready wiring without deleting historical infrastructure.
- [X] T031 [US1] Run the focused DB, Edge eligibility/search/operation, room, candidate, resolution-panel, route, lint, typecheck, and check-only generated-type commands for T019–T030; include a bounded responsive-controlled-provider acquisition timing trial that demonstrates at least 95% complete minimum presentations within 10 seconds, and record exact failures-then-passes plus zero client TMDB catalog traffic/fixture presentation in `specs/006-tmdb-candidate-source/quickstart.md` before beginning US2.

**US1 checkpoint / commit boundary**: A compatible room can acquire and display
one exact real-TMDB identity through the controlled boundary; every early gate
is closed and Feature 002 is absent from the normal path. Commit the DB+Edge+
client success slice only after T031 is green; do not release it without US2/US3.

---

## Phase 4: User Story 2 — Share and Recover the Same Candidate (Priority: P1)

**Goal**: Make voters and the non-voting creator converge on the same immutable
DB winner through concurrency, repeated calls, lost responses, missed updates,
reload, reconnect, and same-identity re-entry.

**Independent Test**: Race different eligible proposals and an empty proposal,
discard a committed response, replay calls, retire route generations, and prove
all authorized roles recover the one stored ID while stale callbacks and losing
proposals never render.

### Failing convergence and recovery evidence

- [X] T032 [P] [US2] Extend `supabase/functions/_tests/room-candidate.test.ts` with failing concurrent-orchestration tests for different eligible proposals, candidate-versus-empty races, terminal preflight short-circuit, loser adoption of the stored winner, assignment-response loss, repeated assigned recovery through Details only, and late success/error/empty responses unable to replace a terminal.
- [X] T033 [P] [US2] Extend `__tests__/candidates/state.test.ts` and `__tests__/candidates/use-room-candidate.test.ts` with failing tests for immutable identity anchor, same-ID mutable metadata refresh, different-ID integrity conflict, React effect replay, explicit request generations, retired room A→B→A callbacks, committed-response-loss Retry, and equal behavior for voter and non-voting creator.
- [X] T034 [P] [US2] Extend `__tests__/rooms/state.test.ts`, `__tests__/rooms/use-room-subscription.test.ts`, and `__tests__/routes/room.test.tsx` with failing candidate-status monotonicity/conflict tests, one ID-only rooms channel, terminal invalidation/refetch, coalesced updates, system-ok missed-notification recovery, cleanup-before-rebind, reload/link/code/QR re-entry, and zero polling/Presence/Broadcast/second channel.

### Winner adoption and lifecycle convergence

- [X] T035 [US2] Complete terminal winner adoption and response-loss recovery in `supabase/functions/room-candidate/index.ts`: every commit result replaces the local proposal, assigned preflight reads Details only, no-candidates preflight performs zero TMDB calls, and safe failures after an uncertain commit allow the next preflight to recover without replacement.
- [X] T036 [US2] Implement immutable identity, monotonic terminal/conflict handling, request/image generation retirement, shared-flight replay, and same-ID-only recovery in `src/candidates/state.ts` and `src/candidates/use-room-candidate.ts` so no successful losing candidate is ever exposed even transiently.
- [X] T037 [US2] Extend `src/rooms/contracts.ts`, `src/rooms/state.ts`, and `src/rooms/use-room-subscription.ts` for terminal candidate-status convergence through the existing rooms-only invalidation/refetch lifecycle, preserving last-good state, canonical re-entry, filter-resolution authority, and exact channel teardown/rebind behavior.
- [X] T038 [US2] Integrate role-equal candidate recovery and integrity-conflict suppression in `app/room/[code].tsx`, ensuring a non-voting creator can initiate/observe the same authorized operation while contributing no filter and every role sees the same approved field set.
- [X] T039 [US2] Run focused DB dblink/CAS, Edge concurrency, room Realtime, candidate state/hook, and route recovery tests for T032–T038 and record winner IDs only as safe test-local assertions plus exact write/`xmin`/request-count evidence in `specs/006-tmdb-candidate-source/quickstart.md`.

**US2 checkpoint / commit boundary**: Concurrent and recovering members converge
on one stable assigned ID with no second write or second Realtime mechanism.
Commit this recovery slice only after T039 is green.

---

## Phase 5: User Story 3 — Understand Empty and External-Failure Outcomes (Priority: P2)

**Goal**: Distinguish a completed-empty acquisition from retryable acquisition
incompleteness and preserve an assigned identity through Details/configuration/
poster degradation.

**Independent Test**: Drive every controlled external fault and every bounded
pagination boundary; prove only a fully completed, error-free attempt with no
eligible movie observed commits no-candidates,
all interruptions remain pending with acquisition Retry, and post-commit retries
target metadata/poster for the same ID only.

### Failing completed-empty/failure and presentation-state evidence

- [X] T040 [US3] Add one coherent controlled-HTTP failure matrix to `supabase/functions/_tests/tmdb-search.test.ts` and `supabase/functions/_tests/room-candidate.test.ts` covering timeout/abort, 429 with/without `Retry-After`, bounded jitter/backoff, 4xx auth/parameter, 500/502/503/504, malformed JSON/schema, inconsistent totals/pages, request/deadline exhaustion, page 500, >500 recursive shards, single-day overflow, complete multi-shard zero, candidate/empty CAS loss, and proof that only a fully parsed, error-free completion returns completed-empty while every early stop is `search_incomplete`; assert the result means no eligible movie was observed in that scripted attempt and makes no global snapshot claim.
- [X] T041 [P] [US3] Add failing client/component tests in `__tests__/candidates/state.test.ts`, `__tests__/candidates/use-room-candidate.test.ts`, `__tests__/candidates/candidate-card.test.tsx`, and `__tests__/routes/room.test.tsx` for distinct acquiring/acquisition-error/no-candidates/metadata-error/poster-loading/poster-error/no-poster states, exactly one applicable Retry, stable new-room action without acquisition Retry, title/year retention during poster failure, and stale error/image callback suppression.

### Completed-empty terminal, retry mapping, and same-ID degradation

- [X] T042 [US3] Complete bounded retry/rate/failure classification and completed-empty attempt accounting in `supabase/functions/_shared/tmdb-client.ts`, counting every HTTP retry against both budgets, honoring advisory `Retry-After`, validating every page before evidence use, and returning `search_incomplete` for any limit/upstream/parser fault or incomplete page/shard traversal rather than terminal empty; do not encode a snapshot/global-nonexistence claim.
- [X] T043 [US3] Complete `no_candidates`, `metadata_unavailable`, and poster/configuration behavior in `supabase/functions/room-candidate/index.ts`: call empty CAS only after one bounded, error-free attempt completed every required request/page/shard with no eligible movie observed, adopt any competing terminal, preserve committed ID on Details/config failure, refresh isolate-only configuration when appropriate, return null only for confirmed no poster, and never retry Discover after assignment.
- [X] T044 [US3] Implement attempt-overlay transitions and actions in `src/candidates/contracts.ts`, `src/candidates/state.ts`, and `src/candidates/use-room-candidate.ts` so precommit operational failure leaves authoritative pending, terminal empty has no Retry, metadata Retry calls Edge for the anchored ID, and image Retry cannot invoke acquisition.
- [X] T045 [US3] Implement accessible finding/error/empty/metadata/poster/no-poster rendering and exact action routing in `src/candidates/candidate-card.tsx` and `app/room/[code].tsx`, retaining known same-ID title/year through poster errors and using the existing create-new-room route for terminal empty.
- [X] T046 [US3] Extend `__tests__/config/e2e-diagnostics.test.ts` and `e2e/support/safe-diagnostics.ts` with fixed safe Feature 006 failure categories/counts that exclude headers, URLs with credentials, request/response bodies, room/user/movie IDs, constraint values, upstream payloads, and speculative/fixture candidate data.
- [X] T047 [US3] Run the controlled Edge completed-empty/failure matrix, DB terminal races, client state/component/route cases, diagnostics tests, lint, typecheck, and `db:types:check`, recording exact request/shard/page/deadline completion evidence, the no-global-snapshot contract assertion, and failure-to-terminal write counts in `specs/006-tmdb-candidate-source/quickstart.md`.

**US3 checkpoint / commit boundary**: Completed-empty is the only terminal zero;
all operational incompleteness is retryable, and every post-assignment failure
retains the same identity. Commit this outcome slice only after T047 is green.

---

## Phase 6: User Story 4 — Minimal TMDB Metadata, Privacy, and Attribution (Priority: P2)

**Goal**: Ship exactly the approved TMDB-authored display through a least-
privilege boundary, expose neither secrets nor private eligibility, deny foreign
access, and satisfy mandatory TMDB attribution now.

**Independent Test**: Inspect requests, responses, state, bundles, logs, and
cross-room operations; prove clients send only room UUID, see exactly title/year/
poster meaning for their room, cannot access server RPCs or private data, and can
reach an accessible approved About/Credits surface.

### Failing security, metadata, and compliance evidence

- [X] T048 [P] [US4] Extend `supabase/functions/_tests/room-candidate.test.ts` with failing signed-out/expired-JWT, foreign-room, malformed-body, caller-supplied constraint/actor/candidate, server-RPC allowlist, direct-admin-table-access static, safe-error, and safe-log tests proving no TMDB/server token, private handoff, filter/source identity, raw upstream payload, foreign assignment, or fixture metadata can escape.
- [X] T049 [P] [US4] Extend `__tests__/candidates/contracts.test.ts` and `__tests__/candidates/service.test.ts` with failing exact business/error response parsing, room-UUID-only Edge invocation, no direct `api.themoviedb.org` catalog traffic, HTTPS configuration-derived poster acceptance, foreign/extra/private field rejection, and no secret/constraint/fixture retention in client state or errors.
- [X] T050 [P] [US4] Create failing exact three-field/accessibility tests in `__tests__/candidates/tmdb-presentation.test.tsx` for en-US title/release year, visible poster, confirmed no-poster fallback, internal-ID suppression, and absence of overview/rating/runtime/cast/provider/swipe/next/match content.
- [X] T051 [P] [US4] Create failing compliance tests in `__tests__/compliance/tmdb-attribution.test.tsx` and `__tests__/routes/about.test.tsx` for reachable navigation, approved accessible logo, preserved aspect/color/orientation, TMDB link, lower prominence than Otteroom, and the exact notice `This product uses the TMDB API but is not endorsed or certified by TMDB.`

### Least privilege, exact presentation, and mandatory attribution

- [X] T052 [US4] Harden JWT/body parsing, server-only secret access, three-RPC allowlisting, cross-room masking, response narrowing, and fixed-category logging in `supabase/functions/room-candidate/index.ts`; keep the TMDB Bearer token out of URLs and make private constraints exist only inside the trusted request lifetime.
- [X] T053 [US4] Harden `src/candidates/contracts.ts`, `src/candidates/service.ts`, `src/candidates/candidate-card.tsx`, and `app/room/[code].tsx` to expose exactly approved fields/actions, never render the TMDB ID as metadata, accept mutable same-ID en-US Details, and allow browser-origin TMDB traffic only to the validated poster CDN URL.
- [X] T054 [US4] Add an approved, unmodified official logo at `assets/compliance/tmdb-logo.png` and a provenance/hash assertion in `__tests__/compliance/tmdb-attribution.test.tsx`; do not redraw, recolor, flip, rotate, or generate a substitute asset.
- [X] T055 [US4] Implement the reusable attribution surface in `src/compliance/tmdb-attribution.tsx`, the About/Credits route in `app/about.tsx`, and reachable normal navigation in `app/index.tsx` with the exact notice, TMDB name/link, accessible logo text, and no implication of endorsement.
- [X] T056 [US4] Run the complete Edge auth/privacy/log suite, DB ACL/RLS matrix, candidate transport/presentation tests, compliance/route tests, client bundle/environment secret scan, lint, typecheck, web export, applicable native export checks, and `db:types:check`; record exact results and any justified platform omission in `specs/006-tmdb-candidate-source/quickstart.md`.

**US4 checkpoint / commit boundary**: The release boundary is least-privilege,
three-field, en-US, adult-excluding, fixture-free, and TMDB-attribution compliant.
Commit the privacy/compliance slice only after T056 is green.

---

## Phase 7: Cross-Story Acceptance, Provider Smoke, and Release Evidence

**Goal**: Prove the full Feature 006 vertical slice through bounded real-stack
acceptance, permanent smoke, deterministic external-boundary substitution, live
provider compatibility, repeatability, and an exact-SHA fresh checkout.

- [X] T057 Create one deterministic local TMDB HTTP substitute and shared candidate harness in `e2e/support/tmdb-stub.ts` and `e2e/support/candidate-harness.ts`, with scripted Discover/Details/Configuration pages/faults, held/released calls, committed-response discard, request counting, zero real TMDB catalog traffic, safe labels only, deterministic cleanup, and no credential or private-constraint capture.
- [X] T058 [P] Author failing J01 (cap 3) in `e2e/tmdb-candidate-source.spec.ts`: voting creator plus two voters reach distinct-clause/bounded-year compatible handoff, simultaneous real Edge calls see controlled eligible/decoy TMDB responses, one exact candidate wins, all show title/year/poster, reload/reconnect/re-entry recover it, attribution is reachable, and no fixture appears.
- [X] T059 Author failing J02 (cap 4) in `e2e/tmdb-candidate-source.spec.ts`: non-voting creator plus three voters prove zero creator contribution, one role-equal shared candidate, missed-update recovery, private ordinary-client traffic, then reuse the same identities in a second room whose controlled boundary completes every required search operation with no eligible movie observed to recover stable no-candidates with create-new-room action, no acquisition Retry, no global-catalog claim, no relaxation, and no fixture fallback.
- [X] T060 Author failing J03 (cap 2) in `e2e/tmdb-candidate-source.spec.ts`: reuse two identities across bounded rooms for precommit timeout/429/5xx/malformed/limit failure and Retry, committed-response loss, Details/configuration/poster failure, same-ID recovery, confirmed null-poster fallback, stale callback suppression, and zero fixture fallback.
- [X] T061 [P] Add failing profile/budget/safety tests for exact J01=3/J02=4/J03=2, F=9, workers=1, retries=0, repeatEach=1, capture-off artifacts, scanner, cleanup, and rejection of CLI environment/mock/identity overrides in `__tests__/config/feature006-e2e-profile.test.ts`.
- [X] T062 Implement the additive `feature006` selection, exact case inventory, F=9 accounting, controlled-stub process lifecycle, safe receipt fields, and unchanged full-discovery semantics in `scripts/run-e2e.mjs`, `playwright.config.ts`, and `package.json`; do not change shared Auth/context/reporter/scanner semantics or select F02/F04/F07/F08 separately.
- [X] T063 Evolve only superseded compatible-terminal assertions in G03/G04/G05/G08/H01 across `e2e/generalized-room-membership-qr.spec.ts` and `e2e/participant-filters.spec.ts` to the current candidate-appearance/privacy meaning while preserving their 16-identity assembly, QR, filter, isolation, and recovery intent; retain T=0 because J01–J03 plus lower layers absorb F02/F04/F07/F08.
- [X] T064 Extend the C1/static finalized-artifact boundary in `e2e/diagnostics/credential-safety.spec.ts`, `scripts/check-e2e-artifacts.mjs`, and `e2e/support/safe-reporter.ts` to reject TMDB/server secrets, private constraints, raw upstream data, internal IDs, and unsafe Feature 006 diagnostics while preserving exactly one C1 identity and owned cleanup.
- [X] T065 Implement the separate zero-identity, read-only live provider contract in `supabase/functions/_tests/live-tmdb-contract.test.ts` and its safe runner in `scripts/run-tmdb-contract.mjs`: with a separately provisioned Bearer token verify Genre List mappings, bounded Discover shape/parameters, en-US Details, HTTPS Configuration/poster sizes, and adult=false without pinning/logging a movie or treating this unstable provider smoke as deterministic acceptance.
- [X] T066 Run the final non-browser gate from `specs/006-tmdb-candidate-source/quickstart.md`: every nonempty migration runner, clean reset/full DB suite, `test:edge`, zero-identity live-TMDB contract smoke, full client suite, security/static scans, lint, typecheck, build, web/applicable native exports, and check-only DB types; record actual commands, versions, timings, outcomes, and omissions without a second generated-type write.
- [X] T067 Admit R02, then run C1 once plus J01/J02/J03 and permanent G03/G04/G05/G08/H01 through safe wrappers only; record the normal formula `1 + 16 + 9 + 0 = 26`, actual attempts/successes/timestamps/scanner/cleanup, fail on HTTP 429 or any mismatch, and add the evidence receipt to `specs/006-tmdb-candidate-source/quickstart.md`.
- [X] T068 From unchanged source and stack, run repeatability as C1 once followed by Feature 006 owner plus permanent smoke twice with fresh case identities, exact budget `1 + 2*(16 + 9) + 0 = 51`, workers=1/retries=0/repeatEach=1, scanner zero, deterministic cleanup, and check-only DB types; record the receipt in `specs/006-tmdb-candidate-source/quickstart.md`.
- [X] T069 At the exact implementation SHA in an independent disposable checkout, prove fresh install and secret-free setup, all nonempty migrations, clean reset/full DB and Edge/client/static tests, check-only canonical generated types, live provider smoke with separately supplied secret, lint/type/build/web/applicable native exports, C1 plus permanent smoke at 17 identities, scanner/cleanup zero, and combined repeatability+fresh budget `51 + 17 = 68`; record evidence in `specs/006-tmdb-candidate-source/quickstart.md` and remove only owned resources.

**Final checkpoint / release commit boundary**: All deterministic, live-provider,
normal R02, repeatability, and fresh-checkout gates are green at one exact source
state. The final release commit must contain no evidence secret, no generated-
type rewrite after T018, no fixture normal path, and no Feature 007 behavior.

---

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1** starts immediately and changes no product authority. T001 and T002
  touch disjoint evidence files and may be authored in parallel; T003 follows the
  expected T002 failure and makes that configuration evidence green.
- **Phase 2** depends on Phase 1 and blocks every story. T004–T011 establish
  failing evidence; T013–T016 implement the final DB contract; T017 must be green
  before the sole R01 write in T018.
- **US1** depends on T018 and establishes the common successful vertical path.
- **US2** depends on US1 because recovery adopts the identity US1 assigns.
- **US3** depends on US1/US2 because failure mapping must distinguish precommit
  state from the already-committed winner and terminal empty.
- **US4** depends on the stable Edge/client response boundary from US1–US3.
- **Phase 7** depends on all four story checkpoints; browser execution begins
  only after deterministic lower-layer and static gates are green.

### Within-story order

- Write and observe failing tests before their implementation task.
- Complete database schema/functions before R01; run `db:types` once, immediately
  check it, and never generate again.
- Build pure eligibility/parser/search behavior before Edge orchestration; build
  strict transport/state contracts before route rendering.
- Preserve the no-lock-across-HTTP split: preflight transaction, external work,
  short terminal CAS, then Details/configuration for the committed winner.
- Execute browser cases only through the reviewed wrappers after C1 admission.

### Parallel groups

- **Setup**: T001 provenance recording and T002 failing configuration evidence
  touch disjoint files; T003 is serial after T002.
- **Foundation**: T009, T010, and T011 may be authored in parallel with the new
  DB test stream T004–T008; T013–T018 are serial integration work.
- **US1 tests**: T019–T023 are disjoint failing-evidence streams. After their
  failures are recorded, T024 and T025 can run in parallel; T026–T031 converge
  serially.
- **US2 tests**: T032–T034 are parallel Edge/client/Realtime evidence; T035–T039
  integrate serially.
- **US3 tests**: T040 and T041 are parallel Edge/client streams; implementation
  and the checkpoint are serial.
- **US4 tests**: T048–T051 are parallel security/transport/display/compliance
  streams; T052–T056 integrate serially.
- **Acceptance authoring**: after T057, J01 authoring and the runner-profile unit
  tests (T058 and T061) may proceed in parallel; J02/J03 share one spec file and
  remain serial. All browser executions are serial by policy.

## Parallel Execution Examples

```text
Foundation authoring group:
  T009 Feature 002 evolution DB evidence
  T010 nonempty pre-upgrade fixtures
  T011 post-upgrade assertions

US1 failing-evidence group:
  T019 exact eligibility algebra
  T020 Discover pagination/search
  T021 Edge operation contract
  T022 room projection contract
  T023 client candidate flow

US4 failing-evidence group:
  T048 Edge auth/privacy
  T049 client transport privacy
  T050 exact display
  T051 attribution compliance
```

## Implementation Strategy

1. Complete Setup and the whole DB foundation, including the one R01 write.
2. Deliver US1 as the smallest successful vertical slice: coherent compatible
   handoff to one exact candidate and minimum display.
3. Add US2 convergence/recovery before treating the success path as releasable.
4. Add US3 completed-empty and failure distinctions without adding durable
   transient state or candidate replacement.
5. Add US4 least-privilege hardening and mandatory attribution.
6. Run Phase 7 once the lower layers are green; use controlled TMDB HTTP for
   deterministic browser evidence and the separate zero-identity live smoke only
   for current provider compatibility.

**Suggested MVP implementation scope**: Phases 1–4 (Foundation + US1 + US2)
form the core candidate-authority slice. The Feature 006 release still requires
US3, US4, and all Phase 7 gates because empty/failure distinction, privacy, and
attribution are mandatory rather than optional polish.

## Testing Impact Matrix

| Changed boundary | Primary authority | Browser owner evidence | Historical selection |
| --- | --- | --- | --- |
| Feature 005 compatible to candidate; early suppression | DB preflight + Edge + client | J01/J02 and evolved G03/G04/H01 | None |
| Exact year/AND-of-OR/all-Any/duplicates/disjoint/adult | Edge pure search + DB commit validation | J01 representative decoys | None |
| One terminal under concurrency/retry/lost response | DB dblink/CAS + Edge orchestration | J01/J03 | F02/F07 absorbed |
| Shared role-equal Realtime/re-entry recovery | DB/client rooms-only lifecycle | J01/J02 | F02 absorbed |
| Empty versus incomplete/upstream failure | Edge controlled HTTP + client state | J02/J03 | None |
| TMDB metadata/configuration/poster/no-poster | Edge parser + client component/image state | J01/J03 | F08 absorbed |
| Authorization, secret, and private constraint | DB ACL/RLS + Edge auth + C1 | J02 and G08 | F04 absorbed |
| Fixture cutover and additive existing-room migration | Migration + DB/client static tests | J01/J03 no-fixture assertion | Obsolete fixture cases not rerun |
| Attribution/About/Credits | Client compliance tests | Folded into J01 | None |
| Auth/QR/filter mechanics and harness safety | Existing lower layers + permanent smoke | G03/G04/G05/G08/H01 | No non-smoke E/G/H case |

`T=0` remains justified: all surviving F02/F04/F07/F08 authority, denial,
response-loss, recovery, and poster behavior is modernized by J01–J03, G08, and
the lower-layer owners. The fixture-specific historical versions would duplicate
evidence and assert the deliberately retired normal source.

## R01 and R02 Budgets

- **R01**: exactly one intentional `npm run db:types` in T018 after the final
  public schema/RPC contract, followed immediately by `db:types:check`; T019–T069
  are check-only.
- **Feature owner**: J01=3, J02=4, J03=2, so `F=9`.
- **Permanent smoke**: G03/G04/G05/G08/H01=`16`; **C1**=`1`;
  **targeted historical** `T=0`.
- **Normal**: `1 + 16 + 9 + 0 = 26`.
- **Repeatability**: `1 + 2*(16 + 9) + 0 = 51`.
- **Fresh checkout**: `1 + 16 = 17`.
- **Repeatability + fresh checkout**: `51 + 17 = 68`.
- **Explicit full historical trigger only**: `1 + 82 = 83`; it is not part of
  normal Feature 006 acceptance unless a policy trigger occurs.

## Functional-Requirement Traceability — 34/34

| Requirement | Principal implementation | Executable evidence |
| --- | --- | --- |
| FR-001 | T014/T027/T030 | T005/T021/T023, J01 |
| FR-002 | T014/T027/T030 | T005/T021/T023, J01/J02 |
| FR-003 | T014/T027 | T005/T006/T021/T048 |
| FR-004 | T025/T026/T014 | T006/T019/T020, J01 |
| FR-005 | T025/T026 | T006/T019/T020 |
| FR-006 | T025/T026/T014 | T006/T019/T020 |
| FR-007 | T014/T027/T052 | T005/T021/T048/T049, J02/G08 |
| FR-008 | T013/T014 | T004/T007/T008 |
| FR-009 | T014/T035/T036 | T007/T008/T032/T033, J01/J03 |
| FR-010 | T014/T035/T036/T043 | T007/T008/T032/T033/T040/T041, J01/J03 |
| FR-011 | T036/T037/T038 | T033/T034, J01/J02 |
| FR-012 | T025/T027/T029/T030 | T009/T019/T023, J01/J03 |
| FR-013 | T013/T015/T029 | T009/T010/T011, J01/J03 |
| FR-014 | T026/T043/T053 | T004/T020/T040/T050 |
| FR-015 | T013/T014 | T004/T006/T011 |
| FR-016 | T030/T053 | T023/T041/T050, J01/J03 |
| FR-017 | T043/T044/T045 | T040/T041/T050, J03 |
| FR-018 | T025/T026 | T019/T020, J01 |
| FR-019 | T042/T044/T045 | T040/T041, J03 |
| FR-020 | T014/T043/T044/T045 | T007/T040/T041, J02 |
| FR-021 | T014/T035/T036/T044 | T007/T032/T033/T040 |
| FR-022 | T014/T035/T036 | T007/T008/T032/T033, J03 |
| FR-023 | T043/T044/T045 | T040/T041, J03 |
| FR-024 | T043/T044/T045 | T040/T041, J03 |
| FR-025 | T035/T036/T037/T038 | T032/T033/T034, J01/J02/J03 |
| FR-026 | T037/T038 | T034, J01/J02 |
| FR-027 | T003/T024/T027/T052/T064 | T002/T021/T048/T049/T064, C1 |
| FR-028 | T014/T024/T027/T052/T053 | T005/T021/T048/T049, J02 |
| FR-029 | T014/T027/T052 | T005/T048, J02/G08 |
| FR-030 | T024/T042/T046/T052/T064 | T021/T040/T046/T048/T064, C1 |
| FR-031 | T029/T030/T053 | T023/T050, J01/J02 |
| FR-032 | T025/T026/T043/T053 | T006/T019/T020/T040/T050, J01/J03 |
| FR-033 | T013/T014/T029 | T004/T007/T023/T050/T069 |
| FR-034 | T014/T027/T037/T038 | T005/T006/T034, J01/J02 |

## Non-Functional-Requirement Traceability — 8/8

| Requirement | Principal implementation | Executable evidence |
| --- | --- | --- |
| NFR-001 | T013/T014/T035 | T004/T007/T008/T032 |
| NFR-002 | T014/T035/T036/T037 | T007/T008/T032–T034, J01–J03 |
| NFR-003 | T014/T025/T026 | T006/T019/T020/T040 |
| NFR-004 | T014/T027/T052/T064 | T004/T005/T021/T048/T049/T064, C1/G08 |
| NFR-005 | T014/T042/T043/T044 | T007/T008/T040/T041, J03 |
| NFR-006 | T030/T044/T045/T055 | T023/T041/T050/T051, J01–J03 |
| NFR-007 | T026/T036/T043/T053 | T032/T033/T040/T049/T050 |
| NFR-008 | T013–T055 | T004/T009/T019/T023/T050/T064/T069 |

## Success-Criterion Traceability — 12/12

| Criterion | Principal implementation | Executable evidence |
| --- | --- | --- |
| SC-001 | T014/T027/T030 | T005/T021/T023, J01/J02 |
| SC-002 | T014/T025/T026 | T006/T019/T020/T040, J01 |
| SC-003 | T014/T035/T036 | T007/T008/T032/T033, J01/J03 |
| SC-004 | T035/T036/T037 | T007/T008/T032–T034, J01–J03 |
| SC-005 | T038 | T033/T034, J01/J02 |
| SC-006 | T026/T030/T043/T053 | T020/T023/T040/T041/T050, J01/J03 |
| SC-007 | T042–T045 | T040/T041, J02/J03 |
| SC-008 | T014/T052/T053/T064 | T004/T005/T048/T049/T064, C1/G08/J02 |
| SC-009 | T013/T015/T029/T030 | T009–T011/T023, J01/J03 |
| SC-010 | T026/T027/T029/T030 | T020/T021/T023/T031, J01 plus recorded timing |
| SC-011 | T057–T067 | J01=3 + J02=4 + J03=2 = 9 |
| SC-012 | T013–T069 | T004/T009/T019/T023/T050/T064/T069 |

## Acceptance-Scenario Traceability — 28/28

| Scenario | Principal implementation | Executable evidence |
| ---: | --- | --- |
| 1 | T014/T027/T030 | T005/T021/T023, J01 |
| 2 | T014/T027/T030 | T005/T021/T023, J02 |
| 3 | T027/T029/T030 | T021/T023, J01 |
| 4 | T014/T025/T026 | T006/T019/T020, J01 |
| 5 | T014/T025/T026 | T006/T019/T020, J01 |
| 6 | T014/T025/T026 | T006/T019/T020 |
| 7 | T013/T014/T027 | T004/T007/T009, J01 |
| 8 | T025/T026 | T019/T020, J01 |
| 9 | T014/T035/T036 | T007/T008/T032/T033, J01 |
| 10 | T014/T035/T036 | T007/T032/T033 |
| 11 | T036/T037/T038 | T033/T034, J01/J02 |
| 12 | T035/T036/T037/T038 | T032–T034, J01/J02 |
| 13 | T035/T037 | T032/T034, J02 |
| 14 | T014/T035/T036 | T007/T008/T032/T033, J03 |
| 15 | T036/T037 | T033/T034, J03 |
| 16 | T042/T044/T045 | T040/T041, J03 |
| 17 | T014/T043/T044/T045 | T007/T040/T041, J02 |
| 18 | T042/T043/T044 | T040/T041, J03 |
| 19 | T014/T035/T036 | T007/T032/T033, J03 |
| 20 | T043/T044/T045 | T040/T041, J03 |
| 21 | T043/T044/T045 | T040/T041, J03 |
| 22 | T043/T044/T045 | T040/T041/T050, J03 |
| 23 | T026/T030/T053 | T020/T023/T050, J01 |
| 24 | T036/T038/T053 | T033/T034/T050, J01/J02 |
| 25 | T024/T027/T052/T053 | T021/T048/T049, J02/C1 |
| 26 | T014/T027/T052 | T005/T048, J02/G08 |
| 27 | T013/T015/T029/T030 | T009–T011/T023, J01/J03 |
| 28 | T025/T026/T043/T053 | T006/T019/T020/T040/T050, J01/J03 |

## Feature Evolution and Handoff Traceability

| Boundary | Tasks and evidence |
| --- | --- |
| Feature 002 → 006: preserve one shared identity, concurrency, replay, reload/reconnect and usable title/year/poster | T007–T009, T032–T039, T058–T060 |
| Feature 002 → 006: replace fixture normal source/metadata/poster/Ready trigger without deleting test infrastructure | T009–T015, T023/T029/T030, T063, J01/J03 |
| Feature 005 → 006: compatible-only private immutable exact handoff, no voter-filter reread or client disclosure | T005/T006/T014/T021/T027/T048/T052, J01/J02 |
| Feature 006 → 007: exactly one assigned `tmdb_movie_id`, no decision/progression state | T004/T007/T013/T014/T050/T069 |
| Attribution/compliance | T051/T054/T055/T058 |
| C1/R01/R02 | T018/T061–T069 |

## Completion Conditions

- All 69 tasks retain strict checklist format and their phase/story labels.
- Every required failing test is observed before its implementation task.
- All 34 FRs, 8 NFRs, 12 SCs, and 28 acceptance scenarios have both an
  implementation owner and executable evidence.
- Deterministic browser acceptance uses no live TMDB catalog dependency; the
  separate live smoke uses zero Otteroom Auth identities and is non-authoritative
  for deterministic acceptance.
- No unresolved product or design item remains. A newly discovered conflict or
  R02/harness trigger stops dependent work and updates upstream artifacts before
  implementation continues.

## Post-review remediation evidence

The independent final review invalidated the previous final-source claim at
`6f449a6342b74b14e279c0925a96f0f584aae4ba`; its receipts remain historical.
After failing-first integrity and pagination tests, remediation commit
`594a54e985b433f3d1c91f25be3f2f62acb5a0a3` passed the applicable T066 gate,
complete 51-identity T068 repeatability profile and exact-SHA 17-identity T069
fresh-checkout profile. T001–T069 therefore return to 69/69 on the new release
candidate. R01 remains exactly one generated-types write. Cumulative actual R02,
including every historical/superseded and one unplanned-but-counted remediation
C1 identity, is 284 attempts / 284 successful identities; the normative
26 + 51 + 17 = 94 budget is unchanged. Full receipts and zero-identity
infrastructure failures are preserved in `quickstart.md`.

## Cumulative-pagination final-review remediation evidence

The next independent final review invalidated only the final-source claim at
`594a54e985b433f3d1c91f25be3f2f62acb5a0a3`; all of its receipts remain
historical. A failing-first two-page regression proved that one noneligible raw
row followed by one eligible raw row must not return the movie when stable
`total_results=1`. The minimal guard before eligibility evaluation is committed
and pushed as `9d0a1a106b648868f33b65bf46ef1f563a050371`. Its focused RED/GREEN,
complete 19-test TMDB search file, exact-SHA T066, successful normative
51-identity T068 shape, and exact-SHA 17-identity T069 fresh checkout are
recorded in `quickstart.md`; all 69 tasks are again supported as checked.

R01 remains exactly one generated-types write with canonical SHA-256
`adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`.
T068 also retained one failed 9-identity owner attempt and one failed 16-identity
smoke attempt before their unchanged replacements passed, so cumulative actual
R02 is `284 + 76 + 17 = 377` attempts / 377 successful identities. The
normative normal 26 + repeatability 51 + fresh 17 = 94 budget is unchanged.

## Terminal-conflict final-review remediation evidence

The next independent final review invalidated only the final-source claim at
`9d0a1a106b648868f33b65bf46ef1f563a050371`; every prior receipt remains
historical. Failing-first reducer evidence proved all three contradictory Edge
terminal paths: assigned-to-no-candidates, no-candidates-to-available, and
no-candidates-to-metadata-unavailable. One centralized implied-terminal check
before the no-candidates short-circuit is committed and pushed as
`a5db7a7e40840f52d740bb169e6b03c7edc6bdac`. It preserves equal terminals,
same-ID mutable metadata/recovery, poster-error retention, stale-generation
suppression and canonical re-entry as the only integrity recovery.

Reducer GREEN was 15/15 and the affected state/hook/card/route set was 4 suites /
67 tests. Exact-SHA T066 passed Edge 39/39 plus one ignored, client/static
40 suites / 672 tests, lint/typecheck/check-only types, static security,
web/iOS/Android exports, 64-file zero-finding scans and the zero-identity live
TMDB contract. T068 passed the exact normative 51/51 profile with G04 twice and
no failed replacement attempts. Exact-SHA T069 passed all four migration
runners, clean reset, targeted DB 52/52 after one recorded dblink barrier
timeout, full DB 5/857, the same Edge/client/static/build/security/live gates,
and fresh C1+smoke 17/17; all owned disposable resources were removed.

T001–T069 are therefore again supported as 69/69 on the new release candidate.
R01 remains one Feature 006 generated-types write with canonical SHA-256
`adcec775b81b96552ada2887a69e3eaf80ce6d8ae465a2bcf52cb82e2396f5d3`.
Cumulative actual R02 is `377 + 51 + 17 = 445` attempts / 445 successful
identities. The normative normal 26 + repeatability 51 + fresh 17 = 94 budget is
unchanged.

## Final Task Status

- **T001–T069: 69/69 complete; zero unchecked tasks.**
- An independent whole-feature review of
  `0fcd79e8af4717f781c2bf173de8753e731b8a04..a5db7a7e40840f52d740bb169e6b03c7edc6bdac`
  found no substantive defect in the terminal state machine, pagination,
  eligibility, database CAS, privacy/security, metadata ownership, Realtime,
  fixture cutover, attribution or Feature 006 scope boundary.
- Final evidence remains T066 Edge 39/39 plus one live-only ignore and client
  40/672; T068 normative 51/51; T069 fresh 17/17 with all four migration runners
  and eventual DB 857/857. R01 remains exactly one generated-types write.
  Normative R02 remains 94 and cumulative historical actual remains 445/445.
- All 34 functional requirements, 8 non-functional requirements, 12 success
  criteria, 28 acceptance scenarios and all eight constitution principles are
  satisfied. Feature 007 has not started.

## Live-seam remediation current status

- The live manual failure after `a570821cde06d77ae619ce94f4f7693b40cdd28a`
  invalidated the previous final-source claim and reopened Feature 006. Older
  controlled-browser, live-contract and exact-SHA receipts remain historical;
  they did not prove the complete live TMDB-to-PostgreSQL browser seam.
- Failing-first evidence proved provider-ordered `genre_ids` were deduplicated
  but not sorted before the unchanged database canonical-evidence check. The
  one-line parser fix and its parsing/eligibility/commit regression are pushed
  in `f180d4bcf17a6766fcea8cec958c54221792c752`. Affected Edge tests passed
  40/40, full Edge passed 40/40 plus one live-only ignore, client passed
  40/672, candidate-authority DB passed 52/52, and lint/typecheck/check-only
  types/diff checks passed.
- The mandatory exact-SHA local acceptance used two normal anonymous voters and
  no provider substitute. Feature 005 resolved compatible, live Discover chose
  TMDB `1768727`, PostgreSQL committed that one ID, and both clients displayed
  **Old Habits Die Hard (2000)** with its poster before and after reload. Six
  Edge calls returned HTTP 200 `available`; Edge logs contained six serving
  entries and no `operation/internal`. Browser traffic contained no direct TMDB
  or private candidate RPC request and no secret/private-constraint disclosure.
- Feature 006 is COMPLETE again at remediation SHA `f180d4b`; R01 remains one
  historical generated-types write, recorded cumulative identities are now
  447/447, and Feature 007 has not started.
