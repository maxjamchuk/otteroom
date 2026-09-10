# Data Model: Generalized Room Membership & QR Join

**Authority**: PostgreSQL 17; planned final Feature 003 schema.
**New application relation**: `public.room_members`. Existing rooms and the
unchanged four-row movie_candidates catalog remain. No implementation occurred.

## public.rooms

| Column | SQL type / nullability | Default or derivation | Purpose |
| --- | --- | --- | --- |
| id | uuid NOT NULL | existing `extensions.gen_random_uuid()` | Immutable primary key |
| code | text NOT NULL | none | Existing canonical ten-uppercase-hex invitation |
| creation_request_id | uuid NOT NULL | none | Creator-scoped logical creation request |
| creator_user_id | uuid NOT NULL | none | Creator identity; does not imply voting |
| required_voter_count | integer NOT NULL | 2 | Immutable configured target, at least 2 |
| voter_count | integer NOT NULL | 0 | Transactional count of admitted voter members |
| state | text NOT NULL | GENERATED ALWAYS STORED, expression below | Authoritative membership Waiting/Ready |
| movie_candidate_id | text NULL | no default | Existing unchanged catalog FK |
| created_at | timestamptz NOT NULL | `pg_catalog.transaction_timestamp()` | Existing room creation time |
| updated_at | timestamptz NOT NULL | `pg_catalog.transaction_timestamp()` | Last admitted voter or first candidate assignment transaction |

State expression: `CASE WHEN voter_count = required_voter_count THEN 'ready'::text
ELSE 'waiting'::text END`. The bounds check rules out over-capacity and negative
states. Neither state nor count is derived from connectivity. `integer` has a
technical upper bound of 2147483647; this is not a product maximum. Public create
requires an explicit valid integer despite the table's default of 2.

| Constraint | Exact invariant |
| --- | --- |
| rooms_pkey | PRIMARY KEY (id), preserved |
| rooms_code_key | UNIQUE (code), preserved |
| rooms_code_format_check | `code ~ '^[0-9A-F]{10}$'`, preserved |
| rooms_creator_creation_request_key | UNIQUE (creator_user_id, creation_request_id), renamed from host key |
| rooms_creator_user_id_fkey | creator_user_id → auth.users(id), ON UPDATE NO ACTION ON DELETE RESTRICT |
| rooms_required_voter_count_check | required_voter_count >= 2 |
| rooms_voter_count_check | voter_count >= 0 AND voter_count <= required_voter_count |
| rooms_movie_candidate_id_fkey | Existing FK → movie_candidates(id), NO ACTION / RESTRICT, preserved |
| rooms_candidate_requires_ready_check | movie_candidate_id IS NULL OR voter_count = required_voter_count |

Existing PK/code/creator-request unique indexes suffice for lookup/idempotency.
Remove the old guest index. No independent state, count or candidate index is
required for the current access paths. No host_user_id or guest_user_id remains.

## public.room_members

| Column | SQL type / nullability | Default | Meaning |
| --- | --- | --- | --- |
| id | uuid NOT NULL | `extensions.gen_random_uuid()` | Stable application membership PK; not an Auth identity |
| room_id | uuid NOT NULL | none | Owning room |
| user_id | uuid NOT NULL | none | Existing authenticated local identity |
| is_voter | boolean NOT NULL | none | Occupies one configured voter slot if true |
| joined_at | timestamptz NOT NULL | `pg_catalog.transaction_timestamp()` | Admission/materialization time |

| Constraint | Definition |
| --- | --- |
| room_members_pkey | PRIMARY KEY (id) |
| room_members_room_user_key | UNIQUE (room_id, user_id) |
| room_members_room_id_fkey | room_id → rooms(id), ON UPDATE NO ACTION ON DELETE CASCADE |
| room_members_user_id_fkey | user_id → auth.users(id), ON UPDATE NO ACTION ON DELETE RESTRICT |

The room-leading unique index serves the exact room/user membership predicate
and room membership checks. No speculative roster/filter/vote indexes. Auth
deletion is restricted and cannot silently release a slot. Whole-room deletion
by privileged test cleanup cascades its dependent memberships; clients have no
delete operation. Removal/replacement of individual members is outside scope.

There are no filter/vote fields, role enum, TV/spectator states, presence fields
or second membership relation. Member IDs are stable for relational identity,
but Feature 003 returns neither member IDs nor a roster to the client.

## Creator and voter dimensions

Every room has exactly one member whose user_id equals creator_user_id. This
association is created atomically with the room. Its is_voter stores the fixed
creator choice; no redundant rooms.creator_is_voter column is needed.

| Caller kind | is_creator returned by RPC | is_voter | Count contribution |
| --- | --- | --- | ---: |
| Voting creator | true | true | 1 |
| Non-voting creator | true | false | 0 |
| Normal admitted joiner | false | true | 1 |
| Non-creator non-voter | false | false | Exceptional integrity/configuration failure if encountered by a room RPC projection |

