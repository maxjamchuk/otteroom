# Contract: Generalized Room RPCs

**Transport**: existing typed supabase-js client over the Data API.
**Replaces**: Feature 001's fixed-seat RPC contract for the Feature 003 runtime.
Completed Feature 001 artifacts remain historical inputs and are not edited.

## Exact public signatures and result

```sql
public.create_room(
  p_creation_request_id uuid,
  p_required_voter_count integer,
  p_creator_is_voter boolean
)

public.join_room(p_room_code text)
```

Both return exactly:

```sql
RETURNS TABLE (
  outcome text,
  room_id uuid,
  room_code text,
  room_state text,
  is_creator boolean,
  is_voter boolean,
  voter_count integer,
  required_voter_count integer
)
```

Both are LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''. There are no
argument defaults, identity parameters, role enum, roster or member IDs. The
old create_room(uuid) overload is removed. join_room(text) is dropped/recreated
for its changed return type in the atomic migration. All dependent code/types
cut over in the same implementation phase.

## Cardinality, nullability and outcomes

Business responses are one-element arrays with exactly the eight named fields.
On accepted outcomes every field is non-null. On rejected join outcomes only
outcome is non-null; all seven remaining fields are NULL. Exceptions produce no
business row. Generated types do not replace logical runtime validation.

| Operation/outcome | Flags | State/count | Writes |
| --- | --- | --- | --- |
| create: created | is_creator=true; is_voter=explicit choice | waiting; count 1 if voter, otherwise 0; configured target | One room and one creator member |
| create: already_created | Creator=true; persisted creator voter flag | Current persisted target/count/state | None |
| join: joined | Creator=false, voter=true | Current count after admission; waiting or ready | One voter member; one count/timestamp UPDATE |
| join: already_member | Persisted creator/voter dimensions | Current target/count/state, even if ready/full | None |
| join: invalid_code | NULL/NULL | All projection fields NULL | None |
| join: not_found | NULL/NULL | All projection fields NULL | None |
| join: full | NULL/NULL | All projection fields NULL | None |

Only those create/join outcomes exist. Full discloses the existing invitation
contract's full result, not count, configuration, member flags or candidate.
Malformed and well-formed nonexistent codes remain distinguishable. Unrelated
private-ID reads are denied by RLS; knowing an invitation permits only normal
admission, not pre-admission private projection access.

Every accepted room RPC projection validates the persisted member dimensions.
`is_creator = false AND is_voter = false` is an exceptional integrity/configuration
failure, never a legitimate member projection or a new business outcome. Do not
repair it by changing the member flag. A creator with no membership is likewise
an integrity failure; creation recovery and join recovery cannot recreate that
membership or infer a replacement voting choice.

## Authentication and hardening

Caller identity comes exclusively from auth.uid(). Both bodies first reject a
missing subject with authorization exception 42501. Malformed UUID/integer/
boolean transport input cannot bypass PostgreSQL type validation. Owner is
postgres; explicitly revoke each exact signature from PUBLIC, anon and
authenticated, then grant EXECUTE only to authenticated. Pin empty search_path,
qualify objects/functions, use fixed SQL and no dynamic SQL. Neither RPC depends
on a client service-role credential. The definer independently authorizes every
branch; table RLS is separately tested. Raw SQL errors, credentials, user IDs,
constraint names and response dumps never appear in participant UI/diagnostics.

## Creation validation and transactional order

1. Authenticate, require non-null request UUID, required count and creator choice.
   Missing values raise 22004; count <2 raises 22023. Non-integer/out-of-range
   input is a transport/type failure. Client validation gives clear corrective
   feedback before calling; technical integer limit is not a business maximum.
2. Look up `(creator_user_id=auth.uid(), creation_request_id=request)`. On a
   hit, read its creator membership and return persisted original settings and
   current state/count as already_created; missing creator membership is an
   exceptional integrity failure. Use a coherent single statement/join projection.
3. For a new request, allocate a canonical code from five cryptographically
   random bytes using the existing server rule. Within one exception
   subtransaction insert room with target and initial count 1/0, then exactly
   one creator membership with the explicit flag. Return created only after
   both operations succeed. No second room UPDATE is needed for initialization.
