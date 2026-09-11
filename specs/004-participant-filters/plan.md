# Implementation Plan: Participant Filters

**Branch**: `main` (feature directory label `004-participant-filters`)
**Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)
**Baseline**: `c0801694c0685f165c2132a9e1ea216265ad128b`
**Status**: Planning complete; no Feature 004 implementation performed.

## Summary

After Feature 003 assembles its fixed voting group, each voter privately saves
one canonical 19-genre/inclusive-year filter set. A dedicated private relation
owns values by `room_members.id`; existence is that member's one completion
contribution. `rooms.filter_completed_count` is the transactionally maintained
public summary, and equality with `required_voter_count` is both durable
all-voters-complete and the irreversible edit lock.

A SECURITY DEFINER submission RPC derives ownership from `auth.uid()` and
serializes all saves/edits on the existing room row. It atomically inserts the
final voter filter, changes progress to N/N and freezes all filters. A separate
read RPC recovers only the caller's values. The existing rooms-only Realtime
channel invalidates/refetches X/N; filter details are neither selectable nor
published.

Feature 004 also removes the normal candidate consumer and revokes authenticated
EXECUTE on `ensure_room_candidate`. This prevents fixture assignment/exposure
through UI, direct RPC and recovery while preserving historical fixtures/FKs.
The flow stops at an explicit Feature 005 handoff and implements no resolution,
TMDB or candidate behavior.

## Technical Context

| Item | Selected context |
| --- | --- |
| Language/runtime | Strict TypeScript ~6.0.3; repository engines Node 24.20.x/npm 11.19.0. Planning host currently reports Node 22.23.2/npm 10.9.8, so executable validation must use the declared toolchain |
| Client | Expo 57.0.20, Expo Router 57.0.19, React/DOM 19.2.3, React Native 0.86.3, RN Web ~0.21.0 |
| Backend | Supabase JS 2.115.0, CLI 2.116.0, local PostgreSQL 17, Anonymous Auth, PostgREST/RLS and Postgres Changes |
| Storage | Existing `rooms`, `room_members`, fixture candidates; new enum, one private participant-filter relation and one room aggregate column |
| Client state | Existing focused React hooks/state and RN primitives; no new state/form/UI dependency |
| Testing | Jest 29/jest-expo/RNTL 13.3.3, pgTAP+dblink, Playwright 1.63.0, existing safe managed Docker browser/runtime |
| Target | Shared mobile-first iOS/Android/web source; functional real-stack web acceptance and native bundle checks |
| Performance | No invented SLA; one indexed owner lookup and one room-scoped lock per submission; automatic aggregate convergence under normal connectivity |
| Constraints | Fixed group; 19-value enum; Any=`[]`; inclusive 1900..current UTC year; both bounds; private details; monotonic X/N; first N/N freezes; no candidate |
| Scale/scope | Existing configured group size semantics; one row per voter, no roster, two RPCs, one projection/channel, three grouped new browser cases |
| External resources | No TMDB, movie/genre network request, new secret, provider, service or custom backend |

There are no `NEEDS CLARIFICATION` items. All product decisions are resolved in
the specification; technical choices and rejected alternatives are recorded in
[research.md](research.md).

## Constitution Check — Before Design

**PASS at planning level.** The authoritative inputs were read completely. The
specification has 35 functional requirements, six non-functional requirements,
14 success criteria, 31 numbered acceptance scenarios and no unresolved product
decision.

| Principle | Pre-design gate |
| --- | --- |
| I. Working behavior | Plan defines future clean migration, DB/client/browser/export and fresh-checkout evidence; artifacts alone will not be called implementation proof |
| II. Small vertical slices | Scope ends at private per-voter values plus durable N/N handoff; no Feature 005/006 dependency is implemented |
| III. Consistency | Explicitly evolves Ready→candidate and identifies affected migrations, RPCs, types, UI and E/F/G acceptance rather than preserving contradictory behavior |
| IV. Authoritative transitions | PostgreSQL owns membership, values, count and locking; RPC contracts cover auth, validation, retry, failure, stale state, concurrency and recovery |
| V. Least privilege | Filter table denied by default; own-detail RPC only; aggregate rooms projection only; fixture RPC privilege removed; C1 retained |
| VI. Reproducibility/schema | One additive migration, nonempty Feature003→004 evidence and one R01 generation point followed by check-only validation |
| VII. Acceptance evidence | Deterministic dblink lock/write proofs plus grouped real Auth/RPC/Realtime/browser flows; no presence-only oracle |
| VIII. Scope/simplicity | One relation, one summary, two RPCs, existing channel/primitives; no catalog, resolution, TMDB, candidate, swipe or speculative infrastructure |

