# Quickstart and Validation: Generalized Room Membership & QR Join

**Status**: Planned validation, not executed evidence. **Date**: 2026-09-10.
No command below is claimed to pass during planning. Future implementation must
record actual commands/results, test counts, schema/type hashes, Auth accounting
and cleanup before marking its phase green.

## Prerequisites and command ownership

Use repository root `/home/maks/work/otteroom`, source branch main, existing
Node 24.20.0/npm11.19.0, committed lockfile and project CLI Supabase2.116.0.
Docker must be available. Retain existing Playwright1.63.0 managed Docker runtime
on this Linux host; do not replace it with ad hoc browser/dependency workarounds.
No hosted Supabase, Dashboard SQL, Auth account, movie API, scanner or phone is
required for automated acceptance.

All commands in this file are for future implementation/validation. The new
`scripts/check-room-membership-migration.mjs` does not exist at planning time.
Schema/type/client changes must be implemented together before cutover validation;
do not run a new DB against the obsolete client and call that a green phase.

### QR dependencies — Phase 1 implementation only

Run sequentially, review package/lock changes and preserve the pinned framework:

```sh
npx expo install react-native-svg
npm install --save-exact react-native-qrcode-svg@6.3.24
npm install --save-dev --save-exact jsqr@1.4.0
npm ci
```

Expo57's selected SVG version must match 15.15.4. Do not force incompatible
peers or add a scanner/transformer. jsQR is test-only. Phase 1 tests the standalone
component/real local encoder and keeps existing application checks green;
integrated QR export/decode evidence waits until its Phase 3 route import.

## Version-limited existing-row migration evidence

Future paths:

- `scripts/check-room-membership-migration.mjs`
- `supabase/tests/migration/room_membership.before.sql`
- `supabase/tests/migration/room_membership.after.sql`

Invoke with the owned local validation stack running and no application/test
traffic. The runner refuses a database containing rooms or Auth users before
starting its destructive legacy reset. A previous acceptance run can leave such
data in the stopped stack's retained volume. Prepare an empty local database
explicitly; this does not restore Auth quota or remove earlier R02 charges:

```sh
npm run db:reset
node scripts/check-room-membership-migration.mjs
```

The runner owns this exact sequence, using project-local CLI resolution and
the established bounded owner-only Docker/psql technique:

1. Verify local project identity and no competing run. Reset with
   `supabase db reset --local --version 20260909000001 --no-seed`.
2. Run before.sql through `docker exec -i supabase_db_otteroom-room-session
   psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt`. Create only controlled
   synthetic Auth fixtures and three legacy rooms: Waiting; Ready without
   candidate; Ready with a valid non-lowest fixture assignment. Fix known room
   IDs/codes/request IDs/timestamps. Snapshot expected values in bounded memory,
   never in diagnostic files. These are zero GoTrue signup operations.
3. Run the actual pending migration with `supabase migration up --local`.
   Its transaction executes `ANALYZE public.rooms` as postgres after the
   generated-expression/schema cutover and before COMMIT. Require successful
   completion; SET EXPRESSION removes the changed column's statistics.
4. after.sql checks exact IDs/codes/request IDs/creator/room timestamps/state
   and candidate FK preserved; target2/count1 or2; host→voting creator;
   guest→voter; exactly one row per room/user; new stable member IDs; creator
   recovery flags; no old columns/overloads or guest-dependent constraint/policy.
   Legacy member joined_at is migration materialization time. Do not compare
   pre/post xmin across the necessary rewrite. With these nonempty fixtures,
   verify as owner that pg_catalog.pg_statistic contains statistics for
   public.rooms.state after ANALYZE. Do not wait for autovacuum or require
   fixed planner estimate values. The final empty clean reset also executes
   ANALYZE successfully, but need not produce statistics for absent rows.
5. Exercise migrated creator/voter recovery and existing candidate through real
   authenticated SQL roles/claims, not owner-as-caller. Verify repeated calls
   do not insert/update membership and the assigned non-lowest movie is retained.
6. Remove only owned fixtures, then restore a full latest clean reset in
   guaranteed cleanup on success/failure/interruption. Propagate verification
   and cleanup failures. Never generate types inside this runner.

Record safe counts/booleans only; drain/suppress raw CLI or SQL output that might
contain private fixture/session data. The before/after scripts live outside the
default database test directory so a normal pgTAP run cannot reset its own schema.
Normal reset and pgTAP afterward verify reproducibility independently of this
nonempty upgrade test.

## R01 — One intentional update, then check only

Only inside Phase 2, after the complete migration/RPC/public DB contract and
database evidence are final:

```sh
npm run db:reset
npm run db:test
npm run db:types
npm run db:types:check
```

Review the sole intentional canonical update in src/types/database.generated.ts
with the entire cutover. No manual nullability patch. Then independently:

```sh
sha256sum src/types/database.generated.ts
stat -c '%i %s %Y %Z' src/types/database.generated.ts
npm run db:reset
npm run db:types:check
sha256sum src/types/database.generated.ts
stat -c '%i %s %Y %Z' src/types/database.generated.ts
```

Require byte equality and unchanged canonical inode/size/mtime/ctime through
check-only validation. Every subsequent check/fresh clone uses db:types:check;
no preceding write to conceal drift. R01 wrapper semantics remain unchanged.

## Database and client acceptance

Full `npm run db:test` must cover both evolved existing suites. Do not target a
fixed old assertion count: retain their safety classes and record the actual
new totals. Prior baseline 588 (288 room +300 candidate) is historical evidence,
not the future expected test count.

| Area | Required executable proof |
| --- | --- |
| Schema | Exact rooms/member columns/types/defaults/keys/FKs/checks; state generated from count; no final host/guest; candidate check generalized; no count above target |
| Creation | Four target/mode cases; min/NULL/type rejection; exact settings; same-request sequential/concurrent/lost-ack recovery; conflicting valid retry returns original; one room/member; named code conflicts |
| Join | Intermediate Waiting, final Ready; valid existing-member before full; non-voting creator zero; only a non-creator without membership reaches new-voter capacity/admission; malformed/unknown/full no writes; real same-identity, last-slot and multiple-slot races |
| Failure | Inject member insertion/count update fault in test scope; no partial room/member/count; accepted lost response recovers existing membership; missing creator membership and persisted non-creator non-voter cause exceptional room RPC failure without repair/promotion or a normal outcome |
| Security | Exact public/helper owner/definer/search_path/ACL; missing subject; private helper false for foreign/missing; direct roster/catalog/writes denied; own room projection including NVC allowed, foreign denied |
| Candidate | Generalized Waiting not_ready; all authorized members incl NVC share one Ready assignment; empty/broken catalog exceptional; no rotation, repeated no-update, rollback and real candidate race retained |
| Cleanup | No production test trigger/helper, synthetic room/user or open dblink caller remains; original fixture catalog/assets unchanged |

