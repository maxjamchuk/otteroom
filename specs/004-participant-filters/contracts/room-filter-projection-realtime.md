# Contract: Room Filter Projection and Realtime

## Authoritative aggregate read

After any accepted create/join and on every invalidation, `refetchRoom(roomId)`
selects exactly:

```text
id, code, state, voter_count, required_voter_count, filter_completed_count
```

RLS remains `private.is_room_member(id)`, so voting members and a non-voting
creator can read only their own room rows. There is no `select('*')`, filter
detail, member/user ID, roster, candidate FK or timestamp in the client projection.

Logical validation requires:

- matching immutable room ID and canonical code;
- integer `2 <= required_voter_count <= 2147483647`;
- integer `0 <= voter_count <= required_voter_count`;
- membership state equals Waiting below target and Ready at target;
- integer `0 <= filter_completed_count <= required_voter_count`;
- a positive filter count only when membership is Ready.

Same-room refetch adopts membership and filter counts monotonically. Delayed
lower counts cannot replace a higher accepted value; Ready cannot regress; N/N
cannot regress. A changed target, code, identity or invalid count combination is
a contract error rather than a new room state. The database remains authority;
monotonic guards only prevent stale response display.

The composed route owns one aggregate watermark across every exact validated
join, refetch, recovery and submission result. Any source may advance X/N, none
may regress it, and an observed N/N dominates every later-arriving X<N result.
Own-detail adoption is independently generation-guarded and never changes this
aggregate watermark.

## One unchanged invalidation channel

Retain exactly one channel per accepted route:

```text
channel: room:<accepted room UUID>
event: UPDATE
schema: public
table: rooms
filter: id=eq.<accepted room UUID>
selected payload: id only
```

Only `public.rooms` remains in `supabase_realtime`. Do not publish or subscribe
to `participant_filters`, `room_members` or `movie_candidates`; do not add
Presence, Broadcast, polling or a second filter channel.

Every first filter save commits the private row, room count and updated timestamp
together. The room UPDATE is only an invalidation signal. Each authorized client
refetches the RLS-limited room projection after commit and converges on X/N. The
final insert emits the same kind of event and refetch yields N/N. A private
replacement/no-op changes no shared aggregate, performs no rooms UPDATE and
therefore leaks no edit activity to other members.

The existing lifecycle remains binding:

- install UPDATE/system listeners before subscribing;
- treat SUBSCRIBED as transport-only and system postgres_changes/status=ok as
  binding readiness;
- refetch on every system-ok to recover a commit missed before binding;
- coalesce bursts to at most one active plus one pending read;
- guard room/lifecycle/request generations and discard stale results;
- preserve last accepted state on channel/read error with explicit retry;
- remove the prior channel before replacement and never open a duplicate after
  failed removal;
- reconnect with the same Auth client and membership; create no new identity.

An observer who misses 1/N may legitimately refetch directly to 2/N or N/N.
Every displayed value must be a valid authoritative snapshot; the client need
not replay every intermediate count.

## Own-filter refresh

For a voter, entry into membership Ready starts one own-filter recovery request.
Reload/re-entry calls the same read RPC. The rooms subscription does not publish
details. A room invalidation may schedule aggregate refetch only; the submitting
client adopts its own RPC response, while an explicit own-filter recovery retry
handles lost responses/errors. No requirement needs other tabs to receive a
private pre-lock edit live.

At N/N, a voter recovery returns their own row as `locked`; a non-voting creator
does not call detail recovery and sees only the aggregate handoff.

If N/N arrives while own-detail recovery is loading or failed, completion is
rendered immediately from the aggregate. The voter gets no editable/default
form; a separate read-only detail loading/error state and recovery retry remain
until the accepted own values arrive.

## Visible states

| Authority | Voter | Non-voting creator |
| --- | --- | --- |
| Membership Waiting | Waiting/count/invitation; no filter form or candidate | Same, contributes no slot |
| Ready, own recovery loading | Loading own filters plus authoritative X/N; no candidate | Not applicable; progress only |
| Ready, no own row, X<N | Editable Any + 1900..current-year draft | Progress only |
| Ready, own row, X<N | Saved values, editable replacement, saved/waiting and X/N | Progress only |
| Ready, submission error | Last accepted values remain authoritative; draft/error explicit | Progress unchanged |
| Ready, X=N | Own accepted values read-only; all collected / Feature 005 next | All collected / Feature 005 next |
| Synchronization error | Preserve last accepted aggregate/detail; disable new saves; separate room and own-detail retries | Preserve last aggregate; safe room retry |

No state renders or starts candidate, resolution, swipe, progression or match.

## Executable evidence

Client tests extend existing exact projection, monotonic count, system-ok,
missed-event, burst, stale-generation, reconnect and cleanup cases. Real browser
G03/G04 prove 0/3→1/3→2/3→3/3 and non-voting observer convergence; H cases prove
own recovery and final handoff. Tests assert normal routes issue zero candidate
RPCs at Waiting, Ready 0/N, partial and N/N.