No violation or exception requires Complexity Tracking.

## Existing Boundary Impact Inventory

| Current path/boundary | Current behavior | Planned evolution |
| --- | --- | --- |
| `supabase/migrations/20260910000000_generalized_room_membership.sql` | Ready is membership equality; rooms exposes five fields; create/join return eight; candidate RPC executable | Historical file unchanged; new migration adds filter count, recreates result shapes, installs filters/RPCs and revokes candidate EXECUTE |
| `public.room_members` | Private stable membership owner | Referenced by new filter PK/FK; membership schema/flags remain unchanged |
| `public.ensure_room_candidate(uuid)` | Any authorized Ready member can assign/return fixture | Authenticated EXECUTE revoked; owner-only historical function retained |
| `rooms.movie_candidate_id` / fixtures | Hidden Ready-only FK and four-row catalog | Values/FK/assets preserved but inaccessible and unrelated to filter handoff |
| `src/types/database.generated.ts` | Feature 003 rows/enums/functions | One intentional regeneration after complete new DB contract |
| `src/rooms/contracts.ts`, `service.ts`, `state.ts` | Eight-field create/join and five-field room projection | Add exact `filter_completed_count`, validate/derive monotonic all-complete |
| `src/rooms/use-room-subscription.ts` | One `rooms` UPDATE invalidation/refetch channel | Keep lifecycle/channel; refetch aggregate field and prevent stale regression |
| `app/room/[code].tsx` | Ready always mounts candidate hook/card | Render Waiting/filter/progress/handoff state; import/call no candidate code |
| `src/candidates/*` and four PNGs | Active candidate service/state/card | Retain as historical isolated code/assets unless unused checks require bounded cleanup; no normal route consumer |
| `supabase/tests/database/room_session.test.sql` | Membership schema/RPC/RLS/races | Add filter schema/RPC/privacy/count/locking/fault evidence |
| `supabase/tests/database/room_candidate.test.sql` | Available fixture authority and races | Preserve FK/catalog/ACL/invisibility classes; replace current normal availability with execute-denied/no-write suppression |
| Migration validator/fixtures | Pre-003→latest assumes callable candidate | Preserve membership evidence, evolve latest expectations, add focused nonempty Feature003→004 migration proof |
| Room/client tests | Membership projection and candidate integration | Extend exact contracts; add filter state/form/recovery; require zero candidate calls |
| `e2e/room-session.spec.ts` | E membership cases; some helpers wait for candidate | Keep 24/47, make assembly assertion candidate-free |
| `e2e/first-movie-candidate.spec.ts` | Eight F cases prove obsolete normal flow | Remove from normal discovery; keep completed artifacts and move meaningful invariants to SQL/client tests |
| `e2e/generalized-room-membership-qr.spec.ts` | G03/G04/G07 use candidate harnesses; G08 calls candidate directly | Keep nine/26, remove every candidate wait/call and replace with filters/progress/privacy/suppression |
| E2E diagnostics/config | 41 cases/91 identities and strict labels | Change reviewed inventory to 36/82 and add H01–H03; C1 behavior unchanged |

## Selected Architecture

### Persistence and representation

[Data model](data-model.md) is binding. `participant_filters.room_member_id` is
both PK and FK, so each voter has at most one current accepted filter and no
client-supplied owner. Genres are generated enum literals stored as a canonical
array; years are two required inclusive `smallint` columns. A default draft is
not a persisted/completed row.

The dedicated relation is preferred over member-attached nullable state because
it preserves membership immutability, separates the private RLS surface and
uses row existence as the sole completion fact. It adds no catalog/reference
table and no resolved constraint.

### Progress, completion and locking authority

`rooms.filter_completed_count` is the public summary. The submission transaction
locks the authorized room, inserts/updates only the caller's row, and increments
the summary only on first insertion. The committed invariant is summary = count
of voting members with filter rows. `count == required_voter_count` is exactly
all-complete and locked; no redundant phase/boolean/timestamp can disagree.

Every submission takes the same room lock, including edits. Thus the database
orders an edit/final-submit race: edit-first is frozen after its commit; final-
first causes the edit to return locked. Equal retries are no-write `unchanged`.
There is no delete, decrement or unlock operation.

### Privacy and API

