# Implementation Plan: Swipe Decisions

**Branch**: `main` (feature directory label `007-swipe-decisions`)

**Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Baseline**: `bf72bb524afd4fcf82f4c00181ea2040f68df3bf`
**Status**: Planning complete; no Feature 007 implementation performed.

**Input**: Feature specification from `/specs/007-swipe-decisions/spec.md`

## Summary

Add one immutable right/yes or left/no decision for each fixed voter and the
room's authoritative current TMDB candidate. PostgreSQL owns identity,
authorization, first-write-wins concurrency and the privacy-safe completion
count. A grant-free decision relation is keyed by voter membership plus TMDB
identity; two authenticated `SECURITY DEFINER` operations recover the caller's
own value or atomically accept the first value while rejecting replacement.

The existing `public.rooms` row gains only `decision_completed_count`. A first
accepted decision increments it in the same transaction and therefore reuses
the established rooms-only Realtime invalidation/refetch lifecycle. Agreement is
never persisted: the operations derive `true` or `false` only for exactly two
voters and return `null` for larger groups. The Expo client adds a feature-local
decision state machine and accessible decision surface. Mobile uses the already
installed Gesture Handler and Reanimated packages for deterministic horizontal
swipes; always-visible labeled buttons provide equivalent web, keyboard and
assistive-technology access. No decision changes the candidate or calls TMDB.

## Technical Context

**Language/Version**: Strict TypeScript ~6.0.3; Node.js 24.20.x and npm 11.19.0
as declared by the repository; PostgreSQL 17. The planning host reports Node
24.12.0/npm 11.6.2, so executable gates must use the declared toolchain.

**Primary Dependencies**: Expo 57.0.20, Expo Router 57.0.19, React 19.2.3,
React Native 0.86.3, React Native Web ~0.21.0,
`@supabase/supabase-js` 2.115.0, Supabase CLI 2.116.0,
`react-native-gesture-handler` 2.32.0, `react-native-reanimated` 4.5.1 and
`react-native-worklets` 0.10.1. No new dependency is planned.

**Storage**: Existing Supabase PostgreSQL; one enum, one grant-free
per-voter/per-candidate relation and one privacy-safe aggregate column on
`public.rooms`. No decision request ledger, yes-count, agreement row, candidate
generation, queue or metadata copy.

**Testing**: Jest 29.7 with React Native Testing Library 13.3.3; pgTAP and dblink
for database authority/concurrency; Playwright 1.63 for bounded real-stack web
acceptance; existing migration runners, generated-type check, lint, TypeScript,
web export, native export and credential-safe diagnostics/scanning.

**Target Platform**: Shared Expo Android/iOS/web client; automated owner
acceptance on Chromium web using desktop keyboard and mobile-sized touch
contexts; PostgreSQL through Supabase Auth/Data API/Postgres Changes.

**Project Type**: Mobile-first Expo application with functional web access and
Supabase PostgreSQL/Auth/Realtime backend.

**Performance Goals**: Preserve specification NFR-009/SC-009 through one
controlled healthy local full-stack profile: warmed healthy local services, an
already displayed assigned candidate, one worker, serial attempts and no
injected fault. Measure from eligible control activation or qualifying gesture
completion until the validated authoritative decision result is rendered.
Exactly 20 first-decision attempts reuse two identities across 10 preassembled
assigned rooms; at least 19 must finish within 2,000 milliseconds. Assembly,
acquisition, navigation and metadata loading are excluded. Any actionable
recoverable failure is recorded separately, is not a passing timing sample and
invalidates the controlled performance run. Record sample count, passing count
and maximum duration; no percentile is normative. Gesture movement stays on the
UI thread and submission occurs once at gesture completion.

**Constraints**: Fixed assembled voters; one Feature 006 `assigned` TMDB
identity; first accepted value immutable; right=yes and left=no; caller identity
comes only from Auth; expected TMDB ID is compare-only stale protection; private
individual values; exact-two yes/yes rule; larger-group agreement `UNRESOLVED`
and represented as no outcome; no candidate progression, match UX or TMDB change.

**Scale/Scope**: One current candidate, one row per voter/candidate pair, one
small room aggregate, two RPCs, one existing Realtime channel, one feature-local
client module group, two current-feature browser cases with six identities.
Configured voter count remains unbounded by this feature.

## Constitution Check — Before Phase 0

**PASS at planning entry; no exception or amendment required.**

