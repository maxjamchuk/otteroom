# Data Model: Participant Filters

**Authority**: PostgreSQL 17 after the Feature 004 additive migration.
**New relation**: `public.participant_filters`.
**New enum**: `public.participant_genre`.
**Evolved relation**: `public.rooms` gains one aggregate column.

This model stops at individual accepted filters and the durable N/N handoff. It
contains no resolved constraints, candidate eligibility, TMDB data or movie
selection state.

## `public.participant_genre`

The database enum and TypeScript wire values are:

| Stored value | Display label |
| --- | --- |
| `action` | Action |
| `adventure` | Adventure |
| `animation` | Animation |
| `comedy` | Comedy |
| `crime` | Crime |
| `documentary` | Documentary |
| `drama` | Drama |
| `family` | Family |
| `fantasy` | Fantasy |
| `history` | History |
| `horror` | Horror |
| `music` | Music |
| `mystery` | Mystery |
| `romance` | Romance |
| `science_fiction` | Science Fiction |
| `tv_movie` | TV Movie |
| `thriller` | Thriller |
| `war` | War |
| `western` | Western |

The enum declaration order is the canonical stored/returned order. Empty array
means Any genre. A submission may contain any unique subset in any order; the
RPC rejects duplicates and canonicalizes accepted storage. This vocabulary is
application state only, not a movie catalog and not a TMDB API integration.

## Evolved `public.rooms`

All Feature 003 columns, keys and meanings remain. Add only:

| Column | SQL type / nullability | Default | Purpose |
| --- | --- | --- | --- |
| `filter_completed_count` | integer NOT NULL | `0` | Number of distinct voting memberships with an accepted filter row |

New checks:

| Constraint | Invariant |
| --- | --- |
| `rooms_filter_completed_count_check` | `filter_completed_count >= 0 AND filter_completed_count <= required_voter_count` |
| `rooms_filters_require_assembled_check` | `filter_completed_count = 0 OR voter_count = required_voter_count` |

Room-wide filter semantics:

- denominator = immutable `required_voter_count`;
- numerator = `filter_completed_count`;
- collecting = membership `state='ready'` and numerator < denominator;
- all-voters-complete/frozen = numerator = denominator;
- membership `state` continues to mean only Waiting/Ready assembly and is not
  renamed or overloaded as filter/candidate readiness;
- neither value depends on connected devices;
- the numerator never decreases and never changes for a valid replacement;
- direct client writes remain denied.

Committed cross-table invariant:

```text
rooms.filter_completed_count
  = count(participant_filters rows whose room_member is in that room and is_voter=true)
```

The sole submission RPC maintains both sides under the room row lock in one
transaction. Migration verification and database tests compare both sides; no
separate trigger, boolean or cached roster is another authority.

The authenticated rooms SELECT projection becomes exactly:

```text
id, code, state, voter_count, required_voter_count, filter_completed_count
```

All-complete is derived as `filter_completed_count === required_voter_count`.
`movie_candidate_id`, creator/auth IDs and timestamps remain private.
`rooms.updated_at` evolves to include a first accepted filter contribution as a
shared room transition. A private replacement/no-op does not touch it.

## New `public.participant_filters`

| Column | SQL type / nullability | Default | Meaning |
| --- | --- | --- | --- |
| `room_member_id` | uuid NOT NULL | none | Owner; also the primary key and FK to `room_members(id)` |
| `genres` | `participant_genre[]` NOT NULL | `'{}'` | Canonically ordered unique genre slugs; empty means Any |
| `release_year_from` | smallint NOT NULL | none | Inclusive lower year |
| `release_year_to` | smallint NOT NULL | none | Inclusive upper year |

Constraints:

