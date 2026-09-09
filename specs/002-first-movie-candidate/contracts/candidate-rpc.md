# Contract: ensure_room_candidate

**Feature**: `002-first-movie-candidate`
**Transport**: Existing typed supabase-js client RPC over the local Data API
**Authority**: PostgreSQL 17; one function invocation in its caller transaction

## Exact Signature

```sql
public.ensure_room_candidate(p_room_id uuid)
RETURNS TABLE (
  outcome text,
  candidate_id text,
  title text,
  release_year smallint,
  poster_key text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
```

This signature specifies the interface, not an implemented function body.
There is exactly one new public application RPC and no public helper RPC.

## Input and Security

- Caller identity comes only from auth.uid(); there is no user-ID argument.
- p_room_id is the accepted room's internal UUID, never displayed as movie UI.
  A valid but nonexistent UUID and SQL NULL produce not_found after Auth checks.
  Invalid UUID syntax is a transport/type error, not another business outcome.
- Function owner is postgres, not a client role. SECURITY DEFINER is required
  because clients cannot read the catalog or mutate rooms; the body explicitly
  authorizes every request because its owner can bypass caller RLS.
- In the creation migration transaction, explicitly revoke the exact signature
  from PUBLIC, anon, authenticated, then grant EXECUTE only to authenticated.
  Do not assume default function ACLs were changed by older migrations.
- Independently reject null auth.uid() with an authorization exception (42501),
  including an authenticated SQL role with no subject claim.
- Pin empty search_path, qualify all table/function references, use fixed
  statements, and accept no caller-supplied SQL, candidate, key, or identity.
- Preserve rooms RLS/column grants and deny normal direct catalog access.
  No client service-role credential, Storage, or custom backend participates.

## Result Cardinality and Nullability

Exactly one result row for every business outcome; the Data API representation
is a one-element array with exactly these five keys.

| Field | SQL type | available | not_ready / not_found |
| --- | --- | --- | --- |
| outcome | text | available, non-null | Respective closed value, non-null |
| candidate_id | text | Non-null stable catalog ID | NULL |
| title | text | Non-null trimmed nonempty display title | NULL |
| release_year | smallint | Non-null integer in the catalog range | NULL |
| poster_key | text | Non-null catalog key | NULL |

RETURNS TABLE output fields are physically nullable. Function branches, pgTAP,
and client runtime parsing enforce logical nullability. Generated TypeScript
alone is insufficient evidence of that contract.

Do not return room ID, state, code, host/guest IDs, Auth UUIDs, sort_order, internal
timestamps, or unrelated metadata. An infrastructure exception returns no business
row and is never disguised as available/not_ready/not_found.

## Transaction Decision Order

1. Read and validate auth.uid().
2. Select the exact target row by immutable primary key with FOR UPDATE.
   Acquire no catalog candidate before this room lock. No row means not_found.
3. Check whether caller is host or guest. Use null-safe denial equivalent to
   `caller IS DISTINCT FROM host_user_id AND caller IS DISTINCT FROM guest_user_id`.
   An unrelated caller gets the same not_found projection whether the room is
   Waiting, Ready, assigned, or unassigned.
4. If the accepted room has no guest, return not_ready with all candidate fields
   NULL, without modifying the row or reading a selectable candidate.
5. If Ready and movie_candidate_id is non-null, fetch exactly that catalog row
   and return available. Do not issue UPDATE, including a same-value UPDATE.
6. If Ready and unassigned, choose `ORDER BY sort_order ASC LIMIT 1`, update only
   movie_candidate_id and updated_at using transaction_timestamp(), and return
   that candidate as available.
7. Empty catalog or an impossible missing referenced record raises an
   infrastructure/configuration exception. Do not turn it into not_found and do
   not replace an established assignment. Any failed transaction rolls back its
   own writes.

This operation cannot create/change room membership or the generated room state.
Concurrent join/ensure operations serialize on the same row; the candidate CHECK
still forbids a Waiting assignment.

## Idempotency, Isolation, and Recovery

At READ COMMITTED, concurrent callers lock the same room in the same order.
One establishes the assignment; after its commit the other sees that assignment
and returns identical metadata. There is no accepted intermediate state with
two authoritative assignments. Unique sort_order makes initial fixture choice
deterministic; its specific first record is implementation fixture data.

An existing assignment path preserves the entire room row and updated_at.
Repeated, concurrent, reload, and reconnect reads cannot rotate the movie.
Failure of one caller must preserve an assignment established by another.