4. Handle unique violations using GET STACKED DIAGNOSTICS CONSTRAINT_NAME:
   rooms_creator_creation_request_key recovers the committed creator/request
   winner; rooms_code_key first repeats that lookup, otherwise regenerates up
   to five attempts. An absent expected winner or any other constraint violation
   is re-raised. Failed member insertion rolls back the tentative room too.
5. Any uncaught exception rolls back this operation. No partial usable room or
   invitation is rendered. A response lost after commit is recovered by retry.

Same request plus **different valid** target/choice returns the originally
persisted configuration; it never mutates it or invents a conflict outcome.
Invalid/missing input still fails validation, including on a retry. Concurrent
different valid configurations for one caller/request have one committed winner;
both callers recover that winner's settings. Normal UI prevents accidental
configuration divergence by freezing one `{requestId, requiredVoterCount,
creatorIsVoter}` after valid submission. A separate deliberate create action
uses a new UUID. No identity or room cache crosses browser contexts.

## Join validation and transactional order

1. Authenticate. Trim/uppercase p_room_code; NULL or failure to match
   `^[0-9A-F]{10}$` returns invalid_code without a room lookup/write.
2. Locate by unique canonical code and lock that room FOR UPDATE. Missing means
   not_found with the all-null projection. Make no capacity/member decision
   from a pre-lock room snapshot.
3. After lock acquisition query room_members for the caller. If present,
   validate its persisted projection: non-creator plus is_voter=false raises an
   exceptional integrity/configuration failure without mutation. Otherwise return
   already_member with its stored is_voter and creator equality flag.
   This precedes the full check and preserves non-voting creator re-entry.
4. If membership is absent AND auth.uid() equals the locked room's
   creator_user_id, raise an exceptional integrity failure. Do not insert a
   member, increment voter_count, change creator voting mode or return joined/full.
   Missing creator membership is never treated as a normal new voter.
5. Only a non-creator with no membership reaches capacity logic. If count equals
   target, return full. No roster/spectator fallback.
6. Otherwise insert exactly one member with is_voter=true, increment count once
   and assign updated_at=transaction_timestamp() on the locked room. Return the
   updated generated state/count as joined. Target/configuration never changes.
7. A transaction failure rolls back both membership insert and summary update.
   A committed join with lost response remains admitted; retry finds that
   membership even if the room has filled. No UPDATE on any recovery/rejection.

Room row serialization plus unique membership are authoritative. At READ
COMMITTED, a blocked caller sees the updated room and then the committed member
row. Same-identity callers consume one slot, different callers may fill multiple
free slots, and two contenders for one slot yield exactly one joined and one
full. An admitted member's concurrent recovery does not compete for capacity.
Different rooms do not take a shared application lock. No production advisory
lock, retry loop after infrastructure error or client selection is required.

## Runtime parser and route contract

`src/rooms/contracts.ts` checks exact keys/cardinality and types, canonical code,
UUID room identity, integer 2<=target<=2147483647, integer 0<=count<=target,
and state equality. Booleans are independently checked. Non-creator implies
is_voter=true; any voter implies count>=1. created requires creator and Waiting
with exact 1/0 count; already_created requires creator; joined requires
non-creator voter; already_member admits all three legitimate combinations.
Rejected outcomes require strict NULLs. Unknown/extra/malformed fields fail safely.

`src/rooms/service.ts` supplies all create arguments, awaits existing Auth and
uses generic errors; join and recovery retain the canonical code operation.
`app/index.tsx` uses default count text "2" and an initially unselected pair of
explicit voting choices. TextInput and accessible Pressables require no numeric
or form dependency. Trim digits, require a whole count >=2, reject fractions,
non-numbers and technical overflow; do not silently clamp. The submitted
configuration stays fixed during progress and retry. No incomplete invitation
is shown. Successful create navigates using canonical code only.

`app/room/[code].tsx` still invokes join_room for normal entry/recovery,
including creator navigation. Same-code effect replay shares one promise;
code change invalidates the old generation before display/cleanup. Accepted
state contains isCreator, isVoter, voterCount and requiredVoterCount, not role or
a count derived solely from Waiting/Ready. Full copy no longer says two people.