| Constraint | Definition / guarantee |
| --- | --- |
| `participant_filters_pkey` | PRIMARY KEY (`room_member_id`), therefore one current set and contribution per member |
| `participant_filters_room_member_id_fkey` | `room_member_id` → `room_members(id)`, ON UPDATE NO ACTION, ON DELETE CASCADE |
| `participant_filters_genres_unique_check` | Array is one-dimensional, contains no NULL and has no duplicate enum value |
| `participant_filters_release_year_check` | `1900 <= release_year_from AND release_year_from <= release_year_to AND release_year_to <= 9999` |

`private.valid_participant_genres(public.participant_genre[])` is an `IMMUTABLE
STRICT SECURITY INVOKER` SQL helper used only by the genre CHECK. It is owned by
postgres, has an empty `search_path`, and uses only schema-qualified or
`pg_catalog` references. Revoke its exact signature from PUBLIC, anon and
authenticated and grant it to no client role. It accepts the zero-length array,
rejects multidimensional arrays, NULL elements and duplicates, and relies on the
enum type itself for the fixed vocabulary.

The write RPC additionally rejects `release_year_to` above the year extracted
from `transaction_timestamp() AT TIME ZONE 'UTC'`. Recovery/submission return
that same authoritative maximum to the client. The write always supplies an
explicit genre array and both bounds.
No completion flag is stored: existence is completion. No `room_id`, user/Auth
ID, resolved value, compatibility result, movie ID, timestamps or draft is stored.

The FK cascade matters only for privileged whole-room cleanup because client
membership removal is outside scope. There is no client delete/unsubmit API.

## Relationships and ownership

```text
rooms (1)
  └── room_members (fixed assembled membership, 1..N voters plus creator membership)
        └── participant_filters (0..1 per member; production rows only for voters)
```

- Owner identity is resolved server-side by joining `auth.uid()` to
  `room_members.user_id` in the requested room.
- A voting creator and a normal voter use the same ownership rule.
- A non-voting creator has a member row but can never receive a filter row.
- A client cannot supply `room_member_id` or another user as a mutation target.
- Feature 005 may read all rows only through its future explicitly authorized
  server boundary; Feature 004 gives no participant such roster/detail access.

## Validation rules

### Genres

- NULL array: invalid.
- Empty array: valid Any genre and default.
- Each element: one of the 19 enum slugs.
- NULL element: invalid.
- Duplicate element: invalid, even if input order differs.
- Accepted unique inputs: stored/returned in enum declaration order.
- Selecting all 19 values is valid and remains distinct from empty Any genre.

### Years

- Both endpoints are required.
- Both are whole years representable as `smallint`.
- Lower bound is at least 1900.
- Upper bound is at most the server's current UTC year at submission time.
- Lower may equal upper; both ends are inclusive.
- Lower greater than upper is invalid.
- Default draft is 1900 through the server-returned current UTC year; defaults are not
  persisted and do not count until explicitly submitted.

### Structural/integrity failures

The RPC fails exceptionally, with rollback, if committed private state is
impossible, including a filter row for a non-voting member, an all-complete room
missing the caller's voter filter, or a room summary unequal to actual voting
filter rows when checked at a protected integrity boundary. Such failures are
not repaired, promoted or converted into another member/filter owner.

## Lifecycle and state transitions

| Initial authority | Operation | Mutation | Result |
| --- | --- | --- | --- |
| Membership Waiting | Any recovery | None | `not_ready`; no form/save and count remains 0 |
| Membership Waiting | Any submit | None | `not_ready`; no validation state accepted |
| Ready, non-voting creator | Recovery/submit | None | `not_voter`; aggregate remains observable through room projection |
| Ready voter, no row, X<N | Recovery | None | `not_submitted`; client uses default draft |
| Ready voter, no row, X<N | Valid submit | Insert own row + room count/timestamp UPDATE | `saved`, X becomes X+1 |
| Ready voter, row, X<N | Same canonical submit | None | `unchanged`, X unchanged |
| Ready voter, row, X<N | Different valid submit | Update own row only | `saved`, X unchanged |
| Ready voter, X<N | Invalid submit | None | Specific validation outcome; accepted row/count unchanged |
| Ready voter, final new row, X=N-1 | Valid submit | Insert own row + room count/timestamp UPDATE | `saved`, count becomes N atomically and all rows freeze |
| Ready voter, X=N, same canonical values | Retry | None | `unchanged`, accepted values recovered |
| Ready voter, X=N, different valid values | Edit | None | `locked`, current accepted values returned |
| Ready voter, X=N, invalid function-level payload | Edit | None | `locked`, current accepted values returned; an uncastable enum is a no-write transport rejection |
| Disconnect/reconnect/re-entry | Recovery | None | Same membership, own accepted row if voter, same X/N |
| New voter after assembly | Feature 003 join | None | `full`; filters/count unchanged |

