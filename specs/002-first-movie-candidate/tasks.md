---
description: "Executable task breakdown for Feature 002 first-movie-candidate"
---

# Tasks: Show the First Shared Movie Candidate

**Input**: Fully reviewed documents in `specs/002-first-movie-candidate/`: `spec.md`, `checklists/requirements.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/candidate-rpc.md`, `contracts/candidate-display.md`, and `quickstart.md`; governed by `.specify/memory/constitution.md`.

**Repository**: `/home/maks/work/otteroom`; existing branch `main`. Do not create/switch branches, commit, push, or modify Feature 001 specification/planning artifacts.

**Tests**: Explicitly required. Write executable assertions before the corresponding implementation and observe the relevant failure before making them pass. Database, isolated client/component, real-stack browser, packaging, repeatability, and fresh-checkout evidence are complementary. No runtime checks or implementation are claimed by generating this file; all tasks start unchecked.

**Organization**: The eight ordered green phases below follow the approved plan. Shared prerequisites precede story work. Story labels distinguish US1 and US2 within phases 5–7; story demonstrations and dependencies are specified below. Existing application/test infrastructure is reused with only the planned compatibility adaptations.

## Format: `[ID] [P?] [Story] Description`

- Every task uses `- [ ] Tnnn`, an optional `[P]`, an applicable `[US1]` or `[US2]`, a concrete action, and exact repository-relative paths.
- `[P]` marks only the four independent poster files. Other tasks run in listed order; checkpoints block the next phase.
- US1 (P1): **Ready Room Receives a Shared Movie Candidate**.
- US2 (P1): **Shared Candidate Remains Stable**.
- A label gives primary story ownership; the coverage matrices show shared prerequisites and cross-story evidence. Unlabelled tasks are shared infrastructure or validation.
- Paths name future implementation outputs unless already present. Completing this task-generation workflow creates only this `tasks.md`.

## Execution Constraints

The release ends at one authoritative fixture candidate, shared title/year/visible poster, and stable reload/reconnect/repeated/concurrent access and recovery. No TMDB/external movie API, queue/deck, second candidate, next/previous, voting, matching, preferences, genres, ranking/recommendations, movie details, or watched/history work is included.

Use the existing Auth bootstrap, typed Supabase client, room state and one Realtime channel in `src/rooms/use-room-subscription.ts`. The candidate hook consumes authoritative Ready; it creates no channel, polling, replacement identity, or automatic retry loop. Assignment UPDATE invalidation may refetch the same room safely. Do not broaden the existing `rooms` projection beyond id/code/state or expose candidate IDs as movie UI.

Keep the installed dependencies and `package.json`/`package-lock.json` infrastructure. R01 uses one intentional generation after the finalized RPC, then check-only validation. Do not change `scripts/database-types.mjs` semantics unless a demonstrated incompatibility requires a separately reviewable correction.

Before the first database assertion/reset, prepare the existing local Docker/Supabase environment with `npm run supabase:start` and `npm run env:local` as described in `specs/002-first-movie-candidate/quickstart.md`. Reuse the existing installed runtime during incremental work; the fresh-copy task explicitly verifies `npm ci` and browser preparation. Preserve the quickstart's failure-safe cleanup discipline. npm/Docker preparation traffic is separate from page-level movie traffic assertions.

C1 applies to every browser case, helper, and cleanup: use the existing safe reporter, credential registry, bounded assertions and finalized scanner. Keep trace, HAR, video, storage-state exports and raw Auth/Realtime/request dumps disabled. Poster tests never authorize screenshots or scanner exceptions. Ordinary image-bearing UI credential checks must be separate from the preserved strict screenshot guard.

All browser acceptance uses real Anonymous Auth, local Supabase, the real RPC/PostgreSQL, existing Feature 001 Realtime, Expo web and the existing Playwright Docker runtime. No Supabase mocks or synthetic successful RPC responses are acceptance evidence. Candidate request/response data and internal identities stay in memory; diagnostics contain fixed safe labels/counts/booleans only.

**Browser execution/accounting rule**: Case-writing tasks define tests run at their named gates; they do not require extra standalone runs. Every additional development run must reserve its own cap and run C1 first. Attach signup observers before navigation, count dispatched failed attempts as well as successful identities, enforce each case cap, and require zero additional identities for reload/reconnect/retry/repeated access. Database synthetic identities consume zero GoTrue signups. The R02 table below governs admission to every browser block.

## Frozen Fixture and Schema Inputs

The migration is the sole runtime metadata catalog. Test expectations and the key-to-asset registry are not additional selection catalogs. All four rows and original PNG contents remain fixed through Feature 002.

| id | title | release_year | poster_key | sort_order | Exact local PNG |
| --- | --- | ---: | --- | ---: | --- |
| fixture-cardboard-comet | The Cardboard Comet | 2020 | cardboard-comet | 10 | `assets/candidates/cardboard-comet.png` |
| fixture-pebble-bay-lanterns | Lanterns of Pebble Bay | 2021 | pebble-bay-lanterns | 20 | `assets/candidates/pebble-bay-lanterns.png` |
| fixture-cloud-tram-four | Cloud Tram Number Four | 2022 | cloud-tram-four | 30 | `assets/candidates/cloud-tram-four.png` |
| fixture-clockwork-orchard | The Clockwork Orchard | 2023 | clockwork-orchard | 40 | `assets/candidates/clockwork-orchard.png` |

Each PNG is original artwork, exactly **240×360**, at most **64 KiB (65,536 bytes)**, and statically bundled by Expo. No provider credentials or external movie resource is required.

| Catalog field | Required SQL definition |
| --- | --- |
| id | text NOT NULL, no default; PRIMARY KEY; slug `^[a-z0-9]+(-[a-z0-9]+)*$` |
| title | text NOT NULL, no default; equals btrim(title), nonempty after trim |
| release_year | smallint NOT NULL, no default; BETWEEN 1888 AND 9999 |
| poster_key | text NOT NULL, no default; UNIQUE; same slug pattern |
| sort_order | integer NOT NULL, no default; UNIQUE and > 0 |

Exact catalog constraint names: `movie_candidates_pkey`, `movie_candidates_id_format_check`, `movie_candidates_title_check`, `movie_candidates_release_year_check`, `movie_candidates_poster_key_format_check`, `movie_candidates_poster_key_key`, `movie_candidates_sort_order_check`, `movie_candidates_sort_order_key`.

The only room extension is nullable `rooms.movie_candidate_id text` without a default; `rooms_movie_candidate_id_fkey` references `movie_candidates(id)` ON DELETE RESTRICT / ON UPDATE NO ACTION. Named `rooms_candidate_requires_guest_check` is `movie_candidate_id IS NULL OR guest_user_id IS NOT NULL`: Waiting + NULL valid; Waiting + candidate forbidden; Ready + NULL valid; Ready + candidate valid. Existing generated state and membership semantics remain intact; no backfill is required. Application immutability follows the sole authorized RPC and denied direct mutations, not a claim that this CHECK prevents privileged administrative SQL.

The only new public application RPC is `public.ensure_room_candidate(p_room_id uuid)`, returning exactly one row of `outcome text, candidate_id text, title text, release_year smallint, poster_key text`. `available` requires all four candidate values; `not_ready`/`not_found` require four NULLs. Exceptions are not additional business outcomes.

## Phase 1: Fixture poster/catalog baseline

**Purpose**: Establish the four local fixture assets before schema or candidate UI work.

- [x] T001 Add fixture-file validation in `__tests__/candidates/assets.test.ts` using existing Node/Jest facilities: require exactly the four approved paths in the fixture table above, valid PNG signatures, 240×360 IHDR dimensions, size at most 65,536 bytes each, distinct file contents, and no extra fixture PNG; first observe failure for missing assets. Keep expected metadata test-only, with no client selection catalog.

- [x] T002 [P] Create the original geometric poster `assets/candidates/cardboard-comet.png` for The Cardboard Comet: exactly 240×360 pixels, at most 64 KiB, no external artwork or remote resource reference; own only this asset and do not edit a shared registry.

- [x] T003 [P] Create the original geometric poster `assets/candidates/pebble-bay-lanterns.png` for Lanterns of Pebble Bay: exactly 240×360 pixels, at most 64 KiB, no external artwork or remote resource reference; own only this asset and do not edit a shared registry.

