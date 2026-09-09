# Implementation Plan: Show the First Shared Movie Candidate

**Branch**: `main` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)
**Feature directory**: `specs/002-first-movie-candidate`
**Input**: Reviewed Feature 002 specification and the user's binding technical architecture.
**Status**: Planning complete; implementation has not started.

## Summary

Add the first movie display to the existing two-person room. Waiting has no
assignment or candidate UI. Each accepted participant automatically calls one
idempotent RPC when their authoritative room becomes Ready. PostgreSQL assigns
the lowest-sort fixture once under a room-row lock and returns its metadata.
The client resolves its poster key through a static registry of four bundled
PNGs. Repeated access, reload, reconnect, response loss, and poster retry preserve
the same assignment.

The only new application table is `public.movie_candidates`. The only new room
field is nullable `movie_candidate_id`. The only new public application RPC is
`public.ensure_room_candidate(p_room_id uuid)`. Existing room RPCs, identity
semantics, room read grants, and Realtime lifecycle remain intact.

## Technical Context

| Item | Selected context |
| --- | --- |
| Language/runtime | Strict TypeScript `~6.0.3`; Node `24.20.x` (existing pinned baseline `24.20.0`); npm `11.19.0`; committed package-lock |
| Application | Expo `57.0.20`, Expo Router `~57.0.19`, React/React DOM `19.2.3`, React Native `0.86.3`, locked React Native Web `0.21.2` |
| Images | Existing React Native `Image`; static `require` registry; no expo-image package or asset plugin added |
| Backend | Project Supabase CLI `2.116.0`, supabase-js `2.115.0`, PostgreSQL 17, existing Anonymous Auth and RLS |
| Storage | Existing rooms plus one five-field fixture catalog; local PNGs in the application bundle |
| State | Focused React hooks and pure state mapping; no additional state framework |
| Testing | Existing Jest 29/jest-expo/React Native Testing Library, pgTAP plus real dblink sessions, Playwright `1.63.0` |
| Browser runtime | Existing managed runtime, including `mcr.microsoft.com/playwright:v1.63.0-noble` and loopback forwarding; no replacement launcher |
| Platforms | Existing web/iOS/Android source compatibility; real web is the acceptance target, as in Feature 001 |
| Performance goals | No new latency or throughput requirement; deterministic serialization and eventual automatic display under the spec's recovery conditions |
| Scope | Four catalog records/PNGs, one nullable FK, one new RPC, one existing room screen, eight new browser cases covering all 17 scenarios |
| Public configuration | Existing two public Supabase variables only; no movie-provider credential or external movie/image traffic |

Version facts come from current package metadata/lockfile and committed
infrastructure; this plan does not upgrade the stack.

## Scope Boundary and Existing Dependencies

Reuse `src/auth/anonymous-session.ts`, `src/lib/supabase.ts`, the accepted room
model, `src/rooms/use-room-subscription.ts`, and `app/room/[code].tsx`.
The host learns Ready through the existing channel's authoritative refetch; the
guest learns it directly from `join_room`. Both then acquire the candidate.

Read integration boundaries:
[Feature 001 plan](../001-room-session/plan.md),
[data model](../001-room-session/data-model.md),
[RPC](../001-room-session/contracts/rpc.md),
[Realtime](../001-room-session/contracts/realtime.md), and
[routes](../001-room-session/contracts/client-routes.md).
Those completed-slice artifacts are not rewritten. This feature extends behavior
after their Ready boundary and adds a new accepted `updated_at` mutation for
candidate assignment; it does not change membership behavior.

Exclude external movie services, catalog browsing, another candidate, progression,
voting, matching, preferences, recommendations, extra metadata, custom backends,
Edge Functions, Storage, another channel, polling, and deployment work.

## Constitution Check — Before Design

**Result: PASS at planning level.** The reviewed input has 2 P1 stories, 17
acceptance scenarios, 21 FR, 3 NFR, 8 SC, and no unresolved product decision.

