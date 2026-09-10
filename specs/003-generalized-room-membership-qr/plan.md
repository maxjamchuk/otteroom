# Implementation Plan: Generalized Room Membership & QR Join

**Branch**: `main` (feature directory label `003-generalized-room-membership-qr`)
**Date**: 2026-09-10 | **Spec**: [spec.md](spec.md)
**Input**: Reviewed specification/checklist and binding planning request.
**Status**: Planning complete; no Feature 003 implementation performed.

## Summary

Replace the fixed host/guest authority with normalized room membership and a
configured voter target. Every creator is a member; their independent voting
flag contributes one or zero slots. PostgreSQL serializes admission on the room
row, maintains the voter count atomically and derives Waiting/Ready from count
versus target. Existing members recover before full-room rejection is considered.

QR displays the existing invitation target through a small native/web SVG
component. Existing Anonymous Auth, code/link routes, a single rooms Realtime
invalidation channel and the shared fixture candidate remain. The database,
public RPCs, generated types and consuming client cut over together; there is
no green checkpoint with incompatible contracts or dual membership authority.

## Technical Context

| Item | Exact selected context |
| --- | --- |
| Language/runtime | Strict TypeScript ~6.0.3; Node 24.20.0 / engines 24.20.x; npm 11.19.0 |
| App | Expo 57.0.20, Router 57.0.19, React/React DOM 19.2.3, RN 0.86.3, locked RN Web 0.21.2, Linking 57.0.9 |
| Backend | Existing Supabase JS 2.115.0, CLI 2.116.0, local PostgreSQL 17, Anonymous Auth, PostgREST/RLS and existing pinned Realtime infrastructure |
| Storage | rooms + new room_members + unchanged movie_candidates; no external movie source or custom backend |
| QR additions | react-native-qrcode-svg 6.3.24; Expo-selected react-native-svg 15.15.4; test-only jsqr 1.4.0 |
| Client state | Existing focused React state/hooks; no state, form or numeric-control dependency |
| Tests | Existing Jest 29/jest-expo/RNTL 13.3.3, pgTAP/dblink, Playwright 1.63.0, safe managed Docker runtime |
| Platform | Shared mobile-first iOS/Android/web source; real local web acceptance, native bundle checks; no TV or scanner |
| Performance | No invented latency/throughput SLA; automatic convergence with valid connectivity and deterministic capacity under contention |
| Constraints | Target whole integer >=2, product default2, explicit creator choice without default; fixed configuration/members after assembly; least privilege; no polling |
| Scope | Two existing routes, one new relation, one private boolean helper, three public application RPCs (two evolved, one preserved interface), nine new grouped browser cases |
| Public config | Existing two Expo public Supabase variables only; no new token, provider credential or environment contract |

Version evidence is the actual package/lockfile, installed Expo native manifest
and primary sources recorded in [research.md](research.md). Compatibility is a
planning conclusion, not a claim of successful installation or runtime checks.

## Current Host/Guest Impact Inventory — Verified before Design Selection

All entries were traced in current source, not assumed from the prompt. Historical
artifacts/migrations remain unchanged; the future cutover overrides runtime
contracts explicitly through Feature 003 artifacts and new versioned migration.

