import { acceptedRoomState, createErrorState } from '../../src/rooms/state';
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