| Principle | Pre-design assessment |
| --- | --- |
| I. Working behavior is primary evidence | The plan defines migration, DB, client, browser, build/export, repeatability and fresh-checkout evidence without claiming that any implementation check has run. |
| II. Small verifiable vertical slices | Authority, accessible decision input, swipe enhancement and bounded acceptance are separate green checkpoints; none depends on Feature 008 or 009. |
| III. Artifact consistency | The specification, Feature 006 handoff, fixed membership, contracts, data model and test policy use the same voter/candidate/value lifecycle. Case labels were corrected to K01/K02 and the implemented full-suite count was reconciled. |
| IV. Explicit authoritative transitions | PostgreSQL owns the immutable decision and atomic completion count. Contracts cover validation, Auth, authorization, duplicate/conflict behavior, stale candidates, concurrency, rollback, response loss and recovery. |
| V. Security and least privilege | The table is RLS-enabled and grant-free; functions derive `auth.uid()`, return only the caller's value plus aggregates, mask foreign rooms and expose no other voter value. |
| VI. Reproducible schema evolution | One additive migration, a nonempty Feature 006→007 upgrade proof, clean reset, one controlled generated-type write and later check-only validation are required. |
| VII. Executable acceptance evidence | Deterministic database tests own concurrency/ACL truth; client tests own gesture/state truth; K01/K02 and targeted J03 prove representative real cooperation. |
| VIII. Explicit scope and simplicity | Existing PostgreSQL, rooms channel and installed gesture stack are reused. No Edge function, second channel, mutable decision, progression state or larger-group policy is added. |

The intentionally unresolved larger-group agreement policy does not affect any
Feature 007 transition or contract. It remains `UNRESOLVED` and blocks only
dependent Feature 008 progression design.

## Project Structure

### Documentation (this feature)

```text
specs/007-swipe-decisions/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── decision-rpcs.md
    ├── room-decision-projection-realtime.md
    ├── client-decision-flow.md
    └── swipe-interaction.md
```

No `tasks.md` is created by this workflow.

### Future implementation paths

```text
app/
├── _layout.tsx
└── room/[code].tsx

src/
├── candidates/{candidate-card,use-room-candidate,state}.ts[x]
├── decisions/
│   ├── contracts.ts
│   ├── service.ts
│   ├── state.ts
│   ├── use-candidate-decision.ts
│   └── candidate-decision-surface.tsx
├── rooms/{contracts,service,state,use-room-subscription}.ts
└── types/database.generated.ts

supabase/
├── migrations/20260916000000_swipe_decisions.sql
└── tests/
    ├── database/{room_session,swipe_decisions}.test.sql
    └── migration/{swipe_decisions.before,swipe_decisions.after}.sql

__tests__/
├── decisions/{contracts,service,state,use-candidate-decision,candidate-decision-surface}.test.ts[x]
├── rooms/{contracts,state,use-room-subscription}.test.ts
├── routes/room.test.tsx
└── config/{database-types,e2e-diagnostics,feature007-e2e-profile}.test.ts

e2e/
├── swipe-decisions.spec.ts
├── tmdb-candidate-source.spec.ts
└── support/{decision-harness,candidate-harness,room-harness,safe-reporter}.ts

scripts/
├── check-swipe-decisions-migration.mjs
└── run-e2e.mjs
```

**Structure Decision**: Retain the repository's existing feature-local Expo
modules, SQL migration/test boundary and single rooms subscription. The new
`src/decisions` folder mirrors candidates/filters without mixing persistence
into Feature 006's `CandidateCard`. PostgreSQL RPCs are sufficient because the
operation has no external secret or provider call; no Edge function or new
backend service is justified.

## Architecture and Authority Flow

```text
Feature 006 candidate response
  -> client holds canonical tmdbMovieId (never rendered as movie metadata)
  -> decision recovery RPC(room ID, expected TMDB ID)
       Auth subject -> fixed room_members row
       room assignment -> authoritative current TMDB ID
       private own row + privacy-safe aggregate facts
  -> voter swipes or presses labeled Yes/No
  -> submission RPC(room ID, expected TMDB ID, yes|no)
       lock authoritative room row
       reauthorize fixed voter and compare candidate
       existing pair -> unchanged/conflict, zero writes
       missing pair -> insert immutable row + increment room count atomically
  -> submitter adopts authoritative result
  -> rooms UPDATE emits existing id-only invalidation
  -> every authorized client refetches safe room count
  -> decision recovery refreshes caller-owned value and aggregate facts
```

