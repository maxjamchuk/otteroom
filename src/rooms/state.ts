import type { AcceptedRoomResult } from './contracts';

export function acceptedRoomState(result: AcceptedRoomResult) {
  return {
    kind: 'accepted' as const,
    id: result.room_id,
    code: result.room_code,
    role: result.participant_role,
    state: result.room_state,
    title: result.room_state === 'waiting' ? 'Waiting' : 'Ready',
    count: result.participant_count,
  };
}
export type AcceptedRoomState = ReturnType<typeof acceptedRoomState>;
export function createErrorState() {
  return { kind: 'error' as const, message: 'Unable to create your room. Please try again.' };
}
