# Implementation Plan: Candidate Progression

**Branch**: `main` (feature directory label `008-candidate-progression`)

**Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

**Baseline**: `bd3233f3916f1280bf9d4bf1e7e2fef51752c182`
**Status**: Approved implementation plan; analysis findings remediated; no
Feature 008 implementation performed.

**Owner Approval**: APPROVED — 2026-09-18

**Input**: Feature specification from
`/specs/008-candidate-progression/spec.md`

## Summary

Add a durable candidate-occurrence ledger and a privacy-safe room progression
projection. PostgreSQL remains the authority for voter identity, immutable
decisions, complete-set detection, the integer-only agreement threshold, and
the single transition from a collecting occurrence to either `agreed` or
`rejected`. The final accepted decision is resolved in the same database
transaction under the existing room-row lock. Agreement leaves the current
candidate installed and terminal; rejection closes that occurrence and places
the room in a durable `advancing` state.

TMDB network work stays in the existing `room-candidate` Edge Function. The
function reuses Feature 006's frozen constraint and bounded search, adds the
room's server-supplied resolved-candidate exclusion set, and commits a proposal
only against the rejected occurrence's expected sequence. Search runs outside
the database transaction; a room lock, expected sequence, unique occurrence
ordinal, and unique room/TMDB pair make the commit an idempotent compare-and-set.
A competing caller either adopts the one installed successor, observes stable
exhaustion, or refetches newer canonical state. It cannot install a second
successor or skip an ordinal.

The existing rooms-only Realtime invalidation/refetch channel carries two new
safe fields: progression status and candidate sequence. Client room merges
become sequence-aware, candidate and decision generations include that sequence,
and stale callbacks/actions are retired. UI adds only collecting, advancing,
retryable failure, agreed/stopped, and no-further-candidate meanings. It adds no
Match experience and no second decision or candidate-source path.

## Technical Context

**Language/Version**: Strict TypeScript ~6.0.3; Node.js 24.20.x and npm 11.19.0
as declared by the repository; Deno 2.5.2 for Edge tests/functions; PostgreSQL
17. The planning host reports Node 24.12.0/npm 11.6.2, so executable gates must
use the declared toolchain.

**Primary Dependencies**: Expo 57.0.20, Expo Router 57.0.19, React 19.2.3,
React Native 0.86.3, React Native Web ~0.21.0,
`@supabase/supabase-js` 2.115.0, Supabase CLI 2.116.0, Playwright 1.63.0,
Jest 29.7 and the already installed Feature 007 gesture stack. No new runtime
dependency is planned.

**Storage**: Existing Supabase PostgreSQL. One additive migration adds two
closed enums, a grant-free candidate-occurrence relation, room progression
status/sequence, occurrence-bound decision keys, indexes/constraints, and
rewritten room/decision/candidate RPC projections. Existing room, membership,
filter-resolution, TMDB identity and decision data are migrated in place.

**Testing**: Jest and React Native Testing Library for strict contracts,
reducers, hooks and UI; Deno tests for the Edge orchestration and TMDB exclusion
traversal; pgTAP plus dblink for database authority and deterministic locking;
Playwright for bounded real-stack browser acceptance; existing protected
migration runners, generated-type check, lint, TypeScript, web/native export,
credential-safe diagnostics and artifact scanning.

**Target Platform**: Shared Expo Android/iOS/web client; automated owner
acceptance on Chromium web; Supabase PostgreSQL/Auth/Data API/Postgres Changes;
the existing Deno `room-candidate` Edge Function and TMDB provider boundary.

**Project Type**: Mobile-first Expo application with functional web access and
a Supabase PostgreSQL/Auth/Realtime/Edge backend.

**Performance Goals**: Under the controlled healthy local browser profile, all
already-open authorized clients converge on the same progression outcome and
candidate meaning within 5 seconds of the authoritative database transition.
Feature 006's bounded search remains at its existing 100-request/20-second
defaults unless its approved contract returns earlier. No new latency promise
is attached to an unavailable external provider.

**Constraints**: Fixed assembled voting group; no early resolution; threshold
`2` for `N = 2`, otherwise `((2 * N::bigint) + 2) / 3` using integer division;
Feature 007 first-write-wins decisions; Feature 006 as the only candidate
source; no resolved-candidate repeat within a room session; no direct client
writes; private per-voter values; one rooms Realtime channel; no Match UX,
threshold modes, decision editing, dynamic membership or alternate source.