The client-supplied TMDB ID is never assignment authority. It is an expected
identity guard: equality permits an operation; mismatch rejects a stale UI
action. The database always reads the actual room assignment. The caller cannot
supply a user ID or room-member ID.

## Database Authority and Persistence

### Decision relation

Create `public.candidate_decisions` with:

- `room_member_id uuid` referencing `public.room_members(id)` with delete cascade;
- positive `tmdb_movie_id bigint`;
- `decision public.candidate_decision_value` where the closed values are
  `yes | no`;
- immutable `accepted_at timestamptz`; and
- primary key `(room_member_id, tmdb_movie_id)`.

The composite key is the first-write-wins boundary. It naturally represents the
specified voter/candidate pair without duplicating room/user identity. No
update/delete application operation exists. The table is postgres-owned,
RLS-enabled, contains no client policy, has all PUBLIC/anon/authenticated table
privileges revoked and is absent from Realtime.

### Room completion summary

Add non-null `rooms.decision_completed_count integer default 0` with:

```text
0 <= decision_completed_count <= required_voter_count

decision_completed_count > 0 ->
  state = ready
  voter_count = required_voter_count
  filter_completed_count = required_voter_count
  filter_resolution_status = compatible
  candidate_acquisition_status = assigned
  tmdb_movie_id IS NOT NULL
```

The count is the privacy-safe current-candidate completion watermark and the
existing Realtime invalidation source. It is not a yes-count and reveals no
individual answer. Every accepted first decision increments it once in the same
transaction as the detail row. RPCs validate it against the exact count of fixed
voter decisions for the current TMDB ID before returning or mutating state.

Agreement and `decision_set_complete` are derived, never persisted. For exactly
two required voters, agreement is a non-null boolean and is true only when the
count is two and both stored values are yes. For more than two voters agreement
is always null, even at N/N.

### Transaction and concurrency order

The submission operation:

1. requires authenticated `auth.uid()`;
2. validates non-null positive expected ID and typed decision;
3. locks only the target `rooms` row and joins the caller's fixed membership;
4. masks missing/foreign rooms as `not_found`;
5. rejects an authorized non-voting creator as `not_voter`;
6. requires Feature 006 assigned state and exact expected/current identity;
7. verifies stored aggregate/detail coherence for the current candidate;
8. returns an existing same value as `unchanged` or opposite value as
   `conflict`, both with zero writes and the authoritative stored value; or
9. inserts the missing row, increments `decision_completed_count`, updates the
   room timestamp and returns `accepted` plus the coherent safe projection.

Concurrent same-voter requests serialize on the room/unique key and cannot
replace the winner. Concurrent different voters may briefly serialize on the
room row needed for one atomic completion summary. After both requests reach
the authoritative transaction boundary, completion requires no further user
action, client connectivity or acknowledgement from either voter; only bounded
database transaction serialization may delay completion. Different rooms share
no decision lock. Any exception rolls back detail and count together.

No request UUID is required. The immutable unique pair and returned stored value
make same-value retry, conflicting retry and committed-response-loss recovery
idempotent.

The recovery operation establishes an authorized room relationship without
joining a foreign caller to the room's lock queue. It then locks the authorized
target room row `FOR SHARE`, revalidates the locked membership, candidate and
room state, and reads caller detail, aggregate count, completeness and exact-two
agreement while that lock prevents a submission from changing the room count.
Recovery therefore returns one coherent pre-submit or post-submit projection
and never compares detail and aggregate values obtained across a concurrent room
update. A foreign or missing caller returns masked `not_found` without waiting
on the target room lock.

## RPC and Privacy Boundary

[decision-rpcs.md](contracts/decision-rpcs.md) is binding.

`get_room_candidate_decision(room, expected_candidate)` returns one of:

- `decided`: voter plus their own accepted value;
- `not_decided`: voter with no accepted value;
- `observer`: authorized non-voting creator with no own value;
- `not_ready`: no assigned current candidate;
- `candidate_changed`: expected identity does not match authority; or
- `not_found`: missing and foreign rooms share one masked outcome.

`submit_room_candidate_decision(room, expected_candidate, decision)` returns
`accepted | unchanged | conflict | not_voter | not_ready | candidate_changed |
not_found`. Successful/reconciled results contain only `my_decision`, completed
count, required count, completion boolean and nullable exact-two agreement.
An authorized `not_voter` observer may receive the safe aggregate with no own
decision; masked, unready and stale-candidate results contain no aggregate or
decision data.

