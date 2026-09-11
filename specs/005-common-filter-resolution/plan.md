# Implementation Plan: Common Filter Resolution

**Branch**: `main` (feature directory label `005-common-filter-resolution`)
**Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)
**Baseline**: `e4f92a1a445baaf73a5c72d5546f2759977529da`
**Status**: Planning complete; no Feature 005 implementation performed.

## Summary

After Feature 004 freezes the complete N/N filter set, any authorized room
member's client automatically invokes one hardened, idempotent resolution RPC.
PostgreSQL locks the room, validates the complete fixed voting group, derives
the inclusive year overlap, and atomically records one terminal room status.

`rooms.filter_resolution_status` is the participant-visible authority for
`pending | compatible | incompatible`. A compatible result has one private
server-only constraint row plus an ordered private set of anonymous genre
clauses. Each nonempty voter selection becomes one OR clause; the rows are ANDed
together. Any-genre voters add no clause. An incompatible result has no usable
constraint. The existing rooms-only Realtime channel invalidates/refetches the
status; clients never receive years, clauses, voter identities or filter rows.

The dedicated RPC is deliberately separate from Feature 004's final-save
transaction. This preserves the completed freeze contract, supports
already-frozen rooms, permits a failed resolution attempt to roll back while
N/N remains frozen and retryable, and needs no trigger, job, Edge Function or
client-side eligibility calculation. Feature 005 fetches and displays no movie.

## Technical Context

| Item | Selected context |
| --- | --- |
| Language/runtime | Strict TypeScript ~6.0.3; repository engines Node 24.20.x/npm 11.19.0. Planning host toolchain is not acceptance evidence |
| Client | Expo 57.0.20, Expo Router 57.0.19, React/DOM 19.2.3, React Native 0.86.3, RN Web ~0.21.0 |
| Backend | Supabase JS 2.115.0, CLI 2.116.0, local PostgreSQL 17, Anonymous Auth, PostgREST/RLS and Postgres Changes |
| Storage | Evolve `public.rooms`; add one public status enum and two deny-by-default private constraint relations |
| Client state | Existing route-scoped React hooks/reducers and React Native primitives; no new state/UI dependency |
| Testing | Jest 29/jest-expo/RNTL 13.3.3, pgTAP+dblink, Playwright 1.63.0, existing managed local stack and safe diagnostics |
| Target | Shared mobile-first iOS/Android/web source; functional real-stack web acceptance and native bundle checks |
| Performance | No invented SLA; one indexed room lock/read and work linear in the fixed voters plus their selected genres |
| Constraints | Resolve only frozen N/N; max/min inclusive years; per-voter OR/group AND; Any neutral; terminal status; private payload; no movie |
| Scale/scope | Existing generalized fixed-group semantics; one room status, one compatible payload, zero-or-more anonymous clauses, one RPC, one channel |
| External resources | None: no TMDB, catalog, movie metadata, provider, new secret, service, queue or background worker |

There are no `NEEDS CLARIFICATION` items. Product semantics are fixed by the
specification; technical decisions and rejected alternatives are recorded in
[research.md](research.md).

## Constitution Check — Before Design

**PASS at planning level.** The constitution, product vision, roadmap, testing
strategy, Feature 005 specification/checklist, Feature 004 specification,
plan/contracts and relevant implementation were read completely. The active
specification has no unresolved product decision.

| Principle | Pre-design gate |
| --- | --- |
| I. Working behavior | The plan identifies future migration, DB/client/browser/export and fresh-checkout evidence; planning artifacts are not implementation evidence |
| II. Small vertical slices | The slice ends at one stable constraint/status handoff and adds no TMDB or candidate behavior |
| III. Consistency | Feature 004's N/N endpoint is explicitly evolved while membership, filter ownership, freeze and suppression remain authoritative |
| IV. Authoritative transitions | PostgreSQL owns validation, calculation, locking, terminal persistence, retry, rollback and recovery |
| V. Least privilege | Only approved status is participant-readable; source filters and resolved payload remain behind deny-by-default server boundaries |
| VI. Reproducibility/schema | One additive migration, nonempty Feature004→005 evidence, clean reset and one R01 write point are planned |
| VII. Acceptance evidence | Exact algebra and races belong to pgTAP/dblink; client state belongs to Jest; three bounded real-stack journeys prove cooperation |
| VIII. Scope/simplicity | One operation, existing room lock/channel and normalized private payload are sufficient; no speculative catalog or infrastructure is introduced |