All creators are authorized members. Re-entry finds that row before checking
capacity, so a non-voting creator is never promoted by their own invitation.
If the creator's membership is missing, join_room raises an exceptional integrity
failure after locking and checking membership, before any capacity/admission
logic. It cannot recreate the row, infer a voting choice or increment the count.
An encountered persisted non-creator non-voter likewise fails the room RPC
projection exceptionally. Neither invalid condition has a business outcome or
an automatic repair path; valid existing-member recovery remains unchanged.

| Required | Creator votes | Initial voter_count | Extra voters needed | State |
| ---: | --- | ---: | ---: | --- |
| 2 | yes | 1 | 1 | waiting |
| 3 | yes | 1 | 2 | waiting |
| 2 | no | 0 | 2 | waiting |
| 3 | no | 0 | 3 | waiting |

## Count/member consistency and lifecycle

Committed invariant: `rooms.voter_count` equals the number of its
`room_members` rows with is_voter=true. Member rows identify admitted membership;
the summary is its transactionally maintained room-level capacity/state value.

Create inserts room and creator member within the same successful subtransaction.
Join locks the room, checks membership and creator integrity, and admits only
a non-creator without membership by inserting one voter and updating count
and updated_at once in the same transaction. Both statements commit or roll
back together; no other production member write surface exists. Client table
writes are denied. This enforces consistency at the state owner without an
unenforceable cross-table CHECK or a duplicate count-maintenance trigger.
Privileged test fixtures must construct coherent pairs and verify the invariant.
Integrity fault tests may break them only inside controlled savepoints, with
exception/no-mutation evidence followed by deterministic restoration.

| Required=3 / count | State | Candidate |
| --- | --- | --- |
| 0 | waiting | NULL only |
| 1 | waiting | NULL only |
| 2 | waiting | NULL only |
| 3 | ready | NULL or existing assignment |
| negative or >3 | forbidden | no valid row |

| Operation | Mutation | Result / next state |
| --- | --- | --- |
| New valid create | One room + one creator membership | waiting, count 1 or 0 |
| Same creator/request retry | None | Current persisted room/configuration |
| New non-creator voter without membership, count < required | One member + one room count/timestamp UPDATE under lock | waiting until equal; then ready |
| Existing creator/voter re-entry, even full | None | Same member, count and current state |
| Creator re-entry with missing membership | None | Exceptional integrity failure before capacity/admission; no promotion or repair |
| Persisted non-creator non-voter encountered by room RPC projection | None | Exceptional integrity/configuration failure; no accepted projection |
| New non-creator without membership, assembled group | None | full, no private projection |
| Invalid/unknown invitation | None | invalid_code / not_found |
| Disconnect, reload, retry after committed acknowledgement loss | No membership mutation | Same member; count never decreases |
| Failed transaction before commit | Entire operation rolled back | Previously committed room/members unchanged |
| Ready + first candidate ensure | Candidate FK/timestamp UPDATE only | Same ready/count/members |
| Existing candidate ensure or poster retry | No membership or assignment UPDATE | Same candidate |

Forbidden production transitions: changing required count or creator identity;
changing any member's voting flag; adding another non-voting member; deleting,
replacing or duplicating membership; decreasing occupancy; Ready→Waiting;
count>required; assigning while Waiting; candidate rotation/clearing. The
hardened write APIs and denied direct writes are the enforcement boundary for
immutability, in addition to declarative count/unique/FK/state constraints.

## Migration from the exact pre-003 schema

Future additive migration:
`supabase/migrations/20260910000000_generalized_room_membership.sql`.
Do not edit any of the five committed Feature 001/002 migrations.

One transaction, application traffic stopped, no intermediate commit:

1. Acquire the rooms DDL/ACCESS EXCLUSIVE lock before reading/backfilling legacy
   rows. Existing operations must finish first; no old writer can enter mid-cutover.
2. Drop the old `create_room(uuid)` and `join_room(text)` definitions explicitly.
   The latter must be recreated because its return type changes. Remove
   `rooms_select_member` before retiring its columns. No broad DROP CASCADE.
3. Rename host_user_id→creator_user_id, its FK→rooms_creator_user_id_fkey and
   request unique constraint→rooms_creator_creation_request_key. Preserve values
   and unique-index semantics.
4. Add required/count fields and the fully denied, RLS-enabled room_members
   relation. Backfill every old room with required=2, count=1 if guest is NULL,
   otherwise count=2. Insert exactly one voter member for the old host and one
   for each non-null old guest. Distinct-member checks in the old schema already
   prevent identical seats. New member IDs are generated once.
5. Legacy members' joined_at is the migration transaction time: exact historical
   guest admission time is unavailable because updated_at may record a later
   candidate assignment. Do not misrepresent that timestamp as recovered history.
   Preserve rooms.created_at and rooms.updated_at exactly.
6. Replace the generated state expression in place via PostgreSQL 17
   `ALTER COLUMN state SET EXPRESSION AS (...)`. Verify old Waiting/Ready values
   are unchanged. Install required/count checks and the generalized candidate
   readiness check, then remove rooms_candidate_requires_guest_check.
