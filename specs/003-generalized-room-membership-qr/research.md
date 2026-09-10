# Research: Generalized Room Membership & QR Join

**Date / source access date**: 2026-09-10
**Status**: Technical decisions resolved; implementation and runtime validation have not occurred.

The constitution, product vision, roadmap, reviewed specification/checklist,
completed Feature 001/002 plans/models/contracts and relevant implementation
were read. Independent research covered all five migrations, both full database
suites, existing browser suites/harnesses, credential diagnostics and QR sources.
The impact inventory in [plan.md](plan.md) precedes implementation design.

## R1 — Membership, count and capacity authority

**Decision:** Normalize admitted membership into `public.room_members`; retain
`public.rooms` as the serialization point and its `voter_count` as an atomic
summary. Creator ownership and membership voting status are independent. Every
creator has one member row, including the non-voting creator. Only hardened
create/join RPCs insert members; only join increments an existing room's count.

**Rationale:** Unique `(room_id, user_id)` prevents duplicate membership; the
locked room summary supplies a single capacity decision. Join checks existing
membership before fullness. Read Committed `SELECT ... FOR UPDATE` waits and
returns the current row after the preceding writer commits. A subsequent member
lookup sees the winner's committed insertion. The application never estimates
capacity from a prior unlocked count or current connections.

**Alternatives rejected:** numbered guest columns, UUID arrays/JSON and permanent
host/guest mirrors lack a normalized unique membership boundary. Presence or
device counts lose admitted members on disconnect. An unlocked aggregate count
allows competing admissions. A creator/voter/display role enum wrongly makes
independent dimensions exclusive. No custom backend or Edge Function is needed.

