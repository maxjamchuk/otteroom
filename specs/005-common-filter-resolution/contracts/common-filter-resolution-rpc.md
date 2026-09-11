# Contract: Common Filter Resolution RPC

**Transport**: Existing typed `supabase-js` Data API client.
**Identity**: `auth.uid()` only; no user, member, filter or clause target argument.
**Authority**: One PostgreSQL transaction over the authorized room, frozen
Feature 004 source rows and private result relations.

## Signature

```sql
public.resolve_common_filters(p_room_id uuid)

RETURNS TABLE (
  outcome text,
  filter_resolution_status public.filter_resolution_status
)
```

The function is `LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''`, owned
by postgres, and uses schema-qualified fixed SQL. Revoke the exact signature from
PUBLIC, anon and authenticated before granting EXECUTE only to authenticated.
`NULL auth.uid()` raises SQLSTATE 42501.

Every business call returns exactly one row. A transport/integrity exception
returns no business row. The client requires exact cardinality, exact two keys
and the nullability/value matrix below; generated types are not logical validation.

## Outcome matrix

| Outcome | When | Status field | Writes | Client meaning |
| --- | --- | --- | --- | --- |
| `not_found` | Room is missing or caller is not its member | NULL | None | Safe generic room/resolution failure |
| `pending` | Caller is authorized but room is not frozen N/N | `pending` | None | Continue Feature 004/wait; no usable result |
| `compatible` | This call commits or recovers the one compatible result | `compatible` | First call only | Candidate sourcing is a future next step |
| `incompatible` | This call commits or recovers the empty-year result | `incompatible` | First call only | Terminal; create a new room/session |

`outcome` and non-null status must match exactly. There is no `failed`,
`already_resolved`, payload, readiness boolean, year, genre, clause count,
member/filter ID or error detail in the response. Candidate readiness is derived
only as `status === compatible` and is not a Feature 005 fetch command.

## Authoritative transaction order

1. Require authenticated subject and a transport-valid room UUID.
2. Select the exact room joined to `room_members` for `auth.uid()` and lock only
   the room `FOR UPDATE OF r`. No row returns `not_found`; a foreign subject
   acquires no application room lock. The member may be a voter or the room's
   non-voting creator. Any other non-voting membership is an integrity failure.
3. Validate room/result shape already visible under the lock. A terminal room
   must be frozen N/N. Compatible must have exactly one valid private parent and
   contiguous valid clauses; incompatible must have no payload. Any contradictory
   committed shape raises an integrity exception and is not repaired.
4. If status is terminal, return the same terminal outcome with zero writes.
5. If membership is not Ready or X<N, require status pending and no private
   payload, then return pending with zero writes. Calling early never starts a
   partial result.
6. At pending frozen N/N, verify actual voting-member count = required count,
   actual voter filter count = required count = stored X, every voter has exactly
   one valid row and no non-voter has one. Connection state is not consulted.
7. Read every voter source row in the same snapshot. Compute max lower year and
   min upper year. Do not update, lock individually for mutation or canonicalize
   source rows; Feature 004 has already frozen canonical values.
8. If max lower > min upper, require/write no private payload and update the room
   once to incompatible plus the transaction timestamp.
9. Otherwise insert one private parent with those inclusive years. For each
   nonempty source genre array insert one anonymous clause, ordered by canonical
   array then private membership UUID as an unpersisted equal-value tie-breaker.
   Assign contiguous ordinals from one. Update the room once to compatible plus
   the transaction timestamp.
10. Return the committed-intent status. Parent, clauses and room status commit or
    roll back together. No candidate function or external request is invoked.

## Idempotency, concurrency and recovery

- Concurrent first calls serialize on the room. Exactly one writes; waiters
  return the resulting terminal value without changing any row.
- A repeated terminal call is a verified no-op. Parent/clauses/status and their
  xmin values remain unchanged.
- A response lost after commit is recovered by room refetch or the same RPC.
- A request lost before reaching the database leaves pending and may be retried.
- An exception after any internal insert/update rolls back every result write;
  frozen filters and N/N remain as they were before the attempt.
- Different authorized members cannot produce different committed outcomes.
- No request UUID is needed because immutable source, terminal status, primary
  keys and the room lock provide natural idempotency.
- Unrelated rooms can resolve independently; no table lock or global mutex is used.

## Failure and privacy

The client maps every exceptional failure to one safe transient message and
Retry. It never renders raw SQLSTATE, SQL text, Auth/member/filter IDs, request
payloads or private result data. A failed attempt is not incompatible: the
authoritative room remains pending until a later transaction commits.

Authorization precedes all business validation that could reveal room state.
Direct client access to source/result tables remains independently denied. A
non-voting creator may call the operation because they are an authorized room
observer, but the fixed `is_voter=true` source join guarantees zero contribution.

## Required evidence

PostgreSQL tests own exact schema/function ACLs, early-call no writes, algebra,
private payload shape, member/filter completeness, cross-room masking, failure
rollback, concurrent first calls, repeated calls, lost-response recovery and
unchanged source values/xmin. Client tests own exact parsing, one-flight, stale
generations and safe failure mapping. Browser I01-I03 prove representative real
Auth/RPC/PostgreSQL/Realtime/UI cooperation without reading the hidden payload.