No violation or exception requires Complexity Tracking.

## Existing Boundary Impact Inventory

| Current path/boundary | Feature 004 baseline | Planned Feature 005 evolution |
| --- | --- | --- |
| `public.rooms` | Six client-readable fields; N/N is frozen handoff | Add safe `filter_resolution_status`; terminal values require N/N |
| `public.participant_filters` | One private canonical row per voter; immutable at N/N | Remains unchanged and private; resolver reads every fixed voter row under the room lock |
| `submit_my_participant_filter(...)` | Final insert atomically reaches N/N and freezes; no resolution | Signature, outcomes and write semantics stay unchanged; its N/N response may trigger the separate resolver client-side |
| `get_my_participant_filter(uuid)` | Owner-only accepted detail recovery | Unchanged; voters may still recover only their own frozen detail |
| `create_room` / `join_room` | Nine result fields including X/N | Add status to accepted/re-entry projections; rejected rows keep every projection field NULL |
| rooms SELECT/RLS | Own-room exact six-column projection | Exact seven-column projection adds status only; private constraint remains unselectable |
| rooms Realtime | One exact-room UPDATE invalidation/refetch channel | Same channel; terminal status UPDATE causes refetch; no new publication/channel/payload detail |
| room/filter client state | Monotonic X/N and frozen own-detail surface | Add monotonic pending→one-terminal status plus automatic one-flight resolver and retry/error overlay |
| room route | N/N says Feature 005 is next | N/N pending resolves automatically, then renders compatible or terminal incompatible next action |
| candidate authority | Participant RPC revoked; normal route has no candidate consumer | Unchanged and suppressed through pending, failure and both terminal outcomes |
| database evidence | Filter schema/RPC/RLS/freeze/races | Add result algebra, private payload, resolver ACL/rollback/retry/concurrency and frozen-xmin evidence |
| browser evidence | Permanent smoke G03/G04/G05/G08/H01; H02/H03 historical owner evidence | Update evolved smoke terminals; add I01-I03; select H03 once for the N/N→resolution impact |

## Selected Architecture

### Authoritative state and private payload

[Data model](data-model.md) is binding. Add
`public.filter_resolution_status = pending | compatible | incompatible` and a
non-null `rooms.filter_resolution_status` defaulting to `pending`. This safe
room column is the sole participant-visible resolution authority and is the
only new data carried by create/join/refetch/Realtime recovery.

A compatible room has exactly one `private.room_filter_resolutions` row with
the inclusive common years. Its zero-or-more
`private.room_filter_resolution_genre_clauses` children contain nonempty,
canonical `participant_genre[]` OR clauses. They are ordered deterministically
and carry no member/Auth/filter-row ID. Zero clauses means every voter selected
Any and the genre predicate is true. An incompatible room has no private usable
constraint. Pending and failed attempts likewise have none.

The status/payload split prevents the rooms Realtime publication from carrying
the private constraint. It avoids JSON grammar, multidimensional-array and
literal-intersection errors while retaining the exact boolean predicate.
Tables are postgres-owned, RLS-enabled, grant-free and absent from Realtime.

### Resolution trigger and RPC

[Resolution RPC contract](contracts/common-filter-resolution-rpc.md) defines
`public.resolve_common_filters(uuid)`. Every authorized route automatically
calls it when its authoritative room state first has frozen N/N plus `pending`.
The same condition on reload, reconnect or re-entry is the recovery trigger.
Any authorized member, including a non-voting creator, may invoke it; no caller
supplies voter/filter identity and no response contains the constraint.

The RPC first authorizes membership, then locks only that room. Below N/N it
returns pending with no write. At terminal status it verifies and returns the
existing result with no write. At pending N/N it validates exact membership,
filter count/ownership/freeze invariants, aggregates all voter years, writes a
compatible payload and clauses when applicable, and changes the room to exactly
one terminal status in the same transaction.

This dedicated operation is chosen instead of a trigger or modifying Feature
004's final-submit transaction. It makes an operationally failed attempt a
rollback that leaves frozen N/N plus pending for bounded retry, supports rooms
that were already N/N when the migration arrived, and avoids a background
system. The client starts work but never derives or supplies the result.