There is no transition from complete to incomplete, no filter deletion, no
post-N/N mutation, and no automatic transition to common resolution or candidate.

## Concurrency ordering

Every submitting transaction locks the same room before consulting or changing
filter state. The relevant serial histories are:

```text
two distinct new voters: A insert/count → B insert/count (or B → A)
edit vs final:             edit commit → final insert/freeze
                         | final insert/freeze → edit returns locked
same voter duplicate:     one insert/count → equal no-op (or locked different retry)
```

Because validation and ownership happen within one transaction, failure rolls
back both the filter and room summary. No caller observes a committed filter row
without its completion contribution or a committed contribution without its row.

## Migration from exact Feature 003 schema

Use one new versioned transaction after
`20260910000000_generalized_room_membership.sql`; do not edit historical migrations.

1. Lock/alter `rooms` to add `filter_completed_count` with default 0 and checks.
2. Create the enum, filter table and the exact private helper with the
   ownership/security/ACL properties specified above.
3. Owner/RLS/revoke the filter table; add no client policy and no publication.
4. Recreate `create_room` and `join_room` for the added aggregate return field;
   keep all existing membership ordering, outcomes and invariants.
5. Revoke authenticated execution of `ensure_room_candidate(uuid)`.
6. Add and harden the exact recovery/submission RPCs.
7. Replace rooms column grants with the six approved projection fields.
8. Verify count/filter/member consistency, creator membership, unchanged room/
   member/candidate data and rooms-only publication; notify PostgREST schema reload.
9. Commit all changes together.

All existing rooms, including Waiting, Ready/unassigned and Ready/preassigned,
migrate to `filter_completed_count=0` with no filter rows. Preserve exact room IDs,
codes, creation requests, creator IDs, member rows/flags, required/voter counts,
membership state, timestamps and candidate FK. A preassigned candidate remains an
internal historical FK only: participants cannot execute its RPC or select its
metadata, and it does not affect filter progress or handoff.

## Final access matrix

| Surface | PUBLIC / anon | authenticated room member |
| --- | --- | --- |
| Six-field rooms SELECT | none | Own rooms only through existing member RLS |
| `participant_filters` direct SELECT/write | none | none |
| `room_members` direct SELECT/write | none | none |
| `movie_candidates` / hidden candidate FK | none | none |
| `get_my_participant_filter(uuid)` | no EXECUTE | EXECUTE; own detail or safe outcome only |
| `submit_my_participant_filter(...)` | no EXECUTE | EXECUTE; own voter row only |
| `create_room` / `join_room` | unchanged authenticated contract plus count field | authenticated only |
| `ensure_room_candidate(uuid)` | no EXECUTE | no EXECUTE |
| `private.valid_participant_genres(...)` | no EXECUTE | no EXECUTE; internal CHECK only |
| Realtime publication | n/a | `public.rooms` only; no detail/member/catalog table |

All public application functions are postgres-owned SECURITY DEFINER with empty
`search_path`, schema-qualified fixed SQL, explicit exact-signature revokes and
only the required authenticated grants. No service-role credential reaches the
client or browser tests.
