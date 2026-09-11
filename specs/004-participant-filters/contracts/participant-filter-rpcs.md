# Contract: Participant Filter RPCs

**Transport**: Existing typed `supabase-js` Data API client.
**Identity**: `auth.uid()` only; no user or member target argument.
**Owner**: PostgreSQL transaction and fixed `room_members` membership.

## Shared hardening

Both functions are `LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''`,
owned by postgres, use only schema-qualified fixed SQL and reject a NULL
`auth.uid()` with SQLSTATE 42501. Revoke exact signatures from PUBLIC, anon and
authenticated before granting EXECUTE only to authenticated. Table RLS/direct
grants remain an independent deny boundary.

Every business call returns exactly one row. An exceptional transport/integrity
failure returns no business row. Runtime parsers require exact cardinality,
exact keys, enum values, integer ranges, count bounds and the nullability matrix;
generated types alone are not logical validation.

All validation performed inside the function follows authorization so a foreign
caller cannot use business input errors to distinguish a missing room from
another member's room. PostgreSQL/PostgREST transport coercion can still reject
an unknown enum label or a value outside `smallint` before the function body;
those target-independent errors reveal no room state.

## Recover one's own accepted filter

```sql
public.get_my_participant_filter(p_room_id uuid)

RETURNS TABLE (
  outcome text,
  genres public.participant_genre[],
  release_year_from smallint,
  release_year_to smallint,
  filter_completed_count integer,
  required_voter_count integer,
  allowed_release_year_max smallint
)
```

The function uses one coherent read snapshot joining the room, the caller's
member row and (where applicable) only that member's filter row. It does not
insert a default, lock the room for mutation or expose a member/Auth ID.

| Outcome | When | Detail fields | Count fields / allowed maximum | Writes |
| --- | --- | --- | --- | --- |
| `not_found` | Missing room or caller is not a member | NULL | All NULL | None |
| `not_ready` | Caller is a member but membership is still Waiting | NULL | Current 0, required N and server year | None |
| `not_voter` | Caller is the non-voting creator of this room | NULL | Current X, required N and server year | None |
| `not_submitted` | Ready voter has no filter row and X<N | NULL | Current X, required N and server year | None |
| `saved` | Ready voter has an accepted row and X<N | Own canonical values | Current X, required N and server year | None |
| `locked` | Ready voter has an accepted row and X=N | Own canonical values | N, N and server year | None |

`not_found` deliberately masks missing versus foreign membership. An N/N voter
without a row, a non-voter with a row, a nonzero pre-assembly summary or a count
that disagrees with protected filter/member state is an integrity exception,
not a repair or extra business outcome. `not_voter` is valid only for the room's
creator whose immutable membership has `is_voter=false`; any non-creator
non-voting membership is likewise an integrity exception.

## Submit or replace one's own filter

```sql
public.submit_my_participant_filter(
  p_room_id uuid,
  p_genres public.participant_genre[],
  p_release_year_from smallint,
  p_release_year_to smallint
)

RETURNS TABLE (
  outcome text,
  genres public.participant_genre[],
  release_year_from smallint,
  release_year_to smallint,
  filter_completed_count integer,
  required_voter_count integer,
  allowed_release_year_max smallint
)
```

### Outcome and nullability matrix

| Outcome | Meaning | Detail fields | Count fields / allowed maximum | Writes |
| --- | --- | --- | --- | --- |
| `not_found` | Missing room or caller is not a member | NULL | All NULL | None |
| `not_ready` | Fixed voting group is not assembled | NULL | Current 0, required N and server year | None |
| `not_voter` | Caller is an authorized non-voting creator | NULL | Current X, required N and server year | None |
| `invalid_genres` | While X<N, NULL, duplicate or otherwise invalid genre array | NULL | Current X, required N and server year | None |
| `invalid_year_range` | While X<N, missing, below 1900, above current UTC year or reversed endpoints | NULL | Current X, required N and server year | None |
| `saved` | First accepted row or a different valid pre-lock replacement | Canonical accepted own values | Post-operation X/N and server year | Insert+room update for first save; own-row update only for replacement |
| `unchanged` | Canonical payload equals the accepted own row | Current accepted own values | Current X/N and server year | None |
| `locked` | Room is N/N and the parseable payload is not an equal valid retry | Current accepted own values | N/N and server year | None |