**Scale/Scope**: One current occurrence per room, a compact immutable occurrence
history and one decision per fixed voter/occurrence. Threshold tests cover
`N = 2..10`; the existing product does not impose a new participant-count cap.
Two current-feature browser cases use six identities total.

## Constitution Check — Before Phase 0

**PASS at planning entry; no exception, amendment or unresolved decision.**

| Principle | Pre-design assessment |
| --- | --- |
| I. Working behavior is primary evidence | The plan defines migration, DB, Edge, client, browser, build/export, repeatability and fresh-checkout evidence without claiming any implementation gate has run. |
| II. Small verifiable vertical slices | Database outcome authority, source sequencing, client convergence and bounded acceptance are separable green checkpoints. None depends on Feature 009. |
| III. Artifact consistency | The completed specification, Features 003/006/007 contracts, occurrence model, RPC contracts and traceability gate use the same fixed membership, full-set timing and outcome meanings. |
| IV. Explicit authoritative transitions | PostgreSQL owns complete-set resolution; the durable `advancing` barrier and expected sequence protect the external-source phase. Validation, duplicate, retry, stale, concurrency, partial failure and recovery behavior are explicit. |
| V. Security and least privilege | Detail tables stay RLS-enabled, grant-free and outside Realtime. Authenticated decision RPCs derive `auth.uid()`; candidate-source prepare/commit RPCs remain service-role-only; public rooms expose only safe progress/sequence fields. |
| VI. Reproducible schema evolution | One versioned migration, a nonempty Feature 007→008 cutover proof, clean reset, one controlled generated-type write and later check-only validation are required. Historical migrations remain immutable. |
| VII. Executable acceptance evidence | PostgreSQL owns arithmetic/locks/ACLs, Deno owns provider orchestration, client tests own stale-generation behavior, and L01/L02 prove representative real cooperation within the identity budget. |
| VIII. Explicit scope and simplicity | The design reuses the room lock, decision RPC path, room subscription and Edge source. It adds only the occurrence identity and progression state required for safe sequencing; Match and early resolution remain absent. |

## Project Structure

### Documentation (this feature)

```text
specs/008-candidate-progression/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── requirements-traceability.md
├── quickstart.md
├── tasks.md
└── contracts/
    ├── progression-decision-rpcs.md
    ├── candidate-source-sequencing.md
    ├── room-progression-realtime.md
    └── client-progression-flow.md
```

`tasks.md` now contains the approved, dependency-ordered implementation and
evidence work. Every task remains unchecked; its presence records planned work,
not implementation progress.

### Future implementation paths

```text
package.json

app/
└── room/[code].tsx

docs/
└── testing-strategy.md

src/
├── candidates/{contracts,service,state,use-room-candidate}.ts
├── decisions/{contracts,service,state,use-candidate-decision}.ts
├── progression/
│   └── candidate-progression-status.tsx
├── rooms/{contracts,service,state,use-room-subscription}.ts
└── types/database.generated.ts

supabase/
├── functions/
│   ├── _shared/{candidate-contracts,tmdb-client}.ts
│   ├── _tests/{room-candidate,tmdb-search}.test.ts
│   └── room-candidate/index.ts
├── migrations/20260918000000_candidate_progression.sql
└── tests/
    ├── database/
    │   ├── candidate_progression.test.sql
    │   ├── swipe_decisions.test.sql
    │   └── tmdb_candidate_source.test.sql
    └── migration/
        ├── candidate_progression.before.sql
        └── candidate_progression.after.sql

__tests__/
├── candidates/{contracts,service,state,use-room-candidate}.test.ts
├── decisions/{contracts,service,state,use-candidate-decision}.test.ts
├── progression/candidate-progression-status.test.tsx
├── rooms/{contracts,state,use-room-subscription}.test.ts
├── routes/room.test.tsx
└── config/{database-types,e2e-diagnostics,feature008-e2e-profile}.test.ts

e2e/
├── candidate-progression.spec.ts
├── generalized-room-membership-qr.spec.ts
├── swipe-decisions.spec.ts
└── support/
    ├── candidate-harness.ts
    ├── decision-harness.ts
    ├── progression-harness.ts
    ├── room-harness.ts
    ├── safe-reporter.ts
    └── tmdb-stub.ts

scripts/
├── check-candidate-progression-migration.mjs
└── run-e2e.mjs
```