| Current path / boundary | Current dependency | Required deliberate evolution |
| --- | --- | --- |
| supabase/migrations/20260905000000_rooms_schema.sql | host/guest columns, guest-derived generated state, host-request unique key, distinct seats/FKs/guest index, member policy, SELECT(id,code,state) | New migration renames creator, materializes members/count, changes expression/policy/grants, removes guest dependencies |
| supabase/migrations/20260905000001_room_rpcs.sql | create_room(uuid), host/guest six-field results, one guest UPDATE | Explicit old-function removal; eight-field create/join API; room+member atomic creation and locked count-based admission |
| supabase/migrations/20260905000002_rooms_realtime.sql | rooms-only publication | Preserve publication, primary key and one exact-room binding |
| supabase/migrations/20260909000000_movie_candidates_schema.sql | rooms_candidate_requires_guest_check | Replace through new migration with count-equals-target check; keep catalog/seed/FK |
| supabase/migrations/20260909000001_room_candidate_rpc.sql | host/guest authorization and guest readiness | Replace body using room_members and count; preserve signature/assignment/failure rules |
| src/types/database.generated.ts | host/guest row shapes, old create Args and six-field room Returns | One intentional generation for final DB cutover; new room/member shapes and eight-field results |
| src/rooms/contracts.ts | Host/Guest unions, Waiting=1/Ready=2, exact six keys | Independent booleans, integer bounds/count-state rules, exact eight keys/nullability |
| src/rooms/service.ts | create with UUID alone; exact three-column refetch | Explicit target/choice; exact five-column refetch with runtime checks |
| src/rooms/state.ts | role/count, count derived from state; full copy says two | isCreator/isVoter/voterCount/requiredVoterCount; monotonic intermediate count; generalized full copy |
| src/rooms/use-room-subscription.ts | accepted model and refetch mapper | Preserve channel/readiness/cleanup; extend state and stale count tests |
| src/rooms/code.ts | canonical ten-hex code; web-origin/native Linking invitation | Reuse one target for link and QR; no token/identity changes |
| app/index.tsx | literal two-person text, request UUID ref, no settings | Default2 numeric text, explicit voting selection, frozen request/config through retry |
| app/room/[code].tsx | state.count of2, second-participant copy, Waiting-derived invitation | Actual voter counts, mode, creator invitation access, later QR integration; preserve route generation/retry |
| src/candidates/contracts.ts, service.ts, state.ts, use-room-candidate.ts, candidate-card.tsx, posters.ts | Hook imports accepted-room type; runtime uses ID/state only; no host/guest selection in candidate modules | Preserve behavior; only actual room-type adaptation if necessary; same four static PNGs |
| supabase/tests/database/room_session.test.sql | Exact columns/constraints/policies/FKs, owner fixtures, six-field outcomes, seat races | Evolve exact expectations and fixture cleanup; retain invariant classes and add generalized races |
| supabase/tests/database/room_candidate.test.sql | Fixed-seat setup/preservation/ACL assertions and concurrency metadata | Generalized coherent member fixtures/authorization; retain all catalog/assignment/fault/no-write evidence |
| __tests__/rooms/contracts.test.ts, service.test.ts, state.test.ts, use-room-subscription.test.ts | Fixed roles/counts/projection fixtures | Generalized exact parser/service/state/lifecycle tests |
| __tests__/routes/home.test.tsx, room.test.tsx | Old create calls/copy and accepted models | Four configuration cases, validation, count/mode/recovery and later QR integration |
| __tests__/candidates/use-room-candidate.test.ts, candidate-card.test.tsx | Accepted-room fixtures | Update type fixtures, retain acquisition/poster behavior tests |
| e2e/room-session.spec.ts | 24 exact-seat trials, private-column attacks, count copy | Explicit two-voter/voting-creator regression configuration; generalized assertions, same safety classes |
| e2e/first-movie-candidate.spec.ts | Eight two-person fixtures and room snapshots | Preserve F01–F08; adapt membership representation only |
| e2e/support/room-harness.ts | Host/guest snapshots, three-column projection, result assertions, create helpers, Realtime observer | Parameterized configuration/count/flags; bounded member snapshot; exact refetch matching; reused-session helper |
| e2e/support/candidate-harness.ts | Two-element participant/actions/results/limits arrays | Bounded variable arrays for 3/4 authorized clients while pair behavior stays green |
| playwright.config.ts | Exactly two acceptance files; 180s global deadline | Add reviewed G-case file; bounded 600s full-suite deadline and 90s G-case deadline; retries0/workers1 |
| e2e/support/safe-reporter.ts, sanitize-diagnostics.ts; scripts/run-e2e.mjs | Exact scenario/location vocabulary, N=65 text | Only reviewed G cases/helper locations and discovered-suite budget labels |
| e2e/support/safe-diagnostics.ts | N=65 accounting; strict SVG/image/canvas capture ban | Update budget label only; retain capture policy and ordinary safe text inspection |
| __tests__/config/e2e-diagnostics.test.ts, playwright-runtime.test.ts | Discovery/allowlist/budget exactness | Assert reviewed phase/final inventory; reject unknown future labels |
| scripts/database-types.mjs and config/database-types tests | R01 atomic write/check semantics | Reuse unchanged; one write after complete DB surface |
| supabase/config.toml | anonymous_users=150; historical N=47 explanatory comment | Keep all settings; update only obsolete budget comment during implementation |