Transport rejection of an unknown enum string or an integer outside `smallint`
may occur before the function body. The service maps either to the matching safe
corrective genre/year message; it never renders a raw PostgREST/PostgreSQL error.
Normal client validation catches both earlier. Duplicate values are a
function-level `invalid_genres` outcome.

### Transaction order

1. Require authenticated subject and non-null room UUID transport type.
2. Select the exact room joined to `room_members` for `auth.uid()` and lock only
   that room `FOR UPDATE OF r`. No row means `not_found`; a foreign subject does
   not acquire an application room lock.
3. Reject membership Waiting as `not_ready`. Return `not_voter` only for the
   non-voting creator; treat any non-creator non-voting member as an integrity
   exception. Read the caller's existing filter row and confirm room/member/
   filter summary invariants; do not repair.
4. Compute `allowed_release_year_max` once from the transaction timestamp in UTC.
   If X=N, require the caller's row. A valid canonical payload exactly equal to
   that row returns `unchanged`; every other function-level edit attempt returns
   `locked` with the current row. No validation outcome can reopen editing.
5. While X<N, validate non-null/unique enum values and both year endpoints against
   the allowed maximum. Return a validation outcome with no write, then
   canonicalize valid genres into enum declaration order.
6. If the canonical payload exactly equals the existing row, return `unchanged`.
   This is the idempotent pre-lock lost-ack retry path.
7. If an own row exists, update only its three value fields and return
   `saved`, and do not update `rooms` because aggregate progress did not change.
8. Otherwise insert the one row keyed by the caller's membership, increment
   `rooms.filter_completed_count` once and set `rooms.updated_at` to the
   transaction timestamp. Return the canonical row and post-update X/N.
9. Commit row and summary together. Any exception rolls the entire operation
    back and a later retry re-evaluates authoritative state.

The first insert that changes X from N-1 to N is, in that same transaction, the
authoritative all-voters-complete/freeze transition. It performs no common
resolution and calls no candidate function.

## Retry, overlap and lost-response semantics

- Same identity + same canonical values: at most one filter insert and count
  contribution; all later calls are `unchanged` with no row version change.
- Same identity + different values before N/N: serialized replacements are
  allowed; each accepted call owns only that row and count remains one.
- Distinct identities: all calls serialize on their room, never exchange owner
  rows, and each new voter increments once.
- Response lost after commit: recovery returns `saved` or `locked`; an equal
  resubmission returns `unchanged` even if that accepted call completed N/N.
- Failure before commit: neither filter values nor room count changes.
- Edit racing final other-voter submit: room-lock order decides. Edit first is
  committed then frozen; final first freezes and the edit returns `locked`.
- All post-N/N function-level edit attempts except an equal valid retry return
  `locked`; disconnect, Realtime changes and late join attempts cannot reopen
  the period. A value that cannot be cast to the enum or `smallint` is rejected
  by transport before the function and likewise performs no write.

No request UUID is needed because the owner primary key, canonical equality and
room lock make the operation naturally idempotent.

## Client service boundary

Future client paths are feature-local, for example:

```text
src/filters/contracts.ts
src/filters/service.ts
src/filters/state.ts
src/filters/use-participant-filter.ts
src/filters/participant-filter-form.tsx
```

`service.ts` awaits the existing anonymous Auth bootstrap and passes only the
four declared arguments. It translates infrastructure/unknown-enum failures to
generic or corrective safe messages, never raw IDs, SQL or request dumps.

The state layer keeps separate values for:

- authoritative accepted filter returned by RPC/recovery;
- editable local draft;
- request generation/attempt;
- validation or generic failure.

It never increments X optimistically and never describes a draft as saved. On
success it adopts the exact canonical response. Route change, stale response,
effect replay and explicit retry follow the existing room/candidate generation
and single-flight test patterns without sharing state across rooms.

## Evolved create/join boundary

The existing `create_room(...)` and `join_room(text)` return tables add exactly
one field after `required_voter_count`:

```sql
filter_completed_count integer
```

Accepted outcomes have all nine fields non-null. Rejected join outcomes retain
only non-null `outcome`; all eight projection fields are NULL. New creation
returns 0. Existing-member re-entry returns the current stored value, including
N/N. All current outcome names, validation, membership lock order, creator flags,
capacity, retries and no-write semantics stay unchanged.

The client validates:

```text
0 <= filter_completed_count <= required_voter_count
filter_completed_count > 0 implies room_state == ready
```

It derives `filtersComplete` only from equality. Create/join never return filter
details and non-voting creators receive no extra private data.