**Evidence:** [PostgreSQL 17: explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html)
and [Read Committed isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
support the lock/current-row design. [Constraints](https://www.postgresql.org/docs/17/ddl-constraints.html)
support row checks, uniqueness and FKs; an ordinary CHECK cannot enforce a
cross-table aggregate. The cross-table invariant is therefore enforced by the
exclusive transactional write surface, with real database tests, rather than
an invalid aggregate CHECK. Privileged maintenance is outside the client model.

## R2 — Exact migration and green-main cutover

**Decision:** One future versioned migration,
`supabase/migrations/20260910000000_generalized_room_membership.sql`, performs
the complete database cutover in one transaction. Its implementation phase also
contains generated types, client parsing/services/state, create configuration,
room counts, candidate compatibility and affected regressions. There is no
intermediate committed DB/client mismatch and no temporary public compatibility API.

Rename `host_user_id` to `creator_user_id`; migrate host and optional guest to
voter member rows; backfill required/count to 2 and 1/2. Change the generated
state expression using PostgreSQL 17 `ALTER COLUMN state SET EXPRESSION AS`.
Replace dependencies explicitly, then drop `guest_user_id`; no final host or
guest columns remain. Preserve logical room fields and both timestamps; do not
expect physical row versions to survive the table rewrite.

After replacing the generated expression and completing the schema cutover,
execute `ANALYZE public.rooms` as postgres before the migration transaction commits.
PostgreSQL 17 documents that SET EXPRESSION removes the column's statistics and
recommends ANALYZE afterward. This refreshes statistics without changing the
selected count-derived state model.

**Rationale:** [PostgreSQL 17: ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html)
supports replacing a generated expression in place. Changing a function's return
type requires dropping/recreating it; adding create parameters alone would leave
an obsolete overload. [CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html)
supports the explicit function replacement/ACL treatment. The detailed order is
in [data-model.md](data-model.md).

**Alternatives rejected:** changing only DB and waiting until a later committed
phase for client/types; two permanent membership authorities; legacy wrappers
that accept an implicit creator voting default; editing historical migrations;
replacing rooms or candidates. A larger atomic vertical phase is the smallest
coherent contract change here. Run migrations with application traffic stopped;
rolling compatibility with cached old clients is not promised.

**Migration evidence design:** Reuse the Feature 002 quickstart's version-limited
reset technique. Installed CLI `2.116.0` help was inspected without starting a
service: `db reset --local --version 20260909000001 --no-seed` and
`migration up --local` are supported. A future bounded runner installs three
controlled legacy rows, applies the actual migration and verifies preserved
logical fields/memberships before restoring a clean latest database. An empty
reset alone cannot prove migration of existing rooms.
The nonempty upgrade validator also verifies completed post-cutover ANALYZE and
rooms.state statistics in pg_catalog.pg_statistic as owner; do not rely on
autovacuum timing or fixed estimate values. Empty reset still executes ANALYZE
successfully without requiring statistics for absent rows.

## R3 — Privacy without exposing a membership roster

**Decision:** RLS on rooms uses the unexposed helper
`private.is_room_member(p_room_id uuid) RETURNS boolean`. It reads only the
caller's membership using `auth.uid()`, never a supplied user ID. It is a
`STABLE SECURITY DEFINER` SQL function, owner `postgres`, empty search path,
with fixed schema-qualified SQL. The private schema is absent from exposed API
schemas/search paths. Authenticated has USAGE and exact helper EXECUTE, but no
CREATE. PUBLIC/anon cannot execute. Missing, unrelated and NULL inputs return
false, including a missing subject.

`room_members` has RLS, no client policies and no client table/column grants.
Rooms grants permit only `id, code, state, voter_count, required_voter_count`.
The two participant-specific booleans come from room RPCs; no roster or member
ID is exposed. Stable member IDs are useful relational keys but not required by
the Feature 003 client, so are kept server-side.

**Rationale:** A definer can evaluate membership without requiring caller read
access to private identities. The helper accesses only the membership table;
there is no recursive rooms-to-members-to-rooms policy. Public mutation RPCs
still implement authorization themselves and do not rely on RLS bypass for
permission. Exact function ACLs and column grants need separate tests.

**Alternatives rejected:** broad membership SELECT; own-membership SELECT that
exposes columns the client does not need; recursive policies; an exposed general
membership lookup RPC. The helper's one boolean for the caller is the minimum
authorization operation and does not disclose foreign room existence.

**Evidence:** [PostgreSQL 17: row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html),
[Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions)
support the private definer pattern, explicit identity checks and safe search path.

## R4 — Existing Realtime remains sufficient

**Decision:** Publish only rooms and retain one exact-room UPDATE subscription,
`select: ['id']`. An admitted voter insert and the count/timestamp UPDATE commit
together. Authorized observers refetch the five-column room projection. No
member-table publication, Presence, polling, Broadcast or second channel.

**Rationale:** Supabase Postgres Changes evaluates access for the subscriber.
The RLS helper changes SQL execution owner while `auth.uid()` still reads the
subscriber JWT claims. This is source-supported compatibility, not a claimed
runtime pass. Actual Data API and Realtime delivery to a non-voting creator and
prior voters are required at the cutover checkpoint. Generated state is read
from PostgreSQL, never inferred from a replication payload.

Keep the existing distinction between transport SUBSCRIBED and current
`postgres_changes` system-ok. Initial/reconnected system-ok refetch, request and
generation guards, coalescing and removal-before-replacement stay intact.
Monotonic count protection now covers intermediate Waiting counts as well as
Ready; candidate UPDATE invalidations cannot reset acquisition.

**Evidence:** [Supabase: Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
describes RLS-bound delivery; [Supabase WALRUS source](https://github.com/supabase/walrus/blob/master/sql/walrus--0.1.sql)
shows subscriber role/claims for row checks. Repository
`src/rooms/use-room-subscription.ts` and `e2e/support/room-harness.ts` supply the
already-proven binding/readiness/reconnect mechanism; no unrelated re-research
or replacement of that mechanism is needed.

WALRUS is upstream corroboration, not a claim that its current source is byte-
identical to the pinned Realtime server. The real subscriber acceptance gate
remains mandatory for this membership-policy change.

## R5 — Creation retry and candidate compatibility

**Decision:** Preserve `created`/`already_created` and join's existing closed
outcomes. Create takes request UUID, integer count and explicit boolean choice.
Validate non-null/valid inputs before lookup. Reusing a request with a different
valid configuration returns the original persisted configuration without
mutation or a new product outcome. The UI freezes the submitted configuration
with that request through retry; a deliberate new action uses a new UUID.

Creation inserts room plus creator member in one subtransaction. Keep the
proven named-constraint conflict routing and five cryptographic code attempts;
recover a concurrent winner only by creator/request. Failures cannot leave a
room without its creator member. Join locks room before membership/capacity
decisions and returns a valid existing membership before checking fullness.
If membership is missing for the creator, raise an exceptional integrity failure
before capacity/admission: no member insertion, count change, creator promotion
or joined/full result. Only a non-creator without membership can be admitted
as a new voter and increment the count once. An encountered persisted
non-creator non-voter is also an exceptional room RPC projection failure.
Neither failure adds a business outcome or a second creator-choice authority.
Planned rollback-scoped SQL faults prove real authenticated join rejects these
states without writes and restores test state deterministically; see
[room RPC evidence](contracts/room-rpcs.md#creator-and-member-integrity-fault-evidence).

`ensure_room_candidate(uuid)` retains its five-column result and three outcomes.
Only authorization and Ready predicate change. An existing assignment is
returned without UPDATE, even if it is a non-lowest fixture; empty or broken
catalog integrity remains exceptional. No fixture/poster/client-acquisition
redesign is necessary.

**Alternatives rejected:** new configuration-conflict business outcome; mutating
settings on retry; implicit creator voting default; silently repairing missing
creator membership as a voter; projecting false/false as a legitimate member;
candidate readiness based on guest; random/reselected candidates. Local evidence is the reviewed spec
FR-004/019/033–035 and existing RPC implementations/contracts.

## R6 — QR display and pinned compatibility

**Decision:** Use `react-native-qrcode-svg@6.3.24` and Expo-selected
`react-native-svg` (SDK 57 selects `15.15.4`). Implementation alone runs
`npx expo install react-native-svg`, then exact QR package installation and
commits the lockfile. Keep React/RN/Expo versions unchanged.

**Rationale:** The Expo SDK 57 support matrix and installed bundled-native-module
manifest agree. Published QR peers accept React, RN >=0.63.4 and SVG >=14;
RN 0.86 needs no legacy TextEncoder transformer. Encoding and SVG paths are
local. Black/white, error correction M, no logo/network, a clear margin and a
labelled wrapper are sufficient. QR generation is deterministic for the same
input/options; incidental SVG IDs are not acceptance identity.

The selected package calls `onError` during rendering. Use a local keyed error
boundary instead of updating a parent from that callback. Preserve text/code
when QR rendering fails. No room operation follows that failure.

**Evidence:** [Expo SDK 57: react-native-svg](https://docs.expo.dev/versions/v57.0.0/sdk/svg/),
[react-native-svg upstream](https://github.com/software-mansion/react-native-svg),
[QR package metadata 6.3.24](https://registry.npmjs.org/react-native-qrcode-svg/6.3.24),
[QR package documentation](https://github.com/Expensify/react-native-qrcode-svg),
[QR component source](https://raw.githubusercontent.com/Expensify/react-native-qrcode-svg/main/src/index.js)
and [DENSO WAVE: QR margins](https://www.qrcode.com/en/howto/code.html).
Native/web bundle and actual web decode tests remain required; documentation
and peers alone do not prove successful rendering in this application.

**Alternatives rejected:** remote QR service (new network/data disclosure);
DOM-only generator (separate native implementation); custom View matrix or SVG
encoder integration (more owned rendering); Skia (unnecessary native surface);
PNG generation/export, separate QR database/token and an in-app scanner.

## R7 — Independent QR evidence and invitation reachability

**Decision:** Add test-only `jsqr@1.4.0`, an established pure-JS RGBA decoder with
no runtime dependencies. Validate visible SVG geometry, serialize only its
restricted subtree in memory, rasterize into a detached browser canvas and
decode independently. Compare decoded text to the actual textual invitation;
open it in a fresh participant context and prove normal voter admission.

This uses no screenshot API, PNG parser, camera, external request or diagnostic
artifact. No encoding-input echo or component-existence assertion substitutes
for decoding. Dispose Blob URLs/buffers and retain only safe booleans/counts.
C1's strict SVG/image/canvas screenshot rejection remains unchanged.

**Evidence:** [jsQR API](https://github.com/cozmo/jsQR#readme),
[jsQR 1.4.0 metadata](https://registry.npmjs.org/jsqr/1.4.0) and
[HTML canvas drawing specification](https://html.spec.whatwg.org/multipage/canvas.html#dom-context-2d-drawimage).
The decoder is a small test dependency, not a claim of frequent upstream releases.
The approach proves rendered-symbol encoding plus visibility and navigation;
it does not simulate optical camera hardware.

**Invitation decision:** Reuse `src/rooms/code.ts` without a new identity/token:
web page origin plus canonical room path; native `Linking.createURL` under its
compatible runtime. [Expo SDK 57: Linking](https://docs.expo.dev/versions/v57.0.0/sdk/linking/)
supports that distinction. Loopback browser acceptance does not imply physical
phone reachability. Supplemental phone validation uses a LAN-reachable creator
web origin and public Supabase endpoint; both link and QR then naturally share
the LAN target. No production universal-link or TV work is included.

## R8 — Executable regression inventory, C1, R01 and R02

**Decision:** Reaudit, retain and adapt the current 24 room trials and 8
candidate trials; add nine grouped cases G01–G09. Full per-trial allocation,
all 36 scenario mappings and commands are in [quickstart.md](quickstart.md).
Existing room trials explicitly choose required=2/creatorVotes=true, replacing
obsolete roles/count assertions while preserving their tested invariant classes.

The freshly counted allocations happen to remain 47 for those room trials and
18 for the candidate trials. New grouped cases use 26: total 41 tests / 91
identities; one C1 + full run costs 92, below 150. C1 once + two complete runs
costs 183; fresh checkout adds 92, aggregate 275. Repeatability itself therefore
requires separate recovered quota windows, with the same stack kept running
across the outside-harness wait. Detailed admission rules count earlier failed,
partial, targeted and manual attempts; no retry after 429 or restart workaround.

R01 has one intentional write after the final cutover DB contract; later gates
and fresh checkout use check only. C1 remains the existing safe runner/reporter/
registry/scanner; only exact scenario/location allowlists and budget labels evolve.
No trace, HAR, video, storage exports or raw traffic diagnostics are permitted.

**Alternatives rejected:** assuming the old total without a case audit; one
browser test per product sentence; cross-test identity caches; falsely fitting
two complete runs under 150; inside-test quota sleeps/retries; broad diagnostic
allowlists. These decisions reuse settled repository infrastructure rather than
replacing it. No unresolved technical decision remains.
