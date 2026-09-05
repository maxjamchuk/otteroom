# Data Model: Create and Join a Two-Person Room

**Feature**: `001-room-session`
**Database**: Supabase-CLI-managed local PostgreSQL 17
**Application tables introduced**: exactly one, `public.rooms`

Supabase-managed `auth.users` provides participant identity. It is platform
infrastructure, not an application-owned participant table. No participant,
membership, invitation, session, event, history, or audit table is introduced.

## Required Extension

The migration enables `pgcrypto` in Supabase's `extensions` schema. The
`create_room` function obtains five bytes from
`extensions.gen_random_bytes(5)` and uppercases their hexadecimal encoding to
produce an unpredictable ten-character room code.

## `public.rooms`

| Column | PostgreSQL type | Null | Default / generation | Meaning |
|---|---|---:|---|---|
| `id` | `uuid` | No | `extensions.gen_random_uuid()` | Internal immutable room identity used for exact reads and Realtime filtering; never shown in UI |
| `code` | `text` | No | Supplied only by `create_room` | Canonical invitation code, exactly ten uppercase hexadecimal characters |
| `creation_request_id` | `uuid` | No | None | Client-generated idempotency key scoped to the host |
| `host_user_id` | `uuid` | No | None | First seat; foreign key to `auth.users(id)` |
| `guest_user_id` | `uuid` | Yes | `NULL` | Second seat; foreign key to `auth.users(id)` when occupied |
| `state` | `text` | No | Stored generated expression | `waiting` when `guest_user_id IS NULL`, otherwise `ready` |
| `created_at` | `timestamptz` | No | `pg_catalog.transaction_timestamp()` | Room creation instant |
| `updated_at` | `timestamptz` | No | `pg_catalog.transaction_timestamp()` | Last accepted membership transition; assigned to the joining transaction timestamp only when the guest seat is filled |

The generated expression is equivalent to:

```sql
CASE
  WHEN guest_user_id IS NULL THEN 'waiting'::text
  ELSE 'ready'::text
END
```

`state` is `GENERATED ALWAYS ... STORED`; no caller can insert or update it
independently.

No timestamp trigger is used. `create_room` relies on the two table defaults;
the sole accepted post-create mutation in `join_room` explicitly assigns
`updated_at = pg_catalog.transaction_timestamp()`. Idempotent, invalid,
not-found, and full outcomes leave `updated_at` unchanged.

## Constraints

| Name | Definition | Invariant enforced |
|---|---|---|
| `rooms_pkey` | `PRIMARY KEY (id)` | Stable internal identity |
| `rooms_code_key` | `UNIQUE (code)` | One room per canonical code and collision authority |
| `rooms_host_creation_request_key` | `UNIQUE (host_user_id, creation_request_id)` | A repeated create request from the same participant returns one room |
| `rooms_code_format_check` | `CHECK (code ~ '^[0-9A-F]{10}$')` | Stored codes are canonical and valid |
| `rooms_distinct_participants_check` | `CHECK (guest_user_id IS NULL OR guest_user_id <> host_user_id)` | One participant cannot hold both seats |
| `rooms_host_user_id_fkey` | `FOREIGN KEY (host_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT` | Every host is an Auth identity; membership is not silently deleted |
| `rooms_guest_user_id_fkey` | `FOREIGN KEY (guest_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT` | Every guest is an Auth identity; membership is not silently deleted |

Both foreign keys use `ON UPDATE NO ACTION` and `ON DELETE RESTRICT`. Anonymous
user cleanup would therefore have to remove dependent rooms first, but both room
expiration and anonymous-user cleanup are deployment concerns outside this
feature.

## Indexes

- `rooms_pkey` supplies the unique B-tree index used by exact internal-ID
  refetches and Realtime subscription filters.
- `rooms_code_key` supplies the unique B-tree index used by `join_room` lookup.
- `rooms_host_creation_request_key` supplies the unique B-tree index used by
  create idempotency checks and host lookups.
- `rooms_guest_user_id_idx` is a partial B-tree index on `guest_user_id WHERE
  guest_user_id IS NOT NULL` for the guest side of membership-scoped reads.