| Principle | Gate assessment |
| --- | --- |
| I — Working evidence | Define executable acceptance and fresh-checkout gates; document creation is not runtime evidence. |
| II — Small slices | One first-candidate result, implemented through bounded green checkpoints below. |
| III — Consistency | Spec remains authoritative; design and validation map to all scenarios without changing Feature 001 contracts. |
| IV — Authority | PostgreSQL owns assignment; locked, authenticated RPC defines concurrency, duplicate access, rollback, and response-loss recovery. |
| V — Security | Preserve existing RLS/grants and C1; expose catalog metadata only through member-authorized RPC. |
| VI — Reproducibility | Two versioned migrations, fixed catalog/assets, locked dependencies, and preserved R01 reset/generate/check workflow. |
| VII — Acceptance evidence | Real database-session race plus real authenticated browsers, with controlled transport faults rather than mocked success. |
| VIII — Scope | One catalog table, one room field, one RPC; no speculative architecture or future interactions. |

## Architecture and Data Flow

1. Existing Auth/room recovery supplies an accepted room with its immutable ID.
2. Waiting causes no candidate RPC, no image load, and no candidate card.
3. Ready triggers the candidate hook once for its room/attempt. It awaits the
   existing Auth bootstrap and calls `ensure_room_candidate`.
4. The function authenticates, locks that room, checks membership and readiness,
   returns an existing assignment or writes the minimum-sort fixture once.
5. A strict parser validates the one-row five-field response. An available
   candidate becomes the room-local immutable metadata anchor before image load.
6. The poster registry resolves the returned key to a literal bundled source.
   Only image `onLoad` completes the successful card; errors preserve the anchor.
7. An assignment UPDATE may cause the existing channel to refetch `id, code,
   state`. The resulting Ready projection does not restart successful candidate
   acquisition or create another channel.
8. Reload recovers the room and calls the same RPC. A channel reconnect preserves
   an already displayed candidate; candidate errors have explicit safe retry.

See [RPC contract](contracts/candidate-rpc.md) and
[display contract](contracts/candidate-display.md) for exact behavior.

## Catalog, Assets, and Migration Strategy

The exact four synthetic rows are fixed in [data-model.md](data-model.md) and
[research.md](research.md). The first fixture is `fixture-cardboard-comet`.
Selection by the smallest unique `sort_order` is temporary fixture machinery,
not a recommendation rule. Different rooms intentionally select the same movie.

Future implementation creates four original geometric PNGs, 240×360 pixels,
each at most 64 KiB, in `assets/candidates/`. They contain no third-party artwork
or external references. Each key maps one-to-one to a literal static require
in `src/candidates/posters.ts`; dynamic require paths are forbidden.

The pinned Expo Metro PNG transformer emits a file URI on web (including
export), not a size-based data URI. F08 must observe that actual app-origin
request. Export inclusion of all four files is a phase 6 gate, after the room
screen makes the registry reachable from the application entry graph.

Apply, in order:

1. `supabase/migrations/20260909000000_movie_candidates_schema.sql`: create the
   catalog and constraints, revoke direct client access, enable RLS, insert the
   exact four rows, append the nullable room FK and named Waiting constraint.
2. `supabase/migrations/20260909000001_room_candidate_rpc.sql`: create the one
   hardened RPC, fix its owner and exact-signature ACL in the same transaction.

Both changes reproduce through `npm run db:reset`; no Dashboard SQL, extra seed
command, snapshot columns, join table, new publication, or maintenance RPC.
Preserve rooms' SELECT grant of `id, code, state` only. Do not grant access to
`movie_candidate_id` or publish the catalog.

## Client Structure and UI

| Planned path | Responsibility |
| --- | --- |
| `src/candidates/contracts.ts` | Generated-type integration plus strict runtime validation and closed outcome union |
| `src/candidates/service.ts` | Existing Auth bootstrap/client, one RPC transport, safe errors, no direct table reads |
| `src/candidates/posters.ts` | Exactly four static image-source mappings; unknown key fails safely |
| `src/candidates/state.ts` | Pure loading/available/recoverable-error mapping and immutable-candidate checks |
| `src/candidates/use-room-candidate.ts` | Waiting/Ready trigger, per-room single-flight, generations, explicit acquisition/poster retries |
| `src/candidates/candidate-card.tsx` | Minimal poster/title/year presentation, image callbacks, generic recovery control |
| `app/room/[code].tsx` | Add candidate hook/card inside the existing accepted-room screen |