**Structure Decision**: Retain the existing feature-local Expo modules, one
versioned SQL cutover, one rooms subscription and the one Feature 006 Edge
Function. Progression status presentation gets one small component module;
sequencing authority does not move into a new client service. The Edge Function
is required only because TMDB I/O cannot run inside PostgreSQL; every durable
outcome and sequence transition remains database-owned.

## Architecture and Authority Flow

```text
voter submits through existing decision RPC
  -> lock public.rooms row
  -> validate Auth member, fixed voter, expected sequence + TMDB identity
  -> validate occurrence/detail/room summary integrity
  -> insert first immutable decision or recover the stored decision
  -> if count < N: update current count only; remain collecting
  -> if count = N: calculate T with integer arithmetic in the same transaction
       -> Y >= T: occurrence=agreed, room=agreed, retain candidate
       -> Y <  T: occurrence=rejected, room=advancing, clear active identity,
                   reset current count to 0

room=advancing at rejected sequence k
  -> existing room-candidate Edge Function requests server-private preflight
  -> RPC authorizes actor without joining a foreign room lock queue
  -> lock the authorized room row, then revalidate authorization + handoff
  -> preflight returns frozen constraints + all prior room TMDB IDs + k
  -> existing bounded TMDB search skips excluded IDs
       -> incomplete/failure: no database write; room stays advancing
       -> match: commit(expected k, proposal) under room lock
            -> insert exactly occurrence k+1 + install it, or adopt winner
       -> completed empty: commit exhaustion(expected k) under room lock

every durable room UPDATE
  -> existing public.rooms Realtime invalidation
  -> member-scoped canonical refetch
  -> compare candidate_sequence, then legal same-sequence phase
  -> recover metadata and own current decision through existing boundaries
```

The final-decision transaction and successor-source transaction are intentionally
separate. Holding a PostgreSQL transaction/row lock during network search would
make provider latency part of database serialization and would not make TMDB
atomic. The durable `advancing` state is the transaction boundary between them.
Together, `(room_id, rejected candidate_sequence)` names one logical progression
step. Only a commit expecting that exact step may install `sequence + 1` or mark
it exhausted.

The requested logical operation maps to enforcing boundaries as follows:

1. the final-decision transaction preauthorizes the actor without joining a
   foreign room lock queue, locks the authorized room, revalidates authorization,
   and identifies its current occurrence from sequence plus private TMDB identity;
2. it validates fixed membership and counts occurrence-bound accepted rows;
3. at exactly `N`, it computes the integer threshold;
4. it derives the outcome from the private authoritative yes count;
5. agreement is persisted once by closing the occurrence and room as `agreed`;
6. rejection is persisted once as `advancing`, after which the existing Edge
   Function obtains one Feature 006 source result outside the transaction;
7. the candidate commit preauthorizes without a foreign-room lock, then locks
   the authorized room, revalidates authorization/handoff and compares the
   rejected expected sequence before accepting one proposal;
8. that same commit inserts exact ordinal `k+1`, installs it and leaves its
   decision count at 0, or commits exhaustion without an occurrence; and
9. a decision result may carry its complete lock-consistent projection, while an
   Edge result carries metadata only; the room UPDATE and member-scoped canonical
   refetch supply progression/count authority for all callers to converge.

Thus external retrieval is not falsely described as SQL-atomic, while the two
database boundaries enforce one indivisible outcome and one indivisible
successor/terminal commit around a durable logical-step key.

## Candidate Occurrence and Room State Model

The migration creates `public.room_candidate_occurrences` as protected history:

- UUID primary key used by protected decisions;
- `room_id`, positive `sequence`, positive `tmdb_movie_id`;
- occurrence status `collecting | rejected | agreed`;
- `created_at` and nullable `resolved_at`;
- unique `(room_id, sequence)` to forbid two candidates at one ordinal;
- unique `(room_id, tmdb_movie_id)` to enforce the session no-repeat rule;
- one partial unique active row per room for `collecting` or `agreed`; and
- RLS enabled, no client policy/grant, and no Realtime publication.

`public.rooms` gains:

- `candidate_progression_status`:
  `inactive | collecting | advancing | agreed | exhausted`; and
- `candidate_sequence`, starting at `0` before any candidate and increasing by
  exactly one only when a candidate occurrence becomes authoritative.

The existing `candidate_acquisition_status`, private `tmdb_movie_id` and safe
`decision_completed_count` remain. Their legal combinations become:

| Progression | Sequence | Acquisition | Private TMDB ID | Current count | Meaning |
| --- | ---: | --- | --- | ---: | --- |
| `inactive` | 0 | `pending` | null | 0 | No first candidate yet. |
| `inactive` | 0 | `no_candidates` | null | 0 | Feature 006 original empty terminal. |
| `collecting` | >=1 | `assigned` | current ID | 0..N-1 | Current occurrence accepts decisions. |
| `agreed` | >=1 | `assigned` | agreed ID | N | Terminal Feature 009 handoff; no more source calls. |
| `advancing` | >=1 | `pending` | null | 0 | Last occurrence rejected; same step may retry source. |
| `exhausted` | >=1 | `no_candidates` | null | 0 | Last rejected step completed empty; terminal. |

A composite current-candidate foreign key from the non-null room
`(id, candidate_sequence, tmdb_movie_id)` to the matching occurrence triple
protects the collecting/agreed identity while allowing null identity in other
states. Check constraints reject illegal cross-field combinations and require
assembled compatible frozen filters for every active progression state.

Feature 007 decisions are migrated from movie-bound keys to occurrence-bound
keys. `candidate_decisions` gains `room_id` and `candidate_occurrence_id`, uses
composite foreign keys so the voter membership and occurrence belong to the
same room, and changes its primary key to
`(room_member_id, candidate_occurrence_id)`. The redundant decision-row
`tmdb_movie_id` is dropped after verified backfill; movie identity remains on
the occurrence. This makes repeated movie identity unable to inherit an older
decision even if a later feature changes today's no-repeat rule.

Full entity definitions, constraints and transitions are in
[data-model.md](data-model.md).

## Authoritative Resolution Transaction

The evolved `submit_room_candidate_decision` remains the only write path for a
participant decision. It first authorizes the actor through an unlocked
membership lookup so a foreign caller never joins the room lock queue, then
locks that authorized room row and revalidates authorization before performing
the following inside one PostgreSQL transaction:

1. derive the actor from `auth.uid()` and revalidate authorized membership under
   the room lock;
2. validate fixed-voter status, room readiness, expected sequence and expected
   TMDB identity; allow `collecting` for a new write and `agreed` only for
   read-only duplicate/lost-response recovery of the matching occurrence;
3. count occurrence-bound decision detail and fail closed if membership,
   occurrence, summary count or candidate facts disagree;
4. recover a same-value duplicate as `unchanged` or an opposite repeat as
   `conflict`, with no writes;
5. insert the first accepted decision for the voter/occurrence;
6. if the new count is below `N`, update only the room count and return
   `collecting`;
7. only at exactly `N`, compute `T`: `2` for `N = 2`, otherwise
   `((2 * N::bigint) + 2) / 3`, count authoritative yes rows and compare `Y >= T`;
8. atomically mark the occurrence `agreed` and the room `agreed`, retaining the
   current identity/count, or mark the occurrence `rejected` and the room
   `advancing`, clearing the active identity and resetting current count to 0;
9. return the caller's stored decision plus safe occurrence-level completion,
   threshold and outcome fields so the initiating client can converge without
   exposing another decision.

There is no separate voting RPC, trigger, client tally or early-resolution
path. The threshold helper is private and shared by the final-decision logic and
migration backfill so arithmetic cannot drift. Its eligibility condition is
separate from the formula: Feature 008 calls it only at `N/N`, preserving a
future timing change without encoding early resolution now.

The read RPC supports only the current `collecting` or `agreed` occurrence. A
request for a rejected/older sequence returns `candidate_changed` with protected
fields null, causing canonical room recovery. An agreed current occurrence
remains readable for own-decision recovery, but it is not writable and exposes
no new voting controls.

## Concurrency and Idempotency Invariants

The concrete idempotency keys are not request IDs:

- decision idempotency: `(room_member_id, candidate_occurrence_id)`;
- outcome idempotency: the occurrence row's one-way
  `collecting -> agreed | rejected` transition under the room lock;
- progression-step idempotency: `(room_id, rejected candidate_sequence)`;
- successor identity/order: unique `(room_id, sequence + 1)` and unique
  `(room_id, tmdb_movie_id)`.

The room lock serializes distinct final voters. The first final caller that
observes fewer than `N` creates a normal decision; the caller that makes the
count exactly `N` resolves once. A duplicate final request then sees its stored
decision or a newer progression state and performs no second transition.