- [x] T004 [P] Create the original geometric poster `assets/candidates/cloud-tram-four.png` for Cloud Tram Number Four: exactly 240×360 pixels, at most 64 KiB, no external artwork or remote resource reference; own only this asset and do not edit a shared registry.

- [x] T005 [P] Create the original geometric poster `assets/candidates/clockwork-orchard.png` for The Clockwork Orchard: exactly 240×360 pixels, at most 64 KiB, no external artwork or remote resource reference; own only this asset and do not edit a shared registry.

- [x] T006 Run `npm run lint`, `npm run typecheck`, and `npm run test:client`, including `__tests__/candidates/assets.test.ts`; inspect the four original PNGs for usable distinct artwork and record G1 command/results in `specs/002-first-movie-candidate/quickstart.md`. Require exact file/key coverage and all existing checks green before schema work.

**Checkpoint G1**: Local PNG validity and existing static/client checks pass; no candidate UI behavior is introduced.

---

## Phase 2: Catalog schema, fixture seed, room assignment

**Purpose**: Install the single catalog relation and nullable assignment column without changing Feature 001 membership behavior.

- [x] T007 Add catalog/assignment pgTAP assertions in `supabase/tests/database/room_candidate.test.sql` for the exact five fields, SQL types, null/default rules, four full seed rows, named constraints above, actual invalid/duplicate inserts, FK actions, and the four Waiting/Ready × NULL/assigned states. Include a real rejected Waiting assignment and referenced-candidate deletion; demonstrate the new assertions fail before the schema migration.

- [x] T008 Extend `supabase/tests/database/room_candidate.test.sql` with actual PUBLIC/anon/authenticated table and column privilege checks, enabled catalog RLS with no client policies, denied catalog SELECT/INSERT/UPDATE/DELETE and room assignment reads/mutations, existing member-only rooms projection, unrelated-room isolation, and unchanged rooms-only publication. Verify role-level denial as well as catalog ACL definitions.

- [x] T009 Create `supabase/migrations/20260909000000_movie_candidates_schema.sql` with `public.movie_candidates`, the exact field/constraint definitions and four rows listed above; enable RLS, create no client catalog policies, and explicitly revoke all table privileges from PUBLIC, anon, authenticated. Seed inside this versioned migration, with no extra runtime metadata source or separate seed command.

- [x] T010 Extend the same ordered migration `supabase/migrations/20260909000000_movie_candidates_schema.sql` with nullable `public.rooms.movie_candidate_id text` without a default, `rooms_movie_candidate_id_fkey` (ON DELETE RESTRICT, ON UPDATE NO ACTION), and `rooms_candidate_requires_guest_check`. Preserve existing columns/state/grants/publication; old Waiting and Ready rows acquire NULL safely without backfill. Add no second assignment relation, snapshot fields, or extra index.

- [x] T011 Update exact-shape assertions in `supabase/tests/database/room_session.test.sql` additively for two application tables, nine room columns, the third rooms FK and named Waiting-assignment check; retain all original create/join, membership, concurrency, RLS, grants, and Realtime publication assertions, including unchanged existing RPC result shapes.

- [x] T012 Validate safe upgrade using `npm run db:reset -- --version 20260905000002`, owner-only synthetic Waiting/Ready fixtures and before-row snapshots following `supabase/tests/database/room_session.test.sql`, then `node_modules/.bin/supabase migration up --local`; require every prior field unchanged and only NULL added, without backfill or GoTrue signups. Record this disposable migration trial and G2 in `specs/002-first-movie-candidate/quickstart.md`. Then run full `npm run db:reset` and `npm run db:test`, requiring exact seed/schema/ACL assertions in `supabase/tests/database/room_candidate.test.sql` and the entire existing room suite green; canonical type validation begins in phase 4.

**Checkpoint G2**: A clean reset reproduces the exact four fixtures; new schema/ACL checks and the existing room database suite pass.

---

## Phase 3: Candidate RPC, security, concurrency

**Purpose**: Finish the authoritative transaction and prove its security, atomicity, and real-session serialization before client integration.

- [x] T013 Extend `supabase/tests/database/room_candidate.test.sql` before RPC implementation with exact signature/one-row/five-key/nullability tests; postgres owner, SECURITY DEFINER, empty search_path, fixed schema-qualified body and exact EXECUTE ACL checks; signed-out denial and authenticated null-subject SQLSTATE 42501; own Waiting not_ready; NULL/absent/unrelated Waiting/unrelated Ready/unrelated assigned-room not_found equality. Require no candidate fields or room writes for denied/not-ready business outcomes.

- [x] T014 Add first-selection, existing-assignment, sequential/overlapping repeat, and rollback assertions in `supabase/tests/database/room_candidate.test.sql`: lowest sort_order wins, all candidate fields match, repeats preserve the whole room and timestamp, empty catalog remains exceptional, and a rollback-only fault after assignment UPDATE preserves Ready/membership/NULL. Schedule empty-catalog trials before any reference to its rows and fault DDL after committed race trials; roll back every fault and expose no application fault switch.

- [x] T015 Build the deterministic dblink race setup/barrier in `supabase/tests/database/room_candidate.test.sql`, reusing the conventions of `supabase/tests/database/room_session.test.sql`: supabase_admin only for test-extension setup with immediate client EXECUTE revocation; a separate postgres setup connection commits two synthetic auth.users rows and one Ready/NULL room. Open distinct host/guest PIDs with authenticated role, individual auth.uid() claims, and explicit READ COMMITTED; assert these inside both sessions. Hold the room FOR UPDATE in an owner coordinator, dispatch both real RPCs asynchronously, and require bounded observed pg_blocking_pids chains for both, including queued blockers, before release. Synthetic SQL users consume zero GoTrue signups.

- [x] T016 Complete the race assertions and cleanup in `supabase/tests/database/room_candidate.test.sql`: release the owner only after the observed barrier, drain/commit the winner while the other caller remains blocked, snapshot the winner's committed whole room plus xmin::text through an owner observer before the second commit, then drain/commit the second caller. Require identical available rows, minimum-sort FK, one persisted room/assignment update, four catalog rows, unchanged membership/state/created_at, and identical final row/xmin proving no second same-value UPDATE. Bound all waits; cancel/drain terminal dblink results, roll back/close sessions, and remove only committed trial fixtures on every exit; no arbitrary sleep as overlap evidence.

- [x] T017 Create `supabase/migrations/20260909000001_room_candidate_rpc.sql` with exactly `public.ensure_room_candidate(p_room_id uuid)` and the approved five-column result. In one migration transaction install a postgres-owned SECURITY DEFINER function with empty search_path, qualified fixed SQL and no dynamic SQL; revoke its exact signature from PUBLIC, anon, authenticated, then grant authenticated. Require auth.uid(), lock the target room before candidate lookup, deny outsiders using null-safe host/guest comparisons, return exact not_found/not_ready null rows, return an existing assignment without UPDATE, or assign the lowest sort_order fixture by changing only movie_candidate_id and updated_at = pg_catalog.transaction_timestamp(). Raise exceptional empty/integrity failures atomically; add no reassignment path, public helper RPC, or broader client privileges.

- [x] T018 Run `npm run db:reset` and `npm run db:test` against `supabase/tests/database/room_candidate.test.sql` and `supabase/tests/database/room_session.test.sql`; record G3 in `specs/002-first-movie-candidate/quickstart.md` only after security/outcomes, real lock overlap, one-write/no-reassignment proof, atomic rollback, and Feature 001 database behavior pass. Finalize both migration contracts before generating types; this gate requires zero browser identities.

**Checkpoint G3**: The complete RPC, security, rollback, and deterministic two-session database tests pass after a clean reset.

---

## Phase 4: Generated database types

**Purpose**: Perform the one intentional R01 update after the public database contract is final.

- [x] T019 Run the intentional R01 sequence `npm run db:reset`, `npm run db:types`, then `npm run db:types:check`; review the catalog, nullable room FK relationship, and RPC additions in canonical `src/types/database.generated.ts`. Perform this intentional write once after G3, never hand-edit output, and retain `scripts/database-types.mjs` semantics and the existing package scripts.

- [x] T020 Record the canonical artifact hash, run a subsequent `npm run db:reset` followed only by `npm run db:types:check`, then lint/typecheck/client tests through the existing `package.json` scripts; require `src/types/database.generated.ts` unchanged and `__tests__/config/database-types.test.ts` green. Record G4 and the intentional-versus-check-only boundary in `specs/002-first-movie-candidate/quickstart.md`; any drift blocks client work.

