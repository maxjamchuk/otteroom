import { acceptedRoomState, createErrorState, joinRoomState, joinErrorState, malformedInvitationState } from '../../src/rooms/state';
import { narrowCreateResult, narrowJoinResult } from '../../src/rooms/contracts';

const row = { outcome: 'created', room_id: '11111111-1111-4111-8111-111111111111', room_code: 'ABCDEF0123', participant_role: 'host', room_state: 'waiting', participant_count: 1 };
it('projects accepted host Waiting with internal identity retained only in local model', () => {
  expect(acceptedRoomState(narrowCreateResult([row]))).toEqual({ kind: 'accepted', id: row.room_id, code: row.room_code, role: 'host', state: 'waiting', title: 'Waiting', count: 1 });
});
it('maps current authoritative host Ready recovery without later behavior', () => {
  const result = narrowJoinResult([{ ...row, outcome: 'already_member', room_state: 'ready', participant_count: 2 }]);
  if (result.outcome !== 'already_member') throw new Error('Unexpected fixture');
  expect(acceptedRoomState(result)).toEqual({ kind: 'accepted', id: row.room_id, code: row.room_code, role: 'host', state: 'ready', title: 'Ready', count: 2 });
});
it('create failure contains only generic retry presentation, never a room/invitation', () => {
  expect(createErrorState()).toEqual({ kind: 'error', message: 'Unable to create your room. Please try again.' });
});
it.each([
  ['joined', 'guest', 'ready', 2], ['already_member', 'guest', 'ready', 2],
  ['already_member', 'host', 'waiting', 1], ['already_member', 'host', 'ready', 2],
])('maps accepted join %# without effects', (outcome, participant_role, room_state, participant_count) => {
  const result = narrowJoinResult([{ ...row, outcome, participant_role, room_state, participant_count }]);
  expect(joinRoomState(result)).toEqual({ kind: 'accepted', id: row.room_id, code: row.room_code, role: participant_role, state: room_state, title: room_state === 'ready' ? 'Ready' : 'Waiting', count: participant_count });
});
it.each([
  ['invalid_code', 'malformed', 'Malformed invitation. Enter a valid room code.'],
  ['not_found', 'not-found', 'Room not found. Check your invitation.'],
  ['full', 'full', 'Room Full. This room already has two participants.'],
])('maps %s with no room projection', (outcome, kind, message) => {
  const result = narrowJoinResult([{ outcome, room_id: null, room_code: null, room_state: null, participant_role: null, participant_count: null }]);
  expect(joinRoomState(result)).toEqual({ kind, message });
});
it('distinguishes local malformed input from generic infrastructure failure', () => {
  expect(malformedInvitationState()).toEqual({ kind: 'malformed', message: 'Malformed invitation. Enter a valid room code.' });
  expect(joinErrorState()).toEqual({ kind: 'error', message: 'Unable to open this room. Please try again.' });
});