## Deterministic SQL concurrency and rollback evidence

Reuse the stronger existing `pg_temp.candidate_race()` dblink technique in
`supabase/tests/database/room_candidate.test.sql` when extending the room suite:

1. Owner setup commits exact synthetic Auth/room/member fixtures. Caller
   sessions are independent backends with authenticated role, expected auth.uid()
   and READ COMMITTED verified. Same-identity trial uses two sessions with the
   same subject; distinct-voter trials use different subjects.
2. Owner coordinator holds the target row FOR UPDATE. Dispatch all real RPC
   calls asynchronously before collecting results. A bounded observer requires
   outstanding calls, pg_blocking_pids lock chains and ungranted tuple or
   transactionid entries in pg_locks. No arbitrary sleep.
3. Release coordinator; keep the first finished caller's transaction open and
   prove another caller blocked on it. Record per-session
   pg_stat_xact_user_tables deltas before commit; then drain/commit in lock order.
4. Same identity with >=2 free slots: member INSERT deltas 1/0, room UPDATE
   deltas 1/0, joined/already_member, count increases once and another slot stays
   free. First committed and final snapshot/xmin match after the no-write loser.
5. Final-slot distinct race: deltas 1/0; joined/full; count exactly target,
   one new member; loser produces no new row version.
6. Multiple-free-slot distinct race: deltas 1/1, both joined, count increments
   twice. Extend to three callers in a non-voting creator's 0/3 room: three
   distinct voters, 3/3 Ready, creator still zero. Check count/member equality
   after every commit. No claim that every successful admission has the same xmin.
7. Preserve the old create unique-index wait/code-collision harness, updating
   the constraint name and proving one room/member for both creator modes.
   Add rollback-scoped member-insert/count-update faults and assert preservation.
8. Cancel/drain outstanding queries, rollback callers, remove only owned
   fixtures and restrict/drop test helpers on every exit. Drain dblink's terminal
   empty result before reuse. No production trigger or fault hook remains.

Browser outgoing-request barriers corroborate real overlapping calls and UI
results but do not substitute for PostgreSQL lock evidence. See
[quickstart.md](../quickstart.md) for G02/G05/G06/G07/G09 and quota allocation.

## Creator and member integrity fault evidence

Extend `supabase/tests/database/room_session.test.sql` with rollback-scoped
privileged corruption, not a production repair path or fault API:

1. Construct coherent fixtures for both creator voting choices, each in Waiting
   and Ready. Record the original creator membership ID/flag and complete room
   snapshot. Inside a savepoint, the owner removes that creator membership while
   leaving count/configuration/state/timestamps untouched. This is deliberately
   invalid test state, never a supported membership transition.
2. Set authenticated role and the real creator's auth.uid(), then invoke the
   real join_room with the room code. Require an exception and no business row,
   including when the stored count already equals the target.
3. Compare the post-call state with the corrupted pre-call snapshot: no member
   or voter was inserted for the creator; voter_count, state, required count,
   creator identity, timestamps, room xmin and all other memberships are unchanged.
   The missing row stays missing; neither an inferred flag nor promotion repairs
   it. The valid original creator choice is retained only by test setup for
   deterministic restoration, not by adding a second production authority.
4. Roll back the fault savepoint and verify the exact original member ID/flag
   and count/member invariant are restored. Normal creator re-entry again returns
   already_member with the original one-slot or zero-slot contribution. Restore
   role/claims and roll back the enclosing test transaction on every exit.
5. Separately, inside a savepoint, corrupt an admitted non-creator's is_voter to
   false using owner privileges. Its authenticated real join_room must raise an
   integrity/configuration exception before returning already_member, with no
   writes and an unchanged corrupted pre-call snapshot. Roll back and verify
   exact restoration. Runtime parser rejection of false/false is additional
   defense, not a substitute for this database projection evidence.

These SQL fixtures create no GoTrue signups. The existing concurrency mechanism,
valid existing-member-before-full ordering and business outcome set are unchanged.