**Checkpoint G4**: The reviewed canonical types survive a subsequent clean reset and check-only validation unchanged, ready for client work.

---

## Phase 5: Candidate client layer

**Purpose**: Build the feature-oriented contracts, service, registry, state, hook, and standalone card behavior permitted by the plan; room-screen integration follows in phase 6.

**Story tests**: US1 verifies Waiting/Ready acquisition and complete display through the isolated candidate layer. US2 verifies immutable metadata and distinct acquisition/poster recovery with controlled deferred completions; real service evidence follows in phases 6–7.

- [x] T021 [US1] Add `__tests__/candidates/contracts.test.ts` before the parser: exercise the exact one-row/five-key available/not_ready/not_found contract, all four logical NULL fields on unavailable outcomes, slug IDs/keys, trimmed title, integral 1888–9999 year, and rejection of missing/extra rows or keys, unknown outcomes, wrong types, and malformed null combinations without echoing data.

- [x] T022 [US1] Create `src/candidates/contracts.ts` with the strict closed result union and runtime narrowing from unknown data, checking logical nullability independently of generated SQL types and emitting fixed safe contract errors; satisfy `__tests__/candidates/contracts.test.ts` without making fixture selection a client concern.

- [x] T023 [US1] Add `__tests__/candidates/service.test.ts` before the service: require the shared anonymous bootstrap and exactly the typed ensure_room_candidate RPC with p_room_id, runtime parsing, safe fixed errors for Auth/transport/database/parser failures, and no direct catalog or assignment-column reads. Keep this isolated client test separate from real-stack acceptance evidence.

- [x] T024 [US1] Create `src/candidates/service.ts` using `src/auth/anonymous-session.ts`, `src/lib/supabase.ts`, and canonical `src/types/database.generated.ts`; expose the typed room candidate request and fixed CandidateServiceError, preserve existing session bootstrap, and pass every result through `src/candidates/contracts.ts` without logging or displaying backend details.

- [x] T025 [US1] Add `__tests__/candidates/posters.test.ts` before the registry: require exactly the four approved key-to-file mappings, literal static requires, unchanged ImageSourcePropType native-number/web-object forms, and safe unknown-key failure; combine with `__tests__/candidates/assets.test.ts` to reject missing, extra, oversized, or invalid fixture assets.

- [x] T026 [US1] Create `src/candidates/posters.ts` with exactly four literal requires of `../../assets/candidates/cardboard-comet.png`, `../../assets/candidates/pebble-bay-lanterns.png`, `../../assets/candidates/cloud-tram-four.png`, and `../../assets/candidates/clockwork-orchard.png`; return the registered ImageSourcePropType unchanged. Unknown keys fail safely; do not construct require paths, URLs, external fallbacks, or another metadata catalog.

- [x] T027 [US2] Add `__tests__/candidates/state.test.ts` before state mappings: cover inactive/loading/available/acquisition-error/poster-error states, immutable metadata anchored before image load, a differing later result rejected without replacement, Ready not_ready/not_found mapped to recoverable failure, and unchanged room/membership inputs. Require explicit incomplete display until current onLoad succeeds.

- [x] T028 [US2] Create `src/candidates/state.ts` with pure candidate/presentation mappings owned by room ID, generation and applicable attempt; retain the first valid metadata through poster and infrastructure failures, keep acquisition retry separate from poster retry, and expose only the approved generic copy. Do not persist client selections or introduce a global cache/state framework.

- [x] T029 [US1] Add `__tests__/candidates/use-room-candidate.test.ts` before the hook: Waiting or no room makes zero calls; authoritative Ready starts automatically; same-room effect replay and repeated Ready objects share one room/attempt promise; assignment-triggered existing room invalidation does not reacquire; no extra subscription, polling, or automatic retry loop is created.

- [x] T030 [US1] Create `src/candidates/use-room-candidate.ts` around stable accepted room ID/state and explicit attempt, preserving a room-local promise across effect replay and using the existing candidate service/state modules. Waiting remains inactive; Ready starts acquisition once; a recoverable failure without metadata offers explicit single-flight retry of the same room RPC.

- [x] T031 [US2] Extend `__tests__/candidates/use-room-candidate.test.ts` with controlled deferred completions for stale room/generation/request/image attempts, render-time ownership rejection, synchronously invalidated cleanup, retained metadata/success through Realtime reconnect, retry after response loss, and rejection of differing metadata. Prove poster retry increments only the image attempt, keeps the same source/candidate, and causes zero candidate RPCs or new Auth sessions.

- [x] T032 [US2] Complete `src/candidates/use-room-candidate.ts` with current room/generation/attempt guards on publishing and rendering, immutable metadata preservation, stable per-image-attempt onLoad/onError callbacks, ignored obsolete callbacks, and separate explicit acquisition/poster retry behavior. Reconnect and harmless Ready refetches preserve the candidate; onLoadEnd alone cannot mark success.

- [x] T033 [US1] Add baseline component tests in `__tests__/candidates/candidate-card.test.tsx` for the standalone card: correct title/year and accessible poster text, bounded Image source/aspect ratio, no candidate ID as user-facing data, explicit loading, success only on current onLoad, and safe acquisition/configuration errors with the approved retry control.

- [x] T034 [US2] Extend `__tests__/candidates/candidate-card.test.tsx` before card implementation with onError/unknown-key failure, retained ID/title/year metadata, visibly incomplete status, same-source Image remount on explicit retry, actual onLoad recovery, stable callbacks, stale-image-event rejection, and a zero-RPC poster-retry assertion using the hook/service boundary.

- [x] T035 [US1] Create the minimal `src/candidates/candidate-card.tsx` using existing React Native Image and the candidate model: render title/year/poster with accessible text and generic loading/error/retry states, retain metadata on poster failure, and remount only the same-source Image for poster retry. Wire current onLoad/onError rather than onLoadEnd success; show no internal IDs or additional movie controls. Leave `app/room/[code].tsx` integration to phase 6.

- [x] T036 Run `npm run db:types:check`, `npm run lint`, `npm run typecheck`, `npm run test:client`, and `npm run web:export`; require all candidate tests under `__tests__/candidates/` and existing client/config/route suites green. Record G5 in `specs/002-first-movie-candidate/quickstart.md`, including all-four source/registry validity and the existing application export result; defer proof of candidate bundle inclusion until the screen imports the registry in phase 6.

**Checkpoint G5**: Candidate unit/component tests and the complete client/static/type checks pass; the existing application exports successfully. All-four application bundle inclusion is not claimed before phase 6.

---

## Phase 6: Room candidate UI integration — US1

**Purpose**: Integrate the minimal card and complete every harness prerequisite for F01 and the existing room regression suite.

**Independent Test (US1 core)**: A fresh host Waiting room plus guest join automatically converges to one fully displayed candidate, including synchronized first requests and repeated reads. F01 and all compatibility prerequisites are implemented in this phase, not deferred.

- [x] T037 [US1] Extend `__tests__/routes/room.test.tsx` before integration: preserve the canonical-code RoomEntry generation boundary and Waiting UI/zero acquisition; exercise immediate guest Ready and host authoritative Ready refetch, automatic shared candidate loading, title/year/poster/error/retry display, candidate retention during synchronization errors, and harmless assignment UPDATE invalidation. Keep existing room/invitation/membership regressions.

- [x] T038 [US1] Integrate `src/candidates/use-room-candidate.ts` and `src/candidates/candidate-card.tsx` into accepted-room content in `app/room/[code].tsx` using the current `useRoomSubscription` room-or-initial projection. Retain Ready/title/code/count/synchronization information and the existing Waiting experience; give host and guest the same candidate path, usable short-screen layout, and explicit safe retry states without another Realtime channel.

- [x] T039 Extend `__tests__/config/c1-capture.test.ts` and `__tests__/config/e2e-diagnostics.test.ts` with executable distinctions between ordinary image-bearing text/attribute credential inspection and strict screenshot eligibility. Assert image/background/SVG capture still fails, controlled C1 capture remains bounded, forbidden values still fail, and fixture/participant cleanup and final scanning cannot bypass safety.