The canonical-code keyed route remains the lifetime boundary. Effect replay
reuses the same in-flight promise; callbacks also check room ID, attempt, and
generation. Depend on stable room ID/state, not a freshly allocated refetch
object. Stale results never appear during render or after navigation.

Candidate and synchronization errors remain separate. Preserve existing Ready
information and its synchronization retry. Candidate retry neither joins again
nor bootstraps a replacement identity. No internal candidate ID is shown.

## R01 — Generated Types

The new table, FK relationship, column, and RPC require an intentional canonical
update after both migrations are finalized:

`npm run db:reset` → `npm run db:types` →
`npm run db:types:check`.

During implementation, review and commit `src/types/database.generated.ts`
with the schema/RPC change. Normal phase checks and fresh checkout use reset →
`db:types:check` only. Do not alter generator semantics, hand-edit its output,
or regenerate just before a normal drift check. Runtime parsing remains
necessary because generated RPC output types do not encode logical nullability.

## Existing Test and C1 Integration

Current exact-shape assumptions must be adapted during implementation:

- `supabase/tests/database/room_session.test.sql` expects one public application
  table, eight room columns, and old constraint/FK sets. Extend those assertions
  for the catalog and nullable FK while retaining membership/security checks.
- `e2e/room-session.spec.ts` validates the full owner-visible rooms row.
  Add the field to its checked shape. E06's single UPDATE expectation must
  distinguish the one membership transition from the additional assignment
  UPDATE. Preserve membership projections; compare full rows only after candidate
  acquisition settles. Candidate tests independently prove the single assignment.
- `playwright.config.ts` must explicitly include
  `first-movie-candidate.spec.ts` alongside the existing acceptance file.
- Add only fixed F01–F08 names/locations to the existing safe reporter/diagnostic
  allowlists, and update combined budget labels to N=65. Preserve all existing
  C1 capture restrictions and finalized artifact scanning.
- Existing `assertNoCredentialUi()` rejects all images, and `assertReady()`
  calls it. Add a separately named, bounded text/attribute credential inspection
  for ordinary image-bearing UI checks, reusing the current forbidden-value
  checks. Keep the original strict screenshot inspection unchanged, including
  its image/background/SVG ban. A poster never authorizes an application
  screenshot. The C-probe still captures only its controlled static surface.
- Reuse existing safe room/browser/transport helpers. Extract only genuinely
  shared helpers to `e2e/support/room-harness.ts` if needed by the new test file;
  preserve their signup caps, cleanup, memory-only credential registry, and
  errors. A reused authenticated context needs a create-with-existing-session
  helper for F06; calling the fresh-signup helper would break its budget.

No trace, HAR, video, storage-state export, raw Auth/Realtime/request dump, broad
diagnostic allowlist, or artifact-scanner exception is allowed.

## Testing Strategy

- **Database:** catalog shape/exact rows/completeness; FK and Waiting constraint;
  table/column grants; owner/definer/search-path/EXECUTE checks; signed-out and
  missing-subject denial; own Waiting; absent/unrelated Waiting/unrelated Ready
  equality; first assignment; no-write repeats; rollback, empty catalog, and
  independent-session concurrency with real blockers and one-write evidence.
- **Client:** all outcome/nullability/shape branches, malformed data, registry
  coverage and unknown key, zero Waiting requests, automatic Ready, replay
  single-flight, stale room/generation, immutable metadata, safe acquisition and
  poster retry, image success/error, and reconnect preservation.
- **Browser:** eight real-stack cases F01–F08 cover all 17 scenarios; each checks
  its signup cap and zero recovery signups. Synchronize actual outgoing RPCs;
  separately prove the database serialization boundary. Monitor local movie/image
  traffic in memory.
- **Poster evidence:** visible RN Web image wrapper with nonzero rendered bounds,
  loaded same-origin PNG, positive decoded dimensions, matching painted background
  source, and success only after onLoad. Its hidden accessibility img is
  insufficient by itself. Check all four PNGs and static registry; web export
  must retain all four assets. Web success does not claim native runtime execution.

[quickstart.md](quickstart.md) contains the complete scenario map and commands.

## R02 — Auth Budget

Eight independent new cases consume at most **18** signup attempts/identities.
Existing 47 + new 18 = **N=65** per complete acceptance run. C1 costs one separate
identity: C1 + one complete run = **66**; C1 once + two complete runs = **131**.

