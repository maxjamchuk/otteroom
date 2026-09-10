# Contract: Generalized Room Projection and Realtime

## Authoritative read surface

After an accepted room RPC, `src/rooms/service.ts` reads exactly
`id, code, state, voter_count, required_voter_count` from public.rooms by the
accepted immutable ID. Require exactly one row; no select('*'). Validate exact
keys, matching id/code, integer bounds and state/count equality as in
[room-rpcs.md](room-rpcs.md). Required count cannot change within a room.

An approved client model contains id/code, waiting/ready, isCreator, isVoter,
voterCount, requiredVoterCount and display title. Booleans come from the accepted
RPC and stay fixed through refetch. Reload recovers them from join_room using
the same stored Auth identity. Counts are never inferred as Waiting=1 or Ready=2.

The room RPC must fail exceptionally if its persisted member projection would
be `is_creator=false AND is_voter=false`; that combination is invalid, not a
fourth member kind. A creator's missing membership likewise makes join recovery
fail exceptionally before capacity/admission. Neither path can infer new flags,
recreate membership or promote the creator. The client parser also rejects
false/false; failures use the existing generic recovery path without an accepted
projection or new business outcome. Refetch never repairs membership or flags.

Rooms SELECT RLS calls `private.is_room_member(id)`; the helper verifies only
the calling subject. All three member combinations are authorized, including
the non-voting creator. Member rows themselves cannot be read or changed by
ordinary clients. creator_user_id, member/user IDs, request ID, timestamps and
movie_candidate_id are outside the projection. An unrelated ID yields no room;
knowing an invitation alone does not authorize reads before admission.

## One publication and channel

The only application publication remains public.rooms in supabase_realtime.
Retain channel `room:<accepted ID>`, one postgres_changes binding for UPDATE,
schema public, table rooms, exact `id=eq.<ID>` filter and `select:['id']`.
No membership publication, roster event, Presence, Broadcast, polling or second
candidate/count channel is introduced.

New voter member INSERT and room count/updated_at UPDATE commit together. The
event invalidates state; only an RLS-authorized refetch publishes new count/state
to React. Candidate assignment may emit another room UPDATE; it is harmless
and does not imply another member or candidate acquisition.

## Existing lifecycle retained, generalized state applied

`src/rooms/use-room-subscription.ts` keeps its current lifecycle:

- Await the same Auth bootstrap; accepted RPC state is immediately visible.
- Register UPDATE/system listeners before subscribe. SUBSCRIBED confirms only
  transport. Current-generation system extension=postgres_changes/status=ok
  establishes binding readiness and triggers an immediate refetch every time.
- A matching UPDATE schedules/coalesces reads. At most one read is active with
  one pending follow-up. A pre-binding missed commit is recovered by system-ok
  refetch, including intermediate Waiting count changes.
- Guard callbacks/results by room, lifecycle and request sequence. A retired
  code generation cannot display even one frame of the prior room.
- Apply same-room counts monotonically: older lower counts, including
  Waiting→Waiting, cannot replace a higher accepted count. Ready never regresses.
  A changed target or mismatched identity is a contract error, not a new setting.
- System/channel error invalidates pending reads and preserves the last room
  with generic recovery UI. Reconnect needs a new system-ok/refetch; transport
  alone cannot mark recovered. Explicit retry removes the old channel before
  replacement. Removal failure remains recoverable, never opens a duplicate.
- Auth refresh uses the same client. No membership deletion, anonymous identity
  replacement or automatic signup loop follows disconnect.

## Room presentation

Display Waiting/Ready and `voterCount of requiredVoterCount voters` using actual
fields. Make the creator's voting/non-voting choice understandable; a new
non-voting creator displays 0/N. Do not show internal identities or a roster.
Show creator invitations after creation and recovery, including access when
Ready; retain ordinary Waiting invitation sharing for admitted members. Link
and QR use one derived invitation value, never stale route parameters. Showing
an invitation after assembly grants no extra slot: normal full/re-entry rules
still apply. No new non-voting admission flow or membership editing controls.

Existing candidate hook/card consumes only accepted ID and authoritative state;
generalized count updates do not create another acquisition source. Synchronization
failure and candidate/poster failures remain separate.

## Executable evidence

Update `__tests__/rooms/use-room-subscription.test.ts`, service/state tests and
`__tests__/routes/room.test.tsx` for 0/3→1/3→2/3→3/3, intermediate stale responses,
immutable flags/target, missed initial events and every existing lifecycle test.

Adapt `e2e/support/room-harness.ts` projection observers and retain its actual
WebSocket/system readiness barriers. G03 proves creator intermediate counts
without refresh, a previously admitted Waiting voter missing final assembly
then recovering Ready, and Ready disconnect continuity. G04 proves all four
clients including non-voting creator converge; G06 proves its own-invite
recovery before/after concurrent assembly. Existing E03/E07/E08/E12 preserve
missed-event, reconnect, retired-channel and unrelated subscription checks.

RLS plus Realtime source research supports this design, but real subscriber
delivery must pass in the cutover checkpoint. Inspect allowed flags/counts in
memory; no raw Auth/Realtime messages or private rows reach diagnostics.