- [x] T040 Add a separately named bounded text/attribute credential check in `e2e/support/safe-diagnostics.ts`, reusing the forbidden-value registry and sanitizer for ordinary image-bearing UI and ordinary fixture/participant final checks. Preserve the original strict screenshot inspector, image/background/SVG ban, controlled static C-probe, capture bans, and finalized scanner; update ordinary assertion callers in `e2e/room-session.spec.ts` without authorizing poster screenshots.

- [x] T041 Extract only shared existing room/context/signup-observer/snapshot/actual-socket helpers from `e2e/room-session.spec.ts` into `e2e/support/room-harness.ts` for F01 reuse; retain `e2e/support/safe-diagnostics.ts` context ownership, in-memory credentials, pre-navigation signup observation, cleanup, system-ok/refetch barriers, and all existing case caps. Extraction must not create identities beyond the original 47 plus F01's 2 when the phase gate runs.

- [x] T042 Adapt `e2e/room-session.spec.ts` and shared owner snapshots in `e2e/support/room-harness.ts` to the ninth nullable room field; preserve E06's one membership transition while distinguishing the candidate assignment UPDATE, and settle candidate acquisition before full-row equality baselines, including affected E12 trials. Expose the committed room row plus xmin::text from the same owner-only SQL read for candidate assertions, keeping xmin as separate test metadata outside the nine-field row and the client projection unchanged. Preserve all existing 24 cases, their original identity allocation of 47, and membership/security oracles.

- [x] T043 Update `__tests__/config/e2e-diagnostics.test.ts` and affected discovery/runtime assertions in `__tests__/config/playwright-runtime.test.ts` for explicit acceptance discovery of the existing file plus `e2e/first-movie-candidate.spec.ts`, bounded F01/file labels, and phase-6 N=49 budget reporting. Assert C1 capture/reporter/scanner protections, one-worker/repeat-one/retries-zero defaults, and existing bounded wrapper options remain intact.

- [x] T044 Add `first-movie-candidate.spec.ts` explicitly alongside `room-session.spec.ts` in `playwright.config.ts`; extend only fixed F01/file labels in `e2e/support/safe-reporter.ts`, `e2e/support/sanitize-diagnostics.ts`, and `scripts/run-e2e.mjs`, and align budget diagnostics in `e2e/support/safe-diagnostics.ts`/`scripts/run-e2e.mjs` to N=49 for this phase. Preserve the safe reporter, artifact scanner, credential registry, capture bans, wrapper options, and existing cases.

- [x] T045 Add narrowly scoped shared candidate assertions and outgoing-request barriers in `e2e/support/candidate-harness.ts`, using `e2e/support/room-harness.ts`: install holds before Ready, require one first request from each authenticated participant with zero forwarded, then release only after both arrive. Track per-participant candidate RPC counts in memory, separating automatic application calls from intentional direct contract/repeat probes; consume T042's committed row/xmin snapshot for database assertions. Assert a visible RN Web wrapper with positive bounds, correct local painted PNG, successful actual load/positive decoded dimensions and onLoad-derived card success; monitor configured app/Supabase HTTP/WS origins from before navigation and reject external candidate metadata/poster traffic. Emit only C1-safe labels/counts/booleans, use bounded barriers/cleanup, and create no identities independently.

- [x] T046 [US1] Implement F01 `@candidate` in `e2e/first-movie-candidate.spec.ts` (cap 2 fresh identities) using the real stack: prove Waiting has NULL/no card/zero automatic candidate RPCs, test own direct not_ready separately, then join the guest and synchronize both automatic first requests through the pre-Ready barrier. Require automatic host Ready convergence through existing Realtime, matching catalog ID/title/year/visibly loaded poster for both, no displayed ID, one persisted assignment, stable sequential/overlapping repeated RPC reads with no extra UPDATE, zero conflicting successful displays, and local-only candidate traffic. Execute as part of T048; reload/retry/repeat calls add zero identities.

- [x] T047 Run `npm run web:export` after screen integration and inspect `dist/` against all four `assets/candidates/` PNG files: verify each distinct source's bytes/hash is present as a bundled local PNG and the static registry is reachable from the exported application. Add the reproducible dependency-free Node inspection command and its actual result to `specs/002-first-movie-candidate/quickstart.md`; a successful export exit code alone does not satisfy this task.