Missing-room and unrelated-room outputs have identical outcome, candidate-field
nulls, and shape. A caller can obtain only their room's assignment; globally
repeated movie metadata does not authorize another room's assignment disclosure.
Direct catalog and room-assignment column access remain denied independently
of the RPC. Do not infer isolation from channel naming or route validation.

A request that never reaches the server changes nothing. A server transaction
failure rolls back. If the Data API commits and its response is discarded before
the browser receives it, the FK survives and the same RPC recovers it.
The client exposes only generic recoverable failures, never SQL messages,
constraint names, stack traces, or raw response dumps.

## Database Acceptance

Use a new `supabase/tests/database/room_candidate.test.sql` following the
existing local pgTAP conventions. Cover actual constraints and role-level
operations, not merely migration text:

- exact five catalog fields and four rows; nonempty and unique identities/keys/
  orders; valid years; minimum-sort selection;
- room FK actions and Waiting check, including a real rejected SQL mutation;
- table RLS, no client policies, exact column/table ACL denial, owner, definer,
  empty search_path, and exact EXECUTE allow/deny;
- signed-out execution rejection and authenticated-without-subject body rejection;
- own Waiting not_ready; unrelated Waiting, unrelated Ready, absent and NULL
  room inputs with equal not_found projection;
- complete first result, all later identical results, and unchanged timestamps/
  whole row on repeat and rejected business outcomes;
- catalog-empty fault before any room references a catalog row, rolled back after
  the trial; rollback-only failure after the UPDATE to prove atomic preservation;
- no client direct assignment mutation and no candidate returned by table reads.

A test-only rollback-scoped fault may provoke a constraint failure after the
candidate UPDATE. It is not a deployed trigger, additional public application
function, or client-accessible fault switch.

### Deterministic Real-Session Race

Reuse the existing dblink/controller conventions; do not replace concurrency
with sequential calls or an unobserved Promise.all.

1. The local test controller uses supabase_admin only for test-extension setup,
   immediately restricts dblink entry EXECUTE, and keeps test helpers/fault DDL
   inside a rollback scope. A separate postgres setup connection commits two
   synthetic auth.users rows and one Ready room with NULL candidate. No GoTrue
   signup or service-role client is used for these database fixtures.
2. Open caller A/B with distinct backend PIDs, authenticated role, their own
   subject claims, and explicit READ COMMITTED transactions. Assert role,
   auth.uid(), and isolation inside both sessions.
3. An owner coordinator transaction locks the same room FOR UPDATE. Dispatch
   both real RPC calls asynchronously before collecting either result.
4. A bounded observer uses pg_blocking_pids to prove both callers are waiting
   through the coordinator's lock chain. Account for a queued caller blocking
   behind the other caller as well as directly behind the owner.
5. Release the owner lock only after that barrier. Collect/drain the first
   completed RPC and commit its caller; the second remains blocked until then.
6. Before committing the second caller, use the owner observer to record the
   first committed room snapshot and xmin::text. Collect/drain and commit the
   second caller.
7. Both results must be identical available rows. The one room points at the
   minimum-sort catalog row; catalog count stays four; host/guest/state/created_at
   are unchanged. Final room snapshot and xmin equal the first committed
   snapshot, proving no second same-value UPDATE occurred.
8. On success or failure, cancel/drain outstanding queries, rollback/close
   callers, remove only the test room and synthetic identities through owner,
   and close all connections. Drain dblink's terminal empty result before reuse.
   Bound statement/lock/observation deadlines; no fixed sleep proves overlap.

Run independently committed race trials before controller rollback-only fault
DDL. Test-only privileged setup/inspection is not an application access path.

## Browser Acceptance

F01 holds both automatic outgoing requests before forwarding either, proves both
arrived, then releases real traffic together. Both browsers must show identical
loaded data. F05 aborts both requests before forwarding; F07 forwards/validates
real successful responses in memory, discards both deliveries, observes the
persisted FK, then retries both concurrently. Never fulfill a synthetic success.

F04 compares exact foreign/missing not_found rows with real authenticated
participants and preserves both room assignments. Candidate IDs and raw
responses stay in memory; only safe labels/counts/booleans reach C1 diagnostics.

See [candidate-display.md](candidate-display.md) and
[../quickstart.md](../quickstart.md) for complete UI and execution evidence.