Search matches in unrelated string parsing (for example scripts/configure-local-env.mjs)
are not domain dependencies. Auth/storage, environment wrappers, asset catalog,
C1 scanner/registry and browser runtime ownership are reused, not redesigned.

## Scope Boundary

New functionality is configuration → create/invite → voter assembly → stable
membership Ready, including errors/retry/isolation. Retain Feature 002 temporary
fixture compatibility after generalized Ready for every member, including a
non-voting creator. Future filters still follow assembly, and TMDB remains the
future metadata authority; neither flow is implemented here.

Exclude filters/common resolution, movie APIs/TMDB, swipes, progression,
agreement/match, dynamic membership, spectator/TV roles, camera/scanner,
production deep-link deployment, new external catalog, account recovery and
room cleanup features. The >2 agreement policy remains due before/during
Feature 008 specification and has no dependency in this design.

## Constitution Check — Before Design

**PASS at planning level.** Reviewed input: 35 FR, 4 NFR, 12 SC, 36 acceptance
scenarios, three P1 stories. No product clarification or exception is needed.

| Principle | Gate basis |
| --- | --- |
| I | Every future phase has executable checks and fresh-checkout applicability; planning does not claim runtime evidence |
| II | Four coherent phases below; the coupled contract cuts over atomically rather than committing broken intermediate slices |
| III | Normative vision/roadmap/spec and completed contracts read; explicit impact inventory; old artifacts preserved |
| IV | PostgreSQL membership/count owner, atomic creation/join, idempotency, locks, rollback, stale/refetch and recovery contracts |
| V | Narrow RLS/helper/read projection, authenticated-only hardened functions, no roster and preserved C1 |
| VI | Additive versioned migration with legacy-row proof, one R01 write, pinned dependencies, complete fresh-clone path |
| VII | Real dblink blocking proof, real browser Auth/RPC/Realtime, independently decoded QR; no presence-only evidence |
| VIII | One normalized member relation, focused QR component and existing infrastructure; no future product interaction |

## Selected Architecture and Cutover

[Data model](data-model.md) defines the final room fields, membership keys/FKs,
state/count checks and exact old-row mapping. Every creator has one membership;
creator ownership and is_voter are separate. Member rows identify admitted
membership; voter_count is maintained in the same transaction and serialized
under the room lock. Clients cannot write either side. No count trigger or
unlocked aggregate becomes a competing authority.

All legacy rooms become required2 with a voting creator, one voter if Waiting
and two if Ready. Preserve id/code/request/room timestamps and exact movie FK.
Legacy member joined_at records cutover materialization time, not an invented
historical admission timestamp. Rename host to creator, migrate members, change
PostgreSQL 17's generated expression in place, replace policies/functions/checks
and remove guest. There is no final host/guest authority or compatibility API.
After the generated-expression/schema cutover, run `ANALYZE public.rooms` as
postgres before the migration transaction commits to refresh the column
statistics removed by SET EXPRESSION.

One new migration runs transactionally with application traffic stopped. Final
DB + canonical types + consuming client + configuration/occupancy UI + required
regression changes form **Phase 2 together**. Do not commit its internal steps
separately. Old cached clients are not a supported rolling deployment surface;
restart/reload the local application against the coherent final baseline.

Creation keeps creator/request uniqueness, named code-conflict handling and
original configuration on retry. Join checks membership before fullness under
FOR UPDATE. A creator without membership fails exceptionally before capacity
logic, with no insertion, count change or inferred voting choice. A persisted
non-creator non-voter also fails the room RPC projection exceptionally. Only a
non-creator without membership may reach normal admission and mutate member/count
once. Valid existing-member recovery and the business outcomes are unchanged.
[Room RPC contract](contracts/room-rpcs.md)
contains exact signatures/results/nullability, rollback and real concurrency
oracles. Private helper-based RLS exposes no member roster; [projection contract](contracts/room-projection-realtime.md)
retains one rooms UPDATE invalidation/refetch lifecycle. The non-voting creator
has the same observer authorization as every admitted voter.