### Determinism, idempotency and concurrency

All first attempts serialize on the existing room row at READ COMMITTED. The
winner computes and commits; every waiter re-reads the committed terminal status
and returns it without updating room/payload rows. Primary/foreign keys prevent
duplicate parent or clause ordinals. There is no request ledger because terminal
state, the room lock and frozen source rows make the operation naturally
idempotent.

The resolver orders each already-canonical nonempty genre array by its enum
values and assigns clause ordinals by clause value with private member ID used
only as a stable tie-breaker for identical clauses. The member ID is not stored
in or returned with the resolved predicate. Duplicate equal clauses remain
separate rows, so every constrained voter is represented once without exposing
who selected it.

A transaction exception rolls back the parent, every clause and room status.
It never mutates `participant_filters`. A response lost after commit is recovered
through the room projection or an equal resolver retry. A contradictory terminal
outcome is an integrity failure, never a last-writer-wins update.

### Client status and recovery

[Client flow](contracts/client-resolution-flow.md) adds one feature-local
resolution state/hook. Below N/N the existing Feature 004 UI remains authority.
At N/N pending, the hook shares one promise across effect replay/duplicate calls
and renders resolving. A safe transport/integrity exception retains pending,
shows a distinct transient failure and offers Retry. A later room refetch or RPC
response may advance to one terminal state and clears the local failure.

The route-level watermark merges exact create/join, refetch and resolver results:
pending may advance to compatible or incompatible; a delayed pending cannot
regress a terminal value; equal terminal results are no-ops. A resolver `pending`
response to an N/N-triggered call becomes a bounded retryable error rather than
an automatic loop. Different terminal values set a generation-scoped integrity
overlay that suppresses all ready/next-step meaning until full room re-entry.
Room/code/request generations discard stale results.
The compatible UI says that candidate sourcing is the next feature but shows no
constraint or movie. Incompatible is terminal and links to the existing new-room
creation flow; it never enables filter editing. The Feature 004 form is evolved
at N/N to retain only progress, own read-only accepted detail and its recovery
control; it removes the stale “Feature 005 is next” heading. The new resolution
panel solely owns resolving/compatible/incompatible copy.

### Privacy, authorization and RLS

- `auth.uid()` is mandatory and membership is derived server-side.
- Missing and foreign rooms share `not_found`; a foreign caller obtains no room lock.
- The public resolver is postgres-owned `SECURITY DEFINER`, has empty
  `search_path`, schema-qualified SQL, exact-signature revokes and authenticated
  EXECUTE only.
- Private result tables have RLS enabled, no client policies/privileges and no
  Realtime publication. Direct writes and reads remain denied even to room members.
- Authenticated rooms SELECT stays column-granted and member-RLS-limited; only
  status joins the existing safe projection.
- Existing participant filters retain their no-table-access, owner-only RPC
  detail boundary. Resolution never returns a roster, clause count, years,
  genres, ownership marker or internal ID.
- No service-role secret or new credential enters client code, tests or artifacts;
  C1 remains unchanged.

### Realtime

[Projection/Realtime contract](contracts/room-resolution-projection-realtime.md)
retains exactly one `public.rooms` UPDATE subscription filtered by accepted room
UUID and selecting only `id` as invalidation payload. Resolution's only shared
write updates room status and `updated_at`, so all authorized clients refetch the
seven safe fields. A missed event is recovered by system-ok refetch. No Presence,
Broadcast, polling, participant-filter publication, private-result publication
or second channel is justified.

### Feature 006 handoff

[Internal handoff contract](contracts/feature-006-filter-handoff.md) is server-only.
Future candidate sourcing may proceed only when room status is `compatible` and
the matching private parent/clauses validate. It receives:

```text
inclusiveReleaseYear = [release_year_from, release_year_to]
genreCondition = AND over ordered clauses; each clause = OR over its genres
```

A movie genre set satisfies the condition iff it intersects every clause; the
empty clause list is true. The handoff carries no voter identity and no movie or
catalog. Pending/incompatible/failure return no constraint. Feature 006 must not
re-read individual filters, collapse clauses to union/intersection, or reinterpret
catalog emptiness as Feature 005 incompatibility.