Both functions are postgres-owned, exact-signature `SECURITY DEFINER SET
search_path=''`, use schema-qualified objects, revoke PUBLIC/anon/authenticated,
then grant only authenticated execution. Direct decision table operations remain
denied. Raw database exceptions are mapped to the client's fixed safe failure.

## Realtime and Recovery

[room-decision-projection-realtime.md](contracts/room-decision-projection-realtime.md)
extends accepted create/join results and direct room refetch with exactly
`decision_completed_count`. Rejected join shapes remain all-null except outcome.
New and migrated rooms begin at zero.

Retain exactly the existing `room:<UUID>` Postgres Changes subscription on
`public.rooms`, with ID-only invalidation. Do not publish the decision table or
add Broadcast, Presence, polling or a second channel. A first accepted decision
updates the room count/timestamp and therefore emits one invalidation; unchanged
and conflict results write nothing and emit none.

The room client merges the count monotonically within the immutable Feature 007
candidate. System-ok and UPDATE both cause canonical refetch; missed events are
therefore recovered. The decision hook reads initially, after count advance,
after reconnect/re-entry and on explicit recovery. The submitter adopts the RPC
result immediately rather than waiting for Realtime.

Feature 008 must evolve the count/reset merge together with a candidate
occurrence/generation before progression. Feature 007 neither resets the count
nor invents that future identity.

## Client State and Interaction

[client-decision-flow.md](contracts/client-decision-flow.md) defines one
generation-scoped hook keyed by room ID plus candidate TMDB ID. It separates:

- authoritative room count and RPC projection;
- caller-owned authoritative decision;
- pending local intent; and
- request/recovery generation.

Initial recovery must finish before input is enabled. Submission is one-flight;
gesture/button collisions while pending do not issue another local request.
Cross-tab/device duplicates still reach the database invariant. A transport
failure claims no acceptance, keeps the intent for explicit retry/reconciliation
and cannot replace a later recovered authoritative value. Room A→B→A, candidate
change, unmount and late callbacks are retired by generation.

The active decision surface exists only for a voter with an assigned,
recognizable candidate object. Title/year with poster loading, poster error or
explicit no-poster fallback remains decidable. Acquisition, metadata loading,
metadata error, no-candidates and integrity-error states expose no active input.
Non-voting creators may observe count and exact-two agreement but receive no
controls or own value.

The room route composes a new `CandidateDecisionSurface` around the existing
candidate presentation. `CandidateCard` remains responsible for Feature 006
metadata/failure UI; decision service/state does not call candidate acquisition.

## Swipe and Accessibility Design

[swipe-interaction.md](contracts/swipe-interaction.md) is binding.

Wrap the app in `GestureHandlerRootView`. Use the installed declarative
`Gesture.Pan()` API, one pointer, horizontal activation outside `[-12, 12]`
points and pre-activation vertical failure outside `[-24, 24]`. A normal release
submits only when:

```text
threshold = max(72, min(120, 0.25 * measured card width))
abs(translationX) >= threshold
abs(translationX) >= 1.25 * abs(translationY)
```

Positive X maps to yes; negative X maps to no. Cancellation, failure, vertical
dominance and under-threshold release submit nothing. Gesture movement uses
Reanimated shared values on the UI thread and springs to center with system
reduced-motion behavior. Completion schedules exactly one JS submit. The card
does not leave the room or reveal another candidate.

Always-visible Pressable controls labeled by meaning provide No and Yes, minimum
44-point targets, button roles, disabled/busy state and web keyboard activation.
Text/live-region copy distinguishes loading, ready, submitting, accepted yes,
accepted no, conflict reconciliation and recoverable failure without relying on
direction, position, animation or color. Exact-two agreement is neutral status
copy, not celebration or final match UX. Larger rooms show progress only.

## Migration and Generated Types

Create one additive migration after
`20260914000000_tmdb_candidate_source.sql`; modify no historical migration.
Within one transaction:

1. snapshot existing rooms, members, filters, resolutions, candidates and TMDB
   assignments for preservation checks;
2. add the decision enum and `decision_completed_count` with constraints;
3. create and harden the grant-free decision table;
4. recreate `create_room` and `join_room` only to append the safe count while
   preserving every existing outcome, lock and authorization rule;
5. create/harden the two decision RPCs;
6. refresh exact rooms column grants to add only the count, keeping TMDB ID and
   internal identifiers denied;