Candidate commit RPCs first preauthorize without a room lock, then lock only the
authorized room and revalidate authorization/handoff. They require both
`advancing` and the caller's `p_expected_candidate_sequence = k`. The winning commit can create
only ordinal `k + 1`. A second proposal for the same `k` finds either that exact
winner and returns it, or finds an exhausted/newer/terminal state and returns a
safe canonical outcome. It never inserts `k + 2`. A lost response is recovered
by the next preflight, which returns the already assigned candidate or terminal.
An agreed room never satisfies the preflight or commit transition predicate.

These invariants cover concurrent final decisions, duplicate/replayed decisions,
lost responses, two different proposals, completed-empty racing a proposal,
stale clients, late results and reconnect after commit.

## Candidate Source Reuse and Failure Model

The HTTP request remains the exact Feature 006 body `{ "room_id": <uuid> }` and
the existing authenticated `room-candidate` Edge Function remains the only TMDB
path. Server-only preflight adds the current sequence and a sorted, deduplicated
list of all occurrence TMDB IDs. Clients cannot supply or remove exclusions.

`searchTmdbCandidate` accepts the server-produced exclusion set and skips those
IDs while retaining the same date sharding, page/result validation, frozen
constraint, locale, adult exclusion, retry budget and eligibility predicate.
Only a full `completed_empty` traversal after exclusions may be committed as
exhaustion. `search_incomplete` remains HTTP 503/retryable and writes nothing.

Commit behavior is compare-and-set:

- initial `inactive/pending`, expected sequence 0 -> occurrence 1 collecting;
- `advancing` at `k`, match -> occurrence `k + 1` collecting;
- `advancing` at `k`, completed empty -> `exhausted` at `k`;
- same-step loser -> return the installed winner or terminal;
- state newer than the expected step -> `refresh_required`, no write.

Once a candidate commits, metadata or poster failure stays attached to that
identity and sequence. Retrying loads presentation for the installed identity;
it does not call Discover again. The original Feature 006 `no_candidates`
terminal remains `inactive/no_candidates`, distinct from progression exhaustion.

Exact interfaces are in
[candidate-source-sequencing.md](contracts/candidate-source-sequencing.md).

## RPC, Privacy and RLS Boundary

- `get_room_candidate_decision` and `submit_room_candidate_decision` remain the
  only authenticated decision interfaces. Both add the expected candidate
  sequence; neither accepts a user/member ID.
- Individual decision and occurrence tables keep RLS enabled, no permissive
  policies, no ordinary-client privileges and no Realtime publication.
- Candidate prepare/commit functions remain executable only by `service_role`.
  They receive the JWT-verified actor UUID from the existing Edge boundary and
  use one exact protocol: authorize through an unlocked actor/room membership
  lookup without joining a foreign room lock queue, lock only the authorized
  room row, then revalidate authorization and the applicable frozen handoff
  under that lock before revealing private state or committing a transition.
- Ordinary clients retain member-scoped `SELECT` only on the exact safe room
  columns. `candidate_progression_status` and `candidate_sequence` are added;
  `tmdb_movie_id`, occurrence IDs/history and all decision detail remain denied.
- Missing/foreign-room RPC branches preserve all-null protected shapes.
- Shared decision results expose own value, count, required count, threshold and
  `collecting | agreed | rejected`; they expose no yes tally, peer value, peer
  identity, timestamp or roster.

The exact signatures and response rules are in
[progression-decision-rpcs.md](contracts/progression-decision-rpcs.md).

## Realtime, Canonical Recovery and Client Flow

`public.rooms` remains the sole Postgres Changes publication. An UPDATE is only
an invalidation hint; the existing member-scoped exact-column refetch is the
canonical state. No occurrence/decision channel or broadcast payload is added.

The client merge treats each strictly validated canonical room projection as one
node in a monotonic partial order. Its direct forward edges are:

```text
inactive(0,pending) -> inactive(0,no_candidates)
inactive(0,pending) -> collecting(1,0)
collecting(k,c)     -> collecting(k,c') where c' >= c and c' < N
collecting(k,c)     -> agreed(k,N) | advancing(k,0)
advancing(k,0)      -> exhausted(k,0) | collecting(k+1,0)
```

