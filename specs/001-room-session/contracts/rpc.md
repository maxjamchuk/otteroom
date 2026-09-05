# RPC Contract: Room Session

**Feature**: `001-room-session`
**Transport**: Supabase JavaScript client `rpc()` over the Data API
**Authority**: PostgreSQL functions in a versioned migration

## Shared Result Vocabulary

The functions return exactly one row. The SQL return shape is:

```sql
TABLE (
  outcome text,
  room_id uuid,
  room_code text,
  room_state text,
  participant_role text,
  participant_count smallint
)
```

PostgreSQL `RETURNS TABLE` output parameters are physically nullable; it does not
support per-output-column `NOT NULL` declarations. The function branches and
pgTAP assertions enforce this logical nullability contract:

| Field | SQL type | Physical nullability | Logical contract |
|---|---|---|---|
| `outcome` | `text` | Nullable output parameter | Always non-null and in the function's closed outcome set |
| `room_id` | `uuid` | Nullable output parameter | Non-null only for accepted-member outcomes; otherwise null |
| `room_code` | `text` | Nullable output parameter | Non-null and canonical only for accepted-member outcomes; otherwise null |
| `room_state` | `text` | Nullable output parameter | `waiting` or `ready` for accepted-member outcomes; otherwise null |
| `participant_role` | `text` | Nullable output parameter | `host` or `guest` for accepted-member outcomes; otherwise null |
| `participant_count` | `smallint` | Nullable output parameter | `1` or `2` for accepted-member outcomes; otherwise null |

Closed values:

- create outcomes: `created`, `already_created`;
- join outcomes: `joined`, `already_member`, `invalid_code`, `not_found`,
  `full`;
- participant roles: `host`, `guest`;
- room states: `waiting`, `ready`;
- participant counts: `1` for `waiting`, `2` for `ready`.

Generated database types are used at the Supabase client boundary. A small
client contract module narrows returned text fields to these literal unions and
rejects any unexpected result as an infrastructure/contract error.

Both functions live directly in the exposed `public` schema. They are deliberately
thin mutation APIs rather than general privileged helpers. The local migration
role `postgres` owns them; `PUBLIC`, `anon`, and `authenticated` never own them.
They execute as `SECURITY DEFINER` because client roles have no table mutation
grant. The owner can bypass RLS, so each body contains the complete authorization
and business checks described below and does not rely on RLS for its own access.

## `create_room`

### Exact signature

```sql
public.create_room(p_creation_request_id uuid)
RETURNS TABLE (
  outcome text,
  room_id uuid,
  room_code text,
  room_state text,
  participant_role text,
  participant_count smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
```

### Authentication and authorization

- Only PostgreSQL role `authenticated` receives `EXECUTE` on the exact
  signature.
- `PUBLIC` and signed-out `anon` receive no execution privilege.
- The function independently reads `auth.uid()` and raises an authorization
  exception if it is null.
- The caller ID always supplies `host_user_id`; no identity can be passed as an
  argument.
- The only caller-controlled argument is the statically typed UUID request ID;
  the function uses no dynamic SQL.

### Request

| Field | Type | Required | Contract |
|---|---|---:|---|
| `p_creation_request_id` | UUID | Yes | Generated once by the client for one logical create action and reused for retries |

A SQL function argument can physically be null, so immediately after the
authorization guard the body rejects `p_creation_request_id IS NULL` as an
exceptional invalid-input error before any lookup, code generation, or insert. A
new intentional create uses a new UUID; only retries of one logical create reuse
it.

### Outcomes

| Outcome | `room_id` | `room_code` | `room_state` | `participant_role` | `participant_count` | Disclosure | Mutation |
|---|---|---|---|---|---|---|---|
| `created` | Non-null | Non-null canonical code | Non-null `waiting` | Non-null `host` | Non-null `1` | Only the caller's accepted room projection | Inserts one complete room |
| `already_created` | Non-null, same room | Non-null, same canonical code | Non-null `waiting` or `ready` | Non-null `host` | Non-null `1` or `2`, matching state | Only the caller's accepted room projection | None |
| Exceptional failure (not an outcome) | No result row | No result row | No result row | No result row | No result row | Generic client error only; raw database detail is not returned as business data | Entire function statement rolls back |

An exceptional failure returns no result row and is not converted to an
`outcome` value.

### Atomicity, retries, and failures

- After authentication and null checks, the function first looks up the exact
  caller/request pair for the sequential `already_created` path. Code generation
  and each insert attempt then execute within the same database transaction.
- `(host_user_id, creation_request_id)` is the idempotency authority, including
  concurrent duplicate calls.
- Codes are generated from five cryptographically random bytes and accepted only
  by the unique code constraint.
- The insert is wrapped in a PL/pgSQL exception subtransaction. On
  `unique_violation`, `GET STACKED DIAGNOSTICS v_constraint_name =
  CONSTRAINT_NAME` reads the exact named constraint. The handler then follows
  this closed routing table:

| Constraint diagnostic | Required handler action |
|---|---|
| `rooms_host_creation_request_key` | Select the now-committed room by caller/request and return `already_created`; if the row is unexpectedly absent, re-raise rather than misclassify |
| `rooms_code_key` | Repeat the caller/request lookup to cover a simultaneous conflict on both keys; return `already_created` if found, otherwise regenerate the code and retry |
| Any other name | Re-raise the original exception unchanged |

- PostgreSQL's unique-index check waits for the competing insert to commit or
  abort. After the failed insert subtransaction rolls back, the handler's next
  statement at Read Committed sees the winner. Thus two simultaneous calls with
  the same caller/request return the same `room_id`/`room_code`, while the table
  gains exactly one row.