The RLS predicate's host equality can use the leading `host_user_id` column of
`rooms_host_creation_request_key`; its guest equality can use
`rooms_guest_user_id_idx`. No duplicate index is added for `code`, `id`, or the
already-indexed host column.

The exact unique-constraint names are part of the RPC implementation contract.
`create_room` reads PostgreSQL's stacked `CONSTRAINT_NAME` diagnostic and never
guesses a conflict from the absence or presence of an arbitrary row.

## Room-Code Contract

1. User input is trimmed at both ends and uppercased.
2. The normalized value is valid only if it matches `^[0-9A-F]{10}$`.
3. The client performs the same normalization and format check for immediate
   feedback, but that check grants no authority.
4. `join_room` repeats normalization and validation before reading or changing a
   room.
5. `create_room` generates five cryptographically random bytes on the server,
   hex-encodes them, and stores the uppercase result.
6. The unique constraint is authoritative. On a code collision, `create_room`
   generates another code and retries, up to five insert attempts. Exhaustion is
   an exceptional infrastructure failure and leaves no partially created room.
7. Codes are not sequential and are not derived from `rooms.id`.
8. Generated invitation URLs use `/room/<CANONICAL_CODE>`.

## Creation Idempotency

The client creates one UUID when the user starts a create attempt and reuses it
for retries of that logical request. `create_room` first checks the unique
`(host_user_id, creation_request_id)` identity. If the room already exists, it
returns that room with outcome `already_created`.

Concurrent calls with the same host/request key can both initially see no row.
The unique index serializes their inserts. Inside the insert exception block the
losing call executes:

```sql
GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
```

- `rooms_host_creation_request_key` means the call waits for and then selects
  the committed row by `(host_user_id, creation_request_id)`, returning
  `already_created`; an unexpectedly absent row is re-raised rather than
  misclassified.
- `rooms_code_key` first repeats that same idempotency lookup, because one
  simultaneous logical request could collide on both keys. If no such row now
  exists, this is a true code collision and the function generates a new code.
- Any other constraint name is unexpected and is re-raised unchanged.

Each PL/pgSQL exception block is a subtransaction: the failed insert is rolled
back before the handler runs. PostgreSQL's unique-index wait resolves only after
the competing transaction commits or aborts, and the following statement under
the default Read Committed isolation sees the committed winner. The enclosing
function call either returns one complete row or fails atomically; it cannot
leave a partial room.

## State and Membership Transitions

`public.rooms` is the authoritative state owner. The only accepted membership
change after creation is filling a null `guest_user_id` through `join_room`.

| Current state | Caller and operation | Result | Next state | Data change |
|---|---|---|---|---|
| No row | Authenticated caller, new `create_room` request | `created`, caller becomes host | `waiting` | Insert one complete row |
| Existing row | Same host, same create request | `already_created` | Current `waiting` or `ready` | None |
| `waiting` | Existing host repeats `join_room` | `already_member` as host | `waiting` | None |
| `waiting` | Distinct authenticated caller joins | `joined` as guest | `ready` | Set `guest_user_id` and `updated_at = pg_catalog.transaction_timestamp()` atomically |
| `ready` | Existing host repeats `join_room` | `already_member` as host | `ready` | None |
| `ready` | Existing guest repeats `join_room` | `already_member` as guest | `ready` | None |
| `ready` | Third distinct caller joins | `full` | `ready` | None |
| Any | Malformed code | `invalid_code` | Unchanged | None |
| Any | Well-formed unknown code | `not_found` | Unchanged | None |

### Forbidden transitions

- `ready` to `waiting`;
- changing or clearing either occupied seat;
- replacing host or guest;
- setting `state` directly;
- creating a third seat;
- deleting a room as a participant operation;
- changing membership through Data API table writes; and
- starting any post-Ready behavior.

These transitions have no RPC and client roles receive no table mutation
privileges.

## Concurrency and Failure Preservation

`join_room` canonicalizes and validates its input, finds the row by its unique
code, and locks that row with `FOR UPDATE` before examining membership. The lock
order is deterministic because one canonical code identifies at most one row.
While the row is locked:

1. an existing host or guest is returned as `already_member`;
2. a null guest seat is filled for the caller; or
3. an occupied guest seat yields `full`.

