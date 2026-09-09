# Data Model: First Shared Movie Candidate

**Feature**: `002-first-movie-candidate`
**Authority**: Existing local PostgreSQL 17
**New application tables**: Exactly one, `public.movie_candidates`
**Existing table extension**: Exactly one nullable column on `public.rooms`

All schema/data changes below are planned for versioned migrations. No migration
or fixture asset is created by this planning workflow.

## Catalog: public.movie_candidates

| Field | SQL type | Null/default | Meaning and validation |
| --- | --- | --- | --- |
| id | text | NOT NULL, no default | Stable primary key; lowercase hyphenated slug |
| title | text | NOT NULL, no default | Display title; trimmed and nonempty |
| release_year | smallint | NOT NULL, no default | Integer display year, 1888 through 9999 |
| poster_key | text | NOT NULL, no default | Unique lowercase hyphenated key into the static bundled registry; never a URL |
| sort_order | integer | NOT NULL, no default | Unique positive ordering for deterministic fixture selection |

The static year bound is a technical fixture validation rule. All four selected
years fall within it; no product catalog or future metadata rule is established.

| Constraint | Definition |
| --- | --- |
| movie_candidates_pkey | PRIMARY KEY (id) |
| movie_candidates_id_format_check | id matches `^[a-z0-9]+(-[a-z0-9]+)*$` |
| movie_candidates_title_check | title equals btrim(title) and length(btrim(title)) > 0 |
| movie_candidates_release_year_check | release_year BETWEEN 1888 AND 9999 |
| movie_candidates_poster_key_format_check | poster_key matches `^[a-z0-9]+(-[a-z0-9]+)*$` |
| movie_candidates_poster_key_key | UNIQUE (poster_key) |
| movie_candidates_sort_order_check | sort_order > 0 |
| movie_candidates_sort_order_key | UNIQUE (sort_order) |

Primary/unique constraints supply the required indexes. No sequence, timestamp,
provider identifier, metadata extension, catalog mutation RPC, or extra table is
introduced. Title uniqueness is not an identity rule.

## Exact Versioned Fixture Rows

| id | title | release_year | poster_key | sort_order |
| --- | --- | ---: | --- | ---: |
| fixture-cardboard-comet | The Cardboard Comet | 2020 | cardboard-comet | 10 |
| fixture-pebble-bay-lanterns | Lanterns of Pebble Bay | 2021 | pebble-bay-lanterns | 20 |
| fixture-cloud-tram-four | Cloud Tram Number Four | 2022 | cloud-tram-four | 30 |
| fixture-clockwork-orchard | The Clockwork Orchard | 2023 | clockwork-orchard | 40 |

All four are fictional project fixtures. Each poster_key maps to exactly one
`assets/candidates/<poster_key>.png`, an original 240×360 PNG at most 64 KiB.
The versioned SQL migration is the only runtime metadata catalog; the client
registry duplicates only the necessary key-to-asset relationship.

Catalog IDs, titles, years, poster keys, ordering, and PNG contents remain fixed
through Feature 002. Application actors cannot modify them. A later intentional
catalog change requires its own reviewed scope/compatibility decision; it is
not a maintenance operation supplied here.

## Existing rooms Extension

| Field | Type | Null/default | Relationship |
| --- | --- | --- | --- |
| movie_candidate_id | text | Nullable, no default (NULL on existing/new rooms) | References movie_candidates.id |

Add these named constraints:

| Name | Definition |
| --- | --- |
| rooms_movie_candidate_id_fkey | FOREIGN KEY (movie_candidate_id) REFERENCES public.movie_candidates(id) ON UPDATE NO ACTION ON DELETE RESTRICT |
| rooms_candidate_requires_guest_check | CHECK (movie_candidate_id IS NULL OR guest_user_id IS NOT NULL) |

Use guest occupancy directly in the check. Existing generated state continues to
mean waiting for a null guest and ready otherwise. There is no state-column
mutation or separate membership representation.