In `supabase/tests/database/room_session.test.sql`, implement the exact
[creator/member integrity fault evidence](contracts/room-rpcs.md#creator-and-member-integrity-fault-evidence):
privileged savepoint setup removes creator membership for both original voting
choices in Waiting and Ready, leaving the room snapshot untouched. The creator's
real authenticated join_room must throw, return no joined/full/already_member
row, insert no voter membership and preserve count/state/configuration, all
other memberships, timestamps and room xmin. A separate privileged corruption
of an admitted non-creator to is_voter=false must also fail the real room RPC
projection without writes. Roll back each fault savepoint, verify the exact
original member ID/flag and count invariant, and prove normal creator re-entry
still has its original one-slot or zero-slot contribution. Restore role/claims
and enclosing fixture state on every exit. These tests add zero GoTrue signups
and leave browser cases, R02 budgets and concurrency barriers unchanged.

Concurrency follows [room-rpcs.md](contracts/room-rpcs.md): owner lock barrier,
independent authenticated caller PIDs/claims, observable pg_blocking_pids and
pg_locks waits, then direct loser→winner blocking before first commit. Verify
per-session member INSERT and rooms UPDATE deltas 1/0 for duplicate/final slot,
1/1 for two available slots, and one each for three NVC-room joiners; count equals
voter rows after commits. An idempotent loser preserves first-commit xmin.
Browser simultaneous dispatch alone cannot establish this database evidence.

Client suite covers exact eight-field parser/nulls, integer target2..2147483647,
count/state/flag combinations, malformed rejection, typed create args, explicit
choice, default2, input errors, request/config freeze, count/mode rendering,
Ready and intermediate Waiting stale responses, one-channel lifecycle, same-code
replay, error recovery, QR/error/value and candidate/poster regressions. Runtime
success is never inferred from a snapshot or a mock invocation alone.

## Complete browser inventory and R02 accounting

Use real local Anonymous Auth, RPCs, PostgreSQL, Realtime and Expo web. Each
case owns isolated participant contexts. Same-case sequential rooms reuse their
identities with new deliberate creation IDs; no identity cache crosses cases.
Every reload, reconnect, repeated entry, same-context retry and fault recovery
below adds **zero** signups. Observe attempts and successful identities before
navigation and enforce both caps. No hidden setup user or service-role caller.

### Existing room regression inventory, deliberately evolved

Each room created below explicitly chooses target2/creatorVotes=true. Replace
old roles, columns, exact six-field results and copy with the new contract;
preserve every stated invariant. Separate rows below are the actual 24 trials,
including the Auth test; their allocations are freshly audited.

| Existing test ID / trial | New identities | Preserved guarantee |
| --- | ---: | --- |
| E01 rapid create | 1 | One logical creation despite duplicate action |
| E01 pre-acceptance create failure | 1 | No usable partial room; retry same request |
| E01 committed create response loss | 1 | Recover original committed room |
| Auth persistence/independence/explicit storage clear | 3 | Original + independent + deliberately cleared-original identity; reload itself adds zero |
| E02 link and re-entry | 2 | Canonical invitation/common join and member recovery |
| E03 live bound UPDATE | 2 | Real automatic Ready convergence |
| E03 commit before binding readiness | 2 | system-ok authoritative refetch recovers missed event |
| E04 manual normalization | 2 | Code path equals link admission |
| E04 pre-acceptance join failure | 2 | Preserved room and recoverable retry |
| E05 full rejection | 3 | No third voter/private transient UI |
| E06 final-slot race | 3 | One joined/one full, exact membership mutation |
| E07 creator Waiting reload | 1 | Same identity/member |
| E07 creator Ready reload | 2 | Same assembled room |
| E07 creator socket loss | 2 | Real reconnect, no new member |
| E08 voter Ready reload | 2 | Existing voter recovery |
| E08 voter socket loss | 2 | Real reconnect and same assignment |
| E09 repeat/overlapping join | 2 | Existing member never consumes another slot |
| E10 malformed manual | 1 | Corrective error, no room RPC |
| E10 malformed direct route | 1 | Invalid route never mutates |
| E11 nonexistent canonical code | 1 | not_found without membership |
| E12 private read | 2 | Unrelated room zero-row read |
| E12 live subscription isolation | 3 | No unauthorized room UPDATE delivery |
| E12 stale navigation | 3 | Retired room response cannot cross route generation |
| E12 direct mutations | 3 | No direct room/member privilege bypass |
| **24 trials** | **47** | Same invariant classes; obsolete representation replaced |

The Auth test's deliberate clear is a standalone existing identity test, never
a recovery or quota workaround. E06 holds candidate traffic when measuring
membership-only writes; candidate assignment's separate legitimate UPDATE must
not create a false duplicate-admission finding. E12 private fields become
creator_user_id/member fields and new five-column projections; no broad roster
read replaces protected owner setup.

### Existing candidate regression inventory

These cases use explicit two-voter/voting-creator configuration and generalized
room/member snapshots. Candidate invariants do not change.

| Case | New identities | Preserved behavior |
| --- | ---: | --- |
| F01 | 2 | Waiting RPC0/not_ready; synchronized first acquisition; one assignment; harmless invalidation/repeat |
| F02 | 2 | Both reload/reconnect/repeated access preserve assignment/xmin |
| F03 | 2 | Disconnected Waiting creator recovers peer-established candidate |
| F04 | 4 | Two unrelated rooms; exact missing/foreign null response and isolated recovery |
| F05 | 2 | Both pre-forward failures leave Ready/NULL; retry assigns once |
| F06 | 2 | Two sequential rooms reuse both identities; alternate failed participant |
| F07 | 2 | Real upstream commit, snapshot before response abort, same assignment on retry |
| F08 | 2 | Exact local PNG failure, retained metadata, same-poster retry with RPC delta0 |
| **8 trials** | **18** | No rotation, external movie traffic or weakened C1 |

### New Feature 003 grouped cases

File: `e2e/generalized-room-membership-qr.spec.ts`. Fixed names carry
`@membership G01` through `G09`. G03/G04 are complete link/code cases available
in Phase 2; the other seven are introduced in Phase 3. No placeholders/skips
are counted as passing cases.

| Case | Exact bounded trial and executable result | New identities / reuse |
| --- | --- | --- |
| G01 — Configuration and invitations | One creator validates default2, below-minimum/fraction/non-number and absent choice; creates four separate rooms for 2/yes,3/yes,2/no,3/no. Check initial count/state/flags, no candidate; configuration immutable, code/link/QR visible, independently decoded QR equals text. No new admission here | **1** creator reused across four deliberate rooms |
| G02 — Creation recovery | For each creator mode: pre-forward create failure/retry; real committed response loss/retry including different valid supplied config; overlapping same-request real calls. Six separate logical rooms, each exactly one room/member and original chosen configuration/invitation, one/zero creator slots | **1** creator reused; all retries/overlap0 |
| G03 — Three voting members | Creator3/yes sees1/3; link voter gives2/3 Waiting; that voter reloads while Waiting, disconnects real Realtime; manual-code third voter gives3/3. Creator sees each count automatically, returning voter recovers Ready. Hold all three first candidate RPCs until arrived, release together; one identical candidate/title/year/visible local poster. Creator/voters reload/reconnect/re-entry retain membership/candidate | **3**, all reused through recovery; QR-independent |
| G04 — Non-voting creator assembly | Creator3/no observes0/3→1/3→2/3→3/3 through sequential link/code joins, all four converge; creator zero throughout. Waiting no automatic candidate request; real own probes not_ready. Synchronize four first candidate calls; same movie/poster. Creator/voter reload/reconnect and acquisition failure after established assignment recover same. Fail exact local poster request before reload, retain metadata, same-image retry with candidate RPC delta0 | **4**, recovery0; QR-independent |
| G05 — Same-identity first join | Creator3/yes at1/3. Decode actual QR into new voter's entry; hold two real same-subject join calls before forwarding either. Exactly one member/increment, result2/3 and another slot still free. Repeat/overlap QR/link/code entry as that member; no extra count | **2**; multiple calls/pages reuse the same voter session |
| G06 — Multiple available slots | Creator3/no at0/3 re-enters own QR/link/code and stays non-voting. Hold three distinct real new-voter requests, release together; exactly three members admitted,3/3 Ready. Creator repeats QR/link/code/reload/reconnect after assembly; no promotion/extra slot | **4**, same four sessions throughout |
| G07 — Final slot and full re-entry | Creator3/yes + prior voter give2/3. Two new distinct joiners overlap for final slot: exactly joined/full, one admission. Loser attempts QR/link/code, always full with all-null projection; existing winner/prior voter/creator recover through invitations without new slots | **4**; loser reused as late-entry tester |
| G08 — Generalized isolation | Room A: voting creator and two voters Ready3/3. Fourth identity creates unrelated room B as non-voting creator. Ordinary JWT requests prove own access, foreign ID/code reads denied, no roster/catalog browse, no direct member/config/assignment mutation. Compare protected snapshots and no UUID UI. Existing E12 retains live subscription isolation | **4**, B creator reused for attacks, no owner credential in browser |
| G09 — Join failure boundaries | Same C/J/K contexts across three target2/voting-creator rooms: J pre-forward fail then retry once admitted; J fail then K fills so J retry full; J route.fetch commits, owner snapshot confirms membership before response abort, then retry already_member in assembled room | **3**, all retries/three rooms reuse identities |
| **9 cases** | All 36 spec scenarios mapped below | **26** |

G02/G05/G06/G07 hold all outgoing requests until the expected participants have
arrived, then forward real calls. Verify request subjects in memory, outcomes
and persisted memberships/counts. SQL tests separately prove actual lock waits.
Use route.fetch with maxRetries0/maxRedirects0 for committed-response-loss probes;
inspect successful upstream response and independently committed DB state
before aborting delivery. Never fulfill synthetic successful RPC responses.

G04 poster fault must intercept the actual local bundled PNG request exactly
once before allowing retry; routing disables HTTP cache, but the interception
must still be observed. If the case uses another logical room to isolate image
state, reuse the same four Auth identities and verify the new request ID/room.
The visible wrapper, decoded positive image dimensions, matching local source
and onLoad completion remain the F08-grade evidence. Metadata does not disappear
on poster retry and the candidate RPC counter must not increase.

## All 36 product scenarios mapped

Gates refer to the phase checkpoints in plan.md. The mapping records future
executable evidence, never documentation-only acceptance.

| Spec scenario | Implementation boundary | Browser evidence | Gate |
| --- | --- | --- | --- |
| 1 | Home configuration | G01 | G3 |
| 2 | Input + create validation | G01 | G3 |
| 3 | Atomic create/voting creator | G01 | G3 |
| 4 | Atomic create/count UI | G01, G03 | G2/G3 |
| 5 | Atomic create/non-voting creator | G01 | G3 |
| 6 | Atomic create/non-voting creator | G01, G04, G06 | G2/G3 |
| 7 | Invitation component/shared target | G01 | G3 |
| 8 | QR encoding/existing route | G01, G05 | G3 |
| 9 | Explicit choice validation | G01 | G3 |
| 10 | Immutable DB write surface + UI | G01, G08; pgTAP before/after assembly | G2/G3 |
| 11 | Request/config freeze + atomic create | G02; pgTAP real create race/rollback | G3 |
| 12 | Existing link route + generalized join | G03, G04 | G2 |
| 13 | Manual normalization + same join | G03 | G2 |
| 14 | QR target + same join | G05 | G3 |
| 15 | Count summary/projection | G03 | G2 |
| 16 | Locked final admission/generated Ready | G03 | G2 |
| 17 | Existing Realtime + five-field refetch | G03, G04 | G2 |
| 18 | NVC membership/count/observation | G04 | G2 |
| 19 | Unique member + room lock/recovery | G05, G07; SQL duplicate race | G3 |
| 20 | Creator existing-member recovery | G03, G07 | G2/G3 |
| 21 | NVC fixed member flag/recovery | G04, G06 | G2/G3 |
| 22 | Auth/route recovery | G03, G04 | G2 |
| 23 | Persisted member + Realtime reconnect | G03 | G2 |
| 24 | No membership removal on disconnect | G03, G04 | G2 |
| 25 | Locked final-slot admission | G07; SQL exact winner/loser | G3 |
| 26 | Locked multiple-slot admission | G06; SQL three-caller race | G3 |
| 27 | Full check for new identities | G07 | G3 |
| 28 | Existing-member check precedes full | G07 | G3 |
| 29 | RLS/helper/RPC private boundary | G08, evolved E12/F04 | G2/G3 |
| 30 | Existing normalization/closed outcomes | E10 manual/direct, E11 | G2 |
| 31 | Atomic rollback + retry/current capacity | G09 | G3 |
| 32 | Idempotent join after committed response loss | G09 | G3 |
| 33 | Denied direct room/member mutations | G08; pgTAP ACL/invariant tests | G3 |
| 34 | Generalized candidate authorization/Ready | G03, G04 | G2 |
| 35 | Preserved candidate/poster/recovery layer | G03, G04, F02/F05/F06/F07/F08 | G2 |
| 36 | Generated Waiting + no candidate | G01/G03/G04/G05/G06; direct SQL not_ready | G2/G3 |

US1 is independently demonstrable through G01/G02 (configuration/invitations,
without completing a group); US2 through G03/G04/G05 (successful assembly and
QR admission); US3 through G05–G09 and preserved candidate/reconnect regressions.
All stories are complete at G3; G4 proves repeatability/fresh-checkout behavior.

### Requirements and success criteria

| Requirements | Concrete implementation/test coverage | Success criteria |
| --- | --- | --- |
| FR-001–004 | Configuration UI/validation, immutable RPC/member fields; G01/G02/G08 + client/SQL | SC-001, SC-012 |
| FR-005–008 | Atomic creator membership and 1/0 initialization; G01/G03/G04/G06 | SC-001, SC-004, SC-005 |
| FR-009–012 | Existing code/link + local QR, normal voter join; G01/G03/G04/G05 | SC-006 |
| FR-013–018 | Unique member/row lock/existing-before-full; G05/G06/G07/G09 + SQL races | SC-003, SC-004, SC-005, SC-007 |
| FR-019 | Creator/request unique key/frozen retry; G02 + SQL unique-index wait/rollback | SC-012 |
| FR-020–024 | Persistent membership, five-field refetch, mode/count UI/no IDs; G03/G04/G06/G07 + existing E03/E07/E08 | SC-002, SC-004, SC-005, SC-008, SC-009 |
| FR-025–027 | Summary bounds and serialized admission; G05/G06/G07 + real pgTAP wait/write oracles | SC-003, SC-007 |
| FR-028–029 | Private helper/RLS, no table writes/roster; G08 + E12/F04 + ACL tests | SC-009 |
| FR-030–032 | Distinct invalid/not_found, generic failures, committed recovery; E10/E11, G02/G09 | SC-012 |
| FR-033–035 | Candidate member authorization/count Ready; G03/G04 + retained F01–F08 | SC-011 |
| NFR-001 | Realtime automatic intermediate/final convergence; G03/G04/G06 + lifecycle regressions | SC-002, SC-008 |
| NFR-002 | SQL+browser duplicate/available/final-slot/recovery trials | SC-003, SC-004, SC-005, SC-007 |
| NFR-003 | Function/table/helper ACL, foreign denial/no UUID, C1 | SC-009, SC-012 |
| NFR-004 | Shared RN controls/SVG, native module bundles, web QR independent decode/join | SC-001, SC-005, SC-006 |
| Release boundary | No future interactions in all cases; preserved fixture scaffolding only | SC-010 |

Coverage targets: 35/35 FR, 4/4 NFR, 12/12 SC, 36/36 scenarios and 3/3 stories.
No runtime PASS is claimed by this map. C1 is checked before browser gates,
R01 at G2 then every DB-dependent gate, R02 per case/block below.

## Auth quota admission — binding R02 arithmetic

`anonymous_users=150` remains unchanged. Defaults: one worker, repeatEach1,
retries0. A case deadline of90s and suite deadline600s are safeguards for grouped
work, not waits, retries or product latency requirements. Preserve bounded
event/lock barriers. Update only historical budget commentary/diagnostic labels.

| Block | Arithmetic | Required allowance |
| --- | --- | ---: |
| Phase 1 existing suite + C1 | 47+18+1 | 66 |
| Phase 2 existing32 + G03/G04 + C1 | 47+18+3+4+1 | 73 |
| G-only optional selection + C1 | 26+1 | 27 |
| One final complete acceptance | 47+18+26 | 91 |
| C1 + final complete | 1+91 | 92 |
| C1 once + two complete runs | 1+91+91 | 183, exceeds one window |
| Fresh checkout with C1 | 1+91 | 92 |
| Repeatability + fresh checkout | 183+92 | 275, separate recovered windows |

Optional targeted runs cost additional allowance if performed alongside full
gates; they are never free because the cases overlap. Track actual dispatched
signup attempts, successful identities, partial/failed runs and manual use in
the same hour/IP. Record safe timestamps/counts, never Auth payloads. Merely
creating a browser context is not a signup; restoring one adds none.

If prior use is unknown or allowance insufficient, wait outside the test harness
until it recovers; a full signup-free hour from the last counted attempt provides
a conservative admission point. Do not add an Auth probe to check quota. HTTP
429 fails/aborts the run as environment-budget failure; no automatic retry,
storage clearing, rate-limit increase, restart or DB reset to evade the counter.
The C1 probe's one identity is counted separately and is excluded from discovery.

## Normal green command path

With sufficient quota, after implementation of the applicable phase, run in a
shell that guarantees cleanup. Example shell sequence (check only, not R01 write):

```sh
set -eu
trap 'OTTEROOM_CHECK_EXIT=$?; trap - EXIT; if ! npm run supabase:stop; then exit 1; fi; exit "$OTTEROOM_CHECK_EXIT"' EXIT
npm ci
npm run supabase:start
npm run env:local
npm run db:reset
node scripts/check-room-membership-migration.mjs
npm run db:reset
npm run db:types:check
npm run lint
npm run typecheck
npm run test:client
npm run db:test
npm run web:export
npx expo export --platform ios --platform android --output-dir dist/native-validation
npm run playwright:install
npm run test:e2e:security
npm run test:e2e
git diff --check
```

Phase 1 omits the not-yet-created migration runner and its preparatory reset;
the following normal reset still checks its existing schema and canonical types.
Phase 2 must first have completed the
separate intentional R01 update. Capture canonical hash/metadata before and
after check-only execution. Inspect web export for all four original PNGs;
at G3 require the imported QR component in the application bundle and actual
browser decode/join. Native export is module/bundle evidence, not native camera
or device runtime evidence. Keep output under ignored dist and clean disposable
validation outputs after inspection.

The managed browser controller closes its web process/owned browser container;
the shell trap stops only the project's Supabase stack. Explicitly check cleanup
results and fail if any owned runtime remains. Run no unrelated Docker cleanup.
No failure is hidden by broad `|| true`; trap cleanup is also checked/recorded.

At Phase 2 unfiltered discovery contains exactly 34 tests (existing32 + G03/G04).
At Phase 3/final it contains exactly41. All use the existing safe reporter and
scanner. Never call raw Playwright to bypass diagnostics. An optional separately
budgeted selection is `npm run test:e2e -- --grep '@membership'` after C1;
it does not replace complete regression.

## Repeatability — same stack, outside-harness quota windows

For Phase 4, this block is the normal final validation: complete run #1 supplies
that checkpoint. Do not run an additional 92-signup normal invocation first.
Keep one cleanup-owning shell/driver alive through both runs and the
outside-harness wait; its EXIT cleanup runs only after run #2 or failure.

1. Admit at least92 remaining attempts. Start the local stack, derive env, run
   migration/full static/client/DB/export/type checks and C1 once, then complete
   acceptance #1:41 tests, at most91 signups (92 including C1). Record measured
   counts and scanner0. Close all browser contexts; keep Supabase running.
2. Do not dispatch acceptance #2 until another91 attempts are available. Wait
   outside any Playwright/test process; keep the same stack running through
   that interval. No stop/start, configuration change or automatic 429 retry.
3. After quota admission, optional suite-level db:reset followed by
   db:types:check only, then `npm run test:e2e` for complete #2. Same exact source,
   fresh contexts,41 tests, at most91 signups, scanner0. C1 from this unchanged
   stack/source block remains the prior gate; if it is rerun, explicitly add1.
4. Record the total successful block183, actual windows/counts, then stop the
   stack and verify cleanup. Separate allowance for fresh checkout is still
   needed; reset/cleanup is not evidence of recovered Auth quota.

Do not launch this as unattended repeat-each2 or keep a test waiting for an hour.
If source changes between runs, resolve the defect/revalidate and record the
additional cost; two different implementations do not prove repeatability.

## Fresh checkout of the final implementation

Use an exact committed implementation SHA containing Phase 3 code/tests (the
current planning-only origin/main is not sufficient). Preserve source main;
create a disposable clone outside its directory and record remote/SHA. A detached
checkout inside the disposable clone does not create a source branch/tag.

A local Git clone can verify only committed source without copying working-tree
state. Execute this setup only when source HEAD is the reviewed implementation:

```sh
OTTEROOM_VALIDATION_SHA="$(git -C /home/maks/work/otteroom rev-parse HEAD)"
OTTEROOM_FRESH_ROOT="$(mktemp -d /tmp/otteroom-003-fresh.XXXXXX)"
git clone --quiet --no-hardlinks --no-checkout /home/maks/work/otteroom "$OTTEROOM_FRESH_ROOT/repo"
git -C "$OTTEROOM_FRESH_ROOT/repo" checkout --detach "$OTTEROOM_VALIDATION_SHA"
cd "$OTTEROOM_FRESH_ROOT/repo"
git rev-parse HEAD
git status --short
```

Record the local source path and exact SHA (or the remote source if a remote
clone is chosen). Run the normal validation path inside this clone with its
cleanup trap; after shutdown, leave that directory and remove only the mktemp
directory allocated above. No source branch/history operation is needed.

Before clone execution, verify the chosen version includes the final migration,
canonical types, QR integration and all41 acceptance cases. Install with npm ci;
do not copy node_modules, .env, caches, Auth storage or local service data.
Start the local stack only after source-stack cleanup, derive local env from
safe wrappers, and execute the complete normal green command path above. Require
the migration compatibility runner and latest reset, check-only types with
unchanged canonical hash/metadata, lint/typecheck/full client/pgTAP, web/native
bundles, four posters, managed browser setup, C1, all41 cases and scanner0.

Reserve92 independently of repeatability and wait outside the harness if needed.
No db:types write or application patch is permitted to repair the fresh clone's
normal validation. A failure must be fixed in the source and revalidated at an
explicit version, not hidden in the clone. Stop all owned services, verify no
container/process remains, remove only the disposable clone and its outputs.

## Manual multi-browser and supplemental phone check

Manual browser checks consume their own recorded identities; do not use the
automated run's quota reservation without counting them. Three-voter/yes needs3,
three-voter/no needs4; doing both with independent groups costs7. Re-entry/reload
of each same context adds0.

- Voting creator chooses3/yes → Waiting1/3 with invitations. A second browser
  follows link →2/3 Waiting, no movie; a third enters code →3/3 Ready. All three
  converge automatically and show the same existing title/year/visible poster.
- Non-voting creator chooses3/no →0/3, shares the same link/QR, observes three
  other identities join to3/3; all four see one candidate, creator stays zero.
  Reopen creator's own invite while Waiting and Ready: never becomes a voter.
- Reload/reconnect an admitted browser, then attempt a late new identity:
  existing member recovers; new identity gets full without private room data.

Phone supplement: the creator must open a LAN-reachable web origin, with local
Supabase API/Realtime also reachable from the phone. Use only the public key and
the phone-reachable public URL in ignored local configuration, then restore the
normal loopback environment before automated tests. The same invitationLink
helper produces identical LAN text/QR. External camera scan opens the usual
route, no in-app scanner. A computer's localhost QR is not claimed reachable
from a phone. Existing automated decoded-target/browser admission is required
independently of this supplemental physical-device check.

## Evidence log convention for implementation

Append an evidence entry per completed green checkpoint with date, source SHA/
working-tree scope, environment, commands actually run, results/test totals,
canonical hash/metadata, migration-row and concurrency receipts, Auth attempt/
identity/window accounting, C1/scanner result, export/poster/QR result and cleanup.
Identify any non-applicable check with concrete phase reason. Preserve useful
failed-run history and consumed quota, superseding it only with actual evidence.
This planning file contains no completed implementation evidence or task boxes.

## Implementation evidence

### 2026-09-10 — Phase 1 baseline and applicability (T001)

Source main HEAD: `3c25659000ad5e8e7af66c43a9ffe460c94faade`. Initial `git status --short` was empty.
Captured SHA-256 of all 146 tracked files before editing; 142 existing files are protected
outside the four permitted modified paths. Group hashes below are SHA-256 of
sorted `path + NUL + file SHA-256 + newline` entries; individual originals are
also reproducible with `git show <starting-HEAD>:<path>`.

| Protected group | Files | Manifest SHA-256 |
| --- | ---: | --- |
| Feature 001 specifications | 10 | `a1f8f94d22ae72026344b348da0d53311eddc6eb399325c6600ed7e0893c79a3` |
| Feature 002 specifications | 9 | `29c981b4baa14c52795b3cc308be3f46b445db5bcfda887c79c0987ce76cf8ab` |
| Product documents | 2 | `b2615db5def6498507782580762f34e23de8ce8755b49b0a907e06ecce4cd43d` |
| Historical migrations | 5 | `157061795ea7689a0bb037e3fc9fe191de53d3481661cf003411d65d44c10366` |
| Original PNG posters | 4 | `781b24282bdcbd3f86dc92f2b4ad27f6672c6cf49cd52b7c9ab2609b26487bad` |
| Candidate implementation | 6 | `8c5475fdffa35120604263eb236006558f0a471c7c63195993065d372bff829f` |
| Room application routes | 3 | `5361a62ec84dcd935e16a71e4548667ab3ac130c067748e130f63f02f4fce9f8` |

Canonical database types SHA-256: `f6b77ecf056b1ccb68f2c43a48fccde2a305a5fe8ee20d0124120050d0415a69`.
Canonical inode/size/mtime_ns/ctime_ns: `444960/7370/1788966938747066009/1788966940057157360`.

Default shell Node22.22.0/npm10.9.4 is not the project toolchain. All implementation
and validation commands use the already-installed
`/home/maks/.nvm/versions/node/v24.20.0/bin` first in PATH:
`node --version` = v24.20.0; `npm --version` = 11.19.0. Framework pins remain
the committed package/lock baseline. No toolchain installation was needed.

Applicable scope: only locked QR/SVG/jsQR dependencies, standalone component and
test, and this evidence log/task bookkeeping. G1 requires the existing full
static/client/DB/type-check/web/native/C1/32-case acceptance path with cleanup.
Omit only the not-yet-created generalized migration runner. QR route integration,
QR browser decode/join, G01–G09 and every T007+ task are outside this phase.
Standalone tests prove encoder/error behavior; current application exports do
not claim inclusion of an unimported QR component. No G1 pass is claimed yet.

Initial Docker inventory: no Otteroom Supabase or managed browser container.
Other-project containers remain untouched. Planned G1 reservation is 66
signups/identities (47 room +18 candidate +1 C1); quota admission and actual
attempts will be recorded before/after browser execution.

### 2026-09-10 — Phase 1 dependencies (T002)

Sequential `npx expo install react-native-svg`, exact QR install, exact dev-only
jsQR install, then `npm ci` all exited 0 under Node24.20.0/npm11.19.0.
Resolved SVG15.15.4, QR6.3.24 and jsQR1.4.0 match the reviewed contract. Existing
framework declarations and resolved framework versions are unchanged. Only the
three approved direct dependencies and their transitive dependencies were added;
no scanner/camera, custom transformer, form or state package was introduced.
The installer reported 13 moderate audit findings and existing install-script
warnings; no audit fix, override or unrelated package update was applied.
G1 has not yet run.

### 2026-09-10 — Standalone QR tests and component (T003–T005)

Tests were created before `src/rooms/invitation-qr.tsx`. The exact focused command
`npm run test:client -- --runTestsByPath __tests__/rooms/invitation-qr.test.tsx`
first exited 1 because the component did not exist (one failed suite, zero tests
executed). This was expected pre-implementation evidence, not a behavior pass.
After implementation the same command exited 0: **1 suite /11 tests PASS**.

The healthy path uses the actual package and qrcode encoder, with nonempty real
module geometry. Tests assert the one required value prop, accessible wrapper,
black stroke, opaque white margin/background, M correction, rendered240 and
quietZone48/viewBox336; stable same-value rerender and isolated changed value.
Real empty/oversized encoder rejection, injected transient encoder failure and
downstream SVG render failure stay inside the keyed local boundary. Retry uses
the same value; successful retry returns to actual encoder/rendering. Tests
assert generic text, preserved independent sibling content, no render-time parent
update warning, and **zero createRoom/joinRoom/refetchRoom/ensureRoomCandidate
calls**, including every failure/retry. The encoder is never replaced for healthy
geometry checks. No onError callback schedules a parent update.

`app/room/[code].tsx` remains byte-identical and does not import the component.
No browser QR decode/join or generalized membership work was performed.

G1 admission: existing source summaries have filesystem UTC timestamps no later
than 2026-09-09 21:04:05; fresh-checkout evidence records the later prior-day
22:08 cleanup (historical headings use the local date). At this work's
2026-09-10 16:16 UTC baseline no project runtime was present. Those prior
automated attempts are outside the hourly window; no signup probe or manual
Auth action was performed in this phase. Reserve66 for C1 plus existing32, with
all new/failed attempts charged if they occur. Stack startup is ordinary G1
setup, never a quota-recovery mechanism.

### 2026-09-10 — First G1 attempt: typecheck correction

The normal driver completed npm ci, safe local start/env, clean reset,
db:types:check and lint, then typecheck stopped on TS7006 in the new QR test's
console-warning inspection callback. The local test-only correction explicitly
types that inspected argument as unknown; production behavior and the contract
are unchanged. The failure-preserving EXIT trap invoked Supabase shutdown.
No browser/C1 test had started: this attempt consumed **0 signups /0 identities**.
G1 remains incomplete; rerun the complete command path after the correction.

### 2026-09-10 — G1 continuation after interrupted command session

Second normal driver completed npm ci, start/env/reset, check-only types, lint,
typecheck, all **24 client suites /425 tests**, both DB suites **588/588**, and
web export. Its command session was lost during native export; at 16:40 UTC no
native completion metadata or new browser summary existed and no driver/Node
process remained. Supabase was still running. This interruption is not recorded
as a native/export or G1 pass. No C1/E2E invocation had started: additional Auth
consumption remains0. Resume from native export plus every remaining command,
keeping the existing stack without reset/restart. Record durable bounded step
receipts and explicitly verify shutdown; preceding completed checks remain valid
because application/package/test files have not changed.

### 2026-09-10 — Phase 1 / G1 complete (T006): PHASE 1 GREEN

Source remains `main` at `3c25659000ad5e8e7af66c43a9ffe460c94faade`.
The successful checks below supersede the incomplete G1 entries above; their
failure/interruption history and zero-Auth accounting are retained. Following
the test-only type annotation fix, the second driver passed every command
through web export. Native export and all remaining commands then passed on
the same running stack, without a reset/restart or intervening code change.
Node24.20.0/npm11.19.0 and the exact T002 dependency versions were used throughout.

| Executed command/check | Result |
| --- | --- |
| `npm ci` | PASS; original dependency declarations and existing resolved package versions preserved |
| `npm run supabase:start` / `npm run env:local` / `npm run db:reset` | PASS; only the five committed historical migrations applied |
| `npm run db:types:check` | PASS; check only, canonical bytes and file metadata unchanged |
| `npm run lint` / `npm run typecheck` | PASS, including the required-value TypeScript contract assertions |
| `npm run test:client` | PASS: 24 suites /425 tests, including all 11 standalone QR tests |
| `npm run db:test` | PASS: 2 suites /588 assertions (room288 + candidate300) |
| `npm run web:export` | PASS: current application static web export |
| `npx expo export --platform ios --platform android --output-dir dist/native-validation` | PASS: both platform metadata entries and emitted bundles verified |
| Four existing fixture posters | PASS: PNG, 240x360, <=65536 bytes; byte-identical copies found in both web and native exports |
| `npm run playwright:install` | PASS: existing managed Playwright Docker runtime |
| `npm run test:e2e:security` | PASS: expected controlled failure probe verified; scanner findings0 |
| `npm run test:e2e` | PASS: existing32/32 (Feature00124/24 + Feature0028/8), scanner findings0 |
| `npm run supabase:stop` and managed browser cleanup | PASS; driver exit0/cleanup0, no owned container or test/export process remains |
| `git diff --check` and new-file whitespace check | PASS; only the six approved Phase 1 paths differ |

Canonical database types retain SHA-256
`f6b77ecf056b1ccb68f2c43a48fccde2a305a5fe8ee20d0124120050d0415a69`
and inode/size/mtime_ns/ctime_ns
`444960/7370/1788966938747066009/1788966940057157360`.
No `db:types` write occurred. The nonexistent Feature003 migration runner is
inapplicable to G1; membership migration/concurrency receipts belong to Phase 2.

Poster byte sizes are cardboard-comet5011, pebble-bay-lanterns6521,
cloud-tram-four5616 and clockwork-orchard7711. Native export emitted iOS and
Android bundles; these and the web export validate the current application,
without claiming route-integrated QR, physical-device testing or browser QR
decoding. Owned ignored export output was removed after inspection.

Safe browser receipts: C1 `run-HkAC3R` completed at
`2026-09-10T16:42:32Z`; acceptance `run-oF8EFB` completed at
`2026-09-10T16:44:59Z`. C1 has two passing controls and its one expected failing
capture probe, which the security gate accepted with complete safe artifacts.
Both runners recorded successful cleanup and zero scanner findings. Existing
safe summaries remain in ignored test-results for review. Trace/HAR/video,
storage-state export, raw Auth/request/Realtime dumps and QR diagnostic capture
were never enabled; C1 implementation is unchanged.

Measured R02 consumption: Feature001 **47 signups /47 identities**, Feature002
**18/18**, C1 **1/1**, total **66/66**. The earlier failed and interrupted
pre-browser attempts each consumed0. No additional browser invocation, manual
signup, 429 retry or quota-limit change occurred. Prior recorded use was outside
the hourly window, so no quota wait was needed. Supabase was not restarted to
evade quota; continuation preserved the running stack until normal shutdown.

Final baseline audit: all142 protected existing files remain byte-identical,
including Feature001/002 specifications, product documents, historical
migrations/RPCs, generated types, candidates, PNGs, room routes and C1 harness.
Only package.json, package-lock.json, this log and tasks.md were modified;
only the standalone QR component and its tests were added. The room route does
not import the component. No generalized membership, new DB surface, G01-G09 or
T007+ work was performed. T001-T006 are complete; T007-T067 remain unchecked.

### 2026-09-10 — Phase 2 baseline and DB tests-first work (T007–T018)

Starting main HEAD: `10b0e5a930ea1aa8300fbab1672b71b5545b6435`; initial
working tree clean. SHA-256 captured for all148 tracked files before editing.
Node24.20.0/npm11.19.0 reused; no dependency installation/change in the DB block.
No Otteroom runtime was running at entry. The owned shell has an EXIT cleanup
trap and keeps the same local stack available through the internal DB/R01 gate.
No application/browser traffic or GoTrue signup is part of this block.

Read all normative inputs and inspected historical migrations and both complete
SQL suites. Specification checklist16/16, no unchecked item; extension hooks
absent. Scope is only T007–T050, one coherent cutover with no intermediate commit.
Phase1 QR and all T051+ work remain outside the current change.

`npm run supabase:start`, `npm run env:local`, and an existing-schema
`npm run db:reset` passed. Before any new migration existed, the focused room DB
suite produced the expected schema regression:54 assertions,9 failed, identifying
the missing member relation, count/creator fields, defaults, generated expression,
constraints and indexes. New creation/admission/integrity/security tests were
then authored before production SQL. A second pre-cutover run retained those
nine failures and stopped at the missing room_members relation used by its
statistics helper; this is expected incompatibility, not passing RPC evidence.

The pending complete migration was authored in task order and first applied
only after candidate tests/body and final dependency removal/ANALYZE were present.
No generated types or application cutover has run yet. No task is marked
complete until its required executable proof succeeds; later DB race/fault and
nonempty upgrade gates remain mandatory.

### 2026-09-10 — Phase 2 internal DB gate (T007–T026)

The complete additive migration was applied only after T012–T018 were authored.
Both real DB suites now pass: **922 assertions** (room/session560,
candidate362). Earlier test-authoring failures (JSON subtraction parentheses
and a fixture mutation selecting multiple members) were corrected in tests;
the production contract did not change. Full reset reproduced the result.

Real independent authenticated READ COMMITTED dblink callers prove create
unique-index waits and code-collision winner recovery in both creator modes,
with one room/member and no initialization UPDATE. Admission trials prove
owner-row-lock overlap and direct loser-on-winner pg_blocking_pids/pg_locks
waits: duplicate identity and final-slot trials have member INSERT/room UPDATE
winner1/1, loser0/0 and unchanged first-commit xmin; distinct free-slot callers
each1/1; non-voting creator0/3 plus three callers reaches3/3 with creator false;
existing-member recovery performs0/0. Count equals voter member rows after every
commit. A separately locked room does not block another room's real join/commit.
Candidate races cover voting/non-voting creators in three-voter rooms with
first assignment UPDATE1/0, repeat0/0, stable FK/xmin and member snapshots.

Creator absence and invalid non-creator/non-voter fault cases throw exceptionally
without repair. Post-member-INSERT and post-count-UPDATE faults roll back both
relations; explicit recovery is idempotent. All exact signatures, owners,
empty search_path, function ACLs, five-column RLS, denied roster/catalog/writes,
three valid member combinations, integer/configuration constraints and candidate
failure/non-disclosure/ordering assertions pass. No production test hooks exist.

`node scripts/check-room-membership-migration.mjs` passed the actual nonempty
legacy upgrade: Waiting, Ready/NULL and Ready/non-lowest candidate all preserved
exact logical identity/configuration/timestamps/assignment; target2/count1-or2,
five voter member rows, authenticated recovery without writes, and owner-visible
rooms.state statistics after ANALYZE. Bounded before snapshots stay in memory.
A real SIGTERM after legacy fixtures returned143 and still completed latest
reset with fixtures0. An independent latest `npm run db:reset` followed it.

One infrastructure correction was necessary: CLI2.116.0 recursively discovers
SQL throughout `supabase/tests`, including the new migration before/after
scripts. The original unrestricted command therefore failed on those scripts
while both pgTAP suites passed. `package.json` now scopes `db:test` to
`supabase/tests/database`; the user-facing `npm run db:test` command is unchanged.
A regression assertion in `__tests__/config/local-supabase-config.test.ts` guards
this separation. No dependency/lockfile/framework version changed. This implements
the planned isolation of destructive upgrade fixtures from ordinary pgTAP.

Post-gate owner count receipt: rooms0, members0, Auth users0, catalog4,
test schemas0, application triggers0, dblink callers0. All SQL work consumed
**0 GoTrue signup attempts / 0 browser identities**. No application/browser
traffic, G03/G04 or QR route integration has started. This internal gate is
**not** a releasable Phase 2 checkpoint.

### 2026-09-10 — Phase 2 R01 intentional generation (T027)

After T026, exactly one `npm run db:types` completed and the immediately
following `npm run db:types:check` reported consistent. No manual patch was made.
Reviewed final rooms10/member5 shapes, member→rooms and rooms→catalog FK
metadata, required three create arguments and both eight-field RPC returns;
candidate Args/Returns stayed unchanged. Public-only generation omits Auth FKs
and private helper, as expected. Logical result nullability is validated by the
client contract, not manually patched into generator output.

Canonical receipt for later independent check-only validation:

```text
sha256=fcd0b773b75e71bc74dfaddde2fd96ecf05e62f132eac0132ba2777891890cea
inode=571258
size=8442
mtime_ns=1789063032339221814
ctime_ns=1789063034039306100
```

T007’s owned Supabase block stopped successfully; project-container inventory
returned zero. Protected baseline33 files (historical migrations, Feature001/002
specs, product docs, posters, Phase1 QR component/test and lockfile) remained
byte-identical. The new pgTAP-discovery regression passed16/16 config tests.
No browser traffic or GoTrue signups occurred. T028 onward and G2 are pending.

### 2026-09-10 — Phase 2 client cutover (T028–T040)

Tests-first contract/service run:31 expected failures/111 tests against the
old six-field client. After exact eight-field parser/three-argument service and
five-field refetch,111/111 pass. Consumer tests ran before state/UI changes:
57 expected failures/164 tests across home, room, state and subscription, with
both unchanged candidate consumers already passing their generalized fixtures.
After implementation all six consumer suites pass164/164.

Home has text2 and initially unselected explicit participation, whole-number
validation, and a frozen request UUID/target/choice across duplicate handlers,
transport/navigation failures and retry. Room renders actual0/3→1/3→2/3→3/3,
creator mode and creator invitations in Waiting and Ready. Immutable flags/target
and monotonically observed counts survive refetch, stale results and recovery.
The existing single rooms channel/lifecycle is retained; candidate UPDATE is
only invalidation. Candidate hook implementation needed no change: accepted ID
and Ready remain its only runtime inputs. All valid member modes preserve
local poster failure/retry with zero acquisition/Auth delta. QR stays unimported.

The new local Supabase config/discovery regression also passed16/16. No browser
identities have been created; G03/G04, C1 and full G2 are still pending.


### 2026-09-10 — Phase 2 browser preparation and static gate (T041–T049)

Room/candidate harnesses now use exact eight/five-field contracts, bounded private
member snapshots and 2–4 independent candidate callers. Existing24 E/Auth and8 F
trials retain their47+18 identity allocation. Only G03/G04 are added, with3+4
identities; QR integration and all other G cases remain absent.

The updated diagnostic/runtime tests first failed4/46 on the missing Phase2
metadata/discovery. After the two cases and narrow labels/locations were added,
46/46 pass, including retained C1 negative tests and 2/3/4-caller barrier cleanup.
Discovery is34 cases/72 identities; C1 adds1. Suite timeout600s, each G case90s,
workers1/retries0 and all capture restrictions unchanged. Only historical Auth
budget comment/diagnostic labels changed; anonymous_users stays150.

T049: lint and typecheck PASS; full client24 suites/511 tests PASS; web, iOS and
Android exports PASS. All four240x360 original PNGs have byte-identical exported
copies on web/native and remain <=65536 bytes. Lint initially rejected render-time
ref access in home configuration presentation; state now drives the disabled
presentation while the event-owned request remains frozen. Regression tests pass.
Active room authority has no host/guest union or fixed-two count, and exactly one
rooms UPDATE channel remains. The standalone QR has no route import.

No GoTrue/browser identities consumed yet. Real E/F/G execution and the complete
T050/G2 checkpoint are pending; this entry does not claim an end-to-end pass.

### 2026-09-10 — G2 first complete execution and G03 harness correction

The normal command path passed npm ci, owned start/env, nonempty actual upgrade,
independent reset, check-only R01 with identical bytes/inode/size/mtime/ctime,
lint/typecheck, client24/511, DB922, all exports/posters and managed browser setup.
Post-pgTAP receipt: rooms0/members0/Auth0/catalog4/triggers0/dblink0/retired columns0.
Actual catalog inspection confirmed all four function owners/security/search_path,
exact eight/eight/five-field public RPCs, only five readable room columns and
rooms-only publication. C1 PASS, findings0, one signup/identity.

Acceptance started after 18:29:06 UTC:33/34 passed (E24/24, F8/8, G04 PASS).
G03 failed its response-completion counter comparison after Waiting reload and
actual socket loss. That counter can advance for a request dispatched before the
outage. The harness now separately observes request dispatch, and G03 requires
zero new reads while disconnected or while real system-ok remains held, followed
by a new read after release and real Ready/candidate recovery. A synthetic event
regression proves a delayed prior response increments completions without new
request dispatch; no timing sleep or fabricated server success replaces the case.
The corrected lint/typecheck and diagnostic/runtime47/47 tests pass.

This first invocation consumed72 acceptance +1 C1 =73 attempts/identities,
including the failed G03. Scanner findings0; required driver failure cleanup
stopped Supabase and removed its browser runtime. These73 remain charged despite
that shutdown. Corrective validation reserves another C1=1, focused G03=3 and
complete acceptance72: cumulative149 <=150. The next start is for validation
after mandatory failure cleanup, never quota avoidance; no reset/limit increase,
429 retry or lost-attempt accounting is allowed. Full G2 is still pending.

Corrective static/C1 execution: full client24/512 PASS and C1 PASS/findings0.
An overly anchored focused selector (`^@membership G03 `) matched no full
Playwright title (the runner prefixes project/file titles), so its safe controller
failed before any test/Auth execution:0 attempts/identities, findings0, cleanup0.
This is not a G03 result. Use the reviewed bounded `--grep G03` selector instead.
Cumulative accounting is74; focused3 plus complete72 still totals149. No third
C1 run is needed: its implementation/source and successful evidence are unchanged.

Focused G03 then consumed3 identities and reached its final business assertions,
but the Realtime health guard still failed. The remaining test assumption was
absolute read totals after reload:2 could already be satisfied by pre-reload
system/UPDATE responses. Each observed G03 reload now holds the actual new
system-ok, starts an exact five-field request observer, releases that binding,
and waits for that request's own successful body/completion before disconnect.
This keeps the zero-premature-read guard intact and establishes causal evidence
without sleeps. Lint/typecheck and diagnostic/runtime47/47 PASS. No application,
RPC, schema or C1 capture implementation changed for either harness correction.

Cumulative attempts/identities77; the next complete acceptance allocation of72 identities
ends at149. No extra focused run/C1 is scheduled. Prior successful static/DB/export
and C1 evidence remains applicable; the final changed E2E source will run all34
trials. Each stopped stack was the required failure cleanup; its charged budget
is retained across the validation restarts, with no quota/configuration change.

The following complete run again passed E24/F8/G04 (33/34), with G03 stopped by
the observer's failure flag; its business result is not accepted as a green case.
Total charged attempts/identities is149. All completed controllers reported
findings0 and owned-runtime cleanup succeeded. Browser validation is paused
outside the harness; no 429 occurred and quota has not been raised or reset in
accounting.

Two additional synthetic event regressions reproduced separate lifecycle defects
in the existing observer (2 expected failures/5 tests): a retired socket could
still change binding counters, and retrieving an old navigation's response body
could fail after reload and poison the current test. Connection membership guards
now discard retired socket callbacks. A weak request/navigation association ignores
only unavailable bodies of known retired requests; current/unknown body failures
and available malformed/private projections still fail. Valid old bodies are still
checked/counted, preserving delayed-response assertions. The five regressions pass,
as do lint/typecheck, diagnostic/runtime52/52 and full client24/517. No production
Realtime or C1 capture behavior changed; real G03 remains pending rerun.

Conservative R02 scheduling uses finalized safe-summary timestamps, each later
than every signup in that invocation. After19:34:40 UTC the first73 identities
are at least one hour old; at most76 remain charged. One new C1 plus complete
acceptance reserves73 more, giving hourly upper bound149 (lifetime total222 if
successful). Wait outside Playwright/Supabase until that admission time; preserve
all failed and zero-test invocation counts. Runtime restarts are only the mandated
failure-cleanup/validation lifecycle, never a substitute for this quota wait.

During the outside-harness wait, one additional observer regression first failed:
the first failure's location was replaced by a later wait/health-check location.
The observer now retains its own fixed `E2E_SAFE_FAILURE` at the observation
site, never the network exception or payload. The existing safe boundary still
projects only an approved source path and numeric location; no reporter/capture
permission changed. Focused lifecycle7/7 and full client24/518 pass, with lint,
typecheck and whitespace checks passing. These checks consumed zero identities.
Protected baseline40 files, including the R01 script, remain byte-identical;
canonical generated bytes and all recorded metadata are still unchanged.

### 2026-09-10 — Phase 2 final G2 checkpoint: GREEN (T007–T050)

The outside-harness quota gate admitted the next owned stack at19:34:40 UTC.
C1 plus unfiltered acceptance ran from19:35:25 to19:42:27 UTC. Final receipts:
`test-results/run-canxXG` (C1 PASS, expected controlled negative probe with all
required artifacts) and `test-results/run-VTgIkm` (**34/34 PASS**). Both finalized
controller scans have **0 findings**, all contexts report cleanup, and no Auth
budget failure occurred. Browser runtime removal and driver shutdown passed;
the complete corrective driver returned0 with cleanup0.

G03 PASS: voting creator3/yes at1/3, link voter2/3, real Waiting reload/socket
outage, manual final voter3/3, existing clients converge and returning voter
refetches only after real system-ok. Three first candidate calls were held with
forwarded0; membership UPDATE2 then assignment UPDATE1, one FK and three matching
visible local posters. Creator/voter reload, reconnect and repeated re-entry
preserve members/FK/xmin with automatic acquisition totals2/2/1 and3 identities.

G04 PASS: non-voting creator3/no observes0/3→1/3→2/3→3/3, remains authorized and
contributes0 while three voters assemble. Waiting automatic candidate calls0;
direct ensure returns not_ready. Four first calls were held before forwarding;
all four receive the same candidate/poster with admission UPDATE3 and assignment
UPDATE1. Post-success acquisition failure/retry and exact bundled poster failure
before voter reload/retry preserve members/FK/xmin; poster retry adds0 candidate
RPCs and0 Auth calls. Four identities, all recovery using existing sessions.

Final E/Auth regression **24/24**, F01–F08 **8/8**, G03/G04 **2/2**. Actual final
acceptance allocation is E47 +F18 +G03:3 +G04:4 =**72 signups/72 identities**;
C1 adds1, final successful browser block **73/73**. All preceding failed/targeted
invocations remain counted:149 +73 =**222 signups/222 identities across quota
windows**. At admission at most76 previous identities remained within the hour,
so the conservative hourly bound was149 including the reserved73. The wait was
outside the harness; no429, limit increase, automatic retry or restart/reset to
evade quota. Earlier shutdowns were mandatory failed-driver cleanup.

The initial complete normal path supplied successful npm ci, start/env, actual
nonempty legacy migration/statistics proof, independent clean reset, check-only
types, lint/typecheck/client/DB, web/iOS/Android/poster exports and managed browser
setup. Subsequent changes affected only the E2E observer/cases and their tests;
their affected gates were rerun: lint/typecheck PASS, latest full client
**24 suites/518 tests PASS**, C1 PASS and all34 real trials PASS. DB remains
**922/922** (room/session560 +candidate362); production DB/client/export inputs
did not change after their successful gates. All four original240×360 PNGs were
reverified byte-identical in web/native exports before removing owned exports.

R01: exactly one intentional generation atT027; every later validation used
check-only. Final SHA-256 is
`fcd0b773b75e71bc74dfaddde2fd96ecf05e62f132eac0132ba2777891890cea`;
inode571258, size8442, mtime_ns1789063032339221814 and
ctime_ns1789063034039306100 remain identical to the original canonical receipt.
Protected baseline40 files remain byte-identical, including historical
migrations/specs/product docs, candidate implementation/posters, Phase1 QR and
lockfile/R01 script. The sole package script correction is the recorded pgTAP
directory isolation; dependency/framework pins did not change.

Final cleanup: owned Supabase/browser containers0, app/API/DB ports closed,
migration lock absent and owned web/native exports removed. Safe finalized test
receipts remain ignored for review; temporary authoring/migration material is
removed after the final baseline audit. Tracked and new-file whitespace checks
pass. One rooms channel, no retired host/guest authority, no QR route integration,
no future G cases or product scope. T001–T050 are complete; T051–T067 remain
unchecked. No branch, commit or push was created. This supersedes the earlier
pending/failed G2 attempts without discarding their evidence or Auth accounting.

### 2026-09-10 — Independent Phase 2 review: corrections and validation

The review found two localized contract/evidence issues. The room route exposed
the invitation only to the creator, although the approved room projection
contract retains sharing for ordinary Waiting members. It now shows the same
link after joined/already_member while Waiting and hides it after Ready for
ordinary voters; creators retain their invitation after assembly. Two new
behavioral assertions failed before the correction; the focused route suite
then passed39/39. G03/G04 also assert the same link during intermediate admission
and recovery, without adding identities or QR integration.

The migration runner correctly refused retained acceptance data before its
destructive legacy reset, but the normal command path omitted its empty-database
precondition. The initial review driver stopped at preconditions and performed
owned shutdown, consuming0 signups. The command path now explicitly prepares
the owned local validation database with db:reset before invoking the runner;
the independent reset after migration remains. Existing R02 charges survive
this data cleanup. No runner/migration/RPC implementation changed during review.

The corrected command path passed npm ci, local start/env, preparatory reset,
the real nonempty legacy upgrade (three rooms, statistics and authenticated
recovery), independent reset and db:types:check only. Canonical bytes/inode/size/
mtime/ctime remained identical to T027. Lint/typecheck PASS, client24 suites/519
tests PASS, DB922/922 PASS, web/iOS/Android exports PASS, all four original PNGs
byte-identical in both exports, managed browser setup PASS. Post-pgTAP inspection
confirmed ten room columns, five member columns, exact public signatures, the
private helper, postgres owners/SECURITY DEFINER/empty search_path, authenticated
EXECUTE only apart from owner, five readable room fields and rooms-only
publication. Test rooms/members/Auth users/application test triggers all0.

Review C1 receipt `test-results/run-ETnFeE` passed with one identity and scanner0.
The complete acceptance receipt `test-results/run-gXx6OQ` passed33/34: all24 E/Auth
and both G03/G04 passed, while F04 exceeded its overall30000ms test deadline.
It did not report an isolation assertion failure. This invocation consumed72
signups/identities, including the failed case; cleanup passed and scanner0.

F04 covers two room lifecycles, four contexts and repeated isolation checks
around acquisition/reload/reconnect/retry. Its case-level budget is now60000ms;
all assertions, per-operation/barrier deadlines, retries0 and diagnostic capture
restrictions remain intact. Lint/typecheck passed again; the focused F04 rerun
passed all existing assertions with4 signups/identities, scanner0 and successful
owned shutdown. No application/SQL/C1 implementation was changed for this fix.

Review accounting so far: initial preparation failure0 +C1:1 +complete72
+focused4 =77. Prior Phase2 attempts222 remain charged in lifetime accounting,
giving299 signups/299 identities across quota windows. At review admission the
older149 were already outside the hour; prior successful73 +review77 gives a
conservative rolling bound150. Reserve the next complete C1+acceptance73 only
after20:42:30 UTC, later than the prior successful acceptance's finalized summary
at19:42:25.386701 UTC plus one hour. Then review77 +reserved73 is at most150.
Wait outside the harness; no429, quota increase, automatic retry, or restart/reset
as a quota workaround. A new final complete receipt is pending; this entry does
not reinterpret the failed unfiltered review invocation as green.

### 2026-09-10 — Independent review final checkpoint: READY FOR COMMIT

The outside-harness gate admitted the final block at20:42:30.002082 UTC.
Local start/env, a fresh reset and db:types:check only passed. Canonical SHA-256
`fcd0b773b75e71bc74dfaddde2fd96ecf05e62f132eac0132ba2777891890cea`,
inode571258, size8442, mtime_ns1789063032339221814 and
ctime_ns1789063034039306100 remained unchanged; no additional generation occurred.

Final C1 receipt `test-results/run-6TPwZa` passed with the expected controlled
negative probe, all required artifacts and scanner0. Final unfiltered acceptance
receipt `test-results/run-HpTpIa` passed **34/34** on the final source:
E/Auth24/24, F01–F08 8/8, G03/G04 2/2. Scanner findings0, all participant cleanup
receipts true and no Auth budget failure. F04 retains every isolation and
recovery assertion; its preceding focused PASS receipt is
`test-results/run-lbRKcN`. G03/G04 retain the added ordinary-Waiting invitation
checks. No future G case or QR integration was added.

The final block consumed C1:1 +E47 +F18 +G03:3 +G04:4 =**73 signups/73 identities**.
Total review consumption is0 preparation +73 first block +4 focused +73 final
=**150 signups/150 identities**. With the prior development222, Phase2 and review
total **372/372 across quota windows**. Earlier failed/targeted attempts remain
included. Both review admission bounds were at most150; the final full block
waited until the previous implementation's73 expired, retaining review77 in the
window. No429, limit increase, automatic retry or quota-evading reset/restart.

The review's successful nonempty migration, full DB922 (room560/candidate362),
client24/519, web/iOS/Android/four-poster exports and npm ci evidence above remain
applicable: their inputs did not change afterward. Only F04's case-level time
budget changed before the focused/final browser runs; lint/typecheck passed after
that correction. The final driver returned0, shutdown passed, owned Supabase/
browser containers0, application/API/DB ports closed, migration lock absent and
owned export directories removed. Safe finalized browser receipts remain ignored.

Review findings: BLOCKING0, MAJOR0, MINOR3, all corrected; unresolved0. Review
changes are limited to app/room/[code].tsx, its route tests, the G03/G04 suite,
F04's suite and this quickstart. No SQL/RPC/generated-type/C1 implementation or
dependency change was made during review. Protected baseline40 files remain
byte-identical; product decisions and approved architecture are unchanged.
T001–T050 remain checked and T051–T067 unchecked. No commit, push, branch or
Phase3 implementation was performed. This final receipt supersedes the pending
review checkpoint while preserving its failure and quota evidence.

### 2026-09-11 — Phase 3 G3 checkpoint: GREEN (T051–T064)

The room route now renders the standalone local QR from the exact same
`invitationLink(authoritativeRoomCode)` value as the selectable invitation text.
Creators retain both after Ready; ordinary members can share them while Waiting.
Route tests cover recovery, stale-route replacement, mobile scrolling and an
isolated QR render failure/retry that preserves room/candidate state and adds zero
room or candidate RPCs. The focused route suite passed **40/40**.

The browser-only QR harness selects one visible labelled SVG, verifies positive
viewport bounds and center hit-testing, accepts only bounded SVG geometry and
definitions, removes the validated React Native root layout style, rasterizes the
selected subtree through an in-memory Blob/canvas and independently decodes it
with pinned jsQR. SVG is capped at64KiB and RGBA at512×512. Scripts,
foreignObject, raster images, event handlers, external URLs/fonts and unknown
content fail closed. Blob URLs and all pixel/markup buffers are revoked or cleared
on every exit. It creates no screenshot, attachment, payload dump or persisted QR
asset. Boundary/cleanup and final diagnostic metadata tests passed.

Final discovery is **41 browser cases / 91 identities**: E/Auth24/47,
F01–F08 8/18 and G01–G09 9/26. G01–G09 all passed on the final source, including
four creator configurations with decoded visible QR, same-session configuration
stability, idempotent decoded-target admission, voting/non-voting assembly,
final-slot competition, ordinary-JWT isolation and recoverable/committed join
failures. The unfiltered receipt reported every case passed, retries0, workers1,
all context cleanup receipts and scanner findings0. C1 passed separately with its
expected controlled negative probe and one identity; the final block was
**92/92 signups/identities**.

Development accounting retained every earlier partial run: two initial G01–G09
attempts consumed21 each, a loader failure consumed0, focused G01 attempts
consumed1+1, and the G02/G05/G06/G07 selection consumed11. The final C1+complete
block consumed92. A stricter post-gate G02 authoring attempt failed safely with
scanner enforcement and consumed1; its corrected rerun passed all six transport
trials with scanner0 and consumed1. The final focused G01 validation rerun consumed
the last1, for **150 signups/150 identities** in the active window. No429, rate
change, automatic retry or quota-evading restart occurred.

The complete G3 path passed npm ci, local start/env, a preparatory clean reset,
the real nonempty migration cutover (**3 legacy rooms, 5 synthetic users,
statistics=true, authenticated recovery=true, no reassignment, generated types
unchanged**), its owned latest reset, then an independent clean reset and
`db:types:check` only. Lint and typecheck passed. Client tests passed
**24 suites / 521 tests** and pgTAP passed **922/922**. Web, iOS and Android
exports passed; the web bundle contains the integrated QR implementation and all
four original candidate PNGs are present in export output. Native evidence is
module-bundle/export evidence only; no physical camera/scanner runtime was added.

R01 remains check-only in Phase3. The established rooms-only Realtime channel,
C1 policy, DB migrations/RPCs/generated types, Feature001/002 artifacts, product
docs, dependency pins and four source PNGs are unchanged. There is no external
QR/movie provider, stored QR asset, second channel or future product interaction.
The final driver returned0 and removed the browser runtime and Supabase stack.
T001–T064 are complete; T065–T067 remain unchecked. No commit or push was made.

### 2026-09-11 — Phase 3 final barrier audit: quota-blocked continuation

The G3 run above is green for its exact source, and subsequent focused G01 and
G02 reruns are green after strengthening validation and the six creation
transport trials. A final audit then found that G05/G06/G07 dispatched concurrent
real joins but did not hold every outgoing request at an observable browser
barrier before forwarding, as T057–T059 explicitly require. The shared harness
now counts all arrivals, proves forwarded0 at the barrier, releases together and
cleans every route. This latest harness change has passed typecheck but has not
yet been executed against the real stack.

R02 is the only remaining blocker: the final focused G01 consumed the 150th
signup/identity in the current window. Running G05/G06/G07 now would knowingly
cross `anonymous_users=150`, so no attempt or automatic429 retry was made. The
first development group becomes conservatively eligible outside the harness
after **2026-09-10 22:12 UTC**. T057–T059 and the final-source T064 checkpoint are
therefore reopened; T051–T056 and T060–T063 retain successful evidence. Supabase
and the browser runtime are stopped. This entry supersedes only the premature
completion bookkeeping, not the recorded successful receipts.

### 2026-09-11 — Strengthened admission barriers: GREEN (T057–T059)

The outside-harness gate opened after22:12 UTC; the single targeted invocation
started after22:15 UTC. G05, G06 and G07 passed once on the strengthened source
through the normal safe runner with **10 signups/10 identities** (2+4+4), scanner
findings0 and complete browser/Supabase cleanup. Each case observed every planned
outgoing `join_room` request at the shared barrier, asserted forwarded0, released
the gate once, and observed exactly the planned number forwarded. G05 produced
joined/already_member for one subject and one membership increment; G06 admitted
three distinct voters while preserving the creator's non-voting row; G07 produced
exactly joined/full at the final slot and stable full/re-entry behavior. No429,
automatic retry, rate/configuration change or quota-evading restart occurred.

### 2026-09-11 — Final-source G3 checkpoint: GREEN (T064)

The complete final-source checkpoint passed. npm ci and local start/env passed;
a preparatory reset admitted the real nonempty migration proof, which preserved
three legacy rooms and five synthetic users and reported `statistics=true`,
authenticated recovery, no reassignment and generated types unchanged. Its owned
latest reset and the independent clean reset passed. `db:types:check` alone
reported the canonical artifact consistent; `npm run db:types` was not executed.

Lint and typecheck passed. Full client validation passed **24 suites / 521 tests**;
pgTAP passed **922/922**. Web, iOS and Android exports passed. The web bundle
contains the integrated local QR implementation, native metadata exists, and all
four original candidate posters are bundled. No camera/native scan dependency or
external QR/movie service was introduced.

The first Playwright image preparation attempt failed before Auth because of a
transient Docker preparation/registry check and consumed zero identities. The
already-present pinned image was verified locally; the next preparation passed.
C1 then passed with A/B and the expected controlled C failure, one signup/identity,
all required artifacts and scanner findings0. Unfiltered acceptance passed
**41/41**: E/Auth24/24, F01–F08 8/8 and G01–G09 9/9, with **91 signups/91
identities**, retries0, workers1, scanner0 and all cleanup receipts.

The new quota window consumed **10** identities for the one targeted G05–G07 run
plus **92** for C1 and complete acceptance, exactly **102 signups/102 identities**.
No429, automatic retry, quota/configuration change or restart to evade quota
occurred. Supabase and both Playwright runtimes were removed by their owning
drivers. T001–T064 are complete and T065–T067 remain unchecked. No commit or push
was made.

### 2026-09-11 — Focused pre-commit review corrections: GREEN

The focused review found that successful earlier cases did not fully prove five
planned boundaries. The QR decoder now returns the independently decoded target,
checks the SVG itself with opacity/CSS visibility, and its failure test clears a
nonzero RGBA buffer. G05 now launches two same-session pages through that decoded
target and verifies both authenticated subjects at the observed-before-forward
barrier. G06 exercises the non-voting creator's QR/link/code, reload and real
Realtime recovery before and after the three-voter barrier. G07 holds the sole
candidate request while one Realtime membership UPDATE is counted, checks a
strict-null full projection, then recovers all existing members. G08 adds own and
foreign ID/code reads, foreign candidate non-disclosure, strict-full join and
denied member/catalog mutations. G09 holds the committed upstream response until
the owner snapshot proves membership, then verifies the retry's exact
`already_member` result. The shared join barrier now validates JWT subjects and
settles pending calls on every exit; G02's duplicate create path also observes
both same-subject requests held with forwarded0 before release.

Lint and typecheck passed. The affected client/config/route selection passed
**3 suites / 94 tests**. One normal safe targeted browser invocation passed
**G02/G05/G06/G07/G08/G09 6/6** with **18 signups/18 identities**, retries0,
workers1, scanner findings0 and owned browser cleanup. G05/G06/G07 each observed
all expected subjects before forwarding; G07 observed exactly one membership
Realtime UPDATE while candidate assignment was held. The full 92-identity gate
was not repeated because these changes are confined to the reviewed QR and G-case
assertion harnesses; every affected browser case was rerun. The prior final G3
receipt remains the complete inventory result, and T001–T064 remain complete.