- [x] T048 [US1] Run the G6 static/client/R01 checks using existing `package.json` scripts (`db:reset`, `db:types:check`, lint, typecheck, test:client, db:test, web:export plus T047's asset inspection), then prepare the existing Docker runtime with `npm run playwright:install`. Reserve 50 signup attempts before `npm run test:e2e:security` followed by unfiltered `npm run test:e2e`; require the C1 wrapper/scan and all 25 cases (24 existing + F01, N=49) green. Record G6 in `specs/002-first-movie-candidate/quickstart.md`; an additional separate C1 + F01 development run costs 3 and needs its own allowance.

**Checkpoint G6**: All four PNGs are present in the production web export; C1 and the unfiltered 25-case acceptance suite (existing 24 + F01) pass, acceptance N=49 and block cap=50.

---

## Phase 7: Real-stack Feature 002 acceptance — US1 and US2

**Purpose**: Retain F01 and add F02–F08 to cover all 17 product scenarios with real services and credential-safe diagnostics.

**Independent Tests**: Complete US1 with F04 isolation and F05 initial failure, alongside F01. Demonstrate US2 in fresh case-owned contexts using F02/F03/F06/F07/F08 plus F01 repeat access and F05 retry. No case depends on identities or mutable room state left by another case.

- [x] T049 Extend fixed F02–F08/file labels and final budget/discovery expectations in `playwright.config.ts`, `e2e/support/safe-reporter.ts`, `e2e/support/sanitize-diagnostics.ts`, `e2e/support/safe-diagnostics.ts`, `scripts/run-e2e.mjs`, `__tests__/config/e2e-diagnostics.test.ts`, and `__tests__/config/playwright-runtime.test.ts`; retain F01 and every existing case. Final discovery must be eight @candidate/32 total cases with allocation 47 + 18 = 65; C1 adds one. Keep default retries zero and no automatic Auth retry after 429.

- [x] T050 Extend `e2e/support/candidate-harness.ts` with bounded one-shot real-transport faults: pre-forward aborts for both callers; separate committed-response-loss forwarding via `route.fetch({ maxRetries: 0, maxRedirects: 0, timeout: 15000 })`; and an exact resolved app-origin HTTP PNG failure before its first load. For committed response loss, keep both browser routes paused until both real available responses are validated in memory and T042's independent owner read confirms the same committed FK, then abort browser delivery and dispose both responses. Failure to establish that barrier fails the trial; an ordinary abort is never commit evidence. Reuse the two-request retry barrier and safe cleanup; never fulfill synthetic Supabase success, accept a data/blob substitute, or bypass C1 reporting/scanning. Helpers create zero identities; caller cases own their explicit caps.

- [x] T051 Extend `e2e/support/room-harness.ts` with F06's create-with-existing-session path: retain the two authenticated contexts, use a fresh creation request ID, validate the returned room ID, and allow an owner to have two trial rooms without a length-one own-rooms assumption. Do not call the helper that creates/waits for fresh signup for the second room; assert this path adds zero identities and retains existing cleanup/security behavior.

- [x] T052 [US2] Implement F02 `@candidate` in `e2e/first-movie-candidate.spec.ts` (cap 2) for scenarios 9–11: after both see the candidate, reload host and guest separately, then close actual browser/server socket paths and restore each participant separately using the existing system-ok/refetch barrier. Use T045's counters to require one initial acquisition per participant, exactly one additional application candidate RPC for each participant's reload, and zero additional candidate RPCs during either socket-reconnect trial or harmless Ready refetch. Require identical identity/title/year/visible poster and committed row/xmin, preserved displayed candidate while synchronization recovers, unchanged membership, no extra assignment, and zero new recovery signups; execute in T059/T060.

- [x] T053 [US2] Implement F03 `@candidate` in `e2e/first-movie-candidate.spec.ts` (cap 2) for scenario 15: disconnect the actual original host socket paths while Waiting, let the guest join and load the assignment, then restore that host's real subscription and authoritative Ready refetch. Require automatic acquisition of the guest's existing candidate/visible poster, unchanged assignment and membership, and zero recovery identities; execute in T059/T060.

- [x] T054 [US1] Implement F04 `@candidate` in `e2e/first-movie-candidate.spec.ts` (cap 4) for scenario 6: establish two unrelated Ready rooms with four distinct members, compare exact foreign and absent not_found rows with all four candidate fields NULL in both directions across initial/concurrent/repeated access, reload, actual reconnect, and retry. Require no private assignment disclosure or mutation, generic safe failure handling, each own candidate intact, and real client denial of catalog browse/assignment-column access; identical fixture titles across rooms are not an isolation oracle. Recovery adds zero identities; execute in T059/T060.

- [x] T055 [US1] Implement F05 `@candidate` in `e2e/first-movie-candidate.spec.ts` (cap 2) for scenarios 7 and 13: hold then abort both automatic first RPCs before any forwarding or route.fetch; prove persisted Ready/NULL, unchanged membership, generic recoverable errors and no complete/conflicting candidate. Clear the fault, synchronize both explicit retry requests, and require exactly one assignment and matching complete displays, with zero new retry identities; execute in T059/T060.

- [x] T056 [US2] Implement F06 `@candidate` in `e2e/first-movie-candidate.spec.ts` (cap 2 total) for scenario 14: run two sequential fresh-room subtrials in the same two authenticated contexts, reversing which participant's acquisition fails before receiving metadata while the other displays the real assigned candidate. Use T051 for the second room, retry the failed participant explicitly, and prove the established ID/title/year/poster/FK and successful participant's display never rotate; second room/retries add zero signups. Execute in T059/T060.

- [x] T057 [US2] Implement F07 `@candidate` in `e2e/first-movie-candidate.spec.ts` (cap 2) for scenario 16: forward both first actual RPCs using T050's bounded route.fetch and validate genuine available responses in memory while both browser deliveries remain paused and neither participant has received metadata. Before aborting either delivery, use T042's independent owner snapshot to prove a committed non-NULL FK matching both responses and retain its row/xmin baseline. Only then abort both browser deliveries and dispose the responses; require generic recoverable errors before allowing either explicit retry. Synchronize both retries and require that same persisted candidate and full poster display, unchanged committed row/xmin, no rotation, and zero recovery signups. A missing commit barrier or failed real upstream response fails this test rather than counting as response loss. Execute in T059/T060.

- [x] T058 [US2] Implement F08 `@candidate` in `e2e/first-movie-candidate.spec.ts` (cap 2) for scenario 17: in a fresh context install an exact resolved local HTTP PNG route before first load, inject exactly one actual poster-request failure including query-string-safe matching, and retain assigned ID/title/year/source with a generic incomplete-display error. Retry the same Image source, require actual successful load/decoded dimensions/visible painted wrapper and onLoad success, and assert zero candidate RPCs caused by poster retry, unchanged row/xmin and membership, no external resource, and zero retry identities. Use the unchanged safe reporter/scanner; execute in T059/T060.

- [x] T059 Run the updated client/config tests with `npm run test:client`, then `npm run db:reset`, `npm run db:types:check`, and `npm run db:test`. Reserve 19 attempts for `npm run test:e2e:security` followed by `npm run test:e2e -- --grep '@candidate'`; require exactly F01–F08 in `e2e/first-movie-candidate.spec.ts`, all 17 mapped scenarios, per-case caps totaling at most 18, no recovery identities, local-only candidate traffic and finalized C1 scans. Record G7a evidence in `specs/002-first-movie-candidate/quickstart.md`.

- [x] T060 Reserve a separate sufficient allowance of 66 attempts, run `npm run db:reset`, `npm run db:types:check`, then `npm run test:e2e:security` and unfiltered `npm run test:e2e`; require 32 discovered/passing cases from `e2e/room-session.spec.ts` and `e2e/first-movie-candidate.spec.ts`, acceptance cap 65, preserved Feature 001 behavior, every F01–F08 assertion and clean finalized C1 scans. Record G7b in `specs/002-first-movie-candidate/quickstart.md`; together with G7a this is the complete phase-7 checkpoint, without starting further movie interactions.

**Checkpoint G7**: G7a passes C1 + all eight candidate cases; G7b passes C1 + all 32 acceptance cases. Both story contracts are demonstrated, including failure and recovery.

---

## Phase 8: Repeatability and fresh checkout

**Purpose**: Prove the completed slice through the normal command path, two clean acceptance runs on one continuously started stack, and a disposable fresh checkout/copy.

- [x] T061 Run the complete static/client/database/build checks through `package.json`: `npm run db:reset`, `npm run db:types:check`, `npm run lint`, `npm run typecheck`, `npm run test:client`, `npm run db:test`, and `npm run web:export` plus T047's all-four inclusion command. Record unchanged canonical type hash, both database suites including the real lock race, all client/config/route regressions, and local asset validity in `specs/002-first-movie-candidate/quickstart.md`; keep R01 write/check semantics and the existing dependencies unchanged.

- [x] T062 Execute the repeatability block in `specs/002-first-movie-candidate/quickstart.md` after explicitly reserving 131 attempts: prepare dependencies/browser runtime once, keep one local Supabase stack continuously started, configure env, and use the failure-preserving cleanup trap. Run reset → db:types:check → C1 → complete acceptance, then reset → db:types:check → complete acceptance without a restart between runs; each complete run discovers/passes 32 cases at cap 65, C1 costs 1 once, and both artifact scans pass. Count prior/failed/manual use; wait outside the harness if allowance is insufficient/unknown, fail on 429 without retry, and record safe totals/results and successful shutdown.

- [x] T063 Validate from a disposable clean clone/copy of the completed versionable implementation using the exact fresh-checkout shell sequence and cleanup trap in `specs/002-first-movie-candidate/quickstart.md`: npm ci → supabase:start → env:local → db:reset → db:types:check only → lint → typecheck → test:client → db:test → web:export plus T047's asset inspection → playwright:install → test:e2e:security → unfiltered test:e2e → supabase:stop. Include the four assets, both migrations, canonical types and test/harness files, while excluding reused node_modules/env/build/artifacts; do not commit or switch branches to create the copy. Admit this 66-attempt block only against separately sufficient recovered allowance after the 131 block (197 > 150). Require all 32 cases, C1 scans, check-only stable types, local movie resources and shutdown; record copy provenance and results without credentials.

- [x] T064 Reconcile actual implementation evidence in `specs/002-first-movie-candidate/quickstart.md` against every coverage row and checkpoint in `specs/002-first-movie-candidate/tasks.md`; require G1–G7, T061, both T062 runs and T063 green with no skipped required case/check. Confirm T001–T063 evidence and this final audit, no extra candidate/Realtime/provider surface, preserved Feature 001 artifacts, clean artifact scans and shutdown; run `git diff --check`, whitespace-check untracked implementation files, and record `git status --short`. Mark completion only during the later authorized implementation workflow; do not commit or push.

**Checkpoint G8**: All required checks, both repeatability runs, fresh-checkout acceptance, artifact scans, and shutdown pass; every Feature 002 task is complete before implementation is declared finished.

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 / G1 (T006)
  → Phase 2 / G2 (T012)
  → Phase 3 / G3 (T018)
  → Phase 4 / G4 (T020)
  → Phase 5 / G5 (T036)
  → Phase 6 / G6 (T048)
  → Phase 7 / G7a + G7b (T059 + T060)
  → Phase 8 / G8 (T064)
```

Every unmarked task depends on the preceding listed task; the only exception is the explicitly concurrent group T002–T005, whose members each depend on T001 and collectively precede T006. References to later execution gates are scheduling instructions, not reverse dependencies. Test-writing tasks may be red before their implementation tasks; every phase checkpoint must be green. No gate depends on infrastructure assigned to a later phase.

| Critical dependency | Concrete prerequisite → consumer |
| --- | --- |
| Original assets before validation/registry/export | T002, T003, T004, T005 → T006, T025, T026, T047 |
| Catalog and room invariant before RPC | T009, T010, T012 → T017, T018 |
| Final RPC before canonical types | T017, T018 → T019, T020 |
| Generated types before typed client service | T020 → T023, T024 |
| Contract/service/registry/state before complete hook/card | T022, T024, T026, T028 → T030, T032, T035 |
| Candidate layer before room integration | T036 → T037, T038 |
| Screen and safe harness before F01 | T038, T039, T040, T041, T042, T043, T044, T045 → T046, T048 |
| Reachable registry before bundle inclusion proof | T038 → T047, T048 |
| Initial UI acceptance before remaining real-stack cases | T048 → T049, T050, T051, T052, T053, T054, T055, T056, T057, T058 |
| All acceptance before repeatability/fresh copy | T059, T060 → T061, T062, T063, T064 |

### User Story Dependencies and Checkpoints

| Story | Implementation path | Independent executable demonstration | Story checkpoint |
| --- | --- | --- | --- |
| US1 — Ready Room Receives a Shared Movie Candidate (P1) | Shared G1–G4; parser/service/registry/hook/card and room integration (T022, T024, T026, T030, T035, T038) | F01 starts with its own Waiting host and guest; F04 and F05 use their own unrelated/failure fixtures, with no dependency on another browser case's state | Core shared display at G6 (T048); full US1 including isolation/initial failure at G7 (T059, T060) |
| US2 — Shared Candidate Remains Stable (P1) | Shared authoritative RPC plus state/continuity/retry (T017, T028, T032, T035, T038); requires the working US1 acquisition/display foundation | F02 starts with a newly established Ready candidate, then independently exercises host/guest reload/reconnect; F03/F06/F07/F08 separately establish their required preconditions. F01 and F05 also prove repeats/concurrent recovery | Isolated continuity layer at G5 (T036); complete real-stack US2 at G7 (T059, T060); both stories repeatable at G8 (T064) |

US2's browser tests are independently runnable after the shared acquisition/display foundation exists; this does not imply its UI can be built before US1's prerequisites. Both stories are P1. G6 is a demonstrable core increment, not a substitute for US1's complete safety boundary or the remaining Feature 002 acceptance.

### Parallel Opportunities and Examples

Only T002, T003, T004, T005 carry `[P]`: after T001, each creates one distinct PNG and edits no shared file. Join all four at T006. No migration, generated artifact, fixture-dependent registry/test, package/lockfile edit, same-file task, or shared-stack E2E task is marked parallel.

```text
After T001:
  T002 → assets/candidates/cardboard-comet.png
  T003 → assets/candidates/pebble-bay-lanterns.png
  T004 → assets/candidates/cloud-tram-four.png
  T005 → assets/candidates/clockwork-orchard.png
Join at T006.
```

For US1, use the sequential client → integration → F01 path; there is no safe story-level parallel group in this breakdown. For US2, serialize state/hook/card changes and F02–F08 tasks because several edit the same file and browser gates share a mutable local stack. Test independence means fresh case-owned contexts, not authorization to run stack-mutating gates concurrently.

## R02 Admission and Browser Budget

| Case / block | Signup cap | Owning executable task(s) |
| --- | ---: | --- |
| Existing Feature 001 acceptance, 24 cases | 47 | Preserved by T042, T048, T060, T062, T063 |
| F01 | 2 | T046 |
| F02 | 2 | T052 |
| F03 | 2 | T053 |
| F04 | 4 | T054 |
| F05 | 2 | T055 |
| F06, two rooms in the same two contexts | 2 total | T051, T056 |
| F07 | 2 | T057 |
| F08 | 2 | T058 |
| Feature 002 additional, eight cases | 18 | T059 |
| Optional C1 + F01 development block | 3 | Additional run counted by T048 |
| Phase 6 C1 + existing + F01 | 50 = 1 + 47 + 2; acceptance N=49 | T048 |
| C1 + Feature 002 targeted | 19 = 1 + 18 | T059 |
| Complete acceptance, 32 cases | 65 = 47 + 18 | T060, T062, T063 |
| C1 + complete acceptance | 66 | T060 |
| C1 once + two complete runs | 131 = 1 + 65 + 65 | T062 |
| Fresh checkout: C1 + complete | 66 | T063 |
| Repeatability + fresh checkout | 197 > 150 | T062, T063: separately sufficient quota windows |

Before **every** browser block, establish remaining allowance from safe counts/timestamps, including earlier C1, targeted, failed and manual attempts and other local traffic sharing the IP. Keep `anonymous_users=150` in `supabase/config.toml`. Unknown or insufficient budget means postpone and wait **outside the application, tests and E2E wrapper**; one full signup-free hour after the last counted attempt is the conservative recovery boundary. Elapsed database cleanup/reset is not quota recovery. Do not probe Auth for quota, restart Supabase to evade the quota, raise the limit, add in-suite sleeps, or automatically retry HTTP 429. An actual 429 fails the run with the existing safe budget diagnosis and its attempt remains counted.

The phase-7 targeted and complete blocks together cost at most 85 before other usage. The 131 and 66 phase-8 blocks cannot both use one unrecovered allowance of 150. If C1 is deliberately repeated before the second complete repeatability run, reserve 132 instead of 131. Workers partition one invocation; an additional worker-profile invocation adds 65. Repeat-each=2 costs 130 before C1; repeat-each=3 costs 195 and does not fit. Defaults remain workers=1, repeatEach=1, retries=0.

## Coverage / Traceability

These matrices refer to executable implementation and test tasks, never documentation alone. A test-writing task supplies an executable assertion; its listed green gate runs it. G7 means **both** G7a (T059) and G7b (T060). G8 (T064) also requires the actual checks in T061, T062, T063. All stated 100% criteria require every applicable check to pass with no skipped case, conflicting display, or incomplete poster accepted as success.

### Functional Requirements — 21 / 21

| Requirement | Implementation tasks | Executable test tasks | Green checkpoint |
| --- | --- | --- | --- |
| FR-001 — Waiting has no candidate | T010, T017, T030, T038 | T007, T013, T029, T037, T046 | G2, G3, G5, G6 |
| FR-002 — Ready automatically receives one | T009, T010, T017, T030, T038 | T013, T016, T029, T046, T055 | G3, G6, G7 |
| FR-003 — At most one, immutable full candidate | T010, T017, T028, T032 | T007, T014, T016, T027, T031, T046, T057 | G3, G5, G7 |
| FR-004 — Only the supplied catalog | T009, T017, T026 | T007, T025, T046 | G2, G5, G6, G8 |
| FR-005 — Complete nonempty eligible fixtures | T002, T003, T004, T005, T009, T026 | T001, T007, T025, T047, T046 | G1, G2, G6 |
| FR-006 — Same identity on every successful access | T017, T028, T032 | T014, T016, T046, T052, T053, T055, T056, T057 | G3, G7 |
| FR-007 — Matching visible title | T022, T035, T038 | T021, T033, T037, T046 | G5, G6 |
| FR-008 — Matching visible release year | T022, T035, T038 | T021, T033, T037, T046 | G5, G6 |
| FR-009 — Matching visibly loaded poster | T026, T032, T035, T038 | T025, T033, T034, T046, T058, T047 | G5, G6, G7 |
| FR-010 — No internal ID as movie UI | T035, T038 | T033, T037, T046 | G5, G6 |
| FR-011 — Concurrent first access converges | T010, T017, T030, T032 | T015, T016, T029, T031, T046 | G3, G5, G6 |
| FR-012 — Sequential/overlapping repeats stay stable | T017, T028, T032 | T014, T016, T031, T046 | G3, G5, G6 |
| FR-013 — Host reload continuity | T017, T024, T032, T038 | T031, T052 | G5, G7 |
| FR-014 — Guest reload continuity | T017, T024, T032, T038 | T031, T052 | G5, G7 |
| FR-015 — Reconnect including Ready during absence | T017, T030, T032, T038 | T029, T031, T037, T052, T053 | G5, G7 |
| FR-016 — Authorized participants only | T009, T010, T017, T022, T024, T032 | T008, T013, T021, T023, T031, T054 | G2, G3, G7 |
| FR-017 — Atomic failure, preserved room and assignment | T017, T028, T032, T035, T038 | T014, T027, T031, T034, T055, T056, T057, T058 | G3, G5, G7 |
| FR-018 — Generic failure and explicit retry | T022, T024, T028, T030, T032, T035, T038 | T021, T023, T027, T031, T034, T055, T056, T057, T058 | G5, G7 |
| FR-019 — Retry never rotates an assignment | T017, T028, T032, T035 | T014, T016, T031, T034, T055, T056, T057, T058 | G3, G5, G7 |
| FR-020 — No initial manual choice or refresh | T017, T030, T038 | T029, T037, T046, T053 | G5, G6, G7 |
| FR-021 — Preserve Feature 001 membership/identity | T010, T017, T024, T032, T038 | T011, T014, T016, T037, T042, T046, T052, T053, T054, T055, T056, T057, T058 | G2, G3, G6, G7, G8 |

### Non-Functional Requirements — 3 / 3

| Requirement | Implementation tasks | Executable test tasks | Green checkpoint |
| --- | --- | --- | --- |
| NFR-001 — Reproducibility without external movies | T002, T003, T004, T005, T009, T026 | T001, T007, T025, T047, T046, T059, T060, T062, T063 | G1, G2, G6, G7, G8 |
| NFR-002 — No conflicting authoritative candidate | T010, T017, T028, T032, T035 | T016, T027, T031, T034, T046, T052, T053, T055, T056, T057, T058 | G3, G5, G7, G8 |
| NFR-003 — Isolation across all access/recovery variants | T009, T010, T017, T022, T024, T032 | T008, T013, T021, T023, T031, T054 | G2, G3, G7, G8 |

### Success Criteria — 8 / 8

| Criterion | Implementation tasks | Executable test tasks | Green checkpoint |
| --- | --- | --- | --- |
| SC-001 — All successful Ready flows converge automatically | T017, T030, T032, T035, T038 | T046, T052, T053, T054, T055, T056, T057, T058 | G6, G7, G8 |
| SC-002 — Complete matching visible data, no ID | T022, T026, T035, T038 | T001, T025, T033, T034, T047, T046, T058 | G1, G5, G6, G7 |
| SC-003 — All reload/reconnect/repeat flows stable | T017, T032, T038 | T014, T031, T046, T052, T053 | G3, G5, G7 |
| SC-004 — One assignment in every concurrent first/retry flow | T010, T017, T028, T032 | T015, T016, T031, T046, T055, T057 | G3, G6, G7 |
| SC-005 — Zero candidate throughout Waiting checks | T010, T017, T030, T038 | T007, T013, T029, T037, T046 | G2, G3, G5, G6 |
| SC-006 — Every failure/retry preserves room and any assignment | T017, T024, T028, T032, T035, T038 | T014, T023, T031, T034, T055, T056, T057, T058 | G3, G5, G7 |
| SC-007 — No private assignment disclosure | T009, T010, T017, T024, T032 | T008, T013, T023, T031, T054 | G2, G3, G7 |
| SC-008 — Full suite uses supplied fixtures, zero external movie traffic | T002, T003, T004, T005, T009, T026 | T001, T007, T025, T047, T046, T059, T060, T062, T063 | G1, G2, G6, G7, G8 |

### Product Acceptance Scenarios — 17 / 17

Scenario numbers are the unchanged numbered scenarios in `spec.md`.

| Scenario / story | Implementation tasks | Executable test tasks | Browser case | Green checkpoint |
| --- | --- | --- | --- | --- |
| 1 — US1 — Waiting absence | T010, T017, T030, T038 | T007, T013, T029, T037, T046 | F01 | G2, G3, G5, G6 |
| 2 — US1 — Automatic guest display | T017, T030, T035, T038 | T029, T033, T037, T046 | F01 | G5, G6 |
| 3 — US1 — Automatic host convergence | T017, T030, T038 | T029, T037, T046 | F01 | G5, G6 |
| 4 — US1 — Same full catalog data and visible poster | T009, T022, T026, T035, T038 | T007, T021, T025, T033, T047, T046 | F01 | G2, G5, G6 |
| 5 — US1 — Concurrent first acquisition | T010, T017, T030, T032 | T015, T016, T029, T046 | F01 | G3, G5, G6 |
| 6 — US1 — Isolation in every access/recovery variant | T009, T010, T017, T024, T032 | T008, T013, T023, T031, T054 | F04 | G2, G3, G7 |
| 7 — US1 — Pre-assignment failure | T017, T024, T028, T030, T035, T038 | T014, T023, T027, T055 | F05 | G3, G5, G7 |
| 8 — US1 — Eligible supplied catalog without movie services | T002, T003, T004, T005, T009, T026, T017 | T001, T007, T025, T047, T046 | F01 | G1, G2, G6 |
| 9 — US2 — Host reload | T017, T024, T032, T038 | T031, T052 | F02 | G5, G7 |
| 10 — US2 — Guest reload | T017, T024, T032, T038 | T031, T052 | F02 | G5, G7 |
| 11 — US2 — Separate host and guest reconnect | T017, T032, T038 | T031, T037, T052 | F02 | G5, G7 |
| 12 — US2 — Sequential and overlapping repeat reads | T017, T028, T032 | T014, T016, T031, T046 | F01 | G3, G5, G6 |
| 13 — US2 — Concurrent retry from Ready/NULL | T017, T028, T030, T032, T035 | T016, T031, T055 | F05 | G3, G5, G7 |
| 14 — US2 — Other participant already sees candidate, both directions | T017, T028, T032, T035, T038 | T014, T031, T056 | F06 | G3, G5, G7 |
| 15 — US2 — Host returns after Waiting became Ready | T017, T030, T032, T038 | T029, T031, T037, T053 | F03 | G5, G7 |
| 16 — US2 — Committed assignment unseen by either participant | T017, T024, T028, T032, T035 | T014, T023, T031, T057 | F07 | G3, G5, G7 |
| 17 — US2 — Poster failure and same-source recovery | T026, T028, T032, T035, T038 | T025, T031, T034, T058 | F08 | G5, G7 |

### Feature 002 Browser Cases — 8 / 8

| Case | Executable case task | Product scenarios | Test prerequisites | Execution checkpoint |
| --- | --- | --- | --- | --- |
| F01 | T046 | 1, 2, 3, 4, 5, 8, 12 | T038, T040, T041, T042, T044, T045 | G6, G7, G8 |
| F02 | T052 | 9, 10, 11 | T041, T045, T049 | G7, G8 |
| F03 | T053 | 15 | T041, T045, T049 | G7, G8 |
| F04 | T054 | 6 | T013, T041, T045, T049 | G7, G8 |
| F05 | T055 | 7, 13 | T045, T049, T050 | G7, G8 |
| F06 | T056 | 14 | T045, T049, T050, T051 | G7, G8 |
| F07 | T057 | 16 | T016, T045, T049, T050 | G7, G8 |
| F08 | T058 | 17 | T034, T045, T047, T049, T050 | G7, G8 |

### Cross-Cutting Controls

| Control | Implementation / accounting tasks | Executable evidence and gates |
| --- | --- | --- |
| C1 — credential-safe diagnostics throughout E2E | T040, T041, T042, T044, T045, T049, T050, T051; every F01–F08 case uses the existing safe context/reporter/scanner | T039, T043; C1 before ordinary acceptance and finalized scans in T048, T059, T060, T062, T063; poster recovery T058 cannot bypass them |
| R01 — one intentional canonical type update, normal check only | T019; preserve `scripts/database-types.mjs` | T020, T036, T048, T059, T060, T061, T062, T063; check-only hash stability after clean reset, plus existing `__tests__/config/database-types.test.ts` |
| R02 — explicit per-case/per-block budget and outside-harness admission | T041, T044, T045, T049, T050, T051; caps in T046, T052, T053, T054, T055, T056, T057, T058; 131 and 66 admitted separately | Signup observers/caps and zero recovery signups at T048, T059, T060, T062, T063; unchanged 150 limit and no automatic 429 retry |
| Existing one-channel Realtime / no polling | T030, T032, T038 consume the existing authoritative room projection | T029, T031, T037, T042, T046, T052, T053 at G5–G8 |
| No external movie resource or second candidate flow | T002, T003, T004, T005, T009, T017, T026, T035, T038 | Source/schema/registry tests, T047, local-traffic assertions shared by all F cases, and T059, T060, T062, T063 |

## Implementation Strategy

Complete G1–G4 in order to establish reproducible assets, the database authority and canonical types. Build the tested candidate layer at G5, then demonstrate US1's initial shared display at G6. Complete both story contracts at G7, with the PostgreSQL concurrency proof already green before client work. Finish with separately budgeted repeatability and fresh-checkout evidence at G8. Stop progression at any failed checkpoint and correct that phase's failure before advancing; a documentation entry never substitutes for the command/test result.

Use the existing `package.json` commands and the precise cleanup/validation sequences in `specs/002-first-movie-candidate/quickstart.md`. The only additional packaging inspection is the dependency-free command supplied and executed by T047; reuse it after exports at later gates. The phase-2 version-limited migration trial is a scoped upgrade check, not the normal validation path. Phases 2–3 deliberately defer canonical types to phase 4; subsequent database-dependent gates use `db:types:check` without preceding write generation.

Future implementation evidence in the Feature 002 quickstart records the versionable checkout/copy identity, command exits, case counts, safe signup totals, all-four bundle inclusion, both repeatability runs, fresh-copy result, finalized artifact scans and cleanup. Preserve Feature 001 specification/planning artifacts. No commit, push, Issues, deployment, or additional Spec Kit workflow is part of these tasks.

## Task Inventory and Review State

| Phase | Task IDs | Count |
| --- | --- | ---: |
| 1 | T001–T006 | 6 |
| 2 | T007–T012 | 6 |
| 3 | T013–T018 | 6 |
| 4 | T019–T020 | 2 |
| 5 | T021–T036 | 16 |
| 6 | T037–T048 | 12 |
| 7 | T049–T060 | 12 |
| 8 | T061–T064 | 4 |
| Total | T001–T064 | 64 |

Primary ownership: **38 shared**, **16 US1**, **10 US2**. Parallel markers: **4**, one distinct-asset group **T002–T005**. Coverage: **21 FR, 3 NFR, 8 success criteria, 17 product scenarios, 2 stories, 8 browser cases, C1/R01/R02**. All requirements have executable evidence and a green checkpoint.

No unresolved product or technical decision remains. Runtime implementation and every runtime pass are still pending; all 64 checkboxes intentionally remain unchecked for review. Generating this file does not execute the tasks or any follow-on workflow.

## Independent Task Review — 2026-09-09

**Verdict: READY FOR ANALYZE after corrections.** Findings identified: BLOCKING 0, MAJOR 0, MINOR 2; both corrected in this file. Unresolved upstream conflicts: none. This is document and mechanism review, not execution of Feature 002 acceptance or a Spec Kit workflow.

### Findings and Corrections

| ID | Severity | Finding in the pre-review task text | Correction |
| --- | --- | --- | --- |
| TR1 | MINOR | T057 required an owner-visible committed assignment but placed the explicit database evidence after aborting browser delivery. The existing owner snapshot also returned only the old room row, while later tasks needed committed row/xmin evidence. The review requires commit independently confirmed before delivery loss. | T042 explicitly supplies the committed row/xmin test oracle; T050 and T057 hold both browser routes until both real responses and that independent committed-FK observation agree, then abort delivery. A failed barrier is failed evidence. This strengthens the approved route.fetch design without changing the RPC or planning contracts. |
| TR2 | MINOR | F02/T052 required stable assignment and no extra UPDATE, which alone cannot detect redundant idempotent candidate RPCs during reconnect. Its browser assertions did not explicitly enforce the approved acquisition frequency. | T045 supplies per-participant counters and separates intentional direct probes; T052 requires one acquisition initially, one additional call per reload, and zero calls caused by reconnect or equivalent Ready refetch. T045 also identifies both distinct authenticated callers before releasing the initial barrier. |

### Independent Feasibility Evidence

All ten required input documents were read completely in this review. Existing code was inspected only for paths, harness behavior, dependency boundaries and installed transport/asset mechanisms.

- **F01**: existing held-request helpers in `e2e/room-session.spec.ts` support a bounded two-participant barrier before forwarding. T041–T046 extend them before G6. Database overlap and absence of a second UPDATE are separately proven by T015–T016, not inferred from browser request timing.
- **F02/F03**: the existing `realtimeBarrier` closes both real socket paths, rejects replacements while paused, and observes actual system-ok plus authoritative refetch. Existing Auth recovery preserves the context's identity. T052 adds explicit request-frequency assertions; T053 covers the host who last observed Waiting.
- **F04**: existing `ownRooms`/`ownParticipant` conventions use real participant sessions. Foreign/absent candidate RPC comparisons must use each caller's own authenticated context, never an owner or service-role caller. The owner snapshot is only a postcondition oracle. Two rooms use exactly four identities.
- **F05**: the existing pre-acceptance fault intercepts the request and calls `route.abort` without `route.fetch` or `route.continue`. T055 applies this to both first candidate calls and verifies Ready/NULL before real concurrent retries, so it cannot silently become a post-commit trial.
- **F06**: one participant already sees the assignment while the other fails; two role-reversed fresh-room trials reuse the same two identities through T051. This differs from F05's unassigned room and F07's assignment unseen by both.
- **F07**: the installed Playwright implementation in `node_modules/playwright-core/lib/coreBundle.js` separates `Route.fetch` (API request context forwarding) from browser route completion through abort/continue/fulfill. The existing room harness already uses bounded real forwarding followed by loss of delivery. T042/T050/T057 add the explicit owner-confirmed commit barrier before abort and preserve the snapshot through retry; no reliance on abort alone or an HTTP status as the sole commit oracle.
- **F08**: inspected installed `node_modules/@expo/metro-config/build/transform-worker/asset-transformer.js` and `getAssets.js`, static-web `app.json`, and the absence of a custom Metro override. A read-only in-memory transform of the existing 188-byte `node_modules/expo-router/assets/forward.png` produced a local file URI for web development, a hashed file URI for export, and native asset registration; neither web result was a data/blob URI. Installed RN Web Image/ImageLoader code uses the URI in a real image load and paints the visible wrapper separately from its hidden accessibility img. Thus T058's exact local-request fault/remount/load assertions are feasible. This creates no PNG and does not prove the four future fixtures or browser acceptance have already passed.

The review brief's F03/F04 headings differ from the binding plan/research/quickstart numbering. Preserve the approved map: F03 = Waiting-disconnect recovery; F04 = unrelated-room isolation; concurrent first acquisition belongs to F01. All requested behaviors remain covered, with the approved 2/2/2/4/2/2/2/2 allocation.

### Constitution Review

| Principle | Result at task-review stage |
| --- | --- |
| I — Working behavior as evidence | PASS: each green gate requires actual commands/assertions and a recorded result; no runtime pass is claimed by this review. |
| II — Small verifiable slices | PASS: eight ordered, bounded phase checkpoints; G6 has every prerequisite for its first real candidate flow. |
| III — Artifact consistency | PASS: exact fixture/schema/RPC/display boundaries and all requirement/scenario maps agree with upstream documents; corrections are confined to tasks. |
| IV — Authoritative state transitions | PASS: PostgreSQL row lock, one room FK, strict member RPC, separate failure classes and no-write retry/concurrency evidence. |
| V — Security and least privilege | PASS: denied catalog/assignment access, hardened exact RPC ACL, real participant isolation tests, and unchanged C1 capture/scanner boundaries. |
| VI — Reproducibility/schema evolution | PASS: versioned migrations, exact local fixtures, R01 byte comparison without a Git-index gate, and quota-aware repeatability/fresh-copy commands. |
| VII — Executable acceptance evidence | PASS: real pgTAP session race, real-stack F01–F08, actual poster loading, explicit F07 commit oracle and F02 RPC-count evidence; unit tests do not stand in for recovery acceptance. |
| VIII — Explicit scope/simplicity | PASS: one catalog, one room column, one RPC and the existing Realtime channel; no future movie interactions or provider dependency. |

### Review Validation

Task count remains 64 because the two corrections clarify existing review units; no new feature or separate implementation unit is required. Phase counts remain 6/6/6/2/16/12/12/4; primary labels remain 38 shared, 16 US1, 10 US2. All IDs are sequential and all checkboxes unchecked. Only T002–T005 are parallel, each owning a distinct PNG with no shared registry/configuration edit.

Coverage was recomputed from the actual task and upstream rows: 21 FR, 3 NFR, 8 SC, 17 acceptance scenarios, both stories, F01–F08 and C1/R01/R02. Each scenario maps to implementation, executable assertions and a running checkpoint. US2 is complete only at real-stack G7, followed by G8 repeatability.

The existing `anonymousBudget` allocations in `e2e/room-session.spec.ts` sum to 47; the eight independent candidate cases add 18. Complete acceptance costs 65, C1 + complete 66, C1 once + two complete 131, and repeatability + fresh copy 197 > 150. The task admission rules require separately sufficient allowance and outside-harness waiting; no reset/restart/limit increase or automatic 429 retry is quota recovery.

Validation is limited to document structure, coverage/dependencies, local source/mechanism inspection, scoped diff and whitespace checks. No application implementation, migration execution, service startup, dependency installation, browser acceptance, branch change, commit, push or Spec Kit workflow is performed by this review.