## Migration Strategy

Create exactly one additive migration after
`20260911000000_participant_filters.sql`; edit no history. In one transaction:

1. Create the public status enum and add the non-null pending room column plus
   terminal-requires-frozen-N/N check.
2. Create the two private compatible-constraint relations, keys/checks, owner,
   RLS and deny-by-default ACLs; add neither to Realtime.
3. Recreate create/join only because accepted projection shape gains status;
   preserve every Feature 003/004 outcome, lock order and write rule.
4. Create/harden the one resolver RPC.
5. Replace rooms column grants with the exact seven safe fields.
6. Verify old rooms, members, filters, timestamps and candidate FKs byte/logically
   unchanged apart from the new pending default; verify zero private results and
   rooms-only publication; notify PostgREST and commit.

Existing Waiting, partial and frozen N/N rooms all migrate as pending. No filter
or resolved constraint is invented during schema installation. On the first
authorized observation of an already-frozen N/N room, the normal client invokes
the same resolver; concurrent observers converge exactly as for a newly completed
room. This lazy cutover is deterministic, recoverable and avoids a special
migration-only result algorithm.

Nonempty Feature004→005 migration evidence covers voting and non-voting creator
rooms, Waiting, partial, compatible-frozen, incompatible-frozen, NULL candidate
and preserved preassigned candidate cases. It compares source row values/xmin
before any post-migration resolution, then proves lazy resolution on preserved
N/N rows and returns the database to clean latest state.

## API and Client Boundaries

| Boundary | Planned change |
| --- | --- |
| `create_room(...)` | Accepted row adds `filter_resolution_status=pending`; retry/recovery returns stored status |
| `join_room(text)` | Accepted/re-entry row adds stored status; every rejected projection field is NULL |
| `refetchRoom(uuid)` | Exact seven fields add `filter_resolution_status`; member RLS remains authority |
| `resolve_common_filters(uuid)` | New get-or-resolve RPC returns only `not_found`, `pending`, `compatible` or `incompatible` with exact status/nullability |
| Feature 004 detail/submit RPCs | No signature, payload, outcome or authority change |
| Resolution client service | Sends room UUID only, strictly parses one row and maps raw failures to one safe message |
| Resolution hook/state | Auto one-flight at N/N pending; retry, stale-generation guards and monotonic terminal adoption |
| Room route | Adds resolving/error/compatible/incompatible presentation and existing new-room navigation; no candidate import/call |

## Concurrency and Database Evidence

Use the established pgTAP+dblink pattern: independent authenticated READ
COMMITTED sessions/PIDs, an owner-held room lock, bounded lock observation via
`pg_blocking_pids`/ungranted locks, controlled drains, exact snapshots/xmin and
`pg_stat_xact_user_tables` deltas. Browser overlap proves usability only.

| Deterministic trial | Required proof |
| --- | --- |
| Concurrent first compatible attempts | Both real RPCs block/serialize on one room; one parent/status write and exact clause rows; both return compatible |
| Concurrent first incompatible attempts | One status write, zero payload/clauses; both return incompatible |
| Repeated same client | Same terminal result; zero further writes; room/result/filter xmin unchanged |
| Committed-response loss | First call commits while result is discarded; refetch/retry returns existing terminal state with zero duplicate writes |
| Failure after partial internal work | Test-scope trigger aborts before commit; status stays pending, no parent/clause persists, all filter rows/xmin stay exact; retry succeeds |
| Stable compatible algebra | Exact max/min years, single-year overlap, all-Any, mixed Any, overlapping and disjoint genre sets yield canonical clause rows |
| Stable incompatible algebra | `max(from) > min(to)` alone yields terminal incompatible without catalog access or payload |
| Incomplete/foreign/non-voter calls | Partial room returns pending/no write; foreign masks as not_found/no lock; authorized non-voting creator may resolve but contributes no input |
| Frozen-source protection | Every attempt/failure/retry leaves participant-filter values, row count and xmin unchanged |
| Divergence defense | At most one room terminal value, at most one parent, exact contiguous clause ordinals and no terminal reversal |

Test-only fault objects are transaction-scoped/uniquely named, PID/mode guarded,
cleaned on every path and never shipped in a migration.