Candidate compatibility replaces only its authorization, Ready predicate and
room constraint. The existing source, metadata, RPC result and poster/retry
semantics remain. See [candidate compatibility](contracts/candidate-compatibility.md).

## Client and QR Decisions

Refactor the existing room modules rather than adding a second room client.
Use generated argument/field types plus strict logical parsing. Accepted state
holds independent flags and integer counts; refetch preserves immutable flags/
target and guards lower stale Waiting counts as well as Ready regression.
No state is adopted from Realtime payloads or connection totals.

Home uses RN TextInput (initial "2") and two accessible Pressables for explicit
participation, initially neither selected. Invalid values produce corrective
feedback; one accepted submission freezes config with its UUID through retry.
The room renders current/required voters and Waiting/Ready, explains creator
mode, and retains invitation access in both creator modes. No settings editor.

Use one standalone `src/rooms/invitation-qr.tsx` based on the selected Expo-compatible
SVG package. Phase 1 tests/bundles it independently; Phase 3 integrates it with
one shared textual invitation value. Its safe error boundary preserves link/code.
Independent test-side jsQR decoding validates actual rendered geometry and real
join navigation without retained images. Exact payload, accessibility, C1 and
LAN/native limitations are in [QR contract](contracts/qr-invitation.md).

## Testing and Existing Acceptance Evolution

Do not rewrite old specifications or delete safety coverage to match new shapes.
Existing application tests evolve where their representation is obsolete:
fixed host/guest roles, Waiting1/Ready2 mapping, private columns and full copy.
Keep creation/join idempotency, code collisions, grants/RLS, membership isolation,
concurrency, rollback, route staleness, subscription readiness, recovery and
candidate authority. Reaudit all 24 old room and eight candidate trials.

Database tests cover final exact schema/ACL/helper, four creation cases,
configuration immutability, original-config retries, real same-identity/final-slot/
multiple-free-slot races, no partial membership/count writes and generalized
candidate authorization. Rollback-scoped privileged faults remove the creator
membership for both voting choices in Waiting/Ready and corrupt a non-creator
to non-voter; real authenticated join calls must fail without any repair,
promotion, count/state change or other write, then exact fixture state is restored.
A version-limited migration runner proves three nonempty legacy states and
post-cutover ANALYZE/rooms.state statistics before a full latest reset. Synthetic
Auth fixtures use privileged setup only, real authenticated roles/claims as
tested callers, zero GoTrue signups. No production test hook remains.

Client tests cover parser/nullability/invalid integers, service args, default and
explicit choice, retry freeze, flags/count UI, intermediate count refetch,
generation/reconnect, QR value/error, and preserved candidate/poster behavior.
Web export must include the integrated QR and all four original posters. Native
bundle checks validate shared imports, not physical native execution.

Browser evidence uses actual Anonymous Auth/local Supabase/RPC/PostgreSQL/
Realtime/Expo web and existing Playwright Docker management. Request barriers
prove browser overlap; pgTAP separately proves row-lock blocking and exact
write deltas. Nine grouped new cases cover all 36 scenarios efficiently. See
[quickstart.md](quickstart.md) for every case, requirement map and command.

## C1, R01 and R02

**C1:** No capture-policy redesign. Fixed new test/location labels and budget
strings only; safe wrapper/reporter/scanner remain mandatory. QR decode is
bounded memory-only SVG/pixel inspection, not a screenshot permission. The
strict diagnostic guard still rejects SVG/images/canvas. No raw Auth/Realtime/
request dumps, trace, HAR, video or storage-state exports. Scanner findings must
be zero; the controlled C1 probe remains before ordinary Auth acceptance.