The filter relation has RLS enabled and no normal table privileges/policies.
[RPC contract](contracts/participant-filter-rpcs.md) defines exact owner recovery,
submission, validation, nullability, idempotency and failure outcomes. Both RPCs
derive membership from Auth. Other voters and non-voting creators cannot request
details; all admitted room members receive only X/N from rooms.

Create/join add the summary field so immediate recovery is never falsely 0/N.
The direct refetch selects six fields. Client runtime parsing remains stricter
than generated structural types.

### Realtime and client flow

[Realtime contract](contracts/room-filter-projection-realtime.md) retains the
single exact-room `public.rooms` UPDATE channel. First submissions update the
room and invalidate every member; a private replacement emits no room event.
Initial system-ok refetch, coalescing, sequence/generation guards and error retry
remain unchanged. One route-level aggregate watermark merges exact join,
refetch, recovery and submission results: any may advance X/N, none may regress
it, and N/N dominates every late X<N response.

[Client contract](contracts/client-filter-flow.md) defines exact mobile-first
states: membership assembling; voter recovery/editable defaults; saved/editable
waiting; shared X/N; non-voting observer; frozen N/N/Feature005 handoff. Accepted
values and local draft are distinct. No state starts resolution or a movie.

### Candidate authority evolution

[Candidate suppression](contracts/candidate-suppression.md) is binding. Revoke
participant execution of the fixture RPC and remove its normal route consumer.
Do not merely hide the card, and do not gate the old RPC on N/N. Direct JWT,
reload, reconnect, re-entry, retries and preassigned legacy rooms must be unable
to assign or expose a fixture.

Historical Feature 002 invariant classes retained in current evidence are FK/
fixture preservation, hidden catalog/assignment, no direct mutation, isolation
and no-write suppression. Automatic Ready assignment/display, poster recovery
and participant-available candidate races remain valid completed-slice history
but are obsolete normal acceptance and leave Playwright discovery.

## Migration Strategy

Create exactly one new versioned migration after the six historical migrations.
Do not edit history. Within one transaction:

1. Add `rooms.filter_completed_count=0` and its bounds/assembly checks.
2. Create the enum, filter relation and exact-signature private array-validation
   helper as postgres-owned `IMMUTABLE STRICT SECURITY INVOKER` SQL with empty
   `search_path`, schema-qualified/`pg_catalog` references, and no client EXECUTE.
3. Apply postgres ownership, RLS and deny-by-default grants.
4. Drop/recreate create/join only because their exact return shape adds the count;
   preserve all Feature 003 logic/outcomes/lock order.
5. Create/harden the two filter RPCs.
6. Replace rooms column grants with the six-field projection.
7. Revoke authenticated candidate RPC execution.
8. Verify every existing room has zero filter count/no rows and unchanged room,
   member, invitation, timestamp and candidate values; retain rooms-only publication.
9. Notify PostgREST schema reload and commit.

Nonempty migration evidence covers voting/non-voting creator rooms, Waiting,
Ready/NULL candidate and Ready/preassigned candidate. Existing rooms begin 0/N;
no default filters are invented. The old candidate FK remains preserved and
invisible. The existing pre-003 chain validator's latest expectations must also
be reconciled so historical membership evidence remains runnable.

## Concurrency and Database Evidence

Use the established pgTAP+dblink technique with independent authenticated
READ COMMITTED sessions/PIDs, an owner-held room lock, observable
`pg_blocking_pids`/ungranted locks, bounded drains and per-session table-write
deltas. Browser request overlap corroborates but does not replace it.

Required deterministic trials:

| Trial | Required proof |
| --- | --- |
| Two distinct first submissions | Correct owner/value rows; two inserts; 0→1→2; no merge/swap |
| Final two submit concurrently from 1/3 | Each inserts once; exactly one transition reaches 3; never >3; one durable N/N |
| Edit wins before final | Hold edited transaction, prove final blocks, commit edit, then final freezes edited value |
| Final wins before edit | Hold final transaction, prove edit blocks, commit final, then edit returns locked/no write |
| Repeated same voter | One row/contribution; same canonical retry no write/xmin change; different overlap obeys lock |
| Lost acknowledgement | Commit real call while discarding result; recovery/equal retry returns same row/count with zero new writes |
| Failure between row/summary work | Test-scope fault rolls back both; prior rows/count unchanged; retry succeeds |
| Post-completion attempts | Every voter's different edit, non-voter and foreign attempts perform zero filter/room writes |