7. verify all prior rows/values and applicable xmins remain unchanged, every new
   count is zero, no decision row was invented, and rooms remains the sole
   Realtime publication relation;
8. notify PostgREST schema reload and commit.

The nonempty upgrade runner seeds Waiting, incompatible, no-candidate and
assigned two-/three-voter rooms in both creator modes, applies the actual
migration, proves preservation and finishes with a clean latest reset.

The public enum, room field, table and RPC signatures change generated types.
After migration/DB contracts are final and green, run exactly one intentional
`npm run db:types`, immediately run `npm run db:types:check`, review the bytes,
then use check-only validation for every subsequent gate and fresh checkout.

## Validation and Impact Plan

`docs/testing-strategy.md` is normative. Its implemented baseline is now
recorded as E/G/H/I/J = 42 cases and 100 identities. Feature 007 adds K01/K02,
so full discovery becomes 44 cases and 106 identities after implementation;
C1 plus full becomes 107. A full run is not selected for the normal Feature 007
gate because the change is additive and bounded.

### Evidence ownership

| Guarantee | Primary authority | Browser responsibility |
| --- | --- | --- |
| One immutable value, exact writes, rollback and races | pgTAP/dblink | Representative K01/K02 dispatch only |
| Fixed-voter authorization and observer exclusion | PostgreSQL ACL/RPC + route tests | K01/K02 and evolved G04 |
| Own recovery and other-voter privacy | PostgreSQL + strict client parser | K01/K02 and G08 |
| Gesture threshold/cancel/mapping and accessibility | Pure/component/hook tests | K01 mobile touch and desktop keyboard |
| Missed update/reconnect/stale generation | Client state + rooms Realtime | K01/K02 lifecycle recovery |
| Completion and exact-two truth table | PostgreSQL | K01 representative outcomes; K02 proves no >2 outcome |
| Metadata/poster gating of controls | Candidate/decision component tests | Targeted Feature 006 J03 |
| No TMDB/progression side effect | DB/client and controlled-provider counters | K01/K02/J03 |
| Migration/type consistency | Migration/DB/type checks | None |
| 95% decision responsiveness | Controlled K01 healthy local full-stack timing subtrial | Exactly 20 serial first-decision samples; at least 19 render authority within 2,000 ms; any recoverable failure invalidates the run |

### Current-feature owner acceptance (`F = 6`)

- **K01 — 2 identities**: voting creator and one voter reuse their identities
  across bounded rooms. Prove the same TMDB identity, cancelled/right/left
  mobile touch gestures, desktop keyboard controls, independence while the
  other voter is idle/disconnected, duplicate/conflict/overlap behavior,
  committed-response loss, reload/reconnect/re-entry, privacy, exact-two outcome
  combinations, unchanged candidate and zero TMDB/progression calls.
- **K02 — 4 identities**: non-voting creator plus three voters prove no creator
  control/server authority, concurrent independent decisions, N/N completion,
  own-value missed-update recovery, no individual disclosure, null/no larger-
  group agreement and zero candidate change.

Register the exact titles as `K01` and `K02`; `J01-J03` already belong to
Feature 006. Add an override-free `test:e2e:feature007` profile that selects
only `@feature007`, requires exactly two passing receipts, exact 2+4 signup and
identity counts, cleanup/Auth/scanner success and total six.

### Permanent smoke and targeted historical selection

Keep G03/G04/G05/G08/H01 at 16 identities:

- G03/H01 keep incompatible/no-candidate decision suppression;
- G04 keeps non-voting creator exclusion and adds a lightweight three-voter
  completed decision flow with no group agreement;
- G05 keeps QR/idempotent admission unchanged; and
- G08 extends ordinary-JWT isolation to direct decision denial and individual
  decision privacy.

Select existing Feature 006 **J03 once (`T = 2`)**. Its metadata-unavailable,
poster-error and no-poster states now control whether decision input is withheld
or active. J01 is absorbed by K01 shared-candidate/recovery coverage; J02 is
absorbed by K02 plus G04. Detect a direct `--grep J03` as an exact bounded
two-identity profile so its receipt cannot pass with an incorrect budget.

### R02 budget

| Gate | Formula | Identities |
| --- | --- | ---: |
| Normal checkpoint | `1 + 16 + 6 + 2` | **25** |
| Repeatability | `1 + 2 × (16 + 6) + 2` | **47** |
| Fresh checkout | `1 + 16` | **17** |
| Repeatability plus fresh checkout | `47 + 17` | **64** |
| Post-Feature-007 explicit full checkpoint | `1 + 106` | **107** |

