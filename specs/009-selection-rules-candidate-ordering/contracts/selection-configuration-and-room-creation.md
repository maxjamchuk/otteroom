# Contract: Selection Configuration and Room Creation

**Feature**: 009 — Selection Rules and Candidate Ordering  
**Status**: Planned replacement of the direct authenticated creation boundary

## Startup Configuration

Canonical server-only repository file:

```text
config/selection-rules.yaml
```

Accepted fields:

| YAML field | Required | Accepted value | Omission |
| --- | --- | --- | --- |
| `minimum_vote_count` | yes | non-negative safe integer | startup failure |
| `metadata_language` | yes | canonical supported TMDB primary-translation IETF tag | startup failure |
| `ordering` | no | `vote_count_desc`, `average_rating_desc`, `popularity_desc`, `title_asc` | `vote_count_desc` |
| `minimum_average_rating` | no | finite number in inclusive `0..10` | no cutoff |
| `genre_mode` | no | `or`, `and` | `or` |
| `larger_group_agreement` | no | exact ASCII `p/q`, `0 < p <= q` | exact `2/3` |

The approved initial canonical file supplies `minimum_vote_count: 500`,
`metadata_language: en-US`, `ordering: vote_count_desc`, `genre_mode: or` and
`larger_group_agreement: 2/3`. The approved no-rating-cutoff value is represented by
omitting `minimum_average_rating`, not by explicit `null`. These are editable
operational values activated only by successful rebuild/redeploy/restart; existing
rooms retain their snapshots.

Missing/empty files, malformed or multi-document YAML, duplicate keys,
aliases/anchors/custom tags, a non-mapping root, unknown fields, explicit `null`,
wrong types, non-finite values, unsupported literals, unsupported language tags,
invalid fractions and values outside domains are errors. No invalid explicit field
receives a default.

The parser reduces the fraction to a signed-32-bit positive integer pair and freezes
the complete value once during server module initialization. Diagnostics identify the
invalid field by fixed code but do not echo raw YAML or parsed values. No environment
variable or request can reload or override the value.

Server build/deploy tooling bundles the exact canonical file into both Edge
artifacts. The build fails if it is missing, differs from the repository file or is
included in a client artifact. Editing YAML has no effect on a running process;
changed rules require a successful rebuild/redeploy and restart. There is no watcher,
hot reload, admin/configuration UI, runtime configuration service or user setting.

## Public Edge Operation: `room-create`

### Request

```http
POST /functions/v1/room-create
Authorization: Bearer <Supabase access token>
Content-Type: application/json
```

Exact body:

```json
{
  "creation_request_id": "uuid",
  "required_voter_count": 2,
  "creator_is_voter": true
}
```

The numeric value is illustrative of the existing Feature 003 input, not a new
Feature 009 tuning value. Unknown/missing/body-type errors are invalid requests.
Rules, actor/user/member IDs and room codes are never accepted.

### Authentication and authorization

The function validates the Bearer token through the same Supabase Auth boundary as
`room-candidate`, extracts its subject UUID and passes that actor only to the private
RPC. A caller cannot select another actor. Startup configuration must already have
validated before the handler exists.

### Successful response

HTTP 200 returns the same exact safe fields and meanings as the current create RPC,
as one object rather than a PostgREST row array:

```text
outcome: created | already_created
room_id: uuid
room_code: canonical code
room_state: waiting | ready
is_creator: true
is_voter: boolean
voter_count: integer
required_voter_count: integer
filter_completed_count: integer
filter_resolution_status: pending | compatible | incompatible
candidate_acquisition_status: pending | assigned | no_candidates
candidate_progression_status: inactive | collecting | advancing | agreed | exhausted
candidate_sequence: non-negative integer
decision_completed_count: non-negative integer
```

For `created`, all post-membership fields must describe a fresh room exactly as the
existing create contract requires. `already_created` returns the persisted room and
does not reveal its protected rule row.

### Safe errors

| HTTP | Body | Meaning |
| ---: | --- | --- |
| 204 | empty | OPTIONS |
| 400 | `{ "error": "invalid_request" }` | malformed request |
| 401 | `{ "error": "authentication_required" }` | invalid/missing session |
| 405 | `{ "error": "method_not_allowed" }` | wrong method |
| 503 | `{ "error": "room_creation_unavailable" }` | RPC/internal failure |

No response includes config, rule version, fraction, cutoff, language, predicate,
service credential or raw error.

## Server-Only Creation RPC

Conceptual signature (exact SQL naming may follow repository conventions):

```text
public.create_room_with_selection_rules(
  p_actor_user_id uuid,
  p_creation_request_id uuid,
  p_required_voter_count integer,
  p_creator_is_voter boolean,
  p_rule_set_kind text,
  p_candidate_ordering text,
  p_minimum_vote_count bigint,
  p_minimum_average_rating numeric,
  p_metadata_language text,
  p_genre_mode text,
  p_agreement_numerator integer,
  p_agreement_denominator integer
)
```

Execution is revoked from PUBLIC, `anon` and `authenticated` and granted only to
`service_role`. The function is postgres-owned `SECURITY DEFINER` with empty
`search_path`, fully qualified objects and fixed validation failures.

### Atomic new-room behavior

For a new `(actor, creation_request_id)`:

1. validate actor and existing Feature 003 creation inputs;
2. validate the complete configured snapshot shape/ranges/normalization;
3. allocate the room code under the established bounded collision loop;
4. insert room;
5. insert creator membership; and
6. insert exactly one `configured_009_v1` rule row.

All effects commit or roll back together.

### Retry behavior

For an existing `(actor, creation_request_id)`, return its current safe room result
with zero writes. Do not compare current config to the stored snapshot, rewrite
timestamps or insert/repair a missing rule row. Missing/incoherent stored rules are an
integrity failure, not permission to apply current configuration.

Concurrent A/B requests for the same idempotency key retain the established unique
winner. The losing transaction returns that winner and its persisted snapshot remains
the one inserted atomically by the winner.

## Cutover

- Drop or revoke authenticated execution of the old direct `create_room` signature
  in the same migration that creates/backfills snapshots.
- `join_room`, safe room SELECT and rooms-only Realtime remain direct and unchanged.
- Client create parsing becomes object-based and strict; room UI behavior remains
  unchanged.
- No post-cutover SQL path can create a room without a snapshot.

## Startup/Restart Acceptance Matrix

| Condition | Required outcome |
| --- | --- |
| Valid complete config | Both server handlers construct; new rooms get exact normalized snapshot |
| Approved optional field omitted | Exact approved default/no-cutoff only |
| Required field absent | Startup failure; no handler served |
| Explicit field malformed/unsupported | Startup failure; no fallback |
| Canonical YAML edited while running | Existing frozen object remains active |
| Rebuild/redeploy/restart A -> B | Old rooms keep A; new rooms get B |
| Failed restart with invalid B | New process serves nothing; persisted rooms remain unchanged |
| Lost create response under A, retry after B | `already_created` room retains A |