Two distinct final-seat callers therefore serialize. Exactly one changes the
null guest seat; the next observes the committed occupant and receives `full`.
Concurrent duplicates from the same accepted guest resolve to `joined` plus
`already_member`, never two seats. PostgreSQL statement/transaction rollback
preserves the previous row on exceptions. Validation, unknown-code, existing
membership, and full-room outcomes perform no writes.

## RLS and SQL Grants

The migration enables RLS explicitly on `public.rooms`.

### Table privileges

| Role | `SELECT` | `INSERT` | `UPDATE` | `DELETE` |
|---|---|---|---|---|
| `PUBLIC` | None | None | None | None |
| signed-out `anon` | None | None | None | None |
| `authenticated` | Columns `id`, `code`, and `state` only, subject to RLS | None | None | None |

Before granting the narrow authenticated read, the migration uses
`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public` to revoke all
future table privileges from `anon` and `authenticated`, then explicitly revokes
all privileges on `public.rooms` from `PUBLIC`, `anon`, and `authenticated`.
`api.auto_expose_new_tables = false` supplies an additional local-configuration
default, but the migration ACLs remain authoritative. The client always uses the
exact projection `id, code, state`; it never uses `select('*')`.

### Row policy

One SELECT policy applies only to `authenticated` and allows a row when:

```sql
(SELECT auth.uid()) = host_user_id
OR (SELECT auth.uid()) = guest_user_id
```

There are no client-role insert, update, or delete policies. A signed-out `anon`
request has neither a table grant nor a policy. An unrelated authenticated user
fails the membership predicate and receives no row. An anonymous Supabase Auth
user has the `authenticated` role and can read only its own room. SQL column
grants and RLS are separate checks: pgTAP proves both a missing privilege and a
zero-row policy denial. The `id, code, state` grant is sufficient for the Data
API refetch and Realtime `select: ['id']`; participant UUID columns are never in
the normal client projection.

### Function privileges

- The local migration role `postgres` owns the two functions; ownership is never
  assigned to `PUBLIC`, `anon`, or `authenticated`. The migration revokes the
  owner's default `EXECUTE` privilege on future functions in the `public` schema
  from `PUBLIC` and also revokes each exact function signature explicitly.
- It revokes `EXECUTE` on both exact RPC signatures from `PUBLIC`, `anon`, and
  `authenticated`, then grants each exact signature only to `authenticated`.
- Each function verifies that `auth.uid()` is non-null even though SQL grants
  already deny `anon`.
- Both functions use `SECURITY DEFINER SET search_path = ''` and schema-qualify
  every relation and non-`pg_catalog` function, including `auth.uid()` and
  `extensions.gen_random_bytes()`; neither uses dynamic SQL.
- The definer owner can bypass caller RLS. Therefore the function bodies perform
  all caller, membership, capacity, mutation, and disclosure checks themselves;
  they do not claim that RLS authorizes definer-body table access. RLS is a
  separate boundary for the later Data API read and Postgres Changes delivery.
- No service-role or secret key participates in the client path.

Database tests exercise each allow and deny case rather than inferring safety
from migration text.

## Realtime Publication

A later versioned migration explicitly adds `public.rooms` to the
`supabase_realtime` publication after the schema and RPC checkpoints are green.
The addition is guarded by catalog inspection so a clean replay is deterministic
and does not depend on Dashboard configuration. No other application table is
published by this feature.

Authenticated room members subscribe to UPDATE events filtered by the exact
internal `id`. Realtime delivery remains RLS-constrained. Event data is only an
invalidation signal; the client refetches `id, code, state` through the Data API
and applies that authoritative result.

## Invariant Summary

- Exactly one non-null host exists per room.
- Zero or one guest exists per room, and the guest differs from the host.
- Capacity cannot exceed two because no third membership field or mutation path
  exists.
- `state` is a non-writable function of guest-seat occupancy.
- One logical create request per host produces one room.
- One canonical code identifies at most one room.
- Only database functions can create or change membership.
- Rejected business outcomes and exceptional rollbacks preserve membership and
  state.
- Only accepted members can read the room's client-visible projection.