Keep local `anonymous_users=150`. Three full runs cost 195 and are not covered
by the former Feature 001 three-run allowance. The two-run block and fresh-checkout
block cost 197 together and require separately sufficient recovered hourly
allowance. Count prior targeted, failed, security, and manual signups; reset and
restart are not quota recovery. If allowance is insufficient or prior usage is
unknown, wait outside the test harness before admitting the next block; do not
add Auth probes or in-suite sleeps/retries. Full recovery can be scheduled after
one signup-free hour from the last counted attempt. Full derivation is in
[research.md](research.md#r02--binding-identity-budget).

## Implementation Phases and Green Checkpoints

These are phase boundaries, not a generated task list. Complete each applicable
checkpoint before starting the next phase; any failed required check blocks it.

| Phase | Bounded deliverable | Green evidence |
| --- | --- | --- |
| 1 — Fixture/poster baseline | Four exact fixture definitions and four original PNGs; no second runtime catalog | File dimensions/signature/distinct-content/key completeness checks; existing lint/typecheck/client baseline remains green |
| 2 — Schema and versioned data | First migration, exact rows, FK, Waiting constraint, denied catalog access; additive legacy schema-test updates | Clean db:reset and schema/ACL pgTAP; existing room operations still pass |
| 3 — RPC and database safety | Second migration, security and transactional behavior, real concurrent-session tests | Clean reset and full db:test including overlap, one-write, rollback, and disclosure evidence |
| 4 — Canonical generated types | Intentional R01 update for finalized public schema | db:types then db:types:check, reviewed generated artifact, lint/typecheck/client tests |
| 5 — Candidate client layer | Parser/service/state/static registry/hook/card behavior | Focused client coverage plus complete client suite, typecheck, db:types:check; existing application web export still builds; source/registry checks cover all four PNGs |
| 6 — Room integration and first real acceptance | Screen integration makes the registry reachable; implement F01, its request barrier/shared helpers, explicit test discovery and fixed C1 labels; adapt existing row/UPDATE/UI assertions now | All-four asset inclusion in web export; lint/typecheck/client/type checks; C1 plus all 25 currently implemented acceptance cases including F01 (N=49, reserve 50); clean artifact scan |
| 7 — Complete acceptance | Add F02–F08 and their bounded fault/recovery helpers and labels; update combined budget from N=49 to N=65 | C1 + targeted feature cases reserve 19; C1 + complete 32-case suite reserve 66; all assertions and artifact scans pass |
| 8 — Repeatability/fresh checkout | Two-run same-stack proof plus independent fresh versioned checkout | Reserve 131 and 66 in separately budgeted blocks; full command chain, cleanup, no external movie dependency |

Phases 2–3 intentionally precede the finalized generated artifact in phase 4:
their schema-only/RPC gates do not claim canonical type consistency yet.
After phase 4 every database-dependent checkpoint includes non-mutating
`db:types:check`. No failed type check is relabeled as a pass.

Phase 5 does not claim that an unimported candidate registry is already in the
application export. Phase 6 owns every prerequisite of F01 and compatibility
with existing acceptance; it cannot defer discovery, C1 support, or row/UPDATE
assertions to phase 7. Its optional targeted C1 + F01 development run costs 3
additional signups if executed separately from the required 50-signup block.
Only after phase 7 should discovery expect eight candidate cases/32 total cases.

## Fresh-Checkout Path

Future versioned implementation checkout → npm ci → local Supabase → env:local →
db:reset → db:types:check → lint → typecheck → client tests → pgTAP → web export →
existing browser-runtime preparation → C1 → full E2E → shutdown.
Use guaranteed cleanup and the precise commands in [quickstart.md](quickstart.md).
Network used by npm/Docker setup is distinct from movie traffic during acceptance.

## Project Structure

### Documentation (this feature)

```text
specs/002-first-movie-candidate/
├── spec.md                         # existing reviewed input
├── checklists/requirements.md      # existing reviewed input
├── plan.md
├── research.md
├── data-model.md
├── contracts/candidate-rpc.md
├── contracts/candidate-display.md
└── quickstart.md
```

### Planned Source/Test Changes

```text
assets/candidates/                  # four PNGs
src/candidates/                     # six focused modules listed above
app/room/[code].tsx                 # existing screen integration
src/types/database.generated.ts    # intentional generated update
supabase/migrations/20260909000000_movie_candidates_schema.sql
supabase/migrations/20260909000001_room_candidate_rpc.sql
supabase/tests/database/room_candidate.test.sql
supabase/tests/database/room_session.test.sql  # additive compatibility assertions
__tests__/candidates/               # parser/service/state/hook/poster/card tests
__tests__/routes/room.test.tsx       # existing route regression coverage
e2e/first-movie-candidate.spec.ts    # F01–F08
e2e/room-session.spec.ts            # preserved membership regressions
e2e/support/                       # existing C1 helpers; narrowly shared room helpers
playwright.config.ts               # explicit additional acceptance file
scripts/run-e2e.mjs                 # safe labels and combined budget text
```

These are future implementation paths, not files created by this planning turn.

## Constitution Check — After Design

**Result: PASS at planning level; no exception.** All eight initial gates remain
satisfied. The final design gives I/VII concrete database, client, browser, and
fresh-checkout evidence; II/VIII remain one bounded feature; III has six consistent
planning documents with scenario coverage; IV has row-lock and retry contracts;
V preserves privilege and C1 boundaries; VI preserves migration/R01/R02 workflows.
Schema-specific existing test expectations are explicitly accounted for rather
than silently weakening Feature 001 evidence.

## Complexity Tracking

No constitutional violation or complexity exception. Rejected alternatives and
their simpler replacements are recorded in [research.md](research.md).

## Planning-Only Declaration and Validation

No implementation, asset creation, migration execution, dependency installation,
database-type update, Supabase startup, application test run, commit, or push
occurred. Existing Feature 001 artifacts, application files, reviewed Feature 002
inputs, and active-feature metadata are preserved.

Planning validation checks document links, exact fixture consistency, all 17
scenario mappings, the N=65/131 arithmetic, required invariants, absence of
unresolved placeholders, and whitespace (including untracked files).
Pre/post planning hook configuration is absent, so no extension hook is dispatched.
The setup helper's BRANCH value is the feature-directory label
`002-first-movie-candidate`; the actual Git branch remains `main`.

## Independent Technical Review — 2026-09-09

**Verdict: READY FOR TASKS after corrections.** Findings identified: BLOCKING 0,
MAJOR 1, MINOR 1. All are resolved; no product decision or constitutional
exception is required. This review does not start another Spec Kit workflow.

| ID | Severity | Finding in the pre-review plan | Correction |
| --- | --- | --- | --- |
| PR1 | MAJOR | Phase 5 required all-four application export inclusion before phase 6 imported the candidate layer; phase 6 required F01 while discovery/harness updates were deferred to phase 7. | Move export-inclusion proof and all F01/legacy C1 prerequisites into phase 6; require its 25-case regression gate (N=49, C1 total 50). Phase 7 adds the remaining seven cases and reaches N=65. |
| PR2 | MINOR | The correct 197-signup aggregate required recovered allowance but did not explicitly restate where/how to wait when usage was unknown or insufficient. | Carry forward Feature 001's outside-harness wait/admission and HTTP 429 failure rules in plan/research/quickstart; keep the 150 limit. |

The review also verified the current Expo PNG transform in memory, made F08's
HTTP-asset precondition explicit, and recorded per-case fresh-context counts.
The catalog/data model and RPC contract required no change. Non-disclosure is
the identical authorized business response/field shape; no constant-time claim
is made for nonexistent versus locked unrelated rows.

Validation: all six planning files reread; cross-artifact concern/outcome/scenario
matrices checked; exact four fixtures, 17 scenarios, R01 and R02 verified;
document links and shell-block syntax checked; no unfinished placeholders;
git diff --check and untracked-file whitespace checks passed. A scoped unified
diff against in-memory pre-review copies shows the four changed planning files.
All 104 protected pre-existing files remain byte-identical, including Feature
001 and Feature 002 spec/checklist. Git branch/HEAD remain unchanged.

Only plan.md, research.md, contracts/candidate-display.md, and quickstart.md were
edited by this review. No application build/test, Supabase startup, implementation,
asset creation, task generation, branch change, commit, or push occurred. The
transformer inspection is mechanism evidence only, not Feature 002 acceptance.