The merge uses the transitive closure of those edges. If local authority can
reach the incoming projection, adopt it; if the incoming projection can reach
local authority, ignore it as provably stale; if neither can reach the other,
fail closed as a genuine conflict. Thus a valid higher sequence may arrive as
`collecting`, `agreed`, `advancing`, or `exhausted`, and same-sequence
`collecting -> exhausted` is accepted when `advancing` was missed. An older
collecting/advancing observation is ignored, while an older terminal that could
not have led to the current state is conflicting rather than merely stale.

This deliberately replaces Feature 007's global `Math.max` decision-count merge.
Counts are monotonic only within one collecting occurrence; a forward successor
projection replaces the count exactly, and a client may jump several sequence
values or phases without inventing missed occurrences.

Candidate requests and decision requests are keyed by
`(room_id, candidate_sequence, tmdb_movie_id)` plus their local attempt token.
A strictly parsed decision RPC result may immediately merge its lock-consistent
room projection. Candidate Edge results never install room progression or
decision-count authority and never synthesize a fresh `0/N`; they may cache only
database-confirmed metadata for their sequence, trigger canonical room refetch,
and render that metadata only if the refetched projection still names the same
collecting/agreed generation. A delayed winner therefore preserves a successor's
already-increased count, and is discarded if that successor has advanced again.
Late callbacks with an older/different generation are retired.

Observable client states are minimal:

- collecting: current candidate and `x/N`; only undecided voters have controls;
- advancing: no active decision controls, source acquisition or safe Retry;
- successor collecting: one authoritative new card and fresh `0/N`;
- agreed: preserve the candidate, remove controls, show neutral stopped copy;
- exhausted: no active card/control/acquisition Retry, show stable no-further
  copy and an existing start-new-room/session action;
- metadata/poster failure: preserve the installed identity and offer the
  Feature 006 presentation Retry.

No state navigates to Match, celebrates, confirms a choice, changes a decision
or changes membership. See
[room-progression-realtime.md](contracts/room-progression-realtime.md) and
[client-progression-flow.md](contracts/client-progression-flow.md).

## Migration and Generated Types

Create one migration after `20260916000000_swipe_decisions.sql` and modify no
historical migration. The migration runs as one traffic-stopped contract
cutover and must:

1. lock affected room/decision tables and snapshot protected nonempty fixtures;
2. fail before repair if room counts, candidate identity, voter membership or
   decision detail disagree;
3. create enums, occurrence history, room progression fields and constraints;
4. materialize occurrence 1 for every existing assigned room;
5. map every existing decision to that occurrence and install the same-room
   composite foreign keys/new primary key;
6. resolve pre-existing complete sets during migration using the fixed threshold:
   agreed rooms retain occurrence 1; rejected rooms become `advancing` at 1;
   incomplete assigned rooms become `collecting`;
7. preserve original Feature 006 `no_candidates` rooms as `inactive` at 0;
8. replace the decision and candidate RPCs, append room projection fields,
   rebuild exact grants, and keep only `public.rooms` in Realtime;
9. verify row/data transformation, ACL/RLS/function ownership, history uniqueness,
   legal state combinations and historical migration hashes; and
10. notify PostgREST only after the transaction commits.

The new migration runner starts at exact Feature 007, seeds pending, initial
empty, assigned/incomplete, complete-agreed and complete-rejected rooms plus
decisions, applies the actual migration, verifies only the specified state
changes and restores a clean latest reset. Existing history is never edited.

After migration/RPC contracts and database tests are final, run the repository's
single legitimate generated-type write point exactly once with
`npm run db:types`, review it, immediately run `npm run db:types:check`, and use
check-only validation for every later gate. Migration and fixture runners hash
the canonical generated file before that point and may never rewrite it.

## Validation and Impact Plan

`docs/testing-strategy.md` remains normative.

### Evidence ownership

| Guarantee | Primary authority | Browser responsibility |
| --- | --- | --- |
| Threshold `N=2..10`, boundary and no early resolution | pgTAP | Representative exact-two, three-voter and four-voter L02 subflows |
| Final-decision serialization, exact writes and rollback | pgTAP/dblink | Concurrent dispatch and visible convergence only |
| One successor/exhaustion per rejected sequence | pgTAP/dblink + Edge tests | One shared successor and failure/retry journey |
| Feature 006 eligibility/exclusion/completed-empty | Deno search/Edge tests + DB commit validation | Controlled provider proves real orchestration |
| Occurrence-bound decision freshness/history | Migration + pgTAP | Fresh `0/N` after progression |
| Stale/out-of-order/missed events | Client state/hook tests | Stale tab, reload and reconnect |
| RLS/ACL/privacy/cross-room denial | PostgreSQL role tests | G08 and one owner-case ordinary-JWT probe |
| Neutral stopped/exhausted UI and no Match | Component/route tests | L01/L02 visible absence |
| Migration/type reproducibility | Protected migration runner/reset/type check | None |