Do not add title/year/poster snapshots, a join table, an assignment timestamp,
another room identifier, or an extra rooms FK index for this four-row catalog
with no reverse-lookup/deletion workload.

The assignment branch alone writes movie_candidate_id and
`updated_at = pg_catalog.transaction_timestamp()`. Existing create/join
membership writes remain unchanged. Repeated available, not_ready, and not_found
outcomes do not update either field.

## Assignment Lifecycle

| Room state / assignment | Validity | Allowed next behavior |
| --- | --- | --- |
| Waiting + NULL | Valid; zero authoritative candidates | Existing guest join can make room Ready; candidate RPC returns not_ready to the host |
| Waiting + non-NULL | Forbidden by named CHECK | No application transition |
| Ready + NULL | Valid transient state | Member RPC may establish the first candidate |
| Ready + assigned | Valid terminal Feature 002 assignment | Return the existing catalog record; reads/recovery do not write |
| Assigned A → assigned B | Forbidden by application/RPC contract | No replacement operation |
| Assigned → NULL | Forbidden by application/RPC contract | No clearing operation |
| Ready → Waiting or participant replacement | Outside existing authorized room behavior | No new transition |

At-most-one follows from the single column. Once-established immutability follows
from the only permitted mutation path and lack of client table write privileges.
No additional trigger is needed to police privileged administrative SQL, which
is not a participant operation.

## Grants, RLS, and Publication

| Surface | PUBLIC | Signed-out anon | Authenticated participant |
| --- | --- | --- | --- |
| movie_candidates direct SELECT/INSERT/UPDATE/DELETE | None | None | None |
| rooms direct SELECT | None | None | Existing id, code, state only; membership RLS |
| rooms movie_candidate_id direct SELECT | None | None | None |
| rooms direct mutations | None | None | None |
| ensure_room_candidate(uuid) EXECUTE | None | None | Granted; body enforces membership |

The schema migration explicitly revokes all privileges on the new table from
PUBLIC, anon, authenticated; enables RLS; and creates no normal client catalog
policies. The postgres owner can access the catalog within the hardened definer.
The new field receives no room-column grant. Preserve existing room RLS and the
exact authenticated column projection rather than broadening SELECT.

The existing publication remains `public.rooms` only. The candidate catalog is
not published. The one existing room channel selects id for invalidation and
refetches id/code/state; candidate metadata is returned exclusively by RPC.

## Atomic Assignment and Failure

The authorized function locks one exact rooms row before inspecting assignment,
then returns its existing catalog record or chooses the row with the smallest
unique sort_order. It updates the FK/timestamp once in the same transaction.
The next concurrent locker sees and returns that persisted FK. No candidate is
selected independently before obtaining the room lock.

An exception rolls back the function's changes. A successfully committed
assignment whose response is lost remains authoritative. Retry returns it.
Catalog-empty or impossible missing-reference conditions are exceptional, with
no alternate selection or normal business outcome.

A poster error affects presentation only. It cannot clear or replace the room FK.

## Migration and Type Lifecycle

1. `20260909000000_movie_candidates_schema.sql` atomically installs table,
   constraints, denied catalog surface, four rows, room field, and FK/check.
2. `20260909000001_room_candidate_rpc.sql` installs the exact RPC/security.
3. After the final reset, intentionally generate/check the canonical public
   database types; normal validation then checks without rewriting.

Existing room RPC signatures/results do not change. Their use of rooms%ROWTYPE
can accommodate the appended nullable field while their result projection stays
explicit. Existing schema tests receive additive expectations, including a
second application table and third rooms FK; publication expectations remain
unchanged.

## Validation References

[RPC contract](contracts/candidate-rpc.md) specifies result types, locking,
authentication, no-write repeats, and deterministic real-session proof.
[quickstart.md](quickstart.md) binds pgTAP, client, browser, and fresh-checkout
evidence to all 17 acceptance scenarios.