## Testing-Strategy Impact Matrix

`docs/testing-strategy.md` is normative. Feature 005 does not inherit the full
36-case/82-identity historical browser inventory.

| Observable boundary | Primary authority | Browser evidence | Historical selection / cost |
| --- | --- | --- | ---: |
| N/N pending → automatic authoritative resolution | DB lock/invariant tests + client state | I01/I02; G03/G04/H01 smoke terminals evolve | H03 once / 3 |
| Exact year algebra and anonymous CNF genre clauses | PostgreSQL | I01/I02 prove representative end-to-end statuses, not hidden payload | None / 0 |
| Concurrent first resolution, rollback, duplicate/no-write, lost response | PostgreSQL dblink/xmin/write deltas | I03 proves visible retry/lost-response recovery | H03 supports final-freeze handoff / included above |
| Status-only visibility and cross-room denial | PostgreSQL ACL/RLS + client parser | I02; permanent G08 ordinary-JWT smoke | None / 0 |
| Room status projection, Realtime invalidation/refetch and stale guards | Client tests + DB state | I01/I02; G03/G04/H01 smoke | None / 0 |
| Feature 004 own-filter recovery/edit/lock contract | Existing Feature 004 DB/client suites | No Feature 005 change | H02 not selected / 0 |
| QR/link/code/Auth/membership/capacity lifecycle | Existing authority + permanent G05/G03/G04 | No implementation change beyond added parsed status | No non-smoke E/G / 0 |
| Candidate suppression through new states | Existing ACL + route/client tests | I01-I03 and evolved smoke require zero calls/UI | None / 0 |
| E2E harness/safe diagnostics | Existing config tests and C1 | No cross-cutting harness semantics planned | None / 0; full historical gate not triggered |

H03 is selected once because the client auto-trigger is deliberately coupled to
the first frozen N/N observation, including concurrent final submissions and a
lost final-save confirmation. Its exact filter-freeze assertions remain intact;
only its post-N/N terminal expectation evolves. H02 is not selected because the
Feature 004 recovery/submit RPC, editable period and locked-detail behavior are
unchanged. G03/G04/G05/G08/H01 already run in permanent smoke.

### Feature 005 owner acceptance

| Case | Identity cap | New real-stack responsibility |
| --- | ---: | --- |
| I01 | 3 | Voting creator + two voters: partial→N/N→compatible; max/min years, Any plus disjoint genre clauses, convergence, reload/reconnect/re-entry and zero candidate |
| I02 | 4 | Non-voting creator + three voters: disjoint years→terminal incompatible; no creator input, status-only privacy, missed-update recovery, new-room action and no handoff/candidate |
| I03 | 2 | Voting creator + voter across bounded rooms: pre-commit transport failure, retry, committed-response loss, stable recovery, unchanged frozen filters and failure≠incompatible |
| **F total** | **9** | Within the recommended envelope |

### Projected R02 budgets

With `F=9`, targeted `T=3`, permanent smoke `16` and C1 `1`:

| Gate | Formula | Identities |
| --- | --- | ---: |
| Normal checkpoint | `1 + 16 + 9 + 3` | **29** |
| Repeatability | `1 + 2 × (16 + 9) + 3` | **54** |
| Fresh checkout | `1 + 16` | **17** |
| Repeatability plus fresh checkout | `54 + 17` | **71** |

Targeted H03 runs once and is not repeated. The first owner+smoke execution is
the normal checkpoint. Every actual/failed/partial/manual attempt remains charged
under R02; workers=1, retries=0 and repeatEach=1 remain unchanged. Full historical
acceptance is reserved for the policy's explicit triggers, not this plan.

## R01

Finalize the complete migration, RPC signatures, grants and database contract
tests before generated types change. Then run exactly one intentional
`npm run db:types`, immediately run `npm run db:types:check`, and review the new
room enum/column and create/join/resolver signatures. After an independent clean
reset, run check-only comparison with the existing hash/inode/size/timestamp
receipt. Every later normal, repeatability and fresh-checkout validation is
check-only. `scripts/database-types.mjs` needs no behavior change.

## Implementation Phases and Green Checkpoints

These describe future implementation slices, not tasks and not completed work.