### Current-feature owner acceptance (`F = 6`)

- **L01/L03 — 2 identities, one executable case**: two fixed voters reuse the
  same independent identities across bounded rooms. Prove one-decision waiting,
  yes/yes agreement and stopped reload/reconnect with no source call or Match UI.
  In later rooms overlap a yes/no final pair, duplicate/lose/replay the final
  response, retain a stale tab, observe one distinct successor and fresh `0/2`,
  then exercise transient source failure, same-step retry success and completed
  no-further-candidate recovery. L03 is a named subflow inside L01, not a third
  Playwright case, so reuse complies with the no-cross-case-identity rule.
- **L02 — 4 identities**: one non-voting creator plus three voters prove no
  creator contribution, no resolution after an already-threshold-satisfying
  incomplete set, `2 yes + 1 no` agreement, and in a bounded second room
  non-agreement followed by one shared distinct successor at `0/3`. Include
  concurrent final dispatch, creator/voter convergence within 5 seconds, stale
  recovery and an ordinary-JWT cross-room denial. Reuse these same four
  case-owned identities in bounded rooms with all four configured as voters to
  prove `N=4`, `T=3`, continued collecting after three early yes or two early no
  decisions, agreement at three yes, and non-agreement/progression at two yes;
  no fifth identity or third owner case is added.

The fixed `test:e2e:feature008` profile selects exactly L01 and L02, requires
exact 2+4 signup/identity receipts, workers 1/retries 0/repeat 1, owned cleanup,
Auth success and zero scanner findings.

### Permanent smoke and historical impact

Retain G03/G04/G05/G08/H01 at 16 identities. G04's old Feature 007 terminal
assertion (`3/3` with no larger-group policy) is deliberately replaced by the
now-authoritative three-voter progression outcome while preserving its
non-voting-creator/privacy purpose. G08 appends progression/occurrence direct
access denial to its exact ordinary-JWT boundary. Other smoke intent is
unchanged.

No additional historical browser case is selected (`T = 0`):

- K01/K02's now-obsolete post-`N/N` assertions must be updated for the current
  contract, but L01/L02 own the same browser boundary and provide the stronger
  progression evidence;
- J03's first-candidate metadata recovery remains intact and later-occurrence
  recovery is owned by L01 plus Deno/client tests; and
- source commit races, migration behavior and detailed privacy remain lower-layer
  authority, while G08 is already in smoke.

K01/K02 remain executable current-code regressions for immutable own decisions
when full discovery is explicitly run; their historical Feature 007 receipt is
not rewritten. Adding L01/L02 makes the planned full current-code inventory 46
cases and 112 identities, subject to implementation-time discovery
reconciliation.

### R02 budget

| Gate | Formula | Identities |
| --- | --- | ---: |
| Normal checkpoint and repeatability run one | `1 + 16 + 6 + 0` | **23** |
| Additional repeatability run after normal | `16 + 6` | **22** |
| Cumulative normal plus repeatability | `23 + 22 = 1 + 2 × (16 + 6) + 0` | **45** |
| Fresh checkout | `1 + 16` | **17** |
| Cumulative repeatability plus fresh checkout | `45 + 17` | **62** |
| Current pre-Feature-008 full checkpoint | `1 + 106` | **107** |
| Planned explicit full current-code checkpoint | `1 + 112` | **113** |

Every charged run requires the existing rolling-window admission calculation.
No quota probe, retry, reset, restart or session export may evade the 150-user
limit. Failed/partial/manual attempts count. Receipt, cleanup and scanner rules
remain unchanged.

## Implementation Phases and Green Checkpoints

These are future implementation slices summarized from `tasks.md`; none is
completed work.