Compare exact private owner snapshots, filter/room xmin and `pg_stat_xact_user_tables`
deltas. SQL fixtures create zero GoTrue identities and leave no production fault
hook or open dblink connection.

## Acceptance Evolution, C1, R01 and R02

### C1

Keep the controlled capture policy and `__tests__/config/c1-capture.test.ts`
unchanged. Continue to forbid screenshots, trace, HAR, video, storage-state and
raw Auth/RPC/Realtime/private-filter dumps. Only reviewed scenario/location and
budget strings change; scanner findings must be zero. Normal assertions inspect
safe visible text/booleans, never diagnostic filter payloads.

### R01

After the complete migration, functions and pgTAP contract are green, run exactly
one intentional `npm run db:types`, immediately `npm run db:types:check`, and
review enum/table/room/RPC changes. Then perform an independent reset and
check-only comparison including hash/inode/size/mtime/ctime. Every later/fresh
validation is check-only. `scripts/database-types.mjs` remains unchanged.

### R02

Browser acceptance is regrouped, not multiplied by spec scenario:

| Inventory | Cases | Identities |
| --- | ---: | ---: |
| E membership/Auth, adapted | 24 | 47 |
| G generalized membership/QR, adapted | 9 | 26 |
| H01 validation/ownership/edit | 1 | 3 |
| H02 recovery/failure/lost acknowledgement | 1 | 3 |
| H03 concurrency/final freeze | 1 | 3 |
| **Complete** | **36** | **82** |

C1 adds exactly one identity: full+C1 = 83, leaving 67 below
`anonymous_users=150`. H-only+C1 = 10. C1 once + two full runs = 165, so the
second run waits outside the harness for a recovered window while the stack
stays running. Fresh checkout+C1 = 83. Repeatability+fresh = 248 across recovered
windows. Keep workers=1, retries=0, repeatEach=1; count failed/partial/targeted/
manual attempts, never raise 150, restart/reset to evade quota, retry 429 or
export sessions across cases.

H cases reuse identities across multiple deliberate rooms within the case:

- H01: defaults, all genre/year boundaries, distinct voter values, spoofed owner,
  invalid replacement preservation and valid pre-lock edit;
- H02: reload/reconnect/link/QR/code recovery, disconnected voter semantics,
  pre-commit failure, duplicate/overlap and real committed-response loss;
- H03: distinct/final concurrent submissions, both forced edit-vs-final orders,
  same-voter repeats, active-save response after observed N/N, equal final retry
  and all other castable post-N/N rejection/no-write behavior.

Adapt G03 for voting-creator 3-voter 0→N filter progress and zero automatic
candidate traffic; retitle G04 to remove candidate-era wording and prove non-voting
creator progress-only behavior; remove G07's candidate harness/held wait while
retaining its membership-only final-slot/late-join proof and zero candidate
calls; adapt G08 for cross-room filter probes. Direct candidate EXECUTE denial
belongs to pgTAP/migration evidence, not a browser probe. E Waiting/assembly/recovery cases
assert no form/candidate until Ready. Full traceability belongs in the later
tasks artifact; this plan does not generate tasks or run analyze.

The three new exact titles are:

```text
@filters H01 validates private owned filters and editable saved state
@filters H02 recovers filters through failures and lost acknowledgements
@filters H03 serializes final completion and freezes every filter
```

Register `participant-filters.spec.ts` in acceptance `testMatch`, map the tag to
safe reporter scenario `filters` and browser cases H01/H02/H03, and allow only
the reviewed test/support locations including `filter-harness.ts`. H01/H02 have
90-second case caps; H03 has 120 seconds for its bounded multi-room ordering
trials. Global timeout remains 600 seconds with workers1/retries0/repeatEach1.
Update `__tests__/config/e2e-diagnostics.test.ts` and
`__tests__/config/playwright-runtime.test.ts` to prove removal of F discovery,
the exact G04 title change, all H titles/budgets/timeouts/locations, testMatch and
the final 36/82 inventory.

## Implementation Phases and Green Checkpoints

These are future design phases, not generated tasks or completed work.