- A true code collision is retried for at most five insert attempts.
- Collision-attempt exhaustion and database/platform faults are exceptional;
  PostgreSQL rolls back the statement/transaction and the client maps the error
  to one generic recoverable failure without exposing raw details.
- No response is returned until a complete room row exists or the transaction
  has failed.

## `join_room`

### Exact signature

```sql
public.join_room(p_room_code text)
RETURNS TABLE (
  outcome text,
  room_id uuid,
  room_code text,
  room_state text,
  participant_role text,
  participant_count smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
```

### Authentication and authorization

- Only PostgreSQL role `authenticated` receives `EXECUTE` on the exact
  signature.
- `PUBLIC` and signed-out `anon` receive no execution privilege.
- The function independently rejects a null `auth.uid()`.
- Membership is derived only from `auth.uid()` and the locked authoritative
  room row. No host, guest, state, or count is accepted from the client.
- The only caller-controlled argument is the statically typed room-code text;
  the function uses no dynamic SQL.

### Request

| Field | Type | Required | Contract |
|---|---|---:|---|
| `p_room_code` | Text | Yes | Trimmed and uppercased by the function; valid only when the result matches `^[0-9A-F]{10}$` |

Invitation-link join, manual-code join, initial room-route entry, reload,
reconnect, and repeated join all call this one signature.

### Outcomes and disclosure

| Outcome | `room_id` | `room_code` | `room_state` | `participant_role` | `participant_count` | Disclosure | Mutation |
|---|---|---|---|---|---|---|---|
| `joined` | Non-null | Non-null canonical code | Non-null `ready` | Non-null `guest` | Non-null `2` | Only the newly accepted member's room projection | Sets guest and `updated_at` |
| `already_member` (host) | Non-null | Non-null canonical code | Non-null `waiting` or `ready` | Non-null `host` | Non-null `1` or `2`, matching state | Only the existing host's room projection | None |
| `already_member` (guest) | Non-null | Non-null canonical code | Non-null `ready` | Non-null `guest` | Non-null `2` | Only the existing guest's room projection | None |
| `invalid_code` | Null | Null | Null | Null | Null | Outcome only | None |
| `not_found` | Null | Null | Null | Null | Null | Outcome only | None |
| `full` | Null | Null | Null | Null | Null | Outcome only; no confirmation beyond the supplied code being full | None |
| Exceptional failure (not an outcome) | No result row | No result row | No result row | No result row | No result row | Generic client error only; raw database detail is not returned as business data | Entire function statement rolls back |

Failure outcomes intentionally contain no participant IDs. No outcome exposes
Auth records, email, profiles, service credentials, host UUID, or guest UUID.
Internal `room_id` is disclosed only to an accepted member and is retained for
authorized refetch/subscription, never rendered in the app.
An exceptional failure returns no result row and is not converted to a business
outcome.

### Atomicity and concurrency

Within one transaction, the function follows this exact decision order:

1. `btrim` and uppercase the supplied text; malformed or null input returns
   `invalid_code` before any mutation;
2. select the canonical-code row with `FOR UPDATE`; absence returns `not_found`;
3. if the caller is host or guest, return `already_member`;
4. if `guest_user_id IS NULL`, update that locked row once, assigning the caller
   and `updated_at = pg_catalog.transaction_timestamp()`, then return `joined`;
5. otherwise return `full`.

The room-row lock serializes all final-seat claims. Two distinct callers cannot
both observe and fill a null seat: exactly one returns `joined`, the other waits,
then returns `full`; `guest_user_id` is the winner and generated state remains
`ready`. A duplicate call from the winning guest waits, then becomes
`already_member`. Every rejected outcome performs no write. An unexpected
exception rolls back any statement changes and is not translated to a business
outcome.

## Client Error Mapping

- A returned closed outcome maps through a pure result-to-UI-state function.
- A network error, Auth outage, malformed RPC response, database exception, or
  Realtime-independent refetch failure maps to `recoverable unexpected failure`.
- The UI offers an explicit retry that reuses the same create request UUID for a
  create retry and calls the same code-based join for a join retry.
- Raw exception messages, SQLSTATE values, relation names, and stack traces are
  never rendered to users.
- Button disabling and an in-flight client guard prevent accidental duplicate
  submissions, while database idempotency and locking remain authoritative.

## SQL Privilege Contract

The migration performs all of the following:

1. makes the non-client local migration role `postgres` the owner, revokes that
   owner's default function execution in `public` from `PUBLIC`, and never
   transfers ownership to a client role;
2. revokes `EXECUTE` on both exact signatures from `PUBLIC`, `anon`, and
   `authenticated`;
3. grants `EXECUTE` on both exact signatures only to `authenticated`;
4. uses `SECURITY DEFINER` only for these controlled mutations;
5. pins an empty search path and schema-qualifies every relation and non-built-in
   function reference;
6. explicitly rejects null `auth.uid()` inside each body, independently of ACLs;
7. accepts no caller-controlled identity, table name, SQL fragment, or room UUID
   and uses no dynamic SQL;
8. leaves the client without table `INSERT`, `UPDATE`, or `DELETE` privilege; and
9. puts no service-role or secret key in the client.

RLS does not authorize the definer body and is tested separately as the read
boundary. pgTAP executes exact function ACLs, signed-out rejection,
authenticated success, RLS visibility after results, two-session idempotent and
final-seat races, information disclosure, and non-mutating failure paths. Test
fixtures may be created by the local test owner, but calls under test use real
`anon`/`authenticated` roles and claims, never `service_role`.