| Phase | Coherent deliverable | Minimum evidence before the next phase |
| --- | --- | --- |
| 1 — DB authority | Additive status/private payload/resolver migration and nonempty upgrade fixture | Migration checker, clean reset, pgTAP ACL/algebra/rollback/deterministic races; no type write yet |
| 2 — Typed client cutover | One R01 write; exact room/resolution contracts, state/hook, route states and tests | Immediate and independent check-only types, lint, typecheck, full client, DB, web/native exports |
| 3 — Bounded real acceptance | Add I01-I03, evolve permanent smoke and targeted H03 metadata/assertions | C1, F=9, smoke=16, H03=3, scanner zero and exact R02 receipt |
| 4 — Repeatability/fresh checkout | Reproduce completed behavior from unchanged source and exact SHA | 54-identity repeatability across admitted window plus independent 17-identity fresh-checkout gate |

Dependency is Phase 1 → 2 → 3 → 4. Schema, generated types and client form one
release cutover even though evidence is ordered; do not ship an incompatible
intermediate contract. No phase implements Feature 006.

## Project Structure

### Planning artifacts

```text
specs/005-common-filter-resolution/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── common-filter-resolution-rpc.md
    ├── room-resolution-projection-realtime.md
    ├── client-resolution-flow.md
    └── feature-006-filter-handoff.md
```

No `tasks.md` is created by this workflow.

### Future implementation paths

```text
supabase/migrations/20260912000000_common_filter_resolution.sql
supabase/tests/database/{room_session,room_candidate,common_filter_resolution}.test.sql
supabase/tests/migration/{common_filter_resolution.before,common_filter_resolution.after}.sql
scripts/{check-common-filter-resolution-migration,run-e2e}.mjs
src/types/database.generated.ts
src/rooms/{contracts,service,state,use-room-subscription}.ts
src/filters/participant-filter-form.tsx
src/resolution/{contracts,service,state,use-common-filter-resolution}.ts
src/resolution/common-filter-resolution-panel.tsx
app/room/[code].tsx
__tests__/resolution/*
__tests__/filters/participant-filter-form.test.tsx
__tests__/rooms/{contracts,service,state,use-room-subscription}.test.ts
__tests__/routes/room.test.tsx
__tests__/config/{e2e-diagnostics,playwright-runtime}.test.ts
e2e/{common-filter-resolution,participant-filters,generalized-room-membership-qr}.spec.ts
e2e/support/{resolution-harness,filter-harness,room-harness,safe-diagnostics,safe-reporter}.ts
playwright.config.ts
```

The existing Expo/Supabase feature layout is retained. No generic backend,
catalog, cache, queue, job, Edge Function or second state channel is introduced.

## Constitution Check — After Design

**PASS at planning level, all eight principles, no exception.**

- I/VII: [quickstart.md](quickstart.md) defines reproducible migration, exact DB
  authority, client, bounded real-stack, repeatability and fresh-checkout evidence;
  the plan claims no working implementation.
- II/VIII: one room status, one private compatible payload, one resolver and the
  existing channel are the smallest coherent slice; TMDB/candidate/ranking/swipe/
  progression/match/filter reopening remain excluded.
- III: Feature 004 freeze/privacy/RPCs and candidate suppression are preserved;
  the N/N terminal UI, result projections, contracts and selected evidence are
  explicitly evolved together.
- IV: authorization, complete-input validation, exact algebra, atomic terminal
  write, lock ordering, duplicate calls, stale state, rollback, lost response and
  recovery all have documented owners and outcomes.
- V: clients see only status/next action; both source and resolved detail are
  deny-by-default; no new secret or participant identity surface exists.
- VI: one additive migration, preserved nonempty rows, one intentional type write,
  later check-only validation and exact-SHA fresh checkout keep evolution reproducible.

No post-design gate failed and no constitution amendment is required.

## Complexity Tracking

No constitutional violation or approved exception. Two private relations are
the minimum normalized representation that preserves variable-length AND-of-OR
clauses without JSON or multidimensional-array ambiguity. The public room column
contains only the approved shared status needed by the existing Realtime model.

## Planning-Only Declaration

No implementation, migration, generated-type update, dependency installation,
service startup, application/database/browser test, tasks/analyze workflow,
source branch creation/switch, commit or push is part of this planning run.