| Phase | Coherent deliverable | Minimum evidence before next phase |
| --- | --- | --- |
| 1 — DB authority and migration | Additive schema, RPCs, summary/lock, RLS, candidate privilege cutover, nonempty upgrade tests | Migration runner(s), clean reset, exact pgTAP including deterministic races/faults/privacy/suppression; no type write yet |
| 2 — Atomic typed/client cutover | One R01 generation; evolved room contract/channel; filter service/state/form; route candidate removal; unit/integration tests | Immediate type check, independent reset/check-only, lint/typecheck/full client, web/native exports; DB/client contract coherent, no partial release |
| 3 — Grouped real acceptance | Adapt E/G, retire F from normal discovery, add H01–H03 and exact C1/R02 metadata | C1, all 36 real cases/82 identities, scanner0; all 31 scenarios mapped; no candidate traffic/UI |
| 4 — Repeatability/fresh checkout | Re-run exact completed behavior and clean-source path | C1 once + two full runs across recovered windows; independent fresh checkout+C1/full; check-only R01 and cleanup |

Dependency: Phase 1 → Phase 2 → Phase 3 → Phase 4. The schema/RPC/generated
types/consuming client form one release cutover even though evidence is ordered;
do not ship or commit an incompatible intermediate contract. No phase requires
Feature 005.

## Fresh-Clone Validation Path

At the later implementation SHA, a disposable clone must use the declared
Node/npm and lockfile, start/configure the local Supabase stack, run pre-003→latest
and Feature003→004 nonempty migration evidence, clean reset, check-only generated
types, lint/typecheck/full client/DB, web and iOS/Android exports, managed C1 and
all 36 acceptance cases, scanner0, then verified owned cleanup. Record exact SHA,
commands/results/counts/type metadata/quota windows. No hosted service, TMDB,
physical device or copied secret/session is required.

## Project Structure

### Planning artifacts

```text
specs/004-participant-filters/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── participant-filter-rpcs.md
    ├── room-filter-projection-realtime.md
    ├── candidate-suppression.md
    └── client-filter-flow.md
```

`tasks.md` is present; task generation was completed as a separate workflow.

### Future implementation paths

```text
supabase/migrations/20260911000000_participant_filters.sql
supabase/tests/database/{room_session,room_candidate}.test.sql
supabase/tests/migration/{participant_filters.before,participant_filters.after}.sql
scripts/check-participant-filters-migration.mjs
scripts/check-room-membership-migration.mjs
src/types/database.generated.ts
src/rooms/{contracts,service,state,use-room-subscription}.ts
src/filters/{genres,contracts,service,state,use-participant-filter}.ts
src/filters/participant-filter-form.tsx
app/room/[code].tsx
__tests__/filters/*
__tests__/rooms/{contracts,service,state,use-room-subscription}.test.ts
__tests__/routes/room.test.tsx
__tests__/config/{e2e-diagnostics,playwright-runtime}.test.ts
e2e/{room-session,generalized-room-membership-qr,participant-filters}.spec.ts
e2e/support/{room-harness,filter-harness,safe-diagnostics,safe-reporter,sanitize-diagnostics}.ts
playwright.config.ts
scripts/run-e2e.mjs
supabase/config.toml                 # explanatory budget comment only
```

Existing feature-oriented Expo/Supabase layout is retained. No generic backend,
new app, cache, queue, catalog or event subsystem is introduced.

## Constitution Check — After Design

**PASS at planning level, all eight principles, no exception.**

- I/VII: quickstart defines executable migration, state-transition, privacy,
  Realtime, real-browser, repeatability and fresh-checkout evidence; planning
  makes no implementation claim.
- II/VIII: the minimum relation/summary/two-RPC/one-channel design stops exactly
  at the Feature 005 handoff and removes—not replaces—candidate behavior.
- III: every affected Feature 003/002 authority and acceptance class is explicitly
  reconciled; no obsolete Ready→candidate assertion is retained as current truth.
- IV: ownership, validation, atomic summary, idempotency, lock order, final
  transition, stale results, partial failure and recovery have exact owners and
  outcomes.
- V: filter details are deny-by-default, owner-only through hardened RPCs; shared
  data is X/N only; fixture execution is revoked; C1 is unchanged.
- VI: additive nonempty migration, one R01 write and later check-only/fresh-clone
  path keep schema/types/runtime reproducible.

## Complexity Tracking

No constitutional violation or approved exception. The dedicated relation and
stored summary are the minimum needed to satisfy private ownership plus shared
Realtime progress; their consistency is owned by one transaction. Rejected
alternatives are documented in research.md.

## Planning-Only Declaration

No implementation, migration, generated-type update, dependency installation,
service startup, application/database/browser test, tasks/analyze workflow,
source branch creation/switch, commit or push is part of this planning run.