Workers remain 1, retries 0 and repeatEach 1. Every partial/failed/manual signup
attempt is charged. Receipts record source/profile, case maxima, actual attempts,
successful identities, timestamps, scanner result and cleanup. HTTP 429 fails;
no reset/restart/probe/session export may evade quota.

Each charged browser block requires a fresh admission calculation using all
attempts still inside the rolling window. The 25-identity normal block,
107-identity full checkpoint and 47-identity repeatability block are not assumed
to fit one allowance window. When remaining capacity is unknown or insufficient,
wait outside the harness for the conservative full signup-free recovery period.
Database reset, service restart and a new checkout do not replenish Auth quota.

## Implementation Phases and Green Checkpoints

These are future implementation slices, not tasks and not completed work.

| Phase | Coherent deliverable | Minimum evidence before next phase |
| --- | --- | --- |
| 1 — Database authority | Additive migration, decision relation/count, hardened RPCs, projection evolution and nonempty upgrade proof | Migration runner, clean reset, full pgTAP including ACLs, exact-two/>2 truth, deterministic duplicate/conflict/distinct-voter races, rollback and no candidate mutation; no generated-type write yet |
| 2 — Accessible decision vertical slice | One controlled type generation; strict decision client contracts/service/state/hook; functional qualifying right/left Pan mapping; explicit Yes/No controls and room integration | Immediate and independent type check-only, lint, typecheck, full client/DB suites, web/native exports; two clients can recover authoritative gesture and button decisions without progression |
| 3 — Gesture, accessibility and convergence hardening | Exhaustive measured swipe boundaries, UI-thread motion/reduced motion, count-driven Realtime recovery, observer/progress/agreement copy | Pure gesture/component/hook tests, client lifecycle/race coverage, full DB/client gates; cancelled/vertical/diagonal gestures create no request and accepted state remains authoritative |
| 4 — Bounded acceptance | K01/K02, evolved smoke, exact J03 profile and safe runner/reporter/config changes | C1=1, F=6, smoke=16, T=2, normal total 25, scanner zero, controlled TMDB counters unchanged by decisions |
| 5 — Repeatability and fresh checkout | Reproduce unchanged source and exact implementation SHA | 47-identity repeatability plus independent 17-identity fresh checkout, check-only types and deterministic cleanup |

Dependency is Phase 1 → 2 → 3 → 4 → 5. Schema, generated types and client are
one release cutover even though evidence is ordered; no incompatible intermediate
contract may ship. A phase must be green or explicitly cancelled and its
dependent artifacts updated before the next begins.

## Constitution Check — After Phase 1 Design

**PASS at design completion; all eight principles, no exception.**

- **I/VII**: [quickstart.md](quickstart.md) separates migration, database,
  client, browser, build/export, repeatability and fresh-checkout proof. Artifact
  creation is not presented as implementation evidence.
- **II/VIII**: One relation, one aggregate, two RPCs, one existing channel and
  existing gesture packages are the minimum architecture for the approved
  independent durable decision slice. Feature 008/009 behavior remains absent.
- **III**: Spec terminology, Feature 006 identity handoff, data model, all four
  contracts, K labels and current testing-policy inventory agree. The only
  `UNRESOLVED` decision is explicitly outside this slice.
- **IV**: The room lock plus immutable composite key defines authorization,
  idempotency, conflicting races, independent voter writes, rollback, response
  loss, stale candidate handling and recovery at the enforcing boundary.
- **V**: Direct detail access is denied; caller identity is derived; only own
  value and aggregate facts cross the RPC; C1/G08/database evidence cover
  disclosure and mutation denial.
- **VI**: One additive migration preserves all prior state, R01 has one controlled
  write followed by checks, and exact-SHA fresh setup remains mandatory.

No post-design gate failed and no constitution amendment is required.

## Complexity Tracking

No constitutional violation or approved exception. The room completion count is
intentional denormalization already established by Feature 004: it is the
smallest privacy-safe Realtime watermark and makes N/N recovery observable
without publishing individual decisions. Brief room-row serialization is
bounded atomic coordination, not a dependency on another person's action.

## Planning-Only Declaration

No implementation, migration, generated-type update, dependency installation,
service startup, application/database/browser test, tasks/analyze workflow,
branch creation/switch, commit or push is part of this planning run.