**R01:** In Phase 2 only, after the complete migrated schema/RPC contract passes
DB evidence, intentionally run db:types then immediately db:types:check and
review the canonical artifact. A second clean reset/check-only gate confirms
byte and metadata stability. All later normal validation and fresh checkouts
use check only. No generator script change or manual nullable-field patch.

**R02:** Recounted old trials47 + candidate18 + new26 = **91 identities / 41 cases**.
C1+complete=92. Cutover's existing32+G03/G04=72, with C1=73. Two complete runs
plus one C1=183; fresh validation=92; aggregate=275. Reserve separate recovered
windows for repeatability itself and fresh checkout; wait outside the harness,
keep the repeatability stack running, never restart/reset for quota, raise150,
retry429 or use a session-export cache. Prior partial/manual/targeted attempts
remain counted. All per-case caps and phase admission rules are in quickstart.

## Implementation Phases and Green Checkpoints

These are future phase boundaries, not generated tasks or completed work.

| Phase | Coherent deliverable | Minimum green checkpoint |
| --- | --- | --- |
| 1 — Standalone QR foundation | Add locked QR/SVG/decoder deps and standalone component/error/interface tests; no route or DB contract change | npm ci; lint/typecheck/full client tests including real local encoder and standalone render; dependency resolution; current web/native exports; existing reset/type-check/db tests; C1 + existing32 E2E (65+1=66); cleanup. Baseline exports do not yet prove integrated QR bundling |
| 2 — Atomic membership cutover | New complete migration + legacy-row validator + RLS/RPC/candidate changes + full SQL tests; one R01 update; generalized room client and create/count UI; adapted existing tests/harness/C1 metadata; new G03/G04 | Version-limited old-row migration with post-cutover ANALYZE, clean reset and full pgTAP including creator/member integrity faults and real lock/write evidence; intentional types then check; independent reset/check-only; lint/typecheck/client/web+native bundles; poster inclusion; C1 + all34 discovered tests (72+1=73), including both generalized three-voter creator modes. No old API/columns or mismatched client at commit |
| 3 — QR invitation and complete acceptance | Integrate standalone QR into authorized invitations; independent decoder helper; add G01/G02/G05–G09, complete discovery/bounded C1 labels and budgets | Full static/client/db/type checks and migration validator; integrated web/native exports; C1 + all41 browser tests (91+1=92), all36 scenarios and zero scanner findings. QR-derived real admission, generalized races/recovery/isolation and retained F01–F08 pass |
| 4 — Repeatability and fresh checkout | Final full validation, two complete runs with one C1 across recovered windows, independently versioned fresh clone | Complete command chain and traceability review; repeatability183 and fresh92 separately admitted; canonical types unchanged under check; all41 tests each run; zero scanner findings; cleanup and no scope leakage |

Phase 1 exports prove the existing application remains buildable after dependency
installation. Standalone component/encoder tests prove its bounded behavior;
the integrated QR web/native bundling and browser decode proof belongs to
Phase 3, after its route import exists. No phase claims an unimported component
is already included in the application export.

Phase 2 includes all current affected tests and candidate harness generalization;
these cannot be deferred while the current suite is broken. Its new G03/G04 are
complete link/code cases, deliberately independent of QR, with their full
membership/candidate recovery assertions. Phase 3 adds seven complete cases;
there are no skipped future tests counted as cutover evidence.

Phase 4's first repeatability run also supplies its normal final acceptance
checkpoint. Do not add an uncounted preliminary full run; keep the cleanup-owning
shell/driver and same stack alive through the outside-harness quota wait.

Dependency graph: **Phase 1 → Phase 2 → Phase 3 → Phase 4**. Within cutover:
legacy migration proof + final DB contract → single intentional generated types
→ generalized typed client/UI → complete cutover acceptance. These are internal
ordering constraints in one phase, not separately committable incompatible states.
Independent QR foundations precede its route integration; all acceptance precedes
repeatability/fresh validation. No circular dependency or future-feature prerequisite.

## Fresh-Clone Path

Use an exact committed implementation SHA, not today's planning-only HEAD.
Disposable clone outside source → npm ci → safe Supabase start/env → versioned
migration compatibility → latest clean reset → db:types:check only → lint →
typecheck → full client and pgTAP → web/native export → four-poster inclusion →
managed Playwright setup → C1 → complete acceptance → shutdown/cleanup. Record
source SHA, commands, counts, quota windows and canonical hash/metadata.