| Phase | Coherent deliverable | Minimum evidence before next phase |
| --- | --- | --- |
| 1 — Occurrence and resolution authority | One migration, occurrence ledger, backfill, occurrence-bound decisions, room state constraints, evolved decision RPCs | Protected nonempty cutover, clean reset, pgTAP threshold/no-early/privacy/integrity tests, deterministic final-decision races and agreement/rejection transactions; generated types not written yet |
| 2 — Source sequencing | Evolved service-only prepare/commit CAS, exclusion-aware Feature 006 search, stable exhaustion and retryable failure | Deno Edge/search tests; pgTAP competing proposal/empty/winner/stale cases; original Feature 006 eligibility/metadata/failure suite green |
| 3 — Client convergence vertical slice | One controlled type generation; sequence-aware room/candidate/decision state; progression statuses and room integration | Immediate type check-only; focused parser/reducer/hook/component tests; full client/DB/Edge suites; lint/typecheck/web/native exports |
| 4 — Bounded acceptance | L01-with-L03, L02, evolved G04/G08 and safe fixed profile | C1=1, smoke=16, F=6, T=0; normal total 23; all open clients converge within 5 seconds; cleanup and scanner zero |
| 5 — Repeatability and fresh checkout | Reproduce unchanged source and exact implementation SHA | Treat the 23-identity normal checkpoint as repeatability run one, charge only one additional 22-identity owner+smoke run, then run the independent 17-identity fresh checkout; cumulative totals 45 and 62; check-only types and deterministic cleanup |

Dependency is Phase 1 -> 2 -> 3 -> 4 -> 5. The migration, Edge contracts,
generated types and client ship as one coherent release even though validation is
ordered. A phase must be green or explicitly cancelled with dependent artifacts
updated before the next begins.

## Requirements Traceability and Planning Gate

[requirements-traceability.md](requirements-traceability.md) maps all five user
stories, all 30 numbered acceptance scenarios, all 45 functional requirements,
all 10 non-functional requirements, and all 12 success criteria to implementation
and evidence tasks.

Planning reconciliation result:

- all 45 functional requirements have a concrete database, Edge, Realtime,
  client or security mechanism;
- all 10 non-functional requirements map explicitly to implementation and
  executable evidence tasks;
- all 12 success criteria have measurable planned evidence;
- all 30 scenarios are covered by L01/L02, pgTAP/dblink, Deno, migration or
  focused client/component tests without exceeding six owner identities;
- all five stories have an independently verifiable vertical path;
- no requirement depends on Feature 009 or on early resolution; and
- no proposed design is unable to satisfy the specification.

## Constitution Check — After Phase 1 Design

**PASS at design completion; all eight principles, no exception.**

- **I/VII**: [quickstart.md](quickstart.md) separates migration, database, Edge,
  client, browser, build/export, repeatability and fresh-checkout proof. Planning
  artifacts are not claimed as executable evidence.
- **II/VIII**: One occurrence ledger, two room fields, evolved existing RPCs,
  the existing Edge source and one room channel are the minimum structure that
  can distinguish movie identity from occurrence and serialize one successor.
  No queue, worker, alternate channel or Match abstraction is added.
- **III**: The spec, [research](research.md),
  [data model](data-model.md), four contracts and complete traceability matrix
  agree on full-set timing, fixed threshold, one sequence and Feature 009
  boundary. There is no `NEEDS CLARIFICATION` or `UNRESOLVED` item.
- **IV**: Room lock, occurrence key, one-way outcome, durable `advancing` state,
  expected sequence and uniqueness constraints define atomicity, idempotency,
  retry, stale and partial-failure behavior at the enforcing boundary.
- **V**: Protected tables remain grant-free and off Realtime; identity is
  derived; private filters/exclusions stay server-side; safe room status reveals
  no peer answer or roster.
- **VI**: One migration preserves history, deterministically resolves existing
  complete sets, protects historical hashes and generated types, and retains
  clean reset/exact-SHA validation discipline.

No post-design gate failed and no constitution amendment is required.

## Complexity Tracking

No constitutional violation or approved exception.

The occurrence relation and durable `advancing` state are required, not
speculative abstractions: the current Feature 007 `(member, tmdb_movie_id)` key
cannot distinguish repeated occurrences, and external TMDB work cannot be part
of the final-decision SQL transaction. The sequence/CAS boundary is the minimum
mechanism that makes that unavoidable split exactly-once logically.

## Planning-Only Declaration

No implementation, migration, generated-type update, dependency installation,
service startup, application/database/Edge/browser test, task execution,
analysis rerun, branch creation/switch, commit or push is part of this approved
planning-artifact correction.