7. Replace ensure_room_candidate's body without changing its signature/result.
   Install the final create/join functions and exact ACLs, private helper and
   membership-based rooms policy. Replace grants with the exact final projection,
   including checking residual column privileges, not just table ACLs.
8. Remove rooms_distinct_participants_check, rooms_guest_user_id_fkey and
   rooms_guest_user_id_idx explicitly; drop guest_user_id RESTRICT. Verify no
   final function/policy/check retains host/guest references. The renamed creator
   column is the only ownership column, not a second membership authority.
9. Verify constraints, one creator member per room, exact summary/member count,
   preserved candidate/catalog and rooms-only publication. No test hooks,
   compatibility overloads or data-copy table survive.
10. After the generated-expression change and all schema cutover steps, execute
    `ANALYZE public.rooms` as postgres before committing the migration transaction.
    PostgreSQL removes the changed column's statistics during SET EXPRESSION;
    this explicitly refreshes them for the final schema. Commit all changes
    together, then reload the PostgREST schema cache for final signatures.

| Legacy room | Preserved configuration/data | Materialized members | Final result |
| --- | --- | --- | --- |
| Waiting, guest NULL | Same id/code/request/host-as-creator/timestamps; candidate NULL | Host is voting creator | required2, count1, waiting |
| Ready, guest present, candidate NULL | Same logical fields | Host and guest are voters | required2, count2, ready |
| Ready, candidate assigned | Same logical fields and exact candidate FK | Host and guest are voters | required2, count2, ready, same movie |

Physical xmin is expected to change during cutover; no migration assertion may
confuse row rewrites with replacement of logical room identity. Normal post-cutover
idempotent calls still require no-update/xmin evidence.

## Final grants, RLS and publication

The rooms and room_members tables and private schema are owned by postgres;
ownership is never assigned to a normal client role.

| Surface | PUBLIC / anon | authenticated |
| --- | --- | --- |
| rooms direct SELECT | none | id, code, state, voter_count, required_voter_count only; member RLS |
| rooms other columns / direct writes | none | none |
| room_members all direct access | none | none; RLS enabled, no client policies |
| movie_candidates all direct access | none | none; existing RLS/ACL unchanged |
| create_room(uuid, integer, boolean) | no EXECUTE | EXECUTE, guarded body |
| join_room(text) | no EXECUTE | EXECUTE, guarded body |
| ensure_room_candidate(uuid) | no EXECUTE | EXECUTE, guarded body |
| private schema | no USAGE/CREATE | USAGE only |
| private.is_room_member(uuid) | no EXECUTE | EXECUTE only, own-membership boolean |

All functions/helper are owned by postgres, SECURITY DEFINER, empty search_path,
fixed schema-qualified SQL, no dynamic SQL. Explicitly revoke each exact
signature from PUBLIC/anon/authenticated, then grant authenticated EXECUTE.
Public RPCs reject NULL auth.uid(); helper returns false. `private` remains
outside PostgREST exposed schemas and extra_search_path. Helpers cannot accept
an identity or expose a roster. Rooms policy is SELECT TO authenticated USING
`private.is_room_member(id)`. Function-body authorization and table RLS are
separate tested boundaries.

Only public.rooms remains in supabase_realtime. Retain its existing primary key
and default replica identity; publish no roster/catalog. The invalidation binding
selects only id and refetches the approved projection after commit. No generated
state payload or raw membership event is required.

## Required database evidence

Evolve `supabase/tests/database/room_session.test.sql` for exact final schema,
all creation/join outcomes, settings immutability, code conflicts, preserved
idempotency, generalized RLS/ACL/helper security and real concurrency. Evolve
`supabase/tests/database/room_candidate.test.sql` for the new room fixtures and
membership/readiness authorization, keeping every candidate authority/failure
class. Add version-limited before/after fixtures under `supabase/tests/migration/`
and the safe runner described in [quickstart.md](quickstart.md).

Include the rollback-scoped creator/member corruption cases in
[room-rpcs.md](contracts/room-rpcs.md#creator-and-member-integrity-fault-evidence):
real authenticated creator join fails with no insertion/promotion/count/state
change for both voting choices and both Waiting/Ready; a persisted non-creator
non-voter fails projection exceptionally. Restore exact fixture state afterward.
The migration validator must prove ANALYZE completed after cutover; with its
nonempty legacy fixtures, check as owner that rooms.state column statistics
exist in pg_catalog.pg_statistic. Do not depend on autovacuum timing or assert
fixed planner estimates. An empty clean reset requires successful ANALYZE
execution, not a statistics row for a table with no rows.

Every accepted/rejected/raced operation checks both member rows and count;
same-identity joins must be tested with multiple free slots. Three callers with
a non-voting creator exercise 0→3. Prove authenticated own reads and unrelated
denial, no catalog/roster/mutation privileges, and the private helper's exact
owner/ACL/search path separately. Generated public types change once after this
complete DB surface is final; they are never manually patched.