[quickstart.md](quickstart.md) specifies the reproducible run sequence. Setup
npm/Docker network use is separate from movie/QR runtime traffic, which has no
external resource dependency. No production hosting, hosted Supabase or camera
hardware is a prerequisite for automated evidence.

## Project Structure

### Documentation for this feature

```text
specs/003-generalized-room-membership-qr/
├── spec.md                         # reviewed input, unchanged
├── checklists/requirements.md       # reviewed input, unchanged
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── room-rpcs.md
    ├── room-projection-realtime.md
    ├── qr-invitation.md
    └── candidate-compatibility.md
```

Task generation is a separate later workflow; no tasks.md is created now.

### Future implementation paths

```text
supabase/migrations/20260910000000_generalized_room_membership.sql
supabase/tests/database/room_session.test.sql
supabase/tests/database/room_candidate.test.sql
supabase/tests/migration/room_membership.before.sql
supabase/tests/migration/room_membership.after.sql
scripts/check-room-membership-migration.mjs
src/types/database.generated.ts
src/rooms/{contracts,service,state,use-room-subscription}.ts
src/rooms/invitation-qr.tsx
app/index.tsx
app/room/[code].tsx
__tests__/rooms/invitation-qr.test.tsx
__tests__/rooms/{contracts,service,state,use-room-subscription}.test.ts
__tests__/routes/{home,room}.test.tsx
__tests__/candidates/{use-room-candidate.test.ts,candidate-card.test.tsx}
e2e/generalized-room-membership-qr.spec.ts
e2e/support/qr-harness.ts
e2e/{room-session,first-movie-candidate}.spec.ts
e2e/support/{room-harness,candidate-harness,safe-diagnostics,safe-reporter,sanitize-diagnostics}.ts
scripts/run-e2e.mjs
playwright.config.ts
__tests__/config/{e2e-diagnostics,playwright-runtime}.test.ts
package.json
package-lock.json
supabase/config.toml                # historical budget comment only
```

Retain the root feature-oriented Expo layout. Braces above enumerate existing
parallel filenames, not a new generic abstraction. The standalone QR module,
normalized membership relation, private helper and bounded test utilities each
have a current requirement; no speculative subsystem is added.

## Constitution Check — After Design

**PASS at planning level, all eight principles, no exception.** I/VII have
executable migration, SQL, client, real browser, QR decode and fresh-checkout
oracles; II uses four coherent phases, including the necessarily coupled
cutover; III reconciles the complete impact inventory and cross-artifact coverage;
IV defines count/membership ownership, locking, every recovery and no-write path;
V preserves narrow authorization/C1; VI fixes migration/R01/toolchain/quota
procedures; VIII stops new product functionality at membership Ready.

## Complexity Tracking

No constitutional violation or approved exception. The private authorization
helper avoids exposing a roster; one larger cutover phase avoids dual-authority
compatibility. Both are necessary for the present contract. Rejected alternatives
and source evidence are recorded in research.md.

## Planning-Only Declaration

No implementation, migration/test/QR asset creation, dependency installation,
Supabase startup, application test, generated-type change, branch change, commit
or push occurred. Only these eight normal Feature 003 planning artifacts were
written. Reviewed spec/checklist, normative documents and completed Feature
001/002 artifacts remain unchanged. Pre/post extension hook configuration is
absent. setup-plan's BRANCH value is the feature label; actual Git branch is main.

Planning validation checked local document links, closed interface consistency,
all 35 FR/4 NFR/12 SC/36 scenarios, G01–G09 and F01–F08, exact case allocations
and phase budgets, shell-block syntax, git diff --check and whitespace of every
new untracked artifact. Focused technical review corrected the explicit parser
minimum and clarified reuse of repeatability run #1; no finding remains. All
138 protected baseline files, including reviewed inputs and local feature
pointer, remain byte-identical. These are artifact checks only, not application
tests or a Feature 003 implementation verdict.
